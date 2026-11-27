import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { getZCoreUrl, zCoreBridge } from '../../services/zCoreBridge';
import { hasAuthenticatedHubAccountSession } from '../../services/supabaseClient';
import {
  cleanVideoTimestampLabel,
  groupBurstSearchResults,
  resolveVideoCardThumbUrl,
} from '../../services/aiEngine';
import { VoiceHeroStage } from '../../components/VoiceHeroStage';
import { Stage1MinimalSearchPreview } from '../../components/Stage1MinimalPreview';
import {
  LoungeFeedContextBanner,
  LoungeView,
} from '../../components/LoungeView';
import {
  buildDocPreviewSnippet,
  renderHighlightedDocText,
  maskSensitiveDocText,
} from '../../components/PricingModal';
import { openLocalDocWithMissingGuard } from '../../components/searchModals/docAndVideoFormatUtils';
import { GhostSearchTrainingPage } from '../../components/ghostDojo/GhostSearchTrainingPage';
import { GhostSecretaryFirstGuard } from '../../components/GhostSecretaryFirstGuard';
import { useDashboardNavStore } from '../shared/dashboardNavState';
import { SampleSharedRoomExperienceCard } from '../free_photo_share/SampleSharedRoomExperienceCard';
import {
  evaluateSharedPhotoDeletePermission,
  readHostRetainsHidePermission,
  resolveCurrentUserIdentityTokens,
} from '../free_photo_share/FreePhotoShareLounge';

/** 클라우드 전용 사진(G: 구글 드라이브 등) 썸네일을 받을 수 없을 때 표시하는 구름 자리표시 (원본 다운로드 폴백 금지) */
const CLOUD_ONLY_PHOTO_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" fill="#18181b"/><path d="M42 60h38a12 12 0 0 0 1-24 17 17 0 0 0-32-4 13 13 0 0 0-7 28z" fill="none" stroke="#a1a1aa" stroke-width="3" stroke-linejoin="round"/></svg>'
)}`;

export const GhostSearchPane: React.FC<{
  ghostSearchWindowStage: 'small' | 'medium' | 'large' | null;
}> = ({ ghostSearchWindowStage }) => {
  const {
    desktopTab,
    activeLoungeType,
    activeFamilyRoom,
    activeJoinedRoomMeta,
    merlinAuth,
    searchSpace,
    resetSearchSpaceToAll,
    matchedLocalDocs,
    matchedVaultPhotos,
    setSelectedDocModal,
    videoSceneItems,
    matchedVideoScenes,
    setSelectedVideoModal,
    activeQuery,
    photos,
    searchResults,
    groupBurstsInSearch,
    setGroupBurstsInSearch,
    setSelectedPhoto,
    toggleBookmark,
    softDeleteSharedRoomPhoto24h,
    restoreSharedRoomPhotoFromTrash,
    lastSoftDeletedSharedPhoto,
    clearLastSoftDeletedSharedPhoto,
    sharedRoomSoftDeletedMap,
    sharedRoomAddedPhotos,
    sharedRoomHostPhotos,
    joinedSharedRooms,
    setDesktopTab,
    openLocalFolder,
    hasExecutedUserSearch,
    refreshLiveLocalFilesInSearchWindow,
  } = useSaySeeStore();

  const currentIdentityTokens = useMemo(
    () => resolveCurrentUserIdentityTokens(merlinAuth?.email),
    [merlinAuth?.email]
  );

  const { setOcrModalPhoto } = useDashboardNavStore();
  const lastWatchSigRef = useRef<string>('');
  const watchRefreshInflightRef = useRef<boolean>(false);
  const queuedReprobeRef = useRef<boolean>(false);

  useEffect(() => {
    const isSearchSurfaceActive =
      Boolean(ghostSearchWindowStage) ||
      (desktopTab === 'dashboard' && activeLoungeType === 'personal');
    if (!isSearchSurfaceActive || typeof window === 'undefined') return;
    let cancelled = false;

    const probeWatchSig = async () => {
      if (cancelled || !zCoreBridge.isConnected) {
        return;
      }
      if (watchRefreshInflightRef.current) {
        // 직전 파일 생성(예: '새 텍스트 문서.txt') 갱신 도중 이름 변경·메모장 저장이 연속 발생한 경우 절대 유실하지 않고 직후 즉시 재조회!
        queuedReprobeRef.current = true;
        return;
      }
      try {
        const ctrl = new AbortController();
        const tid = window.setTimeout(() => ctrl.abort(), 3000);
        const res = await fetch(getZCoreUrl('/__zcore/watch-sig'), {
          cache: 'no-store',
          signal: ctrl.signal,
        }).finally(() => window.clearTimeout(tid));
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as { ok?: boolean; sig?: string };
        if (cancelled || !data?.ok || !data.sig) return;
        if (!lastWatchSigRef.current) {
          lastWatchSigRef.current = data.sig;
          return;
        }
        if (data.sig !== lastWatchSigRef.current) {
          const targetSig = data.sig;
          watchRefreshInflightRef.current = true;
          try {
            const refreshedOk = await refreshLiveLocalFilesInSearchWindow();
            if (refreshedOk !== false) {
              lastWatchSigRef.current = targetSig;
            }
          } finally {
            watchRefreshInflightRef.current = false;
            if (!cancelled && queuedReprobeRef.current) {
              queuedReprobeRef.current = false;
              void probeWatchSig();
            }
          }
        }
      } catch {
        /* ignore transient poll error */
      }
    };

    void probeWatchSig();
    const unsubZCore = zCoreBridge.subscribe((connected) => {
      if (connected) void probeWatchSig();
    });
    const intervalId = window.setInterval(() => {
      void probeWatchSig();
    }, 650);
    const onImmediateWake = () => {
      void probeWatchSig();
    };
    window.addEventListener('focus', onImmediateWake);
    window.addEventListener('pointerenter', onImmediateWake);
    document.addEventListener('mouseenter', onImmediateWake);
    document.addEventListener('visibilitychange', onImmediateWake);
    return () => {
      cancelled = true;
      unsubZCore();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onImmediateWake);
      window.removeEventListener('pointerenter', onImmediateWake);
      document.removeEventListener('mouseenter', onImmediateWake);
      document.removeEventListener('visibilitychange', onImmediateWake);
    };
  }, [ghostSearchWindowStage, desktopTab, activeLoungeType, refreshLiveLocalFilesInSearchWindow]);

  const [isStage1MinimalPreview] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    if (new URLSearchParams(window.location.search).get('ghostSearchWindow')) return false;
    return !window.location.search.includes('preview=legacy');
  });

  const showCanvasResults = true;

  const groupedResults = useMemo(() => {
    const isSharedLounge =
      activeLoungeType === 'family' ||
      activeLoungeType === 'club' ||
      activeLoungeType === 'student';
    if (isSharedLounge) {
      return searchResults.map((item) => ({
        representative: item,
        burstPhotos: [item.photo],
        burstCount: 1,
      }));
    }
    const orderedGroups = groupBurstSearchResults(searchResults, photos);
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
  }, [searchResults, photos, groupBurstsInSearch, searchSpace, hasExecutedUserSearch, activeLoungeType]);

  const collapsedBurstCount = searchResults.length - groupedResults.length;

  const [visiblePhotoLimit, setVisiblePhotoLimit] = useState<number>(48);
  const [visibleDocLimit, setVisibleDocLimit] = useState<number>(36);
  const photoMoreRef = useRef<HTMLDivElement | null>(null);
  const docMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisiblePhotoLimit(48);
    setVisibleDocLimit(36);
  }, [activeQuery, searchSpace, activeLoungeType, activeFamilyRoom]);

  useEffect(() => {
    const el = photoMoreRef.current;
    if (!el || visiblePhotoLimit >= groupedResults.length) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisiblePhotoLimit((prev) => Math.min(groupedResults.length, prev + 48));
        }
      },
      { rootMargin: '360px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visiblePhotoLimit, groupedResults.length]);

  useEffect(() => {
    const el = docMoreRef.current;
    if (!el || visibleDocLimit >= matchedLocalDocs.length) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleDocLimit((prev) => Math.min(matchedLocalDocs.length, prev + 36));
        }
      },
      { rootMargin: '360px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleDocLimit, matchedLocalDocs.length]);

  const visibleGroupedResults = useMemo(
    () => groupedResults.slice(0, visiblePhotoLimit),
    [groupedResults, visiblePhotoLimit]
  );
  const visibleMatchedDocs = useMemo(
    () => matchedLocalDocs.slice(0, visibleDocLimit),
    [matchedLocalDocs, visibleDocLimit]
  );

  return (
    <>
      {desktopTab === 'trial' && activeLoungeType === 'work' && (
        <GhostSecretaryFirstGuard>
          <LoungeView />
        </GhostSecretaryFirstGuard>
      )}

      {ghostSearchWindowStage ? (
        <div className="flex-1 min-h-0 flex overflow-hidden bg-white">
          <div className="flex-1 min-w-0 h-full overflow-y-auto">
            <Stage1MinimalSearchPreview
              initialQuery={
                typeof window !== 'undefined'
                  ? new URLSearchParams(window.location.search).get('q') || ''
                  : ''
              }
            />
          </div>
        </div>
      ) : (
        (desktopTab === 'dashboard' ||
          (desktopTab === 'trial' && activeLoungeType !== 'work')) &&
        (activeLoungeType === 'personal' && isStage1MinimalPreview ? (
          <GhostSearchTrainingPage />
        ) : (
          <GhostSecretaryFirstGuard>
            <main className="flex-1 w-full max-w-[1320px] mx-auto px-4 sm:px-6 md:px-10 py-6 sm:py-8 flex flex-col gap-6">
              {activeLoungeType === 'work' ? (
                <LoungeFeedContextBanner />
              ) : (
                <>
                  <div className="w-full flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2.5 px-0.5">
                      <h1 className="text-[20px] md:text-[22px] text-slate-900 font-bold tracking-tight">
                        {activeLoungeType === 'personal'
                          ? '내 기기 검색'
                          : activeLoungeType === 'family'
                          ? `${activeFamilyRoom} 가족 사진방`
                          : activeLoungeType === 'club'
                          ? '동호회 · 모임 사진방'
                          : '동창회 사진방'}
                      </h1>
                      {activeLoungeType === 'personal' && (
                        <div className="hidden sm:inline-flex items-center gap-2.5 px-3 py-1 rounded-xl bg-white border border-slate-200">
                          <span className="text-[12px] font-semibold text-slate-600 tracking-tight">
                            귀신검색 호출 단축키
                          </span>
                          <span className="h-3.5 w-px bg-slate-200" />
                          <img
                            src="/ghostkey_shortcut_badge.png"
                            alt="Ctrl+0 / Ctrl+우클릭"
                            className="h-6 w-auto object-contain select-none"
                          />
                        </div>
                      )}
                    </div>

                    <LoungeFeedContextBanner />

                    <VoiceHeroStage />
                  </div>

                  {showCanvasResults && (
                    <div id="ghosti-search-results" className="scroll-mt-20">
                      {searchSpace === 'video' ? (
                        <section className="flex flex-col gap-4">
                          <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-[16px] md:text-[17px] text-slate-900 font-bold">
                                {hasExecutedUserSearch && activeQuery
                                  ? `“${activeQuery}” 동영상 검색 결과`
                                  : '동영상'}
                              </h2>
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[12px] font-medium">
                                {matchedVideoScenes.length}건
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {matchedVideoScenes.length < videoSceneItems.length && (
                                <button
                                  onClick={() => resetSearchSpaceToAll('video')}
                                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium border border-slate-200 cursor-pointer"
                                >
                                  전체 {videoSceneItems.length}개 보기
                                </button>
                              )}
                              <button
                                onClick={() => void openLocalFolder('videos', matchedVideoScenes[0]?.fullPath)}
                                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium border border-slate-200 flex items-center gap-1.5 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[15px]">folder_open</span>
                                <span>폴더 열기</span>
                              </button>
                            </div>
                          </div>

                          {matchedVideoScenes.length === 0 ? (
                            <div className="p-10 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center gap-2.5">
                              <span className="material-symbols-outlined text-slate-400 text-[32px]">
                                videocam_off
                              </span>
                              <h3 className="text-[15px] text-slate-800 font-semibold">
                                “{activeQuery}” 조건과 일치하는 동영상 구간이 없습니다.
                              </h3>
                              <p className="text-[12.5px] text-slate-500 max-w-md">
                                상단 탭에서 사진({searchResults.length})이나 문서({matchedLocalDocs.length + matchedVaultPhotos.length}) 결과를 확인하거나 전체 동영상을 볼 수 있습니다.
                              </p>
                              <button
                                type="button"
                                onClick={() => resetSearchSpaceToAll('video')}
                                className="mt-1 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[12.5px] font-semibold cursor-pointer"
                              >
                                전체 동영상 보기 ({videoSceneItems.length})
                              </button>
                            </div>
                          ) : (
                            <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1">
                              {matchedVideoScenes.map((vid, vIdx) => {
                                const cardThumbUrl = resolveVideoCardThumbUrl(vid);
                                const isWholeClip = (vid.matchedSeekSec ?? 0) <= 0;
                                const cleanTs = cleanVideoTimestampLabel(vid.matchedTimestamp);
                                return (
                                  <article
                                    key={vid.id}
                                    onClick={() => setSelectedVideoModal(vid, vid.matchedSeekSec)}
                                    className="min-w-[85%] sm:min-w-[340px] md:min-w-0 snap-center group rounded-xl overflow-hidden bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 flex flex-col cursor-pointer transition-colors"
                                  >
                                    <div data-keep-dark="true" className="relative aspect-video w-full overflow-hidden bg-black">
                                      {cardThumbUrl ? (
                                        <img
                                          key={cardThumbUrl}
                                          crossOrigin={cardThumbUrl.startsWith('http://127.0.0.1') ? 'anonymous' : undefined}
                                          src={cardThumbUrl}
                                          alt={vid.title}
                                          loading={vIdx < 8 ? 'eager' : 'lazy'}
                                          decoding="async"
                                          onLoad={(e) => {
                                            (e.currentTarget as HTMLElement).style.display = '';
                                          }}
                                          onError={(e) => {
                                            const imgEl = e.currentTarget;
                                            if (!imgEl.dataset.retried && cardThumbUrl) {
                                              imgEl.dataset.retried = '1';
                                              const sep = cardThumbUrl.includes('?') ? '&' : '?';
                                              imgEl.src = `${cardThumbUrl}${sep}r=${Date.now()}`;
                                              return;
                                            }
                                            imgEl.style.display = 'none';
                                          }}
                                          className="w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-300"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-400 gap-1.5 p-4 text-center">
                                          <span className="material-symbols-outlined text-3xl text-zinc-400">movie</span>
                                          <span className="text-[11px] font-medium text-zinc-400 truncate max-w-[80%]">{vid.title}</span>
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                        <div className="w-10 h-10 rounded-full bg-black/70 border border-white/25 text-white flex items-center justify-center">
                                          <span className="material-symbols-outlined text-[24px]">play_arrow</span>
                                        </div>
                                      </div>

                                      {hasExecutedUserSearch && activeQuery && (
                                        <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/80 text-white text-[11px] font-semibold">
                                          {isWholeClip ? '00:00~' : `${cleanTs} 구간`}
                                        </div>
                                      )}

                                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                                        {vid.hasScreenOcrText && (
                                          <span className="px-2 py-0.5 rounded bg-black/75 text-white text-[10.5px] font-medium">
                                            화면 글자 포함
                                          </span>
                                        )}
                                        <span className="px-2 py-0.5 rounded bg-black/80 text-white text-[11px] font-medium tabular-nums">
                                          {vid.durationText}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="p-3.5 flex flex-col gap-2 flex-1 justify-between">
                                      <div className="flex flex-col gap-1.5">
                                        <h3 className="text-[14.5px] text-slate-900 font-semibold leading-snug">
                                          {renderHighlightedDocText(
                                            vid.title,
                                            hasExecutedUserSearch ? activeQuery : ''
                                          )}
                                        </h3>

                                        {hasExecutedUserSearch && activeQuery && (
                                          <p className="text-[12px] text-slate-600 leading-snug line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                            {renderHighlightedDocText(
                                              vid.matchedFrameCaption,
                                              activeQuery
                                            )}
                                          </p>
                                        )}
                                      </div>

                                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11.5px] text-slate-500">
                                        <span>{vid.date}</span>
                                        <span className="text-slate-800 font-semibold">
                                          {hasExecutedUserSearch && activeQuery
                                            ? isWholeClip
                                              ? '처음부터 재생'
                                              : `${cleanTs}부터 재생`
                                            : '재생'}
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
                              <h2 className="text-[16px] md:text-[17px] text-slate-900 font-bold">
                                {hasExecutedUserSearch && activeQuery
                                  ? `“${activeQuery}” 문서 검색 결과`
                                  : '문서'}
                              </h2>
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[12px] font-medium">
                                {matchedVaultPhotos.length > 0
                                  ? `문서 ${matchedLocalDocs.length}건 · 촬영 서류 ${matchedVaultPhotos.length}장`
                                  : `${matchedLocalDocs.length}건`}
                              </span>
                            </div>

                            <button
                              onClick={() => void openLocalFolder('docs')}
                              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium border border-slate-200 flex items-center gap-1.5 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[15px]">folder_open</span>
                              <span>문서 폴더 열기</span>
                            </button>
                          </div>

                          {hasExecutedUserSearch &&
                            activeQuery &&
                            matchedLocalDocs.length > 0 &&
                            matchedLocalDocs.every((d) => d.matchType === 'SIMILAR') && (
                              <div className="px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-[12.5px] font-medium">
                                {matchedLocalDocs[0].similarityNoticeKo ||
                                  '정확히 일치하는 문서가 없어 유사한 문서를 표시합니다.'}
                              </div>
                            )}

                          {matchedLocalDocs.length > 0 && (
                            <div className="flex flex-col gap-2.5">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pb-1">
                                {visibleMatchedDocs.map((doc) => (
                                  <article
                                    key={doc.id}
                                    onClick={() => setSelectedDocModal(doc)}
                                    className="p-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 flex flex-col justify-between gap-3 cursor-pointer transition-colors"
                                  >
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[10.5px] font-semibold">
                                            {doc.ext}
                                          </span>
                                          <span className="text-slate-500 text-[11.5px]">
                                            {doc.categoryBadge}
                                          </span>
                                        </div>
                                        <span className="text-[11px] text-slate-400">
                                          {doc.deviceSource}
                                        </span>
                                      </div>

                                      <h4 className="text-[14.5px] text-slate-900 font-semibold leading-snug">
                                        {renderHighlightedDocText(
                                          doc.title,
                                          hasExecutedUserSearch ? activeQuery : '',
                                          doc.matchedQueryTokens
                                        )}
                                      </h4>

                                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                        <p className="text-[12px] text-slate-600 line-clamp-3 leading-relaxed m-0 p-0">
                                          {renderHighlightedDocText(
                                            maskSensitiveDocText(
                                              hasExecutedUserSearch && activeQuery
                                                ? buildDocPreviewSnippet(
                                                    doc.extractedText,
                                                    activeQuery,
                                                    180,
                                                    doc.matchedQueryTokens
                                                  )
                                                : doc.extractedText.slice(0, 220)
                                            ),
                                            hasExecutedUserSearch ? activeQuery : '',
                                            doc.matchedQueryTokens
                                          )}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11.5px] text-slate-500 gap-2">
                                      <span>{doc.date}</span>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void navigator.clipboard?.writeText(doc.extractedText);
                                            useSaySeeStore.setState({
                                              lastQuarantineToast: `[${doc.title}] 본문이 클립보드에 복사되었습니다.`,
                                            });
                                          }}
                                          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11.5px] font-medium transition-colors cursor-pointer"
                                        >
                                          복사
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void openLocalDocWithMissingGuard(doc);
                                          }}
                                          className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[11.5px] font-medium transition-colors cursor-pointer"
                                        >
                                          열기
                                        </button>
                                      </div>
                                    </div>
                                  </article>
                                ))}
                              </div>
                              {visibleDocLimit < matchedLocalDocs.length && (
                                <div ref={docMoreRef} className="h-4 w-full" aria-hidden="true" />
                              )}
                            </div>
                          )}

                          {matchedVaultPhotos.length > 0 && (
                            <div className="flex flex-col gap-2.5">
                              <span className="text-[13px] text-slate-600 font-semibold px-0.5">
                                촬영 · 캡처 서류 ({matchedVaultPhotos.length}장)
                              </span>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                                {matchedVaultPhotos.map((item) => (
                                  <article
                                    key={item.photo.id}
                                    onClick={() => setSelectedPhoto(item.photo, null)}
                                    className="group relative rounded-xl overflow-hidden bg-slate-100 border border-slate-200 hover:border-slate-300 flex flex-col cursor-pointer transition-colors"
                                  >
                                    <div data-keep-dark="true" className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-950">
                                      <img
                                        src={item.photo.thumbUrl}
                                        alt={item.photo.name}
                                        crossOrigin={item.photo.thumbUrl?.startsWith('http://127.0.0.1') ? 'anonymous' : undefined}
                                        loading="lazy"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                      />
                                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 text-white text-[10.5px] font-medium">
                                        {item.photo.vaultCategoryLabel || item.photo.tags[0] || '촬영 서류'}
                                      </div>
                                      <div className="absolute inset-x-0 bottom-0 h-[22%] min-h-[40px] px-2.5 pb-2 pt-4 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex items-end justify-between pointer-events-none">
                                        <span className="text-[11px] font-medium text-white whitespace-nowrap shrink-0">
                                          {item.photo.date.split(' ')[0]}
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
                        <section className="flex flex-col gap-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-[16px] md:text-[17px] text-slate-900 font-bold">
                                {hasExecutedUserSearch && activeQuery
                                  ? `“${activeQuery}” 검색 결과`
                                  : '사진'}
                              </h2>
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[12px] font-medium">
                                {searchResults.length}장
                                {groupBurstsInSearch && collapsedBurstCount > 0
                                  ? ' · 연사 묶음 포함'
                                  : ''}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {(() => {
                                if (
                                  activeLoungeType !== 'family' &&
                                  activeLoungeType !== 'club' &&
                                  activeLoungeType !== 'student'
                                ) {
                                  return null;
                                }
                                const trashedCount = Object.keys(sharedRoomSoftDeletedMap || {}).filter(
                                  (pid) =>
                                    sharedRoomAddedPhotos.some((p) => p.id === pid) ||
                                    sharedRoomHostPhotos.some((p) => p.id === pid)
                                ).length;
                                if (trashedCount <= 0) return null;
                                return (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      try {
                                        sessionStorage.setItem(
                                          'ghosti_scroll_shared_trash_once',
                                          '1'
                                        );
                                      } catch {
                                        /* ignore */
                                      }
                                      setDesktopTab('trash');
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12px] font-medium transition-colors cursor-pointer"
                                  >
                                    휴지통 · 숨긴 사진 ({trashedCount}장)
                                  </button>
                                );
                              })()}
                              {(() => {
                                // [확정 ④] [⤢ 크게(갤러리)] 인물 검색 시 가족방 연결 버튼 (기존 방 유무 자동 분기)
                                if (activeLoungeType !== 'personal' || !hasExecutedUserSearch || !activeQuery) {
                                  return null;
                                }
                                const isPersonQuery = Boolean(
                                  searchResults.some((r) => (r as unknown as { matchedBy?: string }).matchedBy === 'face' || ((r.photo as unknown as { face_person_names?: string[] }).face_person_names && (r.photo as unknown as { face_person_names?: string[] }).face_person_names!.length > 0)) ||
                                  photos.some((p) => (p as unknown as { face_person_names?: string[] }).face_person_names && (p as unknown as { face_person_names?: string[] }).face_person_names!.some((fn: string) => activeQuery.includes(fn)))
                                );
                                if (!isPersonQuery) return null;

                                const hasExistingFamilyRoom = Boolean(activeJoinedRoomMeta || joinedSharedRooms.length > 0 || (sharedRoomAddedPhotos && sharedRoomAddedPhotos.length > 0));
                                const targetRoomName = (activeJoinedRoomMeta as unknown as { customTitle?: string; room_title?: string; title?: string })?.customTitle || (activeJoinedRoomMeta as unknown as { room_title?: string })?.room_title || activeFamilyRoom || '우리집';
                                const btnText = hasExistingFamilyRoom
                                  ? `👨‍👩‍👧‍👦 '${targetRoomName}' 가족방에 담기`
                                  : '👨‍👩‍👧‍👦 이 사진들로 가족방 만들기';

                                const handleAddToFamilyRoom = async () => {
                                  try {
                                    const currentRoomPhotos = sharedRoomAddedPhotos || [];
                                    const existingPhotoIds = new Set(currentRoomPhotos.map((p) => p.id));
                                    const existingHashes = new Set(
                                      currentRoomPhotos.map((p) => (p as { dhash?: string; image_hash?: string }).dhash || (p as { dhash?: string; image_hash?: string }).image_hash).filter(Boolean)
                                    );

                                    let addedCount = 0;
                                    let skippedCount = 0;
                                    const toAdd: typeof searchResults[0]['photo'][] = [];

                                    for (const item of searchResults) {
                                      const p = item.photo;
                                      const pHash = (p as { dhash?: string; image_hash?: string }).dhash || (p as { dhash?: string; image_hash?: string }).image_hash;
                                      if (existingPhotoIds.has(p.id) || (pHash && existingHashes.has(pHash))) {
                                        skippedCount++;
                                      } else {
                                        addedCount++;
                                        toAdd.push(p);
                                        if (pHash) existingHashes.add(pHash);
                                        existingPhotoIds.add(p.id);
                                      }
                                    }

                                    if (toAdd.length > 0) {
                                      useSaySeeStore.setState((prev) => ({
                                        sharedRoomAddedPhotos: [...(prev.sharedRoomAddedPhotos || []), ...toAdd],
                                      }));
                                    }

                                    useSaySeeStore.setState({
                                      lastQuarantineToast: `새 사진 ${addedCount}장 추가 · 이미 있는 ${skippedCount}장 자동 제외되었습니다!`,
                                      activeLoungeType: 'family',
                                    });
                                  } catch {
                                    useSaySeeStore.setState({
                                      lastQuarantineToast: '가족방 사진 담기에 실패했습니다.',
                                    });
                                  }
                                };

                                return (
                                  <button
                                    type="button"
                                    onClick={() => void handleAddToFamilyRoom()}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                                  >
                                    <span>{btnText}</span>
                                  </button>
                                );
                              })()}
                              <button
                                onClick={() => setGroupBurstsInSearch(!groupBurstsInSearch)}
                                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors cursor-pointer ${
                                  groupBurstsInSearch
                                    ? 'bg-slate-900 border-slate-900 text-white'
                                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                                }`}
                              >
                                {groupBurstsInSearch ? '연사 묶어보기 켜짐' : '연사 펼쳐보기'}
                              </button>
                            </div>
                          </div>

                          {lastSoftDeletedSharedPhoto &&
                            (activeLoungeType === 'family' ||
                              activeLoungeType === 'club' ||
                              activeLoungeType === 'student') && (
                              <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[12px] text-slate-700">
                                <span>
                                  {lastSoftDeletedSharedPhoto.mode === 'host_hide'
                                    ? '사진을 공유방에서 숨김 처리해 [공유방 휴지통]으로 옮겼습니다. (내 기기 원본 안전)'
                                    : '사진을 삭제해 [공유방 휴지통]으로 옮겼습니다. (내 기기 원본 안전)'}
                                </span>
                                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      restoreSharedRoomPhotoFromTrash(
                                        lastSoftDeletedSharedPhoto.photoId
                                      )
                                    }
                                    className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-[11.5px] font-semibold cursor-pointer"
                                  >
                                    1초 복원
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      try {
                                        sessionStorage.setItem(
                                          'ghosti_scroll_shared_trash_once',
                                          '1'
                                        );
                                      } catch {
                                        /* ignore */
                                      }
                                      setDesktopTab('trash');
                                    }}
                                    className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11.5px] font-medium cursor-pointer"
                                  >
                                    공유방 휴지통 바로가기
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => clearLastSoftDeletedSharedPhoto()}
                                    className="px-1.5 py-1 text-slate-400 hover:text-slate-700 text-[11px] cursor-pointer"
                                  >
                                    닫기
                                  </button>
                                </div>
                              </div>
                            )}

                          {groupedResults.length > 0 ? (
                            <>
                              <div
                                className={
                                  groupedResults.length <= 16
                                    ? 'grid grid-cols-2 sm:grid-cols-4 gap-3.5'
                                    : 'grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5'
                                }
                              >
                                {visibleGroupedResults.map((group, gIdx) => {
                                  const item = group.representative;
                                  const isBurst = group.burstCount >= 2;
                                  const cleanUploader = (item.photo.uploaderLabel || '').replace(/^[👑📸\s]+/u, '');
                                  return (
                                    <article
                                      key={item.photo.id}
                                      onClick={() =>
                                        setSelectedPhoto(item.photo, isBurst ? group.burstPhotos : null)
                                      }
                                      className="group relative rounded-xl overflow-hidden bg-slate-100 border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer flex flex-col"
                                    >
                                      <div
                                        data-keep-dark="true"
                                        className={`relative ${
                                          groupedResults.length <= 16 ? 'aspect-[4/3]' : 'aspect-[4/5]'
                                        } w-full overflow-hidden bg-zinc-950`}
                                      >
                                        <img
                                          src={item.photo.thumbUrl}
                                          alt={item.photo.name}
                                          crossOrigin={item.photo.thumbUrl?.startsWith('http://127.0.0.1') ? 'anonymous' : undefined}
                                          loading={gIdx < 16 ? 'eager' : 'lazy'}
                                          decoding="async"
                                          onError={(e) => {
                                            const imgEl = e.currentTarget;
                                            if (item.photo.cloudOnly) {
                                              // 클라우드 전용 사진은 썸네일 실패 시 원본 전체 다운로드로 폴백하지 않고 구름 자리표시만 표시
                                              if (imgEl.dataset.retried !== 'cloud') {
                                                imgEl.dataset.retried = 'cloud';
                                                imgEl.src = CLOUD_ONLY_PHOTO_PLACEHOLDER;
                                              }
                                              return;
                                            }
                                            if (!imgEl.dataset.retried && item.photo.fullUrl && imgEl.src !== item.photo.fullUrl) {
                                              imgEl.dataset.retried = '1';
                                              imgEl.src = item.photo.fullUrl;
                                            } else if (imgEl.dataset.retried === '1' && item.photo.thumbUrl) {
                                              imgEl.dataset.retried = '2';
                                              const sep = item.photo.thumbUrl.includes('?') ? '&' : '?';
                                              imgEl.src = `${item.photo.thumbUrl}${sep}r=${Date.now()}`;
                                            }
                                          }}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />

                                        {isBurst ? (
                                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 text-white text-[10.5px] font-semibold">
                                            ❐ {group.burstCount}장 연사
                                          </div>
                                        ) : cleanUploader &&
                                          (activeLoungeType === 'family' ||
                                            activeLoungeType === 'club' ||
                                            activeLoungeType === 'student') ? (
                                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 text-white text-[10.5px] font-medium">
                                            {cleanUploader}
                                          </div>
                                        ) : null}

                                        {(String(item.photo.id || '').startsWith('shared_sb_') ||
                                          String(item.photo.id || '').startsWith('shared_added_')) &&
                                          hasAuthenticatedHubAccountSession() &&
                                          (() => {
                                            const delPerm = evaluateSharedPhotoDeletePermission({
                                              photoId: item.photo.id,
                                              uploaderLabel: item.photo.uploaderLabel,
                                              mtimeMs: item.photo.mtimeMs,
                                              isJoinedOtherRoom: Boolean(activeJoinedRoomMeta),
                                              hostRetainsHidePermission: readHostRetainsHidePermission(),
                                              currentIdentityTokens,
                                            });
                                            if (!delPerm.allowed) return null;
                                            return (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  softDeleteSharedRoomPhoto24h(
                                                    item.photo.id,
                                                    delPerm.mode === 'host_hide'
                                                      ? 'host_hide'
                                                      : 'uploader_24h'
                                                  );
                                                }}
                                                aria-label={
                                                  delPerm.mode === 'host_hide'
                                                    ? '공유방에서 숨기기'
                                                    : '공유방에서 삭제'
                                                }
                                                title={
                                                  delPerm.mode === 'host_hide'
                                                    ? '방장 권한으로 이 사진을 공유방에서 숨기고 휴지통으로 이동 (내 기기 원본 보존)'
                                                    : '내가 올린 사진 24시간 내 삭제 후 공유방 휴지통으로 이동 (내 기기 원본 보존)'
                                                }
                                                className="absolute top-2 right-11 z-20 px-2 py-0.5 rounded bg-black/75 hover:bg-rose-600 text-white text-[10.5px] font-semibold cursor-pointer transition-colors"
                                              >
                                                {delPerm.mode === 'host_hide' ? '숨기기' : '삭제'}
                                              </button>
                                            );
                                          })()}

                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleBookmark(item.photo.id);
                                          }}
                                          aria-label="즐겨찾기"
                                          title={item.photo.bookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                                          className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                                            item.photo.bookmarked
                                              ? 'bg-rose-600 text-white'
                                              : 'bg-black/60 text-white/85 hover:bg-black/80'
                                          }`}
                                        >
                                          <span
                                            className="material-symbols-outlined text-[15px]"
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
                                          title="사진에서 글자·표 추출 (OCR)"
                                          className="absolute bottom-9 right-2 z-10 px-2 py-0.5 rounded bg-black/75 hover:bg-black text-white text-[10.5px] font-semibold transition-colors cursor-pointer"
                                        >
                                          OCR
                                        </button>

                                        <div className="absolute inset-x-0 bottom-0 h-[22%] min-h-[40px] px-2.5 pb-2 pt-4 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex items-end justify-between gap-2 pointer-events-none">
                                          <span className="text-[11px] font-medium text-white whitespace-nowrap shrink-0">
                                            {item.photo.date.split(' ')[0]}
                                          </span>
                                          {item.photo.tags[0] && (
                                            <span className="text-[11px] text-zinc-200 truncate">
                                              {item.photo.tags[0]}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </article>
                                  );
                                })}
                              </div>
                              {visiblePhotoLimit < groupedResults.length && (
                                <div ref={photoMoreRef} className="h-4 w-full" aria-hidden="true" />
                              )}
                            </>
                          ) : !hasExecutedUserSearch &&
                            (activeLoungeType === 'family' ||
                              activeLoungeType === 'club' ||
                              activeLoungeType === 'student') ? (
                            <SampleSharedRoomExperienceCard
                              loungeType={activeLoungeType}
                              familyRoom={activeFamilyRoom}
                            />
                          ) : (
                            <div className="py-14 rounded-xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center gap-2">
                              <span className="material-symbols-outlined text-slate-400 text-[34px]">
                                image_search
                              </span>
                              <p className="text-[14.5px] text-slate-600 font-medium">
                                일치하는 사진을 찾지 못했습니다. 다른 단어로 검색해 보세요.
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
        ))
      )}
    </>
  );
};
