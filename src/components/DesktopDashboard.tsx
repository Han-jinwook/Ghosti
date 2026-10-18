import React, { useMemo } from 'react';
import { useSaySeeStore, type DesktopTab } from '../store/useSaySeeStore';
import type { GpuHelperTierId, LoungeType } from '../types/saysee';
import { groupBurstSearchResults } from '../services/aiEngine';
import { VoiceHeroStage } from './VoiceHeroStage';
import { SmartTrashView } from './SmartTrashView';
import {
  LoungeCustomSettingsHeader,
  LoungeFeedContextBanner,
  LoungeIndexingWaitingRoom,
  LoungeView,
} from './LoungeView';

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
  }
};

const MAIN_LOUNGE_MENUS: Array<{
  id: LoungeType;
  label: string;
}> = [
  { id: 'personal', label: '개인 라운지' },
  { id: 'family', label: '패밀리 라운지' },
  { id: 'club', label: '클럽 라운지' },
  { id: 'student', label: '스쿨 라운지' },
];

const LOUNGE_SUBMENU_CONFIG: Record<
  LoungeType,
  Array<{ id: DesktopTab; label: string; showTrashCount?: boolean }>
> = {
  personal: [
    { id: 'trial', label: '무료체험' },
    { id: 'dashboard', label: 'AI 투시검색 몬스터' },
    { id: 'trash', label: 'AI 클린 몬스터', showTrashCount: true },
    { id: 'sync', label: 'AI 설정 몬스터' },
  ],
  family: [
    { id: 'trial', label: '무료체험' },
    { id: 'dashboard', label: '우리집·본가·처가 피드' },
    { id: 'trash', label: 'AI 인덱싱 대기실' },
    { id: 'sync', label: '가족 초대 & 서버도우미' },
  ],
  club: [
    { id: 'trial', label: '무료체험' },
    { id: 'dashboard', label: '모임 피드 & 원본 소환' },
    { id: 'trash', label: 'AI 인덱싱 대기실' },
    { id: 'sync', label: '클럽 관리 & 서버도우미' },
  ],
  student: [
    { id: 'trial', label: '무료체험' },
    { id: 'dashboard', label: '타임캡슐 피드 & 씬 검색' },
    { id: 'trash', label: 'AI 인덱싱 대기실' },
    { id: 'sync', label: '게이밍 PC & 학생인증' },
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
  } = useSaySeeStore();

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

  return (
    <div className="min-h-screen flex flex-col bg-[#09090B] text-zinc-100">
      {/* ─────────────── 상단 2단 통합 헤더 (뭐먹지? 스타일): 1단(화이트 바 + 흑백 라인 아이콘 메인메뉴 캡슐) + 2단(이모지 없는 깔끔한 언더라인 서브메뉴 탭) ─────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl">
        {/* 1단: 좌측 로고 ─── 세련된 흑백 라인 아이콘 메인메뉴 4개 ─── 우상단 테마 토글 */}
        <div
          className={`px-5 md:px-8 py-2.5 flex items-center justify-between gap-4 border-b transition-colors ${
            themeMode === 'light'
              ? 'bg-white/95 border-[#EAE8E1]'
              : 'bg-[#09090B]/95 border-white/10'
          }`}
        >
          <div className="flex items-center min-w-0 flex-wrap gap-y-2">
            {/* 좌측 브랜드 로고(아래 슬로건) */}
            <div className="flex items-center gap-3.5 shrink-0 md:w-[210px]">
              <div
                onClick={() => setDesktopTab('dashboard')}
                className="flex items-center gap-2.5 cursor-pointer shrink-0"
              >
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                    themeMode === 'light'
                      ? 'bg-[#F8F7F4] border-[#E5E0D5] text-[#0D9488]'
                      : 'bg-zinc-900 border-white/15 text-primary-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px] font-bold">
                    graphic_eq
                  </span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1.5 leading-none">
                    <span
                      className={`font-headline-sm text-[18px] tracking-tight font-extrabold whitespace-nowrap ${
                        themeMode === 'light' ? 'text-slate-900' : 'text-white'
                      }`}
                    >
                      세이씨
                    </span>
                    <span
                      className={`font-normal text-[12.5px] ${
                        themeMode === 'light' ? 'text-slate-500' : 'text-zinc-400'
                      }`}
                    >
                      SaySee
                    </span>
                  </div>
                  <span
                    className={`font-label-sm text-[11px] font-medium mt-1 leading-none whitespace-nowrap flex items-center gap-1 ${
                      themeMode === 'light' ? 'text-slate-500' : 'text-zinc-400'
                    }`}
                  >
                    <svg
                      className="w-3 h-3 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="4" y="11" width="16" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                    <span>No-클라우드 시크릿 라운지</span>
                  </span>
                </div>
              </div>
            </div>

            {/* 1단 메인메뉴 4개: 세련된 흑백 라인 아이콘 + 캡슐 하이라이트 */}
            <nav className="ml-6 sm:ml-8 md:ml-8 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {MAIN_LOUNGE_MENUS.map((menu) => {
                const active = activeLoungeType === menu.id;
                const isLoungeSub = Boolean(subscribedLounges[menu.id]);
                return (
                  <button
                    key={menu.id}
                    type="button"
                    onClick={() => setActiveLoungeType(menu.id)}
                    className={`px-4 py-2 rounded-full font-label-md text-[13.5px] flex items-center gap-1.5 transition-all shrink-0 whitespace-nowrap outline-none focus:outline-none cursor-pointer ${
                      active
                        ? themeMode === 'light'
                          ? 'bg-[#E6F7F5] text-[#0D9488] font-extrabold shadow-[0_1px_2px_rgba(13,148,136,0.08)]'
                          : 'bg-zinc-800 text-primary-container font-extrabold'
                        : themeMode === 'light'
                        ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70 font-bold'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50 font-bold'
                    }`}
                  >
                    <MainLoungeMonoIcon id={menu.id} className="w-[16px] h-[16px] shrink-0" />
                    <span>{menu.label}</span>
                    {isLoungeSub && (
                      <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 text-[10px] font-extrabold">
                        PRO
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* 우측 상단: 심플 아이콘 테마 토글 (밝은 화면일 때 달 아이콘 / 어두운 화면일 때 해 아이콘) */}
          <div className="flex items-center gap-2 shrink-0" aria-label="화면 테마 및 프로필 영역">
            <button
              type="button"
              onClick={toggleThemeMode}
              title={themeMode === 'light' ? '어두운 화면(다크 모드)으로 전환' : '밝은 화면(웜 라이트)으로 전환'}
              aria-label={themeMode === 'light' ? '어두운 화면으로 전환' : '밝은 화면으로 전환'}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 outline-none focus:outline-none ${
                themeMode === 'light'
                  ? 'text-slate-400 hover:text-slate-700 hover:bg-black/5'
                  : 'bg-slate-800/90 hover:bg-slate-700 border border-white/20 text-slate-300 hover:text-white shadow-sm'
              }`}
            >
              {themeMode === 'light' ? (
                <svg
                  className="w-[18px] h-[18px]"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg
                  className="w-[18px] h-[18px]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" fill="currentColor" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* 2단: 서브메뉴 바 — 이모지 없이 깔끔한 언더라인 탭 (먹로그 | 먹예약 | 먹캘린더 스타일) */}
        <div
          className={`px-5 md:px-8 pt-1.5 border-b flex items-center gap-1 overflow-x-auto no-scrollbar md:pl-[274px] transition-colors ${
            themeMode === 'light'
              ? 'bg-[#F8F7F4]/95 border-[#E5E0D5]'
              : 'bg-[#111114]/95 border-white/10'
          }`}
        >
          {currentSubmenus.map((sub) => {
            if (sub.id === 'trial' && isCurrentLoungeSubscribed) {
              return null;
            }
            const isSubActive = desktopTab === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => setDesktopTab(sub.id)}
                className={`px-5 py-2.5 rounded-t-xl border-b-[3px] font-label-md text-[13.5px] flex items-center gap-1.5 transition-all shrink-0 whitespace-nowrap outline-none focus:outline-none cursor-pointer ${
                  isSubActive
                    ? themeMode === 'light'
                      ? 'bg-[#EAF8F6] text-[#0D9488] border-[#0D9488] font-extrabold'
                      : 'bg-primary-container/15 text-primary-container border-primary-container font-extrabold'
                    : themeMode === 'light'
                    ? 'border-transparent text-slate-800 hover:text-[#0D9488] hover:bg-black/[0.02] font-bold'
                    : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.03] font-bold'
                }`}
              >
                <span>{sub.label}</span>
                {sub.showTrashCount && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono font-bold ${
                      isSubActive
                        ? themeMode === 'light'
                          ? 'bg-[#0D9488]/15 text-[#0D9488]'
                          : 'bg-primary-container/20 text-primary-container'
                        : themeMode === 'light'
                        ? 'bg-slate-200/80 text-slate-600'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {activeTrashCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ─────────────── 서브메뉴 1번: ✨ 무료체험 (정식 구독 시 Auto-Hide) ─────────────── */}
      {desktopTab === 'trial' && <LoungeView />}

      {/* ─────────────── 서브메뉴 2번: 메인 피드 & 파워 검색 ─────────────── */}
      {desktopTab === 'dashboard' && (
        <main className="flex-1 w-full max-w-[1440px] mx-auto px-5 md:px-8 py-5 flex flex-col gap-5">
          {/* 라운지별 전용 상단 컨트롤 바 (패밀리 서브룸 전환 / 클럽 5MB 원본 소환 / 10대 학생 타임캡슐 리포트) */}
          <LoungeFeedContextBanner />

          {/* 1층: 통합 검색창 + 3대 카테고리 탭 + 1줄 추천 칩 / 2층: 접이식 브리핑 보드 아코디언 */}
          <VoiceHeroStage />

          {/* 검색 결과 영역 */}
          <div id="saysee-search-results" className="scroll-mt-20">
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
        </main>
      )}

      {/* ─────────────── 서브메뉴 3번: 개인은 [AI 클린 몬스터], 패밀리/클럽/10대 학생은 [⏳ AI 인덱싱 대기실] ─────────────── */}
      {desktopTab === 'trash' &&
        (activeLoungeType === 'personal' ? (
          <SmartTrashView />
        ) : (
          <LoungeIndexingWaitingRoom />
        ))}

      {/* ─────────────── 서브메뉴 4번: AI 설정 몬스터 / 초대 / 인증 & 정식 스토어 설치 가이드 ─────────────── */}
      {desktopTab === 'sync' && (
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-5 md:px-8 py-7 flex flex-col gap-5">
          {/* 라운지별 전용 상단 설정 섹션 (AI 설정 몬스터 / 가족 무수락 초대·강퇴 / 클럽 관리 / 게이밍 PC·학생증 OCR 인증) */}
          <LoungeCustomSettingsHeader />

          {/* 정식 스토어 및 공인 설치 가이드 (편법 배제 · 안드로이드 / iOS / Windows PC 정공법) */}
          <div className="p-5 md:p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold">
                  스토어 정공법 · 공인 설치 가이드
                </span>
                <span className="font-body-sm text-[12px] text-zinc-400">
                  복잡한 편법 설정 없이 정식 스토어 및 MS 공식 인증서 서명 설치파일로 안전하게 연결됩니다
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-headline-sm text-[14.5px] text-white font-bold">
                    Android 스마트폰
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10.5px] font-bold">
                    Google Play / 공식 APK
                  </span>
                </div>
                <p className="font-body-sm text-[12px] text-zinc-300 leading-relaxed">
                  Google Play 스토어 정식 앱 또는 공식 서명된 APK로 원터치 설치 후 PC와 QR로 즉시 페어링합니다.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-headline-sm text-[14.5px] text-white font-bold">
                    iOS (아이폰 · 아이패드)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-primary-container/15 text-primary-container text-[10.5px] font-bold">
                    App Store / 공식 TestFlight
                  </span>
                </div>
                <p className="font-body-sm text-[12px] text-zinc-300 leading-relaxed">
                  App Store 정식 출시 앱 및 Apple 공식 TestFlight를 통해 공인 iOS 앱으로 안전하고 깔끔하게 설치합니다.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-headline-sm text-[14.5px] text-white font-bold">
                    Windows PC
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10.5px] font-bold">
                    MS 공식 인증서 서명 설치파일
                  </span>
                </div>
                <p className="font-body-sm text-[12px] text-zinc-300 leading-relaxed">
                  Microsoft 공식 EV 코드사이닝 인증서가 서명된 정식 설치파일(<code>SaySee_Setup.exe</code>)로 보안 경고 없이 안전하게 구동됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* [필수 반영] AI 설정 몬스터 내 '24시간 GPU 클라우드 서버 도우미' 초특가 요금 카드 */}
          <div className="p-6 rounded-2xl bg-[#18181B] border border-primary-container/50 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold">
                  AI 설정 몬스터 핵심 기능
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[11.5px] font-medium">
                  방장 PC가 꺼져 있거나 고장 났을 때 스마트폰에서 원터치 가동
                </span>
              </div>
              {gpuHelper24hActive ? (
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-mono text-[11px] font-bold">
                    🟢 현재 24시간 GPU 클라우드 도우미 가동 중
                  </span>
                  <button
                    type="button"
                    onClick={deactivateGpuHelper24h}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 font-label-sm text-[11px] font-semibold"
                  >
                    내 PC 모드로 복귀 (클라우드 즉시 소각)
                  </button>
                </div>
              ) : (
                <span className="px-3 py-1 rounded-full bg-zinc-900 border border-white/10 text-zinc-400 font-label-mono text-[11px]">
                  현재 상태: 내 PC 직접 구동 모드 (대기 중)
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <h1 className="font-headline-md text-[21px] md:text-[23px] text-white font-bold tracking-tight">
                ⚡ 24시간 GPU 클라우드 서버 도우미 (일 1,000원 / 클럽 규모별 1,000 · 2,000 · 3,000원)
              </h1>
              <p className="font-body-sm text-[13px] text-zinc-200 leading-relaxed bg-zinc-950/90 p-4 rounded-xl border border-white/10">
                내 PC가 꺼져 있을 때 단돈 1,000원(중·대형 클럽 2,000~3,000원)으로 24시간 동안 초고속 GPU 클라우드 도우미를 즉시 가동합니다. 멤버들이 올린 사진·영상의 Gemma 2 인덱싱과 캐시 배포를 실시간 대행하며, 추후 내 PC가 켜지면 원본을 내 PC로 안전하게 이관한 뒤 클라우드에서는 100% 자동 소각됩니다.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(
                [
                  {
                    id: 'standard_1000' as GpuHelperTierId,
                    badge: '개인 / 패밀리 / 스쿨',
                    title: '개인 · 패밀리 · 스쿨 라운지',
                    price: '24시간 당 1,000원',
                    sub: '방장 PC OFF 시 24시간 실시간 인덱싱·배포 대행',
                  },
                  {
                    id: 'club_small_1000' as GpuHelperTierId,
                    badge: '클럽 라운지 (소형)',
                    title: '소형 클럽 (~20명)',
                    price: '24시간 당 1,000원',
                    sub: '20명 기준 모임 사진·영상 24시간 대행',
                  },
                  {
                    id: 'club_medium_2000' as GpuHelperTierId,
                    badge: '클럽 라운지 (중형)',
                    title: '중형 클럽 (~100명)',
                    price: '24시간 당 2,000원',
                    sub: '100명 기준 모임 사진·영상 24시간 대행',
                  },
                  {
                    id: 'club_large_3000' as GpuHelperTierId,
                    badge: '클럽 라운지 (대형)',
                    title: '대형 클럽 (무제한)',
                    price: '24시간 당 3,000원',
                    sub: '인원 무제한 대형 클럽 24시간 대행',
                  },
                ]
              ).map((item) => {
                const active = gpuHelper24hActive && gpuHelperActiveTier === item.id;
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl flex flex-col justify-between gap-3 border transition-all ${
                      active
                        ? 'bg-zinc-900 border-primary-container shadow-[0_0_20px_rgba(32,247,219,0.14)]'
                        : 'bg-zinc-950/80 border-white/10'
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-label-mono text-[10.5px] text-zinc-400">
                        {item.badge}
                      </span>
                      <span className="font-headline-sm text-[15px] text-white font-bold">
                        {item.title}
                      </span>
                      <span className="font-headline-sm text-[18px] text-primary-container font-black mt-0.5">
                        {item.price}
                      </span>
                      <p className="font-body-sm text-[11.5px] text-zinc-400 mt-0.5">
                        {item.sub}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => activateGpuHelper24h(item.id)}
                      className={`w-full py-2 rounded-lg font-label-sm text-[12px] font-extrabold transition-all ${
                        active
                          ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                          : 'bg-primary-container text-zinc-950 hover:opacity-95'
                      }`}
                    >
                      {active ? '✓ 현재 24시간 가동 중' : '⚡ 원터치 24시간 가동'}
                    </button>
                  </div>
                );
              })}
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
                <strong>배터리 · OS 제재 방어 원칙:</strong> 세이씨 정식 모바일 앱(Google Play / App Store)은 상시 백그라운드 통신을 하지 않으며,{' '}
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
                  폰과 PC를 주치의 정리로 먼저 깨끗이 비운 뒤, 양쪽 기기에 똑같은 원본 파일을 1:1로 유지하여 클라우드 없이 상호 백업 보험을 구축합니다.
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
                  👻 초경량 섀도우 캐시 모드 (장당 13KB)
                </h2>

                <p className="font-body-sm text-[13px] text-zinc-400 leading-relaxed">
                  무거운 원본(수십 GB)은 집 PC 하드디스크로 이관해 폰 용량을 비우고, 폰에는 장당 13KB 경량 WebP 썸네일 + 768d 벡터 인덱스만 남깁니다.
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
                    <span className="font-body-sm text-[11px] text-zinc-400">30일 정리대기함</span>
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
                  📂 정리대기함 폴더
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
  );
};
