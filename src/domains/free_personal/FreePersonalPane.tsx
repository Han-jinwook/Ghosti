import React, { useMemo, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import {
  cleanVideoTimestampLabel,
  groupBurstSearchResults,
  resolveVideoCardThumbUrl,
} from '../../services/aiEngine';
import { executeRealOsAction } from '../../services/setupMonsterEngine';
import { VoiceHeroStage } from '../../components/VoiceHeroStage';
import { SmartTrashView } from '../../components/SmartTrashView';
import {
  Stage1MinimalCarePreview,
  Stage1MinimalSearchPreview,
} from '../../components/Stage1MinimalPreview';
import {
  LoungeFeedContextBanner,
  LoungeIndexingWaitingRoom,
  LoungeView,
} from '../../components/LoungeView';
import { renderHighlightedDocText } from '../../components/PricingModal';
import { GhostSearchTrainingPage } from '../../components/ghostDojo/GhostSearchTrainingPage';
import { GhostSecretaryFirstGuard } from '../../components/GhostSecretaryFirstGuard';
import { useDashboardNavStore } from '../shared/dashboardNavState';

export const FreePersonalPane: React.FC<{
  ghostSearchWindowStage: 'small' | 'medium' | 'large' | null;
}> = ({ ghostSearchWindowStage }) => {
  const {
    desktopTab,
    activeLoungeType,
    activeFamilyRoom,
    searchSpace,
    resetSearchSpaceToAll,
    matchedLocalDocs,
    matchedVaultPhotos,
    setSelectedDocModal,
    videoSceneItems,
    matchedVideoScenes,
    setSelectedVideoModal,
    activeQuery,
    searchResults,
    groupBurstsInSearch,
    setGroupBurstsInSearch,
    setSelectedPhoto,
    toggleBookmark,
    openLocalFolder,
    hasExecutedUserSearch,
  } = useSaySeeStore();

  const { setOcrModalPhoto } = useDashboardNavStore();

  const [isStage1MinimalPreview] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    if (new URLSearchParams(window.location.search).get('ghostSearchWindow')) return false;
    return !window.location.search.includes('preview=legacy');
  });

  const showCanvasResults = true;

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

  const collapsedBurstCount = searchResults.length - groupedResults.length;

  return (
    <>
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

                {matchedVideoScenes.length > 0 && (
                  <div className="px-3.5 py-2.5 rounded-xl bg-teal-950/60 border border-teal-400/40 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[12px] text-teal-200 font-bold">
                      👻 화면 속 글자(자막·문서·칠판)가 찍힌 영상은 우측 하단 <strong className="text-teal-300">[📝 글자 뽑기]</strong>를 누르면 1초 만에 텍스트로 쏙 뽑아 복사할 수 있어요!
                    </span>
                  </div>
                )}

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
                      const isWholeClip = (vid.matchedSeekSec ?? 0) <= 0;
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
                              {isWholeClip ? '🎯 전 구간 일치 (00:00~)' : `🎯 ${cleanTs} 장면 포착`}
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

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10 font-label-mono text-[11px] text-zinc-400">
                            <span>{vid.date}</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  try {
                                    sessionStorage.setItem('ghosti_auto_extract_video_ocr', vid.id);
                                  } catch {
                                    /* ignore */
                                  }
                                  setSelectedVideoModal(vid, vid.matchedSeekSec);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-400 text-teal-200 hover:text-zinc-950 border border-teal-400/50 font-label-sm text-[11px] font-black transition cursor-pointer"
                              >
                                📝 글자 뽑기
                              </button>
                              <span className="text-primary-container font-bold">
                                {hasExecutedUserSearch && activeQuery
                                  ? isWholeClip
                                    ? '▶ 처음부터 재생'
                                    : `▶ ${cleanTs} 재생`
                                  : '▶ 재생'}
                              </span>
                            </div>
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

                            {isBurst ? (
                              <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-zinc-950/85 backdrop-blur-md border border-white/15 text-primary-container font-label-sm text-[10.5px] font-bold flex items-center gap-1">
                                <span>❐ {group.burstCount}장 연사</span>
                              </div>
                            ) : item.photo.uploaderLabel && (activeLoungeType === 'family' || activeLoungeType === 'club') ? (
                              <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-zinc-950/85 backdrop-blur-md border border-teal-400/40 text-teal-300 font-label-sm text-[10.5px] font-bold flex items-center gap-1">
                                <span>{item.photo.uploaderLabel.includes('방장') ? '👑' : '📸'} {item.photo.uploaderLabel}</span>
                              </div>
                            ) : null}

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
                              title="별도 독립 사진·OCR 창(창 UI ③)을 열어 글자·표·단어칩을 추출합니다"
                              className="absolute bottom-10 right-2.5 z-10 px-2.5 py-1 rounded-lg bg-zinc-950/90 hover:bg-teal-400 text-teal-200 hover:text-zinc-950 border border-teal-400/60 font-label-sm text-[11px] font-black shadow-md transition-all cursor-pointer"
                            >
                              📝 OCR
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

    </>
  );
};
