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

const HUB_URL = process.env.MERLIN_HUB_URL || 'https://os.sundreamer.app';
const HUB_CLIENT_ID = process.env.MERLIN_HUB_CLIENT_ID || 'APP-01';
const HUB_CLIENT_SECRET = process.env.MERLIN_HUB_CLIENT_SECRET || 'merlin-family-secret-key-2026';
const TOKEN_TTL_SEC = 60 * 60;

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
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

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, reason: 'POST only' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!supabaseUrl || !serviceKey || !jwtSecret) {
    return json(500, { ok: false, reason: '서버 환경변수 미설정 (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_JWT_SECRET)' });
  }

  const auth = req.headers.get('authorization') || '';
  const hubToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!hubToken) return json(401, { ok: false, reason: '허브 토큰 없음' });

  let body = {};
  try {
    body = await req.json();
  } catch {
    /* body 선택 */
  }

  // ① 허브 토큰 서버 검증 (브라우저가 보낸 userId/email은 신뢰하지 않음)
  let hubUser;
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
      return json(401, { ok: false, reason: `허브 토큰 검증 실패 (HTTP ${r.status})` });
    }
    hubUser = data.user;
  } catch (e) {
    return json(502, { ok: false, reason: `허브 연결 실패: ${e?.message || e}` });
  }

  const userId = String(hubUser.userId || hubUser.id || '').trim();
  const email = String(hubUser.email || '').trim().toLowerCase();
  if (!userId || !email) return json(401, { ok: false, reason: '허브 응답에 userId/email 없음' });
  if (body.userId && String(body.userId).trim() !== userId) {
    return json(403, { ok: false, reason: '요청 userId와 허브 검증 userId 불일치' });
  }

  // ② service_role Upsert (id = 허브 family_users.id) + 온보딩/사전가입 메타데이터 수집
  const appSettings = {};
  if (body.nativePushToken) {
    appSettings.native_push_token = String(body.nativePushToken);
    appSettings.push_channel_id = 'ghosti';
  }
  if (body.signupSource) {
    appSettings.signup_source = String(body.signupSource);
  }
  if (typeof body.launchNotifyOptIn === 'boolean') {
    appSettings.launch_notify_opt_in = body.launchNotifyOptIn;
  }
  if (body.devicePlatform) {
    appSettings.device_platform = String(body.devicePlatform);
  }
  appSettings.last_synced_at = new Date().toISOString();

  const row = {
    id: userId,
    email,
    nickname: hubUser.nickname || body.nickname || email.split('@')[0],
    last_login_at: new Date().toISOString(),
    app_settings: appSettings,
  };
  const up = await fetch(`${supabaseUrl}/rest/v1/users?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!up.ok) {
    const detail = await up.text().catch(() => '');
    return json(500, { ok: false, reason: `users Upsert 실패 (HTTP ${up.status})`, detail: detail.slice(0, 300) });
  }

  // ③ 단기 Supabase 토큰 발급
  const { token, expiresAt } = signSupabaseJwt({ userId, email }, jwtSecret);
  return json(200, { ok: true, userId, email, supabaseAccessToken: token, expiresAt });
};
