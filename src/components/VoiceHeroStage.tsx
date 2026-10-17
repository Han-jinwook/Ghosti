import React, { useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';

const BRIEFING_DOC_HINTS = [
  {
    id: 'hint_doc_insurance',
    label: '📄 삼성화재 자동차 보험 증권 및 특약',
    query: '삼성화재 자동차 보험 증권 및 특약',
    meta: 'PDF 문서 • 2026.05.01 (PC 바탕화면)',
  },
  {
    id: 'hint_doc_manual',
    label: '📄 원목 의자 단계별 조립 설명서 도면',
    query: '원목 의자 단계별 조립 설명서 도면',
    meta: 'PDF + 촬영 도면 • 2026.08.14 (PC 바탕화면·사진첩)',
  },
  {
    id: 'hint_doc_receipt',
    label: '📄 수트라하버 리조트 숙박 결제 영수증',
    query: '수트라하버 리조트 숙박 결제 영수증',
    meta: 'PDF 영수증 • 2024.07.11 (스마트폰 다운로드)',
  },
  {
    id: 'hint_doc_passport',
    label: '🛂 여권 및 항공권 이티켓 사본',
    query: '여권 신분증 항공권 예약 확인서',
    meta: '촬영 서류 + PDF • 갤러리·다운로드',
  },
];

const BRIEFING_VIDEO_HINTS = [
  {
    id: 'hint_vid_parasailing',
    query: '구명조끼 입고 무지개 낙하산 패러세일링 후 보트 갑판 착지',
    meta: '🎯 00:18 구간 포착 • 20240719_105706.mp4 (7구간 해부)',
  },
  {
    id: 'hint_vid_resort_couple',
    query: '야자수 리조트 소파에서 손가락 브이 포즈 취하다가 하트 목걸이 클로즈업',
    meta: '🎯 00:17 구간 포착 • 20240720_134808.mp4 (7구간 해부)',
  },
  {
    id: 'hint_vid_airplane_sunrise',
    query: '새벽 비행기 창문 너머 구름 위 일출을 스마트폰 카메라로 찍는 장면',
    meta: '🎯 00:07 구간 포착 • 20240722_052422.mp4 (6구간 해부)',
  },
];

const FREE_SEARCH_MICRO_OBJECT_CHIPS = [
  { label: '💎 하트 목걸이 (00:17)', query: '하트 목걸이 클로즈업', videoId: 'vid_full_02', seekSec: 17 },
  { label: '👒 밀짚모자 선글라스 (00:00)', query: '밀짚모자 선글라스 꽃무늬 반바지', videoId: 'vid_full_02', seekSec: 0 },
  { label: '✌️ 손가락 브이 포즈 (00:04)', query: '소파에 나란히 앉아 손가락 브이 포즈', videoId: 'vid_full_02', seekSec: 4 },
  { label: '🗣️ 동영상이다! 다가옴 (00:08)', query: '동영상이다 말하며 카메라로 다가오는 장면', videoId: 'vid_full_02', seekSec: 8 },
  { label: '🪢 보트 밧줄 매듭 (00:20)', query: '보트 갑판 굵은 밧줄 매듭', videoId: 'vid_full_01', seekSec: 20 },
  { label: '📱 스마트폰 앱 아이콘 (00:02)', query: '창가 아래 스마트폰 홈 화면 앱 아이콘', videoId: 'vid_full_03', seekSec: 2 },
];

const FALLBACK_SENTENCE_CHIPS = [
  {
    id: 'sent_kk_bridge',
    query: '코타키나발루 나무 다리 위에서 산책하는 모습',
  },
  {
    id: 'sent_night_fireshow',
    query: '한밤중 바닷가 화려한 불쇼 퍼포먼스',
  },
  {
    id: 'sent_terrace_drink',
    query: '야외 테라스에서 밤거리 보며 한잔하는 분위기',
  },
  {
    id: 'sent_yeouido_friends',
    query: '여의도 한강공원에서 친구들과 걷는 뒷모습',
  },
];

export const VoiceHeroStage: React.FC = () => {
  const {
    layout,
    photos,
    searchSpace,
    setSearchSpace,
    localDocuments,
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
    setSelectedVideoModal,
    openLocalFolder,
    setShowProModal,
    setDesktopTab,
    setMobileTab,
  } = useSaySeeStore();

  const [textInput, setTextInput] = useState('');
  // 2층 브리핑 보드 아코디언: 기본은 깔끔하게 접힌(Collapsed) 상태, 검색 실행 시에도 자동 접힘(Auto-Collapse)
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);

  const activePhotos = useMemo(() => photos.filter((p) => !p.quarantined), [photos]);
  const activeTrashCount = useMemo(
    () => activePhotos.filter((p) => Boolean(p.trashCategory)).length,
    [activePhotos]
  );
  const vaultPhotoCount = useMemo(
    () => activePhotos.filter((p) => p.isVaultDocument).length,
    [activePhotos]
  );
  const totalIndexedDocs = localDocuments.length + vaultPhotoCount; // 20건
  const totalDissectedSegments = useMemo(
    () => videoSceneItems.reduce((acc, v) => acc + v.timelineFrames.length, 0),
    [videoSceneItems]
  );

  const scrollToResults = () => {
    if (typeof document !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById('saysee-search-results')?.scrollIntoView({
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
    setIsBriefingOpen(false); // 검색 시 브리핑 아코디언 자동 접힘 (Auto-Collapse)
    await runTextQuery(q);
    scrollToResults();
  };

  const handleBriefingChipClick = (target: 'doc' | 'video', query: string) => {
    setTextInput(query);
    setIsBriefingOpen(false); // 칩 클릭 시 브리핑 아코디언 자동 접힘 (Auto-Collapse)
    void runBriefingHintChip(target, query);
  };

  const handleGalleryChipClick = (query: string) => {
    setTextInput(query);
    setIsBriefingOpen(false); // 칩 클릭 시 브리핑 아코디언 자동 접힘 (Auto-Collapse)
    setSearchSpace('gallery');
    void runTextQuery(query);
    scrollToResults();
  };

  const isMobile = layout === 'mobile';
  const activeSentencePool =
    sentenceChips.length >= 4
      ? sentenceChips.slice(sentenceChipPage * 4, sentenceChipPage * 4 + 4)
      : FALLBACK_SENTENCE_CHIPS;

  const topMatchedVideo = matchedVideoScenes[0];

  return (
    <section className="w-full flex flex-col gap-3">
      {/* ─────────────── [1층: 최상단 주인공] 통합 검색창 + 3대 카테고리 스위칭 탭 + 탭 맞춤형 1줄 추천 칩 ─────────────── */}
      <div className="w-full rounded-2xl bg-[#18181B] border border-white/10 p-4 md:p-5 shadow-lg flex flex-col gap-3.5">
        {/* 1-A. 자연어 문장형 통합 검색창 (최상단 배치) */}
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
              placeholder={
                searchSpace === 'vault'
                  ? '서류·영수증·계약서 검색 (예: "삼성화재 자동차 보험 증권", "원목 의자 조립 설명서")'
                  : searchSpace === 'video'
                  ? '동영상 3개 속 사물·행동 검색 (예: "하트 목걸이 클로즈업", "밀짚모자 선글라스", "보트 밧줄 매듭")'
                  : '기억나는 장면을 문장으로 검색해 보세요 (예: "나무 다리 위에서 산책하는 모습", "밤거리 보며 한잔하는 분위기")'
              }
              className="w-full h-12 md:h-13 pl-11 pr-24 rounded-xl bg-zinc-950/90 border border-white/10 focus:border-primary-container outline-none font-body-md text-[13.5px] md:text-[14.5px] text-white placeholder:text-zinc-500 transition-colors"
            />
            {textInput && (
              <button
                type="button"
                onClick={() => setTextInput('')}
                className="absolute right-20 text-zinc-400 hover:text-white p-1"
                title="지우기"
              >
                <span className="material-symbols-outlined text-[17px]">close</span>
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 h-9 md:h-10 px-4 rounded-lg bg-primary-container hover:opacity-95 text-zinc-950 font-label-md text-[13px] font-extrabold transition-all"
            >
              검색
            </button>
          </div>

          <button
            type="button"
            onClick={() => void toggleMicRecording()}
            title="음성으로 검색"
            className={`h-12 md:h-13 px-3.5 rounded-xl border flex items-center gap-1.5 font-label-md text-[13px] font-bold shrink-0 transition-all ${
              isListening
                ? 'bg-primary-container text-zinc-950 border-primary-container'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-white/10'
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

        {/* 1-B. 3대 카테고리 스위칭 탭 (무채색 다크그레이 베이스 + 선택된 탭에만 단일 민트 포인트) */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setTextInput('');
                setSearchSpace('gallery');
              }}
              className={`px-3.5 py-2 rounded-xl font-label-md text-[12.5px] md:text-[13px] font-bold flex items-center gap-1.5 transition-all border shrink-0 ${
                searchSpace === 'gallery'
                  ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                  : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/10'
              }`}
            >
              <span>🖼️ 전체 갤러리</span>
              <span
                className={`px-1.5 py-0.2 rounded-md text-[11px] font-mono ${
                  searchSpace === 'gallery' ? 'bg-black/20 text-zinc-950 font-black' : 'text-zinc-400'
                }`}
              >
                {activePhotos.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTextInput('');
                setSearchSpace('vault');
              }}
              className={`px-3.5 py-2 rounded-xl font-label-md text-[12.5px] md:text-[13px] font-bold flex items-center gap-1.5 transition-all border shrink-0 ${
                searchSpace === 'vault'
                  ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                  : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/10'
              }`}
            >
              <span>📁 스마트 서류함</span>
              <span
                className={`px-1.5 py-0.2 rounded-md text-[11px] font-mono ${
                  searchSpace === 'vault' ? 'bg-black/20 text-zinc-950 font-black' : 'text-zinc-400'
                }`}
              >
                {totalIndexedDocs}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTextInput('');
                setSearchSpace('video');
              }}
              className={`px-3.5 py-2 rounded-xl font-label-md text-[12.5px] md:text-[13px] font-bold flex items-center gap-1.5 transition-all border shrink-0 ${
                searchSpace === 'video'
                  ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                  : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-white/10'
              }`}
            >
              <span>🎬 동영상 해부</span>
              <span
                className={`px-1.5 py-0.2 rounded-md text-[11px] font-mono ${
                  searchSpace === 'video' ? 'bg-black/20 text-zinc-950 font-black' : 'text-zinc-400'
                }`}
              >
                {videoSceneItems.length}개·{totalDissectedSegments}구간
              </span>
            </button>
          </div>

          {searchSpace === 'vault' && !isMobile && (
            <button
              type="button"
              onClick={() => void openLocalFolder('docs')}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-label-sm text-[11.5px] font-medium border border-white/10 shrink-0"
            >
              📂 로컬 서류폴더 열기
            </button>
          )}
        </div>

        {/* 1-C. 선택한 탭에 맞는 추천 검색어 칩 1줄 가로 스크롤 (주절주절 긴 설명 없이 깔끔하게 1줄!) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          <span className="font-label-mono text-[11px] text-zinc-400 font-semibold shrink-0 mr-1">
            추천 힌트:
          </span>

          {searchSpace === 'video' &&
            FREE_SEARCH_MICRO_OBJECT_CHIPS.map((item) => {
              const isSelectedChip = activeQuery === item.query;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleBriefingChipClick('video', item.query)}
                  className={`px-3 py-1.5 rounded-lg border font-label-sm text-[12px] font-medium transition-all shrink-0 cursor-pointer ${
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
            BRIEFING_DOC_HINTS.map((chip) => {
              const isSelectedChip = activeQuery === chip.query;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => handleBriefingChipClick('doc', chip.query)}
                  className={`px-3 py-1.5 rounded-lg border font-label-sm text-[12px] font-medium transition-all shrink-0 cursor-pointer ${
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
                    className={`px-3 py-1.5 rounded-lg border font-label-sm text-[12px] font-medium transition-all shrink-0 cursor-pointer ${
                      isSelectedChip
                        ? 'bg-primary-container text-zinc-950 border-primary-container font-extrabold'
                        : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border-white/10'
                    }`}
                  >
                    ✨ {chip.query}
                  </button>
                );
              })}
              {sentenceChips.length > 4 && (
                <button
                  type="button"
                  onClick={cycleSentenceChips}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-label-sm text-[11.5px] font-medium flex items-center gap-1 border border-white/10 shrink-0"
                >
                  <span className="material-symbols-outlined text-[14px]">autorenew</span>
                  <span>다른 문장</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─────────────── [2층: 접고 펴는 스마트 가이드 바 (Collapsible Accordion)] ─────────────── */}
      <div className="w-full rounded-2xl bg-zinc-900/70 border border-white/10 overflow-hidden transition-all">
        {/* 접힌 상태에서도 항상 보이는 깔끔한 1줄 요약 바 */}
        <div className="w-full px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsBriefingOpen((prev) => !prev)}
            className="flex items-center gap-2 text-left min-w-0 flex-1 cursor-pointer group"
          >
            <span className="px-2 py-0.5 rounded bg-zinc-800 border border-white/10 text-primary-container font-label-mono text-[10.5px] font-bold shrink-0">
              ✨ 무료 체험 준비 완료
            </span>
            <span className="font-body-sm text-[12.5px] md:text-[13px] text-zinc-300 font-medium truncate">
              서류 <strong className="text-white">{totalIndexedDocs}건</strong> · 동영상{' '}
              <strong className="text-white">{videoSceneItems.length}개({totalDissectedSegments}구간)</strong> 해부됨 · 중복/연사{' '}
              <strong className="text-white">{activeTrashCount}장</strong> 진단 완료
            </span>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (isMobile) setMobileTab('trash');
                else setDesktopTab('trash');
              }}
              className="hidden sm:inline-flex px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white font-label-sm text-[11.5px] font-medium transition-colors"
            >
              🧹 중복·연사 {activeTrashCount}장 정리 →
            </button>
            <button
              type="button"
              onClick={() => setIsBriefingOpen((prev) => !prev)}
              className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-200 font-label-sm text-[11.5px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>
                💡 무료 체험 분석 리포트 &amp; 테스트 가이드 {isBriefingOpen ? '접기 ▴' : '펼쳐보기 ▾'}
              </span>
            </button>
          </div>
        </div>

        {/* 펼쳐졌을 때만 나타나는 상세 브리핑 패널 (검색 실행 시 자동으로 스르륵 접힘) */}
        {isBriefingOpen && (
          <div className="px-4 pb-4 pt-3 border-t border-white/10 flex flex-col gap-4 bg-zinc-950/60">
            {/* 2-A. 해부된 동영상 3개 가로 스와이프 카드덱 (Horizontal Snap Carousel) */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-body-sm text-[12.5px] text-zinc-300 font-medium">
                  🎬 최근 동영상 3개를 처음부터 끝까지 1초 단위로 해부(총 {totalDissectedSegments}개 구간)했습니다. 카드를 좌우로 넘기거나 초(Sec) 버튼을 눌러 즉시 점프 재생해 보세요.
                </p>
                <span className="font-label-mono text-[11px] text-zinc-400">
                  역추적 구간: 2024.07.11 ~ 2026.10.14
                </span>
              </div>

              {/* 모바일/컴팩트에서는 좌우 스와이프(Carousel), 와이드 데스크톱에서는 3열 */}
              <div className="flex md:grid md:grid-cols-3 gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1">
                {videoSceneItems.map((baseVid, idx) => {
                  const liveVid = matchedVideoScenes.find((m) => m.id === baseVid.id) ?? baseVid;
                  const isTopMatched = searchSpace === 'video' && topMatchedVideo?.id === baseVid.id;
                  return (
                    <div
                      key={baseVid.id}
                      onClick={() => {
                        setSearchSpace('video');
                        setSelectedVideoModal(liveVid, liveVid.matchedSeekSec);
                      }}
                      className={`min-w-[85%] sm:min-w-[320px] md:min-w-0 snap-center group p-3 rounded-xl flex flex-col gap-2.5 cursor-pointer transition-all border ${
                        isTopMatched
                          ? 'bg-zinc-900 border-primary-container'
                          : 'bg-zinc-900/70 hover:bg-zinc-900 border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-black shrink-0 border border-white/10">
                          <video
                            key={`${liveVid.id}-${liveVid.matchedSeekSec}`}
                            src={`${liveVid.videoUrl}#t=${liveVid.matchedSeekSec}`}
                            poster={liveVid.thumbUrl}
                            preload="metadata"
                            muted
                            playsInline
                            onLoadedMetadata={(e) => {
                              try {
                                e.currentTarget.currentTime = liveVid.matchedSeekSec;
                              } catch {
                                // ignore
                              }
                            }}
                            className="w-full h-full object-cover pointer-events-none"
                          />
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded bg-black/80 text-white font-label-mono text-[9.5px] font-bold">
                            {liveVid.durationText}
                          </span>
                          <span className="absolute top-1 left-1 px-1.5 py-0.2 rounded bg-zinc-900/90 text-zinc-200 font-label-mono text-[9px] font-bold border border-white/10">
                            #{idx + 1}
                          </span>
                        </div>
                        <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-label-mono text-[10px] text-zinc-400">
                              00:00~{liveVid.durationText} ({liveVid.timelineFrames.length}구간)
                            </span>
                            <span className="px-2 py-0.5 rounded bg-zinc-800 text-primary-container font-label-mono text-[9.5px] font-bold shrink-0">
                              ▶ {liveVid.matchedTimestamp}
                            </span>
                          </div>
                          <span className="font-label-md text-[12.5px] text-white font-bold truncate">
                            {liveVid.title}
                          </span>
                          <span className="font-body-sm text-[11px] text-zinc-400 truncate">
                            {liveVid.matchedFrameCaption}
                          </span>
                        </div>
                      </div>

                      {/* 초(Sec) 점프 버튼 */}
                      <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-white/10">
                        <span className="font-label-mono text-[9.5px] text-zinc-500 mr-0.5">
                          초 점프:
                        </span>
                        {liveVid.timelineFrames.map((f) => {
                          const isCurrentSec = liveVid.matchedSeekSec === f.timeSec;
                          return (
                            <button
                              key={f.timeSec}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearchSpace('video');
                                setSelectedVideoModal(liveVid, f.timeSec);
                              }}
                              title={`${f.timestampText} (${f.phaseLabel}): ${f.sceneCaption}`}
                              className={`px-1.5 py-0.5 rounded font-label-mono text-[9.5px] font-bold transition-all ${
                                isCurrentSec
                                  ? 'bg-primary-container text-zinc-950 font-black'
                                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                              }`}
                            >
                              {f.timestampText}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2-B. 서류 힌트 3개 & 동영상 문장 힌트 3개 (가로 스와이프 지원 차분한 다크 카드) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/10 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-[12.5px] text-zinc-200 font-bold">
                    📄 서류 내용 힌트 ({totalIndexedDocs}건 중 추출)
                  </span>
                  <span className="font-label-mono text-[10px] text-zinc-400">
                    PDF + 촬영 영수증·설명서
                  </span>
                </div>
                <div className="flex lg:flex-col gap-2 overflow-x-auto snap-x snap-mandatory no-scrollbar">
                  {BRIEFING_DOC_HINTS.slice(0, 3).map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => handleBriefingChipClick('doc', chip.query)}
                      className="min-w-[260px] lg:min-w-0 snap-center px-3 py-2 rounded-lg bg-zinc-950/70 hover:bg-zinc-800/80 border border-white/10 text-left flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12.5px] text-zinc-100 font-semibold truncate">
                          “{chip.query}”
                        </span>
                        <span className="text-[11px] text-zinc-400 truncate">{chip.meta}</span>
                      </div>
                      <span className="text-[11px] text-primary-container font-mono shrink-0">
                        검색 →
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/10 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-[12.5px] text-zinc-200 font-bold">
                    🎬 동영상 3개 전 구간 문장 힌트 ({totalDissectedSegments}개 구간)
                  </span>
                  <span className="font-label-mono text-[10px] text-zinc-400">
                    해당 초(Sec) 즉시 점프
                  </span>
                </div>
                <div className="flex lg:flex-col gap-2 overflow-x-auto snap-x snap-mandatory no-scrollbar">
                  {BRIEFING_VIDEO_HINTS.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => handleBriefingChipClick('video', chip.query)}
                      className="min-w-[260px] lg:min-w-0 snap-center px-3 py-2 rounded-lg bg-zinc-950/70 hover:bg-zinc-800/80 border border-white/10 text-left flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12.5px] text-zinc-100 font-semibold truncate">
                          “{chip.query}”
                        </span>
                        <span className="text-[11px] text-zinc-400 truncate">{chip.meta}</span>
                      </div>
                      <span className="text-[11px] text-primary-container font-mono shrink-0">
                        재생 →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2-C. 차분하고 세련된 다크 카드 형태의 전체 연결 & 요금제 안내 (형광 노란 그라데이션 제거) */}
            <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-[16px] shrink-0">🚀</span>
                <p className="font-body-sm text-[12.5px] text-zinc-300 font-medium truncate">
                  내 폰과 PC의 나머지 10년 치 모든 사진·동영상·서류를 전부 연결하고 깨끗이 정리하시겠습니까?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-amber-400 font-label-sm text-[12px] font-bold shrink-0 transition-colors self-start sm:self-auto"
              >
                1,900원 단품 / 월 1,100원 (10년 특전) 열기 →
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
