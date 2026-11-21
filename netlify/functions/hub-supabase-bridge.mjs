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
 * 필요한 Netlify 환경변수: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET
 * 선택: MERLIN_HUB_URL (기본 https://os.sundreamer.app), MERLIN_HUB_CLIENT_ID, MERLIN_HUB_CLIENT_SECRET
 */
import crypto from 'node:crypto';
import {
  handleAuthedWorkAndDeviceAction,
  handlePublicWorkPreviewAction,
  handlePublicWorkSignDownloadAction,
} from './lib/workAndDeviceBridgeOps.mjs';

const HUB_URL = process.env.MERLIN_HUB_URL || 'https://os.sundreamer.app';
const HUB_CLIENT_ID = process.env.MERLIN_HUB_CLIENT_ID || 'APP-01';
const HUB_CLIENT_SECRET = process.env.MERLIN_HUB_CLIENT_SECRET || 'merlin-family-secret-key-2026';
const TOKEN_TTL_SEC = 60 * 60;
const PHOTO_SEED_TTL_DAYS = 14;
const PHOTO_SEED_TTL_MS = PHOTO_SEED_TTL_DAYS * 24 * 60 * 60 * 1000;
const HUB_VERIFY_CACHE_TTL_MS = 45 * 1000;
const verifiedHubUserCache = new Map();
let lastAutoPurgeAtMs = 0;

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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
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

  // 비로그인 상태에서도 유효한 초대 토큰(inviteToken)만으로 열람·다운로드 가능한 업무방 24시간 프리뷰
  if (reqAction === 'work_get_preview') {
    const out = await handlePublicWorkPreviewAction({
      supabaseUrl,
      serviceKey,
      inviteToken: body?.inviteToken || '',
    });
    return json(out.status, out.body);
  }
  if (reqAction === 'work_sign_download' && body?.inviteToken) {
    const out = await handlePublicWorkSignDownloadAction({
      supabaseUrl,
      serviceKey,
      inviteToken: body.inviteToken,
      sha256: body.sha256 || '',
    });
    return json(out.status, out.body);
  }

  const auth = req.headers.get('authorization') || '';
  const hubToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!hubToken) return json(401, { ok: false, reason: '허브 토큰 없음' });

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
  // [제18조 준수]: app_settings JSONB에 기생시키거나 빈 객체로 덮어쓰지 않고, 정식 분리 컬럼에만 전달된 값만 부분 반영!
  const baseRow = {
    id: userId,
    email,
    nickname: hubUser.nickname || body.nickname || email.split('@')[0],
    last_login_at: new Date().toISOString(),
  };

  const row = { ...baseRow };
  if (body.nativePushToken) {
    row.native_push_token = String(body.nativePushToken);
    row.push_channel_id = 'ghosti';
  }
  if (body.signupSource) {
    row.signup_source = String(body.signupSource);
  }
  if (typeof body.launchNotifyOptIn === 'boolean') {
    row.launch_notify_opt_in = body.launchNotifyOptIn;
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
