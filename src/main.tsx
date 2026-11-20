import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initNativePushRouter } from './services/nativePushRouter';
import {
  GHOSTI_LOGOUT_LOCK_UNTIL_KEY,
  GHOSTI_POST_LOGOUT_WORKSPACE_KEY,
  clearGhostiSupabaseSession,
  purgeAllGhostiLocalAuthArtifacts,
} from './services/supabaseClient';

// [초대 토큰 ↔ 허브 SSO ?token= 충돌 및 로그아웃 직후 인플라이트 /api/auth/me(newToken) 부활 레이스 원천 차단 가드 (MerlinHub SDK 무수정 보호)]
// - 1) 직전 페이지에서 [로그아웃] 클릭 직후 언로드 대기 중 인플라이트 /api/auth/me(newToken) 응답이 merlin_session_token을 되살린 경우,
//      HubProvider 마운트 이전 동기 시점에 1회성 락을 소비하며 세션을 100% 소거하고 게스트 상태를 확정합니다.
// - 2) 공유방/업무방 구형 초대 링크(?invite=...&token=<hex> 또는 ?workRoom=...&token=<hex>)로 접속했을 때
//      HubProvider가 방 초대 토큰을 SSO 로그인 JWT로 오인해 세션을 오염시키거나 URL에서 삭제하기 전에
//      마운트 이전 동기 시점에 ?inviteToken=<hex>로 안전하게 승격합니다. (정식 3단 JWT eyJ...는 SSO용으로 100% 보존)
if (typeof window !== 'undefined') {
  try {
    const pendingLogoutLockUntil = Number(localStorage.getItem(GHOSTI_LOGOUT_LOCK_UNTIL_KEY) || 0);
    if (pendingLogoutLockUntil > 0) {
      if (Date.now() <= pendingLogoutLockUntil) {
        purgeAllGhostiLocalAuthArtifacts({ clearLogoutLock: true });
      } else {
        localStorage.removeItem(GHOSTI_LOGOUT_LOCK_UNTIL_KEY);
      }
    } else if (
      localStorage.getItem('merlin_logged_out') === '1' &&
      !(localStorage.getItem('merlin_session_token') || '').trim()
    ) {
      clearGhostiSupabaseSession();
    }

    // 워크스페이스에서 로그아웃 직후 루트('/')로 이동된 경우, 온보딩/쇼룸 대문으로 튕기지 않고
    // 마운트 이전 동기 시점에 게스트 워크스페이스 URL(?lounge=personal&tab=...)로 즉시 정착
    const postLogoutRaw = localStorage.getItem(GHOSTI_POST_LOGOUT_WORKSPACE_KEY);
    if (postLogoutRaw) {
      localStorage.removeItem(GHOSTI_POST_LOGOUT_WORKSPACE_KEY);
      try {
        const parsedReturn = JSON.parse(postLogoutRaw) as {
          lounge?: string;
          tab?: string;
          ts?: number;
        };
        const isFresh =
          typeof parsedReturn?.ts === 'number' && Date.now() - parsedReturn.ts < 30_000;
        const curParams = new URLSearchParams(window.location.search);
        const isBareRoot =
          !curParams.get('lounge') &&
          !curParams.get('tab') &&
          !curParams.has('invite') &&
          !curParams.has('inviteToken') &&
          !curParams.has('workRoom') &&
          curParams.get('view') !== 'showroom';
        if (isFresh && isBareRoot) {
          purgeAllGhostiLocalAuthArtifacts({ clearLogoutLock: true });
          const safeLounge = parsedReturn.lounge === 'personal' ? 'personal' : 'personal';
          const safeTab =
            parsedReturn.tab &&
            ['trash', 'dashboard', 'sync', 'settings', 'share'].includes(parsedReturn.tab)
              ? parsedReturn.tab
              : 'trash';
          const nextSearch = `?lounge=${encodeURIComponent(safeLounge)}&tab=${encodeURIComponent(safeTab)}`;
          window.history.replaceState({}, '', `${window.location.pathname}${nextSearch}`);
        }
      } catch {
        /* ignore post-logout restore parse error */
      }
    }

    const params = new URLSearchParams(window.location.search);
    const rawTok = (params.get('token') || '').trim();
    if (rawTok) {
      const isThreePartJwt =
        rawTok.startsWith('eyJ') && rawTok.split('.').length === 3;
      const isRoomInviteContext =
        params.has('invite') ||
        params.has('workRoom') ||
        params.get('preview') === 'guest' ||
        /^[a-f0-9]{24,64}$/i.test(rawTok);
      if (!isThreePartJwt && isRoomInviteContext) {
        if (!params.get('inviteToken')) {
          params.set('inviteToken', rawTok);
        }
        params.delete('token');
        const qs = params.toString();
        const safeUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`;
        window.history.replaceState(window.history.state || {}, '', safeUrl);
      }
    }
    // 과거 테스트 중 36자리 hex 초대 토큰이 merlin_session_token에 잘못 저장된 잔재가 있으면 즉시 정화
    const storedHubSession = (localStorage.getItem('merlin_session_token') || '').trim();
    if (storedHubSession && !storedHubSession.includes('.') && /^[a-f0-9]{28,48}$/i.test(storedHubSession)) {
      localStorage.removeItem('merlin_session_token');
      document.cookie = 'merlin_session_token=; path=/; max-age=0;';
    }
  } catch {
    /* ignore URL/storage guard error */
  }
}

// Register PWA Service Worker with immediate update check (prevents stale HTML/JS cache)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        void reg.update();
      })
      .catch(() => {
        /* ignore sw error in dev */
      });
  });
}

// [스토어 앱] 네이티브(Capacitor) 구동 시에만 패밀리 공용 동적 푸시 라우팅 초기화 (웹에서는 즉시 반환)
void initNativePushRouter();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
