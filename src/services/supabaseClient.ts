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
  if (cleanAnon === activeSupabaseAnonKey && supabase) return;
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
 * 로컬 Z-코어(LNA) 동의 플래그(`ghosti_secretary_engine_agreed`)와 분리된
 * 실제 멀린 허브·Supabase 계정 로그인 세션 보유 여부 단일 판별 함수.
 * - 로그인 시: `merlin_session_token` 또는 유효한 `ghosti_supabase_access_token` 존재 ➔ true
 * - 로그아웃 / 시크릿 창 / 비로그인 초대링크 구경 시: 둘 다 없음 ➔ false
 */
export function hasAuthenticatedHubAccountSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const hubToken = (getSessionToken() || localStorage.getItem('merlin_session_token') || '').trim();
    if (hubToken) return true;
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
  const isNonProdOrigin =
    isCapacitorNative || host === 'localhost' || host === '127.0.0.1';
  return isNonProdOrigin
    ? 'https://ghosti.sundreamer.app/.netlify/functions/hub-supabase-bridge'
    : '/.netlify/functions/hub-supabase-bridge';
}

export async function callGhostiServerBridge<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {},
  opts?: { allowAnonymous?: boolean }
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

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ghosti_hub_user_id', cleanUserId);
      localStorage.setItem('ghosti_hub_user_email', cleanEmail);
      if (params.nickname) {
        localStorage.setItem('ghosti_hub_user_nickname', params.nickname);
      }
    }

    if (!params.forceSync && getGhostiSupabaseAccessToken()) {
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
      if (typeof data.supabaseAnonKey === 'string' && data.supabaseAnonKey) {
        applyRuntimePublicConfig(
          typeof data.supabaseUrl === 'string' ? data.supabaseUrl : undefined,
          data.supabaseAnonKey
        );
      }
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
  if (!activeSupabaseAnonKey) {
    await ensureGhostiPublicSupabaseClient();
  }
  const existing = getGhostiAuthedSupabase();
  if (existing) return existing;
  if (typeof window === 'undefined') return null;

  const hubToken = (getSessionToken() || localStorage.getItem('merlin_session_token') || '').trim();
  if (!hubToken) return null;

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

  // userId/email이 아직 로컬에 없더라도 서버 브릿지(hub-supabase-bridge)가 hubToken으로 직접 검증·발급함
  if (!userId || !email) {
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
        localStorage.setItem(GHOSTI_SB_TOKEN_KEY, data.supabaseAccessToken);
        localStorage.setItem(GHOSTI_SB_TOKEN_EXP_KEY, String(data.expiresAt || 0));
        return getGhostiAuthedSupabase();
      }
    } catch {
      /* ignore */
    }
    return null;
  }

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
