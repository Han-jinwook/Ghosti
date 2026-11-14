import React, { useEffect, useMemo, useState } from 'react';
import { useSaySeeStore, type DesktopTab } from '../../store/useSaySeeStore';
import type { FamilyRoomId, LoungeType } from '../../types/saysee';
import { GhostiBrandLogo } from '../../components/GhostiBrandLogo';
import {
  GhostiSidebarBottomFamilyLauncher,
  GhostiTopRightHubAnchor,
} from '../../components/GhostiHubInfraBridge';
import {
  fetchSuperpowerStatus,
  type SuperpowerTrialStatus,
} from '../../components/OnboardingModal';
import {
  resetToZenCanvas,
  scrollAppToTop,
  useDashboardNavStore,
} from './dashboardNavState';

const FAMILY_ROOMS: FamilyRoomId[] = ['우리집', '본가(친가)', '처가(친정)'];

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
    { id: 'dashboard', icon: '🖼️', label: '우리집·가족 앨범 & 검색' },
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

export const DesktopSidebarContainer: React.FC<{
  ghostSearchWindowStage: 'small' | 'medium' | 'large' | null;
}> = ({ ghostSearchWindowStage }) => {
  const {
    desktopTab,
    setDesktopTab,
    activeLoungeType,
    setActiveLoungeType,
    pcAgentPairedMobile,
    activePricingPlan,
    subscribedLounges,
    themeMode,
    merlinAuth,
    isStoreAppMode,
  } = useSaySeeStore();

  const {
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isMobileDrawerOpen,
    setIsMobileDrawerOpen,
    isDeviceIntegrationOpen,
    setIsDeviceIntegrationOpen,
    activeIntegrationSubTab,
    setActiveIntegrationSubTab,
    ghostWindowTier,
    setGhostWindowTier,
    setGhostWindowInitialTab,
  } = useDashboardNavStore();

  const [showFamilyAppsInSidebar, setShowFamilyAppsInSidebar] = useState(false);
  const [superpowerStatus, setSuperpowerStatus] = useState<SuperpowerTrialStatus | null>(null);
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

              {/* [v2.0 1순위] 👻 귀신비서 — 축 A 최초 유입 미끼 1순위 */}
              <button
                type="button"
                onClick={() => {
                  setIsDeviceIntegrationOpen(false);
                  setActiveLoungeType('personal');
                  setDesktopTab('trash');
                  if (isMobileDrawer) setIsMobileDrawerOpen(false);
                  else scrollAppToTop();
                }}
                title="느려진 내 PC·폰, 클릭 한 번에 새것처럼 — 은행 보안프로그램은 안 지우고 재우고, 중복 사진·날아간 문서·깨진 한글 압축까지 광고 없이 1초 만에 해결합니다."
                className={mainBtnClass(isGhostSecretaryActive)}
              >
                <div className="flex flex-col text-left min-w-0 flex-1">
                  <span className="truncate text-[14.5px]">👻 귀신비서</span>
                  <span className="text-[10.5px] opacity-75 font-normal truncate">
                    느려진 내 PC·폰, 클릭 한 번에 새것처럼
                  </span>
                </div>
              </button>

              {/* [v2.0 2순위] 👻 귀신검색 — 축 B 시각 쇼케이스 1순위 (Ctrl+0 / Ctrl+우클릭) */}
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
                title="파일 이름 몰라도, 열지 않고 1초 소환 (Ctrl + 0 / Ctrl + 우클릭) — 계약서 속 숫자·표, 사진 속 글자, 동영상 속 찾던 장면까지 1초 만에 눈앞에 대령합니다."
                className={mainBtnClass(isGhostSearchActive)}
              >
                <div className="flex flex-col text-left min-w-0 flex-1">
                  <span className="truncate text-[14.5px]">👻 귀신검색</span>
                  <span className="text-[10.5px] opacity-75 font-normal truncate">
                    파일 이름 몰라도, 열지 않고 1초 소환
                  </span>
                </div>
              </button>

              {/* [v2.0 3순위] ⚡ 귀신창 — 축 C 일일 습관 락인 (창 전환 제로) */}
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
                  title="하던 일 멈추지 마세요, 쓰던 자리에서 1초면 끝 — 창을 오가며 헤매지 마세요. 영타 자동 변환부터 칸 맞춤 복붙까지 일하던 커서 위에서 바로 끝냅니다."
                  className={mainBtnClass(isPcFreeSuperpowerActive)}
                >
                  <div className="flex flex-col text-left min-w-0 flex-1">
                    <span className="truncate text-[14.5px]">⚡ 귀신창</span>
                    <span className="text-[10.5px] opacity-75 font-normal truncate">
                      하던 일 멈추지 마세요, 쓰던 자리에서 1초면 끝
                    </span>
                  </div>
                </button>
              </div>

              {/* [v2.0 4순위] 📸 사진 공유 — 축 D-무료 가족·모임 바이럴 */}
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
                  title="가족·모임 원본 사진, 만료 없이 평생 0원 — 카톡 30일 만료와 화질 저하 없이, 몇천 장의 추억도 링크 하나로 원본 그대로 모읍니다."
                  className={mainBtnClass(isPhotoShareActive)}
                >
                  <div className="flex flex-col text-left min-w-0 flex-1">
                    <span className="truncate text-[14.5px]">📸 사진 공유</span>
                    <span className="text-[10.5px] opacity-75 font-normal truncate">
                      {isStoreAppMode ? '가족·모임 원본 사진·영상 공유' : '가족·모임 원본 사진, 만료 없이 평생 0원'}
                    </span>
                  </div>
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

              {/* ━━━ 기기 연동 · 팀 확장 (B2B 영업 간판 보호: 제목+1줄 가치 슬로건만 담백 노출 · 복잡 요금표 접힘) ━━━ */}
              <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1 select-none" aria-label="확장 메뉴">
                {!isStoreAppMode && (
                  <div className="px-3 pb-0.5 text-[10px] font-extrabold tracking-tight opacity-60 truncate">
                    클라우드 월세 0원, 내 모든 기기와 팀을 하나로
                  </div>
                )}
                {/* [확장 1 / 5번] 📱 내 기기 통합 */}
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
                        title={
                          isStoreAppMode
                            ? '내 폰과 데스크톱(PC) 대화면을 하나로 직결합니다.'
                            : '카톡 ‘나에게 보내기’ 끝, 내 모든 기기를 하나로 — 매달 내는 클라우드 월세 없이 내 폰·집컴·회사컴을 1초 만에 직결합니다. (30일 무료체험)'
                        }
                        className={mainBtnClass(isPhonePcIntegrationActive)}
                      >
                        <div className="flex flex-col text-left min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[14px]">📱 내 기기 통합</span>
                            {superpowerStatus?.trial_status &&
                              superpowerStatus.trial_status !== 'NOT_STARTED' &&
                              superpowerStatus.trial_status !== 'EXPIRED' &&
                              superpowerStatus.trial_status !== 'EXPIRED_LOCKED' && (
                                <span className="px-1.5 py-0.5 text-[9.5px] font-bold rounded bg-emerald-500/20 text-emerald-400 shrink-0">
                                  ✨ 체험중
                                </span>
                              )}
                          </div>
                          <span className="text-[10.5px] opacity-70 font-normal truncate">
                            {isStoreAppMode
                              ? '내 폰 ↔ 집·회사 PC 대화면 연동'
                              : '카톡 ‘나에게 보내기’ 끝, 내 모든 기기를 하나로'}
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

                {/* [확장 2 / 6번] 💼 업무 공유 (S:) */}
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
                        title={
                          isStoreAppMode
                            ? '사내 팀 문서와 현장 사진을 S: 드라이브 하나로 공유합니다.'
                            : '클라우드 월세 0원, 우리 팀 PC를 S: 드라이브 하나로 — 비싼 서버나 클라우드 구독 없이 사내 문서·현장 사진을 공유 드라이브(S:) 하나로 묶어 1초 만에 찾고 씁니다. (30일 무료체험)'
                        }
                        className={mainBtnClass(isWorkShareActive || isWorkTeamSuperpowerActive)}
                      >
                        <div className="flex flex-col text-left min-w-0 flex-1">
                          <span className="truncate text-[14px]">💼 업무 공유 (S:)</span>
                          <span className="text-[10.5px] opacity-70 font-normal truncate">
                            {isStoreAppMode
                              ? '사내 문서·현장 사진 S: 드라이브 통합'
                              : '클라우드 월세 0원, 우리 팀 PC를 S: 드라이브 하나로'}
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
    <>
      {!isSidebarCollapsed && !ghostSearchWindowStage && (
        <aside className="hidden lg:block w-[258px] shrink-0 sticky top-0 h-screen z-40">
          {renderSidebarNavigationContent(false)}
        </aside>
      )}
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
    </>
  );
};

export const DesktopTopHeaderAndLoungeBar: React.FC<{
  ghostSearchWindowStage: 'small' | 'medium' | 'large' | null;
}> = ({ ghostSearchWindowStage }) => {
  const {
    desktopTab,
    setDesktopTab,
    activeLoungeType,
    setActiveLoungeType,
    subscribedLounges,
    themeMode,
    activeFamilyRoom,
    setActiveFamilyRoom,
    isGuestPreviewMode,
    setIsGuestPreviewMode,
    triggerGuestJoinWall,
  } = useSaySeeStore();

  const {
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    setIsMobileDrawerOpen,
    setIsDeviceIntegrationOpen,
  } = useDashboardNavStore();

  const currentSubmenus = LOUNGE_SUBMENU_CONFIG[activeLoungeType] || LOUNGE_SUBMENU_CONFIG.personal;
  const isCurrentLoungeSubscribed = Boolean(subscribedLounges[activeLoungeType]);

  return (
    <>
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
                    { label: '📥 고화질 원본(5MB) 저장', reason: '📥 이 사진 고화질 원본(5MB) 내 기기에 저장하기' },
                    { label: '❤️ 하트 / 💬 댓글 달기', reason: '❤️ 하트 누르기 / 💬 댓글("와 이 사진 대박!") 달기' },
                    { label: '📸 내 사진 같이 올리기', reason: '📸 이 방에 내 사진·영상 같이 올리기' },
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
    </>
  );
};
