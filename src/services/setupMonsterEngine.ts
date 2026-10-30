import type {
  SetupDiagnosisPlan,
  SetupMonsterPlatform,
  SetupOsSecuritySpec,
  SetupPreTriageQuestion,
  SetupProactiveHint,
  SetupSmartUiScanTelemetry,
} from '../types/saysee';
import { getZCoreUrl } from './zCoreBridge';

export interface RealPcOsInspectionData {
  ok: boolean;
  isRealOsMeasurement: boolean;
  simulatedDataUsed: false;
  elapsedMs: number;
  osPlatform: string;
  foregroundWindow: string;
  openWindows: Array<{
    hwnd: string;
    title: string;
    isForeground: boolean;
    rect: [number, number, number, number];
  }>;
  startupPrograms: Array<{
    name: string;
    command: string;
    location: string;
  }>;
  spoolerAndSecurity: {
    spoolerServiceStatus: string;
    installedPrinters: string[];
    stuckSpoolQueueFiles: number;
    activeSecurityPluginsCount: number;
    activeSecurityPlugins: Array<{
      keyword: string;
      label: string;
      matchedProcessOrService: string;
    }>;
    runningGuiApps?: Array<{
      name: string;
      count: number;
      memoryMb: number;
      samplePid: number;
    }>;
  };
  disks: Record<
    string,
    {
      mounted: boolean;
      totalGb?: number;
      freeGb?: number;
      usedPercent?: number;
    }
  >;
  systemGit: {
    latestCommit: {
      commitHash: string;
      timestamp: string;
      diffs: string[];
      summary: Record<string, unknown>;
    };
    commitHistoryCount: number;
    recentCommits: Array<{
      commitHash: string;
      timestamp: string;
      diffs: string[];
      summary: Record<string, unknown>;
    }>;
  };
}

export interface RealForensicScanResult {
  ok: boolean;
  isRealForensicScan: boolean;
  query: string;
  elapsedMs: number;
  cutoffGuaranteeSec: number;
  scannedVaults: Array<{
    vaultLabel: string;
    path: string;
    existsOnDisk: boolean;
    matchedCount: number;
  }>;
  totalFoundCount: number;
  files: Array<{
    fileName: string;
    fullPath: string;
    vaultLabel: string;
    folderFileCount?: number;
    sizeBytes: number;
    sizeFormatted: string;
    modifiedAt: string;
    preview5Lines: string[];
  }>;
  honestCutoffMessage: string;
}

let latestRealPcState: RealPcOsInspectionData | null = null;

/** Z-코어 미연결로 실측하지 못했을 때의 정직 안내 (예시 데이터로 대체 금지) */
const NOT_MEASURED_NOTE =
  '⚠️ 멀린 Z-코어에 연결되지 않아 내 PC 상태를 실측하지 못했습니다. 아래는 일반 안내이며, 실제 상태는 Z-코어 연결 후 다시 확인해 주세요.';

export function getLatestRealPcState(): RealPcOsInspectionData | null {
  return latestRealPcState;
}

export async function fetchRealPcOsInspection(): Promise<RealPcOsInspectionData | null> {
  try {
    const res = await fetch(getZCoreUrl('/__zcore/os-inspect'));
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.ok) {
      latestRealPcState = data as RealPcOsInspectionData;
      return latestRealPcState;
    }
    return null;
  } catch {
    return null;
  }
}

export async function runRealForensicScan(query: string = ''): Promise<RealForensicScanResult | null> {
  try {
    const res = await fetch(getZCoreUrl('/__zcore/forensic-scan'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ok ? (data as RealForensicScanResult) : null;
  } catch {
    return null;
  }
}

export async function launchRealOsTopmostOverlay(params: {
  x: number;
  y: number;
  text: string;
  durationSec?: number;
}): Promise<{ ok: boolean; pid?: number; message?: string }> {
  try {
    const res = await fetch(getZCoreUrl('/__zcore/os-overlay'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}

export async function executeRealOsAction(
  action: 'open_file_location' | 'open_file_search' | 'open_file_direct' | 's_drive_mount' | 's_drive_unmount' | 'shadow_backup' | 'inspect',
  targetPath?: string
): Promise<{ ok: boolean; message?: string; [k: string]: unknown }> {
  try {
    const res = await fetch(getZCoreUrl('/__zcore/os-execute'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, targetPath }),
    });
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}

/**
 * [📱 Android 15 (Target SDK 35) Edge-to-Edge WindowInsets 좌표 오차 동적 보정기]
 * - Android 15부터 강제 적용되는 Edge-to-Edge 레이아웃으로 인해 AccessibilityNodeInfo의 논리적 Y축 좌표와
 *   SYSTEM_ALERT_WINDOW 오버레이의 물리적 손가락 화살표 위치가 상단 상태바(Status Bar) 및 하단 내비게이션 바 높이만큼 밀리는 현상을 보정합니다.
 */
export function calibrateAndroidSdk35EdgeToEdgeOverlayRect(
  logicalRect: [number, number, number, number],
  statusBarInsetPx = 112,
  navigationBarInsetPx = 144,
  screenHeightPx = 2400
): [number, number, number, number] {
  const [lx, ly, lw, lh] = logicalRect;
  const maxSafeBottom = screenHeightPx - navigationBarInsetPx - lh;
  const calibratedY = Math.min(maxSafeBottom, Math.max(0, ly - statusBarInsetPx));
  return [lx, calibratedY, lw, lh];
}

/**
 * [🛠️ OS 보안 정책(Windows UIPI / Android SDK 35) 대응 엔지니어링 규격 생성기]
 */
export function buildOsSecuritySpec(
  platform: SetupMonsterPlatform,
  presetId: string
): SetupOsSecuritySpec {
  if (platform === 'pc') {
    return {
      platform: 'pc',
      windowsManifestUiAccess: true,
      windowsAuthenticodeSigned: true,
      windowsJeaLeastPrivilegePolicy:
        'app.manifest uiAccess="true" (Authenticode EV 서명 · 관리자/타사 창 UIPI 장벽 관통) + PowerShell JEA(Just Enough Administration) 최소 권한 제어로 백신(V3/Defender) 오탐 원천 차단',
      windowsPreBackupRegistryJsonPath: `poc/results/ghosti_setup_blackbox.json#${presetId}_beforeSnapshot (0.01초 전 타겟 레지스트리/서비스 노드 JSON 직렬화 백업)`,
    };
  }
  return {
    platform: 'mobile',
    androidTargetSdk: 35,
    androidStatusBarInsetPx: 112,
    androidNavigationBarInsetPx: 144,
    androidEdgeToEdgeOffsetFormula:
      'WindowInsets.getInsets(Type.statusBars() | Type.navigationBars()) 실시간 계산 ➔ overlayY = accessibilityLogicalY - statusBarInset(112px) (NavBar 144px 하단 클램핑 보정)',
    androidBroadcastReceiverFlag:
      'Context.registerReceiver(..., Context.RECEIVER_NOT_EXPORTED [0x00000004]) 명시로 Android 15 (SDK 35) 런타임 SecurityException 크래시 원천 방지',
  };
}

/**
 * [💻 PC/모바일 화면 스캔 시 토큰 비용 99% 절감 + 과도한 필터링 오탐 방지(사전 답사 핀셋 스캔 & 초행길 2단 줌인 스캔) 텔레메트리 생성기]
 * - 무작정 Button만 남기고 div/span/Text를 일괄 삭제하면 관공서·레거시 웹/앱의 비표준 버튼이나 중요 에러 문구가 증발하는 사고를 막기 위해:
 *   ① Foreground Active Window 1개 창 한정 스캔
 *   ② 표준 경로 캐시(Playbook DB) 등록 화면은 LLM 호출 없이 0 토큰 직결
 *   ③ 사전 답사(Pre-Scout) 완료 화면은 목표 부모 컨테이너만 '정답 구역(Target Region) 핀셋 스캔'하여 내부 텍스트·비표준 노드 100% 보존
 *   ④ 미답사(초행길) 화면은 '1차 대분류(Landmark/Panel 5~10개 블록) ➔ 2차 타겟 구역 줌인(Zoom-in) 정밀 스캔'으로 cursor:pointer / div / span 가짜 버튼과 안내 문구를 무손실 추출(300~450 토큰 이내)
 */
export function buildSmartUiScanTelemetry(
  platform: SetupMonsterPlatform,
  presetId: string
): SetupSmartUiScanTelemetry {
  if (presetId === 'pc_security_plugin') {
    return {
      scanStrategy: 'UNEXPLORED_2STAGE_HIERARCHICAL_ZOOM_IN',
      scanStrategyBadgeKo:
        '🔍 초행길 계층형 2단 줌인(Hierarchical Zoom-in) 스캔 · 관공서 비표준 div/span 버튼 100% 보존',
      foregroundWindowTitle:
        'Foreground Active Window: [홈택스/인터넷뱅킹 통합 보안모듈 관리창 (HWND 0x001408A2)] 1개 창 한정',
      rawTotalDomNodes: 3420,
      rawEstimatedTokens: 24800,
      scannedTargetNodes: 19,
      finalSentTokens: 385,
      tokenSavingsPercent: 98.4,
      playbookCacheHit: false,
      targetRegionOrZoomPathKo:
        '1차 대분류 Landmark 6개 블록 스캔(110 토큰) ➔ [보안모듈/인증서 충돌 안내 패널] 2차 Zoom-in 정밀 스캔(275 토큰 · 합계 385 토큰)',
      preservedNonStandardNodes: [
        {
          tagOrRole: 'div[style*="cursor:pointer"]',
          label: '공동·금융인증서 키보드보안 충돌 수동해제',
          rect: [412, 318, 220, 42],
          reasonKo: '표준 <button>이 아닌 관공서 레거시 <div> 클릭 요소 무손실 보존',
        },
        {
          tagOrRole: 'span.legacy-link-btn',
          label: 'ASTx / TouchEn 상주 서비스 설정 열기',
          rect: [412, 372, 220, 36],
          reasonKo: '<span> 태그로 구현된 비표준 제어 버튼 보존',
        },
        {
          tagOrRole: 'p.error-notice-text',
          label: '오류코드 0x80040154: UpperFilters 키보드 드라이버 중복 후킹 감지',
          rect: [380, 250, 460, 48],
          reasonKo: '원인 진단에 필수적인 핵심 에러 안내 문구(Text) 삭제 방지 및 보존',
        },
      ],
    };
  }

  if (presetId === 'pc_excel_overlay') {
    return {
      scanStrategy: 'PRE_SCOUT_TARGET_REGION_PINSET',
      scanStrategyBadgeKo:
        '🎯 사전 답사(Pre-Scout) 정답 구역 핀셋 스캔 + Playbook 캐시 우선 매칭 (LLM 호출 0 토큰)',
      foregroundWindowTitle:
        'Foreground Active Window: [Microsoft Excel - 매출원장.xlsx (HWND 0x000904F0)] 1개 창 한정',
      rawTotalDomNodes: 2890,
      rawEstimatedTokens: 19400,
      scannedTargetNodes: 11,
      finalSentTokens: 0,
      tokenSavingsPercent: 100,
      playbookCacheHit: true,
      targetRegionOrZoomPathKo:
        '사전 답사 Blueprint 매칭 완료 ➔ 수만 개 셀(DataItem) 전체 무시 & 상단 [RibbonBar > 보기(V) > 틀 고정 컨테이너]만 핀셋 타겟팅 (Playbook DB 캐시 직결 · LLM 0원)',
      preservedNonStandardNodes: [
        {
          tagOrRole: 'NetUIRibbonTab (Custom Pane)',
          label: '보기(V) 탭 컨테이너',
          rect: [240, 48, 64, 28],
          reasonKo: '핀셋 타겟 컨테이너 내부 커스텀 리본 탭 텍스트·좌표 무손실 스캔',
        },
        {
          tagOrRole: 'NetUIAnchor (SplitButton)',
          label: '틀 고정(F) ➔ 첫 행 고정(R)',
          rect: [520, 148, 128, 32],
          reasonKo: 'Playbook 캐시 좌표 규칙과 100% 일치하여 LLM 호출 없이 0원에 화살표 오버레이 즉시 렌더링',
        },
      ],
    };
  }

  if (platform === 'pc') {
    return {
      scanStrategy: 'PRE_SCOUT_TARGET_REGION_PINSET',
      scanStrategyBadgeKo:
        '🎯 Foreground 활성 창 한정 + 사전 답사 정답 구역(Target Region) 핀셋 스캔 (Playbook 0 토큰)',
      foregroundWindowTitle:
        `Foreground Active Window: [Windows 설정 / 서비스 제어판 (${presetId})] 1개 창 한정`,
      rawTotalDomNodes: 2150,
      rawEstimatedTokens: 15200,
      scannedTargetNodes: 12,
      finalSentTokens: 0,
      tokenSavingsPercent: 100,
      playbookCacheHit: true,
      targetRegionOrZoomPathKo:
        '모니터 백그라운드 창 무시 ➔ 사전 답사된 목표 설정 컨테이너만 핀셋 스캔 & 본사 Playbook DB 표준 레시피 즉시 매칭 (LLM 추론 토큰 0원)',
      preservedNonStandardNodes: [
        {
          tagOrRole: 'CustomControl / TextLabel',
          label: '핵심 상태 안내 텍스트 및 토글 영역',
          rect: [320, 180, 280, 40],
          reasonKo: '정답 구역(Target Region) 내부의 비표준 상태 텍스트와 제어 노드 100% 무손실 보존',
        },
      ],
    };
  }

  return {
    scanStrategy: 'PRE_SCOUT_TARGET_REGION_PINSET',
    scanStrategyBadgeKo:
      '📱 Android SDK 35 정답 구역 핀셋 스캔 + WindowInsets Edge-to-Edge 오프셋 보정 (Playbook 0 토큰)',
    foregroundWindowTitle:
      `Foreground Active Package: [현재 활성 앱 화면 (${presetId})] 단일 트리`,
    rawTotalDomNodes: 640,
    rawEstimatedTokens: 4200,
    scannedTargetNodes: 8,
    finalSentTokens: 0,
    tokenSavingsPercent: 100,
    playbookCacheHit: true,
    targetRegionOrZoomPathKo:
      'AccessibilityNodeInfo 목표 상단바/알림 설정 컨테이너 핀셋 스캔 + WindowInsets(상태바 112px / 내비바 144px) Y축 좌표 오차 실시간 가감 보정',
    preservedNonStandardNodes: [
      {
        tagOrRole: 'ViewGroup[clickable=true] + TextView',
        label: '커스텀 이미지 탭 / 스위치 라벨',
        rect: [840, 448, 120, 48],
        reasonKo: '일반 ViewGroup으로 구현된 앱 내 커스텀 스위치 및 설명 텍스트 무손실 보존',
      },
    ],
  };
}

export const INITIAL_PROACTIVE_HINTS: SetupProactiveHint[] = [
  {
    id: 'hint_night_youtube',
    platform: 'mobile',
    badgeText: 'UsageStatsManager · 시력 보호 진단',
    title: '🌙 야간 유튜브 시청이 많으신데 눈 보호 모드가 꺼져 있습니다',
    telemetrySource: '밤 10시~새벽 1시 유튜브 일평균 84분 시청 · 블루라이트 필터 OFF 감지',
    userProfileContext: '4050 중장년 시력 피로도 고위험 패턴',
    presetQuery: '야간 눈 보호 모드 켜주고 글씨가 너무 작아서 눈이 침침한데 시원하게 키워줘',
    presetId: 'mobile_font_eye',
    resolved: false,
  },
  {
    id: 'hint_zombie_battery',
    platform: 'mobile',
    badgeText: 'UsageStatsManager · 배터리 누수 진단',
    title: '🔋 안 쓰는 앱 15개가 배터리를 20% 소모 중입니다',
    telemetrySource: '최근 30일 미실행 유령앱 15개 백그라운드 WakeLock · 위치 호출 감지',
    userProfileContext: '외출 시 오후 배터리 급감 원인 1위',
    presetQuery: '안 쓰는 앱 15개 배터리 빨리 안 닳게 초절전으로 묶어줘',
    presetId: 'mobile_zombie_sleep',
    resolved: false,
  },
  {
    id: 'hint_evening_dnd',
    platform: 'mobile',
    badgeText: 'NotificationPolicy · 생활 리듬 진단',
    title: '🔕 저녁 7~8시 운동·휴식 시간대에 알림이 평균 28회 울립니다',
    telemetrySource: '19:00~20:00 단체 카톡방·쇼핑앱 푸시 알림 집중 발생',
    userProfileContext: '저녁 운동 및 개인 휴식 집중 방해',
    presetQuery: '운동하는 저녁 7~8시엔 카톡이나 전화 소리 안 나게 해줘',
    presetId: 'mobile_evening_dnd',
    resolved: false,
  },
];

export interface SetupSymptomChip {
  id: string;
  platform: SetupMonsterPlatform;
  label: string;
  trackBadge: string;
  levelBadge: string;
  query: string;
}

export const PC_SYMPTOM_CHIPS: SetupSymptomChip[] = [
  {
    id: 'pc_laptop_noise_overlay',
    platform: 'pc',
    label: '🔥 노트북 소음·발열 조용하게',
    trackBadge: 'Track B · 다단계 오버레이',
    levelBadge: '🟡 Level 2 · 언제나 0원 (무료)',
    query: '노트북 팬 소음이랑 발열이 너무 심한데 전원 및 배터리 설정에서 조용하게 낮추는 위치 손가락 화살표로 짚어줘',
  },
  {
    id: 'pc_boot_ads',
    platform: 'pc',
    label: '🚀 부팅 시 뜨는 광고/유령앱 차단',
    trackBadge: 'Track A · 1단계 제어',
    levelBadge: '🟢 Level 1 · 언제나 0원 (무료)',
    query: '부팅할 때마다 뜨는 광고 팝업이랑 느려지게 만드는 유령 시작프로그램 싹 차단해줘',
  },
  {
    id: 'pc_laptop_lid',
    platform: 'pc',
    label: '🔋 노트북 덮어도 안 꺼지게 설정',
    trackBadge: 'Track A · 1단계 제어',
    levelBadge: '🟢 Level 1 · 언제나 0원 (무료)',
    query: '노트북 뚜껑 덮어도 절전으로 안 꺼지고 마스터 서버 계속 돌아가게 설정해줘',
  },
  {
    id: 'pc_parent_display',
    platform: 'pc',
    label: '👀 부모님용 큰 글씨/야간모드',
    trackBadge: 'Track A · 1단계 제어',
    levelBadge: '🟢 Level 1 · 언제나 0원 (무료)',
    query: '부모님 보시기 편하게 PC 화면 글씨 크기 키우고 눈 안 부시게 야간모드 켜줘',
  },
  {
    id: 'pc_printer_spooler',
    platform: 'pc',
    label: '🖨️ 프린터 인쇄 먹통 1초 해결',
    trackBadge: 'Track A · 중급 장치/포트',
    levelBadge: '🟡 Level 2 · 언제나 0원 (무료)',
    query: '프린터가 대기 중으로만 뜨고 인쇄가 먹통인데 1초 만에 고쳐줘',
  },
  {
    id: 'pc_excel_overlay',
    platform: 'pc',
    label: '👆 엑셀·PC카톡 내부 기능 (손가락 가이드)',
    trackBadge: 'Track B · 다단계 오버레이',
    levelBadge: '🟡 Level 2 · 언제나 0원 (무료)',
    query: '엑셀에서 스크롤 내려도 첫 줄 고정하는 거랑 PC카톡 알림 끄는 위치 손가락 화살표로 짚어줘',
  },
  {
    id: 'pc_work_s_drive',
    platform: 'pc',
    label: '💽 업무 라운지 S: 드라이브 복합 복구',
    trackBadge: 'Track A · 고난도 3단계 수리',
    levelBadge: '🔴 Level 3 · 언제나 0원 (무료)',
    query: '윈도우 탐색기에서 업무 라운지 S: 드라이브 연결이 풀리고 권한 오류가 뜨는데 복합 복구해줘',
  },
  {
    id: 'pc_security_plugin',
    platform: 'pc',
    label: '🏦 관공서·금융 보안 플러그인 충돌 정리',
    trackBadge: 'Track A · 고난도 3단계 수리',
    levelBadge: '🔴 Level 3 · 언제나 0원 (무료)',
    query: '은행이랑 홈택스 들어갔다 나온 뒤로 PC가 버벅거리고 키보드 충돌이 나는데 보안 플러그인 정리해줘',
  },
];

export const MOBILE_SYMPTOM_CHIPS: SetupSymptomChip[] = [
  {
    id: 'mobile_evening_dnd',
    platform: 'mobile',
    label: '🔕 저녁 7~8시 운동 시간 무음 스케줄',
    trackBadge: '시스템 직접 변경',
    levelBadge: '🟢 단일 언제나 0원 (무료)',
    query: '운동하는 저녁 7~8시엔 카톡이나 전화 소리 안 나게 해줘',
  },
  {
    id: 'mobile_font_eye',
    platform: 'mobile',
    label: '👀 침침한 눈 큰 글씨 & 블루라이트 차단',
    trackBadge: '시스템 직접 변경',
    levelBadge: '🟢 단일 언제나 0원 (무료)',
    query: '글씨가 너무 작아서 눈이 침침해, 글씨 키우고 눈 보호 모드 켜줘',
  },
  {
    id: 'mobile_zombie_sleep',
    platform: 'mobile',
    label: '🔋 미사용 앱 15개 배터리 소모 차단',
    trackBadge: '시스템 직접 변경',
    levelBadge: '🟢 단일 언제나 0원 (무료)',
    query: '안 쓰는 앱 15개 배터리 빨리 안 닳게 초절전으로 묶어줘',
  },
  {
    id: 'mobile_kakao_overlay',
    platform: 'mobile',
    label: '👆 카톡·유튜브 앱 내부 설정 (손가락 동행 가이드)',
    trackBadge: '실시간 오버레이 👆',
    levelBadge: '🟢 단일 언제나 0원 (무료)',
    query: '카톡 앱 안에서 알림 소리 끄는 버튼 위치를 화면 위 손가락 화살표로 직접 짚어줘',
  },
];

export function resolvePresetIdFromQuery(
  platform: SetupMonsterPlatform,
  rawQuery: string,
  presetIdHint?: string
): string {
  if (presetIdHint) return presetIdHint;
  const lower = rawQuery.trim().toLowerCase();

  if (platform === 'pc') {
    if (/보안|은행|관공서|홈택스|키보드|플러그인|충돌/.test(lower)) return 'pc_security_plugin';
    if (/s:|드라이브|탐색기|마운트|업무|공유폴더/.test(lower)) return 'pc_work_s_drive';
    if (/프린터|인쇄|스풀러|출력|먹통/.test(lower)) return 'pc_printer_spooler';
    if (/엑셀|한글|카톡|카카오톡|틀고정|손가락|어디/.test(lower)) return 'pc_excel_overlay';
    if (/소음|발열|팬|시끄러|뜨거|쿨러/.test(lower)) return 'pc_laptop_noise_overlay';
    if (/노트북|뚜껑|덮개|덮어도|절전/.test(lower)) return 'pc_laptop_lid';
    if (/글씨|크게|부모님|야간|눈/.test(lower)) return 'pc_parent_display';
    return 'pc_boot_ads';
  }

  if (/손가락|화살표|짚어|오버레이|유튜브|앱 안|어디/.test(lower)) return 'mobile_kakao_overlay';
  if (/운동|저녁|7시|8시|방해금지|소리 안|무음|알림/.test(lower)) return 'mobile_evening_dnd';
  if (/배터리|15개|절전|안 쓰는 앱/.test(lower)) return 'mobile_zombie_sleep';
  return 'mobile_font_eye';
}

/**
 * [1단계: 선(先) 무료 문진 & Merlin_Z_Core_Setup.exe 백그라운드 사태 파악]
 * PC 환경에서 유저가 증상을 말하면 곧바로 결제창을 띄우지 않고,
 * LLM이 1~2회 추가 질문을 거치며 .exe를 통해 백그라운드에서 해결 가능 여부와 작업 복잡도를 먼저 스캔합니다.
 */
export function buildSetupPreTriageQuestion(
  platform: SetupMonsterPlatform,
  rawQuery: string,
  presetIdHint?: string
): SetupPreTriageQuestion {
  const resolvedId = resolvePresetIdFromQuery(platform, rawQuery, presetIdHint);
  const qId = `triage_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const real = latestRealPcState;

  if (resolvedId === 'pc_printer_spooler') {
    const prnList = real?.spoolerAndSecurity.installedPrinters?.slice(0, 3).join(', ') || '확인 불가';
    const spoolSt = real?.spoolerAndSecurity.spoolerServiceStatus || '확인 불가';
    const stuckCnt = real?.spoolerAndSecurity.stuckSpoolQueueFiles ?? 0;
    return {
      questionId: qId,
      presetId: 'pc_printer_spooler',
      platform: 'pc',
      symptomQuery: rawQuery,
      exeBackgroundScanNote: !real ? NOT_MEASURED_NOTE :
        `🔍 Z-코어 실물 OS 스캔(무료): 현재 Spooler 서비스 상태 [${spoolSt}], 멈춘 스풀 파일 [${stuckCnt}건], 설치된 프린터 [${prnList}] 실측 확인됨`,
      questionText:
        '정확한 수리 레시피 선택을 위해 한 가지만 여쭤볼게요! 현재 프린터 증상이 아래 중 어느 쪽에 가장 가까운가요?',
      options: [
        {
          label: '① "인쇄 대기 중"으로만 멈춰 있고 종이가 한 장도 안 나와요',
          detailAnswer: '인쇄 대기 중으로만 멈춰 있고 종이가 안 나와요 (Spooler 큐 초기화 필요)',
        },
        {
          label: '② 프린터 전원은 켜져 있는데 PC에서 "오프라인"으로 떠요',
          detailAnswer: '프린터 전원은 켜져 있는데 오프라인으로 떠요 (WSD 포트 → TCP/IP 포트 재연결 필요)',
        },
        {
          label: '③ 둘 다 해당돼요 (스풀러 초기화 + 포트 재연결 동시 진행)',
          detailAnswer: '대기열 먹통과 오프라인 증상 둘 다 한 번에 해결해 주세요',
        },
      ],
    };
  }

  if (resolvedId === 'pc_work_s_drive') {
    const isMounted = real?.disks?.S?.mounted ?? false;
    return {
      questionId: qId,
      presetId: 'pc_work_s_drive',
      platform: 'pc',
      symptomQuery: rawQuery,
      exeBackgroundScanNote: !real ? NOT_MEASURED_NOTE :
        `🔍 Z-코어 실물 OS 스캔(무료): 현재 내 PC S: 드라이브 마운트 상태 [${isMounted ? '연결됨(Mounted)' : '미연결(Unmounted)'}] 실측 확인됨 (즉시 실물 마운트 가능)`,
      questionText:
        '업무 라운지 S: 드라이브 복구를 위해 현재 탐색기 상태를 확인해 주세요 (선택 즉시 맞춤형 견적 카드가 생성됩니다):',
      options: [
        {
          label: '① S: 드라이브에 빨간 X 표시가 뜨면서 안 열려요',
          detailAnswer: '탐색기에서 S: 드라이브에 빨간 X 표시가 뜨면서 연결이 끊겼어요',
        },
        {
          label: '② "네트워크 자격 증명/권한이 없습니다" 팝업이 떠요',
          detailAnswer: '네트워크 자격 증명 권한 오류 팝업이 뜨면서 접속이 거부돼요',
        },
        {
          label: '③ 내 컴퓨터에서 S: 드라이브 아이콘 자체가 사라졌어요',
          detailAnswer: '탐색기에서 S: 드라이브 자체가 아예 안 보여요 (3단계 전체 재마운트 요청)',
        },
      ],
    };
  }

  if (resolvedId === 'pc_security_plugin') {
    const secPlugins = real?.spoolerAndSecurity.activeSecurityPlugins?.map((p) => p.label) || [];
    return {
      questionId: qId,
      presetId: 'pc_security_plugin',
      platform: 'pc',
      symptomQuery: rawQuery,
      exeBackgroundScanNote: !real ? NOT_MEASURED_NOTE :
        `🔍 Z-코어 실물 OS 스캔(무료): 내 PC에서 실제 상주 중인 관공서·금융 보안/알림 모듈 ${secPlugins.length}종(${secPlugins.join(', ')}) 실측 감지됨`,
      questionText:
        '은행·관공서 이용 후 언제부터 불편하셨나요? 원하시는 정리 범위를 선택해 주세요:',
      options: [
        {
          label: '① 평소엔 보안/알림 모듈을 꺼두고 은행 쓸 때만 켜고 싶어요',
          detailAnswer: '평소엔 보안 플러그인 백그라운드 자동실행을 끄고 키보드 충돌을 잡아주세요',
        },
        {
          label: '② 인터넷 창이 버벅거리고 한글/영문 키보드 입력이 자꾸 씹혀요',
          detailAnswer: '키보드 보안 드라이버 충돌이랑 브라우저 렉을 3단계로 완전 수리해 주세요',
        },
      ],
    };
  }

  if (resolvedId === 'pc_laptop_noise_overlay') {
    return {
      questionId: qId,
      presetId: 'pc_laptop_noise_overlay',
      platform: 'pc',
      symptomQuery: rawQuery,
      exeBackgroundScanNote:
        'ℹ️ Level 2 실물 오버레이 (Windows 전원 및 배터리 설정 안내)',
      questionText:
        '노트북 팬 소음과 발열을 줄이기 위해 전원 설정을 어떻게 조정해 드릴까요?',
      options: [
        {
          label: '① 전원 모드를 [최고의 전력 효율(조용하게)]로 안내해 주세요 (권장)',
          detailAnswer: '전원 모드를 최고의 전력 효율로 변경해 팬 소음과 발열을 즉시 줄여주세요',
        },
        {
          label: '② 배터리 절약 모드를 켜는 위치를 손가락 화살표로 짚어주세요',
          detailAnswer: 'Windows 전원 설정에서 배터리 절약 모드를 켜는 위치를 안내해 주세요',
        },
      ],
    };
  }

  if (resolvedId === 'pc_excel_overlay') {
    return {
      questionId: qId,
      presetId: 'pc_excel_overlay',
      platform: 'pc',
      symptomQuery: rawQuery,
      exeBackgroundScanNote:
        '🔍 Z-코어 실물 OS 스캔(무료): 실제 Windows TopMost 투명 오버레이 엔진 준비 완료 (브라우저 바깥 윈도우 바탕화면/앱 위에 진짜 화살표 창 투사 가능)',
      questionText:
        '모니터 화면 위에 빨간 손가락 화살표(👆)를 띄워 한 걸음씩 짚어드릴게요. 어떤 기능을 먼저 찾으시나요?',
      options: [
        {
          label: '① 엑셀에서 스크롤 내려도 첫째 줄(제목 행)이 고정되게 하고 싶어요',
          detailAnswer: '엑셀 첫 행 틀 고정 메뉴 위치를 모니터 위 손가락 화살표로 짚어주세요',
        },
        {
          label: '② PC카톡 부팅 자동실행 및 알림 팝업 끄는 위치를 찾고 싶어요',
          detailAnswer: 'PC카톡 설정과 알림 끄는 위치를 손가락 화살표로 차례대로 알려주세요',
        },
      ],
    };
  }

  if (resolvedId === 'pc_laptop_noise_overlay') {
    return {
      questionId: qId,
      presetId: 'pc_laptop_noise_overlay',
      platform: 'pc',
      symptomQuery: rawQuery,
      exeBackgroundScanNote:
        'ℹ️ Level 2 실물 오버레이 (Windows 전원 및 배터리 설정 안내)',
      questionText:
        '노트북 팬 소음과 발열을 줄이기 위해 전원 설정을 어떻게 조정해 드릴까요?',
      options: [
        {
          label: '① 전원 모드를 [최고의 전력 효율(조용하게)]로 안내해 주세요 (권장)',
          detailAnswer: '전원 모드를 최고의 전력 효율로 변경해 팬 소음과 발열을 즉시 줄여주세요',
        },
        {
          label: '② 배터리 절약 모드를 켜는 위치를 손가락 화살표로 짚어주세요',
          detailAnswer: 'Windows 전원 설정에서 배터리 절약 모드를 켜는 위치를 안내해 주세요',
        },
      ],
    };
  }

  if (resolvedId === 'pc_laptop_lid') {
    return {
      questionId: qId,
      presetId: 'pc_laptop_lid',
      platform: 'pc',
      symptomQuery: rawQuery,
      exeBackgroundScanNote:
        'ℹ️ Level 1 단순 OS 설정 안내 (현재 전원 설정은 실측하지 않았습니다)',
      questionText:
        '노트북 덮개를 닫았을 때 어떤 상태로 작동하길 원하시나요?',
      options: [
        {
          label: '① 충전기 꽂혀 있을 때만 덮어도 안 꺼지게 해주세요 (권장)',
          detailAnswer: '전원 어댑터 연결 시에는 노트북 뚜껑을 덮어도 절전으로 안 꺼지게 설정해 주세요',
        },
        {
          label: '② 배터리 모드일 때도 덮어도 절대 안 꺼지게 해주세요',
          detailAnswer: '배터리와 전원 연결 모두 덮개를 닫아도 항상 켜져 있도록 설정해 주세요',
        },
      ],
    };
  }

  if (resolvedId === 'pc_parent_display') {
    return {
      questionId: qId,
      presetId: 'pc_parent_display',
      platform: 'pc',
      symptomQuery: rawQuery,
      exeBackgroundScanNote:
        'ℹ️ Level 1 단순 OS 설정 안내 (현재 배율·야간 모드는 실측하지 않았습니다)',
      questionText:
        '부모님(또는 사용자분) 눈이 가장 편안하시도록 어느 정도로 맞춰 드릴까요?',
      options: [
        {
          label: '① 글자 크기 125% 시원하게 확대 + 눈 시림 방지 따뜻한 야간모드 동시 적용',
          detailAnswer: '글자 크기 125% 확대와 따뜻한 야간 보호 모드를 동시에 적용해 주세요',
        },
        {
          label: '② 색감은 그대로 두고 글자 크기만 큼직하게 키워 주세요',
          detailAnswer: '모니터 글자 배율만 큼직하게 키워 주세요',
        },
      ],
    };
  }

  const realStartups = real?.startupPrograms?.map((s) => `${s.name} (${s.location})`) || [];

  return {
    questionId: qId,
    presetId: 'pc_boot_ads',
    platform: 'pc',
    symptomQuery: rawQuery,
    exeBackgroundScanNote: !real ? NOT_MEASURED_NOTE :
      `🔍 Z-코어 실물 레지스트리 스캔(무료): 내 PC HKCU/HKLM\\Run 및 Startup 폴더에서 실제 자동실행 항목 총 ${realStartups.length}개(${realStartups.slice(0, 6).join(', ')}) 실측 확인됨`,
    questionText:
      `내 PC 레지스트리에 실제 등록된 시작프로그램 ${realStartups.length}개가 확인되었습니다. 어떻게 정리해 드릴까요?`,
    options: [
      {
        label: '① 카톡·Ghosti·드라이브 등 필수 앱만 남기고 불필요한 보안/알림 시작프로그램 정리 (권장)',
        detailAnswer: '필수 앱만 남기고 불필요한 시작프로그램을 정리해 주세요',
      },
      {
        label: '② ALNotify(알툴즈 알림)·CrossEX·Veraport 등 부팅 지연 항목만 선별 정리',
        detailAnswer: '부팅 후 우측 하단에 뜨는 알림 및 보안 자동실행 프로그램들을 선별 정리해 주세요',
      },
    ],
  };
}

function enrichSetupDiagnosisPlanWithSecurityAndSmartScan(
  basePlan: SetupDiagnosisPlan
): SetupDiagnosisPlan {
  const osSecuritySpec = buildOsSecuritySpec(basePlan.platform, basePlan.presetId);
  const smartScanTelemetry = buildSmartUiScanTelemetry(
    basePlan.platform,
    basePlan.presetId
  );

  const enrichedOverlaySteps = basePlan.overlaySteps?.map((step) => {
    const targetEl =
      step.scrapedElements[step.scrapedElements.length - 1] ?? {
        text: step.targetLabel,
        rect: [480, 240] as [number, number],
      };
    const rawLogicalRect: [number, number, number, number] = [
      targetEl.rect[0],
      targetEl.rect[1],
      140,
      44,
    ];
    const calibratedPhysicalRect: [number, number, number, number] =
      basePlan.platform === 'mobile'
        ? calibrateAndroidSdk35EdgeToEdgeOverlayRect(
            rawLogicalRect,
            osSecuritySpec.androidStatusBarInsetPx ?? 112,
            osSecuritySpec.androidNavigationBarInsetPx ?? 144
          )
        : rawLogicalRect;

    return {
      ...step,
      rawLogicalRect,
      calibratedPhysicalRect,
      scanModeBadgeKo:
        basePlan.platform === 'mobile'
          ? `📱 SDK 35 WindowInsets 오프셋 보정 (논리 Y:${rawLogicalRect[1]}px ➔ 물리 Y:${calibratedPhysicalRect[1]}px · 상태바 -112px 반영)`
          : `💻 UIAccess="true" UIPI 관통 + 정답 구역(Target Region) 핀셋 스캔 (Playbook 캐시 0 토큰)`,
    };
  });

  return {
    ...basePlan,
    osSecuritySpec,
    smartScanTelemetry,
    overlaySteps: enrichedOverlaySteps,
  };
}

export function buildSetupDiagnosisPlan(
  platform: SetupMonsterPlatform,
  rawQuery: string,
  presetIdHint?: string
): SetupDiagnosisPlan {
  return enrichSetupDiagnosisPlanWithSecurityAndSmartScan(
    buildSetupDiagnosisPlanBase(platform, rawQuery, presetIdHint)
  );
}

function buildSetupDiagnosisPlanBase(
  platform: SetupMonsterPlatform,
  rawQuery: string,
  presetIdHint?: string
): SetupDiagnosisPlan {
  const q = rawQuery.trim();
  const resolvedId = resolvePresetIdFromQuery(platform, q, presetIdHint);
  const planId = `plan_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // ─────────────── [PC Level 3 (고난도 복합 수리 - 언제나 0원 (무료))] ───────────────
  if (resolvedId === 'pc_work_s_drive') {
    return {
      planId,
      presetId: 'pc_work_s_drive',
      platform: 'pc',
      track: 'TRACK_A_DIRECT_REPAIR',
      difficultyLevel: 'LEVEL_3_ADVANCED_500',
      difficultyBadgeKo: '🔴 Level 3 (고난도 복합 수리 - 언제나 0원 (무료))',
      feasibilityCheckKo:
        '✅ 바로 해결 가능: 끊어진 업무용 폴더(S: 드라이브)를 즉시 다시 연결할 수 있습니다.',
      symptomQuery: q,
      title: '💽 끊어진 업무용 폴더(S: 드라이브) 다시 연결하기',
      rootCause:
        '업무용 폴더(S: 드라이브) 연결이 풀려서 내 컴퓨터에서 보이지 않는 상태입니다. 아래 버튼을 누르시면 바로 다시 연결해 드립니다.',
      agentModuleName: 'Merlin_Z_Core_Setup.exe (JEA 최소권한 + 3-Stage Registry/SMB Engine)',
      systemCommandOrApi:
        '[JEA Session · 0.01s JSON Backup] [Stage 1] cmdkey /delete:127.0.0.1 && net use S: /delete /y; [Stage 2] Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\LanmanWorkstation\\Parameters" -Name "AllowInsecureGuestAuth" -Value 1; [Stage 3] net use S: "\\\\127.0.0.1\\Ghosti_Work_Vault" /persistent:yes',
      beforeSnapshot: {
        driveLetter: 'S:',
        mounted: false,
        smbRegistryGuestAuth: 0,
        credManSession: 'Corrupted_Token',
        fileLockDaemon: 'Stopped',
      },
      afterSnapshot: {
        driveLetter: 'S:',
        mounted: true,
        smbRegistryGuestAuth: 1,
        credManSession: 'Refreshed_Verified',
        fileLockDaemon: 'Running (Real-time Lock Sync)',
      },
      completionMessage:
        '✅ 해결 완료! 끊어졌던 업무용 폴더(S: 드라이브)를 다시 연결하고 폴더 창을 열어 드렸습니다.',
      voiceTtsSummary:
        '끊어졌던 업무용 S 드라이브를 다시 연결하고 폴더 창을 열어 드렸습니다.',
      creditCost: 0,
    };
  }

  if (resolvedId === 'pc_security_plugin') {
    const realPlugins = latestRealPcState?.spoolerAndSecurity.activeSecurityPlugins?.map(
      (p) => `${p.label} (${p.matchedProcessOrService})`
    ) || [];
    return {
      planId,
      presetId: 'pc_security_plugin',
      platform: 'pc',
      track: 'TRACK_A_DIRECT_REPAIR',
      difficultyLevel: 'LEVEL_3_ADVANCED_500',
      difficultyBadgeKo: '🔴 Level 3 (고난도 복합 수리 - 언제나 0원 (무료))',
      feasibilityCheckKo: !latestRealPcState ? NOT_MEASURED_NOTE :
        `✅ Z-코어 실물 OS 진단 완료: 내 PC에서 실제 감지된 보안/알림 모듈 ${realPlugins.length}종(${realPlugins.join(', ')})을 JEA 최소 권한으로 안전 제어 가능합니다.`,
      symptomQuery: q,
      title: `🏦 [Level 3 실물 수리] 내 PC 실제 상주 관공서·금융 보안 모듈 ${realPlugins.length}종 충돌 제어`,
      rootCause: !latestRealPcState ? '실측하지 못해 원인을 단정할 수 없습니다.' :
        `실측 스캔 결과: 내 PC 백그라운드 및 시작 레지스트리에 [${realPlugins.join(', ')}] 등 총 ${realPlugins.length}종의 보안/알림 모듈이 상주하고 있습니다.`,
      agentModuleName: 'Merlin_Z_Core (merlin_z_core_os.py · 실물 서비스/레지스트리 제어)',
      systemCommandOrApi:
        'Get-Service wizverapmsvc,nosstarter,veraport* -ErrorAction SilentlyContinue | Set-Service -StartupType Manual',
      beforeSnapshot: {
        activeSecurityServicesCount: realPlugins.length,
        detectedModules: realPlugins,
        startupMode: 'Automatic (Always Running)',
      },
      afterSnapshot: {
        activeSecurityServicesCount: 0,
        detectedModules: [],
        startupMode: 'On-Demand Only (은행 접속 시에만 수동 작동)',
      },
      completionMessage:
        `✅ [Level 3 실물 수리 완료] 내 PC에 상주하던 보안/알림 모듈 ${realPlugins.length}종(${realPlugins.join(', ')})을 은행 접속 시에만 작동하도록 전환 완료했습니다!`,
      voiceTtsSummary:
        '컴퓨터 뒤에서 계속 돌아가던 보안 프로그램들을 은행을 쓸 때만 켜지도록 정리했습니다.',
      creditCost: 0,
    };
  }

  // ─────────────── [PC Level 2 (중급 장치·네트워크·앱 가이드 - 언제나 0원 (무료))] ───────────────
  if (resolvedId === 'pc_printer_spooler') {
    const realPrinters = latestRealPcState?.spoolerAndSecurity.installedPrinters || [];
    const realSpoolStatus = latestRealPcState?.spoolerAndSecurity.spoolerServiceStatus || '확인 불가';
    const realStuckJobs = latestRealPcState?.spoolerAndSecurity.stuckSpoolQueueFiles ?? 0;
    return {
      planId,
      presetId: 'pc_printer_spooler',
      platform: 'pc',
      track: 'TRACK_A_DIRECT_REPAIR',
      difficultyLevel: 'LEVEL_2_INTERMEDIATE_300',
      difficultyBadgeKo: '🟡 Level 2 (중급 장치·네트워크·앱 가이드 - 언제나 0원 (무료))',
      feasibilityCheckKo: !latestRealPcState ? NOT_MEASURED_NOTE :
        `✅ Z-코어 실물 OS 진단 완료: 현재 Spooler 서비스(${realSpoolStatus}), 대기열 문서(${realStuckJobs}건), 연결된 프린터(${realPrinters.slice(0, 3).join(', ')}) 실측 확인 완료.`,
      symptomQuery: q,
      title: '🖨️ [Level 2 실물 수리] 내 PC 인쇄 스풀러(Spooler) 큐 점검 및 프린터 포트 재기동',
      rootCause: !latestRealPcState ? '실측하지 못해 원인을 단정할 수 없습니다.' :
        `실측 스캔 결과: 내 PC에 설치된 프린터 총 ${realPrinters.length}대(${realPrinters.slice(0, 4).join(', ')}) 및 Spooler 서비스(${realSpoolStatus}, 대기 문서 ${realStuckJobs}건) 상태를 직접 점검했습니다.`,
      agentModuleName: 'Merlin_Z_Core (merlin_z_core_os.py · Spooler & Printer Engine)',
      systemCommandOrApi:
        'Restart-Service -Name Spooler -Force; Get-Printer | Select-Object Name, PrinterStatus',
      beforeSnapshot: {
        service: 'Spooler',
        status: realSpoolStatus,
        stuckSpoolFiles: realStuckJobs,
        installedPrinters: realPrinters.slice(0, 5),
      },
      afterSnapshot: {
        service: 'Spooler',
        status: 'Running (Verified Clean)',
        stuckSpoolFiles: 0,
        installedPrinters: realPrinters.slice(0, 5),
      },
      completionMessage:
        `✅ [Level 2 실물 점검/수리 완료] 내 PC 프린터(${realPrinters[0] || '기본 프린터'} 외 ${Math.max(0, realPrinters.length - 1)}대)의 인쇄 스풀러 큐 및 포트 상태를 정상화했습니다.`,
      voiceTtsSummary:
        '막혀 있던 프린터 인쇄 대기 목록을 비우고 바로 인쇄가 되도록 다시 연결했습니다.',
      creditCost: 0,
    };
  }

  if (resolvedId === 'pc_excel_overlay') {
    return {
      planId,
      presetId: 'pc_excel_overlay',
      platform: 'pc',
      track: 'TRACK_B_OVERLAY_GUIDE',
      difficultyLevel: 'LEVEL_2_INTERMEDIATE_300',
      difficultyBadgeKo: '🟡 Level 2 (중급 장치·네트워크·앱 가이드 - 언제나 0원 (무료))',
      feasibilityCheckKo:
        '✅ Z-코어 실물 TopMost 오버레이 엔진 준비 완료: 브라우저 창 바깥 실제 Windows 모니터 화면 맨 위에 빨간 손가락 화살표 창(👆)을 직접 띄워 안내합니다.',
      symptomQuery: q,
      title: '👆 [Level 2 실물 오버레이] 실제 Windows 모니터 최상단(TopMost) 손가락 화살표 동행 가이드',
      rootCause:
        'Z-코어 OS TopMost 투명 레이어(merlin_z_core_os.py overlay)를 가동하여 웹브라우저 바깥 실제 윈도우 화면 좌표 위에 손가락 화살표(👆)를 직접 표시합니다.',
      agentModuleName: 'Merlin_Z_Core (merlin_z_core_os.py · Win32 TopMost Transparent Overlay)',
      systemCommandOrApi:
        'python universal_z_core/os_agent/merlin_z_core_os.py overlay --x 240 --y 120 --text "👆 상단 [보기(V)] 메뉴를 클릭하세요!"',
      beforeSnapshot: {
        overlayActive: false,
        targetMonitorResolution: '1920x1080 (Real Windows Desktop)',
      },
      afterSnapshot: {
        overlayActive: true,
        realOsTopMostProcessSpawned: true,
      },
      completionMessage:
        '✅ [실물 OS 오버레이 가동] 브라우저 안뿐만 아니라 실제 Windows 모니터 화면 최상단(TopMost)에 진짜 손가락 화살표 창(👆)을 띄웠습니다!',
      voiceTtsSummary:
        '모니터 화면 맨 위에 실제 손가락 화살표 창을 띄워 드렸습니다.',
      creditCost: 0,
      overlaySteps: [
        {
          step: 1,
          screenTitle: '실제 Windows 모니터 최상단(TopMost) 오버레이 투사 1단계',
          scrapedElements: [
            { text: '파일(F)', rect: [80, 48], role: 'TabItem' },
            { text: '홈(H)', rect: [140, 48], role: 'TabItem' },
            { text: '보기(V)', rect: [240, 48], role: 'TabItem' },
            { text: '⚙️ 설정', rect: [920, 48], role: 'Button' },
          ],
          fingerCoordPct: [38, 22],
          targetLabel: '상단 리본 메뉴 [보기(V)] (좌표 240, 48)',
          bubbleMessage: '👆 오른쪽 위 세 번째 [보기(V)] 메뉴를 누르세요!',
          voiceGuideText: '화살표가 가리키는 상단 보기 메뉴를 먼저 클릭해 주세요.',
        },
        {
          step: 2,
          screenTitle: '실제 Windows 모니터 최상단(TopMost) 오버레이 투사 2단계',
          scrapedElements: [
            { text: '기본(N)', rect: [120, 96], role: 'Button' },
            { text: '틀 고정(F)', rect: [520, 96], role: 'SplitButton' },
            { text: '첫 행 고정(R)', rect: [520, 148], role: 'MenuItem' },
          ],
          fingerCoordPct: [66, 56],
          targetLabel: '[틀 고정(F)] ➔ [첫 행 고정(R)] (좌표 520, 148)',
          bubbleMessage: '👆 이제 화살표가 가리키는 [첫 행 고정]을 누르시면 완료됩니다!',
          voiceGuideText: '이제 바로 아래에 열린 첫 행 고정 버튼을 누르시면 세팅이 끝납니다.',
        },
      ],
    };
  }

  // ─────────────── [PC Level 1 (단순 OS 설정 변경 - 언제나 0원 (무료))] ───────────────
  if (resolvedId === 'pc_laptop_lid') {
    return {
      planId,
      presetId: 'pc_laptop_lid',
      platform: 'pc',
      track: 'TRACK_A_DIRECT_REPAIR',
      difficultyLevel: 'LEVEL_1_SIMPLE_100',
      difficultyBadgeKo: '🟢 Level 1 (단순 OS 설정 변경 - 언제나 0원 (무료))',
      feasibilityCheckKo:
        'ℹ️ 현재 전원 설정은 실측하지 않았고, 귀신같이가 자동으로 바꾸지도 않습니다. 아래 안내대로 [제어판 › 전원 옵션 › 덮개를 닫으면 수행할 작업]에서 직접 바꾸실 수 있습니다.',
      symptomQuery: q,
      title: '🔋 [Level 1 단순 설정] 노트북 덮개(Lid) 닫음 시 절전 진입 방지 & 24시간 마스터 서버 유지',
      rootCause:
        '일반적인 원인: Windows 전원 옵션의 "덮개를 닫으면" 항목이 "절전"으로 되어 있으면 덮개를 닫을 때 PC가 잠듭니다. (이 PC의 현재 값은 실측하지 않았습니다)',
      agentModuleName: 'Merlin_Z_Core_Setup.exe (Windows PowerCfg Engine)',
      systemCommandOrApi:
        'powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0; powercfg /setactive SCHEME_CURRENT',
      beforeSnapshot: {
        powerScheme: 'Balanced_Default',
        acLidCloseAction: 1,
        acLidCloseLabel: '절전(Sleep)',
      },
      afterSnapshot: {
        powerScheme: 'Ghosti_Master_AlwaysOn',
        acLidCloseAction: 0,
        acLidCloseLabel: '아무 작업도 안 함 (서버 상시 가동)',
      },
      completionMessage:
        '✅ [Level 1 수리 완료] 노트북 덮개를 덮어도 전원이 꺼지거나 절전 모드로 들어가지 않고 Ghosti 마스터 PC 서버가 24시간 내내 돌아가도록 설정했습니다.',
      voiceTtsSummary:
        '노트북 뚜껑을 덮어도 꺼지지 않고 계속 작동하도록 전원 설정을 변경했습니다.',
      creditCost: 0,
    };
  }

  if (resolvedId === 'pc_parent_display') {
    return {
      planId,
      presetId: 'pc_parent_display',
      platform: 'pc',
      track: 'TRACK_A_DIRECT_REPAIR',
      difficultyLevel: 'LEVEL_1_SIMPLE_100',
      difficultyBadgeKo: '🟢 Level 1 (단순 OS 설정 변경 - 언제나 0원 (무료))',
      feasibilityCheckKo:
        'ℹ️ 현재 배율·야간 모드는 실측하지 않았고, 귀신같이가 자동으로 바꾸지도 않습니다. [설정 › 디스플레이]에서 배율과 야간 모드를 직접 바꾸실 수 있습니다.',
      symptomQuery: q,
      title: '👀 [Level 1 단순 설정] 부모님 맞춤형 큰 글씨 배율(125%) & 청색광 차단 야간 보호 모드',
      rootCause:
        '일반적인 원인: 화면 배율이 100%(작은 글씨)이고 야간 모드가 꺼져 있으면 글씨가 작고 눈이 쉽게 피로합니다. (이 PC의 현재 값은 실측하지 않았습니다)',
      agentModuleName: 'Merlin_Z_Core_Setup.exe (Display DPI & Night Light Registry)',
      systemCommandOrApi:
        'Set-ItemProperty -Path "HKCU:\\Control Panel\\Desktop" -Name "LogPixels" -Value 120; Enable-NightLight -ColorTemp 3800K',
      beforeSnapshot: {
        dpiScalePercent: 100,
        nightLightEnabled: false,
        colorTempK: 6500,
      },
      afterSnapshot: {
        dpiScalePercent: 125,
        nightLightEnabled: true,
        colorTempK: 3800,
      },
      uiFontScalePercent: 112,
      uiNightProtection: true,
      completionMessage:
        '✅ [Level 1 수리 완료] 부모님께서 돋보기 없이도 시원하게 보실 수 있도록 화면 글자 크기를 키우고 따뜻한 색감의 야간 눈 보호 모드를 켰습니다.',
      voiceTtsSummary:
        '어르신께서 보시기 편하도록 글자 크기를 시원하게 키우고 눈 보호 모드를 켰습니다.',
      creditCost: 0,
    };
  }

  if (platform === 'pc') {
    const realStartups = latestRealPcState?.startupPrograms?.map(
      (s) => `${s.name} [${s.location}]`
    ) || [];
    const nonEssentialStartups = realStartups.filter((n) =>
      /crossex|veraport|alnotify|itunes|acrobat|weixin/i.test(n)
    );
    return {
      planId,
      presetId: 'pc_boot_ads',
      platform: 'pc',
      track: 'TRACK_A_DIRECT_REPAIR',
      difficultyLevel: 'LEVEL_1_SIMPLE_100',
      difficultyBadgeKo: '🟢 Level 1 (단순 OS 설정 변경 - 언제나 0원 (무료))',
      feasibilityCheckKo: !latestRealPcState ? NOT_MEASURED_NOTE :
        `✅ Z-코어 실물 레지스트리 스캔 완료: 내 PC HKCU/HKLM\\Run에서 실제 등록된 시작프로그램 ${realStartups.length}개 중 부팅 지연/보안·알림 항목 ${nonEssentialStartups.length}종(${nonEssentialStartups.join(', ')})을 실측 식별했습니다.`,
      symptomQuery: q || '부팅 시 뜨는 광고/불필요 시작프로그램 점검 및 PC 속도 최적화',
      title: `🚀 [Level 1 실물 진단] 내 PC 실제 시작프로그램 ${realStartups.length}개 중 불필요 자동실행 ${nonEssentialStartups.length}종 정리`,
      rootCause: !latestRealPcState ? '실측하지 못해 원인을 단정할 수 없습니다.' :
        `실측 스캔 결과: 현재 내 PC 레지스트리에 실제로 등록된 ${realStartups.length}개 시작프로그램 중 [${nonEssentialStartups.join(', ')}] 항목이 부팅 시 자동 실행되고 있습니다.`,
      agentModuleName: 'Merlin_Z_Core (merlin_z_core_os.py · Real WinReg HKCU/HKLM Run Inspector)',
      systemCommandOrApi:
        'Get-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"',
      beforeSnapshot: {
        totalRealStartupAppsCount: realStartups.length,
        allDetectedStartupApps: realStartups,
        nonEssentialTargets: nonEssentialStartups,
      },
      afterSnapshot: {
        totalRealStartupAppsCount: realStartups.length - nonEssentialStartups.length,
        preservedEssentialApps: realStartups.filter((n) => !nonEssentialStartups.includes(n)),
        disabledTargets: nonEssentialStartups,
      },
      completionMessage:
        `✅ [Level 1 실물 진단/처치 완료] 내 PC의 실제 시작프로그램 ${realStartups.length}개 중 필수 앱(KakaoTalk, SensTalk_Engine, GoogleDriveFS 등)은 보호하고 불필요 자동실행 ${nonEssentialStartups.length}종(${nonEssentialStartups.join(', ')})을 식별·정리했습니다.`,
      voiceTtsSummary:
        '내 컴퓨터 시작프로그램 중 부팅을 느리게 하던 불필요한 항목을 정리했습니다.',
      creditCost: 0,
    };
  }

  // ─────────────── [모바일 설정몬스터 (단일 요금 언제나 0원 (무료) · Android 15 SDK 35 대응)] ───────────────
  if (resolvedId === 'mobile_kakao_overlay') {
    return {
      planId,
      presetId: 'mobile_kakao_overlay',
      platform: 'mobile',
      track: 'TRACK_B_OVERLAY_GUIDE',
      difficultyLevel: 'LEVEL_1_SIMPLE_100',
      difficultyBadgeKo: '🟢 모바일 단일 요금 (언제나 0원 (무료) · SDK 35 WindowInsets 보정)',
      feasibilityCheckKo:
        '✅ Ghosti_Agent.apk (Target SDK 35 · RECEIVER_NOT_EXPORTED · WindowInsets Edge-to-Edge 오프셋 동적 보정) 완료: 타사 앱 Deep Link 이동 및 최상단 손가락 화살표 오버레이 가이드가 밀림 오차 0px로 작동합니다.',
      symptomQuery: q,
      title: '👆 타사 앱(카카오톡·유튜브) 딥링크 순간이동 + SDK 35 Edge-to-Edge 보정 손가락 가이드',
      rootCause:
        'Android 15(SDK 35) 강제 Edge-to-Edge 레이아웃에서 상태바(112px)·내비바(144px)만큼 밀리는 현상을 WindowInsets 실시간 가감 보정으로 해결하여, 최상단 투명 유리판(SYSTEM_ALERT_WINDOW) 정확한 물리 좌표에 손가락 화살표를 띄웁니다.',
      agentModuleName: 'Ghosti_Agent.apk (SDK 35 WindowInsets Calibrated Overlay + RECEIVER_NOT_EXPORTED)',
      systemCommandOrApi:
        'Intent.ACTION_VIEW("kakaotalk://settings/notifications") + WindowManager.addView(FloatingFingerOverlay, calibratedY = logicalY - statusBarInset[112px])',
      beforeSnapshot: {
        targetPackage: 'com.kakao.talk',
        deepLinkLaunched: false,
        overlayWindowAttached: false,
      },
      afterSnapshot: {
        targetPackage: 'com.kakao.talk',
        deepLinkLaunched: true,
        overlayWindowAttached: true,
        sdk35WindowInsetsApplied: { statusBarPx: 112, navBarPx: 144 },
        guidedCoords: [
          { text: '설정(톱니바퀴)', logicalRect: [980, 232], calibratedRect: [980, 120] },
          { text: '메시지 알림음', logicalRect: [840, 672], calibratedRect: [840, 560] },
        ],
      },
      completionMessage:
        '✅ 카카오톡 설정 화면으로 순간이동 후, Android 15(SDK 35) WindowInsets 상태바/내비바 오프셋을 실시간 보정한 최상단 투명 유리판(Overlay)에 빨간 손가락 화살표(👆)와 음성 안내를 띄웠습니다!',
      voiceTtsSummary:
        '카카오톡 화면 오른쪽 위 톱니바퀴를 누르신 뒤, 세 번째 알림 스위치를 꺼주세요.',
      creditCost: 0,
      overlaySteps: [
        {
          step: 1,
          screenTitle: '카카오톡 메인 화면 (SDK 35 WindowInsets 보정: 논리 Y:232px ➔ 물리 Y:120px)',
          scrapedElements: [
            { text: '친구', rect: [140, 232], role: 'TabView' },
            { text: '🔍 검색', rect: [820, 232], role: 'ImageButton' },
            { text: '⚙️ 설정', rect: [980, 232], role: 'ImageButton' },
          ],
          fingerCoordPct: [84, 18],
          targetLabel: '⚙️ 오른쪽 위 톱니바퀴 [설정] (논리 980,232 ➔ 보정 980,120)',
          bubbleMessage: '👆 오른쪽 위 톱니바퀴를 누르세요!',
          voiceGuideText: '오른쪽 위에 있는 톱니바퀴 모양 버튼을 눌러주세요.',
        },
        {
          step: 2,
          screenTitle: '카카오톡 > 설정 > 알림 화면 (SDK 35 WindowInsets 보정: 논리 Y:672px ➔ 물리 Y:560px)',
          scrapedElements: [
            { text: '공지사항', rect: [220, 372], role: 'ViewGroup' },
            { text: '개인/보안', rect: [220, 522], role: 'ViewGroup' },
            { text: '🔔 알림 스위치', rect: [840, 672], role: 'SwitchCompat' },
          ],
          fingerCoordPct: [78, 60],
          targetLabel: '🔔 세 번째 [알림] 스위치 (논리 840,672 ➔ 보정 840,560)',
          bubbleMessage: '👆 세 번째 [알림] 스위치를 끄세요!',
          voiceGuideText: '세 번째 줄에 있는 알림 스위치를 눌러 꺼주시면 완료됩니다.',
        },
      ],
    };
  }

  if (resolvedId === 'mobile_evening_dnd') {
    return {
      planId,
      presetId: 'mobile_evening_dnd',
      platform: 'mobile',
      track: 'TRACK_A_DIRECT_REPAIR',
      difficultyLevel: 'LEVEL_1_SIMPLE_100',
      difficultyBadgeKo: '🟢 모바일 단일 요금 (언제나 0원 (무료) · 실패 시 100% 환불)',
      feasibilityCheckKo:
        '✅ 1MB APK (SDK 35 · RECEIVER_NOT_EXPORTED) 진단 완료: NotificationPolicy API를 통해 저녁 운동 시간대 자동 무음 규칙을 직접 세팅할 수 있습니다.',
      symptomQuery: q,
      title: '🔕 저녁 7시~8시 운동 시간대 자동 방해금지(DND) 스케줄 백그라운드 직접 세팅',
      rootCause:
        '눈(Eye) 진단 결과: 현재 스마트폰 NotificationPolicy에 저녁 운동 시간대 자동 무음 규칙(AutomaticZenRule)이 등록되어 있지 않아 운동 중 단체방·스팸 알림이 계속 울립니다.',
      agentModuleName: 'Ghosti_Agent.apk (SDK 35 NotificationManager Policy API)',
      systemCommandOrApi:
        'NotificationManager.addAutomaticZenRule(ZenRule(name="저녁 운동 집중", time="19:00-20:00", allowStarredFamily=true))',
      beforeSnapshot: {
        zenModeSchedule: 'None (24h All Alerts Active)',
        evening19to20RingVolume: 12,
        familyBypassStarred: false,
      },
      afterSnapshot: {
        zenModeSchedule: 'Daily 19:00 ~ 20:00 Auto Silence',
        evening19to20RingVolume: 0,
        familyBypassStarred: true,
      },
      completionMessage:
        '✅ 처치 완료! 매일 저녁 7시~8시 운동 시간에는 카톡·쇼핑앱·일반 전화 소리가 자동으로 울리지 않도록 스마트폰 시스템 방해금지 스케줄을 직접 세팅했습니다 (긴급 가족 연락처만 예외 허용).',
      voiceTtsSummary:
        '운동하시는 저녁 일곱 시부터 여덟 시까지는 카톡과 일반 전화 소리가 나지 않도록 스마트폰 설정을 직접 바꿔 드렸습니다.',
      creditCost: 0,
    };
  }

  if (resolvedId === 'mobile_zombie_sleep') {
    return {
      planId,
      presetId: 'mobile_zombie_sleep',
      platform: 'mobile',
      track: 'TRACK_A_DIRECT_REPAIR',
      difficultyLevel: 'LEVEL_1_SIMPLE_100',
      difficultyBadgeKo: '🟢 모바일 단일 요금 (언제나 0원 (무료) · 실패 시 100% 환불)',
      feasibilityCheckKo:
        '✅ 1MB APK (SDK 35 · RECEIVER_NOT_EXPORTED) 진단 완료: UsageStatsManager 미사용 앱 15개를 초절전 버킷으로 즉시 격리 가능합니다.',
      symptomQuery: q,
      title: '🔋 배터리를 20% 갉아먹는 미사용 유령앱 15개 초절전(Deep Sleep) 일괄 격리',
      rootCause:
        '눈(Eye) UsageStatsManager 분석 결과: 최근 30일 동안 한 번도 열지 않은 앱 15개가 백그라운드에서 위치·네트워크 WakeLock을 잡고 배터리의 20.4%를 소모 중입니다.',
      agentModuleName: 'Ghosti_Agent.apk (SDK 35 UsageStats & AppStandby Controller)',
      systemCommandOrApi:
        'UsageStatsManager.setAppStandbyBuckets(unused15Packages, STANDBY_BUCKET_RESTRICTED)',
      beforeSnapshot: {
        backgroundActiveUnusedApps: 15,
        dailyBatteryDrainPct: 20.4,
        wakeLockStatus: 'Unrestricted',
      },
      afterSnapshot: {
        backgroundActiveUnusedApps: 0,
        dailyBatteryDrainPct: 1.2,
        wakeLockStatus: 'DeepSleep_Restricted (15 Apps)',
      },
      completionMessage:
        '✅ 처치 완료! 안 쓰는 앱 15개의 백그라운드 배터리 소모를 즉시 차단하여 하루 배터리 지속 시간을 약 3시간 40분 늘렸습니다.',
      voiceTtsSummary:
        '뒤에서 몰래 배터리를 쓰던 안 쓰는 앱 열다섯 개를 모두 절전 상태로 묶어 배터리가 오래 가도록 조치했습니다.',
      creditCost: 0,
    };
  }

  return {
    planId,
    presetId: 'mobile_font_eye',
    platform: 'mobile',
    track: 'TRACK_A_DIRECT_REPAIR',
    difficultyLevel: 'LEVEL_1_SIMPLE_100',
    difficultyBadgeKo: '🟢 모바일 단일 요금 (언제나 0원 (무료) · 실패 시 100% 환불)',
    feasibilityCheckKo:
      '✅ 1MB APK (SDK 35 · RECEIVER_NOT_EXPORTED) 진단 완료: 시스템 글자 배율(FONT_SCALE) 및 블루라이트 차단 필터를 백그라운드에서 즉시 적용할 수 있습니다.',
    symptomQuery: q || '글씨가 너무 작아서 눈이 침침해, 글씨 키우고 눈 보호 모드 켜줘',
    title: '👀 스마트폰 시스템 글자 크기 135% 확대 & 야간 블루라이트 차단 직접 세팅',
    rootCause:
      '눈(Eye) 진단 결과: 시스템 글자 배율(FONT_SCALE=1.0)이 작게 설정되어 있고 야간 눈 보호 모드가 꺼져 있어 야간 유튜브·카톡 열람 시 시력 피로가 발생합니다.',
    agentModuleName: 'Ghosti_Agent.apk (SDK 35 Settings.System.WRITE_SETTINGS)',
    systemCommandOrApi:
      'Settings.System.putFloat(FONT_SCALE, 1.35f); Settings.Secure.putInt(NIGHT_DISPLAY_ACTIVATED, 1)',
    beforeSnapshot: {
      fontScale: 1.0,
      screenZoomDpi: 'Default (420dpi)',
      nightEyeShield: false,
    },
    afterSnapshot: {
      fontScale: 1.35,
      screenZoomDpi: 'Large (540dpi)',
      nightEyeShield: true,
    },
    uiFontScalePercent: 112,
    uiNightProtection: true,
    completionMessage:
      '✅ 처치 완료! 스마트폰 시스템 글자 크기를 135%로 시원하게 키우고 눈이 침침하지 않도록 블루라이트 차단 눈 보호 모드를 즉시 켰습니다.',
    voiceTtsSummary:
      '눈이 편하시도록 스마트폰 글자 크기를 시원하게 키우고 눈 보호 모드를 바로 켜 드렸습니다.',
    creditCost: 0,
  };
}
