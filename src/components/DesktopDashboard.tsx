import React, { useMemo } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { groupBurstSearchResults } from '../services/aiEngine';
import { VoiceHeroStage } from './VoiceHeroStage';
import { SmartTrashView } from './SmartTrashView';
import { FoundingMemberFomoBar } from './PricingModal';

export const DesktopDashboard: React.FC = () => {
  const {
    desktopTab,
    setDesktopTab,
    setLayout,
    photos,
    searchSpace,
    setSearchSpace,
    matchedLocalDocs,
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
    setShowProModal,
    syncState,
    setPrivateSyncStrategy,
    updateSyncSettings,
    setChargingOnlySync,
    triggerSyncNow,
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

  return (
    <div className="min-h-screen flex flex-col bg-[#09090B] text-zinc-100">
      {/* ─────────────── 최상단 창립 멤버 선착순 특전 미니멀 바 ─────────────── */}
      <FoundingMemberFomoBar />

      {/* ─────────────── 상단 헤더: 로고 + [🟢 내 PC 엔진 안전 가동 중] 캡슐 + 중앙 3대 탭 + 우측 유틸리티 ─────────────── */}
      <header className="sticky top-0 h-15 bg-[#09090B]/95 backdrop-blur-xl z-40 px-5 md:px-8 flex items-center justify-between border-b border-white/10 gap-3">
        {/* 좌측 브랜드 로고 + [🟢 신호등 보안/연결 상태 캡슐 1개] */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            onClick={() => setDesktopTab('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-white/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary-container text-[19px] font-bold">
                graphic_eq
              </span>
            </div>
            <span className="font-headline-sm text-[18px] text-white tracking-tight font-extrabold">
              세이씨 <span className="hidden sm:inline text-zinc-400 font-normal text-[14px]">SaySee</span>
            </span>
          </div>

          {/* [처방 1] 본 화면 상단의 거대한 초록색 온보딩 박스를 대체하는 단 하나의 세련된 신호등 캡슐 (클릭 시 보안/QR 모달 오픈) */}
          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            title="클릭하여 MS EV 보안 상세 안내 · 검진 폴더 설정 · 모바일 QR 페어링 열기"
            className="px-3 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-white/25 text-zinc-200 font-label-sm text-[11.5px] font-medium flex items-center gap-1.5 transition-all cursor-pointer truncate"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="truncate">
              {onboardingTrackMode === 'pc_local'
                ? `내 PC 엔진 안전 가동 중 ${pcAgentPairedMobile ? '(폰 연결됨)' : '• QR 연결'}`
                : '초고속 클라우드 엔진 가동 중 • 보안 안내'}
            </span>
          </button>
        </div>

        {/* 중앙 미니멀 3대 네비게이션 탭 */}
        <nav className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900/90 border border-white/10">
          <button
            onClick={() => setDesktopTab('dashboard')}
            className={`px-3.5 py-1.5 rounded-lg font-label-md text-[12.5px] font-bold flex items-center gap-1.5 transition-all ${
              desktopTab === 'dashboard'
                ? 'bg-primary-container text-zinc-950 font-extrabold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
            }`}
          >
            <span>🔍 파워 검색</span>
          </button>

          <button
            onClick={() => setDesktopTab('trash')}
            className={`px-3.5 py-1.5 rounded-lg font-label-md text-[12.5px] font-bold flex items-center gap-1.5 transition-all ${
              desktopTab === 'trash'
                ? 'bg-primary-container text-zinc-950 font-extrabold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
            }`}
          >
            <span>🧹 주치의 정리</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10.5px] font-mono font-bold ${
                desktopTab === 'trash'
                  ? 'bg-black/20 text-zinc-950'
                  : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              {activeTrashCount}
            </span>
          </button>

          <button
            onClick={() => setDesktopTab('sync')}
            className={`px-3.5 py-1.5 rounded-lg font-label-md text-[12.5px] font-bold flex items-center gap-1.5 transition-all ${
              desktopTab === 'sync'
                ? 'bg-primary-container text-zinc-950 font-extrabold'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
            }`}
          >
            <span>⚙️ 내 기기 &amp; 백업</span>
          </button>
        </nav>

        {/* 우측 유틸리티 버튼 (절제된 다크 버튼 + 앰버 텍스트 포인트) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowProModal(true)}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-amber-400 font-label-sm text-[12px] font-bold flex items-center gap-1 transition-all"
          >
            <span>👑 요금제</span>
            <span className="hidden lg:inline">· 10년 특전</span>
          </button>

          <button
            onClick={() => setLayout('mobile')}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-label-sm text-[12px] font-medium flex items-center gap-1.5 border border-white/10 transition-all"
          >
            <span className="material-symbols-outlined text-zinc-400 text-[15px]">
              smartphone
            </span>
            <span className="hidden md:inline">모바일 뷰</span>
          </button>
        </div>
      </header>

      {/* ─────────────── 탭 1: 🔍 파워 검색 ─────────────── */}
      {desktopTab === 'dashboard' && (
        <main className="flex-1 w-full max-w-[1440px] mx-auto px-5 md:px-8 py-5 flex flex-col gap-5">
          {/* 1층: 통합 검색창 + 3대 카테고리 탭 + 1줄 추천 칩 / 2층: 접이식 브리핑 보드 아코디언 */}
          <VoiceHeroStage />

          {/* 검색 결과 영역 */}
          <div id="saysee-search-results" className="scroll-mt-20">
            {searchSpace === 'video' ? (
              <section className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-bold">
                      🎬 “{activeQuery}” 타임라인 구간 검색 결과
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-medium">
                      {matchedVideoScenes.length}개 영상 매칭 · 클릭 시 포착된 초(Sec) 즉시 재생
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {matchedVideoScenes.length < videoSceneItems.length && (
                      <button
                        onClick={() => setSearchSpace('video')}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-primary-container font-label-sm text-[12px] font-bold border border-white/10"
                      >
                        🔄 동영상 {videoSceneItems.length}개 전체 보기
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
                      검색어 팩트와 무관한 동영상을 억지로 끼워 넣지 않습니다. 아래 버튼을 눌러 해부된 동영상 {videoSceneItems.length}개 전체 구간을 확인해 보세요.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearchSpace('video')}
                      className="mt-1 px-4 py-2 rounded-lg bg-primary-container text-zinc-950 font-label-md text-[12.5px] font-extrabold"
                    >
                      🎬 동영상 {videoSceneItems.length}개 전 구간 전체 보기
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
                              📍 {vid.locationKo}
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
                      📁 “{activeQuery}” 스마트 서류함 검색 결과
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-medium">
                      로컬 문서 {matchedLocalDocs.length}건 + 촬영 서류 {searchResults.length}장
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
                      📄 폰·PC 로컬 문서 파일 (PDF · TXT · DOCX — {matchedLocalDocs.length}건)
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
                    📸 갤러리 내 촬영·캡처 서류 자산 ({searchResults.length}장)
                  </span>

                  {searchResults.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                      {searchResults.map((item) => (
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

      {/* ─────────────── 탭 2: 🧹 주치의 정리 ─────────────── */}
      {desktopTab === 'trash' && <SmartTrashView />}

      {/* ─────────────── 탭 3: ⚙️ 내 기기 & 백업 (클라우드 대체 프라이빗 싱크) ─────────────── */}
      {desktopTab === 'sync' && (
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-5 md:px-8 py-7 flex flex-col gap-5">
          <div className="p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 border border-white/10 text-primary-container font-label-sm text-[11.5px] font-bold">
                폰↔PC 프라이빗 싱크 센터
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-400 font-label-sm text-[11.5px]">
                무거운 원본 외부 미전송 · 100% 내 기기 간 직접 일치화
              </span>
            </div>

            <h1 className="font-headline-md text-[22px] text-white font-bold tracking-tight">
              ⚙️ 클라우드 대체 ‘프라이빗 싱크’ 2-Track 전략 선택
            </h1>

            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-white/10 flex items-center gap-3">
              <span className="material-symbols-outlined text-zinc-400 text-[20px] shrink-0">
                battery_charging_full
              </span>
              <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
                <strong>배터리 · OS 제재 방어 원칙:</strong> 세이씨 모바일 에이전트(1MB APK)는 상시 백그라운드 통신을 하지 않으며,{' '}
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
                ⚡ 집 PC 전원이 꺼져 있어도 밖에서 내 폰으로 0.04초 만에 100% 검색·열람 가능
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
