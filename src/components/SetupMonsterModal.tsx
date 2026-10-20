import React, { useEffect, useState } from 'react';
import {
  MOBILE_SYMPTOM_CHIPS,
  PC_SYMPTOM_CHIPS,
} from '../services/setupMonsterEngine';
import { dispatchAndroidOverlayArrowViaBridge } from '../services/p2pHybridBridge';
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
    activeOverlayBacktrackCount,
    recordOverlayBacktrack,
    advanceSetupOverlayStep,
    closeSetupOverlayGuide,
  } = useSaySeeStore();

  if (!activeOverlayPlan || !activeOverlayPlan.overlaySteps?.length) return null;

  const steps = activeOverlayPlan.overlaySteps;
  const currentStep = steps[activeOverlayStepIndex] ?? steps[0];
  const [leftPct, topPct] = currentStep.fingerCoordPct;
  const nativeOverlayDispatch = dispatchAndroidOverlayArrowViaBridge({
    rawLogicalRect: currentStep.rawLogicalRect ?? [leftPct * 10, topPct * 20, 120, 56],
    instructionKo: currentStep.bubbleMessage,
  });

  return (
    <div className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl rounded-3xl bg-zinc-950/95 border-2 border-rose-500/70 shadow-[0_0_50px_rgba(244,63,94,0.35)] overflow-hidden flex flex-col">
        {/* 상단 투명 유리판(Overlay) 상태 헤더 + 실시간 뒤로 가기(Back) 카운터 */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-rose-950/90 via-zinc-900 to-zinc-950 border-b border-rose-500/40 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-label-sm text-[11px] font-extrabold animate-pulse">
              👆 실시간 플로팅 오버레이 가이드 ({currentStep.step}/{steps.length}단계)
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full font-label-sm text-[11px] font-extrabold border ${
                activeOverlayBacktrackCount >= 2
                  ? 'bg-pink-500/25 border-pink-400 text-pink-200'
                  : activeOverlayBacktrackCount === 1
                  ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                  : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
              }`}
            >
              {activeOverlayBacktrackCount >= 2
                ? `💖 뒤로 가기(Back) ${activeOverlayBacktrackCount}회 — 완료 즉시 100% 쿨 환불(수업료 면제) 발동!`
                : activeOverlayBacktrackCount === 1
                ? '🟡 뒤로 가기(Back) 1회 — 인간적 허용 (1회 더 헤매면 100% 환불!)'
                : '🟢 뒤로 가기(Back) 0회 — 쾌속 완주 코스'}
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-label-sm text-[11px] text-primary-container font-extrabold">
                👁️ 에이전트 눈(Eye) 0.01초 화면 좌표 스캔 배열 (Scraped DOM/UI Tree)
              </span>
              <span className="font-mono text-[10.5px] text-emerald-300">
                Latency: 8.4ms · Backtrack: {activeOverlayBacktrackCount}회 · Bridge: {nativeOverlayDispatch.bridgeMode} (Inset -{nativeOverlayDispatch.statusBarInsetPx}px)
              </span>
            </div>
            {currentStep.scanModeBadgeKo && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/40 text-cyan-200 font-mono text-[10.5px] font-bold">
                  🛡️ {currentStep.scanModeBadgeKo}
                </span>
                {currentStep.rawLogicalRect && currentStep.calibratedPhysicalRect && (
                  <span className="font-mono text-[10.5px] text-amber-300 font-bold">
                    논리 좌표 [{currentStep.rawLogicalRect[0]}, {currentStep.rawLogicalRect[1]}] ➔ 물리 보정 좌표 [{currentStep.calibratedPhysicalRect[0]}, {currentStep.calibratedPhysicalRect[1]}]
                  </span>
                )}
              </div>
            )}
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

          {/* 하단 음성 안내 및 [뒤로 가기(Back) 초행길 헤맴] + [다음 단계] 버튼 */}
          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-400/30 flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="font-label-sm text-[11px] text-rose-300 font-extrabold">
                🔊 실시간 AI 동행 음성 안내
              </span>
              <p className="font-body-sm text-[12.5px] text-white">
                “{currentStep.voiceGuideText}”
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={recordOverlayBacktrack}
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-pink-400/50 text-pink-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
              >
                🔙 어? 이 화면이 아닌데 (뒤로 가기 Back +1 · 현재 {activeOverlayBacktrackCount}회)
              </button>
              <button
                type="button"
                onClick={advanceSetupOverlayStep}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-label-md text-[12px] font-extrabold shrink-0 cursor-pointer"
              >
                {activeOverlayStepIndex + 1 < steps.length
                  ? '👆 화살표 위치 눌렀어요 (다음 단계 ➔)'
                  : activeOverlayBacktrackCount >= 2
                  ? '💖 설정 완료! (2회+ 헤맴 감지 ➔ 100% 쿨 환불 & 최단 지름길 OTA 받기)'
                  : '✅ 설정 완료 (가이드 종료)'}
              </button>
            </div>
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
    setupFailureTelemetryQueue,
    setupSelfHealingOtaQueue,
    pendingTriageQuestion,
    setupEscrowHoldingCoins,
    merlinCoinTopupBridge,
    uiFontScalePercent,
    uiNightEyeProtection,
    setSimulatedMerlinCoinBalance,
    openMerlinCoinTopupBridge,
    closeMerlinCoinTopupBridge,
    topupMerlinCoinAndStartEscrowRepair,
    confirmSetupEscrowSettlement,
    loadSetupMonsterState,
    submitSetupMonsterQuery,
    answerSetupPreTriage,
    approveAndExecuteSetupPlan,
    triggerEmpathyRefundForCompletedRepair,
    undoSetupMonsterRepair,
    reportUnresolvedAndRefundSetup,
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
  const hasActiveRefundableAudit = setupAuditLogs.some((a) => !a.refunded);

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

  const getLevelColorStyle = (level?: SetupDiagnosisPlan['difficultyLevel']) => {
    if (level === 'LEVEL_3_ADVANCED_500') {
      return 'bg-rose-500/20 border-rose-400/50 text-rose-200';
    }
    if (level === 'LEVEL_2_INTERMEDIATE_300') {
      return 'bg-amber-500/20 border-amber-400/50 text-amber-200';
    }
    return 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200';
  };

  const renderPlanActionCard = (
    plan: SetupDiagnosisPlan,
    turnUndone?: boolean,
    turnRefunded?: boolean
  ) => {
    const isTrackA = plan.track === 'TRACK_A_DIRECT_REPAIR';
    const currentCoins = merlinAuth.coinBalance;
    const requiredCoins = plan.creditCost ?? 100;
    const deficitCoins = Math.max(0, requiredCoins - currentCoins);
    const hasEnoughCoins = deficitCoins === 0;

    return (
      <div className="mt-3 p-4 rounded-2xl bg-zinc-950/95 border border-primary-container/40 flex flex-col gap-3">
        {/* 상단 난이도 배지 + 트랙 배지 + 무위험 에스크로 100% 반환 보증 배지 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-md border font-label-sm text-[11px] font-extrabold ${getLevelColorStyle(
                plan.difficultyLevel
              )}`}
            >
              {plan.difficultyBadgeKo}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-md font-label-sm text-[11px] font-extrabold ${
                isTrackA
                  ? 'bg-emerald-500/15 border border-emerald-400/35 text-emerald-300'
                  : 'bg-rose-500/15 border border-rose-400/35 text-rose-300'
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
          <span className="px-2.5 py-0.5 rounded-md bg-pink-500/15 border border-pink-400/40 font-label-sm text-[11px] text-pink-200 font-extrabold">
            💖 초행길 2회 이상 헤매도 100% 쿨 환불 & 실패 시 100% 즉시 반환
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <h4 className="font-headline-sm text-[15px] text-white font-bold">
            {plan.title}
          </h4>
          <p className="font-body-sm text-[12px] text-zinc-300 leading-relaxed">
            {plan.rootCause}
          </p>
          {plan.feasibilityCheckKo && (
            <p className="font-mono text-[11px] text-emerald-300 mt-0.5">
              ✓ {plan.feasibilityCheckKo}
            </p>
          )}
        </div>

        {/* [멀린허브(Merlin Hub) 통합 지갑 사전 잔액 검증 (Pre-Check) 상태 바] */}
        <div
          className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
            hasEnoughCoins
              ? 'bg-emerald-950/30 border-emerald-400/40'
              : 'bg-amber-950/35 border-amber-400/60'
          }`}
        >
          <div className="flex flex-col gap-0.5">
            <span
              className={`font-label-sm text-[11.5px] font-extrabold ${
                hasEnoughCoins ? 'text-emerald-300' : 'text-amber-300'
              }`}
            >
              {hasEnoughCoins
                ? `✅ 멀린허브 통합 지갑 사전 잔액 검증(Pre-Check) 통과 — 즉시 에스크로 홀딩 가능`
                : `⚠️ 멀린허브 통합 지갑 사전 잔액 검증(Pre-Check) — 멀린코인 ${deficitCoins.toLocaleString()}개가 부족합니다!`}
            </span>
            <span className="font-body-sm text-[11px] text-zinc-300">
              필요 견적: <strong className="text-white">{requiredCoins.toLocaleString()} 코인</strong> · 현재 내 지갑 잔액:{' '}
              <strong className={hasEnoughCoins ? 'text-emerald-300' : 'text-amber-300'}>
                {currentCoins.toLocaleString()} 코인
              </strong>
              {!hasEnoughCoins && (
                <span>
                  {' '}
                  (충전이 완료되는 즉시 {requiredCoins} 코인 에스크로 홀딩을 걸고 1초 수리에 돌입합니다)
                </span>
              )}
            </span>
          </div>
          {!hasEnoughCoins && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-400/50 text-amber-200 font-label-sm text-[11px] font-extrabold">
              부족분: -{deficitCoins.toLocaleString()} 코인
            </span>
          )}
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

        {/* [딥리서치 엔지니어링 2대 급소: OS 보안 정책(Windows UIPI·JEA / Android SDK 35 WindowInsets) + 스마트 타겟팅 UI 스캔(토큰 99% 절감 & div/span 무손실 보존)] */}
        {(plan.osSecuritySpec || plan.smartScanTelemetry) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {plan.osSecuritySpec && (
              <div className="p-2.5 rounded-xl bg-cyan-950/25 border border-cyan-400/35 flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-label-sm text-[10.5px] text-cyan-300 font-extrabold">
                    {plan.osSecuritySpec.platform === 'pc'
                      ? '💻 Windows 11 OS 보안 (UIPI 관통 & JEA 최소 권한)'
                      : '📱 Android 15 (SDK 35) Edge-to-Edge 오프셋 보정'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-200 font-mono text-[9.5px] font-bold">
                    {plan.osSecuritySpec.platform === 'pc'
                      ? 'uiAccess="true" · Authenticode · JEA'
                      : `WindowInsets (상단 -${plan.osSecuritySpec.androidStatusBarInsetPx ?? 112}px) · RECEIVER_NOT_EXPORTED`}
                  </span>
                </div>
                <p className="font-body-sm text-[10.5px] text-zinc-300 leading-snug">
                  {plan.osSecuritySpec.platform === 'pc'
                    ? `JEA 정책: ${plan.osSecuritySpec.windowsJeaLeastPrivilegePolicy} · 백업: ${plan.osSecuritySpec.windowsPreBackupRegistryJsonPath}`
                    : `보정 공식: ${plan.osSecuritySpec.androidEdgeToEdgeOffsetFormula} · 플래그: ${plan.osSecuritySpec.androidBroadcastReceiverFlag}`}
                </p>
              </div>
            )}

            {plan.smartScanTelemetry && (
              <div className="p-2.5 rounded-xl bg-emerald-950/25 border border-emerald-400/35 flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-label-sm text-[10.5px] text-emerald-300 font-extrabold">
                    {plan.smartScanTelemetry.scanStrategyBadgeKo}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 font-mono text-[9.5px] font-bold">
                    {plan.smartScanTelemetry.rawTotalDomNodes.toLocaleString()}노드({plan.smartScanTelemetry.rawEstimatedTokens.toLocaleString()}T) ➔{' '}
                    {plan.smartScanTelemetry.scannedTargetNodes}노드({plan.smartScanTelemetry.finalSentTokens}T ·{' '}
                    {plan.smartScanTelemetry.tokenSavingsPercent}% 절감)
                  </span>
                </div>
                <p className="font-mono text-[10px] text-zinc-300">
                  • 활성 창: {plan.smartScanTelemetry.foregroundWindowTitle} | 타겟 경로: {plan.smartScanTelemetry.targetRegionOrZoomPathKo}
                </p>
                <p className="font-mono text-[10px] text-amber-200">
                  • 비표준 클릭 요소(div/span/에러 라벨) 무손실 보존:{' '}
                  {plan.smartScanTelemetry.preservedNonStandardNodes
                    .map((n) => `${n.tagOrRole}("${n.label}")`)
                    .join(' | ')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* [에스크로 홀딩 후 1초 수리 시작] + [1회 우회 / 2회 헤맨 성공 100% 쿨 환불 시뮬레이션] */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {hasEnoughCoins ? (
                <>
                  <button
                    type="button"
                    onClick={() => approveAndExecuteSetupPlan(plan, 0)}
                    className="px-4 py-2.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-md text-[12.5px] font-extrabold shadow-[0_0_20px_rgba(32,247,219,0.25)] cursor-pointer"
                  >
                    ⚡ {requiredCoins} 코인 에스크로 홀딩 후 1초 수리 시작 (🟢 0회 쾌속 완주)
                  </button>
                  <button
                    type="button"
                    onClick={() => approveAndExecuteSetupPlan(plan, 1)}
                    className="px-3 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                  >
                    🟡 1회 우회 성공 (정상 정산 + 미세 교정 OTA)
                  </button>
                  <button
                    type="button"
                    onClick={() => approveAndExecuteSetupPlan(plan, 2)}
                    className="px-3.5 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-label-sm text-[12px] font-extrabold shadow-[0_0_20px_rgba(236,72,153,0.4)] cursor-pointer"
                  >
                    💖 2회 헤맨 성공 시뮬레이션 (수리 유지 + 100% 쿨 환불 + 최단 지름길 OTA!)
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => openMerlinCoinTopupBridge(plan)}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-md text-[12.5px] font-extrabold shadow-[0_0_25px_rgba(251,191,36,0.35)] cursor-pointer animate-pulse"
                >
                  🪙 멀린코인 {deficitCoins.toLocaleString()}개가 부족합니다 — 1초 충전 후 바로 고치기
                </button>
              )}

              {plan.overlaySteps && plan.overlaySteps.length > 0 && (
                <button
                  type="button"
                  onClick={() => openSetupOverlayGuide(plan)}
                  className="px-3.5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-rose-200 font-label-sm text-[12px] font-extrabold cursor-pointer"
                >
                  👆 손가락 화살표 오버레이 띄우기 (Back 버튼 테스트 가능)
                </button>
              )}
            </div>
            {turnRefunded ? (
              <span className="font-label-sm text-[11px] text-pink-300 font-extrabold">
                💖 에스크로 {requiredCoins} 코인 100% 반환 완료
              </span>
            ) : turnUndone ? (
              <span className="font-label-sm text-[11px] text-amber-300 font-bold">
                ↩️ 원상복구 완료된 내역입니다
              </span>
            ) : null}
          </div>
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
      {/* 1. 정갈한 상단 헤더: 좌측 타이틀 & PC/모바일 전환 탭 / 우측 지갑 상태 텍스트 & 액션 버튼 */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-headline-sm text-[19px] text-white font-extrabold tracking-tight">
              🛠️ Z-Eye 설정 몬스터
            </h2>
            <span className="text-[12px] text-zinc-400">
              무료 상담 후 수리 · 초행길 2회 이상 헤매거나 실패 시 100% 자동 환불
            </span>
          </div>

          {/* 깔끔한 2단 플랫폼 스위처 */}
          <div className="inline-flex p-1 rounded-xl bg-zinc-950 border border-white/10">
            <button
              type="button"
              onClick={() => setSetupMonsterPlatform('pc')}
              className={`px-4 py-2 rounded-lg font-label-md text-[12.5px] font-extrabold transition-all cursor-pointer ${
                setupMonsterPlatform === 'pc'
                  ? 'bg-primary-container text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              💻 PC 설정·수리
            </button>
            <button
              type="button"
              onClick={() => setSetupMonsterPlatform('mobile')}
              className={`px-4 py-2 rounded-lg font-label-md text-[12.5px] font-extrabold transition-all cursor-pointer ${
                setupMonsterPlatform === 'mobile'
                  ? 'bg-primary-container text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              📱 스마트폰 설정
            </button>
          </div>
        </div>

        {/* 우측: 지갑 상태(순수 텍스트 위계) + 꼭 필요한 버튼만 배치 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-[12.5px] text-zinc-300">
            <span>
              🪙 잔액: <strong className="text-amber-300">{merlinAuth.coinBalance.toLocaleString()} 코인</strong>
            </span>
            {setupEscrowHoldingCoins > 0 && (
              <span className="text-primary-container font-bold">
                (🔒 에스크로 {setupEscrowHoldingCoins}C)
              </span>
            )}
            <span className="text-[11px] text-zinc-500 ml-1">
              테스트 잔액:{' '}
              {[0, 100, 1250].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setSimulatedMerlinCoinBalance(amt)}
                  className={`underline ml-1 cursor-pointer ${
                    merlinAuth.coinBalance === amt ? 'text-amber-300 font-extrabold' : 'hover:text-zinc-300'
                  }`}
                >
                  {amt}C
                </button>
              ))}
            </span>
          </div>

          {hasActiveRefundableAudit && (
            <>
              <button
                type="button"
                onClick={() => triggerEmpathyRefundForCompletedRepair(undefined, 2)}
                className="px-3 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-label-sm text-[11.5px] font-extrabold cursor-pointer"
              >
                💖 2회 헤맴 100% 쿨 환불
              </button>
              <button
                type="button"
                onClick={() => reportUnresolvedAndRefundSetup()}
                className="px-3 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-label-sm text-[11.5px] font-extrabold cursor-pointer"
              >
                👎 미해결 환불
              </button>
            </>
          )}

          {hasActiveUndoableAudit && (
            <button
              type="button"
              onClick={() => undoSetupMonsterRepair()}
              className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
            >
              ↩️ 1초 원상복구
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowBlackboxPanel((prev) => !prev)}
            className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 font-label-sm text-[11.5px] font-bold cursor-pointer"
          >
            📋 기록 ({setupAuditLogs.length})
          </button>
        </div>
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
                  ⚡ 이 문제 1초 진단 & 해결하기 (100 코인)
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. 원클릭 증상 칩 (PC 6대 수리 칩: Level 1/2/3 표시 / 모바일 증상 칩) */}
      <div className="flex flex-col gap-2">
        <span className="font-label-sm text-[12px] text-zinc-400 font-bold">
          💡 자주 찾는 증상 선택 (무료 상담부터 시작)
        </span>
        <div className="flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() =>
                submitSetupMonsterQuery(chip.query, chip.id, chip.platform)
              }
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 hover:border-primary-container text-white font-label-sm text-[12.5px] font-bold transition-all cursor-pointer"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. 대화형 수리 창구 (사전 무료 문진 ➔ 난이도별 견적 & 사전 잔액 Pre-Check ➔ 에스크로 수리 완료 리포트) */}
      <div className="p-4 rounded-2xl bg-zinc-950/90 border border-white/10 flex flex-col gap-3 max-h-[620px] overflow-y-auto">
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

          // [선(先) 무료 문진 & Z-Eye_PC_Setup.exe 사태 파악 턴 — 잔액 0코인이어도 100% 무료]
          if (turn.role === 'assistant_triage' && turn.triageQuestion) {
            const q = turn.triageQuestion;
            return (
              <div
                key={turn.id}
                className="p-4 rounded-2xl bg-zinc-900/95 border border-primary-container/45 flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-primary-container/20 border border-primary-container/50 text-primary-container font-label-sm text-[11px] font-extrabold">
                      🔍 STEP 1 · 선(先) 무료 문진 & Z-Eye_PC_Setup.exe 사태 파악 (잔액 0코인이어도 100% 무료)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-950 border border-white/10 text-emerald-300 font-mono text-[10.5px]">
                      해결 가능 여부 & 작업 복잡도 스캔 완료
                    </span>
                  </div>
                  <span className="font-mono text-[10.5px] text-zinc-400">
                    {turn.timestamp}
                  </span>
                </div>

                <p className="font-body-sm text-[12.5px] text-zinc-200 whitespace-pre-line leading-relaxed">
                  {turn.text}
                </p>

                {/* 문진 선택지 버튼 (1~2회 질문 응답 시 맞춤 난이도 견적 카드 + 멀린허브 사전 잔액 검증 제시) */}
                <div className="flex flex-col gap-2 pt-1">
                  <span className="font-label-sm text-[11px] text-amber-300 font-bold">
                    👇 아래 증상 세부 항목을 선택하시거나 하단 채팅창에 편하게 답변해 주세요 (선택 시 난이도별 견적 및 멀린허브 지갑 잔액 Pre-Check가 실행됩니다):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((opt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          answerSetupPreTriage(
                            q.questionId,
                            opt.detailAnswer,
                            q.presetId
                          )
                        }
                        className="px-3.5 py-2 rounded-xl bg-zinc-950 hover:bg-primary-container hover:text-zinc-950 border border-primary-container/40 text-white font-label-sm text-[12px] font-extrabold transition-all cursor-pointer"
                      >
                        💬 {opt.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        answerSetupPreTriage(
                          q.questionId,
                          q.symptomQuery,
                          q.presetId,
                          true
                        )
                      }
                      className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-label-sm text-[11.5px] font-bold cursor-pointer"
                    >
                      ⚡ 문진 건너뛰고 바로 견적 & 잔액 체크 보기
                    </button>
                  </div>
                  {turn.triageAnswered && (
                    <span className="font-label-sm text-[11px] text-emerald-300 font-bold">
                      ✓ 사전 문진 응답 완료 — 아래에 난이도별 차등 견적 및 멀린코인 에스크로 승인 카드가 제시되었습니다.
                    </span>
                  )}
                </div>
              </div>
            );
          }

          // [수리 완료 리포트 턴: 에스크로 홀딩 상태 표시 + 완치 확정 정산 or [💖 초행길 2회 헤맴 100% 쿨 환불] or [👎 아직 해결 안 됨]]
          if (turn.role === 'system_repair') {
            const cost = turn.diagnosisPlan?.creditCost ?? 100;
            const isSettled = turn.escrowStatus === 'SETTLED_COMPLETED';
            const isEmpathyRefund = turn.escrowStatus === 'RELEASED_EMPATHY_REFUND';
            const btCount = turn.backtrackCount ?? 0;
            return (
              <div
                key={turn.id}
                className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-400/50 flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-label-sm text-[11px] font-extrabold">
                      {isEmpathyRefund
                        ? `💖 수리 완료 유지 · 초행길 ${btCount}회 헤맴으로 +${cost} 코인 100% 쿨 환불 완료`
                        : turn.refunded
                        ? `💸 에스크로 홀딩 ${cost} 코인 100% 반환됨`
                        : isSettled
                        ? `✅ 완치 확인 · 에스크로 ${cost} 코인 최종 정산 확정`
                        : `🔒 1초 수리 완료 · ${cost} 멀린코인 에스크로 홀딩 중 (Back ${btCount}회)`}
                    </span>
                    {turn.diagnosisPlan?.difficultyBadgeKo && (
                      <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-200 font-label-sm text-[10.5px] font-bold">
                        {turn.diagnosisPlan.difficultyBadgeKo}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[10.5px] text-zinc-400">
                    Audit ID: {turn.auditId} · {turn.timestamp}
                  </span>
                </div>
                <p className="font-body-sm text-[13px] text-white font-bold whitespace-pre-line leading-relaxed">
                  {turn.text}
                </p>

                {/* 멀린코인 에스크로 완치 정산 vs 초행길 2회 헤맴 100% 쿨 환불 vs 실패 시 100% 즉시 반환 액션 바 */}
                <div className="p-3 rounded-xl bg-zinc-950/85 border border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-label-sm text-[11.5px] text-primary-container font-extrabold">
                      🔒 멀린코인 에스크로 & 인간미 쿨 환불 판정
                    </span>
                    <span className="font-body-sm text-[11px] text-zinc-300">
                      초행길에 2번 이상 헤매며 완료됐다면 수리는 그대로 유지한 채 {cost} 코인을 100% 돌려드리고 최단 지름길을 전 세계에 배포합니다!
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {turn.diagnosisPlan?.overlaySteps?.length ? (
                      <button
                        type="button"
                        onClick={() => openSetupOverlayGuide(turn.diagnosisPlan!)}
                        className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-rose-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                      >
                        👆 손가락 오버레이 다시 띄우기
                      </button>
                    ) : null}

                    {!turn.refunded && !isSettled && (
                      <button
                        type="button"
                        onClick={() => confirmSetupEscrowSettlement(turn.auditId)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                      >
                        ✅ 잘 고쳐졌어요 (정상 정산 확정)
                      </button>
                    )}

                    {!turn.refunded && (
                      <button
                        type="button"
                        onClick={() =>
                          triggerEmpathyRefundForCompletedRepair(turn.auditId, 2)
                        }
                        className="px-3.5 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-label-sm text-[11.5px] font-extrabold shadow-[0_0_18px_rgba(236,72,153,0.4)] cursor-pointer"
                      >
                        💖 초행길 2회 헤맨 성공 (수리 유지 + {cost}C 100% 쿨 환불 & 지름길 OTA)
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => reportUnresolvedAndRefundSetup(turn.auditId)}
                      disabled={turn.refunded}
                      className={`px-3.5 py-2 rounded-xl font-label-sm text-[11.5px] font-extrabold cursor-pointer ${
                        turn.refunded
                          ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                          : 'bg-rose-500 hover:bg-rose-400 text-white'
                      }`}
                    >
                      {turn.refunded
                        ? `✓ +${cost} 코인 100% 환불 완료`
                        : `👎 아직 해결 안 됨 (원상복구 + ${cost}C 100% 반환)`}
                    </button>

                    <button
                      type="button"
                      onClick={() => undoSetupMonsterRepair(turn.auditId)}
                      disabled={turn.undone}
                      className={`px-3 py-2 rounded-xl font-label-sm text-[11.5px] font-extrabold cursor-pointer ${
                        turn.undone
                          ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                          : 'bg-amber-400 hover:bg-amber-300 text-zinc-950 shadow'
                      }`}
                    >
                      {turn.undone ? '✓ 원상복구됨' : '↩️ 단순 1초 원상복구'}
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // [💖 초행길 2회 이상 우회 성공 시 100% 쿨 환불(인간미 UX) + 본사 Multi-LLM 최단 직행 지름길 전 세계 OTA 배포 완료 턴]
          if (turn.role === 'system_empathy_refund') {
            const ota = turn.selfHealingOta;
            const refundedCoins = turn.refundedAmount ?? ota?.refundedCoins ?? 100;
            return (
              <div
                key={turn.id}
                className="p-4 rounded-2xl bg-gradient-to-br from-pink-950/55 via-zinc-950 to-emerald-950/35 border-2 border-pink-400/70 shadow-[0_0_30px_rgba(236,72,153,0.2)] flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-pink-500 text-white font-label-sm text-[11px] font-extrabold">
                      💖 인간 냄새 나는 100% 쿨 환불 완료 (+{refundedCoins} 멀린코인 즉시 반환 · 수리 완료 상태 유지!)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-label-sm text-[11px] font-extrabold">
                      🌍 Multi-LLM 최단 직행 지름길 전 세계 APK/.exe 실시간 OTA 배포 완료
                    </span>
                  </div>
                  <span className="font-mono text-[10.5px] text-pink-200">
                    {ota?.otaId} · {turn.timestamp}
                  </span>
                </div>

                {/* 인간미 넘치는 사과 & 100% 환불 브리핑 메시지 */}
                <div className="p-3.5 rounded-xl bg-zinc-950/85 border border-pink-400/35">
                  <p className="font-body-sm text-[13px] text-white whitespace-pre-line leading-relaxed">
                    {turn.text}
                  </p>
                </div>

                {/* 소중한 학습 기회 즉시 자산화 (우회 궤적 ➔ 최단 직행 지름길 도출 명세) */}
                {ota && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl bg-zinc-900/90 border border-rose-400/35 flex flex-col gap-1.5">
                      <span className="font-label-sm text-[11px] text-rose-300 font-extrabold">
                        🧭 현장 우회 성공 궤적 (Trajectory Log · 뒤로 가기 {ota.backtrackCount}회)
                      </span>
                      <div className="flex flex-col gap-1">
                        {ota.rawTrajectorySteps.map((step, idx) => (
                          <span
                            key={idx}
                            className={`font-mono text-[10.5px] ${
                              step.includes('뒤로 가기(Back)')
                                ? 'text-rose-300 font-bold'
                                : 'text-zinc-300'
                            }`}
                          >
                            • {step}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-400/45 flex flex-col gap-1.5">
                      <span className="font-label-sm text-[11px] text-emerald-300 font-extrabold">
                        ⚡ Multi-LLM 최단 직행 지름길 (Shortest Path · 헤맨 구간 100% 제거 & 전 세계 OTA)
                      </span>
                      <div className="flex flex-col gap-1">
                        {ota.prunedShortestPathSteps.map((step, idx) => (
                          <span
                            key={idx}
                            className="font-mono text-[10.5px] text-emerald-200 font-bold"
                          >
                            {step}
                          </span>
                        ))}
                      </div>
                      <span className="mt-1 font-mono text-[10px] text-primary-container">
                        ✓ {ota.multiLlmActionKo}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // [수리 실패 시 1초 원상복구 + 에스크로 코인 100% 즉시 반환 + 본사 실패 블랙박스 로그 전송 완료 턴]
          if (turn.role === 'system_refund') {
            return (
              <div
                key={turn.id}
                className="p-4 rounded-2xl bg-rose-950/40 border-2 border-rose-400/60 flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-rose-500 text-white font-label-sm text-[11px] font-extrabold">
                    💸 무위험(Zero-Risk) 1초 원상복구 & 에스크로 +{turn.refundedAmount ?? 100} 멀린코인 100% 즉시 반환 완료
                  </span>
                  <span className="font-mono text-[10.5px] text-rose-200">
                    Failure Telemetry ID: {turn.failureTelemetryId} · {turn.timestamp}
                  </span>
                </div>
                <p className="font-body-sm text-[12.5px] text-white whitespace-pre-line leading-relaxed">
                  {turn.text}
                </p>
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
                  🧠 STEP 2 · Z-Eye 설정 몬스터 (난이도별 견적 & 멀린허브 사전 잔액 Pre-Check 완료)
                </span>
                <span className="font-mono text-[10.5px] text-zinc-500">
                  {turn.timestamp}
                </span>
              </div>
              <p className="font-body-sm text-[12.5px] text-zinc-200 whitespace-pre-line leading-relaxed">
                {turn.text}
              </p>
              {turn.diagnosisPlan &&
                renderPlanActionCard(
                  turn.diagnosisPlan,
                  turn.undone,
                  turn.refunded
                )}
            </div>
          );
        })}
      </div>

      {/* 6. 하단 자연어 멀티턴 입력 바 (타이핑 + 음성 마이크 + "2번 헤맸어" / "아직 해결 안 됨" / "원래대로 해줘" 자동 인식) */}
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
            pendingTriageQuestion
              ? `문진 답변 입력 (예: ${pendingTriageQuestion.options[0]?.label ?? '윈도우 기본에서 먹통이에요'}) 또는 새로운 증상 입력`
              : setupMonsterPlatform === 'pc'
              ? '예: 프린터 먹통 고쳐줘 / 초행길에 2번 헤맸어 / 아직 해결 안 됨 환불해줘'
              : '예: 저녁 7~8시엔 카톡 소리 안 나게 해줘 / 2번 헤맸어 / 원래대로 해줘'
          }
          className="flex-1 px-3 py-2 bg-transparent text-white text-[13px] placeholder:text-zinc-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSendQuery}
          className="px-5 py-2.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-md text-[12.5px] font-extrabold whitespace-nowrap cursor-pointer"
        >
          {pendingTriageQuestion ? '💬 문진 답변 제출 (0 코인 무료)' : '🔍 무료 사전 문진 요청 (0 코인)'}
        </button>
      </div>

      {/* 7. 🌍 본사 Multi-LLM 최단 직행 지름길 OTA 큐 & 📡 실패 분석 큐 & 🛡️ 분쟁 예방 감사 로그 */}
      {showBlackboxPanel && (
        <div className="p-4 rounded-2xl bg-zinc-950 border border-amber-400/40 flex flex-col gap-4">
          {/* 7-0. 본사 Multi-LLM 최단 직행 지름길 (Shortest Path) OTA 자산화 큐 */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-label-sm text-[12px] text-pink-300 font-extrabold">
                🌍 본사 Multi-LLM ‘최단 직행 지름길(Shortest Path) OTA 자산화 큐’ ({setupSelfHealingOtaQueue.length}건)
              </span>
              <span className="font-mono text-[10.5px] text-emerald-300">
                초행길 우회 성공 궤적(Trajectory Log) ➔ 헤맨 구간 제거 ➔ 전 세계 APK / .exe 실시간 OTA 배포
              </span>
            </div>

            {setupSelfHealingOtaQueue.length === 0 ? (
              <p className="font-body-sm text-[11.5px] text-zinc-400 py-1">
                아직 수집된 초행길 우회 학습 궤적이 없습니다. 견적 카드에서 [💖 2회 헤맨 성공 시뮬레이션] 또는 [🟡 1회 우회 성공]을 누르면 즉시 전 세계 OTA 지름길 자산화 내역이 이곳에 기록됩니다.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                {setupSelfHealingOtaQueue.map((ota) => (
                  <div
                    key={ota.otaId}
                    className="p-3 rounded-xl bg-pink-950/25 border border-pink-400/40 flex flex-col gap-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-label-sm text-[11.5px] text-pink-200 font-extrabold">
                        [{ota.trajectoryGradeBadgeKo}] {ota.title} · {ota.escrowSettlementKo}
                      </span>
                      <span className="font-mono text-[10.5px] text-zinc-400">
                        {ota.otaId} · {ota.createdAt}
                      </span>
                    </div>
                    <p className="font-mono text-[10.5px] text-emerald-300 break-all">
                      • 최단 직행 지름길(Shortest Path): {ota.prunedShortestPathSteps.join(' ➔ ')}
                    </p>
                    <p className="font-mono text-[10.5px] text-zinc-300 break-all">
                      • {ota.multiLlmActionKo}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 7-A. 본사 실패 블랙박스 로그 큐 (Failure Telemetry) */}
          <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-label-sm text-[12px] text-rose-300 font-extrabold">
                📡 본사 어드민 ‘실패 분석 큐 (Failure Telemetry)’ 자동 전송 내역 ({setupFailureTelemetryQueue.length}건)
              </span>
              <span className="font-mono text-[10.5px] text-zinc-400">
                패킷 구조: &#123; 증상 대화 내역 + Windows 빌드/환경 정보 + 실행 시도 스크립트 + Error Code &#125;
              </span>
            </div>

            {setupFailureTelemetryQueue.length === 0 ? (
              <p className="font-body-sm text-[11.5px] text-zinc-400 py-1">
                아직 발생한 수리 실패·환불 로그가 없습니다. 수리 완료 후 [👎 아직 해결 안 됨 (원상복구 및 100% 즉시 반환)] 버튼을 누르면 즉시 에스크로 100% 반환과 함께 이곳에 본사 전송 패킷이 기록됩니다.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                {setupFailureTelemetryQueue.map((fp) => (
                  <div
                    key={fp.failureId}
                    className="p-3 rounded-xl bg-rose-950/25 border border-rose-400/40 flex flex-col gap-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-label-sm text-[11.5px] text-rose-200 font-extrabold">
                        [{fp.hqQueueStatus}] {fp.symptomQuery} (+{fp.refundedCoins} 코인 100% 반환됨)
                      </span>
                      <span className="font-mono text-[10.5px] text-zinc-400">
                        {fp.failureId} · {fp.reportedAt}
                      </span>
                    </div>
                    <p className="font-mono text-[10.5px] text-zinc-300 break-all">
                      • 환경: {fp.windowsBuildEnv} | Error Code: {fp.errorCode}
                    </p>
                    <p className="font-mono text-[10.5px] text-amber-200 break-all">
                      • 실행 시도 스크립트: {fp.attemptedScript}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 7-B. 분쟁 예방 감사 로그 (Audit Log) */}
          <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="font-label-sm text-[11.5px] text-amber-300 font-extrabold">
                  🛡️ 분쟁 예방 감사 로그 (Audit Log 로컬 블랙박스 · poc/results/z_eye_setup_blackbox.json)
                </span>
                <span className="font-body-sm text-[11.5px] text-zinc-400">
                  [대화 전문 + 변경 전후 JSON 스냅샷 + 유저 승인 타임스탬프 + 화면 DOM 캡처 해시]를 영구 보존합니다.
                </span>
              </div>
            </div>

            {setupAuditLogs.length === 0 ? (
              <p className="font-body-sm text-[12px] text-zinc-400 py-1">
                아직 기록된 수리 감사 로그가 없습니다.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                {setupAuditLogs.map((log) => (
                  <div
                    key={log.auditId}
                    className="p-3 rounded-xl bg-zinc-900 border border-white/10 flex flex-col gap-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-label-sm text-[12px] text-white font-bold">
                        [{log.platform.toUpperCase()} · {log.creditDeducted} 코인 · Back {log.backtrackCount ?? 0}회] {log.title}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10.5px] text-zinc-400">
                          승인: {log.userApprovedAt} · DOM: {log.domCaptureHash}
                        </span>
                        {log.escrowStatus === 'RELEASED_EMPATHY_REFUND' ? (
                          <span className="px-2 py-0.5 rounded bg-pink-500/20 text-pink-200 font-label-sm text-[10.5px] font-extrabold">
                            💖 수리 유지 & +{log.creditDeducted}C 100% 쿨 환불
                          </span>
                        ) : log.refunded ? (
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-label-sm text-[10.5px] font-extrabold">
                            💸 원복 & +{log.creditDeducted} 코인 100% 반환됨
                          </span>
                        ) : log.undone ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-label-sm text-[10.5px] font-bold">
                            ↩️ 원복됨 ({log.undoneAt})
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                triggerEmpathyRefundForCompletedRepair(log.auditId, 2)
                              }
                              className="px-2.5 py-1 rounded bg-pink-500 text-white font-label-sm text-[10.5px] font-extrabold cursor-pointer"
                            >
                              💖 2회 헤맴 100% 쿨 환불
                            </button>
                            <button
                              type="button"
                              onClick={() => reportUnresolvedAndRefundSetup(log.auditId)}
                              className="px-2.5 py-1 rounded bg-rose-500 text-white font-label-sm text-[10.5px] font-extrabold cursor-pointer"
                            >
                              👎 미해결 100% 반환
                            </button>
                            <button
                              type="button"
                              onClick={() => undoSetupMonsterRepair(log.auditId)}
                              className="px-2.5 py-1 rounded bg-amber-400 text-zinc-950 font-label-sm text-[10.5px] font-extrabold cursor-pointer"
                            >
                              ↩️ 1초 원상복구
                            </button>
                          </>
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
        </div>
      )}

      {/* 8. 🪙 멀린허브(Merlin Hub) 원클릭 1초 충전 브릿지 모달 (잔액 부족 Pre-Check 시 직결) */}
      {merlinCoinTopupBridge.open && (
        <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-zinc-950 border-2 border-amber-400/70 shadow-[0_0_50px_rgba(251,191,36,0.3)] p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-zinc-950 font-label-sm text-[11px] font-extrabold w-fit">
                  🪙 멀린허브(Merlin Hub) 통합 지갑 · 원클릭 1초 충전 브릿지
                </span>
                <h3 className="font-headline-sm text-[18px] text-white font-extrabold mt-1">
                  멀린코인 {merlinCoinTopupBridge.deficitCoins.toLocaleString()}개가 부족합니다 — 1초 충전 후 바로 고치기
                </h3>
                <p className="font-body-sm text-[12px] text-zinc-300 leading-relaxed">
                  충전이 완료되는 즉시 <strong className="text-amber-300">{merlinCoinTopupBridge.requiredCoins} 코인 에스크로 홀딩(완치 후 정산)</strong>을 걸고 1초 자동 수리에 돌입합니다. (실패 시 100% 즉시 반환 보장)
                </p>
              </div>
              <button
                type="button"
                onClick={closeMerlinCoinTopupBridge}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-label-sm text-[12px] font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 사전 잔액 검증(Pre-Check) 계산 내역 */}
            <div className="p-4 rounded-2xl bg-zinc-900/90 border border-white/10 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-zinc-400">대상 수리 작업</span>
                <span className="text-white font-bold">
                  {merlinCoinTopupBridge.targetPlan?.title} ({merlinCoinTopupBridge.targetPlan?.difficultyBadgeKo})
                </span>
              </div>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-zinc-400">필요 에스크로 홀딩 코인</span>
                <span className="text-white font-extrabold">
                  {merlinCoinTopupBridge.requiredCoins.toLocaleString()} 코인
                </span>
              </div>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-zinc-400">현재 멀린허브 보유 잔액</span>
                <span className="text-zinc-200 font-bold">
                  {merlinCoinTopupBridge.currentCoins.toLocaleString()} 코인
                </span>
              </div>
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[13.5px]">
                <span className="text-amber-300 font-extrabold">부족한 멀린코인</span>
                <span className="text-amber-300 font-extrabold">
                  {merlinCoinTopupBridge.deficitCoins.toLocaleString()} 코인 부족
                </span>
              </div>
            </div>

            {/* 원클릭 충전 & 즉시 수리 시작 버튼 3종 */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() =>
                  topupMerlinCoinAndStartEscrowRepair(merlinCoinTopupBridge.deficitCoins)
                }
                className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-label-md text-[13px] font-extrabold shadow-lg cursor-pointer"
              >
                ⚡ 부족한 +{merlinCoinTopupBridge.deficitCoins.toLocaleString()} 코인만 1초 충전 후 바로 고치기 (추천)
              </button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => topupMerlinCoinAndStartEscrowRepair(500)}
                  className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-primary-container/50 text-primary-container font-label-sm text-[12px] font-extrabold cursor-pointer"
                >
                  🪙 +500 멀린코인 충전 후 바로 고치기
                </button>
                <button
                  type="button"
                  onClick={() => topupMerlinCoinAndStartEscrowRepair(1000)}
                  className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-emerald-400/50 text-emerald-300 font-label-sm text-[12px] font-extrabold cursor-pointer"
                >
                  💎 +1,000 멀린코인 충전 후 바로 고치기
                </button>
              </div>
            </div>
          </div>
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
