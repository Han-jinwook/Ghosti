/**
 * ❖ 귀신비서(1귀신) '제미니 에이전트 자유 문답 + 다중 취사선택 PC 정리' 전용 엔진
 * - 2026-11-24 Ghosti × MerlinHub 최종 합의 5대 기둥 완벽 구현:
 *   1) Read-Only 조회 도구(disk_hog_scan, security_2tier_scan, desktop_detail_scan, installed_apps_list) 1턴 병렬 즉시 실행
 *   2) 직전 스캔 원장(lastCareScanContext)을 60개·5개 압축 키({no, id, name, cat, mb})로 경량 직렬화해 Gemini 2.5 Flash에 주입
 *   3) 멀티턴 취사선택·제외 필터("예스파일·오캠 빼고 다 지워", "4번이랑 카톡은 놔두고 정리해")를 파싱해
 *      [🟢 보존 확정(제외) vs 🔴 실행 대상 N건 (휴지통 안전 보관)] 체크박스 요약 카드 1회 확인 후 배치 실행
 *   4) 휴지통 비우기 전/후 용량 병기 UX + D: 드라이브 1초 안전 이사 + WD 시스템 아이콘 안전 숨김 + 데스크톱 배터리 가드
 */

import { getZCoreUrl } from './zCoreBridge';

export type AgentCareReadTool =
  | 'disk_hog_scan'
  | 'security_2tier_scan'
  | 'desktop_detail_scan'
  | 'installed_apps_list'
  | 'hidden_rats_scan';

export type AgentCareMutatingAction =
  | 'disk_hog_clean'
  | 'batch_deep_uninstall'
  | 'desktop_batch_action'
  | 'security_2tier_apply'
  | 'desktop_system_icon_toggle'
  | 'desktop_power_boost'
  | 'hidden_rats_apply';

export type CareNormalizedBucketId = 'SPEED' | 'SECURITY' | 'STORAGE' | 'DESKTOP';

export type CareSubFocus =
  | 'UNUSED_APPS'
  | 'DISK_SPACE'
  | 'ADWARE_SECURITY'
  | 'SPEED_SLOW'
  | 'DESKTOP_CLEAN'
  | 'PHOTO_CLEANUP'
  | 'FULL_CHECKUP';

export const ALL_FOUR_PLUS_ONE_READ_TOOLS: AgentCareReadTool[] = [
  'disk_hog_scan',
  'security_2tier_scan',
  'hidden_rats_scan',
  'installed_apps_list',
  'desktop_detail_scan',
];

export interface CareFourBucketSummary {
  bucketId: CareNormalizedBucketId;
  stepNo: string;
  titleKo: string;
  subtitleKo: string;
  statusTone: 'GOOD' | 'WARN' | 'ALERT';
  statusBadgeKo: string;
  headlineMetricKo: string;
  itemCount: number;
  selectedCount?: number;
  reclaimableMb?: number;
}

export interface AgentCareScanItem {
  no: number;
  id: string;
  name: string;
  cat: string;
  bucketId?: CareNormalizedBucketId;
  sizeMb: number;
  detailKo?: string;
  /** 초보자 눈높이 1줄 설명 ("이게 뭐 하는 프로그램인지 / 지워도 안전한지") */
  plainExplainKo?: string;
  /** 설치 앱 전용 3대 안심 힌트: ① 용도 / ② 마지막 사용 시점 */
  plainRoleKo?: string;
  lastUsedLabelKo?: string;
  lastUsedStatus?: string;
  /** 안전도 배지 ('DANGER_DELETE' | 'SAFE_DELETE' | 'SAFE_CLEAN' | 'SLEEP_RECOMMEND' | 'USER_CHECK') */
  safetyBadge?: 'DANGER_DELETE' | 'SAFE_DELETE' | 'SAFE_CLEAN' | 'SLEEP_RECOMMEND' | 'USER_CHECK';
  safetyBadgeLabel?: string;
  path?: string;
  actionType?: string;
  ratKind?: 'SCHEDULED_TASK' | 'WINDOWS_SERVICE' | 'STARTUP_ITEM' | 'HIGH_MEM_PROCESS';
  targetKey?: string;
  executePath?: string;
  arguments?: string;
  publisher?: string;
  movableToOtherDrive?: boolean;
  defaultSelected?: boolean;
  isProtected?: boolean;
}

export interface AgentCareScanContext {
  updatedAt: number;
  scanKind: 'DISK_HOG' | 'SECURITY_2TIER' | 'DESKTOP_DETAIL' | 'INSTALLED_APPS' | 'HIDDEN_RATS' | 'MULTI';
  cDriveFreeGb?: number;
  cDriveTotalGb?: number;
  cDriveUsedPct?: number;
  availableMoveDrives?: Array<{ drive: string; freeGb: number }>;
  isDesktop?: boolean;
  powerPlanName?: string;
  isHighPerformance?: boolean;
  visibleSystemIcons?: Array<{ iconId: string; label: string; safeExplanationKo: string }>;
  items: AgentCareScanItem[];
}

export interface MonsterAgentCareCardPayload {
  mode: 'SCAN_REPORT' | 'CONFIRM_BATCH';
  title: string;
  badgeText: string;
  summaryLines: string[];
  /** 『PC 손보기 4+1 정규 카테고리』 상단 4칸 동적 요약표 데이터 */
  fourBucketSummaries?: CareFourBucketSummary[];
  defaultActiveBucket?: CareNormalizedBucketId;
  liveCpuPct?: number | null;
  liveRamPct?: number | null;
  photoCleanupCandidateCount?: number;
  action: AgentCareMutatingAction;
  items: AgentCareScanItem[];
  selectedIds: string[];
  excludedNames: string[];
  moveDestinationDrive?: string;
  availableMoveDrives?: Array<{ drive: string; freeGb: number }>;
  visibleSystemIcons?: Array<{ iconId: string; label: string; safeExplanationKo: string }>;
  currentFreeGb?: number;
  projectedFreeAfterEmptyGb?: number;
  isDesktop?: boolean;
  isHighPerformance?: boolean;
  executed?: boolean;
  executionReportKo?: string;
  approvedTypedText?: string;
}

export interface AgentCareLlmPlan {
  replyKo: string;
  readTools: AgentCareReadTool[];
  mutatingPlan?: {
    action: AgentCareMutatingAction;
    includeIds: string[];
    excludeIds: string[];
    excludeKeywords?: string[];
    moveDestinationDrive?: string;
    hideSystemIconIds?: string[];
    reasonSummaryKo?: string;
  } | null;
  followUpSuggestions: string[];
}

/**
 * 🏆 『PC 손보기 4 + 1 정규 카테고리』 분류기 (SSOT)
 * - ① SPEED    : ⚡ 속도 높이기 (메모리·CPU·부팅 자동실행·서비스 수동전환·고성능 전원)
 * - ② SECURITY : 🛡️ 광고·보안앱 정리 (애드웨어·스파이웨어·그리드·은행보안 잠재우기)
 * - ③ STORAGE  : 💾 용량 늘리기 (안전 캐시·최대절전·잊고 있던 미사용 앱·D: 이사)
 * - ④ DESKTOP  : 🗂️ 바탕화면·사진 정돈 (바탕화면 파일/폴더·특수 아이콘 숨김)
 */
export function classifyCareItemBucket(item: AgentCareScanItem): CareNormalizedBucketId {
  if (item.bucketId) return item.bucketId;
  const cat = String(item.cat || '').toUpperCase();
  if (cat.startsWith('DESKTOP_')) return 'DESKTOP';
  if (
    cat === 'SAFE_CACHE' ||
    cat === 'DESKTOP_HIBERFIL' ||
    cat === 'USER_FOLDER' ||
    cat === 'APP_DATA_HOG' ||
    cat === 'USER_LARGE_ITEM' ||
    cat === 'INSTALLED_APP' ||
    cat === 'PROTECTED_APP'
  ) {
    return 'STORAGE';
  }
  if (
    cat === 'PUP_ADWARE' ||
    cat === 'ACTIVE_BANK_SECURITY' ||
    item.actionType === 'SECURITY_SLEEP' ||
    item.actionType === 'PUP_ERADICATE'
  ) {
    return 'SECURITY';
  }
  if (item.ratKind) {
    // 위험/광고 스케줄러는 ② 광고·보안앱으로, 일반 상주 서비스/부팅 자동실행/고메모리 앱은 ① 속도 높이기로 분류
    if (item.safetyBadge === 'DANGER_DELETE' || item.safetyBadge === 'SAFE_DELETE') {
      return 'SECURITY';
    }
    return 'SPEED';
  }
  if (cat === 'POWER_PLAN') return 'SPEED';
  return 'STORAGE';
}

export function buildCareFourBucketSummaries(params: {
  items: AgentCareScanItem[];
  selectedIds: string[];
  cDriveFreeGb?: number;
  cDriveUsedPct?: number;
  isDesktop?: boolean;
  isHighPerformance?: boolean;
  liveCpuPct?: number | null;
  liveRamPct?: number | null;
  photoCleanupCandidateCount?: number;
  visibleSystemIconsCount?: number;
  preferredBucket?: CareNormalizedBucketId;
}): {
  summaries: CareFourBucketSummary[];
  defaultActiveBucket: CareNormalizedBucketId;
} {
  const {
    items,
    selectedIds,
    cDriveFreeGb,
    cDriveUsedPct,
    isDesktop,
    isHighPerformance,
    liveCpuPct,
    liveRamPct,
    photoCleanupCandidateCount = 0,
    visibleSystemIconsCount = 0,
    preferredBucket,
  } = params;
  const selSet = new Set(selectedIds);
  const byBucket: Record<CareNormalizedBucketId, AgentCareScanItem[]> = {
    SPEED: [],
    SECURITY: [],
    STORAGE: [],
    DESKTOP: [],
  };
  for (const it of items) {
    const b = classifyCareItemBucket(it);
    it.bucketId = b;
    byBucket[b].push(it);
  }

  // ① 속도 높이기
  const speedList = byBucket.SPEED.filter((i) => !i.isProtected);
  const speedPowerNeed = Boolean(isDesktop && isHighPerformance === false);
  const ramWarn = typeof liveRamPct === 'number' && liveRamPct >= 75;
  const speedTone: CareFourBucketSummary['statusTone'] =
    ramWarn || speedList.length >= 6 ? 'ALERT' : speedList.length > 0 || speedPowerNeed ? 'WARN' : 'GOOD';
  const speedBadge =
    speedTone === 'ALERT'
      ? `🔴 점검 권장`
      : speedTone === 'WARN'
      ? `🟡 ${speedList.length + (speedPowerNeed ? 1 : 0)}건 개선 가능`
      : '🟢 쾌적';
  const speedHeadlineParts: string[] = [];
  if (typeof liveRamPct === 'number') speedHeadlineParts.push(`메모리 ${liveRamPct}%`);
  else if (typeof liveCpuPct === 'number') speedHeadlineParts.push(`CPU ${liveCpuPct}%`);
  if (speedList.length > 0) speedHeadlineParts.push(`자동실행·상주 ${speedList.length}건`);
  else if (speedPowerNeed) speedHeadlineParts.push('고성능 전원 전환 가능');
  else speedHeadlineParts.push('백그라운드 양호');

  // ② 광고·보안앱 정리
  const secList = byBucket.SECURITY.filter((i) => !i.isProtected);
  const dangerCount = secList.filter(
    (i) => i.safetyBadge === 'DANGER_DELETE' || i.safetyBadge === 'SAFE_DELETE'
  ).length;
  const sleepCount = secList.filter((i) => i.safetyBadge === 'SLEEP_RECOMMEND').length;
  const secTone: CareFourBucketSummary['statusTone'] =
    dangerCount > 0 ? 'ALERT' : sleepCount > 0 || secList.length > 0 ? 'WARN' : 'GOOD';
  const secBadge =
    dangerCount > 0
      ? `🔴 광고·위험 ${dangerCount}건`
      : sleepCount > 0
      ? `🟡 보안앱 ${sleepCount}건 수면`
      : '🟢 깨끗함';
  const secHeadline =
    dangerCount > 0 && sleepCount > 0
      ? `광고앱 ${dangerCount}건 · 은행보안 ${sleepCount}건`
      : dangerCount > 0
      ? `몰래 깔린 광고·불필요 앱 ${dangerCount}건`
      : sleepCount > 0
      ? `은행·관공서 보안앱 ${sleepCount}건 잠재우기`
      : '몰래 깔린 광고앱 없음';

  // ③ 용량 늘리기 (저장공간 + 잊고 있던 앱)
  const storList = byBucket.STORAGE.filter((i) => !i.isProtected);
  const storReclaimMb = Math.round(
    storList
      .filter((i) => i.cat === 'SAFE_CACHE' || i.cat === 'DESKTOP_HIBERFIL' || selSet.has(i.id))
      .reduce((acc, i) => acc + (i.sizeMb || 0), 0)
  );
  const staleAppCount = storList.filter(
    (i) =>
      i.cat === 'INSTALLED_APP' &&
      (i.lastUsedStatus === 'DORMANT' ||
        i.lastUsedStatus === 'STALE' ||
        i.lastUsedStatus === 'UNUSED_SINCE_INSTALL')
  ).length;
  const lowDisk = (typeof cDriveFreeGb === 'number' && cDriveFreeGb < 25) || (typeof cDriveUsedPct === 'number' && cDriveUsedPct >= 85);
  const storTone: CareFourBucketSummary['statusTone'] =
    lowDisk ? 'ALERT' : storReclaimMb >= 512 || staleAppCount > 0 || storList.length > 0 ? 'WARN' : 'GOOD';
  const storBadge = lowDisk
    ? `🔴 여유 ${cDriveFreeGb ?? '?'}GB`
    : storReclaimMb >= 1024
    ? `🟡 +${(storReclaimMb / 1024).toFixed(1)}GB 가능`
    : staleAppCount > 0
    ? `🟡 묵은 앱 ${staleAppCount}개`
    : storList.length > 0
    ? `🟡 ${storList.length}건 확인`
    : '🟢 여유 충분';
  const storHeadlineParts: string[] = [];
  if (typeof cDriveFreeGb === 'number') storHeadlineParts.push(`C: 여유 ${cDriveFreeGb}GB`);
  if (storReclaimMb >= 100) {
    storHeadlineParts.push(
      `즉시 +${storReclaimMb >= 1024 ? `${(storReclaimMb / 1024).toFixed(1)}GB` : `${storReclaimMb}MB`}`
    );
  }
  if (staleAppCount > 0) storHeadlineParts.push(`안 쓰는 앱 ${staleAppCount}개`);
  if (storHeadlineParts.length === 0) storHeadlineParts.push(`점검 항목 ${storList.length}건`);

  // ④ 바탕화면·사진 정돈
  const deskList = byBucket.DESKTOP.filter((i) => !i.isProtected);
  const deskTotalCount = deskList.length + visibleSystemIconsCount;
  const deskTone: CareFourBucketSummary['statusTone'] =
    deskList.length >= 15 ? 'WARN' : deskTotalCount > 0 || photoCleanupCandidateCount > 0 ? 'WARN' : 'GOOD';
  const deskBadge =
    deskList.length > 0
      ? `🟡 바탕화면 ${deskList.length}개`
      : photoCleanupCandidateCount > 0
      ? `🟡 사진 ${photoCleanupCandidateCount}장`
      : '🟢 정돈됨';
  const deskHeadlineParts: string[] = [];
  if (deskList.length > 0) deskHeadlineParts.push(`바탕화면 ${deskList.length}개`);
  if (photoCleanupCandidateCount > 0) deskHeadlineParts.push(`정리 후보 사진 ${photoCleanupCandidateCount}장`);
  if (deskHeadlineParts.length === 0) deskHeadlineParts.push('바탕화면 깔끔함');

  const summaries: CareFourBucketSummary[] = [
    {
      bucketId: 'SPEED',
      stepNo: '①',
      titleKo: '⚡ 속도 높이기',
      subtitleKo: '메모리 · CPU · 부팅 자동실행',
      statusTone: speedTone,
      statusBadgeKo: speedBadge,
      headlineMetricKo: speedHeadlineParts.join(' · '),
      itemCount: byBucket.SPEED.length,
      selectedCount: byBucket.SPEED.filter((i) => selSet.has(i.id) && !i.isProtected).length,
    },
    {
      bucketId: 'SECURITY',
      stepNo: '②',
      titleKo: '🛡️ 광고 · 보안앱',
      subtitleKo: '애드웨어 · 은행보안 · 순정백신',
      statusTone: secTone,
      statusBadgeKo: secBadge,
      headlineMetricKo: secHeadline,
      itemCount: byBucket.SECURITY.length,
      selectedCount: byBucket.SECURITY.filter((i) => selSet.has(i.id) && !i.isProtected).length,
    },
    {
      bucketId: 'STORAGE',
      stepNo: '③',
      titleKo: '💾 용량 · 묵은 앱',
      subtitleKo: '임시캐시 · 안 쓰는 앱 · D: 이사',
      statusTone: storTone,
      statusBadgeKo: storBadge,
      headlineMetricKo: storHeadlineParts.join(' · '),
      itemCount: byBucket.STORAGE.length,
      selectedCount: byBucket.STORAGE.filter((i) => selSet.has(i.id) && !i.isProtected).length,
      reclaimableMb: storReclaimMb,
    },
    {
      bucketId: 'DESKTOP',
      stepNo: '④',
      titleKo: '🗂️ 바탕화면 · 사진',
      subtitleKo: '화면 파일 정돈 · 중복사진',
      statusTone: deskTone,
      statusBadgeKo: deskBadge,
      headlineMetricKo: deskHeadlineParts.join(' · '),
      itemCount: byBucket.DESKTOP.length,
      selectedCount: byBucket.DESKTOP.filter((i) => selSet.has(i.id) && !i.isProtected).length,
    },
  ];

  // 유저가 특정 영역(①~④)을 콕 집어 질문했으면 해당 칸을 최우선 펼침 탭으로 선택하고, 전체 점검일 때만 시급한 칸 자동 선택
  const alertHit = summaries.find((s) => s.statusTone === 'ALERT' && s.itemCount > 0);
  const nonEmptyHit = summaries.find((s) => s.itemCount > 0);
  const defaultActiveBucket: CareNormalizedBucketId =
    preferredBucket || alertHit?.bucketId || nonEmptyHit?.bucketId || 'STORAGE';

  return { summaries, defaultActiveBucket };
}
let lastCareScanContext: AgentCareScanContext | null = null;

export function getLastCareScanContext(): AgentCareScanContext | null {
  return lastCareScanContext;
}

export function clearLastCareScanContext(): void {
  lastCareScanContext = null;
}

/**
 * 🌟 [초보자 눈높이 1줄 번역 사전 — 고클린과의 결정적 차별화]
 * 영문 프로그램명·프로세스명만 나열하면 일반 유저가 멘붕하므로,
 * 모든 스캔 항목에 "이게 뭐 하는 프로그램인지 + 지워도 되는지" 쉬운 한글 설명과 안전도 배지를 자동 부착합니다.
 */
export function explainCareItemForBeginner(item: {
  id: string;
  name: string;
  cat: string;
  sizeMb?: number;
  actionType?: string;
  isProtected?: boolean;
}): {
  safetyBadge: NonNullable<AgentCareScanItem['safetyBadge']>;
  safetyBadgeLabel: string;
  plainExplainKo: string;
} {
  const comb = `${item.id} ${item.name} ${item.cat}`.toLowerCase();

  if (item.isProtected) {
    return {
      safetyBadge: 'USER_CHECK',
      safetyBadgeLabel: '🛡️ 자동 보호',
      plainExplainKo: '컴퓨터·업무가 정상 작동하는 데 꼭 필요한 프로그램이라 실수로 지워지지 않게 보호 중이에요.',
    };
  }
  if (/datasharing|lockprofilecookie/.test(comb)) {
    return {
      safetyBadge: 'DANGER_DELETE',
      safetyBadgeLabel: '🚨 위험 · 꼭 삭제',
      plainExplainKo: '크롬 브라우저의 보안 잠금(쿠키 보호)을 몰래 풀어두는 위험한 예약 작업이에요. 바로 없애는 게 안전해요!',
    };
  }
  if (/cachecloud|cacheconsole|cloudtask|storageservice|pc\s*app\s*store|pcappstore|febjb|msload|ngplus|rayitem|toast|hancapture|zsi|zum|yoondisk|yondisk|natservice|clipdown|tabbie|utilzone/.test(comb)) {
    return {
      safetyBadge: 'SAFE_DELETE',
      safetyBadgeLabel: '🔴 100% 삭제 안전',
      plainExplainKo: '무료 프로그램 깔 때 몰래 따라 들어온 광고·속도 저하 앱이에요. 지워도 내 문서·업무에 아무 지장 없고 PC가 확 빨라져요!',
    };
  }
  if (/hiberfil/.test(comb)) {
    return {
      safetyBadge: 'SAFE_CLEAN',
      safetyBadgeLabel: '🟢 데스크톱 즉시 확보',
      plainExplainKo: '노트북 배터리 절전용 파일인데 데스크톱에선 쓸 일이 없어요. 끄시면 1초 만에 몇 GB가 바로 늘어나요!',
    };
  }
  if (/chrome_cache|edge_cache|whale_cache|브라우저\s*캐시/.test(comb)) {
    return {
      safetyBadge: 'SAFE_CLEAN',
      safetyBadgeLabel: '🟢 로그인 유지 · 안전 청소',
      plainExplainKo: '인터넷 보며 쌓인 임시 그림 찌꺼기만 비워요. 자동로그인·비밀번호·즐겨찾기는 절대 안 풀려요!',
    };
  }
  if (/kakao|카카오/.test(comb) && /캐시|cache|adfit/.test(comb)) {
    return {
      safetyBadge: 'SAFE_CLEAN',
      safetyBadgeLabel: '🟢 대화·사진 보호',
      plainExplainKo: '카카오톡 광고·임시 찌꺼기만 청소해요. 대화 내용과 카톡 받은 파일은 100% 그대로 보호됩니다!',
    };
  }
  if (/temp|npm|pnpm|yarn|pip|gradle|crashdump|video_stream_cache/.test(comb)) {
    return {
      safetyBadge: 'SAFE_CLEAN',
      safetyBadgeLabel: '🟢 100% 안전 청소',
      plainExplainKo: '작업 후 남은 임시 찌꺼기 파일이에요. 지워도 프로그램 실행에 전혀 문제가 없고 용량만 깔끔히 확보돼요!',
    };
  }
  if (/capcut|캡컷/.test(comb)) {
    if (/cache|렌더링/.test(comb)) {
      return {
        safetyBadge: 'SAFE_CLEAN',
        safetyBadgeLabel: '🟢 편집 원본 보호',
        plainExplainKo: '영상 편집 앱(CapCut)의 임시 캐시만 비워요. 작업 중인 영상 프로젝트는 그대로 남아요!',
      };
    }
    return {
      safetyBadge: 'USER_CHECK',
      safetyBadgeLabel: '🔎 확인 후 선택',
      plainExplainKo: '영상 편집 프로그램(CapCut)이에요. 10GB 가까이 크게 자리 잡으니 영상 편집을 안 하시면 지우는 게 용량에 큰 도움이 돼요!',
    };
  }
  if (/copilot/.test(comb)) {
    return {
      safetyBadge: 'SAFE_DELETE',
      safetyBadgeLabel: '🔴 메모리 600MB 회수',
      plainExplainKo: '윈도우 기본 AI 앱(Copilot)인데 안 써도 뒤에서 메모리를 600MB 넘게 먹고 있어요. 안 쓰시면 꺼두는 게 훨씬 쾌적해요!',
    };
  }
  if (/ocam|오캠/.test(comb)) {
    if (/task|스케줄러/.test(comb)) {
      return {
        safetyBadge: 'SAFE_DELETE',
        safetyBadgeLabel: '🔴 100% 꺼도 안전',
        plainExplainKo: '화면 녹화 프로그램(oCam)이 켤 때마다 몰래 띄우는 백그라운드 광고/점검 작업이에요. 꺼도 녹화 기능은 정상 작동해요!',
      };
    }
    return {
      safetyBadge: 'USER_CHECK',
      safetyBadgeLabel: '🔎 쓰시면 유지',
      plainExplainKo: 'PC 화면 녹화 프로그램(오캠)이에요. 평소 화면 녹화를 쓰시면 체크를 빼고 남겨두세요!',
    };
  }
  if (/scapture|s캡쳐/.test(comb)) {
    return {
      safetyBadge: 'USER_CHECK',
      safetyBadgeLabel: '🔎 쓰시면 유지',
      plainExplainKo: '화면 캡처 프로그램(SCapture)이에요. 평소 즐겨 쓰시면 놔두시고, 안 쓰시면 지우셔도 됩니다!',
    };
  }
  if (/고클린|goclean/.test(comb)) {
    return {
      safetyBadge: 'SAFE_DELETE',
      safetyBadgeLabel: '🔴 귀신비서로 대체됨',
      plainExplainKo: '구형 PC 정리 프로그램(고클린)이에요. 이제 광고 없는 귀신비서가 더 안전하게 대신하므로 지우셔도 됩니다!',
    };
  }
  if (/hp\s*print\s*scan|제품\s*개선|hpcust|hp\s*dropbox|hp\s*google/.test(comb)) {
    return {
      safetyBadge: 'SAFE_DELETE',
      safetyBadgeLabel: '🔴 인쇄 영향 없음',
      plainExplainKo: '프린터 본체 드라이버가 아니라 뒤에서 통계만 보내는 부가 프로그램이에요. 지워도 인쇄·스캔은 100% 그대로 됩니다!',
    };
  }
  if (/nprotect|ahnlab|astx|nossvc/.test(comb)) {
    return {
      safetyBadge: 'SAFE_DELETE',
      safetyBadgeLabel: '🟠 CPU 과점유 · 삭제 추천',
      plainExplainKo: '은행 보안 프로그램인데 끄지 못하게 잠겨 있어 평소에도 CPU를 많이 먹어요. 자주 안 쓰시면 지우시는 게 훨씬 빠르고, 나중에 은행 가면 자동 재설치돼요!',
    };
  }
  if (item.actionType === 'SECURITY_SLEEP' || /anysign|touchen|delfino|veraport|wizvera|crossex|iniline|ipinside|keysharp|magicline|crosscert|secukit/.test(comb)) {
    return {
      safetyBadge: 'SLEEP_RECOMMEND',
      safetyBadgeLabel: '🟡 안 지우고 재우기 추천',
      plainExplainKo: '은행·홈택스·민원 사이트용 보안 프로그램이에요. 지우면 다음에 또 깔아야 하니 평소엔 쿨쿨 재워두고 은행 갈 때만 자동으로 깨워드려요!',
    };
  }
  if (/miplatform|iformscan|inziiform|ozweb|ozx|aps\s*engine|yettiesoft|redbc|non-activex|e-pagesafer|markany/.test(comb)) {
    return {
      safetyBadge: 'SAFE_DELETE',
      safetyBadgeLabel: '🔴 구형 관공서 · 삭제 추천',
      plainExplainKo: '예전에 등기소·특허청·관공서 문서 출력할 때 깔린 구형 플러그인이에요. 요즘 안 들어가시면 지우셔도 전혀 문제없어요!',
    };
  }
  if (/곰플레이어|gom|팟인코더|샤나인코더|vrew|포토스케이프|photoscape|calibre|reflector/.test(comb)) {
    return {
      safetyBadge: 'USER_CHECK',
      safetyBadgeLabel: '🔎 안 쓰시면 삭제',
      plainExplainKo: '영상 재생·편집·사진 꾸미기용 유틸리티 앱이에요. 최근에 쓰신 적 없으면 체크해서 깔끔하게 지우셔도 됩니다!',
    };
  }
  if (/cursor|windsurf|postman|figma|antigravity/.test(comb)) {
    return {
      safetyBadge: 'USER_CHECK',
      safetyBadgeLabel: '🔎 업무용 확인',
      plainExplainKo: '개발·디자인 작업용 프로그램이에요. 직접 개발이나 디자인 작업을 하지 않으시면 지워도 업무에 지장 없어요!',
    };
  }
  if (item.cat === 'USER_FOLDER' || item.cat === 'USER_LARGE_ITEM' || item.cat.startsWith('DESKTOP_')) {
    return {
      safetyBadge: 'USER_CHECK',
      safetyBadgeLabel: '🔎 내용 확인 후 선택',
      plainExplainKo: '내 파일·폴더입니다. 지우기 아까운 대용량 자료라면 삭제 대신 여유 있는 D: 드라이브로 안전하게 이사할 수 있어요!',
    };
  }
  return {
    safetyBadge: 'USER_CHECK',
    safetyBadgeLabel: '🔎 확인 후 선택',
    plainExplainKo: '이 프로그램이 궁금하시면 오른쪽 [이게 뭐예요?]를 누르거나 채팅창에 번호를 물어보시면 친절히 설명해 드릴게요!',
  };
}

async function callCareApi<T = any>(
  path: string,
  body?: Record<string, unknown>,
  timeoutMs = 15000
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(getZCoreUrl(path), {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) {
      return { ok: false, error: `HTTP_${res.status}` };
    }
    return { ok: Boolean(json.ok), data: json as T, error: json.error };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err || 'NETWORK_ERROR') };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * [경량 직렬화] 허브 AI 게이트웨이 토큰·타임아웃 방어 (최대 120개 × 압축 키 — 4+1 전 영역 항목 누락 방지)
 */
export function serializeCompactScanContext(ctx: AgentCareScanContext | null): string {
  if (!ctx || !ctx.items.length) return '';
  const compactItems = ctx.items.slice(0, 120).map((it) => ({
    no: it.no,
    id: it.id,
    name: it.name.slice(0, 48),
    cat: it.cat,
    bk: it.bucketId || classifyCareItemBucket(it),
    stale:
      it.lastUsedStatus === 'DORMANT' ||
      it.lastUsedStatus === 'STALE' ||
      it.lastUsedStatus === 'UNUSED_SINCE_INSTALL'
        ? 1
        : undefined,
    mb: Math.round(it.sizeMb || 0),
  }));
  const header = [
    `[직전 PC 정밀 스캔 원장 (${ctx.scanKind} · 총 ${ctx.items.length}건)]`,
    ctx.cDriveFreeGb !== undefined
      ? `- C: 여유 ${ctx.cDriveFreeGb}GB / ${ctx.cDriveTotalGb ?? '?'}GB (사용률 ${ctx.cDriveUsedPct ?? '?'}%) | 데스크톱여부: ${ctx.isDesktop ? '데스크톱' : '노트북'} | 여유이사드라이브: ${(ctx.availableMoveDrives || []).map((d) => `${d.drive}(${d.freeGb}GB)`).join(', ') || '없음'}`
      : '',
    ctx.visibleSystemIcons && ctx.visibleSystemIcons.length > 0
      ? `- 바탕화면 표시 중인 특수 시스템 아이콘: ${ctx.visibleSystemIcons.map((i) => `${i.iconId}(${i.label})`).join(', ')}`
      : '',
    JSON.stringify(compactItems),
  ]
    .filter(Boolean)
    .join('\n');
  return header;
}

/**
 * 🧠 [2차 고도화 도구 2: 카탈로그에 없는 처음 보는 미등록 쥐새끼를 제미니가 서명사·경로·인자 보고 초보자 언어로 3단 자동 해석]
 */
async function enrichUnknownRatsWithGemini(unknownItems: AgentCareScanItem[]): Promise<void> {
  if (!unknownItems.length) return;
  const payload = unknownItems.slice(0, 25).map((it) => ({
    id: it.id,
    name: it.name,
    kind: it.ratKind || it.cat,
    exe: (it.executePath || '').slice(0, 90),
    args: (it.arguments || '').slice(0, 80),
    pub: (it.publisher || '').slice(0, 40),
  }));
  const prompt = [
    '당신은 Windows PC 내부에 숨어 돌아가는 처음 보는 백그라운드 스케줄러·서비스·시작프로그램의 정체를 초보자 눈높이로 1줄 해석해 주는 보안 비서입니다.',
    '아래 목록 각각의 실행경로·인자·서명사를 보고 3단계 중 하나로 분류하고 쉬운 한글 1줄 설명을 JSON 배열로 반환하세요.',
    '- tier: "DANGER_DELETE"(광고·위험·쿠키잠금해제·미서명 쥐새끼 ➔ 차단 권장) | "SLEEP_RECOMMEND"(즐겨쓰는 웹하드·유틸리티 상주 서비스 ➔ 앱 삭제 말고 수동전환/자동실행 해제 권장) | "USER_CHECK"(정상/업무용 확인 필요)',
    '- badge: "🔴 차단·제거 권장" | "🟡 수동전환·자동실행 해제" | "🔎 확인 후 선택"',
    '- explainKo: 개발용어 없이 초보자가 1초 만에 이해하는 1문장 (예: "예스파일 웹하드 서비스인데 앱을 꺼도 뒤에서 계속 돌고 있어요. 앱을 지우지 않고 켤 때만 돌게 수동으로 바꿀 수 있어요!")',
    '',
    JSON.stringify(payload),
    '',
    '반드시 순수 JSON 배열만 출력하세요: [{"id":"...","tier":"...","badge":"...","explainKo":"..."}]',
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);
  try {
    const res = await fetch('https://os.sundreamer.app/api/ai/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': 'ghosti',
        'x-ai-account': 'beakes',
      },
      body: JSON.stringify({
        appId: 'ghosti',
        account: 'beakes',
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        config: {
          temperature: 0.15,
          maxOutputTokens: 900,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return;
    const data = await res.json();
    const raw = String(data?.text || '')
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const sIdx = raw.indexOf('[');
    const eIdx = raw.lastIndexOf(']');
    if (sIdx < 0 || eIdx <= sIdx) return;
    const arr = JSON.parse(raw.slice(sIdx, eIdx + 1));
    if (!Array.isArray(arr)) return;
    const map = new Map<string, any>();
    for (const row of arr) {
      if (row && typeof row.id === 'string') map.set(row.id, row);
    }
    for (const it of unknownItems) {
      const hit = map.get(it.id);
      if (hit) {
        if (hit.tier === 'DANGER_DELETE' || hit.tier === 'SAFE_DELETE' || hit.tier === 'SLEEP_RECOMMEND' || hit.tier === 'USER_CHECK') {
          it.safetyBadge = hit.tier;
        }
        if (typeof hit.badge === 'string' && hit.badge.trim()) {
          it.safetyBadgeLabel = hit.badge.trim();
        }
        if (typeof hit.explainKo === 'string' && hit.explainKo.trim()) {
          it.plainExplainKo = hit.explainKo.trim();
        }
        if (hit.tier === 'DANGER_DELETE' || hit.tier === 'SAFE_DELETE') {
          it.defaultSelected = true;
        }
      }
    }
  } catch {
    /* keep fallback */
  } finally {
    clearTimeout(timer);
  }
}

/**
 * [Read-Only 도구 병렬 실행기] 승인 게이트 없이 1턴에 복수 조회 도구를 병렬 실행하고
 * lastCareScanContext를 최신화합니다.
 */
export async function runAgentCareReadTools(
  tools: AgentCareReadTool[],
  options?: {
    preferredBucket?: CareNormalizedBucketId;
    subFocus?: CareSubFocus;
  }
): Promise<{
  ok: boolean;
  context: AgentCareScanContext;
  card: MonsterAgentCareCardPayload;
  briefingKo: string;
  followUpSuggestions: string[];
}> {
  const uniqueTools = Array.from(new Set(tools));
  const [diskRes, secRes, deskRes, appsRes, ratsRes] = await Promise.all([
    uniqueTools.includes('disk_hog_scan') ? callCareApi<any>('/api/care/disk-hog-scan') : Promise.resolve(null),
    uniqueTools.includes('security_2tier_scan') ? callCareApi<any>('/api/care/security-2tier-scan') : Promise.resolve(null),
    uniqueTools.includes('desktop_detail_scan') ? callCareApi<any>('/api/care/desktop-detail-scan') : Promise.resolve(null),
    uniqueTools.includes('installed_apps_list') ? callCareApi<any>('/api/care/installed-apps-list?limit=80') : Promise.resolve(null),
    uniqueTools.includes('hidden_rats_scan') ? callCareApi<any>('/api/care/hidden-rats-scan') : Promise.resolve(null),
  ]);

  const items: AgentCareScanItem[] = [];
  const summaryLines: string[] = [];
  let idx = 1;
  let cFreeGb: number | undefined;
  let cTotalGb: number | undefined;
  let cUsedPct: number | undefined;
  let projectedFreeGb: number | undefined;
  let availMoveDrives: Array<{ drive: string; freeGb: number }> = [];
  let isDesktop: boolean | undefined;
  let powerPlanName: string | undefined;
  let isHighPerformance: boolean | undefined;
  let visibleSysIcons: Array<{ iconId: string; label: string; safeExplanationKo: string }> = [];

  let primaryAction: AgentCareMutatingAction = 'disk_hog_clean';
  let primaryTitle = 'PC 정밀 스캔 & 취사선택 정리 목록';
  let primaryBadge = '귀신비서 AI 에이전트 실측';
  let scanKind: AgentCareScanContext['scanKind'] = uniqueTools.length > 1 ? 'MULTI' : 'DISK_HOG';

  // 1) C드라이브 대용량 공간 도둑 스캔 결과 반영
  if (diskRes?.ok && diskRes.data) {
    const d = diskRes.data;
    cFreeGb = Number(d.currentFreeGb ?? d.cDrive?.freeGb ?? 0);
    cTotalGb = Number(d.cDrive?.totalGb ?? 0);
    cUsedPct = Number(d.cDrive?.usedPercent ?? 0);
    projectedFreeGb = Number(d.projectedFreeAfterEmptyGb ?? cFreeGb);
    availMoveDrives = Array.isArray(d.availableMoveDrives) ? d.availableMoveDrives : [];
    isDesktop = Boolean(d.isDesktop);
    powerPlanName = String(d.powerPlan?.name || '');
    isHighPerformance = Boolean(d.powerPlan?.isHighPerformance);
    summaryLines.push(
      `💾 C: 드라이브 현재 여유 ${cFreeGb}GB / ${cTotalGb}GB (사용률 ${cUsedPct}%) · 안전 캐시 정리 시 휴지통 비우기 후 예상 여유 ${projectedFreeGb}GB`
    );
    if (availMoveDrives.length > 0) {
      summaryLines.push(
        `📦 여유 드라이브 감지: ${availMoveDrives.map((dv) => `${dv.drive} (${dv.freeGb}GB 여유)`).join(', ')} — 대용량 폴더 안전 이사 가능`
      );
    }
    if (isDesktop && !isHighPerformance && powerPlanName) {
      summaryLines.push(`⚡ 데스크톱 전원 모드가 '${powerPlanName}'으로 묶여 있습니다 (고성능 전환 가능).`);
    }
    for (const sc of d.safeCaches || []) {
      items.push({
        no: idx++,
        id: String(sc.id),
        name: String(sc.name),
        cat: String(sc.cat || 'SAFE_CACHE'),
        sizeMb: Number(sc.sizeMb || 0),
        detailKo: sc.cat === 'DESKTOP_HIBERFIL' ? '데스크톱 최대절전 즉시 해제' : '로그인·쿠키 보호 안전 캐시',
        defaultSelected: true,
      });
    }
    for (const hf of d.heavyFolders || []) {
      items.push({
        no: idx++,
        id: String(hf.id),
        name: String(hf.name),
        cat: String(hf.cat || 'USER_FOLDER'),
        sizeMb: Number(hf.sizeMb || 0),
        path: String(hf.path || ''),
        movableToOtherDrive: Boolean(hf.movableToOtherDrive),
        detailKo: hf.movableToOtherDrive && availMoveDrives.length > 0 ? '확인 후 삭제 또는 D: 안전 이사 권장' : '대용량 폴더 (확인 후 선택)',
        defaultSelected: false,
      });
    }
    if (uniqueTools.length === 1) {
      scanKind = 'DISK_HOG';
      primaryAction = 'disk_hog_clean';
      primaryTitle = `C: 드라이브 대용량 공간 도둑 정밀 진단 (여유 ${cFreeGb}GB)`;
      primaryBadge = '3초 고속 공간 스캔';
    }
  }

  // 2) 보안모듈·애드웨어 2분류 스캔 결과 반영
  if (secRes?.ok && secRes.data) {
    const s = secRes.data;
    summaryLines.push(
      `🛡️ 보안·애드웨어 2분류: 완전 삭제·적출 권장 ${s.deleteRecommendCount ?? 0}건 · 무삭제 수면(자동기상) 권장 ${s.sleepRecommendCount ?? 0}건`
    );
    for (const del of s.deleteRecommend || []) {
      items.push({
        no: idx++,
        id: String(del.id),
        name: String(del.name),
        cat: String(del.cat || 'PUP_ADWARE'),
        sizeMb: Number(del.sizeMb || del.estimatedRamMb || 0),
        detailKo: `🔴 삭제·적출 권장 — ${del.reason || ''}`,
        actionType: String(del.actionType || 'PUP_ERADICATE'),
        defaultSelected: true,
      });
    }
    for (const slp of s.sleepRecommend || []) {
      items.push({
        no: idx++,
        id: String(slp.id),
        name: String(slp.name),
        cat: String(slp.cat || 'ACTIVE_BANK_SECURITY'),
        sizeMb: 0,
        detailKo: `🟢 무삭제 수면·자동기상 권장 — ${slp.reason || ''}`,
        actionType: 'SECURITY_SLEEP',
        defaultSelected: false,
      });
    }
    if (uniqueTools.length === 1) {
      scanKind = 'SECURITY_2TIER';
      primaryAction = 'batch_deep_uninstall';
      primaryTitle = '보안모듈·애드웨어 스마트 2분류 (수면 vs 삭제)';
      primaryBadge = '사용이력·PUP 2분류';
    }
  }

  // 3) 바탕화면 상세 분석 & 시스템 아이콘 진단
  if (deskRes?.ok && deskRes.data) {
    const dk = deskRes.data;
    visibleSysIcons = Array.isArray(dk.visibleSystemIcons) ? dk.visibleSystemIcons : [];
    summaryLines.push(
      `🖥️ 바탕화면 전수 분석: 총 ${dk.count ?? 0}개 항목 (${dk.totalMb ?? 0}MB)` +
        (visibleSysIcons.length > 0
          ? ` · 특수 시스템 아이콘 ${visibleSysIcons.length}개 표시 중(${visibleSysIcons.map((i) => i.label).join(', ')})`
          : '')
    );
    for (const di of (dk.items || []).slice(0, 30)) {
      items.push({
        no: idx++,
        id: String(di.id),
        name: String(di.name),
        cat: `DESKTOP_${di.kind || 'FILE'}`,
        sizeMb: Number(di.sizeMb || 0),
        path: String(di.fullPath || ''),
        movableToOtherDrive: true,
        detailKo: `${di.scope || '바탕화면'} · ${di.compositionKo || ''} (${di.modifiedAt || ''})`,
        defaultSelected: false,
      });
    }
    if (uniqueTools.length === 1) {
      scanKind = 'DESKTOP_DETAIL';
      primaryAction = 'desktop_batch_action';
      primaryTitle = `바탕화면 상세 구성 분석 (${dk.count ?? 0}개 · ${dk.totalMb ?? 0}MB)`;
      primaryBadge = '폴더 내부 구성·시스템 아이콘 진단';
    }
  }

  // 4) 설치된 전체 프로그램 목록 (잊고 있던 미사용 앱 3대 안심 힌트 포함: 용도 · 마지막 사용 시점 · 안전도)
  if (appsRes?.ok && appsRes.data) {
    const ap = appsRes.data;
    const staleCnt = Number(ap.staleUnusedCount ?? 0);
    summaryLines.push(
      `📦 설치된 프로그램 스캔: 총 ${ap.totalCount ?? 0}개` +
        (staleCnt > 0 ? ` (오래 안 쓴 묵은 앱 ${staleCnt}개 발견)` : '') +
        ` — 용도와 마지막 사용 시점을 보고 골라 지우실 수 있어요`
    );
    const appSliceLimit = uniqueTools.length > 1 ? 35 : 50;
    for (const a of (ap.items || []).slice(0, appSliceLimit)) {
      const roleKo = String(a.plainRoleKo || '').trim();
      const lastUsedKo = String(a.lastUsedLabelKo || '').trim();
      const lastSt = String(a.lastUsedStatus || '').trim();
      // 멀티 종합 점검에서는 보호된 시스템 부품은 제외하고 실제 유저가 판단할 앱(특히 오래 안 쓴 앱·대용량 앱) 위주로 노출
      if (uniqueTools.length > 1 && a.isProtected) continue;
      items.push({
        no: idx++,
        id: `inst_${idx}_${String(a.name || '').slice(0, 20)}`,
        name: String(a.name || ''),
        cat: a.isProtected ? 'PROTECTED_APP' : 'INSTALLED_APP',
        bucketId: 'STORAGE',
        sizeMb: Number(a.sizeMb || 0),
        plainRoleKo: roleKo || undefined,
        lastUsedLabelKo: lastUsedKo || undefined,
        lastUsedStatus: lastSt || undefined,
        detailKo: [
          roleKo || a.publisher || '설치 프로그램',
          lastUsedKo || (a.installDate ? `설치일 ${a.installDate}` : ''),
        ]
          .filter(Boolean)
          .join(' · '),
        isProtected: Boolean(a.isProtected),
        defaultSelected: false,
      });
    }
    if (uniqueTools.length === 1) {
      scanKind = 'INSTALLED_APPS';
      primaryAction = 'batch_deep_uninstall';
      primaryTitle = `설치된 프로그램 · 잊고 있던 앱 정리 (${ap.totalCount ?? 0}개)`;
      primaryBadge = '용도 · 마지막 사용 시점 안심 힌트';
    }
  }

  // 5) [2차 고도화] 미등록 신종 쥐새끼(비-MS 스케줄러·비-Windows 서비스·자동실행·고메모리) 전수 수색 결과 반영 (보안·PUP 2분류와 중복 행 자동 제거)
  const unknownRatsToEnrich: AgentCareScanItem[] = [];
  if (ratsRes?.ok && ratsRes.data) {
    const rt = ratsRes.data;
    summaryLines.push(
      `🕵️ 숨은 백그라운드 전수 수색: 비-MS 스케줄러 ${rt.taskCount ?? 0}건 · 비-Windows 상주 서비스 ${rt.serviceCount ?? 0}건 · 부팅 자동실행 ${rt.startupCount ?? 0}건`
    );
    const existingSigTokens = items
      .map((ex) =>
        String(ex.name || '')
          .toLowerCase()
          .replace(/\[.*?\]|\(.*?\)/g, ' ')
          .trim()
      )
      .filter((s) => s.length >= 3);
    const isDuplicateOfSecScan = (riName: string, riKey: string) => {
      if (!secRes?.ok) return false;
      const probe = `${riName} ${riKey}`.toLowerCase();
      const knownOverlap = [
        'cachecloud', 'cacheconsole', 'cacheservice', 'frontserviceupdater',
        'cloudtask', 'storageservice', 'pcappstore', 'febjb', 'datasharing',
        'msload', 'ngplus', 'rayitem', 'shellexecuteas', 'e0477272', 'toast',
        'ocamtask', 'clipdown', 'nossvc', 'nprotect', 'magicline', 'crossex',
        'anysign', 'touchen', 'veraport', 'delfino', 'ipinside', 'keysharp',
      ];
      if (knownOverlap.some((tok) => probe.includes(tok) && existingSigTokens.some((es) => es.includes(tok.slice(0, 5))))) {
        return true;
      }
      return false;
    };

    for (const ri of (rt.items || []).slice(0, 35)) {
      const rName = String(ri.name || '');
      const rKey = String(ri.targetKey || '');
      if (isDuplicateOfSecScan(rName, rKey)) continue;
      const scanIt: AgentCareScanItem = {
        no: idx++,
        id: String(ri.id),
        name: rName,
        cat: String(ri.cat || 'RAT_TASK'),
        sizeMb: Number(ri.sizeMb || 0),
        detailKo: `${ri.publisher || '서명 미확인'} · ${ri.arguments || ri.executePath || ''}`,
        actionType: String(ri.recommendedAction || 'DISABLE_TASK'),
        ratKind: ri.ratKind,
        targetKey: rKey,
        executePath: String(ri.executePath || ''),
        arguments: String(ri.arguments || ''),
        publisher: String(ri.publisher || ''),
        defaultSelected: Boolean(ri.defaultSelected),
        isProtected: Boolean(ri.isProtected),
      };
      items.push(scanIt);
    }
    if (uniqueTools.length === 1) {
      scanKind = 'HIDDEN_RATS';
      primaryAction = 'hidden_rats_apply';
      primaryTitle = `숨은 백그라운드·신종 쥐새끼 전수 수색 (${rt.count ?? 0}건)`;
      primaryBadge = '미등록 스케줄러·서비스 수동전환';
    }
  }

  // 🌟 모든 스캔 항목에 초보자 친절 1줄 설명 & 안전도 배지 자동 부착 + 카탈로그에 없는 미등록 쥐새끼는 제미니로 즉시 정체 해석!
  // [안전 체크 원칙]: '쓰시면 유지 / 확인 후 선택(USER_CHECK)' 및 '안 지우고 재우기 추천(SLEEP_RECOMMEND)' 항목은
  // 실수로 삭제 창이 뜨지 않도록 절대 기본 자동 체크(defaultSelected=true)하지 않습니다.
  for (const it of items) {
    const exp = explainCareItemForBeginner(it);
    it.safetyBadge = exp.safetyBadge;
    it.safetyBadgeLabel = exp.safetyBadgeLabel;
    if (
      it.cat === 'INSTALLED_APP' &&
      it.plainRoleKo &&
      exp.plainExplainKo.includes('오른쪽 [이게 뭐예요?]')
    ) {
      const staleNote =
        it.lastUsedStatus === 'DORMANT' || it.lastUsedStatus === 'STALE' || it.lastUsedStatus === 'UNUSED_SINCE_INSTALL'
          ? '오랫동안 쓰신 흔적이 없으니 더 이상 안 쓰시면 지워 용량을 확보하셔도 안전해요! (내 개인 문서·사진 원본은 지워지지 않아요)'
          : it.lastUsedStatus === 'ACTIVE_NOW' || it.lastUsedStatus === 'RECENT'
          ? '최근에 사용 중인 프로그램이니 평소 쓰신다면 체크하지 말고 그대로 두세요!'
          : '자주 쓰지 않는 프로그램이라면 체크해서 깔끔하게 정리하셔도 괜찮아요!';
      it.plainExplainKo = `${it.plainRoleKo}예요. ${staleNote}`;
    } else {
      it.plainExplainKo = exp.plainExplainKo;
    }
    if (exp.safetyBadge === 'USER_CHECK' || exp.safetyBadge === 'SLEEP_RECOMMEND') {
      it.defaultSelected = false;
    }
    if (it.ratKind && it.plainExplainKo.includes('오른쪽 [이게 뭐예요?]')) {
      unknownRatsToEnrich.push(it);
    }
    it.bucketId = classifyCareItemBucket(it);
  }
  if (unknownRatsToEnrich.length > 0) {
    await enrichUnknownRatsWithGemini(unknownRatsToEnrich);
    for (const u of unknownRatsToEnrich) {
      u.bucketId = classifyCareItemBucket(u);
    }
  }

  // 유저가 '안 쓴 프로그램 / 설치된 앱'을 물어봤을 때는 ③ 용량·묵은 앱 칸에서 오래 안 쓴 설치 앱이 맨 위에 바로 보이도록 정렬!
  if (options?.subFocus === 'UNUSED_APPS') {
    const isStaleApp = (x: AgentCareScanItem) =>
      x.cat === 'INSTALLED_APP' &&
      (x.lastUsedStatus === 'DORMANT' ||
        x.lastUsedStatus === 'STALE' ||
        x.lastUsedStatus === 'UNUSED_SINCE_INSTALL');
    items.sort((a, b) => {
      if (a.bucketId === 'STORAGE' && b.bucketId === 'STORAGE') {
        const rankA = isStaleApp(a) ? 0 : a.cat === 'INSTALLED_APP' ? 1 : 2;
        const rankB = isStaleApp(b) ? 0 : b.cat === 'INSTALLED_APP' ? 1 : 2;
        if (rankA !== rankB) return rankA - rankB;
        return (b.sizeMb || 0) - (a.sizeMb || 0);
      }
      return 0;
    });
  }

  // 번호 재정렬 (중복 제거 및 정렬 후 1..N 연속 번호 유지)
  items.forEach((it, i) => {
    it.no = i + 1;
  });

  // [영역별 안전 기본 체크 가드]: 유저가 특정 영역(예: 바탕화면, 묵은 앱, 광고앱)만 물어봤을 때
  // 다른 탭(자동실행·캐시 등) 항목이 몰래 함께 체크되어 엉뚱한 정리가 실행되는 현상을 원천 차단합니다!
  const prefBucket = options?.preferredBucket;
  const subFocus = options?.subFocus;
  for (const it of items) {
    if (prefBucket && it.bucketId !== prefBucket) {
      it.defaultSelected = false;
    }
    if (subFocus === 'UNUSED_APPS' || prefBucket === 'DESKTOP') {
      it.defaultSelected = false;
    }
  }

  const ctx: AgentCareScanContext = {
    updatedAt: Date.now(),
    scanKind,
    cDriveFreeGb: cFreeGb,
    cDriveTotalGb: cTotalGb,
    cDriveUsedPct: cUsedPct,
    availableMoveDrives: availMoveDrives,
    isDesktop,
    powerPlanName,
    isHighPerformance,
    visibleSystemIcons: visibleSysIcons,
    items,
  };
  lastCareScanContext = ctx;

  const defaultSelectedIds = items.filter((it) => it.defaultSelected && !it.isProtected).map((it) => it.id);
  const { summaries: fourBucketSummaries, defaultActiveBucket } =
    uniqueTools.length > 1
      ? buildCareFourBucketSummaries({
          items,
          selectedIds: defaultSelectedIds,
          cDriveFreeGb: cFreeGb,
          cDriveUsedPct: cUsedPct,
          isDesktop,
          isHighPerformance,
          visibleSystemIconsCount: visibleSysIcons.length,
          preferredBucket: prefBucket,
        })
      : { summaries: undefined, defaultActiveBucket: undefined };

  if (uniqueTools.length > 1) {
    primaryTitle =
      subFocus === 'UNUSED_APPS'
        ? '🩺 PC 4대 진단 · 오랫동안 안 쓴 프로그램 점검'
        : subFocus === 'DISK_SPACE'
        ? '🩺 PC 4대 진단 · 용량 확보 & 묵은 앱 점검'
        : subFocus === 'ADWARE_SECURITY'
        ? '🩺 PC 4대 진단 · 광고·보안앱 집중 점검'
        : subFocus === 'DESKTOP_CLEAN' || subFocus === 'PHOTO_CLEANUP'
        ? '🩺 PC 4대 진단 · 바탕화면·사진 정돈'
        : subFocus === 'SPEED_SLOW'
        ? '🩺 PC 4대 진단 · 속도 높이기 집중 점검'
        : '🩺 내 PC 한눈에 4대 진단 리포트';
    primaryBadge = '칸을 누르면 세부 내역이 펼쳐집니다';
    if (prefBucket === 'DESKTOP') primaryAction = 'desktop_batch_action';
    else if (prefBucket === 'SPEED') primaryAction = 'hidden_rats_apply';
    else if (prefBucket === 'SECURITY' || subFocus === 'UNUSED_APPS') primaryAction = 'batch_deep_uninstall';
  }

  const card: MonsterAgentCareCardPayload = {
    mode: 'SCAN_REPORT',
    title: primaryTitle,
    badgeText: primaryBadge,
    summaryLines,
    fourBucketSummaries,
    defaultActiveBucket,
    action: primaryAction,
    items: items.slice(0, 150),
    selectedIds: defaultSelectedIds,
    excludedNames: [],
    availableMoveDrives: availMoveDrives,
    visibleSystemIcons: visibleSysIcons,
    currentFreeGb: cFreeGb,
    projectedFreeAfterEmptyGb: projectedFreeGb,
    isDesktop,
    isHighPerformance,
  };

  const installedTotal = Number(appsRes?.data?.totalCount ?? items.filter((i) => i.cat === 'INSTALLED_APP').length);
  const staleAppsCnt = items.filter(
    (i) =>
      i.cat === 'INSTALLED_APP' &&
      (i.lastUsedStatus === 'DORMANT' || i.lastUsedStatus === 'STALE' || i.lastUsedStatus === 'UNUSED_SINCE_INSTALL')
  ).length;
  const deskCnt = items.filter((i) => i.bucketId === 'DESKTOP').length;
  const deskMb = Number(deskRes?.data?.totalMb ?? 0);
  const secDangerCnt = items.filter(
    (i) => i.bucketId === 'SECURITY' && (i.safetyBadge === 'DANGER_DELETE' || i.safetyBadge === 'SAFE_DELETE')
  ).length;
  const secSleepCnt = items.filter(
    (i) => i.bucketId === 'SECURITY' && i.safetyBadge === 'SLEEP_RECOMMEND'
  ).length;

  let briefingParts: string[];
  if (subFocus === 'UNUSED_APPS') {
    briefingParts = [
      `설치된 프로그램 **총 ${installedTotal}개**를 살펴보니, 오랫동안 쓰지 않은 **묵은 앱 ${staleAppsCnt}개**가 확인됐어요!`,
      `• 아래 4칸 요약표 중 **[③ 💾 용량 · 묵은 앱]** 칸을 바로 펼쳐 두었습니다. 각 앱의 **📌 용도 · 🕒 마지막 사용 시점 · 안전 배지**를 보시고 골라 지우실 수 있어요.`,
      `• 체크박스로 고르시거나 채팅창에 **"오캠은 빼고 안 쓰는 앱 지워줘"**, **"1번이 뭐 하는 프로그램이야?"**처럼 편하게 말씀해 주세요!`,
    ];
  } else if (subFocus === 'DISK_SPACE') {
    briefingParts = [
      `현재 **C: 드라이브 여유 공간은 ${cFreeGb ?? '?'}GB (사용률 ${cUsedPct ?? '?'}%)**예요!`,
      `• 아래 4칸 요약표 중 **[③ 💾 용량 · 묵은 앱]** 칸에 바로 비울 수 있는 안전 임시 캐시와 오래 안 쓴 프로그램(${staleAppsCnt}개)을 펼쳐 두었어요.`,
      `• 체크박스로 선택하시거나 **"안전 캐시만 정리해줘"**, **"큰 폴더는 D드라이브로 옮겨줘"**처럼 말씀해 주세요!`,
    ];
  } else if (subFocus === 'ADWARE_SECURITY') {
    briefingParts = [
      `광고·애드웨어와 은행·관공서 보안프로그램을 정밀 점검해 **삭제 권장 ${secDangerCnt}건 · 잠재우기 권장 ${secSleepCnt}건**을 분류했어요!`,
      `• 아래 4칸 요약표 중 **[② 🛡️ 광고 · 보안앱]** 칸을 바로 펼쳐 두었습니다.`,
      `• **"빨간색 광고앱만 지우고 은행 보안앱은 잠재워줘"**처럼 말씀하시거나 원하는 항목만 체크해 실행해 보세요!`,
    ];
  } else if (subFocus === 'DESKTOP_CLEAN' || subFocus === 'PHOTO_CLEANUP') {
    briefingParts = [
      `바탕화면 항목 **총 ${deskCnt}개(${deskMb}MB)**를 분석해 **[④ 🗂️ 바탕화면 · 사진]** 칸에 바로 펼쳐 두었어요!`,
      `• 임의로 아무것도 지우지 않았습니다. 아래 목록에서 정리할 파일·폴더만 체크하시거나 **"설치파일만 지워줘"**, **"중요 폴더 빼고 정리해줘"**처럼 편하게 말씀해 주세요! (모든 파일은 영구 삭제 없이 **Windows 휴지통** 또는 여유 드라이브로 안전 이동하며 1초 되돌리기가 보장됩니다)`,
    ];
  } else if (subFocus === 'SPEED_SLOW') {
    const speedCnt = items.filter((i) => i.bucketId === 'SPEED' && !i.isProtected).length;
    briefingParts = [
      `속도를 늦추는 백그라운드 상주 서비스·자동실행 항목 **${speedCnt}건**과 4대 영역을 함께 점검했어요!`,
      `• 아래 4칸 요약표 중 **[① ⚡ 속도 높이기]** 칸을 바로 펼쳐 두었으니, 원하시는 항목만 체크하거나 **"빨간색 안전 항목만 정리해줘"**처럼 말씀해 주세요!`,
    ];
  } else {
    briefingParts = [
      `내 PC의 **4대 영역(①속도 · ②광고/보안앱 · ③용량/묵은앱 · ④바탕화면/사진)**에서 총 **${items.length}개 항목**을 실측해 왔어요!`,
      ...summaryLines.map((l) => `• ${l}`),
      `상단 **4칸 성적표**를 눌러 영역별 세부 내역을 보시고, 체크박스로 고르시거나 **"오캠이랑 4번은 빼고 정리해줘"**처럼 편하게 말씀해 주세요!`,
    ];
  }

  const hasSafeCacheItems = items.some(
    (it) => it.cat === 'SAFE_CACHE' || it.cat === 'DESKTOP_HIBERFIL'
  );
  const followUps: string[] = [];
  if (subFocus === 'UNUSED_APPS') {
    followUps.push('1번 프로그램이 뭐 하는 건지 알려줘');
    followUps.push('오래 안 쓴 프로그램만 골라줘');
  } else if (subFocus === 'ADWARE_SECURITY' || scanKind === 'SECURITY_2TIER') {
    followUps.push('빨간색 애드웨어만 지우고 은행 보안앱은 잠재워줘');
    followUps.push('윈도우 순정 백신 검사해줘');
  } else if (subFocus === 'DESKTOP_CLEAN' || subFocus === 'PHOTO_CLEANUP' || scanKind === 'DESKTOP_DETAIL') {
    if (visibleSysIcons.length > 0) {
      followUps.push('바탕화면 특수 아이콘만 안전하게 숨겨줘');
    }
    followUps.push('1번 항목이 뭔지 설명해줘');
  } else if (scanKind === 'DISK_HOG' || subFocus === 'DISK_SPACE' || uniqueTools.includes('disk_hog_scan')) {
    if (hasSafeCacheItems) {
      followUps.push('안전 캐시만 지금 정리해줘');
    } else {
      followUps.push('빨간색(삭제·차단 안전) 항목만 정리해줘');
    }
    if (availMoveDrives.length > 0 && items.some((it) => it.movableToOtherDrive)) {
      followUps.push(`다운로드 큰 파일은 ${availMoveDrives[0].drive} 드라이브로 옮겨줘`);
    }
    followUps.push('지금 CPU·메모리 제일 많이 쓰는 앱 알려줘');
  } else {
    followUps.push('체크한 항목들 안전하게 정리해줘');
  }

  return {
    ok: items.length > 0 || summaryLines.length > 0,
    context: ctx,
    card,
    briefingKo: briefingParts.join('\n'),
    followUpSuggestions: followUps.slice(0, 3),
  };
}

/**
 * [제미니 에이전트 자유 문답 플래너]
 * 유저 발화 + 직전 스캔 원장(60개 × 5키)을 Gemini 2.5 Flash로 넘겨
 * ALLOW 화이트리스트 Tool 조합 및 제외 필터(excludeIds/excludeKeywords)를 JSON으로 파싱합니다.
 */
export async function planCareAgentTurnWithGemini(params: {
  query: string;
  pcContextText: string;
  scanContext: AgentCareScanContext | null;
  recentTurns: Array<{ role: 'user' | 'assistant'; text: string }>;
}): Promise<AgentCareLlmPlan | null> {
  const { query, pcContextText, scanContext, recentTurns } = params;
  const compactScan = serializeCompactScanContext(scanContext);
  const hist = recentTurns
    .slice(-5)
    .map((t) => `${t.role === 'user' ? '유저' : '귀신비서'}: ${t.text.slice(0, 180)}`)
    .join('\n');

  const prompt = [
    '당신은 『귀신같이(Ghosti)』의 내 PC 전담 AI 에이전트 **귀신비서**입니다.',
    '유저의 자연어 요청과 직전 스캔 원장을 분석해, 허용된 안전 도구(Safe Toolset)만 조합한 JSON 플랜을 출력하세요.',
    '',
    '[절대 경계 헌법 (ALLOW / DENY)]:',
    '✅ ALLOW (허용 도구):',
    '  - 조회(readTools): "disk_hog_scan"(C드라이브 대용량·캐시·hiberfil 스캔), "security_2tier_scan"(보안모듈 수면 vs 악성애드웨어·그리드 2분류), "hidden_rats_scan"(미등록 신종 쥐새끼·비-MS 스케줄러·비-Windows 서비스·자동실행·고메모리 전수 수색), "desktop_detail_scan"(바탕화면 폴더 구성·특수아이콘 진단), "installed_apps_list"(설치 앱 전체 목록)',
    '  - 변경(mutatingPlan.action): "disk_hog_clean"(캐시·hiberfil 정리/D: 이사), "batch_deep_uninstall"(다중 앱·애드웨어 취사선택 일괄 제거), "hidden_rats_apply"(숨은 스케줄러 차단·서비스 수동전환·부팅 자동실행 해제 — 앱 삭제 없이 1초 원복), "desktop_batch_action"(바탕화면 선택 항목 휴지통/D: 이사/아이콘 숨김), "security_2tier_apply"(실사용 보안모듈 수면 + 애드웨어 삭제), "desktop_system_icon_toggle"(WD 사용자폴더 등 특수아이콘 숨김), "desktop_power_boost"(데스크톱 고성능 전원 전환)',
    '🚫 DENY (절대 금지): 임의 Shell/PowerShell 생성 금지, 시스템 폴더 삭제 금지, 영구 삭제 금지(모든 파일·폴더는 Windows 휴지통으로만 이동), 하드웨어 드라이버(NVIDIA/AMD/Intel/Realtek) 삭제 금지.',
    '',
    '[멀티턴 취사선택·제외 필터 파싱 규칙]:',
    '- 유저가 직전 스캔 목록을 보고 "카톡·오캠·4번은 놔두고 나머지 다 지워", "예스파일, S캡쳐는 빼고 다 제거해", "여행 폴더만 지우고 WD 아이콘은 숨겨줘"라고 말하면:',
    '  1) 반드시 직전 스캔 원장의 항목 `id` 또는 `#번호`를 기준으로 `includeIds`(실행할 대상)와 `excludeIds`·`excludeKeywords`(보존할 대상)를 정확히 분리해 `mutatingPlan`에 담으세요.',
    '  2) "나머지 다"라고 하면 직전 스캔 원장에서 `excludeIds`/`excludeKeywords`와 보호 항목을 뺀 모든 대상 `id`를 `includeIds`에 넣으세요.',
    '  3) 유저가 새로 조사·스캔을 요청하면 `readTools` 배열에 필요한 도구 1~3개를 담고 `mutatingPlan`은 null로 두세요.',
    '',
    pcContextText,
    compactScan,
    hist ? `[최근 대화]\n${hist}` : '',
    `[현재 유저 요청]: "${query}"`,
    '',
    '반드시 아래 순수 JSON 하나만 출력하세요 (코드블록 없이 { 로 시작해서 } 로 끝낼 것):',
    '{',
    '  "replyKo": "따뜻하고 똑부러지는 귀신비서 해요체 1~2문장 안내 (제외된 항목과 정리할 항목을 명확히 짚어줄 것)",',
    '  "readTools": [],',
    '  "mutatingPlan": null | {',
    '    "action": "disk_hog_clean" | "batch_deep_uninstall" | "hidden_rats_apply" | "desktop_batch_action" | "security_2tier_apply" | "desktop_system_icon_toggle" | "desktop_power_boost",',
    '    "includeIds": ["스캔원장의 id 또는 앱/폴더명"],',
    '    "excludeIds": ["제외할 id 또는 #번호"],',
    '    "excludeKeywords": ["유저가 놔두라고 한 앱/폴더 이름 키워드"],',
    '    "moveDestinationDrive": "D: (다른 드라이브 이사 요청 시에만)",',
    '    "hideSystemIconIds": ["user_files" | "network" | "control_panel"],',
    '    "reasonSummaryKo": "실행 계획 1줄 요약"',
    '  },',
    '  "followUpSuggestions": ["유저 반말 버튼 1", "유저 반말 버튼 2"]',
    '}',
  ]
    .filter(Boolean)
    .join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);
  try {
    const res = await fetch('https://os.sundreamer.app/api/ai/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': 'ghosti',
        'x-ai-account': 'beakes',
      },
      body: JSON.stringify({
        appId: 'ghosti',
        account: 'beakes',
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        config: {
          temperature: 0.15,
          maxOutputTokens: 600,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return buildLocalMultiTurnFilterFallback(query, scanContext);
    const data = await res.json();
    const raw = String(data?.text || '')
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const sIdx = raw.indexOf('{');
    const eIdx = raw.lastIndexOf('}');
    if (sIdx < 0 || eIdx <= sIdx) return buildLocalMultiTurnFilterFallback(query, scanContext);
    const parsed = JSON.parse(raw.slice(sIdx, eIdx + 1));
    if (!parsed || typeof parsed.replyKo !== 'string') return buildLocalMultiTurnFilterFallback(query, scanContext);
    logGeminiCareTurnNonBlocking(query, parsed.replyKo, 'care_plan');
    return {
      replyKo: parsed.replyKo.trim(),
      readTools: Array.isArray(parsed.readTools) ? parsed.readTools : [],
      mutatingPlan: parsed.mutatingPlan || null,
      followUpSuggestions: Array.isArray(parsed.followUpSuggestions)
        ? parsed.followUpSuggestions.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, 3)
        : [],
    };
  } catch {
    return buildLocalMultiTurnFilterFallback(query, scanContext);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * [2층 제미니 비차단 텔레메트리 로거 — 0ms 지연, 주 1회 1층 정규식 승격용]
 */
function logGeminiCareTurnNonBlocking(query: string, aiReply: string, stage: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const maskedQ = String(query || '')
      .replace(/[A-Za-z]:\\Users\\[^\\\s]+/gi, 'C:\\Users\\*')
      .slice(0, 240);
    const key = 'ghosti_gemini_care_telemetry_v1';
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    const next = Array.isArray(prev) ? prev : [];
    next.push({
      at: new Date().toISOString(),
      stage,
      q: maskedQ,
      replyPreview: String(aiReply || '').slice(0, 180),
    });
    localStorage.setItem(key, JSON.stringify(next.slice(-150)));
  } catch {
    /* non-blocking */
  }
}

/**
 * [P1-3 로컬 결정론적 멀티턴 필터 폴백]
 * 네트워크 지연·쿼터 전환으로 제미니가 타임아웃 나더라도 "오캠이랑 3번 빼고 다 지워", "D드라이브로 옮겨줘"를 0ms로 정확히 파싱해 확인 카드를 생성합니다.
 */
export function buildLocalMultiTurnFilterFallback(
  query: string,
  scanContext: AgentCareScanContext | null
): AgentCareLlmPlan | null {
  if (!scanContext || scanContext.items.length === 0) return null;
  const q = query.trim();
  const moveDrvMatch = q.match(/([d-zD-Z])\s*:?\s*드라이브/);
  const moveDrive = moveDrvMatch ? `${moveDrvMatch[1].toUpperCase()}:` : '';

  const excludeIds: string[] = [];
  const excludeKeywords: string[] = [];

  const excClauseMatch = q.match(/^(.+?)\s*(?:은|는|이랑|랑|하고|과|와|,)?\s*(?:빼고|제외하고|제외|놔두고|놔둬|남기고|냅두고|말고)/i);
  if (excClauseMatch && excClauseMatch[1]) {
    const rawPart = excClauseMatch[1];
    for (const nm of rawPart.matchAll(/#?(\d+)\s*번?/g)) {
      excludeIds.push(`#${nm[1]}`);
    }
    const tokens = rawPart
      .replace(/#?\d+\s*번?/g, ' ')
      .split(/[,/·]|이랑|랑|하고|그리고|및|\s+/)
      .map((t) => t.replace(/(은|는|이|가|을|를|만|도)$/, '').trim())
      .filter((t) => t.length >= 2 && !/^(내가|쓰는|사용하는|프로그램|앱|파일|폴더|항목)$/.test(t));
    excludeKeywords.push(...tokens);
  }

  const includeIds: string[] = [];
  const wantsSafeCacheOnly = /(?:안전\s*)?캐시만/i.test(q);
  const wantsRedSafeOnly = /(빨간색|삭제\s*안전|차단\s*권장|100%\s*삭제)/i.test(q);
  const wantsStaleAppsOnly = /(?:오래\s*(?:동안\s*)?(?:안\s*쓴|안쓴|안\s*쓰는|안쓰는)|묵은)\s*(?:프로그램|앱|어플)/i.test(q);
  const wantsDesktopItems = /바탕화면/i.test(q);
  if (!excClauseMatch) {
    for (const nm of q.matchAll(/#?(\d+)\s*번?/g)) {
      includeIds.push(`#${nm[1]}`);
    }
    if (wantsSafeCacheOnly) {
      for (const it of scanContext.items) {
        if (!it.isProtected && (it.cat === 'SAFE_CACHE' || it.cat === 'DESKTOP_HIBERFIL')) {
          includeIds.push(it.id);
        }
      }
    } else if (wantsRedSafeOnly) {
      for (const it of scanContext.items) {
        if (
          !it.isProtected &&
          (it.safetyBadge === 'DANGER_DELETE' || it.safetyBadge === 'SAFE_DELETE')
        ) {
          includeIds.push(it.id);
        }
      }
    } else if (wantsStaleAppsOnly) {
      for (const it of scanContext.items) {
        if (
          !it.isProtected &&
          it.cat === 'INSTALLED_APP' &&
          (it.lastUsedStatus === 'DORMANT' ||
            it.lastUsedStatus === 'STALE' ||
            it.lastUsedStatus === 'UNUSED_SINCE_INSTALL')
        ) {
          includeIds.push(it.id);
        }
      }
    } else if (wantsDesktopItems && /다\s*(?:지워|치워|정리|삭제)/i.test(q)) {
      for (const it of scanContext.items) {
        if (!it.isProtected && it.cat.startsWith('DESKTOP_')) {
          includeIds.push(it.id);
        }
      }
    } else {
      // 번호 없이 항목 이름을 직접 말한 경우("고클린 지워줘", "스크린샷 정리해줘") 스캔 목록에서 직접 매칭
      const qLow = q
        .replace(/(?:만|도|은|는|이|가|을|를)?\s*(?:다\s*)?(?:지워|삭제|제거|정리|치워|꺼|숨겨|골라).*$/i, '')
        .trim()
        .toLowerCase();
      if (qLow.length >= 2) {
        for (const it of scanContext.items) {
          if (!it.isProtected && it.name.toLowerCase().includes(qLow)) {
            includeIds.push(it.id);
          }
        }
      }
    }
    if (moveDrive && /다운로드/.test(q)) {
      const dl = scanContext.items.find((i) => /다운로드|download/i.test(i.name));
      if (dl) includeIds.push(dl.id);
    }
  } else if (wantsStaleAppsOnly) {
    for (const it of scanContext.items) {
      if (
        !it.isProtected &&
        it.cat === 'INSTALLED_APP' &&
        (it.lastUsedStatus === 'DORMANT' ||
          it.lastUsedStatus === 'STALE' ||
          it.lastUsedStatus === 'UNUSED_SINCE_INSTALL')
      ) {
        includeIds.push(it.id);
      }
    }
  } else if (wantsDesktopItems) {
    for (const it of scanContext.items) {
      if (!it.isProtected && it.cat.startsWith('DESKTOP_')) {
        includeIds.push(it.id);
      }
    }
  }

  const defaultAction: AgentCareMutatingAction =
    wantsSafeCacheOnly
      ? 'disk_hog_clean'
      : scanContext.scanKind === 'HIDDEN_RATS'
      ? 'hidden_rats_apply'
      : scanContext.scanKind === 'DESKTOP_DETAIL'
      ? 'desktop_batch_action'
      : scanContext.scanKind === 'DISK_HOG' || Boolean(moveDrive)
      ? 'disk_hog_clean'
      : 'batch_deep_uninstall';

  return {
    replyKo: moveDrive
      ? `말씀하신 대로 선택 항목을 **${moveDrive}\\귀신비서_보관함**으로 안전하게 옮길 준비를 마쳤어요! 아래 목록을 확인 후 실행해 주세요.`
      : excludeKeywords.length > 0 || excludeIds.length > 0
      ? `말씀하신 보존 항목은 안전하게 제외하고, 정리 권장 항목만 골라두었어요! 한 번 더 확인 후 실행해 주세요.`
      : `요청하신 기준에 맞춰 안전 정리 대상을 준비했어요! 아래 체크박스를 확인 후 실행해 주세요.`,
    readTools: [],
    mutatingPlan: {
      action: defaultAction,
      includeIds,
      excludeIds,
      excludeKeywords,
      moveDestinationDrive: moveDrive || undefined,
      reasonSummaryKo: moveDrive ? `${moveDrive} 드라이브 안전 이사 확인` : '취사선택 일괄 정리 최종 확인',
    },
    followUpSuggestions: ['응 진행해', '휴지통 비워줘'],
  };
}

/**
 * [배치 실행기 — 1회 확인 후 실제 Z-Core 도구 호출]
 */
function cleanCareRawErrorText(raw: string): string {
  return (raw || '')
    .replace(/\(\s*Command\s+'?\[[^\n)]+\]?'?\s+timed\s+out[^)]*\)/gi, '')
    .replace(/Command\s+'?\[[^\n]+\]?'?\s+timed\s+out[^\n.]*/gi, '')
    .replace(/\[WinError\s+\d+\][^\n.]*/gi, '')
    .replace(/Traceback\s*\(most recent call last\)[\s\S]*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function explainCareIncompleteReasonKo(rawErr: string | undefined, taskLabelKo: string): string {
  const r = String(rawErr || '');
  if (/timed?\s*out|시간\s*초과/i.test(r)) {
    return `ℹ️ **${taskLabelKo}** 중 윈도우 시스템 응답이 길어져 일부 항목은 안전을 위해 건너뛰었습니다(현재 열려 있는 프로그램을 닫은 뒤 다시 시도해 주세요).`;
  }
  if (/권한|uac|access\s+is\s+denied|액세스.*?거부|canceled|취소/i.test(r)) {
    return `ℹ️ **${taskLabelKo}**을(를) 진행하려면 윈도우 관리자 권한 확인 창에서 **[예]** 승인이 필요합니다(승인이 취소되어 원래 상태를 그대로 유지했습니다).`;
  }
  if (/사용\s*중|being\s+used|열려|locked/i.test(r)) {
    return `ℹ️ **${taskLabelKo}** 대상 중 현재 실행 중인 파일·프로그램이 있어 작업 보호를 위해 해당 항목은 건너뛰었습니다.`;
  }
  const cleaned = cleanCareRawErrorText(r);
  return cleaned
    ? `ℹ️ **${taskLabelKo} 안내**: ${cleaned}`
    : `ℹ️ **${taskLabelKo}** 대상이 이미 정리되어 있거나 현재 실행 중이라 안전하게 건너뛰었습니다.`;
}

export async function executeAgentCareBatchCard(
  card: MonsterAgentCareCardPayload,
  userApprovalText = '체크박스 확인 후 일괄 실행'
): Promise<{
  ok: boolean;
  reportKo: string;
  currentFreeGb?: number;
  projectedFreeAfterEmptyGb?: number;
}> {
  const selectedSet = new Set(card.selectedIds);
  const selectedItems = card.items.filter((it) => selectedSet.has(it.id) && !it.isProtected);
  const unselectedNames = card.items
    .filter((it) => !selectedSet.has(it.id) && !it.isProtected)
    .map((it) => it.name);
  const allExcluded = Array.from(new Set([...(card.excludedNames || []), ...unselectedNames]));

  // 전용 비-아이템 단일 액션 처리
  if (card.action === 'desktop_power_boost' && selectedItems.every((i) => i.cat === 'POWER_PLAN')) {
    const r = await callCareApi<any>('/api/care/desktop-power-boost', { userApprovalTypedText: userApprovalText }, 15000);
    return {
      ok: r.ok,
      reportKo: r.ok
        ? cleanCareRawErrorText(String(r.data?.message || '데스크톱 고성능 전원 모드로 전환했습니다!'))
        : explainCareIncompleteReasonKo(r.data?.message || r.error, '전원 모드 전환'),
    };
  }

  if (card.action === 'desktop_system_icon_toggle' && selectedItems.length === 0) {
    const iconIds = (card.visibleSystemIcons || []).map((i) => i.iconId);
    const targetId = iconIds[0] || 'user_files';
    const r = await callCareApi<any>('/api/care/desktop-icon-toggle', { iconId: targetId, hide: true }, 10000);
    return {
      ok: r.ok,
      reportKo: r.ok
        ? cleanCareRawErrorText(String(r.data?.message || '바탕화면 시스템 아이콘을 안전하게 숨겼습니다!'))
        : explainCareIncompleteReasonKo(r.data?.message || r.error, '바탕화면 아이콘 숨김'),
    };
  }

  // [P0-1 정공법] MULTI 복합 스캔에서도 단 1건의 누락이 없도록 선택된 항목을 실제 성격별 5대 버킷으로 분리해 순차 실행!
  const DISK_HOG_CATS = new Set([
    'SAFE_CACHE',
    'DESKTOP_HIBERFIL',
    'USER_FOLDER',
    'APP_DATA_HOG',
    'USER_LARGE_ITEM',
  ]);
  const ratItems = selectedItems.filter((i) => Boolean(i.ratKind));
  const diskHogItems = selectedItems.filter((i) => !i.ratKind && DISK_HOG_CATS.has(i.cat));
  const desktopItems = selectedItems.filter(
    (i) => !i.ratKind && !DISK_HOG_CATS.has(i.cat) && i.cat.startsWith('DESKTOP_')
  );
  const sleepItems = selectedItems.filter(
    (i) => !i.ratKind && !DISK_HOG_CATS.has(i.cat) && !i.cat.startsWith('DESKTOP_') && i.actionType === 'SECURITY_SLEEP'
  );
  const uninstallOrPupItems = selectedItems.filter(
    (i) =>
      !i.ratKind &&
      !DISK_HOG_CATS.has(i.cat) &&
      !i.cat.startsWith('DESKTOP_') &&
      i.actionType !== 'SECURITY_SLEEP' &&
      i.cat !== 'POWER_PLAN'
  );

  const reportBlocks: string[] = [];
  let anyOk = false;
  let updatedFreeGb: number | undefined;
  let updatedProjGb: number | undefined;

  // [병렬 고속 실행]: 서로 충돌하지 않는 버킷(스케줄러·서비스 / 안전 캐시 / 바탕화면 / 보안모듈 수면)을
  // 순차 대기 대신 Promise.all로 병렬 실행해 '안전 정리 실행 중...' 체감 대기 시간을 절반 이하로 단축합니다.
  const [rRat, rDisk, rDesk, rSlp] = await Promise.all([
    ratItems.length > 0
      ? callCareApi<any>(
          '/api/care/hidden-rats-apply',
          {
            disableTasks: ratItems.filter((i) => i.ratKind === 'SCHEDULED_TASK' && i.targetKey).map((i) => i.targetKey!),
            manualServices: ratItems.filter((i) => i.ratKind === 'WINDOWS_SERVICE' && i.targetKey).map((i) => i.targetKey!),
            disableStartups: ratItems.filter((i) => i.ratKind === 'STARTUP_ITEM' && i.targetKey).map((i) => i.targetKey!),
            stopProcesses: ratItems.filter((i) => i.ratKind === 'HIGH_MEM_PROCESS' && i.targetKey).map((i) => i.targetKey!),
            userApprovalTypedText: userApprovalText,
          },
          45000
        )
      : Promise.resolve(null),
    diskHogItems.length > 0
      ? callCareApi<any>(
          '/api/care/disk-hog-clean',
          {
            includeIds: diskHogItems.map((i) => i.id),
            excludeIds: card.excludedNames || [],
            moveDestinationDrive: card.moveDestinationDrive || '',
            userApprovalTypedText: userApprovalText,
          },
          60000
        )
      : Promise.resolve(null),
    desktopItems.length > 0 || (card.action === 'desktop_batch_action' && card.visibleSystemIcons?.length)
      ? (() => {
          const paths = desktopItems.map((i) => i.path || '').filter(Boolean);
          const isMove = Boolean(card.moveDestinationDrive);
          return callCareApi<any>(
            '/api/care/desktop-batch-action',
            {
              recyclePaths: isMove ? [] : paths,
              movePaths: isMove ? paths : [],
              moveDestinationDrive: card.moveDestinationDrive || 'D:',
              hideSystemIcons: card.visibleSystemIcons?.length && paths.length === 0 ? ['user_files'] : [],
              userApprovalTypedText: userApprovalText,
            },
            45000
          );
        })()
      : Promise.resolve(null),
    sleepItems.length > 0 || card.action === 'security_2tier_apply'
      ? callCareApi<any>('/api/care/sleep', { explicitOptIn: true }, 55000)
      : Promise.resolve(null),
  ]);

  if (rRat) {
    if (rRat.ok) anyOk = true;
    if (rRat.data?.reportKo) {
      reportBlocks.push(cleanCareRawErrorText(String(rRat.data.reportKo)));
    } else if (!rRat.ok) {
      reportBlocks.push(explainCareIncompleteReasonKo(rRat.data?.message || rRat.error, '백그라운드·자동실행 정리'));
    }
  }
  if (rDisk) {
    if (rDisk.ok) anyOk = true;
    if (rDisk.data?.reportKo || rDisk.data?.message) {
      reportBlocks.push(cleanCareRawErrorText(String(rDisk.data.reportKo || rDisk.data.message)));
    } else if (!rDisk.ok) {
      reportBlocks.push(explainCareIncompleteReasonKo(rDisk.error, '임시·용량 파일 정리'));
    }
    if (typeof rDisk.data?.currentFreeGb === 'number') updatedFreeGb = rDisk.data.currentFreeGb;
    if (typeof rDisk.data?.projectedFreeAfterEmptyGb === 'number') updatedProjGb = rDisk.data.projectedFreeAfterEmptyGb;
  }
  if (rDesk) {
    if (rDesk.ok) anyOk = true;
    if (rDesk.data?.reportKo) {
      reportBlocks.push(cleanCareRawErrorText(String(rDesk.data.reportKo)));
    } else if (!rDesk.ok) {
      reportBlocks.push(explainCareIncompleteReasonKo(rDesk.data?.message || rDesk.error, '바탕화면 정돈'));
    }
  }
  if (rSlp) {
    if (rSlp.ok) anyOk = true;
    if (rSlp.data?.toastMessage) {
      reportBlocks.push(`🌙 **[실사용 보안모듈 무삭제 수면 적용]**\n${cleanCareRawErrorText(String(rSlp.data.toastMessage))}`);
    } else if (!rSlp.ok) {
      reportBlocks.push(explainCareIncompleteReasonKo(rSlp.data?.message || rSlp.error, '상주 보안앱 절전'));
    }
  }

  // 버킷 4: 악성 PUP 적출 + 설치 앱 2-Pass 심층 제거 (MSI/설치기 경합 방지를 위해 단독 실행)
  const pupIds = uninstallOrPupItems.filter((i) => i.id.startsWith('pup_')).map((i) => i.id);
  const appNames = uninstallOrPupItems.filter((i) => !i.id.startsWith('pup_')).map((i) => i.name);
  if (appNames.length > 0 || pupIds.length > 0) {
    const rBatch = await callCareApi<any>(
      '/api/care/batch-deep-uninstall',
      {
        appNames,
        pupIds,
        excludeNames: allExcluded.slice(0, 20),
        userApprovalTypedText: userApprovalText,
      },
      120000
    );
    if (rBatch.ok) anyOk = true;
    if (rBatch.data?.reportKo) {
      reportBlocks.push(cleanCareRawErrorText(String(rBatch.data.reportKo)));
    } else if (!rBatch.ok) {
      reportBlocks.push(
        `ℹ️ **[프로그램 제거 안내]** 선택한 프로그램(${appNames.length + pupIds.length}건) 중 일부는 프로그램 자체 제거 확인 창이 닫혔거나 현재 실행 중이어서 안전하게 건너뛰었습니다. 실행 중인 창을 닫은 뒤 필요한 항목만 골라 다시 시도해 주세요.`
      );
    }
  }

  return {
    ok: anyOk,
    reportKo:
      reportBlocks.join('\n\n') ||
      (anyOk
        ? '선택하신 항목들을 깔끔하게 정리했습니다!'
        : selectedItems.length === 0
        ? '현재 선택된 정리 항목이 없거나 이미 모두 깨끗한 최신 상태입니다.'
        : '현재 대상 항목이 이미 최신 상태이거나 실행 중이어서 안전하게 원래 상태를 유지했습니다.'),
    currentFreeGb: updatedFreeGb,
    projectedFreeAfterEmptyGb: updatedProjGb,
  };
}

/**
 * 🌟 [초보자 질문 전용 제미니 설명기]
 * 유저가 스캔 목록을 보고 "3번이랑 5번이 뭐 하는 애들이야? 지워도 돼?", "이 중에 꼭 남겨야 할 거 알려줘"라고 되물었을 때,
 * 절대 삭제하지 않고 초보자 눈높이(비전문용어)로 정체·삭제 시 영향·추천 행동을 1:1 친절하게 설명합니다.
 */
export async function explainCareItemsWithGemini(params: {
  query: string;
  scanContext: AgentCareScanContext;
}): Promise<{ replyKo: string; followUpSuggestions: string[] }> {
  const { query, scanContext } = params;
  const matchedNums = Array.from(query.matchAll(/#?(\d+)\s*번?/g)).map((m) => Number(m[1]));
  const pickedByNumOrName =
    matchedNums.length > 0
      ? scanContext.items.filter((it) => matchedNums.includes(it.no))
      : scanContext.items.filter((it) => {
          const baseNm = it.name
            .replace(/\[.*?\]|\(.*?\)/g, ' ')
            .trim()
            .toLowerCase();
          return baseNm.length >= 2 && query.toLowerCase().includes(baseNm);
        });
  const scopedCtx: AgentCareScanContext =
    pickedByNumOrName.length > 0
      ? { ...scanContext, items: pickedByNumOrName.slice(0, 6) }
      : scanContext;
  const compactScan = serializeCompactScanContext(scopedCtx);

  const prompt = [
    '당신은 컴퓨터를 잘 모르는 일반인도 1초 만에 안심하고 결정할 수 있게 설명해 주는 『귀신같이』의 귀신비서입니다.',
    '아래 [질문 대상 항목]을 보고 유저가 물어본 항목만 콕 집어 쉬운 일상어로 간결하게 설명해 주세요.',
    '',
    '[설명 절대 원칙]:',
    '1. "안녕하세요! 컴퓨터를 귀신같이 잘 아는 친절한 비서예요", "지금부터 하나하나 설명해 드릴게요" 같은 자기소개·인사치레를 절대 쓰지 말고 첫 줄부터 바로 핵심 답변을 시작하세요.',
    '2. 유저가 특정 번호(예: 1번)나 특정 이름을 물어봤으면 오직 그 항목만 설명하고, 묻지 않은 다른 번호 항목들은 절대 나열하지 마세요.',
    '3. 개발/IT 전문용어(프로세스, 스케줄러, 레지스트리, DLL 등) 대신 초보자 일상어로 ① 무엇인지, ② 지워도 내 문서/업무에 안전한지, ③ [삭제 추천 / 안 지우고 재우기 추천 / 쓰시면 유지] 중 무엇이 좋은지 짧게 글머리(•)로 정리하세요.',
    '',
    compactScan,
    '',
    `[유저 질문]: "${query}"`,
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8500);
  try {
    const res = await fetch('https://os.sundreamer.app/api/ai/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': 'ghosti',
        'x-ai-account': 'beakes',
      },
      body: JSON.stringify({
        appId: 'ghosti',
        account: 'beakes',
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        config: {
          temperature: 0.25,
          maxOutputTokens: 700,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: controller.signal,
    });
    if (res.ok) {
      const data = await res.json();
      const text = String(data?.text || '').trim();
      if (text) {
        logGeminiCareTurnNonBlocking(query, text, 'item_explain');
        return {
          replyKo: text,
          followUpSuggestions: [
            '빨간색(삭제 안전) 표시된 것만 다 지워줘',
            '은행 보안모듈은 안 지우고 재워만 줘',
            'C드라이브 안전 캐시도 같이 정리해줘',
          ],
        };
      }
    }
  } catch {
    /* fallback below */
  } finally {
    clearTimeout(timer);
  }

  // 오프라인/타임아웃 폴백: 로컬 초보자 번역 사전으로 즉시 100% 친절 답변!
  const targetList = pickedByNumOrName.length > 0 ? pickedByNumOrName.slice(0, 6) : scanContext.items.slice(0, 6);
  const lines = [
    '궁금하신 항목들을 알기 쉽게 정리해 드릴게요!',
    ...targetList.map((it) => {
      const exp = explainCareItemForBeginner(it);
      return `• **#${it.no} ${it.name}** (${exp.safetyBadgeLabel}): ${exp.plainExplainKo}`;
    }),
    '보시고 **"체크된 것만 다 지워줘"** 또는 **"오캠이랑 4번은 빼고 나머지 다 지워줘"**처럼 편하게 말씀해 주세요!',
  ];
  return {
    replyKo: lines.join('\n'),
    followUpSuggestions: ['빨간색(삭제 안전) 항목만 다 지워줘', '은행 보안모듈은 잠재워만 줘'],
  };
}

/**
 * 유저 발화가 신규 '제미니 에이전트 자유 문답 + 다중 PC 정리' 트랙에 해당하는지 정밀 판별
 * - 비전문용어/일상 불만어("컴이 왜 이리 버벅거려", "이상한 거 깔렸나", "자꾸 뭐가 떠", "컴 좀 가볍게 청소하자")까지 모두 자동 인식!
 */
export function detectAgentCareIntent(
  clean: string,
  scanContext: AgentCareScanContext | null
): {
  matched: boolean;
  immediateReadTools: AgentCareReadTool[];
  preferredBucket?: CareNormalizedBucketId;
  subFocus?: CareSubFocus;
  needsGeminiMultiTurnFilter: boolean;
  needsGeminiExplainOnly: boolean;
  isSystemIconQuery: boolean;
  isPowerBoostQuery: boolean;
} {
  const emptyNoMatch = {
    matched: false,
    immediateReadTools: [] as AgentCareReadTool[],
    needsGeminiMultiTurnFilter: false,
    needsGeminiExplainOnly: false,
    isSystemIconQuery: false,
    isPowerBoostQuery: false,
  };

  // [P1-1] 복원 기록 조회·원복·실종 파일 구출·바탕화면 바로가기 생성·개별 시작프로그램 스위치·순정 백신 단독 검사는 전용 핸들러로 즉시 양보!
  if (
    /(복원\s*기록|복원\s*지점|히스토리|되돌려|되돌리|원복|원래대로|다시\s*켜\s*줘|(?:방금|아까|최근|이전|어제).*?(?:취소|복원|복구|되돌|지운|삭제한|사라진|없어진)|(?:사라진|없어진|날아간|방금\s*지운)\s*(?:파일|문서|사진))/i.test(
      clean
    )
  ) {
    return emptyNoMatch;
  }
  if (/바로가기|바탕화면에\s*꺼내|아이콘\s*만들|자주\s*가는\s*(?:카페|사이트|유튜브|은행)/i.test(clean)) {
    return emptyNoMatch;
  }
  if (
    !/애드웨어|보안\s*(?:모듈|프로그램|앱)|강제\s*종료|전체\s*점검/i.test(clean) &&
    /(시작\s*프로그램|자동\s*실행\s*(?:목록|프로그램)|부팅.*?(?:켜지는|실행되는)\s*(?:시작\s*)?(?:프로그램|앱|목록))/i.test(
      clean
    )
  ) {
    return emptyNoMatch;
  }
  if (
    !/애드웨어|그리드/i.test(clean) &&
    /(백신|디펜더|defender|바이러스|랜섬웨어|알약|어베스트|avast|v3\s*lite|usb.*?검사)/i.test(clean)
  ) {
    return emptyNoMatch;
  }
  if (
    /(보안\s*절전|즉시\s*(?:깨우|깨워)|알아서\s*재우고|안\s*지우고\s*(?:잠재우|재워)|은행\s*업무.*?(?:깨우|깨워)|보안\s*프로그램\s*(?:상태|확인|몇\s*개|원래대로|원복|복구|절전\s*해제)|안\s*쓰는\s*보안\s*(?:앱|프로그램|모듈)\s*완전\s*삭제|편의\s*기능\s*두\s*가지|비서\s*실적|실적\s*보고서|1초\s*압축\s*풀기|기본\s*압축\s*앱)/i.test(
      clean
    )
  ) {
    return emptyNoMatch;
  }
  if (/(임시\s*쓰레기|temp\s*폴더|temp\s*파일|크래시\s*덤프)/i.test(clean) && !/용량|c\s*드라이브/i.test(clean)) {
    return emptyNoMatch;
  }

  const hasRecentScan = Boolean(
    scanContext && scanContext.items.length > 0 && Date.now() - scanContext.updatedAt < 25 * 60 * 1000
  );

  // 1) 직전 스캔 목록의 실제 항목(#번호 / 항목명 / '이 중에 남겨야 할 거')을 물어볼 때만 설명 모드로 분기!
  //    ("다른 백신도 추천해 줘", "귀신검색이 뭐야?" 같은 일반 질문이 직전 바탕화면/스캔 목록 설명으로 잘못 빠지는 동문서답 100% 원천 차단!)
  const isQuestChipOrCpuRamAsk =
    clean === '좋아, 알려줘' ||
    clean === '좋아, 예쁘게 바꿔줘' ||
    /(?:cpu|메모리|램|ram).*(?:제일\s*많이|가장\s*많이|많이\s*쓰는|점유|먹는)/i.test(clean);
  const matchesAnyScannedItemName = Boolean(
    scanContext?.items.some((it) => {
      const baseNm = it.name
        .replace(/\[.*?\]|\(.*?\)/g, ' ')
        .trim()
        .toLowerCase();
      return baseNm.length >= 2 && clean.toLowerCase().includes(baseNm);
    })
  );
  const referencesScanListOrItem =
    /#?\d+\s*번/i.test(clean) ||
    matchesAnyScannedItemName ||
    /(?:이\s*중|위\s*목록|방금\s*목록|스캔\s*목록|이\s*항목|이\s*프로그램|이\s*앱|저거|이거|(?:꼭\s*)?(?:남겨야|놔둬야|지울\s*거|지워야\s*할\s*거|어떻게\s*골라))/i.test(
      clean
    );
  const isExplainQuestionText =
    !isQuestChipOrCpuRamAsk &&
    /(뭐야|뭔데|뭔가요|뭐예요|뭐\s*하는|무슨\s*(앱|프로그램|파일|폴더|기능|설정)|궁금|지워도\s*(돼|되|괜찮|안전)|삭제해도\s*(돼|되|괜찮)|없애도\s*(돼|되|괜찮)|꺼도\s*(돼|되|괜찮)|치워도\s*(돼|되|괜찮)|설명해|알려\s*줘|남겨야|놔둬야|지울\s*거\s*골라|어떻게\s*골라|멘붕|모르겠)/i.test(
      clean
    ) &&
    !/(빼고|제외하고|나머지\s*다|일괄\s*삭제|다\s*지워|옮겨\s*줘)/i.test(clean);
  const isPowerExplainQuestion =
    isExplainQuestionText && /(전원\s*(옵션|모드)|고성능\s*(모드|전원|전환))/i.test(clean);
  const isAskingExplain =
    (hasRecentScan && referencesScanListOrItem && isExplainQuestionText) || isPowerExplainQuestion;

  const isSystemIconQuery =
    /(wd\s*(폴더|아이콘)|사용자\s*폴더\s*(아이콘|숨겨|숨김|지워도|뭐야)|바탕화면\s*(시스템|특수)\s*아이콘)/i.test(
      clean
    );
  const isPowerBoostQuery =
    !isExplainQuestionText && /(전원\s*(옵션|모드).*?(고성능|바꿔|전환)|고성능\s*(모드|전원))/i.test(clean);

  const mentionsScannedItemForAction =
    hasRecentScan &&
    !isAskingExplain &&
    !isSystemIconQuery &&
    /(지워|삭제|제거|정리|치워|꺼|숨겨|옮겨|골라)/i.test(clean) &&
    matchesAnyScannedItemName;

  // 2) 직전 스캔 컨텍스트가 살아있고 유저가 취사선택·제외 필터("빼고", "놔두고", "나머지 다", "빨간색만 지워", "옮겨줘", "#3번", "오래 안 쓴 앱만 골라줘")를 말하는 경우
  const isMultiTurnFilter =
    hasRecentScan &&
    !isAskingExplain &&
    !isSystemIconQuery &&
    (mentionsScannedItemForAction ||
      /(빼고|제외|놔두고|놔둬|남기고|냅두고|말고|나머지\s*(?:다|전부|모두)?|빨간색|차단\s*권장|삭제\s*안전|안전\s*캐시만|수동\s*(?:전환|으로)|[d-zD-Z]\s*:?\s*드라이브|옮겨\s*(?:줘|주세요|라)?|이사\s*(?:해|시켜)?|#\d+|\d+\s*번|(?:만|골라서)\s*(?:지워|삭제|제거|정리|꺼|치워|숨겨|골라)|(?:오래\s*(?:동안\s*)?(?:안\s*쓴|안쓴|안\s*쓰는|안쓰는)|묵은)\s*(?:프로그램|앱|어플)\s*(?:만|다)\s*(?:골라|지워|삭제|정리)|체크(?:한|된)\s*(?:것|거|항목|프로그램|앱))/i.test(
        clean
      ));

  // 3) 『PC 손보기 4 + 1 정규 카테고리』 일상 자연어 매칭 (정해진 문구 없이 평소 말투로 말해도 100% 찰떡 인식!)
  // ③-A) 잊고 있던·오랫동안 안 쓴 프로그램 / 설치된 앱 조회·정리
  const isUnusedOrInstalledApps =
    /(?:오래\s*동안|오랫\s*동안|오래|한참|예전에|깔아\s*(?:놓고|두고)|묵은|잊고\s*있던|방치된|안\s*쓰고).*?(?:안\s*쓴|안쓴|안\s*쓰는|안쓰는|사용\s*안\s*(?:한|하는)|쓰지\s*않는|안\s*건드린)?\s*(?:프로그램|앱|어플|소프트웨어|거)/i.test(
      clean
    ) ||
    /(?:안\s*쓴|안쓴|안\s*쓰는|안쓰는|사용\s*안\s*(?:한|하는)|쓰지\s*않는|불필요한|쓸데없는|묵은)\s*(?:프로그램|앱|어플|소프트웨어)/i.test(
      clean
    ) ||
    /(?:설치된|설치돼\s*있는|깔린|깔려\s*있는)\s*(?:프로그램|앱|어플|소프트웨어)/i.test(clean);

  // ③-B) 저장공간·C드라이브·캐시 용량 확보
  const isDiskHog =
    /(?:[c-zC-Z]\s*드라이브|(?:저장\s*)?(?:용량|공간|하드|디스크|ssd)(?:이|가|은|는|도|을|를)?\s*(?:너무\s*|자꾸\s*|많이\s*|다\s*|좀\s*)?(?:부족|모자라|꽉|없|줄|찼|차서|안\s*남|확보|도둑|주범|정리|스캔|분석|체크|점검|확인|늘려|비워|청소|차지)|파일(?:이|가)?\s*안\s*(?:받아|열려|깔려|저장)|대용량\s*(?:폴더|파일|캐시|스캔|찾아|프로그램|앱)|캐시\s*(?:정리|청소|삭제|지워|스캔|비워)|최대\s*절전|hiberfil|크롬\s*캐시)/i.test(
      clean
    );

  // ② 광고·애드웨어·은행/관공서 보안앱 점검·정리 ("애드웨어 체크해줘", "이상한 광고창 떠", "은행 보안앱 정리" 등 전면 포괄)
  const isSecurity2Tier =
    /(?:애드웨어|스파이웨어|그리드|구라\s*제거|악성\s*(?:앱|프로그램)|광고\s*(?:프로그램|앱|어플|창|팝업|배너)|(?:이상한|모르는|수상한)\s*(?:창|팝업|광고|배너|앱|프로그램)|(?:은행|관공서|홈택스|키보드|웹)?\s*보안\s*(?:프로그램|모듈|앱|어플|서비스|쓰레기))/i.test(
      clean
    );

  // ④ 바탕화면·사진 정돈 ("바탕화면 정리해줘", "바탕화면 사진 정리", "중복 사진 정리" 등 전면 포괄)
  const isPhotoCleanupPhrase =
    /(?:바탕화면\s*사진|(?:중복|연사|흔들린|흐린|어질러진|스크린샷|캡처|영수증)\s*사진|사진\s*(?:정돈|정리|청소))/i.test(
      clean
    ) && !/찾아\s*줘|보여\s*줘|검색/i.test(clean);
  const isDesktopDetail =
    isPhotoCleanupPhrase ||
    /(?:바탕\s*화면|데스크탑\s*화면).*?(?:분석|보고|상세|구성|뭐\s*있|있나|있어|스캔|점검|체크|확인|정리|정돈|치워|청소|용량|지저분|어지러|더러|복잡|아이콘|파일|폴더|사진)/i.test(
      clean
    ) ||
    /^(?:바탕\s*화면|내\s*바탕\s*화면)\s*(?:좀\s*)?(?:봐\s*줘|정리|정돈|치워)?[.!?~]*$/i.test(clean);

  // ① 속도 높이기 (느려진 속도·메모리·부팅 자동실행·숨은 백그라운드)
  const isHiddenRatsOrSpeed =
    /(?:쥐새끼|몰래\s*(?:도|돌|켜|숨|깔)|숨은\s*(?:앱|프로그램|서비스|스케줄러|프로세스|악성|광고)|백그라운드.*?(?:전수|수색|조사|찾아|스캔|뭐\s*돌|정리|점검|체크)|수동\s*(?:전환|으로\s*바꿔)|예스파일|mspcmanager|edgeautolaunch)/i.test(
      clean
    ) ||
    /(?:속도|부팅|컴퓨터|컴터|피씨|pc|노트북|컴|화면|마우스|창).*?(?:느려|느린|느리|버벅|렉|무거워|무겁|답답|먹통|멈칫|빨라지|빠르게|속도\s*(?:높|올|개선|최적화))/i.test(
      clean
    ) ||
    /(?:왜\s*이리|왜\s*이렇게|너무|자꾸|요즘|갑자기)\s*(?:버벅|느려|무거워|답답|렉\s*걸|멈칫|멈춰|끊겨)/i.test(clean) ||
    /(?:메모리|램|ram|자동\s*실행|시작\s*프로그램|상주\s*(?:프로그램|앱|서비스)).*?(?:정리|줄여|비워|최적화|치워|꺼|끄|점검|체크|많이\s*(?:먹|쓰|차지))/i.test(
      clean
    );

  // 종합 점검 ("정기 점검", "내 PC 점검해줘", "컴퓨터 손 좀 봐줘", "전체 청소하자")
  const isCasualFullCheckup =
    /^(?:정기\s*점검|전체\s*점검|종합\s*점검|pc\s*점검|컴퓨터\s*점검|1초\s*건강\s*검진|건강\s*검진)/i.test(clean) ||
    /(?:컴퓨터|컴터|피씨|pc|노트북|컴).*?(?:가볍게|청소\s*(?:좀|하자|해)|정리\s*(?:좀|하자|해\s*줘)|손\s*좀\s*보|손보자|손봐|점검\s*(?:좀|해)|상태\s*(?:좀|봐)|전체.*?봐\s*줘)/i.test(
      clean
    ) ||
    /(?:창|팝업|광고|배너|뭐)(?:이|가)?\s*자꾸\s*(?:떠|뜨|나와|열려|돌아|켜져)|뭐\s*(?:지우면|삭제하면|정리하면)\s*(?:돼|좋아|될까)/i.test(
      clean
    );

  let preferredBucket: CareNormalizedBucketId | undefined;
  let subFocus: CareSubFocus | undefined;

  if (!isAskingExplain && !isMultiTurnFilter && !isSystemIconQuery && !isPowerBoostQuery) {
    if (isDesktopDetail) {
      preferredBucket = 'DESKTOP';
      subFocus = isPhotoCleanupPhrase ? 'PHOTO_CLEANUP' : 'DESKTOP_CLEAN';
    } else if (isUnusedOrInstalledApps) {
      preferredBucket = 'STORAGE';
      subFocus = 'UNUSED_APPS';
    } else if (isDiskHog) {
      preferredBucket = 'STORAGE';
      subFocus = 'DISK_SPACE';
    } else if (isSecurity2Tier) {
      preferredBucket = 'SECURITY';
      subFocus = 'ADWARE_SECURITY';
    } else if (isHiddenRatsOrSpeed) {
      preferredBucket = 'SPEED';
      subFocus = 'SPEED_SLOW';
    } else if (isCasualFullCheckup) {
      preferredBucket = undefined;
      subFocus = 'FULL_CHECKUP';
    }
  }

  // 『PC 손보기 4 + 1 정규 카테고리』 표준: 4대 영역 중 어느 것을 평소 말투로 시켜도
  // 5대 Read-Only 스캔을 병렬 실측해 상단 '4칸 요약 성적표'와 해당 칸 세부 내역(3대 안심 힌트 포함)을 한 번에 띄웁니다!
  const readTools: AgentCareReadTool[] = subFocus ? [...ALL_FOUR_PLUS_ONE_READ_TOOLS] : [];

  return {
    matched: readTools.length > 0 || isMultiTurnFilter || isAskingExplain || isSystemIconQuery || isPowerBoostQuery,
    immediateReadTools: readTools,
    preferredBucket,
    subFocus,
    needsGeminiMultiTurnFilter: isMultiTurnFilter,
    needsGeminiExplainOnly: isAskingExplain,
    isSystemIconQuery,
    isPowerBoostQuery,
  };
}
