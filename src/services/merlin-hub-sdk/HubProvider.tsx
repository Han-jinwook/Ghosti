'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { checkSession, getBalance, getUserId, getSessionToken, setSessionToken, clearSessionToken } from './CoreLogic/index';
import { configureMerlinHub } from './CoreLogic/config';
import { HubOfflineBanner } from './UI/HubOfflineBanner';

interface HubUser {
  id: string;
  email: string;
  nickname?: string;
  avatar_url?: string;
  profile_image?: string;
  referral_code?: string;
  notification_settings?: any;
  registered_apps?: string[];
}

interface HubContextType {
  user: HubUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  balance: number | null;
  refreshSession: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  updateNotificationSettings: (settings: { email: boolean; smart_notification?: boolean }) => Promise<boolean>;
}

const HubContext = createContext<HubContextType | undefined>(undefined);

function extractJwtPayloadInfo(token?: string | null): { userId: string; email: string } {
  if (!token) return { userId: '', email: '' };
  try {
    const parts = token.split('.');
    if (parts.length < 2) return { userId: '', email: '' };
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonStr);
    return {
      userId: String(payload.userId || payload.id || payload.sub || '').trim(),
      email: String(payload.email || '').trim().toLowerCase()
    };
  } catch {
    return { userId: '', email: '' };
  }
}

export function HubProvider({ children, appId }: { children: React.ReactNode; appId?: string }) {
  // 🚀 [SSO 선제 캡처 방어막] 자식 컴포넌트(예: App.tsx의 useEffect history.replaceState)가 실행되기 전에
  // 렌더링 초기화 단계에서 URL의 ?sso_token= 또는 ?token=을 최우선으로 로컬스토리지/쿠키에 저장하고 이전 계정 캐시를 즉시 소거합니다.
  useState(() => {
    if (typeof window !== 'undefined') {
      try {
        getSessionToken();
      } catch {}
    }
    return true;
  });

  const [user, setUser] = useState<HubUser | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);

  // appId 설정 주입
  useEffect(() => {
    if (appId) {
      configureMerlinHub({ appId });
    }
  }, [appId]);

  const refreshBalance = useCallback(async () => {
    try {
      const userId = getUserId();
      if (!userId) return;
      
      const result = await getBalance(userId);
      if (result.success && typeof result.balance === 'number') {
        setBalance(result.balance);
        if (typeof window !== 'undefined') {
          localStorage.setItem('merlin_cached_balance', String(result.balance));
        }
      }
    } catch (err) {
      console.error('[HubProvider] Failed to fetch balance:', err);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      if (
        typeof window !== 'undefined' &&
        (localStorage.getItem('merlin_logged_out') === '1' ||
          sessionStorage.getItem('merlin_logged_out') === '1')
      ) {
        setUser(null);
        setIsLoggedIn(false);
        setBalance(null);
        setIsLoading(false);
        return;
      }
      // 캐시가 존재할 때는 UI 깜빡임 방지를 위해 로딩 스켈레톤을 띄우지 않고 백그라운드 갱신합니다.
      setIsLoading(prev => {
        if (typeof window !== 'undefined') {
          return !localStorage.getItem('merlin_cached_user');
        }
        return prev;
      });
      const session = await checkSession();

      // 🚨 인플라이트 checkSession() 대기 중 로그아웃이 실행된 경우 상태/캐시 복원 즉시 차단
      if (
        typeof window !== 'undefined' &&
        (localStorage.getItem('merlin_logged_out') === '1' ||
          sessionStorage.getItem('merlin_logged_out') === '1')
      ) {
        setUser(null);
        setIsLoggedIn(false);
        setBalance(null);
        return;
      }
      
      if (session.valid && session.email) {
        const freshUser = {
          id: session.userId || '',
          email: session.email,
          nickname: session.nickname,
          avatar_url: session.avatar_url,
          referral_code: session.referral_code,
          notification_settings: (session as any).notification_settings || {},
          registered_apps: (session as any).registered_apps || [],
        };
        setUser(freshUser);
        setIsLoggedIn(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('merlin_cached_user', JSON.stringify(freshUser));
          if (freshUser.id) {
            localStorage.setItem('merlin_user_id', freshUser.id);
          }
          if (freshUser.email) {
            localStorage.setItem('userEmail', freshUser.email);
          }
          window.dispatchEvent(new CustomEvent('merlinLoggedIn', { detail: freshUser }));
        }
        // 세션 확인 성공 시 잔액도 업데이트
        refreshBalance();
      } else if (session.status === 401 || session.status === 403) {
        // 서버의 명시적인 인증 거부(401/403)일 때만 세션 클리어
        setUser(null);
        setIsLoggedIn(false);
        setBalance(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('merlin_cached_user');
          localStorage.removeItem('merlin_cached_balance');
        }
      }
      // 일시적인 네트워크 오류(status 0, 502 등)일 때는 기존 캐시된 로그인 상태를 유지!
    } catch (err) {
      console.error('[HubProvider] Failed to sync session:', err);
    } finally {
      setIsLoading(false);
    }
  }, [refreshBalance]);

  const updateNotificationSettings = useCallback(async (settings: { email: boolean; smart_notification?: boolean }) => {
    try {
      const { MerlinHubClient } = await import('./CoreLogic/client');
      const client = new MerlinHubClient();
      const result = await client.updateProfile({
        notification_settings: settings,
      });
      if (result) {
        await refreshSession();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[HubProvider] Failed to update notification settings:', err);
      return false;
    }
  }, [refreshSession]);

  // 초기 로드 및 이벤트 리스너
  useEffect(() => {
    // 🚀 [멀린 패밀리 강령] 카카오톡 및 주요 인앱브라우저 0.1초 자동 탈출 (세션 격리 박멸 & 기설치 PWA/정식 브라우저 직송 & 특정 페이지 해시 100% 보존)
    if (typeof window !== 'undefined') {
      const userAgent = navigator.userAgent || '';
      const isAndroid = /Android/i.test(userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
      const isKakao = /KAKAOTALK|kakaowork/i.test(userAgent);
      const isLine = /Line/i.test(userAgent);
      const isInApp = isKakao || isLine || /NAVER|Instagram|FB|FBAN|FBAV/i.test(userAgent);

      // 마지막 탈출 시도 시간 (무한 루프 방지: 3초 스로틀링)
      const lastEscapeTime = Number(sessionStorage.getItem('merlin_inapp_escaped_time') || 0);
      const isRecentlyEscaped = Date.now() - lastEscapeTime < 3000;

      if (isInApp && !isRecentlyEscaped) {
        sessionStorage.setItem('merlin_inapp_escaped_time', String(Date.now()));

        // 특정 페이지 해시(#shorts/..., #store, #my 등)를 100% 안전 보존
        // 안드로이드 intent 문법상 #Intent;와 충돌하지 않도록 해시의 '#'을 '%23'으로 안전 인코딩하여 전달
        const cleanHost = window.location.host;
        const currentPath = window.location.pathname || '/';
        const currentSearch = window.location.search || '';
        const currentHash = window.location.hash || '';
        const encodedHash = currentHash ? '%23' + currentHash.replace(/^#/, '') : '';
        const fullTargetUri = `${cleanHost}${currentPath}${currentSearch}${encodedHash}`;

        if (isAndroid) {
          // 안드로이드: 기설치된 PWA(WebAPK) 단독 앱 1순위 호출 (package 고정 해제로 OS가 기설치 PWA 우선 매칭, 미설치 시 기본 브라우저 연결)
          const fallbackUrl = encodeURIComponent(window.location.href);
          window.location.href = `intent://${fullTargetUri}#Intent;scheme=https;S.browser_fallback_url=${fallbackUrl};end`;
          return;
        } else if (isIOS && isKakao) {
          // iOS 카카오톡: 외부 브라우저(Safari) 호출 스킴 자동 시도
          const safariExternalUrl = `kakaotalk://web/openExternal?url=${encodeURIComponent(window.location.href)}`;
          window.location.href = safariExternalUrl;
        }
      }

      const urlParams = new URLSearchParams(window.location.search);

      // SSO (Single Sign-On) 토큰 파싱: 귀신팸 앱 스위처를 통해 넘어올 때 로그인 상태 유지
      const ssoToken = urlParams.get('sso_token') || urlParams.get('token');
      if (ssoToken && ssoToken.split('.').length === 3) {
        const prevToken = localStorage.getItem('merlin_session_token');
        const incomingInfo = extractJwtPayloadInfo(ssoToken);
        const cachedRaw = localStorage.getItem('merlin_cached_user');
        let cachedEmail = '';
        let cachedId = '';
        if (cachedRaw) {
          try {
            const parsed = JSON.parse(cachedRaw);
            cachedEmail = String(parsed?.email || '').trim().toLowerCase();
            cachedId = String(parsed?.id || parsed?.userId || '').trim();
          } catch {}
        }
        const isDifferentUser =
          (prevToken && prevToken !== ssoToken) ||
          (incomingInfo.email && cachedEmail && incomingInfo.email !== cachedEmail) ||
          (incomingInfo.userId && cachedId && incomingInfo.userId !== cachedId);

        if (isDifferentUser) {
          localStorage.removeItem('merlin_cached_user');
          localStorage.removeItem('merlin_cached_balance');
          localStorage.removeItem('userNickname');
          localStorage.removeItem('userEmail');
          localStorage.removeItem('userProfileImage');
          localStorage.removeItem('merlin_user_id');
        }

        setSessionToken(ssoToken);
        console.log('[HubProvider] Detected SSO token, saving to session and domain cookie');
        
        // 보안 및 깔끔한 URL을 위해 주소창에서 token 파라미터 제거
        urlParams.delete('token');
        urlParams.delete('sso_token');
        const searchStr = urlParams.toString();
        const newUrl = window.location.pathname + (searchStr ? '?' + searchStr : '') + window.location.hash;
        window.history.replaceState({}, '', newUrl);
      }
    }

    // 1. SSR Hydration 이후 즉시 로컬 스토리지/공용 쿠키의 세션 토큰을 확인 (SWR)
    const token = getSessionToken();
    if (token) {
      const tokenInfo = extractJwtPayloadInfo(token);
      const cachedUser = localStorage.getItem('merlin_cached_user');
      const cachedBalance = localStorage.getItem('merlin_cached_balance');
      
      let parsedUser = null;
      let parsedBalance = null;
      
      if (cachedUser) {
        try {
          const candidate = JSON.parse(cachedUser);
          const candEmail = String(candidate?.email || '').trim().toLowerCase();
          const candId = String(candidate?.id || candidate?.userId || '').trim();
          const emailMismatch = Boolean(tokenInfo.email && candEmail && tokenInfo.email !== candEmail);
          const idMismatch = Boolean(tokenInfo.userId && candId && tokenInfo.userId !== candId);
          if (emailMismatch || idMismatch) {
            localStorage.removeItem('merlin_cached_user');
            localStorage.removeItem('merlin_cached_balance');
          } else {
            parsedUser = candidate;
          }
        } catch {}
      } else {
        // 백업용 fallback: 기존 어플리케이션 전역에서 쓰고 있는 userNickname/userProfileImage 사용
        const backupNickname = localStorage.getItem('userNickname');
        const backupEmail = (localStorage.getItem('userEmail') || '').trim().toLowerCase();
        const backupAvatar = localStorage.getItem('userProfileImage') || '';
        const backupUserId = (localStorage.getItem('merlin_user_id') || '').trim();
        const emailMismatch = Boolean(tokenInfo.email && backupEmail && tokenInfo.email !== backupEmail);
        const idMismatch = Boolean(tokenInfo.userId && backupUserId && tokenInfo.userId !== backupUserId);
        if (backupNickname && !emailMismatch && !idMismatch) {
          parsedUser = {
            id: backupUserId || tokenInfo.userId,
            email: backupEmail || tokenInfo.email,
            nickname: backupNickname,
            avatar_url: backupAvatar,
            notification_settings: {}
          };
        }
      }

      if (cachedBalance) {
        parsedBalance = parseInt(cachedBalance, 10);
      }

      if (parsedUser) {
        setUser(parsedUser);
        setIsLoggedIn(true);
        setIsLoading(false); // 캐시가 있다면 우선 로딩 스켈레톤 제거
      }
      if (parsedBalance !== null) {
        setBalance(parsedBalance);
      }
    } else {
      // 비로그인 사용자는 로딩 상태 즉시 해제 (게스트로 렌더링)
      setIsLoading(false);
    }

    // 2. 백그라운드 갱신 실행 (서버의 최신 상태와 동기화)
    refreshSession();

    // 외부 이벤트 대응 (로그인 성공, 세션 만료, 잔액 변동 등)
    const handleProfileUpdate = () => {
      if (
        typeof window !== 'undefined' &&
        (localStorage.getItem('merlin_logged_out') === '1' ||
          sessionStorage.getItem('merlin_logged_out') === '1')
      ) {
        return;
      }
      refreshSession();
    };
    const handleCreditsUpdate = () => refreshBalance();
    const handleSessionExpired = () => {
      setUser(null);
      setIsLoggedIn(false);
      setBalance(null);
      setIsLoading(false);
      clearSessionToken('local');
      localStorage.removeItem('merlin_cached_user');
      localStorage.removeItem('merlin_cached_balance');
    };

    // 3. 멀티 탭 실시간 동기화: 다른 탭에서 로그인/로그아웃하거나 탭 활성화 시 세션 갱신 (5분 스마트 스로틀링)
    let lastCheckTime = Date.now();
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const currentToken = getSessionToken();
        const now = Date.now();
        if (currentToken) {
          // 탭 전환 시 과도한 API 연타 방지: 최소 5분(300,000ms) 경과 시에만 백그라운드 갱신
          if (now - lastCheckTime > 5 * 60 * 1000) {
            lastCheckTime = now;
            refreshSession();
          }
        } else if (isLoggedIn) {
          // 🚨 Local Token Shield: 이 앱 자체의 로컬스토리지에 토큰이 살아있다면, 타 앱 로그아웃이나 쿠키 변동으로 세션을 죽이지 않음!
          const localToken = typeof window !== 'undefined' ? localStorage.getItem('merlin_session_token') : null;
          if (!localToken) {
            handleSessionExpired();
          }
        }
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'merlin_logged_out' && e.newValue === '1') {
        handleSessionExpired();
        return;
      }
      if (e.key === 'merlin_session_token' && !e.newValue) {
        handleSessionExpired();
        return;
      }
      if (e.key === 'merlin_session_token' || e.key === 'merlin_cached_user') {
        refreshSession();
      }
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    window.addEventListener('creditsUpdated', handleCreditsUpdate);
    window.addEventListener('merlinSessionExpired', handleSessionExpired);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
      window.removeEventListener('creditsUpdated', handleCreditsUpdate);
      window.removeEventListener('merlinSessionExpired', handleSessionExpired);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [refreshSession, refreshBalance, isLoggedIn]);

  return (
    <HubContext.Provider value={{ 
      user, 
      isLoggedIn, 
      isLoading, 
      balance, 
      refreshSession, 
      refreshBalance,
      updateNotificationSettings
    }}>
      {children}
      <HubOfflineBanner />
    </HubContext.Provider>
  );
}

export function useHub() {
  const context = useContext(HubContext);
  if (context === undefined) {
    throw new Error('useHub must be used within a HubProvider');
  }
  return context;
}
