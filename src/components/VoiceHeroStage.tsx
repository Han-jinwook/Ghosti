import React, { useMemo, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';

const FALLBACK_SENTENCE_CHIPS = [
  {
    id: 'sent_kk_bridge',
    query: '코타키나발루 나무 다리 위에서 산책하는 모습',
    factFormula: '지명 + 배경 + 행동',
  },
  {
    id: 'sent_night_fireshow',
    query: '한밤중 바닷가 화려한 불쇼 퍼포먼스',
    factFormula: '시기 + 배경 + 상황',
  },
  {
    id: 'sent_terrace_drink',
    query: '야외 테라스에서 밤거리 보며 한잔하는 분위기',
    factFormula: '배경 + 행동/분위기',
  },
  {
    id: 'sent_yeouido_friends',
    query: '여의도 한강공원에서 친구들과 걷는 뒷모습',
    factFormula: '지명 + 인물/행동',
  },
];

const VAULT_SENTENCE_CHIPS = [
  {
    id: 'vault_manual',
    query: '조립 설명서',
    badge: '사진 + PDF 통합',
    desc: '의자 조립 도면 촬영본 + 원목수납장 조립 설명서 PDF 동시 검색',
  },
  {
    id: 'vault_insurance',
    query: '보험 증권',
    badge: 'PDF 문서 검색',
    desc: '자동차 보험증권 PDF + 실손의료비 청구서 영수증 PDF 검색',
  },
  {
    id: 'vault_receipt',
    query: '영수증',
    badge: '바우처 + 전표',
    desc: '수트라하버 결제 영수증 바우처 + 병원 진료비 영수증 검색',
  },
  {
    id: 'vault_id_contract',
    query: '신분증 여권 계약서',
    badge: '신분증 + 계약서',
    desc: '대한민국 여권 신원정보면 촬영본 + 주택임대차 표준계약서 PDF 검색',
  },
];

const SHORT_KEYWORD_CHIPS = [
  { emoji: '🏝️', label: '코타키나발루' },
  { emoji: '🌊', label: '속초 강원도' },
  { emoji: '🌉', label: '나무 다리' },
  { emoji: '🍺', label: '식당 맥주' },
  { emoji: '🍷', label: '와인' },
  { emoji: '🚤', label: '보트 요트' },
  { emoji: '🔥', label: '불쇼' },
  { emoji: '🏛️', label: '용산 박물관 전시' },
  { emoji: '🌳', label: '여의도 한강공원' },
  { emoji: '🅿️', label: '주차장 기둥' },
  { emoji: '📄', label: '조립 설명서' },
];

export const VoiceHeroStage: React.FC = () => {
  const {
    layout,
    photos,
    searchSpace,
    setSearchSpace,
    localDocuments,
    activeQuery,
    isListening,
    liveWaveBands,
    interimSttPreview,
    sentenceChips,
    sentenceChipPage,
    cycleSentenceChips,
    toggleMicRecording,
    runTextQuery,
    openLocalFolder,
  } = useSaySeeStore();

  const [textInput, setTextInput] = useState('');

  const activePhotos = useMemo(() => photos.filter((p) => !p.quarantined), [photos]);
  const vaultPhotoCount = useMemo(
    () => activePhotos.filter((p) => p.isVaultDocument).length,
    [activePhotos]
  );

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = textInput.trim();
    if (!q) return;
    void runTextQuery(q);
  };

  const handleChipClick = (label: string) => {
    setTextInput(label);
    void runTextQuery(label);
  };

  const isMobile = layout === 'mobile';
  const activeSentencePool =
    sentenceChips.length >= 4
      ? sentenceChips.slice(sentenceChipPage * 4, sentenceChipPage * 4 + 4)
      : FALLBACK_SENTENCE_CHIPS;

  return (
    <section className="w-full rounded-3xl bg-surface-container/85 backdrop-blur-2xl border border-outline-variant/30 p-5 md:p-6 shadow-xl flex flex-col gap-4">
      {/* ─────────────── [스펙 1 핵심] 검색 탭 상단 스위칭 필터: [🖼️ 전체/갤러리] vs [📁 스마트 서류함] ─────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-outline-variant/25">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTextInput('');
              setSearchSpace('gallery');
            }}
            className={`px-4 py-2.5 rounded-2xl font-label-lg text-[13.5px] font-extrabold flex items-center gap-2 transition-all border ${
              searchSpace === 'gallery'
                ? 'bg-primary-container text-on-primary-container border-primary-container shadow-[0_0_20px_rgba(0,229,255,0.35)]'
                : 'bg-surface-container-lowest/80 hover:bg-surface-container-high text-on-surface-variant border-outline-variant/30'
            }`}
          >
            <span>🖼️ 전체 / 갤러리</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                searchSpace === 'gallery'
                  ? 'bg-surface-container-lowest/25 text-on-primary-container'
                  : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {activePhotos.length}장
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTextInput('');
              setSearchSpace('vault');
            }}
            className={`px-4 py-2.5 rounded-2xl font-label-lg text-[13.5px] font-extrabold flex items-center gap-2 transition-all border ${
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
              서류사진 {vaultPhotoCount} + PDF·문서 {localDocuments.length}건
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {searchSpace === 'vault' ? (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-[#FFAB00]/15 border border-[#FFAB00]/40 text-[#FFAB00] font-label-sm text-[11.5px] font-extrabold">
                ✨ 삼성 갤러리 차별화: 사진첩 속 설명서·신분증·영수증과 PC/폰 PDF 문서를 한 번에 검색!
              </span>
              <button
                type="button"
                onClick={() => void openLocalFolder('docs')}
                className="px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-sm text-[11.5px] font-bold border border-outline-variant/30 shrink-0"
              >
                📂 PDF 서류폴더 열기
              </button>
            </div>
          ) : (
            <span className="font-body-sm text-[12px] text-on-surface-variant">
              💡 신분증·조립 설명서·보험 증권·영수증 PDF를 찾으실 땐 좌측{' '}
              <button
                type="button"
                onClick={() => setSearchSpace('vault')}
                className="text-[#FFAB00] font-extrabold underline hover:opacity-90"
              >
                [📁 스마트 서류함]
              </button>
              을 눌러보세요!
            </span>
          )}
        </div>
      </div>

      {/* 모바일 화면이거나 음성 녹음 중일 때: 깔끔한 중앙 마이크 영역 */}
      {(isMobile || isListening) && (
        <div className="flex flex-col items-center justify-center gap-3 py-1">
          <button
            type="button"
            onClick={() => void toggleMicRecording()}
            aria-label="음성으로 사진 찾기"
            className={`relative w-18 h-18 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-[0_0_36px_rgba(0,229,255,0.45)] ${
              isListening
                ? 'bg-primary-container text-on-primary-container scale-105 ring-4 ring-primary-container/50'
                : 'bg-gradient-to-tr from-secondary-container via-[#00626e] to-primary-container text-primary-container hover:scale-105 active:scale-95'
            }`}
          >
            <span className="material-symbols-outlined text-[34px]">
              {isListening ? 'stop_circle' : 'mic'}
            </span>
          </button>

          {isListening ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1 h-8">
                {liveWaveBands.slice(0, 12).map((amp, i) => (
                  <span
                    key={i}
                    style={{ height: `${Math.max(6, Math.round(amp * 32))}px` }}
                    className="w-1.5 rounded-full bg-primary-container transition-all duration-100"
                  />
                ))}
              </div>
              <p className="font-headline-sm text-[15px] text-primary-container font-bold">
                {interimSttPreview
                  ? `“${interimSttPreview}”`
                  : '말씀해 주세요... (말씀이 끝나면 자동으로 즉시 검색됩니다)'}
              </p>
            </div>
          ) : (
            <p className="font-body-sm text-[12.5px] text-on-surface-variant text-center">
              {searchSpace === 'vault'
                ? '마이크를 누르고 "보험 증권", "조립 설명서", "영수증"이라고 말씀해 보세요'
                : '마이크를 누르고 기억나는 장면을 문장으로 편하게 말씀해 보세요'}
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
            {searchSpace === 'vault' ? 'folder_managed' : 'search'}
          </span>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={
              searchSpace === 'vault'
                ? '찾고 싶은 서류·문서를 입력해 보세요 (예: "보험 증권", "조립 설명서", "영수증", "신분증 여권")'
                : '기억나는 장면을 문장으로 편하게 말해 보세요 (예: "나무 다리 위에서 산책하는 모습", "밤거리 보며 한잔하는 분위기")'
            }
            className={`w-full h-14 pl-12 pr-28 rounded-2xl bg-surface-container-lowest/95 border outline-none font-body-md text-[14px] md:text-[15.5px] text-on-surface placeholder:text-outline transition-all ${
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

      {/* ─────────────── 분기 1: [📁 스마트 서류함] 전용 추천 검색 칩 ─────────────── */}
      {searchSpace === 'vault' ? (
        <div className="flex flex-col gap-2.5 pt-0.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md bg-[#FFAB00]/20 text-[#FFAB00] font-label-sm text-[11px] font-extrabold">
                서류 사진 + PDF 통합 색인
              </span>
              <span className="font-label-sm text-[12px] text-on-surface-variant font-semibold">
                클릭하면 폰·PC에 흩어진 촬영 서류와 PDF 문서가 한 번에 검색됩니다:
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setTextInput('');
                setSearchSpace('vault');
              }}
              className="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-[#FFAB00] font-label-sm text-[11px] font-bold flex items-center gap-1 border border-[#FFAB00]/30 transition-all"
            >
              <span className="material-symbols-outlined text-[14px]">folder_open</span>
              <span>서류함 전체 보기 ({vaultPhotoCount + localDocuments.length}건)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {VAULT_SENTENCE_CHIPS.map((chip) => {
              const isActive = activeQuery === chip.query;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => handleChipClick(chip.query)}
                  className={`group px-4 py-2.5 rounded-2xl text-left transition-all flex items-center justify-between gap-2 border ${
                    isActive
                      ? 'bg-[#FFAB00] text-surface-container-lowest font-extrabold border-[#FFAB00] shadow-[0_0_16px_rgba(255,171,0,0.35)]'
                      : 'bg-surface-container-high/90 hover:bg-surface-bright text-on-surface border-[#FFAB00]/35 hover:border-[#FFAB00]'
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px]">📁</span>
                      <span className="text-[13.5px] font-extrabold truncate">
                        “{chip.query}”
                      </span>
                    </div>
                    <span
                      className={`text-[11px] truncate ${
                        isActive ? 'text-surface-container-lowest/85' : 'text-on-surface-variant'
                      }`}
                    >
                      {chip.desc}
                    </span>
                  </div>
                  <span
                    className={`font-label-mono text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                      isActive
                        ? 'bg-black/20 text-surface-container-lowest font-black'
                        : 'bg-[#FFAB00]/15 text-[#FFAB00] font-bold'
                    }`}
                  >
                    {chip.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* ─────────────── 분기 2: [🖼️ 전체/갤러리] 실제 사진 팩트 기반 '리얼 문장 샘플(추천 칩)' ─────────────── */
        <>
          <div className="flex flex-col gap-2 pt-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-primary-container/20 text-primary-container font-label-sm text-[11px] font-extrabold">
                  내 사진 팩트 조합
                </span>
                <span className="font-label-sm text-[12px] text-on-surface-variant font-semibold">
                  누르면 100% 실제 사진이 나오는 자연어 문장 검색:
                </span>
              </div>
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
              {activeSentencePool.map((chip) => {
                const isActive = activeQuery === chip.query;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => handleChipClick(chip.query)}
                    className={`group px-4 py-2.5 rounded-2xl text-left transition-all flex items-center justify-between gap-2 border ${
                      isActive
                        ? 'bg-primary-container text-on-primary-container font-extrabold border-primary-container shadow-[0_0_16px_rgba(0,229,255,0.35)]'
                        : 'bg-surface-container-high/90 hover:bg-surface-bright text-on-surface border-primary-container/30 hover:border-primary-container/70'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[15px] shrink-0">✨</span>
                      <span className="text-[13.5px] md:text-[14px] font-bold truncate">
                        “{chip.query}”
                      </span>
                    </div>
                    <span
                      className={`font-label-mono text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                        isActive
                          ? 'bg-surface-container-lowest/25 text-on-primary-container font-extrabold'
                          : 'bg-surface-container-lowest/70 text-primary-container'
                      }`}
                    >
                      문장 검색
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2열 (보조): 기존의 짧은 단어 칩 */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-outline-variant/20">
            <span className="font-label-sm text-[11px] text-on-surface-variant mr-1">
              단어 빠른 필터:
            </span>
            {SHORT_KEYWORD_CHIPS.map((chip) => {
              const isActive = activeQuery === chip.label;
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => handleChipClick(chip.label)}
                  className={`px-2.5 py-1 rounded-full text-[12px] font-medium transition-all flex items-center gap-1 border ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container font-bold border-primary-container shadow-[0_0_10px_rgba(0,229,255,0.3)]'
                      : 'bg-surface-container-high/60 hover:bg-surface-bright text-on-surface-variant hover:text-on-surface border-outline-variant/25'
                  }`}
                >
                  <span className="text-[12px]">{chip.emoji}</span>
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};
