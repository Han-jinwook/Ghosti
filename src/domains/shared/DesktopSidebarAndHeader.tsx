import React, { useEffect, useMemo, useState } from 'react';
import { useSaySeeStore, type DesktopTab } from '../../store/useSaySeeStore';
import type { FamilyRoomId, LoungeType } from '../../types/saysee';
import { GhostiBrandLogo } from '../../components/GhostiBrandLogo';
import {
  GhostiHeaderQuickShareButton,
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
import { readCurrentInviteDisplayMeta } from '../../services/shareInviteDeepLinkBridge';
import { hasAuthenticatedHubAccountSession } from '../../services/supabaseClient';

const FAMILY_ROOMS: FamilyRoomId[] = ['우리집', '본가(친가)', '처가(친정)'];

const SidebarLineIcon: React.FC<{
  kind: 'secretary' | 'search' | 'photo' | 'sync' | 'work';
  className?: string;
}> = ({ kind, className = 'w-[16px] h-[16px] shrink-0' }) => {
  switch (kind) {
    case 'secretary':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'search':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case 'photo':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
        </svg>
      );
    case 'sync':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect width="14" height="10" x="2" y="4" rx="2" />
          <rect width="7" height="12" x="15" y="8" rx="1.5" />
          <path d="M6 18h4" />
        </svg>
      );
    case 'work':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
        </svg>
      );
  }
};

type QuickMenuId = 'personal' | 'photo_share' | 'work';

const MOBILE_QUICK_MENUS: Array<{
  id: QuickMenuId;
  label: string;
  iconKind: 'secretary' | 'photo' | 'work';
  defaultLounge: LoungeType;
}> = [
  { id: 'personal', label: '내 기기', iconKind: 'secretary', defaultLounge: 'personal' },
  { id: 'photo_share', label: '사진 공유', iconKind: 'photo', defaultLounge: 'family' },
  { id: 'work', label: '업무 공유', iconKind: 'work', defaultLounge: 'work' },
];

const PHOTO_SHARE_GROUPS: Array<{ id: LoungeType; label: string }> = [
  { id: 'family', label: '가족' },
  { id: 'club', label: '동호회·모임' },
  { id: 'student', label: '동창회' },
];

const resolveQuickMenuId = (lounge: LoungeType): QuickMenuId =>
  lounge === 'family' || lounge === 'club' || lounge === 'student'
    ? 'photo_share'
    : lounge === 'work'
    ? 'work'
    : 'personal';

const LOUNGE_SUBMENU_CONFIG: Record<
  LoungeType,
  Array<{ id: DesktopTab; label: string }>
> = {
  personal: [
    { id: 'trash', label: '귀신비서' },
    { id: 'dashboard', label: '귀신검색' },
  ],
  family: [
    { id: 'dashboard', label: '앨범' },
    { id: 'trash', label: '정리 대기실' },
    { id: 'sync', label: '방 관리' },
  ],
  club: [
    { id: 'dashboard', label: '앨범' },
    { id: 'trash', label: '정리 대기실' },
    { id: 'sync', label: '방 관리' },
  ],
  student: [
    { id: 'dashboard', label: '앨범' },
    { id: 'trash', label: '정리 대기실' },
    { id: 'sync', label: '방 관리' },
  ],
  work: [
    { id: 'dashboard', label: '문서 검색' },
    { id: 'trash', label: '폴더 보기 (S:)' },
    { id: 'sync', label: '팀 권한 및 서버' },
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

  const isWorkShareAutoExpanded = useMemo(() => {
    const isTeamSubscribed =
      isAuthenticatedUser &&
      (activePricingPlan.startsWith('work_') || Boolean(subscribedLounges.work));
    return Boolean(isTeamSubscribed || isWorkShareManuallyExpanded);
  }, [
    isAuthenticatedUser,
    activePricingPlan,
    subscribedLounges.work,
    isWorkShareManuallyExpanded,
  ]);

  const [isDeviceIntegrationCollapsed, setIsDeviceIntegrationCollapsed] = useState(false);
  const [isWorkShareCollapsed, setIsWorkShareCollapsed] = useState(false);

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

  useEffect(() => {
    const onAutoOpenIntegration = () => {
      toggleDeviceIntegrationExpanded(true);
      setIsDeviceIntegrationOpen(true);
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
    <div className="h-full flex flex-col justify-between px-2.5 py-3 select-none overscroll-contain bg-[#FBFBFA] border-r border-slate-200/80 text-slate-700">
      <div className="flex flex-col gap-3 overflow-y-auto overscroll-contain no-scrollbar">
        {/* 1. 로고 & 접기 */}
        <div className="flex items-center justify-between px-2 py-1 gap-1.5">
          <GhostiBrandLogo
            size="desktop"
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
            className="w-7 h-7 rounded-md hover:bg-black/5 text-slate-400 hover:text-slate-700 flex items-center justify-center text-[13px] cursor-pointer"
          >
            {isMobileDrawer ? '✕' : '«'}
          </button>
        </div>

        {/* 2. 노션형 5단 미니멀 메뉴 */}
        {(() => {
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
          const isPhonePcIntegrationActive =
            (activeLoungeType === 'personal' && desktopTab === 'sync') || isDeviceIntegrationOpen;

          const mainBtnClass = (active: boolean) =>
            `w-full px-2.5 py-1.5 rounded-lg text-[13.5px] flex items-center justify-between gap-2 transition-colors cursor-pointer border ${
              active
                ? 'bg-teal-50/90 text-teal-800 border-teal-200/80 font-semibold'
                : 'border-transparent text-slate-600 hover:text-teal-800 hover:bg-teal-50/40 font-medium'
            }`;

          const subWrapClass = 'ml-4 pl-2.5 border-l border-teal-100 flex flex-col gap-0.5 py-0.5';

          const subBtnClass = (active: boolean) =>
            `w-full px-2.5 py-1.5 rounded-md text-left text-[13px] flex items-center justify-between gap-1.5 transition-colors cursor-pointer ${
              active
                ? 'bg-teal-50/75 text-teal-800 font-semibold'
                : 'text-slate-500 hover:text-teal-800 hover:bg-teal-50/40 font-normal'
            }`;

          const isTrialActive =
            superpowerStatus?.trial_status &&
            superpowerStatus.trial_status !== 'NOT_STARTED' &&
            superpowerStatus.trial_status !== 'EXPIRED' &&
            superpowerStatus.trial_status !== 'EXPIRED_LOCKED';

          return (
            <div className="flex flex-col gap-0.5">
              <div className="px-2.5 pb-1 pt-1 text-[11px] font-medium text-slate-400">
                기본 메뉴
              </div>

              {/* 1. 귀신비서 */}
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
                <span className="flex items-center gap-2.5 min-w-0">
                  <SidebarLineIcon kind="secretary" />
                  <span className="truncate">귀신비서</span>
                </span>
              </button>

              {/* 2. 귀신검색 */}
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
                <span className="flex items-center gap-2.5 min-w-0">
                  <SidebarLineIcon kind="search" />
                  <span className="truncate">귀신검색</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">Ctrl+0</span>
              </button>

              {/* 3. 사진 공유 */}
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
                  <span className="flex items-center gap-2.5 min-w-0">
                    <SidebarLineIcon kind="photo" />
                    <span className="truncate">사진 공유</span>
                  </span>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {isPhotoShareActive ? '▾' : '▸'}
                  </span>
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
                      <span>가족</span>
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
                      <span>동호회·모임</span>
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
                      <span>동창회</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 확장 섹션 */}
              <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-col gap-0.5" aria-label="확장 메뉴">
                <div className="px-2.5 pb-1 text-[11px] font-medium text-slate-400">
                  기기 · 팀 확장
                </div>

                {/* 4. 내 기기 통합 */}
                {(() => {
                  const isDeviceIntegrationExpanded =
                    (isDeviceIntegrationAutoExpanded || isPhonePcIntegrationActive) &&
                    !isDeviceIntegrationCollapsed;
                  return (
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDeviceIntegrationCollapsed(false);
                          toggleDeviceIntegrationExpanded(true);
                          setIsDeviceIntegrationOpen(true);
                          setActiveLoungeType('personal');
                          setDesktopTab('sync');
                          if (isMobileDrawer) setIsMobileDrawerOpen(false);
                          else scrollAppToTop();
                        }}
                        className={mainBtnClass(isPhonePcIntegrationActive)}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <SidebarLineIcon kind="sync" />
                          <span className="truncate">내 기기 통합</span>
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          {isTrialActive ? (
                            <span className="text-[10.5px] text-teal-700 font-medium">체험중</span>
                          ) : !isStoreAppMode ? (
                            <span className="text-[10.5px] text-slate-400 font-medium">Pro</span>
                          ) : null}
                          <span
                            role="button"
                            aria-label={isDeviceIntegrationExpanded ? '접기' : '펼치기'}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isDeviceIntegrationExpanded) {
                                setIsDeviceIntegrationCollapsed(true);
                                toggleDeviceIntegrationExpanded(false);
                              } else {
                                setIsDeviceIntegrationCollapsed(false);
                                toggleDeviceIntegrationExpanded(true);
                              }
                            }}
                            className="text-[11px] text-slate-400 hover:text-slate-700 px-0.5 cursor-pointer"
                          >
                            {isDeviceIntegrationExpanded ? '▾' : '▸'}
                          </span>
                        </span>
                      </button>

                      {isDeviceIntegrationExpanded && (
                        <div className={subWrapClass}>
                          <button
                            type="button"
                            onClick={() => {
                              setIsDeviceIntegrationOpen(true);
                              setActiveLoungeType('personal');
                              setDesktopTab('sync');
                              if (isMobileDrawer) setIsMobileDrawerOpen(false);
                            }}
                            className={subBtnClass(isDeviceIntegrationOpen)}
                          >
                            <span>기기 연결 (PC · 모바일)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 5. 업무 공유 */}
                {(() => {
                  const isWorkShareExpanded =
                    (isWorkShareAutoExpanded || isWorkShareActive) && !isWorkShareCollapsed;
                  return (
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsWorkShareCollapsed(false);
                          toggleWorkShareExpanded(true);
                          setIsDeviceIntegrationOpen(false);
                          setActiveLoungeType('work');
                          setDesktopTab('dashboard');
                          resetToZenCanvas();
                          if (isMobileDrawer) setIsMobileDrawerOpen(false);
                          else scrollAppToTop();
                        }}
                        className={mainBtnClass(isWorkShareActive)}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <SidebarLineIcon kind="work" />
                          <span className="truncate">업무 공유 (S:)</span>
                        </span>
                        <span
                          role="button"
                          aria-label={isWorkShareExpanded ? '접기' : '펼치기'}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isWorkShareExpanded) {
                              setIsWorkShareCollapsed(true);
                              toggleWorkShareExpanded(false);
                            } else {
                              setIsWorkShareCollapsed(false);
                              toggleWorkShareExpanded(true);
                            }
                          }}
                          className="text-[11px] text-slate-400 hover:text-slate-700 shrink-0 px-0.5 cursor-pointer"
                        >
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
                            <span>공용 폴더 (S:)</span>
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

      {/* 3. 패밀리 앱 런처 */}
      <GhostiSidebarBottomFamilyLauncher
        isOpen={showFamilyAppsInSidebar}
        onToggle={() => setShowFamilyAppsInSidebar((v) => !v)}
      />
    </div>
  );

  return (
    <>
      {!isSidebarCollapsed && !ghostSearchWindowStage && (
        <aside className="hidden lg:block w-[240px] shrink-0 sticky top-0 h-screen z-40">
          {renderSidebarNavigationContent(false)}
        </aside>
      )}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex overscroll-contain">
          <div
            onClick={() => setIsMobileDrawerOpen(false)}
            onTouchMove={(e) => e.preventDefault()}
            className="fixed inset-0 bg-black/45 backdrop-blur-xs touch-none"
          />
          <aside className="relative w-[264px] max-w-[85vw] h-full z-10 shadow-xl overscroll-contain">
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
    activeFamilyRoom,
    activeJoinedRoomMeta,
    joinedSharedRooms,
    selectOwnSharedRoom,
    selectJoinedSharedRoom,
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
      <header className={`sticky top-0 z-30 backdrop-blur-md ${ghostSearchWindowStage ? 'hidden' : ''}`}>
        <div className="px-3 sm:px-5 md:px-7 py-2 flex flex-col gap-2 border-b bg-white/95 border-slate-200/80">
          <div className="flex items-center justify-between gap-2 flex-nowrap min-w-0">
            {/* 좌측 */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(true)}
                title="메뉴 열기"
                className="lg:hidden w-8 h-8 rounded-lg border bg-white border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center cursor-pointer shrink-0"
              >
                ☰
              </button>

              {isSidebarCollapsed && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsSidebarCollapsed(false)}
                    title="사이드바 펼치기"
                    className="hidden lg:flex px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-[12px] font-medium items-center gap-1 cursor-pointer shrink-0"
                  >
                    <span>☰</span>
                    <span>메뉴</span>
                  </button>
                  <GhostiBrandLogo
                    size="desktop"
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
                onClick={() => {
                  setIsDeviceIntegrationOpen(false);
                  setActiveLoungeType('personal');
                  setDesktopTab('trash');
                  resetToZenCanvas();
                  scrollAppToTop();
                }}
                className="lg:hidden"
              />
            </div>

            {/* 우측 */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto" aria-label="상단 도구 영역">
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
                  title="최근 정리·수리 복원 기록 보기"
                  className="px-2.5 py-1 rounded-md text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:bg-black/5 whitespace-nowrap transition-colors cursor-pointer shrink-0"
                >
                  복원 기록
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('ghosti_navigate_showroom'));
                }}
                title="온보딩 가이드 보기"
                className="px-2.5 py-1 rounded-md text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:bg-black/5 whitespace-nowrap transition-colors cursor-pointer shrink-0"
              >
                가이드
              </button>

              <GhostiHeaderQuickShareButton />

              <GhostiTopRightHubAnchor />
            </div>
          </div>

          {/* 모바일 빠른 전환 */}
          <nav className="grid grid-cols-3 lg:hidden gap-1">
            {MOBILE_QUICK_MENUS.map((menu) => {
              const active = resolveQuickMenuId(activeLoungeType) === menu.id;
              return (
                <button
                  key={menu.id}
                  type="button"
                  onClick={() => {
                    if (!active) setActiveLoungeType(menu.defaultLounge);
                    setIsDeviceIntegrationOpen(false);
                    setDesktopTab(menu.id === 'personal' ? 'trash' : 'dashboard');
                    resetToZenCanvas();
                  }}
                  className={`py-1.5 px-1 rounded-lg text-[12px] flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-teal-600 text-white font-semibold'
                      : 'bg-slate-100 text-slate-600 font-medium'
                  }`}
                >
                  <SidebarLineIcon kind={menu.iconKind} className="w-[13px] h-[13px] shrink-0" />
                  <span>{menu.label}</span>
                </button>
              );
            })}
          </nav>

          {resolveQuickMenuId(activeLoungeType) === 'photo_share' && (
            <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto no-scrollbar">
              {PHOTO_SHARE_GROUPS.map((group) => {
                const groupActive = !activeJoinedRoomMeta && activeLoungeType === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      if (groupActive) return;
                      selectOwnSharedRoom(group.id);
                      resetToZenCanvas();
                    }}
                    className={`px-2.5 py-1 rounded-md border text-[11.5px] shrink-0 whitespace-nowrap transition-colors cursor-pointer ${
                      groupActive
                        ? 'bg-teal-600 border-teal-600 text-white font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 font-medium'
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

      {/* 공유 라운지 본문 상단 서브탭 */}
      {activeLoungeType !== 'personal' && (
        <div className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 md:px-10 pt-5 pb-1 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {activeLoungeType === 'family' ? (
                FAMILY_ROOMS.map((room) => {
                  const roomActive =
                    !activeJoinedRoomMeta &&
                    activeFamilyRoom === room &&
                    desktopTab === 'dashboard';
                  return (
                    <button
                      key={room}
                      type="button"
                      data-own-room={room}
                      onClick={() => {
                        selectOwnSharedRoom('family', room);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium border transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                        roomActive
                          ? 'bg-teal-600 text-white border-teal-600 font-semibold'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {room}
                    </button>
                  );
                })
              ) : (
                <button
                  type="button"
                  data-own-lounge={activeLoungeType}
                  onClick={() => {
                    if (activeLoungeType === 'work') {
                      setDesktopTab('dashboard');
                    } else {
                      selectOwnSharedRoom(activeLoungeType);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium border transition-colors cursor-pointer ${
                    !activeJoinedRoomMeta && desktopTab === 'dashboard'
                      ? 'bg-teal-600 text-white border-teal-600 font-semibold'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {activeLoungeType === 'work'
                    ? '업무 공유 (S:)'
                    : activeLoungeType === 'club'
                    ? '내 동호회·모임 앨범'
                    : '내 동창회 앨범'}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 ml-auto">
              {currentSubmenus
                .filter((sub) => !(sub.id === 'trial' && isCurrentLoungeSubscribed))
                .map((sub) => {
                  const isSubActive =
                    desktopTab === sub.id ||
                    (sub.id === 'dashboard' && desktopTab === 'trial');
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setDesktopTab(sub.id)}
                      className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                        isSubActive
                          ? 'bg-teal-600 text-white border-teal-600 font-semibold'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {sub.label}
                    </button>
                  );
                })}
            </div>
          </div>

          {activeLoungeType !== 'work' && joinedSharedRooms.length > 0 && (
            <div
              aria-label="초대받은 공유방 목록"
              className="flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-lg border bg-slate-50 border-slate-200"
            >
              <span className="text-[12px] font-medium text-slate-500 shrink-0 whitespace-nowrap mr-1">
                참여 중인 초대방 ({joinedSharedRooms.length})
              </span>
              {joinedSharedRooms.map((jr) => {
                const isJoinedActive =
                  activeJoinedRoomMeta?.roomId === jr.roomId && desktopTab === 'dashboard';
                const shortRoomLabel =
                  jr.loungeType === 'family'
                    ? jr.familyRoom
                    : jr.roomTitle.replace(/^[⛰️🎓🏠🏡🌸\s]+/, '').trim() ||
                      (jr.loungeType === 'club' ? '동호회·모임' : '동창회');
                return (
                  <button
                    key={jr.roomId}
                    type="button"
                    data-joined-room-id={jr.roomId}
                    onClick={() => selectJoinedSharedRoom(jr)}
                    className={`px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                      isJoinedActive
                        ? 'bg-teal-600 text-white border-teal-600 font-semibold'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {jr.masterNickname} · {shortRoomLabel}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 비로그인 초대 링크 열람 배너 */}
      {(activeLoungeType === 'family' || activeLoungeType === 'club' || activeLoungeType === 'student') &&
        isGuestPreviewMode &&
        (() => {
          const inviteMeta = readCurrentInviteDisplayMeta(activeLoungeType, activeFamilyRoom);
          return (
            <div className="w-full max-w-[1320px] mx-auto px-4 sm:px-6 md:px-10 pt-2">
              <div className="px-4 py-2.5 rounded-xl border bg-slate-50 border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] font-semibold text-slate-900">
                    {inviteMeta.inviteToken && !inviteMeta.isHostVerified
                      ? `${inviteMeta.roomTitle} 불러오는 중...`
                      : `${inviteMeta.hostName} 님의 공유방 (${inviteMeta.roomTitle})`}
                  </span>
                  <span className="text-[12px] text-slate-500">
                    로그인 없이 사진을 둘러볼 수 있습니다.
                  </span>
                  {!inviteMeta.hasExplicitUrlInvite && hasAuthenticatedHubAccountSession() && (
                    <button
                      type="button"
                      onClick={() => setIsGuestPreviewMode(false)}
                      className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11.5px] font-medium cursor-pointer"
                    >
                      내 방으로 돌아가기
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: '내 사진 올리기', reason: '내 사진 올리기' },
                    { label: '원본 일괄 저장', reason: '원본 일괄 저장' },
                    { label: '새 사진 알림', reason: '새 사진 알림 받기' },
                  ].map((trig) => (
                    <button
                      key={trig.label}
                      type="button"
                      onClick={() => triggerGuestJoinWall(trig.reason)}
                      className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11.5px] font-medium cursor-pointer"
                    >
                      {trig.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
    </>
  );
};
