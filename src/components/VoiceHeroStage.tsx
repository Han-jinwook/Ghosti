import React, { useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';

const BRIEFING_DOC_HINTS = [
  {
    id: 'hint_doc_insurance',
    query: '삼성화재 자동차 보험 증권 및 특약',
    meta: 'PDF 문서 • 2026.05.01 (PC 바탕화면)',
  },
  {
    id: 'hint_doc_manual',
    query: '원목 의자 단계별 조립 설명서 도면',
    meta: 'PDF + 촬영 도면 • 2026.08.14 (PC 바탕화면·사진첩)',
  },
  {
    id: 'hint_doc_receipt',
    query: '수트라하버 리조트 숙박 결제 영수증',
    meta: 'PDF 영수증 • 2024.07.11 (스마트폰 다운로드)',
  },
];

const BRIEFING_VIDEO_HINTS = [
  {
    id: 'hint_vid_parasailing',
    query: '구명조끼 입고 무지개 낙하산 패러세일링 후 보트 갑판 착지',
    meta: '🎯 00:18 구간 포착 • 20240719_105706.mp4 (전 구간 7프레임 해부)',
  },
  {
    id: 'hint_vid_resort_couple',
    query: '야자수 리조트 소파에서 손가락 브이 포즈 취하다가 하트 목걸이 클로즈업',
    meta: '🎯 00:17 구간 포착 • 20240720_134808.mp4 (전 구간 7프레임 해부)',
  },
  {
    id: 'hint_vid_airplane_sunrise',
    query: '새벽 비행기 창문 너머 구름 위 일출을 스마트폰 카메라로 찍는 장면',
    meta: '🎯 00:07 구간 포착 • 20240722_052422.mp4 (전 구간 6프레임 해부)',
  },
];

const FREE_SEARCH_MICRO_OBJECT_CHIPS = [
  { label: '💎 하트 목걸이 (00:17)', query: '하트 목걸이 클로즈업' },
  { label: '👒 밀짚모자 선글라스 (00:00)', query: '밀짚모자 선글라스 꽃무늬 반바지' },
  { label: '✌️ 손가락 브이 포즈 (00:04)', query: '소파에 나란히 앉아 손가락 브이 포즈' },
  { label: '🗣️ 동영상이다! 다가옴 (00:08)', query: '동영상이다 말하며 카메라로 다가오는 장면' },
  { label: '🪢 보트 밧줄 매듭 (00:20)', query: '보트 갑판 굵은 밧줄 매듭' },
  { label: '📱 스마트폰 앱 아이콘 (00:02)', query: '창가 아래 스마트폰 홈 화면 앱 아이콘' },
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
    trialScanPermissions,
    onboardingTrackMode,
    setOnboardingTrackMode,
    pcAgentPairedMobile,
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
    setShowOnboarding,
    setShowProModal,
    setDesktopTab,
    setMobileTab,
  } = useSaySeeStore();

  const [textInput, setTextInput] = useState('');

  const activePhotos = useMemo(() => photos.filter((p) => !p.quarantined), [photos]);
  const activeTrashCount = useMemo(
    () => activePhotos.filter((p) => Boolean(p.trashCategory)).length,
    [activePhotos]
  );
  const vaultPhotoCount = useMemo(
    () => activePhotos.filter((p) => p.isVaultDocument).length,
    [activePhotos]
  );
  const totalIndexedDocs = localDocuments.length + vaultPhotoCount; // 12 + 8 = 20건
  const totalDissectedSegments = useMemo(
    () => videoSceneItems.reduce((acc, v) => acc + v.timelineFrames.length, 0),
    [videoSceneItems]
  );

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = textInput.trim();
    if (!q) return;
    void runTextQuery(q);
  };

  const handleBriefingChipClick = (target: 'doc' | 'video', query: string) => {
    setTextInput(query);
    void runBriefingHintChip(target, query);
  };

  const handleGalleryChipClick = (query: string) => {
    setTextInput(query);
    setSearchSpace('gallery');
    void runTextQuery(query);
  };

  const isMobile = layout === 'mobile';
  const activeSentencePool =
    sentenceChips.length >= 4
      ? sentenceChips.slice(sentenceChipPage * 4, sentenceChipPage * 4 + 4)
      : FALLBACK_SENTENCE_CHIPS;

  return (
    <section className="w-full flex flex-col gap-4">
      {/* ─────────────── [1. 온보딩 프레임 대전환] Track A (내 PC 직접 구동 권장 + QR 모바일 연결) vs Track B (모바일 단독 시 클라우드 GPU 서버 무료 대여) ─────────────── */}
      <div className="w-full p-3.5 md:px-5 rounded-2xl bg-gradient-to-r from-emerald-950/95 via-[#072a34]/95 to-surface-container-high border border-emerald-400/55 shadow-md flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setOnboardingTrackMode('pc_local')}
              className={`px-3 py-1 rounded-xl font-label-sm text-[11.5px] font-black transition-all flex items-center gap-1 border ${
                onboardingTrackMode === 'pc_local'
                  ? 'bg-emerald-400 text-surface-container-lowest border-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.4)]'
                  : 'bg-black/40 text-emerald-300 border-emerald-400/35 hover:border-emerald-400'
              }`}
            >
              <span>💻 내 PC 직접 구동 (권장 · 외부 전송 0%)</span>
            </button>
            <button
              type="button"
              onClick={() => setOnboardingTrackMode('cloud_rental')}
              className={`px-3 py-1 rounded-xl font-label-sm text-[11.5px] font-black transition-all flex items-center gap-1 border ${
                onboardingTrackMode === 'cloud_rental'
                  ? 'bg-primary-container text-on-primary-container border-primary-container shadow-[0_0_14px_rgba(0,229,255,0.4)]'
                  : 'bg-black/40 text-primary-container border-primary-container/35 hover:border-primary-container'
              }`}
            >
              <span>📱 모바일 단독: GPU 서버 무료 대여</span>
            </button>
          </div>

          <span className="font-label-md text-[12px] md:text-[12.5px] text-white font-bold leading-snug">
            {onboardingTrackMode === 'pc_local'
              ? '🔒 MS EV 인증 SaySee_PC_Agent.exe 가동 중: 파일이 외부로 단 1바이트도 나가지 않고 100% 내 PC 내부에서만 분석됩니다.'
              : '⚡ 스마트폰 발열·배터리 보호를 위해 세이씨 초고속 GPU 서버 무료 대여 중 (무거운 원본 미전송 · 서버 RAM 0.1초 연산 후 즉시 자동 소각)'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="px-3 py-1.5 rounded-xl bg-black/50 hover:bg-black/70 border border-emerald-400/50 text-emerald-300 font-label-mono text-[11px] font-extrabold flex items-center gap-1.5 transition-all"
          >
            <span className="material-symbols-outlined text-[15px]">qr_code_2</span>
            <span>
              📱 QR 모바일 동시 페어링 {pcAgentPairedMobile ? '(연결됨)' : '(스캔하기)'}
            </span>
          </button>
          <span className="px-2.5 py-1 rounded-lg bg-black/45 border border-outline-variant/35 font-label-mono text-[11px] text-on-surface-variant font-bold hidden sm:inline">
            검진 허용: {trialScanPermissions.gallery ? '☑️사진첩 ' : ''}
            {trialScanPermissions.downloads ? '☑️다운로드 ' : ''}
            {trialScanPermissions.desktop ? '☑️바탕화면' : ''}
          </span>
          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="px-3.5 py-1.5 rounded-xl bg-primary-container hover:opacity-95 text-on-primary-container font-label-sm text-[11.5px] font-black shadow-[0_0_14px_rgba(0,229,255,0.35)] transition-all"
          >
            🚀 내 PC 안심 체험 &amp; QR 연결 모달
          </button>
        </div>
      </div>

      {/* ─────────────── [2. 체험 완료 브리핑 보드] 동영상 3개 전 구간(Full-Timeline) 완전 해부 + 서류 20건 ─────────────── */}
      <div className="w-full rounded-3xl bg-gradient-to-br from-[#071f29] via-surface-container-low to-[#1c1607] border-2 border-primary-container/45 p-5 md:p-6 shadow-[0_0_40px_rgba(0,229,255,0.14)] flex flex-col gap-4">
        {/* 브리핑 헤더 & 분석 날짜 범위 */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-outline-variant/25">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-mono text-[10.5px] font-black uppercase">
                FREE TRIAL BRIEFING BOARD
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-black/50 border border-outline-variant/40 text-emerald-300 font-label-mono text-[11px] font-bold">
                📅 역추적 분석 구간: 2024.07.11 ~ 2026.10.14 (1분 이내 초고속 색인 완료)
              </span>
            </div>
            <h2 className="font-headline-md text-[17px] md:text-[20px] text-white font-extrabold tracking-tight mt-0.5">
              🎉 무료 체험 분석 완료! (
              <button
                type="button"
                onClick={() => {
                  if (isMobile) setMobileTab('trash');
                  else setDesktopTab('trash');
                }}
                className="text-emerald-300 underline hover:opacity-90"
              >
                🧹 정리 대상 중복/연사 {activeTrashCount}장 발견
              </button>{' '}
              | <span className="text-[#FFAB00]">📄 최근 서류 {totalIndexedDocs}건</span> 및{' '}
              <span className="text-primary-container">
                🎬 최신 동영상 {videoSceneItems.length}개 전 구간({totalDissectedSegments}개 프레임)
              </span>{' '}
              완전 해부 완료)
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isMobile) setMobileTab('trash');
              else setDesktopTab('trash');
            }}
            className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 font-label-sm text-[12px] font-extrabold shrink-0 self-start lg:self-auto"
          >
            🧹 중복·연사 {activeTrashCount}장 진단서 바로 보기 →
          </button>
        </div>

        {/* [핵심 지시사항 2] 해부된 최신 동영상 3개 썸네일 프리뷰 & 자유 검색 선언 배너 */}
        <div className="p-4 rounded-2xl bg-black/55 border-2 border-primary-container/55 flex flex-col gap-3 shadow-[0_0_24px_rgba(0,229,255,0.12)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <p className="font-headline-sm text-[13.5px] md:text-[14.5px] text-white font-extrabold leading-relaxed">
              🎬 최근 동영상 3개를 처음부터 끝까지 <span className="text-primary-container">1초 단위로 완벽 해부(총 {totalDissectedSegments}개 구간)</span>했습니다! 아래 추천 힌트뿐만 아니라,{' '}
              <span className="text-[#FFD740] underline decoration-[#FFD740]/60">
                이 영상 3개 안에 스쳐 지나가는 어떤 사물이나 행동이든 검색창에 자유롭게 입력해서 시험해 보세요!
              </span>
            </p>
            <span className="px-2.5 py-1 rounded-full bg-primary-container/20 border border-primary-container/50 text-primary-container font-label-mono text-[10.5px] font-black shrink-0 self-start md:self-auto">
              00:00 ~ 끝 전 구간 색인 • 타임라인 점프 재생 지원
            </span>
          </div>

          {/* 해부된 동영상 3개 썸네일 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {videoSceneItems.map((vid, idx) => (
              <div
                key={vid.id}
                onClick={() => {
                  setSearchSpace('video');
                  setSelectedVideoModal(vid, vid.matchedSeekSec);
                }}
                className="group p-2.5 rounded-xl bg-surface-container-high/90 hover:bg-surface-bright border border-primary-container/35 hover:border-primary-container flex items-center gap-3 cursor-pointer transition-all"
              >
                <div className="relative w-20 h-14 rounded-lg overflow-hidden bg-black shrink-0 border border-primary-container/40">
                  <img
                    src={vid.thumbUrl}
                    alt={vid.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded bg-black/85 text-white font-label-mono text-[9.5px] font-bold">
                    {vid.durationText}
                  </span>
                  <span className="absolute top-1 left-1 px-1.5 py-0.2 rounded bg-primary-container text-on-primary-container font-label-mono text-[9px] font-black">
                    영상 #{idx + 1}
                  </span>
                </div>
                <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-label-mono text-[10px] text-emerald-300 font-black">
                      00:00~{vid.durationText} ({vid.timelineFrames.length}구간 해부)
                    </span>
                    <span className="font-label-mono text-[9.5px] text-primary-container font-bold">
                      ▶ 구간 재생
                    </span>
                  </div>
                  <span className="font-label-md text-[12px] text-white font-extrabold truncate">
                    {vid.title}
                  </span>
                  <span className="font-body-sm text-[10.5px] text-on-surface-variant truncate">
                    {vid.timelineFrames.map((f) => f.timestampText).join(' · ')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* 영상 3개 속 스쳐 지나가는 사물/행동 자유 검색 테스트 칩 */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="font-label-mono text-[11px] text-[#FFD740] font-extrabold mr-1">
              🔍 스쳐 지나가는 사물·행동 즉시 포착 시험:
            </span>
            {FREE_SEARCH_MICRO_OBJECT_CHIPS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleBriefingChipClick('video', item.query)}
                className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-primary-container hover:text-on-primary-container border border-primary-container/40 text-white font-label-sm text-[11px] font-bold transition-all"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 좌우 2열: 📄 [서류 내용 힌트 칩] (3개) & 🎬 [동영상 장면 힌트 칩] (3개) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 좌측: 📄 [서류 내용 힌트 칩] */}
          <div className="p-4 rounded-2xl bg-black/40 border border-[#FFAB00]/45 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-headline-sm text-[14px] text-[#FFAB00] font-extrabold flex items-center gap-1.5">
                <span>📄 [서류 내용 힌트 칩]</span>
                <span className="text-[11px] text-on-surface-variant font-normal">
                  (최근 서류 {totalIndexedDocs}건 중 추출)
                </span>
              </span>
              <span className="px-2 py-0.5 rounded bg-[#FFAB00]/20 text-[#FFAB00] font-label-mono text-[10px] font-bold">
                PDF + 영수증 + 설명서
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {BRIEFING_DOC_HINTS.map((chip) => {
                const isActive = searchSpace === 'vault' && activeQuery === chip.query;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => handleBriefingChipClick('doc', chip.query)}
                    className={`px-3.5 py-2.5 rounded-xl text-left transition-all flex items-center justify-between gap-2 border ${
                      isActive
                        ? 'bg-[#FFAB00] text-surface-container-lowest font-black border-[#FFAB00] shadow-[0_0_16px_rgba(255,171,0,0.4)]'
                        : 'bg-surface-container-high/90 hover:bg-surface-bright text-white border-[#FFAB00]/35 hover:border-[#FFAB00]'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] md:text-[13.5px] font-extrabold truncate">
                        📄 “{chip.query}”
                      </span>
                      <span
                        className={`text-[11px] truncate ${
                          isActive ? 'text-surface-container-lowest/80' : 'text-on-surface-variant'
                        }`}
                      >
                        {chip.meta}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full font-label-mono text-[10px] shrink-0 ${
                        isActive
                          ? 'bg-black/20 text-surface-container-lowest font-black'
                          : 'bg-[#FFAB00]/20 text-[#FFAB00] font-bold'
                      }`}
                    >
                      0.04초 검색 →
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 우측: 🎬 [동영상 3개 전 구간 해부 힌트 칩] */}
          <div className="p-4 rounded-2xl bg-black/40 border border-primary-container/50 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-headline-sm text-[14px] text-primary-container font-extrabold flex items-center gap-1.5">
                <span>🎬 [동영상 3개 전 구간 힌트 칩]</span>
                <span className="text-[11px] text-on-surface-variant font-normal">
                  (총 {totalDissectedSegments}개 타임라인 구간 중 포착)
                </span>
              </span>
              <span className="px-2 py-0.5 rounded bg-primary-container/20 text-primary-container font-label-mono text-[10px] font-bold">
                🎯 해당 초(Sec) 점프 재생
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {BRIEFING_VIDEO_HINTS.map((chip) => {
                const isActive = searchSpace === 'video' && activeQuery === chip.query;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => handleBriefingChipClick('video', chip.query)}
                    className={`px-3.5 py-2.5 rounded-xl text-left transition-all flex items-center justify-between gap-2 border ${
                      isActive
                        ? 'bg-primary-container text-on-primary-container font-black border-primary-container shadow-[0_0_16px_rgba(0,229,255,0.4)]'
                        : 'bg-surface-container-high/90 hover:bg-surface-bright text-white border-primary-container/35 hover:border-primary-container'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] md:text-[13.5px] font-extrabold truncate">
                        🎬 “{chip.query}”
                      </span>
                      <span
                        className={`text-[11px] truncate ${
                          isActive ? 'text-on-primary-container/80' : 'text-on-surface-variant'
                        }`}
                      >
                        {chip.meta}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full font-label-mono text-[10px] shrink-0 ${
                        isActive
                          ? 'bg-black/20 text-on-primary-container font-black'
                          : 'bg-primary-container/20 text-primary-container font-bold'
                      }`}
                    >
                      구간 포착 →
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 브리핑 보드 바로 아래: 전환(Conversion) 유도 버튼 */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowProModal(true)}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#FFAB00] via-[#FFC400] to-[#00E5FF] text-surface-container-lowest font-headline-sm text-[13.5px] md:text-[15px] font-black shadow-[0_0_28px_rgba(255,171,0,0.35)] hover:brightness-105 active:scale-[0.99] transition-all flex flex-wrap items-center justify-center gap-2"
          >
            <span>🚀 내 폰과 PC의 나머지 10년 치 모든 사진·동영상·서류를 전부 연결하고 깨끗이 청소하시겠습니까?</span>
            <span className="px-2.5 py-0.5 rounded-full bg-black/80 text-[#FFD740] text-[11.5px] font-extrabold">
              1,900원 단품 / 월 1,100원 (선착순 10년권) 열기 →
            </span>
          </button>
        </div>
      </div>

      {/* ─────────────── 검색 공간 3-Track 스위칭 필터 & 통합 문장 검색창 ─────────────── */}
      <div className="w-full rounded-3xl bg-surface-container/85 backdrop-blur-2xl border border-outline-variant/30 p-5 md:p-6 shadow-xl flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-outline-variant/25">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTextInput('');
                setSearchSpace('video');
              }}
              className={`px-4 py-2.5 rounded-2xl font-label-lg text-[13px] md:text-[13.5px] font-extrabold flex items-center gap-2 transition-all border ${
                searchSpace === 'video'
                  ? 'bg-primary-container text-on-primary-container border-primary-container shadow-[0_0_20px_rgba(0,229,255,0.35)]'
                  : 'bg-surface-container-lowest/80 hover:bg-surface-container-high text-on-surface border-primary-container/35'
              }`}
            >
              <span>🎬 동영상 3개 전 구간 검색</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                  searchSpace === 'video'
                    ? 'bg-black/25 text-on-primary-container'
                    : 'bg-primary-container/20 text-primary-container'
                }`}
              >
                {videoSceneItems.length}개 영상 · {totalDissectedSegments}구간
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTextInput('');
                setSearchSpace('vault');
              }}
              className={`px-4 py-2.5 rounded-2xl font-label-lg text-[13px] md:text-[13.5px] font-extrabold flex items-center gap-2 transition-all border ${
                searchSpace === 'vault'
                  ? 'bg-[#FFAB00] text-surface-container-lowest border-[#FFAB00] shadow-[0_0_24px_rgba(255,171,0,0.45)]'
                  : 'bg-surface-container-lowest/80 hover:bg-surface-container-high text-on-surface border-[#FFAB00]/40'
              }`}
            >
              <span>📁 스마트 서류함</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                  searchSpace === 'vault'
                    ? 'bg-black/25 text-surface-container-lowest'
                    : 'bg-[#FFAB00]/20 text-[#FFAB00]'
                }`}
              >
                최근 {totalIndexedDocs}건 (PDF {localDocuments.length} + 서류사진 {vaultPhotoCount})
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTextInput('');
                setSearchSpace('gallery');
              }}
              className={`px-4 py-2.5 rounded-2xl font-label-lg text-[13px] md:text-[13.5px] font-extrabold flex items-center gap-2 transition-all border ${
                searchSpace === 'gallery'
                  ? 'bg-emerald-400 text-surface-container-lowest border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                  : 'bg-surface-container-lowest/80 hover:bg-surface-container-high text-on-surface-variant border-outline-variant/30'
              }`}
            >
              <span>🖼️ 전체 갤러리 통합</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                  searchSpace === 'gallery'
                    ? 'bg-black/25 text-surface-container-lowest'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {activePhotos.length}장
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {searchSpace === 'vault' && (
              <button
                type="button"
                onClick={() => void openLocalFolder('docs')}
                className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-bright text-[#FFAB00] font-label-sm text-[11.5px] font-bold border border-[#FFAB00]/35 shrink-0"
              >
                📂 PDF 서류폴더 열기
              </button>
            )}
          </div>
        </div>

        {/* 모바일 화면이거나 음성 녹음 중일 때: 중앙 마이크 영역 */}
        {(isMobile || isListening) && (
          <div className="flex flex-col items-center justify-center gap-2.5 py-1">
            <button
              type="button"
              onClick={() => void toggleMicRecording()}
              aria-label="음성으로 찾기"
              className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-[0_0_32px_rgba(0,229,255,0.45)] ${
                isListening
                  ? 'bg-primary-container text-on-primary-container scale-105 ring-4 ring-primary-container/50'
                  : 'bg-gradient-to-tr from-secondary-container via-[#00626e] to-primary-container text-primary-container hover:scale-105 active:scale-95'
              }`}
            >
              <span className="material-symbols-outlined text-[30px]">
                {isListening ? 'stop_circle' : 'mic'}
              </span>
            </button>

            {isListening ? (
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-1 h-7">
                  {liveWaveBands.slice(0, 12).map((amp, i) => (
                    <span
                      key={i}
                      style={{ height: `${Math.max(6, Math.round(amp * 28))}px` }}
                      className="w-1.5 rounded-full bg-primary-container transition-all duration-100"
                    />
                  ))}
                </div>
                <p className="font-headline-sm text-[14px] text-primary-container font-bold">
                  {interimSttPreview
                    ? `“${interimSttPreview}”`
                    : '말씀해 주세요... (말씀이 끝나면 자동으로 즉시 검색됩니다)'}
                </p>
              </div>
            ) : (
              <p className="font-body-sm text-[12px] text-on-surface-variant text-center">
                마이크를 누르고 동영상 3개 속 스쳐 지나가는 사물·행동이나 서류 내용을 말씀해 보세요
              </p>
            )}
          </div>
        )}

        {/* PC & 모바일 공통: 자연어 문장형 통합 검색창 */}
        <form onSubmit={handleTextSubmit} className="w-full flex items-center gap-2.5">
          <div className="relative flex-1 flex items-center">
            <span
              className={`material-symbols-outlined text-[22px] absolute left-4 pointer-events-none ${
                searchSpace === 'vault' ? 'text-[#FFAB00]' : 'text-primary-container'
              }`}
            >
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
                  ? '서류·영수증·계약서 내용을 입력해 보세요 (예: "삼성화재 자동차 보험 증권 및 특약", "원목 의자 조립 설명서")'
                  : searchSpace === 'video'
                  ? '해부된 영상 3개 속 어떤 사물·행동이든 입력해 보세요 (예: "하트 목걸이", "밀짚모자 선글라스", "구름 위 일출 스마트폰 촬영")'
                  : '기억나는 장면을 문장으로 편하게 말해 보세요 (예: "나무 다리 위에서 산책하는 모습", "밤거리 보며 한잔하는 분위기")'
              }
              className={`w-full h-14 pl-12 pr-28 rounded-2xl bg-surface-container-lowest/95 border outline-none font-body-md text-[14px] md:text-[15px] text-on-surface placeholder:text-outline transition-all ${
                searchSpace === 'vault'
                  ? 'border-[#FFAB00]/50 focus:border-[#FFAB00] focus:shadow-[0_0_20px_rgba(255,171,0,0.25)]'
                  : 'border-outline-variant/50 focus:border-primary-container focus:shadow-[0_0_20px_rgba(0,229,255,0.25)]'
              }`}
            />
            {textInput && (
              <button
                type="button"
                onClick={() => setTextInput('')}
                className="absolute right-24 text-on-surface-variant hover:text-on-surface p-1"
                title="지우기"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
            <button
              type="submit"
              className={`absolute right-2 h-10 px-5 rounded-xl font-label-lg text-[14px] font-extrabold shadow-sm transition-all ${
                searchSpace === 'vault'
                  ? 'bg-[#FFAB00] hover:bg-[#FFC400] text-surface-container-lowest'
                  : 'bg-primary-container hover:opacity-95 text-on-primary-container'
              }`}
            >
              검색
            </button>
          </div>

          {!isMobile && (
            <button
              type="button"
              onClick={() => void toggleMicRecording()}
              title="음성으로 검색"
              className={`h-14 px-4 rounded-2xl border flex items-center gap-2 font-label-lg text-[14px] font-bold shrink-0 transition-all ${
                isListening
                  ? 'bg-primary-container text-on-primary-container border-primary-container shadow-[0_0_20px_rgba(0,229,255,0.4)]'
                  : 'bg-surface-container-high hover:bg-surface-bright text-on-surface border-outline-variant/40'
              }`}
            >
              <span className="material-symbols-outlined text-primary-container text-[22px]">
                {isListening ? 'stop_circle' : 'mic'}
              </span>
              <span className="hidden sm:inline">{isListening ? '듣는 중...' : '음성 검색'}</span>
            </button>
          )}
        </form>

        {/* 전체 갤러리 모드일 때 추가 노출: 내 사진 팩트 조합 문장 샘플 */}
        {searchSpace === 'gallery' && (
          <div className="flex flex-col gap-2 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-label-sm text-[12px] text-on-surface-variant font-semibold">
                ✨ 내 사진첩 팩트 조합 문장 샘플:
              </span>
              {sentenceChips.length > 4 && (
                <button
                  type="button"
                  onClick={cycleSentenceChips}
                  className="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-primary font-label-sm text-[11px] font-bold flex items-center gap-1 border border-outline-variant/30 transition-all"
                >
                  <span className="material-symbols-outlined text-[14px]">autorenew</span>
                  <span>다른 문장 샘플</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {activeSentencePool.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => handleGalleryChipClick(chip.query)}
                  className="px-3.5 py-2 rounded-xl bg-surface-container-high/80 hover:bg-surface-bright text-left font-label-md text-[13px] text-on-surface font-bold border border-outline-variant/30 truncate"
                >
                  ✨ “{chip.query}”
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
