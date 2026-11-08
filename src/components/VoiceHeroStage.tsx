import React, { useEffect, useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { FaceMemberInlineBar } from './FaceMemberRegistryModal';
import { ensureLoginAndZCoreReady, requestConnectMyComputer, zCoreBridge } from '../services/zCoreBridge';
import { SilentIndexingStatusBar } from './SilentIndexingStatusBar';
import { VoiceActorControlPill } from './VoiceActorControlPill';
import { unlockMobileAudioOnUserGesture } from '../services/setupMonsterTts';
import {
  SEARCH_STAGE_PC_ROLLING_PLACEHOLDERS_10,
  SEARCH_STAGE_MOBILE_ROLLING_PLACEHOLDERS_10,
  PLACEHOLDER_ROLLING_INTERVAL_MS,
  getAndAdvanceSessionPlaceholderStartIndex,
} from '../services/weeklyCareAndPlaceholderEngine';

export const VoiceHeroStage: React.FC = () => {
  const {
    layout,
    activeLoungeType,
    photos,
    searchSpace,
    hasExecutedUserSearch,
    setSearchSpace,
    resetSearchSpaceToAll,
    localDocuments,
    matchedLocalDocs,
    matchedVaultPhotos,
    searchResults,
    videoSceneItems,
    matchedVideoScenes,
    activeQuery,
    isListening,
    liveWaveBands,
    interimSttPreview,
    sentenceChips,
    sentenceChipPage,
    cycleSentenceChips,
    toggleMicRecording,
    runTextQuery,
    runBriefingHintChip,
    openLocalFolder,
    importMobileLocalPhotos,
    isStoreAppMode,
  } = useSaySeeStore();

  // [v1.3] 로컬 귀신검색창(?ghostSearchWindow=…&q=…)으로 넘어온 검색어는 입력창에도 그대로 보여줌
  const [textInput, setTextInput] = useState(() => {
    if (typeof window === 'undefined') return '';
    const sp = new URLSearchParams(window.location.search);
    return sp.get('ghostSearchWindow') ? sp.get('q') || '' : '';
  });
  const mobilePhotoInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isZCoreConnected, setIsZCoreConnected] = useState(zCoreBridge.isConnected);

  useEffect(() => {
    return zCoreBridge.subscribe((connected) => setIsZCoreConnected(connected));
  }, []);

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
  const totalDissectedSegments = useMemo(
    () => videoSceneItems.reduce((acc, v) => acc + v.timelineFrames.length, 0),
    [videoSceneItems]
  );

  // 100% 엔진 색인 데이터 기반 동적 서류 힌트 생성 (컬러 이모지 제거)
  const dynamicDocHints = useMemo(() => {
    return localDocuments.slice(0, 4).map((doc) => ({
      id: `hint_doc_${doc.id}`,
      label: doc.title,
      query: doc.title,
      meta: `${doc.ext} 문서 • ${doc.date} (${doc.deviceSource})`,
    }));
  }, [localDocuments]);

  // 100% 엔진 색인 데이터 기반 동영상 초(Sec) 단위 사물·장면 칩 생성 (컬러 이모지 제거)
  const dynamicMicroObjectChips = useMemo(() => {
    const chips: Array<{ label: string; query: string; videoId: string; seekSec: number }> = [];
    const seenQueries = new Set<string>();
    for (const vid of videoSceneItems) {
      const candidateFrames = [
        vid.timelineFrames.find((f) => f.timeSec === vid.matchedSeekSec),
        ...vid.timelineFrames,
      ].filter((f): f is NonNullable<typeof f> => Boolean(f));

      let pickedForVid = 0;
      for (const frame of candidateFrames) {
        const kwPair = frame.keywords.slice(0, 2).join(' ').trim();
        if (!kwPair || seenQueries.has(kwPair)) continue;
        seenQueries.add(kwPair);
        chips.push({
          label: `${kwPair} (${frame.timestampText})`,
          query: frame.keywords.slice(0, 3).join(' ').trim() || kwPair,
          videoId: vid.id,
          seekSec: frame.timeSec,
        });
        pickedForVid += 1;
        if (pickedForVid >= 2 || chips.length >= 6) break;
      }
      if (chips.length >= 6) break;
    }
    return chips;
  }, [videoSceneItems]);

  const isMobile = layout === 'mobile';
  const isMobileOrStore = isMobile || Boolean(isStoreAppMode);
  const searchPlaceholderPool = useMemo(
    () =>
      isMobileOrStore
        ? SEARCH_STAGE_MOBILE_ROLLING_PLACEHOLDERS_10
        : SEARCH_STAGE_PC_ROLLING_PLACEHOLDERS_10,
    [isMobileOrStore]
  );
  const [rollingSearchIdx, setRollingSearchIdx] = useState<number>(() =>
    getAndAdvanceSessionPlaceholderStartIndex(10)
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRollingSearchIdx((prev) => (prev + 1) % searchPlaceholderPool.length);
    }, PLACEHOLDER_ROLLING_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [searchPlaceholderPool.length]);

  const searchPlaceholder = useMemo(() => {
    return searchPlaceholderPool[rollingSearchIdx % searchPlaceholderPool.length];
  }, [searchPlaceholderPool, rollingSearchIdx]);

  const scrollToResults = () => {
    if (typeof document !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById('ghosti-search-results')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 60);
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    unlockMobileAudioOnUserGesture();
    const q = textInput.trim();
    if (!q) return;
    await runTextQuery(q);
    scrollToResults();
  };

  const handleBriefingChipClick = (target: 'doc' | 'video', query: string) => {
    setTextInput(query);
    void runBriefingHintChip(target, query);
  };

  const handleGalleryChipClick = (query: string) => {
    setTextInput(query);
    setSearchSpace('gallery');
    void runTextQuery(query);
    scrollToResults();
  };

  const activeSentencePool = useMemo(
    () => sentenceChips.slice(sentenceChipPage * 4, sentenceChipPage * 4 + 4),
    [sentenceChips, sentenceChipPage]
  );

  return (
    <section className="w-full flex flex-col gap-3">
      {/* ─────────────── 노션형 보더리스(Borderless) 통합 검색 캔버스 블록 ─────────────── */}
      <div className="w-full flex flex-col gap-3">
        {/* 1-A. 자연어 문장형 통합 검색창 */}
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
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-11 md:h-13 pl-10 pr-20 rounded-2xl bg-[#18181B] border border-white/15 focus:border-primary-container shadow-sm outline-none font-body-md text-[13px] md:text-[14.5px] text-white placeholder:text-zinc-400/75 transition-colors"
            />
            {textInput && (
              <button
                type="button"
                onClick={() => setTextInput('')}
                className="absolute right-16 text-zinc-400 hover:text-white p-1 cursor-pointer"
                title="지우기"
              >
                <span className="material-symbols-outlined text-[17px]">close</span>
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 h-8.5 md:h-10 px-3.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-md text-[12.5px] md:text-[13px] font-extrabold transition-all whitespace-nowrap cursor-pointer"
            >
              검색
            </button>
          </div>

          <div className="md:hidden flex items-center gap-1.5 shrink-0 ml-auto">
            {/* PC는 채팅/키보드 검색 올인, 모바일에서만 마이크 [말하기] 버튼 노출 */}
            <button
              type="button"
              onClick={() => {
                unlockMobileAudioOnUserGesture();
                void toggleMicRecording();
              }}
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

            {/* 음성 아이콘 하나에 재생/중단 토글 + [남 | 여] 성우 선택이 통합된 트렌디 컨트롤 캡슐 */}
            <VoiceActorControlPill />
          </div>
        </form>

        {/* 음성 인식 중일 때만 슬림하게 열리는 파형 피드백 */}
        {isListening && (
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

        {/* 1-B. 3대 카테고리 스위칭 캡슐 탭: [사진] | [동영상] | [문서] (이모지 없이 깔끔한 캡슐 디자인) */}
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
                {hasExecutedUserSearch ? `(${searchResults.length})` : gallerySceneCount}
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
                {hasExecutedUserSearch
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
                {hasExecutedUserSearch ? `(${matchedTotalDocsCount})` : totalIndexedDocs}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasExecutedUserSearch && (
              <div className="flex items-center gap-2">
                <span className="hidden md:inline font-label-mono text-[11.5px] text-zinc-300">
                  <strong className="text-white">“{activeQuery}”</strong> 매칭:{' '}
                  <span className="text-primary-container font-bold">
                    (사진 {searchResults.length}) (동영상 {matchedVideoScenes.length}) (문서 {matchedTotalDocsCount})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTextInput('');
                    resetSearchSpaceToAll(searchSpace);
                  }}
                  className="px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white font-label-sm text-[11.5px] whitespace-nowrap cursor-pointer"
                >
                  ✕ 검색 해제
                </button>
              </div>
            )}

            {searchSpace === 'vault' && !isMobile && (
              <button
                type="button"
                onClick={() => void openLocalFolder('docs')}
                className="px-3.5 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-label-sm text-[11.5px] font-medium border border-white/10 shrink-0 whitespace-nowrap cursor-pointer"
              >
                로컬 서류폴더 열기
              </button>
            )}
          </div>
        </div>

        {/* 1-D. Z-코어 연결 시 무소음 인덱싱 상태 바 / 미연결 시 [⚡ 내 컴퓨터 1초 연결하기] 1줄 안내 바 */}
        {isZCoreConnected ? (
          <SilentIndexingStatusBar variant="search-bar" className="mt-1" />
        ) : isMobile || isStoreAppMode ? (
          <div className="w-full px-4 py-2.5 rounded-2xl bg-teal-500/10 dark:bg-teal-950/35 border border-teal-500/30 flex flex-wrap items-center justify-between gap-3 mt-0.5 shadow-sm">
            <input
              ref={mobilePhotoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  void importMobileLocalPhotos(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <div className="flex items-center gap-2 text-[12.5px] font-extrabold text-slate-900 dark:text-white">
              <span>
                📱 내 스마트폰 갤러리 사진을 불러와 선명도·중복·영수증을 1초 만에 정리·검색해 보세요!
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => mobilePhotoInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs whitespace-nowrap transition-all cursor-pointer shrink-0"
              >
                📱 내 폰 사진 불러오기
              </button>
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
          <div className="w-full px-4 py-2.5 rounded-2xl bg-teal-500/10 dark:bg-teal-950/35 border border-teal-500/30 flex flex-wrap items-center justify-between gap-3 mt-0.5 shadow-sm">
            <div className="flex items-center gap-2 text-[12.5px] font-extrabold text-slate-900 dark:text-white">
              <span>
                {hasExecutedUserSearch
                  ? '👀 지금은 샘플 검색 결과입니다 · 내 컴퓨터 진짜 사진·영상·문서도 1초 만에 찾아보세요!'
                  : '👀 지금은 체험 샘플 화면입니다 · 내 컴퓨터 진짜 사진·영상·문서를 1초 만에 찾아볼까요?'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => requestConnectMyComputer()}
              className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black text-xs whitespace-nowrap transition-all cursor-pointer shrink-0"
            >
              ⚡ 내 컴퓨터 1초 연결하기
            </button>
          </div>
        )}
      </div>

      {/* ─────────────── [라운지 마스터 단일 확인 카드] 개인 라운지에서는 100% 숨김 · 사진 공유(패밀리·동호회·동창회)에서 확인 대기 건이 있을 때만 1장씩 노출 후 Auto-Hide ─────────────── */}
      {activeLoungeType !== 'personal' && (searchSpace === 'gallery' || searchSpace === 'video') && (
        <FaceMemberInlineBar
          onRunRealNameQuery={(query, targetSpace = 'gallery') => {
            setTextInput(query);
            setSearchSpace(targetSpace);
            void runTextQuery(query);
            scrollToResults();
          }}
        />
      )}
    </section>
  );
};
