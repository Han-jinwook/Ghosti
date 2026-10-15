import React, { useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';

/**
 * [지침 A1] 메인 검색 화면 상단/하단에 노출되는
 * 640+ 역방향 사전 매칭 + 실제 Gemini 3.8 Flash 사진별 고립 프롬프트 추천 문장 바
 */
export const OnboardingAhaStrip: React.FC = () => {
  const {
    conceptLexiconCount,
    onboardingAhaItems,
    onboardingAhaLoading,
    onboardingAhaModel,
    fetchOnboardingAhaWithGemini,
    applyAhaRecommendation,
  } = useSaySeeStore();

  if (onboardingAhaItems.length === 0 && !onboardingAhaLoading) return null;

  return (
    <div className="w-full p-4 rounded-2xl bg-surface-container-low/85 backdrop-blur-xl border border-primary-container/25 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-primary-container/20 border border-primary-container/40 text-primary-container font-label-mono text-[10px] font-extrabold">
            A1 • {conceptLexiconCount}개 개념 사전 역방향 매칭 + Gemini 고립 프롬프트
          </span>
          <span className="font-label-sm text-label-sm text-on-surface font-bold">
            내 사진첩 팩트 기반 AI 맞춤 추천 검색어 (짬뽕 0%)
          </span>
          <span className="font-label-mono text-[10px] text-outline">
            ({onboardingAhaModel})
          </span>
        </div>

        <button
          disabled={onboardingAhaLoading}
          onClick={() => void fetchOnboardingAhaWithGemini()}
          className="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-primary font-label-mono text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[14px]">
            {onboardingAhaLoading ? 'sync' : 'auto_awesome'}
          </span>
          <span>{onboardingAhaLoading ? 'Gemini 생성 중...' : '새 추천 문장 생성'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {onboardingAhaItems.slice(0, 6).map((item) => (
          <button
            key={item.photoId}
            onClick={() => void applyAhaRecommendation(item)}
            className="group flex items-center gap-3 p-2.5 rounded-xl bg-surface-container/80 hover:bg-surface-container-high border border-outline-variant/25 hover:border-primary-container/50 text-left transition-all"
          >
            <img
              src={item.thumbUrl}
              alt=""
              loading="lazy"
              className="w-12 h-12 rounded-lg object-cover shrink-0 border border-primary-container/30 group-hover:scale-105 transition-transform"
            />
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.2 rounded bg-primary-container/15 text-primary-container font-label-mono text-[10px] font-bold">
                  {item.shortChip}
                </span>
                <span className="font-label-mono text-[10px] text-outline truncate">
                  {item.dateFact}
                </span>
              </div>
              <p className="font-body-sm text-[12px] text-on-surface font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                “{item.sentence}”
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * [지침 A2] 지능적 LLM 라우팅 (스무고개 인터뷰 & JSON 지시서 발급기)
 * - Feature Flag가 해금되고 유저가 [설정]에서 'AI 티키타카(스무고개) 토글'을 ON으로 켠 상태에서만 작동합니다.
 * - 대화 도중에는 코인 차감 알림이나 팝업을 절대 띄우지 않습니다 (하이패스 과금 UX).
 */
export const TikiTakaInterviewPanel: React.FC = () => {
  const {
    tikiTakaFeatureFlagUnlocked,
    tikiTakaEnabled,
    tikiTakaOpen,
    setTikiTakaOpen,
    tikiTakaTurn,
    tikiTakaLoading,
    tikiTakaMessages,
    tikiTakaQuickReplies,
    lastJsonDirective,
    startTikiTakaSession,
    sendTikiTakaReply,
    activeQuery,
  } = useSaySeeStore();

  const [inputReply, setInputReply] = useState('');

  // Feature Flag 미해금 또는 유저 설정 토글 OFF 시 노출하지 않음 (지침 A2 준수)
  if (!tikiTakaFeatureFlagUnlocked || !tikiTakaEnabled) {
    return null;
  }

  return (
    <div className="w-full">
      {!tikiTakaOpen ? (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-secondary-container/25 via-surface-container-high/85 to-surface-container border border-secondary/35 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-secondary-container/40 border border-secondary/50 flex items-center justify-center text-secondary shrink-0">
              <span className="material-symbols-outlined text-[20px]">psychology</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-secondary/20 text-secondary font-label-mono text-[10px] font-bold">
                  PHASE 1-B • AI 티키타카(스무고개) ON
                </span>
                <span className="font-label-sm text-[13px] text-on-surface font-bold">
                  찾으시는 사진이 모호하거나 결과가 너무 많으신가요?
                </span>
              </div>
              <span className="font-body-sm text-[11px] text-on-surface-variant">
                2~3턴의 스무고개(시간대 ➔ 장소 ➔ 상황)로 조건을 좁혀 로컬 Gemma 2에 정밀 JSON 지시서를 내립니다.
              </span>
            </div>
          </div>

          <button
            onClick={() => void startTikiTakaSession(activeQuery)}
            className="px-4 py-2 rounded-full bg-secondary hover:opacity-95 text-on-secondary font-label-md text-label-md font-extrabold shadow-[0_0_20px_rgba(124,77,255,0.4)] flex items-center gap-1.5 transition-all"
          >
            <span className="material-symbols-outlined text-[17px]">forum</span>
            <span>AI 스무고개로 좁혀 찾기</span>
          </button>
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-surface-container/95 backdrop-blur-2xl border border-secondary/45 shadow-[0_0_36px_rgba(124,77,255,0.2)] flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-outline-variant/25">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full bg-secondary text-on-secondary font-label-mono text-[10px] font-black">
                AI 스무고개 인터뷰 • TURN {tikiTakaTurn}/3
              </span>
              <h3 className="font-headline-sm text-[15px] text-on-surface font-extrabold">
                시간대 ➔ 장소 ➔ 상황 3단계 퍼널 라우팅 (Gemini 3.8 Flash ➔ Gemma 2)
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => void startTikiTakaSession(activeQuery)}
                className="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface-variant font-label-sm text-[11px]"
              >
                새로 시작
              </button>
              <button
                onClick={() => setTikiTakaOpen(false)}
                className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          {/* Conversation Messages */}
          <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto pr-1">
            {tikiTakaMessages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col gap-1 max-w-[88%] ${
                  m.role === 'user' ? 'self-end items-end' : 'self-start items-start'
                }`}
              >
                <div className="flex items-center gap-1.5 px-1">
                  <span className="font-label-mono text-[10px] text-outline">
                    {m.role === 'user' ? '나의 단서' : '세이씨 AI 네비게이터'}
                  </span>
                  {m.stepLabel && (
                    <span className="font-label-mono text-[10px] text-secondary font-bold">
                      • {m.stepLabel}
                    </span>
                  )}
                </div>
                <div
                  className={`px-4 py-2.5 rounded-2xl font-body-sm text-[13px] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-primary-container text-on-primary-container font-bold rounded-br-sm'
                      : 'bg-surface-container-high text-on-surface border border-secondary/30 rounded-bl-sm'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {tikiTakaLoading && (
              <div className="self-start px-4 py-2 rounded-2xl bg-surface-container-high text-secondary font-label-mono text-[11px] animate-pulse">
                Gemini 3.8 Flash가 단서를 분석하고 있습니다...
              </div>
            )}
          </div>

          {/* Quick Replies */}
          {tikiTakaQuickReplies.length > 0 && !tikiTakaLoading && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-label-mono text-[10px] text-on-surface-variant">
                원클릭 단서 선택:
              </span>
              {tikiTakaQuickReplies.map((qr) => (
                <button
                  key={qr}
                  onClick={() => void sendTikiTakaReply(qr)}
                  className="px-3 py-1.5 rounded-full bg-secondary-container/30 hover:bg-secondary text-on-surface hover:text-on-secondary border border-secondary/40 font-label-sm text-[12px] font-bold transition-all"
                >
                  {qr}
                </button>
              ))}
            </div>
          )}

          {/* Issued JSON Directive Preview (When Complete) */}
          {lastJsonDirective && (
            <div className="p-3 rounded-xl bg-surface-container-lowest/90 border border-primary-container/40 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-label-mono text-[11px] text-primary-container font-extrabold">
                  ✓ LLM 최종 JSON 지시서 발급 완료 ➔ 로컬 EmbeddingGemma 2 즉시 실행됨
                </span>
                <span className="font-label-mono text-[10px] text-emerald-400 font-bold">
                  0ms 로컬 벡터 스나이핑
                </span>
              </div>
              <div className="font-label-mono text-[11px] text-on-surface-variant flex flex-wrap gap-x-4 gap-y-1">
                <span>
                  한국어 쿼리: <strong className="text-on-surface">{lastJsonDirective.rewrittenQueryKo}</strong>
                </span>
                <span>
                  영문 멀티모달: <strong className="text-primary">{lastJsonDirective.rewrittenQueryEn}</strong>
                </span>
                {lastJsonDirective.season && (
                  <span>
                    계절 필터: <strong className="text-[#FFAB00]">{lastJsonDirective.season}</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Free Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!inputReply.trim()) return;
              const q = inputReply;
              setInputReply('');
              void sendTikiTakaReply(q);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputReply}
              onChange={(e) => setInputReply(e.target.value)}
              placeholder="기억나는 시간대, 장소, 함께 있던 사람이나 색상을 편하게 말씀해 주세요..."
              className="flex-1 bg-surface-container-lowest/90 border border-outline-variant/40 rounded-xl px-3.5 py-2 text-on-surface font-body-sm text-[13px] outline-none focus:border-secondary"
            />
            <button
              type="submit"
              disabled={tikiTakaLoading || !inputReply.trim()}
              className="px-4 py-2 rounded-xl bg-secondary hover:opacity-90 text-on-secondary font-label-md text-[12px] font-extrabold disabled:opacity-40 shrink-0"
            >
              단서 전송
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

/**
 * [지침 A2] 프로필/설정 페이지용:
 * 1) 신규 유저 1개월 숙련 후 출현 Feature Flag 제어
 * 2) 'AI 티키타카(스무고개) 토글' ON/OFF 스위치
 * 3) 하이패스형 일일 합산 코인 정산 내역 (대화 중 무팝업 누적 ➔ 일일 마감 시 단 1건의 합산 로그로 정산)
 */
export const TikiTakaSettingsAndLedgerCard: React.FC = () => {
  const {
    tikiTakaFeatureFlagUnlocked,
    setTikiTakaFeatureFlagUnlocked,
    tikiTakaEnabled,
    setTikiTakaEnabled,
    unbilledCoins,
    unbilledCalls,
    dailyCoinLedger,
    settleDailyCoinsNow,
  } = useSaySeeStore();

  return (
    <div className="p-5 rounded-2xl bg-surface-container/90 border border-secondary/35 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-secondary/20 border border-secondary/40 text-secondary font-label-mono text-[10px] font-extrabold">
              PHASE 1-B • 지능적 LLM 라우팅 &amp; 하이패스 과금
            </span>
          </div>
          <h3 className="font-headline-sm text-[16px] text-on-surface font-extrabold">
            [프로필/설정] AI 티키타카(스무고개) 제어 &amp; 일일 합산 코인 정산
          </h3>
          <p className="font-body-sm text-[12px] text-on-surface-variant">
            유저가 대화하고 검색하는 도중에는 코인 차감 팝업을 절대 띄우지 않고 백그라운드에 누적한 뒤,
            일일 마감(또는 세션 종료) 시 단 1건의 합산 로그로 정산합니다.
          </p>
        </div>
      </div>

      {/* Toggles Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 1) Feature Flag Toggle */}
        <label className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between gap-3 cursor-pointer">
          <div className="flex flex-col gap-0.5">
            <span className="font-label-md text-[13px] text-on-surface font-bold">
              1개월 숙련 유저 Feature Flag 해금
            </span>
            <span className="font-body-sm text-[11px] text-on-surface-variant">
              기본 세이씨(Gemma 2 즉시 검색)에 익숙해진 뒤 스무고개 기능을 노출합니다.
            </span>
          </div>
          <input
            type="checkbox"
            checked={tikiTakaFeatureFlagUnlocked}
            onChange={(e) => setTikiTakaFeatureFlagUnlocked(e.target.checked)}
            className="w-5 h-5 accent-[#7C4DFF] shrink-0"
          />
        </label>

        {/* 2) User Setting Toggle */}
        <label
          className={`p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 flex items-center justify-between gap-3 ${
            tikiTakaFeatureFlagUnlocked ? 'cursor-pointer' : 'opacity-50 pointer-events-none'
          }`}
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-label-md text-[13px] text-on-surface font-bold">
              AI 티키타카(스무고개) 토글 ON/OFF
            </span>
            <span className="font-body-sm text-[11px] text-on-surface-variant">
              켜져 있을 때만 모호한 검색 시 LLM 스무고개 라우터가 작동합니다.
            </span>
          </div>
          <input
            type="checkbox"
            checked={tikiTakaEnabled}
            onChange={(e) => setTikiTakaEnabled(e.target.checked)}
            className="w-5 h-5 accent-[#00E5FF] shrink-0"
          />
        </label>
      </div>

      {/* Hi-Pass Daily Consolidated Coin Settlement Box */}
      <div className="p-4 rounded-xl bg-surface-container-lowest/90 border border-outline-variant/30 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FFAB00] text-[18px]">
              toll
            </span>
            <span className="font-label-md text-[13px] text-on-surface font-bold">
              하이패스(Hi-Pass) 일일 합산 코인 정산 내역
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container-high font-label-mono text-[10px] text-primary-container">
              대화 중 팝업 0회 • 무중단 UX
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-label-mono text-[11px] text-on-surface-variant">
              오늘 미정산 누적:{' '}
              <strong className="text-[#FFAB00]">
                {unbilledCalls}회 ({unbilledCoins} 코인)
              </strong>
            </span>
            <button
              disabled={unbilledCalls === 0}
              onClick={settleDailyCoinsNow}
              className="px-3 py-1 rounded-lg bg-[#FFAB00] hover:bg-[#FFB724] text-surface-container-lowest font-label-sm text-[11px] font-extrabold disabled:opacity-40 transition-all"
            >
              일일 마감 1건 합산 정산 실행
            </button>
          </div>
        </div>

        {/* Consolidated 1-Line Daily Ledger Entries */}
        <div className="flex flex-col gap-1.5">
          {dailyCoinLedger.map((entry) => (
            <div
              key={entry.id}
              className="px-3 py-2 rounded-lg bg-surface-container/80 border border-outline-variant/20 flex flex-wrap items-center justify-between gap-2 font-label-mono text-[11px]"
            >
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  {entry.dateKey} 일괄정산
                </span>
                <span className="text-on-surface font-semibold">{entry.summaryTitle}</span>
              </div>
              <span className="text-outline">{entry.settledAt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
