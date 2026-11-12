function scrollAppToTop(): void {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
}
import React, { useEffect, useMemo, useState } from 'react';
import { zCoreBridge } from '../services/zCoreBridge';
import { useSaySeeStore, getActivePersonaForCluster, type DesktopTab } from '../store/useSaySeeStore';
import type { FamilyRoomId, GpuHelperTierId, LoungeType } from '../types/saysee';
import {
  cleanVideoTimestampLabel,
  groupBurstSearchResults,
  resolveVideoCardThumbUrl,
} from '../services/aiEngine';
import { executeRealOsAction } from '../services/setupMonsterEngine';
import { VoiceHeroStage } from './VoiceHeroStage';
import { SmartTrashView } from './SmartTrashView';
import { Stage1MinimalSearchPreview, Stage1MinimalCarePreview } from './Stage1MinimalPreview';
import {
  GhostWindowThreeStageMockup,
  GhostPhotoOcrTeleportModal,
  type GhostWindowTierMode,
  type GhostWindowUiTab,
} from './GhostWindowThreeStageMockup';
import {
  LoungeCustomSettingsHeader,
  LoungeFeedContextBanner,
  LoungeIndexingWaitingRoom,
  LoungeView,
} from './LoungeView';
import { PcMasterQuickSendPanel, renderHighlightedDocText } from './PricingModal';
import { GhostiTopRightHubAnchor, GhostiSidebarBottomFamilyLauncher } from './GhostiHubInfraBridge';
import { GhostiBrandLogo } from './GhostiBrandLogo';
import { GhostSuperpowerDojo } from './ghostDojo/GhostSuperpowerDojo';
import { GhostSearchTrainingPage } from './ghostDojo/GhostSearchTrainingPage';
import {
  computeGhostSearchWindowRect,
  resolveGhostSearchResponsiveSpec,
  type GhostSearchStage,
} from '../services/ghostSearchWindowGeometry';
import { ZCoreEngineStatusBadge } from './ZCoreEngineStatusBadge';
import { MerlinZCoreGuideModal } from './MerlinZCoreGuideModal';
import { GhostSecretaryFirstGuard, GhostSecretaryFirstModal } from './GhostSecretaryFirstGuard';
import {
  OnboardingModal,
  fetchSuperpowerStatus,
  startSuperpowerTrialAction,
  type SuperpowerTrialStatus,
} from './OnboardingModal';

const MainLoungeMonoIcon: React.FC<{ id: LoungeType; className?: string }> = ({
  id,
  className = 'w-[16px] h-[16px]',
}) => {
  switch (id) {
    case 'personal':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7" />
        </svg>
      );
    case 'family':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3 19c0-3.31 2.69-6 6-6s6 2.69 6 6" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M16 13.5c2.76 0 5 2.24 5 5" />
        </svg>
      );
    case 'club':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 3v18" />
          <path d="M5 4h12l-2.5 4.5L17 13H5" />
        </svg>
      );
    case 'student':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 10L12 5 2 10l10 5 10-5z" />
          <path d="M6 12.5V17c0 1.66 2.69 3 6 3s6-1.34 6-3v-4.5" />
        </svg>
      );
    case 'work':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          <path d="M2 12h20" />
        </svg>
      );
  }
};

const MAIN_LOUNGE_MENUS: Array<{
  id: LoungeType;
  label: string;
  shortLabel: string;
  sectionHeader?: string;
  freeBadge?: boolean;
}> = [
  {
    id: 'personal',
    label: '내 기기 (PC·폰)',
    shortLabel: '내 기기',
    freeBadge: false,
  },
  {
    id: 'family',
    label: '패밀리 (우리집·양가)',
    shortLabel: '패밀리',
    sectionHeader: '사진 공유',
  },
  {
    id: 'club',
    label: '동호회 · 동창회',
    shortLabel: '동호·동창',
  },
  {
    id: 'work',
    label: '업무 공유 (S: 드라이브)',
    shortLabel: '업무(S:)',
    sectionHeader: '업무 공유',
  },
];

/**
 * [1차 출시 3대 메뉴 체계 — 모바일 빠른 전환 바] 내 기기 / 사진 공유 / 업무 공유
 * - 데스크톱 사이드바는 섹션 헤더(💻 내 기기 / 📸 사진 공유 / 💼 업무 공유)로 이미 3대 구조이므로 그대로 유지
 * - 모바일에서는 '사진 공유' 1칸으로 묶고 하위에서 패밀리 ↔ 동호회·동창회를 선택 전환
 */
type QuickMenuId = 'personal' | 'photo_share' | 'work';

const MOBILE_QUICK_MENUS: Array<{
  id: QuickMenuId;
  label: string;
  iconId: LoungeType;
  defaultLounge: LoungeType;
}> = [
  { id: 'personal', label: '내 기기', iconId: 'personal', defaultLounge: 'personal' },
  { id: 'photo_share', label: '사진 공유', iconId: 'family', defaultLounge: 'family' },
  { id: 'work', label: '업무 공유', iconId: 'work', defaultLounge: 'work' },
];

const PHOTO_SHARE_GROUPS: Array<{ id: LoungeType; label: string }> = [
  { id: 'family', label: '👨‍👩‍👧‍👦 가족' },
  { id: 'club', label: '⛰️ 동호회·모임' },
  { id: 'student', label: '🎓 동창회' },
];

const resolveQuickMenuId = (lounge: LoungeType): QuickMenuId =>
  lounge === 'family' || lounge === 'club' || lounge === 'student'
    ? 'photo_share'
    : lounge === 'work'
    ? 'work'
    : 'personal';

const LOUNGE_SUBMENU_CONFIG: Record<
  LoungeType,
  Array<{ id: DesktopTab; icon: string; label: string; subcaption?: string; showTrashCount?: boolean }>
> = {
  personal: [
    // [v1.3] 귀신 3총사 명칭·순서 통일: 1순위 귀신비서(구 손보기+채팅) → 2순위 귀신검색(구 찾기)
    { id: 'trash', icon: '👻', label: '귀신비서', subcaption: '손보기 · 귀신계 여권 · 채팅', showTrashCount: true },
    { id: 'dashboard', icon: '👻', label: '귀신검색', subcaption: 'Ctrl + 0 현장 소환 수련' },
  ],
  family: [
    { id: 'trial', icon: '📸', label: '패밀리 공유 시작' },
    { id: 'trash', icon: '🧹', label: '새 사진 정리함' },
    { id: 'sync', icon: '⚙️', label: '가족 초대 & 방 관리' },
  ],
  club: [
    { id: 'trial', icon: '⛰️', label: '동호회·모임 시작' },
    { id: 'dashboard', icon: '🖼️', label: '동호회·모임 앨범 & 원본 다운로드' },
    { id: 'trash', icon: '🧹', label: '새 사진 정리함' },
    { id: 'sync', icon: '⚙️', label: '모임 관리 & 회원 초대' },
  ],
  student: [
    { id: 'trial', icon: '🎓', label: '동창회 시작' },
    { id: 'dashboard', icon: '🖼️', label: '동창회 앨범 & 원본 다운로드' },
    { id: 'trash', icon: '🧹', label: '새 사진·영상 정리함' },
    { id: 'sync', icon: '⚙️', label: '동창회 관리 & 동기 초대' },
  ],
  work: [
    { id: 'trial', icon: '💼', label: '업무 공유(S:) 시작' },
    { id: 'dashboard', icon: '📂', label: '업무 문서·현장사진 & S: 드라이브' },
    { id: 'trash', icon: '🧹', label: '새 업무파일 정리함' },
    { id: 'sync', icon: '⚙️', label: '팀원 권한 & S: 드라이브 연결' },
  ],
};

export const DesktopDashboard: React.FC = () => {
  const [showZCoreGuideModal, setShowZCoreGuideModal] = useState(false);
  const [isZCoreConnected, setIsZCoreConnected] = useState(zCoreBridge.isConnected);

  useEffect(() => {
    setIsZCoreConnected(zCoreBridge.isConnected);
    const onOpenZCoreGuide = () => setShowZCoreGuideModal(true);
    window.addEventListener('openZCoreGuideModal', onOpenZCoreGuide);
    const unsub = zCoreBridge.subscribe((conn) => {
      setIsZCoreConnected(conn);
      if (
        conn &&
        typeof sessionStorage !== 'undefined' &&
        sessionStorage.getItem('ghosti_initial_indexing_done') !== '1' && false
      ) {
        setShowZCoreGuideModal(true);
      }
    });

    void zCoreBridge.checkHealth();

    return () => {
      window.removeEventListener('openZCoreGuideModal', onOpenZCoreGuide);
      unsub();
    };
  }, []);
  const {
    desktopTab,
    setDesktopTab,
    activeLoungeType,
    setActiveLoungeType,
    photos,
    searchSpace,
    setSearchSpace,
    resetSearchSpaceToAll,
    matchedLocalDocs,
    matchedVaultPhotos,
    setSelectedDocModal,
    videoSceneItems,
    matchedVideoScenes,
    setSelectedVideoModal,
    syncRealVideoDuration,
    onboardingTrackMode,
    pcAgentPairedMobile,
    activeQuery,
    searchResults,
    groupBurstsInSearch,
    setGroupBurstsInSearch,
    setSelectedPhoto,
    toggleBookmark,
    openLocalFolder,
    setShowOnboarding,
    activePricingPlan,
    subscribedLounges,
    gpuHelper24hActive,
    gpuHelperActiveTier,
    activateGpuHelper24h,
    deactivateGpuHelper24h,
    syncState,
    setPrivateSyncStrategy,
    updateSyncSettings,
    setChargingOnlySync,
    triggerSyncNow,
    themeMode,
    toggleThemeMode,
    merlinAuth,
    isStoreAppMode,
    enableSetupMonster,
    enableMobileCoinDisplay,
    showCoinBalanceInApp,
    enablePcGuideShareButton,
    setIsStoreAppMode,
    setEnableSetupMonster,
    setEnableMobileCoinDisplay,
    setEnablePcGuideShareButton,
    setShowMobileMasterPcIntroModal,
    setShowSetupMonsterModal,
    setShowProModal,
    faceClusters,
    activeFamilyRoom,
    setActiveFamilyRoom,
    setDoorplatePickerClusterId,
    hasExecutedUserSearch,
    hasUserSelectedSearchTab,
    isGuestPreviewMode,
    guestJoinWallReason,
    setIsGuestPreviewMode,
    triggerGuestJoinWall,
    completeGuestOneSecJoin,
    initialized,
  } = useSaySeeStore();

  const [guestNicknameDraft, setGuestNicknameDraft] = useState('박총무');
  const [guestEmailDraft, setGuestEmailDraft] = useState('friend@sundreamer.app');

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDeviceIntegrationOpen, setIsDeviceIntegrationOpen] = useState(false);
  const [isDeviceIntegrationManuallyExpanded, setIsDeviceIntegrationManuallyExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('ghosti_device_integration_expanded') === 'true';
    } catch {
      return false;
    }
  });

  const [isWorkShareManuallyExpanded, setIsWorkShareManuallyExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('ghosti_work_share_expanded') === 'true';
    } catch {
      return false;
    }
  });

  const [activeIntegrationSubTab, setActiveIntegrationSubTab] = useState<'devices' | 'superpower'>('devices');
  const [ghostWindowTier, setGhostWindowTier] = useState<GhostWindowTierMode>('pc_free');
  const [ghostWindowInitialTab, setGhostWindowInitialTab] = useState<GhostWindowUiTab>('ui1_basic');
  const [ocrModalPhoto, setOcrModalPhoto] = useState<any>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isCanvasExpanded, setIsCanvasExpanded] = useState(false);
  const [showFamilyAppsInSidebar, setShowFamilyAppsInSidebar] = useState(false);
  const [showPrivateSyncSection, setShowPrivateSyncSection] = useState(true);
  const [showPolicyAndStoreSection, setShowPolicyAndStoreSection] = useState(false);
  const [superpowerStatus, setSuperpowerStatus] = useState<SuperpowerTrialStatus | null>(null);
  /**
   * [v1.4 확정] 로컬 『👻 귀신검색창』 전용 화면 모드: ?ghostSearchWindow=small|medium|large|compact
   * - 상단 수동 버튼은 일반 창처럼 [⤢ 크게(갤러리)] ↔ [⤡ 작게] 단 1개 토글(2모드)만 노출
   * - 평소 '작게(compact)' 모드일 때는 검색량·미리보기(사진/문서 OCR) 유무에 따라 소형(520) ↔ 중형(960×640)으로 자율 반응형 조절
   */
  const [ghostSearchWindowStage, setGhostSearchWindowStage] = useState<'small' | 'medium' | 'large' | null>(() => {
    if (typeof window === 'undefined') return null;
    const v = new URLSearchParams(window.location.search).get('ghostSearchWindow');
    if (v === 'compact') return 'small';
    return v === 'small' || v === 'medium' || v === 'large' ? v : null;
  });
  const [ghostSearchAnchor] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 200, y: 120 };
    return { x: window.screenX || 200, y: window.screenY || 120 };
  });
  const [isInsideIframe] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  });
  const applyStandaloneWindowGeometry = (nextStage: GhostSearchStage, customHeight?: number) => {
    setGhostSearchWindowStage(nextStage);
    try {
      const prev = JSON.parse(localStorage.getItem('ghosti_search_game_v1') || '{}');
      const next = {
        ...prev,
        summon: true,
        ...(nextStage === 'medium' ? { medium: true } : {}),
        ...(nextStage === 'large' ? { medium: true, large: true } : {}),
      };
      localStorage.setItem('ghosti_search_game_v1', JSON.stringify(next));
    } catch {
      /* ignore */
    }
    try {
      const rect = computeGhostSearchWindowRect(
        nextStage,
        ghostSearchAnchor.x,
        ghostSearchAnchor.y,
        {
          left: 0,
          top: 0,
          right: window.screen?.availWidth || 1920,
          bottom: window.screen?.availHeight || 1040,
        },
        20,
        customHeight
      );
      window.resizeTo(rect.width, rect.height);
      window.moveTo(rect.x, rect.y);
    } catch {
      /* ignore */
    }
  };
  const toggleStandaloneGhostSearchLargeMode = () => {
    if (!ghostSearchWindowStage) return;
    if (ghostSearchWindowStage === 'large') {
      const totalMatched =
        searchResults.length + matchedLocalDocs.length + matchedVaultPhotos.length + matchedVideoScenes.length;
      const spec = resolveGhostSearchResponsiveSpec({
        mode: 'compact',
        hasQuery: Boolean(hasExecutedUserSearch && activeQuery.trim()),
        resultCount: totalMatched,
        hasRichPreview: searchResults.length > 0 || matchedVaultPhotos.length > 0 || matchedLocalDocs.length > 0,
      });
      applyStandaloneWindowGeometry(spec.stage, spec.customHeight);
    } else {
      applyStandaloneWindowGeometry('large');
    }
  };
  // '작게(소↔중 자율)' 모드일 때 검색 결과 양에 따라 120ms 디바운스로 창 크기를 자동 조절 (Top-Left 앵커 고정)
  useEffect(() => {
    if (!ghostSearchWindowStage || ghostSearchWindowStage === 'large' || isInsideIframe) return;
    const timer = window.setTimeout(() => {
      const cleanQ =
        hasExecutedUserSearch &&
        activeQuery &&
        !activeQuery.startsWith('전체 갤러리 사진') &&
        !activeQuery.startsWith('동영상 ') &&
        !activeQuery.startsWith('최근 서류 ')
          ? activeQuery.trim()
          : '';
      const totalMatched =
        searchResults.length + matchedLocalDocs.length + matchedVaultPhotos.length + matchedVideoScenes.length;
      const spec = resolveGhostSearchResponsiveSpec({
        mode: 'compact',
        hasQuery: Boolean(cleanQ),
        resultCount: totalMatched,
        hasRichPreview: searchResults.length > 0 || matchedVaultPhotos.length > 0 || matchedLocalDocs.length > 0,
      });
      applyStandaloneWindowGeometry(spec.stage, spec.customHeight);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [
    ghostSearchWindowStage,
    isInsideIframe,
    hasExecutedUserSearch,
    activeQuery,
    searchResults.length,
    matchedLocalDocs.length,
    matchedVaultPhotos.length,
    matchedVideoScenes.length,
  ]);
  const [isStage1MinimalPreview] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    if (new URLSearchParams(window.location.search).get('ghostSearchWindow')) return false;
    return !window.location.search.includes('preview=legacy');
  });
  useEffect(() => {
    if (!ghostSearchWindowStage) return;
    setActiveLoungeType('personal');
    setDesktopTab('dashboard');
    // 귀신비서·현장 소환에서 넘겨준 검색어(&q=)가 있으면 초기화 완료 후 아직 실행되지 않았을 때만 1회 실행
    if (!initialized) return;
    const q = (new URLSearchParams(window.location.search).get('q') || '').trim();
    const st = useSaySeeStore.getState();
    if (q && (!st.hasExecutedUserSearch || st.activeQuery !== q)) {
      void st.runTextQuery(q);
    }
  }, [ghostSearchWindowStage, initialized, setActiveLoungeType, setDesktopTab]);

  const isAnySubscribed = useMemo(
    () =>
      activePricingPlan !== 'free_trial' ||
      Object.values(subscribedLounges).some(Boolean) ||
      Boolean(superpowerStatus?.is_subscribed),
    [activePricingPlan, subscribedLounges, superpowerStatus?.is_subscribed]
  );

  const isAuthenticatedUser = Boolean(
    merlinAuth?.email && merlinAuth.userId && merlinAuth.userId !== 'guest'
  );

  // [4대 조건부 자동 펼침 판별]
  // 조건 1&2: 로그인된 상태에서 Pro/체험 중, 모바일 페어링 이력, 또는 수동 Sticky
  const isDeviceIntegrationAutoExpanded = useMemo(() => {
    const isProOrTrial =
      isAuthenticatedUser &&
      (activePricingPlan !== 'free_trial' ||
        Boolean(superpowerStatus?.is_subscribed) ||
        (superpowerStatus?.trial_status && superpowerStatus.trial_status !== 'NOT_STARTED'));
    const isDevicePaired = isAuthenticatedUser && Boolean(pcAgentPairedMobile);
    return Boolean(isProOrTrial || isDevicePaired || isDeviceIntegrationManuallyExpanded);
  }, [
    isAuthenticatedUser,
    activePricingPlan,
    superpowerStatus,
    pcAgentPairedMobile,
    isDeviceIntegrationManuallyExpanded,
  ]);

  // 조건 1&2: 로그인된 상태에서 Team 구독 중, 30일 무료체험 중, 모바일(아이폰/안드로이드) 연결 시, 또는 수동 Sticky
  const isWorkShareAutoExpanded = useMemo(() => {
    const isTeamSubscribed =
      isAuthenticatedUser &&
      (activePricingPlan.startsWith('work_') || Boolean(subscribedLounges.work));
    const isProOrTrial =
      isAuthenticatedUser &&
      (activePricingPlan !== 'free_trial' ||
        Boolean(superpowerStatus?.is_subscribed) ||
        (superpowerStatus?.trial_status && superpowerStatus.trial_status !== 'NOT_STARTED'));
    const isDevicePaired = isAuthenticatedUser && Boolean(pcAgentPairedMobile);
    return Boolean(isTeamSubscribed || isProOrTrial || isDevicePaired || isWorkShareManuallyExpanded);
  }, [
    isAuthenticatedUser,
    activePricingPlan,
    subscribedLounges.work,
    superpowerStatus,
    pcAgentPairedMobile,
    isWorkShareManuallyExpanded,
  ]);

  const toggleDeviceIntegrationExpanded = (force?: boolean) => {
    const next = typeof force === 'boolean' ? force : !isDeviceIntegrationAutoExpanded;
    setIsDeviceIntegrationManuallyExpanded(next);
    try {
      localStorage.setItem('ghosti_device_integration_expanded', String(next));
    } catch {}
  };

  const toggleWorkShareExpanded = (force?: boolean) => {
    const next = typeof force === 'boolean' ? force : !isWorkShareAutoExpanded;
    setIsWorkShareManuallyExpanded(next);
    try {
      localStorage.setItem('ghosti_work_share_expanded', String(next));
    } catch {}
  };

    // 조건 4: 실시간 이벤트 트리거 (모바일 원샷 사진 수신 or 한도 도달) 및 귀신비서 점프 핸들러
  useEffect(() => {
    const onAutoOpenIntegration = () => {
      toggleDeviceIntegrationExpanded(true);
      setIsDeviceIntegrationOpen(true);
      setActiveIntegrationSubTab('devices');
    };
    const onJumpToSecretary = () => {
      setIsDeviceIntegrationOpen(false);
      setActiveLoungeType('personal');
      setDesktopTab('trash');
      setIsMobileDrawerOpen(false);
      scrollAppToTop();
    };
    window.addEventListener('ghosti_expand_device_integration', onAutoOpenIntegration);
    window.addEventListener('ghosti_superpower_limit_reached', onAutoOpenIntegration);
    window.addEventListener('ghosti_jump_to_secretary', onJumpToSecretary);
    return () => {
      window.removeEventListener('ghosti_expand_device_integration', onAutoOpenIntegration);
      window.removeEventListener('ghosti_superpower_limit_reached', onAutoOpenIntegration);
      window.removeEventListener('ghosti_jump_to_secretary', onJumpToSecretary);
    };
  }, []);

  useEffect(() => {
    const accountId = merlinAuth?.email || merlinAuth?.userId || 'local_user';
    const subFlag = activePricingPlan !== 'free_trial' || Object.values(subscribedLounges).some(Boolean);
    void fetchSuperpowerStatus(accountId, subFlag).then(setSuperpowerStatus);
    const onUpdated = (e: Event) => {
      const custom = e as CustomEvent<SuperpowerTrialStatus>;
      if (custom.detail) setSuperpowerStatus(custom.detail);
    };
    window.addEventListener('ghosti_superpower_status_updated', onUpdated);
    return () => window.removeEventListener('ghosti_superpower_status_updated', onUpdated);
  }, [merlinAuth?.email, merlinAuth?.userId, activePricingPlan, subscribedLounges]);

  const showCanvasResults = true;
  const resetToZenCanvas = () => {
    setIsCanvasExpanded(true);
    useSaySeeStore.setState({
      hasExecutedUserSearch: false,
      hasUserSelectedSearchTab: false,
    });
  };
  const FAMILY_ROOMS: FamilyRoomId[] = ['우리집', '본가(친가)', '처가(친정)'];

  const myPassportCluster = useMemo(
    () => faceClusters.find((c) => c.clusterId === 'face_member_5') || faceClusters[0],
    [faceClusters]
  );
  const myDoorplatePersona = useMemo(() => {
    if (!myPassportCluster) return '멀린';
    const { activePersona } = getActivePersonaForCluster(
      myPassportCluster,
      activeLoungeType,
      activeFamilyRoom
    );
    return activePersona || myPassportCluster.registeredName || '멀린';
  }, [myPassportCluster, activeLoungeType, activeFamilyRoom]);

  const activePhotos = useMemo(() => photos.filter((p) => !p.quarantined), [photos]);
  const quarantinedPhotos = useMemo(() => photos.filter((p) => p.quarantined), [photos]);
  const activeTrashCount = useMemo(
    () => activePhotos.filter((p) => Boolean(p.trashCategory)).length,
    [activePhotos]
  );

  // 검색 결과에서 동일 연사(dHash/연속촬영) 그룹을 1장으로 겹쳐서 [❐ N장 연사] 배지로 묶기
  const groupedResults = useMemo(() => {
    const orderedGroups = groupBurstSearchResults(searchResults);

    if (!groupBurstsInSearch || searchSpace === 'vault') {
      return orderedGroups.flatMap((g) =>
        g.burstPhotos.map((photo) => ({
          representative: {
            photo,
            score: g.representative.score,
            matchPercentage: g.representative.matchPercentage,
            matchedBy: g.representative.matchedBy,
          },
          burstPhotos: [photo],
          burstCount: 1,
        }))
      );
    }
    return orderedGroups;
  }, [searchResults, groupBurstsInSearch, searchSpace, hasExecutedUserSearch]);

  useEffect(() => {
    if (isMobileDrawerOpen) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeLoungeType, desktopTab, activeFamilyRoom, isMobileDrawerOpen]);

  // 모바일 사이드바 드로어(isMobileDrawerOpen)가 열려 있는 동안 뒤쪽 배경 페이지가 스크롤되는 오류(Background Scroll Bleed) 원천 차단
  useEffect(() => {
    if (typeof document === 'undefined' || !isMobileDrawerOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [isMobileDrawerOpen]);

  const collapsedBurstCount = searchResults.length - groupedResults.length;
  const currentSubmenus = LOUNGE_SUBMENU_CONFIG[activeLoungeType] || LOUNGE_SUBMENU_CONFIG.personal;
  const isCurrentLoungeSubscribed = Boolean(subscribedLounges[activeLoungeType]);
  const activeLoungeLabel =
    MAIN_LOUNGE_MENUS.find((m) => m.id === activeLoungeType)?.label || '개인 라운지';
  const activeSubmenuLabel =
    (activeLoungeType === 'personal' && desktopTab === 'trial' ? '🧹 귀신같이 청소 진단' : currentSubmenus.find((s) => s.id === desktopTab)?.label) || '귀신같이 찾기';

  const renderSidebarNavigationContent = (isMobileDrawer = false) => (
    <div
      className={`h-full flex flex-col justify-between p-3 select-none overscroll-contain ${
        themeMode === 'light'
          ? 'bg-[#F8F7F4] border-r border-[#E5E0D5] text-slate-800'
          : 'bg-[#111114] border-r border-white/10 text-zinc-200'
      }`}
    >
      <div className="flex flex-col gap-4 overflow-y-auto overscroll-contain no-scrollbar">
        {/* 1. 사이드바 최상단: 공식 스타일 A 브랜드 로고 (Ghosti + [👁️ AI 내용검색]) & 사이드바 접기 버튼 */}
        <div className="flex items-center justify-between px-1.5 py-1 gap-1.5">
          <GhostiBrandLogo
            size="desktop"
            themeMode={themeMode}
            showBadge={true}
            onClick={() => {
              setIsDeviceIntegrationOpen(false);
              setActiveLoungeType('personal');
              setDesktopTab('trash');
              resetToZenCanvas();
              if (isMobileDrawer) setIsMobileDrawerOpen(false);
              else scrollAppToTop();
            }}
          />

          <button
            type="button"
            onClick={() =>
              isMobileDrawer ? setIsMobileDrawerOpen(false) : setIsSidebarCollapsed(true)
            }
            title={isMobileDrawer ? '메뉴 닫기' : '사이드바 접기'}
            className="w-7 h-7 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center text-[13px] font-bold cursor-pointer"
          >
            {isMobileDrawer ? '✕' : '«'}
          </button>
        </div>

        {/* 2. 4대 메인 메뉴(내 기기 / 내 기기 통합 / 사진 공유 / 업무 공유) & 들여쓰기 사이드 서브메뉴 통일 */}
        {(() => {
          const isDeviceIntegrationActive =
            (activeLoungeType === 'personal' && desktopTab === 'sync') || isDeviceIntegrationOpen;
          const isMyDeviceActive =
            activeLoungeType === 'personal' && desktopTab !== 'sync' && !isDeviceIntegrationOpen;
          const isGhostSecretaryActive = isMyDeviceActive && desktopTab === 'trash';
          const isGhostSearchActive = isMyDeviceActive && desktopTab === 'dashboard';
          const isPhotoShareActive =
            !isDeviceIntegrationOpen &&
            (activeLoungeType === 'family' ||
              activeLoungeType === 'club' ||
              activeLoungeType === 'student');
          const isWorkShareActive = !isDeviceIntegrationOpen && activeLoungeType === 'work';

          const mainBtnClass = (active: boolean) =>
            `w-full px-3 py-2 rounded-xl font-label-md text-[15px] flex items-center justify-between gap-2 transition-all cursor-pointer ${
              active
                ? themeMode === 'light'
                  ? 'bg-[#E6F7F5] text-[#0F766E] font-extrabold'
                  : 'bg-zinc-800/90 text-primary-container font-extrabold'
                : themeMode === 'light'
                ? 'text-slate-800 hover:text-slate-950 hover:bg-black/5 font-extrabold'
                : 'text-zinc-200 hover:text-white hover:bg-white/5 font-extrabold'
            }`;

          const subWrapClass = `ml-3.5 pl-2.5 border-l flex flex-col gap-0.5 py-0.5 ${
            themeMode === 'light' ? 'border-slate-200' : 'border-white/10'
          }`;

          const subBtnClass = (active: boolean) =>
            `w-full px-2.5 py-1.5 rounded-lg text-left text-[13.5px] flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
              active
                ? themeMode === 'light'
                  ? 'bg-[#0D9488]/10 text-[#0D9488] font-extrabold'
                  : 'bg-white/10 text-white font-extrabold'
                : themeMode === 'light'
                ? 'text-slate-600 hover:text-slate-900 hover:bg-black/5 font-medium'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 font-medium'
            }`;

          const isPcFreeSuperpowerActive =
            isDeviceIntegrationOpen &&
            activeIntegrationSubTab === 'superpower' &&
            ghostWindowTier === 'pc_free';
          const isPhonePcIntegrationActive =
            isDeviceIntegrationOpen &&
            (activeIntegrationSubTab === 'devices' ||
              (activeIntegrationSubTab === 'superpower' && ghostWindowTier === 'phone_pc'));
          const isWorkTeamSuperpowerActive =
            isDeviceIntegrationOpen &&
            activeIntegrationSubTab === 'superpower' &&
            ghostWindowTier === 'work_team';

          return (
            <div className="flex flex-col gap-1.5">
              {/* ━━━ 기본 무료 메뉴 ━━━ */}

              {/* [v1.3 1순위] 👻 귀신비서 — 필수 첫 관문 & 만능 채팅 총괄 (구 손보기 + 채팅 도우미 통합) */}
              <button
                type="button"
                onClick={() => {
                  setIsDeviceIntegrationOpen(false);
                  setActiveLoungeType('personal');
                  setDesktopTab('trash');
                  if (isMobileDrawer) setIsMobileDrawerOpen(false);
                  else scrollAppToTop();
                }}
                className={mainBtnClass(isGhostSecretaryActive)}
              >
                <span className="truncate" title="컴퓨터 손보기부터 귀신계 여권까지">
                  👻 귀신비서
                </span>
              </button>

              {/* [v1.3 2순위] 👻 귀신검색 — 웹 검색창 폐지, 소환술 수련 + 도장깨기 + 3단 변신 귀신검색창 (구 찾기) */}
              <button
                type="button"
                onClick={() => {
                  setIsDeviceIntegrationOpen(false);
                  setActiveLoungeType('personal');
                  setDesktopTab('dashboard');
                  resetToZenCanvas();
                  if (isMobileDrawer) setIsMobileDrawerOpen(false);
                  else scrollAppToTop();
                }}
                className={mainBtnClass(isGhostSearchActive)}
              >
                <span className="truncate" title="Ctrl + 0 (우클릭 꾹~ / Ctrl+우클릭)">
                  👻 귀신검색
                </span>
              </button>

              {/* [v1.3 3순위] ⚡ 귀신창 초능력 — 상시 연습장 (1단계 소환술 3단 + 2단계 9종 도장깨기 체험관) */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeviceIntegrationOpen(true);
                    setActiveIntegrationSubTab('superpower');
                    setGhostWindowTier('pc_free');
                    setGhostWindowInitialTab('ui1_basic');
                    setActiveLoungeType('personal');
                    setDesktopTab('sync');
                    if (isMobileDrawer) setIsMobileDrawerOpen(false);
                    else scrollAppToTop();
                  }}
                  className={mainBtnClass(isPcFreeSuperpowerActive)}
                >
                  <div className="flex flex-col text-left min-w-0 flex-1">
                    <span className="truncate text-[14px]">⚡ 귀신창 초능력</span>
                    <span className="text-[10.5px] opacity-75 font-normal truncate">
                      🥋 수련장 · 도장깨기 체험관
                    </span>
                  </div>
                </button>
              </div>

              {/* [v1.3 4순위] 📸 사진 공유 (가족·동호회·동창회 — 인원·장수 무제한 평생 0원 · 사진/영상 전용) */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeviceIntegrationOpen(false);
                    if (
                      activeLoungeType !== 'family' &&
                      activeLoungeType !== 'club' &&
                      activeLoungeType !== 'student'
                    ) {
                      setActiveLoungeType('family');
                    }
                    setDesktopTab('dashboard');
                    resetToZenCanvas();
                  }}
                  className={mainBtnClass(isPhotoShareActive)}
                >
                  <span className="truncate" title="인원·장수 무제한 평생 0원 · 사진/영상 전용">
                    📸 사진 공유
                  </span>
                  <span className="text-[10px] opacity-60">{isPhotoShareActive ? '▾' : '▸'}</span>
                </button>

                {isPhotoShareActive && (
                  <div className={subWrapClass}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDeviceIntegrationOpen(false);
                        setActiveLoungeType('family');
                        setDesktopTab('dashboard');
                        resetToZenCanvas();
                        if (isMobileDrawer) setIsMobileDrawerOpen(false);
                      }}
                      className={subBtnClass(activeLoungeType === 'family')}
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="grayscale opacity-75 shrink-0 text-[13px]">👨‍👩‍👧‍👦</span>
                          <span className="truncate font-bold">가족</span>
                        </div>
                        <span className="pl-[21px] text-[11px] opacity-75 font-normal truncate">
                          우리집 · 본가 · 처가 앨범 (평생 0원)
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsDeviceIntegrationOpen(false);
                        setActiveLoungeType('club');
                        setDesktopTab('dashboard');
                        resetToZenCanvas();
                        if (isMobileDrawer) setIsMobileDrawerOpen(false);
                      }}
                      className={subBtnClass(activeLoungeType === 'club')}
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="grayscale opacity-75 shrink-0 text-[13px]">⛰️</span>
                          <span className="truncate font-bold">동호회·모임</span>
                        </div>
                        <span className="pl-[21px] text-[11px] opacity-75 font-normal truncate">
                          인원·장수 무제한 사진/영상 (평생 0원)
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsDeviceIntegrationOpen(false);
                        setActiveLoungeType('student');
                        setDesktopTab('dashboard');
                        resetToZenCanvas();
                        if (isMobileDrawer) setIsMobileDrawerOpen(false);
                      }}
                      className={subBtnClass(activeLoungeType === 'student')}
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="grayscale opacity-75 shrink-0 text-[13px]">🎓</span>
                          <span className="truncate font-bold">동창회</span>
                        </div>
                        <span className="pl-[21px] text-[11px] opacity-75 font-normal truncate">
                          학창시절 · 동창 사진/영상 (평생 0원)
                        </span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* ━━━ 기기 연동 · 팀 확장 (관심 시 클릭하여 펼침 / 4대 조건부 자동 펼침) ━━━ */}
              <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1 select-none" aria-label="확장 메뉴">
                {/* [확장 1] 내 기기 통합 (기본 접힘 / 4대 조건부 자동 펼침 & Sticky State) */}
                {(() => {
                  const isDeviceIntegrationExpanded = isDeviceIntegrationAutoExpanded || isPhonePcIntegrationActive;
                  return (
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          toggleDeviceIntegrationExpanded(true);
                          setIsDeviceIntegrationOpen(true);
                          setActiveIntegrationSubTab('devices');
                          setGhostWindowTier('phone_pc');
                          setActiveLoungeType('personal');
                          setDesktopTab('sync');
                          if (!isMobileDrawer) scrollAppToTop();
                        }}
                        className={mainBtnClass(isPhonePcIntegrationActive)}
                      >
                        <div className="flex flex-col text-left min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[14px]">내 기기 통합</span>
                            {superpowerStatus?.trial_status && superpowerStatus.trial_status !== 'NOT_STARTED' && (
                              <span className="px-1.5 py-0.5 text-[9.5px] font-bold rounded bg-emerald-500/20 text-emerald-400 shrink-0">
                                ✨ 체험중
                              </span>
                            )}
                          </div>
                          <span className="text-[10.5px] opacity-70 font-normal truncate">
                            폰 ↔ PC 연동 · 기기 통합 검색
                          </span>
                        </div>
                        <span className="text-[10px] opacity-60">{isDeviceIntegrationExpanded ? '▾' : '▸'}</span>
                      </button>

                      {isDeviceIntegrationExpanded && (
                        <div className={subWrapClass}>
                          <button
                            type="button"
                            onClick={() => {
                              setIsDeviceIntegrationOpen(true);
                              setActiveIntegrationSubTab('devices');
                              setActiveLoungeType('personal');
                              setDesktopTab('sync');
                              if (isMobileDrawer) setIsMobileDrawerOpen(false);
                            }}
                            className={subBtnClass(
                              isDeviceIntegrationOpen && activeIntegrationSubTab === 'devices'
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="grayscale opacity-75 shrink-0 text-[13px]">🔗</span>
                              <span className="truncate font-bold">기기 연결 (PC ↔ 폰)</span>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsDeviceIntegrationOpen(true);
                              setActiveIntegrationSubTab('superpower');
                              setGhostWindowTier('phone_pc');
                              setGhostWindowInitialTab('ui3_ocr');
                              setActiveLoungeType('personal');
                              setDesktopTab('sync');
                              if (isMobileDrawer) setIsMobileDrawerOpen(false);
                            }}
                            className={subBtnClass(
                              isDeviceIntegrationOpen &&
                                activeIntegrationSubTab === 'superpower' &&
                                ghostWindowTier === 'phone_pc'
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="shrink-0 text-[13px]">⚡</span>
                              <span className="truncate font-bold">귀신창 : 📱 폰 + PC</span>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* [확장 2] 업무 공유 (기본 접힘 / 4대 조건부 자동 펼침 & Sticky State) */}
                {(() => {
                  const isWorkShareExpanded = isWorkShareAutoExpanded || isWorkShareActive || isWorkTeamSuperpowerActive;
                  return (
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          toggleWorkShareExpanded(true);
                          setIsDeviceIntegrationOpen(false);
                          setActiveLoungeType('work');
                          setDesktopTab('dashboard');
                          resetToZenCanvas();
                        }}
                        className={mainBtnClass(isWorkShareActive || isWorkTeamSuperpowerActive)}
                      >
                        <div className="flex flex-col text-left min-w-0 flex-1">
                          <span className="truncate text-[14px]">업무 공유 (S:)</span>
                          <span className="text-[10.5px] opacity-70 font-normal truncate">
                            팀 공유 드라이브 · 계약서/단가표 공유
                          </span>
                        </div>
                        <span className="text-[10px] opacity-60">
                          {isWorkShareExpanded ? '▾' : '▸'}
                        </span>
                      </button>

                      {isWorkShareExpanded && (
                        <div className={subWrapClass}>
                          <button
                            type="button"
                            onClick={() => {
                              setIsDeviceIntegrationOpen(false);
                              setActiveLoungeType('work');
                              setDesktopTab('dashboard');
                              resetToZenCanvas();
                              if (isMobileDrawer) setIsMobileDrawerOpen(false);
                            }}
                            className={subBtnClass(activeLoungeType === 'work' && !isDeviceIntegrationOpen)}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="grayscale opacity-75 shrink-0 text-[13px]">💼</span>
                              <span className="truncate font-bold">S: 드라이브 · 문서 공유</span>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsDeviceIntegrationOpen(true);
                              setActiveIntegrationSubTab('superpower');
                              setGhostWindowTier('work_team');
                              setGhostWindowInitialTab('ui2_summon');
                              setActiveLoungeType('personal');
                              setDesktopTab('sync');
                              if (isMobileDrawer) setIsMobileDrawerOpen(false);
                            }}
                            className={subBtnClass(isWorkTeamSuperpowerActive)}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="shrink-0 text-[13px]">⚡</span>
                              <span className="truncate font-bold">귀신창 : 💼 팀 공유</span>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })()}
      </div>

      {/* 3. 사이드바 하단: 멀린 패밀리 생태계 앱 런처 (허브 SSO 연동) */}
      <GhostiSidebarBottomFamilyLauncher
        isOpen={showFamilyAppsInSidebar}
        onToggle={() => setShowFamilyAppsInSidebar((v) => !v)}
      />
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#09090B] text-zinc-100">
      {/* ─────────────── [PC/데스크톱 lg+] 노션형 좌측 접이식 사이드바 (244px) ─────────────── */}
      {!isSidebarCollapsed && !ghostSearchWindowStage && (
        <aside className="hidden lg:block w-[258px] shrink-0 sticky top-0 h-screen z-40">
          {renderSidebarNavigationContent(false)}
        </aside>
      )}

      {/* ─────────────── [모바일 lg 미만] 좌상단 ☰ 터치 시 열리는 슬라이드 드로어 ─────────────── */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex overscroll-contain">
          <div
            onClick={() => setIsMobileDrawerOpen(false)}
            onTouchMove={(e) => e.preventDefault()}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs touch-none"
          />
          <aside className="relative w-[264px] max-w-[82vw] h-full z-10 shadow-2xl overscroll-contain">
            {renderSidebarNavigationContent(true)}
          </aside>
        </div>
      )}

      {/* ─────────────── 우측 메인 도화지(Canvas) 영역 ─────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {ghostSearchWindowStage && !isInsideIframe && (
          <div className="sticky top-0 z-40 h-9 px-3 flex items-center justify-between bg-zinc-900 border-b border-white/15 text-white text-[12px] font-bold">
            <span className="flex items-center gap-1.5">
              <span>👻 귀신검색창</span>
              <span className="text-[11px] text-[#5EEAD4]">
                {ghostSearchWindowStage === 'large'
                  ? '· 크게 (갤러리 1440×900)'
                  : ghostSearchWindowStage === 'medium'
                    ? '· 작게 (검색량 반응형 확장 · 960×640)'
                    : '· 작게 (자율 슬림 · 520px)'}
              </span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleStandaloneGhostSearchLargeMode}
                title="크게(갤러리) / 작게(자율 반응형) 전환"
                className={`px-2.5 py-0.5 rounded cursor-pointer transition-colors ${
                  ghostSearchWindowStage === 'large'
                    ? 'bg-[#2DD4BF] text-zinc-950 font-extrabold'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-[#5EEAD4] font-extrabold border border-[#2DD4BF]/40'
                }`}
              >
                {ghostSearchWindowStage === 'large' ? '⤡ 작게' : '⤢ 크게(갤러리)'}
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    window.close();
                  } catch {
                    /* ignore */
                  }
                }}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        {/* 상단 슬림 바: PC에서는 노션 브레드크럼 + 우상단 고정 앵커(문패/크레딧/테마), 모바일에서는 1줄 5대 라운지 탭 병행 */}
        <header className={`sticky top-0 z-30 backdrop-blur-xl ${ghostSearchWindowStage ? 'hidden' : ''}`}>
          <div
            className={`px-3.5 sm:px-5 md:px-7 py-2 flex flex-col gap-2 border-b transition-colors ${
              themeMode === 'light'
                ? 'bg-white/90 border-[#EAE8E1]'
                : 'bg-[#09090B]/90 border-white/8'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              {/* 좌측: 모바일 ☰ 버튼 / PC 사이드바 열기 버튼 + 현재 위치 브레드크럼 */}
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(true)}
                  title="전체 메뉴 열기"
                  className="lg:hidden w-8 h-8 rounded-lg bg-zinc-900 border border-white/10 text-zinc-300 flex items-center justify-center cursor-pointer shrink-0"
                >
                  ☰
                </button>

                {isSidebarCollapsed && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsSidebarCollapsed(false)}
                      title="좌측 사이드바 펼치기"
                      className="hidden lg:flex px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 text-[12px] font-bold items-center gap-1 cursor-pointer shrink-0"
                    >
                      <span>☰</span>
                      <span>메뉴</span>
                    </button>
                    <GhostiBrandLogo
                      size="desktop"
                      themeMode={themeMode}
                      showBadge={true}
                      onClick={() => {
                        setIsDeviceIntegrationOpen(false);
                        setActiveLoungeType('personal');
                        setDesktopTab('trash');
                        resetToZenCanvas();
                        scrollAppToTop();
                      }}
                      className="hidden lg:inline-flex mr-1"
                    />
                  </>
                )}
                <GhostiBrandLogo
                  size="mobile"
                  themeMode={themeMode}
                  showBadge={true}
                  onClick={() => {
                    setIsDeviceIntegrationOpen(false);
                    setActiveLoungeType('personal');
                    setDesktopTab('trash');
                    resetToZenCanvas();
                    scrollAppToTop();
                  }}
                  className="lg:hidden mr-1"
                />

              </div>

              {/* 우측 상단 심플 앵커: [🕰️ 복원 기록] + 가이드(온보딩 점프) + 공유 아이콘 + 프로필(맨 우측) */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" aria-label="가이드 공유 및 프로필 영역">
                {activeLoungeType === 'personal' && desktopTab === 'trash' && (
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('ghosti_toss_to_monster_chat', {
                          detail: { query: '최근 [복원 기록] 보여줘' },
                        })
                      );
                    }}
                    title="최근 손보기·정리 복원 기록 조회 및 원래대로 1초 되돌리기"
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-extrabold text-[12px] border transition-all cursor-pointer ${
                      themeMode === 'light'
                        ? 'bg-violet-50 border-violet-300 text-violet-800 hover:bg-violet-100'
                        : 'bg-violet-950/70 border-violet-500/40 text-violet-200 hover:bg-violet-900/80'
                    }`}
                  >
                    <span className="text-[13px]">🕰️</span>
                    <span>복원 기록</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('ghosti_navigate_showroom'));
                  }}
                  title="공식 온보딩/가이드 페이지로 이동"
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[12px] transition-all cursor-pointer ${
                    themeMode === 'light'
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-black/5'
                      : 'text-zinc-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="text-[13px]">📖</span>
                  <span>가이드</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const shareText =
                      '귀신같이(Ghosti) | 사진·영상·서류 속 내용까지 1초 만에 꿰뚫어 찾는 1초 AI 내용검색 — 내 폰·PC 속 내용검색·손보기는 언제나 0원, 가족·모임·업무 공유는 방장 한 분만 https://ghosti.sundreamer.app';
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      void navigator.clipboard.writeText(shareText);
                    }
                    useSaySeeStore.setState({
                      lastQuarantineToast: '💌 [앱 공유 링크 복사됨] "초대받은 가족·회원·직원은 언제나 무료입니다" 안내가 클립보드에 준비되었습니다!',
                    });
                  }}
                  title="지인·가족에게 앱 공유하기 (초대받은 가족·회원·직원은 언제나 무료)"
                  className={`flex w-7 h-7 rounded-lg items-center justify-center transition-all cursor-pointer shrink-0 outline-none ${
                    themeMode === 'light'
                      ? 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                      : 'text-zinc-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">share</span>
                </button>

                <GhostiTopRightHubAnchor themeMode={themeMode} />
              </div>
            </div>

            {/* 모바일(lg 미만, 360px 포함) 전용 1줄 라운지 빠른 전환 바 — 1차 출시 3대 메뉴(내 기기 / 사진 공유 / 업무 공유) */}
            <nav className="grid grid-cols-3 lg:hidden gap-1">
              {MOBILE_QUICK_MENUS.map((menu) => {
                const active = resolveQuickMenuId(activeLoungeType) === menu.id;
                return (
                  <button
                    key={menu.id}
                    type="button"
                    onClick={() => {
                      // 이미 사진 공유(패밀리/동호회·동창회) 안에 있으면 현재 하위 선택 유지
                      if (!active) setActiveLoungeType(menu.defaultLounge);
                      setIsDeviceIntegrationOpen(false);
                      setDesktopTab(menu.id === 'personal' ? 'trash' : 'dashboard');
                      resetToZenCanvas();
                    }}
                    className={`py-1.5 px-1 rounded-full font-label-md text-[11.5px] flex items-center justify-center gap-1 transition-all whitespace-nowrap cursor-pointer ${
                      active
                        ? themeMode === 'light'
                          ? 'bg-[#E6F7F5] text-[#0D9488] font-extrabold'
                          : 'bg-zinc-800 text-primary-container font-extrabold'
                        : themeMode === 'light'
                        ? 'bg-slate-100/80 text-slate-600 font-bold'
                        : 'bg-zinc-900/80 text-zinc-400 font-bold'
                    }`}
                  >
                    <MainLoungeMonoIcon id={menu.iconId} className="w-[12px] h-[12px] shrink-0" />
                    <span>{menu.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* 모바일 전용: 사진 공유 하위 선택 (패밀리 ↔ 동호회·동창회) */}
            {resolveQuickMenuId(activeLoungeType) === 'photo_share' && (
              <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto no-scrollbar">
                {PHOTO_SHARE_GROUPS.map((group) => {
                  const groupActive = activeLoungeType === group.id;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        if (groupActive) return;
                        setActiveLoungeType(group.id);
                        setDesktopTab('dashboard');
                        resetToZenCanvas();
                      }}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                        groupActive
                          ? themeMode === 'light'
                            ? 'bg-white border-[#0D9488] text-[#0D9488] font-extrabold'
                            : 'bg-zinc-900 border-primary-container text-primary-container font-extrabold'
                          : themeMode === 'light'
                          ? 'bg-transparent border-[#E5E0D5] text-slate-500 font-bold'
                          : 'bg-transparent border-white/10 text-zinc-400 font-bold'
                      }`}
                    >
                      {group.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </header>

        {/* ─────────────── 공유 라운지(패밀리 / 동호회·동창회 / 업무 공유) 본문 상단 우측 통합 탭 바 ─────────────── */}
        {activeLoungeType !== 'personal' && (
          <div className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 md:px-10 pt-5 pb-1 flex flex-wrap items-center justify-between gap-3">
            {/* 좌측: 패밀리일 때는 우리집 / 본가 / 처가 방 선택 알약, 그 외에는 라운지 타이틀 */}
            <div className="flex flex-wrap items-center gap-1.5">
              {activeLoungeType === 'family' ? (
                FAMILY_ROOMS.map((room) => {
                  const roomActive = activeFamilyRoom === room;
                  return (
                    <button
                      key={room}
                      type="button"
                      onClick={() => {
                        setActiveFamilyRoom(room);
                        if (desktopTab !== 'dashboard') setDesktopTab('dashboard');
                      }}
                      className={`px-3.5 py-1.5 rounded-full font-label-sm text-[13px] font-extrabold border transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                        roomActive && desktopTab === 'dashboard'
                          ? 'bg-[#0D9488] text-white border-[#0D9488] shadow-xs'
                          : themeMode === 'light'
                          ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          : 'bg-zinc-900 text-zinc-300 border-white/10 hover:bg-zinc-800'
                      }`}
                    >
                      {room === '우리집'
                        ? '🏠 우리집'
                        : room === '본가(친가)'
                        ? '🏡 본가(친가)'
                        : '🌸 처가(친정)'}
                    </button>
                  );
                })
              ) : (
                <button
                  type="button"
                  onClick={() => setDesktopTab('dashboard')}
                  className={`px-3.5 py-1.5 rounded-full font-label-sm text-[13px] font-extrabold border transition-all cursor-pointer ${
                    desktopTab === 'dashboard'
                      ? 'bg-[#0D9488] text-white border-[#0D9488] shadow-xs'
                      : themeMode === 'light'
                      ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      : 'bg-zinc-900 text-zinc-300 border-white/10 hover:bg-zinc-800'
                  }`}
                >
                  {activeLoungeType === 'work'
                    ? '📂 업무 공유(S:) 메인'
                    : activeLoungeType === 'club'
                    ? '⛰️ 동호회·모임 앨범 홈'
                    : '🎓 동창회 앨범 홈'}
                </button>
              )}
            </div>

            {/* 우측: 해당 공유방의 서브메뉴 버튼들 (공유 시작 / 새 사진 정리함 / 초대 & 방 관리) */}
            <div className="flex flex-wrap items-center gap-1.5 ml-auto">
              {currentSubmenus
                .filter((sub) => sub.id !== 'dashboard' && !(sub.id === 'trial' && isCurrentLoungeSubscribed))
                .map((sub) => {
                  const isSubActive = desktopTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setDesktopTab(sub.id)}
                      className={`px-3.5 py-1.5 rounded-full font-label-sm text-[12.5px] font-extrabold border transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        isSubActive
                          ? 'bg-[#0D9488] text-white border-[#0D9488] shadow-xs'
                          : themeMode === 'light'
                          ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          : 'bg-zinc-900 text-zinc-300 border-white/10 hover:bg-zinc-800'
                      }`}
                    >
                      <span className="grayscale opacity-80 text-[12px]">{sub.icon}</span>
                      <span>{sub.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* ─────────────── 💬 카톡 인앱 무가입 1초 프리뷰 (Guest Preview) 샌드박스 & 4대 행동 트리거 바 (패밀리/소모임·동호·동창회 공유방 전용) ─────────────── */}
        {(activeLoungeType === 'family' || activeLoungeType === 'club' || activeLoungeType === 'student') && (
          <div className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 md:px-10 pt-2">
            <div
              className={`px-3.5 py-2.5 rounded-2xl border flex flex-wrap items-center justify-between gap-2.5 transition-all ${
                isGuestPreviewMode
                  ? 'bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-zinc-900 border-amber-400/50'
                  : themeMode === 'light'
                  ? 'bg-slate-50 border-slate-200/90'
                  : 'bg-zinc-900/70 border-white/10'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsGuestPreviewMode(!isGuestPreviewMode)}
                  className={`px-2.5 py-1 rounded-lg font-label-sm text-[11.5px] font-extrabold cursor-pointer transition-all ${
                    isGuestPreviewMode
                      ? 'bg-[#FEE500] text-[#191919] shadow-xs'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-400/30'
                  }`}
                >
                  {isGuestPreviewMode
                    ? '💬 카톡 무가입 1초 프리뷰 모드 ON (13KB 썸네일 구경 중)'
                    : '💬 카톡 단톡방 무가입 1초 프리뷰 체험하기'}
                </button>
                <span className="text-[11.5px] text-zinc-300">
                  {isGuestPreviewMode
                    ? '로그인 없이 0.5초 만에 사진 피드·얼굴 문패·0.04초 검색을 구경 중입니다! 아래 4가지 행동 클릭 시 1초 합류 창이 열립니다.'
                    : '단톡방 초대 링크 터치 시 로그인 창 없이 0.5초 만에 사진 바둑판과 친구 얼굴 아바타를 먼저 보여주는 무가입 프리뷰 퍼널입니다.'}
                </span>
              </div>

              {isGuestPreviewMode && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: '🎯 내 얼굴 사진 1초 찾기', reason: '🎯 내 얼굴이 나온 사진만 1초 만에 다 찾기' },
                    { label: '📥 고화질 원본(5MB) 저장', reason: '📥 이 사진 고화질 원본(5MB) 내 폰에 저장하기' },
                    { label: '❤️ 하트 / 💬 댓글 달기', reason: '❤️ 하트 누르기 / 💬 댓글("야 이거 누구야ㅋㅋ") 달기' },
                    { label: '📸 내 폰 사진 같이 올리기', reason: '📸 내 폰에 있는 그날 사진도 같이 올리기' },
                  ].map((trig) => (
                    <button
                      key={trig.label}
                      type="button"
                      onClick={() => triggerGuestJoinWall(trig.reason)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-950/90 hover:bg-zinc-800 border border-amber-400/40 text-amber-200 text-[11px] font-bold cursor-pointer"
                    >
                      {trig.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─────────────── 서브메뉴 1번: ✨ 1초 진단 & 공유 시작 (정식 구독 시 Auto-Hide) ─────────────── */}
        {desktopTab === 'trial' && (
          <GhostSecretaryFirstGuard>
            <LoungeView />
          </GhostSecretaryFirstGuard>
        )}

        {/* ─────────────── 서브메뉴 2번: 노션형 백지 도화지(Zen Canvas) & 점진적 결과 펼침 ─────────────── */}
        {desktopTab === 'dashboard' &&
          (activeLoungeType === 'personal' && isStage1MinimalPreview ? (
            // [v1.3] 웹 검색 입력창 폐지 → 소환술 수련 + 귀신검색 도장깨기(가상 모니터 안 귀신검색창 = 기존 찾기 UI 100% 승계)
            <GhostSearchTrainingPage />
          ) : activeLoungeType === 'personal' && ghostSearchWindowStage ? (
            <Stage1MinimalSearchPreview
              initialQuery={
                typeof window !== 'undefined'
                  ? new URLSearchParams(window.location.search).get('q') || ''
                  : ''
              }
            />
          ) : (
            <GhostSecretaryFirstGuard>
              <main className="flex-1 w-full max-w-[1320px] mx-auto px-4 sm:px-6 md:px-10 py-6 sm:py-8 flex flex-col gap-6">
            {activeLoungeType === 'work' ? (
              <LoungeFeedContextBanner />
            ) : (
              <>
                {/* 상단 검색 프레임: 폭과 위치를 항상 고정하여 검색/탭 전환 시 화면 흔들림 원천 차단 */}
                <div className="w-full flex flex-col gap-3">
                  {/* 도화지 타이틀 헤더 */}
                  <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                    <div className="flex items-center gap-2.5">
                      <h1 className="font-headline-md text-[20px] md:text-[24px] text-white font-extrabold tracking-tight">
                        {activeLoungeType === 'personal'
                          ? '🔍 내 기기 1초 AI 내용검색'
                          : activeLoungeType === 'family'
                          ? `👨‍👩‍👧‍👦 ${activeFamilyRoom} 패밀리 앨범`
                          : activeLoungeType === 'club'
                          ? '⛰️ 동호회·모임 추억 & 원본 보관함'
                          : '🎓 동창회 추억 & 원본 보관함'}
                      </h1>
                    </div>
                  </div>

                  {/* 라운지별 인물 시드 알약 & 컨트롤 바 (개인 라운지에서는 불필요한 모니터 버튼 숨김) */}
                  <LoungeFeedContextBanner />

                  {/* 보더리스 통합 검색창 + [사진/동영상/문서] 캡슐 + 연결/인덱싱 상태 바 */}
                  <VoiceHeroStage />
                </div>

                {/* 검색을 실행했거나 [전체 펼치기]를 눌렀을 때만 도화지 아래로 채워지는 결과 영역 */}
                {showCanvasResults && (
                  <div id="ghosti-search-results" className="scroll-mt-20">
                    {searchSpace === 'video' ? (
              <section className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-bold">
                      {hasExecutedUserSearch && activeQuery
                        ? `“${activeQuery}” 동영상 장면 검색 결과`
                        : '전체 동영상 목록'}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-medium">
                      {hasExecutedUserSearch && activeQuery
                        ? `${matchedVideoScenes.length}개 영상 · 포착된 장면부터 즉시 재생`
                        : `총 ${matchedVideoScenes.length}개 영상`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {matchedVideoScenes.length < videoSceneItems.length && (
                      <button
                        onClick={() => resetSearchSpaceToAll('video')}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-primary-container font-label-sm text-[12px] font-bold border border-white/10"
                      >
                        동영상 {videoSceneItems.length}개 전체 보기
                      </button>
                    )}
                    <button
                      onClick={() => void openLocalFolder('photos')}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-label-sm text-[12px] font-medium border border-white/10 flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[15px]">folder_open</span>
                      <span>원본 폴더 열기</span>
                    </button>
                  </div>
                </div>

                {matchedVideoScenes.length === 0 ? (
                  <div className="p-10 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col items-center justify-center text-center gap-3">
                    <span className="material-symbols-outlined text-zinc-500 text-[34px]">
                      videocam_off
                    </span>
                    <h3 className="font-headline-sm text-[16px] text-white font-bold">
                      “{activeQuery}” 조건과 일치하는 동영상 타임라인 구간이 없습니다 (0건)
                    </h3>
                    <p className="font-body-sm text-[12.5px] text-zinc-400 max-w-lg">
                      검색어 팩트와 무관한 동영상을 억지로 끼워 넣지 않습니다. 상단 탭에서 <strong>사진 ({searchResults.length})</strong>이나 <strong>문서 ({matchedLocalDocs.length + matchedVaultPhotos.length})</strong> 결과를 확인하거나, 아래 버튼을 눌러 전체 동영상을 확인해 보세요.
                    </p>
                    <button
                      type="button"
                      onClick={() => resetSearchSpaceToAll('video')}
                      className="mt-1 px-4 py-2 rounded-lg bg-primary-container text-zinc-950 font-label-md text-[12.5px] font-extrabold"
                    >
                      동영상 {videoSceneItems.length}개 전 구간 전체 보기
                    </button>
                  </div>
                ) : (
                  /* 컴팩트 화면에서는 좌우 스와이프(Carousel), 데스크톱에서는 깔끔한 카드 그리드 */
                  <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1">
                    {matchedVideoScenes.map((vid) => {
                      const cardThumbUrl = resolveVideoCardThumbUrl(vid);
                      const cleanTs = cleanVideoTimestampLabel(vid.matchedTimestamp);
                      return (
                      <article
                        key={vid.id}
                        onClick={() => setSelectedVideoModal(vid, vid.matchedSeekSec)}
                        className="min-w-[85%] sm:min-w-[340px] md:min-w-0 snap-center group rounded-2xl overflow-hidden bg-[#18181B] hover:bg-zinc-900 border border-white/10 hover:border-white/25 flex flex-col cursor-pointer transition-all"
                      >
                        <div className="relative aspect-video w-full overflow-hidden bg-black">
                          {cardThumbUrl ? (
                            <img
                              key={cardThumbUrl}
                              src={cardThumbUrl}
                              alt={vid.title}
                              loading="lazy"
                              onLoad={(e) => {
                                (e.currentTarget as HTMLElement).style.display = '';
                              }}
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                              className="w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-500 gap-1.5 p-4 text-center">
                              <span className="material-symbols-outlined text-3xl text-zinc-400">movie</span>
                              <span className="text-[11px] font-medium text-zinc-400 truncate max-w-[80%]">{vid.title}</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <div className="w-11 h-11 rounded-full bg-black/75 border border-white/20 text-white flex items-center justify-center group-hover:bg-primary-container group-hover:text-zinc-950 group-hover:border-primary-container transition-all">
                              <span className="material-symbols-outlined text-[26px]">play_arrow</span>
                            </div>
                          </div>

                          {hasExecutedUserSearch && activeQuery && (
                            <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-zinc-950/90 backdrop-blur-md border border-primary-container/50 text-primary-container font-label-mono text-[11px] font-bold">
                              🎯 {cleanTs} 장면 포착
                            </div>
                          )}

                          <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-md bg-zinc-950/90 backdrop-blur-md border border-white/15 text-white font-label-mono text-[11px] font-extrabold shadow-md">
                            ⏱️ {vid.durationText}
                          </div>

                          <div className="absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex items-center justify-between gap-2">
                            <span className="font-label-mono text-[11px] text-zinc-200 font-medium truncate">
                              {vid.locationKo} • {vid.videoFileName} ({vid.sizeMB}MB)
                            </span>
                            <span className="px-2 py-0.5 rounded bg-black/85 border border-white/20 font-label-mono text-[11px] text-emerald-300 font-extrabold shrink-0">
                              ▶ {vid.durationText}
                            </span>
                          </div>
                        </div>

                        <div className="p-4 flex flex-col gap-2.5 flex-1 justify-between">
                          <div className="flex flex-col gap-2">
                            <h3 className="font-headline-sm text-[15px] text-white font-bold group-hover:text-primary-container transition-colors">
                              {renderHighlightedDocText(
                                vid.title,
                                hasExecutedUserSearch ? activeQuery : ''
                              )}
                            </h3>

                            {hasExecutedUserSearch && activeQuery && (
                              <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-primary-container/30">
                                <p className="font-body-sm text-[12px] text-zinc-200 leading-snug line-clamp-2">
                                  {renderHighlightedDocText(
                                    vid.matchedFrameCaption,
                                    activeQuery
                                  )}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/10 font-label-mono text-[11px] text-zinc-400">
                            <span>{vid.date}</span>
                            <span className="text-primary-container font-bold">
                              {hasExecutedUserSearch && activeQuery
                                ? `▶ ${cleanTs} 바로 재생 →`
                                : '▶ 재생 →'}
                            </span>
                          </div>
                        </div>
                      </article>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : searchSpace === 'vault' ? (
              <section className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-bold">
                      {hasExecutedUserSearch && activeQuery
                        ? `“${activeQuery}” 스마트 서류함 검색 결과`
                        : '전체 문서·서류 목록'}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-medium">
                      {matchedVaultPhotos.length > 0
                        ? `로컬 문서 ${matchedLocalDocs.length}건 + 촬영 서류 ${matchedVaultPhotos.length}장`
                        : `실생활 필수 문서 ${matchedLocalDocs.length}건 · 별표(***) 가림 없이 1초 복사`}
                    </span>
                  </div>

                  <button
                    onClick={() => void openLocalFolder('docs')}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-label-sm text-[12px] font-medium border border-white/10 flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[15px]">folder_open</span>
                    <span>내 PC 문서 폴더 열기</span>
                  </button>
                </div>

                {/* (1) 로컬 PDF / TXT / DOCX 문서 파일 그리드 (3x2 그리드) */}
                {hasExecutedUserSearch &&
                  activeQuery &&
                  matchedLocalDocs.length > 0 &&
                  matchedLocalDocs.every((d) => d.matchType === 'SIMILAR') && (
                    <div className="px-4 py-3 rounded-2xl bg-amber-500/15 border border-amber-400/50 text-amber-200 font-label-md text-[13px] font-extrabold flex items-center gap-2">
                      <span>
                        {matchedLocalDocs[0].similarityNoticeKo ||
                          '💡 검색어와 100% 일치하는 문서가 없어 유사한 문서를 찾았습니다!'}
                      </span>
                    </div>
                  )}
                {matchedLocalDocs.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pb-1">
                      {matchedLocalDocs.map((doc) => (
                        <article
                          key={doc.id}
                          onClick={() => setSelectedDocModal(doc)}
                          className="min-w-[85%] sm:min-w-[320px] md:min-w-0 snap-center group p-4 rounded-2xl bg-[#18181B] hover:bg-zinc-900 border border-white/10 hover:border-white/25 flex flex-col justify-between gap-3 cursor-pointer transition-all"
                        >
                          <div className="flex flex-col gap-2">
                            {hasExecutedUserSearch && doc.matchType === 'SIMILAR' && (
                              <div className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-300 font-label-sm text-[11px] font-extrabold">
                                {doc.similarityNoticeKo || '💡 유사한 문서를 찾았습니다!'}
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-zinc-800 border border-white/10 text-amber-400 font-label-mono text-[10px] font-bold">
                                  {doc.ext}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 font-label-sm text-[11px] font-medium">
                                  {doc.categoryBadge}
                                </span>
                              </div>
                              <span className="font-label-mono text-[10px] text-zinc-500">
                                {doc.deviceSource}
                              </span>
                            </div>

                            <h4 className="font-headline-sm text-[15px] text-white font-bold group-hover:text-primary-container transition-colors">
                              {renderHighlightedDocText(
                                doc.title,
                                hasExecutedUserSearch ? activeQuery : ''
                              )}
                            </h4>

                            <p className="font-body-sm text-[12px] text-zinc-400 line-clamp-2 leading-relaxed bg-zinc-950/80 p-2.5 rounded-xl border border-white/5">
                              {renderHighlightedDocText(
                                doc.extractedText,
                                hasExecutedUserSearch ? activeQuery : ''
                              )}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/10 font-label-mono text-[11px] text-zinc-400 gap-2">
                            <span>{doc.date}</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void navigator.clipboard?.writeText(doc.extractedText);
                                  useSaySeeStore.setState({
                                    lastQuarantineToast: `📋 복사 완료! [${doc.title}] 본문/계정 정보가 별표(***) 가림 없이 즉시 복사되었습니다.`,
                                  });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-300 font-label-sm text-[11.5px] font-extrabold transition-colors cursor-pointer"
                              >
                                📋 복사
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void executeRealOsAction('open_file_search', doc.path || doc.fileName).then((res) => {
                                    useSaySeeStore.setState({
                                      lastQuarantineToast: res.summaryKo || `📂 탐색기에서 [${doc.fileName}] 파일을 바로 띄웠습니다.`,
                                    });
                                  });
                                }}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-300 font-label-sm text-[11.5px] font-extrabold transition-colors cursor-pointer"
                              >
                                🔍 이 파일 바로 띄우기
                              </button>
                              <span className="text-primary-container font-bold">본문 →</span>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                {/* (2) 사진첩 속 촬영 서류 그리드 (촬영 서류가 있을 때만 표시) */}
                {matchedVaultPhotos.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <span className="font-label-md text-[13px] text-zinc-400 font-semibold px-0.5">
                      갤러리 내 촬영·캡처 서류 자산 ({matchedVaultPhotos.length}장)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                      {matchedVaultPhotos.map((item) => (
                        <article
                          key={item.photo.id}
                          onClick={() => setSelectedPhoto(item.photo, null)}
                          className="group relative rounded-2xl overflow-hidden bg-[#18181B] border border-white/10 hover:border-white/25 flex flex-col cursor-pointer transition-all"
                        >
                          <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-950">
                            <img
                              src={item.photo.thumbUrl}
                              alt={item.photo.name}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />

                            <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-zinc-950/85 backdrop-blur-md border border-white/15 text-zinc-200 font-label-sm text-[10.5px] font-semibold">
                              {item.photo.vaultCategoryLabel || item.photo.tags[0] || '촬영 서류'}
                            </div>

                            <div className="absolute inset-x-0 bottom-0 h-[22%] min-h-[44px] px-3 pb-2 pt-4 bg-gradient-to-t from-black/90 via-black/55 to-transparent flex items-end justify-between pointer-events-none">
                              <span className="font-label-sm text-[11.5px] font-semibold text-white whitespace-nowrap shrink-0">
                                {item.photo.date.split(' ')[0]}
                              </span>
                              <span className="font-label-sm text-[11px] font-medium text-zinc-300 truncate ml-2">
                                {item.photo.tags[0]}
                              </span>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            ) : (
              /* [🖼️ 전체 갤러리] 모드 */
              <section className="flex flex-col gap-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-bold">
                      {hasExecutedUserSearch && activeQuery
                        ? `“${activeQuery}” 검색 결과`
                        : '전체 사진 목록'}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-medium">
                      총 {searchResults.length}장
                      {groupBurstsInSearch && collapsedBurstCount > 0
                        ? ' · 연사 묶음 1세트 포함'
                        : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => setGroupBurstsInSearch(!groupBurstsInSearch)}
                      className={`px-3 py-1.5 rounded-lg font-label-sm text-[12px] font-medium flex items-center gap-1.5 border transition-all ${
                        groupBurstsInSearch
                          ? 'bg-zinc-900 border-white/20 text-white'
                          : 'bg-zinc-950 border-white/10 text-zinc-400'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[15px]">burst_mode</span>
                      <span>
                        {groupBurstsInSearch ? '❐ 동일 연사 묶어보기 ON' : '연사 전체 펼쳐보기'}
                      </span>
                    </button>
                  </div>
                </div>

                {groupedResults.length > 0 ? (
                  <div
                    className={
                      groupedResults.length <= 16
                        ? 'grid grid-cols-2 sm:grid-cols-4 gap-3.5'
                        : 'grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5'
                    }
                  >
                    {groupedResults.map((group) => {
                      const item = group.representative;
                      const isBurst = group.burstCount >= 2;
                      return (
                        <article
                          key={item.photo.id}
                          onClick={() =>
                            setSelectedPhoto(item.photo, isBurst ? group.burstPhotos : null)
                          }
                          className="group relative rounded-2xl overflow-hidden bg-[#18181B] border border-white/10 hover:border-white/25 transition-all cursor-pointer flex flex-col"
                        >
                          <div
                            className={`relative ${
                              groupedResults.length <= 16 ? 'aspect-[4/3]' : 'aspect-[4/5]'
                            } w-full overflow-hidden bg-zinc-950`}
                          >
                            <img
                              src={item.photo.thumbUrl}
                              alt={item.photo.name}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />

                            {isBurst && (
                              <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-zinc-950/85 backdrop-blur-md border border-white/15 text-primary-container font-label-sm text-[10.5px] font-bold flex items-center gap-1">
                                <span>❐ {group.burstCount}장 연사</span>
                              </div>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleBookmark(item.photo.id);
                              }}
                              aria-label="즐겨찾기"
                              title={item.photo.bookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                              className={`absolute top-2.5 right-2.5 w-7.5 h-7.5 rounded-full backdrop-blur-md flex items-center justify-center transition-all cursor-pointer ${
                                item.photo.bookmarked
                                  ? 'bg-red-600/95 text-white ring-2 ring-white/80 shadow-md scale-105'
                                  : 'bg-black/60 text-white/85 hover:text-red-400 hover:bg-black/80'
                              }`}
                            >
                              <span
                                className="material-symbols-outlined text-[16px]"
                                style={
                                  item.photo.bookmarked
                                    ? { fontVariationSettings: "'FILL' 1, 'wght' 600" }
                                    : undefined
                                }
                              >
                                favorite
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOcrModalPhoto(item.photo);
                              }}
                              title="이 사진에서 글자·표·원하는 단어 조각(칩)만 바로 따내기 (창 UI ③)"
                              className="absolute bottom-10 right-2.5 z-10 px-2.5 py-1 rounded-lg bg-zinc-950/90 hover:bg-teal-400 text-teal-200 hover:text-zinc-950 border border-teal-400/60 font-label-sm text-[11px] font-black shadow-md transition-all cursor-pointer"
                            >
                              📝 OCR 글자 따기
                            </button>

                            <div className="absolute inset-x-0 bottom-0 h-[22%] min-h-[44px] px-3 pb-2.5 pt-4 bg-gradient-to-t from-black/90 via-black/55 to-transparent flex items-end justify-between gap-2 pointer-events-none">
                              <span className="font-label-sm text-[11.5px] font-semibold text-white whitespace-nowrap shrink-0">
                                {item.photo.date.split(' ')[0]}
                              </span>
                              {item.photo.tags[0] && (
                                <span className="font-label-sm text-[11.5px] font-bold text-primary-container truncate">
                                  {item.photo.tags[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-14 rounded-2xl bg-[#18181B] border border-white/10 text-center flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-zinc-500 text-[36px]">
                      image_search
                    </span>
                    <p className="font-headline-sm text-[15px] text-zinc-300 font-semibold">
                      일치하는 사진을 찾지 못했습니다. 다른 문장이나 단어로 검색해 보세요.
                    </p>
                  </div>
                )}
              </section>
            )}
          </div>
          )}
            </>
          )}
        </main>
            </GhostSecretaryFirstGuard>
          ))}

      {/* ─────────────── 서브메뉴 3번: 개인은 [AI 클린몬스터], 사진 공유(패밀리·동호·동창회)은 [⏳ AI 인덱싱 대기실] ─────────────── */}
      {desktopTab === 'trash' &&
        (activeLoungeType === 'personal' ? (
          isStage1MinimalPreview ? (
            <Stage1MinimalCarePreview />
          ) : (
            <GhostSecretaryFirstGuard>
              <SmartTrashView />
            </GhostSecretaryFirstGuard>
          )
        ) : (
          <GhostSecretaryFirstGuard>
            <LoungeIndexingWaitingRoom />
          </GhostSecretaryFirstGuard>
        ))}

      {/* ─────────────── 서브메뉴 4번: 내 기기 통합 (내 기기 연결 & 귀신창 Ctrl+0) / 공유방 관리 ─────────────── */}
      {desktopTab === 'sync' && (
        <main className="flex-1 w-full max-w-[1640px] mx-auto px-5 md:px-8 py-7 flex flex-col gap-4">
          {activeLoungeType === 'personal' && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex p-1 rounded-2xl bg-zinc-900 border border-white/10 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveIntegrationSubTab('devices')}
                  className={`px-4 py-2 rounded-xl font-label-sm text-[13px] font-extrabold transition-all cursor-pointer ${
                    activeIntegrationSubTab === 'devices'
                      ? 'bg-primary-container text-zinc-950 shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  🔗 내 기기 연결 (PC↔폰)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIntegrationSubTab('superpower')}
                  className={`px-4 py-2 rounded-xl font-label-sm text-[13px] font-extrabold transition-all cursor-pointer ${
                    activeIntegrationSubTab === 'superpower'
                      ? 'bg-amber-400 text-zinc-950 shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  ⚡ 귀신창 (Ctrl+0)
                </button>
              </div>
            </div>
          )}

          <GhostSecretaryFirstGuard>
            {activeLoungeType === 'personal' && activeIntegrationSubTab === 'superpower' ? (
            <div className="flex flex-col gap-6">
              {/* [공문 2053 · v1.3 3순위] ⚡ 귀신창 초능력 상시 연습장 = 🥋 초능력 도장깨기 체험관 */}
              {ghostWindowTier === 'pc_free' && <GhostSuperpowerDojo variant="full" />}
              <GhostWindowThreeStageMockup
                activeTier={ghostWindowTier}
                onTierChange={setGhostWindowTier}
                initialWindowTab={ghostWindowInitialTab}
              />
              
            </div>
          ) : activeLoungeType === 'personal' ? (
            <>
              <LoungeCustomSettingsHeader />
              {/* [결함 3 해결] 하단 거대 중복 아코디언 2개 및 중복 폴더 카운트를 걷어내고 1줄 안심 배너만 유지 */}
              <div className="px-4 py-3 rounded-xl bg-zinc-900/80 border border-emerald-500/30 flex items-center justify-between gap-2 text-[12.5px] text-emerald-300 font-bold">
                <span>
                  🔒 내 사진·문서는 외부 서버 저장 없이 내 기기 간에만 암호화 직결되며, 탈퇴 시 흔적 없이 즉시 소멸됩니다.
                </span>
              </div>
            </>
          ) : (
            <>
          {/* 라운지별 전용 상단 설정 섹션 (가족 무수락 초대·강퇴 / 동호·동창회 관리 / 업무 공유(S:) 관리) */}
          <LoungeCustomSettingsHeader />

          {/* 노션 토글 1: 🔄 폰↔PC 프라이빗 싱크 센터 & 내 PC 로컬 폴더 직결 관리 (클릭 시 동적 펼침) */}
          <section className="rounded-2xl bg-[#18181B] border border-white/10 overflow-hidden transition-all">
            <div
              onClick={() => setShowPrivateSyncSection((v) => !v)}
              className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-zinc-900/60 transition-colors select-none"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[12.5px] text-primary-container font-bold">
                  {showPrivateSyncSection ? '▾' : '▸'} 🔄 폰↔PC 프라이빗 싱크 &amp; 로컬 폴더 관리
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 border border-white/10 text-zinc-300 text-[11px] font-bold">
                  {syncState.privateSyncStrategy === 'shadow'
                    ? `모드 B · 폰 용량 99.4% 절약 (${syncState.packSizeMB}MB)`
                    : `모드 A · 100% 원본 미러링 (${syncState.originalSizeGB}GB)`}
                </span>
                <span className="hidden md:inline text-[12px] text-zinc-400">
                  최근 일치화: {syncState.lastSyncedAt}
                </span>
              </div>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  disabled={syncState.syncing}
                  onClick={() => void triggerSyncNow()}
                  className="px-3.5 py-1.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-sm text-[12px] font-extrabold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {syncState.syncing ? '일치화 실행 중...' : '⚡ 지금 일치시키기'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrivateSyncSection((v) => !v)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 text-[13px] font-extrabold select-none shadow-sm cursor-pointer transition-all"
                >
                  {showPrivateSyncSection ? '접기 ▴' : '설정 펼치기 ▾'}
                </button>
              </div>
            </div>

            {showPrivateSyncSection && (
              <div className="px-5 pb-5 pt-3 border-t border-white/10 flex flex-col gap-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* 모드 A */}
                  <div
                    onClick={() => setPrivateSyncStrategy('mirror')}
                    className={`p-5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between gap-4 border ${
                      syncState.privateSyncStrategy === 'mirror'
                        ? 'bg-zinc-900 border-primary-container'
                        : 'bg-zinc-950/70 hover:bg-zinc-900/80 border-white/10'
                    }`}
                  >
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded bg-zinc-800 border border-white/10 text-zinc-300 font-label-sm text-[11.5px] font-semibold">
                          모드 A · 폰 여유 공간이 넉넉할 때
                        </span>
                        <input
                          type="radio"
                          checked={syncState.privateSyncStrategy === 'mirror'}
                          onChange={() => setPrivateSyncStrategy('mirror')}
                          className="w-4 h-4 accent-[#00E5FF]"
                        />
                      </div>

                      <h2 className="font-headline-sm text-[17px] text-white font-bold">
                        🔄 100% 원본 미러링 모드
                      </h2>

                      <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5 font-label-sm text-[12px]">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">내 PC 보관함 용량</span>
                          <span className="text-white font-bold">{syncState.originalSizeGB} GB (원본 100%)</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">내 스마트폰 점유 용량</span>
                          <span className="text-zinc-200 font-bold">{syncState.originalSizeGB} GB (1:1 미러링)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 모드 B */}
                  <div
                    onClick={() => setPrivateSyncStrategy('shadow')}
                    className={`p-5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between gap-4 border ${
                      syncState.privateSyncStrategy === 'shadow'
                        ? 'bg-zinc-900 border-primary-container'
                        : 'bg-zinc-950/70 hover:bg-zinc-900/80 border-white/10'
                    }`}
                  >
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded bg-zinc-800 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold">
                          모드 B · 폰 용량이 부족할 때 (권장)
                        </span>
                        <input
                          type="radio"
                          checked={syncState.privateSyncStrategy === 'shadow'}
                          onChange={() => setPrivateSyncStrategy('shadow')}
                          className="w-4 h-4 accent-[#00E5FF]"
                        />
                      </div>

                      <h2 className="font-headline-sm text-[17px] text-white font-bold">
                        ⚡ 스마트폰 용량 절약 모드 (원본은 PC에 안전 보관)
                      </h2>

                      <div className="p-3 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5 font-label-sm text-[12px]">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">내 PC 하드디스크 (원본 보관)</span>
                          <span className="text-white font-bold">{syncState.originalSizeGB} GB (원본 전체)</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">내 스마트폰 점유 용량 ({photos.length}장)</span>
                          <span className="text-primary-container font-bold">
                            단 {syncState.packSizeMB} MB (99.4% 절약)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-zinc-950/70 border border-white/10 flex flex-col justify-between gap-3">
                    <div className="flex flex-col gap-2">
                      <h3 className="font-headline-sm text-[15px] text-white font-bold">
                        📲 자동 작동 조건 &amp; 즉시 일치화
                      </h3>

                      <label className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/10 flex items-center justify-between gap-3 cursor-pointer">
                        <span className="font-label-md text-[12px] text-zinc-200 font-medium">
                          집/사무실 동일 Wi-Fi 연결 시에만 작동
                        </span>
                        <input
                          type="checkbox"
                          checked={syncState.wifiOnly}
                          onChange={(e) => updateSyncSettings(syncState.mode, e.target.checked)}
                          className="w-4 h-4 accent-[#00E5FF] rounded"
                        />
                      </label>

                      <label className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/10 flex items-center justify-between gap-3 cursor-pointer">
                        <span className="font-label-md text-[12px] text-zinc-200 font-medium">
                          충전 중일 때만 백그라운드 동기화 실행
                        </span>
                        <input
                          type="checkbox"
                          checked={syncState.chargingOnly}
                          onChange={(e) => setChargingOnlySync(e.target.checked)}
                          className="w-4 h-4 accent-[#00E5FF] rounded"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-950/70 border border-white/10 flex flex-col justify-between gap-3">
                    <div className="flex flex-col gap-2.5">
                      <h3 className="font-headline-sm text-[15px] text-white font-bold">
                        📁 내 PC 로컬 폴더 직결 관리
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/10 flex flex-col">
                          <span className="font-body-sm text-[10.5px] text-zinc-400">갤러리 활성</span>
                          <span className="font-headline-sm text-[15px] text-white font-bold">
                            {activePhotos.length}장
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/10 flex flex-col">
                          <span className="font-body-sm text-[10.5px] text-zinc-400">스마트 서류함</span>
                          <span className="font-headline-sm text-[15px] text-white font-bold">
                            {matchedLocalDocs.length + activePhotos.filter((p) => p.isVaultDocument).length}건
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/10 flex flex-col">
                          <span className="font-body-sm text-[10.5px] text-zinc-400">휴지통 이동</span>
                          <span className="font-headline-sm text-[15px] text-white font-bold">
                            {quarantinedPhotos.length}장
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                      <button
                        onClick={() => void openLocalFolder('photos')}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[11.5px] font-medium cursor-pointer"
                      >
                        📂 사진 폴더
                      </button>
                      <button
                        onClick={() => void openLocalFolder('docs')}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[11.5px] font-medium cursor-pointer"
                      >
                        📂 서류함(PDF) 폴더
                      </button>
                      <button
                        onClick={() => void openLocalFolder('quarantine')}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[11.5px] font-medium cursor-pointer"
                      >
                        🗑️ OS 기본 휴지통 열기
                      </button>
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('ghosti_navigate_showroom'));
                        }}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-semibold cursor-pointer"
                      >
                        🔒 보안 · QR 페어링 설정
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 노션 토글 2: 🛡️ 모바일↔PC 연동 가이드 · 탈퇴 데이터 보호 원칙 */}
          <section className="rounded-2xl bg-[#18181B] border border-white/10 overflow-hidden transition-all">
            <div
              onClick={() => setShowPolicyAndStoreSection((v) => !v)}
              className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 cursor-pointer hover:bg-zinc-900/60 transition-colors select-none"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[12.5px] text-emerald-400 font-bold">
                  {showPolicyAndStoreSection ? '▾' : '▸'} 🛡️ 데스크톱 연동 가이드 · 탈퇴 데이터 보호 원칙
                </span>
                <span className="hidden sm:inline text-[12px] text-zinc-400">
                  13KB 썸네일 DB 자체 해결 · 탈퇴 시 내 여권 100% 보존 · 원본 로컬 보관
                </span>
              </div>
              <span className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 text-[13px] font-extrabold select-none shadow-sm cursor-pointer transition-all">
                {showPolicyAndStoreSection ? '접기 ▴' : '펼치기 ▾'}
              </span>
            </div>

            {showPolicyAndStoreSection && (
              <div className="px-5 pb-5 pt-3 border-t border-white/10 flex flex-col gap-4">
                <PcMasterQuickSendPanel />
              </div>
            )}
          </section>
            </>
          )}
          </GhostSecretaryFirstGuard>
        </main>
      )}
      </div>
      <GhostPhotoOcrTeleportModal
        photo={ocrModalPhoto}
        onClose={() => setOcrModalPhoto(null)}
      />
      <GhostSecretaryFirstModal themeMode={themeMode} />
      <MerlinZCoreGuideModal
        isOpen={showZCoreGuideModal}
        onClose={() => {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('ghosti_zcore_prompt_dismissed', '1');
          }
          setShowZCoreGuideModal(false);
        }}
        themeMode={themeMode}
      />

      {/* 💬 카톡 인앱 무가입 1초 프리뷰 — Step 3: [1초 합류] 명분 있는 별명(실명) + 이메일 입력 모달 (Auth-Wall) */}
      {guestJoinWallReason && (
        <div
          onClick={() => triggerGuestJoinWall('')}
          className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-zinc-950 border-2 border-amber-400/60 p-6 shadow-[0_0_50px_rgba(251,191,36,0.25)] flex flex-col gap-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="px-2.5 py-1 rounded-full bg-[#FEE500] text-[#191919] font-label-sm text-[11.5px] font-black">
                💬 카톡 단톡방 1초 합류 (평생 0원)
              </span>
              <button
                type="button"
                onClick={() => useSaySeeStore.setState({ guestJoinWallReason: null })}
                className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="text-[12px] font-extrabold text-amber-300">
                선택하신 기능: [{guestJoinWallReason}]
              </div>
              <h3 className="font-headline-sm text-[18px] text-white font-black leading-snug">
                🔒 외부인 유출 방지 및 고화질 원본 전달을 위해, 이 방에서 쓰실 별명(실명)과 이메일만 입력해 주세요!
              </h3>
              <p className="text-[12px] text-emerald-300 font-bold">
                ✨ 방장님이 초대하신 분은 앱 설치·결제 없이 평생 100% 무료입니다. (각 방에서 입력한 별명·실명 그대로 표시됩니다)
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] text-zinc-300 font-bold">
                  이 방에서 쓰실 별명 또는 실명 (예: 한민수, 박준호)
                </span>
                <input
                  type="text"
                  value={guestNicknameDraft}
                  onChange={(e) => setGuestNicknameDraft(e.target.value)}
                  placeholder="예: 박총무"
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-[13px] font-bold outline-none focus:border-amber-400"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11.5px] text-zinc-300 font-bold">
                  이메일 주소 (고화질 원본 전달 및 내 얼굴 여권 연결용)
                </span>
                <input
                  type="email"
                  value={guestEmailDraft}
                  onChange={(e) => setGuestEmailDraft(e.target.value)}
                  placeholder="예: friend@naver.com"
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-[13px] font-bold outline-none focus:border-amber-400"
                />
              </label>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => completeGuestOneSecJoin(guestNicknameDraft, guestEmailDraft)}
                className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-md text-[13px] font-black cursor-pointer shadow-md"
              >
                🚀 1초 합류하고 고화질 원본·댓글 바로 쓰기 (0원)
              </button>
              <button
                type="button"
                onClick={() => useSaySeeStore.setState({ guestJoinWallReason: null })}
                className="px-3.5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 text-[12px] font-bold cursor-pointer"
              >
                더 구경하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
