import React, { useEffect, useState } from 'react';
import {
  MOBILE_SYMPTOM_CHIPS,
  PC_SYMPTOM_CHIPS,
} from '../services/setupMonsterEngine';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { SetupDiagnosisPlan } from '../types/saysee';

/**
 * [Track B & 모바일 타사 앱 내부 설정용 실시간 플로팅 오버레이 가이드 (SYSTEM_ALERT_WINDOW / UI Automation)]
 * - APK/.exe의 눈(Eye)이 0.01초 만에 긁어온 화면 텍스트·좌표 배열([{text: '설정', rect: [980, 120]}, ...])을 기반으로
 *   최상단 투명 유리판(Overlay) 위 정확한 좌표에 빨간 손가락 화살표(👆)와 반투명 말풍선을 실시간으로 띄워 한 걸음씩 동행 안내합니다.
 */
export const SetupFloatingOverlayGuide: React.FC = () => {
  const {
    activeOverlayPlan,
    activeOverlayStepIndex,
    advanceSetupOverlayStep,
    closeSetupOverlayGuide,
  } = useSaySeeStore();

  if (!activeOverlayPlan || !activeOverlayPlan.overlaySteps?.length) return null;

  const steps = activeOverlayPlan.overlaySteps;
  const currentStep = steps[activeOverlayStepIndex] ?? steps[0];
  const [leftPct, topPct] = currentStep.fingerCoordPct;

  return (
    <div className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl rounded-3xl bg-zinc-950/95 border-2 border-rose-500/70 shadow-[0_0_50px_rgba(244,63,94,0.35)] overflow-hidden flex flex-col">
        {/* 상단 투명 유리판(Overlay) 상태 헤더 */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-rose-950/90 via-zinc-900 to-zinc-950 border-b border-rose-500/40 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-label-sm text-[11px] font-extrabold animate-pulse">
              👆 실시간 플로팅 오버레이 가이드 ({currentStep.step}/{steps.length}단계)
            </span>
            <span className="font-label-sm text-[11.5px] text-rose-200 font-bold">
              {activeOverlayPlan.platform === 'mobile'
                ? 'SYSTEM_ALERT_WINDOW 투명 유리판 작동 중'
                : 'Z-Eye_PC_Setup.exe UI Automation 최상단 오버레이'}
            </span>
          </div>
          <button
            type="button"
            onClick={closeSetupOverlayGuide}
            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-label-sm text-[11.5px] font-bold cursor-pointer"
          >
            ✕ 가이드 닫기
          </button>
        </div>

        {/* 눈(Eye)이 0.01초 만에 긁어온 화면 텍스트·좌표 배열 시각화 & 시뮬레이션 캔버스 */}
        <div className="p-5 flex flex-col gap-4">
          <div className="p-3 rounded-xl bg-zinc-900/90 border border-white/10 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-[11px] text-primary-container font-extrabold">
                👁️ 에이전트 눈(Eye) 0.01초 화면 좌표 스캔 배열 (Scraped DOM/UI Tree)
              </span>
              <span className="font-mono text-[10.5px] text-emerald-300">
                Latency: 8.4ms
              </span>
            </div>
            <p className="font-mono text-[11px] text-zinc-300 break-all">
              {JSON.stringify(currentStep.scrapedElements)}
            </p>
          </div>

          {/* 가상 타사 앱/프로그램 화면 + 최상단 투명 유리판 손가락 화살표(👆) */}
          <div className="relative h-64 rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/15 overflow-hidden p-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="font-headline-sm text-[13px] text-white font-bold">
                📱 {currentStep.screenTitle}
              </span>
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono text-[10.5px]">
                Deep Link 순간이동 완료
              </span>
            </div>

            {/* 화면 위 긁혀온 버튼 요소들 */}
            <div className="mt-4 grid grid-cols-3 gap-2.5 opacity-80">
              {currentStep.scrapedElements.map((el, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-zinc-800/80 border border-white/10 flex flex-col gap-0.5"
                >
                  <span className="font-label-sm text-[12px] text-white font-bold">
                    {el.text}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400">
                    rect: [{el.rect[0]}, {el.rect[1]}]
                  </span>
                </div>
              ))}
            </div>

            {/* 정확한 좌표에 뜬 빨간 손가락 화살표와 반투명 말풍선 */}
            <div
              style={{
                left: `${Math.min(78, Math.max(12, leftPct))}%`,
                top: `${Math.min(68, Math.max(22, topPct))}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 z-20"
            >
              <button
                type="button"
                onClick={advanceSetupOverlayStep}
                className="px-4 py-2 rounded-2xl bg-rose-600/95 hover:bg-rose-500 text-white font-headline-sm text-[13px] font-extrabold shadow-[0_0_25px_rgba(244,63,94,0.85)] border-2 border-white flex items-center gap-2 cursor-pointer animate-bounce"
              >
                <span className="text-[18px]">👆</span>
                <span>{currentStep.bubbleMessage}</span>
              </button>
              <span className="px-2.5 py-0.5 rounded-md bg-black/85 border border-rose-400/50 text-rose-200 font-mono text-[10.5px] font-bold">
                타겟: {currentStep.targetLabel} (클릭 시 다음 화면 이동)
              </span>
            </div>
          </div>

          {/* 하단 음성 안내 및 단계 이동 버튼 */}
          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="font-label-sm text-[11px] text-rose-300 font-extrabold">
                🔊 실시간 AI 동행 음성 안내
              </span>
              <p className="font-body-sm text-[12.5px] text-white">
                “{currentStep.voiceGuideText}”
              </p>
            </div>
            <button
              type="button"
              onClick={advanceSetupOverlayStep}
              className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-label-md text-[12px] font-extrabold shrink-0 cursor-pointer"
            >
              {activeOverlayStepIndex + 1 < steps.length
                ? '👆 화살표 위치 눌렀어요 (다음 단계 ➔)'
                : '✅ 설정 완료 (가이드 종료)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * [🛠️ Z-Eye 설정 몬스터 (Setup Monster) 본체 패널]
 * - 개인 라운지 4번 탭 및 독립 모달에서 공통으로 렌더링됩니다.
 */
export const SetupMonsterContent: React.FC = () => {
  const {
    merlinAuth,
    isStoreAppMode,
    enableSetupMonster,
    setEnableSetupMonster,
    setupMonsterPlatform,
    setSetupMonsterPlatform,
    setupProactiveHints,
    setupChatTurns,
    setupAuditLogs,
    uiFontScalePercent,
    uiNightEyeProtection,
    loadSetupMonsterState,
    submitSetupMonsterQuery,
    approveAndExecuteSetupPlan,
    undoSetupMonsterRepair,
    openSetupOverlayGuide,
  } = useSaySeeStore();

  const [inputQuery, setInputQuery] = useState('');
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [showBlackboxPanel, setShowBlackboxPanel] = useState(false);

  useEffect(() => {
    loadSetupMonsterState();
  }, [loadSetupMonsterState]);

  // 1차 앱스토어 심사 통과용 클린 모드 제어: isStoreAppMode === true && !enableSetupMonster 일 때 숨김 안내
  if (isStoreAppMode && !enableSetupMonster) {
    return (
      <div className="p-6 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-label-sm text-[11px] font-bold w-fit">
              🛡️ 1차 앱스토어 심사 방어 모드 (isStoreAppMode=true · enableSetupMonster=false)
            </span>
            <h3 className="font-headline-sm text-[17px] text-white font-bold mt-1">
              현재 1차 스토어 심사 프리패스를 위해 설정 몬스터와 크레딧 잔액이 숨김 상태입니다
            </h3>
            <p className="font-body-sm text-[12.5px] text-zinc-400">
              심사 통과 후 스토어 재심사 없이 원격 플래그(enableSetupMonster = true)만 켜면 즉시 전체 기능과 크레딧 지갑이 개통됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnableSetupMonster(true)}
            className="px-4 py-2.5 rounded-xl bg-primary-container text-zinc-950 font-label-md text-[12px] font-extrabold cursor-pointer"
          >
            🛠️ 설정 몬스터 즉시 켜기 (enableSetupMonster=true 테스트)
          </button>
        </div>
      </div>
    );
  }

  const activeChips =
    setupMonsterPlatform === 'pc' ? PC_SYMPTOM_CHIPS : MOBILE_SYMPTOM_CHIPS;
  const hasActiveUndoableAudit = setupAuditLogs.some((a) => !a.undone);

  const handleSendQuery = async () => {
    const clean = inputQuery.trim();
    if (!clean) return;
    setInputQuery('');
    await submitSetupMonsterQuery(clean);
  };

  const handleVoiceMicInput = () => {
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRec) {
      const sample =
        setupMonsterPlatform === 'pc'
          ? '프린터가 대기 중으로만 뜨고 인쇄가 먹통인데 1초 만에 고쳐줘'
          : '운동하는 저녁 7~8시엔 카톡이나 전화 소리 안 나게 해줘';
      submitSetupMonsterQuery(sample);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = 'ko-KR';
      rec.interimResults = false;
      setIsListeningVoice(true);
      rec.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript || '';
        setIsListeningVoice(false);
        if (transcript.trim()) {
          submitSetupMonsterQuery(transcript.trim());
        }
      };
      rec.onerror = () => setIsListeningVoice(false);
      rec.onend = () => setIsListeningVoice(false);
      rec.start();
    } catch {
      setIsListeningVoice(false);
    }
  };

  const renderPlanActionCard = (plan: SetupDiagnosisPlan, turnUndone?: boolean) => {
    const isTrackA = plan.track === 'TRACK_A_DIRECT_REPAIR';
    return (
      <div className="mt-3 p-4 rounded-2xl bg-zinc-950/95 border border-primary-container/35 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-md font-label-sm text-[11px] font-extrabold ${
                isTrackA
                  ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                  : 'bg-rose-500/20 border border-rose-400/40 text-rose-300'
              }`}
            >
              {isTrackA
                ? '⚡ Track A · 백그라운드 1초 자동 수리 (90%)'
                : '👆 Track B · 실시간 플로팅 손가락 가이드 (10%)'}
            </span>
            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-zinc-300 font-mono text-[10.5px]">
              🦶 손발 에이전트: {plan.agentModuleName}
            </span>
          </div>
          <span className="font-label-sm text-[11px] text-amber-300 font-bold">
            진단·원복 무료 / 처치 승인 시 {plan.creditCost} 크레딧
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <h4 className="font-headline-sm text-[15px] text-white font-bold">
            {plan.title}
          </h4>
          <p className="font-body-sm text-[12px] text-zinc-300 leading-relaxed">
            {plan.rootCause}
          </p>
        </div>

        {/* 실행 명령 및 0.01초 전 JSON 스냅샷 백업 명세 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-white/10 flex flex-col gap-1">
            <span className="font-label-sm text-[10.5px] text-primary-container font-bold">
              🛡️ 0.01초 전 JSON 스냅샷 자동 백업 (Before ➔ After)
            </span>
            <p className="font-mono text-[10.5px] text-zinc-400 break-all">
              Before: {JSON.stringify(plan.beforeSnapshot)}
            </p>
            <p className="font-mono text-[10.5px] text-emerald-300 break-all">
              After: {JSON.stringify(plan.afterSnapshot)}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-white/10 flex flex-col gap-1">
            <span className="font-label-sm text-[10.5px] text-amber-300 font-bold">
              ⚙️ 에이전트 실행 API / PowerShell 명령
            </span>
            <p className="font-mono text-[10.5px] text-zinc-200 break-all">
              {plan.systemCommandOrApi}
            </p>
          </div>
        </div>

        {/* 승인 및 실행 버튼 + Track B 오버레이 미리보기 */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => approveAndExecuteSetupPlan(plan)}
              className="px-4 py-2.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-md text-[12.5px] font-extrabold shadow-[0_0_20px_rgba(32,247,219,0.25)] cursor-pointer"
            >
              ⚡ 1초 자동 수리 승인 ({plan.creditCost} 크레딧)
            </button>
            {plan.overlaySteps && plan.overlaySteps.length > 0 && (
              <button
                type="button"
                onClick={() => openSetupOverlayGuide(plan)}
                className="px-3.5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-rose-200 font-label-sm text-[12px] font-extrabold cursor-pointer"
              >
                👆 손가락 화살표 오버레이 즉시 띄우기
              </button>
            )}
          </div>
          {turnUndone && (
            <span className="font-label-sm text-[11px] text-amber-300 font-bold">
              ↩️ 원상복구 완료된 내역입니다
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        fontSize: `${uiFontScalePercent}%`,
        filter: uiNightEyeProtection ? 'sepia(0.18) saturate(0.92)' : undefined,
      }}
      className="p-6 rounded-2xl bg-[#18181B] border border-primary-container/40 flex flex-col gap-5 transition-all"
    >
      {/* 1. 상단 헤더: 두뇌(웹/LLM) vs 손발(APK/.exe) 분업 아키텍처 & 플랫폼 스위처 & 크레딧 지갑 */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-primary-container text-zinc-950 font-label-sm text-[11.5px] font-extrabold">
              🛠️ Z-Eye 설정 몬스터 (Setup Monster)
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 font-label-sm text-[11px] font-bold">
              🧠 두뇌는 웹/LLM · 🦶 손발은 1MB APK & Z-Eye_PC_Setup.exe
            </span>
            {uiNightEyeProtection && (
              <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-200 font-label-sm text-[11px] font-bold">
                🌙 눈 보호 모드 & 큰 글씨({uiFontScalePercent}%) 작동 중
              </span>
            )}
          </div>
          <h2 className="font-headline-sm text-[19px] md:text-[21px] text-white font-bold mt-1">
            일상어로 말하면 AI가 PC·스마트폰 설정을 1초 만에 직접 고치거나 손가락 화살표(👆)로 짚어줍니다
          </h2>
          <p className="font-body-sm text-[12.5px] text-zinc-300 leading-relaxed">
            수리기사를 부르거나 복잡한 설정 미로를 헤맬 필요 없이, 0.01초 전 JSON 스냅샷 백업과 1초 원상복구(Undo) 안전망으로 안심하고 맡기세요.
          </p>
        </div>

        {/* 우측: 크레딧 잔액 + 1초 원복 + 블랙박스 감사로그 토글 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-amber-400/40 flex items-center gap-2">
            <span className="text-[15px]">🪙</span>
            <div className="flex flex-col">
              <span className="font-label-sm text-[10px] text-zinc-400">
                내 보유 크레딧 (수리 승인 100C)
              </span>
              <span className="font-headline-sm text-[14px] text-amber-300 font-extrabold">
                {merlinAuth.coinBalance.toLocaleString()} 크레딧
              </span>
            </div>
          </div>

          {hasActiveUndoableAudit && (
            <button
              type="button"
              onClick={() => undoSetupMonsterRepair()}
              className="px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[12px] font-extrabold shadow-md cursor-pointer"
            >
              ↩️ 수리 전 상태로 1초 원상복구 (Undo · 무료)
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowBlackboxPanel((prev) => !prev)}
            className="px-3 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-label-sm text-[11.5px] font-bold cursor-pointer"
          >
            🛡️ 법적 면피 감사 로그 ({setupAuditLogs.length})
          </button>
        </div>
      </div>

      {/* 2. 플랫폼 모드 스위처 (💻 PC판 1초 수리기사 vs 📱 모바일판 선제 진단 & 손가락 가이드) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-zinc-950 border border-white/10">
          <button
            type="button"
            onClick={() => setSetupMonsterPlatform('pc')}
            className={`px-4 py-2 rounded-lg font-label-md text-[12.5px] font-extrabold transition-all cursor-pointer ${
              setupMonsterPlatform === 'pc'
                ? 'bg-primary-container text-zinc-950 shadow'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            💻 PC판 설정 몬스터 (Z-Eye_PC_Setup.exe · 1초 수리기사)
          </button>
          <button
            type="button"
            onClick={() => setSetupMonsterPlatform('mobile')}
            className={`px-4 py-2 rounded-lg font-label-md text-[12.5px] font-extrabold transition-all cursor-pointer ${
              setupMonsterPlatform === 'mobile'
                ? 'bg-primary-container text-zinc-950 shadow'
                : 'text-zinc-300 hover:text-white'
            }`}
          >
            📱 모바일판 설정 몬스터 (1MB APK · 선제 진단 & 오버레이 👆)
          </button>
        </div>

        <span className="font-mono text-[11px] text-zinc-400">
          {setupMonsterPlatform === 'pc'
            ? '🟢 Z-Eye_PC_Setup.exe (PowerShell / Registry / Spooler / UIAutomation 대기 중)'
            : '🟢 Z-Eye_Mobile_1MB.apk (UsageStats / WRITE_SETTINGS / SYSTEM_ALERT_WINDOW 대기 중)'}
        </span>
      </div>

      {/* 3. 📱 모바일판 전용: 선제적 맞춤 진단 카드 (Proactive Hints) */}
      {setupMonsterPlatform === 'mobile' && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[12px] text-primary-container font-extrabold">
              🩺 모바일 APK 선제적 맞춤 진단 (UsageStatsManager 앱 사용 통계 + 연령·생활 패턴 결합)
            </span>
            <span className="font-body-sm text-[11px] text-zinc-400">
              스마트폰 잘 아는 젊은 조카가 먼저 발견해 챙겨주는 힌트 카드
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {setupProactiveHints.map((hint) => (
              <div
                key={hint.id}
                className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                  hint.resolved
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-zinc-950/90 border-amber-400/35'
                }`}
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-label-sm text-[10.5px] font-bold">
                      {hint.badgeText}
                    </span>
                    {hint.resolved && (
                      <span className="text-emerald-400 font-label-sm text-[11px] font-extrabold">
                        ✓ 처치 완료
                      </span>
                    )}
                  </div>
                  <h4 className="font-headline-sm text-[14px] text-white font-bold leading-snug">
                    {hint.title}
                  </h4>
                  <p className="font-body-sm text-[11.5px] text-zinc-400">
                    • 감지 근거: {hint.telemetrySource}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    submitSetupMonsterQuery(hint.presetQuery, hint.presetId, 'mobile')
                  }
                  className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-primary-container/40 text-primary-container font-label-sm text-[12px] font-extrabold cursor-pointer"
                >
                  ⚡ 이 문제 1초 진단 & 해결하기
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. 원클릭 증상 칩 (PC 5대 수리 칩 + 타사 앱 오버레이 칩 / 모바일 증상 칩) */}
      <div className="flex flex-col gap-2">
        <span className="font-label-sm text-[11.5px] text-zinc-300 font-bold">
          💡 자주 찾는 원클릭 증상 칩 (클릭 시 즉시 진단합니다 · 진단 무료)
        </span>
        <div className="flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() =>
                submitSetupMonsterQuery(chip.query, chip.id, chip.platform)
              }
              className="px-3.5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-white/15 hover:border-primary-container/60 text-left flex items-center gap-2 transition-all cursor-pointer"
            >
              <span className="font-label-sm text-[12px] text-white font-bold">
                {chip.label}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-primary-container font-label-sm text-[10px] font-bold">
                {chip.trackBadge}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 5. 대화형 수리 창구 (채팅 히스토리 + 승인 버튼 + 1초 Undo 버튼 상시 노출) */}
      <div className="p-4 rounded-2xl bg-zinc-950/90 border border-white/10 flex flex-col gap-3 max-h-[540px] overflow-y-auto">
        {setupChatTurns.map((turn) => {
          if (turn.role === 'user') {
            return (
              <div key={turn.id} className="flex justify-end">
                <div className="max-w-xl px-4 py-2.5 rounded-2xl bg-primary-container text-zinc-950 font-body-sm text-[13px] font-bold">
                  “{turn.text}”
                  <span className="ml-2 text-[10px] opacity-70">{turn.timestamp}</span>
                </div>
              </div>
            );
          }

          if (turn.role === 'system_repair') {
            return (
              <div
                key={turn.id}
                className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-400/50 flex flex-col gap-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-label-sm text-[11px] font-extrabold">
                    ✅ 1초 자동 수리 완료 · 0.01초 전 JSON 스냅샷 보관됨 (-100 크레딧)
                  </span>
                  <span className="font-mono text-[10.5px] text-zinc-400">
                    Audit ID: {turn.auditId} · {turn.timestamp}
                  </span>
                </div>
                <p className="font-body-sm text-[13px] text-white font-bold leading-relaxed">
                  {turn.text}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="font-body-sm text-[11.5px] text-zinc-300">
                    💡 마음에 안 드시거나 불편하시면 버튼 하나로 1초 만에 수리 전 상태로 되돌립니다 (무료).
                  </span>
                  <div className="flex items-center gap-2">
                    {turn.diagnosisPlan?.overlaySteps?.length ? (
                      <button
                        type="button"
                        onClick={() => openSetupOverlayGuide(turn.diagnosisPlan!)}
                        className="px-3.5 py-2 rounded-xl bg-rose-500 text-white font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                      >
                        👆 손가락 오버레이 다시 띄우기
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => undoSetupMonsterRepair(turn.auditId)}
                      disabled={turn.undone}
                      className={`px-4 py-2 rounded-xl font-label-sm text-[12px] font-extrabold cursor-pointer ${
                        turn.undone
                          ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                          : 'bg-amber-400 hover:bg-amber-300 text-zinc-950 shadow'
                      }`}
                    >
                      {turn.undone
                        ? '✓ 원상복구 완료됨'
                        : '↩️ 수리 전 상태로 1초 원상복구 (Undo)'}
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          if (turn.role === 'system_undo') {
            return (
              <div
                key={turn.id}
                className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-400/50 text-amber-200 font-body-sm text-[12.5px] font-bold"
              >
                {turn.text}
              </div>
            );
          }

          return (
            <div
              key={turn.id}
              className="p-4 rounded-2xl bg-zinc-900/90 border border-white/10 flex flex-col gap-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-[11px] text-primary-container font-extrabold">
                  🧠 Z-Eye 설정 몬스터 (웹/LLM 두뇌 진단)
                </span>
                <span className="font-mono text-[10.5px] text-zinc-500">
                  {turn.timestamp}
                </span>
              </div>
              <p className="font-body-sm text-[12.5px] text-zinc-200 leading-relaxed">
                {turn.text}
              </p>
              {turn.diagnosisPlan &&
                renderPlanActionCard(turn.diagnosisPlan, turn.undone)}
            </div>
          );
        })}
      </div>

      {/* 6. 하단 자연어 멀티턴 입력 바 (타이핑 + 음성 마이크 + "원래대로 해줘" 자동 인식) */}
      <div className="p-3.5 rounded-2xl bg-zinc-950 border border-primary-container/40 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <button
          type="button"
          onClick={handleVoiceMicInput}
          className={`px-3.5 py-2.5 rounded-xl font-label-sm text-[12px] font-extrabold shrink-0 cursor-pointer ${
            isListeningVoice
              ? 'bg-rose-500 text-white animate-pulse'
              : 'bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-primary-container'
          }`}
        >
          {isListeningVoice ? '🎙️ 듣는 중...' : '🎙️ 음성으로 말하기'}
        </button>
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendQuery();
          }}
          placeholder={
            setupMonsterPlatform === 'pc'
              ? '예: 부팅 광고 차단해줘 / 프린터 먹통 고쳐줘 / 어? 바꿨더니 불편해, 원래대로 해줘'
              : '예: 저녁 7~8시엔 카톡 소리 안 나게 해줘 / 글씨가 작아서 침침해 / 원래대로 해줘'
          }
          className="flex-1 px-3 py-2 bg-transparent text-white text-[13px] placeholder:text-zinc-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSendQuery}
          className="px-5 py-2.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-md text-[12.5px] font-extrabold whitespace-nowrap cursor-pointer"
        >
          🧠 1초 진단 요청 (무료)
        </button>
      </div>

      {/* 7. 🛡️ 분쟁 예방 감사 로그 (Audit Log 법적 면피 블랙박스) */}
      {showBlackboxPanel && (
        <div className="p-4 rounded-2xl bg-zinc-950 border border-amber-400/40 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="font-label-sm text-[11.5px] text-amber-300 font-extrabold">
                🛡️ 분쟁 예방 감사 로그 (Audit Log 로컬 블랙박스 · poc/results/z_eye_setup_blackbox.json)
              </span>
              <span className="font-body-sm text-[11.5px] text-zinc-400">
                [대화 전문 + 변경 전후 JSON 스냅샷 + 유저 승인 타임스탬프 + 화면 DOM 캡처 해시]를 영구 보존하여 법적 책임을 100% 면피합니다.
              </span>
            </div>
          </div>

          {setupAuditLogs.length === 0 ? (
            <p className="font-body-sm text-[12px] text-zinc-400 py-2">
              아직 기록된 수리 감사 로그가 없습니다. 위에서 [⚡ 1초 자동 수리 승인]을 실행하면 0.01초 전 JSON 스냅샷이 이곳에 자동 기록됩니다.
            </p>
          ) : (
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
              {setupAuditLogs.map((log) => (
                <div
                  key={log.auditId}
                  className="p-3 rounded-xl bg-zinc-900 border border-white/10 flex flex-col gap-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-label-sm text-[12px] text-white font-bold">
                      [{log.platform.toUpperCase()}] {log.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10.5px] text-zinc-400">
                        승인 시각: {log.userApprovedAt} · DOM: {log.domCaptureHash}
                      </span>
                      {log.undone ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-label-sm text-[10.5px] font-bold">
                          ↩️ 원복됨 ({log.undoneAt})
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => undoSetupMonsterRepair(log.auditId)}
                          className="px-2.5 py-1 rounded bg-amber-400 text-zinc-950 font-label-sm text-[10.5px] font-extrabold cursor-pointer"
                        >
                          ↩️ 1초 원상복구
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="font-mono text-[10.5px] text-zinc-300 break-all">
                    • Before Snapshot: {JSON.stringify(log.beforeSnapshot)} ➔ After:{' '}
                    {JSON.stringify(log.afterSnapshot)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const SetupMonsterModal: React.FC = () => {
  const { showSetupMonsterModal, setShowSetupMonsterModal } = useSaySeeStore();
  if (!showSetupMonsterModal) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl my-auto">
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={() => setShowSetupMonsterModal(false)}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-white font-label-sm text-[12px] font-bold cursor-pointer"
          >
            ✕ 설정 몬스터 창 닫기
          </button>
        </div>
        <SetupMonsterContent />
      </div>
    </div>
  );
};
