import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

/** 브릿지가 발급한 단기(1시간) Supabase 토큰 보관 키 */
const GHOSTI_SB_TOKEN_KEY = 'ghosti_supabase_access_token';
const GHOSTI_SB_TOKEN_EXP_KEY = 'ghosti_supabase_access_token_exp';

let authedClient: SupabaseClient | null = null;
let authedClientToken = '';

/** 브릿지 단기 토큰(만료 전)만 반환 */
export function getGhostiSupabaseAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(GHOSTI_SB_TOKEN_KEY);
  const exp = Number(localStorage.getItem(GHOSTI_SB_TOKEN_EXP_KEY) || 0);
  if (!token || !exp || Date.now() > exp - 60_000) return null;
  return token;
}

/**
 * RLS 보호 테이블(라운지 방·기기·페어링 코드·여권 등)용 클라이언트.
 * - 브릿지 단기 토큰이 있으면 그 토큰을 Authorization 헤더로 실은 클라이언트를 반환 (auth.jwt() ->> 'email' 판별 가능)
 * - 토큰이 없거나 만료되면 null (호출부에서 syncHubUserToLocalSupabase 재호출 필요)
 */
export function getGhostiAuthedSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const token = getGhostiSupabaseAccessToken();
  if (!token) return null;
  if (authedClient && authedClientToken === token) return authedClient;
  authedClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  authedClient.realtime.setAuth(token);
  authedClientToken = token;
  return authedClient;
}

/**
 * [허브 SDK ↔ 귀신같이 단독 Supabase SSOT 계정 매핑 브릿지]
 * - 허브(os.sundreamer.app) 이메일 6자리 OTP 인증 완료 시 확정된 `family_users.id`(UUID)를
 *   귀신같이 단독 Supabase `public.users.id`와 1:1 동일 키로 동기화합니다.
 * - 코인/결제 테이블은 귀신같이 DB에 두지 않으며, 오직 허브 중앙 지갑 원장만 참조합니다.
 * - [2026-10-27 Ghosti 보완] 스키마 RLS상 브라우저(anon)는 users INSERT가 불가하므로
 *   서버 함수(`/.netlify/functions/hub-supabase-bridge`)를 1차 경로로 호출합니다.
 *   서버가 허브 토큰을 검증 → service_role Upsert → 1시간 단기 토큰 발급.
 *   실패 시 `ok: false` + 사유를 정직하게 반환합니다 (침묵 성공 금지).
 */
export async function syncHubUserToLocalSupabase(params: {
  userId: string;
  email: string;
  nickname?: string;
  hubToken?: string | null;
}): Promise<{ ok: boolean; syncedUserId?: string; error?: string }> {
  const cleanEmail = (params.email || '').trim().toLowerCase();
  const cleanUserId = (params.userId || '').trim();
  if (!cleanUserId || !cleanEmail) {
    return { ok: false, error: 'Missing userId or email' };
  }

  try {
    // 1. 로컬 캐시에 허브 SSOT 매핑 정보 보존
    if (typeof window !== 'undefined') {
      localStorage.setItem('ghosti_hub_user_id', cleanUserId);
      localStorage.setItem('ghosti_hub_user_email', cleanEmail);
      if (params.nickname) {
        localStorage.setItem('ghosti_hub_user_nickname', params.nickname);
      }
    }

    // 이미 유효한 단기 토큰이 있으면 재호출 생략 (허브/서버 호출 최소화)
    if (getGhostiSupabaseAccessToken()) {
      return { ok: true, syncedUserId: cleanUserId };
    }

    const token =
      params.hubToken ||
      (typeof window !== 'undefined' ? localStorage.getItem('merlin_session_token') : null);
    if (!token) {
      return { ok: false, error: '허브 로그인 토큰 없음' };
    }

    const nativePushToken =
      typeof window !== 'undefined' ? localStorage.getItem('ghosti_native_push_token') : null;

    // 2. 서버 브릿지 호출 (허브 토큰 검증 → service_role Upsert → 단기 토큰 발급)
    const res = await fetch('/.netlify/functions/hub-supabase-bridge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: cleanUserId,
        email: cleanEmail,
        nickname: params.nickname || cleanEmail.split('@')[0],
        nativePushToken,
      }),
    });
    const data = await res.json().catch(() => ({} as any));

    if (!res.ok || !data?.ok || !data?.supabaseAccessToken) {
      const reason = data?.reason || `브릿지 응답 오류 (HTTP ${res.status})`;
      console.warn('[Ghosti] 허브↔Supabase 계정 동기화 실패:', reason);
      return { ok: false, error: reason };
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(GHOSTI_SB_TOKEN_KEY, data.supabaseAccessToken);
      localStorage.setItem(GHOSTI_SB_TOKEN_EXP_KEY, String(data.expiresAt || 0));
      window.dispatchEvent(
        new CustomEvent('ghostiSupabaseUserSynced', {
          detail: { userId: cleanUserId, email: cleanEmail, nickname: params.nickname },
        })
      );
    }

    return { ok: true, syncedUserId: cleanUserId };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Supabase sync error' };
  }
}

/** 로그아웃 시 단기 토큰 폐기 */
export function clearGhostiSupabaseSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GHOSTI_SB_TOKEN_KEY);
  localStorage.removeItem(GHOSTI_SB_TOKEN_EXP_KEY);
  authedClient = null;
  authedClientToken = '';
}
