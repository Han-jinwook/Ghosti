import React, { useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { FaceMemberInlineBar } from './FaceMemberRegistryModal';

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
  } = useSaySeeStore();

  const [textInput, setTextInput] = useState('');

  const activePhotos = useMemo(() => photos.filter((p) => !p.quarantined), [photos]);
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

  const searchPlaceholder = useMemo(() => {
    if (searchSpace === 'vault') {
      const ex = dynamicDocHints.slice(0, 2).map((d) => `"${d.query}"`).join(', ');
      return ex
        ? `서류·영수증·계약서 검색 (예: ${ex})`
        : '서류·영수증·계약서 본문 키워드를 입력해 보세요';
    }
    if (searchSpace === 'video') {
      const ex = dynamicMicroObjectChips.slice(0, 2).map((c) => `"${c.query}"`).join(', ');
      return ex
        ? `동영상·사진·문서 통합 검색 (예: ${ex})`
        : '동영상·사진·문서 속 장면이나 인물 이름을 검색해 보세요';
    }
    const ex = sentenceChips.slice(0, 2).map((s) => `"${s.query}"`).join(', ');
    return ex
      ? `기억나는 장면을 문장으로 검색해 보세요 (예: ${ex})`
      : '기억나는 장면을 문장으로 검색해 보세요';
  }, [searchSpace, dynamicDocHints, dynamicMicroObjectChips, sentenceChips]);

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

  const isMobile = layout === 'mobile';
  const activeSentencePool = useMemo(
    () => sentenceChips.slice(sentenceChipPage * 4, sentenceChipPage * 4 + 4),
    [sentenceChips, sentenceChipPage]
  );

  return (
    <section className="w-full flex flex-col gap-3">
      {/* ─────────────── 노션형 보더리스(Borderless) 통합 검색 캔버스 블록 ─────────────── */}
      <div className="w-full flex flex-col gap-3">
        {/* 1-A. 자연어 문장형 통합 검색창 */}
        <form onSubmit={handleTextSubmit} className="w-full flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <span className="material-symbols-outlined text-[20px] absolute left-4 pointer-events-none text-zinc-400">
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
              className="w-full h-12 md:h-13 pl-11 pr-24 rounded-2xl bg-[#18181B] border border-white/15 focus:border-primary-container shadow-sm outline-none font-body-md text-[13.5px] md:text-[14.5px] text-white placeholder:text-zinc-500 transition-colors"
            />
            {textInput && (
              <button
                type="button"
                onClick={() => setTextInput('')}
                className="absolute right-20 text-zinc-400 hover:text-white p-1 cursor-pointer"
                title="지우기"
              >
                <span className="material-symbols-outlined text-[17px]">close</span>
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 h-9 md:h-10 px-4 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-md text-[13px] font-extrabold transition-all whitespace-nowrap cursor-pointer"
            >
              검색
            </button>
          </div>

          <button
            type="button"
            onClick={() => void toggleMicRecording()}
            title="음성으로 검색"
            className={`h-12 md:h-13 px-3.5 rounded-2xl border flex items-center gap-1.5 font-label-md text-[13px] font-bold shrink-0 whitespace-nowrap transition-all cursor-pointer ${
              isListening
                ? 'bg-primary-container text-zinc-950 border-primary-container'
                : 'bg-[#18181B] hover:bg-zinc-800 text-zinc-200 border-white/15'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${
                isListening ? 'text-zinc-950' : 'text-primary-container'
              }`}
            >
              {isListening ? 'stop_circle' : 'mic'}
            </span>
            <span className="hidden sm:inline">{isListening ? '듣는 중...' : '음성'}</span>
          </button>
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

        {/* 1-B. 3대 카테고리 스위칭 캡슐 탭: [동영상] | [사진] | [문서] (이모지 없이 깔끔한 캡슐 디자인) */}
        <div className="flex flex-wrap items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <div className="flex items-center gap-2 shrink-0">
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
                  : `${videoSceneItems.length}개·${totalDissectedSegments}구간`}
              </span>
            </button>

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
                {hasExecutedUserSearch ? `(${searchResults.length})` : activePhotos.length}
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
                    (동영상 {matchedVideoScenes.length}) (사진 {searchResults.length}) (문서 {matchedTotalDocsCount})
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

        {/* 1-C. 선택한 탭에 맞는 추천 검색어 칩 1줄 가로 스크롤 (컬러 이모지 없이 깔끔한 캡슐 칩) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          <span className="font-label-mono text-[11px] text-zinc-400 font-semibold shrink-0 mr-1">
            추천 힌트:
          </span>

          {searchSpace === 'video' &&
            dynamicMicroObjectChips.map((item) => {
              const isSelectedChip = activeQuery === item.query;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleBriefingChipClick('video', item.query)}
                  className={`px-3.5 py-1.5 rounded-full border font-label-sm text-[12px] font-medium transition-all shrink-0 cursor-pointer outline-none focus:outline-none ${
                    isSelectedChip
                      ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                      : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border-white/10'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}

          {searchSpace === 'vault' &&
            dynamicDocHints.map((chip) => {
              const isSelectedChip = activeQuery === chip.query;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => handleBriefingChipClick('doc', chip.query)}
                  className={`px-3.5 py-1.5 rounded-full border font-label-sm text-[12px] font-medium transition-all shrink-0 cursor-pointer outline-none focus:outline-none ${
                    isSelectedChip
                      ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                      : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border-white/10'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}

          {searchSpace === 'gallery' && (
            <>
              {activeSentencePool.map((chip) => {
                const isSelectedChip = activeQuery === chip.query;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => handleGalleryChipClick(chip.query)}
                    className={`px-3.5 py-1.5 rounded-full border font-label-sm text-[12px] font-medium transition-all shrink-0 cursor-pointer outline-none focus:outline-none ${
                      isSelectedChip
                        ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                        : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border-white/10'
                    }`}
                  >
                    {chip.query}
                  </button>
                );
              })}
              {sentenceChips.length > 4 && (
                <button
                  type="button"
                  onClick={cycleSentenceChips}
                  className="px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-label-sm text-[11.5px] font-medium flex items-center gap-1 border border-white/10 shrink-0 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">autorenew</span>
                  <span>다른 문장</span>
                </button>
              )}
            </>
          )}
        </div>
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
