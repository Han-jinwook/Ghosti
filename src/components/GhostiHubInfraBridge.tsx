import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import {
  HubProvider,
  useHub,
  logout as hubSdkLogout,
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
import {
  claimOrHeartbeatLocalPcAccountOwner,
  releaseLocalPcTabSessionOnUnload,
  setLocalPcOwnershipBlockedState,
} from '../services/pcSingleAccountGuard';
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
  resolveHubSupabaseBridgeEndpoint,
} from '../services/supabaseClient';
import { clearCachedSharedRoomTokens } from '../services/sharedPhotoRoomSupabase';
import {
  clearWorkRoomLocalCachesOnLogout,
  ensureLocalHostOutboundTunnelAndRegister,
  fetchMyJoinedWorkRooms,
  saveCachedJoinedWorkRoomMeta,
} from '../services/workRoomSyncService';
import { resetSharedMonsterChatToWelcome } from '../services/monsterChatRouter';
import {
  clearPcZCoreClipboardAuthContext,
  getThisDeviceIdentity,
  loadCachedDeviceIntegrationSnapshot,
  loadCachedSyncedClips,
  syncDeviceHeartbeatAndList,
  syncEntitlementToLocalPcEngine,
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

const GHOSTI_GIFT_PRODUCTS: GiftProductItem[] = [
  {
    id: 'custom_coin',
    title: '자유 코인 선물',
    subtitle: '1,000C 이상 직접 입력',
    fullTitle: '패밀리 코인 자유 선물',
    amount: 1000,
    category: 'COIN',
    emoji: '',
    defaultMessage: '마음을 담아 준비한 패밀리 코인 선물입니다.',
    isCustom: true,
  },
];

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

export const GhostiHeaderQuickShareButton: React.FC<{
  compact?: boolean;
}> = ({ compact = false }) => {
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
      '귀신같이(Ghosti) — 사진·동영상·문서 내용 검색과 사진 공유 https://ghosti.sundreamer.app';
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
        title="앱 공유 링크 복사"
        aria-label="앱 공유 링크 복사"
        className={`flex ${
          compact ? 'w-7 h-7' : 'w-6 h-6 sm:w-7 sm:h-7'
        } rounded-md items-center justify-center transition-colors cursor-pointer shrink-0 outline-none ${
          copied
            ? 'bg-slate-100 text-slate-900'
            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
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
          className="absolute right-0 top-full mt-1.5 z-50 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 whitespace-nowrap pointer-events-none select-none shadow-md"
        >
          <div className="text-[11.5px] font-semibold leading-tight">
            공유 링크가 복사되었습니다
          </div>
        </div>
      )}
    </div>
  );
};

export const GhostiTopRightHubAnchor: React.FC = () => {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="rounded-full px-0.5 sm:px-1 py-0.5 border border-slate-200 bg-slate-50 transition-colors">
        <HubProfileWidget
          layout="row"
          onLoginClick={() => window.dispatchEvent(new CustomEvent('openLoginModal'))}
          onProfileClick={() => window.dispatchEvent(new CustomEvent('openProfileModal'))}
        />
      </div>
    </div>
  );
};

export const GhostiSidebarBottomFamilyLauncher: React.FC<{
  isOpen?: boolean;
  onToggle?: () => void;
}> = () => {
  return (
    <div className="pt-3 border-t border-slate-200">
      <HubAppSwitcher currentAppId="ghosti" variant="sidebar" placement="bottom-up" />
    </div>
  );
};

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
  const [pcAccountConflict, setPcAccountConflict] = useState<{
    activeEmailMasked: string;
    currentEmail: string;
  } | null>(null);
  const [switchingPcOwner, setSwitchingPcOwner] = useState(false);
  const wasLoggedInRef = useRef(false);
  const lastAuthedEmailRef = useRef('');
  const logoutInProgressRef = useRef(false);
  const pendingLogoutWipeRef = useRef<(() => void) | null>(null);

  const detachPendingLogoutWipe = useCallback(() => {
    if (typeof window === 'undefined' || !pendingLogoutWipeRef.current) return;
    window.removeEventListener('pagehide', pendingLogoutWipeRef.current);
    window.removeEventListener('beforeunload', pendingLogoutWipeRef.current);
    pendingLogoutWipeRef.current = null;
  }, []);

  const performGhostiCleanLogout = useCallback(() => {
    logoutInProgressRef.current = true;
    wasLoggedInRef.current = false;
    lastAuthedEmailRef.current = '';
    setIsProfileOpen(false);
    const curState = useSaySeeStore.getState();
    const hasUrlInviteToken = Boolean(readActiveInviteToken());
    if (typeof window !== 'undefined') {
      try {
        const preLogoutToken = (localStorage.getItem('merlin_session_token') || '').trim();
        const thisDeviceId = getThisDeviceIdentity().deviceId;
        if (preLogoutToken && thisDeviceId) {
          localStorage.setItem('ghosti_revoked_by_own_logout', '1');
          void fetch(resolveHubSupabaseBridgeEndpoint(), {
            method: 'POST',
            keepalive: true,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${preLogoutToken}`,
            },
            body: JSON.stringify({
              action: 'device_revoke_device',
              targetDeviceId: thisDeviceId,
            }),
          }).catch(() => {});
        }
      } catch {
        /* ignore pre-logout device revoke error */
      }
    }
    purgeAllGhostiLocalAuthArtifacts({ setLogoutLockMs: 15_000 });
    clearWorkRoomLocalCachesOnLogout();
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
    resetSharedMonsterChatToWelcome();
    clearCachedSharedRoomTokens();
    clearPcZCoreClipboardAuthContext();
    zCoreBridge.disconnectForLogout();
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
      const cleanedSearchResults = isInSharedLounge
        ? []
        : [];
      return {
        photos: [],
        duplicateGroups: [],
        faceClusters: [],
        localDocuments: [],
        matchedLocalDocs: [],
        videoSceneItems: [],
        matchedVideoScenes: [],
        matchedVaultPhotos: [],
        pcAgentPairedMobile: false,
        thisDeviceRevoked: false,
        connectedDevices: [],
        devicePairingCode6: null,
        deviceEntitlement: null,
        syncedClipboardItems: [],
        syncState: {
          ...state.syncState,
          syncing: false,
          connectedPeer: '연결된 기기 없음',
          lastSyncedAt: '로그인 후 연결 가능',
        },
        showSharedPhotoUploadModal: false,
        isInvitedMemberSession: false,
        activeSharedRoomId: null,
        activeJoinedRoomMeta: null,
        joinedSharedRooms: [],
        activeQuery: '',
        hasExecutedUserSearch: false,
        matchedTags: [],
        ...(!hasUrlInviteToken
          ? {
              sharedRoomAddedPhotos: [],
              sharedRoomHostPhotos: [],
              searchResults: cleanedSearchResults,
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
      window.dispatchEvent(new CustomEvent('merlinSessionExpired'));
      window.dispatchEvent(new CustomEvent('ghosti_jump_to_secretary'));
      detachPendingLogoutWipe();
      const finalWipe = () => {
        try {
          const liveTok = (localStorage.getItem('merlin_session_token') || '').trim();
          const hasLiveJwt = liveTok.startsWith('eyJ') && liveTok.split('.').length === 3;
          if (hasLiveJwt && localStorage.getItem('merlin_logged_out') !== '1') {
            return;
          }
        } catch {
          /* ignore */
        }
        purgeAllGhostiLocalAuthArtifacts({ setLogoutLockMs: 15_000 });
        clearWorkRoomLocalCachesOnLogout();
      };
      pendingLogoutWipeRef.current = finalWipe;
      window.addEventListener('pagehide', finalWipe, { once: true });
      window.addEventListener('beforeunload', finalWipe, { once: true });
    }
  }, [detachPendingLogoutWipe]);

  useEffect(() => {
    if (logoutInProgressRef.current) {
      return;
    }
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('merlin_session_token') || '' : '';

    if (isLoggedIn && user?.id && user?.email) {
      detachPendingLogoutWipe();
      clearGhostiLogoutLock();
      const cleanUserEmail = user.email.trim().toLowerCase();
      const didTransitionFromGuest = !wasLoggedInRef.current;
      const didSwitchAccountDirectly = Boolean(
        lastAuthedEmailRef.current && lastAuthedEmailRef.current !== cleanUserEmail
      );
      lastAuthedEmailRef.current = cleanUserEmail;
      wasLoggedInRef.current = true;

      if (didSwitchAccountDirectly) {
        clearCachedSharedRoomTokens();
        storeSharedRefs.activeSharedRoomId = null;
        storeSharedRefs.knownJoinedRoomIds.clear();
        if (!readActiveInviteToken()) {
          clearStoredInviteSession();
        }
      }

      const cachedDevSnap = loadCachedDeviceIntegrationSnapshot(cleanUserEmail);
      const isAccountTransition = didTransitionFromGuest || didSwitchAccountDirectly;
      useSaySeeStore.setState((state) => ({
        pcAgentPairedMobile: false,
        connectedDevices: [],
        devicePairingCode6: isAccountTransition
          ? cachedDevSnap?.pairingCode ?? null
          : cachedDevSnap?.pairingCode ?? state.devicePairingCode6,
        deviceEntitlement: isAccountTransition
          ? cachedDevSnap?.entitlement ?? null
          : cachedDevSnap?.entitlement ?? state.deviceEntitlement,
        syncedClipboardItems: loadCachedSyncedClips(cleanUserEmail),
        ...(isAccountTransition
          ? {
              activeSharedRoomId: null,
              activeJoinedRoomMeta: null,
              joinedSharedRooms: [],
              sharedRoomAddedPhotos: [],
              sharedRoomHostPhotos: [],
              searchResults: [],
              activeQuery: '',
              hasExecutedUserSearch: false,
              matchedTags: [],
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

      if (isAccountTransition) {
        resetSharedMonsterChatToWelcome();
        // [4귀신 근본 수정] F5 새로고침 시 세션 복원(didTransitionFromGuest) 때마다 'ghosti_jump_to_secretary'를 쏘면
        // DesktopSidebarAndHeader가 현재 탭(업무 공유·귀신검색·사진 공유·내 기기 통합)을 무조건 귀신비서 탭으로 강제 이동시킴.
        // 대화창(MonsterStandardChatColumn) 환영 인사 갱신 전용 이벤트('ghostiSupabaseUserSynced')만 발송해 현재 탭을 100% 보존.
        window.dispatchEvent(new CustomEvent('ghostiSupabaseUserSynced'));
      }

      void syncHubUserToLocalSupabase({
        userId: user.id,
        email: user.email,
        nickname: cleanHubNick || undefined,
        hubToken: token,
      }).then(() => {
        if (isAccountTransition) {
          const stNow = useSaySeeStore.getState();
          void stNow.refreshDeviceIntegrationState();
          void stNow.syncActiveSharedRoomFromSupabase();
          window.dispatchEvent(new CustomEvent('ghostiSupabaseUserSynced'));
        }
      });

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
          window.dispatchEvent(new CustomEvent('ghostiSupabaseUserSynced'));
        }
      }

      const isNativeMobile =
        typeof window !== 'undefined' &&
        Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
      if (!isNativeMobile) {
        void zCoreBridge.checkHealth(false).then(async (alive) => {
          if (!alive) return;
          // [정책 §5.4-⑨] 카카오톡 PC 방식 1 PC = 1 활성 계정 단독 점유 선점 검사
          const ownerRes = await claimOrHeartbeatLocalPcAccountOwner({
            email: cleanUserEmail,
            action: 'claim',
          });
          if (!ownerRes.ok && ownerRes.reason === 'PC_OWNED_BY_OTHER_ACCOUNT') {
            setPcAccountConflict({
              activeEmailMasked: ownerRes.activeEmailMasked || '다른 계정',
              currentEmail: cleanUserEmail,
            });
            return;
          }
          setPcAccountConflict(null);
          void useSaySeeStore.getState().initApp(true);

          const joined = await fetchMyJoinedWorkRooms();
          if (!joined.ok || joined.rooms.length === 0) return;
          const curEnt = useSaySeeStore.getState().deviceEntitlement;
          const hosted = joined.rooms.find((r) => r.isHost && r.ownerUnlocked);
          const invited = joined.rooms.find((r) => !r.isHost);
          if (invited) {
            saveCachedJoinedWorkRoomMeta(invited, cleanUserEmail);
          }
          if (hosted) {
            await syncEntitlementToLocalPcEngine(curEnt, cleanUserEmail, {
              unlocked: true,
              roomId: hosted.roomId,
              isHost: true,
              planId: curEnt?.workPlanId || 'work_trial_30d',
            });
            await ensureLocalHostOutboundTunnelAndRegister(hosted.roomId, {
              masterServerName: hosted.hostTunnel?.masterServerName,
              backupServers: hosted.hostTunnel?.backupServers,
            });
          } else if (invited && invited.ownerUnlocked) {
            await syncEntitlementToLocalPcEngine(curEnt, cleanUserEmail, {
              unlocked: true,
              roomId: invited.roomId,
              isHost: false,
              planId: 'work_invited_member',
            });
          }
        });
      } else {
        void zCoreBridge.checkHealth(false).then((alive) => {
          if (alive) {
            void useSaySeeStore.getState().initApp(true);
          }
        });
      }
    } else if (!isLoggedIn) {
      setPcAccountConflict(null);
      setLocalPcOwnershipBlockedState(false);
      const hasUrlInviteToken = Boolean(readActiveInviteToken());
      const isMarkedLoggedOut =
        typeof window !== 'undefined' && localStorage.getItem('merlin_logged_out') === '1';
      if (wasLoggedInRef.current || isMarkedLoggedOut) {
        wasLoggedInRef.current = false;
        clearGhostiSupabaseSession();
        clearGhostSecretaryAccountNicknameOnLogout();
        resetSharedMonsterChatToWelcome();
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
        const isNativeCap = Boolean(
          (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
        );
        if (ev?.persisted && !isNativeCap) {
          window.location.replace(window.location.href);
        }
      }
    };
    const onPageShow = (ev: PageTransitionEvent) => enforceLogoutOnHistoryRestore(ev);
    const onPopState = () => enforceLogoutOnHistoryRestore();
    const onLogoutAndOpenLogin = () => {
      performGhostiCleanLogout();
      setIsLoginOpen(true);
    };

    window.addEventListener('openLoginModal', onOpenLogin);
    window.addEventListener('openProfileModal', onOpenProfile);
    window.addEventListener('openPurchaseModal', onOpenPurchase);
    window.addEventListener('openGiftBoxModal', onOpenGiftBox);
    window.addEventListener('merlinSessionExpired', onHubSessionExpired);
    window.addEventListener('ghosti_logout_and_open_login', onLogoutAndOpenLogin);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('openLoginModal', onOpenLogin);
      window.removeEventListener('openProfileModal', onOpenProfile);
      window.removeEventListener('openPurchaseModal', onOpenPurchase);
      window.removeEventListener('openGiftBoxModal', onOpenGiftBox);
      window.removeEventListener('merlinSessionExpired', onHubSessionExpired);
      window.removeEventListener('ghosti_logout_and_open_login', onLogoutAndOpenLogin);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('popstate', onPopState);
    };
  }, [hideCoin, performGhostiCleanLogout]);

  return (
    <>
      <HubAuthModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        appName="귀신같이"
        appLogoUrl="/gwisinkachi_app_icon_512.png"
        rewardType="none"
        onSuccess={(email, userId) => {
          logoutInProgressRef.current = false;
          detachPendingLogoutWipe();
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
            try {
              localStorage.removeItem('ghosti_revoked_by_own_logout');
            } catch {
              /* ignore */
            }
            void syncDeviceHeartbeatAndList({ explicitReconnect: true }).then((hb) => {
              if (hb?.ok) {
                useSaySeeStore.getState().setDeviceIntegrationSnapshot({
                  devices: hb.devices,
                  pairingCode: hb.pairingCode,
                  entitlement: hb.entitlement,
                  revokedSelf: false,
                });
              }
            });
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
                }
              })();
            }
          }
        }}
      />

      {isProfileOpen && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 pt-safe pb-safe overflow-y-auto"
          onClick={() => setIsProfileOpen(false)}
        >
          <div
            className="relative w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-5 shadow-xl border border-slate-200 space-y-3.5 text-slate-900 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-100">
              <h3 className="text-[15px] font-bold text-slate-900 min-w-0">
                내 프로필 · 계정 설정
              </h3>
              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    useSaySeeStore.getState().setDoorplatePickerClusterId('self_passport');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  title="내 여권 (이름 · 시기별 사진)"
                >
                  여권
                </button>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(false)}
                  className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0 cursor-pointer"
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

      {!hideCoin && <GhostiSubscriptionCheckoutModal />}

      {!hideCoin && (
        <HubGiftBoxModal
          isOpen={isGiftBoxOpen}
          onClose={() => setIsGiftBoxOpen(false)}
          appName="귀신같이"
          customProducts={GHOSTI_GIFT_PRODUCTS}
        />
      )}

      <PcSingleAccountGuardOverlay
        isLoggedIn={isLoggedIn}
        userEmail={user?.email || ''}
        conflict={pcAccountConflict}
        setConflict={setPcAccountConflict}
        switching={switchingPcOwner}
        setSwitching={setSwitchingPcOwner}
        onPerformLogout={() => {
          setPcAccountConflict(null);
          setLocalPcOwnershipBlockedState(false);
          try {
            hubSdkLogout();
          } catch {
            /* ignore */
          }
          performGhostiCleanLogout();
        }}
      />

      <HubBugReporter appId="Ghosti" appVersion="v1.0.7" />
      <HubNotifier />
    </>
  );
};

interface PcSingleAccountGuardOverlayProps {
  isLoggedIn: boolean;
  userEmail: string;
  conflict: { activeEmailMasked: string; currentEmail: string } | null;
  setConflict: React.Dispatch<
    React.SetStateAction<{ activeEmailMasked: string; currentEmail: string } | null>
  >;
  switching: boolean;
  setSwitching: React.Dispatch<React.SetStateAction<boolean>>;
  onPerformLogout: () => void;
}

const PcSingleAccountGuardOverlay: React.FC<PcSingleAccountGuardOverlayProps> = ({
  isLoggedIn,
  userEmail,
  conflict,
  setConflict,
  switching,
  setSwitching,
  onPerformLogout,
}) => {
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  const conflictRef = useRef(conflict);
  conflictRef.current = conflict;
  const logoutCbRef = useRef(onPerformLogout);
  logoutCbRef.current = onPerformLogout;

  useEffect(() => {
    if (typeof window === 'undefined' || !isLoggedIn || !cleanEmail) return undefined;
    const isNativeMobile = Boolean(
      (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
    );
    if (isNativeMobile) return undefined;

    let cancelled = false;

    const verifyOrHeartbeat = async (mode: 'claim' | 'heartbeat') => {
      if (cancelled || !zCoreBridge.isConnected) return;
      if (mode === 'heartbeat' && conflictRef.current) return;
      const res = await claimOrHeartbeatLocalPcAccountOwner({
        email: cleanEmail,
        action: mode,
      });
      if (cancelled) return;
      if (!res.ok) {
        if (res.reason === 'DISPLACED_BY_OTHER_ACCOUNT') {
          logoutCbRef.current();
          useSaySeeStore
            .getState()
            .showToast('다른 창에서 새 계정으로 전환되어 로그아웃되었습니다.');
          return;
        }
        if (res.reason === 'PC_OWNED_BY_OTHER_ACCOUNT') {
          setConflict({
            activeEmailMasked: res.activeEmailMasked || '다른 계정',
            currentEmail: cleanEmail,
          });
        }
        return;
      }
      if (conflictRef.current) {
        setConflict(null);
      }
    };

    const unsubZCore = zCoreBridge.subscribe((connected) => {
      if (connected && !cancelled) {
        void verifyOrHeartbeat('claim');
      }
    });

    const intervalId = window.setInterval(() => {
      void verifyOrHeartbeat('heartbeat');
    }, 4000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void verifyOrHeartbeat('heartbeat');
      }
    };
    const onPageHide = () => {
      if (!conflictRef.current) {
        releaseLocalPcTabSessionOnUnload(cleanEmail);
      }
    };

    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      cancelled = true;
      unsubZCore();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [isLoggedIn, cleanEmail, setConflict]);

  const handleForceSwitchHere = async () => {
    if (!conflict || switching) return;
    setSwitching(true);
    try {
      const sw = await claimOrHeartbeatLocalPcAccountOwner({
        email: conflict.currentEmail,
        action: 'claim',
        forceSwitch: true,
      });
      if (sw.ok) {
        setConflict(null);
        setLocalPcOwnershipBlockedState(false);
        void useSaySeeStore.getState().initApp(true);
        void useSaySeeStore.getState().refreshDeviceIntegrationState();
        const joined = await fetchMyJoinedWorkRooms();
        if (joined.ok && joined.rooms.length > 0) {
          const curEnt = useSaySeeStore.getState().deviceEntitlement;
          const hosted = joined.rooms.find((r) => r.isHost && r.ownerUnlocked);
          const invited = joined.rooms.find((r) => !r.isHost);
          if (invited) {
            saveCachedJoinedWorkRoomMeta(invited, conflict.currentEmail);
          }
          if (hosted) {
            await syncEntitlementToLocalPcEngine(curEnt, conflict.currentEmail, {
              unlocked: true,
              roomId: hosted.roomId,
              isHost: true,
              planId: curEnt?.workPlanId || 'work_trial_30d',
              force: true,
            });
            await ensureLocalHostOutboundTunnelAndRegister(hosted.roomId, {
              masterServerName: hosted.hostTunnel?.masterServerName,
              backupServers: hosted.hostTunnel?.backupServers,
              forceRegister: true,
            });
          } else if (invited && invited.ownerUnlocked) {
            await syncEntitlementToLocalPcEngine(curEnt, conflict.currentEmail, {
              unlocked: true,
              roomId: invited.roomId,
              isHost: false,
              planId: 'work_invited_member',
              force: true,
            });
          }
        }
        window.dispatchEvent(new CustomEvent('ghostiSupabaseUserSynced'));
        useSaySeeStore
          .getState()
          .showToast('이 PC의 연결 계정이 현재 계정으로 전환되었습니다.');
      }
    } finally {
      setSwitching(false);
    }
  };

  if (!conflict) return null;

  return (
    <div
      data-testid="pc-single-account-conflict-modal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[220] bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-950 border border-amber-300 dark:border-amber-400/55 shadow-2xl p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="inline-flex self-start px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/90 border border-amber-200 dark:border-amber-400/50 text-amber-800 dark:text-amber-200 text-[11.5px] font-extrabold">
            1 PC 1계정 보호 (카카오톡 PC 방식)
          </span>
          <h3 className="text-[17px] text-slate-900 dark:text-white font-extrabold leading-snug break-keep">
            현재 이 PC에는 이미 다른 계정({conflict.activeEmailMasked})이 연결되어 있습니다.
          </h3>
          <p className="text-[13px] text-slate-600 dark:text-zinc-300 leading-relaxed break-keep">
            한 PC에서는 한 번에 하나의 계정만 사용할 수 있습니다. 이 계정으로 전환하면 기존 계정의 로컬 연결과 공유 드라이브(S:)가 해제되고 기존 창은 로그아웃됩니다.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1">
          <button
            type="button"
            data-testid="pc-account-conflict-logout-btn"
            onClick={onPerformLogout}
            disabled={switching}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-white/15 text-slate-700 dark:text-zinc-200 text-[13px] font-bold cursor-pointer"
          >
            로그아웃
          </button>
          <button
            type="button"
            data-testid="pc-account-force-switch-btn"
            onClick={() => void handleForceSwitchHere()}
            disabled={switching}
            className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[13px] font-extrabold cursor-pointer shadow-sm disabled:opacity-60"
          >
            {switching ? '전환 중...' : '이 계정으로 전환하기 (기존 계정 연결 해제)'}
          </button>
        </div>
      </div>
    </div>
  );
};

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
