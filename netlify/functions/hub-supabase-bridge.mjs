/**
 * [Ghosti] 허브 SSO ↔ 귀신같이 단독 Supabase 인증 브릿지 (Netlify Function)
 *
 * 스키마(supabase/ghosti_zero_cloud_schema.sql 상단 [인증 브릿지] 주석) 설계 그대로 구현:
 *   ① 허브 `GET /api/auth/me`로 브라우저가 보낸 허브 토큰(merlin_session_token)을 서버에서 검증
 *   ② service_role로 public.users(id = 허브 family_users.id) Upsert  (RLS상 브라우저 직접 INSERT 불가)
 *   ③ 우리 프로젝트 JWT 시크릿으로 단기(1시간) 토큰 발급 (sub = 허브 userId, email, role = authenticated)
 *      → 브라우저는 이 토큰으로 RLS(`auth.jwt() ->> 'email'`) 보호 테이블에 접근
 *
 * 외부 패키지 0개 (fetch + node:crypto 만 사용).
 * 필요한 Netlify 환경변수: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, MERLIN_HUB_CLIENT_SECRET
 * 선택: MERLIN_HUB_URL (기본 https://os.sundreamer.app), MERLIN_HUB_CLIENT_ID, GHOSTI_ADMIN_PURGE_KEY
 */
import crypto from 'node:crypto';
import {
  handleAuthedWorkAndDeviceAction,
  handleDaemonWorkTunnelRefreshAction,
  handlePublicWorkPreviewAction,
} from './lib/workAndDeviceBridgeOps.mjs';

const HUB_URL = process.env.MERLIN_HUB_URL || 'https://os.sundreamer.app';
const HUB_CLIENT_ID = process.env.MERLIN_HUB_CLIENT_ID || 'APP-01';
const HUB_CLIENT_SECRET = (
  process.env.MERLIN_HUB_CLIENT_SECRET ||
  process.env.VITE_MERLIN_CLIENT_SECRET ||
  process.env.NEXT_PUBLIC_MERLIN_CLIENT_SECRET ||
  'merlin-family-secret-key-2026'
).trim();
const ADMIN_PURGE_KEY = (
  process.env.GHOSTI_ADMIN_PURGE_KEY ||
  process.env.MERLIN_HUB_CLIENT_SECRET ||
  ''
).trim();
const TOKEN_TTL_SEC = 60 * 60;
const PHOTO_SEED_TTL_DAYS = 14;
const PHOTO_SEED_TTL_MS = PHOTO_SEED_TTL_DAYS * 24 * 60 * 60 * 1000;
const HUB_VERIFY_CACHE_TTL_MS = 45 * 1000;
const verifiedHubUserCache = new Map();
let lastAutoPurgeAtMs = 0;

const ALLOWED_EXACT_ORIGINS = new Set([
  'https://sundreamer.app',
  'https://merlincode.com',
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost',
  'tauri://localhost',
]);

const ALLOWED_NETLIFY_SITES = new Set([
  'ghosti',
  'ghosti-app',
  'ghostkey',
  'ghostkey-app',
  'sundreamer',
  'merlin',
  'senstalk',
  'sensetalk',
  'aggrofilter',
  'vaulter',
  'whateat',
  'luminote',
  'autonote',
]);

function isTrustedBridgeOrigin(rawOrigin) {
  if (!rawOrigin) return false;
  const origin = String(rawOrigin).trim().replace(/\/+$/, '');
  const lower = origin.toLowerCase();
  if (!lower || lower === 'null') return false;
  if (ALLOWED_EXACT_ORIGINS.has(lower)) return true;

  let parsed = null;
  try {
    parsed = new URL(lower);
  } catch {
    return false;
  }
  const scheme = parsed.protocol.replace(/:$/, '');
  const host = (parsed.hostname || '').toLowerCase();
  if (!host) return false;

  if (scheme === 'capacitor' || scheme === 'ionic' || scheme === 'tauri') {
    return host === 'localhost';
  }
  if ((scheme === 'http' || scheme === 'https') && (host === 'localhost' || host === '127.0.0.1')) {
    return true;
  }
  if (scheme === 'https' && (host === 'sundreamer.app' || host.endsWith('.sundreamer.app'))) {
    return true;
  }
  if (scheme === 'https' && (host === 'merlincode.com' || host.endsWith('.merlincode.com'))) {
    return true;
  }
  if (scheme === 'https' && host.endsWith('.netlify.app')) {
    const sub = host.slice(0, -'.netlify.app'.length);
    const siteName = sub.includes('--') ? sub.split('--').pop() : sub;
    if (siteName && ALLOWED_NETLIFY_SITES.has(siteName)) {
      return true;
    }
  }
  return false;
}

function buildCorsHeaders(req) {
  const rawOrigin = req?.headers?.get?.('origin') || '';
  const headers = {
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Purge-Key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  };
  if (rawOrigin && isTrustedBridgeOrigin(rawOrigin)) {
    headers['Access-Control-Allow-Origin'] = String(rawOrigin).trim().replace(/\/+$/, '');
  }
  return headers;
}

function verifyAdminPurgeAuth(req) {
  if (!ADMIN_PURGE_KEY || ADMIN_PURGE_KEY.length < 12) {
    return false;
  }
  const headerKey = (req.headers.get('x-admin-purge-key') || '').trim();
  const bearerRaw = (req.headers.get('authorization') || '').trim();
  const bearerKey = bearerRaw.startsWith('Bearer ') ? bearerRaw.slice(7).trim() : '';
  const candidate = headerKey || bearerKey;
  if (!candidate) return false;
  const expectedBuf = Buffer.from(ADMIN_PURGE_KEY, 'utf8');
  const providedBuf = Buffer.from(candidate, 'utf8');
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

async function inspectOrPurgePhotoSeedBuffer(supabaseUrl, serviceKey, shouldPurge) {
  const nowMs = Date.now();
  const cutoffIso = new Date(nowMs - PHOTO_SEED_TTL_MS).toISOString();
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  let purgedCount = 0;
  if (shouldPurge) {
    const delUrl = `${supabaseUrl}/rest/v1/ghosti_room_shared_photos?created_at=lt.${encodeURIComponent(
      cutoffIso
    )}&select=id`;
    const delRes = await fetch(delUrl, {
      method: 'DELETE',
      headers: {
        ...headers,
        Prefer: 'return=representation',
      },
    });
    if (delRes.ok) {
      const deletedRows = await delRes.json().catch(() => []);
      purgedCount = Array.isArray(deletedRows) ? deletedRows.length : 0;
    }
  }

  const listUrl = `${supabaseUrl}/rest/v1/ghosti_room_shared_photos?select=room_id,created_at&order=created_at.asc&limit=5000`;
  const listRes = await fetch(listUrl, { method: 'GET', headers });
  if (!listRes.ok) {
    const errText = await listRes.text().catch(() => '');
    return {
      ok: false,
      status: listRes.status,
      reason: `ghosti_room_shared_photos 조회 실패: ${errText.slice(0, 200)}`,
    };
  }
  const rows = await listRes.json().catch(() => []);
  const safeRows = Array.isArray(rows) ? rows : [];
  let activeWithin14dRows = 0;
  let expiredOver14dRows = 0;
  const roomSet = new Set();

  for (const r of safeRows) {
    if (r?.room_id) roomSet.add(String(r.room_id));
    const ts = Date.parse(String(r?.created_at || ''));
    if (!Number.isNaN(ts) && ts < nowMs - PHOTO_SEED_TTL_MS) {
      expiredOver14dRows += 1;
    } else {
      activeWithin14dRows += 1;
    }
  }

  return {
    ok: true,
    ttlDays: PHOTO_SEED_TTL_DAYS,
    checkedAtUtc: new Date(nowMs).toISOString(),
    cutoffUtc: cutoffIso,
    totalRows: safeRows.length,
    activeWithin14dRows,
    expiredOver14dRows,
    purgedCount,
    distinctRoomCount: roomSet.size,
    oldestCreatedAt: safeRows.length > 0 ? safeRows[0]?.created_at || null : null,
    newestCreatedAt:
      safeRows.length > 0 ? safeRows[safeRows.length - 1]?.created_at || null : null,
  };
}

const makeJsonResponder = (req) => (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

const b64url = (input) =>
  Buffer.from(typeof input === 'string' ? input : JSON.stringify(input))
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

function signSupabaseJwt({ userId, email }, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({
    sub: userId,
    email,
    role: 'authenticated',
    aud: 'authenticated',
    iss: 'ghosti-hub-bridge',
    iat: now,
    exp: now + TOKEN_TTL_SEC,
  });
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return { token: `${header}.${payload}.${sig}`, expiresAt: (now + TOKEN_TTL_SEC) * 1000 };
}

function signAnonPublishableJwt(supabaseUrl, secret) {
  let ref = '';
  try {
    ref = new URL(supabaseUrl).hostname.split('.')[0] || '';
  } catch {
    ref = '';
  }
  // 고정 iat/exp를 사용하여 호출 시마다 동일한 anon JWT 문자열을 반환 (클라이언트 applyRuntimePublicConfig가 활성 Realtime 채널을 재생성·단절시키는 현상 원천 차단)
  const fixedIat = 1735689600;
  const fixedExp = 2051222400;
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const payload = b64url({
    iss: 'supabase',
    ...(ref ? { ref } : {}),
    role: 'anon',
    iat: fixedIat,
    exp: fixedExp,
  });
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${payload}.${sig}`;
}

export default async (req) => {
  const json = makeJsonResponder(req);
  const rawOriginHeader = (req.headers.get('origin') || '').trim();

  if (req.method === 'OPTIONS') {
    if (rawOriginHeader && !isTrustedBridgeOrigin(rawOriginHeader)) {
      return new Response(null, { status: 403 });
    }
    return new Response(null, { status: 204, headers: buildCorsHeaders(req) });
  }

  if (rawOriginHeader && !isTrustedBridgeOrigin(rawOriginHeader)) {
    return json(403, { ok: false, reason: 'UNTRUSTED_ORIGIN' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  const publicAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    (supabaseUrl && jwtSecret ? signAnonPublishableJwt(supabaseUrl, jwtSecret) : '');

  if (req.method === 'GET') {
    let reqUrl = null;
    try {
      reqUrl = new URL(req.url);
    } catch {
      reqUrl = null;
    }
    const action = reqUrl?.searchParams.get('action') || '';
    if (action === 'photo_seed_ttl_status') {
      if (!verifyAdminPurgeAuth(req)) {
        return json(401, {
          ok: false,
          reason: 'ADMIN_AUTH_REQUIRED',
          message: '관리자 시크릿 헤더(X-Admin-Purge-Key) 인증이 필요합니다.',
        });
      }
      if (!supabaseUrl || !serviceKey) {
        return json(500, { ok: false, reason: '서버 환경변수 미설정 (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' });
      }
      const shouldPurge = reqUrl?.searchParams.get('purge') === '1';
      const report = await inspectOrPurgePhotoSeedBuffer(supabaseUrl, serviceKey, shouldPurge);
      return json(report.ok ? 200 : 500, report);
    }

    if (action === 'work_get_preview') {
      if (!supabaseUrl || !serviceKey) {
        return json(500, { ok: false, reason: '서버 환경변수 미설정' });
      }
      const inviteToken =
        reqUrl?.searchParams.get('inviteToken') ||
        reqUrl?.searchParams.get('token') ||
        '';
      const out = await handlePublicWorkPreviewAction({
        supabaseUrl,
        serviceKey,
        inviteToken,
      });
      return json(out.status, out.body);
    }

    if (!supabaseUrl || !publicAnonKey) {
      return json(500, { ok: false, reason: '공개 클라이언트 설정 미준비' });
    }
    return json(200, { ok: true, supabaseUrl, supabaseAnonKey: publicAnonKey });
  }

  if (req.method !== 'POST') return json(405, { ok: false, reason: 'GET or POST only' });

  if (!supabaseUrl || !serviceKey || !jwtSecret) {
    return json(500, { ok: false, reason: '서버 환경변수 미설정 (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_JWT_SECRET)' });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    /* body 선택 */
  }

  const reqAction = typeof body?.action === 'string' ? body.action.trim() : '';

  // 비로그인 초대 링크 클릭 시 방 제목·방장 안내만 반환 (원본·본문·이메일은 절대 비노출, 로그인 수락 후 대장 PC 터널 직결)
  if (reqAction === 'work_get_preview') {
    const out = await handlePublicWorkPreviewAction({
      supabaseUrl,
      serviceKey,
      inviteToken: body?.inviteToken || '',
    });
    return json(out.status, out.body);
  }

  // 대장 PC 데몬(Merlin_Z_Core) 상시 터널 주소 자동 갱신 (기등록 256-bit hostAccessKey 상수 시간 검증)
  if (reqAction === 'work_refresh_tunnel_by_key') {
    const out = await handleDaemonWorkTunnelRefreshAction({
      supabaseUrl,
      serviceKey,
      body,
    });
    return json(out.status, out.body);
  }

  const auth = req.headers.get('authorization') || '';
  const hubToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!hubToken) return json(401, { ok: false, reason: '허브 토큰 없음' });

  if (!HUB_CLIENT_SECRET) {
    return json(500, {
      ok: false,
      reason: 'SERVER_ENV_MISSING_MERLIN_HUB_CLIENT_SECRET',
      message: '서버 환경변수(MERLIN_HUB_CLIENT_SECRET)가 설정되지 않았습니다.',
    });
  }

  // ① 허브 토큰 서버 검증 (브라우저가 보낸 userId/email은 신뢰하지 않으며, 동일 서버리스 인스턴스 내 45초 단기 검증 캐시로 외부 왕복 지연을 최소화)
  const tokenCacheKey = crypto.createHash('sha256').update(hubToken).digest('hex');
  const cachedVerify = verifiedHubUserCache.get(tokenCacheKey);
  let hubUser =
    cachedVerify && cachedVerify.expiresAtMs > Date.now() ? cachedVerify.user : null;
  if (!hubUser) {
    try {
      const r = await fetch(`${HUB_URL}/api/auth/me?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${hubToken}`,
          'X-Client-Id': HUB_CLIENT_ID,
          'X-Client-Secret': HUB_CLIENT_SECRET,
        },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.success || !data?.user) {
        verifiedHubUserCache.delete(tokenCacheKey);
        return json(401, { ok: false, reason: `허브 토큰 검증 실패 (HTTP ${r.status})` });
      }
      hubUser = data.user;
      if (verifiedHubUserCache.size > 200) {
        verifiedHubUserCache.clear();
      }
      verifiedHubUserCache.set(tokenCacheKey, {
        user: hubUser,
        expiresAtMs: Date.now() + HUB_VERIFY_CACHE_TTL_MS,
      });
    } catch (e) {
      return json(502, { ok: false, reason: `허브 연결 실패: ${e?.message || e}` });
    }
  }

  const userId = String(hubUser.userId || hubUser.id || '').trim();
  const email = String(hubUser.email || '').trim().toLowerCase();
  if (!userId || !email) return json(401, { ok: false, reason: '허브 응답에 userId/email 없음' });
  if (body.userId && String(body.userId).trim() !== userId) {
    return json(403, { ok: false, reason: '요청 userId와 허브 검증 userId 불일치' });
  }

  if (reqAction) {
    const opOut = await handleAuthedWorkAndDeviceAction({
      action: reqAction,
      body,
      userId,
      email,
      hubNickname: hubUser.nickname || '',
      hubToken,
      hubUrl: HUB_URL,
      hubClientId: HUB_CLIENT_ID,
      hubClientSecret: HUB_CLIENT_SECRET,
      supabaseUrl,
      serviceKey,
    });
    if (opOut) {
      return json(opOut.status, opOut.body);
    }
  }

  // ② service_role Upsert (id = 허브 family_users.id)
  // [원엔진·투도어 앱 분리]: 호출 도메인(Origin) 또는 body.appId로 'ghosti' vs 'ghostkey'를 판별하여
  // 각 앱의 접속 시각·사전알림 컬럼을 독립 기록하고 최초 가입 앱(first_signup_app / signup_source)이 덮어써지지 않게 보호!
  const reqOrigin = String(req.headers.get('origin') || req.headers.get('referer') || '').toLowerCase();
  const callerApp =
    String(body.appId || '').toLowerCase() === 'ghostkey' || reqOrigin.includes('ghostkey')
      ? 'ghostkey'
      : 'ghosti';
  const nowLoginIso = new Date().toISOString();

  let existingUserRow = null;
  try {
    const exRes = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=id,signup_source,first_signup_app&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );
    const exArr = exRes.ok ? await exRes.json().catch(() => []) : [];
    existingUserRow = Array.isArray(exArr) && exArr[0] ? exArr[0] : null;
  } catch {
    existingUserRow = null;
  }

  const baseRow = {
    id: userId,
    email,
    nickname: hubUser.nickname || body.nickname || email.split('@')[0],
    last_login_at: nowLoginIso,
  };

  const row = {
    ...baseRow,
    ...(callerApp === 'ghostkey'
      ? { ghostkey_last_login_at: nowLoginIso }
      : { ghosti_last_login_at: nowLoginIso }),
  };
  if (!existingUserRow?.first_signup_app) {
    row.first_signup_app = callerApp;
  }
  if (body.nativePushToken) {
    row.native_push_token = String(body.nativePushToken);
    row.push_channel_id = callerApp;
  }
  if (body.signupSource && !existingUserRow?.signup_source) {
    row.signup_source = String(body.signupSource);
  }
  if (typeof body.launchNotifyOptIn === 'boolean') {
    if (callerApp === 'ghostkey') {
      row.ghostkey_notify_opt_in = body.launchNotifyOptIn;
    } else {
      row.launch_notify_opt_in = body.launchNotifyOptIn;
    }
  }
  if (
    body.devicePlatform &&
    ['windows', 'macos', 'android', 'ios', 'web'].includes(String(body.devicePlatform))
  ) {
    row.device_platform = String(body.devicePlatform);
  }

  const upsertHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  };

  let up = await fetch(`${supabaseUrl}/rest/v1/users?on_conflict=id`, {
    method: 'POST',
    headers: upsertHeaders,
    body: JSON.stringify(row),
  });
  if (!up.ok && Object.keys(row).length > Object.keys(baseRow).length) {
    // 정식 컬럼 ALTER TABLE 실행 전 환경에서도 로그인이 막히거나 기존 app_settings가 덮어써지지 않도록 baseRow 안전 폴백
    up = await fetch(`${supabaseUrl}/rest/v1/users?on_conflict=id`, {
      method: 'POST',
      headers: upsertHeaders,
      body: JSON.stringify(baseRow),
    });
  }
  if (!up.ok) {
    const detail = await up.text().catch(() => '');
    return json(500, { ok: false, reason: `users Upsert 실패 (HTTP ${up.status})`, detail: detail.slice(0, 300) });
  }

  // 14일(2주) 경과 마중물 썸네일 행 서버 측 무인 자동 청소 (인스턴스당 10분 스로틀 · 로그인 응답 지연 0ms 방어를 위해 백그라운드 병행)
  if (Date.now() - lastAutoPurgeAtMs > 10 * 60 * 1000) {
    lastAutoPurgeAtMs = Date.now();
    void inspectOrPurgePhotoSeedBuffer(supabaseUrl, serviceKey, true).catch(() => {});
  }

  // ③ 단기 Supabase 토큰 발급
  const { token, expiresAt } = signSupabaseJwt({ userId, email }, jwtSecret);
  return json(200, {
    ok: true,
    userId,
    email,
    nickname: String(hubUser.nickname || '').trim(),
    supabaseUrl,
    supabaseAnonKey: publicAnonKey,
    supabaseAccessToken: token,
    expiresAt,
  });
};
