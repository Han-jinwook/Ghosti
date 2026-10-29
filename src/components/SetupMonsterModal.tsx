import React, { useEffect, useState } from 'react';
import {
  MOBILE_SYMPTOM_CHIPS,
  PC_SYMPTOM_CHIPS,
  executeRealOsAction,
  fetchRealPcOsInspection,
  launchRealOsTopmostOverlay,
  runRealForensicScan,
  type RealForensicScanResult,
  type RealPcOsInspectionData,
} from '../services/setupMonsterEngine';
import { dispatchAndroidOverlayArrowViaBridge } from '../services/p2pHybridBridge';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { SetupDiagnosisPlan } from '../types/saysee';
import { GhostiBrandLogo } from './GhostiBrandLogo';
import {
  processUnifiedMonsterChatQuery,
  loadLocalHealthCheckHistory,
  executeRestorePointRollback,
  type MonsterChatMessage,
  type MonsterLiteracyLevel,
  type DigitalHealthCheckRecord,
} from '../services/monsterChatRouter';
import {
  MonsterInteractiveCardView,
  PersonalHealthCheckHistoryDrawer,
} from './MonsterInteractiveCards';

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

  const steps = activeOverlayPlan?.overlaySteps ?? [];
  const currentStep = steps[activeOverlayStepIndex] ?? steps[0];

  useEffect(() => {
    if (!activeOverlayPlan || !currentStep || activeOverlayPlan.platform !== 'pc') return;
    const [lx, ly] = currentStep.rawLogicalRect ?? [420, 160, 120, 56];
    void launchRealOsTopmostOverlay({
      x: lx,
      y: ly,
      text: currentStep.bubbleMessage,
      durationSec: 10,
    });
  }, [activeOverlayPlan, activeOverlayStepIndex, currentStep]);

  if (!activeOverlayPlan || !activeOverlayPlan.overlaySteps?.length) return null;

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
                ? `💦 뒤로 가기(Back) ${activeOverlayBacktrackCount}회 — 헤맨 단계는 내 PC 기록에 남깁니다`
                : activeOverlayBacktrackCount === 1
                ? '🟡 뒤로 가기(Back) 1회'
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
                  ? '✅ 설정 완료 (가이드 종료)'
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
 * [🛠️ 설정몬스터 (Setup Monster) 본체 패널]
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
    runTextQuery,
    setDesktopTab,
    setMobileTab,
    layout,
  } = useSaySeeStore();

  const [inputQuery, setInputQuery] = useState('');
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [showBlackboxPanel, setShowBlackboxPanel] = useState(false);
  const [showRealOsPanel, setShowRealOsPanel] = useState(true);
  const [showHealthHistoryDrawer, setShowHealthHistoryDrawer] = useState(false);
  const [healthHistoryRecords, setHealthHistoryRecords] = useState<DigitalHealthCheckRecord[]>(() =>
    loadLocalHealthCheckHistory()
  );
  const [literacyLevel, setLiteracyLevel] = useState<MonsterLiteracyLevel>('normal');
  const [monsterMessages, setMonsterMessages] = useState<MonsterChatMessage[]>([]);

  const triggerMonsterQuery = async (rawQuery: string) => {
    const q = rawQuery.trim();
    if (!q) return;
    const nowLabel = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const userMsg: MonsterChatMessage = {
      id: `user_rep_${Date.now()}`,
      role: 'user',
      timestamp: nowLabel,
      text: q,
      sourceTab: 'repair',
    };
    setMonsterMessages((prev) => [...prev, userMsg]);
    const aiMsg = await processUnifiedMonsterChatQuery({
      query: q,
      sourceTab: 'repair',
      literacyLevel,
      ttsEnabled: true,
    });
    setMonsterMessages((prev) => [...prev, aiMsg]);
  };

  const [realPcState, setRealPcState] = useState<RealPcOsInspectionData | null>(null);
  const [loadingRealPc, setLoadingRealPc] = useState(false);
  const [forensicQuery, setForensicQuery] = useState('계약서');
  const [forensicResult, setForensicResult] = useState<RealForensicScanResult | null>(null);
  const [loadingForensic, setLoadingForensic] = useState(false);
  const [buttonGuideStep, setButtonGuideStep] = useState<0 | 3 | 4 | 5 | 6>(5);

  const handleRefreshRealPcState = async () => {
    setLoadingRealPc(true);
    const data = await fetchRealPcOsInspection();
    if (data) setRealPcState(data);
    setLoadingRealPc(false);
  };

  const handleRunForensicScan = async (qOverride?: string) => {
    setLoadingForensic(true);
    const q = qOverride !== undefined ? qOverride : forensicQuery;
    const res = await runRealForensicScan(q);
    if (res) setForensicResult(res);
    setLoadingForensic(false);
  };

  const handleOpenRealFileLocation = async (fullPath: string) => {
    await executeRealOsAction('open_file_search', fullPath);
  };

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      /* ignore */
    }
    loadSetupMonsterState();
    void handleRefreshRealPcState();
    void handleRunForensicScan('계약서');
    const lastTurn = setupChatTurns[setupChatTurns.length - 1];
    if (lastTurn?.role === 'system_repair' && !lastTurn.undone) {
      setButtonGuideStep(6);
    } else if (
      !lastTurn ||
      (lastTurn.role !== 'system_repair' &&
        lastTurn.role !== 'system_undo' &&
        lastTurn.diagnosisPlan?.presetId !== 'pc_work_s_drive')
    ) {
      void answerSetupPreTriage(
        'triage_s_drive_direct',
        '윈도우 탐색기에서 업무 라운지 S: 드라이브 연결이 풀리고 권한 오류가 뜨는데 복합 복구해줘',
        'pc_work_s_drive',
        true
      );
      setButtonGuideStep(5);
    }
  }, [loadSetupMonsterState]);

  useEffect(() => {
    if (setupMonsterPlatform === 'pc') {
      void handleRefreshRealPcState();
    }
  }, [setupAuditLogs.length, setupMonsterPlatform]);

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
              현재 1차 스토어 심사 프리패스를 위해 설정몬스터와 크레딧 잔액이 숨김 상태입니다
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
            🛠️ 설정몬스터 즉시 켜기 (enableSetupMonster=true 테스트)
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
    if (
      /복원\s*기록|없어졌|사라졌|증발|지웠|날아갔|어디\s*갔|바로가기|바탕화면|다운로드|설치\s*파일|apk|exe|msi|보안\s*프로그램|anysign|magicline|touchen|사양|스펙|돌아가|배그|포토샵|독소\s*조항|법률|세금/i.test(
        clean
      )
    ) {
      await triggerMonsterQuery(clean);
      return;
    }
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
    const hasEnoughCoins = true; // [멀린님 확정 A1]: 언제나 0원 무료!

    return (
      <div className="mt-3 p-4 rounded-2xl bg-zinc-950/95 border border-primary-container/40 flex flex-col gap-3">
        {/* 상단 난이도 배지 + 환불 보증 안내 */}
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
                ? '⚡ 자동 해결 가능'
                : '👆 화면 위 화살표 안내'}
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-md bg-pink-500/15 border border-pink-400/40 font-label-sm text-[11px] text-pink-200 font-extrabold">
            🆓 개인 (기본) : 언제나 0원 · 수리 전 상태 자동 백업 & 1초 원상복구 보장
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <h4 className="font-headline-sm text-[16px] !text-white font-extrabold tracking-wide drop-shadow-sm">
            {plan.title}
          </h4>
          <p className="font-body-sm text-[13px] !text-zinc-100 font-medium leading-relaxed">
            {plan.rootCause}
          </p>
        </div>

        {/* 깔끔한 실행 버튼 */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {hasEnoughCoins && (
                <div className="relative inline-flex items-center">
                  <button
                    id="zcore-step2-execute-btn"
                    type="button"
                    onClick={() => {
                      if (buttonGuideStep === 5) setButtonGuideStep(6);
                      void approveAndExecuteSetupPlan(plan, 0);
                    }}
                    className={`px-4 py-2.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-md text-[12.5px] font-extrabold shadow-[0_0_20px_rgba(32,247,219,0.25)] cursor-pointer ${
                      buttonGuideStep === 5 ? 'ring-2 ring-yellow-300' : ''
                    }`}
                  >
                    ⚡ 바로 해결하기 (언제나 0원)
                  </button>
                  {buttonGuideStep === 5 && (
                    <span className="ml-2 text-[28px] leading-none select-none pointer-events-none animate-bounce">
                      👈
                    </span>
                  )}
                </div>
              )}

              {plan.overlaySteps && plan.overlaySteps.length > 0 && (
                <button
                  type="button"
                  onClick={() => openSetupOverlayGuide(plan)}
                  className="px-3.5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-rose-200 font-label-sm text-[12px] font-extrabold cursor-pointer"
                >
                  👆 화면 위 화살표 안내 보기
                </button>
              )}
            </div>
            {turnRefunded || turnUndone ? (
              <span className="font-label-sm text-[11px] text-amber-300 font-bold">
                ↩️ 원래 설정으로 1초 원상복구됨 (0원)
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
            <h2 className="font-headline-sm text-[20px] md:text-[22px] text-zinc-900 dark:text-white font-extrabold tracking-tight flex items-center gap-2">
              <span>🛠️ 귀신같이 설정몬스터</span>
            </h2>
            <span className="text-[12.5px] text-zinc-500 dark:text-zinc-400 font-medium">
              비용 없이 제한 없이 (언제나 0원) PC·스마트폰 해결사 · 언제든 1초 원상복구 보장
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

        {/* 우측: 언제나 0원 배지 + 건강검진 기록함 + 복원 기록 타임머신 */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 font-label-sm text-[11.5px] font-extrabold">
            🆓 개인 (기본) : 언제나 0원
          </span>

          <button
            type="button"
            onClick={() => setShowHealthHistoryDrawer((v) => !v)}
            className="px-3 py-2 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
          >
            📋 내 기기 건강검진 기록함 ({healthHistoryRecords.length})
          </button>

          <button
            type="button"
            onClick={() => void triggerMonsterQuery('최근 [복원 기록] 보여줘')}
            className="px-3 py-2 rounded-xl bg-violet-950/80 hover:bg-violet-900/80 border border-violet-500/40 text-violet-300 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
          >
            🕰️ [복원 기록] 타임머신
          </button>

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
            📋 감사로그 ({setupAuditLogs.length})
          </button>
        </div>
      </div>

      {showHealthHistoryDrawer && (
        <PersonalHealthCheckHistoryDrawer
          records={healthHistoryRecords}
          onClose={() => setShowHealthHistoryDrawer(false)}
          onRollbackRestoreId={(rid) => {
            void executeRestorePointRollback(rid).then((res) => {
              setMonsterMessages((prev) => [
                ...prev,
                {
                  id: `monster_${Date.now()}`,
                  role: 'assistant',
                  timestamp: new Date().toLocaleTimeString('ko-KR'),
                  text: res.message,
                  sourceTab: 'repair',
                },
              ]);
            });
          }}
        />
      )}

      {/* 3. 📱 모바일판 전용: 선제적 맞춤 진단 카드 */}
      {setupMonsterPlatform === 'mobile' && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[12px] text-primary-container font-extrabold">
              🩺 스마트폰 맞춤 추천 설정
            </span>
            <span className="font-body-sm text-[11px] text-zinc-400">
              자주 쓰는 기능과 불편한 점을 먼저 찾아 알려드립니다
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
                        ✓ 해결됨
                      </span>
                    )}
                  </div>
                  <h4 className="font-headline-sm text-[14px] text-white font-bold leading-snug">
                    {hint.title}
                  </h4>
                  <p className="font-body-sm text-[11.5px] text-zinc-400">
                    • {hint.telemetrySource}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    submitSetupMonsterQuery(hint.presetQuery, hint.presetId, 'mobile')
                  }
                  className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-primary-container/40 text-primary-container font-label-sm text-[12px] font-extrabold cursor-pointer"
                >
                  ⚡ 이 문제 바로 해결하기
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. 원클릭 증상 칩 (화면 최상단 고정 · 스크롤/레이아웃 흔들림 0%) */}
      <div className="flex flex-col gap-2">
        <span className="font-label-sm text-[12px] text-zinc-400 font-bold">
          💡 자주 찾는 증상 선택 (무료 상담부터 시작)
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => {
            const isTargetStep2Chip = chip.id === 'pc_work_s_drive';
            const showChipGuide = buttonGuideStep === 3 && isTargetStep2Chip;
            return (
              <div key={chip.id} className="relative inline-flex items-center">
                <button
                  id={isTargetStep2Chip ? 'zcore-step2-chip-sdrive' : undefined}
                  type="button"
                  onClick={() => {
                    if (buttonGuideStep === 3 && isTargetStep2Chip) {
                      setButtonGuideStep(4);
                    }
                    submitSetupMonsterQuery(chip.query, chip.id, chip.platform);
                  }}
                  className={`px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 hover:border-primary-container text-white font-label-sm text-[12.5px] font-bold transition-all cursor-pointer ${
                    showChipGuide ? 'ring-2 ring-yellow-300 border-yellow-300' : ''
                  }`}
                >
                  {chip.label}
                </button>
                {showChipGuide && (
                  <span className="ml-1.5 text-[28px] leading-none select-none pointer-events-none animate-bounce">
                    👈
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. 대화형 수리 창구 (이전 대화 적체 없이 현재 단계 카드 1개만 제자리 즉시 교체) */}
      <div className="p-4 rounded-2xl bg-zinc-950/90 border border-white/10 flex flex-col gap-3">
        {setupChatTurns.slice(-1).map((turn) => {
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
                      🔍 1단계 · 무료 증상 확인 (0 코인)
                    </span>
                  </div>
                  <span className="font-mono text-[10.5px] text-zinc-400">
                    {turn.timestamp}
                  </span>
                </div>

                <p className="font-body-sm text-[12.5px] text-zinc-200 whitespace-pre-line leading-relaxed">
                  {turn.text}
                </p>

                <div className="flex flex-col gap-2 pt-1">
                  <span className="font-label-sm text-[11px] text-amber-300 font-bold">
                    👇 아래 항목 중 해당하는 증상을 선택해 주세요:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
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
                    <div className="relative inline-flex items-center">
                      <button
                        id={!turn.triageAnswered ? 'zcore-step2-triage-skip' : undefined}
                        type="button"
                        onClick={() => {
                          if (buttonGuideStep === 4) setButtonGuideStep(5);
                          void answerSetupPreTriage(
                            q.questionId,
                            q.symptomQuery,
                            q.presetId,
                            true
                          );
                        }}
                        className={`px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-label-sm text-[11.5px] font-bold cursor-pointer ${
                          buttonGuideStep === 4 && !turn.triageAnswered
                            ? 'ring-2 ring-yellow-300 text-white'
                            : ''
                        }`}
                      >
                        ⚡ 바로 해결 방법 보기
                      </button>
                      {buttonGuideStep === 4 && !turn.triageAnswered && (
                        <span className="ml-2 text-[28px] leading-none select-none pointer-events-none animate-bounce">
                          👈
                        </span>
                      )}
                    </div>
                  </div>
                  {turn.triageAnswered && (
                    <span className="font-label-sm text-[11px] text-emerald-300 font-bold">
                      ✓ 증상 확인 완료 — 아래에서 바로 해결하실 수 있습니다.
                    </span>
                  )}
                </div>
              </div>
            );
          }

          if (turn.role === 'system_repair') {
            const cost = turn.diagnosisPlan?.creditCost ?? 100;
            const isSettled = turn.escrowStatus === 'SETTLED_COMPLETED';
            const isEmpathyRefund = turn.escrowStatus === 'RELEASED_EMPATHY_REFUND';
            return (
              <div
                key={turn.id}
                className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-400/50 flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-label-sm text-[11px] font-extrabold">
                      {turn.refunded
                        ? '📝 미해결 신고됨'
                        : isSettled
                        ? '✅ 해결 확인됨 (0원)'
                        : isEmpathyRefund
                        ? '💦 안내 중 헤맴 기록됨 (0원)'
                        : '📋 진단 결과 — 아래 내용을 확인해 주세요'}
                    </span>
                  </div>
                  <span className="font-mono text-[10.5px] text-zinc-400">
                    {turn.timestamp}
                  </span>
                </div>
                <p className="font-body-sm text-[13px] text-white font-bold whitespace-pre-line leading-relaxed">
                  {turn.text}
                </p>

                <div className="p-3 rounded-xl bg-zinc-950/85 border border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-body-sm text-[11.5px] text-zinc-300">
                    귀신같이가 자동으로 바꾼 설정이 있으면 아래 버튼으로 원래대로 되돌릴 수 있습니다.
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {turn.diagnosisPlan?.overlaySteps?.length ? (
                      <button
                        type="button"
                        onClick={() => openSetupOverlayGuide(turn.diagnosisPlan!)}
                        className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-rose-200 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                      >
                        👆 화면 위 화살표 다시 보기
                      </button>
                    ) : null}

                    {!turn.refunded && !isSettled && (
                      <button
                        type="button"
                        onClick={() => confirmSetupEscrowSettlement(turn.auditId)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                      >
                        ✅ 잘 고쳐졌어요
                      </button>
                    )}


                    <div className="relative inline-flex items-center">
                      <button
                        id={!turn.undone ? 'zcore-step2-undo-btn' : undefined}
                        type="button"
                        onClick={() => {
                          if (buttonGuideStep === 6) setButtonGuideStep(0);
                          void undoSetupMonsterRepair(turn.auditId);
                        }}
                        disabled={turn.undone}
                        className={`px-3 py-2 rounded-xl font-label-sm text-[11.5px] font-extrabold cursor-pointer ${
                          turn.undone
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                            : 'bg-amber-400 hover:bg-amber-300 text-zinc-950 shadow'
                        } ${
                          buttonGuideStep === 6 && !turn.undone
                            ? 'ring-2 ring-yellow-300'
                            : ''
                        }`}
                      >
                        {turn.undone ? '✓ 원래대로 복구됨' : '↩️ 원래 설정으로 되돌리기'}
                      </button>
                      {buttonGuideStep === 6 && !turn.undone && (
                        <span className="ml-2 text-[28px] leading-none select-none pointer-events-none animate-bounce">
                          👈
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          if (turn.role === 'system_empathy_refund') {
            const ota = turn.selfHealingOta;
            const refundedCoins = turn.refundedAmount ?? ota?.refundedCoins ?? 100;
            return (
              <div
                key={turn.id}
                className="p-4 rounded-2xl bg-gradient-to-br from-pink-950/55 via-zinc-950 to-emerald-950/35 border-2 border-pink-400/70 flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-pink-500 text-white font-label-sm text-[11px] font-extrabold">
                    💦 길 안내가 헤매게 해 드려 죄송합니다 (0원 · 내 PC 기록만 저장)
                  </span>
                  <span className="font-mono text-[10.5px] text-pink-200">
                    {turn.timestamp}
                  </span>
                </div>
                <p className="font-body-sm text-[13px] text-white whitespace-pre-line leading-relaxed">
                  {turn.text}
                </p>
              </div>
            );
          }

          if (turn.role === 'system_refund') {
            return (
              <div
                key={turn.id}
                className="p-4 rounded-2xl bg-rose-950/40 border-2 border-rose-400/60 flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-rose-500 text-white font-label-sm text-[11px] font-extrabold">
                    📝 미해결 신고 기록됨 (0원)
                  </span>
                  <span className="font-mono text-[10.5px] text-rose-200">
                    {turn.timestamp}
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
                  🛠️ 2단계 · 진단 결과 및 해결 방법
                </span>
                <span className="font-mono text-[10.5px] text-zinc-500">
                  {turn.timestamp}
                </span>
              </div>
              <p className="font-body-sm text-[13px] !text-zinc-100 font-medium whitespace-pre-line leading-relaxed">
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

      {/* 3-B. 💻 PC판 전용: Z-코어 실물 OS 3대 검증 패널 (시뮬레이션 0% · 내 PC 100% 실측 · 노션 스타일 동적 토글) */}
      {setupMonsterPlatform === 'pc' && (
        <div className="rounded-2xl bg-white dark:bg-zinc-950/95 border border-zinc-200 dark:border-emerald-500/35 overflow-hidden transition-all shadow-sm">
          <div
            onClick={() => setShowRealOsPanel((prev) => !prev)}
            className="p-4 flex flex-wrap items-center justify-between gap-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-400 text-[12px] font-mono select-none">
                {showRealOsPanel ? '▾' : '▸'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-zinc-950 font-label-sm text-[11px] font-extrabold">
                🟢 Z-코어 실물 OS 직결됨 (가짜 프리셋 0% · 100% 내 PC 실측)
              </span>
              {realPcState && (
                <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300">
                  {realPcState.osPlatform} · Git Commit #{realPcState.systemGit.latestCommit.commitHash} ({realPcState.elapsedMs}ms)
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleRefreshRealPcState();
                }}
                disabled={loadingRealPc}
                className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:border-white/15 dark:text-zinc-200 font-label-sm text-[11.5px] font-bold cursor-pointer transition-colors"
              >
                {loadingRealPc ? '⏳ 스캔 중...' : '🔄 내 PC 실측 새로고침'}
              </button>
              <span className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 text-zinc-800 dark:bg-zinc-800/90 dark:border-white/20 dark:text-zinc-100 dark:hover:text-white text-[13px] font-extrabold select-none shadow-sm transition-colors">
                {showRealOsPanel ? '접기 ▴' : '펼치기 ▾'}
              </span>
            </div>
          </div>

          {showRealOsPanel && (
            <div className="px-4 pb-4 pt-3 border-t border-white/10 flex flex-col gap-4">
              {/* 실측 요약 카드 3종: 시작프로그램/보안모듈, 프린터/스풀러, 디스크/PC Git Diff */}
              {realPcState && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-zinc-900/90 border border-white/10 flex flex-col gap-1.5">
                    <span className="font-label-sm text-[11px] text-emerald-300 font-extrabold">
                      ① 내 PC 실제 시작프로그램 ({realPcState.startupPrograms.length}개) & 보안모듈 ({realPcState.spoolerAndSecurity.activeSecurityPluginsCount}종)
                    </span>
                    <p className="font-body-sm text-[11.5px] text-zinc-300 leading-snug">
                      • <strong>보안/알림 감지:</strong>{' '}
                      {realPcState.spoolerAndSecurity.activeSecurityPlugins
                        .map((p) => p.label)
                        .join(', ') || '없음'}
                    </p>
                    <p className="font-mono text-[10.5px] text-zinc-400 line-clamp-2">
                      • 레지스트리 Run:{' '}
                      {realPcState.startupPrograms.map((s) => s.name).join(', ')}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900/90 border border-white/10 flex flex-col gap-1.5">
                    <span className="font-label-sm text-[11px] text-amber-300 font-extrabold">
                      ② 내 PC 실제 프린터 ({realPcState.spoolerAndSecurity.installedPrinters.length}대) & 인쇄 스풀러
                    </span>
                    <p className="font-body-sm text-[11.5px] text-zinc-300">
                      • Spooler 상태: <strong>{realPcState.spoolerAndSecurity.spoolerServiceStatus}</strong> (멈춘 인쇄 파일: <strong>{realPcState.spoolerAndSecurity.stuckSpoolQueueFiles}건</strong>)
                    </p>
                    <p className="font-mono text-[10.5px] text-zinc-400 line-clamp-2">
                      • 설치 프린터: {realPcState.spoolerAndSecurity.installedPrinters.join(', ')}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900/90 border border-white/10 flex flex-col gap-1.5">
                    <span className="font-label-sm text-[11px] text-cyan-300 font-extrabold">
                      ③ 내 PC 디스크 실측 & PC Git 타임머신 Diff
                    </span>
                    <p className="font-body-sm text-[11.5px] text-zinc-300">
                      • C: 잔여 <strong>{realPcState.disks.C?.freeGb}GB</strong> (사용률 {realPcState.disks.C?.usedPercent}%) / D: 잔여 <strong>{realPcState.disks.D?.freeGb}GB</strong> / S: {realPcState.disks.S?.mounted ? '🟢 마운트됨' : '⚪ 미연결'}
                    </p>
                    <p className="font-mono text-[10.5px] text-amber-200 line-clamp-2">
                      • Git Diff: {realPcState.systemGit.latestCommit.diffs.join(' | ')}
                    </p>
                  </div>
                </div>
              )}

              {/* 3초 결정론적 오피스/문서 포렌식 + 내부 5줄 실물 증거 미리보기 */}
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/95 border border-zinc-200 dark:border-emerald-500/30 flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-[12px] text-emerald-300 font-extrabold">
                      🕵️‍♂️ [제1·2원칙 실물 검증] 내 PC 5대 은닉 금고 3초 결정론적 포렌식 & 내부 텍스트 5줄 실물 증거
                    </span>
                    <span className="font-body-sm text-[12px] text-zinc-600 dark:text-zinc-300 font-medium">
                      Excel·Word·한글 자동복구 폴더, 문서(Documents), 다운로드, ShadowVault를 실제로 뒤져 파일 내부 5줄을 먼저 보여줍니다.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={forensicQuery}
                      onChange={(e) => setForensicQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleRunForensicScan();
                      }}
                      placeholder="찾을 문서 키워드 (예: 계약서, 정산, 견적)"
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-white/15 text-zinc-900 dark:text-white text-[12px] w-52 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      id="zcore-target-btn-scan"
                      type="button"
                      onClick={() => void handleRunForensicScan()}
                      disabled={loadingForensic}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-label-sm text-[11.5px] font-extrabold cursor-pointer"
                    >
                      {loadingForensic ? '스캔 중...' : '🔍 3초 실물 스캔'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForensicQuery('');
                        void handleRunForensicScan('');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-label-sm text-[11px] font-bold cursor-pointer"
                    >
                      전체 최근 문서
                    </button>
                  </div>
                </div>

                {forensicResult && (
                  <div className="flex flex-col gap-2">
                    <div className="text-[11.5px] text-emerald-200 font-bold">
                      {forensicResult.honestCutoffMessage}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                      {forensicResult.files.slice(0, 6).map((f, idx) => (
                        <div
                          key={`${f.fullPath}_${idx}`}
                          className="p-2.5 rounded-xl bg-zinc-950 border border-white/10 flex flex-col justify-between gap-2"
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-headline-sm text-[12.5px] text-white font-bold truncate">
                                📄 {f.fileName}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {typeof f.folderFileCount === 'number' && f.folderFileCount > 1 && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                                      f.folderFileCount >= 30
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                                        : 'bg-zinc-800 text-zinc-300'
                                    }`}
                                  >
                                    폴더 내 {f.folderFileCount}개 항목
                                  </span>
                                )}
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono text-[10px]">
                                  {f.sizeFormatted} · {f.modifiedAt}
                                </span>
                              </div>
                            </div>
                            <span className="font-mono text-[10px] text-zinc-400 truncate">
                              {f.vaultLabel} ➔ {f.fullPath}
                            </span>
                            <div className="mt-1 p-2 rounded bg-zinc-900 border border-white/5 font-mono text-[10.5px] text-zinc-200 flex flex-col gap-0.5">
                              {f.preview5Lines.slice(0, 5).map((ln, lIdx) => (
                                <div key={lIdx} className="truncate">
                                  {ln}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="relative flex justify-end pt-1">
                            <button
                              id={idx === 0 ? 'zcore-target-btn-open-0' : undefined}
                              type="button"
                              onClick={() => void handleOpenRealFileLocation(f.fullPath)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-label-sm text-[11.5px] font-extrabold shadow cursor-pointer"
                            >
                              🔍 탐색기 검색창에 파일명 넣어 이 파일만 바로 띄우기
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5-B. 치우기 × 고치기 통합 주치의 대화 카드 (사라진 파일 1초 소명, 사이트 바로가기 생성, PC 사양 상담, 복원 기록 등) */}
      {monsterMessages.length > 0 && (
        <div className="p-4 rounded-2xl bg-zinc-950 border border-primary-container/40 space-y-3">
          <div className="flex items-center justify-between text-xs font-extrabold text-primary-container">
            <span>🩺 치우기 × 고치기 통합 주치의 실행 게이트 (Zero-Auto-Action · 언제나 0원)</span>
            <button
              type="button"
              onClick={() => setMonsterMessages([])}
              className="text-[11px] text-zinc-400 hover:text-white"
            >
              대화 접기 ✕
            </button>
          </div>
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {monsterMessages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3.5 rounded-xl border ${
                  msg.role === 'user'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-100 ml-8'
                    : 'bg-zinc-900/95 border-primary-container/40 text-zinc-100'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                  <span className="font-extrabold">
                    {msg.role === 'user' ? '🙋‍♂️ 나의 요청' : '🩺 귀신같이 주치의 (언제나 0원)'}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>
                <p className="text-[13px] leading-relaxed whitespace-pre-line font-semibold">
                  {msg.text}
                </p>
                {msg.role === 'assistant' && (
                  <MonsterInteractiveCardView
                    message={msg}
                    literacyLevel={literacyLevel}
                    onChangeLiteracyLevel={setLiteracyLevel}
                    onUpdateMessage={(updated) =>
                      setMonsterMessages((prev) =>
                        prev.map((m) => (m.id === updated.id ? updated : m))
                      )
                    }
                    onHealthRecordAdded={(rec) =>
                      setHealthHistoryRecords((prev) => [rec, ...prev])
                    }
                    onJumpToSearch={(kw) => {
                      void runTextQuery(kw);
                      if (layout === 'mobile') setMobileTab('search');
                      else setDesktopTab('dashboard');
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. 하단 자연어 멀티턴 입력 바 (타이핑 + 음성 마이크 + 치우기/고치기/사양상담/바로가기/복원기록 통합 인식) */}
      <div className="p-3.5 rounded-2xl bg-zinc-950 border border-primary-container/40 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-extrabold text-amber-400">💡 통합 대화 칩:</span>
          {[
            {
              label: '🔗 자주 가는 사이트 바탕화면 바로가기 만들기',
              q: '내가 자주 가는 네이버 카페 바탕화면에 바로가기 만들어줘',
            },
            {
              label: '💻 내 PC 사양으로 포토샵·배그 돌아가?',
              q: '내 컴퓨터 실시간 사양으로 포토샵이랑 배그 잘 돌아가?',
            },
            {
              label: '🕵️ 사라진 파일 1초 추적·복구',
              q: '어제 바탕화면에 있던 카톡받은_영수증캡처_01.jpg 파일이 사라졌어 찾아줘',
            },
            {
              label: '⚡ 상주 보안모듈(AnySign/TouchEn) 동결',
              q: '은행 관공서 상주 보안 프로그램(AnySign, MagicLine, TouchEn) 동결해서 부팅 속도 높여줘',
            },
            {
              label: '🕰️ [복원 기록] 1초 타임머신',
              q: '최근 [복원 기록] 보여줘',
            },
          ].map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => void triggerMonsterQuery(c.q)}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 text-[11px] font-bold transition cursor-pointer"
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
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
                ? `문진 답변 입력 (예: ${pendingTriageQuestion.options[0]?.label ?? '윈도우 기본에서 먹통이에요'}) 또는 새로운 증상/정리 요청 입력`
                : setupMonsterPlatform === 'pc'
                ? '예: 프린터 먹통 고쳐줘 / 자주 가는 카페 바탕화면 바로가기 만들어줘 / 내 PC로 배그 돌아가? / 원래대로 해줘'
                : '예: 저녁 7~8시엔 카톡 소리 안 나게 해줘 / 다운로드 폴더 설치파일 치워줘 / 원래대로 해줘'
            }
            className="flex-1 px-3 py-2 bg-transparent text-white text-[13px] placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSendQuery}
            className="px-5 py-2.5 rounded-xl bg-primary-container hover:opacity-95 text-zinc-950 font-label-md text-[12.5px] font-extrabold whitespace-nowrap cursor-pointer"
          >
            {pendingTriageQuestion ? '💬 문진 답변 제출 (언제나 0원)' : '🔍 주치의에게 요청하기 (언제나 0원)'}
          </button>
        </div>
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
                아직 수집된 초행길 우회 학습 궤적이 없습니다.
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
                        [{ota.trajectoryGradeBadgeKo}] {ota.title} (언제나 0원)
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

          {/* 7-B. 분쟁 예방 감사 로그 (Audit Log) */}
          <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="font-label-sm text-[11.5px] text-amber-300 font-extrabold">
                  🛡️ 분쟁 예방 감사 로그 (Audit Log 로컬 블랙박스 · poc/results/ghosti_setup_blackbox.json)
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
                        [{log.platform.toUpperCase()} · 언제나 0원 · Back {log.backtrackCount ?? 0}회] {log.title}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10.5px] text-zinc-400">
                          승인: {log.userApprovedAt} · DOM: {log.domCaptureHash}
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
        <div className="flex items-center justify-between mb-2 px-1">
          <GhostiBrandLogo size="desktop" themeMode="dark" showBadge={true} />
          <button
            type="button"
            onClick={() => setShowSetupMonsterModal(false)}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-white font-label-sm text-[12px] font-bold cursor-pointer"
          >
            ✕ 설정몬스터 창 닫기
          </button>
        </div>
        <SetupMonsterContent />
      </div>
    </div>
  );
};
