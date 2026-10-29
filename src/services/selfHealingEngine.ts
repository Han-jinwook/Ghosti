import type {
  SetupDiagnosisPlan,
  SetupSelfHealingOtaEntry,
  SetupTrajectoryGrade,
} from '../types/saysee';

export interface SelfHealingEvaluationResult {
  trajectoryGrade: SetupTrajectoryGrade;
  trajectoryGradeBadgeKo: string;
  shouldNormalSettle100Pct: boolean;
  shouldEmpathyRefund100Pct: boolean;
  empathyApologyToastKo: string;
  empathyBriefingChatKo: string;
  fineTuneNoticeKo: string;
  otaEntry: SetupSelfHealingOtaEntry;
}

/**
 * [🛠️ 설정몬스터 길 안내 기록 엔진]
 * 화살표 길 안내 중 '뒤로 가기' 횟수를 등급으로 기록합니다.
 *
 * [정직 원칙 — AGENTS.md 수칙 3]
 * - 모든 [내 기기] 고치기는 0원이므로 '코인 환불·에스크로 정산'은 발생하지 않습니다. 그런 문구를 표시하지 않습니다.
 * - 이 기록은 내 PC의 Z-코어 로컬 기록(setup_monster_blackbox.json)에만 남습니다.
 *   본사 전송·전 세계 배포·AI 자동 학습은 현재 구현되어 있지 않으므로 그렇게 말하지 않습니다.
 * - 필드 이름(otaEntry, escrowSettlementKo 등)은 기존 기록 형식 호환을 위해 유지합니다.
 */
export function evaluateTrajectoryAndBuildSelfHealingOta(params: {
  plan: SetupDiagnosisPlan;
  auditId: string;
  backtrackCount: number;
  abortedAsFailure?: boolean;
}): SelfHealingEvaluationResult {
  const { plan, auditId, backtrackCount, abortedAsFailure } = params;
  const nowIso = new Date().toISOString();
  const otaId = `ota_${Date.now()}`;
  const FREE_NOTE = '0원 (내 기기 고치기는 항상 무료)';
  const LOCAL_LOG_NOTE = '내 PC 로컬 기록에만 저장 (외부 전송·자동 배포 없음)';

  if (abortedAsFailure) {
    const otaEntry: SetupSelfHealingOtaEntry = {
      otaId,
      auditId,
      createdAt: nowIso,
      platform: plan.platform,
      presetId: plan.presetId,
      title: plan.title,
      backtrackCount,
      trajectoryGrade: 'GRADE_FAIL_ABORTED',
      trajectoryGradeBadgeKo: '🔴 해결하지 못함 (중단)',
      escrowSettlementKo: FREE_NOTE,
      multiLlmActionKo: `실패 기록 저장 — ${LOCAL_LOG_NOTE}`,
      rawTrajectorySteps: [`[시작] ${plan.title}`, '[중단] 해결하지 못했다는 유저 신고'],
      prunedShortestPathSteps: [],
      otaBroadcastStatus: 'LOCAL_LOG_ONLY',
      refundedCoins: 0,
    };
    return {
      trajectoryGrade: 'GRADE_FAIL_ABORTED',
      trajectoryGradeBadgeKo: otaEntry.trajectoryGradeBadgeKo,
      shouldNormalSettle100Pct: false,
      shouldEmpathyRefund100Pct: false,
      empathyApologyToastKo: '',
      empathyBriefingChatKo: '',
      fineTuneNoticeKo: '',
      otaEntry,
    };
  }

  if (backtrackCount <= 0) {
    const otaEntry: SetupSelfHealingOtaEntry = {
      otaId,
      auditId,
      createdAt: nowIso,
      platform: plan.platform,
      presetId: plan.presetId,
      title: plan.title,
      backtrackCount: 0,
      trajectoryGrade: 'GRADE_0_EXPRESS',
      trajectoryGradeBadgeKo: '🟢 한 번에 완료 (뒤로 가기 0회)',
      escrowSettlementKo: FREE_NOTE,
      multiLlmActionKo: `길 안내 기록 — ${LOCAL_LOG_NOTE}`,
      rawTrajectorySteps: [`[완료] ${plan.title} · 뒤로 가기 0회`],
      prunedShortestPathSteps: [],
      otaBroadcastStatus: 'LOCAL_LOG_ONLY',
      refundedCoins: 0,
    };
    return {
      trajectoryGrade: 'GRADE_0_EXPRESS',
      trajectoryGradeBadgeKo: otaEntry.trajectoryGradeBadgeKo,
      shouldNormalSettle100Pct: true,
      shouldEmpathyRefund100Pct: false,
      empathyApologyToastKo: '',
      empathyBriefingChatKo: '',
      fineTuneNoticeKo: '🟢 안내대로 한 번에 마치셨습니다.',
      otaEntry,
    };
  }

  if (backtrackCount === 1) {
    const otaEntry: SetupSelfHealingOtaEntry = {
      otaId,
      auditId,
      createdAt: nowIso,
      platform: plan.platform,
      presetId: plan.presetId,
      title: plan.title,
      backtrackCount: 1,
      trajectoryGrade: 'GRADE_1_TOLERATED',
      trajectoryGradeBadgeKo: '🟡 뒤로 가기 1회 후 완료',
      escrowSettlementKo: FREE_NOTE,
      multiLlmActionKo: `헤맨 단계 기록 — ${LOCAL_LOG_NOTE}`,
      rawTrajectorySteps: [`[시작] ${plan.title}`, '[뒤로 가기 1회]', '[완료]'],
      prunedShortestPathSteps: [],
      otaBroadcastStatus: 'LOCAL_LOG_ONLY',
      refundedCoins: 0,
    };
    return {
      trajectoryGrade: 'GRADE_1_TOLERATED',
      trajectoryGradeBadgeKo: otaEntry.trajectoryGradeBadgeKo,
      shouldNormalSettle100Pct: true,
      shouldEmpathyRefund100Pct: false,
      empathyApologyToastKo: '',
      empathyBriefingChatKo: '',
      fineTuneNoticeKo: '🟡 한 번 뒤로 가셨지만 마치셨습니다. 헤맨 단계는 내 PC 기록에 남겨 두었습니다.',
      otaEntry,
    };
  }

  const otaEntry: SetupSelfHealingOtaEntry = {
    otaId,
    auditId,
    createdAt: nowIso,
    platform: plan.platform,
    presetId: plan.presetId,
    title: plan.title,
    backtrackCount,
    trajectoryGrade: 'GRADE_2_EMPATHY_REFUND',
    trajectoryGradeBadgeKo: `💦 뒤로 가기 ${backtrackCount}회 — 안내가 헤매게 해 드렸습니다`,
    escrowSettlementKo: FREE_NOTE,
    multiLlmActionKo: `헤맨 단계 기록 — ${LOCAL_LOG_NOTE} (안내 개선 시 참고)`,
    rawTrajectorySteps: [`[시작] ${plan.title}`, `[뒤로 가기 ${backtrackCount}회]`, '[완료]'],
    prunedShortestPathSteps: [],
    otaBroadcastStatus: 'LOCAL_LOG_ONLY',
    refundedCoins: 0,
  };

  const empathyApologyToastKo = `죄송합니다. 화살표 안내가 ${backtrackCount}번이나 헤매게 해 드렸습니다. 헤맨 단계는 내 PC 기록에 남겨 안내 개선에 참고하겠습니다. (고치기는 항상 0원이라 별도 비용은 없습니다)`;
  const empathyBriefingChatKo = `[${plan.title}] 안내를 마쳤습니다.\n화면이 바뀌어 화살표 안내가 ${backtrackCount}번 헤매게 해 드려 죄송합니다. 헤맨 단계는 내 PC 로컬 기록에만 남겼습니다(외부 전송 없음).`;

  return {
    trajectoryGrade: 'GRADE_2_EMPATHY_REFUND',
    trajectoryGradeBadgeKo: otaEntry.trajectoryGradeBadgeKo,
    shouldNormalSettle100Pct: false,
    shouldEmpathyRefund100Pct: true,
    empathyApologyToastKo,
    empathyBriefingChatKo,
    fineTuneNoticeKo: '',
    otaEntry,
  };
}
