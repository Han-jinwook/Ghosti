import React, { useEffect, useMemo, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import type { PhotoItem } from '../../types/saysee';
import {
  cleanVideoTimestampLabel,
  groupBurstSearchResults,
  resolveVideoCardThumbUrl,
  stripCollisionKeySuffix,
} from '../../services/aiEngine';
import { executeRealOsAction } from '../../services/setupMonsterEngine';
import {
  buildDocPreviewSnippet,
  formatVideoCardOcrSummary,
  renderHighlightedDocText,
  resolveDocExtBadge,
  maskSensitiveDocText,
} from '../searchModals/docAndVideoFormatUtils';
import {
  requestConnectMyComputer,
  zCoreBridge,
} from '../../services/zCoreBridge';
import { SilentIndexingStatusBar } from '../SilentIndexingStatusBar';
import { isCapacitorNativeMobileRuntime } from '../../services/ghostiMobileCareBridge';
import { VoiceActorControlPill } from '../VoiceActorControlPill';
import { isMobileVoiceEnvironment, unlockMobileAudioOnUserGesture } from '../../services/setupMonsterTts';
import {
  SEARCH_STAGE_PC_ROLLING_PLACEHOLDERS_10,
  SEARCH_STAGE_MOBILE_ROLLING_PLACEHOLDERS_10,
  getAndAdvanceSessionPlaceholderStartIndex,
} from '../../services/weeklyCareAndPlaceholderEngine';
import { GhostPhotoOcrTeleportModal } from '../GhostPhotoOcrTeleportModal';
import { jumpToGhostSecretary } from '../GhostSecretaryFirstGuard';
import { GhostLabelerActionButton } from '../GhostLabelerActionButton';
import {
  DEMO_SEARCH_SAMPLE_DOCS_2,
  DEMO_SEARCH_SAMPLE_PHOTOS_2,
  DEMO_SEARCH_SAMPLE_VIDEOS_2,
} from './stage1DemoSamples';

const STAGE1_ROLLING_INTERVAL_MS = 180_000;

const Stage1IsolatedSearchInputForm: React.FC<{
  initialQuery: string;
  initialized: boolean;
  hasExecutedUserSearch: boolean;
  activeQuery: string;
  searchSpace: 'gallery' | 'video' | 'vault';
  searchPlaceholderPool: readonly string[];
  allowMobileVoice: boolean;
  isListening: boolean;
  clearSignal: number;
  onExecuteQuery: (q: string) => Promise<void>;
  onToggleMic: () => void;
}> = React.memo(
  ({
    initialQuery,
    initialized,
    hasExecutedUserSearch,
    activeQuery,
    searchSpace,
    searchPlaceholderPool,
    allowMobileVoice,
    isListening,
    clearSignal,
    onExecuteQuery,
    onToggleMic,
  }) => {
    const [textInput, setTextInput] = useState(() => {
      if (initialQuery && initialQuery.trim()) return initialQuery.trim();
      if (typeof window !== 'undefined') {
        const qParam = new URLSearchParams(window.location.search).get('q');
        if (qParam && qParam.trim()) return qParam.trim();
      }
      if (
        hasExecutedUserSearch &&
        activeQuery &&
        !activeQuery.startsWith('전체 갤러리 사진') &&
        !activeQuery.startsWith('동영상 ') &&
        !activeQuery.startsWith('최근 서류 ')
      ) {
        return activeQuery;
      }
      return '';
    });
    const [isInputFocused, setIsInputFocused] = useState(false);
    const consumedInitialQueryRef = React.useRef<string>('');
    const lastClearSignalRef = React.useRef<number>(clearSignal);

    useEffect(() => {
      if (clearSignal !== lastClearSignalRef.current) {
        lastClearSignalRef.current = clearSignal;
        setTextInput('');
      }
    }, [clearSignal]);

    useEffect(() => {
      const q = (initialQuery || '').trim();
      if (q && initialized && consumedInitialQueryRef.current !== q) {
        consumedInitialQueryRef.current = q;
        setTextInput(q);
        if (!hasExecutedUserSearch || activeQuery !== q) {
          void onExecuteQuery(q);
        }
        return;
      }
      if (
        !isInputFocused &&
        hasExecutedUserSearch &&
        activeQuery &&
        !activeQuery.startsWith('전체 갤러리 사진') &&
        !activeQuery.startsWith('동영상 ') &&
        !activeQuery.startsWith('최근 서류 ')
      ) {
        setTextInput(activeQuery);
      }
    }, [initialQuery, initialized, hasExecutedUserSearch, activeQuery, isInputFocused, onExecuteQuery]);

    const [rollingSearchIdx, setRollingSearchIdx] = useState<number>(() =>
      getAndAdvanceSessionPlaceholderStartIndex(10)
    );

    useEffect(() => {
      if (isInputFocused || textInput.trim().length > 0) return;
      const timer = window.setInterval(() => {
        setRollingSearchIdx((prev) => (prev + 1) % searchPlaceholderPool.length);
      }, STAGE1_ROLLING_INTERVAL_MS);
      return () => window.clearInterval(timer);
    }, [isInputFocused, textInput, searchPlaceholderPool.length]);

    const currentExampleSentence = useMemo(() => {
      return searchPlaceholderPool[rollingSearchIdx % searchPlaceholderPool.length];
    }, [searchPlaceholderPool, rollingSearchIdx]);

    const handleStepPlaceholder = (delta: -1 | 1) => {
      setRollingSearchIdx(
        (prev) => (prev + delta + searchPlaceholderPool.length) % searchPlaceholderPool.length
      );
    };

    const handleTextSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      unlockMobileAudioOnUserGesture();
      const fallbackExample = searchSpace === 'video' ? '바다 패러세일링' : currentExampleSentence;
      const q = (textInput.trim() || fallbackExample).trim();
      if (!q) return;
      setTextInput(q);
      await onExecuteQuery(q);
    };

    const handleRunExampleInstant = async () => {
      unlockMobileAudioOnUserGesture();
      const fallbackExample = searchSpace === 'video' ? '바다 패러세일링' : currentExampleSentence;
      const q = fallbackExample.trim();
      if (!q) return;
      setTextInput(q);
      await onExecuteQuery(q);
    };

    return (
      <form onSubmit={handleTextSubmit} className="w-full flex flex-wrap items-center gap-1.5 sm:gap-2">
        <div className="relative flex-1 min-w-[200px] flex items-center">
          <span className="material-symbols-outlined text-[19px] absolute left-3.5 pointer-events-none text-slate-400">
            {searchSpace === 'vault'
              ? 'folder_managed'
              : searchSpace === 'video'
              ? 'smart_display'
              : 'search'}
          </span>
          <input
            type="text"
            value={textInput}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={
              searchSpace === 'video'
                ? '영상 속 장면이나 화면 글자를 입력해 보세요'
                : `예) ${currentExampleSentence}`
            }
            className="w-full h-11 md:h-12 pl-10 pr-[92px] sm:pr-[240px] rounded-xl bg-white border border-slate-300 focus:border-slate-600 shadow-xs outline-none text-[13.5px] md:text-[14.5px] text-slate-900 placeholder:text-slate-400 transition-colors"
          />

          <div className="absolute right-1.5 inset-y-0 flex items-center gap-1">
            {!textInput.trim() ? (
              <div className="hidden sm:flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStepPlaceholder(-1)}
                  title="이전 예시"
                  className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-semibold flex items-center justify-center transition-colors cursor-pointer"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => handleStepPlaceholder(1)}
                  title="다음 예시"
                  className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-semibold flex items-center justify-center transition-colors cursor-pointer"
                >
                  ›
                </button>
                <button
                  type="button"
                  onClick={() => void handleRunExampleInstant()}
                  title="보이는 예시로 검색"
                  className="inline-flex items-center h-7.5 px-2.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11.5px] font-medium transition-colors whitespace-nowrap cursor-pointer"
                >
                  예시 검색
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setTextInput('')}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                title="지우기"
              >
                <span className="material-symbols-outlined text-[17px]">close</span>
              </button>
            )}
            <button
              type="submit"
              className="h-8.5 md:h-9 px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12.5px] font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              검색
            </button>
          </div>
        </div>

        {allowMobileVoice && (
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={onToggleMic}
              title="마이크로 말해서 검색"
              className={`h-10 px-3 rounded-xl border flex items-center gap-1 text-[12px] font-semibold shrink-0 whitespace-nowrap transition-colors cursor-pointer ${
                isListening
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isListening ? 'stop_circle' : 'mic'}
              </span>
              <span>{isListening ? '듣는 중' : '말하기'}</span>
            </button>
            <VoiceActorControlPill />
          </div>
        )}
      </form>
    );
  }
);

export const Stage1MinimalSearchPreview: React.FC<{
  initialQuery?: string;
  forceSampleOnly?: boolean;
}> = ({
  initialQuery = '',
  forceSampleOnly = false,
}) => {
  const store = useSaySeeStore();
  const {
    layout,
    searchSpace,
    setSearchSpace,
    resetSearchSpaceToAll,
    isListening,
    liveWaveBands,
    interimSttPreview,
    toggleMicRecording,
    runTextQuery,
    openLocalFolder,
    isStoreAppMode,
    setSelectedPhoto,
    setSelectedVideoModal,
    setSelectedDocModal,
    toggleBookmark,
  } = store;

  const [demoQuery, setDemoQuery] = useState<string>('');
  const [demoExecuted, setDemoExecuted] = useState<boolean>(false);

  const photos = forceSampleOnly ? DEMO_SEARCH_SAMPLE_PHOTOS_2 : store.photos;
  const videoSceneItems = forceSampleOnly ? DEMO_SEARCH_SAMPLE_VIDEOS_2 : store.videoSceneItems;
  const localDocuments = forceSampleOnly ? DEMO_SEARCH_SAMPLE_DOCS_2 : store.localDocuments;
  const initialized = forceSampleOnly ? true : store.initialized;
  const hasExecutedUserSearch = forceSampleOnly ? demoExecuted : store.hasExecutedUserSearch;

  const activeQuery = forceSampleOnly ? demoQuery : store.activeQuery;
  const matchedVaultPhotos = useMemo(
    () => (forceSampleOnly ? [] : store.matchedVaultPhotos),
    [forceSampleOnly, store.matchedVaultPhotos]
  );
  const searchResults = useMemo(() => {
    if (!forceSampleOnly) return store.searchResults;
    const q = demoQuery.trim().toLowerCase();
    const list = !q
      ? DEMO_SEARCH_SAMPLE_PHOTOS_2
      : DEMO_SEARCH_SAMPLE_PHOTOS_2.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.captionKo || '').toLowerCase().includes(q) ||
            p.tags.some((t) => t.toLowerCase().includes(q)) ||
            (p.keywordsKo || []).some((k) => k.toLowerCase().includes(q))
        );
    return (list.length > 0 ? list : DEMO_SEARCH_SAMPLE_PHOTOS_2).map((photo) => ({
      photo,
      score: 0.98,
      matchPercentage: 98,
      matchedBy: 'text-direct' as const,
    }));
  }, [forceSampleOnly, store.searchResults, demoQuery]);
  const matchedVideoScenes = useMemo(() => {
    if (!forceSampleOnly) return store.matchedVideoScenes;
    const q = demoQuery.trim().toLowerCase();
    if (!q) return DEMO_SEARCH_SAMPLE_VIDEOS_2;
    const filtered = DEMO_SEARCH_SAMPLE_VIDEOS_2.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        (v.sceneDescription || '').toLowerCase().includes(q) ||
        (v.ocrFullText || '').toLowerCase().includes(q) ||
        v.keywords.some((k: string) => k.toLowerCase().includes(q))
    );
    return filtered.length > 0 ? filtered : DEMO_SEARCH_SAMPLE_VIDEOS_2;
  }, [forceSampleOnly, store.matchedVideoScenes, demoQuery]);
  const matchedLocalDocs = useMemo(() => {
    if (!forceSampleOnly) return store.matchedLocalDocs;
    const q = demoQuery.trim().toLowerCase();
    if (!q) return DEMO_SEARCH_SAMPLE_DOCS_2;
    const filtered = DEMO_SEARCH_SAMPLE_DOCS_2.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q) ||
        d.extractedText.toLowerCase().includes(q) ||
        d.keywords.some((k: string) => k.toLowerCase().includes(q))
    );
    return filtered.length > 0 ? filtered : DEMO_SEARCH_SAMPLE_DOCS_2;
  }, [forceSampleOnly, store.matchedLocalDocs, demoQuery]);

  const [ocrModalPhoto, setOcrModalPhoto] = useState<PhotoItem | null>(null);
  const [clearInputSignal, setClearInputSignal] = useState<number>(0);
  const [isZCoreConnected, setIsZCoreConnected] = useState(zCoreBridge.isConnected);

  useEffect(() => {
    return zCoreBridge.subscribe((connected) => setIsZCoreConnected(connected));
  }, []);

  const isMobile = layout === 'mobile';
  const isMobileOrStore = isMobile || Boolean(isStoreAppMode);
  const allowMobileVoice = isMobileVoiceEnvironment() || Boolean(isStoreAppMode);
  const searchPlaceholderPool = useMemo(
    () =>
      isMobileOrStore
        ? SEARCH_STAGE_MOBILE_ROLLING_PLACEHOLDERS_10
        : SEARCH_STAGE_PC_ROLLING_PLACEHOLDERS_10,
    [isMobileOrStore]
  );

  const activePhotos = useMemo(() => photos.filter((p) => !p.quarantined), [photos]);
  const gallerySceneCount = useMemo(
    () =>
      activePhotos.filter(
        (p) =>
          !p.isVaultDocument &&
          p.trashCategory !== 'blurry' &&
          p.trashCategory !== 'screenshot' &&
          p.trashCategory !== 'memo' &&
          p.trashCategory !== 'duplicate'
      ).length,
    [activePhotos]
  );
  const vaultPhotoCount = useMemo(
    () => activePhotos.filter((p) => p.isVaultDocument).length,
    [activePhotos]
  );
  const totalIndexedDocs = localDocuments.length + vaultPhotoCount;
  const matchedTotalDocsCount = matchedLocalDocs.length + matchedVaultPhotos.length;

  const groupedResults = useMemo(() => {
    const orderedGroups = groupBurstSearchResults(searchResults, photos);
    if (searchSpace === 'vault') {
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
  }, [searchResults, photos, searchSpace]);

  const isStandaloneSearchWin = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(new URLSearchParams(window.location.search).get('ghostSearchWindow'));
  }, []);
  const initialPhotoBatchSize = isStandaloneSearchWin ? 20 : 48;
  const [visiblePhotoLimit, setVisiblePhotoLimit] = useState<number>(initialPhotoBatchSize);
  const photoLoadMoreRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisiblePhotoLimit(initialPhotoBatchSize);
  }, [activeQuery, searchSpace, initialPhotoBatchSize]);

  useEffect(() => {
    const el = photoLoadMoreRef.current;
    if (!el || visiblePhotoLimit >= groupedResults.length) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisiblePhotoLimit((prev) => Math.min(groupedResults.length, prev + 36));
        }
      },
      { rootMargin: '320px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visiblePhotoLimit, groupedResults.length]);

  const visibleGroupedResults = useMemo(
    () => groupedResults.slice(0, visiblePhotoLimit),
    [groupedResults, visiblePhotoLimit]
  );

  const initialDocBatchSize = isStandaloneSearchWin ? 18 : 36;
  const [visibleDocLimit, setVisibleDocLimit] = useState<number>(initialDocBatchSize);
  const docLoadMoreRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleDocLimit(initialDocBatchSize);
  }, [activeQuery, searchSpace, initialDocBatchSize]);

  useEffect(() => {
    const el = docLoadMoreRef.current;
    if (!el || visibleDocLimit >= matchedLocalDocs.length) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleDocLimit((prev) => Math.min(matchedLocalDocs.length, prev + 36));
        }
      },
      { rootMargin: '320px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleDocLimit, matchedLocalDocs.length]);

  const visibleMatchedDocs = useMemo(
    () => matchedLocalDocs.slice(0, visibleDocLimit),
    [matchedLocalDocs, visibleDocLimit]
  );

  const scrollToResults = React.useCallback(() => {
    if (typeof document !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById('ghosti-search-results')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 60);
    }
  }, []);

  const handleExecuteQuery = React.useCallback(
    async (q: string) => {
      if (forceSampleOnly) {
        setDemoQuery(q);
        setDemoExecuted(true);
      } else {
        await runTextQuery(q);
      }
      scrollToResults();
    },
    [forceSampleOnly, runTextQuery, scrollToResults]
  );

  const handleToggleMic = React.useCallback(() => {
    unlockMobileAudioOnUserGesture();
    void toggleMicRecording();
  }, [toggleMicRecording]);

  return (
    <main className="flex-1 w-full px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-4 bg-white text-slate-900">
      <div className="w-full flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-0.5">
          <h1 className="text-[18px] md:text-[20px] text-slate-900 font-bold tracking-tight">
            내 기기 검색
          </h1>
        </div>

        <section className="w-full flex flex-col gap-2.5">
          <Stage1IsolatedSearchInputForm
            initialQuery={initialQuery}
            initialized={initialized}
            hasExecutedUserSearch={hasExecutedUserSearch}
            activeQuery={activeQuery}
            searchSpace={searchSpace}
            searchPlaceholderPool={searchPlaceholderPool}
            allowMobileVoice={allowMobileVoice}
            isListening={isListening}
            clearSignal={clearInputSignal}
            onExecuteQuery={handleExecuteQuery}
            onToggleMic={handleToggleMic}
          />

          {allowMobileVoice && isListening && (
            <div className="px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-0.5 h-4 shrink-0">
                  {liveWaveBands.slice(0, 8).map((amp, i) => (
                    <span
                      key={i}
                      style={{ height: `${Math.max(4, Math.round(amp * 16))}px` }}
                      className="w-1 rounded-full bg-slate-700 transition-all duration-100"
                    />
                  ))}
                </div>
                <span className="text-[12.5px] text-slate-700 font-medium truncate">
                  {interimSttPreview
                    ? `“${interimSttPreview}”`
                    : '말씀해 주세요. 말씀이 끝나면 바로 검색됩니다.'}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-0.5">
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setSearchSpace('gallery')}
                className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition-colors border shrink-0 whitespace-nowrap outline-none cursor-pointer ${
                  searchSpace === 'gallery'
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <span>사진</span>
                <span className={`text-[11.5px] tabular-nums ${searchSpace === 'gallery' ? 'text-slate-300' : 'text-slate-400'}`}>
                  {!initialized ? '…' : hasExecutedUserSearch ? searchResults.length : gallerySceneCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSearchSpace('video')}
                className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition-colors border shrink-0 whitespace-nowrap outline-none cursor-pointer ${
                  searchSpace === 'video'
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <span>동영상</span>
                <span className={`text-[11.5px] tabular-nums ${searchSpace === 'video' ? 'text-slate-300' : 'text-slate-400'}`}>
                  {!initialized ? '…' : hasExecutedUserSearch ? matchedVideoScenes.length : videoSceneItems.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSearchSpace('vault')}
                className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition-colors border shrink-0 whitespace-nowrap outline-none cursor-pointer ${
                  searchSpace === 'vault'
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <span>문서</span>
                <span className={`text-[11.5px] tabular-nums ${searchSpace === 'vault' ? 'text-slate-300' : 'text-slate-400'}`}>
                  {!initialized ? '…' : hasExecutedUserSearch ? matchedTotalDocsCount : totalIndexedDocs}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const targetPhoto =
                    searchResults[0]?.photo ||
                    photos.find((p) => !p.quarantined) ||
                    photos[0] ||
                    null;
                  if (targetPhoto) {
                    setOcrModalPhoto(targetPhoto);
                  }
                }}
                title="사진에서 글자·표 추출"
                className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-[12.5px] font-medium flex items-center gap-1 shrink-0 whitespace-nowrap transition-colors cursor-pointer"
              >
                <span>글자 추출 (OCR)</span>
              </button>
            </div>

            {hasExecutedUserSearch && (
              <button
                type="button"
                onClick={() => {
                  setClearInputSignal((c) => c + 1);
                  if (forceSampleOnly) {
                    setDemoQuery('');
                    setDemoExecuted(false);
                  } else {
                    resetSearchSpaceToAll(searchSpace);
                  }
                }}
                className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 text-[12px] whitespace-nowrap cursor-pointer shrink-0"
              >
                검색 해제
              </button>
            )}
          </div>

          {forceSampleOnly ? (
            <div className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[12px] text-slate-600">
              샘플 미리보기 화면입니다 (사진 2 · 동영상 2 · 문서 2). 실제 PC 파일은 귀신비서 연결 후 Ctrl + 0 검색창에서 찾습니다.
            </div>
          ) : isZCoreConnected ? (
            <SilentIndexingStatusBar variant="search-bar" />
          ) : isMobile || isStoreAppMode ? (
            <div className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[12.5px] font-medium text-slate-700">
                스마트폰 사진첩을 연동하면 사진과 영상을 바로 찾고 정리할 수 있습니다.
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {isCapacitorNativeMobileRuntime() && (
                  <button
                    type="button"
                    onClick={() =>
                      void useSaySeeStore
                        .getState()
                        .syncMobileNativeGalleryAuto({ promptPermission: true })
                    }
                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs whitespace-nowrap transition-colors cursor-pointer shrink-0"
                  >
                    사진첩 동기화
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => requestConnectMyComputer()}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium text-xs whitespace-nowrap transition-colors cursor-pointer shrink-0"
                >
                  PC 연결 안내
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              <span className="text-[12.5px] font-medium text-slate-700">
                현재 샘플 미리보기 화면입니다. 실제 내 컴퓨터 파일을 찾으려면 귀신비서에서 내 컴퓨터를 연결해 주세요.
              </span>
              <button
                type="button"
                data-allow-secretary-jump="true"
                onClick={jumpToGhostSecretary}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs whitespace-nowrap transition-colors cursor-pointer shrink-0"
              >
                귀신비서로 이동
              </button>
            </div>
          )}
        </section>
      </div>

      <div id="ghosti-search-results" className="scroll-mt-20">
        {searchSpace === 'video' ? (
          <section className="flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[16px] text-slate-900 font-bold">
                  {hasExecutedUserSearch && activeQuery
                    ? `“${activeQuery}” 동영상 검색 결과`
                    : '동영상'}
                </h2>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[12px] font-medium">
                  {matchedVideoScenes.length}건
                </span>
              </div>

              {matchedVideoScenes.length < videoSceneItems.length && (
                <button
                  onClick={() => resetSearchSpaceToAll('video')}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium border border-slate-200 cursor-pointer"
                >
                  전체 {videoSceneItems.length}개 보기
                </button>
              )}
            </div>

            {matchedVideoScenes.length === 0 ? (
              <div className="w-full py-12 px-6 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center gap-2">
                <span className="material-symbols-outlined text-3xl text-slate-400">videocam_off</span>
                <p className="text-[14.5px] font-semibold text-slate-700">
                  {hasExecutedUserSearch && activeQuery
                    ? `“${activeQuery}”와 일치하는 동영상이 없습니다.`
                    : '표시할 동영상이 없습니다.'}
                </p>
                {videoSceneItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => resetSearchSpaceToAll('video')}
                    className="mt-1 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer"
                  >
                    전체 동영상 보기 ({videoSceneItems.length})
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 pb-1">
                {matchedVideoScenes.map((vid, vIdx) => {
                  const cardThumbUrl = resolveVideoCardThumbUrl(vid);
                  const isWholeClip = (vid.matchedSeekSec ?? 0) <= 0;
                  const cleanTs = cleanVideoTimestampLabel(vid.matchedTimestamp);
                  return (
                    <article
                      key={vid.id}
                      onClick={() => setSelectedVideoModal(vid, vid.matchedSeekSec)}
                      className="min-w-0 group rounded-xl overflow-hidden bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 flex flex-col cursor-pointer transition-colors"
                    >
                      <div data-keep-dark="true" className="relative aspect-video w-full overflow-hidden bg-black">
                        {cardThumbUrl ? (
                          <img
                            crossOrigin={cardThumbUrl.startsWith('http://127.0.0.1') ? 'anonymous' : undefined}
                            src={cardThumbUrl}
                            alt={vid.title}
                            loading={vIdx < 8 ? 'eager' : 'lazy'}
                            decoding="async"
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
                            <span className="text-[11.5px] font-medium text-zinc-300 truncate max-w-[85%]">{vid.title}</span>
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
                        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-black/80 text-white text-[11px] font-medium tabular-nums">
                          {vid.durationText}
                        </div>
                        {vid.hasScreenOcrText && (
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/75 text-white text-[10.5px] font-medium">
                            화면 글자 포함
                          </div>
                        )}
                      </div>
                      <div className="p-3.5 flex flex-col gap-2 flex-1 justify-between min-w-0 max-w-full overflow-hidden">
                        <div className="flex flex-col gap-1.5 min-w-0 max-w-full">
                          <h3 className="text-[14.5px] text-slate-900 font-semibold truncate">
                            {renderHighlightedDocText(vid.title, hasExecutedUserSearch ? activeQuery : '')}
                          </h3>
                          {Array.isArray(vid.ocrLines) && vid.ocrLines.length > 0 && (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 min-w-0 max-w-full overflow-hidden">
                              <p className="text-[11.5px] text-slate-600 line-clamp-2 break-words m-0 p-0">
                                {renderHighlightedDocText(
                                  formatVideoCardOcrSummary(vid.ocrLines),
                                  hasExecutedUserSearch ? activeQuery : ''
                                )}
                              </p>
                            </div>
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
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[16px] text-slate-900 font-bold">
                  {hasExecutedUserSearch && activeQuery
                    ? `“${activeQuery}” 문서 검색 결과`
                    : '문서'}
                </h2>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[12px] font-medium">
                  {matchedTotalDocsCount}건
                </span>
              </div>

              {!isMobileOrStore && (
                <button
                  onClick={() => void openLocalFolder('docs')}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-medium border border-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">folder_open</span>
                  <span>문서 폴더 열기</span>
                </button>
              )}
            </div>

            {matchedLocalDocs.length === 0 && matchedVaultPhotos.length === 0 ? (
              <div className="w-full py-12 px-6 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center gap-2">
                <span className="material-symbols-outlined text-3xl text-slate-400">description</span>
                <p className="text-[14.5px] font-semibold text-slate-700">
                  {hasExecutedUserSearch && activeQuery
                    ? `“${activeQuery}”와 일치하는 문서가 없습니다.`
                    : '표시할 문서가 없습니다.'}
                </p>
                {totalIndexedDocs > 0 && hasExecutedUserSearch && (
                  <button
                    type="button"
                    onClick={() => resetSearchSpaceToAll('vault')}
                    className="mt-1 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[12px] font-semibold cursor-pointer"
                  >
                    전체 문서 보기 ({totalIndexedDocs})
                  </button>
                )}
              </div>
            ) : null}

            {matchedLocalDocs.length > 0 && (
              <>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5 pb-1">
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
                              {resolveDocExtBadge(doc)}
                            </span>
                            <span className="text-slate-500 text-[11.5px]">
                              {doc.categoryBadge}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {doc.deviceSource}
                          </span>
                        </div>

                        <h4 className="text-[14.5px] text-slate-900 font-semibold break-all leading-snug">
                          {renderHighlightedDocText(
                            String(doc.id || '').startsWith('local_doc_') && doc.fileName
                              ? stripCollisionKeySuffix(doc.fileName)
                              : doc.title,
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
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          <GhostLabelerActionButton variant="doc" doc={doc} forceSampleOnly={forceSampleOnly} />
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
                              if (isMobileOrStore || !isZCoreConnected) {
                                setSelectedDocModal(doc);
                                return;
                              }
                              void executeRealOsAction('open_file_search', doc.path || doc.fileName).then((res) => {
                                useSaySeeStore.setState({
                                  lastQuarantineToast: res.summaryKo || `[${doc.fileName}] 파일을 열었습니다.`,
                                });
                              });
                            }}
                            className="px-2.5 py-1 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-[11.5px] font-medium transition-colors cursor-pointer"
                          >
                            {isMobileOrStore || !isZCoreConnected ? '본문 보기' : '파일 열기'}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                {visibleDocLimit < matchedLocalDocs.length && (
                  <div ref={docLoadMoreRef} className="h-4 w-full" aria-hidden="true" />
                )}
              </>
            )}

            {matchedVaultPhotos.length > 0 && (
              <div className="flex flex-col gap-2.5 pt-2">
                <h3 className="text-[14px] font-semibold text-slate-800">
                  촬영 · 스캔 서류 사진 ({matchedVaultPhotos.length}건)
                </h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                  {matchedVaultPhotos.map((vItem) => {
                    const vp = vItem.photo;
                    return (
                      <article
                        key={vp.id}
                        onClick={() => setSelectedPhoto(vp, null)}
                        className="p-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 flex flex-col gap-2.5 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            crossOrigin={vp.thumbUrl?.startsWith('http://127.0.0.1') ? 'anonymous' : undefined}
                            src={vp.thumbUrl}
                            alt={vp.name}
                            loading="lazy"
                            onError={(e) => {
                              const imgEl = e.currentTarget;
                              if (!imgEl.dataset.retried && vp.fullUrl && imgEl.src !== vp.fullUrl) {
                                imgEl.dataset.retried = '1';
                                imgEl.src = vp.fullUrl;
                              } else if (imgEl.dataset.retried === '1' && vp.thumbUrl) {
                                imgEl.dataset.retried = '2';
                                const sep = vp.thumbUrl.includes('?') ? '&' : '?';
                                imgEl.src = `${vp.thumbUrl}${sep}r=${Date.now()}`;
                              }
                            }}
                            className="w-14 h-14 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold text-slate-900 truncate">{vp.name}</p>
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                              {maskSensitiveDocText(vp.captionKo || vp.tags.join(' '))}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100">
                          <span className="text-[11px] text-slate-400">
                            {vp.date.split(' ')[0]}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <GhostLabelerActionButton variant="vault_photo" photo={vp} forceSampleOnly={forceSampleOnly} />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOcrModalPhoto(vp);
                              }}
                              className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium cursor-pointer"
                            >
                              OCR
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[16px] text-slate-900 font-bold">
                  {hasExecutedUserSearch && activeQuery
                    ? `“${activeQuery}” 검색 결과`
                    : '사진'}
                </h2>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[12px] font-medium">
                  {hasExecutedUserSearch ? searchResults.length : gallerySceneCount}장
                </span>
              </div>
            </div>

            {groupedResults.length > 0 ? (
              <>
                <div
                  className={
                    groupedResults.length <= 16
                      ? 'grid grid-cols-[repeat(auto-fill,minmax(175px,1fr))] gap-3.5'
                      : 'grid grid-cols-[repeat(auto-fill,minmax(145px,1fr))] gap-2.5'
                  }
                >
                  {visibleGroupedResults.map((group, gIdx) => {
                    const item = group.representative;
                    const isBurst = group.burstCount >= 2;
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
                            crossOrigin={item.photo.thumbUrl?.startsWith('http://127.0.0.1') ? 'anonymous' : undefined}
                            src={item.photo.thumbUrl}
                            alt={item.photo.name}
                            loading={gIdx < 16 ? 'eager' : 'lazy'}
                            decoding="async"
                            onError={(e) => {
                              const imgEl = e.currentTarget;
                              if (!imgEl.dataset.retried && item.photo.fullUrl && imgEl.src !== item.photo.fullUrl) {
                                imgEl.dataset.retried = '1';
                                imgEl.src = item.photo.fullUrl;
                              } else if (imgEl.dataset.retried === '1' && item.photo.thumbUrl) {
                                imgEl.dataset.retried = '2';
                                const sep = item.photo.thumbUrl.includes('?') ? '&' : '?';
                                imgEl.src = `${item.photo.thumbUrl}${sep}r=${Date.now()}`;
                              }
                            }}
                            className="w-full h-full object-cover"
                          />

                          {isBurst && (
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 text-white text-[10.5px] font-semibold">
                              ❐ {group.burstCount}장 연사
                            </div>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBookmark(item.photo.id);
                            }}
                            aria-label="즐겨찾기"
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

                          <div className="absolute bottom-9 right-2 z-10 flex items-center gap-1">
                            <GhostLabelerActionButton variant="gallery_photo" photo={item.photo} forceSampleOnly={forceSampleOnly} />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOcrModalPhoto(item.photo);
                              }}
                              title="사진에서 글자·표 추출 (OCR)"
                              className="px-2 py-0.5 rounded bg-black/75 hover:bg-black text-white text-[10.5px] font-semibold transition-colors cursor-pointer"
                            >
                              OCR
                            </button>
                          </div>

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
                  <div ref={photoLoadMoreRef} className="py-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setVisiblePhotoLimit((prev) => Math.min(groupedResults.length, prev + 72))}
                      className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[12.5px] font-medium cursor-pointer"
                    >
                      더 보기 ({visiblePhotoLimit} / {groupedResults.length}장)
                    </button>
                  </div>
                )}
              </>
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

      <GhostPhotoOcrTeleportModal
        photo={ocrModalPhoto}
        onClose={() => setOcrModalPhoto(null)}
      />
    </main>
  );
};
