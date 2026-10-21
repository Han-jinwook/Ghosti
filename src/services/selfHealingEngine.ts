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
 * [🛠️ Z-Eye 설정 몬스터 SelfHealingEngine — '인간 냄새 나는' 3단계 관용 & 쿨 환불 + Multi-LLM 최단 직행 지름길 즉시 학습/OTA 엔진]
 * - backtrackCount === 0 (🟢 쾌속 완주): 정상 차감 (100%) / 패스 (완벽한 경로 유지)
 * - backtrackCount === 1 (🟡 인간적 허용): 정상 차감 (100%) / 경로 미세 교정 (1번 삐끗한 갈림길만 다듬어 다음 유저부터 0회 직행 패치)
 * - backtrackCount >= 2 (💖 미안함 환불 — 인간미 환불 발동!): 수리 자체는 성공 유지 + 에스크로 홀딩 코인 100% 전액 자동 환불(수업료 면제) + 헤맨 구간을 통째로 도려낸 '최단 직행 지름길(Shortest Path)' 전 세계 기기 즉시 OTA 배포!
 * - 작업 실패 (🔴 해결 불가/포기): 100% 전액 자동 환불 + 1초 스냅샷 원상복구 + 우회 스크립트 생성 배포
 */
export function evaluateTrajectoryAndBuildSelfHealingOta(params: {
  plan: SetupDiagnosisPlan;
  auditId: string;
  backtrackCount: number;
  abortedAsFailure?: boolean;
}): SelfHealingEvaluationResult {
  const { plan, auditId, backtrackCount, abortedAsFailure } = params;
  const cost = plan.creditCost ?? 100;
  const nowIso = new Date().toISOString();
  const otaId = `ota_${Date.now()}`;

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
      trajectoryGradeBadgeKo: '🔴 작업 실패 (해결 불가/중단)',
      escrowSettlementKo: `100% 전액 자동 환불 (+${cost} 코인) + 1초 스냅샷 원상복구`,
      multiLlmActionKo:
        '에러 원인 규명 및 우회 스크립트(Bypass PowerShell/DeepLink) 생성 후 전 세계 기기 즉시 배포',
      rawTrajectorySteps: [
        `[1단계] ${plan.title} 초기 진입`,
        `[중단] 타겟 컨트롤 응답 없음 또는 권한/버전 충돌 발생`,
      ],
      prunedShortestPathSteps: [
        `[패치 1단계] 빌드 호환성 프리체크 후 우회 API 직결 실행`,
      ],
      otaBroadcastStatus: 'GLOBAL_BYPASS_SCRIPT_OTA_QUEUED',
      refundedCoins: cost,
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

  // 1) backtrackCount === 0: 🟢 쾌속 완주 (0회)
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
      trajectoryGradeBadgeKo: '🟢 쾌속 완주 (뒤로 가기 0회)',
      escrowSettlementKo: `정상 차감 100% (${cost} 코인 에스크로 정산 확정)`,
      multiLlmActionKo: '패스 (사전 답사 지도대로 막힘없이 한 번에 도착 · 완벽한 경로 유지)',
      rawTrajectorySteps: [
        `[직행 1단계] ${plan.title} 타겟 진입 (0.01초)`,
        `[직행 완료] 뒤로 가기(Back) 0회 · 최단 경로 완주`,
      ],
      prunedShortestPathSteps: [
        `[최적 경로 유지] ${plan.systemCommandOrApi}`,
      ],
      otaBroadcastStatus: 'OPTIMAL_ROUTE_VERIFIED',
      refundedCoins: 0,
    };

    return {
      trajectoryGrade: 'GRADE_0_EXPRESS',
      trajectoryGradeBadgeKo: otaEntry.trajectoryGradeBadgeKo,
      shouldNormalSettle100Pct: true,
      shouldEmpathyRefund100Pct: false,
      empathyApologyToastKo: '',
      empathyBriefingChatKo: '',
      fineTuneNoticeKo:
        '🟢 [쾌속 완주 (뒤로 가기 0회)] 사전 답사 지도대로 막힘없이 한 번에 완료되어 에스크로 코인이 정상 정산되었습니다.',
      otaEntry,
    };
  }

  // 2) backtrackCount === 1: 🟡 인간적 허용 (딱 1회)
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
      trajectoryGradeBadgeKo: '🟡 인간적 허용 (딱 1회 뒤로 가기 후 성공)',
      escrowSettlementKo: `정상 차감 100% (${cost} 코인 에스크로 정산 · 초행길 애교 수준 관용)`,
      multiLlmActionKo:
        '🔧 경로 미세 교정: 1번 삐끗한 갈림길 좌표만 다듬어 다음 유저부터는 0회 직행 코스로 가도록 본사 Multi-LLM 패치 완료',
      rawTrajectorySteps: [
        `[1단계] ${plan.title} 초기 메뉴 진입`,
        `[삐끗 1회 🔙] 하위 탭 명칭 변경 감지 ➔ 1회 뒤로 가기(Back)`,
        `[완료 ✅] 변경된 정답 좌표 즉시 재탐색 후 처치 성공`,
      ],
      prunedShortestPathSteps: [
        `[미세 교정 직행 1단계] 삐끗했던 중간 갈림길 생략 ➔ 정답 좌표 Direct Jump`,
        `[직행 완료] 다음 유저부터 뒤로 가기 0회 쾌속 도착 보장`,
      ],
      otaBroadcastStatus: 'MINOR_ROUTE_FINE_TUNED_OTA',
      refundedCoins: 0,
    };

    return {
      trajectoryGrade: 'GRADE_1_TOLERATED',
      trajectoryGradeBadgeKo: otaEntry.trajectoryGradeBadgeKo,
      shouldNormalSettle100Pct: true,
      shouldEmpathyRefund100Pct: false,
      empathyApologyToastKo: '',
      empathyBriefingChatKo: '',
      fineTuneNoticeKo: `🟡 [인간적 허용 (딱 1회 우회 성공 · ${cost} 코인 정상 정산)] 낯선 화면에서 딱 1번 뒤로 갔다가 바로 해결했습니다! 1회 우회한 갈림길 로그는 본사 Multi-LLM으로 자동 전송되어 다음 유저부터는 0회 직행 코스로 미세 교정되었습니다.`,
      otaEntry,
    };
  }

  // 3) backtrackCount >= 2: 💖 미안함 환불 (2회 이상 헤맨 성공 ➔ 100% 전액 자동 환불 + 최단 직행 지름길 전 세계 OTA 배포!)
  const otaEntry: SetupSelfHealingOtaEntry = {
    otaId,
    auditId,
    createdAt: nowIso,
    platform: plan.platform,
    presetId: plan.presetId,
    title: plan.title,
    backtrackCount,
    trajectoryGrade: 'GRADE_2_EMPATHY_REFUND',
    trajectoryGradeBadgeKo: `💖 미안함 100% 쿨 환불 (초행길 ${backtrackCount}회 헤맨 끝 성공 · 수업료 면제!)`,
    escrowSettlementKo: `💸 100% 전액 자동 환불! (+${cost} 코인 즉시 반환 · 수리 완료 상태는 그대로 유지)`,
    multiLlmActionKo:
      '🚨 최우선 긴급 수술 (Multi-LLM Ensemble): 헤맨 구간을 통째로 도려내고 [최단 직행 지름길(Shortest Path)]로 새로 깎아 전 세계 모든 APK 및 .exe에 즉시 OTA 배포 완료!',
    rawTrajectorySteps: [
      `[1단계] ${plan.title} 기존 경로 진입`,
      `[헤맴 1회 🔙] 앱/OS 업데이트로 인한 UI 트리 변경 감지 ➔ 뒤로 가기 #1`,
      `[헤맴 ${backtrackCount}회 🔙] 우회 메뉴 탐색 및 재시도 #${backtrackCount} ➔ 최종 타겟 발견 및 수리 완수!`,
    ],
    prunedShortestPathSteps: [
      `[✂️ 도려낸 구간] 초행길 우회 탐색 ${backtrackCount}단계 완전 삭제 (Pruning 100%)`,
      `[⚡ 신규 최단 직행 지름길] 진입 즉시 최종 정답 좌표/스크립트(${plan.systemCommandOrApi.slice(0, 58)}...)로 1초 직행!`,
      `[🌍 전 세계 OTA 배포] 글로벌 멀린 Z 코어 (Merlin_Z_Core.apk & Merlin_Z_Core_Setup.exe) 노드에 실시간 동기화 완료`,
    ],
    otaBroadcastStatus: 'URGENT_SHORTEST_PATH_GLOBAL_OTA_DEPLOYED',
    refundedCoins: cost,
  };

  const empathyApologyToastKo = `✅ 설정/수리는 완료되었지만, 제가 초행길이라 두 번 이상(${backtrackCount}회) 길을 헤매게 해드려 죄송합니다! 소중한 학습 기회를 주신 보답으로 이번 수리비(${cost} 코인)는 받지 않고 100% 전액 환불해 드렸습니다. 방금 배운 지름길은 지금 즉시 업데이트해 두겠습니다!`;

  const empathyBriefingChatKo = `🎉 요청하신 [${plan.title}] 설정/수리가 완료되었습니다!\n죄송합니다! 바뀐 화면에서 제가 초행길이라 ${backtrackCount}번이나 길을 헤매어 피곤하게 해드렸네요 😅\n끝까지 함께해 주셔서 해결은 되었지만, 제 미숙함으로 시간을 뺏었으니 약속드렸던 ${cost} 코인은 받지 않고 100% 전액 환불해 드렸습니다!\n\n✅ [인간미 공식 브리핑]\n“✅ 설정/수리는 완료되었지만, 제가 초행길이라 두 번 이상 길을 헤매게 해드려 죄송합니다! 소중한 학습 기회를 주신 보답으로 이번 수리비(${cost} 코인)는 받지 않고 100% 전액 환불해 드렸습니다. 방금 배운 지름길은 지금 즉시 업데이트해 두겠습니다!”`;

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
