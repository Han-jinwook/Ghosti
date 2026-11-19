import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Ghosti 전용 단독 Supabase 공개 클라이언트 URL 및 Publishable Anon Key (RLS 강제 적용).
 * - Netlify 웹 빌드뿐만 아니라 GitHub Actions iOS TestFlight / 로컬 빌드에서도 누락 없이 동일하게 연결되도록 기본값을 보장합니다.
 * - 마스터 키(service_role)는 절대 클라이언트에 포함하지 않으며 오직 서버 함수(hub-supabase-bridge)에만 존재합니다.
 */
const DEFAULT_GHOSTI_SUPABASE_URL = 'https://dlfoessbfuuhsvrseosz.supabase.co';
const DEFAULT_GHOSTI_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsZm9lc3NiZnV1aHN2cnNlb3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5OTQxMTMsImV4cCI6MjEwODU3MDExM30.53ffT6hG-Ss6PDfyCGGt53t-3faWE__6NSRDnhT24aM';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || DEFAULT_GHOSTI_SUPABASE_URL).trim();
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_GHOSTI_SUPABASE_ANON_KEY
).trim();

export const supabase =
  supabaseUrl && supabaseAnonKey
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
 * RLS 보호 테이블(라운지 방·공유 사진·기기·페어링 코드·여권 등)용 클라이언트.
 * - 브릿지 단기 토큰이 있으면 그 토큰을 Authorization 헤더로 실은 클라이언트를 반환 (auth.jwt() ->> 'email' 판별 가능)
 * - 토큰이 없거나 만료되면 null (호출부에서 ensureGhostiAuthedSupabaseClient 또는 syncHubUserToLocalSupabase 재호출)
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

function resolveHubSupabaseBridgeEndpoint(): string {
  if (typeof window === 'undefined') return '/.netlify/functions/hub-supabase-bridge';
  const isCapacitorNative = Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  );
  const host = window.location?.hostname || '';
  const isNonProdOrigin =
    isCapacitorNative || host === 'localhost' || host === '127.0.0.1';
  return isNonProdOrigin
    ? 'https://ghosti.sundreamer.app/.netlify/functions/hub-supabase-bridge'
    : '/.netlify/functions/hub-supabase-bridge';
}

/**
 * [허브 SDK ↔ 귀신같이 단독 Supabase SSOT 계정 매핑 브릿지]
 */
export async function syncHubUserToLocalSupabase(params: {
  userId: string;
  email: string;
  nickname?: string;
  hubToken?: string | null;
  signupSource?: string;
  launchNotifyOptIn?: boolean;
  forceSync?: boolean;
}): Promise<{ ok: boolean; syncedUserId?: string; error?: string }> {
  const cleanEmail = (params.email || '').trim().toLowerCase();
  const cleanUserId = (params.userId || '').trim();
  if (!cleanUserId || !cleanEmail) {
    return { ok: false, error: 'Missing userId or email' };
  }

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ghosti_hub_user_id', cleanUserId);
      localStorage.setItem('ghosti_hub_user_email', cleanEmail);
      if (params.nickname) {
        localStorage.setItem('ghosti_hub_user_nickname', params.nickname);
      }
    }

    if (!params.forceSync && getGhostiSupabaseAccessToken()) {
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
    const devicePlatform =
      typeof navigator !== 'undefined'
        ? /Android/i.test(navigator.userAgent)
          ? 'android'
          : /iPhone|iPad|iPod/i.test(navigator.userAgent)
          ? 'ios'
          : /Windows/i.test(navigator.userAgent)
          ? 'windows'
          : /Mac/i.test(navigator.userAgent)
          ? 'macos'
          : 'web'
        : 'web';

    const res = await fetch(resolveHubSupabaseBridgeEndpoint(), {
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
        signupSource: params.signupSource || 'ghosti_app',
        launchNotifyOptIn: params.launchNotifyOptIn ?? true,
        devicePlatform,
      }),
    });
    const data = await res.json().catch(() => ({} as Record<string, unknown>));

    if (!res.ok || !data?.ok || typeof data.supabaseAccessToken !== 'string') {
      const reason = String(data?.reason || `브릿지 응답 오류 (HTTP ${res.status})`);
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Supabase sync error';
    return { ok: false, error: msg };
  }
}

/**
 * 로그인된 세션일 때 만료 여부를 자동 확인해 항상 유효한 인증 Supabase 클라이언트를 반환합니다.
 * 비로그인 상태이면 null을 반환합니다.
 */
export async function ensureGhostiAuthedSupabaseClient(): Promise<SupabaseClient | null> {
  const existing = getGhostiAuthedSupabase();
  if (existing) return existing;
  if (typeof window === 'undefined') return null;

  const hubToken = (localStorage.getItem('merlin_session_token') || '').trim();
  if (!hubToken) return null;

  let userId = (localStorage.getItem('ghosti_hub_user_id') || '').trim();
  let email = (localStorage.getItem('ghosti_hub_user_email') || '').trim();
  let nickname = (localStorage.getItem('ghosti_hub_user_nickname') || '').trim();

  if (!userId || !email) {
    try {
      const rawUser = localStorage.getItem('merlin_hub_user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser) as { id?: string; email?: string; nickname?: string };
        userId = userId || (parsed.id || '').trim();
        email = email || (parsed.email || '').trim();
        nickname = nickname || (parsed.nickname || '').trim();
      }
    } catch {
      /* ignore */
    }
  }

  if (!userId || !email) {
    try {
      const r = await fetch(`https://os.sundreamer.app/api/auth/me?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${hubToken}`,
          'X-App-Id': 'APP-01',
        },
      });
      if (r.ok) {
        const me = (await r.json()) as { user?: { id?: string; email?: string; nickname?: string } };
        userId = userId || (me.user?.id || '').trim();
        email = email || (me.user?.email || '').trim();
        nickname = nickname || (me.user?.nickname || '').trim();
      }
    } catch {
      /* ignore */
    }
  }

  if (!userId || !email) return null;

  const synced = await syncHubUserToLocalSupabase({
    userId,
    email,
    nickname: nickname || undefined,
    hubToken,
    forceSync: true,
  });
  if (!synced.ok) return null;
  return getGhostiAuthedSupabase();
}

/** 로그아웃 시 단기 토큰 및 허브 캐시 폐기 */
export function clearGhostiSupabaseSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GHOSTI_SB_TOKEN_KEY);
  localStorage.removeItem(GHOSTI_SB_TOKEN_EXP_KEY);
  localStorage.removeItem('ghosti_hub_user_id');
  localStorage.removeItem('ghosti_hub_user_email');
  localStorage.removeItem('ghosti_hub_user_nickname');
  authedClient = null;
  authedClientToken = '';
}
