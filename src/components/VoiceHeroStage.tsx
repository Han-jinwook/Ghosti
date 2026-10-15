import React, { useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';

const QUICK_CHIPS = [
  { emoji: '🏝️', label: '코타키나발루' },
  { emoji: '🌊', label: '속초 강원도' },
  { emoji: '🌉', label: '나무 다리' },
  { emoji: '🍺', label: '식당 맥주' },
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
    activeQuery,
    isListening,
    liveWaveBands,
    interimSttPreview,
    toggleMicRecording,
    runTextQuery,
  } = useSaySeeStore();

  const [textInput, setTextInput] = useState('');

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

  return (
    <section className="w-full rounded-3xl bg-surface-container/80 backdrop-blur-2xl border border-outline-variant/30 p-5 md:p-7 shadow-xl flex flex-col gap-5">
      {/* 모바일 화면이거나 음성 녹음 중일 때: 깔끔한 중앙 마이크 영역 */}
      {(isMobile || isListening) && (
        <div className="flex flex-col items-center justify-center gap-3 py-2">
          <button
            type="button"
            onClick={() => void toggleMicRecording()}
            aria-label="음성으로 사진 찾기"
            className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-[0_0_36px_rgba(0,229,255,0.45)] ${
              isListening
                ? 'bg-primary-container text-on-primary-container scale-105 ring-4 ring-primary-container/50'
                : 'bg-gradient-to-tr from-secondary-container via-[#00626e] to-primary-container text-primary-container hover:scale-105 active:scale-95'
            }`}
          >
            <span className="material-symbols-outlined text-[36px]">
              {isListening ? 'stop_circle' : 'mic'}
            </span>
          </button>

          {/* 실시간 음성 파형 막대 (녹음 중일 때만 깔끔하게 표시) */}
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
                  : '말씀해 주세요... (다 말씀하신 후 버튼을 누르거나 잠시 멈추면 검색됩니다)'}
              </p>
            </div>
          ) : (
            <p className="font-body-sm text-[13px] text-on-surface-variant">
              마이크 버튼을 누르고 찾고 싶은 사진을 편하게 말씀해 보세요
            </p>
          )}
        </div>
      )}

      {/* PC & 모바일 공통: 큼직하고 직관적인 텍스트 + 음성 통합 검색창 */}
      <form onSubmit={handleTextSubmit} className="w-full flex items-center gap-2.5">
        <div className="relative flex-1 flex items-center">
          <span className="material-symbols-outlined text-primary-container text-[22px] absolute left-4 pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="찾고 싶은 사진을 입력하세요 (예: 바닷가, 강아지, 다리 위, 케이크, 식당, 자동차, 문서...)"
            className="w-full h-14 pl-12 pr-28 rounded-2xl bg-surface-container-lowest/95 border border-outline-variant/50 focus:border-primary-container focus:shadow-[0_0_20px_rgba(0,229,255,0.25)] outline-none font-body-md text-[15px] md:text-[16px] text-on-surface placeholder:text-outline transition-all"
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
            className="absolute right-2 h-10 px-5 rounded-xl bg-primary-container hover:opacity-95 text-on-primary-container font-label-lg text-[14px] font-extrabold shadow-sm transition-all"
          >
            검색
          </button>
        </div>

        {/* PC 화면에서도 필요 시 바로 눌러볼 수 있는 심플 마이크 버튼 */}
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

      {/* 원클릭 빠른 테스트용 검색어 칩 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-label-sm text-[12px] text-on-surface-variant mr-1">
          빠른 검색:
        </span>
        {QUICK_CHIPS.map((chip) => {
          const isActive = activeQuery === chip.label;
          return (
            <button
              key={chip.label}
              type="button"
              onClick={() => handleChipClick(chip.label)}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all flex items-center gap-1.5 border ${
                isActive
                  ? 'bg-primary-container text-on-primary-container font-bold border-primary-container shadow-[0_0_12px_rgba(0,229,255,0.35)]'
                  : 'bg-surface-container-high/80 hover:bg-surface-bright text-on-surface border-outline-variant/30'
              }`}
            >
              <span>{chip.emoji}</span>
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
