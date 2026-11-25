import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSessionToken } from './merlin-hub-sdk/CoreLogic/client';

/**
 * Ghosti 전용 단독 Supabase 공개 클라이언트 (RLS 강제 적용 · 코드 내 JWT 리터럴 0건 원칙).
 * - 1순위: 빌드 환경변수(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — Netlify 및 로컬 .env.local)
 * - 2순위: 환경변수 미주입 CI 빌드(iOS TestFlight 등) 시 브릿지 엔드포인트(GET /.netlify/functions/hub-supabase-bridge)에서
 *          런타임 자동 수신 후 localStorage에 캐싱하여 GitGuardian JWT 오탐 0건과 전 기기 무중단 연결을 동시에 보장합니다.
 * - 마스터 키(service_role)는 절대 클라이언트에 포함하지 않으며 오직 서버 함수(hub-supabase-bridge)에만 존재합니다.
 */
const DEFAULT_GHOSTI_SUPABASE_URL = 'https://dlfoessbfuuhsvrseosz.supabase.co';
const CACHED_PUBLIC_URL_KEY = 'ghosti_public_sb_url';
const CACHED_PUBLIC_ANON_KEY = 'ghosti_public_sb_anon_key';

function readInitialSupabaseConfig(): { url: string; anonKey: string } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envAnon = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (envAnon) {
    return { url: envUrl || DEFAULT_GHOSTI_SUPABASE_URL, anonKey: envAnon };
  }
  if (typeof window !== 'undefined') {
    try {
      const cachedUrl = (localStorage.getItem(CACHED_PUBLIC_URL_KEY) || '').trim();
      const cachedAnon = (localStorage.getItem(CACHED_PUBLIC_ANON_KEY) || '').trim();
      if (cachedAnon) {
        return { url: envUrl || cachedUrl || DEFAULT_GHOSTI_SUPABASE_URL, anonKey: cachedAnon };
      }
    } catch {
      /* ignore storage access error */
    }
  }
  return { url: envUrl || DEFAULT_GHOSTI_SUPABASE_URL, anonKey: '' };
}

let activeSupabaseUrl = readInitialSupabaseConfig().url;
let activeSupabaseAnonKey = readInitialSupabaseConfig().anonKey;

export let supabase: SupabaseClient | null =
  activeSupabaseUrl && activeSupabaseAnonKey
    ? createClient(activeSupabaseUrl, activeSupabaseAnonKey, {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      })
    : null;

let inflightPublicConfigPromise: Promise<SupabaseClient | null> | null = null;

function applyRuntimePublicConfig(url?: string, anonKey?: string): void {
  const cleanAnon = (anonKey || '').trim();
  const cleanUrl = (url || activeSupabaseUrl || DEFAULT_GHOSTI_SUPABASE_URL).trim();
  if (!cleanAnon || !cleanUrl) return;
  // 이미 동일 Supabase 프로젝트 URL로 클라이언트가 초기화된 경우 재생성을 생략하여 구독 중인 Realtime WebSocket 채널 단절을 원천 방지
  if (supabase && activeSupabaseAnonKey && cleanUrl === activeSupabaseUrl) return;
  activeSupabaseUrl = cleanUrl;
  activeSupabaseAnonKey = cleanAnon;
  supabase = createClient(activeSupabaseUrl, activeSupabaseAnonKey, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
  authedClient = null;
  authedClientToken = '';
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CACHED_PUBLIC_URL_KEY, cleanUrl);
      localStorage.setItem(CACHED_PUBLIC_ANON_KEY, cleanAnon);
    } catch {
      /* ignore */
    }
  }
}

export async function ensureGhostiPublicSupabaseClient(): Promise<SupabaseClient | null> {
  if (supabase) return supabase;
  if (typeof window === 'undefined') return null;
  if (inflightPublicConfigPromise) return inflightPublicConfigPromise;

  inflightPublicConfigPromise = (async () => {
    try {
      const res = await fetch(resolveHubSupabaseBridgeEndpoint(), { method: 'GET' });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        supabaseUrl?: string;
        supabaseAnonKey?: string;
      };
      if (res.ok && data?.ok && data.supabaseAnonKey) {
        applyRuntimePublicConfig(data.supabaseUrl, data.supabaseAnonKey);
      }
    } catch {
      /* offline fallback */
    } finally {
      inflightPublicConfigPromise = null;
    }
    return supabase;
  })();

  return inflightPublicConfigPromise;
}

if (typeof window !== 'undefined' && !supabase) {
  void ensureGhostiPublicSupabaseClient();
}

/** 브릿지가 발급한 단기(1시간) Supabase 토큰 보관 키 */
const GHOSTI_SB_TOKEN_KEY = 'ghosti_supabase_access_token';
const GHOSTI_SB_TOKEN_EXP_KEY = 'ghosti_supabase_access_token_exp';
/** 로그아웃 직후 인플라이트 /api/auth/me(newToken) 응답이 세션을 되살리는 레이스를 막는 단기 1회성 가드 키 */
export const GHOSTI_LOGOUT_LOCK_UNTIL_KEY = 'ghosti_pending_logout_lock_until';
/** 워크스페이스에서 로그아웃했을 때 쇼룸(온보딩 대문)으로 튕기지 않고 게스트 워크스페이스에 머무르기 위한 1회성 복귀 키 */
export const GHOSTI_POST_LOGOUT_WORKSPACE_KEY = 'ghosti_post_logout_workspace_v1';

let authedClient: SupabaseClient | null = null;
let authedClientToken = '';

/** 명시적 로그아웃 직후(또는 리로드 대기 중)인지 단일 판별 */
export function isGhostiExplicitlyLoggedOut(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (
      localStorage.getItem('merlin_logged_out') === '1' ||
      sessionStorage.getItem('merlin_logged_out') === '1'
    ) {
      return true;
    }
    const lockUntil = Number(localStorage.getItem(GHOSTI_LOGOUT_LOCK_UNTIL_KEY) || 0);
    if (lockUntil > 0 && Date.now() <= lockUntil) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function clearGhostiLogoutLock(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GHOSTI_LOGOUT_LOCK_UNTIL_KEY);
    localStorage.removeItem(GHOSTI_POST_LOGOUT_WORKSPACE_KEY);
    localStorage.removeItem('merlin_logged_out');
    try {
      sessionStorage.removeItem('merlin_logged_out');
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

/** 브릿지 단기 토큰(만료 전 · 비로그아웃 상태)만 반환 */
export function getGhostiSupabaseAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (isGhostiExplicitlyLoggedOut()) return null;
  const token = localStorage.getItem(GHOSTI_SB_TOKEN_KEY);
  const exp = Number(localStorage.getItem(GHOSTI_SB_TOKEN_EXP_KEY) || 0);
  if (!token || !exp || Date.now() > exp - 60_000) return null;
  return token;
}

/**
 * 로컬 Z-코어(LNA) 동의 플래그(`ghosti_secretary_engine_agreed`)와 분리된
 * 실제 멀린 허브·Supabase 계정 로그인 세션 보유 여부 단일 판별 함수.
 * - 로그인 시: `merlin_session_token` 또는 유효한 `ghosti_supabase_access_token` 존재 ➔ true
 * - 로그아웃 / 시크릿 창 / 비로그인 초대링크 구경 시: 둘 다 없음 ➔ false
 */
export function hasAuthenticatedHubAccountSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (isGhostiExplicitlyLoggedOut()) return false;
    const hubToken = (getSessionToken() || localStorage.getItem('merlin_session_token') || '').trim();
    if (hubToken && !(!hubToken.includes('.') && /^[a-f0-9]{28,48}$/i.test(hubToken))) {
      return true;
    }
    return Boolean(getGhostiSupabaseAccessToken());
  } catch {
    return false;
  }
}

/**
 * `hub-supabase-bridge`가 서명한 단기 JWT 내부의 정식 클레임(`sub` = public.users.id, `email`)을 추출합니다.
 * RLS 정책(`lower(uploader_email) = public.ghosti_current_email()`) 및 `users(id)` FK와 100% 일치시킵니다.
 */
export function readGhostiAuthedJwtClaims(): { sub: string; email: string } | null {
  const token = getGhostiSupabaseAccessToken();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const jsonStr =
      typeof atob === 'function'
        ? decodeURIComponent(
            Array.from(atob(padded))
              .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
              .join('')
          )
        : '';
    if (!jsonStr) return null;
    const parsed = JSON.parse(jsonStr) as { sub?: string; email?: string };
    const email = (parsed.email || '').trim().toLowerCase();
    const sub = (parsed.sub || '').trim();
    if (!email) return null;
    return { sub, email };
  } catch {
    return null;
  }
}

/**
 * RLS 보호 테이블(라운지 방·공유 사진·기기·페어링 코드·여권 등)용 클라이언트.
 * - 브릿지 단기 토큰이 있으면 그 토큰을 Authorization 헤더로 실은 클라이언트를 반환 (auth.jwt() ->> 'email' 판별 가능)
 * - 토큰이 없거나 만료되면 null (호출부에서 ensureGhostiAuthedSupabaseClient 또는 syncHubUserToLocalSupabase 재호출)
 */
export function getGhostiAuthedSupabase(): SupabaseClient | null {
  if (!activeSupabaseUrl || !activeSupabaseAnonKey) return null;
  const token = getGhostiSupabaseAccessToken();
  if (!token) return null;
  if (authedClient && authedClientToken === token) return authedClient;
  authedClient = createClient(activeSupabaseUrl, activeSupabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  authedClient.realtime.setAuth(token);
  authedClientToken = token;
  return authedClient;
}

export function resolveHubSupabaseBridgeEndpoint(): string {
  if (typeof window === 'undefined') return '/.netlify/functions/hub-supabase-bridge';
  const isCapacitorNative = Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  );
  const host = window.location?.hostname || '';
  if (host === 'ghostkey.sundreamer.app') {
    return '/api/hub-supabase-bridge';
  }
  const isNonProdOrigin =
    isCapacitorNative || host === 'localhost' || host === '127.0.0.1';
  return isNonProdOrigin
    ? 'https://ghosti.sundreamer.app/.netlify/functions/hub-supabase-bridge'
    : '/.netlify/functions/hub-supabase-bridge';
}

export async function callGhostiServerBridge<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {},
  opts?: { allowAnonymous?: boolean; keepalive?: boolean }
): Promise<T & { ok?: boolean; reason?: string }> {
  const endpoint = resolveHubSupabaseBridgeEndpoint();
  const hubToken =
    typeof window !== 'undefined'
      ? (getSessionToken() || localStorage.getItem('merlin_session_token') || '').trim()
      : '';
  if (!hubToken && !opts?.allowAnonymous) {
    return { ok: false, reason: 'HUB_AUTH_REQUIRED' } as T & { ok?: boolean; reason?: string };
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (hubToken) {
    headers.Authorization = `Bearer ${hubToken}`;
  }
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...payload }),
      ...(opts?.keepalive ? { keepalive: true } : {}),
    });
    const json = (await res.json().catch(() => ({ ok: false }))) as T & {
      ok?: boolean;
      reason?: string;
    };
    return json;
  } catch (err) {
    return { ok: false, reason: String(err) } as T & { ok?: boolean; reason?: string };
  }
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
  if (isGhostiExplicitlyLoggedOut()) {
    return { ok: false, error: '로그아웃 진행 중' };
  }

  try {
    let accountSwitched = false;
    if (typeof window !== 'undefined') {
      const prevEmail = (localStorage.getItem('ghosti_hub_user_email') || '')
        .trim()
        .toLowerCase();
      accountSwitched = Boolean(prevEmail && prevEmail !== cleanEmail);
      if (accountSwitched) {
        localStorage.removeItem(GHOSTI_SB_TOKEN_KEY);
        localStorage.removeItem(GHOSTI_SB_TOKEN_EXP_KEY);
        localStorage.removeItem('ghosti_hub_user_nickname');
        localStorage.removeItem('userNickname');
        localStorage.removeItem('ghosti_invited_member_nickname');
        localStorage.removeItem('ghosti_joined_invite_room_v1');
        authedClient = null;
        authedClientToken = '';
      }
      localStorage.setItem('ghosti_hub_user_id', cleanUserId);
      localStorage.setItem('ghosti_hub_user_email', cleanEmail);
      const cleanParamNick = (params.nickname || '').trim();
      if (cleanParamNick) {
        localStorage.setItem('ghosti_hub_user_nickname', cleanParamNick);
      } else {
        localStorage.removeItem('ghosti_hub_user_nickname');
      }
    }

    const activeClaims = readGhostiAuthedJwtClaims();
    if (
      !params.forceSync &&
      !accountSwitched &&
      getGhostiSupabaseAccessToken() &&
      activeClaims?.email === cleanEmail
    ) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ghostiSupabaseUserSynced', {
            detail: { userId: cleanUserId, email: cleanEmail, nickname: params.nickname },
          })
        );
      }
      return { ok: true, syncedUserId: cleanUserId };
    }

    const token =
      params.hubToken ||
      (typeof window !== 'undefined'
        ? getSessionToken() || localStorage.getItem('merlin_session_token')
        : null);
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
      // 비동기 브릿지 호출 중 사용자가 로그아웃을 눌렀다면 토큰/계정 키를 절대 되살리지 않음
      if (isGhostiExplicitlyLoggedOut() || !localStorage.getItem('merlin_session_token')) {
        return { ok: false, error: '로그아웃으로 동기화 중단' };
      }
      if (typeof data.supabaseAnonKey === 'string' && data.supabaseAnonKey) {
        applyRuntimePublicConfig(
          typeof data.supabaseUrl === 'string' ? data.supabaseUrl : undefined,
          data.supabaseAnonKey
        );
      }
      if (typeof data.nickname === 'string') {
        const verifiedNick = data.nickname.trim();
        if (verifiedNick) {
          localStorage.setItem('ghosti_hub_user_nickname', verifiedNick);
        } else {
          localStorage.removeItem('ghosti_hub_user_nickname');
        }
      }
      localStorage.setItem(GHOSTI_SB_TOKEN_KEY, data.supabaseAccessToken);
      localStorage.setItem(GHOSTI_SB_TOKEN_EXP_KEY, String(data.expiresAt || 0));
      window.dispatchEvent(
        new CustomEvent('ghostiSupabaseUserSynced', {
          detail: {
            userId: cleanUserId,
            email: cleanEmail,
            nickname: typeof data.nickname === 'string' ? data.nickname : params.nickname,
          },
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
  if (!activeSupabaseAnonKey) {
    await ensureGhostiPublicSupabaseClient();
  }
  const existing = getGhostiAuthedSupabase();
  if (existing) return existing;
  if (typeof window === 'undefined') return null;

  const hubToken = (getSessionToken() || localStorage.getItem('merlin_session_token') || '').trim();
  if (!hubToken || (!hubToken.includes('.') && /^[a-f0-9]{28,48}$/i.test(hubToken))) {
    return null;
  }

  let userId = (localStorage.getItem('ghosti_hub_user_id') || '').trim();
  let email = (localStorage.getItem('ghosti_hub_user_email') || '').trim();
  let nickname = (localStorage.getItem('ghosti_hub_user_nickname') || '').trim();

  if (!userId || !email) {
    try {
      const rawUser = localStorage.getItem('merlin_hub_user') || localStorage.getItem('merlin_cached_user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser) as { id?: string; userId?: string; email?: string; nickname?: string };
        userId = userId || (parsed.id || parsed.userId || '').trim();
        email = email || (parsed.email || '').trim();
        nickname = nickname || (parsed.nickname || '').trim();
      }
    } catch {
      /* ignore */
    }
  }

  // userId/email이 아직 로컬에 없거나 기존 캐시 동기화가 실패(계정 불일치 등)하면
  // 서버 브릿지(hub-supabase-bridge)가 hubToken 단독으로 직접 검증·재발급하도록 자동 자가 치유함
  const tryDirectBridgeByToken = async (): Promise<SupabaseClient | null> => {
    try {
      const res = await fetch(resolveHubSupabaseBridgeEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hubToken}`,
        },
        body: JSON.stringify({
          signupSource: 'ghosti_app',
          launchNotifyOptIn: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        userId?: string;
        email?: string;
        nickname?: string;
        supabaseUrl?: string;
        supabaseAnonKey?: string;
        supabaseAccessToken?: string;
        expiresAt?: number;
      };
      if (res.ok && data?.ok && data.supabaseAccessToken) {
        if (data.supabaseAnonKey) {
          applyRuntimePublicConfig(data.supabaseUrl, data.supabaseAnonKey);
        }
        if (data.userId) localStorage.setItem('ghosti_hub_user_id', data.userId);
        if (data.email) localStorage.setItem('ghosti_hub_user_email', data.email.trim().toLowerCase());
        if (typeof data.nickname === 'string') {
          const verifiedNick = data.nickname.trim();
          if (verifiedNick) {
            localStorage.setItem('ghosti_hub_user_nickname', verifiedNick);
          } else {
            localStorage.removeItem('ghosti_hub_user_nickname');
          }
        }
        localStorage.setItem(GHOSTI_SB_TOKEN_KEY, data.supabaseAccessToken);
        localStorage.setItem(GHOSTI_SB_TOKEN_EXP_KEY, String(data.expiresAt || 0));
        return getGhostiAuthedSupabase();
      }
    } catch {
      /* ignore */
    }
    return null;
  };

  if (!userId || !email) {
    return tryDirectBridgeByToken();
  }

  const synced = await syncHubUserToLocalSupabase({
    userId,
    email,
    nickname: nickname || undefined,
    hubToken,
    forceSync: true,
  });
  if (!synced.ok) {
    return tryDirectBridgeByToken();
  }
  return getGhostiAuthedSupabase();
}

/** 로그아웃 시 단기 토큰 및 허브·별명·초대방 캐시 일괄 폐기 (타 계정/타 공유방 혼동 0%) */
export function clearGhostiSupabaseSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GHOSTI_SB_TOKEN_KEY);
  localStorage.removeItem(GHOSTI_SB_TOKEN_EXP_KEY);
  localStorage.removeItem('ghosti_hub_user_id');
  localStorage.removeItem('ghosti_hub_user_email');
  localStorage.removeItem('ghosti_hub_user_nickname');
  localStorage.removeItem('ghosti_merlin_mock_token');
  localStorage.removeItem('merlin_hub_user');
  localStorage.removeItem('userNickname');
  localStorage.removeItem('ghosti_invited_member_nickname');
  localStorage.removeItem('ghosti_joined_invite_room_v1');
  authedClient = null;
  authedClientToken = '';
}

/**
 * 로그아웃 시 Ghosti·허브 로컬 인증 흔적 일괄 소거 SSOT (인플라이트 /api/auth/me newToken 부활 레이스 차단 포함).
 * - 타 패밀리 앱(.sundreamer.app) 공용 쿠키는 보존하고, 현재 호스트 쿠키 및 Ghosti 로컬 토큰만 완전 소거합니다.
 */
export function purgeAllGhostiLocalAuthArtifacts(opts?: {
  setLogoutLockMs?: number;
  clearLogoutLock?: boolean;
}): void {
  if (typeof window === 'undefined') return;
  try {
    clearGhostiSupabaseSession();
    localStorage.removeItem('merlin_session_token');
    localStorage.removeItem('merlin_cached_user');
    localStorage.removeItem('merlin_cached_balance');
    localStorage.removeItem('merlin_user_id');
    localStorage.removeItem('merlin_family_uid');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userProfileImage');
    localStorage.removeItem('ghosti_prelaunch_verified_email');
    localStorage.setItem('merlin_logged_out', '1');
    try {
      sessionStorage.removeItem('merlin_session_token');
      sessionStorage.removeItem('merlin_cached_user');
      sessionStorage.setItem('merlin_logged_out', '1');
    } catch {
      /* ignore */
    }
    if (opts?.setLogoutLockMs && opts.setLogoutLockMs > 0) {
      localStorage.setItem(GHOSTI_LOGOUT_LOCK_UNTIL_KEY, String(Date.now() + opts.setLogoutLockMs));
    } else if (opts?.clearLogoutLock) {
      localStorage.removeItem(GHOSTI_LOGOUT_LOCK_UNTIL_KEY);
    }
    const expire = '=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0';
    document.cookie = `merlin_session_token${expire}; SameSite=Lax; Secure`;
    document.cookie = `merlin_session_token${expire}`;
  } catch {
    /* ignore storage access error */
  }
}
