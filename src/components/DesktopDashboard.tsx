import React, { useMemo, useState } from 'react';
import { useSaySeeStore, getActivePersonaForCluster, type DesktopTab } from '../store/useSaySeeStore';
import type { FamilyRoomId, GpuHelperTierId, LoungeType } from '../types/saysee';
import { groupBurstSearchResults } from '../services/aiEngine';
import { VoiceHeroStage } from './VoiceHeroStage';
import { SmartTrashView } from './SmartTrashView';
import {
  LoungeCustomSettingsHeader,
  LoungeFeedContextBanner,
  LoungeIndexingWaitingRoom,
  LoungeView,
} from './LoungeView';
import { PcMasterQuickSendPanel } from './PricingModal';

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
    sectionHeader: '💻 내 기기',
    freeBadge: false,
  },
  {
    id: 'family',
    label: '패밀리 (우리집·양가)',
    shortLabel: '패밀리',
    sectionHeader: '📸 사진 공유',
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
    sectionHeader: '💼 업무 공유',
  },
];

const LOUNGE_SUBMENU_CONFIG: Record<
  LoungeType,
  Array<{ id: DesktopTab; label: string; showTrashCount?: boolean }>
> = {
  personal: [
    { id: 'trial', label: '무료체험' },
    { id: 'dashboard', label: '👁️ Z-Eye 투시검색' },
    { id: 'trash', label: '🩺 Z-Eye 클린몬스터', showTrashCount: true },
    { id: 'sync', label: '🛠️ 설정몬스터' },
  ],
  family: [
    { id: 'trial', label: '무료체험' },
    { id: 'dashboard', label: '우리집·본가·처가 앨범' },
    { id: 'trash', label: '새 사진 정리함' },
    { id: 'sync', label: '가족 초대 & 방 관리' },
  ],
  club: [
    { id: 'trial', label: '무료체험' },
    { id: 'dashboard', label: '모임·동창 앨범 & 원본 다운로드' },
    { id: 'trash', label: '새 사진 정리함' },
    { id: 'sync', label: '모임 관리 & 회원 초대' },
  ],
  student: [
    { id: 'trial', label: '무료체험' },
    { id: 'dashboard', label: '타임캡슐 앨범 & 영상 검색' },
    { id: 'trash', label: '새 사진·영상 정리함' },
    { id: 'sync', label: '우리반 관리 & 학생인증' },
  ],
  work: [
    { id: 'trial', label: '무료체험' },
    { id: 'dashboard', label: '업무 문서·현장사진 & S: 드라이브' },
    { id: 'trash', label: '새 업무파일 정리함' },
    { id: 'sync', label: '팀원 권한 & S: 드라이브 연결' },
  ],
};

export const DesktopDashboard: React.FC = () => {
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
  } = useSaySeeStore();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isCanvasExpanded, setIsCanvasExpanded] = useState(false);
  const [showFamilyAppsInSidebar, setShowFamilyAppsInSidebar] = useState(false);

  const showCanvasResults =
    hasExecutedUserSearch || hasUserSelectedSearchTab || isCanvasExpanded;
  const resetToZenCanvas = () => {
    setIsCanvasExpanded(false);
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
    if (!groupBurstsInSearch || searchSpace === 'vault') {
      return searchResults.map((item) => ({
        representative: item,
        burstPhotos: [item.photo],
        burstCount: 1,
      }));
    }
    return groupBurstSearchResults(searchResults);
  }, [searchResults, groupBurstsInSearch, searchSpace]);

  const collapsedBurstCount = searchResults.length - groupedResults.length;
  const currentSubmenus = LOUNGE_SUBMENU_CONFIG[activeLoungeType] || LOUNGE_SUBMENU_CONFIG.personal;
  const isCurrentLoungeSubscribed = Boolean(subscribedLounges[activeLoungeType]);
  const activeLoungeLabel =
    MAIN_LOUNGE_MENUS.find((m) => m.id === activeLoungeType)?.label || '개인 라운지';
  const activeSubmenuLabel =
    (activeLoungeType === 'personal' && desktopTab === 'trial' ? '🧹 클린몬스터 진단' : currentSubmenus.find((s) => s.id === desktopTab)?.label) || '투시검색';

  const renderSidebarNavigationContent = (isMobileDrawer = false) => (
    <div
      className={`h-full flex flex-col justify-between p-3 select-none ${
        themeMode === 'light'
          ? 'bg-[#F8F7F4] border-r border-[#E5E0D5] text-slate-800'
          : 'bg-[#111114] border-r border-white/10 text-zinc-200'
      }`}
    >
      <div className="flex flex-col gap-4 overflow-y-auto no-scrollbar">
        {/* 1. 사이드바 최상단: Z-Eye 로고 & 사이드바 접기 버튼 */}
        <div className="flex items-center justify-between px-1.5 py-1">
          <div
            onClick={() => {
              setDesktopTab('dashboard');
              resetToZenCanvas();
              if (isMobileDrawer) setIsMobileDrawerOpen(false);
            }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div
              className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                themeMode === 'light'
                  ? 'bg-white border-[#E5E0D5] text-[#0D9488]'
                  : 'bg-zinc-900 border-white/15 text-primary-container'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] font-bold">graphic_eq</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`font-headline-sm text-[15.5px] font-extrabold tracking-tight ${
                  themeMode === 'light' ? 'text-slate-900' : 'text-white'
                }`}
              >
                제트아이
              </span>
              <span
                className={`text-[11px] font-extrabold ${
                  themeMode === 'light' ? 'text-teal-700' : 'text-primary-container'
                }`}
              >
                Z-Eye
              </span>
            </div>
          </div>

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

        {/* 2. 3대 전략 메뉴(🆓 내 기기 / 📸 사진 공유 / 💼 업무 공유) & 하위 메뉴 트리 (노션 워크스페이스 스타일) */}
        <div className="flex flex-col gap-1">
          {MAIN_LOUNGE_MENUS.map((menu) => {
            const active = activeLoungeType === menu.id;
            const isLoungeSub = Boolean(subscribedLounges[menu.id]);
            return (
              <div key={menu.id} className="flex flex-col gap-0.5">
                {menu.sectionHeader && (
                  <span className="px-2 pt-2 pb-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-zinc-500">
                    {menu.sectionHeader}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveLoungeType(menu.id);
                    setDesktopTab('dashboard');
                    resetToZenCanvas();
                  }}
                  className={`w-full px-2.5 py-2 rounded-xl font-label-md text-[13px] flex items-center justify-between gap-2 transition-all cursor-pointer ${
                    active
                      ? themeMode === 'light'
                        ? 'bg-[#E6F7F5] text-[#0D9488] font-extrabold'
                        : 'bg-zinc-800/90 text-primary-container font-extrabold'
                      : themeMode === 'light'
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-black/5 font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MainLoungeMonoIcon id={menu.id} className="w-[15px] h-[15px] shrink-0" />
                    <span className="truncate" title={menu.id === 'personal' ? '내 폰·PC 속 클린·설정몬스터 진단과 1초 투시검색' : undefined}>{menu.label}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {menu.freeBadge && !isLoungeSub && (
                      <span className="px-1.5 py-0.2 rounded-full bg-teal-500/15 text-teal-400 text-[9.5px] font-extrabold">
                        0원
                      </span>
                    )}
                    {isLoungeSub && (
                      <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-500 text-[9.5px] font-extrabold">
                        PRO
                      </span>
                    )}
                    <span className="text-[10px] opacity-60">{active ? '▾' : '▸'}</span>
                  </div>
                </button>

                {/* 선택된 라운지의 하위 트리 (노션 페이지 인덴트 구조) */}
                {active && (
                  <div className="ml-4 pl-2.5 border-l border-white/10 flex flex-col gap-0.5 py-0.5">
                    {/* 패밀리 라운지일 때: 우리집 / 본가 / 처가 방 전환 트리 */}
                    {menu.id === 'family' && (
                      <div className="flex flex-col gap-0.5 pb-1 mb-1 border-b border-white/5">
                        {FAMILY_ROOMS.map((room) => {
                          const roomActive =
                            desktopTab === 'dashboard' && activeFamilyRoom === room;
                          return (
                            <button
                              key={room}
                              type="button"
                              onClick={() => {
                                setActiveFamilyRoom(room);
                                setDesktopTab('dashboard');
                                if (isMobileDrawer) setIsMobileDrawerOpen(false);
                              }}
                              className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[12px] flex items-center justify-between transition-colors cursor-pointer ${
                                roomActive
                                  ? 'bg-primary-container/15 text-primary-container font-extrabold'
                                  : 'text-zinc-400 hover:text-white hover:bg-white/5 font-medium'
                              }`}
                            >
                              <span>
                                {room === '우리집'
                                  ? '🏠 우리집'
                                  : room === '본가(친가)'
                                  ? '🏡 본가(친가)'
                                  : '🌸 처가(친정)'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* 해당 라운지의 서브메뉴 트리 */}
                    {currentSubmenus.map((sub) => {
                      if (sub.id === 'trial' && isCurrentLoungeSubscribed) return null;
                      if (
                        activeLoungeType === 'personal' &&
                        sub.id === 'sync' &&
                        isStoreAppMode &&
                        !enableSetupMonster
                      ) {
                        return null;
                      }
                      const isSubActive = desktopTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            setDesktopTab(sub.id);
                            if (isMobileDrawer) setIsMobileDrawerOpen(false);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg text-left text-[12px] flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                            isSubActive
                              ? themeMode === 'light'
                                ? 'bg-[#0D9488]/10 text-[#0D9488] font-extrabold'
                                : 'bg-white/10 text-white font-extrabold'
                              : themeMode === 'light'
                              ? 'text-slate-600 hover:text-slate-900 hover:bg-black/5 font-medium'
                              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 font-medium'
                          }`}
                        >
                          <span className="truncate">{activeLoungeType === 'personal' && sub.id === 'trial' ? '🧹 클린몬스터 진단' : sub.label}</span>
                          {sub.showTrashCount && (
                            <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-mono font-bold shrink-0">
                              {activeTrashCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. 사이드바 하단: 멀린 패밀리 생태계 앱 런처 (확장성 대응) */}
      <div className="pt-3 border-t border-white/10 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setShowFamilyAppsInSidebar((v) => !v)}
          className="w-full px-2.5 py-2 rounded-xl hover:bg-white/5 flex items-center justify-between text-[12px] font-extrabold text-zinc-400 hover:text-white cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md bg-primary-container/20 text-primary-container flex items-center justify-center text-[11px] font-black">
              F
            </span>
            <span>멀린 패밀리 앱</span>
          </span>
          <span className="text-[10px]">{showFamilyAppsInSidebar ? '▾' : '▸'}</span>
        </button>

        {showFamilyAppsInSidebar && (
          <div className="px-2 py-1.5 rounded-xl bg-zinc-950/70 border border-white/5 flex flex-col gap-1 text-[11.5px] text-zinc-400">
            <div className="px-2 py-1 rounded hover:bg-white/5 text-primary-container font-bold flex items-center justify-between">
              <span>⚡ 제트아이 (Z-Eye)</span>
              <span className="text-[9.5px]">현재 앱</span>
            </div>
            <div className="px-2 py-1 rounded hover:bg-white/5 flex items-center justify-between">
              <span>☀️ 썬드리머 (SunDreamer)</span>
              <span className="text-[9.5px] text-zinc-500">SSO 연동</span>
            </div>
            <div className="px-2 py-1 rounded hover:bg-white/5 flex items-center justify-between">
              <span>📝 루미노트 (LumiNote)</span>
              <span className="text-[9.5px] text-zinc-500">SSO 연동</span>
            </div>
            <div className="px-2 py-1 rounded hover:bg-white/5 flex items-center justify-between">
              <span>🍽️ 오늘뭐먹지</span>
              <span className="text-[9.5px] text-zinc-500">SSO 연동</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#09090B] text-zinc-100">
      {/* ─────────────── [PC/데스크톱 lg+] 노션형 좌측 접이식 사이드바 (244px) ─────────────── */}
      {!isSidebarCollapsed && (
        <aside className="hidden lg:block w-[244px] shrink-0 sticky top-0 h-screen z-40">
          {renderSidebarNavigationContent(false)}
        </aside>
      )}

      {/* ─────────────── [모바일 lg 미만] 좌상단 ☰ 터치 시 열리는 슬라이드 드로어 ─────────────── */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            onClick={() => setIsMobileDrawerOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />
          <aside className="relative w-[264px] max-w-[82vw] h-full z-10 shadow-2xl">
            {renderSidebarNavigationContent(true)}
          </aside>
        </div>
      )}

      {/* ─────────────── 우측 메인 도화지(Canvas) 영역 ─────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* 상단 슬림 바: PC에서는 노션 브레드크럼 + 우상단 고정 앵커(문패/크레딧/테마), 모바일에서는 1줄 5대 라운지 탭 병행 */}
        <header className="sticky top-0 z-30 backdrop-blur-xl">
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
                  <button
                    type="button"
                    onClick={() => setIsSidebarCollapsed(false)}
                    title="좌측 사이드바 펼치기"
                    className="hidden lg:flex px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 text-[12px] font-bold items-center gap-1 cursor-pointer shrink-0"
                  >
                    <span>☰</span>
                    <span>메뉴</span>
                  </button>
                )}

                {/* 노션 스타일 상단 경로(Breadcrumb) 표시 */}
                <div className="flex items-center gap-1.5 text-[13px] truncate">
                  <span
                    onClick={() => {
                      setDesktopTab('dashboard');
                      resetToZenCanvas();
                    }}
                    className="font-extrabold text-zinc-200 hover:text-white cursor-pointer truncate"
                  >
                    {activeLoungeLabel}
                  </span>
                  {activeLoungeType === 'family' && desktopTab === 'dashboard' && (
                    <>
                      <span className="text-zinc-600">/</span>
                      <span className="text-primary-container font-bold truncate">
                        {activeFamilyRoom}
                      </span>
                    </>
                  )}
                  <span className="hidden sm:inline text-zinc-600">/</span>
                  <span className="hidden sm:inline text-zinc-400 font-medium truncate">
                    {activeSubmenuLabel}
                  </span>
                </div>
              </div>

              {/* 우측 상단 불변의 생태계 앵커: Z-Eye 여권 문패(업무 공유 제외) + 설정몬스터 + 크레딧 + 테마 토글 */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" aria-label="화면 테마 및 프로필 영역">
                {myPassportCluster && activeLoungeType !== 'work' && (
                  <button
                    type="button"
                    onClick={() => setDoorplatePickerClusterId(myPassportCluster.clusterId)}
                    title="🛂 Z-Eye 여권 문패 사진 변경"
                    className={`pl-1 pr-2.5 py-1 rounded-full border flex items-center gap-1.5 transition-all cursor-pointer ${
                      themeMode === 'light'
                        ? 'bg-teal-50/90 hover:bg-teal-100/80 border-teal-300 text-teal-900 shadow-xs'
                        : 'bg-zinc-900/95 hover:bg-zinc-800 border-primary-container/45 text-white shadow-xs'
                    }`}
                  >
                    <img
                      src={myPassportCluster.avatarUrl || myPassportCluster.representativePhoto}
                      alt={myDoorplatePersona}
                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover border border-primary-container shrink-0"
                    />
                    <span className="font-label-sm text-[11.5px] font-extrabold whitespace-nowrap">
                      👑 {myDoorplatePersona}
                    </span>
                  </button>
                )}
                {(!isStoreAppMode || enableSetupMonster) && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowSetupMonsterModal(true, 'pc')}
                      title="🛠️ 설정몬스터"
                      className="px-2.5 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-600 dark:text-emerald-300 font-label-sm text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <span>🛠️ 설정몬스터</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProModal(true)}
                      title="내 멀린 코인 지갑 & 요금 안내"
                      className={`px-2.5 py-1 rounded-full font-label-mono text-[11px] font-extrabold border flex items-center gap-1 transition-all cursor-pointer ${
                        themeMode === 'light'
                          ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                          : 'bg-zinc-900 border-amber-400/35 text-amber-300 hover:bg-zinc-800'
                      }`}
                    >
                      <span>🪙 {(merlinAuth.coinBalance ?? 5200).toLocaleString()}</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const shareText =
                      '제트아이(Z-Eye) | 사진·영상·서류 속 내용까지 1초 만에 꿰뚫어 찾는 1초 투시검색 — 내 폰·PC 속 투시검색·Z몬스터는 언제나 0원, 가족·모임·업무 공유는 방장 한 분만 https://z-eye.sundreamer.app';
                    if (typeof navigator !== 'undefined' && navigator.share) {
                      void navigator.share({ title: '제트아이 (Z-Eye)', text: shareText, url: 'https://z-eye.sundreamer.app' });
                    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      void navigator.clipboard.writeText(shareText);
                    }
                    useSaySeeStore.setState({
                      lastQuarantineToast: '💌 [앱 공유 링크 복사됨] "초대받은 가족·회원·직원은 언제나 무료입니다" 안내가 클립보드에 준비되었습니다!',
                    });
                  }}
                  title="지인·가족에게 앱 공유하기 (초대받은 가족·회원·직원은 언제나 무료)"
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 outline-none ${
                    themeMode === 'light'
                      ? 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                      : 'bg-slate-800/90 hover:bg-slate-700 border border-white/20 text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">share</span>
                </button>
                <button
                  type="button"
                  onClick={toggleThemeMode}
                  title={themeMode === 'light' ? '어두운 화면으로 전환' : '밝은 화면으로 전환'}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 outline-none ${
                    themeMode === 'light'
                      ? 'text-slate-400 hover:text-slate-700 hover:bg-black/5'
                      : 'bg-slate-800/90 hover:bg-slate-700 border border-white/20 text-slate-300 hover:text-white'
                  }`}
                >
                  {themeMode === 'light' ? (
                    <svg className="w-[16px] h-[16px]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  ) : (
                    <svg
                      className="w-[16px] h-[16px]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="4" fill="currentColor" />
                      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* 모바일(lg 미만, 360px 포함) 전용 1줄 라운지 빠른 전환 바 */}
            <nav className="grid grid-cols-4 lg:hidden gap-1">
              {MAIN_LOUNGE_MENUS.map((menu) => {
                const active = activeLoungeType === menu.id;
                return (
                  <button
                    key={menu.id}
                    type="button"
                    onClick={() => {
                      setActiveLoungeType(menu.id);
                      setDesktopTab('dashboard');
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
                    <MainLoungeMonoIcon id={menu.id} className="w-[12px] h-[12px] shrink-0" />
                    <span>{menu.shortLabel}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        {/* ─────────────── 서브메뉴 1번: ✨ 무료체험 (정식 구독 시 Auto-Hide) ─────────────── */}
        {desktopTab === 'trial' && <LoungeView />}

        {/* ─────────────── 서브메뉴 2번: 노션형 백지 도화지(Zen Canvas) & 점진적 결과 펼침 ─────────────── */}
        {desktopTab === 'dashboard' && (
          <main className="flex-1 w-full max-w-[1320px] mx-auto px-4 sm:px-6 md:px-10 py-6 sm:py-8 flex flex-col gap-6">
            {activeLoungeType === 'work' ? (
              <LoungeFeedContextBanner />
            ) : (
              <>
                {/* 노션 빈 페이지 시작점처럼 여유로운 여백을 가진 중앙 도화지 블록 */}
                <div
                  className={`w-full transition-all duration-300 flex flex-col gap-4 ${
                    !showCanvasResults ? 'max-w-3xl mx-auto py-6 md:py-12' : ''
                  }`}
                >
                  {/* 도화지 타이틀 헤더 */}
                  <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                    <div className="flex items-center gap-2.5">
                      <h1 className="font-headline-md text-[22px] md:text-[26px] text-white font-extrabold tracking-tight">
                        {activeLoungeType === 'personal'
                          ? '👤 내 기기 투시 검색'
                          : activeLoungeType === 'family'
                          ? `👨‍👩‍👧‍👦 ${activeFamilyRoom} 패밀리 앨범`
                          : activeLoungeType === 'club'
                          ? '⛳ 모임 추억 & 원본 보관함'
                          : '🎒 우리반 타임캡슐'}
                      </h1>
                      <span className="text-[12px] text-zinc-500 font-medium">
                        말 한마디나 인물 클릭으로 도화지를 채워보세요
                      </span>
                    </div>

                    {showCanvasResults && (
                      <button
                        type="button"
                        onClick={() => {
                          resetSearchSpaceToAll(searchSpace);
                          resetToZenCanvas();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white font-label-sm text-[11.5px] font-bold cursor-pointer"
                      >
                        ▲ 백지 도화지로 접기
                      </button>
                    )}
                  </div>

                  {/* 라운지별 인물 시드 알약 & 컨트롤 바 (보더리스) */}
                  <LoungeFeedContextBanner />

                  {/* 보더리스 통합 검색창 + [동영상/사진/문서] 캡슐 + 추천 칩 */}
                  <VoiceHeroStage />

                  {/* [Zero-State 도화지 안내]: 아직 검색 전일 때는 무거운 카드 덤프 대신 깔끔한 펼치기 블록만 노출 */}
                  {!showCanvasResults && (
                    <div className="pt-4 flex flex-col items-center gap-3 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSearchSpace('video');
                            setIsCanvasExpanded(true);
                          }}
                          className="px-4 py-2.5 rounded-xl bg-zinc-900/70 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[12.5px] font-bold flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <span>🎬 동영상 전체 펼치기 ({videoSceneItems.length}개)</span>
                          <span className="text-zinc-500">▾</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSearchSpace('gallery');
                            setIsCanvasExpanded(true);
                          }}
                          className="px-4 py-2.5 rounded-xl bg-zinc-900/70 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[12.5px] font-bold flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <span>🖼️ 사진 전체 펼치기 ({activePhotos.length}장)</span>
                          <span className="text-zinc-500">▾</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSearchSpace('vault');
                            setIsCanvasExpanded(true);
                          }}
                          className="px-4 py-2.5 rounded-xl bg-zinc-900/70 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[12.5px] font-bold flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <span>
                            📄 서류 전체 펼치기 ({matchedLocalDocs.length + matchedVaultPhotos.length}건)
                          </span>
                          <span className="text-zinc-500">▾</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 검색을 실행했거나 [전체 펼치기]를 눌렀을 때만 도화지 아래로 채워지는 결과 영역 */}
                {showCanvasResults && (
                  <div id="zeye-search-results" className="scroll-mt-20">
                    {searchSpace === 'video' ? (
              <section className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-bold">
                      “{activeQuery}” 타임라인 구간 검색 결과
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-medium">
                      {matchedVideoScenes.length}개 영상 매칭 · 클릭 시 포착된 초(Sec) 즉시 재생
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
                    {matchedVideoScenes.map((vid) => (
                      <article
                        key={vid.id}
                        onClick={() => setSelectedVideoModal(vid, vid.matchedSeekSec)}
                        className="min-w-[85%] sm:min-w-[340px] md:min-w-0 snap-center group rounded-2xl overflow-hidden bg-[#18181B] hover:bg-zinc-900 border border-white/10 hover:border-white/25 flex flex-col cursor-pointer transition-all"
                      >
                        <div className="relative aspect-video w-full overflow-hidden bg-black">
                          <video
                            key={`${vid.id}-${vid.matchedSeekSec}`}
                            src={`${vid.videoUrl}#t=${vid.matchedSeekSec}`}
                            poster={vid.thumbUrl}
                            preload="metadata"
                            muted
                            playsInline
                            onLoadedMetadata={(e) => {
                              try {
                                e.currentTarget.currentTime = vid.matchedSeekSec;
                              } catch {
                                // ignore
                              }
                            }}
                            className="w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <div className="w-11 h-11 rounded-full bg-black/75 border border-white/20 text-white flex items-center justify-center group-hover:bg-primary-container group-hover:text-zinc-950 group-hover:border-primary-container transition-all">
                              <span className="material-symbols-outlined text-[26px]">play_arrow</span>
                            </div>
                          </div>

                          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-zinc-950/90 backdrop-blur-md border border-white/15 text-primary-container font-label-mono text-[11px] font-bold">
                            {vid.matchedTimestamp}
                          </div>

                          <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-zinc-950/80 border border-white/10 text-zinc-300 font-label-mono text-[10px] font-medium">
                            00:00~{vid.durationText} ({vid.timelineFrames.length}구간)
                          </div>

                          <div className="absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between">
                            <span className="font-label-mono text-[11px] text-zinc-200 font-medium">
                              {vid.locationKo}
                            </span>
                            <span className="font-label-mono text-[10.5px] text-zinc-400">
                              {vid.videoFileName} ({vid.sizeMB}MB)
                            </span>
                          </div>
                        </div>

                        <div className="p-4 flex flex-col gap-2.5 flex-1 justify-between">
                          <div className="flex flex-col gap-2">
                            <h3 className="font-headline-sm text-[15px] text-white font-bold group-hover:text-primary-container transition-colors">
                              {vid.title}
                            </h3>

                            <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-white/10">
                              <p className="font-body-sm text-[12px] text-zinc-300 leading-snug line-clamp-2">
                                {vid.matchedFrameCaption}
                              </p>
                            </div>

                            {/* 전 구간 타임라인 점프 버튼 바 */}
                            <div className="flex flex-wrap items-center gap-1 pt-0.5">
                              <span className="font-label-mono text-[10px] text-zinc-500 mr-0.5">
                                구간 점프:
                              </span>
                              {vid.timelineFrames.map((frame) => {
                                const isMatched = vid.matchedSeekSec === frame.timeSec;
                                return (
                                  <button
                                    key={frame.timeSec}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedVideoModal(vid, frame.timeSec);
                                    }}
                                    title={`${frame.timestampText} (${frame.phaseLabel}): ${frame.sceneCaption}`}
                                    className={`px-2 py-0.5 rounded font-label-mono text-[10px] font-bold transition-all ${
                                      isMatched
                                        ? 'bg-primary-container text-zinc-950 font-black'
                                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5'
                                    }`}
                                  >
                                    {frame.timestampText}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/10 font-label-mono text-[11px] text-zinc-400">
                            <span>{vid.date}</span>
                            <span className="text-primary-container font-bold">
                              ▶ {vid.matchedTimestamp} 재생 →
                            </span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : searchSpace === 'vault' ? (
              <section className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-bold">
                      “{activeQuery}” 스마트 서류함 검색 결과
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-medium">
                      로컬 문서 {matchedLocalDocs.length}건 + 촬영 서류 {matchedVaultPhotos.length}장
                    </span>
                  </div>

                  <button
                    onClick={() => void openLocalFolder('docs')}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-label-sm text-[12px] font-medium border border-white/10 flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[15px]">folder_open</span>
                    <span>내 PC 서류함 폴더(test_docs) 열기</span>
                  </button>
                </div>

                {/* (1) 로컬 PDF / TXT / DOCX 문서 파일 그리드 */}
                {matchedLocalDocs.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <span className="font-label-md text-[13px] text-zinc-400 font-semibold px-0.5">
                      폰·PC 로컬 문서 파일 (PDF · TXT · DOCX — {matchedLocalDocs.length}건)
                    </span>

                    <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-3.5 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1">
                      {matchedLocalDocs.map((doc) => (
                        <article
                          key={doc.id}
                          onClick={() => setSelectedDocModal(doc)}
                          className="min-w-[85%] sm:min-w-[320px] md:min-w-0 snap-center group p-4 rounded-2xl bg-[#18181B] hover:bg-zinc-900 border border-white/10 hover:border-white/25 flex flex-col justify-between gap-3 cursor-pointer transition-all"
                        >
                          <div className="flex flex-col gap-2">
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
                              {doc.title}
                            </h4>

                            <p className="font-body-sm text-[12px] text-zinc-400 line-clamp-2 leading-relaxed bg-zinc-950/80 p-2.5 rounded-xl border border-white/5">
                              {doc.extractedText}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/10 font-label-mono text-[11px] text-zinc-400">
                            <span>{doc.date}</span>
                            <span className="text-primary-container font-bold">본문 열람 →</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                {/* (2) 사진첩 속 촬영 서류 그리드 */}
                <div className="flex flex-col gap-2.5">
                  <span className="font-label-md text-[13px] text-zinc-400 font-semibold px-0.5">
                    갤러리 내 촬영·캡처 서류 자산 ({matchedVaultPhotos.length}장)
                  </span>

                  {matchedVaultPhotos.length > 0 ? (
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
                              <span className="font-label-sm text-[11.5px] font-semibold text-white">
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
                  ) : (
                    <div className="p-8 rounded-2xl bg-[#18181B] border border-white/10 text-center font-body-sm text-zinc-400">
                      일치하는 촬영 서류 사진은 없으며, 상단 로컬 PDF·문서 검색 결과를 확인해 주세요.
                    </div>
                  )}
                </div>
              </section>
            ) : (
              /* [🖼️ 전체 갤러리] 모드 */
              <section className="flex flex-col gap-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-bold">
                      “{activeQuery}” 검색 결과
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-medium">
                      총 {searchResults.length}장
                      {groupBurstsInSearch && collapsedBurstCount > 0
                        ? ` · 연사 묶음 ${groupedResults.length}컷`
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
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
                          <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-950">
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
                              className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-primary-container transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                {item.photo.bookmarked ? 'bookmark_added' : 'favorite'}
                              </span>
                            </button>

                            <div className="absolute inset-x-0 bottom-0 h-[20%] min-h-[44px] px-3 pb-2 pt-4 bg-gradient-to-t from-black/90 via-black/55 to-transparent flex items-end justify-between pointer-events-none">
                              <span className="font-label-sm text-[11.5px] font-semibold text-white">
                                {item.photo.date.split(' ')[0]}
                              </span>
                              {item.photo.tags[0] && (
                                <span className="font-label-sm text-[11px] font-medium text-zinc-300 truncate ml-2">
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
      )}

      {/* ─────────────── 서브메뉴 3번: 개인은 [AI 클린몬스터], 패밀리/클럽/10대 학생은 [⏳ AI 인덱싱 대기실] ─────────────── */}
      {desktopTab === 'trash' &&
        (activeLoungeType === 'personal' ? (
          <SmartTrashView />
        ) : (
          <LoungeIndexingWaitingRoom />
        ))}

      {/* ─────────────── 서브메뉴 4번: AI 설정몬스터 / 초대 / 인증 & 정식 스토어 설치 가이드 ─────────────── */}
      {desktopTab === 'sync' && (
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-5 md:px-8 py-7 flex flex-col gap-5">
          {/* 라운지별 전용 상단 설정 섹션 (AI 설정몬스터 / 가족 무수락 초대·강퇴 / 클럽 관리 / 게이밍 PC·학생증 OCR 인증) */}
          <LoungeCustomSettingsHeader />

          {/* 💻 모바일 ➔ PC 전환 시 스토어 규정(Anti-steering)을 100% 준수하는 데스크톱 기기 연동 패널 */}
          <PcMasterQuickSendPanel />

          {/* 🛡️ 스토어 1차 심사 통과용 클린 모드(isStoreAppMode) · 코인 잔액(enableMobileCoinDisplay) · 원격 공유 토글(enablePcGuideShareButton) · /?master=pc 이중 방어 제어 바 */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 font-label-sm text-[11px] font-extrabold">
                  스토어 1차 출시 3중 안전장치 (Anti-steering 완벽 방어)
                </span>
                <span className="font-label-mono text-[11px] text-zinc-400">
                  isStoreAppMode={String(isStoreAppMode)} · showCoinBalanceInApp={String(showCoinBalanceInApp)} · enablePcGuideShareButton={String(enablePcGuideShareButton)}
                </span>
              </div>
              <h3 className="font-headline-sm text-[15.5px] text-white font-bold">
                모바일 스토어 클린 모드 · 코인 비노출 · PC 연동 가이드 원격 토글 &amp; <code>/?master=pc</code> 이중 방어
              </h3>
              <p className="font-body-sm text-[12px] text-zinc-400">
                ① ‘주소/URL/결제’ 단어 전면 배제(데스크톱 기기 연동 워딩), ② 모바일에서 <code>/?master=pc</code> 접속 시 결제 없는 순수 ‘PC 데스크톱 엔진 기능 소개 화면’만 렌더링, ③ 심사 기간 중 공유 버튼 원격 토글(<code>enablePcGuideShareButton</code>)을 1초 만에 제어합니다.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsStoreAppMode(!isStoreAppMode)}
                className={`px-3.5 py-2 rounded-xl font-label-sm text-[12px] font-extrabold border transition-all cursor-pointer ${
                  isStoreAppMode
                    ? 'bg-emerald-400 text-zinc-950 border-emerald-300'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/15'
                }`}
              >
                {isStoreAppMode ? '📱 스토어 심사 클린 모드: ON' : '💻 PC 마스터 모드 (클릭 시 스토어 모드)'}
              </button>

              <button
                type="button"
                onClick={() => setEnableSetupMonster(!enableSetupMonster)}
                className={`px-3.5 py-2 rounded-xl font-label-sm text-[12px] font-extrabold border transition-all cursor-pointer ${
                  enableSetupMonster
                    ? 'bg-primary-container text-zinc-950 border-primary-container'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-white/15'
                }`}
              >
                {enableSetupMonster
                  ? '🛠️ 설정몬스터 (enableSetupMonster=true)'
                  : '🔒 설정몬스터 숨김 (enableSetupMonster=false)'}
              </button>

              <button
                type="button"
                onClick={() => setEnableMobileCoinDisplay(!enableMobileCoinDisplay)}
                className={`px-3.5 py-2 rounded-xl font-label-sm text-[12px] font-extrabold border transition-all cursor-pointer ${
                  enableMobileCoinDisplay
                    ? 'bg-amber-400 text-zinc-950 border-amber-300'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-white/15'
                }`}
              >
                {enableMobileCoinDisplay
                  ? '🪙 코인 잔액 표시: ON'
                  : '🔒 코인 잔액 완전 숨김: OFF (기본값)'}
              </button>

              <button
                type="button"
                onClick={() => setEnablePcGuideShareButton(!enablePcGuideShareButton)}
                className={`px-3.5 py-2 rounded-xl font-label-sm text-[12px] font-extrabold border transition-all cursor-pointer ${
                  enablePcGuideShareButton
                    ? 'bg-[#FEE500] text-[#191919] border-[#FEE500]'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-white/15'
                }`}
              >
                {enablePcGuideShareButton
                  ? '💬 카톡·이메일 가이드 버튼: ON'
                  : '🔒 카톡·이메일 가이드 버튼: OFF (심사 잠금)'}
              </button>

              <button
                type="button"
                onClick={() => setShowMobileMasterPcIntroModal(true)}
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-primary-container/50 text-primary-container font-label-sm text-[12px] font-extrabold transition-all cursor-pointer"
              >
                🛡️ /?master=pc 모바일 접속 시 방어 화면 보기
              </button>
            </div>
          </div>

          {/* 🔄 내 기기 원본 동기화 경로 & 🚪 탈퇴(자퇴·강퇴 동일) 시 썸네일 DB 즉시 자동 삭제 원칙 */}
          <div className="p-6 rounded-2xl bg-[#18181B] border border-primary-container/50 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold">
                🔄 내 기기 원본 동기화 자체 해결 &amp; 🚪 탈퇴 시 썸네일 DB 즉시 자동 삭제 원칙
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-mono text-[11px] font-bold">
                ✓ 방장 PC 원본 호출 폐지 · 내 기기 동기화로 100% 자체 해결
              </span>
            </div>
            <h2 className="font-headline-md text-[20px] text-white font-bold tracking-tight">
              평소엔 보이지 않는 곳에 13KB 썸네일 DB만 두고, 원본 동기화 시 지정한 내 폴더에서 자체 해결합니다
            </h2>
            <div className="font-body-sm text-[13px] text-zinc-200 leading-relaxed bg-zinc-950/90 p-4 rounded-xl border border-white/10 flex flex-col gap-1.5">
              <p>• <strong>평소(기본):</strong> 멤버 기기에는 보이지 않는 시스템 영역(<code>%LOCALAPPDATA%\Merlin\thumb_db</code>)에 <strong>13KB 초경량 썸네일 DB</strong>만 보관해 용량 부담 없이 0.01초 만에 검색합니다.</p>
              <p>• <strong>원본 동기화 ON:</strong> Wi-Fi 및 여유 공간이 넉넉할 때 지정한 내 폴더 경로(예: <code>D:\Z-Eye\다운로드_원본</code>)로 원본 사진이 자동 복제되어, 방장 PC를 따로 호출할 필요 없이 내 기기에서 자체 해결합니다.</p>
              <p>• <strong>탈퇴(자퇴 · 강퇴 동일) 시 데이터 처리 기준 (방 개설 안내 &amp; 약관 명시):</strong> 탈퇴/강퇴 즉시 해당 방 계정 아웃 처리되며, 숨김 영역에 보관된 <strong>그 공유방의 썸네일 DB · 공유방 검색 인덱스 · 해당 방 내부 타 멤버 여권 목록만 0.1초 만에 자동 삭제</strong>됩니다 (※ 유저가 자기 PC에 인덱싱한 <strong>‘나 자신의 Z-Eye 여권’ 및 ‘내 기기 개인 인덱스’는 절대 삭제되지 않고 100% 보존</strong>되며, 이미 받아둔 공유방 원본 폴더도 반납 없이 각자 자율 관리).</p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold">
                폰↔PC 프라이빗 싱크 센터
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-400 font-label-sm text-[11.5px]">
                무거운 원본 외부 미전송 · 100% 내 기기 간 직접 일치화
              </span>
            </div>

            <h2 className="font-headline-md text-[20px] text-white font-bold tracking-tight">
              ⚙️ 클라우드 대체 ‘프라이빗 싱크’ 2-Track 전략 선택
            </h2>

            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-white/10 flex items-center gap-3">
              <span className="material-symbols-outlined text-zinc-400 text-[20px] shrink-0">
                battery_charging_full
              </span>
              <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                <strong>배터리 · OS 제재 방어 원칙:</strong> 제트아이(Z-Eye) 정식 모바일 앱(Google Play / App Store)은 상시 백그라운드 통신을 하지 않으며,{' '}
                <strong className="text-white">[집 Wi-Fi 연결 + 충전 중]</strong>이거나{' '}
                <strong className="text-primary-container">[지금 일치시키기]</strong> 버튼을 누를 때만 작동합니다.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 모드 A */}
            <div
              onClick={() => setPrivateSyncStrategy('mirror')}
              className={`p-5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between gap-4 border ${
                syncState.privateSyncStrategy === 'mirror'
                  ? 'bg-zinc-900 border-primary-container'
                  : 'bg-[#18181B] hover:bg-zinc-900/80 border-white/10'
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

                <h2 className="font-headline-sm text-[18px] text-white font-bold">
                  🔄 100% 원본 미러링 모드
                </h2>

                <p className="font-body-sm text-[13px] text-zinc-400 leading-relaxed">
                  폰과 PC를 클린몬스터 정리로 먼저 깨끗이 비운 뒤, 양쪽 기기에 똑같은 원본 파일을 1:1로 유지하여 클라우드 없이 상호 백업 보험을 구축합니다.
                </p>

                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5 font-label-sm text-[12px]">
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

              <span className="font-label-sm text-[11.5px] text-zinc-400 pt-2 border-t border-white/10">
                ✓ 폰 분실 시 PC에 원본 100% 보존 · PC 고장 시 폰에 원본 100% 보존
              </span>
            </div>

            {/* 모드 B */}
            <div
              onClick={() => setPrivateSyncStrategy('shadow')}
              className={`p-5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between gap-4 border ${
                syncState.privateSyncStrategy === 'shadow'
                  ? 'bg-zinc-900 border-primary-container'
                  : 'bg-[#18181B] hover:bg-zinc-900/80 border-white/10'
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

                <h2 className="font-headline-sm text-[18px] text-white font-bold">
                  ⚡ 스마트폰 용량 절약 모드 (원본은 PC에 안전 보관)
                </h2>

                <p className="font-body-sm text-[13px] text-zinc-400 leading-relaxed">
                  무거운 원본(수십 GB)은 집 PC 하드디스크로 안전하게 옮겨 폰 용량을 비우고, 폰에는 어디서든 바로 찾아볼 수 있는 가벼운 미리보기 사진만 남깁니다.
                </p>

                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5 font-label-sm text-[12px]">
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

              <span className="font-label-sm text-[11.5px] text-zinc-300 pt-2 border-t border-white/10">
                ⚡ 집 PC 전원이 꺼져 있어도 밖에서 내 폰으로 1초 만에 100% 검색·열람 가능
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-2.5">
                <h3 className="font-headline-sm text-[16px] text-white font-bold">
                  📲 자동 작동 조건 &amp; 즉시 일치화
                </h3>

                <label className="p-3 rounded-xl bg-zinc-950/70 border border-white/10 flex items-center justify-between gap-3 cursor-pointer">
                  <span className="font-label-md text-[12.5px] text-zinc-200 font-medium">
                    집/사무실 동일 Wi-Fi 연결 시에만 작동
                  </span>
                  <input
                    type="checkbox"
                    checked={syncState.wifiOnly}
                    onChange={(e) => updateSyncSettings(syncState.mode, e.target.checked)}
                    className="w-4 h-4 accent-[#00E5FF] rounded"
                  />
                </label>

                <label className="p-3 rounded-xl bg-zinc-950/70 border border-white/10 flex items-center justify-between gap-3 cursor-pointer">
                  <span className="font-label-md text-[12.5px] text-zinc-200 font-medium">
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

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                <span className="font-label-mono text-[11.5px] text-zinc-400">
                  최근 일치화: <strong className="text-zinc-200">{syncState.lastSyncedAt}</strong>
                </span>
                <button
                  type="button"
                  disabled={syncState.syncing}
                  onClick={() => void triggerSyncNow()}
                  className="px-4 py-2 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-md text-[13px] font-extrabold transition-all disabled:opacity-50"
                >
                  {syncState.syncing ? '일치화 실행 중...' : '⚡ 지금 일치시키기'}
                </button>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-3">
                <h3 className="font-headline-sm text-[16px] text-white font-bold">
                  📁 내 PC 로컬 폴더 직결 관리
                </h3>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-zinc-950/70 border border-white/10 flex flex-col">
                    <span className="font-body-sm text-[11px] text-zinc-400">갤러리 활성</span>
                    <span className="font-headline-sm text-[17px] text-white font-bold">
                      {activePhotos.length}장
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950/70 border border-white/10 flex flex-col">
                    <span className="font-body-sm text-[11px] text-zinc-400">스마트 서류함</span>
                    <span className="font-headline-sm text-[17px] text-white font-bold">
                      {matchedLocalDocs.length + activePhotos.filter((p) => p.isVaultDocument).length}건
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950/70 border border-white/10 flex flex-col">
                    <span className="font-body-sm text-[11px] text-zinc-400">OS 기본 휴지통 이동</span>
                    <span className="font-headline-sm text-[17px] text-white font-bold">
                      {quarantinedPhotos.length}장
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={() => void openLocalFolder('photos')}
                  className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[12px] font-medium"
                >
                  📂 사진 폴더
                </button>
                <button
                  onClick={() => void openLocalFolder('docs')}
                  className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[12px] font-medium"
                >
                  📂 서류함(PDF) 폴더
                </button>
                <button
                  onClick={() => void openLocalFolder('quarantine')}
                  className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 font-label-sm text-[12px] font-medium"
                >
                  🗑️ OS 기본 휴지통 열기
                </button>
                <button
                  onClick={() => setShowOnboarding(true)}
                  className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-primary-container font-label-sm text-[12px] font-semibold"
                >
                  🔒 보안 · QR 페어링 설정
                </button>
              </div>
            </div>
          </div>
        </main>
      )}
      </div>
    </div>
  );
};
