import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import {
  HubProvider,
  useHub,
  HubProfileWidget,
  HubProfileCard,
  HubNotificationCard,
  HubLogoutCard,
  HubAuthModal,
  HubPurchaseWidget,
  HubGiftBoxModal,
  HubAppSwitcher,
  HubErrorBoundary,
  HubBugReporter,
  HubSupportLink,
  HubNotifier,
} from '../services/merlin-hub-sdk/react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { storeSharedRefs } from '../store/slices/storeSharedRefs';
import { zCoreBridge } from '../services/zCoreBridge';
import {
  GHOSTI_POST_LOGOUT_WORKSPACE_KEY,
  syncHubUserToLocalSupabase,
  clearGhostiSupabaseSession,
  clearGhostiLogoutLock,
  isGhostiExplicitlyLoggedOut,
  purgeAllGhostiLocalAuthArtifacts,
} from '../services/supabaseClient';
import { clearCachedSharedRoomTokens } from '../services/sharedPhotoRoomSupabase';
import { clearWorkRoomLocalCachesOnLogout } from '../services/workRoomSyncService';
import {
  loadCachedDeviceIntegrationSnapshot,
  loadCachedSyncedClips,
} from '../services/deviceIntegrationService';
import {
  clearStoredInviteSession,
  readActiveInviteToken,
} from '../services/shareInviteDeepLinkBridge';
import {
  bindGhostSecretaryAccountOwner,
  clearGhostSecretaryAccountNicknameOnLogout,
  isInvalidNicknameCandidate,
  loadGhostPassportBook,
  loadGhostSecretaryState,
  saveGhostPassportBook,
  saveGhostSecretaryState,
  setPassportSelf,
} from '../services/ghostSecretaryEngine';
import type { GiftProductItem } from '../services/merlin-hub-sdk/react';
import { GhostiSubscriptionCheckoutModal } from './GhostiSubscriptionCheckoutModal';
import { PENDING_SUB_CHECKOUT_STORAGE_KEY } from '../services/subscriptionPlanCatalog';
import type { PricingPlanId } from '../types/saysee';

/**
 * [귀신같이 선물함 상품]
 * - SDK 기본값(미전달 시)은 어그로필터 '영상 분석 N회' 묶음이 노출되므로 귀신같이 화면에 부적합.
 * - 귀신같이 전용 앱 아이템(예: 방장 구독권) 선물 상품은 가격표 확정 전까지 만들지 않고,
 *   전 패밀리 공통 '자유 코인 선물' 1종만 노출합니다.
 */
const GHOSTI_GIFT_PRODUCTS: GiftProductItem[] = [
  {
    id: 'custom_coin',
    title: '🎀 자유 코인 선물',
    subtitle: '1,000C 이상 직접 입력',
    fullTitle: '🎀 패밀리 코인 자유 선물',
    amount: 1000,
    category: 'COIN',
    emoji: '🎀',
    defaultMessage: '마음을 담아 준비한 패밀리 코인 선물입니다! 반갑게 열어보세요 🎁',
    isCustom: true,
  },
];

/**
 * [스토어 심사 방어 감지 헬퍼]
 * - 네이티브(Capacitor iOS/Android) 환경이거나 `isStoreAppMode && !enableMobileCoinDisplay`일 때
 *   앱 내부에서 코인/충전소/결제 유도 DOM을 100% 원천 숨김 처리합니다 (Apple 3.1.3(b) 준수).
 */
export function useIsCoinHiddenInStore(): boolean {
  const { isStoreAppMode, enableMobileCoinDisplay } = useSaySeeStore();
  const isCapacitorNative =
    typeof window !== 'undefined' &&
    Boolean((window as any).Capacitor?.isNativePlatform?.());
  if (isCapacitorNative && !enableMobileCoinDisplay) {
    return true;
  }
  return Boolean(isStoreAppMode && !enableMobileCoinDisplay);
}

/**
 * [0. 우측 상단 헤더 앱 공유 아이콘 버튼 + 아이콘 직하단 초경량 복사 알림 말풍선]
 * - 하단 전역 토스트(lastQuarantineToast)를 띄우지 않고, 클릭한 공유 아이콘 바로 밑에 가볍게 떴다가 2.2초 뒤 사라집니다.
 */
export const GhostiHeaderQuickShareButton: React.FC<{
  themeMode: 'light' | 'dark';
  compact?: boolean;
}> = ({ themeMode, compact = false }) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setCopied(false);
      }
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [copied]);

  const handleShareClick = () => {
    const shareText =
      '귀신같이(Ghosti) — 내 PC와 모바일에 1초 초능력을! 내용검색·비서·사진공유는 평생 0원 (초대받은 가족·회원·직원도 언제나 무료) https://ghosti.sundreamer.app';
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(shareText).catch(() => {});
    }
    setCopied(true);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setCopied(false);
      timerRef.current = null;
    }, 2200);
  };

  return (
    <div ref={wrapRef} className="relative flex items-center shrink-0">
      <button
        type="button"
        onClick={handleShareClick}
        title="지인·가족에게 앱 공유하기 (초대받은 가족·회원·직원은 언제나 무료)"
        aria-label="앱 공유 링크 복사"
        className={`flex ${
          compact ? 'w-7 h-7' : 'w-6 h-6 sm:w-7 sm:h-7'
        } rounded-lg items-center justify-center transition-all cursor-pointer shrink-0 outline-none ${
          copied
            ? themeMode === 'light'
              ? 'bg-teal-50 text-teal-700'
              : 'bg-teal-500/20 text-teal-300'
            : themeMode === 'light'
            ? 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
            : 'text-zinc-300 hover:text-white hover:bg-white/10'
        }`}
      >
        <span className="material-symbols-outlined text-[15px]">
          {copied ? 'check' : 'share'}
        </span>
      </button>

      {copied && (
        <div
          role="status"
          aria-live="polite"
          className={`absolute right-0 top-full mt-1.5 z-50 px-2.5 py-1.5 rounded-xl border whitespace-nowrap pointer-events-none select-none shadow-lg transition-all ${
            themeMode === 'light'
              ? 'bg-white/98 border-teal-200 text-slate-800 shadow-slate-900/10'
              : 'bg-zinc-900/95 border-teal-400/40 text-zinc-100 shadow-black/50'
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute -top-1 right-2.5 w-2 h-2 rotate-45 border-l border-t ${
              themeMode === 'light'
                ? 'bg-white border-teal-200'
                : 'bg-zinc-900 border-teal-400/40'
            }`}
          />
          <div className="flex items-center gap-1 text-[11.5px] font-extrabold leading-tight">
            <span className={themeMode === 'light' ? 'text-teal-600' : 'text-teal-300'}>✓</span>
            <span>공유 링크 복사됨</span>
          </div>
          <div
            className={`text-[10px] font-semibold leading-tight mt-0.5 ${
              themeMode === 'light' ? 'text-slate-500' : 'text-zinc-400'
            }`}
          >
            초대받은 분은 언제나 무료
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * [1. 우측 상단 헤더 허브 앵커 (프로필 위젯 단독)]
 * - 코인 표시 알약은 프로필 모달 내부에 이미 포함되어 있으므로 헤더에서 제외하고,
 *   허브 표준 프로필 위젯만 심플하게 렌더링합니다.
 */
export const GhostiTopRightHubAnchor: React.FC<{ themeMode: 'light' | 'dark' }> = ({
  themeMode,
}) => {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {/* 🐾 허브 표준 프로필 위젯 (클릭 시 통합 프로필·귀신여권·코인/선물함·문의방 모달 오픈) */}
      <div
        className={`rounded-full px-0.5 sm:px-1 py-0.5 border transition-colors ${
          themeMode === 'light'
            ? 'bg-slate-50/90 border-slate-200/80'
            : 'bg-zinc-900/90 border-white/10'
        }`}
      >
        <HubProfileWidget
          layout="row"
          onLoginClick={() => window.dispatchEvent(new CustomEvent('openLoginModal'))}
          onProfileClick={() => window.dispatchEvent(new CustomEvent('openProfileModal'))}
        />
      </div>
    </div>
  );
};

/**
 * [2. 좌측 하단 노션형 사이드바 패밀리 앱 런처 (허브 공식 SDK `HubAppSwitcher` v2.8.0 정품 연동)]
 * - 임의의 수동 아코디언 코드를 전량 폐기하고, 허브 공식 SDK `<HubAppSwitcher variant="sidebar" placement="bottom-up" />`를 그대로 렌더링합니다.
 * - 클릭 시 가입된 앱(3열 공식 로고 그리드)과 미가입 앱(`썬드리머 패밀리 앱 New` 상세 리스트)이 담긴 정품 화이트 카드 팝업이 사이드바 위로 펼쳐집니다.
 */
export const GhostiSidebarBottomFamilyLauncher: React.FC<{
  isOpen?: boolean;
  onToggle?: () => void;
}> = () => {
  return (
    <div className="pt-3 border-t border-black/10 dark:border-white/10">
      <HubAppSwitcher currentAppId="ghosti" variant="sidebar" placement="bottom-up" />
    </div>
  );
};

/**
 * [3. 허브 전역 모달 & 귀신같이 스토어/수파베이스 자동 동기화 엔진]
 */
const GhostiHubGlobalModals: React.FC = () => {
  const { user, isLoggedIn, balance, refreshSession, refreshBalance } = useHub();
  const hideCoin = useIsCoinHiddenInStore();

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
  const [purchaseModalOpts, setPurchaseModalOpts] = useState<{
    minCustomCoin?: number;
    redirectUrl?: string;
    returnToCheckoutPlan?: PricingPlanId;
  }>({});
  const [isGiftBoxOpen, setIsGiftBoxOpen] = useState(false);
  const wasLoggedInRef = useRef(false);
  const lastAuthedEmailRef = useRef('');
  const logoutInProgressRef = useRef(false);

  const performGhostiCleanLogout = useCallback(() => {
    logoutInProgressRef.current = true;
    wasLoggedInRef.current = false;
    lastAuthedEmailRef.current = '';
    setIsProfileOpen(false);
    const curState = useSaySeeStore.getState();
    const hasUrlInviteToken = Boolean(readActiveInviteToken());
    purgeAllGhostiLocalAuthArtifacts({ setLogoutLockMs: 15_000 });
    clearWorkRoomLocalCachesOnLogout();
    // 워크스페이스 내부에서 로그아웃 시 현재 화면(탭) 그대로 게스트 전환되며,
    // 새로고침(F5)이나 뒤로가기를 눌러도 온보딩/쇼룸 대문으로 튕기지 않고 게스트 워크스페이스에 정착하도록 라우팅 플래그 보존
    if (typeof window !== 'undefined') {
      try {
        const curParams = new URLSearchParams(window.location.search);
        const isInWorkspace =
          curParams.get('view') !== 'showroom' &&
          (Boolean(curParams.get('lounge')) ||
            Boolean(curParams.get('tab')) ||
            curParams.get('dev') === 'true' ||
            curParams.has('invite') ||
            curParams.has('workRoom') ||
            Boolean(
              (window as unknown as { __GHOSTI_ACTIVE_ROUTE__?: { viewMode?: string } })
                .__GHOSTI_ACTIVE_ROUTE__?.viewMode === 'workspace'
            ));
        if (isInWorkspace) {
          const safeTab =
            curState.activeLoungeType === 'personal' &&
            ['trial', 'trash', 'dashboard', 'sync', 'settings', 'share', 'superpower_dojo', 'search_dojo'].includes(curState.desktopTab)
              ? curState.desktopTab
              : 'trash';
          localStorage.setItem('ghosti_onboarding_completed', 'true');
          sessionStorage.setItem('ghosti_entered_from_showroom', '1');
          localStorage.setItem(
            GHOSTI_POST_LOGOUT_WORKSPACE_KEY,
            JSON.stringify({
              lounge: 'personal',
              tab: safeTab,
              ts: Date.now(),
            })
          );
          if (!curParams.get('lounge') || !curParams.get('tab')) {
            curParams.set('lounge', 'personal');
            curParams.set('tab', safeTab);
            const nextUrl = `${window.location.pathname}?${curParams.toString()}${window.location.hash || ''}`;
            window.history.replaceState(window.history.state || {}, '', nextUrl);
          }
        }
      } catch {
        /* ignore storage error */
      }
      window.setTimeout(() => {
        logoutInProgressRef.current = false;
      }, 400);
    }
    clearGhostSecretaryAccountNicknameOnLogout();
    clearCachedSharedRoomTokens();
    storeSharedRefs.activeSharedRoomId = null;
    storeSharedRefs.knownJoinedRoomIds.clear();
    if (!hasUrlInviteToken) {
      clearStoredInviteSession();
    }
    useSaySeeStore.setState((state) => {
      const isInSharedLounge =
        state.activeLoungeType === 'family' ||
        state.activeLoungeType === 'club' ||
        state.activeLoungeType === 'student';
      return {
        pcAgentPairedMobile: false,
        connectedDevices: [],
        devicePairingCode6: null,
        deviceEntitlement: null,
        syncedClipboardItems: [],
        showSharedPhotoUploadModal: false,
        isInvitedMemberSession: false,
        activeSharedRoomId: null,
        activeJoinedRoomMeta: null,
        joinedSharedRooms: [],
        ...(!hasUrlInviteToken
          ? {
              sharedRoomAddedPhotos: [],
              sharedRoomHostPhotos: [],
              ...(isInSharedLounge ? { searchResults: [] } : {}),
            }
          : {}),
        merlinAuth: {
          ...state.merlinAuth,
          token: '',
          userId: 'guest',
          email: '',
          coinBalance: 0,
        },
      };
    });
    if (typeof window !== 'undefined') {
      // 언로드 직전 최종 스위프: 프로필 모달이 띄운 인플라이트 /api/auth/me(newToken) 응답이
      // 리로드 대기 중 세션을 되살려도 페이지 전환 직전에 즉시 재소거합니다.
      const finalWipe = () => {
        purgeAllGhostiLocalAuthArtifacts({ setLogoutLockMs: 15_000 });
    clearWorkRoomLocalCachesOnLogout();
      };
      window.addEventListener('pagehide', finalWipe, { once: true });
      window.addEventListener('beforeunload', finalWipe, { once: true });
    }
  }, []);

  // 허브 인증/잔액 변화 시 Ghosti 내부 스토어(merlinAuth) 및 단독 Supabase(`public.users.id = family_users.id`) 자동 동기화
  useEffect(() => {
    if (logoutInProgressRef.current) {
      return;
    }
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('merlin_session_token') || '' : '';

    if (isLoggedIn && user?.id && user?.email) {
      const cleanUserEmail = user.email.trim().toLowerCase();
      const didSwitchAccountDirectly = Boolean(
        lastAuthedEmailRef.current && lastAuthedEmailRef.current !== cleanUserEmail
      );
      lastAuthedEmailRef.current = cleanUserEmail;

      if (didSwitchAccountDirectly) {
        clearCachedSharedRoomTokens();
        storeSharedRefs.activeSharedRoomId = null;
        storeSharedRefs.knownJoinedRoomIds.clear();
        if (!readActiveInviteToken()) {
          clearStoredInviteSession();
        }
      }

      let restoredMobilePaired = false;
      if (typeof window !== 'undefined') {
        try {
          restoredMobilePaired =
            localStorage.getItem(`ghosti_mobile_paired_${cleanUserEmail}`) === '1';
        } catch {
          restoredMobilePaired = false;
        }
      }
      const cachedDevSnap = loadCachedDeviceIntegrationSnapshot(cleanUserEmail);
      useSaySeeStore.setState((state) => ({
        pcAgentPairedMobile:
          restoredMobilePaired ||
          Boolean(cachedDevSnap?.devices?.some((d) => d.device_kind === 'mobile')) ||
          (cachedDevSnap?.devices?.length || 0) >= 2,
        connectedDevices: didSwitchAccountDirectly
          ? cachedDevSnap?.devices || []
          : cachedDevSnap?.devices?.length
          ? cachedDevSnap.devices
          : state.connectedDevices,
        devicePairingCode6: didSwitchAccountDirectly
          ? cachedDevSnap?.pairingCode ?? null
          : cachedDevSnap?.pairingCode ?? state.devicePairingCode6,
        deviceEntitlement: didSwitchAccountDirectly
          ? cachedDevSnap?.entitlement ?? null
          : cachedDevSnap?.entitlement ?? state.deviceEntitlement,
        syncedClipboardItems: loadCachedSyncedClips(cleanUserEmail),
        ...(didSwitchAccountDirectly
          ? {
              activeSharedRoomId: null,
              activeJoinedRoomMeta: null,
              joinedSharedRooms: [],
              sharedRoomAddedPhotos: [],
              sharedRoomHostPhotos: [],
              searchResults: [],
            }
          : {}),
        merlinAuth: {
          ...state.merlinAuth,
          token,
          userId: user.id,
          email: user.email,
          coinBalance: typeof balance === 'number' ? balance : 0,
        },
      }));

      const cleanHubNick = (user.nickname || '').trim();
      bindGhostSecretaryAccountOwner(user.email, cleanHubNick);

      void syncHubUserToLocalSupabase({
        userId: user.id,
        email: user.email,
        nickname: cleanHubNick || undefined,
        hubToken: token,
      });

      // 허브 회원 닉네임이 있을 때 귀신비서 별명이 비어 있거나 문장형 오인식 값으로 오염되어 있으면 즉시 정화·복원하고 awaitingNickname 지뢰 해제
      if (cleanHubNick && !isInvalidNicknameCandidate(cleanHubNick)) {
        const secSt = loadGhostSecretaryState();
        if (!secSt.nickname || isInvalidNicknameCandidate(secSt.nickname) || secSt.awaitingNickname) {
          const healedNick = !secSt.nickname || isInvalidNicknameCandidate(secSt.nickname) ? cleanHubNick : secSt.nickname;
          saveGhostSecretaryState({
            ...secSt,
            ownerEmail: user.email.trim().toLowerCase(),
            nickname: healedNick,
            awaitingNickname: false,
          });
          saveGhostPassportBook(setPassportSelf(loadGhostPassportBook(), healedNick));
          try {
            localStorage.setItem('userNickname', healedNick);
          } catch {
            /* ignore */
          }
          window.dispatchEvent(new CustomEvent('ghosti_jump_to_secretary'));
        }
      }

      // 유저가 이미 귀신비서에서 내 컴퓨터 연결에 동의한 세션일 때만 로컬 Z-코어 헬스체크 및 실물 파일 동기화 수행
      void zCoreBridge.checkHealth(false).then((alive) => {
        if (alive) {
          void useSaySeeStore.getState().initApp(true);
        }
      });
    } else if (!isLoggedIn) {
      const hasUrlInviteToken = Boolean(readActiveInviteToken());
      const isMarkedLoggedOut =
        typeof window !== 'undefined' && localStorage.getItem('merlin_logged_out') === '1';
      // 로그아웃(로그인 → 게스트 전환) 시 귀신같이 Supabase 단기 토큰·별명·공유방 메모리 캐시 즉시 폐기 (타 계정 사진·별명 노출 0%)
      if (wasLoggedInRef.current || isMarkedLoggedOut) {
        clearGhostiSupabaseSession();
        clearGhostSecretaryAccountNicknameOnLogout();
        clearCachedSharedRoomTokens();
        storeSharedRefs.activeSharedRoomId = null;
        storeSharedRefs.knownJoinedRoomIds.clear();
        if (!hasUrlInviteToken) {
          clearStoredInviteSession();
        }
      }
      useSaySeeStore.setState((state) => {
        const isInSharedLounge =
          state.activeLoungeType === 'family' ||
          state.activeLoungeType === 'club' ||
          state.activeLoungeType === 'student';
        return {
          pcAgentPairedMobile: false,
          connectedDevices: [],
          devicePairingCode6: null,
          deviceEntitlement: null,
          syncedClipboardItems: [],
          showSharedPhotoUploadModal: false,
          isInvitedMemberSession: false,
          ...(wasLoggedInRef.current && !hasUrlInviteToken
            ? {
                activeSharedRoomId: null,
                activeJoinedRoomMeta: null,
                joinedSharedRooms: [],
                sharedRoomAddedPhotos: [],
                sharedRoomHostPhotos: [],
                ...(isInSharedLounge ? { searchResults: [] } : {}),
              }
            : {}),
          merlinAuth: {
            ...state.merlinAuth,
            token: '',
            userId: 'guest',
            email: '',
            coinBalance: 0,
          },
        };
      });
      if (wasLoggedInRef.current && hasUrlInviteToken) {
        void useSaySeeStore.getState().syncActiveSharedRoomFromSupabase();
      }
    }
    wasLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn, user?.id, user?.email, user?.nickname, balance]);

  // KCP 충전 리다이렉트(?ghosti_checkout_plan=... 또는 ?payment=success) 복귀 시 잔액 새로고침 + 구독 결제창 자동 복귀
  useEffect(() => {
    if (hideCoin || !isLoggedIn || typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlPlan = params.get('ghosti_checkout_plan') as PricingPlanId | null;
      const isPaySuccess = params.get('payment') === 'success';
      let pendingPlan: PricingPlanId | null = urlPlan;
      if (!pendingPlan && isPaySuccess) {
        const raw = localStorage.getItem(PENDING_SUB_CHECKOUT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { planId?: PricingPlanId; createdAt?: number };
          if (parsed?.planId && Date.now() - (parsed.createdAt || 0) <= 30 * 60 * 1000) {
            pendingPlan = parsed.planId;
          } else {
            localStorage.removeItem(PENDING_SUB_CHECKOUT_STORAGE_KEY);
          }
        }
      }
      if (pendingPlan) {
        localStorage.removeItem(PENDING_SUB_CHECKOUT_STORAGE_KEY);
        if (params.has('ghosti_checkout_plan') || params.has('payment')) {
          params.delete('ghosti_checkout_plan');
          params.delete('payment');
          const qs = params.toString();
          window.history.replaceState(
            window.history.state || {},
            '',
            `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`
          );
        }
        void refreshBalance().finally(() => {
          useSaySeeStore.getState().openSubscriptionCheckout(pendingPlan!);
        });
      }
    } catch {
      /* ignore */
    }
  }, [hideCoin, isLoggedIn, refreshBalance]);

  // 전역 모달 오픈 이벤트 리스너
  useEffect(() => {
    const onOpenLogin = () => setIsLoginOpen(true);
    const onOpenProfile = () => setIsProfileOpen(true);
    const onOpenPurchase = (ev?: Event) => {
      if (hideCoin) return;
      const detail = (ev as CustomEvent<{
        minCustomCoin?: number;
        redirectUrl?: string;
        returnToCheckoutPlan?: PricingPlanId;
      }> | undefined)?.detail;
      setPurchaseModalOpts(detail || {});
      setIsPurchaseOpen(true);
    };
    const onOpenGiftBox = () => {
      if (!hideCoin) setIsGiftBoxOpen(true);
    };
    const onHubSessionExpired = () => {
      clearGhostiSupabaseSession();
      clearGhostSecretaryAccountNicknameOnLogout();
      clearCachedSharedRoomTokens();
    };
    // 브라우저 뒤로가기(BFCache 복원 포함) 시 로그아웃 직전 화면의 로그인 상태가 그대로 노출되는 현상 원천 차단
    const enforceLogoutOnHistoryRestore = (ev?: PageTransitionEvent) => {
      if (!isGhostiExplicitlyLoggedOut()) return;
      const st = useSaySeeStore.getState();
      const looksStaleAuthed =
        Boolean(ev?.persisted) ||
        st.merlinAuth.userId !== 'guest' ||
        Boolean(st.merlinAuth.email) ||
        Boolean(st.merlinAuth.token);
      if (looksStaleAuthed) {
        purgeAllGhostiLocalAuthArtifacts();
        clearGhostSecretaryAccountNicknameOnLogout();
        clearCachedSharedRoomTokens();
        useSaySeeStore.setState((s) => ({
          pcAgentPairedMobile: false,
          connectedDevices: [],
          devicePairingCode6: null,
          deviceEntitlement: null,
          syncedClipboardItems: [],
          activeSharedRoomId: null,
          activeJoinedRoomMeta: null,
          joinedSharedRooms: [],
          merlinAuth: {
            ...s.merlinAuth,
            token: '',
            userId: 'guest',
            email: '',
            coinBalance: 0,
          },
        }));
        window.dispatchEvent(new CustomEvent('merlinSessionExpired'));
        if (ev?.persisted) {
          window.location.replace(window.location.href);
        }
      }
    };
    const onPageShow = (ev: PageTransitionEvent) => enforceLogoutOnHistoryRestore(ev);
    const onPopState = () => enforceLogoutOnHistoryRestore();

    window.addEventListener('openLoginModal', onOpenLogin);
    window.addEventListener('openProfileModal', onOpenProfile);
    window.addEventListener('openPurchaseModal', onOpenPurchase);
    window.addEventListener('openGiftBoxModal', onOpenGiftBox);
    window.addEventListener('merlinSessionExpired', onHubSessionExpired);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('openLoginModal', onOpenLogin);
      window.removeEventListener('openProfileModal', onOpenProfile);
      window.removeEventListener('openPurchaseModal', onOpenPurchase);
      window.removeEventListener('openGiftBoxModal', onOpenGiftBox);
      window.removeEventListener('merlinSessionExpired', onHubSessionExpired);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('popstate', onPopState);
    };
  }, [hideCoin]);

  return (
    <>
      {/* 1. 표준 이메일 6자리 OTP 로그인 모달 */}
      <HubAuthModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        appName="귀신같이"
        appLogoUrl="/gwisinkachi_app_icon_512.png"
        // 귀신같이는 웰컴 코인 비지급 앱(허브 정책: 웰컴 100코인은 SenseTalk 최초 진입 시에만) →
        // 기본값 'coin'이면 첫 방문자에게 "무료 코인 받으세요!" 오안내 + 스토어 심사 리스크 → 'none' 고정
        rewardType="none"
        onSuccess={(email, userId) => {
          logoutInProgressRef.current = false;
          clearGhostiLogoutLock();
          setIsLoginOpen(false);
          void refreshSession();
          void refreshBalance();
          if (userId && email) {
            const currentHubToken =
              typeof window !== 'undefined' ? localStorage.getItem('merlin_session_token') || '' : '';
            void syncHubUserToLocalSupabase({
              userId,
              email,
              hubToken: currentHubToken,
              signupSource: 'workspace_login_modal',
              launchNotifyOptIn: true,
              forceSync: true,
            });
            // [골든 타이밍 바톤터치]: 유저가 '[⚡ 내 컴퓨터 1초 연결하기]' 또는 내 컴퓨터 파일 액션을 눌러 로그인한 경우(ghosti_pending_zcore_connect === '1')에만
            // 로그인 직후 자동으로 Z-코어 연결 모달(또는 인덱싱)로 바톤터치하고, 단순히 우상단 [로그인] 버튼만 누른 경우에는 보던 화면을 그대로 유지합니다.
            let hasPendingZCoreConnect = false;
            try {
              if (sessionStorage.getItem('ghosti_pending_zcore_connect') === '1') {
                hasPendingZCoreConnect = true;
                sessionStorage.removeItem('ghosti_pending_zcore_connect');
              }
            } catch {
              // ignore
            }
            const isMobileEnv =
              typeof window !== 'undefined' &&
              (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
                window.innerWidth < 860);
            if (hasPendingZCoreConnect && !isMobileEnv) {
              void (async () => {
                const ok = zCoreBridge.isConnected || (await zCoreBridge.checkHealth(true));
                if (ok) {
                  void useSaySeeStore.getState().initApp(true);
                  window.dispatchEvent(new CustomEvent('openZCoreGuideModal'));
                  return;
                }
                window.dispatchEvent(new CustomEvent('openZCoreGuideModal'));
              })();
            }
          }
        }}
      />

      {/* 2. 통합 프로필 설정 모달 (프로필 수정 + 코인/선물함 + 알림 스위치 + 1:1 문의방 + 1초 오류신고 + 로그아웃) */}
      {isProfileOpen && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/65 backdrop-blur-sm p-3 sm:p-4 pt-safe pb-safe overflow-y-auto"
          onClick={() => setIsProfileOpen(false)}
        >
          <div
            className="relative w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-3xl bg-slate-50 p-4 sm:p-5 shadow-2xl border border-slate-200 space-y-3.5 text-slate-900 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
              <h3 className="text-[15px] sm:text-base font-extrabold text-slate-900 flex items-center gap-1.5 min-w-0">
                <span>🐾 내 프로필 · 계정 설정</span>
              </h3>
              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    // [D-35] 여권은 등록 흐름이 기억하는 '내 얼굴'만 표시 (임의 클러스터 추정 금지)
                    useSaySeeStore.getState().setDoorplatePickerClusterId('self_passport');
                  }}
                  className="px-3 py-1.5 rounded-full bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap"
                  title="내 여권 (이름 · 시기별 사진)"
                >
                  <span>🛂</span>
                  <span>여권</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(false)}
                  className="w-9 h-9 rounded-full bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <HubProfileCard
              hideCoinSection={hideCoin}
              customGiftProducts={GHOSTI_GIFT_PRODUCTS}
              onOpenPurchase={() => {
                setIsProfileOpen(false);
                if (!hideCoin) setIsPurchaseOpen(true);
              }}
            />

            <HubNotificationCard />

            <HubSupportLink appId="Ghosti" />

            <HubLogoutCard
              appName="귀신같이"
              onLogout={() => {
                performGhostiCleanLogout();
              }}
              onWithdrawApp={async () => {
                performGhostiCleanLogout();
                try {
                  localStorage.removeItem('ghosti_secretary_engine_agreed');
                  localStorage.removeItem('ghosti_invited_member_email');
                  localStorage.removeItem('ghosti_invited_member_nickname');
                  localStorage.removeItem('ghosti_shared_family_added_photos_v1');
                } catch {
                  /* ignore */
                }
              }}
            />
          </div>
        </div>
      )}

      {/* 3. 3몬스터 패밀리 코인 충전소 모달 (스토어 심사 모드에서는 아예 렌더링하지 않음) */}
      {!hideCoin && isPurchaseOpen && (
        <HubPurchaseWidget
          isModal
          isOpen={isPurchaseOpen}
          minCustomCoin={purchaseModalOpts.minCustomCoin}
          redirectUrl={purchaseModalOpts.redirectUrl}
          onSuccess={() => {
            void refreshBalance();
          }}
          onClose={() => {
            const returnPlan = purchaseModalOpts.returnToCheckoutPlan;
            setIsPurchaseOpen(false);
            setPurchaseModalOpts({});
            void refreshBalance().finally(() => {
              if (returnPlan) {
                useSaySeeStore.getState().openSubscriptionCheckout(returnPlan);
              }
            });
          }}
          appName="귀신같이"
        />
      )}

      {/* 3-1. 귀신같이 전용 이용권 구독 결제창 (잔액 확인 · 부족 시 충전소 직결 · 실차감 영수증) */}
      {!hideCoin && <GhostiSubscriptionCheckoutModal />}

      {/* 4. 패밀리 선물함 단독 모달 (스토어 심사 모드에서는 아예 렌더링하지 않음) */}
      {!hideCoin && (
        <HubGiftBoxModal
          isOpen={isGiftBoxOpen}
          onClose={() => setIsGiftBoxOpen(false)}
          appName="귀신같이"
          customProducts={GHOSTI_GIFT_PRODUCTS}
        />
      )}

      {/* 5. 1초 미니 오류·불편 즉시 신고 모달 & 전역 토스트 */}
      <HubBugReporter appId="Ghosti" appVersion="v1.0.7" />
      <HubNotifier />
    </>
  );
};

/**
 * [4. 최상위 HubProvider + HubErrorBoundary 래퍼]
 */
export const GhostiHubRootProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <HubErrorBoundary appId="Ghosti">
      <HubProvider appId="Ghosti">
        {children}
        <GhostiHubGlobalModals />
      </HubProvider>
    </HubErrorBoundary>
  );
};
