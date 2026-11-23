import React, { useEffect, useRef, useState } from 'react';
import { useSaySeeStore, type DesktopTab, type MobileTab } from './store/useSaySeeStore';
import type { FamilyRoomId, LoungeType } from './types/saysee';
import { playAppEnterGiggleSound } from './services/babyGhostSound';
import { hasActiveGhostiLoginSession, zCoreBridge } from './services/zCoreBridge';
import { hasAuthenticatedHubAccountSession } from './services/supabaseClient';
import {
  clearPendingQrPairCode,
  savePendingQrPairCode,
} from './services/deviceIntegrationService';
import { DesktopDashboard } from './components/DesktopDashboard';
import { GhostiHubRootProvider } from './components/GhostiHubInfraBridge';
import { GhostiShowroomLanding, OFFICIAL_LAUNCH_LIVE } from './components/GhostiShowroomLanding';
import { MobileAppView } from './components/MobileAppView';
import { OnboardingModal } from './components/OnboardingModal';
import { PhotoDetailModal } from './components/PhotoDetailModal';
import {
  LocalDocPreviewModal,
  MobileMasterPcIntroModal,
  PricingModal,
  VideoScenePreviewModal,
} from './components/PricingModal';
import {
  FaceMemberRegistryModal,
  PassportDoorplateStyleModal,
} from './components/FaceMemberRegistryModal';
import { startPassportPhotoActivityWatcher } from './services/passportRegistrationFlow';
import { SetupFloatingOverlayGuide } from './components/SetupMonsterModal';
import { GhostCastAndLiveGlobalOverlay } from './components/GhostCastAndLiveSystem';
import { FreePhotoShareOverlays } from './domains/free_photo_share/FreePhotoShareOverlays';
import { GhostSecretaryFirstModal } from './components/GhostSecretaryFirstGuard';
import { GhostPhotoOcrTeleportModal } from './components/GhostPhotoOcrTeleportModal';
import { useDashboardNavStore } from './domains/shared/dashboardNavState';
import { resolveViewportLayout, storeSharedRefs } from './store/slices/storeSharedRefs';

export const App: React.FC = () => {
  const {
    layout,
    setLayout,
    initApp,
    activeLoungeType,
    desktopTab,
    mobileTab,
    activeFamilyRoom,
    activeSharedRoomId,
    activeJoinedRoomMeta,
    lastQuarantineToast,
    dismissQuarantineToast,
    lastUndoBatch,
    undoLastQuarantine,
    dismissUndoBatch,
    selectedPhoto,
    setSelectedPhoto,
    selectedVideoModal,
    setSelectedVideoModal,
    selectedDocModal,
    setSelectedDocModal,
    showProModal,
    setShowProModal,
    showSetupMonsterModal,
    setShowSetupMonsterModal,
    showOnboarding,
    setShowOnboarding,
    showFaceRegistryModal,
    setShowFaceRegistryModal,
    doorplatePickerClusterId,
    setDoorplatePickerClusterId,
    showSharedPhotoUploadModal,
    guestJoinWallReason,
  } = useSaySeeStore();
  const { ocrModalPhoto, setOcrModalPhoto } = useDashboardNavStore();

  // [D-35] 🪪 여권 조용한 등록: 사진 활동(검색·사진 추가) 감지기 1회 기동 (날짜 고정 없이 활동 직후 1번만 질문)
  useEffect(() => {
    startPassportPhotoActivityWatcher();
  }, []);

  // 뷰포트 크기·회전 변경 시 PC ↔ 모바일 레이아웃 실시간 반응형 동기화 (?ghostSearchWindow 제외)
  const [isLandscapeCompact, setIsLandscapeCompact] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.innerWidth > window.innerHeight && window.innerHeight <= 540
      : false
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncViewportLayout = () => {
      const next = resolveViewportLayout();
      if (useSaySeeStore.getState().layout !== next) {
        setLayout(next);
      }
      setIsLandscapeCompact(window.innerWidth > window.innerHeight && window.innerHeight <= 540);
    };
    syncViewportLayout();
    window.addEventListener('resize', syncViewportLayout, { passive: true });
    window.addEventListener('orientationchange', syncViewportLayout, { passive: true });
    return () => {
      window.removeEventListener('resize', syncViewportLayout);
      window.removeEventListener('orientationchange', syncViewportLayout);
    };
  }, [setLayout]);

  // 모바일 뒤로가기(Hardware Back Button / History PopState) 시 앱 자체가 꺼지지 않고 열려 있는 상세보기 모달만 닫히도록 방어
  const hasAnyModalOpen = Boolean(
    selectedPhoto ||
      selectedVideoModal ||
      selectedDocModal ||
      showProModal ||
      showSetupMonsterModal ||
      showOnboarding ||
      showFaceRegistryModal ||
      doorplatePickerClusterId ||
      showSharedPhotoUploadModal ||
      guestJoinWallReason ||
      ocrModalPhoto
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !hasAnyModalOpen) return;
    let pushedByEffect = false;
    try {
      if (!window.history.state?.ghostiModalOpen) {
        window.history.pushState({ ...(window.history.state || {}), ghostiModalOpen: true }, '');
        pushedByEffect = true;
      }
    } catch {
      // ignore
    }

    const handlePopState = () => {
      const st = useSaySeeStore.getState();
      const navSt = useDashboardNavStore.getState();
      if (navSt.ocrModalPhoto) navSt.setOcrModalPhoto(null);
      if (st.selectedPhoto) st.setSelectedPhoto(null);
      if (st.selectedVideoModal) st.setSelectedVideoModal(null);
      if (st.selectedDocModal) st.setSelectedDocModal(null);
      if (st.showProModal) st.setShowProModal(false);
      if (st.showSetupMonsterModal) st.setShowSetupMonsterModal(false);
      if (st.showOnboarding) st.setShowOnboarding(false);
      if (st.showFaceRegistryModal) st.setShowFaceRegistryModal(false);
      if (st.doorplatePickerClusterId) st.setDoorplatePickerClusterId(null);
      if (st.showSharedPhotoUploadModal) st.setShowSharedPhotoUploadModal(false);
      if (st.guestJoinWallReason) useSaySeeStore.setState({ guestJoinWallReason: null });
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (pushedByEffect && window.history.state?.ghostiModalOpen) {
        try {
          window.history.replaceState(
            { ...(window.history.state || {}), ghostiModalOpen: false },
            ''
          );
        } catch {
          // ignore
        }
      }
    };
  }, [hasAnyModalOpen]);

  // 오직 현재 URL 뒤에 `?dev=true`가 붙어 있거나 로컬호스트이거나 Capacitor 네이티브 스토어 앱일 때 워크스페이스 권한 부여
  const [isDevAuthorized] = useState<boolean>(() => {
    try {
      const isNative = Boolean(
        (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
      );
      if (isNative) {
        return true;
      }
      const params = new URLSearchParams(window.location.search);
      if (
        params.get('dev') === 'true' ||
        params.get('storeApp') === '1' ||
        Boolean(params.get('ghostSearchWindow')) ||
        params.get('preview') === 'legacy' ||
        params.get('preview') === 'guest' ||
        params.has('invite') ||
        params.has('workRoom') ||
        params.has('pairCode')
      ) {
        return true;
      }
      if (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
      ) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  // [라우팅 잠금 철칙]:
  // 1) `https://ghosti.sundreamer.app/` (일반 루트 접속) ➔ 무조건 온보딩 대문('showroom')만 노출
  // 2) `https://ghosti.sundreamer.app/?dev=true`, 로컬 개발 환경, 또는 Capacitor 네이티브 앱 ➔ 내부 워크스페이스('workspace') 진입
  const [viewMode, setViewMode] = useState<'showroom' | 'workspace'>(() => {
    try {
      const isNative = Boolean(
        (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
      );
      if (isNative) {
        return 'workspace';
      }
      const params = new URLSearchParams(window.location.search);
      const isB2bEntry =
        params.get('from') === 'b2b' ||
        /[?&]from=b2b\b/i.test(window.location.href) ||
        window.location.hash === '#work-share';
      if (params.get('view') === 'showroom' || isB2bEntry) {
        return 'showroom';
      }
      if (
        params.get('dev') === 'true' ||
        params.get('storeApp') === '1' ||
        Boolean(params.get('ghostSearchWindow')) ||
        params.get('preview') === 'legacy' ||
        params.get('preview') === 'guest' ||
        params.has('invite') ||
        params.has('inviteToken') ||
        params.has('workRoom') ||
        params.has('pairCode')
      ) {
        return 'workspace';
      }
      const hasWorkspaceRouteParams = Boolean(params.get('lounge')) || Boolean(params.get('tab'));
      if (
        hasWorkspaceRouteParams &&
        (OFFICIAL_LAUNCH_LIVE ||
          isDevAuthorized ||
          Boolean(sessionStorage.getItem('ghosti_active_invite_token')) ||
          sessionStorage.getItem('ghosti_entered_from_showroom') === '1' ||
          localStorage.getItem('ghosti_onboarding_completed') === 'true')
      ) {
        return 'workspace';
      }
      if (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
      ) {
        return 'workspace';
      }
      if (!OFFICIAL_LAUNCH_LIVE) {
        return 'showroom';
      }
      // [기능명세 1030-1032 · Seamless Auto-Bypass] 정식 출시 후 로그인 세션이 있거나 온보딩을 마친 재방문자는
      // 순수 루트 접속이어도 쇼룸을 건너뛰고 첫 렌더부터 본진 워크스페이스로 직행 (쇼룸 깜빡임 0)
      // — 명시적 ?view=showroom / B2B 유입(?from=b2b, #work-share)일 때만 쇼룸을 보여준다
      const wantsShowroomExplicitly =
        params.get('view') === 'showroom' ||
        params.get('from') === 'b2b' ||
        window.location.hash === '#work-share';
      if (
        !wantsShowroomExplicitly &&
        (hasActiveGhostiLoginSession() || localStorage.getItem('ghosti_onboarding_completed') === 'true')
      ) {
        return 'workspace';
      }
      // [라우팅 잠금 철칙 1 준수 — 출시 전]:
      // ?lounge=... 또는 ?tab=... 파라미터가 없는 순수 루트 접속 시, 재방문 조건이 아니면 온보딩 첫 화면('showroom')을 먼저 노출합니다.
    } catch {
      // ignore
    }
    return 'showroom';
  });

  // ─────────────────────────────────────────────────────────────
  // 🧭 [PC·안드로이드·아이폰 통합 브라우저 히스토리(뒤로가기/앞으로가기) 라우터]
  // - 메뉴/탭 전환 시 window.history.pushState 및 URL(?lounge=...&tab=...) 동기화
  // - 뒤로가기 시 구글 첫 화면으로 튕기거나 안드로이드에서 창이 닫히는 현상 원천 차단
  // - 아이폰 Safari에서 뒤로가기(<)·앞으로가기(>) 버튼 즉시 활성화 및 페이지 복원 보장
  // ─────────────────────────────────────────────────────────────
  const isApplyingPopStateRef = useRef(false);
  const isHistoryInitializedRef = useRef(false);
  const lastPushedNavKeyRef = useRef('');

  const buildNavUrl = (nav: {
    viewMode: 'showroom' | 'workspace';
    lounge: LoungeType;
    desktopTab: DesktopTab;
    familyRoom: FamilyRoomId;
    joinedRoomId?: string | null;
  }): string => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (nav.viewMode === 'showroom') {
        params.delete('view');
        params.delete('lounge');
        params.delete('tab');
        params.delete('room');
        params.delete('roomId');
      } else {
        params.delete('view');
        params.set('lounge', nav.lounge);
        params.set('tab', nav.desktopTab);
        if (nav.lounge === 'family') {
          params.set('room', nav.familyRoom);
        } else {
          params.delete('room');
        }
        const isSharedPhoto =
          nav.lounge === 'family' || nav.lounge === 'club' || nav.lounge === 'student';
        const cleanJoinedRoomId = (nav.joinedRoomId || '').trim();
        if (isSharedPhoto && cleanJoinedRoomId) {
          params.set('roomId', cleanJoinedRoomId);
        } else {
          params.delete('roomId');
        }
        // 정식 로그인 세션에서 토큰 없는 구형 ?invite=... 또는 ?preview=guest가 URL에 잔류해 새로고침 시 내 방을 가리는 현상 방지
        const hasRealInviteToken = Boolean(
          (params.get('inviteToken') || params.get('token') || '').trim()
        );
        const hasWorkRoomInvite = Boolean((params.get('workRoom') || '').trim());
        if (nav.lounge !== 'work' && hasWorkRoomInvite) {
          params.delete('workRoom');
          params.delete('host');
          params.delete('title');
          if (!params.has('invite')) {
            params.delete('inviteToken');
            params.delete('token');
          }
        }
        const isAuthedSession = hasAuthenticatedHubAccountSession();
        if (
          (isAuthedSession && nav.lounge === 'personal') ||
          (isAuthedSession && nav.lounge === 'work' && !hasWorkRoomInvite) ||
          (isAuthedSession && !hasRealInviteToken) ||
          (!isAuthedSession && !hasRealInviteToken && nav.lounge === 'personal')
        ) {
          params.delete('invite');
          params.delete('host');
          if (nav.lounge === 'personal') {
            params.delete('inviteToken');
          }
          if (params.get('preview') === 'guest') {
            params.delete('preview');
          }
        }
      }
      const qs = params.toString();
      return `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`;
    } catch {
      return window.location.href;
    }
  };

  const desktopTabToMobileTab = (dt: DesktopTab): MobileTab =>
    dt === 'trial'
      ? 'trial'
      : dt === 'dashboard'
      ? 'search'
      : dt === 'trash'
      ? 'trash'
      : dt === 'share'
      ? 'share'
      : 'settings';

  const normalizeFamilyRoomParam = (raw: string | null | undefined): FamilyRoomId | null => {
    if (!raw) return null;
    const v = raw.trim();
    if (v === '본가(친가)' || v === 'parents' || v === 'family_parents' || v.includes('본가') || v.includes('친가')) return '본가(친가)';
    if (v === '처가(친정)' || v === 'inlaws' || v === 'family_inlaws' || v.includes('처가') || v.includes('친정')) return '처가(친정)';
    if (v === '우리집' || v === 'home' || v === 'family_home' || v.startsWith('family')) return '우리집';
    return null;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1) 초기 진입 또는 외부 페이지(구글 등)에서 앞으로가기/뒤로가기로 복귀 시 URL·history.state에서 정확한 페이지 복원
    try {
      const savedNav = window.history.state?.ghostiNav;
      const params = new URLSearchParams(window.location.search);
      const hasInviteLink = params.has('invite') || params.has('inviteToken');
      const hasWorkRoomLink = params.has('workRoom');
      const rawPairCode = (params.get('pairCode') || '').replace(/\D/g, '').slice(0, 6);
      const hasPairCodeLink = rawPairCode.length === 6 || params.has('pairCode');
      if (rawPairCode.length === 6) {
        savePendingQrPairCode(rawPairCode);
        try {
          sessionStorage.setItem('ghosti_expand_device_sync_once', '1');
          sessionStorage.setItem('ghosti_entered_from_showroom', '1');
        } catch {
          /* ignore */
        }
      }
      const inviteVal = params.get('invite') || '';
      const urlLounge = params.get('lounge') as LoungeType | null;
      const urlTab = params.get('tab') as DesktopTab | null;
      const urlRoom = normalizeFamilyRoomParam(params.get('room') || inviteVal);
      const urlView = params.get('view') as 'showroom' | 'workspace' | null;

      const defaultInviteLounge: LoungeType = hasWorkRoomLink
        ? 'work'
        : inviteVal.startsWith('club')
        ? 'club'
        : inviteVal.startsWith('student') || inviteVal.startsWith('alumni')
        ? 'student'
        : 'family';

      const targetLounge: LoungeType =
        hasInviteLink || hasWorkRoomLink
          ? defaultInviteLounge
          : hasPairCodeLink
          ? 'personal'
          : urlLounge && ['personal', 'family', 'club', 'student', 'work'].includes(urlLounge)
            ? urlLounge
            : savedNav?.lounge || useSaySeeStore.getState().activeLoungeType;
      const targetDesktopTab: DesktopTab =
        hasInviteLink || hasWorkRoomLink
          ? 'dashboard'
          : hasPairCodeLink
          ? 'sync'
          : urlTab &&
              ['trial', 'dashboard', 'trash', 'share', 'settings', 'sync', 'superpower_dojo', 'search_dojo'].includes(urlTab)
            ? urlTab
            : savedNav?.desktopTab || useSaySeeStore.getState().desktopTab;
      const targetMobileTab: MobileTab =
        hasInviteLink || hasWorkRoomLink || hasPairCodeLink
          ? 'search'
          : savedNav?.mobileTab || desktopTabToMobileTab(targetDesktopTab);
      const urlRoomId = (params.get('roomId') || '').trim() || null;
      const targetRoom: FamilyRoomId =
        urlRoom ||
        normalizeFamilyRoomParam(savedNav?.familyRoom) ||
        useSaySeeStore.getState().activeFamilyRoom ||
        '우리집';
      const isB2bUrl =
        params.get('from') === 'b2b' ||
        /[?&]from=b2b\b/i.test(window.location.href) ||
        window.location.hash === '#work-share';
      const isNativeRuntime = Boolean(
        (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
      );
      const isLocalhostRuntime =
        window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const canAutoBypassToWorkspace =
        OFFICIAL_LAUNCH_LIVE &&
        (hasActiveGhostiLoginSession() ||
          localStorage.getItem('ghosti_onboarding_completed') === 'true');
      const hasExplicitWorkspaceUrl = Boolean(
        isNativeRuntime ||
          isLocalhostRuntime ||
          params.get('storeApp') === '1' ||
          params.get('ghostSearchWindow') ||
          params.get('preview') === 'legacy' ||
          params.get('preview') === 'guest' ||
          urlLounge ||
          urlTab ||
          hasInviteLink ||
          hasWorkRoomLink ||
          hasPairCodeLink ||
          params.get('dev') === 'true' ||
          canAutoBypassToWorkspace
      );
      const targetView: 'showroom' | 'workspace' =
        !isNativeRuntime &&
        params.get('storeApp') !== '1' &&
        !hasPairCodeLink &&
        (urlView === 'showroom' || isB2bUrl || !hasExplicitWorkspaceUrl)
          ? 'showroom'
          : hasPairCodeLink
          ? 'workspace'
          : savedNav?.viewMode || (canAutoBypassToWorkspace ? 'workspace' : viewMode);

      if (rawPairCode.length === 6 && !hasAuthenticatedHubAccountSession()) {
        useSaySeeStore.setState({
          lastQuarantineToast:
            'QR 연결 준비가 완료되었습니다. PC와 같은 이메일로 로그인하면 기기 연결이 완료됩니다.',
        });
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('openLoginModal'));
        }, 250);
      }

      isApplyingPopStateRef.current = true;
      if (targetView !== viewMode) {
        setViewMode(targetView);
      }
      if (urlRoomId) {
        storeSharedRefs.activeSharedRoomId = urlRoomId;
      }
      useSaySeeStore.setState({
        activeLoungeType: targetLounge,
        desktopTab: targetDesktopTab,
        mobileTab: targetMobileTab,
        activeFamilyRoom: targetRoom,
        ...(urlRoomId ? { activeSharedRoomId: urlRoomId } : {}),
      });

      const initialNav = {
        viewMode: targetView,
        lounge: targetLounge,
        desktopTab: targetDesktopTab,
        mobileTab: targetMobileTab,
        familyRoom: targetRoom,
        joinedRoomId: urlRoomId,
      };
      const initKey = `${initialNav.viewMode}:${initialNav.lounge}:${initialNav.desktopTab}:${initialNav.familyRoom}:${initialNav.joinedRoomId || ''}`;
      lastPushedNavKeyRef.current = initKey;

      // 루트 가드 엔트리(ghostiRootGuard) + 현재 엔트리(ghostiActiveEntry) 이중 구성:
      // - 초대 링크 진입 시 replaceState가 초대 파라미터/처가 방을 덮어쓰지 않도록 루트 가드 URL을 순수 홈 URL로 분리
      const initUrl = buildNavUrl(initialNav);
      if (!window.history.state?.ghostiNav) {
        const rootHomeNav = {
          viewMode: (targetView === 'showroom' ? 'showroom' : 'workspace') as 'showroom' | 'workspace',
          lounge: 'personal' as LoungeType,
          desktopTab: 'trash' as DesktopTab,
          mobileTab: 'trash' as MobileTab,
          familyRoom: '우리집' as FamilyRoomId,
          joinedRoomId: null as string | null,
        };
        const cleanRootGuardUrl =
          rootHomeNav.viewMode === 'showroom'
            ? window.location.pathname
            : `${window.location.pathname}?lounge=personal&tab=trash`;
        window.history.replaceState(
          { ...(window.history.state || {}), ghostiRootGuard: true, ghostiNav: rootHomeNav },
          '',
          cleanRootGuardUrl
        );
        window.history.pushState(
          { ...(window.history.state || {}), ghostiRootGuard: false, ghostiActiveEntry: true, ghostiNav: initialNav },
          '',
          initUrl
        );
      } else {
        window.history.replaceState(
          { ...(window.history.state || {}), ghostiNav: initialNav },
          '',
          initUrl
        );
      }
    } catch {
      // ignore
    } finally {
      isHistoryInitializedRef.current = true;
      window.setTimeout(() => {
        isApplyingPopStateRef.current = false;
      }, 0);
    }

    const onNavPopState = (event: PopStateEvent) => {
      const st = useSaySeeStore.getState();
      const modalWasOpen = Boolean(
        st.selectedPhoto ||
          st.selectedVideoModal ||
          st.selectedDocModal ||
          st.showProModal ||
          st.showSetupMonsterModal ||
          st.showOnboarding ||
          st.showFaceRegistryModal ||
          st.doorplatePickerClusterId
      );
      if (modalWasOpen) {
        return;
      }

      const stateObj = event.state || {};
      const nav = stateObj.ghostiNav;
      const params = new URLSearchParams(window.location.search);
      const fallbackLounge = (params.get('lounge') as LoungeType) || 'personal';
      const fallbackTab = (params.get('tab') as DesktopTab) || 'trash';
      const fallbackRoom = normalizeFamilyRoomParam(params.get('room') || params.get('invite')) || '우리집';
      const fallbackView =
        params.get('view') === 'showroom' || (!OFFICIAL_LAUNCH_LIVE && !isDevAuthorized)
          ? 'showroom'
          : 'workspace';

      const targetNav = nav || {
        viewMode: fallbackView,
        lounge: fallbackLounge,
        desktopTab: fallbackTab,
        mobileTab: desktopTabToMobileTab(fallbackTab),
        familyRoom: fallbackRoom,
      };

      isApplyingPopStateRef.current = true;
      if (targetNav.viewMode === 'showroom') {
        try {
          sessionStorage.setItem('ghosti_entered_showroom_from_app', '1');
        } catch {}
      }
      setViewMode(targetNav.viewMode === 'showroom' ? 'showroom' : 'workspace');
      useSaySeeStore.setState({
        activeLoungeType: targetNav.lounge,
        desktopTab: targetNav.desktopTab,
        mobileTab: targetNav.mobileTab || desktopTabToMobileTab(targetNav.desktopTab),
        activeFamilyRoom: normalizeFamilyRoomParam(targetNav.familyRoom) || '우리집',
      });
      lastPushedNavKeyRef.current = `${targetNav.viewMode}:${targetNav.lounge}:${targetNav.desktopTab}:${targetNav.familyRoom}`;

      // 만약 루트 가드(ghostiRootGuard)까지 뒤로 왔다면, 구글 첫 화면으로 나가거나 안드로이드 창이 닫히지 않도록 안전하게 루트 엔트리를 재장전
      if (stateObj.ghostiRootGuard) {
        try {
          window.history.pushState(
            { ghostiRootGuard: false, ghostiActiveEntry: true, ghostiNav: targetNav },
            '',
            buildNavUrl(targetNav)
          );
        } catch {
          // ignore
        }
      }

      window.setTimeout(() => {
        isApplyingPopStateRef.current = false;
      }, 0);
    };

    window.addEventListener('popstate', onNavPopState);
    return () => window.removeEventListener('popstate', onNavPopState);
  }, []);

  // 2) 유저가 앱 내 탭/라운지/대문을 전환할 때마다 히스토리 스택에 pushState 기록 + Z-코어 전역 라우트 스냅샷 동기화
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as unknown as { __GHOSTI_ACTIVE_ROUTE__?: unknown }).__GHOSTI_ACTIVE_ROUTE__ = {
      viewMode,
      lounge: activeLoungeType,
      desktopTab,
      mobileTab,
    };
    if (!isHistoryInitializedRef.current) return;
    if (isApplyingPopStateRef.current) return;

    const nextJoinedRoomId = activeJoinedRoomMeta?.roomId || null;
    const nextNav = {
      viewMode,
      lounge: activeLoungeType,
      desktopTab,
      mobileTab,
      familyRoom: activeFamilyRoom,
      joinedRoomId: nextJoinedRoomId,
    };
    const nextKey = `${nextNav.viewMode}:${nextNav.lounge}:${nextNav.desktopTab}:${nextNav.familyRoom}:${nextNav.joinedRoomId || ''}`;
    if (nextKey === lastPushedNavKeyRef.current) return;
    lastPushedNavKeyRef.current = nextKey;

    try {
      window.history.pushState(
        {
          ...(window.history.state || {}),
          ghostiRootGuard: false,
          ghostiActiveEntry: true,
          ghostiNav: nextNav,
        },
        '',
        buildNavUrl(nextNav)
      );
    } catch {
      // ignore
    }
  }, [viewMode, activeLoungeType, desktopTab, mobileTab, activeFamilyRoom, activeSharedRoomId, activeJoinedRoomMeta]);

  const handleEnterWorkspace = (forceAllow = false) => {
    if (!OFFICIAL_LAUNCH_LIVE && !isDevAuthorized && !forceAllow) {
      return;
    }
    playAppEnterGiggleSound(true);
    try {
      localStorage.setItem('ghosti_onboarding_completed', 'true');
      localStorage.setItem('ghosti_view_mode', 'workspace');
      sessionStorage.setItem('ghosti_entered_from_showroom', '1');
      sessionStorage.removeItem('ghosti_entered_showroom_from_app');
    } catch {}
    setViewMode('workspace');
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  // 워크스페이스 내부 상단 헤더의 [🏠 공식 쇼룸 대문] 또는 귀신비서 [온보딩 체험관 구경하기]를 눌렀을 때 해당 세션에서 대문 열람
  // (단, ghosti_onboarding_completed는 유지되므로 다음 날 앱에 재접속할 때는 다시 자동으로 워크스페이스로 직행)
  const handleEnterShowroom = () => {
    // 모바일 스토어 심사 클린 모드(Capacitor 네이티브 / ?storeApp=1)에서는 요금표·PC .zip 다운로드가 있는 웹 쇼룸으로 이탈 차단(Anti-Steering)
    if (useSaySeeStore.getState().isStoreAppMode) {
      return;
    }
    try {
      sessionStorage.setItem('ghosti_entered_showroom_from_app', '1');
    } catch {}
    setViewMode('showroom');
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  useEffect(() => {
    const onGoShowroom = () => handleEnterShowroom();
    const onGoWorkspace = () => handleEnterWorkspace();
    const onMerlinLoggedIn = () => {
      // ⚠️ [온보딩 자동 이탈 원천 차단]:
      // HubProvider.refreshSession()은 초기 진입 비동기 세션 확인, 5분 경과 후 창 포커스 복귀(focus/visibilitychange),
      // 타 탭 로컬스토리지 동기화(storage) 때마다 백그라운드에서 'merlinLoggedIn' 이벤트를 발행합니다.
      // 여기서 setViewMode('workspace')를 호출하면 온보딩 페이지를 가만히 보고 있던 유저가 아무것도 누르지 않았는데
      // 본 웹 귀신비서(tab=trash) 페이지로 강제 pushState 이동되므로, 워크스페이스 진입은 오직 명시적 버튼 클릭(handleEnterWorkspace)으로만 전환합니다.
      if (hasActiveGhostiLoginSession()) {
        void zCoreBridge.checkHealth(false);
      }
    };
    window.addEventListener('ghosti_navigate_showroom', onGoShowroom);
    window.addEventListener('ghosti_navigate_workspace', onGoWorkspace);
    window.addEventListener('merlinLoggedIn', onMerlinLoggedIn);

    // [네이티브 Android/iOS 앱 QR 스캔 App Links / Universal Links 딥링크 즉시 바인딩]
    let capUrlOpenHandle: { remove?: () => Promise<void> | void } | null = null;
    const handleIncomingNativePairUrl = (rawUrl?: string | null) => {
      if (!rawUrl) return;
      try {
        const parsed = new URL(rawUrl);
        const code = (parsed.searchParams.get('pairCode') || '').replace(/\D/g, '').slice(0, 6);
        if (code.length !== 6) return;
        savePendingQrPairCode(code);
        setViewMode('workspace');
        useSaySeeStore.setState({
          activeLoungeType: 'personal',
          desktopTab: 'sync',
          mobileTab: 'search',
        });
        window.dispatchEvent(new CustomEvent('ghosti_open_device_sync_section'));
        if (hasAuthenticatedHubAccountSession()) {
          clearPendingQrPairCode();
          void useSaySeeStore.getState().pairWithSixDigitCode(code);
        } else {
          useSaySeeStore.setState({
            lastQuarantineToast:
              'QR 연결 준비가 완료되었습니다. PC와 같은 이메일로 로그인하면 기기 연결이 완료됩니다.',
          });
          window.dispatchEvent(new CustomEvent('openLoginModal'));
        }
      } catch {
        /* ignore malformed url */
      }
    };
    try {
      const capApp = (
        window as unknown as {
          Capacitor?: {
            Plugins?: {
              App?: {
                getLaunchUrl?: () => Promise<{ url?: string } | null>;
                addListener?: (
                  ev: string,
                  cb: (data: { url?: string }) => void
                ) => Promise<{ remove?: () => Promise<void> | void }> | { remove?: () => void };
              };
            };
          };
        }
      ).Capacitor?.Plugins?.App;
      if (capApp?.getLaunchUrl) {
        void Promise.resolve(capApp.getLaunchUrl())
          .then((launch) => handleIncomingNativePairUrl(launch?.url))
          .catch(() => {});
      }
      if (capApp?.addListener) {
        void Promise.resolve(
          capApp.addListener('appUrlOpen', (data) => handleIncomingNativePairUrl(data?.url))
        )
          .then((handle) => {
            capUrlOpenHandle = handle || null;
          })
          .catch(() => {});
      }
    } catch {
      /* ignore */
    }

    return () => {
      window.removeEventListener('ghosti_navigate_showroom', onGoShowroom);
      window.removeEventListener('ghosti_navigate_workspace', onGoWorkspace);
      window.removeEventListener('merlinLoggedIn', onMerlinLoggedIn);
      if (capUrlOpenHandle?.remove) {
        try {
          void capUrlOpenHandle.remove();
        } catch {
          /* ignore */
        }
      }
    };
  }, [isDevAuthorized]);

  useEffect(() => {
    const isStandaloneSearchWin =
      typeof window !== 'undefined' &&
      Boolean(new URLSearchParams(window.location.search).get('ghostSearchWindow'));
    if (!isStandaloneSearchWin) {
      playAppEnterGiggleSound();
    }
    let didInitWithZCore = zCoreBridge.isConnected;
    let cancelled = false;
    void (async () => {
      const isNative = Boolean(
        (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
      );
      if (!isNative && !zCoreBridge.isConnected) {
        await Promise.race([
          zCoreBridge.checkHealth(isStandaloneSearchWin),
          new Promise<boolean>((resolve) =>
            window.setTimeout(() => resolve(false), isStandaloneSearchWin ? 1200 : 260)
          ),
        ]);
      }
      if (cancelled) return;
      didInitWithZCore = zCoreBridge.isConnected;
      await initApp();
    })();
    const handleZCoreConnected = () => {
      // 세션당 최초 1회만 연결 완료 토스트를 노출하여 반복 팝업 원천 차단
      let shouldShowToast = false;
      try {
        if (
          !isStandaloneSearchWin &&
          sessionStorage.getItem('ghosti_zcore_connected_toast_shown') !== '1'
        ) {
          sessionStorage.setItem('ghosti_zcore_connected_toast_shown', '1');
          shouldShowToast = true;
        }
      } catch {
        // ignore
      }
      if (shouldShowToast) {
        useSaySeeStore.setState({
          lastQuarantineToast: '내 컴퓨터 연결이 완료되어 PC 파일을 사용할 수 있습니다.',
        });
      }
      if (didInitWithZCore && useSaySeeStore.getState().initialized) {
        return;
      }
      didInitWithZCore = true;
      void initApp(true);
    };
    window.addEventListener('zCoreConnected', handleZCoreConnected);

    // [모바일 앱 백그라운드 복귀 자동 인덱싱]:
    // 카메라 촬영·텔레그램/카톡 영상 저장·OS 권한 설정 허용 직후 앱으로 돌아오면 수동 버튼 없이 자동으로 갤러리를 재스캔합니다.
    let lastResumeSyncAt = 0;
    const handleMobileForegroundResume = () => {
      const isNative = Boolean(
        (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
      );
      if (!isNative) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (now - lastResumeSyncAt < 1500) return;
      lastResumeSyncAt = now;
      window.setTimeout(() => {
        void useSaySeeStore.getState().syncMobileNativeGalleryAuto({ promptPermission: false });
      }, 220);
    };
    document.addEventListener('visibilitychange', handleMobileForegroundResume);
    window.addEventListener('focus', handleMobileForegroundResume);

    return () => {
      cancelled = true;
      window.removeEventListener('zCoreConnected', handleZCoreConnected);
      document.removeEventListener('visibilitychange', handleMobileForegroundResume);
      window.removeEventListener('focus', handleMobileForegroundResume);
    };
  }, [initApp]);

  // 모바일(iOS Safari/Chrome/인앱 · Android Chrome/삼성인터넷/인앱 · PWA) 전 화면 공통 Pull-to-refresh 핸들러
  const [ptrPullDist, setPtrPullDist] = useState(0);
  const [isPtrRefreshing, setIsPtrRefreshing] = useState(false);
  const ptrStartRef = useRef<{ x: number; y: number } | null>(null);
  const ptrDistRef = useRef(0);
  const ptrActivePullRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const getRootScrollTop = () => {
      const se = document.scrollingElement;
      if (se) return se.scrollTop;
      return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    };

    const hasInnerScrolledOrBlockedAncestor = (target: EventTarget | null): boolean => {
      if (hasAnyModalOpen || document.body.style.overflow === 'hidden') return true;
      let el = target instanceof HTMLElement ? target : null;
      while (el && el !== document.body && el !== document.documentElement) {
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) {
          return true;
        }
        if (el.getAttribute('role') === 'dialog' || el.classList.contains('overscroll-contain')) {
          return true;
        }
        const style = window.getComputedStyle(el);
        const oy = style.overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 2 && el.scrollTop > 0) {
          return true;
        }
        el = el.parentElement;
      }
      return false;
    };

    const resetPtr = () => {
      ptrStartRef.current = null;
      ptrDistRef.current = 0;
      ptrActivePullRef.current = false;
      setPtrPullDist(0);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (isPtrRefreshing || e.touches.length !== 1) {
        ptrStartRef.current = null;
        return;
      }
      if (getRootScrollTop() <= 2 && !hasInnerScrolledOrBlockedAncestor(e.target)) {
        ptrStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        ptrDistRef.current = 0;
        ptrActivePullRef.current = false;
      } else {
        ptrStartRef.current = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!ptrStartRef.current || isPtrRefreshing || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - ptrStartRef.current.x;
      const dy = e.touches[0].clientY - ptrStartRef.current.y;

      // 위로 올리는 일반 스크롤(dy <= 0) 또는 좌우 가로 스와이프는 즉시 네이티브 스크롤에 양보
      if (!ptrActivePullRef.current) {
        if (dy < -4 || (Math.abs(dx) > 8 && Math.abs(dx) >= Math.abs(dy))) {
          resetPtr();
          return;
        }
      }

      const curScrollTop = getRootScrollTop();
      if (curScrollTop > 2) {
        resetPtr();
        return;
      }

      const iosOverscroll = curScrollTop < 0 ? Math.abs(curScrollTop) : 0;
      if (dy > 10 && dy > Math.abs(dx) * 1.2) {
        ptrActivePullRef.current = true;
        // 최상단(scrollTop <= 0)에서 아래로 당길 때만 preventDefault로 AOS touchcancel 중단 없이 부드러운 당김 보장
        if (curScrollTop <= 0 && e.cancelable) {
          e.preventDefault();
        }
        const damped = Math.min(96, Math.max(Math.round((dy - 10) * 0.55), Math.round(iosOverscroll * 0.85)));
        ptrDistRef.current = damped;
        setPtrPullDist(damped);
      } else if (ptrActivePullRef.current && dy <= 6) {
        ptrDistRef.current = 0;
        setPtrPullDist(0);
      }
    };

    const onTouchEnd = () => {
      if (!ptrStartRef.current) return;
      const finalDist = Math.max(
        ptrDistRef.current,
        getRootScrollTop() < 0 ? Math.abs(getRootScrollTop()) : 0
      );
      ptrStartRef.current = null;
      ptrActivePullRef.current = false;
      if (finalDist >= 50 && !isPtrRefreshing) {
        setIsPtrRefreshing(true);
        setPtrPullDist(58);
        try {
          window.sessionStorage.setItem('ghosti_splash_shown_v1', '1');
        } catch {
          // ignore
        }
        const isNativeCapacitorApp = Boolean(
          (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
        );
        if (isNativeCapacitorApp) {
          // 네이티브 스토어 앱에서 화면을 아래로 당기면 WebView 리로드 없이 즉시 스마트폰 갤러리(사진·동영상) 자동 인덱싱 수행
          void useSaySeeStore.getState().syncMobileNativeGalleryAuto({ promptPermission: true });
          window.setTimeout(() => {
            ptrDistRef.current = 0;
            setIsPtrRefreshing(false);
            setPtrPullDist(0);
          }, 620);
        } else {
          window.setTimeout(() => {
            window.location.reload();
          }, 420);
        }
      } else {
        ptrDistRef.current = 0;
        setPtrPullDist(0);
      }
    };

    const onTouchCancel = () => {
      if (!isPtrRefreshing) {
        resetPtr();
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [hasAnyModalOpen, isPtrRefreshing]);

  // 모바일 및 데스크톱 전 페이지 공통 '맨 위로 가기 (Scroll to Top)' 플로팅 버튼 노출 상태 (모바일 키보드 입력 포커스 중에는 가림 방지를 위해 자동 숨김)
  const [showScrollTopBtn, setShowScrollTopBtn] = useState(false);
  const [isMobileInputFocused, setIsMobileInputFocused] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let kbTouchStart: { x: number; y: number } | null = null;

    const blurFocusedTextControl = () => {
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable)
      ) {
        active.blur();
        setIsMobileInputFocused(false);
      }
    };

    const handleScroll = () => {
      const y =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
      setShowScrollTopBtn(y > 160);
      if (kbTouchStart) {
        blurFocusedTextControl();
        kbTouchStart = null;
      }
    };
    const onKbTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        kbTouchStart = null;
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable)
      ) {
        kbTouchStart = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      } else {
        kbTouchStart = null;
      }
    };
    const onKbTouchMove = (e: TouchEvent) => {
      if (!kbTouchStart || e.touches.length !== 1) return;
      const dx = Math.abs(e.touches[0].clientX - kbTouchStart.x);
      const dy = Math.abs(e.touches[0].clientY - kbTouchStart.y);
      if (dy > 10 && dy > dx) {
        blurFocusedTextControl();
        kbTouchStart = null;
      }
    };
    const onKbTouchEnd = () => {
      kbTouchStart = null;
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        setIsMobileInputFocused(true);
      }
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        setIsMobileInputFocused(Boolean(active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')));
      }, 120);
    };
    const onNativeKb = (ev: Event) => {
      const detail = (ev as CustomEvent<{ open?: boolean }>).detail;
      if (typeof detail?.open === 'boolean') {
        setIsMobileInputFocused(detail.open);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchstart', onKbTouchStart, { passive: true });
    window.addEventListener('touchmove', onKbTouchMove, { passive: true });
    window.addEventListener('touchend', onKbTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onKbTouchEnd, { passive: true });
    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    window.addEventListener('ghostiKeyboardState', onNativeKb);
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchstart', onKbTouchStart);
      window.removeEventListener('touchmove', onKbTouchMove);
      window.removeEventListener('touchend', onKbTouchEnd);
      window.removeEventListener('touchcancel', onKbTouchEnd);
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('ghostiKeyboardState', onNativeKb);
    };
  }, []);

  const handleScrollToTop = () => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  useEffect(() => {
    if (!lastQuarantineToast) return;
    const t = window.setTimeout(() => dismissQuarantineToast(), 4500);
    return () => clearTimeout(t);
  }, [lastQuarantineToast, dismissQuarantineToast]);

  return (
    <GhostiHubRootProvider>
      {/* [프로필 내 본인 여권 단독 보관함 — D-35] 쇼룸·워크스페이스·모바일 전 화면 어디서든 프로필 [🛂 여권] 클릭 시 즉시 오픈 */}
      <PassportDoorplateStyleModal />

      {/* 모바일(iOS/AOS) 전 화면 공통 상단 당겨서 새로고침(Pull-to-refresh) 플로팅 인디케이터 — iOS 상단 상태바(topSafeAreaShieldView) 차폐 영역 아래에 배치하여 상단 잘림 원천 차단 */}
      {(ptrPullDist > 0 || isPtrRefreshing) && (
        <div
          style={{
            top: 'var(--ghosti-safe-top, env(safe-area-inset-top, 0px))',
            transform: `translate3d(-50%, ${
              isPtrRefreshing
                ? 14
                : Math.min(56, Math.max(10, Math.round(ptrPullDist * 0.65)))
            }px, 0)`,
          }}
          className="fixed left-1/2 z-[180] pointer-events-none transition-transform duration-75"
        >
          <div className="px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-800 text-[12.5px] font-medium shadow-md flex items-center gap-2 whitespace-nowrap">
            <span
              className={`inline-block w-3.5 h-3.5 rounded-full border-2 border-slate-700 border-t-transparent ${
                isPtrRefreshing || ptrPullDist >= 50 ? 'animate-spin' : ''
              }`}
            />
            <span>
              {isPtrRefreshing
                ? '새로고침 중...'
                : ptrPullDist >= 50
                ? '손을 떼면 새로고침됩니다'
                : '아래로 당겨서 새로고침'}
            </span>
          </div>
        </div>
      )}

      {/* 공식 쇼룸 & 하이브리드 온보딩 대문 vs 내부 개발 워크스페이스 분기 */}
      {viewMode === 'showroom' ? (
        <GhostiShowroomLanding
          onEnterWorkspace={handleEnterWorkspace}
          isDevAuthorized={isDevAuthorized}
        />
      ) : (
        <>
          {layout === 'desktop' ? <DesktopDashboard /> : <MobileAppView />}

          {/* 체험판 1분 고속 스캔 & 검진 구역 직접 허용 모달 (온보딩 대문 페이지와 중복이므로 팝업 주석 처리) */}
          {/* 체험판 1분 고속 스캔 & 검진 구역 직접 허용 모달 (인포데스크 온보딩 3탭 가이드 모달) */}
          <OnboardingModal />

          {/* 사진 상세 & 연사 비교 Pick & 2차 연관 꼬리물기 탐색 모달 */}
          <PhotoDetailModal />

          {/* [스펙 4] 카페 런칭용 심플 과금 퍼널 & 스토어 클린 모드 데스크톱 기기 연동 모달 */}
          <PricingModal />

          {/* [안전장치 2] /?master=pc 모바일 접속 시 결제/요금 안내 없는 순수 'PC 데스크톱 엔진 기능 소개 화면' 이중 방어 모달 */}
          <MobileMasterPcIntroModal />

          {/* [스펙 1] 스마트 서류함 내 로컬 PDF/TXT/DOCX 문서 상세 열람 모달 */}
          <LocalDocPreviewModal />

          {/* [체험판 타겟 ②] 동영상 장면 검색 상세 & 원본 MP4 재생 모달 */}
          <VideoScenePreviewModal />

          {/* [라운지 마스터 스펙] 자율 얼굴 추출(Face Crop) & 당해 연도 대표 멤버 등록 & 초대 레이더 시드 모달 */}
          <FaceMemberRegistryModal />

          {/* [🛠️ 구 설정몬스터 팝업 비활성화 — 1. 👻 귀신비서 채팅 원클릭 칩으로 100% 일원화] 타사 앱 최상단 손가락 화살표 가이드(👆)만 유지 */}
          <SetupFloatingOverlayGuide />

          {/* [고스트 캐스트 & 라이브 3대 핵심 무기] ① PC/노트북 모니터 풀스크린 클린 뷰어 + 무선 리모컨, ② 방 전용 프라이빗 라이브 생중계 & 라이브 포토 싱크, ③ 원격 모니터링 셔터(선별/즉시 공유 선택) */}
          <GhostCastAndLiveGlobalOverlay />

          {/* PC·모바일 공통 공유방 오버레이 (카톡 1초 합류 Auth-Wall & 공유방 사진 골라 올리기 모달) 및 사진 OCR 모달 */}
          <FreePhotoShareOverlays />
          <GhostSecretaryFirstModal />
          <GhostPhotoOcrTeleportModal photo={ocrModalPhoto} onClose={() => setOcrModalPhoto(null)} />

          {/* [스펙 2] 글로벌 플로팅 3중 타임머신 안전망 (즉시 되돌리기 Undo 바) */}
          {lastUndoBatch && (
            <div
              className={`fixed ${
                layout === 'mobile' && activeLoungeType !== 'personal' && !isLandscapeCompact
                  ? 'bottom-20'
                  : 'bottom-6'
              } mb-safe left-1/2 -translate-x-1/2 z-[115] w-[94%] max-w-xl px-4 sm:px-5 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white shadow-lg flex flex-wrap items-center justify-between gap-2.5 sm:gap-3`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[13px] font-medium break-keep">
                  방금 정리한 {lastUndoBatch.count}장이 휴지통으로 이동되었습니다.
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={() => void undoLastQuarantine()}
                  className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-[12px] font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  실행 취소
                </button>
                <button
                  type="button"
                  onClick={dismissUndoBatch}
                  className="text-slate-400 hover:text-white p-1.5 cursor-pointer"
                  title="닫기"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </div>
          )}

          {/* 글로벌 액션 피드백 토스트 (100% 불투명 솔리드 배경으로 어두운 사진 위에서도 선명한 가독성 보장) */}
          {lastQuarantineToast && !lastUndoBatch && (
            <div
              className={`fixed ${
                layout === 'mobile' && activeLoungeType !== 'personal' && !isLandscapeCompact
                  ? 'bottom-20'
                  : 'bottom-6'
              } mb-safe left-1/2 -translate-x-1/2 z-[110] w-[92vw] max-w-xl px-4 sm:px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-[13px] font-medium shadow-lg flex items-start justify-between gap-2.5`}
            >
              <span className="whitespace-normal break-keep leading-snug flex-1">
                {lastQuarantineToast}
              </span>
              <button
                onClick={dismissQuarantineToast}
                className="text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white p-1 shrink-0 cursor-pointer"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
          )}
        </>
      )}

      {/* [R3 해결] 전사 정밀 안심 배지 */}
      <div className="sr-only" data-privacy-guarantee="true">
        내 파일 원본과 문서 본문은 외부 서버로 전송되지 않고 내 기기 안에서 처리됩니다.
      </div>

      {/* 모든 페이지(쇼룸 대문, 모바일, 데스크톱 전 메뉴) 공통 맨 위로 가기 플로팅 버튼 */}
      {showScrollTopBtn && !(layout === 'mobile' && isMobileInputFocused) && (
        <button
          type="button"
          onClick={handleScrollToTop}
          aria-label="맨 위로 가기"
          title="맨 위로 가기"
          className={`fixed ${
            viewMode === 'workspace' &&
            layout === 'mobile' &&
            activeLoungeType !== 'personal' &&
            !isLandscapeCompact
              ? 'bottom-20'
              : 'bottom-4 sm:bottom-6'
          } mb-safe right-4 sm:right-5 z-[120] w-11 h-11 rounded-full bg-white hover:bg-slate-50 active:scale-95 text-slate-700 border border-slate-200/80 shadow-[0_6px_20px_rgba(15,23,42,0.16)] flex items-center justify-center transition-all cursor-pointer`}
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
      )}
    </GhostiHubRootProvider>
  );
};

export default App;
