import React, { useEffect, useMemo, useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import type { LocalDocumentFile, PhotoItem, VideoSceneItem } from '../../types/saysee';
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
  isZCoreOutdated,
  LATEST_Z_CORE_VERSION,
  Z_CORE_ZIP_URL,
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
import { PassportRegistrationPanel } from '../PassportRegistrationPanel';
import { GhostPhotoOcrTeleportModal } from '../GhostPhotoOcrTeleportModal';
import { GhostSecretaryFirstGuard, jumpToGhostSecretary } from '../GhostSecretaryFirstGuard';
import { GhostLabelerActionButton } from '../GhostLabelerActionButton';
import {
  DEMO_SEARCH_SAMPLE_DOCS_2,
  DEMO_SEARCH_SAMPLE_PHOTOS_2,
  DEMO_SEARCH_SAMPLE_VIDEOS_2,
} from './stage1DemoSamples';

const STAGE1_ROLLING_INTERVAL_MS = 180_000; // 3분(180초) 자동 롤링 (기획 정합)

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
      const fallbackExample = searchSpace === 'video' ? '룰렛 돌리는 장면' : currentExampleSentence;
      const q = (textInput.trim() || fallbackExample).trim();
      if (!q) return;
      setTextInput(q);
      await onExecuteQuery(q);
    };

    const handleRunExampleInstant = async () => {
      unlockMobileAudioOnUserGesture();
      const fallbackExample = searchSpace === 'video' ? '룰렛 돌리는 장면' : currentExampleSentence;
      const q = fallbackExample.trim();
      if (!q) return;
      setTextInput(q);
      await onExecuteQuery(q);
    };

    return (
      <form onSubmit={handleTextSubmit} className="w-full flex flex-wrap items-center gap-1.5 sm:gap-2">
        <div className="relative flex-1 min-w-[200px] flex items-center">
          <span className="material-symbols-outlined text-[20px] absolute left-3.5 pointer-events-none text-zinc-400">
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
                ? '내 영상 속 찾고 싶은 특정 장면이나 대사를 입력해 보세요 (그 순간부터 바로 재생됩니다)'
                : `예) ${currentExampleSentence}`
            }
            className="w-full h-11 md:h-13 pl-10 pr-[110px] sm:pr-[264px] rounded-2xl bg-[#18181B] border border-white/15 focus:border-primary-container shadow-sm outline-none font-body-md text-[13px] md:text-[14.5px] text-white placeholder:text-zinc-400/75 transition-colors"
          />

          <div className="absolute right-1.5 inset-y-0 flex items-center gap-1">
            {!textInput.trim() ? (
              <div className="hidden sm:flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStepPlaceholder(-1)}
                  title="이전 예시 문구 보기"
                  className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 hover:text-white text-[11px] font-bold flex items-center justify-center transition-colors cursor-pointer"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={() => handleStepPlaceholder(1)}
                  title="다음 예시 문구 보기"
                  className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 hover:text-white text-[11px] font-bold flex items-center justify-center transition-colors cursor-pointer"
                >
                  ▶
                </button>
                <button
                  type="button"
                  onClick={() => void handleRunExampleInstant()}
                  title="지금 보이는 예시 문장으로 1초 만에 바로 검색해 봅니다"
                  className="inline-flex items-center gap-1 h-7.5 px-2.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-400/35 text-teal-300 font-label-sm text-[11.5px] font-extrabold transition-all whitespace-nowrap cursor-pointer"
                >
                  <span>예시 바로 검색 ↵</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setTextInput('')}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
                title="지우기"
              >
                <span className="material-symbols-outlined text-[17px]">close</span>
              </button>
            )}
            <button
              type="submit"
              className="h-8.5 md:h-10 px-3.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-md text-[12.5px] md:text-[13px] font-extrabold transition-all whitespace-nowrap cursor-pointer"
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
              title="모바일 마이크로 말해서 검색·낭독·손보기"
              className={`h-10 px-3 rounded-2xl border flex items-center gap-1 font-label-md text-[12px] font-bold shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                isListening
                  ? 'bg-primary-container text-zinc-950 border-primary-container animate-pulse'
                  : 'bg-[#18181B] hover:bg-zinc-800 text-zinc-200 border-white/15'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[18px] ${
                  isListening ? 'text-zinc-950' : 'text-primary-container'
                }`}
              >
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
    importMobileLocalPhotos,
    isStoreAppMode,
    setSelectedPhoto,
    setSelectedVideoModal,
    setSelectedDocModal,
    syncRealVideoDuration,
    toggleBookmark,
    setActiveLoungeType,
    setDesktopTab,
    setMobileTab,
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
  const mobilePhotoInputRef = React.useRef<HTMLInputElement | null>(null);
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

  // 연사 묶기는 스위치 없이 항상 기본 ON으로 자동 작동
  const groupedResults = useMemo(() => {
    const orderedGroups = groupBurstSearchResults(searchResults);
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
  }, [searchResults, searchSpace]);

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
    <main className="flex-1 w-full px-4 sm:px-6 py-5 sm:py-6 flex flex-col gap-5">
      {/* 상단 검색 프레임 */}
      <div className="w-full flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <h1 className="font-headline-md text-[20px] md:text-[24px] text-white font-extrabold tracking-tight">
            🔍 내 기기 1초 AI 내용검색
          </h1>
        </div>

        <section className="w-full flex flex-col gap-3">
          <div className="w-full flex flex-col gap-3">
            {/* 1-A. 자연어 문장형 통합 검색창 (독립 상태 분리로 타이핑 시 하단 그리드 리렌더링 0회 보장) */}
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
              <div className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex items-center gap-0.5 h-4 shrink-0">
                    {liveWaveBands.slice(0, 8).map((amp, i) => (
                      <span
                        key={i}
                        style={{ height: `${Math.max(4, Math.round(amp * 16))}px` }}
                        className="w-1 rounded-full bg-primary-container transition-all duration-100"
                      />
                    ))}
                  </div>
                  <span className="font-label-md text-[12.5px] text-primary-container font-bold truncate">
                    {interimSttPreview
                      ? `“${interimSttPreview}”`
                      : '말씀해 주세요... (말씀이 끝나면 즉시 검색됩니다)'}
                  </span>
                </div>
              </div>
            )}

            {/* 1-B. 3대 카테고리 스위칭 캡슐 탭: [사진] | [동영상] | [문서] */}
            <div className="flex flex-wrap items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-0.5">
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSearchSpace('gallery')}
                  className={`px-4 py-2 rounded-full font-label-md text-[13px] font-bold flex items-center gap-1.5 transition-all border shrink-0 whitespace-nowrap outline-none focus:outline-none cursor-pointer ${
                    searchSpace === 'gallery'
                      ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                      : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/10'
                  }`}
                >
                  <span>사진</span>
                  <span
                    className={`px-2 py-0.2 rounded-full text-[11px] font-mono ${
                      searchSpace === 'gallery'
                        ? 'bg-white/25 text-zinc-950 font-black'
                        : hasExecutedUserSearch && searchResults.length > 0
                        ? 'bg-primary-container/20 text-primary-container font-bold'
                        : 'text-zinc-400 font-bold'
                    }`}
                  >
                    {!initialized
                      ? '…'
                      : hasExecutedUserSearch
                      ? `(${searchResults.length})`
                      : gallerySceneCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSearchSpace('video')}
                  className={`px-4 py-2 rounded-full font-label-md text-[13px] font-bold flex items-center gap-1.5 transition-all border shrink-0 whitespace-nowrap outline-none focus:outline-none cursor-pointer ${
                    searchSpace === 'video'
                      ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                      : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/10'
                  }`}
                >
                  <span>동영상</span>
                  <span
                    className={`px-2 py-0.2 rounded-full text-[11px] font-mono ${
                      searchSpace === 'video'
                        ? 'bg-white/25 text-zinc-950 font-black'
                        : hasExecutedUserSearch && matchedVideoScenes.length > 0
                        ? 'bg-primary-container/20 text-primary-container font-bold'
                        : 'text-zinc-400 font-bold'
                    }`}
                  >
                    {!initialized
                      ? '…'
                      : hasExecutedUserSearch
                      ? `(${matchedVideoScenes.length})`
                      : `${videoSceneItems.length}`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSearchSpace('vault')}
                  className={`px-4 py-2 rounded-full font-label-md text-[13px] font-bold flex items-center gap-1.5 transition-all border shrink-0 whitespace-nowrap outline-none focus:outline-none cursor-pointer ${
                    searchSpace === 'vault'
                      ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                      : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/10'
                  }`}
                >
                  <span>문서</span>
                  <span
                    className={`px-2 py-0.2 rounded-full text-[11px] font-mono ${
                      searchSpace === 'vault'
                        ? 'bg-white/25 text-zinc-950 font-black'
                        : hasExecutedUserSearch && matchedTotalDocsCount > 0
                        ? 'bg-primary-container/20 text-primary-container font-bold'
                        : 'text-zinc-400 font-bold'
                    }`}
                  >
                    {!initialized
                      ? '…'
                      : hasExecutedUserSearch
                      ? `(${matchedTotalDocsCount})`
                      : totalIndexedDocs}
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
                  title="사진에서 글자·표·원하는 단어 조각(칩)만 바로 따내기 (창 UI ③)"
                  className="px-3.5 py-2 rounded-full bg-zinc-950 hover:bg-teal-400 text-teal-200 hover:text-zinc-950 border border-teal-400/60 font-label-md text-[12.5px] font-black shadow-md flex items-center gap-1 shrink-0 whitespace-nowrap transition-all cursor-pointer"
                >
                  <span>📝 OCR 글자 따기</span>
                </button>
              </div>

              {hasExecutedUserSearch && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setClearInputSignal((c) => c + 1);
                      resetSearchSpaceToAll(searchSpace);
                    }}
                    className="px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white font-label-sm text-[11.5px] whitespace-nowrap cursor-pointer"
                  >
                    ✕ 검색 해제
                  </button>
                </div>
              )}
            </div>

            {/* 1-D. 연결 상태 바 (체험판 검색창일 때는 항상 고정 샘플 안내만 노출) */}
            {forceSampleOnly ? (
              <div className="w-full px-4 py-2 rounded-2xl bg-teal-500/10 dark:bg-teal-950/35 border border-teal-500/30 flex flex-wrap items-center justify-between gap-2.5 mt-0.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-[12px] font-extrabold text-slate-900 dark:text-teal-200">
                  <span>🧪 웹 체험검색창 (샘플 사진 2 · 동영상 2 · 문서 2 고정) — 내 진짜 PC 파일은 귀신비서 연결 후 네이티브 『👻 귀신검색창(Ctrl+0)』에서 검색됩니다!</span>
                </div>
              </div>
            ) : isZCoreConnected ? (
              <SilentIndexingStatusBar variant="search-bar" className="mt-1" />
            ) : isMobile || isStoreAppMode ? (
              <div className="w-full px-4 py-2.5 rounded-2xl bg-teal-500/10 dark:bg-teal-950/35 border border-teal-500/30 flex flex-wrap items-center justify-between gap-3 mt-0.5 shadow-sm">
                <span className="text-[12.5px] font-extrabold text-slate-900 dark:text-white">
                  📱 스토어 정식 앱을 실행하시면 수동 불러오기 없이 내 스마트폰 사진·영상이 자동으로 정리·검색됩니다!
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
                      className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs whitespace-nowrap transition-all cursor-pointer shrink-0"
                    >
                      🔄 사진첩 자동 동기화
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => requestConnectMyComputer()}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/15 font-bold text-xs whitespace-nowrap transition-all cursor-pointer shrink-0"
                  >
                    💻 내 PC 연결 안내
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full px-4 py-2 rounded-2xl bg-teal-500/10 dark:bg-teal-950/35 border border-teal-500/30 flex flex-wrap items-center justify-between gap-2.5 mt-0.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-extrabold text-slate-900 dark:text-white">
                  <span>👀 현재 눈으로 구경 중입니다 (직접 클릭·내 진짜 파일 검색은 『👻 귀신비서』 대화 후 열려요!)</span>
                </div>
                <button
                  type="button"
                  data-allow-secretary-jump="true"
                  onClick={jumpToGhostSecretary}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs whitespace-nowrap transition-all cursor-pointer shrink-0"
                >
                  👻 &apos;귀신비서&apos;와 먼저 대화하기 ➔
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 하단 샘플 사진·영상·문서 바둑판 (100% 보존 + TMI 배지 단순화) */}
      <div id="ghosti-search-results" className="scroll-mt-20">
        {searchSpace === 'video' ? (
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-bold">
                  {hasExecutedUserSearch && activeQuery
                    ? `“${activeQuery}” 동영상 검색 결과`
                    : '전체 동영상 목록'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-medium">
                  총 {matchedVideoScenes.length}건
                </span>
              </div>

              <div className="flex items-center gap-2">
                {matchedVideoScenes.length < videoSceneItems.length && (
                  <button
                    onClick={() => resetSearchSpaceToAll('video')}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-primary-container font-label-sm text-[12px] font-bold border border-white/10 cursor-pointer"
                  >
                    동영상 {videoSceneItems.length}개 전체 보기
                  </button>
                )}
              </div>
            </div>

            {matchedVideoScenes.length > 0 && (
              <div className="px-3.5 py-2.5 rounded-xl bg-teal-950/60 border border-teal-400/40 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] text-teal-200 font-bold">
                  👻 화면 속 글자(자막·문서·칠판)가 찍힌 영상은 <strong className="text-teal-300">동영상 카드를 클릭하면</strong> 하단에 추출된 텍스트가 바로 표시되어 즉시 복사할 수 있어요!
                </span>
              </div>
            )}

            {matchedVideoScenes.length === 0 ? (
              <div className="w-full py-12 px-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col items-center justify-center text-center gap-2.5">
                <span className="material-symbols-outlined text-4xl text-zinc-500">videocam_off</span>
                <p className="font-headline-sm text-[15px] font-bold text-zinc-200">
                  {hasExecutedUserSearch && activeQuery
                    ? `“${activeQuery}”와 일치하는 동영상이 없습니다 (0건)`
                    : '표시할 동영상이 없습니다'}
                </p>
                {videoSceneItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => resetSearchSpaceToAll('video')}
                    className="mt-1 px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-primary-container text-[12.5px] font-bold cursor-pointer"
                  >
                    전체 동영상 {videoSceneItems.length}개 다시 보기
                  </button>
                )}
              </div>
            ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 pb-1">
              {matchedVideoScenes.map((vid) => {
                const cardThumbUrl = resolveVideoCardThumbUrl(vid);
                const isWholeClip = (vid.matchedSeekSec ?? 0) <= 0;
                const cleanTs = cleanVideoTimestampLabel(vid.matchedTimestamp);
                return (
                <article
                  key={vid.id}
                  onClick={() => setSelectedVideoModal(vid, vid.matchedSeekSec)}
                  className="min-w-0 group rounded-2xl overflow-hidden bg-[#18181B] hover:bg-zinc-900 border border-white/10 hover:border-white/25 flex flex-col cursor-pointer transition-colors"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-black">
                    {cardThumbUrl ? (
                      <img
                        src={cardThumbUrl}
                        alt={vid.title}
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                        className="w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950 text-zinc-400 gap-1.5 p-4 text-center">
                        <span className="material-symbols-outlined text-3xl text-primary-container/80">movie</span>
                        <span className="text-[11.5px] font-medium text-zinc-300 truncate max-w-[85%]">{vid.title}</span>
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
                    {vid.hasScreenOcrText && (
                      <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-teal-500/90 text-zinc-950 font-label-mono text-[10.5px] font-black shadow">
                        📝 화면 글자 감지됨
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col gap-2.5 flex-1 justify-between min-w-0 max-w-full overflow-hidden">
                    <div className="flex flex-col gap-2 min-w-0 max-w-full">
                      <h3 className="font-headline-sm text-[15px] text-white font-bold group-hover:text-primary-container transition-colors truncate">
                        {renderHighlightedDocText(vid.title, hasExecutedUserSearch ? activeQuery : '')}
                      </h3>
                      {Array.isArray(vid.ocrLines) && vid.ocrLines.length > 0 && (
                        <div className="bg-zinc-950/80 border border-teal-400/35 rounded-lg p-2 min-w-0 max-w-full overflow-hidden">
                          <p className="font-body-sm text-[11.5px] text-zinc-200 line-clamp-2 break-words m-0 p-0">
                            📝{' '}
                            {renderHighlightedDocText(
                              formatVideoCardOcrSummary(vid.ocrLines),
                              hasExecutedUserSearch ? activeQuery : ''
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10 font-label-mono text-[11px] text-zinc-400">
                      <span>{vid.date}</span>
                      <div className="flex items-center gap-2">
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
                    ? `“${activeQuery}” 문서 검색 결과`
                    : '전체 문서·서류 목록'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-medium">
                  총 {matchedTotalDocsCount}건
                </span>
              </div>

              {!isMobileOrStore && (
                <button
                  onClick={() => void openLocalFolder('docs')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-label-sm text-[12px] font-medium border border-white/10 flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">folder_open</span>
                  <span>내 PC 문서 폴더 열기</span>
                </button>
              )}
            </div>

            {matchedLocalDocs.length === 0 && matchedVaultPhotos.length === 0 ? (
              <div className="w-full py-12 px-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col items-center justify-center text-center gap-2.5">
                <span className="material-symbols-outlined text-4xl text-zinc-500">description</span>
                <p className="font-headline-sm text-[15px] font-bold text-zinc-200">
                  {hasExecutedUserSearch && activeQuery
                    ? `“${activeQuery}”와 일치하는 문서가 없습니다 (0건)`
                    : '표시할 문서가 없습니다'}
                </p>
                {totalIndexedDocs > 0 && hasExecutedUserSearch && (
                  <button
                    type="button"
                    onClick={() => resetSearchSpaceToAll('vault')}
                    className="mt-1 px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-primary-container text-[12.5px] font-bold cursor-pointer"
                  >
                    전체 문서 {totalIndexedDocs}건 다시 보기
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
                    className="group p-4 rounded-2xl bg-[#18181B] hover:bg-zinc-900 border border-white/10 hover:border-white/25 flex flex-col justify-between gap-3 cursor-pointer transition-colors"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-zinc-800 border border-white/10 text-amber-400 font-label-mono text-[10px] font-bold">
                            {resolveDocExtBadge(doc)}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 font-label-sm text-[11px] font-medium">
                            {doc.categoryBadge}
                          </span>
                        </div>
                        <span className="font-label-mono text-[10px] text-zinc-500">
                          {doc.deviceSource}
                        </span>
                      </div>

                      <h4 className="font-headline-sm text-[15px] text-white font-bold group-hover:text-primary-container transition-colors break-all">
                        {renderHighlightedDocText(
                          String(doc.id || '').startsWith('local_doc_') && doc.fileName
                            ? stripCollisionKeySuffix(doc.fileName)
                            : doc.title,
                          hasExecutedUserSearch ? activeQuery : '',
                          doc.matchedQueryTokens
                        )}
                      </h4>

                      <div className="bg-zinc-950/80 p-2.5 rounded-xl border border-white/5">
                        <p className="font-body-sm text-[12px] text-zinc-400 line-clamp-3 leading-relaxed m-0 p-0">
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

                    <div className="flex items-center justify-between pt-2 border-t border-white/10 font-label-mono text-[11px] text-zinc-400 gap-2">
                      <span>{doc.date}</span>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <GhostLabelerActionButton variant="doc" doc={doc} forceSampleOnly={forceSampleOnly} />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void navigator.clipboard?.writeText(doc.extractedText);
                            useSaySeeStore.setState({
                              lastQuarantineToast: `📋 복사 완료! [${doc.title}] 본문 정보가 즉시 복사되었습니다.`,
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
                            if (isMobileOrStore || !isZCoreConnected) {
                              setSelectedDocModal(doc);
                              return;
                            }
                            void executeRealOsAction('open_file_search', doc.path || doc.fileName).then((res) => {
                              useSaySeeStore.setState({
                                lastQuarantineToast: res.summaryKo || `📂 탐색기에서 [${doc.fileName}] 파일을 바로 띄웠습니다.`,
                              });
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-300 font-label-sm text-[11.5px] font-extrabold transition-colors cursor-pointer"
                        >
                          {isMobileOrStore || !isZCoreConnected ? '📖 본문 보기' : '🔍 파일 열기'}
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
                <div className="flex items-center gap-2">
                  <h3 className="font-headline-sm text-[14.5px] font-bold text-teal-200">
                    📸 촬영·스캔 서류 사진 ({matchedVaultPhotos.length}건)
                  </h3>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                  {matchedVaultPhotos.map((vItem) => {
                    const vp = vItem.photo;
                    return (
                      <article
                        key={vp.id}
                        onClick={() => setSelectedPhoto(vp, null)}
                        className="group p-3 rounded-2xl bg-[#18181B] hover:bg-zinc-900 border border-white/10 hover:border-teal-400/40 flex flex-col gap-2.5 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={vp.thumbUrl}
                            alt={vp.name}
                            loading="lazy"
                            className="w-14 h-14 rounded-xl object-cover bg-zinc-950 border border-white/10 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-bold text-white truncate">{vp.name}</p>
                            <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                              {maskSensitiveDocText(vp.captionKo || vp.tags.join(' '))}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-white/10">
                          <span className="font-label-mono text-[10.5px] text-zinc-400">
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
                              className="px-2 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/35 border border-teal-400/50 text-teal-200 font-label-sm text-[10.5px] font-extrabold cursor-pointer"
                            >
                              📝 OCR
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
          /* [🖼️ 전체 갤러리] 모드 — [❐ 동일 연사 묶어보기 ON] 스위치 버튼 완전 제거 & 깔끔한 카운트만 표시 */
          <section className="flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-headline-sm text-[17px] md:text-[18px] text-white font-bold">
                  {hasExecutedUserSearch && activeQuery
                    ? `“${activeQuery}” 검색 결과`
                    : '전체 사진 목록'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-label-sm text-[12px] font-medium">
                  총 {hasExecutedUserSearch ? searchResults.length : gallerySceneCount}장
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
                {visibleGroupedResults.map((group) => {
                  const item = group.representative;
                  const isBurst = group.burstCount >= 2;
                  return (
                    <article
                      key={item.photo.id}
                      onClick={() =>
                        // [레드팀 보완] 연사 묶음(❐ N장 연사) 클릭 시 상세 모달에 group.burstPhotos를 그대로 넘겨 모달 내에서 나란히 펼쳐 골라볼 수 있도록 보장
                        setSelectedPhoto(item.photo, isBurst ? group.burstPhotos : null)
                      }
                      className="group relative rounded-2xl overflow-hidden bg-[#18181B] border border-white/10 hover:border-white/25 transition-colors cursor-pointer flex flex-col"
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
                          decoding="async"
                          className="w-full h-full object-cover"
                        />

                        {isBurst && (
                          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-zinc-950/90 border border-white/15 text-primary-container font-label-sm text-[10.5px] font-bold flex items-center gap-1">
                            <span>❐ {group.burstCount}장 연사</span>
                          </div>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBookmark(item.photo.id);
                          }}
                          aria-label="즐겨찾기"
                          className={`absolute top-2.5 right-2.5 w-7.5 h-7.5 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                            item.photo.bookmarked
                              ? 'bg-red-600/95 text-white ring-2 ring-white/80 shadow-md scale-105'
                              : 'bg-black/75 text-white/85 hover:text-red-400 hover:bg-black/90'
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

                        <div className="absolute bottom-10 right-2.5 z-10 flex items-center gap-1">
                          <GhostLabelerActionButton variant="gallery_photo" photo={item.photo} forceSampleOnly={forceSampleOnly} />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOcrModalPhoto(item.photo);
                            }}
                            title="귀신검색창에서 이 사진의 별도 독립 📝 사진·표 OCR 창을 열어 글자·표를 추출합니다"
                            className="px-2.5 py-1 rounded-lg bg-zinc-950/90 hover:bg-teal-400 text-teal-200 hover:text-zinc-950 border border-teal-400/60 font-label-sm text-[11px] font-black shadow-md transition-all cursor-pointer"
                          >
                            📝 OCR
                          </button>
                        </div>

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
              {visiblePhotoLimit < groupedResults.length && (
                <div ref={photoLoadMoreRef} className="py-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setVisiblePhotoLimit((prev) => Math.min(groupedResults.length, prev + 72))}
                    className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 text-[12.5px] font-bold cursor-pointer"
                  >
                    사진 더 보기 ({visiblePhotoLimit} / {groupedResults.length}장)
                  </button>
                </div>
              )}
              </>
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

      {/* [급소 2 돌파 ① · Contextual PQL] 검색 결과 하단 1줄 기기 통합 브릿지 (모바일 스토어 빌드 제외) */}
      {!isStoreAppMode && (
        <div className="mt-2 px-4 py-2.5 rounded-2xl bg-teal-950/35 border border-teal-400/35 flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
          <span className="text-teal-100 font-bold">
            📱 방금 찾은 이 파일, 집컴이나 내 폰에서도 카톡 없이 바로 열려면?
          </span>
          <button
            type="button"
            onClick={() => {
              setActiveLoungeType('personal');
              setDesktopTab('sync');
              setMobileTab('share');
            }}
            className="px-3 py-1.5 rounded-xl bg-[#2DD4BF] hover:bg-[#5EEAD4] text-zinc-950 font-extrabold text-[11.5px] cursor-pointer shrink-0 transition-colors"
          >
            내 기기 통합 30일 무카드 무료체험 켜기 ➔
          </button>
        </div>
      )}

      {/* [메뉴 2 · 👻 귀신검색창 하단 고정 소속 설명란] 유료 티어(🔒) 및 부가 기능 안내 */}
      <section
        aria-label="귀신검색 유료 티어 및 부가 기능 안내"
        className="mt-2 p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-slate-200 dark:border-white/10 flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13.5px] font-extrabold text-teal-800 dark:text-teal-300">
            🔒 귀신검색 유료 티어 안내 (명시적 동의 시 30일 무제한 무료체험 · 만료 시 자동 결제 없이 깔끔 잠금🔒)
          </span>
          <span className="text-[11.5px] text-slate-600 dark:text-zinc-400 font-semibold">
            내 PC 문서·사진·영상 검색 &amp; 동영상 클릭 시 화면 글자 자동 추출은 평생 무제한 무료
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[12px] text-slate-700 dark:text-zinc-200">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/80 border border-slate-200/90 dark:border-white/10 flex flex-col gap-1">
            <span className="font-extrabold text-slate-900 dark:text-white">① 📱 내 기기 통합 소환🔒</span>
            <span className="text-slate-600 dark:text-zinc-400 leading-snug">
              동일 이메일 연결 시 핸드폰 사진·타 PC 파일 통합 노출 &amp; 폰 촬영 직후 <strong className="text-teal-700 dark:text-teal-300">1초 공간이동 (전송 후 1분간 자동 안내)</strong> · 30일 만료 시 원격 노출만 OFF되며 이미 내 PC 폴더에 복사된 원본 파일은 영구 보존
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/80 border border-slate-200/90 dark:border-white/10 flex flex-col gap-1">
            <span className="font-extrabold text-slate-900 dark:text-white">② 📝 사진·표 OCR 창🔒 (별도 독립 창)</span>
            <span className="text-slate-600 dark:text-zinc-400 leading-snug">
              귀신검색창 안에는 사진 목록만 깔끔하게 보이고, 사진에서 <strong className="text-teal-700 dark:text-teal-300">[📝 OCR]</strong>을 누르면 별도 독립 <strong className="text-slate-900 dark:text-white">📝 사진·표 OCR 창</strong>이 열려 글자·표를 추출
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950/80 border border-slate-200/90 dark:border-white/10 flex flex-col gap-1">
            <span className="font-extrabold text-slate-900 dark:text-white">③ 🏷️ 귀신 라벨러🔒</span>
            <span className="text-slate-600 dark:text-zinc-400 leading-snug">
              암호 같은 사진·카톡·문서 파일명을 촬영일·내용 규칙(YYMMDD_내용)으로 한 번에 자동 정리
            </span>
          </div>
        </div>
      </section>

      <GhostPhotoOcrTeleportModal
        photo={ocrModalPhoto}
        onClose={() => setOcrModalPhoto(null)}
      />
    </main>
  );
};
