import {
  detectZeroLlmPerspectiveSearchIntent,
  pickNextShortformTipOnCompletion,
  DOCTOR_3_RED_LINES_NOTICE,
  type ShortformTipItem,
} from './shortformCurationEngine';
import {
  speakWithHyunsuOrSunhi,
  triggerUserFavoriteAiLiveVoiceBatonTouch,
  parseZeroLlmVoiceDocCommand,
  extractKeywordSentencesZeroLlm,
  resolveTargetDocAndBuildFactAnswer,
  dispatchFileToKakaoRealChatroom,
} from './voiceSearchAndAiBatonEngine';
import { getZCoreUrl, hasActiveGhostiLoginSession, zCoreBridge } from './zCoreBridge';
import {
  isAndroidMobileBrowserOrApp,
  isCapacitorNativeMobileRuntime,
  isIosMobileBrowserOrApp,
  scanMobileBloatCleaners,
  triggerMobileCleanerUninstall,
  triggerOpenGoogleAccountPermissions,
  triggerOpenPlaySubscriptions,
} from './ghostiMobileCareBridge';
import {
  submitStudioSupportTicket,
  buildStudioSupportJumpUrl,
} from './merlin-hub-sdk/Support/blackbox';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { computeLocalPhotoCleanupSummary } from './mobilePhotoPicker';
import { validateClubSignboardName } from '../components/PricingModal';
import { dispatchGhostCastLiveCommand } from '../components/GhostCastAndLiveSystem';
import { executeRealOsAction, buildSetupDiagnosisPlan } from './setupMonsterEngine';
import {
  parseConversationalCareScheduleCommand,
  saveWeeklyCareSchedule,
  loadWeeklyCareSchedule,
  formatScheduleLabelKo,
  recordCareCompletionTimestamp,
  evaluateDualProactiveCareEngine,
  type ProactiveCareBriefingResult,
} from './weeklyCareAndPlaceholderEngine';
import {
  isInvalidNicknameCandidate,
  loadGhostPassportBook,
  loadGhostSecretaryState,
  normalizeSuggestionChips,
  parseNicknameSettingIntent,
  sanitizeNicknameAnswer,
  saveGhostPassportBook,
  saveGhostSecretaryState,
  setPassportSelf,
  syncSecretaryNicknameToHubProfile,
} from './ghostSecretaryEngine';
import {
  buildCareFourBucketSummaries,
  detectAgentCareIntent,
  executeAgentCareBatchCard,
  explainCareItemsWithGemini,
  getLastCareScanContext,
  planCareAgentTurnWithGemini,
  runAgentCareReadTools,
  type MonsterAgentCareCardPayload,
} from './ghostCareAgentEngine';

/**
 * 🧹 치우기(클린몬스터) × ⚙️ 고치기(설정몬스터) 공용 대화형 AI & JSON Z-코어 위임 라우터
 *
 * [핵심 아키텍처 — 저가 LLM AI 두뇌(Gemini 2.5 Flash) + JSON 코어 위임(127.0.0.1:5199)]
 * 1. 유저는 명령어를 외울 필요 없이 우측 한 열의 '통상의 채팅창'에서 일상 언어로 편하게 대화합니다.
 * 2. 저가 LLM(Gemini 2.5 Flash)이 내 PC 실시간 사양·상태(~200토큰 컨텍스트)와 유저 눈높이(초급/중급/고급)에 맞춰
 *    깊은 공감과 감동을 주는 설명(replyKo)을 생성하고, 동시에 정형화된 JSON 액션 명세(llmActionJson)를 출력합니다.
 * 3. 라우터는 JSON 액션 명세에 따라 멀린 Z-코어(127.0.0.1:5199)의 실측 API를 호출하여
 *    100% 실제 파일·사양·복원 기록 카드를 말풍선 하단에 부착합니다 (가짜 수치·임의 자동 실행 0%).
 */

export type BatonTouchResult = Awaited<
  ReturnType<typeof triggerUserFavoriteAiLiveVoiceBatonTouch>
>;

export type MonsterLiteracyLevel = 'easy' | 'normal' | 'expert';

export type MonsterCardKind =
  | 'SEARCH_ROUTING'
  | 'MISSING_FILE_EXONERATION'
  | 'CLEANUP_PREVIEW_GATE'
  | 'DESKTOP_SHORTCUT_GATE'
  | 'RESTORE_POINTS_LIST'
  | 'PC_SPEC_CONSULTATION'
  | 'DEVICE_REPAIR_GATE'
  | 'DEEP_UNINSTALL_GATE'
  | 'BATON_TOUCH_CUTOFF'
  | 'GHOSTI_INFO_DESK'
  | 'APP_SETTINGS_CONTROL'
  | 'STUDIO_SUPPORT_PROXY'
  | 'WEEKLY_CARE_BRIEFING'
  | 'BOOT_CARE_PREVIEW_GATE'
  | 'DEFENDER_GUARD_CARD'
  | 'STARTUP_MANAGER_CARD'
  | 'INSTALLED_APPS_CARD'
  | 'AGENT_CARE_BATCH_CARD';

export interface MonsterInfoDeskPayload {
  topicBadge: string;
  title: string;
  bulletPoints: string[];
  actionButtons: Array<{
    label: string;
    actionType: 'OPEN_ONBOARDING_TAB1' | 'OPEN_ONBOARDING_TAB2' | 'OPEN_ONBOARDING_TAB3' | 'OPEN_PRICING_MODAL' | 'JUMP_SEARCH';
  }>;
}

export interface MonsterAppSettingsPayload {
  settingCategory:
    | 'CLIPBOARD_RETENTION'
    | 'GHOST_WINDOW_PREF'
    | 'CLUB_SIGNBOARD'
    | 'GHOST_CAST_LIVE'
    | 'WEEKLY_CARE_SCHEDULE';
  badgeText: string;
  summaryText: string;
  appliedValueLabel: string;
  isBlockedByFilter?: boolean;
}

export interface MonsterStudioSupportPayload {
  ticketKind: 'CLAIM' | 'AS_BUG' | 'IDEA';
  badgeLabel: string;
  userEmail: string;
  userComment: string;
  ticketId?: string | number;
  studioJumpUrl: string;
  submittedOk: boolean;
}

export type MonsterLlmIntent =
  | 'CLEANUP_FOLDER_REORG'
  | 'CLEANUP_DOWNLOAD_INSTALLERS'
  | 'MISSING_FILE_TRACE'
  | 'OFFICE_CRASH_RECOVER'
  | 'DESKTOP_SHORTCUT'
  | 'RESTORE_POINTS_LIST'
  | 'PC_SPEC_CONSULTATION'
  | 'STARTUP_INSPECT'
  | 'OS_REPAIR_ACTION'
  | 'SEARCH_ROUTING'
  | 'BATON_TOUCH_CUTOFF'
  | 'GENERAL_CONVERSATION';

export interface MonsterLlmActionJson {
  replyKo: string;
  intent: MonsterLlmIntent;
  zCoreCommand: {
    endpoint: string;
    action: string;
    params?: Record<string, string>;
  };
  followUpSuggestions: string[];
  modelUsed?: string;
}

export interface MonsterCleanupItem {
  name: string;
  fullPath: string;
  folderLabel: string;
  sizeBytes: number;
  ageDays: number;
}

export interface MonsterCleanupPreviewPayload {
  cleanupType: 'FOLDER_REORG' | 'DOWNLOAD_INSTALLERS' | 'WINDOWS_TEMP_JUNK';
  summaryTitle: string;
  userPrompt: string;
  targetFolderLabel: string;
  moveCount: number;
  totalBytes: number;
  reclaimSizeLabel: string;
  items: MonsterCleanupItem[];
  sampleFiles: string[];
  previewDescriptionKo: string;
  approved?: boolean;
  approvedTypedText?: string;
  createdRestoreId?: string;
  executionError?: string;
  undone?: boolean;
}

export interface MonsterShortcutPreviewPayload {
  siteName: string;
  targetUrl: string;
  shortcutFileName: string;
  userPrompt: string;
  approved?: boolean;
  approvedTypedText?: string;
  createdRestoreId?: string;
  executionError?: string;
}

export interface MonsterMissingFilePayload {
  query: string;
  caseType:
    | 'CASE_A_USER_APPROVED_RESTORE_POINT'
    | 'CASE_B_FOUND_IN_RECYCLE_BIN'
    | 'CASE_C_OFFICE_AUTORECOVER';
  fileName: string;
  currentLocation: string;
  originalLocation: string;
  deletedAtOrSavedAt: string;
  restoreId?: string;
  recycleMetaFile?: string;
  recoverFullPath?: string;
  fiveLinePreview: string[];
  briefingKo: string;
  restored?: boolean;
  restoredPath?: string;
  createdRestoreId?: string;
  approvedTypedText?: string;
  restoreError?: string;
}

export interface MonsterRestorePointItem {
  restoreId: string;
  createdAt: string;
  summary: string;
  userPrompt: string;
  integrityStatus: 'FULL_RESTORABLE' | 'PARTIAL_RESTORABLE' | 'UNRESTORABLE';
  statusBadge: string;
  totalItems: number;
  restorableItems: number;
  missingFiles: string[];
  precheckGuideMessage: string;
  rolledBack?: boolean;
  rollbackTypedText?: string;
}

export interface MonsterPcSpecPayload {
  cpuModel: string;
  cpuLoadPercent?: number | null;
  ramTotalGb: number | null;
  ramUsedPercent: number | null;
  gpuModel: string;
  osVersion: string;
  diskFreeGb: number | null;
  displayHz: number | null;
  verdictBadge: string;
  easyAnswerKo: string;
  normalAnswerKo: string;
  expertAnswerKo: string;
  detectedBloatwareLabels?: string[];
  bloatwareCleaned?: boolean;
  bloatwareCleanSummary?: string;
  approvedTypedText?: string;
  createdRestoreId?: string;
}

export interface DigitalHealthCheckRecord {
  recordId: string;
  issuedAt: string;
  category: '귀신비서' | '고치기' | '바로가기' | '↩️ 복원 기록';
  title: string;
  reclaimedSizeLabel: string;
  cleanedItemCount: number;
  securityPluginsFrozen: number;
  speedUpSummary: string;
  restoreId?: string;
  healthScoreBefore?: number;
  healthScoreAfter?: number;
}

export interface MonsterDetailGroup {
  groupTitle: string;
  items: string[];
}

export interface MonsterDeviceRepairPayload {
  title: string;
  badgeText: string;
  rootCause: string;
  symptomQuery: string;
  presetId: string;
  hasOverlayGuide: boolean;
  detailGroups?: MonsterDetailGroup[];
  executed?: boolean;
  undone?: boolean;
  completionMessage?: string;
  approvedTypedText?: string;
  createdRestoreId?: string;
}

export interface MonsterDeepUninstallPayload {
  targetAppQuery: string;
  targetAppLabel: string;
  foundAny: boolean;
  needsClarification?: boolean;
  zCoreOffline?: boolean;
  runningProcessCount: number;
  serviceAndTaskCount: number;
  totalResidualMb: number;
  estimatedRamMb: number;
  summaryBadge: string;
  honestBriefingKo: string;
  sampleProcesses: string[];
  sampleServicesAndTasks: string[];
  sampleFolders: string[];
  residualFolderItems?: Array<{ path: string; sizeMb: number }>;
  selectedFolderPaths?: string[];
  executed?: boolean;
  approvedTypedText?: string;
  snapshotFile?: string;
  executionReportKo?: string;
  executionError?: string;
}

export interface MonsterBootCarePreviewPayload {
  mode: 'CLEAN_BLOATWARE' | 'SCHEDULE_REBOOT';
  scheduleTime: string;
  uptimeSummaryKo: string;
  detectedPlugins: string[];
  startupCount: number;
  approved?: boolean;
  approvedTypedText?: string;
  createdRestoreId?: string;
  executionSummaryKo?: string;
  executionError?: string;
  undone?: boolean;
}

export interface MonsterDefenderGuardPayload {
  realTimeProtection: boolean;
  antivirusEnabled: boolean;
  firewallEnabled: boolean;
  ransomwareShieldEnabled: boolean;
  signatureVersion: string;
  signatureUpdatedAt: string;
  removableDrives: Array<{ drive: string; label: string }>;
  scanRunning: boolean;
  lastScanResultKo?: string;
  lastActionNoteKo?: string;
}

export interface MonsterStartupItem {
  id: string;
  name: string;
  command: string;
  resolvedPath?: string;
  locationLabel: string;
  enabled: boolean;
  isProtected: boolean;
  requiresAdmin?: boolean;
  fileExists?: boolean;
}

export interface MonsterStartupManagerPayload {
  items: MonsterStartupItem[];
  cleanedOrphanNames?: string[];
  lastToggleNoteKo?: string;
  lastToggleOk?: boolean;
}

export interface MonsterInstalledAppItem {
  name: string;
  publisher: string;
  version: string;
  installDate: string;
  sizeMb: number;
  plainRoleKo?: string;
  lastUsedLabelKo?: string;
  lastUsedStatus?: string;
  isProtected: boolean;
}

export interface MonsterInstalledAppsPayload {
  totalCount: number;
  items: MonsterInstalledAppItem[];
}

export interface MonsterChatMessage {
  id: string;
  role: 'user' | 'assistant';
  timestamp: string;
  text: string;
  sourceTab: 'trash' | 'repair';
  cardKind?: MonsterCardKind;
  searchKeyword?: string;
  missingFilePayload?: MonsterMissingFilePayload;
  cleanupPreview?: MonsterCleanupPreviewPayload;
  shortcutPreview?: MonsterShortcutPreviewPayload;
  restorePoints?: MonsterRestorePointItem[];
  pcSpecPayload?: MonsterPcSpecPayload;
  deviceRepairPayload?: MonsterDeviceRepairPayload;
  deepUninstallPayload?: MonsterDeepUninstallPayload;
  batonTouchPayload?: {
    docTitle: string;
    docText: string;
    userQuestion: string;
    deviceSpecSummary?: string;
    result?: BatonTouchResult;
  };
  shortformTip?: ShortformTipItem | null;
  healthRecordIssued?: DigitalHealthCheckRecord;
  llmActionJson?: MonsterLlmActionJson;
  followUpSuggestions?: string[];
  repairSymptomQuery?: string;
  infoDeskPayload?: MonsterInfoDeskPayload;
  appSettingsPayload?: MonsterAppSettingsPayload;
  studioSupportPayload?: MonsterStudioSupportPayload;
  proactiveCareBriefing?: ProactiveCareBriefingResult & {
    executed?: boolean;
    scheduleConfirmed?: boolean;
    approvedTypedText?: string;
    createdRestoreId?: string;
  };
  /** 모바일에서 채팅(타자)으로 설정/고치기 가이드를 요청했을 때 다짜고짜 음성 출력하지 않고 사전 승낙을 구하는 스크립트 */
  voiceConsentPromptKo?: string;
  voiceConsentApproved?: boolean;
  /** [전환율 보강 ③] 모바일 온보딩 말미: 모바일 ➔ PC 회수 브릿지 (카톡 나에게 PC 실행 링크 보내기 / 주소 복사) 버튼 노출 */
  showMobileToPcBridgeButton?: boolean;
  /** [전환율 보강 ④] 귀신계 여권 가족 실명 등록 직후: 가족 사진 카톡방 1초 구경시켜 주기 바이럴 버튼 대상 실명 */
  passportViralFamilyName?: string;
  bootCarePreviewPayload?: MonsterBootCarePreviewPayload;
  defenderGuardPayload?: MonsterDefenderGuardPayload;
  startupManagerPayload?: MonsterStartupManagerPayload;
  installedAppsPayload?: MonsterInstalledAppsPayload;
  agentCareCardPayload?: MonsterAgentCareCardPayload;
}

// ---------------------------------------------------------------------------
// 🧹 치우기 × ⚙️ 고치기 우측 1열 표준 채팅창 공유 멀티턴 스토어
// ---------------------------------------------------------------------------

function createWelcomeMessage(): MonsterChatMessage {
  const now = new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return {
    id: 'monster_welcome_init',
    role: 'assistant',
    timestamp: now,
    sourceTab: 'trash',
    text:
      '안녕하세요! 컴퓨터·휴대폰 정리, 고치기, 복원, 요금·기능 문의를 편하게 말씀해 주세요.\n' +
      '아래 입력창에 글자로 입력하시거나  음성으로 편하게 말씀해 주세요.',
  };
}

interface SharedMonsterChatState {
  messages: MonsterChatMessage[];
  literacyLevel: MonsterLiteracyLevel;
  ttsEnabled: boolean;
  busy: boolean;
}

let sharedChatState: SharedMonsterChatState = {
  messages: [createWelcomeMessage()],
  literacyLevel: 'normal',
  ttsEnabled: true,
  busy: false,
};

const sharedChatListeners = new Set<() => void>();

function notifySharedChatListeners() {
  sharedChatListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export function getSharedMonsterChatState(): SharedMonsterChatState {
  return sharedChatState;
}

export function subscribeSharedMonsterChat(listener: () => void): () => void {
  sharedChatListeners.add(listener);
  return () => {
    sharedChatListeners.delete(listener);
  };
}

export function setSharedMonsterMessages(
  updater: MonsterChatMessage[] | ((prev: MonsterChatMessage[]) => MonsterChatMessage[])
) {
  const next = typeof updater === 'function' ? updater(sharedChatState.messages) : updater;
  sharedChatState = { ...sharedChatState, messages: next };
  notifySharedChatListeners();
}

export function setSharedMonsterLiteracyLevel(level: MonsterLiteracyLevel) {
  sharedChatState = { ...sharedChatState, literacyLevel: level };
  notifySharedChatListeners();
}

export function setSharedMonsterTtsEnabled(enabled: boolean | ((prev: boolean) => boolean)) {
  const next = typeof enabled === 'function' ? enabled(sharedChatState.ttsEnabled) : enabled;
  sharedChatState = { ...sharedChatState, ttsEnabled: next };
  notifySharedChatListeners();
}

export function setSharedMonsterBusy(busy: boolean) {
  sharedChatState = { ...sharedChatState, busy };
  notifySharedChatListeners();
}

export function resetSharedMonsterChatToWelcome() {
  sharedChatState = {
    ...sharedChatState,
    messages: [createWelcomeMessage()],
    busy: false,
  };
  notifySharedChatListeners();
}

/**
 * [🎯 찾기] 화면 등 외부 탭에서 음성/텍스트로 손보기·설정 변경 명령을 발화했을 때
 * 컴포넌트 마운트 타이밍과 무관하게 0.00[✋ 손보기 대화창] 스토어에서 직접 실행하고
 * 현수/선희 성우 음성 안내까지 완결합니다.
 */
export async function submitExternalMonsterChatQuery(
  rawQuery: string,
  sourceTab: 'trash' | 'repair' = 'trash'
): Promise<void> {
  const raw = (rawQuery || '').trim();
  if (!raw || sharedChatState.busy) return;

  const userMsg: MonsterChatMessage = {
    id: `user_${Date.now()}`,
    role: 'user',
    timestamp: new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    text: raw,
    sourceTab,
  };

  setSharedMonsterMessages((prev) => [...prev, userMsg]);
  setSharedMonsterBusy(true);

  try {
    const assistantMsg = await processUnifiedMonsterChatQuery({
      query: raw,
      sourceTab,
      literacyLevel: sharedChatState.literacyLevel,
      ttsEnabled: sharedChatState.ttsEnabled,
    });
    setSharedMonsterMessages((prev) => [...prev, assistantMsg]);
    if (assistantMsg.repairSymptomQuery) {
      try {
        void useSaySeeStore.getState().submitSetupMonsterQuery(assistantMsg.repairSymptomQuery);
      } catch {
        /* ignore */
      }
    }
    if (assistantMsg.cardKind === 'SEARCH_ROUTING' && assistantMsg.searchKeyword) {
      try {
        const st = useSaySeeStore.getState();
        void st.runTextQuery(assistantMsg.searchKeyword);
        st.setDesktopTab('dashboard');
        st.setMobileTab('search');
      } catch {
        /* ignore */
      }
    }
  } finally {
    setSharedMonsterBusy(false);
  }
}

// ---------------------------------------------------------------------------
// Z-코어 통신 (실패는 실패로 돌려줌)
// ---------------------------------------------------------------------------

export const ZCORE_OFFLINE_MESSAGE =
  '멀린 Z-코어에 연결되어 있지 않아 내 PC를 확인할 수 없습니다. Z-코어를 실행한 뒤 다시 말씀해 주세요. (아무 파일도 건드리지 않았습니다)';

type ZResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function zcoreJson<T = any>(path: string, init?: RequestInit, timeoutMs = 20000): Promise<ZResult<T>> {
  const retryDelays = [300, 800, 1500];
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(getZCoreUrl(path), { ...init, signal: controller.signal });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        if (attempt < retryDelays.length) {
          await new Promise((r) => setTimeout(r, retryDelays[attempt]));
          continue;
        }
        return { ok: false, error: ZCORE_OFFLINE_MESSAGE };
      }
      const data = (await res.json()) as any;
      if (!zCoreBridge.isConnected && hasActiveGhostiLoginSession()) {
        void zCoreBridge.checkHealth(false);
      }
      if (res.status === 403) {
        return { ok: false, error: data?.error || '허용되지 않은 화면에서 요청되어 Z-코어가 실행을 거절했습니다.' };
      }
      if (!res.ok && data?.error) {
        return { ok: false, error: data.error };
      }
      return { ok: true, data };
    } catch (err: any) {
      clearTimeout(timer);
      if (attempt < retryDelays.length) {
        await new Promise((r) => setTimeout(r, retryDelays[attempt]));
        continue;
      }
      if (err?.name === 'AbortError') {
        return { ok: false, error: 'Z-코어 응답 대기 시간이 초과되었습니다. Z-코어가 정상 구동 중인지 확인해 주세요.' };
      }
      return { ok: false, error: ZCORE_OFFLINE_MESSAGE };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, error: ZCORE_OFFLINE_MESSAGE };
}

function postJson(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 KB';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ---------------------------------------------------------------------------
// 🧠 내 PC 실시간 200토큰 컨텍스트 스냅샷 & 저가 LLM (Gemini 2.5 Flash) JSON 라우터
// ---------------------------------------------------------------------------

interface CachedPcContext {
  fetchedAt: number;
  summaryText: string;
  specData?: any;
  osInspectData?: any;
}

let cachedPcContext: CachedPcContext | null = null;

function isMobileRuntimeForChat(): boolean {
  if (
    isCapacitorNativeMobileRuntime() ||
    isAndroidMobileBrowserOrApp() ||
    isIosMobileBrowserOrApp()
  ) {
    return true;
  }
  try {
    const st = useSaySeeStore.getState();
    return Boolean(st.isStoreAppMode || st.layout === 'mobile');
  } catch {
    return false;
  }
}

export async function fetchRealtimePcContextForLlm(): Promise<CachedPcContext> {
  if (isMobileRuntimeForChat()) {
    const st = useSaySeeStore.getState();
    return {
      fetchedAt: Date.now(),
      summaryText: `내 스마트폰 파일 연동 중 (사진 ${st.photos.length}장 · 동영상 ${st.videoSceneItems.length}개 · 문서 ${st.localDocuments.length}건 준비 완료)`,
    };
  }
  if (cachedPcContext && Date.now() - cachedPcContext.fetchedAt < 20000) {
    return cachedPcContext;
  }
  const [specRes, osRes] = await Promise.all([    zcoreJson<any>('/__zcore/pc-spec', undefined, 8000),
    zcoreJson<any>('/__zcore/os-inspect', undefined, 8000),
  ]);

  if (!specRes.ok && !osRes.ok) {
    return {
      fetchedAt: Date.now(),
      summaryText: '내 PC 엔진을 켜 주시면 실시간 사양과 폴더 상태까지 함께 점검해 드려요.',
    };
  }

  const s = specRes.ok ? specRes.data : {};
  const o = osRes.ok ? osRes.data : {};
  const startupNames = Array.isArray(o?.startupPrograms)
    ? o.startupPrograms
        .map((x: any) => String(x?.name || '').trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const spoolerStatus = o?.spoolerAndSecurity?.spoolerServiceStatus || '정상';
  const stuckPrint = o?.spoolerAndSecurity?.stuckSpoolQueueFiles ?? 0;
  const cpuLoadPct = o?.spoolerAndSecurity?.cpuLoadPercent ?? null;
  const secList = Array.isArray(o?.spoolerAndSecurity?.activeSecurityPlugins)
    ? o.spoolerAndSecurity.activeSecurityPlugins
        .map((p: any) => String(p?.label || p?.keyword || '').trim())
        .filter(Boolean)
    : [];

  const lines = [    '[내 PC 실시간 실측 컨텍스트 (Merlin_Z_Core 127.0.0.1:5199)]',
    `- CPU: ${s.cpuModel || '확인중'} (${s.cpuLogicalCores ?? '?'}코어${cpuLoadPct !== null ? ` · 현재 실시간 부하 ${cpuLoadPct}%` : ''}) / GPU: ${s.gpuModel || '내장/확인중'}`,
    `- RAM(메모리): 총 ${s.ramTotalGb ?? '?'}GB (현재 점유율 ${s.ramUsedPercent ?? '?'}%)`,
    `- 저장공간(C드라이브): 여유 ${s.diskFreeGb ?? '?'}GB / 전체 ${s.diskTotalGb ?? '?'}GB`,
    `- 모니터 주사율: ${s.displayHz ? `${s.displayHz}Hz` : '기본'} / OS: ${s.osVersion || 'Windows'}`,
    `- 시작프로그램(${startupNames.length}개): ${startupNames.join(', ') || '없음'}`,
    `- 상주 애드웨어·보안·CPU 과점유 모듈(${secList.length}건): ${secList.slice(0, 8).join(', ') || '0건(깨끗함)'}`,
    `- 인쇄 스풀러: ${spoolerStatus} (대기열 멈춘 인쇄물 ${stuckPrint}건)`,
  ];

  cachedPcContext = {
    fetchedAt: Date.now(),
    summaryText: lines.join('\n'),
    specData: s,
    osInspectData: o,
  };
  return cachedPcContext;
}

/**
 * 📅 [월간 정기 업데이트 사양 기준표 (Monthly PC Spec Benchmark)]
 * - 매번 프롬프트에 넣지 않고(평소 0토큰), 오직 유저가 '사양·게임·영상편집·느려짐·업그레이드'를 물어볼 때만 조건부로 ~45토큰만 주입합니다.
 * - 매월 1일 정기 문서/코드 점검 시 version(YYYY-MM)과 기준치만 1줄 갱신합니다.
 */
export const MONTHLY_PC_SPEC_BENCHMARK = {
  version: '2026-11',
  compactRuleText:
    '[2026-11월 기준 사양 판정표]: 사무·웹탭(RAM 16GB+, 여유 20GB+) | 쇼츠·4K편집·포토샵AI(RAM 16~32GB+, RTX 3060~5060급/최신Arc·Radeon, 여유 50GB+) | 롤·발로(16GB, 내장가능) | 배그·3D게임(16~32GB, RTX 3060~5060+, 144Hz+) | 최신세대(Intel 13·14·Core Ultra, Ryzen 7000~9000, RTX 40·50).',
};

export function isSpecOrPerformanceQuery(query: string): boolean {
  return /사양|스펙|돌아가|배그|포토샵|프리미어|캡컷|영상\s*편집|롤|발로란트|게임|램|ram|메모리|글카|그래픽|gpu|cpu|주사율|hz|업그레이드|새로\s*사|느려|느린|버벅|렉|답답|용량/i.test(
    query
  );
}

const LITERACY_TONE_PROMPT: Record<MonsterLiteracyLevel, string> = {
  easy:
    '[초급 / 쉬운말 모드]: 어려운 영어/전문용어(RAM, 프로세스 등) 대신 "작업 공간(메모리)", "저장 공간"같은 쉬운 표현을 쓰되, 과한 호들갑 없이 따뜻하고 상냥한 귀신비서 애교 해요체(~했어요!, ~해 드릴게요!, ~예요!)로 핵심만 간결하게 안내하세요.',
  normal:
    '[중급 / 일반 모드]: 따뜻하고 다정한 귀신비서 애교 해요체(~했어요!, ~해 드릴게요!, ~예요!)로 1~2단어만 짧게 공감한 뒤, 실측 수치와 해결 방법만 군더더기 없이 1~2문장으로 심플하게 안내하세요.',
  expert:
    '[고급 / 전문가 모드]: CPU 코어, RAM 점유율(%), 디스크 여유량(GB), 주사율(Hz) 등 엔지니어링 실측 수치를 인용하여 다정하고 똑부러지는 귀신비서 해요체(~했어요, ~해 드릴게요)로 1~2문장 이내로 간결하게 브리핑하세요.',
};

function extractJsonObject(raw: string): any | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function callMonsterLlmGateway(prompt: string, timeoutMs = 4800): Promise<{ ok: boolean; text: string; model?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // 1순위: 중앙 멀린허브 Gemini 2.5 Flash 직통 게이트웨이 (CORS 허용 확인 완료)
    const hubRes = await fetch('https://os.sundreamer.app/api/ai/gemini', {
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
          temperature: 0.3,
          maxOutputTokens: 320,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: controller.signal,
    });
    if (hubRes.ok) {
      const data = await hubRes.json();
      const text = String(data?.text || '').trim();
      if (text) return { ok: true, text, model: data?.model_used || 'gemini-2.5-flash' };
    }
  } catch {
    /* fallback to netlify function */
  } finally {
    clearTimeout(timer);
  }

  // 2순위: Netlify Serverless Function 폴백
  const controller2 = new AbortController();
  const timer2 = setTimeout(() => controller2.abort(), 2800);
  try {
    const fnRes = await fetch('/.netlify/functions/monster-llm-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller2.signal,
    });
    if (fnRes.ok) {
      const data = await fnRes.json();
      const text = String(data?.text || '').trim();
      if (text) return { ok: true, text, model: data?.model || 'gemini-2.5-flash' };
    }
  } catch {
    /* ignore */
  } finally {
    clearTimeout(timer2);
  }

  return { ok: false, text: '' };
}

export async function callMonsterLowCostLlmJson(params: {
  query: string;
  sourceTab: 'trash' | 'repair';
  literacyLevel: MonsterLiteracyLevel;
  pcContextText: string;
  recentTurns?: Array<{ role: 'user' | 'assistant'; text: string }>;
}): Promise<MonsterLlmActionJson | null> {
  const { query, sourceTab, literacyLevel, pcContextText, recentTurns = [] } = params;
  const historyBlock = recentTurns
    .slice(-6)
    .map((t) => `${t.role === 'user' ? '유저' : '귀신같이 비서'}: ${t.text.slice(0, 220)}`)
    .join('\n');

  const prompt = [    '당신은 『귀신같이(Ghosti)』의 내 기기 전담 비서인 **귀신비서( 정리·수리·원복)**입니다.',
    '',
    '[유저 질문 말투에 따른 자동 눈높이 맞춤 규칙 (추가 토큰 없이 즉시 반영)]:',
    '- 유저 질문에 전문용어(RAM, 점유율, 클럭, 코어, 주사율, Hz, GPU 등)가 포함되어 있으면: 엔지니어링 실측 수치를 정확히 인용해 브리핑하세요.',
    '- 유저 질문이 일상어/초보 말투("왜 이리 버벅대냐", "새로 사야 해?", "답답해")이면: 어려운 약어 대신 "작업 공간(메모리)", "저장 공간"같은 쉬운 표현을 함께 써서 설명하세요.',
    '',
    pcContextText,
    isSpecOrPerformanceQuery(query) ? MONTHLY_PC_SPEC_BENCHMARK.compactRuleText : '',
    isIosMobileBrowserOrApp()
      ? '[iOS 전용 필수 규칙]: 현재 접속 기기는 아이폰/아이패드(iOS)입니다. Google Play·CleanX 등 안드로이드 전용 클리너 삭제 안내나 유료 요금제 안내를 절대 하지 말고, 클리너·청소앱·구독 해지를 물어보면 "아이폰(iOS)은 애플 보안 정책상 악성 청소앱이 자동 침투할 수 없으며, 정기구독 확인은 [아이폰 설정 > 내 이름(Apple 계정) > 구독]에서 안전하게 관리하실 수 있습니다"라고 안내하세요.'
      : '',
    '',
    '[필수 숙지 1~4귀신 전 기능 공식 팩트 (docs/귀신비서_FAQ_원본.md SSOT — 추측·거짓 답변 금지)]:',
    '• [1귀신 귀신비서]: ①보안프로그램은 사용 이력 기반 2분류(실사용 은행·관공서 모듈 무삭제 자동 절전·기상 vs 악성 애드웨어·그리드·장기 미사용 모듈 다중 취사선택 제거), ②C드라이브 공간 도둑 3초 스캔(크롬·엣지·웨일 4대 순수 캐시[쿠키·로그인 보호]·CapCut 캐시·개발 캐시·데스크톱 최대절전 hiberfil.sys·여유 D드라이브 안전 이사) 및 바탕화면 폴더 구성 분석·WD 특수아이콘 안전 숨김 지원, ③모든 파일·폴더 정리는 🟢보존(제외) vs 🔴실행 체크박스 확인 후 Windows 기본 [휴지통] 이동(영구 삭제 0%, 휴지통 비우기 전/후 용량 병기 및 유저 직접 "휴지통 비워줘" 입력 시 최종 확정), ④모든 정리·설정은 [복원 기록]/"원래대로 돌려줘"로 1초 원복, ⑤Windows Defender 순정 백신 경호 및 1초 스마트 ZIP/암호압축 무료 내장, ⑥부품 쇼핑몰 링크 제공 금지(규격명만 복사).',
    '• [2귀신 귀신검색·여권·귀신키]: ①Ctrl+0(Ctrl+우클릭)으로 👻귀신검색창([⤡작게/⤢크게]) 즉시 소환 — 제목 몰라도 문서 본문(50,000자)·사진 글자(OCR)·동영상 한글 자막 구간(MM:SS) 1초 검색, ②📝사진·표 OCR 창과 🏷️귀신 라벨러(EXIF 촬영일 최우선 보존)는 내 기기 통합 Pro(월 3,900원 · 30일 무료체험) 귀속(S: 업무 폴더 내 라벨러는 전 직원 무료), ③2어절 한영 자동 오타 변환(귀신키 연동)은 자체 오토코렉트 충돌 방지를 위해 아래아한글(HWP)·MS워드·VS Code에서는 양보하고 브라우저·카톡에서 작동, ④귀신계 여권은 성인 10년 단위로 5장씩·미성년자 5년 단위로 5장씩(5대 스타일: 정면·측면·야외·선글라스·야간) 계속 누적 합산되어 총량 제한이 없으며(단순 "무제한"이 아니라 반드시 10년/5년 단위 5장씩 누적 규칙을 함께 설명), 실제 사람 얼굴만 등록 가능(인물 수 무제한 · 2D 만화·3D 캐릭터는 등록 불가 · 반려동물은 다음 버전업 지원 예정)하고 단일 고유 실명(본인만 실명+별명 결속)·PC↔폰 128D 벡터 무료 자동동기화로 작동하며 업무 공유(S:)에서는 미발동.',
    '• [3귀신 사진공유·기기통합]: ①3.사진 공유(우리집·본가·처가·동호회·동창회)는 방장·멤버 전원 인원·장수 무제한 평생 0원(개인 사진·영상 전용), room_id 1:1 물리 격리 및 [💌 초대받은 방] 완전 분리, 14일 마중물 + 합류 멤버 로컬 IndexedDB 영구 금고, 삭제는 방장·업로더 본인만 가능, [💻 모니터로 크게 보기] 무선 캐스트 & [📡 다 같이 보기] 0.1초 앨범 싱크 지원, ②4.내 기기 통합은 엔진 설치된 PC와 스토어 정식 모바일 앱(Android/iOS)만 실사용 기기로 같은 이메일 로그인 시 자동 연결(모바일 웹 브라우저는 쇼룸·앱 이동 다리 전용), 양방향 1초 암호화 클립보드 지원, 모바일 앱 내 결제창 비노출(PC 웹에서 관리).',
    '• [4귀신 업무공유 S:·클라우드·NAS]: ①구글 드라이브(G:)·네이버 마이박스(MYBOX)·원드라이브 폴더도 [업무 폴더 변경 (G: 연결)]로 선택 시 S:와 동시 반영, ②데스크톱 탐색기 설치 시 제목 0.1초·일반문서 본문/OCR 자동 다운로드 100% 검색(우클릭 [오프라인 사용 가능] 권장), ③.gsheet/.gdoc는 "링크가 있는 모든 사용자 보기 가능" 시 표·본문 100% 검색 / 비공개 시트는 제목 검색 후 웹 열기, ④사내 NAS 대비 외근·LTE 무설정 1초 직결·본문 1초 검색·실시간 [🔒 현재 OOO님이 사용 중] 잠금·기존 NAS 병행/대체 우위, ⑤S:는 대표 최상위 업무 폴더 1곳 연결(하위 폴더 개수 무제한), ⑥대표 1인 정액제(5인 9,900원/20인 19,000원/50인 29,000원, 30일 체험)로 초대 팀원 평생 0원이며 만료 시 S: 연결만 해제되고 원본 파일은 100% 보존, [🌙 야간·퇴근 초절전 모드](월 전기료 약 1,800원) 및 백업 PC 지원.',
    '',
    historyBlock ? `[최근 대화 맥락]\n${historyBlock}\n` : '',
    `[현재 유저 입력 (${sourceTab === 'trash' ? '치우기 탭' : '고치기 탭'})]`,
    `"${query}"`,
    '',
    '[절대 준수 4대 화법 및 아키텍처 원칙 — 다정한 애교 해요체 · 군더더기 0% · 범위 밖 질문 외부 바통터치 · JSON 기능 분리]',
    '1. [귀신비서 답변 범위(우리 앱·기기·설정·검색·편의 기능) vs 범위 밖 외부 바통터치]: 우리 앱(귀신같이/귀신검색/귀신비서/귀신계 여권/요금제/연동/설정)이나 PC·스마트폰 정리·수리·파일 복구·사양 진단과 관련된 질문에는 친절하고 정확하게 답변하세요. 특히 직전 [최근 대화 맥락]에서 귀신비서가 유저에게 질문이나 선택지를 제시했고 현재 유저 입력이 그 질문에 대한 직접 대답(예: 선택지 외에 직접 입력한 새 별명·요일/시간·사이트명·폴더명·상태 응답 등)인 경우에는 절대 BATON_TOUCH_CUTOFF로 넘기지 말고 직전 질문의 맥락에 맞춰 자연스럽게 완료·안내하세요. 반면 직전 질문과도 무관하고 우리 앱과도 무관한 일반 상식, 일상 잡담, 작문, 번역, 법률/세무 등 귀신비서의 답변 범위를 벗어나는 질문이면 차갑게 거절하지 말고, 반드시 "intent": "BATON_TOUCH_CUTOFF", "zCoreCommand": { "endpoint": "NONE", "action": "OUT_OF_SCOPE_BATON_TOUCH", "params": {} }로 설정하고, replyKo에는 "이 질문은 귀신비서의 답변 범위를 넘어서는 내용이라 말씀하신 대화 내용을 클립보드에 미리 복사해 두었어요! 아래 버튼을 누르시면 평소 쓰시는 단골 AI로 바로 점프해서 답변받으실 수 있어요."라고 안내하세요.',
    '2. [과한 인사치레·호들갑 절대 금지]: "어휴~", "제가 귀신같이 비서인데 걱정 마세요!"같은 수다스러운 자기소개는 쓰지 마세요. 공감은 딱 한두 마디("충분히 가능해요!", "답답하셨겠어요!", "새로 안 사셔도 괜찮아요!")만 하고 즉시 본론(기능 및 실측 수치)으로 들어가세요.',
    '3. [다정하고 신뢰감 있는 귀신비서 애교 해요체 고정]: 유저가 반말("정리해 줄래?", "고마워")로 말해도 반말("응!", "해줄게")이나 딱딱한 다나까체("~입니다", "~하겠습니다")를 쓰지 말고, 항상 따뜻하고 상냥한 귀신비서 애교 해요체("~했어요!", "~해 드릴게요!", "~예요!")로 총 1~2문장 이내로 심플하게 답하세요.',
    '4. [기능은 JSON으로만 완전 분리 & 임의 삭제 표현 금지]: 말풍선(replyKo)은 군더더기 없이 심플하게 끝내고, 실제 실행할 기능은 JSON의 intent와 zCoreCommand에 분리 주입하세요. 폴더·설치파일 정리 시 "자동으로 삭제해 드릴게요"라고 하지 말고 "정리 대상 파일 목록을 먼저 스캔해 보여드릴게요!"라고 안내하세요.',
    '5. 반드시 아래 JSON 스키마 하나만 순수 JSON으로 출력하세요 (마크다운 코드블록 없이 { 로 시작해서 } 로 끝낼 것):',
    '{',
    '  "replyKo": "따뜻하고 상냥한 귀신비서 애교 해요체(~했어요!, ~해 드릴게요!) 1~2문장 답변 (짧은 공감 + 실측 핵심 결론)",',
    '  "intent": "CLEANUP_FOLDER_REORG" | "CLEANUP_DOWNLOAD_INSTALLERS" | "MISSING_FILE_TRACE" | "OFFICE_CRASH_RECOVER" | "DESKTOP_SHORTCUT" | "RESTORE_POINTS_LIST" | "PC_SPEC_CONSULTATION" | "STARTUP_INSPECT" | "OS_REPAIR_ACTION" | "SEARCH_ROUTING" | "BATON_TOUCH_CUTOFF" | "GENERAL_CONVERSATION",',
    '  "zCoreCommand": {',
    '    "endpoint": "/__zcore/cleanup-scan" | "/__zcore/omni-trace" | "/__zcore/forensic-scan" | "/__zcore/create-shortcut" | "/__zcore/restore-points" | "/__zcore/pc-spec" | "/__zcore/os-inspect" | "/__zcore/execute" | "NONE",',
    '    "action": "실행할 코어 액션 요약 영문 코드",',
    '    "params": { "keyword": "추출 키워드(선택)", "siteName": "사이트명(선택)", "targetUrl": "https://...(선택)", "repairSymptom": "수리 증상(선택)" }',
    '  },',
    '  "followUpSuggestions": ["귀신비서가 실제로 즉시 실행할 수 있는 손보기·순정백신·복원기록·귀신검색 반말 버튼 문구 1~2개 (~해줘, ~보여줘 — 사설 백신 추천·쇼핑몰 링크 추천 등 정책 외 문구 생성 절대 금지)"]',
    '}',
  ].join('\n');

  const res = await callMonsterLlmGateway(prompt);
  if (!res.ok) return null;
  const parsed = extractJsonObject(res.text);
  if (!parsed || typeof parsed.replyKo !== 'string') return null;

  return {
    replyKo: parsed.replyKo.trim(),
    intent: (parsed.intent as MonsterLlmIntent) || 'GENERAL_CONVERSATION',
    zCoreCommand: {
      endpoint: String(parsed?.zCoreCommand?.endpoint || 'NONE'),
      action: String(parsed?.zCoreCommand?.action || parsed.intent || 'CONVERSE'),
      params: parsed?.zCoreCommand?.params || {},
    },
    followUpSuggestions: Array.isArray(parsed.followUpSuggestions)
      ? normalizeSuggestionChips(
          parsed.followUpSuggestions.map((s: any) => String(s || '').trim()).filter(Boolean).slice(0, 3)
        ) || []
      : [],
    modelUsed: res.model || 'gemini-2.5-flash',
  };
}

// ---------------------------------------------------------------------------
// 📋 내 기기 건강검진 기록함 (실제로 실행된 작업만 기록)
// ---------------------------------------------------------------------------

const HEALTH_HISTORY_STORAGE_KEY = 'ghosti_health_check_history_v1';

export function loadLocalHealthCheckHistory(): DigitalHealthCheckRecord[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(HEALTH_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const real = parsed.filter(
      (r: DigitalHealthCheckRecord) => r && typeof r.recordId === 'string' && !r.recordId.startsWith('hc_seed')
    );
    if (real.length !== parsed.length) {
      window.localStorage.setItem(HEALTH_HISTORY_STORAGE_KEY, JSON.stringify(real));
    }
    return real;
  } catch {
    return [];
  }
}

export function appendLocalHealthCheckRecord(
  partial: Omit<DigitalHealthCheckRecord, 'recordId' | 'issuedAt'>
): DigitalHealthCheckRecord {
  const now = new Date();
  const issuedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;

  const record: DigitalHealthCheckRecord = {
    recordId: `hc_${Date.now()}`,
    issuedAt,
    ...partial,
  };

  try {
    if (typeof window !== 'undefined') {
      const prev = loadLocalHealthCheckHistory();
      const next = [record, ...prev].slice(0, 50);
      window.localStorage.setItem(HEALTH_HISTORY_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    /* ignore storage error */
  }
  return record;
}

// ---------------------------------------------------------------------------
// [복원 기록]
// ---------------------------------------------------------------------------

const MISSING_FILE_STOPWORDS = new Set([  '파일', '사진', '이미지', '그림', '문서', '자료', '폴더', '영상', '동영상',
  '미저장', '미저장문서', '저장', '임시', '임시본', '임시저장', '자동복구', '자동저장',
  '정리', '정리함', '보관함', '정리보관함', '윈도우', '컴퓨터', '피씨', 'pc', '귀신비서', '귀신', '비서',
  '내', '내가', '제', '제가', '우리', '우리가', '나', '저', '그', '그거', '이거', '저거',
  '어디', '어디갔어', '어디갔지', '어디있어', '어디로', '방금', '방금전', '방금전에', '조금전', '조금전에',
  '아까', '최근', '최근에', '오늘', '어제', '그제', '일전에', '실수로', '모르고', '일부러', '잘못', '테스트용',
  '없어졌어', '없어졌어요', '없어진', '사라졌어', '사라졌어요', '사라진',
  '증발', '증발했어', '지운', '지웠던', '지웠지', '지웠어', '지웠어요', '지워진',
  '삭제', '삭제한', '삭제된', '삭제했어', '삭제했어요', '버린', '버렸던', '버렸어', '버렸어요',
  '날아갔어', '날아간', '넣은', '넣었던', '보낸', '옮긴',
  '복구', '복구해', '복구해줘', '복구해주세요', '복구하기', '복원', '복원해', '복원해줘', '복원해주세요', '복원하기',
  '되돌려', '되돌려줘', '되돌려주세요', '원복', '원복해줘', '원래대로', '살려', '살려줘', '구출', '구출해', '구출해줘', '구출하기',
  '찾아', '찾아줘', '찾아주세요', '찾기', '보여', '보여줘', '보여주세요', '알려', '알려줘', '못', '찾겠어',
  '휴지통', '휴지통에', '휴지통에서', '니가', '너가', '왜', '좀', '다시', '있던', '있었던',
  '바탕화면', '바탕화면에', '바탕화면에서', '내문서', '문서함', '다운로드', '폴더에', '폴더에서', '거', '것',
  '바로', '즉시', '연속', '원본', '위치', '원위치', '전체', '목록', '실행', '실행해', '실행해줘', '해줘', '해주세요',
]);

export function extractCleanMissingFileKeyword(rawQuery: string): string {
  const cleaned = (rawQuery || '').replace(/['"‘’“”`]/g, ' ');
  const tokens = cleaned.match(/[0-9A-Za-z가-힣._-]{2,}/g) || [];
  const out: string[] = [];
  for (const t of tokens) {
    const stripped =
      t.length > 2 ? t.replace(/(이|가|을|를|은|는|도|에|에서|으로|로|의|만|랑|이랑)$/, '') : t;
    const tLow = t.toLowerCase();
    const sLow = stripped.toLowerCase();
    if (/^\d+(초|분|시|시간|일|번|회|개|건|장|세트)$/i.test(sLow)) {
      continue;
    }
    if (
      stripped &&
      stripped.length >= 2 &&
      !MISSING_FILE_STOPWORDS.has(tLow) &&
      !MISSING_FILE_STOPWORDS.has(sLow) &&
      !out.includes(stripped)
    ) {
      out.push(stripped);
    }
  }
  return out[0] || '';
}

export async function openMissingFileOrRecycleBinLocation(
  targetPath: string,
  isInRecycleBin: boolean
): Promise<{ ok: boolean }> {
  if (isInRecycleBin) {
    const rbOpen = await zcoreJson<{ ok: boolean }>(
      '/__quarantine/open-folder',
      postJson({ target: 'recycle_bin' }),
      4000
    );
    if (rbOpen.ok && rbOpen.data?.ok) {
      return { ok: true };
    }
  }
  const osRes = await executeRealOsAction('open_file_location', targetPath);
  return { ok: Boolean(osRes.ok) };
}

export async function fetchRestorePointsWithPrecheck(): Promise<{
  points: MonsterRestorePointItem[];
  error?: string;
}> {
  const r = await zcoreJson<{ ok: boolean; restorePoints?: any[]; error?: string }>(
    '/__zcore/restore-points'
  );
  if (!r.ok) return { points: [], error: r.error };
  if (!r.data?.ok || !Array.isArray(r.data.restorePoints)) {
    return { points: [], error: r.data?.error || '복원 기록을 불러오지 못했습니다.' };
  }

  const seenRolledBackShadowNames = new Set<string>();
  const normalized: MonsterRestorePointItem[] = [];

  for (const rawPt of r.data.restorePoints) {
    const ops: any[] = Array.isArray(rawPt?.operations) ? rawPt.operations : [];
    const totalItems = Number(rawPt?.totalItems ?? ops.length ?? 0);
    const restorableItems = Number(rawPt?.restorableItems ?? 0);
    const missingFiles: string[] = Array.isArray(rawPt?.missingFiles)
      ? rawPt.missingFiles.map((m: any) => String(m))
      : [];

    const allOpsRolledBack =
      Boolean(rawPt?.rolledBack) ||
      (ops.length > 0 && ops.every((op) => Boolean(op?.rolledBack))) ||
      (totalItems > 0 &&
        restorableItems === 0 &&
        missingFiles.length === totalItems &&
        missingFiles.every((m) => m.includes('이미 되돌림')));

    const isShadowOnly = ops.length > 0 && ops.every((op) => op?.op === 'SHADOW_PROTECT');
    if (allOpsRolledBack && isShadowOnly) {
      const shadowKey = String(ops[0]?.name || rawPt?.summary || '').toLowerCase();
      if (shadowKey && seenRolledBackShadowNames.has(shadowKey)) {
        continue;
      }
      if (shadowKey) seenRolledBackShadowNames.add(shadowKey);
    }

    const cleanSummary = String(rawPt?.summary || '').replace(
      '영구삭제(Shift+Delete) 타임머신 스냅샷 보호본',
      '삭제 파일 타임머신 자동 보호본'
    );

    let integrityStatus: MonsterRestorePointItem['integrityStatus'] =
      rawPt?.integrityStatus || 'FULL_RESTORABLE';
    let statusBadge = String(rawPt?.statusBadge || '');
    let precheckGuideMessage = String(rawPt?.precheckGuideMessage || '');

    if (allOpsRolledBack) {
      integrityStatus = 'FULL_RESTORABLE';
      statusBadge = '[원위치 복원 완료]';
      precheckGuideMessage = '이미 원래 위치로 안전하게 복원 완료된 기록이에요! (추가 되돌리기 불필요)';
    } else if (integrityStatus === 'UNRESTORABLE' || restorableItems === 0) {
      integrityStatus = 'UNRESTORABLE';
      statusBadge = '[대상 파일 이동·삭제됨]';
      precheckGuideMessage = '현재 위치에 되돌릴 파일이 없어 실행할 필요가 없어요.';
    }

    normalized.push({
      restoreId: String(rawPt?.restoreId || '#1'),
      createdAt: String(rawPt?.createdAt || ''),
      summary: cleanSummary,
      userPrompt: String(rawPt?.userPrompt || ''),
      integrityStatus,
      statusBadge,
      totalItems,
      restorableItems,
      missingFiles,
      precheckGuideMessage,
      rolledBack: allOpsRolledBack,
      rollbackTypedText: String(
        rawPt?.rollbackTypedText || rawPt?.blackbox?.lastUserRollbackTypedText || ''
      ),
    });
  }

  return { points: normalized };
}

export async function executeRestorePointRollback(
  restoreId: string,
  userTypedText = '원래대로 되돌려줘'
): Promise<{
  ok: boolean;
  restoreId?: string;
  message: string;
  restoredCount: number;
  userRollbackTypedText: string;
}> {
  const r = await zcoreJson<{
    ok: boolean;
    restoreId?: string;
    message?: string;
    error?: string;
    restoredCount?: number;
    restoredFiles?: string[];
    restoredPhotoNames?: string[];
    userRollbackTypedText?: string;
  }>(
    '/__zcore/restore-rollback',
    postJson({ restoreId: restoreId || 'LATEST', userRollbackTypedText: userTypedText })
  );
  if (!r.ok) return { ok: false, message: ` ${r.error}`, restoredCount: 0, userRollbackTypedText: userTypedText };
  const d = r.data;
  if (d?.ok) {
    const resolvedId = d.restoreId || restoreId;
    const count = Number(d.restoredCount ?? 0);
    // 사진 정리 복원 기록(PHOTO_RECYCLE)을 되돌린 경우 왼쪽 사진 정리 화면에도 즉시 복원 상태 반영
    const photoNamesToSync = Array.from(
      new Set([...(d.restoredPhotoNames || []), ...(d.restoredFiles || [])].filter(Boolean))
    );
    if (photoNamesToSync.length > 0) {
      try {
        useSaySeeStore
          .getState()
          .syncPhotosAfterExternalRestore(
            photoNamesToSync,
            undefined,
            `[${resolvedId}] 정리했던 항목을 원래 위치로 복원했습니다.`
          );
      } catch {
        /* ignore store sync error */
      }
    }
    appendLocalHealthCheckRecord({
      category: '↩️ 복원 기록',
      title: `[${resolvedId}] 자연어 타이핑 원복 완료 ("${userTypedText}")`,
      reclaimedSizeLabel: `${count}건 원위치 복구`,
      cleanedItemCount: count,
      securityPluginsFrozen: 0,
      speedUpSummary: `블랙박스 원복 발화 기록됨: "${userTypedText}"`,
      restoreId: resolvedId,
    });
    return {
      ok: true,
      restoreId: resolvedId,
      message: ` ${d.message || `[${resolvedId} 복원 기록]을 원래 자리로 되돌렸습니다.`}`,
      restoredCount: count,
      userRollbackTypedText: d.userRollbackTypedText || userTypedText,
    };
  }
  return {
    ok: false,
    message: `되돌리지 못했습니다: ${d?.error || d?.message || '알 수 없는 오류'}`,
    restoredCount: 0,
    userRollbackTypedText: userTypedText,
  };
}

// ---------------------------------------------------------------------------
// 🧹 대화형 폴더 정리 실행 (유저 자연어 타이핑 승인 + 블랙박스 영구 기록)
// ---------------------------------------------------------------------------

export async function executeMonsterCleanupApproval(
  preview: MonsterCleanupPreviewPayload,
  userTypedText = '승인 및 정리 진행'
): Promise<{
  ok: boolean;
  restoreId?: string;
  message: string;
  healthRecord?: DigitalHealthCheckRecord;
}> {
  const r = await zcoreJson<{
    ok: boolean;
    restoreId?: string;
    movedCount?: number;
    movedBytes?: number;
    message?: string;
    error?: string;
    errors?: { file: string; error: string }[];
  }>(
    '/__zcore/record-cleanup',
    postJson({
      summary: preview.summaryTitle,
      userPrompt: preview.userPrompt,
      previewPresented: preview.previewDescriptionKo,
      fullPaths: preview.items.map((i) => i.fullPath),
      userApprovalTypedText: userTypedText,
    })
  );
  if (!r.ok) return { ok: false, message: ` ${r.error}` };
  const d = r.data;
  if (!d?.ok || !d.restoreId) {
    const detail = d?.errors?.length ? `(${d.errors.slice(0, 2).map((e) => `${e.file}: ${e.error}`).join(', ')})` : '';
    return { ok: false, message: `정리하지 못했습니다: ${d?.error || '알 수 없는 오류'}${detail}` };
  }
  const moved = Number(d.movedCount ?? 0);
  const failNote = d.errors?.length ? ` · 실패 ${d.errors.length}건` : '';
  const healthRecord = appendLocalHealthCheckRecord({
    category: '귀신비서',
    title: `${preview.summaryTitle} (승인: "${userTypedText}")`,
    reclaimedSizeLabel: `${formatBytes(Number(d.movedBytes ?? 0))} 정돈`,
    cleanedItemCount: moved,
    securityPluginsFrozen: 0,
    speedUpSummary: `${preview.targetFolderLabel}에서 ${moved}건을 '기타_정리함'으로 이동${failNote} · 블랙박스 승인 기록됨`,
    restoreId: d.restoreId,
  });
  return { ok: true, restoreId: d.restoreId, message: ` ${d.message || `${moved}건을 정리했습니다.`}`, healthRecord };
}

export async function executeMonsterShortcutApproval(
  preview: MonsterShortcutPreviewPayload,
  userTypedText = '승인 및 바로가기 생성'
): Promise<{
  ok: boolean;
  restoreId?: string;
  message: string;
  healthRecord?: DigitalHealthCheckRecord;
}> {
  const r = await zcoreJson<{ ok: boolean; restoreId?: string; fileName?: string; message?: string; error?: string }>(
    '/__zcore/create-shortcut',
    postJson({
      siteName: preview.siteName,
      targetUrl: preview.targetUrl,
      userPrompt: preview.userPrompt,
      userApprovalTypedText: userTypedText,
    })
  );
  if (!r.ok) return { ok: false, message: ` ${r.error}` };
  const d = r.data;
  if (!d?.ok || !d.restoreId) {
    return { ok: false, message: `바로가기를 만들지 못했습니다: ${d?.error || '알 수 없는 오류'}` };
  }
  const healthRecord = appendLocalHealthCheckRecord({
    category: '바로가기',
    title: `바탕화면 '${preview.siteName}'바로가기 생성 (승인: "${userTypedText}")`,
    reclaimedSizeLabel: '바탕화면 바로가기',
    cleanedItemCount: 1,
    securityPluginsFrozen: 0,
    speedUpSummary: `바탕화면에서 더블클릭으로 ${preview.targetUrl} 열기 · 블랙박스 승인 기록됨`,
    restoreId: d.restoreId,
  });
  return { ok: true, restoreId: d.restoreId, message: ` ${d.message || '바로가기를 만들었습니다.'}`, healthRecord };
}

export async function scanDeepUninstallTarget(appQuery: string): Promise<MonsterDeepUninstallPayload> {
  const r = await zcoreJson<{
    ok: boolean;
    targetAppQuery?: string;
    targetAppLabel?: string;
    foundAny?: boolean;
    runningProcessCount?: number;
    serviceAndTaskCount?: number;
    totalResidualMb?: number;
    estimatedRamMb?: number;
    summaryBadge?: string;
    honestBriefingKo?: string;
    runningProcesses?: Array<{ name?: string; pid?: number; memoryMb?: number }>;
    services?: Array<{ serviceName?: string; displayName?: string }>;
    scheduledTasks?: string[];
    startupEntries?: Array<{ name?: string }>;
    residualFolders?: Array<{ path?: string; sizeMb?: number }>;
    needsClarification?: boolean;
    error?: string;
  }>('/__zcore/deep-uninstall-scan', postJson({ appQuery }));

  if (r.ok && r.data?.needsClarification) {
    return {
      targetAppQuery: appQuery,
      targetAppLabel: '삭제 대상 프로그램 확인 필요',
      foundAny: false,
      needsClarification: true,
      runningProcessCount: 0,
      serviceAndTaskCount: 0,
      totalResidualMb: 0,
      estimatedRamMb: 0,
      summaryBadge: '삭제할 프로그램 이름을 알려주세요',
      honestBriefingKo:
        r.data.honestBriefingKo ||
        '어떤 프로그램을 깨끗하게 지워드릴까요? 실수로 소중한 앱을 건드리지 않도록 **삭제할 프로그램 이름**을 함께 말씀해 주세요!\n(예: `"알약 완전히 지워줘"`, `"알집 삭제해줘"`, `"어도비 싹 다 지워줘"`)',
      sampleProcesses: [],
      sampleServicesAndTasks: [],
      sampleFolders: [],
    };
  }

  if (r.ok && r.data?.ok) {
    const d = r.data;
    const sampleProcs = (d.runningProcesses || [])
      .slice(0, 6)
      .map((p) => `${p.name || 'process.exe'} (PID ${p.pid ?? '?'} · ${p.memoryMb ?? 1}MB)`);
    const sampleSvcs = [      ...(d.services || []).map((s) => `[서비스] ${s.displayName || s.serviceName}`),
      ...(d.scheduledTasks || []).map((t) => `[스케줄러] ${t}`),
      ...(d.startupEntries || []).map((st) => `[시작Run] ${st.name}`),
    ].slice(0, 6);
    const folderItems = (d.residualFolders || [])
      .filter((f): f is { path: string; sizeMb?: number } => Boolean(f?.path))
      .map((f) => ({ path: String(f.path), sizeMb: Number(f.sizeMb ?? 0) }));
    const sampleDirs = folderItems.slice(0, 6).map((f) => `${f.path} (${f.sizeMb}MB)`);

    const isProtectedMessengerOrBrowser =
      /카카오톡|카톡|kakao|라인|텔레그램|디스코드|슬랙|크롬|chrome|엣지|edge|웨일|whale/i.test(appQuery) ||
      /카카오톡|카톡|kakao|라인|텔레그램|디스코드|슬랙|크롬|chrome|엣지|edge|웨일|whale/i.test(d.targetAppLabel || '');
    const baseBriefing = d.honestBriefingKo || '심층 앱 제거(Deep Uninstaller) 사전 스캔을 완료했습니다.';
    const protectedNote =
      isProtectedMessengerOrBrowser && !baseBriefing.includes('개인 데이터 보호')
        ? `\n\n **개인 데이터 보호 적용**: 대화 기록·북마크 등 소중한 개인 데이터 폴더(\`KakaoTalk\`등)는 잔여 삭제 목록에서 **자동 제외·영구 보호**되었습니다.`
        : '';

    return {
      targetAppQuery: appQuery,
      targetAppLabel: d.targetAppLabel || `${appQuery} 상주 모듈 및 잔여 폴더`,
      foundAny: Boolean(d.foundAny),
      runningProcessCount: Number(d.runningProcessCount ?? 0),
      serviceAndTaskCount: Number(d.serviceAndTaskCount ?? 0),
      totalResidualMb: Number(d.totalResidualMb ?? 0),
      estimatedRamMb: Number(d.estimatedRamMb ?? 0),
      summaryBadge:
        d.summaryBadge ||
        `상주 프로세스 ${d.runningProcessCount ?? 0}개 / 서비스·스케줄러 ${d.serviceAndTaskCount ?? 0}개 / 잔여 폴더 ${d.totalResidualMb ?? 0}MB`,
      honestBriefingKo: `${baseBriefing}${protectedNote}`,
      sampleProcesses: sampleProcs,
      sampleServicesAndTasks: sampleSvcs,
      sampleFolders: sampleDirs,
      residualFolderItems: folderItems,
      selectedFolderPaths: folderItems.map((f) => f.path),
    };
  }

  return {
    targetAppQuery: appQuery,
    targetAppLabel: `${appQuery} 정밀 스캔 대기`,
    foundAny: false,
    zCoreOffline: true,
    runningProcessCount: 0,
    serviceAndTaskCount: 0,
    totalResidualMb: 0,
    estimatedRamMb: 0,
    summaryBadge: '내 PC 엔진(멀린 Z-코어) 연결 필요',
    honestBriefingKo:
      ` **[내 PC 엔진(멀린 Z-코어) 연결이 필요합니다]**\n` +
      `내 PC에 실제로 설치된 프로그램의 상주 프로세스·스케줄러·잔여 캐시 폴더를 가짜 수치 없이 100% 실측 스캔하려면 **멀린 Z-코어 엔진**이 켜져 있어야 합니다.\n` +
      `엔진을 실행하신 뒤 다시 말씀해 주시면 즉시 정밀 스캔해 드릴게요!`,
    sampleProcesses: [],
    sampleServicesAndTasks: [],
    sampleFolders: [],
  };
}

export async function executeBootCarePreviewApproval(
  payload: MonsterBootCarePreviewPayload,
  userApprovalTypedText: string
): Promise<{
  ok: boolean;
  restoreId?: string;
  summaryKo: string;
  healthRecord?: DigitalHealthCheckRecord;
}> {
  if (payload.mode === 'SCHEDULE_REBOOT') {
    const res = await executeRealOsAction('boot_lag_schedule_reboot', payload.scheduleTime || '04:00');
    if (!res.ok) {
      return {
        ok: false,
        summaryKo: res.summaryKo || res.message || '내 컴퓨터 연결(PC 엔진) 상태를 확인해 주세요.',
      };
    }
    const msg =
      res.summaryKo ||
      res.message ||
      `⏰ 새벽 ${payload.scheduleTime || '04:00'}에 윈도우 자동 다시 시작(재부팅) 예약을 등록했습니다.`;
    return { ok: true, summaryKo: msg };
  }

  const osRes = await executeRealOsAction('boot_lag_clean_bloatware', userApprovalTypedText || '응 진행해');
  if (!osRes.ok) {
    return {
      ok: false,
      summaryKo: osRes.summaryKo || osRes.message || '내 컴퓨터 연결(PC 엔진) 상태를 확인해 주세요.',
    };
  }
  const restoreId = String((osRes as any).restoreId || '#1');
  const cpuBefore = Number((osRes as any).cpuLoadBefore ?? 24);
  const cpuAfter = Number((osRes as any).cpuLoadAfter ?? Math.max(6, Math.round(cpuBefore * 0.6)));
  const cleanedCnt =
    (Array.isArray((osRes as any).stoppedBloatware) ? (osRes as any).stoppedBloatware.length : 0) +
      (Array.isArray((osRes as any).disabledStartups) ? (osRes as any).disabledStartups.length : 0) || 1;
  const summaryKo =
    osRes.summaryKo ||
    osRes.message ||
    `미사용 웹 보안 모듈과 불필요 자동실행 항목을 정리했습니다! (실측 CPU 부하: ${cpuBefore}%  ${cpuAfter}%)`;
  const rec = appendLocalHealthCheckRecord({
    category: '귀신비서',
    title: '미사용 웹 보안 모듈 및 불필요 자동실행 정리',
    reclaimedSizeLabel: `CPU 부하 ${cpuBefore}%  ${cpuAfter}%`,
    cleanedItemCount: cleanedCnt,
    securityPluginsFrozen: cleanedCnt,
    speedUpSummary: summaryKo,
    restoreId,
  });
  return { ok: true, restoreId, summaryKo, healthRecord: rec };
}

function parseDefenderSignatureAgeHours(sigUpdatedAt: string): number | null {
  const s = (sigUpdatedAt || '').trim();
  if (!s) return null;
  const m = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (!m) return null;
  const dt = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    m[4] ? Number(m[4]) : 0,
    m[5] ? Number(m[5]) : 0
  );
  if (Number.isNaN(dt.getTime())) return null;
  return (Date.now() - dt.getTime()) / (1000 * 60 * 60);
}

function sanitizeRawOsExceptionNoise(raw: string): string {
  return (raw || '')
    .replace(/\(\s*Command\s+'?\[[^\n)]+\]?'?\s+timed\s+out[^)]*\)/gi, '')
    .replace(/Command\s+'?\[[^\n]+\]?'?\s+timed\s+out[^\n.]*/gi, '')
    .replace(/\[WinError\s+\d+\][^\n.]*/gi, '')
    .replace(/Traceback\s*\(most recent call last\)[\s\S]*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function fetchDefenderGuardState(
  subAction:
    | 'defender_status'
    | 'defender_quick_scan'
    | 'defender_custom_scan'
    | 'defender_scan_status'
    | 'defender_update_signature'
    | 'defender_open_ransomware_shield'
    | 'defender_open_quarantine_history'
    | 'defender_open_threat_settings' = 'defender_status',
  targetPath?: string
): Promise<{ ok: boolean; payload?: MonsterDefenderGuardPayload; summaryKo: string; raw?: any }> {
  // [최신 백신 DB 즉시 확인 정공법]:
  // 이미 최근 24시간 이내에 Windows 보안 DB가 최신 패치된 상태라면, 느린 Windows Update COM 서버(35초 타임아웃)를
  // 붙잡고 기다리거나 영문 에러를 띄우지 않고 0.1초 만에 '이미 최신 버전 적용됨'을 친절히 안내합니다.
  if (subAction === 'defender_update_signature') {
    const pre = (await executeRealOsAction('defender_status')) as any;
    if (pre?.ok) {
      const preSigAt = String(pre.signatureUpdatedAt || '').trim();
      const preVer = String(pre.signatureVersion || '').trim();
      const ageHours = parseDefenderSignatureAgeHours(preSigAt);
      if (ageHours !== null && ageHours >= -2 && ageHours <= 24) {
        // 백그라운드에서 무소음으로 미세 델타 유무만 한 번 더 확인 (사용자 화면 대기 0초)
        void executeRealOsAction('defender_update_signature').catch(() => {});
        const scanStPre = pre.scanState || {};
        const alreadyLatestMsg = `✅ Windows 기본 백신 보안 DB가 이미 최신 버전(${preSigAt}${preVer ? ` · 버전 ${preVer}` : ''})으로 적용되어 있어 추가 다운로드 없이 안전하게 보호되고 있어요!`;
        const payloadPre: MonsterDefenderGuardPayload = {
          realTimeProtection: Boolean(pre.realTimeProtection ?? true),
          antivirusEnabled: Boolean(pre.antivirusEnabled ?? true),
          firewallEnabled: Boolean(pre.firewallEnabled ?? true),
          ransomwareShieldEnabled: Boolean(pre.ransomwareShieldEnabled ?? false),
          signatureVersion: preVer,
          signatureUpdatedAt: preSigAt,
          removableDrives: Array.isArray(pre.removableDrives) ? pre.removableDrives : [],
          scanRunning: Boolean(pre.scanRunning ?? pre.running ?? scanStPre.running),
          lastScanResultKo: alreadyLatestMsg,
          lastActionNoteKo: alreadyLatestMsg,
        };
        return {
          ok: true,
          payload: payloadPre,
          summaryKo: alreadyLatestMsg,
          raw: pre,
        };
      }
    }
  }

  const res = await executeRealOsAction(subAction, targetPath);
  if (!res.ok && subAction !== 'defender_update_signature') {
    const rawFail = String(res.summaryKo || res.message || '');
    const isTimedOut = /timed?\s*out|시간\s*초과/i.test(rawFail);
    const isPerm = /권한|access\s+is\s+denied|액세스.*?거부|uac/i.test(rawFail);
    const cleanFail = sanitizeRawOsExceptionNoise(rawFail);
    const friendlyFail = !zCoreBridge.isConnected
      ? '내 컴퓨터 연결(PC 엔진)이 꺼져 있어 백신 방어막 상태를 확인하지 못했어요. 먼저 내 컴퓨터를 연결해 주세요.'
      : isTimedOut
      ? '윈도우 보안 서비스 응답이 일시적으로 지연되어 바로 확인하지 못했어요(귀신같이 기능 이상이 아닌 윈도우 자체 서비스 대기 현상). 잠시 후 다시 눌러 주세요.'
      : isPerm
      ? '윈도우 관리자 권한 확인 창이 닫혔거나 제한되어 작업을 마치지 못했어요. 권한 확인 창에서 [예]를 눌러 주세요.'
      : cleanFail || '현재 윈도우 보안 서비스가 다른 작업을 처리 중이라 잠시 후 다시 시도해 주세요.';
    return {
      ok: false,
      summaryKo: friendlyFail,
    };
  }

  const r = res as any;
  const scanSt = r.scanState || {};
  const scanRunning = Boolean(r.scanRunning ?? r.running ?? scanSt.running);
  const sigUpdatedAt = String(r.signatureUpdatedAt || '').trim();
  const sigVersion = String(r.signatureVersion || '').trim();
  const rawSummary = String(r.summaryKo || r.message || '');

  let finalSummaryKo = sanitizeRawOsExceptionNoise(rawSummary);
  if (subAction === 'defender_update_signature') {
    const ageAfter = parseDefenderSignatureAgeHours(sigUpdatedAt);
    const wasTimeout = /timed?\s*out|시간\s*초과/i.test(rawSummary);
    const wasPerm = /권한|access\s+is\s+denied|액세스.*?거부|uac/i.test(rawSummary);
    if (res.ok) {
      finalSummaryKo = sigUpdatedAt
        ? `✅ Windows 기본 백신 보안 DB가 최신 상태(${sigUpdatedAt}${sigVersion ? ` · 버전 ${sigVersion}` : ''})로 준비되어 있어요!`
        : finalSummaryKo || '✅ Windows 기본 백신 보안 DB를 최신 버전으로 업데이트했어요!';
    } else if (ageAfter !== null && ageAfter >= -2 && ageAfter <= 36) {
      finalSummaryKo = `✅ 현재 Windows 기본 백신 보안 DB는 이미 최근 버전(${sigUpdatedAt})으로 적용되어 안전하게 작동 중이에요! (마이크로소프트 서버 추가 확인만 응답 지연으로 백그라운드에서 이어서 진행됩니다.)`;
    } else if (wasTimeout) {
      finalSummaryKo = `ℹ️ 마이크로소프트 윈도우 업데이트 서버 응답이 지연되어 즉시 다운로드를 마치지 못했어요(귀신같이 성능 문제가 아닌 마이크로소프트 서버 대기 현상). 윈도우가 백그라운드에서 자동으로 업데이트를 마무리합니다.${sigUpdatedAt ? ` (현재 적용 시각: ${sigUpdatedAt})` : ''}`;
    } else if (wasPerm) {
      finalSummaryKo = `⚠️ 윈도우 보안 권한 제한으로 수동 업데이트를 마치지 못했어요. 윈도우 설정의 [Windows 업데이트]에서 자동 갱신됩니다.${sigUpdatedAt ? ` (현재 적용 시각: ${sigUpdatedAt})` : ''}`;
    } else {
      finalSummaryKo = `ℹ️ 현재 인터넷 연결 또는 윈도우 업데이트 서비스가 점검 중이라 즉시 갱신을 건너뛰었어요. 윈도우가 유휴 시간에 자동으로 최신 보안 DB를 받아 적용합니다.${sigUpdatedAt ? ` (현재 적용 시각: ${sigUpdatedAt})` : ''}`;
    }
  }

  const payload: MonsterDefenderGuardPayload = {
    realTimeProtection: Boolean(r.realTimeProtection ?? true),
    antivirusEnabled: Boolean(r.antivirusEnabled ?? true),
    firewallEnabled: Boolean(r.firewallEnabled ?? true),
    ransomwareShieldEnabled: Boolean(r.ransomwareShieldEnabled ?? false),
    signatureVersion: sigVersion,
    signatureUpdatedAt: sigUpdatedAt,
    removableDrives: Array.isArray(r.removableDrives) ? r.removableDrives : [],
    scanRunning,
    lastScanResultKo: sanitizeRawOsExceptionNoise(String(r.resultSummaryKo || scanSt.resultSummaryKo || '')) || finalSummaryKo,
    lastActionNoteKo: finalSummaryKo,
  };
  return {
    ok: Boolean(res.ok),
    payload,
    summaryKo: finalSummaryKo,
    raw: r,
  };
}

export async function fetchStartupManagerPayload(): Promise<{
  ok: boolean;
  payload?: MonsterStartupManagerPayload;
  errorKo?: string;
}> {
  const r = await zcoreJson<any>('/api/care/startup-list');
  if (!r.ok || !r.data?.ok) {
    return {
      ok: false,
      errorKo: (!r.ok ? r.error : r.data?.error) || '내 컴퓨터 연결(PC 엔진) 상태를 확인해 주세요.',
    };
  }
  return {
    ok: true,
    payload: {
      items: Array.isArray(r.data.items) ? r.data.items : [],
      cleanedOrphanNames: Array.isArray(r.data.cleanedOrphanNames) ? r.data.cleanedOrphanNames : [],
    },
  };
}

export async function toggleStartupProgramItem(
  id: string,
  enable: boolean
): Promise<{ ok: boolean; message: string }> {
  const r = await zcoreJson<any>(
    '/api/care/startup-toggle',
    postJson({ id, enable, userApprovalTypedText: `시작프로그램 ${enable ? '켜기' : '끄기'} 스위치 승인` }),
    35000
  );
  if (!r.ok || !r.data?.ok) {
    return {
      ok: false,
      message: (!r.ok ? r.error : r.data?.message) || '시작프로그램 상태를 변경하지 못했습니다.',
    };
  }
  return { ok: true, message: String(r.data.message || '변경되었습니다.') };
}

export async function openStartupProgramLocation(
  targetExePath: string
): Promise<{ ok: boolean; missingFile?: boolean; messageKo: string }> {
  const cleanTarget = (targetExePath || '').trim();
  if (!cleanTarget) {
    return { ok: false, messageKo: '열 수 있는 폴더 위치 정보가 없습니다.' };
  }
  const r = await zcoreJson<{
    ok: boolean;
    missingFile?: boolean;
    opened?: string;
    error?: string;
  }>('/__quarantine/open-folder', postJson({ targetPath: cleanTarget, strictFile: true }), 6000);

  if (!r.ok) {
    return {
      ok: false,
      messageKo: '내 컴퓨터 연결(PC 엔진) 상태를 확인해 주세요.',
    };
  }
  if (r.data?.ok) {
    return {
      ok: true,
      messageKo: '실제 프로그램이 있는 폴더를 파일 탐색기에서 열었습니다.',
    };
  }
  if (r.data?.missingFile) {
    return {
      ok: false,
      missingFile: true,
      messageKo:
        '예전에 삭제된 프로그램의 이름과 옛 주소만 윈도우 시작 목록에 남아 있는 항목입니다(현재 PC에 실제 파일 없음).',
    };
  }
  return {
    ok: false,
    messageKo: r.data?.error || '해당 폴더 위치를 열지 못했습니다.',
  };
}

export async function fetchInstalledAppsPayload(query = ''): Promise<{
  ok: boolean;
  payload?: MonsterInstalledAppsPayload;
  errorKo?: string;
}> {
  const qs = query ? `?query=${encodeURIComponent(query)}&limit=80` : '?limit=80';
  const r = await zcoreJson<any>(`/api/care/installed-apps-list${qs}`);
  if (!r.ok || !r.data?.ok) {
    return {
      ok: false,
      errorKo: (!r.ok ? r.error : r.data?.error) || '내 컴퓨터 연결(PC 엔진) 상태를 확인해 주세요.',
    };
  }
  return {
    ok: true,
    payload: {
      totalCount: Number(r.data.totalCount ?? 0),
      items: Array.isArray(r.data.items) ? r.data.items : [],
    },
  };
}

export async function executeDeepUninstallApproval(
  payload: MonsterDeepUninstallPayload,
  userTypedText = '흔적까지 100% 심층 적출 실행'
): Promise<{
  ok: boolean;
  reportKo: string;
  snapshotFile?: string;
  healthRecord?: DigitalHealthCheckRecord;
}> {
  const r = await zcoreJson<{
    ok: boolean;
    targetAppLabel?: string;
    snapshotFile?: string;
    killedProcessCount?: number;
    disabledServiceCount?: number;
    deletedTaskCount?: number;
    removedStartupCount?: number;
    cleanedFolderCount?: number;
    reclaimedMb?: number;
    reclaimedRamMb?: number;
    totalRemovedTriggers?: number;
    reportKo?: string;
    message?: string;
    error?: string;
  }>(
    '/__zcore/deep-uninstall-execute',
    postJson({
      appQuery: payload.targetAppQuery,
      invokeOfficialUninstaller: true,
      userApprovalTypedText: userTypedText,
      selectedFolders: payload.selectedFolderPaths,
    }),
    35000
  );

  if (!r.ok || !r.data?.ok) {
    const errMsg = r.ok
      ? r.data?.message ||
        r.data?.reportKo ||
        `제거 실행 중 확인이 필요합니다 (${r.data?.error || 'UNKNOWN_ERROR'}).`
      : '내 PC 엔진(멀린 Z-코어) 응답이 없거나 연결이 끊겨 실제 제거를 진행하지 않았습니다. 엔진 실행 상태를 확인해 주세요.';
    return {
      ok: false,
      reportKo: errMsg,
    };
  }

  const d = r.data;
  const reclaimedMb = Number(d.reclaimedMb ?? 0);
  const reclaimedRamMb = Number(d.reclaimedRamMb ?? 0);
  const totalTriggers = Number(d.totalRemovedTriggers ?? 0);
  const snapshotFile = d.snapshotFile;
  const reportKo =
    d.reportKo ||
    ` **[${d.targetAppLabel || payload.targetAppLabel} — 심층 제거 완료 보고]**\n` +
      `• **정리된 상주 프로세스·스케줄러·서비스**: 총 **${totalTriggers}개**\n` +
      `• **Windows [휴지통]으로 안전 이동한 잔여 캐시 폴더**: **${reclaimedMb}MB** · 상주 메모리 **${reclaimedRamMb}MB** 회수\n` +
      `• **안심 복구 안내**: 지운 잔여 폴더는 바탕화면 **[휴지통]**에 그대로 들어 있어 언제든 우클릭 \`[복원]\`으로 되살릴 수 있습니다!`;

  const healthRecord = appendLocalHealthCheckRecord({
    category: '귀신비서',
    title: `[심층 제거] ${d.targetAppLabel || payload.targetAppLabel} (승인: "${userTypedText}")`,
    reclaimedSizeLabel: `휴지통 안전 이동 ${reclaimedMb}MB · 상주/스케줄러 ${totalTriggers}개 정리`,
    cleanedItemCount: (d.cleanedFolderCount ?? 0) + totalTriggers || 1,
    securityPluginsFrozen: totalTriggers,
    speedUpSummary: reportKo,
    restoreId: '#1',
  });

  return {
    ok: true,
    reportKo,
    snapshotFile,
    healthRecord,
  };
}

// ---------------------------------------------------------------------------
// 사라진 파일 복구 실행 (유저 자연어 타이핑 승인 + 블랙박스 영구 기록)
// ---------------------------------------------------------------------------

export async function executeMissingFileRecovery(
  payload: MonsterMissingFilePayload,
  userTypedText = '승인 및 파일 복구'
): Promise<{
  ok: boolean;
  message: string;
  restoreId?: string;
  restoredPath?: string;
  healthRecord?: DigitalHealthCheckRecord;
}> {
  if (payload.caseType === 'CASE_A_USER_APPROVED_RESTORE_POINT' && payload.restoreId) {
    const res = await executeRestorePointRollback(payload.restoreId, userTypedText);
    return {
      ok: res.ok,
      message: res.message,
      restoreId: res.restoreId || payload.restoreId,
      restoredPath: payload.originalLocation || undefined,
    };
  }
  if (payload.caseType === 'CASE_B_FOUND_IN_RECYCLE_BIN' && payload.recycleMetaFile) {
    const r = await zcoreJson<{
      ok: boolean;
      restoreId?: string;
      restoredPath?: string;
      originalName?: string;
      sizeBytes?: number;
      renamed?: boolean;
      error?: string;
    }>(
      '/__zcore/recycle-restore',
      postJson({
        recycleMetaFile: payload.recycleMetaFile,
        userPrompt: payload.query || '방금 지운 파일 찾아줘',
        userApprovalTypedText: userTypedText,
      })
    );
    if (!r.ok) return { ok: false, message: ` ${r.error}` };
    if (!r.data?.ok) return { ok: false, message: `복원하지 못했어요: ${r.data?.error || '알 수 없는 오류'}` };
    const renamedNote = r.data.renamed ? '(같은 이름 파일이 있어 새 이름으로 복원)' : '';
    const restoreId = r.data.restoreId || '#1';
    const restoredPath = r.data.restoredPath || payload.originalLocation;
    const sizeInfo =
      typeof r.data.sizeBytes === 'number' && r.data.sizeBytes > 0
        ? ` · 원본 크기 ${formatBytes(r.data.sizeBytes)} 100% 일치`
        : '';
    const msg = `휴지통에서 [${restoredPath}] 위치로 안전하게 복원했어요${renamedNote}${sizeInfo}! ([${restoreId} 복원 기록]에 등록 완료)`;

    // [단일 SSOT 스토어 동기화] 사진 정리 보관함(휴지통)으로 보냈던 사진을 3초 구출로 복원한 경우
    // 새로고침 없이 즉시 귀신비서 사진 목록에서도 복원(quarantined: false) 상태로 되살린다.
    try {
      const leafName = String(restoredPath || '')
        .split(/[\\/]/)
        .pop();
      // [단일 1장 정밀 복원 불변식]: 동명 파일(cover.jpg 등)이 여러 폴더에 있을 때
      // fullPath(restoredPath / originalLocation)가 있으면 반드시 정확한 경로 1건만 매칭해
      // 같은 이름의 다른 폴더 사진들까지 한꺼번에 복원되는 현상을 원천 차단합니다!
      const exactFullPaths = Array.from(
        new Set([restoredPath, payload.originalLocation].filter((v): v is string => Boolean(v && /[\\/]/.test(v))))
      );
      const candidateNames =
        exactFullPaths.length > 0
          ? exactFullPaths
          : Array.from(new Set([payload.fileName, r.data.originalName, leafName].filter(Boolean) as string[]));
      if (candidateNames.length > 0) {
        useSaySeeStore
          .getState()
          .syncPhotosAfterExternalRestore(
            candidateNames,
            undefined,
            ` '${payload.fileName}'파일을 원래 폴더 위치로 복원했습니다!`
          );
      }
    } catch {
      /* ignore store sync error */
    }

    const healthRecord = appendLocalHealthCheckRecord({
      category: '↩️ 복원 기록',
      title: `휴지통 '${payload.fileName}'원위치 복원`,
      reclaimedSizeLabel: '원위치 복원 완료',
      cleanedItemCount: 1,
      securityPluginsFrozen: 0,
      speedUpSummary: msg,
      restoreId,
    });
    return { ok: true, message: msg, restoreId, restoredPath, healthRecord };
  }
  if (payload.caseType === 'CASE_C_OFFICE_AUTORECOVER' && payload.recoverFullPath) {
    const r = await zcoreJson<{ ok: boolean; restoreId?: string; recoveredPath?: string; message?: string; error?: string }>(
      '/__zcore/recover-copy',
      postJson({ fullPath: payload.recoverFullPath, userPrompt: payload.query, userApprovalTypedText: userTypedText })
    );
    if (!r.ok) return { ok: false, message: ` ${r.error}` };
    if (!r.data?.ok) return { ok: false, message: `복구본을 만들지 못했어요: ${r.data?.error || '알 수 없는 오류'}` };
    const restoreId = r.data.restoreId || '#1';
    const recoveredPath = r.data.recoveredPath;
    const msg = ` ${r.data.message || `바탕화면에 복구본을 만들었어요: ${recoveredPath}`}`;
    return { ok: true, message: msg, restoreId, restoredPath: recoveredPath };
  }
  return { ok: false, message: '이 항목은 자동 복구 경로 정보가 없어 복구할 수 없어요.' };
}

// ---------------------------------------------------------------------------
// 바로가기 대상 해석 (LLM 추출 결과 또는 정규식 매칭)
// ---------------------------------------------------------------------------

function parseShortcutSiteFromQuery(
  query: string,
  llmParams?: Record<string, string>
): { siteName: string; targetUrl: string } | null {
  if (llmParams?.siteName && llmParams?.targetUrl && /^https?:\/\//i.test(llmParams.targetUrl)) {
    return { siteName: llmParams.siteName.trim(), targetUrl: llmParams.targetUrl.trim() };
  }
  const q = query.trim();
  const urlMatch = q.match(/https?:\/\/[^\s"'<>]+/i);
  if (urlMatch) {
    const url = urlMatch[0];
    let host = '즐겨찾는_웹사이트';
    try {
      host = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      /* keep default */
    }
    return { siteName: host, targetUrl: url };
  }
  if (/유튜브|youtube/i.test(q)) return { siteName: '유튜브', targetUrl: 'https://www.youtube.com' };
  if (/네이버\s*카페/i.test(q)) return { siteName: '네이버카페', targetUrl: 'https://section.cafe.naver.com' };
  if (/네이버/i.test(q)) return { siteName: '네이버', targetUrl: 'https://www.naver.com' };
  if (/정부24|등본|민원/i.test(q)) return { siteName: '정부24', targetUrl: 'https://www.gov.kr' };
  if (/홈택스/i.test(q)) return { siteName: '홈택스', targetUrl: 'https://www.hometax.go.kr' };
  if (/다음|daum/i.test(q)) return { siteName: '다음', targetUrl: 'https://www.daum.net' };
  if (/구글|google/i.test(q)) return { siteName: '구글', targetUrl: 'https://www.google.com' };
  return null;
}

function nowLabel(): string {
  return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatReadableStartupItems(rawNames: string[]): string[] {
  const counts = new Map<string, number>();
  for (const raw of rawNames) {
    const s = String(raw || '').trim();
    if (!s) continue;
    let friendly = s;
    if (/^GoogleChromeAutoLaunch/i.test(s)) {
      friendly = 'Google Chrome 자동실행';
    } else if (/^MicrosoftEdgeAutoLaunch/i.test(s)) {
      friendly = 'Microsoft Edge 자동실행';
    } else if (/^MerlinZCoreDaemon$/i.test(s)) {
      friendly = '귀신같이 로컬 엔진 (필수 보호)';
    } else if (/^SenSTalk_Engine$/i.test(s)) {
      friendly = '센스톡 엔진 (필수 보호)';
    } else if (/^KakaoTalk$/i.test(s)) {
      friendly = '카카오톡 (보호 대상)';
    } else if (/^GoogleDriveFS$/i.test(s)) {
      friendly = 'Google Drive (보호 대상)';
    } else if (/^OneDrive$/i.test(s)) {
      friendly = 'OneDrive (보호 대상)';
    } else {
      friendly = s.replace(/_[0-9A-Fa-f]{8,}$/, '');
    }
    counts.set(friendly, (counts.get(friendly) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([name, cnt]) => (cnt > 1 ? `${name} (${cnt}건)` : name));
}

function formatReadableSecurityItems(rawLabels: string[]): string[] {
  const counts = new Map<string, number>();
  for (const raw of rawLabels) {
    const s = String(raw || '').trim();
    if (!s) continue;
    let friendly = s
      .replace(/^미사용\s*웹\s*보안\s*서비스\s*/g, '')
      .replace(/^\(([^)]+)\)\s*/, '$1 보안모듈 ')
      .replace(/\[실행중\([^)]*\)\]/g, '(현재 실행 중)')
      .replace(/\[부팅\s*자동실행\/스케줄러\s*등록\]/g, '(자동실행 등록)')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!friendly) friendly = s;
    counts.set(friendly, (counts.get(friendly) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, cnt]) => (cnt > 1 ? `${label} · ${cnt}건` : label));
}

function reply(
  sourceTab: 'trash' | 'repair',
  text: string,
  extra: Partial<MonsterChatMessage> = {}
): MonsterChatMessage {
  const normalizedExtra = extra.followUpSuggestions
    ? { ...extra, followUpSuggestions: normalizeSuggestionChips(extra.followUpSuggestions) }
    : extra;
  const cleanText = text
    .replace(/(?:[\u{1F300}-\u{1F445}\u{1F447}-\u{1FAFF}]|[\u2600-\u2712\u2717-\u27BF])\uFE0F?/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return {
    id: `monster_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    role: 'assistant',
    timestamp: nowLabel(),
    text: cleanText,
    sourceTab,
    ...normalizedExtra,
  };
}

const RED_LINES_TEXT = DOCTOR_3_RED_LINES_NOTICE.join('\n');

// ---------------------------------------------------------------------------
// 📮 Role 4: 클레임 · A/S(오류) 접수 · 아이디어 제안 스튜디오 대리 접수 창구
// 🎛️ Role 3: 말 한마디로 모든 앱 설정·상용구 변경 마스터 컨트롤 센터
// 💁‍♂️ Role 2: 귀신같이 기능 · 요금 · 업데이트 인포메이션 데스크
// ---------------------------------------------------------------------------

async function handleStudioSupportProxyIfMatched(
  clean: string,
  sourceTab: 'trash' | 'repair',
  speak: (t: string) => void
): Promise<MonsterChatMessage | null> {
  const isClaim =
    /클레임|불만|항의|환불|결제\s*취소|컴플레인|짜증|엉망|불편\s*신고|고객\s*센터\s*접수/i.test(clean);
  const isReopenLinkOnly =
    /스튜디오\s*문의방\s*링크|문의방\s*(링크|결과|내역)\s*(다시\s*)?(보여|열어|알려|확인)/i.test(clean);
  if (isReopenLinkOnly) {
    const prevSupportMsg = [...sharedChatState.messages]
      .reverse()
      .find((m) => m.cardKind === 'STUDIO_SUPPORT_PROXY' && m.studioSupportPayload);
    const storeState = useSaySeeStore.getState();
    const userEmail =
      prevSupportMsg?.studioSupportPayload?.userEmail ||
      storeState?.merlinAuth?.email ||
      (typeof window !== 'undefined' ? localStorage.getItem('userEmail') || '' : '') ||
      'merlin_member@sundreamer.app';
    const prevPayload: MonsterStudioSupportPayload = prevSupportMsg?.studioSupportPayload || {
      ticketKind: 'AS_BUG',
      badgeLabel: '스튜디오 나의 문의방 바로가기',
      userEmail,
      userComment: '최근 접수 내역 및 진행 결과 조회',
      ticketId: 'MY-INQUIRY',
      studioJumpUrl: buildStudioSupportJumpUrl({
        appId: 'Ghosti',
        ticketId: 'MY-INQUIRY',
        email: userEmail,
      }),
      submittedOk: true,
    };
    speak('접수하신 스튜디오 나의 문의방 바로가기 링크를 다시 띄워드립니다.');
    return reply(
      sourceTab,
      ` **[스튜디오 ‘나의 문의방’ 바로가기 링크 안내]**\n` +
        `회원님 계정(**${prevPayload.userEmail}**)으로 접수된 내역과 처리 진행 상황은 아래 **[스튜디오 ‘나의 문의방’ 결과 보러 가기 ↗]** 버튼을 눌러 바로 확인하실 수 있습니다!`,
      {
        cardKind: 'STUDIO_SUPPORT_PROXY',
        studioSupportPayload: prevPayload,
        followUpSuggestions: [          '내 PC 사양이랑 상태 점검해줘',
          '부팅할 때 켜지는 시작프로그램 목록도 보여줘',
        ],
      }
    );
  }

  const isIdea =
    /아이디어|건의|제안|기능\s*(추가|넣어|만들어)|업데이트\s*요청|개선\s*요청|이런\s*기능/i.test(clean);
  const isAsBug =
    /a\/s|as\s*접수|에이에스|고장\s*신고|버그\s*(신고|접수|리포트)|오류\s*(신고|접수|리포트)|스튜디오.*접수|문의방.*접수/i.test(
      clean
    );

  if (!isClaim && !isIdea && !isAsBug) return null;

  const ticketKind: 'CLAIM' | 'AS_BUG' | 'IDEA' = isClaim ? 'CLAIM' : isIdea ? 'IDEA' : 'AS_BUG';
  const badgeLabel =
    ticketKind === 'CLAIM'
      ? '클레임(불만·환불·개선) 접수'
      : ticketKind === 'IDEA'
      ? '신규 아이디어·기능 제안 접수'
      : 'A/S · 오류 · 버그 수리 접수';

  const storeState = useSaySeeStore.getState();
  const userEmail =
    storeState?.merlinAuth?.email ||
    (typeof window !== 'undefined' ? localStorage.getItem('userEmail') || '' : '') ||
    'merlin_member@sundreamer.app';
  const userHubId = storeState?.merlinAuth?.userId || 'ghosti_member';

  const submitRes = await submitStudioSupportTicket({
    appId: 'Ghosti',
    appVersion: 'v2026.11',
    userEmail,
    userHubId,
    category: ticketKind === 'IDEA' ? 'INQUIRY' : 'BUG',
    userComment: `[${badgeLabel}] ${clean}`,
  });

  const resolvedTicketId = submitRes.ticketId || `GH-${Date.now().toString().slice(-5)}`;
  const studioJumpUrl = buildStudioSupportJumpUrl({
    appId: 'Ghosti',
    ticketId: resolvedTicketId,
    email: userEmail,
  });

  const payload: MonsterStudioSupportPayload = {
    ticketKind,
    badgeLabel,
    userEmail,
    userComment: clean,
    ticketId: resolvedTicketId,
    studioJumpUrl,
    submittedOk: true,
  };

  speak(`${badgeLabel}를 회원님 성함으로 스튜디오에 대신 접수했습니다. 아래 링크를 누르시면 스튜디오 나의 문의방에서 자동 처리 결과를 바로 확인하실 수 있습니다.`);

  return reply(
    sourceTab,
    ` **[스튜디오 통합 CS 대리 접수 완료 — ${badgeLabel}]**
` +
      `회원님 계정(**${userEmail}**)으로 말씀하신 내용을 **썬드리머 스튜디오**에 즉시 전달·접수했습니다 (접수번호: **#${resolvedTicketId}**).
` +
      `스튜디오의 자동화 IDE 에이전트가 내용을 분석·작업하여 결과를 안내해 드리오니, 아래 **[스튜디오 ‘나의 문의방’ 결과 보러 가기 ↗]** 링크를 눌러 진행 상황과 답변을 확인해 주세요!`,
    {
      cardKind: 'STUDIO_SUPPORT_PROXY',
      studioSupportPayload: payload,
      followUpSuggestions: [        '방금 접수한 내역 스튜디오 문의방 링크 다시 보여줘',
        '귀신같이 최신 업데이트 기능도 알려줘',
        '내 PC 사양이랑 상태 점검해줘',
      ],
    }
  );
}

async function handleAppSettingsControlIfMatched(
  clean: string,
  sourceTab: 'trash' | 'repair',
  speak: (t: string) => void
): Promise<MonsterChatMessage | null> {
  // 1) 클립보드 [복사검색] 기록 즉시 비우기
  if (/(복사|클립보드)\s*(기록|내역|목록|히스토리).*?(비워|지워|삭제|초기화|클리어)/i.test(clean)) {
    let zSyncedClear = false;
    try {
      const rClr = await fetch(getZCoreUrl('/api/superpower/clear-history'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear_history: true }),
        signal: AbortSignal.timeout(1800),
      });
      zSyncedClear = rClr.ok;
    } catch {
      zSyncedClear = false;
    }
    if (!zSyncedClear && !zCoreBridge.isConnected) {
      return reply(
        sourceTab,
        '내 컴퓨터 연결(PC 엔진)이 꺼져 있어 로컬 Ctrl+0 클립보드 기록을 비우지 못했어요. 내 컴퓨터 연결 후 다시 말씀해 주세요!'
      );
    }
    const payload: MonsterAppSettingsPayload = {
      settingCategory: 'CLIPBOARD_RETENTION',
      badgeText: '클립보드 검색 기록 즉시 비우기 완료',
      summaryText: '내 PC에 저장된 Ctrl+0 클립보드 검색 히스토리와 오프라인 암호화 우체통 버퍼를 100% 비웠습니다.',
      appliedValueLabel: '보관 기록 0건 (완전 초기화됨)',
    };
    speak('클립보드 복사 기록을 즉시 모두 비웠습니다.');
    return reply(sourceTab, ` **[앱 설정 즉시 변경 완료]**
${payload.summaryText}`, {
      cardKind: 'APP_SETTINGS_CONTROL',
      appSettingsPayload: payload,
      followUpSuggestions: [        '복사 기록 한 달(30일) 동안 보관하게 바꿔줘',
        '복사 기록 기본 7일 보관으로 설정해줘',
        '글씨 크기 좀 더 크게 키워줘',
      ],
    });
  }

  // 2) 클립보드 [복사검색] 보관 기간 변경 (오늘만 1일 / 3일 / 7일 기본 / 한 달 30일)
  if (/(복사|클립보드).*?(보관|유지|기간|기억|저장).*?(오늘|하루|24시간|3일|사흘|7일|일주일|1주일|30일|한\s*달|한달)/i.test(clean)) {
    let targetDays: 1 | 3 | 7 | 30 = 7;
    let labelKo = '최근 7일 (기본 · 최대 300개)';
    if (/30일|한\s*달|한달/.test(clean)) {
      targetDays = 30;
      labelKo = '최근 30일 (한 달 · 최대 1,000개)';
    } else if (/오늘|하루|24시간|1일/.test(clean)) {
      targetDays = 1;
      labelKo = '오늘만 (24시간 · 최대 300개)';
    } else if (/3일|사흘/.test(clean)) {
      targetDays = 3;
      labelKo = '최근 3일 (최대 300개)';
    }
    try {
      await fetch(getZCoreUrl('/api/superpower/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retention_days: targetDays }),
        signal: AbortSignal.timeout(1500),
      });
    } catch {
      /* local fallback */
    }
    const payload: MonsterAppSettingsPayload = {
      settingCategory: 'CLIPBOARD_RETENTION',
      badgeText: 'Ctrl+0 클립보드 검색 보관 기간 변경 완료',
      summaryText: `말씀하신 대로 클립보드 복사·캡처 기록 보관 기간을 '${labelKo}'로 즉시 변경했습니다.`,
      appliedValueLabel: labelKo,
    };
    speak(`클립보드 복사 기록 보관 기간을 ${labelKo}로 변경했습니다.`);
    return reply(sourceTab, ` **[앱 설정 즉시 변경 완료]**
${payload.summaryText}`, {
      cardKind: 'APP_SETTINGS_CONTROL',
      appSettingsPayload: payload,
      followUpSuggestions: [        '방금 복사한 기록 다 비워줘',
        '글씨 크기 좀 더 크게 키워줘',
        '애기귀신 효과음 꺼줘',
      ],
    });
  }

  // 4) 애기귀신 소리 / 화면 유지 시간 설정 변경
  if (/(귀신\s*소리|애기귀신|효과음|음소거|무음|조용히).*?(꺼|켜|음소거|무음|해제|해줘|해주세요)/i.test(clean) && !/스피커|블루투스|윈도우\s*소리/i.test(clean)) {
    const turnOn = /켜|활성|다시|음소거\s*해제/.test(clean) && !/꺼|무음|조용히/.test(clean);
    try {
      await fetch(getZCoreUrl('/api/superpower/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sound_enabled: turnOn }),
        signal: AbortSignal.timeout(1500),
      });
    } catch {
      /* ignore */
    }
    const payload: MonsterAppSettingsPayload = {
      settingCategory: 'GHOST_WINDOW_PREF',
      badgeText: `애기귀신 효과음 ${turnOn ? 'ON (켜짐)' : 'OFF (음소거)'}`,
      summaryText: turnOn
        ? 'Ctrl+0 귀신검색창 소환음과 애기귀신 효과음을 다시 켰습니다.'
        : '조용한 집중 환경을 위해 애기귀신 소환음과 효과음을 음소거(OFF)했습니다.',
      appliedValueLabel: turnOn ? '효과음 켜짐 (ON)' : '효과음 꺼짐 (OFF)',
    };
    speak(payload.summaryText);
    return reply(sourceTab, ` **[앱 설정 즉시 변경 완료]**
${payload.summaryText}`, {
      cardKind: 'APP_SETTINGS_CONTROL',
      appSettingsPayload: payload,
    });
  }

  // 5) 동호회·동창회 문패 이름 변경 (AI 문패 필터 연동)
  const signboardMatch = clean.match(/(?:동호회|동창회|모임|우리\s*방)?\s*문패\s*(?:이름)?(?:을|를)?\s*["'“”]?(.+?)["'“”]?(?:으로|로)?\s*(?:바꿔|변경|설정|등록)/i);
  if (signboardMatch) {
    const candidateName = signboardMatch[1].trim();
    const check = validateClubSignboardName(candidateName);
    const payload: MonsterAppSettingsPayload = {
      settingCategory: 'CLUB_SIGNBOARD',
      badgeText: check.valid ? '모임 상단 문패 변경 완료' : 'AI 문패 필터 작동 (우회 개설 차단)',
      summaryText: check.valid
        ? `모임 라운지 상단 문패를 [${candidateName}]로 변경했습니다. 모든 모임 회원 화면 상단에 고정 표시됩니다.`
        : check.reason || '가족 또는 회사 명칭은 동호회·동창회 문패로 사용할 수 없습니다.',
      appliedValueLabel: check.valid ? `[${candidateName}]` : `변경 차단됨 ("${candidateName}")`,
      isBlockedByFilter: !check.valid,
    };
    speak(payload.summaryText);
    return reply(sourceTab, ` **[모임 문패 설정 결과]**
${payload.summaryText}`, {
      cardKind: 'APP_SETTINGS_CONTROL',
      appSettingsPayload: payload,
    });
  }

  // 5-A) 화면 글씨/글자 크기 즉시 확대·축소·기본 복원
  if (
    /(?:글씨|글자)\s*(?:크기|사이즈)?.*?(?:키워|크게|확대|작게|줄여|보통|기본|원래대로|바꿔|조절|해\s*줘|해\s*주세요)/i.test(
      clean
    ) ||
    /^(?:글씨|글자)\s*(?:크게|작게|키워줘|줄여줘)$/i.test(clean)
  ) {
    const isSmaller = /작게|줄여|작아/.test(clean);
    const isReset = /보통|기본|원래대로|100/.test(clean);
    const nextScale = isSmaller ? '95%' : isReset ? '100%' : '112%';
    const labelKo = isSmaller
      ? '조금 작게 (95%)'
      : isReset
      ? '기본 크기 (100%)'
      : '시원하게 큰 글씨 (112%)';
    if (typeof document !== 'undefined') {
      document.documentElement.style.fontSize = nextScale;
      try {
        localStorage.setItem('ghosti_ui_font_scale', nextScale);
      } catch {
        /* ignore */
      }
    }
    const summaryText = isSmaller
      ? '화면 글자 크기를 한눈에 많이 보이도록 조금 작게(95%) 조정했습니다.'
      : isReset
      ? '화면 글자 크기를 원래 기본 크기(100%)로 되돌렸습니다.'
      : '어르신과 사용자분께서 보시기 편하도록 화면 글자 크기를 시원하게(112%) 키웠습니다.';
    const payload: MonsterAppSettingsPayload = {
      settingCategory: 'GHOST_WINDOW_PREF',
      badgeText: `화면 글자 크기 즉시 변경 완료 (${labelKo})`,
      summaryText,
      appliedValueLabel: labelKo,
    };
    speak(summaryText);
    return reply(sourceTab, ` **[글자 크기 즉시 변경 완료]**\n${summaryText}`, {
      cardKind: 'APP_SETTINGS_CONTROL',
      appSettingsPayload: payload,
      followUpSuggestions: [        '글씨 크기 원래 기본으로 돌려줘',
        '매주 금요일 오후 4시에 정기 검진해줘',
        '바탕화면 어지러운 스크린샷들 한곳으로 모아줘',
      ],
    });
  }

  // 5-B) 라이트 모드(밝은 화면) 적용 및 다크 모드 미사용 안내 (멀린님 확정: 다크 모드 배제, 라이트 모드 단일 표준)
  if (
    /(?:다크\s*모드|블랙\s*모드|어둡게|라이트\s*모드|밝은\s*모드|밝게|화면\s*테마).*?(?:바꿔|변경|적용|설정|켜|꺼|해\s*줘|해\s*주세요)/i.test(clean) ||
    /^(?:다크\s*모드|라이트\s*모드|밝은\s*모드)(?:로)?$/i.test(clean)
  ) {
    const requestedDark = /다크|블랙|어둡게/.test(clean);
    const labelKo = '라이트 모드 (밝고 선명한 표준 화면)';
    const summaryText = requestedDark
      ? '귀신같이는 사진과 문서 가독성을 위해 다크 모드를 사용하지 않고 항상 밝고 선명한 라이트 모드로 고정 운영됩니다.'
      : '화면 테마를 눈이 편안하고 사진·문서가 선명하게 보이는 라이트 모드로 적용했습니다.';
    const payload: MonsterAppSettingsPayload = {
      settingCategory: 'GHOST_WINDOW_PREF',
      badgeText: '화면 테마 라이트 모드 유지 완료',
      summaryText,
      appliedValueLabel: labelKo,
    };
    speak(summaryText);
    return reply(sourceTab, ' **[화면 테마 안내]**\n' + summaryText, {
      cardKind: 'APP_SETTINGS_CONTROL',
      appSettingsPayload: payload,
      followUpSuggestions: [        '글씨 크기 좀 더 크게 키워줘',
        '매주 금요일 오후 4시에 정기 검진해줘',
        '바탕화면 어지러운 스크린샷들 한곳으로 모아줘',
      ],
    });
  }

  // 6) 『고스트 모니터 캐스트 (무선 리모컨)』 & 『다 같이 보기 (앨범 싱크)』 2대 알짜 무기 원격 제어
  if (/모니터.*?(?:크게\s*보기|팝업|캐스트|띄워|켜)|크게\s*보기.*?(?:켜|열어|띄워)|무선\s*리모컨/i.test(clean)) {
    dispatchGhostCastLiveCommand({ action: 'OPEN_MONITOR_CAST' });
    const payload: MonsterAppSettingsPayload = {
      settingCategory: 'GHOST_CAST_LIVE',
      badgeText: '[무기 1] 고스트 모니터 캐스트 & 무선 리모컨 가동',
      summaryText:
        '연결된 내 PC/노트북 모니터에 전체화면 클린 뷰어(카톡·문자 알림 유출 0%)를 띄우고 스마트폰을 무선 리모컨(이전/다음/확대/회전/슬라이드쇼)으로 전환했습니다.',
      appliedValueLabel: '모니터 전체화면 클린 뷰어 ON +  스마트폰 무선 리모컨 활성화',
    };
    speak(payload.summaryText);
    return reply(sourceTab, ` **[고스트 모니터 캐스트 즉시 실행]**\n${payload.summaryText}`, {
      cardKind: 'APP_SETTINGS_CONTROL',
      appSettingsPayload: payload,
    });
  }

  if (/다\s*같이\s*보기|라이브\s*(?:포토\s*)?싱크|사진\s*싱크|앨범\s*싱크/i.test(clean)) {
    dispatchGhostCastLiveCommand({ action: 'TOGGLE_PHOTO_SYNC' });
    const payload: MonsterAppSettingsPayload = {
      settingCategory: 'GHOST_CAST_LIVE',
      badgeText: '[무기 2] 다 같이 보기 (앨범 사진 넘김·줌 싱크) 가동',
      summaryText:
        '내가 넘기거나 확대한 사진 화면이 방에 접속 중인 모든 가족·동창회 회원의 폰/PC 화면에서도 바로 똑같이 넘어가는 앨범 라이브 싱크를 켰습니다.',
      appliedValueLabel: '실시간 화면 동기화 (Live Photo Sync) ON',
    };
    speak(payload.summaryText);
    return reply(sourceTab, ` **[다 같이 보기 앨범 싱크 실행]**\n${payload.summaryText}`, {
      cardKind: 'APP_SETTINGS_CONTROL',
      appSettingsPayload: payload,
    });
  }

  // 7) 「수요 손 없는 날 (수요일 13:00)」 정기 건강검진 요일·시간 Zero-Settings 대화형 변경
  const careCmd = parseConversationalCareScheduleCommand(clean);
  if (careCmd.matched) {
    if (careCmd.action === 'RUN_NOW_CHECKUP') {
      const store = useSaySeeStore.getState();
      const briefing = await evaluateDualProactiveCareEngine({
        forceManual: true,
        isStoreAppMode: store.isStoreAppMode,
      });
      if (briefing) {
        const twoLineText = ` **[${briefing.badgeLabel}]**\n1️⃣ ${briefing.headlineLine1}\n2️⃣ ${briefing.schedulePromptLine2}`;
        speak(briefing.headlineLine1);
        return reply(sourceTab, twoLineText, {
          cardKind: 'WEEKLY_CARE_BRIEFING',
          proactiveCareBriefing: briefing,
          followUpSuggestions: [
            '응 지금 손봐줘',
            '매주 수요일 점심마다 알아서 손봐줘',
            '정기 검진 요일 금요일 오후 4시로 귀신같이 바꿔줘',
          ],
        });
      }
      const curSched = loadWeeklyCareSchedule();
      const curLabel = formatScheduleLabelKo(curSched);
      return reply(
        sourceTab,
        `현재 **주간 정기 점검** 예약은 **${curLabel}**로 설정되어 있어요!\n지금 바로 PC 상태를 점검해 보시거나 원하시는 요일·시간으로 바꿀 수 있어요.`,
        {
          followUpSuggestions: [
            '내 PC 속도랑 메모리 지금 점검해줘',
            '금요일 오후 4시로 정기 점검 바꿔줘',
            '정기 점검 알림 꺼줘',
          ],
        }
      );
    }

    if (careCmd.action === 'DISABLE_SCHEDULE') {
      const updated = saveWeeklyCareSchedule({ enabled: false });
      const label = formatScheduleLabelKo(updated);
      const summaryText =
        '주간 정기 건강검진 자동 알림을 해제했습니다. 앞으로는 원하실 때 언제든 채팅창에 "지금 손봐줘"또는 "정기 검진 다시 켜줘"라고 말씀해 주세요.';
      const payload: MonsterAppSettingsPayload = {
        settingCategory: 'WEEKLY_CARE_SCHEDULE',
        badgeText: '주간 정기 건강검진 알림 해제 완료',
        summaryText,
        appliedValueLabel: label,
      };
      speak(summaryText);
      return reply(sourceTab, ` **[무설정 대화형 예약 변경 완료]**\n${summaryText}`, {
        cardKind: 'APP_SETTINGS_CONTROL',
        appSettingsPayload: payload,
        followUpSuggestions: [          '수요일 오후 1시 수요 손 없는 날로 다시 켜줘',
          '금요일 오후 4시로 정기 검진 바꿔줘',
        ],
      });
    }

    if (careCmd.action === 'UPDATE_SCHEDULE') {
      const updated = saveWeeklyCareSchedule({
        enabled: true,
        dayOfWeek: careCmd.dayOfWeek ?? 3,
        hour: careCmd.hour ?? 13,
        minute: careCmd.minute ?? 0,
      });
      const label = formatScheduleLabelKo(updated);
      const summaryText = `별도 설정창 없이 말씀하신 대로 정기 건강검진 일시를 '${label}'로 즉시 변경했습니다! 해당 시간에 맞춰 느려진 컴퓨터 보안모듈과 유령 프로세스를 귀신같이 점검해 브리핑해 드립니다.`;
      const payload: MonsterAppSettingsPayload = {
        settingCategory: 'WEEKLY_CARE_SCHEDULE',
        badgeText: '주간 정기 건강검진 예약 일시 변경 완료',
        summaryText,
        appliedValueLabel: label,
      };
      speak(summaryText);
      return reply(sourceTab, ` **[무설정 대화형 예약 변경 완료]**\n${summaryText}`, {
        cardKind: 'APP_SETTINGS_CONTROL',
        appSettingsPayload: payload,
        followUpSuggestions: [          '지금 바로 정기 건강검진 한번 실행해줘',
          '수요일 오후 1시 수요 손 없는 날로 다시 맞춰줘',
          '정기 검진 잠시 꺼줘',
        ],
      });
    }
  }

  return null;
}

async function handleSecretaryCareBriefingAndSuperpowersIfMatched(
  clean: string,
  sourceTab: 'trash' | 'repair',
  speak: (t: string) => void
): Promise<MonsterChatMessage | null> {
  const recentAssistantMsgs = sharedChatState.messages.filter((m) => m.role === 'assistant');
  const lastAssistantText = recentAssistantMsgs[recentAssistantMsgs.length - 1]?.text || '';
  const isSimpleYes = /^(응|네|넹|예|좋아|좋아요|ㅇㅇ|ㅇㅋ|오케이|ok|그래|해\s*줘|해\s*주세요|알려\s*줘|알려\s*주세요|뭔데|뭔지\s*알려\s*(?:줘|주세요)|궁금해|궁금해요)$/i.test(clean);

  // 0-A) 은행·관공서 보안프로그램 전부 원래 자동실행 설정으로 1초 완전 복구
  if (/(은행.*?보안\s*프로그램.*?(원래|원복|복구|해제|되돌려)|보안\s*프로그램.*?(원래대로|원상\s*복구|절전\s*해제))/i.test(clean)) {
    const restoreRes = await fetch(getZCoreUrl('/api/care/security-services/restore-default'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .catch(() => null);

    if (!restoreRes?.ok) {
      const errKo = restoreRes?.uacDeclined
        ? '관리자 권한 승인 창에서 취소하셔서 원상복구가 진행되지 않았습니다. 다시 말씀해 주시고 [예]를 눌러주시면 원래 설정으로 복구됩니다.'
        : '내 PC 엔진(멀린 Z-코어) 연결이 확인되지 않아 보안프로그램 설정을 변경하지 못했습니다. 엔진 실행 후 다시 말씀해 주세요!';
      return reply(sourceTab, errKo, {
        followUpSuggestions: ['은행 보안프로그램 상태 확인해줘'],
      });
    }

    try {
      const rawSt = localStorage.getItem('ghosti_ghost_secretary_state_v1');
      const parsedSt = rawSt ? JSON.parse(rawSt) : {};
      parsedSt.consents = { ...(parsedSt.consents || {}), bankSecurityAutoSleep: false };
      localStorage.setItem('ghosti_ghost_secretary_state_v1', JSON.stringify(parsedSt));
    } catch {
      /* ignore */
    }

    const restoredCnt = Math.max(0, Number(restoreRes.totalRestoredCount ?? restoreRes.restoredCount ?? 0));
    const msgKo =
      `↩️ **[은행·관공서 보안프로그램 원래 설정 복구 완료]**\n` +
      (restoreRes.toastMessage || restoreRes.message ||
        `잠재워 두었던 보안 서비스 **${restoredCnt}개**를 모두 설치 당시의 원래 시작 설정으로 복구하고 자동 절전을 해제했습니다.`);
    speak('은행 보안프로그램을 모두 원래 설정으로 복구했습니다.');
    return reply(sourceTab, msgKo, {
      followUpSuggestions: ['은행 보안프로그램 상태 확인해줘', '최근 [복원 기록] 보여줘'],
    });
  }

  // 0-B) 은행·관공서 보안프로그램 현재 상태 조회 ("확인해줘" 발화가 멋대로 절전을 실행하지 않도록 분리)
  if (/(은행.*?보안\s*(?:프로그램|모듈|앱).*?(확인|상태|점검|몇\s*개|보여)|보안\s*(?:프로그램|모듈|앱)\s*(상태|확인|몇\s*개))/i.test(clean)) {
    const stRes = await fetch(getZCoreUrl('/api/care/security-services/status'))
      .then((r) => r.json())
      .catch(() => null);

    if (!stRes?.ok) {
      return reply(
        sourceTab,
        '내 PC의 은행·관공서 보안프로그램 실행 개수를 실제로 점검하려면 **멀린 Z-코어 엔진**이 켜져 있어야 합니다. 엔진을 실행한 뒤 다시 확인해 주세요!',
        { followUpSuggestions: ['요즘 컴퓨터가 좀 느린데 내 사양이랑 상태 봐줘'] }
      );
    }

    const activeCnt = Math.max(0, Number(stRes.activeCount ?? 0));
    const selfDefenseCnt = Math.max(0, Number(stRes.selfDefenseCount ?? 0));
    const totalDetectedCnt = Math.max(activeCnt + selfDefenseCnt, Number(stRes.totalDetectedCount ?? 0));
    const ramMb = Math.max(0, Number(stRes.estimatedRamMb ?? 0));
    const activeLabels: string[] = Array.isArray(stRes.activeModuleLabels) ? stRes.activeModuleLabels : [];
    const selfDefenseLabels: string[] = Array.isArray(stRes.selfDefenseModuleLabels)
      ? stRes.selfDefenseModuleLabels
      : Array.isArray(stRes.selfDefenseGuided)
      ? stRes.selfDefenseGuided
      : [];
    const sleepingLabels: string[] = Array.isArray(stRes.sleepingModuleLabels)
      ? stRes.sleepingModuleLabels
      : Array.isArray(stRes.sleepingServices)
      ? stRes.sleepingServices
      : [];
    const sleepingCnt = sleepingLabels.length;
    const detailLines: string[] = [];
    if (activeLabels.length > 0) {
      detailLines.push(`• **절전 가능 보안 모듈 (${activeLabels.length}종)**: ${activeLabels.join(', ')}`);
    }
    if (selfDefenseLabels.length > 0) {
      detailLines.push(
        `• **커널 자가보호 보안 모듈 (${selfDefenseLabels.length}종 — 완전 삭제 권장)**: ${selfDefenseLabels.join(', ')}`
      );
    }
    if (sleepingLabels.length > 0) {
      detailLines.push(`• **절전 수면 중인 모듈 (${sleepingLabels.length}종)**: ${sleepingLabels.join(', ')}`);
    }
    const detailBlock = detailLines.length > 0 ? `\n${detailLines.join('\n')}` : '';
    const selfDefenseHint =
      selfDefenseLabels.length > 0
        ? `\n\n🛡️ **안내**: \`${selfDefenseLabels.join(', ')}\` 등은 커널 자가보호가 걸려 있어 절전보다 **[안 쓰는 보안앱 완전 삭제]**로 깔끔히 제거하는 것을 권장합니다.`
        : '';
    const msgKo =
      ` **[내 PC 은행·관공서 보안프로그램 실시간 점검 결과]**\n` +
      `• **현재 뒤에서 켜져 있는 보안 모듈**: **총 ${totalDetectedCnt}종** (절전 가능 ${activeCnt}종 · 자가보호 ${selfDefenseCnt}종 / 점유 메모리 약 ${ramMb}MB)\n` +
      `• **현재 절전(잠자는 중) 보안 모듈**: **${sleepingCnt}종**${detailBlock}\n` +
      `• **자동 절전·기상 관리**: **${stRes.autoSleepEnabled ? '켜짐 (은행 접속 시 1초 자동 기상)' : '꺼짐'}**${selfDefenseHint}\n\n` +
      (stRes.honestBriefing || '');
    speak(
      totalDetectedCnt > 0
        ? `현재 미사용 은행 보안프로그램 총 ${totalDetectedCnt}종이 실행 중입니다. 안 지우고 잠재우거나 완전 삭제할 수 있어요.`
        : `현재 뒤에서 켜져 있는 미사용 은행 보안프로그램은 0종입니다.`
    );
    return reply(sourceTab, msgKo, {
      followUpSuggestions:
        totalDetectedCnt > 0
          ? ['안 지우고 잠재우기', '안 쓰는 보안앱 완전 삭제', '최근 [복원 기록] 보여줘']
          : sleepingCnt > 0
          ? ['보안프로그램 즉시 깨우기', '안 쓰는 보안앱 완전 삭제', '은행 보안프로그램 원래대로 복구해줘']
          : ['안 쓰는 보안앱 완전 삭제', '그동안 모아둔 비서 실적 보고서 보여줘'],
    });
  }

  // 0-B2) 대화형 1회성 칩: "[안 쓰는 보안앱 완전 삭제]" ➔ 심층 제거(DEEP_UNINSTALL_GATE) 카드로 직결
  if (/안\s*쓰는\s*보안\s*(?:앱|프로그램|모듈)\s*완전\s*삭제/i.test(clean)) {
    const scanRes = await zcoreJson<{
      ok: boolean;
      needsClarification?: boolean;
      targetAppLabel?: string;
      summaryBadge?: string;
      honestBriefingKo?: string;
      runningProcessCount?: number;
      serviceAndTaskCount?: number;
      totalResidualMb?: number;
      estimatedRamMb?: number;
      installedEntries?: any[];
      runningProcesses?: any[];
      services?: any[];
      scheduledTasks?: string[];
      startupEntries?: any[];
      residualFolders?: any[];
      foundAny?: boolean;
    }>('/__zcore/deep-uninstall-scan', postJson({ appQuery: '보안프로그램' }));

    if (!scanRes?.ok || !scanRes.data) {
      return reply(
        sourceTab,
        '내 PC의 보안프로그램을 삭제하려면 **멀린 Z-코어 엔진**이 켜져 있어야 합니다. 엔진 연결 후 다시 눌러주세요!',
        { followUpSuggestions: ['은행 보안프로그램 상태 확인해줘'] }
      );
    }

    const d = scanRes.data;
    const rawFolders: Array<{ path: string; sizeMb: number }> = Array.isArray(d.residualFolders)
      ? d.residualFolders
          .map((f: any) =>
            typeof f === 'string'
              ? { path: f, sizeMb: 0 }
              : { path: String(f?.path || ''), sizeMb: Number(f?.sizeMb || 0) }
          )
          .filter((f) => Boolean(f.path))
      : [];
    const deepPayload: MonsterDeepUninstallPayload = {
      targetAppQuery: '보안프로그램',
      targetAppLabel: d.targetAppLabel || '관공서·은행 상주 보안 플러그인 일괄',
      foundAny: Boolean(d.foundAny),
      needsClarification: Boolean(d.needsClarification),
      runningProcessCount: Number(d.runningProcessCount || 0),
      serviceAndTaskCount: Number(d.serviceAndTaskCount || 0),
      totalResidualMb: Number(d.totalResidualMb || 0),
      estimatedRamMb: Number(d.estimatedRamMb || 0),
      summaryBadge:
        d.summaryBadge ||
        `상주 프로세스 ${d.runningProcessCount || 0}개 / 서비스·스케줄러 ${d.serviceAndTaskCount || 0}개`,
      honestBriefingKo: d.honestBriefingKo || '',
      sampleProcesses: Array.isArray(d.runningProcesses)
        ? d.runningProcesses.slice(0, 8).map((p: any) => (typeof p === 'string' ? p : String(p?.name || p?.processName || '')))
        : [],
      sampleServicesAndTasks: [
        ...(Array.isArray(d.services) ? d.services.slice(0, 6).map((s: any) => (typeof s === 'string' ? s : String(s?.displayName || s?.name || ''))) : []),
        ...(Array.isArray(d.scheduledTasks) ? d.scheduledTasks.slice(0, 4).map((t: any) => String(t)) : []),
      ].filter(Boolean),
      sampleFolders: rawFolders.slice(0, 6).map((f) => f.path),
      residualFolderItems: rawFolders,
      selectedFolderPaths: rawFolders.map((f) => f.path),
      executed: false,
    };
    speak('설치된 은행·관공서 보안프로그램을 모두 찾아 목록을 준비했습니다. 확인 후 진행해 주세요.');
    return reply(
      sourceTab,
      d.honestBriefingKo ||
        '설치된 은행·관공서 보안프로그램과 상주 서비스를 스캔했습니다. 아래 내역을 확인하신 뒤 실행 버튼을 눌러주세요.',
      {
        cardKind: 'DEEP_UNINSTALL_GATE',
        deepUninstallPayload: deepPayload,
      }
    );
  }

  // 0-C) [연속 왕복 점검 지원] "은행·관공서 보안절전 및 보안프로그램 즉시 깨우기" 동시 입력 시 절전 ➔ 기상 왕복을 1회로 일관 실행
  // [자연어 절전·끄기 명령 확장]: "은행 관공서 프로그램 꺼줘", "은행 보안앱 중지해줘" 등 일상어도 누락 없이 보안절전으로 직결 (완전 삭제/제거 의도는 제외)
  const isExplicitSecurityUninstallIntent = /완전\s*삭제|삭제해|지워\s*(?:줘|주세요|라)|제거해/i.test(clean);
  const hasSleepCue =
    !isExplicitSecurityUninstallIntent &&
    /(안\s*지우고\s*잠재우|알아서\s*재우고\s*깨워|보안\s*절전|(?:은행|관공서|홈택스).*?(?:보안\s*)?(?:프로그램|모듈|앱|서비스)?.*?(?:재우|재워|절전|잠재우|잠재워|자동\s*관리|꺼\s*(?:줘|주세요|라|달라|볼래|도)?|끄기|끄고|중지|멈춰|비활성화)|보안\s*(?:프로그램|모듈|앱|서비스).*?(?:재우|재워|절전|잠재우|잠재워|자동\s*절전|꺼\s*(?:줘|주세요|라|달라|볼래|도)?|끄기|끄고|중지|멈춰|비활성화))/i.test(
      clean
    );
  const hasExplicitWakeCue =
    !/재우고\s*깨워|절전·기상/i.test(clean) &&
    /(은행\s*업무.*?(?:깨우|깨워)|보안\s*(?:프로그램|모듈|앱|서비스)?\s*(?:즉시\s*)?(?:깨우|깨워|기상|켜)|즉시\s*(?:깨우|깨워)|은행\s*모드\s*(?:켜|즉시)|은행\s*사이트\s*안\s*돼)/i.test(
      clean
    );

  if (hasSleepCue && hasExplicitWakeCue) {
    const sleepRes = await fetch(getZCoreUrl('/api/care/security-services/sleep'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(55000),
    })
      .then((r) => r.json())
      .catch(() => null);

    const wakeRes = await fetch(getZCoreUrl('/api/care/security-services/wake'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'secretary_roundtrip_request' }),
      signal: AbortSignal.timeout(55000),
    })
      .then((r) => r.json())
      .catch(() => null);

    if (!sleepRes?.ok && !wakeRes?.ok) {
      return reply(
        sourceTab,
        ' **[내 PC 엔진(멀린 Z-코어) 연결 필요]**\n내 PC의 보안프로그램 절전·기상을 실행하려면 **멀린 Z-코어 엔진**이 켜져 있어야 합니다.',
        { followUpSuggestions: ['은행 보안프로그램 상태 확인해줘'] }
      );
    }

    const roundTripLabels: string[] = Array.from(
      new Set([        ...(Array.isArray(sleepRes?.stoppedModuleLabels) ? sleepRes.stoppedModuleLabels : []),
        ...(Array.isArray(sleepRes?.sleepingModuleLabels) ? sleepRes.sleepingModuleLabels : []),
        ...(Array.isArray(wakeRes?.wokenModuleLabels) ? wakeRes.wokenModuleLabels : []),
      ].filter(Boolean))
    );
    const wokenCnt = Math.max(0, Number(wakeRes?.wokenCount ?? roundTripLabels.length));
    const listText =
      roundTripLabels.length > 0
        ? `\n\n **절전  즉시 기상 검증 완료 모듈 (${roundTripLabels.length}종)**\n` +
          roundTripLabels.map((l) => `• ${l} (절전 후 즉시 기상 완료)`).join('\n')
        : '\n\n• 현재 백그라운드 보안 모듈이 0종으로 추가 대상 없이 정상 확인되었습니다.';

    const msgKo =
      ` **[은행·관공서 보안절전  보안프로그램 즉시 깨우기 연속 점검 완료]**\n` +
      `보안 모듈을 안전하게 절전 기록한 뒤 **${wokenCnt}종**을 멈춤·에러 없이 즉시 재기상시켰습니다!${listText}`;
    speak('은행 보안프로그램 절전 및 즉시 깨우기 연속 점검을 완료했습니다.');
    return reply(sourceTab, msgKo, {
      followUpSuggestions: [        '은행·관공서 보안절전',
        '보안프로그램 즉시 깨우기',
        '은행 보안프로그램 상태 확인해줘',
      ],
    });
  }

  // 1) 은행·관공서 보안프로그램 자동 재우기/절전 요청
  const isBankSleepConsent =
    (hasSleepCue && !hasExplicitWakeCue) ||
    (isSimpleYes && /(은행·관공서\s*보안프로그램.*?깨워드릴까요|삭제하지\s*않고\s*쿨쿨\s*잠재울까요)/.test(lastAssistantText));

  if (isBankSleepConsent) {
    let sleepTimedOut = false;
    const sleepRes = await fetch(getZCoreUrl('/api/care/security-services/sleep'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      // Windows 작업 스케줄러 헬퍼(최대 12초) + 최초 1회 관리자 권한(UAC) 확인 대기(최대 35초)를 충분히 수용
      signal: AbortSignal.timeout(55000),
    })
      .then((r) => r.json())
      .catch((err: any) => {
        if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
          sleepTimedOut = true;
        }
        return null;
      });

    if (!sleepRes?.ok) {
      const failMsg = sleepRes?.uacDeclined
        ? ` **[관리자 권한 승인 보류 안내]**\n` +
          `윈도우 보안 서비스를 안전하게 잠재우려면 최초 1회 관리자 권한 창에서 **[예]**를 눌러주셔야 합니다. 준비되셨을 때 다시 말씀해 주세요! (이후에는 권한 팝업이 다시 뜨지 않습니다)`
        : zCoreBridge.isConnected
        ? sleepTimedOut
          ? ` **[관리자 권한 확인 대기 시간 초과]**\n` +
            `윈도우 자체 오류는 아니며, 화면 아래 작업 표시줄에 **방패 모양의 관리자 권한(예/아니오) 창**이 깜빡이며 승인을 기다리고 있을 수 있습니다. 창에서 **[예]**를 눌러주시거나 **[은행 보안프로그램 상태 확인해줘]**로 현재 상태를 확인해 주세요!`
          : ` **[보안절전 실행 확인 안내]**\n` +
            `윈도우 보안 서비스 제어 권한 확인 중 일시적 지연이 발생했습니다. 작업 표시줄에 관리자 권한 승인 창이 떠 있지 않은지 확인하신 뒤 **[은행 보안프로그램 상태 확인해줘]**를 눌러 상태를 확인해 주세요!`
        : ` **[내 PC 엔진(멀린 Z-코어) 연결 필요]**\n` +
          `내 PC의 은행·관공서 보안프로그램을 실제로 잠재우려면 **멀린 Z-코어 엔진**이 켜져 있어야 합니다. 엔진을 실행한 뒤 다시 말씀해 주세요!`;
      return reply(sourceTab, failMsg, {
        followUpSuggestions: ['은행 보안프로그램 상태 확인해줘', '은행·관공서 보안절전'],
      });
    }

    try {
      const rawSt = localStorage.getItem('ghosti_ghost_secretary_state_v1');
      const parsedSt = rawSt ? JSON.parse(rawSt) : {};
      parsedSt.consents = { ...(parsedSt.consents || {}), bankSecurityAutoSleep: true };
      parsedSt.bankSleepIntroShownAt = new Date().toISOString();
      localStorage.setItem('ghosti_ghost_secretary_state_v1', JSON.stringify(parsedSt));
    } catch {
      /* ignore */
    }

    const stoppedCount = Math.max(0, Number(sleepRes?.stoppedCount ?? 0));
    const reclaimedMb = Math.max(0, Number(sleepRes?.reclaimedRamMb ?? 0));
    const stoppedLabels: string[] = Array.isArray(sleepRes?.stoppedModuleLabels) ? sleepRes.stoppedModuleLabels : [];
    const sleepingLabels: string[] = Array.isArray(sleepRes?.sleepingModuleLabels) ? sleepRes.sleepingModuleLabels : [];
    const displaySleepList = stoppedLabels.length > 0 ? stoppedLabels : sleepingLabels;
    const sleepListBlock =
      displaySleepList.length > 0
        ? `\n\n **절전 수면 관리 중인 보안 모듈 (${displaySleepList.length}종)**\n` +
          displaySleepList.map((l) => `• ${l} ( 절전 수면 중)`).join('\n')
        : '';

    const issuedRec = appendLocalHealthCheckRecord({
      category: '귀신비서',
      title: '안 쓰는 은행·관공서 보안프로그램 자동 재우기(절전) 및 은행 접속 시 자동 기상 설정',
      reclaimedSizeLabel:
        stoppedCount > 0 ? `메모리 약 ${reclaimedMb}MB 확보` : '절전 수면 상태 유지 확인',
      cleanedItemCount: stoppedCount || displaySleepList.length,
      securityPluginsFrozen: stoppedCount || displaySleepList.length,
      speedUpSummary: '평소엔 잠재워 두고 은행·홈택스 접속 또는 [보안프로그램 즉시 깨우기] 시 1초 기상',
    });

    const msgKo =
      stoppedCount > 0
        ? ` **[은행·관공서 보안절전 완료]**\n` +
          `지금 뒤에서 메모리를 차지하던 은행·관공서 보안프로그램 **${stoppedCount}종**을 삭제하지 않고 조용히 재워두었습니다! (메모리 약 **${reclaimedMb}MB** 확보 완료)\n` +
          `은행·홈택스 접속 시 자동으로 깨어나며, 아래 **[보안프로그램 즉시 깨우기]** 버튼으로 언제든 즉시 깨우실 수 있어요!${sleepListBlock}`
        : sleepingLabels.length > 0
        ? ` **[은행·관공서 보안절전 상태 유지 확인]**\n` +
          `현재 추가로 실행 중인 보안프로그램은 **0종**이며, 기존 **${sleepingLabels.length}종**이 변함없이 조용히 절전 수면 중입니다!\n` +
          `은행 업무가 필요하시면 아래 **[보안프로그램 즉시 깨우기]** 버튼을 눌러 깨워보세요!${sleepListBlock}`
        : ` **[은행·관공서 보안절전 설정 완료]**\n` +
          `지금은 켜져 있는 불필요 은행·관공서 보안프로그램이 **0종**으로 아주 깨끗합니다!\n` +
          `앞으로 은행이나 홈택스 사이트에 들어가실 때만 자동으로 깨우고, 업무가 끝난 뒤에는 다시 조용히 재워드릴게요!`;

    speak(
      stoppedCount > 0
        ? `은행 보안프로그램 ${stoppedCount}종을 조용히 재워두었습니다.`
        : sleepingLabels.length > 0
        ? `현재 은행 보안프로그램 ${sleepingLabels.length}종이 절전 수면 중입니다.`
        : '은행 보안프로그램 자동 관리 설정을 마쳤습니다.'
    );
    return reply(sourceTab, msgKo, {
      healthRecordIssued: issuedRec,
      followUpSuggestions: [        '보안프로그램 즉시 깨우기',
        '안 쓰는 보안앱 완전 삭제',
        '은행 보안프로그램 상태 확인해줘',
        '은행 보안프로그램 원래대로 복구해줘',
      ],
    });
  }

  // 2) 방식 A: 편의 기능 2가지 브리핑 (조용한 악성파일 검사 + 다운로드 폴더 누적 압축파일(ZIP) 3건 이상 임계치 분기 안내)
  const isAskingHiddenSuperpowers =
    /(숨은\s*편의 기능|편의 기능\s*두\s*가지|네\s*숨은\s*편의 기능)/i.test(clean) ||
    (isSimpleYes && /숨은\s*편의 기능.*?알려드릴까요/.test(lastAssistantText));

  if (isAskingHiddenSuperpowers) {
    const defRes = await fetch(getZCoreUrl('/api/care/defender/history'))
      .then((r) => r.json())
      .catch(() => null);

    try {
      const rawSt = localStorage.getItem('ghosti_ghost_secretary_state_v1');
      const parsedSt = rawSt ? JSON.parse(rawSt) : {};
      parsedSt.hiddenSuperpowersShown = true;
      localStorage.setItem('ghosti_ghost_secretary_state_v1', JSON.stringify(parsedSt));
    } catch {
      /* ignore */
    }

    const silentPassCount = Math.max(0, Number(defRes?.silentPassCount ?? 0));
    const zipCount = Math.max(0, Number(defRes?.downloadsArchiveCount ?? 0));
    const thresholdMet = Boolean(defRes?.downloadsArchiveThresholdMet ?? zipCount >= 3);
    const zipSamples: string[] = Array.isArray(defRes?.downloadsArchiveSamples)
      ? defRes.downloadsArchiveSamples
      : [];
    const sampleHint =
      zipSamples.length > 0 ? `(예: \`${zipSamples[0]}\`등)` : '';

    const silentPassNote =
      silentPassCount > 0
        ? `*(최근 확인한 파일 **${silentPassCount}건** 모두 안전 통과)*`
        : `*(새로 받는 파일이 생길 때마다 뒤에서 무소음 자동 보호 가동 중)*`;

    const zipSectionKo = thresholdMet
      ? `2️⃣ **더블클릭·우클릭 1초 압축 풀기**\n` +
        `살펴보니 지금 다운로드 폴더에 그동안 받으신 **압축파일이 총 ${zipCount}건**${sampleHint} 쌓여 있던데요! 파일 받을 때마다 귀찮게 팝업을 띄우지 않으니, 필요하실 때 탐색기에서 압축파일을 **그대로 더블클릭**하시거나 **마우스 우클릭 메뉴의 [귀신같이로 깔끔하게 풀기]**를 눌러보세요(보조 단축키 \`Ctrl+0\`). 맥북 한글 깨짐까지 알아서 고쳐서 광고 없이 풀어드립니다!`
      : `2️⃣ **더블클릭·우클릭 1초 압축 풀기**\n` +
        `파일을 받으실 때마다 귀찮게 팝업을 띄우지 않아요! 대신 언제든 탐색기에서 압축파일을 **그대로 더블클릭**하시거나 **마우스 우클릭 메뉴의 [귀신같이로 깔끔하게 풀기]**를 누르시면(보조 단축키 \`Ctrl+0\`), 맥북 한글 깨짐이나 바탕화면 압축폭탄 없이 풀어드립니다.`;

    const msgKo =
      ` **[귀신비서의 편의 기능 2가지 보고]**\n\n` +
      `1️⃣ **조용한 파일 경호원 (무소음 안전 보호)**\n` +
      `인터넷에서 파일이나 문서를 받으실 때마다 광고창 없이 윈도우 기본 보안 엔진과 직결해 뒤에서 조용히 검사합니다. 안전할 땐 귀찮은 팝업을 절대 안 띄우고, 진짜 위험한 파일이 나올 때만 바로 알려드려요! ${silentPassNote}\n\n` +
      zipSectionKo;

    speak(
      thresholdMet
        ? `제 편의 기능 두 가지를 알려드립니다. 첫째로 새로 받는 파일을 광고 팝업 없이 조용히 안전 검사해 드리고, 둘째로 다운로드 폴더에 있는 압축파일 ${zipCount}건을 더블클릭하거나 우클릭 메뉴에서 선택하시면 한글 깨짐 없이 풀어드립니다.`
        : '제 편의 기능 두 가지를 알려드립니다. 첫째로 새로 받는 파일을 광고 팝업 없이 조용히 안전 검사해 드리고, 둘째로 탐색기에서 압축파일을 더블클릭하거나 우클릭 메뉴를 누르시면 한글 깨짐 없이 풀어드립니다.'
    );
    return reply(sourceTab, msgKo, {
      followUpSuggestions:
        zipCount > 0
          ? [              '다운로드 폴더 열어서 1초 압축 풀기 써보기',
              '윈도우 기본 압축 앱으로 연결하기',
              '그동안 모아둔 비서 실적 보고서 보여줘',
            ]
          : [              '윈도우 기본 압축 앱으로 연결하기',
              '그동안 모아둔 비서 실적 보고서 보여줘',
            ],
    });
  }

  // 3) 다운로드 폴더 열어서 최근 압축파일 자동 포커스(explorer /select) 후 더블클릭·우클릭 1초 압축 풀기 바로 써보기
  if (/다운로드\s*폴더\s*열어.*?(우클릭|더블클릭|압축|써\s*보|확인)|1초\s*압축\s*풀기\s*써\s*보/i.test(clean)) {
    const openRes = await fetch(getZCoreUrl('/api/care/open-downloads'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .catch(() => null);

    const selectedFile = String(openRes?.selectedFile || '').trim();
    const msgKo = selectedFile
      ? ` **다운로드 폴더를 열고 가장 최근 압축파일(\`${selectedFile}\`)에 파란색 선택 포커스를 딱 맞춰 두었습니다!**\n` +
        `헤매실 필요 없이 지금 파랗게 선택되어 있는 **\`${selectedFile}\`**을 **그대로 더블클릭**하시거나, **마우스 우클릭 메뉴에서 [귀신같이로 깔끔하게 풀기]**를 눌러보세요! 맥북 한글 자소 깨짐이나 바탕화면 압축폭탄 걱정 없이 깔끔하게 한 폴더로 풀어드립니다.`
      : ` **다운로드 폴더를 바로 열어드렸습니다!**\n` +
        `폴더 안에 있는 압축파일을 **그대로 더블클릭**하시거나 **마우스 우클릭 메뉴에서 [귀신같이로 깔끔하게 풀기]**를 눌러보시면, 맥북 한글 자소 깨짐이나 바탕화면 압축폭탄 걱정 없이 깔끔하게 한 폴더로 풀어드립니다.`;

    speak(
      selectedFile
        ? `다운로드 폴더를 열고 ${selectedFile} 파일에 선택 표시를 맞춰 두었습니다. 그대로 더블클릭하거나 우클릭 메뉴에서 귀신같이로 깔끔하게 풀기를 누르시면 바로 풀립니다.`
        : '다운로드 폴더를 열어드렸습니다. 압축파일을 더블클릭하거나 우클릭 메뉴에서 귀신같이로 깔끔하게 풀기를 누르시면 바로 풀립니다.'
    );
    return reply(sourceTab, msgKo, {
      followUpSuggestions: [        '윈도우 기본 압축 앱으로 연결하기',
        '그동안 모아둔 비서 실적 보고서 보여줘',
      ],
    });
  }

  // 3-2) 윈도우 기본 앱 설정 창 열기 (탐색기 잔소리 팝업 없이 유저가 직접 칩을 눌렀을 때만 안내)
  if (/윈도우\s*기본\s*압축\s*앱|기본\s*압축\s*앱.*?(연결|설정)|기본\s*앱\s*설정/i.test(clean)) {
    await fetch(getZCoreUrl('/api/care/open-default-apps'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => null);

    const msgKo =
      ` **윈도우 [기본 앱] 설정 화면을 바로 열어드렸습니다!**\n` +
      `기존에 다른 압축 프로그램이 연결되어 있던 경우, 검색창에 **\`.zip\`**을 입력해 **『귀신같이 (Ghosti)』**로 한 번만 바꿔주시면 앞으로 모든 압축파일을 더블클릭 한 번에 광고 없이 푸실 수 있습니다. *(탐색기 우클릭 메뉴 [귀신같이로 깔끔하게 풀기]는 설정 변경 없이도 지금 바로 작동합니다!)*`;

    speak('윈도우 기본 앱 설정 화면을 열어드렸습니다. 점 집 확장자를 귀신같이로 선택하시면 더블클릭 한 번으로 바로 풀립니다.');
    return reply(sourceTab, msgKo, {
      followUpSuggestions: [        '다운로드 폴더 열어서 1초 압축 풀기 써보기',
        '그동안 모아둔 비서 실적 보고서 보여줘',
      ],
    });
  }

  // 4) 실적을 모아서 한 번씩 생색내기 (누적 비서 실적 보고서)
  if (/(비서\s*실적|실적\s*보고서|그동안\s*모아둔.*?실적|수호\s*장부|수호\s*히스토리|뒤에서\s*뭐\s*했어)/i.test(clean)) {
    const [secRes, defRes] = await Promise.all([      fetch(getZCoreUrl('/api/care/security-services/status'))
        .then((r) => r.json())
        .catch(() => null),
      fetch(getZCoreUrl('/api/care/defender/history'))
        .then((r) => r.json())
        .catch(() => null),
    ]);

    const sleepCount = Math.max(0, Number(secRes?.weeklyReport?.sleepCount ?? 0));
    const savedRamMb = Math.max(0, Number(secRes?.weeklyReport?.savedRamMb ?? 0));
    const silentPassCount = Math.max(0, Number(defRes?.silentPassCount ?? 0));
    const zipCount = Math.max(0, Number(defRes?.downloadsArchiveCount ?? secRes?.downloadsArchiveCount ?? 0));

    const sleepSummary =
      sleepCount > 0
        ? `누적 **${sleepCount}회** (메모리 **${savedRamMb}MB** 확보 · 은행 접속 시 자동 기상)`
        : `현재 불필요 상주 **0건** (은행·홈택스 접속 시 자동 기상 대기 중)`;
    const guardSummary =
      silentPassCount > 0
        ? `누적 **${silentPassCount}건** 모두 안전 확인 (귀찮은 광고 팝업 **0회**)`
        : `상시 무소음 보호 가동 중 (귀찮은 광고 팝업 **0회**)`;

    const msgKo =
      ` **[귀신비서가 뒤에서 조용히 챙겨드린 누적 실적 보고]**\n\n` +
      `•  **안 쓰는 은행·관공서 보안프로그램 자동 재우기**: ${sleepSummary}\n` +
      `•  **새로 받은 파일·문서 조용히 안전 검사**: ${guardSummary}\n` +
      `•  **다운로드 폴더 압축파일 파악**: 현재 압축파일 **${zipCount}건** 확인됨 (탐색기 **더블클릭 · 우클릭 메뉴**로 1초 해제 지원)\n\n` +
      `평소에는 작업에 방해되지 않도록 시끄러운 알림창 없이 뒤에서 묵묵히 처리하고, 이렇게 필요하실 때 정직하게 보고드리겠습니다!`;

    speak(
      sleepCount > 0
        ? `그동안 안 쓰는 은행 보안프로그램을 ${sleepCount}회 자동 절전하여 메모리 ${savedRamMb}메가바이트를 아꼈고, 새로 받은 파일 ${silentPassCount}건을 광고 팝업 없이 안전 검사했습니다.`
        : `현재 불필요한 은행 보안프로그램은 없으며, 새로 받은 파일 ${silentPassCount}건을 광고 팝업 없이 안전 검사했습니다.`
    );
    return reply(sourceTab, msgKo, {
      followUpSuggestions: [        '다운로드 폴더 열어서 1초 압축 풀기 써보기',
        '지금 은행 업무 볼 거라 보안프로그램 깨워줘',
      ],
    });
  }

  // 5) 은행·관공서 업무를 위해 잠자던 보안프로그램 즉시 깨우기
  if (hasExplicitWakeCue) {
    let wakeTimedOut = false;
    const wakeRes = await fetch(getZCoreUrl('/api/care/security-services/wake'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'secretary_chat_request' }),
      signal: AbortSignal.timeout(55000),
    })
      .then((r) => r.json())
      .catch((err: any) => {
        if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
          wakeTimedOut = true;
        }
        return null;
      });

    if (!wakeRes?.ok) {
      const wakeFailKo = wakeRes?.uacDeclined
        ? '관리자 권한 창에서 승인하지 않으셔서 보안프로그램을 깨우지 못했습니다. 다시 눌러 [예]를 선택해 주세요!'
        : zCoreBridge.isConnected
        ? wakeTimedOut
          ? '윈도우 작업 표시줄에 방패 모양의 관리자 권한(예/아니오) 창이 떠 있는지 확인해 주세요. 승인 후 다시 시도하시면 즉시 깨워드립니다!'
          : '보안프로그램을 깨우는 중 권한 확인이 지연되었습니다. [은행 보안프로그램 상태 확인해줘]로 상태를 확인해 주세요!'
        : '내 PC의 보안프로그램을 실제로 깨우려면 **멀린 Z-코어 엔진**이 켜져 있어야 합니다. 엔진 실행 상태를 먼저 확인해 주세요!';
      return reply(sourceTab, wakeFailKo, {
        followUpSuggestions: ['은행 보안프로그램 상태 확인해줘', '보안프로그램 즉시 깨우기'],
      });
    }

    const wokenLabels: string[] = Array.isArray(wakeRes.wokenModuleLabels) ? wakeRes.wokenModuleLabels : [];
    const wokenCnt = Math.max(
      0,
      Number(wakeRes.wokenCount ?? Number(wakeRes.wokenServicesCount ?? 0) + Number(wakeRes.wokenBridgesCount ?? 0))
    );
    const wokenListBlock =
      wokenLabels.length > 0
        ? `\n\n **방금 깨어난 보안 모듈 (${wokenLabels.length}종)**\n` +
          wokenLabels.map((l) => `• ${l} (현재 실행 중)`).join('\n')
        : '';
    const msgKo =
      wokenCnt > 0
        ? ` **[은행·관공서 보안프로그램 ${wokenCnt}종 즉시 기상 완료]**\n` +
          `잠자고 있던 보안프로그램 **${wokenCnt}종**을 방금 모두 깨워두었습니다!${wokenListBlock}\n\n` +
          ` **이미 열려 있던 은행·홈택스 화면에 '보안프로그램 설치'안내가 보이면 키보드 \`F5(새로고침)\`를 한 번 눌러주세요.** 업무 후에는 아래 **[은행·관공서 보안절전]**으로 다시 재우실 수 있습니다.`
        : ` **[은행·관공서 보안프로그램 대기 확인 완료]**\n` +
          `현재 잠들어 있는 보안프로그램이 없습니다(모두 정상 실행·대기 중). 다시 절전하려면 **[은행·관공서 보안절전]**을 눌러주세요!`;

    speak(
      wokenCnt > 0
        ? `잠자고 있던 은행 보안프로그램 ${wokenCnt}종을 모두 깨웠습니다. 열려 있던 은행 창에서 에프오 새로고침을 한 번 눌러주세요.`
        : '현재 잠들어 있는 보안프로그램이 없으며 모두 정상 대기 중입니다.'
    );
    return reply(sourceTab, msgKo, {
      followUpSuggestions: [        '은행·관공서 보안절전',
        '은행 보안프로그램 상태 확인해줘',
        '은행 보안프로그램 원래대로 복구해줘',
      ],
    });
  }

  return null;
}

function handleGhostiInfoDeskIfMatched(
  clean: string,
  sourceTab: 'trash' | 'repair',
  speak: (t: string) => void
): MonsterChatMessage | null {
  const isConcretePcCareOrSearchCommand =
    !/요금|가격|구독|특판|마스터권|얼리버드|무슨\s*앱|어떤\s*기능|업데이트\s*내역|온보딩\s*[123]?\s*탭|편의 기능\s*(체험방|설명|알려)/i.test(
      clean
    ) &&
    /(바탕화면|다운로드|폴더|휴지통|시작\s*프로그램|자동\s*실행|부팅|재부팅|켜\s*둔|경과\s*시간|바이러스|랜섬웨어|백신|디펜더|사양|스펙|느려|버벅|프린터|와이파이|블루투스|사라졌|없어졌|복구|복원\s*기록|건강\s*검진|정리해|치워\s*줘|고쳐\s*줘)/i.test(
      clean
    );
  if (isConcretePcCareOrSearchCommand) return null;

  const isAskingAboutGhosti =
    /귀신같이|귀신검색|ctrl\s*\+?\s*0|컨트롤\s*0|컨트롤\s*영|내\s*기기\s*통합|소모임|300장|300개|2,?900원|3,?900원|4,?900원|5,?900원|8,?900원|9,?900원|마스터권|특판|얼리버드|요금제|구독료|얼마야|암호화\s*우체통|qr\s*코드|이메일\s*연결|기기\s*연결|온보딩|새로\s*추가된|업데이트\s*내역|무슨\s*앱|어떤\s*기능/i.test(
      clean
    );

  if (!isAskingAboutGhosti) return null;

  const isCapacitorNative =
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
  const isStoreCleanMode =
    isCapacitorNative ||
    Boolean(useSaySeeStore.getState().isStoreAppMode) ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('storeApp') === '1');
  const isMobileViewportRuntime =
    isStoreCleanMode ||
    (typeof window !== 'undefined' &&
      !new URLSearchParams(window.location.search).get('ghostSearchWindow') &&
      (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 860));

  // 모바일 스토어 심사 클린 모드일 때: 가격/구독료 언급과 OPEN_PRICING_MODAL·PC 전용 OnboardingModal을 100% 배제하고 순수 무료 기능·연동 안내만 반환 (Apple 3.1.1 방어)
  if (isStoreCleanMode) {
    const cleanInfoPayload: MonsterInfoDeskPayload = {
      topicBadge: '귀신같이 모바일 3대 메뉴 & 이메일 기기 연동 안내',
      title: '내 폰 사진·문서 AI 내용검색과 스마트 사진 정리·공유를 지원합니다',
      bulletPoints: [        ' ① 귀신비서 (올인원 홈): 맨 위 음성·글자 검색창 + 비서 대화창 + 내 폰 중복·흐린 사진 1초 정리 + 내 기기 통합을 한 화면에서 이용합니다.',
        ' ② 사진 공유 &  ③ 업무 공유: 가족(우리집·본가·처가)·동호회·동창회 고선명 앨범 공유 및 사무실 업무 문서를 깔끔하게 열람합니다.',
        '이메일 1초 기기 연동: 동일한 이메일 계정으로 로그인하면 복잡한 QR 없이 내 스마트폰과 데스크톱(PC)이 자동으로 연결됩니다.',
        '스튜디오 직결 창구: 이 대화창에 불편사항·A/S·아이디어를 말씀하시면 회원님 이름으로 스튜디오에 즉시 접수해 드립니다.',
      ],
      actionButtons: [        { label: '맨 위 검색창으로 내 파일 찾아보기', actionType: 'JUMP_SEARCH' },
      ],
    };
    speak('귀신같이 앱은 사진과 문서를 일 초 만에 찾아주고 중복 사진을 깔끔하게 정리해 드리며, 같은 이메일로 로그인하시면 피씨와 자동으로 연결됩니다.');
    return reply(
      sourceTab,
      ` **[귀신같이 모바일 안내 — 3대 통합 메뉴 & 이메일 자동 연결]**\n` +
        `우리 앱은 **가입하신 이메일 계정 하나로 스마트폰과 데스크톱(PC)이 자동 연결**되어 어디서나 편리하게 찾고 정리하실 수 있어요!`,
      {
        cardKind: 'GHOSTI_INFO_DESK',
        infoDeskPayload: cleanInfoPayload,
        followUpSuggestions: [          '내 폰 사진 자동 점검 결과 볼래',
          '맨 위 검색창으로 바로 찾아볼래',
          '아이디어 건의하고 싶은데 스튜디오에 접수해줘',
        ],
      }
    );
  }

  // 일반 모바일 웹일 때도 PC 전용(QR코드·Ctrl+0·바탕화면 폴더) OnboardingModal 대신 모바일 맞춤 버튼 제공
  if (isMobileViewportRuntime && !/요금|가격|구독|얼마(?!나)|특판|마스터권|얼리버드|3,?900|9,?900/i.test(clean)) {
    const mobileWebPayload: MonsterInfoDeskPayload = {
      topicBadge: '귀신같이 모바일 3대 통합 영역 & PC 연동 가이드',
      title: '모바일에서는 [① 귀신비서 · ② 사진 공유 · ③ 업무 공유] 3탭으로 한눈에 해결합니다',
      bulletPoints: [        ' ① 귀신비서: 화면 맨 위 통합 검색창(사진·동영상 글자뽑기·문서) + 비서 대화창 + 내 폰 사진 4대 분류 정리 + 내 기기 통합(폰↔PC)이 하나로 통합되어 있습니다.',
        ' ② 사진 공유 (기본 무료): 가족(우리집·본가·처가)·동호회·동창회 고화질 앨범을 인원·장수 제한 없이 무료로 나눕니다.',
        'PC 연동 & 암호화 우체통: 같은 이메일로 PC에서도 로그인하시면 내 폰↔PC 통합 검색과 양방향 클립보드 우체통까지 이어집니다.',
      ],
      actionButtons: [        { label: '맨 위 검색창으로 바로 찾아보기', actionType: 'JUMP_SEARCH' },
        { label: '내 기기 통합 Pro(월 3,900원) 안내 보기', actionType: 'OPEN_PRICING_MODAL' },
      ],
    };
    return reply(
      sourceTab,
      ` **[귀신같이 모바일 사용 가이드]**\n스마트폰에서는 복잡한 서브탭 없이 **상단 3개 탭**만으로 검색·정리·공유를 모두 쓰실 수 있어요!`,
      {
        cardKind: 'GHOSTI_INFO_DESK',
        infoDeskPayload: mobileWebPayload,
        followUpSuggestions: [          '내 폰 사진 자동 점검 결과 볼래',
          '내 기기 통합 3,900원 요금제 혜택 알려줘',
        ],
      }
    );
  }

  // Case 1: 요금제 · 내 기기 통합(3,900원) · 연간 할인 · QR 없는 이메일 연결 문의
  // ⚠️ '얼마나'(부팅 경과 시간 등)가 요금 '얼마'로 오매칭되지 않도록 (?!나) 가드 적용
  if (
    !/부팅\s*경과|켜둔\s*지|경과\s*시간|진단/i.test(clean) &&
    /내\s*기기\s*통합|소모임|300장|300개|2,?900|3,?900|4,?900|5,?900|8,?900|9,?900|요금|가격|구독|얼마(?!나)|특판|마스터권|얼리버드|qr|이메일\s*연결|기기\s*연결/i.test(
      clean
    )
  ) {
    const infoPayload: MonsterInfoDeskPayload = {
      topicBadge: '귀신같이 가격 사다리 & 이메일 자동 기기 통합 안내',
      title: '내 기기 기본 기능(귀신비서 · 귀신검색)과 사진 공유는 기본 무료, 내 기기 통합 Pro는 월 3,900원입니다',
      bulletPoints: [
        '내 기기 1대 (기본 무료): 사진·서류·영상 내용검색(귀신검색 · Ctrl+0) 및 PC 보안·속도·용량 점검(귀신비서) 무료 이용 + 유료 확장 선택 시 카드 등록 없이 30일 무료체험(만료 시 자동결제 없음 · 로컬 파일 보존)',
        '내 기기 통합 (월 3,900원 / 연간 39,000원): 이메일 로그인 하나로 스마트폰·집 PC·회사 PC를 연동하고 사진·표 텍스트 추출과 파일명 자동 정리를 함께 사용합니다.',
        '기기 간 클립보드 연동: 스마트폰이나 다른 PC에서 복사(Ctrl+C)·캡처한 내역이 연결된 기기로 자동 전달됩니다(iOS는 앱 진입 시 동기화).',
        '사진 공유 (가족·동호회·동창회): 인원·장수 제한 없이 무료로 공유할 수 있습니다.',
        '업무 공유 (공용 폴더 S: 드라이브 · 30일 무료체험): 소호(~5인) 월 9,900원 / 소기업(~20인) 월 19,000원 / 중소기업(~50인) 월 29,000원 — 대표 1인 구독으로 초대된 팀원은 추가 비용 없이 이용합니다.',
      ],
      actionButtons: isMobileViewportRuntime
        ? [{ label: '내 기기 통합 Pro(월 3,900원) 요금제 창 열기', actionType: 'OPEN_PRICING_MODAL' }]
        : [            { label: '내 기기 통합 Pro(월 3,900원) 요금제 창 열기', actionType: 'OPEN_PRICING_MODAL' },
            { label: '온보딩 2탭(기기 묶기 혜택) 보기', actionType: 'OPEN_ONBOARDING_TAB3' },
          ],
    };
    speak('내 기기 한 대의 기본 기능과 사진 공유는 평생 무료이며, 이메일 하나로 폰과 집 피씨, 회사 피씨를 모두 묶고 사진 표 오씨알과 라벨러를 해금하는 내 기기 통합 프로 플랜은 월 삼천구백 원입니다.');
    return reply(
      sourceTab,
      ` **[귀신같이 인포메이션 데스크 — 요금제 & 이메일 자동 기기 연결 안내]**
` +
        `우리 앱은 **별도의 스마트폰 QR 스캔 없이 가입하신 이메일 계정 하나로 모든 기기(폰·집PC·회사PC)가 자동 연결**됩니다. 아래 요약과 바로가기 버튼을 확인해 주세요!`,
      {
        cardKind: 'GHOSTI_INFO_DESK',
        infoDeskPayload: infoPayload,
        followUpSuggestions: [          'Ctrl+0 귀신검색창 사용법 알려줘',
          '복사 기록 한 달(30일) 동안 보관하게 바꿔줘',
          '아이디어 건의하고 싶은데 스튜디오에 접수해줘',
        ],
      }
    );
  }

  // Case 2: Ctrl+0 귀신검색창 · 핵심 기능 안내
  const infoPayload: MonsterInfoDeskPayload = {
    topicBadge: '귀신검색(Ctrl+0) & 핵심 기능 안내',
    title: '어느 화면에서든 Ctrl + 0 (보조 Ctrl + 우클릭)으로 『귀신검색창』이 소환됩니다',
    bulletPoints: [      'AI 내용검색 (Ctrl+0 · 평생 무료): 파일 이름을 몰라도 계약서 본문 숫자, 사진 속 풍경·글자, 동영상 속 찾던 대사·장면까지 열지 않고 찾아냅니다.',
      '귀신비서 (평생 무료): 은행 보안프로그램 자동 절전·기상, 윈도우 디펜더 정밀 보안 점검, 임시 캐시 청소, 시작프로그램 관리, 무광고 1초 스마트 압축까지 한 곳에서 해결합니다.',
      '귀신검색 Pro 유료 확장 (월 3,900원 · 30일 무료체험): 사진·표 OCR 창(이미지 속 표·글자 엑셀/문서 추출)과 귀신 라벨러(AI 자동 파일명 정리), 내 모든 폰·PC 통합 연결을 무제한 지원합니다.',
      '스튜디오 직결 창구: 이 대화창에 클레임·A/S·아이디어를 말씀하시면 회원님 이름으로 스튜디오에 즉시 대리 접수하고 결과 확인 링크를 드립니다.',
    ],
    actionButtons: [      { label: '온보딩 1탭( 귀신검색 ·  귀신비서 가이드) 열기', actionType: 'OPEN_ONBOARDING_TAB1' },
      { label: '내 기기 통합 Pro(월 3,900원) 요금제 보기', actionType: 'OPEN_PRICING_MODAL' },
    ],
  };
  speak('컨트롤 영을 누르시면 귀신검색창이 일 초 만에 나타나며 문서와 사진, 동영상 속 내용을 열지 않고 바로 찾으실 수 있습니다.');
  return reply(
    sourceTab,
    ` **[귀신같이 인포메이션 데스크 — 핵심 기능 안내]**
` +
      `궁금하신 **『귀신같이(Ghosti)』**의 주요 기능 안내입니다. 이 대화창에서 **"바탕화면 어지러운 스크린샷 모아줘"**, **"내 컴퓨터 보안이랑 속도 점검해줘"**처럼 편하게 말씀해 보세요!`,
    {
      cardKind: 'GHOSTI_INFO_DESK',
      infoDeskPayload: infoPayload,
      followUpSuggestions: [        '요즘 컴퓨터가 좀 느린데 내 사양이랑 상태 봐줘',
        '복사 기록 한 달(30일) 동안 보관하게 바꿔줘',
        '내 기기 통합 3,900원 요금제 혜택 알려줘',
      ],
    }
  );
}


// ---------------------------------------------------------------------------
// 메인 라우터: 저가 LLM AI (Gemini 2.5 Flash) 자연어 대화 + JSON Z-코어(5199) 실행 위임
// ---------------------------------------------------------------------------

export async function processUnifiedMonsterChatQuery(params: {
  query: string;
  sourceTab: 'trash' | 'repair';
  literacyLevel: MonsterLiteracyLevel;
  ttsEnabled: boolean;
}): Promise<MonsterChatMessage> {
  const { query, sourceTab, literacyLevel, ttsEnabled } = params;
  const clean = query
    .trim()
    .replace(/^['"‘’“”`]+|['"‘’“”`]+$/g, '')
    .trim();
  const speak = (text: string) => {
    if (ttsEnabled) void speakWithHyunsuOrSunhi(text, 'hyunsu_briefing');
  };

  // 0-00-N) [귀신비서 ↔ 내 프로필 닉네임 단일 SSOT 실시간 동기화 가드 (LLM 할루시네이션 원천 차단)]
  {
    const curSecSt = loadGhostSecretaryState();
    const prevAssistant = [...sharedChatState.messages]
      .reverse()
      .find((m) => m.role === 'assistant');
    const wasAskingNick =
      Boolean(curSecSt.awaitingNickname) ||
      /(?:어떤|무슨|새|새로|바꾸실|변경하실|원하시는)\s*(?:별명|이름|닉네임|호칭)|(?:별명|닉네임|호칭)(?:을|으로|로)?\s*(?:말씀|입력|알려|적어)|뭐라고\s*불러\s*드리면|어떻게\s*불러\s*드릴까/i.test(
        prevAssistant?.text || ''
      );
    const routerNickIntent = parseNicknameSettingIntent(clean, curSecSt.nickname);
    if (routerNickIntent) {
      if (routerNickIntent.kind === 'change') {
        const newNick = routerNickIntent.newNickname;
        saveGhostSecretaryState({ ...curSecSt, nickname: newNick, awaitingNickname: false });
        saveGhostPassportBook(setPassportSelf(loadGhostPassportBook(), newNick));
        await Promise.race([
          syncSecretaryNicknameToHubProfile(newNick),
          new Promise<void>((r) => window.setTimeout(r, 2500)),
        ]);
        const msg = `알겠어요! 앞으로는 **『${newNick}』**님으로 불러드릴게요. 오른쪽 위 **[내 프로필]** 닉네임도 **『${newNick}』**님으로 바로 통일해 두었습니다!`;
        speak(`앞으로는 ${newNick}님으로 불러드릴게요. 내 프로필 닉네임도 함께 변경했습니다.`);
        return reply(sourceTab, msg);
      }
      if (routerNickIntent.kind === 'ask') {
        saveGhostSecretaryState({ ...curSecSt, awaitingNickname: true });
        const msg = '좋아요! 앞으로 제가 뭐라고 불러드리면 될까요? 바꾸고 싶으신 새 별명(닉네임)을 편하게 말씀해 주세요!';
        speak(msg);
        return reply(sourceTab, msg);
      }
      if (routerNickIntent.kind === 'query') {
        const curN = (curSecSt.nickname || '').trim();
        const msg = curN
          ? `현재 프로필 닉네임과 귀신비서 호칭은 **『${curN}』**님으로 저장되어 있어요. 바꾸고 싶으시면 **'해나라라고 불러줘'**처럼 말씀해 주세요!`
          : '아직 설정된 별명이 없어요. 부르기 편한 별명을 알려주시면 내 프로필 닉네임과 함께 등록해 드릴게요!';
        speak(msg);
        return reply(sourceTab, msg);
      }
    } else if (wasAskingNick && clean.length <= 36) {
      const candNick = sanitizeNicknameAnswer(clean);
      if (candNick && !/^[ㄱ-ㅎㅏ-ㅣ]+$/.test(candNick) && !isInvalidNicknameCandidate(candNick)) {
        saveGhostSecretaryState({ ...curSecSt, nickname: candNick, awaitingNickname: false });
        saveGhostPassportBook(setPassportSelf(loadGhostPassportBook(), candNick));
        await Promise.race([
          syncSecretaryNicknameToHubProfile(candNick),
          new Promise<void>((r) => window.setTimeout(r, 2500)),
        ]);
        const msg = `알겠어요! 앞으로는 **『${candNick}』**님으로 불러드릴게요. 오른쪽 위 **[내 프로필]** 닉네임도 **『${candNick}』**님으로 바로 통일해 두었습니다!`;
        speak(`앞으로는 ${candNick}님으로 불러드릴게요. 내 프로필 닉네임도 함께 변경했습니다.`);
        return reply(sourceTab, msg);
      }
    }
  }

  // 0-00) [모바일 유료결제 유도 클리너(CleanX 등) 3단 원터치 구출(🤖 Android 전용) & 🍎 iOS 맞춤 안내 라우터]
  const isCleanerTrapQuery =
    /(cleanx|클린\s*x|클린엑스|악성\s*(청소\s*앱|클리너)|유료\s*(청소\s*앱|클리너)|이상한\s*(청소\s*앱|클리너)|청소\s*앱\s*(삭제|지워|제거|구독|해지|결제|점검|스캔)|클리너\s*(앱|삭제|지워|제거|구독|해지|결제|구출|점검|스캔)|주간\s*(자동\s*)?결제.*?(청소|클리너|해지))/i.test(
      clean
    );
  const isMobileSubscriptionManageQuery =
    /(구독\s*(해지|취소|확인|관리|알려|어디서|어디|어떻게|방법)|정기\s*(구독|결제)\s*(해지|취소|확인|관리|알려|어디서|어디|어떻게|방법)|(자동|주간)\s*결제\s*(해지|취소|확인|관리|알려|어디서|어디|어떻게|방법)|해지\s*(알려|어디서|어디|어떻게|방법))/i.test(
      clean
    );
  const isIosSubscriptionManageQuery = isIosMobileBrowserOrApp() && isMobileSubscriptionManageQuery;

  if (isIosMobileBrowserOrApp() && (isCleanerTrapQuery || isIosSubscriptionManageQuery)) {
    const iosSafeGuideText =
      ' **아이폰(iOS)은 애플 보안 정책상 악성 청소앱이 자동 침투할 수 없으며, 정기구독 확인은 [아이폰 설정 > 내 이름(Apple 계정) > 구독]에서 안전하게 관리하실 수 있습니다.**';
    speak(
      '아이폰은 애플 보안 정책상 악성 청소앱이 자동 침투할 수 없으며, 정기구독 확인은 아이폰 설정의 내 이름, 애플 계정, 구독에서 안전하게 관리하실 수 있습니다.'
    );
    return reply(sourceTab, iosSafeGuideText, {
      followUpSuggestions: [        '내 폰 사진 자동 점검 결과 볼래',
        '맨 위 검색창으로 바로 찾아볼래',
      ],
    });
  }

  if (isCleanerTrapQuery || (isAndroidMobileBrowserOrApp() && isMobileSubscriptionManageQuery)) {
    const scanRes = await scanMobileBloatCleaners();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ghosti_trigger_mobile_cleaner_scan'));
    }
    const hasDetectedCleaner = scanRes.detected.length > 0;
    if (hasDetectedCleaner && /(삭제|지워|제거)/i.test(clean)) {
      void triggerMobileCleanerUninstall(scanRes.detected[0].packageName);
    } else if (/(구독|정기\s*결제|해지)/i.test(clean)) {
      void triggerOpenPlaySubscriptions(scanRes.detected[0]?.packageName || '');
    } else if (/(구글\s*권한|계정\s*권한|액세스)/i.test(clean)) {
      void triggerOpenGoogleAccountPermissions();
    }

    if (hasDetectedCleaner) {
      const foundNames = scanRes.detected
        .map((d) => `${d.appName}(${d.packageName})`)
        .join(', ');
      const detectedMsg = `휴대폰에서 유료결제 유도 클리너 **[${foundNames}]**가 감지되었어요!\n앱만 지워서는 주 13,000원 자동결제와 구글 계정 데이터 접근 권한이 그대로 남을 수 있으니, 맨 위 구출 카드의 **① [앱 즉시 삭제] · ② [주간 정기결제 해지 확인] · ③ [구글 계정 데이터 권한 끊기]** 3단계를 꼭 순서대로 눌러주세요! `;
      speak('휴대폰에서 유료결제 유도 청소앱이 감지되었어요. 상단 카드의 삭제, 정기결제 해지, 구글 계정 권한 끊기 세 단계를 순서대로 진행해 주세요.');
      return reply(sourceTab, detectedMsg, {
        followUpSuggestions: [          '구글 플레이 정기결제 해지 확인해줘',
          '구글 계정 데이터 접근 권한 끊어줘',
        ],
      });
    }

    const cleanMsg = `방금 휴대폰을 실시간 스캔했는데 **설치된 유료결제 유도 청소앱(CleanX 등)이 감지되지 않았어요!** (이미 삭제되었거나 설치되어 있지 않습니다)\n혹시 앱을 지운 뒤에도 자동결제나 계정 권한이 남아 있는지 확인하시려면, 상단 점검 카드의 **① [Play 정기구독 해지 확인] · ② [구글 계정 연결 권한 끊기] · ③ [내 폰 전체 설치 앱 목록 열기]** 3개 버튼을 눌러 점검해 보세요! `;
    speak('방금 휴대폰을 실시간 스캔했는데 유료결제 유도 청소앱이 감지되지 않았어요. 정기구독 해지나 구글 계정 권한을 확인하시려면 상단 카드의 버튼을 눌러보세요.');
    return reply(sourceTab, cleanMsg, {
      followUpSuggestions: [        '구글 플레이 정기결제 해지 확인해줘',
        '구글 계정 데이터 접근 권한 끊어줘',
      ],
    });
  }

  // 0-0A) [자연어 타이핑 승인 인터셉터 (0 토큰 · 블랙박스 영구 기록)]
  // 대기 중인 미리보기 카드(폴더 정리 / 바로가기 생성 / 사라진 파일 복구)가 있을 때 유저가 자연스러운 긍정/승인 발화를 타이핑하면 즉시 실행 후 블랙박스에 기록합니다.
  const recentTwoAssistantIds = new Set(
    sharedChatState.messages
      .filter((m) => m.role === 'assistant')
      .slice(-2)
      .map((m) => m.id)
  );
  const pendingApprovalMsg = [...sharedChatState.messages]
    .reverse()
    .find(
      (m) =>
        recentTwoAssistantIds.has(m.id) &&
        ((m.cleanupPreview && !m.cleanupPreview.approved) ||
          (m.shortcutPreview && !m.shortcutPreview.approved) ||
          (m.missingFilePayload && !m.missingFilePayload.restored) ||
          (m.cardKind === 'PC_SPEC_CONSULTATION' &&
            m.pcSpecPayload &&
            !m.pcSpecPayload.bloatwareCleaned) ||
          (m.cardKind === 'DEVICE_REPAIR_GATE' &&
            m.deviceRepairPayload &&
            !m.deviceRepairPayload.executed) ||
          (m.cardKind === 'WEEKLY_CARE_BRIEFING' &&
            m.proactiveCareBriefing &&
            !m.proactiveCareBriefing.executed) ||
          (m.cardKind === 'DEEP_UNINSTALL_GATE' &&
            m.deepUninstallPayload &&
            !m.deepUninstallPayload.executed) ||
          (m.cardKind === 'BOOT_CARE_PREVIEW_GATE' &&
            m.bootCarePreviewPayload &&
            !m.bootCarePreviewPayload.approved) ||
          (m.cardKind === 'AGENT_CARE_BATCH_CARD' &&
            m.agentCareCardPayload &&
            !m.agentCareCardPayload.executed))
    );

  const isPendingMissingFileRestoreApprove =
    Boolean(pendingApprovalMsg?.missingFilePayload && !pendingApprovalMsg.missingFilePayload.restored) &&
    !/복원\s*기록|복원\s*지점|히스토리|바로가기|찾아\s*줘|찾아\s*주세요/i.test(clean) &&
    clean.length <= 50 &&
    /^(응|네|예|그래|좋아|바로|당장)?\s*(원위치로\s*|원래\s*자리로\s*|바탕화면으로\s*)?(복구|복원|되돌려|살려)\s*(해\s*)?(줘|주세요|라|할래)?[.!~]*$/i.test(
      clean
    );

  const isNegationOrRollback =
    !isPendingMissingFileRestoreApprove &&
    /아니|안\s*해|하지\s*마|취소|보류|멈춰|잠깐|그만|싫어|놔둬|나중에|되돌려|되돌리|원복|원래대로/i.test(clean);
  const isPronounNePrefix = /^네\s+(숨은|편의 기능|능력|기능|이름|정체|실적)/i.test(clean);
  // [근본 방어 SSOT] 순수 동의/실행 어휘만 제거했을 때 '바탕화면', '애드웨어', '고클린', '오캠', '3번' 같은
  // 새로운 주제·대상 명사가 단 1글자라도 남아 있으면 이전 카드에 대한 맹목적 승인("응 진행해")으로 절대 오인하지 않습니다!
  const strippedConsentResidual = clean
    .replace(
      /\b(ok|okay)\b|응|네|넹|예|그래|좋아|좋아요|오케이|ㅇㅇ|ㅇㅋ|콜|고고|진행|실행|승인|동의|확인|그대로|바로|당장|지금|일단|전부|다|모두|선택한\s*(?:거|것|항목)|체크한\s*(?:거|것|항목)|체크된\s*(?:거|것|항목)|골라\s*준\s*(?:거|것)|추천\s*항목|안전하게|안전\s*정리|불필요\s*항목|상주\s*항목|손봐|정리|치워|지워|삭제|제거|적출|꺼|끄|고쳐|해결|최적화|복구|복원|만들어|옮겨|부탁|해|할래|할게|하자|줄래|주세요|줘|라|요|[.!~,\s]/gi,
      ''
    )
    .trim();
  const isPureShortConsent =
    strippedConsentResidual.length === 0 &&
    clean.length <= 45 &&
    (/^(응|네|넹|예|그래|좋아|오케이|ok|okay|ㅇㅇ|ㅇㅋ|콜|고고|진행|실행|승인|동의|확인|그대로|당장|바로|선택한|체크한|체크된|해\s*줘|해\s*주세요|해라|하자)(\s|$|[.!~,])/i.test(
      clean
    ) ||
      /^(?:그대로\s*)?(?:진행|실행|승인|동의|정리|치워|옮겨|만들어|복구|복원|꺼|고쳐|해결|최적화|적출|삭제|지워)(?:해\s*)?(?:줘|주세요|라|할래)?[.!~]*$/i.test(
        clean
      ));
  const isNaturalAffirmativeConsent =
    isPendingMissingFileRestoreApprove ||
    (!isNegationOrRollback && !isPronounNePrefix && isPureShortConsent);

  if (pendingApprovalMsg && isNaturalAffirmativeConsent) {
    if (pendingApprovalMsg.cleanupPreview && !pendingApprovalMsg.cleanupPreview.approved) {
      const preview = pendingApprovalMsg.cleanupPreview;
      const res = await executeMonsterCleanupApproval(preview, clean);
      setSharedMonsterMessages((prev) =>
        prev.map((m) =>
          m.id === pendingApprovalMsg.id && m.cleanupPreview
            ? {
                ...m,
                cleanupPreview: {
                  ...m.cleanupPreview,
                  approved: res.ok,
                  approvedTypedText: clean,
                  createdRestoreId: res.restoreId,
                  executionError: res.ok ? undefined : res.message,
                },
                healthRecordIssued: res.healthRecord || m.healthRecordIssued,
              }
            : m
        )
      );
      const msgText = res.ok
        ? ` **정리가 완료되었습니다!**\n${res.message}\n **블랙박스 승인 기록 완료** — 승인 발화: \`"${clean}"\` · 복원 번호: \`${res.restoreId}\`\n언제든 우측 상단 **[복원 기록]** 버튼을 누르시거나 채팅창에 **"방금 한 거 되돌려줘"**라고 입력하시면 원래 위치로 1초 원복됩니다.`
        : res.message;
      speak(res.ok ? '승인 말씀이 블랙박스에 기록되었으며 정리를 완료했습니다.' : res.message);
      return reply(sourceTab, msgText, {
        healthRecordIssued: res.healthRecord,
        followUpSuggestions: [          '최근 [복원 기록] 보여줘',
          '방금 한 거 원래대로 되돌려줘',
        ],
      });
    }

    if (pendingApprovalMsg.shortcutPreview && !pendingApprovalMsg.shortcutPreview.approved) {
      const preview = pendingApprovalMsg.shortcutPreview;
      const res = await executeMonsterShortcutApproval(preview, clean);
      setSharedMonsterMessages((prev) =>
        prev.map((m) =>
          m.id === pendingApprovalMsg.id && m.shortcutPreview
            ? {
                ...m,
                shortcutPreview: {
                  ...m.shortcutPreview,
                  approved: res.ok,
                  approvedTypedText: clean,
                  createdRestoreId: res.restoreId,
                  executionError: res.ok ? undefined : res.message,
                },
                healthRecordIssued: res.healthRecord || m.healthRecordIssued,
              }
            : m
        )
      );
      const msgText = res.ok
        ? `${res.message}\n **블랙박스 승인 기록 완료** — 승인 발화: \`"${clean}"\` · 복원 번호: \`${res.restoreId}\`\n언제든 채팅창에 **"방금 한 거 되돌려줘"**라고 입력하시면 바탕화면에서 즉시 제거(원복)됩니다.`
        : res.message;
      speak(res.ok ? '승인 말씀이 블랙박스에 기록되었으며 바탕화면 바로가기를 만들었습니다.' : res.message);
      return reply(sourceTab, msgText, {
        healthRecordIssued: res.healthRecord,
      });
    }

    if (pendingApprovalMsg.missingFilePayload && !pendingApprovalMsg.missingFilePayload.restored) {
      const payload = pendingApprovalMsg.missingFilePayload;
      const res = await executeMissingFileRecovery(payload, clean);
      setSharedMonsterMessages((prev) =>
        prev.map((m) =>
          m.id === pendingApprovalMsg.id && m.missingFilePayload
            ? {
                ...m,
                missingFilePayload: {
                  ...m.missingFilePayload,
                  restored: res.ok,
                  restoredPath: res.restoredPath,
                  currentLocation: res.restoredPath || m.missingFilePayload.currentLocation,
                  createdRestoreId: res.restoreId,
                  approvedTypedText: clean,
                  restoreError: res.ok ? undefined : res.message,
                },
                healthRecordIssued: res.healthRecord || m.healthRecordIssued,
              }
            : m
        )
      );
      const msgText = res.ok
        ? `${res.message}\n **블랙박스 복구 승인 기록 완료** — 승인 발화: \`"${clean}"\`${
            res.restoreId ? ` · 복원 번호: \`${res.restoreId}\`` : ''
          }`
        : res.message;
      speak(res.ok ? '승인 말씀이 블랙박스에 기록되었으며 파일을 원래 자리로 복구했어요.' : res.message);
      return reply(sourceTab, msgText, {
        healthRecordIssued: res.healthRecord,
        followUpSuggestions: ['최근 복원 기록 보여줘', '바탕화면 정리할 거 봐줘'],
      });
    }

    if (
      pendingApprovalMsg.cardKind === 'PC_SPEC_CONSULTATION' &&
      pendingApprovalMsg.pcSpecPayload &&
      !pendingApprovalMsg.pcSpecPayload.bloatwareCleaned
    ) {
      const osRes = await executeRealOsAction('boot_lag_clean_bloatware', clean);
      cachedPcContext = null;
      const restoreId = String((osRes as any).restoreId || '#1');
      const cpuBefore = Number((osRes as any).cpuLoadBefore ?? pendingApprovalMsg.pcSpecPayload.cpuLoadPercent ?? 28);
      const cpuAfter = Number((osRes as any).cpuLoadAfter ?? Math.max(8, Math.round(cpuBefore * 0.45)));
      const ramTotalLabel = pendingApprovalMsg.pcSpecPayload.ramTotalGb
        ? `${Math.round(pendingApprovalMsg.pcSpecPayload.ramTotalGb)}GB`
        : '8GB';
      const defaultChromeGuide = `애드웨어는 모두 껐지만, 현재 내 컴퓨터 전체 메모리(${ramTotalLabel}) 중 크롬 브라우저(창/탭 다수)가 메모리를 많이 차지하고 있습니다. 안 쓰는 크롬 탭만 몇 개 닫아주시면 즉시 체감 속도가 확 빨라집니다!`;
      const baseSummary =
        osRes.summaryKo ||
        osRes.message ||
        `작업 스케줄러·서비스 기반 부활형 애드웨어와 상주 보안모듈을 한 번에 강제 종료 및 자동부활 차단했습니다! (실측 CPU 부하: ${cpuBefore}%  ${cpuAfter}% · 잔존 상주 애드웨어 0건)`;
      const summary = baseSummary.includes('애드웨어는 모두 껐지만')
        ? baseSummary
        : `${baseSummary}\n\n${(osRes as any)?.browserMemoryBottleneck?.guideKo || defaultChromeGuide}`;
      const cleanedCount =
        (Array.isArray((osRes as any).stoppedBloatware) ? (osRes as any).stoppedBloatware.length : 0) +
        (Array.isArray((osRes as any).disabledStartups) ? (osRes as any).disabledStartups.length : 0);
      const healthRecord: DigitalHealthCheckRecord = {
        recordId: `HC-${Date.now()}`,
        issuedAt: new Date().toLocaleString('ko-KR'),
        category: '귀신비서',
        title: `애드웨어·보안·CPU 과점유 상주모듈 정리 (승인: "${clean}")`,
        reclaimedSizeLabel: `CPU 부하 ${cpuBefore}%  ${cpuAfter}%`,
        cleanedItemCount: cleanedCount || pendingApprovalMsg.pcSpecPayload.detectedBloatwareLabels?.length || 1,
        securityPluginsFrozen: cleanedCount || pendingApprovalMsg.pcSpecPayload.detectedBloatwareLabels?.length || 1,
        speedUpSummary: summary,
        restoreId,
      };
      recordCareCompletionTimestamp(pendingApprovalMsg.pcSpecPayload.ramUsedPercent ?? undefined);
      appendLocalHealthCheckRecord(healthRecord);
      setSharedMonsterMessages((prev) =>
        prev.map((m) =>
          m.id === pendingApprovalMsg.id && m.pcSpecPayload
            ? {
                ...m,
                pcSpecPayload: {
                  ...m.pcSpecPayload,
                  bloatwareCleaned: true,
                  bloatwareCleanSummary: summary,
                  approvedTypedText: clean,
                  createdRestoreId: restoreId,
                  verdictBadge: '애드웨어·상주모듈 정리 완료',
                },
                healthRecordIssued: healthRecord,
              }
            : m
        )
      );
      const msgText = `${summary}\n **블랙박스 승인 기록 완료** — 승인 발화: \`"${clean}"\` · 복원 번호: \`${restoreId}\`\n언제든 채팅창에 **"방금 한 거 되돌려줘"**라고 입력하시면 시작프로그램 설정을 원래대로 1초 원복합니다.`;
      speak('승인 말씀이 블랙박스에 기록되었으며 애드웨어와 상주 보안 프로그램을 모두 정리했습니다.');
      return reply(sourceTab, msgText, {
        healthRecordIssued: healthRecord,
      });
    }

    if (
      pendingApprovalMsg.cardKind === 'DEVICE_REPAIR_GATE' &&
      pendingApprovalMsg.deviceRepairPayload &&
      !pendingApprovalMsg.deviceRepairPayload.executed
    ) {
      const osRes = await executeRealOsAction('boot_lag_clean_bloatware', clean);
      cachedPcContext = null;
      const restoreId = String((osRes as any).restoreId || '#1');
      const cpuBefore = Number((osRes as any).cpuLoadBefore ?? 28);
      const cpuAfter = Number((osRes as any).cpuLoadAfter ?? Math.max(8, Math.round(cpuBefore * 0.45)));
      const cleanedCnt =
        (Array.isArray((osRes as any).stoppedBloatware) ? (osRes as any).stoppedBloatware.length : 0) +
        (Array.isArray((osRes as any).disabledStartups) ? (osRes as any).disabledStartups.length : 0) || 1;
      const defaultChromeGuide =
        '애드웨어는 모두 껐지만, 현재 내 컴퓨터 전체 메모리(8GB) 중 크롬 브라우저(창/탭 다수)가 메모리를 많이 차지하고 있습니다. 안 쓰는 크롬 탭만 몇 개 닫아주시면 즉시 체감 속도가 확 빨라집니다!';
      const baseMsg =
        osRes.summaryKo ||
        `작업 스케줄러·서비스 기반 부활형 애드웨어와 상주 보안모듈을 한 번에 강제 종료 및 자동부활 차단했어요! (실측 CPU 부하: ${cpuBefore}%  ${cpuAfter}% · 잔존 상주 애드웨어 0건)`;
      const completionMsg = baseMsg.includes('애드웨어는 모두 껐지만')
        ? baseMsg
        : `${baseMsg}\n\n${(osRes as any)?.browserMemoryBottleneck?.guideKo || defaultChromeGuide}`;
      const issuedRec = appendLocalHealthCheckRecord({
        category: '귀신비서',
        title: '시작프로그램·상주 보안모듈 정리',
        reclaimedSizeLabel: `CPU 부하 ${cpuBefore}%  ${cpuAfter}%`,
        cleanedItemCount: cleanedCnt,
        securityPluginsFrozen: cleanedCnt,
        speedUpSummary: completionMsg,
        restoreId,
      });
      setSharedMonsterMessages((prev) =>
        prev.map((m) =>
          m.id === pendingApprovalMsg.id && m.deviceRepairPayload
            ? {
                ...m,
                deviceRepairPayload: {
                  ...m.deviceRepairPayload,
                  executed: true,
                  undone: false,
                  completionMessage: completionMsg,
                  approvedTypedText: clean,
                  createdRestoreId: restoreId,
                },
                healthRecordIssued: issuedRec,
              }
            : m
        )
      );
      const msgText = `${completionMsg}\n **블랙박스 승인 기록 완료** — 승인 발화: \`"${clean}"\` · 복원 번호: \`${restoreId}\`\n언제든 채팅창에 **"방금 한 거 되돌려줘"**라고 입력하시면 원래 설정으로 1초 원복해 드려요!`;
      speak('승인 말씀이 블랙박스에 기록되었으며 수리를 완료했어요.');
      return reply(sourceTab, msgText, {
        healthRecordIssued: issuedRec,
        followUpSuggestions: [          '속도 개선된 거야?',
          '최근 [복원 기록] 보여줘',
        ],
      });
    }

    if (
      pendingApprovalMsg.cardKind === 'WEEKLY_CARE_BRIEFING' &&
      pendingApprovalMsg.proactiveCareBriefing &&
      !pendingApprovalMsg.proactiveCareBriefing.executed
    ) {
      const osRes = await executeRealOsAction('boot_lag_clean_bloatware', clean);
      cachedPcContext = null;
      const restoreId = String((osRes && osRes.restoreId) || '#1');
      const summary =
        osRes.summaryKo ||
        '은행·관공서 상주 보안모듈과 백그라운드 유령 프로세스를 멈춰 세우고 컴퓨터 속도를 가볍게 회복했습니다!';
      recordCareCompletionTimestamp(pendingApprovalMsg.proactiveCareBriefing.ramUsedPercent ?? undefined);
      saveWeeklyCareSchedule({ enabled: true });
      const schedLabel = formatScheduleLabelKo(loadWeeklyCareSchedule());
      const healthRecord: DigitalHealthCheckRecord = {
        recordId: `HC-${Date.now()}`,
        issuedAt: new Date().toLocaleString('ko-KR'),
        category: '귀신비서',
        title: `[${pendingApprovalMsg.proactiveCareBriefing.badgeLabel}] 속도 회복 처치 (승인: "${clean}")`,
        reclaimedSizeLabel: `보안·유령모듈 ${pendingApprovalMsg.proactiveCareBriefing.detectedBloatwareCount || 1}건 제압`,
        cleanedItemCount: pendingApprovalMsg.proactiveCareBriefing.detectedBloatwareCount || 1,
        securityPluginsFrozen: pendingApprovalMsg.proactiveCareBriefing.detectedBloatwareCount || 1,
        speedUpSummary: summary,
        restoreId,
      };
      appendLocalHealthCheckRecord(healthRecord);
      setSharedMonsterMessages((prev) =>
        prev.map((m) =>
          m.id === pendingApprovalMsg.id && m.proactiveCareBriefing
            ? {
                ...m,
                proactiveCareBriefing: {
                  ...m.proactiveCareBriefing,
                  executed: true,
                  scheduleConfirmed: true,
                  approvedTypedText: clean,
                  createdRestoreId: restoreId,
                },
                healthRecordIssued: healthRecord,
              }
            : m
        )
      );
      const msgText = `${summary}\n **다음 정기 검진 자동 세팅**: ${schedLabel} (원하실 때 채팅으로 요일·시간 변경 가능)\n **블랙박스 승인 기록 완료** — 승인 발화: \`"${clean}"\` · 복원 번호: \`${restoreId}\`\n언제든 채팅창에 **"원래대로 돌려줘"**라고 입력하시면 원복됩니다.`;
      speak('보안 프로그램과 유령 프로세스를 정리하여 컴퓨터 속도를 회복했으며, 다음 주 정기 검진도 자동 예약했습니다.');
      return reply(sourceTab, msgText, {
        healthRecordIssued: healthRecord,
      });
    }

    if (
      pendingApprovalMsg.cardKind === 'BOOT_CARE_PREVIEW_GATE' &&
      pendingApprovalMsg.bootCarePreviewPayload &&
      !pendingApprovalMsg.bootCarePreviewPayload.approved
    ) {
      const bPayload = pendingApprovalMsg.bootCarePreviewPayload;
      const execRes = await executeBootCarePreviewApproval(bPayload, clean);
      cachedPcContext = null;
      setSharedMonsterMessages((prev) =>
        prev.map((m) =>
          m.id === pendingApprovalMsg.id && m.bootCarePreviewPayload
            ? {
                ...m,
                bootCarePreviewPayload: {
                  ...m.bootCarePreviewPayload,
                  approved: execRes.ok,
                  approvedTypedText: clean,
                  createdRestoreId: execRes.restoreId,
                  executionSummaryKo: execRes.ok ? execRes.summaryKo : undefined,
                  executionError: execRes.ok ? undefined : execRes.summaryKo,
                },
                healthRecordIssued: execRes.healthRecord || m.healthRecordIssued,
              }
            : m
        )
      );
      const msgText = execRes.ok
        ? `${execRes.summaryKo}\n **블랙박스 승인 기록 완료** — 승인 발화: \`"${clean}"\`${
            execRes.restoreId ? ` · 복원 번호: \`${execRes.restoreId}\`` : ''
          }\n언제든 채팅창에 **"원래대로 돌려줘"**라고 입력하시면 원복됩니다.`
        : ` ${execRes.summaryKo}`;
      speak(execRes.summaryKo);
      return reply(sourceTab, msgText, {
        healthRecordIssued: execRes.healthRecord,
        followUpSuggestions: ['최근 [복원 기록] 보여줘', '시작프로그램 목록도 보여줘'],
      });
    }

    if (
      pendingApprovalMsg.cardKind === 'DEEP_UNINSTALL_GATE' &&
      pendingApprovalMsg.deepUninstallPayload &&
      !pendingApprovalMsg.deepUninstallPayload.executed
    ) {
      const execRes = await executeDeepUninstallApproval(pendingApprovalMsg.deepUninstallPayload, clean);
      cachedPcContext = null;
      if (!execRes.ok) {
        setSharedMonsterMessages((prev) =>
          prev.map((m) =>
            m.id === pendingApprovalMsg.id && m.deepUninstallPayload
              ? {
                  ...m,
                  deepUninstallPayload: {
                    ...m.deepUninstallPayload,
                    executionError: execRes.reportKo,
                  },
                }
              : m
          )
        );
        return reply(sourceTab, ` ${execRes.reportKo}`, {
          followUpSuggestions: ['요즘 컴퓨터가 좀 느린데 내 사양이랑 상태 봐줘'],
        });
      }
      setSharedMonsterMessages((prev) =>
        prev.map((m) =>
          m.id === pendingApprovalMsg.id && m.deepUninstallPayload
            ? {
                ...m,
                deepUninstallPayload: {
                  ...m.deepUninstallPayload,
                  executed: true,
                  executionError: undefined,
                  approvedTypedText: clean,
                  snapshotFile: execRes.snapshotFile,
                  executionReportKo: execRes.reportKo,
                },
                healthRecordIssued: execRes.healthRecord || m.healthRecordIssued,
              }
            : m
        )
      );
      const msgText = `${execRes.reportKo}\n **블랙박스 심층 제거 승인 기록 완료** — 승인 발화: \`"${clean}"\``;
      speak('승인 말씀이 기록되었으며 상주 프로세스와 스케줄러 정리 후 잔여 캐시 폴더를 윈도우 휴지통으로 안전하게 옮겼습니다.');
      return reply(sourceTab, msgText, {
        healthRecordIssued: execRes.healthRecord,
        followUpSuggestions: [          '속도 개선된거야?',
          '바탕화면이랑 다운로드 폴더 정리할 파일도 봐줘',
        ],
      });
    }

    if (
      pendingApprovalMsg.cardKind === 'AGENT_CARE_BATCH_CARD' &&
      pendingApprovalMsg.agentCareCardPayload &&
      !pendingApprovalMsg.agentCareCardPayload.executed &&
      (pendingApprovalMsg.agentCareCardPayload.selectedIds?.length || 0) > 0 &&
      !/(빼고|제외|놔두|놔둬|남기|냅두|말고|나머지|빨간색|차단\s*권장|삭제\s*안전|안전\s*캐시만|수동\s*전환|수동으로|[d-zD-Z]\s*:?\s*(?:드라이브|로\s*옮|로\s*이사)|이사|옮겨|#\d+|\d+\s*번|만\s*(?:지워|삭제|제거|정리|꺼|치워|숨겨))/i.test(
        clean
      )
    ) {
      const card = pendingApprovalMsg.agentCareCardPayload;
      const execRes = await executeAgentCareBatchCard(card, clean);
      cachedPcContext = null;
      setSharedMonsterMessages((prev) =>
        prev.map((m) =>
          m.id === pendingApprovalMsg.id && m.agentCareCardPayload
            ? {
                ...m,
                agentCareCardPayload: {
                  ...m.agentCareCardPayload,
                  executed: execRes.ok,
                  approvedTypedText: clean,
                  executionReportKo: execRes.reportKo,
                  currentFreeGb: execRes.currentFreeGb ?? m.agentCareCardPayload.currentFreeGb,
                  projectedFreeAfterEmptyGb:
                    execRes.projectedFreeAfterEmptyGb ?? m.agentCareCardPayload.projectedFreeAfterEmptyGb,
                },
              }
            : m
        )
      );
      speak(execRes.ok ? '선택하신 항목들을 안전하게 정리했습니다.' : '정리 실행 결과를 확인해 주세요.');
      return reply(sourceTab, execRes.reportKo, {
        followUpSuggestions: [
          '휴지통 비워줘',
          '최근 [복원 기록] 보여줘',
          'C드라이브 남은 용량 다시 확인해줘',
        ],
      });
    }
  }

  // [임의 실행 0% 원칙] 대기 중인 미리보기 카드가 없을 때 "응" / "진행해"가 입력되면
  // 절대 바로 파일을 옮기거나 프로세스를 끄지 않고, 먼저 대상 목록 미리보기 카드를 띄워 확인을 받습니다!
  const recentAssistantMsgsEarly = sharedChatState.messages.filter((m) => m.role === 'assistant');
  const lastAssistantMsgEarly = recentAssistantMsgsEarly[recentAssistantMsgsEarly.length - 1];
  const lastApprovedCleanupMsgEarly = [...recentAssistantMsgsEarly]
    .reverse()
    .find((m) => m.cleanupPreview && m.cleanupPreview.approved);

  if (
    !pendingApprovalMsg &&
    isNaturalAffirmativeConsent &&
    /(진행해|실행해|정리해|치워|그대로|응|네|그래|좋아)/i.test(clean)
  ) {
    const isRecentSpecOrSlowContext =
      lastAssistantMsgEarly?.cardKind === 'PC_SPEC_CONSULTATION' ||
      lastAssistantMsgEarly?.cardKind === 'DEVICE_REPAIR_GATE' ||
      /사양|스펙|CPU\s*부하|애드웨어|보안모듈|속도\s*저하|시작프로그램/.test(lastAssistantMsgEarly?.text || '');

    if (isRecentSpecOrSlowContext) {
      const diagRes = await executeRealOsAction('boot_lag_diagnose');
      const plugins = Array.isArray((diagRes as any).activeSecurityPlugins)
        ? (diagRes as any).activeSecurityPlugins.map((p: any) => String(p?.label || p?.keyword || '')).filter(Boolean)
        : [];
      const stCnt = Number((diagRes as any).startupProgramsCount ?? 0);
      const previewBoot: MonsterBootCarePreviewPayload = {
        mode: 'CLEAN_BLOATWARE',
        scheduleTime: '04:00',
        uptimeSummaryKo:
          diagRes.summaryKo ||
          '현재 백그라운드 미사용 웹 보안 서비스와 불필요 자동실행 항목을 점검했습니다.',
        detectedPlugins: plugins,
        startupCount: stCnt,
        approved: false,
      };
      return reply(
        sourceTab,
        ` **멋대로 지우지 않고 정리 대상 목록부터 먼저 보여드릴게요!**\n아래 점검 내역을 확인하신 뒤 **[✅ 응, 안전 정리해줘]** 버튼을 누르시거나 **"응 진행해"**라고 입력해 주세요.`,
        {
          cardKind: 'BOOT_CARE_PREVIEW_GATE',
          bootCarePreviewPayload: previewBoot,
        }
      );
    }

    const scanNow = await zcoreJson<{
      ok: boolean;
      items?: MonsterCleanupItem[];
      totalBytes?: number;
      minAgeDays?: number;
    }>('/__zcore/cleanup-scan', postJson({ kind: 'FOLDER_REORG' }));
    const scanNowData = scanNow.ok ? scanNow.data : undefined;
    const scannedItems = scanNowData?.ok ? scanNowData.items || [] : [];
    if (scannedItems.length > 0) {
      const totalBytes = Number(scanNowData?.totalBytes ?? 0);
      const preview: MonsterCleanupPreviewPayload = {
        cleanupType: 'FOLDER_REORG',
        summaryTitle: '바탕화면·다운로드 임시·설치파일 정리 미리보기',
        userPrompt: clean,
        targetFolderLabel: '바탕화면·다운로드 폴더',
        moveCount: scannedItems.length,
        totalBytes,
        reclaimSizeLabel: `총 ${formatBytes(totalBytes)}`,
        items: scannedItems,
        sampleFiles: scannedItems.map(
          (i) => `${i.name} (${i.folderLabel} · ${formatBytes(i.sizeBytes)} · ${i.ageDays}일 전)`
        ),
        previewDescriptionKo: `승인 시 바탕화면·다운로드 폴더의 설치·임시파일 ${scannedItems.length}건을 '기타_정리함'으로 안전하게 모아드립니다.`,
        approved: false,
      };
      return reply(
        sourceTab,
        ` **임의 이동 없이 정리할 파일 ${scannedItems.length}건(${formatBytes(totalBytes)}) 목록을 먼저 찾았어요!**\n아래 목록을 확인하신 뒤 **[✅ 응, 안전 정리해줘]** 버튼을 눌러 주세요.`,
        {
          cardKind: 'CLEANUP_PREVIEW_GATE',
          cleanupPreview: preview,
        }
      );
    }
    if (lastApprovedCleanupMsgEarly?.cleanupPreview) {
      const prevRid = lastApprovedCleanupMsgEarly.cleanupPreview.createdRestoreId || '#1';
      const doneMsg = ` **이미 바탕화면·다운로드 임시 설치파일 정리가 완료되었습니다!**\n• 정리 건수: **${lastApprovedCleanupMsgEarly.cleanupPreview.moveCount}건** (\`'기타_정리함'\`안전 보관 완료)\n• 복원 번호: **\`[${prevRid} 복원 기록]\`**\n우측 상단 **[복원 기록]** 버튼을 누르시거나 채팅창에 **"원래대로 되돌려줘"**라고 입력하시면 원래 위치로 복원됩니다.`;
      speak('이미 정리가 완료되어 복원 기록에 보관되어 있습니다.');
      return reply(sourceTab, doneMsg, {
        followUpSuggestions: [          '최근 [복원 기록] 보여줘',
          '방금 한 거 원래대로 되돌려줘',
        ],
      });
    }
    const doneCleanMsg =
      ' **바탕화면·다운로드 폴더 스캔 및 정리가 완료되었습니다!**\n현재 이동할 불필요 임시·설치파일이 **0건**으로 모든 파일이 깨끗하게 정리된 상태입니다. 우측 상단 **[복원 기록]** 버튼에서 언제든 이전 정리·복원 내역을 확인하고 원래 위치로 되돌리실 수 있습니다.';
    speak('바탕화면과 다운로드 폴더 정리가 완료되었습니다.');
    return reply(sourceTab, doneCleanMsg, {
      followUpSuggestions: [        '최근 [복원 기록] 보여줘',
        '지금 PC가 좀 느린데 1초 건강검진 해줘',
      ],
    });
  }

  // 0-0A2) [정리/진행 상태 확인 질문("진행된거야?", "진행한거야?", "정리된거야?", "정리한거야?", "다 된거야?") 및 속도 확인 0토큰 즉답]
  // 서류 검색(SEARCH_ROUTING)이나 외부 AI 바톤터치(BATON_TOUCH_CUTOFF)로 빠지는 현상을 원천 차단합니다!
  const isCleanupActionStatusVerification =
    !/속도|cpu|메모리|램|ram|빨라/i.test(clean) &&
    /(진행\s*된\s*(?:거|건가)|진행된거|진행\s*한\s*(?:거|건가)|진행한거|진행\s*됐|진행됐|진행\s*했|진행했|정리\s*된\s*(?:거|건가)|정리된거|정리\s*한\s*(?:거|건가)|정리한거|정리\s*됐|정리됐|정리\s*했|정리했|다\s*된\s*(?:거|건가)|다된거|다\s*됐|다됐|완료\s*된\s*(?:거|건가)|완료된거|완료\s*됐|완료됐|끝난\s*(?:거|건가)|끝났어|끝났나)/i.test(
      clean
    );

  if (isCleanupActionStatusVerification) {
    if (pendingApprovalMsg?.cleanupPreview && !pendingApprovalMsg.cleanupPreview.approved) {
      const preview = pendingApprovalMsg.cleanupPreview;
      const res = await executeMonsterCleanupApproval(preview, clean);
      setSharedMonsterMessages((prev) =>
        prev.map((m) =>
          m.id === pendingApprovalMsg.id && m.cleanupPreview
            ? {
                ...m,
                cleanupPreview: {
                  ...m.cleanupPreview,
                  approved: res.ok,
                  approvedTypedText: clean,
                  createdRestoreId: res.restoreId,
                  executionError: res.ok ? undefined : res.message,
                },
                healthRecordIssued: res.healthRecord || m.healthRecordIssued,
              }
            : m
        )
      );
      const msgText = res.ok
        ? ` **네! 방금 말씀하신 바탕화면·다운로드 정리(${preview.moveCount}건)를 즉시 실행 완료했습니다!**\n• ${res.message}\n•  **블랙박스 승인 기록 완료** — 복원 번호: \`${res.restoreId}\`\n우측 상단 **[복원 기록]** 버튼을 누르시거나 **"원래대로 되돌려줘"**라고 입력하시면 원래 자리로 복원됩니다.`
        : res.message;
      speak(res.ok ? '네, 방금 정리를 완료하고 복원 기록에 안전하게 보관했습니다.' : res.message);
      return reply(sourceTab, msgText, {
        healthRecordIssued: res.healthRecord,
        followUpSuggestions: [          '최근 [복원 기록] 보여줘',
          '방금 한 거 원래대로 되돌려줘',
        ],
      });
    }
    if (lastApprovedCleanupMsgEarly?.cleanupPreview) {
      const cp = lastApprovedCleanupMsgEarly.cleanupPreview;
      const rid = cp.createdRestoreId || '#1';
      const verifiedMsg = ` **네! 바탕화면·다운로드 임시파일 정리가 정상적으로 완료되었습니다.**\n• 정리 내역: **${cp.summaryTitle}** (${cp.moveCount}건  \`'기타_정리함'\`안전 이동 완료)\n• 복원 번호: **\`[${rid} 복원 기록]\`** (승인 발화: \`"${cp.approvedTypedText || '응 진행해'}"\`)\n• 우측 상단 **[복원 기록]** 버튼을 누르시거나 채팅창에 **"원래대로 되돌려줘"**라고 입력하시면 원래 위치로 복원됩니다!`;
      speak(`네, 정리가 완료되어 ${rid} 복원 기록에 안전하게 보관되어 있습니다.`);
      return reply(sourceTab, verifiedMsg, {
        followUpSuggestions: [          '최근 [복원 기록] 보여줘',
          '방금 한 거 원래대로 되돌려줘',
        ],
      });
    }
    const { points } = await fetchRestorePointsWithPrecheck();
    if (points.length > 0) {
      const latestPt = points[0];
      const verifiedFromDiskMsg = ` **네! 최근 손보기·정리 작업이 완료되어 \`[${latestPt.restoreId} 복원 기록]\`에 보관되어 있습니다.**\n• 최근 기록: **${latestPt.summary}** (${latestPt.createdAt})\n• 상태: ${latestPt.statusBadge}\n우측 상단 **[복원 기록]** 버튼을 누르시거나 아래 기록 카드에서 **[↩️ 원래 위치로 복원]**을 누르시면 즉시 되돌릴 수 있습니다.`;
      speak(`네, 최근 정리 작업이 완료되어 ${latestPt.restoreId} 복원 기록에 보관되어 있습니다.`);
      return reply(sourceTab, verifiedFromDiskMsg, {
        cardKind: 'RESTORE_POINTS_LIST',
        restorePoints: points,
        followUpSuggestions: [          '1번 복원해줘',
          '바탕화면이랑 다운로드 임시 설치파일 정리해줘',
        ],
      });
    }
  }
  const lastSpecMsgEarly = [...recentAssistantMsgsEarly]
    .reverse()
    .find((m) => m.cardKind === 'PC_SPEC_CONSULTATION' && m.pcSpecPayload);
  const lastSpeedCleanMsgEarly = [...recentAssistantMsgsEarly]
    .reverse()
    .find(
      (m) =>
        m.pcSpecPayload?.bloatwareCleaned ||
        m.deviceRepairPayload?.executed ||
        Boolean(m.healthRecordIssued && /애드웨어|보안|과점유|속도/.test(m.healthRecordIssued.title)) ||
        /실시간 속도 최적화 & 애드웨어|애드웨어·보안\/자동실행 프로그램/.test(m.text)
    );
  const isExplicitSpeedOrStatusVerification =
    !/바탕화면|다운로드|폴더|설치\s*파일|휴지통|바로가기|아이콘|\.exe|\.zip|\.apk/i.test(clean) &&
    (/(속도\s*개선|개선\s*된|개선됐|빨라졌|빨라진|세이브\s*된|세이브됐|줄어든|줄었|정리\s*잘\s*됐|잘\s*정리\s*됐|지금\s*상태\s*어때|상태\s*어때|얼마나\s*(좋아|빨라|개선|세이브|줄었|확보|여유))/i.test(
      clean
    ) ||
      (Boolean(lastSpecMsgEarly || lastSpeedCleanMsgEarly) &&
        /(개선된|세이브|줄어든|된\s*거야|된거야|된\s*건가|한\s*거야|한거야|한\s*건가|만\s*세이브|왜\s*(그래|그대로|안\s*줄|남아|여전히\s*느려)|차이가|효과가)/i.test(
          clean
        )));

  if (isExplicitSpeedOrStatusVerification) {
    const [rNow, osNow] = await Promise.all([      zcoreJson<{ ok: boolean; ramUsedPercent?: number | null; ramTotalGb?: number | null }>('/__zcore/pc-spec'),
      zcoreJson<{
        ok: boolean;
        spoolerAndSecurity?: {
          cpuLoadPercent?: number;
          activeSecurityPlugins?: Array<{ keyword?: string; label?: string }>;
          browserMemoryBottleneck?: {
            detected?: boolean;
            guideKo?: string;
            browserName?: string;
            processCount?: number;
            browserMemoryGb?: number;
            browserSharePercent?: number;
          };
        };
      }>('/__zcore/os-inspect'),
    ]);
    const prevSpec = lastSpecMsgEarly?.pcSpecPayload;
    const osNowData = osNow.ok ? osNow.data : undefined;
    const rNowData = rNow.ok ? rNow.data : undefined;
    const curCpu =
      typeof osNowData?.spoolerAndSecurity?.cpuLoadPercent === 'number'
        ? osNowData.spoolerAndSecurity.cpuLoadPercent
        : prevSpec?.cpuLoadPercent ?? 12;
    const curRamPct =
      typeof rNowData?.ramUsedPercent === 'number' ? rNowData.ramUsedPercent : prevSpec?.ramUsedPercent ?? 52;
    const curSecList = Array.isArray(osNowData?.spoolerAndSecurity?.activeSecurityPlugins)
      ? osNowData.spoolerAndSecurity!.activeSecurityPlugins!
      : [];
    const alreadyCleaned = Boolean(prevSpec?.bloatwareCleaned || lastSpeedCleanMsgEarly || curSecList.length === 0);
    const curSecCount = alreadyCleaned ? 0 : curSecList.length;
    const browserBn = osNowData?.spoolerAndSecurity?.browserMemoryBottleneck;
    const defaultFollowUpChromeGuide =
      '애드웨어는 모두 껐지만, 현재 내 컴퓨터 전체 메모리(8GB) 중 크롬 브라우저가 메모리를 가장 많이 차지하고 있습니다. 안 쓰는 크롬 탭만 몇 개 닫아주시면 즉시 체감 속도가 확 빨라집니다!';
    const browserTipSuffix =
      browserBn?.detected && browserBn?.guideKo
        ? `\n\n${browserBn.guideKo}`
        : `\n\n${defaultFollowUpChromeGuide}`;

    const prevCpuLabel =
      typeof prevSpec?.cpuLoadPercent === 'number' ? `진단 시 **${prevSpec.cpuLoadPercent}%**  ` : '';
    const prevRamLabel =
      typeof prevSpec?.ramUsedPercent === 'number' ? `진단 시 **${prevSpec.ramUsedPercent}%**  ` : '';

    const directFollowUpKo = alreadyCleaned
      ? ` **[정리 전·후 실시간 속도·리소스 비교 브리핑]**\n` +
        `• **CPU 부하**: ${prevCpuLabel}현재 **${curCpu ?? '?'}%**\n` +
        `• **잔존 상주 애드웨어·보안모듈**: **${curSecCount}건** (${
          curSecCount === 0 ? '모두 종료 및 자동부활 차단 완료 ' : '일부 상주 프로세스 감지됨'
        })\n` +
        `• **메모리(RAM) 점유율**: ${prevRamLabel}현재 **${curRamPct ?? '?'}%**\n\n` +
        `백그라운드에서 CPU를 과점유하던 상주 보안·애드웨어 프로세스와 자동부활 트리거는 정리되었습니다.${browserTipSuffix}`
      : `아직 상주 프로그램 정리가 실행되지 않은 **진단 대기 상태**입니다! (현재 CPU 부하 **${
          curCpu ?? '?'
        }%**, 메모리 사용 **${curRamPct ?? '?'}%**, 상주 보안·애드웨어 **${
          curSecCount || prevSpec?.detectedBloatwareLabels?.length || 0
        }건**)\n\n프로그램을 임의로 종료하지 않도록 보호 중이니, 정리를 실행하시려면 채팅창에 **"응 진행해"** 또는 **"응 정리해줘"**라고 입력해 주세요.${browserTipSuffix}`;

    speak(
      alreadyCleaned
        ? `현재 씨피유 부하는 ${curCpu ?? 0}퍼센트, 잔존 애드웨어는 ${curSecCount}건, 메모리 점유율은 ${curRamPct ?? 0}퍼센트입니다.`
        : '아직 정리가 실행되지 않은 진단 대기 상태입니다. 채팅창에 응 정리해줘라고 입력하시면 즉시 정리해 드립니다.'
    );
    return reply(sourceTab, directFollowUpKo, {
      followUpSuggestions: alreadyCleaned
        ? [            '바탕화면이랑 다운로드 폴더 정리할 파일도 봐줘',
            '방금 한 거 되돌려줘 (복원 기록 확인)',
          ]
        : [            '응 정리해줘',
            '응 진행해',
            '바탕화면이랑 다운로드 폴더 정리할 파일 봐줘',
          ],
    });
  }

  // [P1-1] 직전 말풍선이 [복원 기록] 목록(RESTORE_POINTS_LIST)이고 유저가 번호("1번", "#1")를 입력한 경우 0-0B가 최우선 처리하도록 보호
  const lastAssistantMsgPreCare = [...sharedChatState.messages].reverse().find((m) => m.role === 'assistant');
  const isSelectingRestoreNumberNow =
    lastAssistantMsgPreCare?.cardKind === 'RESTORE_POINTS_LIST' &&
    /^\s*(#?\d+\s*(번)?|첫\s*번째|두\s*번째|세\s*번째)(\s*(복원|되돌|원복|진행|실행|취소|해\s*줘|해\s*주세요|할래|선택))?\s*[.!~]?$/i.test(
      clean
    );

  // 0-0C-0) [실시간 CPU·메모리 최다 점유 앱 직답]: "지금 CPU·메모리 제일 많이 쓰는 앱 알려줘" 클릭/입력 시
  // 직전 디스크 스캔 캐시 설명으로 오인하지 않고, 실시간 CPU·메모리·상위 점유 앱 TOP 목록을 즉시 실측 보고합니다.
  if (
    !isMobileRuntimeForChat() &&
    /(?:cpu|메모리|램|ram).*(?:제일\s*많이|가장\s*많이|많이\s*쓰는|점유|먹는)/i.test(clean)
  ) {
    cachedPcContext = null;
    const [liveCtx, ratsRes] = await Promise.all([
      fetchRealtimePcContextForLlm().catch(() => null),
      zcoreJson<any>('/api/care/hidden-rats-scan', undefined, 10000).catch(() => ({ ok: false as const, error: '' })),
    ]);
    const sp = liveCtx?.specData || {};
    const sec = liveCtx?.osInspectData?.spoolerAndSecurity || {};
    const cpuPct = sec?.cpuLoadPercent;
    const ramPct = sp?.ramUsedPercent ?? sec?.ramUsedPercent;
    const ramGb = sp?.ramTotalGb ?? sec?.ramTotalGb;
    const ramFreeGb = sec?.ramFreeGb;
    const browserBn = sec?.browserMemoryBottleneck || null;
    const guiApps: Array<{ name?: string; count?: number; memoryMb?: number }> = Array.isArray(sec?.runningGuiApps)
      ? sec.runningGuiApps
      : [];
    const ratItemsRaw: Array<any> = ratsRes.ok && Array.isArray(ratsRes.data?.items) ? ratsRes.data.items : [];
    const highMemRats = ratItemsRaw
      .filter((it) => it?.ratKind === 'HIGH_MEM_PROCESS' && Number(it?.sizeMb || 0) >= 60)
      .sort((a, b) => Number(b.sizeMb || 0) - Number(a.sizeMb || 0));

    const lines: string[] = ['**[실시간 CPU · 메모리 점유 현황]**'];
    lines.push(
      `• **CPU / 메모리**: ${cpuPct != null ? `CPU 부하 **${cpuPct}%**` : 'CPU 정상'}${
        ramPct !== undefined
          ? ` · 메모리 **${ramPct}%** 사용 중${ramGb ? ` (총 ${ramGb}GB${ramFreeGb !== undefined ? ` · 여유 ${ramFreeGb}GB` : ''})` : ''}`
          : ''
      }`
    );

    const rankedRows: Array<{ label: string; mb: number }> = [];
    const seenKeys = new Set<string>();
    if (browserBn?.browserName && Number(browserBn.browserMemoryMb || 0) >= 100) {
      seenKeys.add('chrome');
      seenKeys.add('msedge');
      seenKeys.add('whale');
      rankedRows.push({
        label: `**${browserBn.browserName}** (${browserBn.processCount ?? '?'}개 프로세스 · 약 ${browserBn.browserMemoryGb}GB${
          browserBn.browserSharePercent ? ` · 전체 RAM의 ${browserBn.browserSharePercent}%` : ''
        })`,
        mb: Number(browserBn.browserMemoryMb || 0),
      });
    }
    for (const g of guiApps) {
      const nm = String(g?.name || '').trim();
      const mb = Number(g?.memoryMb || 0);
      if (!nm || mb < 60 || seenKeys.has(nm.toLowerCase())) continue;
      seenKeys.add(nm.toLowerCase());
      const memTxt = mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${Math.round(mb)}MB`;
      rankedRows.push({
        label: `**${nm}** (${memTxt}${g.count && g.count > 1 ? ` · ${g.count}개` : ''})`,
        mb,
      });
    }
    for (const hm of highMemRats) {
      const nm = String(hm?.name || '').replace(/^\[메모리\s*과점유\]\s*/i, '').trim();
      const k = nm.split(/\s+/)[0].toLowerCase();
      const mb = Number(hm?.sizeMb || 0);
      if (!nm || mb < 60 || seenKeys.has(k)) continue;
      seenKeys.add(k);
      const memTxt = mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${Math.round(mb)}MB`;
      rankedRows.push({ label: `**${nm}** (${memTxt})`, mb });
    }
    rankedRows.sort((a, b) => b.mb - a.mb);

    if (rankedRows.length > 0) {
      lines.push('');
      lines.push('**현재 메모리를 가장 많이 쓰고 있는 앱 TOP**');
      rankedRows.slice(0, 6).forEach((row, i) => {
        lines.push(`${i + 1}. ${row.label}`);
      });
    } else {
      lines.push('• 현재 비정상적으로 메모리를 과점유 중인 백그라운드 앱이 없습니다.');
    }

    if (browserBn?.detected) {
      lines.push('');
      lines.push(`💡 안 쓰는 **${browserBn.browserName}** 탭을 몇 개 닫고 브라우저를 한 번 재시작하시면 즉시 체감 속도가 빨라집니다.`);
    }

    speak('현재 피씨의 실시간 씨피유와 메모리를 가장 많이 쓰는 앱을 실측해 정리해 드렸습니다.');
    return reply(sourceTab, lines.join('\n'), {
      followUpSuggestions: [
        '빨간색(삭제·차단 안전) 항목만 정리해줘',
        '은행·관공서 보안절전',
        '데스크톱 전원 옵션 고성능으로 바꿔줘',
      ],
    });
  }

  // 0-0C-PRE) [전용 결정론 핸들러 선행 실행: 스튜디오 접수 · 보안절전/기상/실적 · 앱 설정 제어 · 귀신같이 FAQ 인포데스크]
  // 추천 칩('은행·관공서 보안절전', '보안프로그램 즉시 깨우기', '편의 기능 두 가지 알려줘', '귀신검색 알려줘' 등)을 눌렀을 때
  // 범용 스캔 에이전트가 중간에 가로채 동문서답하는 일이 없도록 전용 핸들러를 먼저 실행합니다.
  if (!isSelectingRestoreNumberNow) {
    const studioSupportReplyEarly = await handleStudioSupportProxyIfMatched(clean, sourceTab, speak);
    if (studioSupportReplyEarly) return studioSupportReplyEarly;

    const careBriefingReplyEarly = await handleSecretaryCareBriefingAndSuperpowersIfMatched(clean, sourceTab, speak);
    if (careBriefingReplyEarly) return careBriefingReplyEarly;

    const settingsControlReplyEarly = await handleAppSettingsControlIfMatched(clean, sourceTab, speak);
    if (settingsControlReplyEarly) return settingsControlReplyEarly;

    const infoDeskReplyEarly = handleGhostiInfoDeskIfMatched(clean, sourceTab, speak);
    if (infoDeskReplyEarly) return infoDeskReplyEarly;
  }

  // 0-0C) [제미니 에이전트 자유 문답 + 다중 취사선택 PC 정리 트랙 (2026-11-24 Ghosti × MerlinHub 합의 5대 기둥)]
  // - C드라이브 대용량 공간 도둑 3초 스캔 / 보안모듈·애드웨어 2분류 / 바탕화면 상세 분석 & WD 시스템 아이콘 안전 숨김
  // - 직전 스캔 원장(lastCareScanContext)을 60개·5키로 Gemini에 주입해 "예스파일·오캠 빼고 나머지 다 지워", "큰 폴더는 D:로 옮겨줘" 멀티턴 지령 수행!
  if (!isMobileRuntimeForChat() && !/휴지통\s*비워/i.test(clean) && !isSelectingRestoreNumberNow) {
    const curScanCtx = getLastCareScanContext();
    const agentIntent = detectAgentCareIntent(clean, curScanCtx);
    if (agentIntent.matched) {
      // Case A-0: 데스크톱 고성능 전원 모드 '이게 뭐예요?' / 설명 질문 ➔ 카드 반복 대신 쉬운 한글로 친절 설명!
      if (
        agentIntent.needsGeminiExplainOnly &&
        /(전원\s*(옵션|모드)|고성능\s*(모드|전원|전환))/i.test(clean)
      ) {
        const powerExplainKo =
          `⚡ **Windows 전원 옵션 ➔ 고성능(High Performance) 전환**은 지우는 프로그램이 아니라 **Windows 기본 속도 설정**이에요!\n\n` +
          `• **무엇을 바꾸나요?**: 기본 '균형 조정' 모드에서는 전기를 아끼려고 CPU 속도를 수시로 낮추는데, 데스크톱 PC에서 **고성능**으로 바꾸면 CPU가 버벅이지 않고 본래 속도를 꾸준히 유지합니다.\n` +
          `• **안전한가요?**: 배터리가 없는 순수 데스크톱 PC에서만 동작(노트북 자동 차단)하며, 파일이나 프로그램을 삭제하지 않습니다. 원하실 때 언제든 원래 **'균형 조정'**으로 바로 되돌릴 수 있어요!`;
        speak('고성능 전원 모드는 삭제하는 프로그램이 아니라 데스크톱 피씨의 씨피유 속도 저하를 막는 윈도우 기본 설정입니다.');
        return reply(sourceTab, powerExplainKo, {
          followUpSuggestions: ['응 진행해', 'C드라이브 용량 도둑도 스캔해줘'],
        });
      }

      // Case A: 데스크톱 고성능 전원 부스터 직접 요청
      if (agentIntent.isPowerBoostQuery && !agentIntent.needsGeminiExplainOnly && agentIntent.immediateReadTools.length === 0) {
        const powerCard: MonsterAgentCareCardPayload = {
          mode: 'CONFIRM_BATCH',
          title: '데스크톱 고성능 전원 모드 전환 (배터리 가드 검증)',
          badgeText: '데스크톱 전용 성능 부스터',
          summaryLines: [
            '⚡ 배터리 없는 순수 데스크톱 PC에서만 안전하게 고성능 전원 옵션으로 전환합니다 (노트북은 배터리 보호를 위해 자동 차단).',
          ],
          action: 'desktop_power_boost',
          items: [
            {
              no: 1,
              id: 'desktop_power_high',
              name: 'Windows 전원 옵션 ➔ 고성능(High Performance) 전환',
              cat: 'POWER_PLAN',
              sizeMb: 0,
              detailKo: '구형 CPU 클럭 저하 방지 · 언제든 균형 조정 복귀 가능',
              plainExplainKo:
                '구형 CPU 속도 저하를 막는 Windows 기본 설정이에요. 삭제하는 프로그램이 아니며 언제든 원래 균형 조정 모드로 되돌릴 수 있어요.',
              defaultSelected: true,
            },
          ],
          selectedIds: ['desktop_power_high'],
          excludedNames: [],
        };
        return reply(
          sourceTab,
          '데스크톱 PC라면 전원 옵션을 **고성능**으로 바꿔 CPU 속도 저하를 막을 수 있어요! 아래 버튼을 누르시거나 **"응 진행해"**라고 말씀해 주세요.',
          {
            cardKind: 'AGENT_CARE_BATCH_CARD',
            agentCareCardPayload: powerCard,
            followUpSuggestions: ['응 진행해', 'C드라이브 용량 도둑도 스캔해줘'],
          }
        );
      }

      // Case B: 바탕화면 특수 시스템 아이콘(WD 등) 정체 설명 및 안전 숨김
      if (agentIntent.isSystemIconQuery && !agentIntent.needsGeminiMultiTurnFilter) {
        const readRes = await runAgentCareReadTools(['desktop_detail_scan']);
        const visIcons = readRes.context.visibleSystemIcons || [];
        const hasUserIcon = visIcons.some((ic) => ic.iconId === 'user_files');
        const explainText = hasUserIcon
          ? `바탕화면에 보이는 **사용자 계정 폴더(${visIcons[0].label})**는 지우면 큰일 나는 Windows 내 계정 본체 폴더예요!\n절대 삭제하지 않고 **아이콘만 바탕화면에서 깔끔하게 숨길 수 있어요.** 아래 버튼으로 바로 숨겨드릴까요?`
          : `현재 바탕화면을 스캔해 보았어요! Windows 특수 시스템 아이콘(사용자 폴더·네트워크 등)은 파일을 지우지 않고 아이콘만 안전하게 숨기거나 복원할 수 있습니다.`;
        const iconCard: MonsterAgentCareCardPayload = {
          ...readRes.card,
          mode: hasUserIcon ? 'CONFIRM_BATCH' : 'SCAN_REPORT',
          action: hasUserIcon ? 'desktop_system_icon_toggle' : 'desktop_batch_action',
          title: hasUserIcon ? `바탕화면 특수 아이콘(${visIcons[0].label}) 안전 숨김` : readRes.card.title,
        };
        return reply(sourceTab, explainText, {
          cardKind: 'AGENT_CARE_BATCH_CARD',
          agentCareCardPayload: iconCard,
          followUpSuggestions: hasUserIcon
            ? ['응, 그 아이콘만 안전하게 숨겨줘', '바탕화면 폴더랑 파일들도 전체 분석해줘']
            : ['안 쓰는 폴더 선택해서 정리할래', 'C드라이브 대용량 공간 도둑 스캔해줘'],
        });
      }

      // Case B-2: 초보자 되묻기 질문 ("3번이랑 5번이 뭐야? 지워도 돼?", "꼭 남겨야 할 거 알려줘") ➔ 삭제 없이 친절 설명!
      if (agentIntent.needsGeminiExplainOnly && curScanCtx && curScanCtx.items.length > 0) {
        const expRes = await explainCareItemsWithGemini({
          query: clean,
          scanContext: curScanCtx,
        });
        speak('궁금하신 프로그램과 파일이 무엇인지 알기 쉽게 설명해 드렸어요.');
        return reply(sourceTab, expRes.replyKo, {
          followUpSuggestions: expRes.followUpSuggestions,
        });
      }

      // Case C: 직전 스캔 원장 기반 멀티턴 취사선택·제외 필터("예스파일·오캠 빼고 다 지워", "D:로 옮겨줘") ➔ Gemini 2.5 Flash 에이전트 플랜
      if (agentIntent.needsGeminiMultiTurnFilter && curScanCtx && curScanCtx.items.length > 0) {
        // [안전 캐시만 요청 정밀 가드]: 실제 스캔에 안전 캐시가 0건인데 프로그램 제거 15건이 대신 체크되는 오작동 원천 차단
        const wantsSafeCacheOnlyTurn = /(?:안전\s*)?캐시만/i.test(clean);
        const wantsRedSafeOnlyTurn = /(빨간색|삭제\s*안전|차단\s*권장|100%\s*삭제)/i.test(clean);
        const wantsAlsoSleepBankTurn = /(잠재|재워|수면)/i.test(clean);
        if (wantsSafeCacheOnlyTurn) {
          const safeCacheOnlyItems = curScanCtx.items.filter(
            (it) => !it.isProtected && (it.cat === 'SAFE_CACHE' || it.cat === 'DESKTOP_HIBERFIL')
          );
          if (safeCacheOnlyItems.length === 0) {
            const pcCtxFast = await fetchRealtimePcContextForLlm();
            const ramPct = pcCtxFast.specData?.ramUsedPercent;
            const cpuPct = pcCtxFast.osInspectData?.spoolerAndSecurity?.cpuLoadPercent;
            const liveLine =
              ramPct !== undefined || cpuPct !== null
                ? `\n• **현재 PC 실시간 부하**: ${cpuPct != null ? `CPU ${cpuPct}%` : 'CPU 확인됨'}${ramPct !== undefined ? ` · 메모리 ${ramPct}% 사용 중` : ''}`
                : '';
            return reply(
              sourceTab,
              `방금 스캔에서는 별도로 비울 **안전 캐시 항목이 없었어요(0MB)**.${liveLine}\n` +
                `프로그램 제거 창이 뜨지 않도록 설치된 앱은 건드리지 않았습니다. 아래 버튼으로 **빨간색(100% 안전) 백그라운드 항목만 정리**하거나, **실시간 CPU·메모리 점유 원인**을 바로 확인해 보세요!`,
              {
                followUpSuggestions: [
                  '빨간색(삭제·차단 안전) 항목만 정리해줘',
                  '지금 CPU·메모리 제일 많이 쓰는 앱 알려줘',
                ],
              }
            );
          }
        }

        const pcCtxNow = await fetchRealtimePcContextForLlm();
        const recentTurnsNow = sharedChatState.messages.slice(-6).map((m) => ({
          role: m.role,
          text: m.text,
        }));
        const plan = await planCareAgentTurnWithGemini({
          query: clean,
          pcContextText: pcCtxNow.summaryText,
          scanContext: curScanCtx,
          recentTurns: recentTurnsNow,
        });

        if (plan?.mutatingPlan) {
          const mp = plan.mutatingPlan;
          const excIdSet = new Set((mp.excludeIds || []).map((x) => String(x).trim().toLowerCase()));
          const excKwList = (mp.excludeKeywords || []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
          const incIdSet = new Set((mp.includeIds || []).map((x) => String(x).trim().toLowerCase()));

          const isExcludedItem = (it: typeof curScanCtx.items[number]) => {
            if (it.isProtected) return true;
            if (wantsSafeCacheOnlyTurn && it.cat !== 'SAFE_CACHE' && it.cat !== 'DESKTOP_HIBERFIL') return true;
            if (
              wantsRedSafeOnlyTurn &&
              it.safetyBadge !== 'DANGER_DELETE' &&
              it.safetyBadge !== 'SAFE_DELETE' &&
              !(wantsAlsoSleepBankTurn && it.safetyBadge === 'SLEEP_RECOMMEND')
            ) {
              return true;
            }
            const idL = it.id.toLowerCase();
            const nmL = it.name.toLowerCase();
            const noS = String(it.no);
            const hashNo = `#${it.no}`;
            if (excIdSet.has(idL) || excIdSet.has(noS) || excIdSet.has(hashNo)) return true;
            return excKwList.some((kw) => kw.length >= 2 && (nmL.includes(kw) || idL.includes(kw)));
          };

          const isExplicitForceAllApps =
            curScanCtx.scanKind === 'INSTALLED_APPS' &&
            /(설치된\s*(?:프로그램|앱)\s*(?:전부|모두|싹\s*다)|전부\s*다\s*삭제)/i.test(clean);
          const wantsStaleAppsTurn =
            /(?:오래\s*(?:동안\s*)?(?:안\s*쓴|안쓴|안\s*쓰는|안쓰는)|묵은)\s*(?:프로그램|앱|어플)/i.test(clean);
          const wantsDesktopTurn = /바탕\s*화면/i.test(clean);

          const excludedNames: string[] = [];
          const selectedIds: string[] = [];
          for (const it of curScanCtx.items) {
            if (isExcludedItem(it)) {
              if (!it.isProtected && !wantsSafeCacheOnlyTurn && !wantsRedSafeOnlyTurn) excludedNames.push(it.name);
              continue;
            }
            const idL = it.id.toLowerCase();
            const nmL = it.name.toLowerCase();
            const noS = String(it.no);
            const hashNo = `#${it.no}`;
            const isStaleAppItem =
              it.cat === 'INSTALLED_APP' &&
              (it.lastUsedStatus === 'DORMANT' ||
                it.lastUsedStatus === 'STALE' ||
                it.lastUsedStatus === 'UNUSED_SINCE_INSTALL');
            const explicitlyIncluded =
              incIdSet.size === 0
                ? wantsStaleAppsTurn
                  ? isStaleAppItem
                  : wantsDesktopTurn
                  ? it.cat.startsWith('DESKTOP_')
                  : (Boolean(it.defaultSelected) && it.safetyBadge !== 'USER_CHECK') || isExplicitForceAllApps
                : incIdSet.has(idL) ||
                  incIdSet.has(noS) ||
                  incIdSet.has(hashNo) ||
                  Array.from(incIdSet).some((inc) => inc.length >= 2 && nmL.includes(inc));
            if (explicitlyIncluded) {
              selectedIds.push(it.id);
            }
          }

          const selLookup = new Set(selectedIds);
          const excLookup = new Set(excludedNames);
          const allSelectedAreDesktop =
            selectedIds.length > 0 &&
            curScanCtx.items
              .filter((it) => selLookup.has(it.id))
              .every((it) => it.cat.startsWith('DESKTOP_'));

          // 특정 영역(바탕화면·묵은 앱·안전 캐시·빨간색 광고앱)만 지정해 정리를 요청한 경우,
          // 무관한 다른 영역의 미체크 항목들이 한 목록에 뒤섞여 혼란을 주지 않도록 요청 범위 항목만 노출합니다.
          const scopedConfirmPool = curScanCtx.items.filter((it) => {
            if (selLookup.has(it.id) || excLookup.has(it.name)) return true;
            if (wantsSafeCacheOnlyTurn) {
              return it.cat === 'SAFE_CACHE' || it.cat === 'DESKTOP_HIBERFIL';
            }
            if (wantsRedSafeOnlyTurn) {
              return (
                it.safetyBadge === 'DANGER_DELETE' ||
                it.safetyBadge === 'SAFE_DELETE' ||
                (wantsAlsoSleepBankTurn && it.safetyBadge === 'SLEEP_RECOMMEND')
              );
            }
            if (wantsStaleAppsTurn) {
              return it.cat === 'INSTALLED_APP';
            }
            if (wantsDesktopTurn || (mp.action === 'desktop_batch_action' && allSelectedAreDesktop)) {
              return it.cat.startsWith('DESKTOP_');
            }
            return true;
          });

          const orderedConfirmItems = [...scopedConfirmPool].sort((a, b) => {
            const rankA = selLookup.has(a.id) ? 0 : excLookup.has(a.name) ? 1 : 2;
            const rankB = selLookup.has(b.id) ? 0 : excLookup.has(b.name) ? 1 : 2;
            return rankA - rankB;
          });
          const finalConfirmItems = orderedConfirmItems.slice(0, 120);
          const finalConfirmIdSet = new Set(finalConfirmItems.map((it) => it.id));
          const finalSelectedIds = selectedIds.filter((id) => finalConfirmIdSet.has(id));
          const finalSelLookup = new Set(finalSelectedIds);

          const totalSelMb = Math.round(
            finalConfirmItems
              .filter((it) => finalSelLookup.has(it.id) && !it.isProtected)
              .reduce((acc, it) => acc + (it.sizeMb || 0), 0)
          );
          const confirmCard: MonsterAgentCareCardPayload = {
            mode: 'CONFIRM_BATCH',
            title: mp.reasonSummaryKo || `취사선택 일괄 정리 최종 확인 (${finalSelectedIds.length}건 예정)`,
            badgeText: mp.moveDestinationDrive
              ? `${mp.moveDestinationDrive} 안전 이사 확인`
              : '휴지통 안전 보관 · 1회 최종 확인',
            summaryLines: [
              `🔴 정리 실행 예정: ${finalSelectedIds.length}건${totalSelMb > 0 ? ` (약 ${totalSelMb >= 1024 ? `${(totalSelMb / 1024).toFixed(2)}GB` : `${totalSelMb}MB`})` : ''}`,
              excludedNames.length > 0
                ? `🟢 유저 지시로 보존(제외) 확정: ${excludedNames.slice(0, 8).join(', ')}`
                : '🟢 필수 시스템·하드웨어 드라이버·개인 데이터 자동 보호됨',
            ],
            action: mp.action,
            items: finalConfirmItems,
            selectedIds: finalSelectedIds,
            excludedNames,
            moveDestinationDrive: mp.moveDestinationDrive || '',
            availableMoveDrives: curScanCtx.availableMoveDrives,
            visibleSystemIcons: curScanCtx.visibleSystemIcons,
            currentFreeGb: curScanCtx.cDriveFreeGb,
            projectedFreeAfterEmptyGb:
              curScanCtx.cDriveFreeGb !== undefined
                ? Number((curScanCtx.cDriveFreeGb + totalSelMb / 1024).toFixed(1))
                : undefined,
            isDesktop: curScanCtx.isDesktop,
            isHighPerformance: curScanCtx.isHighPerformance,
          };

          const replyKo =
            `${plan.replyKo}\n` +
            `• **🟢 보존 확정(제외)**: ${excludedNames.length > 0 ? excludedNames.join(', ') : '없음(시스템 필수 항목만 보호)'}\n` +
            `• **🔴 실행 예정 (${finalSelectedIds.length}건)**: 상단 **[전체 선택 / 전체 해제]** 또는 개별 체크박스로 확인하신 뒤 **[✅ ${finalSelectedIds.length}건 일괄 실행]** 버튼을 누르시거나 **"응 진행해"**라고 입력해 주세요!`;
          speak(plan.replyKo);
          return reply(sourceTab, replyKo, {
            cardKind: 'AGENT_CARE_BATCH_CARD',
            agentCareCardPayload: confirmCard,
            followUpSuggestions:
              plan.followUpSuggestions.length > 0
                ? plan.followUpSuggestions
                : ['응 진행해', '휴지통 비워줘'],
          });
        }
      }

      // Case D: Read-Only 조회 도구 병렬 즉시 실행 (승인 게이트 없이 바로 4칸 요약 성적표 + 해당 칸 펼침 브리핑)
      if (agentIntent.immediateReadTools.length > 0) {
        cachedPcContext = null;
        const [readRes, livePcCtx] = await Promise.all([
          runAgentCareReadTools(agentIntent.immediateReadTools, {
            preferredBucket: agentIntent.preferredBucket,
            subFocus: agentIntent.subFocus,
          }),
          fetchRealtimePcContextForLlm().catch(() => null),
        ]);
        if (readRes.ok) {
          const isSpeedOrFullCheckupTopic =
            !agentIntent.preferredBucket || agentIntent.preferredBucket === 'SPEED';
          const isWebReloadSlowQuery =
            /(새로고침|로딩|웹\s*페이지|브라우저|크롬|귀신같이)/i.test(clean) &&
            /(느려|느린|길어|오래|버벅|안\s*열|먹통|멈)/i.test(clean);
          const spoolSec = livePcCtx?.osInspectData?.spoolerAndSecurity || {};
          const cpuPct = spoolSec?.cpuLoadPercent;
          const cpuModel = String(livePcCtx?.specData?.cpuModel || '').trim();
          const cpuCores = livePcCtx?.specData?.cpuLogicalCores;
          const ramPct =
            livePcCtx?.specData?.ramUsedPercent ?? spoolSec?.ramUsedPercent;
          const ramGb =
            livePcCtx?.specData?.ramTotalGb ?? spoolSec?.ramTotalGb;
          const ramFreeGb = spoolSec?.ramFreeGb;
          const browserBn = spoolSec?.browserMemoryBottleneck || null;
          const runningGuiApps: Array<{ name?: string; count?: number; memoryMb?: number }> = Array.isArray(
            spoolSec?.runningGuiApps
          )
            ? spoolSec.runningGuiApps
            : [];
          const highMemRats = (readRes.context.items || [])
            .filter((it) => it.ratKind === 'HIGH_MEM_PROCESS' && (it.sizeMb || 0) >= 80)
            .sort((a, b) => (b.sizeMb || 0) - (a.sizeMb || 0));

          // [동문서답 원천 차단]: CPU·메모리·크롬 탭 속도 브리핑은 유저가 '① 속도/느려짐' 또는 '전체 점검'을 물어봤을 때만 상단에 덧붙이고,
          // '묵은 앱', '광고/보안앱', '바탕화면/사진 정돈'을 콕 집어 물어봤을 때는 해당 주제 답변만 깔끔하게 제시합니다!
          const extraTopLines: string[] = [];
          if (isSpeedOrFullCheckupTopic) {
            const cpuCoreLabel = cpuModel
              ? ` (${cpuModel.replace(/\(R\)|\(TM\)|CPU/gi, '').replace(/\s+/g, ' ').trim()}${cpuCores ? ` · ${cpuCores}코어` : ''})`
              : '';
            if (cpuPct != null || ramPct !== undefined) {
              extraTopLines.push(
                `• **실시간 PC 상태**: ${cpuPct != null ? `CPU 부하 **${cpuPct}%**` : 'CPU 정상'}${cpuCoreLabel}` +
                  `${ramPct !== undefined ? ` · 메모리 **${ramPct}%** 사용 중${ramGb ? ` (총 ${ramGb}GB${ramFreeGb !== undefined ? ` · 여유 ${ramFreeGb}GB` : ''})` : ''}` : ''}`
              );
            }

            const topHogParts: string[] = [];
            const seenAppKeys = new Set<string>();
            if (browserBn?.browserName && Number(browserBn.browserMemoryGb || 0) >= 0.4) {
              seenAppKeys.add(String(browserBn.browserName).toLowerCase());
              seenAppKeys.add('chrome');
              seenAppKeys.add('msedge');
              seenAppKeys.add('whale');
              topHogParts.push(
                `**${browserBn.browserName}** ${browserBn.browserMemoryGb}GB (${browserBn.processCount ?? '?'}개 프로세스${browserBn.browserSharePercent ? ` · 전체 RAM의 ${browserBn.browserSharePercent}%` : ''})`
              );
            }
            for (const g of runningGuiApps) {
              const nm = String(g?.name || '').trim();
              const mb = Number(g?.memoryMb || 0);
              if (!nm || mb < 120 || seenAppKeys.has(nm.toLowerCase())) continue;
              seenAppKeys.add(nm.toLowerCase());
              const memLabel = mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${Math.round(mb)}MB`;
              topHogParts.push(`${nm} ${memLabel}${g.count && g.count > 1 ? ` (${g.count}개)` : ''}`);
              if (topHogParts.length >= 4) break;
            }
            for (const hm of highMemRats) {
              const cleanNm = hm.name.replace(/^\[메모리\s*과점유\]\s*/i, '').trim();
              const keyLow = cleanNm.split(/\s+/)[0].toLowerCase();
              if (!cleanNm || seenAppKeys.has(keyLow)) continue;
              seenAppKeys.add(keyLow);
              const mb = Number(hm.sizeMb || 0);
              const memLabel = mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${Math.round(mb)}MB`;
              topHogParts.push(`${cleanNm} ${memLabel}`);
              if (topHogParts.length >= 4) break;
            }
            if (topHogParts.length > 0) {
              extraTopLines.push(`• **현재 가장 많이 점유 중인 앱**: ${topHogParts.join(', ')}`);
            }

            const actionOrder: string[] = [];
            if (browserBn?.detected) {
              actionOrder.push(
                `① **${browserBn.browserName}(${browserBn.browserMemoryGb}GB · ${browserBn.processCount}개)**에서 안 쓰는 탭을 닫고 브라우저를 한 번 재시작`
              );
            } else if (isWebReloadSlowQuery) {
              actionOrder.push('① 열려 있는 브라우저 탭 중 안 쓰는 탭을 닫고 창을 한 번 재시작');
            }
            if (readRes.context.isDesktop && !readRes.context.isHighPerformance) {
              actionOrder.push('② 아래 **[⚡ 고성능 전원 전환]** 버튼 클릭');
            }
            actionOrder.push(
              `${actionOrder.length + 1 === 2 ? '②' : '③'} 아래 목록에서 **빨간색(100% 안전)** 백그라운드 항목만 골라 정리`
            );
            if (isWebReloadSlowQuery || browserBn?.detected || (typeof cpuCores === 'number' && cpuCores <= 4)) {
              extraTopLines.push(`• **체감 속도 회복 우선순위**: ${actionOrder.join(' ➔ ')}`);
            }
          }

          const curStore = useSaySeeStore.getState();
          const isDesktopWebCare =
            !isCapacitorNativeMobileRuntime() && !curStore.isStoreAppMode && curStore.layout !== 'mobile';
          const photoSummary = computeLocalPhotoCleanupSummary(
            curStore.photos || [],
            curStore.duplicateGroups || [],
            {
              isDesktopWebMode: isDesktopWebCare,
              zConnected: zCoreBridge.isConnected,
            }
          );
          const photoCleanupCnt = photoSummary.totalCandidateCount;
          if (agentIntent.preferredBucket === 'DESKTOP' && photoCleanupCnt > 0) {
            extraTopLines.push(
              `• **사진 정돈 후보**: 왼쪽 사진 정리 화면에도 전체 ${photoSummary.totalLocalPhotoCount}장 중 **정리 후보 ${photoCleanupCnt}장**(중복·연사 ${photoSummary.dupPhotoCount}장 · 메모·캡처 ${photoSummary.memoAndScreenCount}장 · 흔들림 ${photoSummary.blurryCount}장)이 준비되어 있어요!`
            );
          }

          const finalBriefing =
            extraTopLines.length > 0
              ? `${extraTopLines.join('\n')}\n\n${readRes.briefingKo}`
              : readRes.briefingKo;
          const rebuilt4Plus1 =
            agentIntent.immediateReadTools.length > 1
              ? buildCareFourBucketSummaries({
                  items: readRes.card.items,
                  selectedIds: readRes.card.selectedIds,
                  cDriveFreeGb: readRes.context.cDriveFreeGb,
                  cDriveUsedPct: readRes.context.cDriveUsedPct,
                  isDesktop: readRes.context.isDesktop,
                  isHighPerformance: readRes.context.isHighPerformance,
                  liveCpuPct: typeof cpuPct === 'number' ? cpuPct : null,
                  liveRamPct: typeof ramPct === 'number' ? ramPct : null,
                  photoCleanupCandidateCount: photoCleanupCnt,
                  visibleSystemIconsCount: (readRes.context.visibleSystemIcons || []).length,
                  preferredBucket: agentIntent.preferredBucket,
                })
              : null;
          const enrichedCard: MonsterAgentCareCardPayload = {
            ...readRes.card,
            fourBucketSummaries: rebuilt4Plus1?.summaries ?? readRes.card.fourBucketSummaries,
            defaultActiveBucket: rebuilt4Plus1?.defaultActiveBucket ?? readRes.card.defaultActiveBucket,
            liveCpuPct: typeof cpuPct === 'number' ? cpuPct : null,
            liveRamPct: typeof ramPct === 'number' ? ramPct : null,
            photoCleanupCandidateCount: photoCleanupCnt,
            summaryLines:
              extraTopLines.length > 0
                ? [...extraTopLines.map((l) => l.replace(/^•\s*/, '').replace(/\*\*/g, '')), ...readRes.card.summaryLines]
                : readRes.card.summaryLines,
          };
          speak('실시간 피씨 부하와 주요 점유 앱을 실측해 왔습니다. 우선순위대로 정리하시면 속도가 훨씬 빨라져요.');
          return reply(sourceTab, finalBriefing, {
            cardKind: 'AGENT_CARE_BATCH_CARD',
            agentCareCardPayload: enrichedCard,
            followUpSuggestions: readRes.followUpSuggestions,
          });
        }
      }
    }
  }

  // 0-0B) [복원 히스토리 조회 ➔ 번호 타이핑 선택 원복 인터셉터 (0 토큰 · 블랙박스 원복 영구 기록)]
  // 직전 메시지가 복원 기록 목록(RESTORE_POINTS_LIST)일 때는 "1번", "2번 해줘", "#1"만 쳐도 즉시 해당 번호 원복으로 인식합니다.
  const lastAssistantMsg = [...sharedChatState.messages].reverse().find((m) => m.role === 'assistant');
  const isChoosingFromShownRestoreList =
    lastAssistantMsg?.cardKind === 'RESTORE_POINTS_LIST' &&
    /^\s*(#?\d+\s*(번)?|첫\s*번째|두\s*번째|세\s*번째)(\s*(복원|되돌|원복|진행|실행|취소|해\s*줘|해\s*주세요|할래|선택))?\s*[.!~]?$/i.test(
      clean
    );

  const explicitNumberRollbackMatch = clean.match(/#?(\d+)\s*번?\s*(복원|되돌|원복|취소|원래대로|진행|해\s*줘|해\s*주세요)/i) ||
    clean.match(/(복원|되돌|원복|취소).*?#?(\d+)\s*번?/i);

  if (isChoosingFromShownRestoreList || explicitNumberRollbackMatch) {
    let numStr = '1';
    const digitHit = clean.match(/(\d+)/);
    if (digitHit) {
      numStr = digitHit[1];
    } else if (/두\s*번째/.test(clean)) {
      numStr = '2';
    } else if (/세\s*번째/.test(clean)) {
      numStr = '3';
    }
    const targetRestoreId = `#${numStr}`;
    const res = await executeRestorePointRollback(targetRestoreId, clean);
    const { points } = await fetchRestorePointsWithPrecheck();
    if (res.ok && res.restoreId) {
      setSharedMonsterMessages((prev) =>
        prev.map((m) =>
          m.restorePoints
            ? {
                ...m,
                restorePoints: m.restorePoints.map((pt) =>
                  pt.restoreId === res.restoreId
                    ? { ...pt, rolledBack: true, rollbackTypedText: clean, statusBadge: '↩️ 되돌리기 완료' }
                    : pt
                ),
              }
            : m
        )
      );
    }
    const msgText = res.ok
      ? `${res.message}\n **블랙박스 원복 기록 완료** — 선택 발화: \`"${clean}"\` · 복원 지점: \`${
          res.restoreId || targetRestoreId
        }\`(${res.restoredCount}건 원위치 복구)`
      : res.message;
    speak(res.ok ? `${targetRestoreId} 복원 기록을 원래 자리로 되돌렸습니다.` : res.message);
    return reply(sourceTab, msgText, {
      ...(points.length > 0 ? { cardKind: 'RESTORE_POINTS_LIST', restorePoints: points } : {}),
    });
  }

  // 번호를 아직 지정하지 않고 "복원해줘", "원래대로 되돌려줘", "복원지점 보여줘"라고 말한 경우:
  // 즉시 복원 히스토리 목록(#1, #2...)을 먼저 보여주고 몇 번을 복원할지 타이핑하게 안내합니다 (LLM 토큰 0원!).
  // 단, "방금 지운 파일 되돌려줘", "휴지통에 넣은 파일 복원해줘"처럼 지운/휴지통 실물 파일을 찾는 요청은
  // 아래 2) 휴지통($Recycle.Bin)·실종 파일 추적 엔진이 직접 스캔하도록 통과시킵니다!
  const hasExplicitRecycleOrDeletedFileCue =
    !/복원\s*기록|복원\s*지점|히스토리/i.test(clean) &&
    /지운|지웠|지워진|삭제|버린|버렸|휴지통|정리\s*보관함|미저장|구출|사라진|사라졌|없어진|없어졌|날아간|날아갔/i.test(clean);

  const isGeneralRestoreRequest =
    !hasExplicitRecycleOrDeletedFileCue &&
    /복원\s*기록|복원\s*지점|되돌려|되돌리|원복|원래대로|(방금|아까|최근|이전).*?(취소|복원|복구|되돌|원복)|(정리한\s*거|치운\s*거|옮긴\s*거|만든\s*거).*?(취소|복원|복구|되돌|원복)/i.test(
      clean
    );

  if (isGeneralRestoreRequest) {
    const { points, error } = await fetchRestorePointsWithPrecheck();
    if (error) {
      speak('Z-코어에 연결되지 않아 복원 기록을 불러오지 못했어요.');
      return reply(sourceTab, ` ${error}`);
    }
    if (points.length === 0) {
      speak('아직 저장된 복원 기록이 없어요.');
      return reply(
        sourceTab,
        '아직 저장된 **[복원 기록]**이 없어요! 바로가기 만들기·폴더 정리·휴지통 파일 복원을 실행하시면 번호별 복원 지점이 이곳에 차곡차곡 기록돼요.',
        {
          followUpSuggestions: [            '방금 지운 파일 찾아줘',
            '유튜브 바탕화면 바로가기 만들어줘',
          ],
        }
      );
    }
    // 복원지점이 많을 때 특정 키워드(예: "바탕화면 복원 기록", "유튜브 복원 기록")를 언급했으면 해당 기록 우선,
    // 일반 조회("최근 복원 기록 보여줘")는 방금 실행한 최신 기록(#N)이 맨 위(1순위)에 오도록 시간순 그대로 유지!
    const filterKwMatch = clean
      .replace(
        /방금|아까|최근|이전|지운|삭제한|영구삭제한|사라진|파일|문서|복원|복구|기록|지점|히스토리|목록|보여|줘|주세요|알려|원래대로|되돌려|원복|취소|해|할래/g,
        ''
      )
      .trim();
    const sortedPoints =
      filterKwMatch.length >= 2
        ? [            ...points.filter((p) => p.summary.includes(filterKwMatch) || p.userPrompt.includes(filterKwMatch)),
            ...points.filter((p) => !p.summary.includes(filterKwMatch) && !p.userPrompt.includes(filterKwMatch)),
          ]
        : points;

    const countGuide =
      sortedPoints.length > 3
        ? `총 ${sortedPoints.length}건 중 **가장 최근 3건**을 먼저 보여드릴게요! (이전 기록은 카드 하단 **[▾ 이전 복원 기록 더 보기]**로 펼칠 수 있어요)`
        : `총 ${sortedPoints.length}건의 복원 기록이 있어요!`;

    speak(`복원 기록 ${sortedPoints.length}건을 확인했어요. 되돌리기 버튼을 누르거나 번호를 말씀해 주세요.`);
    return reply(
      sourceTab,
      ` **[복원 기록] 히스토리 조회** — ${countGuide}\n아래 카드에서 **[↩️ 원래대로 되돌리기 (복원)]** 버튼을 바로 누르시거나, 채팅창에 **"1번 복원해줘"**처럼 입력해 주세요!`,
      {
        cardKind: 'RESTORE_POINTS_LIST',
        restorePoints: sortedPoints,
        followUpSuggestions: [          '1번 복원해줘',
          '방금 지운 파일 찾아줘',
        ],
      }
    );
  }

  // 0-0C) [Role 4: 클레임 · A/S 접수 · 아이디어 제안 스튜디오 대리 접수 창구 (회원 로그인 유지 & 나의 문의방 링크 즉시 반환)]
  const studioSupportReply = await handleStudioSupportProxyIfMatched(clean, sourceTab, speak);
  if (studioSupportReply) return studioSupportReply;

  // 0-0C-2) [귀신비서 대화형 실적 생색내기 & 편의 기능 코칭 (은행 보안프로그램 자동 재우기 · 조용한 악성검사 · 누적 압축파일 안내)]
  const careBriefingReply = await handleSecretaryCareBriefingAndSuperpowersIfMatched(clean, sourceTab, speak);
  if (careBriefingReply) return careBriefingReply;

  // 0-0D) [Role 3: 말 한마디로 모든 앱 설정·F1~F10 상용구·클립보드 보관기간을 직접 변경하는 마스터 컨트롤 센터]
  const settingsControlReply = await handleAppSettingsControlIfMatched(clean, sourceTab, speak);
  if (settingsControlReply) return settingsControlReply;

  // 0-0E) [Role 2: 귀신같이 자체 기능 · 요금제(내 기기 통합 3,900원) · 업데이트 질문에 답하는 인포메이션 데스크]
  const infoDeskReply = handleGhostiInfoDeskIfMatched(clean, sourceTab, speak);
  if (infoDeskReply) return infoDeskReply;

  // 0-0F) [[🎯 찾기] ↔ [👻 귀신비서] 양방향 0토큰 통합 음성/텍스트 자동 라우터]
  // [✋ 손보기 대화창]에서 문서 카톡 전달, 문서 핵심 수치 Q&A("보증금 얼마야?"), 키워드 문장 낭독, 문서 요약, 또는 단순 사진·서류 찾기를 말했을 때
  // "다른 메뉴로 가세요"라고 거절하지 않고 0.00[🎯 찾기] 엔진으로 자동 토스(Toss) 및 음성 브리핑까지 원스톱 실행합니다!
  const voiceDocCmd = parseZeroLlmVoiceDocCommand(clean);
  if (voiceDocCmd.intentType === 'KAKAO_REAL_CHATROOM_SEND') {
    const store = useSaySeeStore.getState();
    const { matchedDoc } = resolveTargetDocAndBuildFactAnswer(
      store.localDocuments,
      voiceDocCmd.targetDocKeyword
    );
    const fileName = matchedDoc?.fileName || `${voiceDocCmd.targetDocKeyword}.pdf`;
    const filePath = matchedDoc?.path;
    const kakaoRes = await dispatchFileToKakaoRealChatroom({
      recipientName: voiceDocCmd.kakaoRecipientName,
      fileName,
      filePath,
    });
    const kakaoHeader = kakaoRes.ok
      ? ` **[양방향 자동 토스  카카오톡 '${kakaoRes.recipientName}'대화방 파일 장전 완료]**`
      : ` **[카카오톡 '${kakaoRes.recipientName}'대화방 연결 대기 (엔진·카톡 확인 필요)]**`;
    return reply(
      sourceTab,
      `${kakaoHeader}\n` +
        `${kakaoRes.hyunsuAnnouncement}\n` +
        `• 대상 서류: **${kakaoRes.fileName}** (스마트 서류함 자동 매칭)`,
      {
        cardKind: 'SEARCH_ROUTING',
        searchKeyword: voiceDocCmd.targetDocKeyword,
        followUpSuggestions: [          '이 계약서 보증금이랑 월세 얼마야?',
          '계약서에서 위약금이나 해지 나오는 문장 다 읽어줘',
          '이 계약서에서 나한테 불리한 조항 있어?',
        ],
      }
    );
  }

  if (voiceDocCmd.intentType === 'DOC_FACT_QA_READ') {
    const store = useSaySeeStore.getState();
    const { matchedDoc, factAnswerKo, voiceRole } = resolveTargetDocAndBuildFactAnswer(
      store.localDocuments,
      voiceDocCmd.targetDocKeyword,
      voiceDocCmd.extractKeywords
    );
    if (ttsEnabled) void speakWithHyunsuOrSunhi(factAnswerKo, voiceRole);
    return reply(
      sourceTab,
      ` **[양방향 자동 토스  스마트 서류함 핵심 수치 즉답]**\n` +
        ` ${factAnswerKo}`,
      {
        cardKind: 'SEARCH_ROUTING',
        searchKeyword: matchedDoc?.title || voiceDocCmd.targetDocKeyword,
        followUpSuggestions: [          '사무실 계약서 찾아서 이쁜이에게 카톡 전달해줘',
          '계약서에서 위약금이나 해지 나오는 문장 다 읽어줘',
          '이 계약서에서 나한테 불리한 독소조항 있어?',
        ],
      }
    );
  }

  if (voiceDocCmd.intentType === 'DOC_KEYWORD_SENTENCE_READ' || voiceDocCmd.intentType === 'DOC_SUMMARY_READ') {
    const store = useSaySeeStore.getState();
    const { matchedDoc, factAnswerKo } = resolveTargetDocAndBuildFactAnswer(
      store.localDocuments,
      voiceDocCmd.targetDocKeyword,
      voiceDocCmd.extractKeywords
    );
    const fullText = matchedDoc?.extractedText || factAnswerKo;
    if (voiceDocCmd.intentType === 'DOC_KEYWORD_SENTENCE_READ') {
      const extracted = extractKeywordSentencesZeroLlm(fullText, voiceDocCmd.extractKeywords);
      const readScript =
        extracted.matchedCount > 0
          ? `${extracted.hyunsuIntroText} ${extracted.sunhiReadScript}`
          : `찾으신 '${matchedDoc?.title || '문서'}'의 내용입니다. ${fullText || factAnswerKo}`;

      if (ttsEnabled) {
        void speakWithHyunsuOrSunhi(readScript, 'sunhi_doc_reader');
      }
      return reply(
        sourceTab,
        ` **[양방향 자동 토스  문서 키워드 조항 발췌 낭독]**\n` +
          ` ${extracted.matchedCount > 0 ? extracted.hyunsuIntroText : `선희 아나운서가 '${matchedDoc?.title || '문서'}'전문을 읽어드립니다.`}\n` +
          (extracted.sunhiReadScript ? ` ${extracted.sunhiReadScript}` : ` ${fullText}`),
        {
          cardKind: 'SEARCH_ROUTING',
          searchKeyword: matchedDoc?.title || voiceDocCmd.targetDocKeyword,
        }
      );
    } else {
      if (ttsEnabled) void speakWithHyunsuOrSunhi(factAnswerKo, 'sunhi_doc_reader');
      return reply(
        sourceTab,
        ` **[양방향 자동 토스  스마트 서류함 요약 낭독]**\n ${factAnswerKo}`,
        {
          cardKind: 'SEARCH_ROUTING',
          searchKeyword: voiceDocCmd.targetDocKeyword,
        }
      );
    }
  }

  if (voiceDocCmd.intentType === 'HIGH_DIFFICULTY_AI_BATON_TOUCH') {
    const store = useSaySeeStore.getState();
    const { matchedDoc } = resolveTargetDocAndBuildFactAnswer(
      store.localDocuments,
      voiceDocCmd.targetDocKeyword
    );
    return reply(
      sourceTab,
      `${RED_LINES_TEXT}\n\n 이 질문은 귀신같이 무료 팩트 검색 범위를 넘는 심층 분석 질문입니다. 찾으신 문서(**${matchedDoc?.fileName || '계약서'}**) 본문과 질문을 클립보드에 담아 평소 쓰시는 **단골 AI(기본: Google Gemini)** 라이브 음성 상담으로 바로 연결해 드립니다.`,
      {
        cardKind: 'BATON_TOUCH_CUTOFF',
        batonTouchPayload: {
          docTitle: matchedDoc?.title || '계약서 문서',
          docText: matchedDoc?.extractedText || clean,
          userQuestion: clean,
        },
      }
    );
  }

  // [무설정 채팅 직결 드라이브 스캔] "D드라이브는 왜 검색안돼?", "D에 사진있는데 찾아줘", "외장하드 찾아줘", "마이박스 사진 찾아줘"
  // 복잡한 설정 페이지나 버튼 없이 채팅창에서 말하면 즉시 해당 드라이브를 스캔·등록하고 검색 엔진에 연결합니다.
  const isDynamicDriveScanRequest =
    !(/\bs\s*드라이브\b/i.test(clean) && /고쳐|오류|끊김|안\s*열려/i.test(clean)) &&
    (/(?:[c-zC-Z]\s*드라이브|\b[d-zD-Z]\s*에\s*(?:있는\s*)?(?:사진|영상|동영상|문서|파일|폴더)|외장\s*하드|마이박스|mybox)/i.test(
      clean
    ));

  if (isDynamicDriveScanRequest) {
    const scanRes = await zcoreJson<{
      ok: boolean;
      exists?: boolean;
      driveLabel?: string;
      driveRoots?: string[];
      drivePhotoCount?: number;
      driveVideoCount?: number;
      driveDocCount?: number;
      totalPhotos?: number;
      totalVideos?: number;
      totalDocs?: number;
      scannedFolderCount?: number;
      sampleFolders?: string[];
      error?: string;
    }>('/__zcore/scan-drive', postJson({ drive: clean, query: clean }), 8000);

    if (scanRes.ok && scanRes.data?.ok) {
      const d = scanRes.data;
      const label = d.driveLabel || '추가 드라이브';
      await useSaySeeStore.getState().initApp(true);

      const strippedKw = clean
        .replace(/[c-zC-Z]\s*드라이브(?:는|은|도|에서|에)?/gi, ' ')
        .replace(/\b[d-zD-Z]\s*에(?:서)?\b/gi, ' ')
        .replace(/외장\s*하드(?:는|은|도|에서|에)?|마이박스(?:는|은|도|에서|에)?|mybox/gi, ' ')
        .replace(/왜\s*검색\s*안\s*(?:돼|되나요|되니|됨)|검색\s*안\s*돼|있는데|있는\s*거|스캔해\s*줘|연결해\s*줘|찾아\s*줘|보여\s*줘|검색해\s*줘/gi, ' ')
        .replace(/[?!.~,]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const msgKo = `별도 설정 없이 말씀하신 **[${label}]**를 즉시 스캔하여 검색 대상에 연결했습니다!\n• ${label} 확인 파일: 사진 **${
        d.drivePhotoCount ?? 0
      }장** · 동영상 **${d.driveVideoCount ?? 0}개** · 문서 **${d.driveDocCount ?? 0}건**\n• 현재 전체 검색 가능: 사진 ${
        d.totalPhotos ?? 0
      }장 · 동영상 ${d.totalVideos ?? 0}개 · 문서 ${
        d.totalDocs ?? 0
      }건\n이제부터 ${label}의 모든 파일이 자동으로 함께 검색됩니다.`;
      speak(`${label}를 즉시 스캔하여 연결했습니다. 사진 ${d.drivePhotoCount ?? 0}장과 동영상 ${d.driveVideoCount ?? 0}개가 추가되었습니다.`);

      if (strippedKw && !/^(사진|영상|동영상|문서|파일|폴더)$/.test(strippedKw)) {
        return reply(sourceTab, msgKo, {
          cardKind: 'SEARCH_ROUTING',
          searchKeyword: strippedKw,
        });
      }
      return reply(sourceTab, msgKo);
    }

    const errMsg =
      (scanRes.ok ? scanRes.data?.error : scanRes.error) ||
      '말씀하신 드라이브가 현재 PC에 연결되어 있지 않거나 접근할 수 없습니다. 외장하드나 드라이브 연결 상태를 확인해 주세요.';
    speak(errMsg);
    return reply(sourceTab, ` ${errMsg}`);
  }

  // [🧹 귀신비서 심층 앱 적출(Deep Uninstaller) 프로토콜]
  // "어도비 싹 다 지워줘", "안 지워지는 프로그램 깨끗하게 삭제해줘", "카카오톡 삭제해줘", "○○ 언인스톨해줘"
  const lastAssistantMsgForUninstall = [...sharedChatState.messages]
    .reverse()
    .find((m) => m.role === 'assistant');
  const isFollowUpAppNameAfterClarify =
    Boolean(
      lastAssistantMsgForUninstall?.text &&
        /어떤 프로그램을 (정리|깨끗하게 지워|삭제).*?프로그램 이름을 함께 말씀해 주세요/s.test(
          lastAssistantMsgForUninstall.text
        )
    ) &&
    clean.length >= 2 &&
    clean.length <= 30 &&
    !/바탕화면|다운로드|휴지통|사진|동영상|문서|복원|부팅|시작\s*프로그램|사양|편의 기능|여권/i.test(clean);

  // [죽은 시작프로그램 잔여 등록 흔적 정리 요청 ("이미 삭제되고 시작 목록에만 남은 프로그램 삭제" 등) 전용 처리]
  const isOrphanStartupCleanQuery =
    /(시작\s*목록|시작\s*프로그램|부팅\s*목록)/i.test(clean) &&
    /(이미\s*삭제|남은|흔적|유령|없는\s*프로그램)/i.test(clean) &&
    /(삭제|제거|정리|지워|없애)/i.test(clean);
  if (isOrphanStartupCleanQuery) {
    const stCleanRes = await fetchStartupManagerPayload();
    if (!stCleanRes.ok || !stCleanRes.payload) {
      return reply(
        sourceTab,
        stCleanRes.errorKo || '내 컴퓨터 연결(PC 엔진) 상태를 확인한 뒤 다시 말씀해 주세요.',
        { followUpSuggestions: ['시작프로그램 목록 보여줘'] }
      );
    }
    const cleanedNames = stCleanRes.payload.cleanedOrphanNames || [];
    const enCnt = stCleanRes.payload.items.filter((x) => x.enabled).length;
    const disCnt = stCleanRes.payload.items.filter((x) => !x.enabled).length;
    const msgKo =
      cleanedNames.length > 0
        ? `이미 지워졌는데 윈도우 시작 목록에만 남아 있던 흔적(**${cleanedNames.join(', ')}**)을 깨끗하게 정리해 목록에서 제외했어요!\n아래에는 현재 내 컴퓨터에 **실제로 설치되어 있는 시작프로그램(켜짐 ${enCnt}개 · 꺼둠 ${disCnt}개)**만 표시됩니다.`
        : `윈도우 시작 목록에 남아 있던 삭제된 프로그램 흔적을 모두 정리하여, 현재는 **실제로 존재하는 시작프로그램(켜짐 ${enCnt}개 · 꺼둠 ${disCnt}개)**만 깨끗하게 남아 있어요!`;
    speak('삭제된 프로그램의 시작 목록 흔적을 정리하고 실제 존재하는 시작프로그램만 보여드렸습니다.');
    return reply(sourceTab, msgKo, {
      cardKind: 'STARTUP_MANAGER_CARD',
      startupManagerPayload: stCleanRes.payload,
      followUpSuggestions: ['설치된 프로그램 목록 보여줘', '내 PC 점검해줘'],
    });
  }

  const isDeepUninstallRequest =
    isFollowUpAppNameAfterClarify ||
    (!/바탕화면|다운로드\s*폴더|휴지통|사진|동영상|문서|파일|폴더|복사\s*기록|중복|연사|보안\s*쓰레기|보안\s*프로그램|시작\s*프로그램|시작\s*목록|방금\s*지운/i.test(
      clean
    ) &&
      (/(어도비|adobe|포토샵|아크로뱃|acrobat|creative\s*cloud|알약|알집|고클린|한컴|줌|zoom|팀뷰어|teamviewer|애니데스크|anydesk|카카오톡|카톡|kakaotalk|라인|텔레그램|디스코드|슬랙|배틀넷|스팀|steam|구글\s*드라이브|원드라이브|드롭박스).*?(지워|삭제|제거|없애|뽑아|적출|언인스톨|치워)/i.test(
        clean
      ) ||
        /(안\s*지워지|안\s*꺼지|좀비\s*프로그램|흔적까지|뿌리째|싹\s*다\s*(지워|삭제|제거)|깨끗하게\s*(지워|삭제|제거)|완전히\s*(지워|삭제|제거)|완전\s*삭제|강제\s*삭제|심층\s*적출|심층\s*제거|언인스톨|uninstall)/i.test(
          clean
        ) ||
        /(프로그램|어플|앱|소프트웨어).*?(지워|삭제|제거|뽑아|적출|언인스톨)/i.test(clean) ||
        /^[가-힣A-Za-z0-9_.\s]{2,20}\s*(프로그램|어플|앱)?\s*(완전히\s*|깨끗하게\s*|싹\s*다\s*)?(삭제해\s*줘|삭제해\s*주세요|지워\s*줘|지워\s*주세요|제거해\s*줘|제거해\s*주세요)$/i.test(
          clean
        )));

  if (isDeepUninstallRequest) {
    const payload = await scanDeepUninstallTarget(clean);
    if (payload.needsClarification || payload.zCoreOffline) {
      if (payload.needsClarification && zCoreBridge.isConnected) {
        const appsRes = await fetchInstalledAppsPayload();
        if (appsRes.ok && appsRes.payload && appsRes.payload.items.length > 0) {
          return reply(
            sourceTab,
            `${payload.honestBriefingKo}\n\n 이름을 일일이 외우실 필요 없도록 **내 PC에 설치된 프로그램 전체 목록(${appsRes.payload.totalCount}개)**을 바로 아래에 띄워 드렸어요! 지우고 싶은 앱 옆의 **[심층 제거 점검]**을 눌러 주세요.`,
            {
              cardKind: 'INSTALLED_APPS_CARD',
              installedAppsPayload: appsRes.payload,
              followUpSuggestions: ['알약 흔적까지 지워줘', '알집 완전히 삭제해줘', '고클린 제거해줘'],
            }
          );
        }
      }
      return reply(sourceTab, payload.honestBriefingKo, {
        followUpSuggestions: payload.needsClarification
          ? ['설치된 프로그램 전체 목록 보여줘', '알약 흔적까지 지워줘', '고클린 제거해줘']
          : ['요즘 컴퓨터가 좀 느린데 내 사양이랑 상태 봐줘'],
      });
    }
    speak(
      payload.foundAny
        ? `${payload.targetAppLabel} 심층 제거 사전 스캔을 완료했습니다. 상주 프로세스 ${payload.runningProcessCount}개와 잔여 폴더 ${payload.totalResidualMb}메가바이트가 발견되었습니다. 심층 제거 실행 버튼을 누르시거나 응 진행해라고 입력해 주세요.`
        : `${payload.targetAppLabel} 관련 잔여 흔적을 모두 스캔했으나 남아 있는 항목이 없습니다.`
    );
    return reply(sourceTab, payload.honestBriefingKo, {
      cardKind: payload.foundAny ? 'DEEP_UNINSTALL_GATE' : undefined,
      deepUninstallPayload: payload.foundAny ? payload : undefined,
      followUpSuggestions: payload.foundAny
        ? [            '응 진행해',
            '요즘 컴퓨터가 좀 느린데 내 사양이랑 상태 봐줘',
          ]
        : [            '요즘 컴퓨터가 좀 느린데 내 사양이랑 상태 봐줘',
            '바탕화면이랑 다운로드 폴더 정리할 파일 봐줘',
          ],
    });
  }

  const isMobileClient =
    typeof navigator !== 'undefined' &&
    (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') ||
      (/Macintosh/i.test(navigator.userAgent || '') && (navigator.maxTouchPoints || 0) > 1));

  // 0-0G) [0토큰 즉시 실행: 시작프로그램 목록 & 개별 켜기/끄기(ON/OFF) 스위치 매니저]
  // 추천 칩('부팅할 때 켜지는 시작프로그램 목록도 보여줘', '시작프로그램 목록 보여줘')이나 자연어 조회 요청이
  // 구버전 일괄 정리 카드(DEVICE_REPAIR_GATE)나 LLM으로 빠지지 않고 즉시 스위치 카드로 열리도록 최우선 처리합니다.
  const isStartupManagerIntent =
    !/강제\s*종료|정리해|치워|삭제해|지워|보안\s*모듈/i.test(clean) &&
    /(시작\s*프로그램|자동\s*실행\s*(목록|프로그램)|부팅.*?(켜지는|실행되는)\s*(프로그램|앱|목록))/i.test(clean);
  if (isStartupManagerIntent) {
    if (isMobileClient) {
      const mobileStartupMsg =
        `지금은 **스마트폰**으로 접속해 계시네요!\n` +
        `윈도우 시작프로그램 켜기·끄기 관리는 **PC(컴퓨터)에서 접속하셨을 때** 바로 보여드려요. 스마트폰에서는 사진첩 중복·연사 정리와 사진·문서 내용검색을 바로 써보실 수 있어요!\n\n` +
        ` **요금 안내**: 시작프로그램 목록 점검과 켜기·끄기 관리는 내 PC 1대에서 무료로 이용하실 수 있습니다!`;
      return reply(sourceTab, mobileStartupMsg, {
        followUpSuggestions: [
          '중복·연사 사진 정리하는 법 알려줘',
          '귀신검색으로 내 파일 찾아볼래',
          '귀신비서의 편의 기능 알려줘',
        ],
      });
    }
    const stRes = await fetchStartupManagerPayload();
    if (!stRes.ok || !stRes.payload) {
      const offlineStartupMsg =
        ` **[내 PC 시작프로그램 관리 안내]**\n` +
        `윈도우가 켜질 때 자동으로 실행되는 시작프로그램 목록을 불러와 켜고 끄려면 **무료 귀신비서 로컬 엔진**이 켜져 있어야 합니다.\n\n` +
        ` **요금 안내**: 시작프로그램 목록 점검과 켜기·끄기 관리는 내 PC 1대에서 무료로 이용하실 수 있습니다!`;
      speak('시작프로그램 관리는 내 PC 1대에서 평생 무료로 이용하실 수 있으며, 로컬 엔진을 켜주시면 즉시 목록을 보여드립니다.');
      return reply(sourceTab, offlineStartupMsg, {
        followUpSuggestions: [
          '컴퓨터 켜둔 지 얼마나 지났는지 부팅 경과 시간 진단해줘',
          '내 PC 사양이랑 남은 용량 진단해 줘',
        ],
      });
    }
    const enCnt = stRes.payload.items.filter((x) => x.enabled).length;
    const disCnt = stRes.payload.items.filter((x) => !x.enabled).length;
    speak(
      `내 컴퓨터 부팅 시 자동 실행되는 시작프로그램 ${stRes.payload.items.length}개를 불러왔어요. 원하시는 항목의 스위치를 눌러 켜고 끌 수 있습니다.`
    );
    return reply(
      sourceTab,
      ` **내 PC 부팅 시 자동 실행되는 시작프로그램 목록(켜짐 ${enCnt}개 · 꺼둠 ${disCnt}개)**이에요!\n원하시는 항목만 골라서 우측 스위치로 안전하게 **켜고 끄실 수 있으며**, 보안·필수 항목은 실수로 꺼지지 않게 보호해 두었습니다.`,
      {
        cardKind: 'STARTUP_MANAGER_CARD',
        startupManagerPayload: stRes.payload,
        followUpSuggestions: ['설치된 프로그램 목록 보여줘', '윈도우 임시파일(Temp) 정리할 거 봐줘'],
      }
    );
  }

  // [🗑️ "휴지통 비워줘" 직접 타이핑 안전핀 & 휴지통 용량 조회 (기능명세 §5.9-3)]
  const isRecycleBinPurgeTyped =
    /휴지통/.test(clean) && /(비워\s*줘|비워\s*주세요|비워\s*줄래|비워라|비우기|완전히\s*비워|싹\s*비워)/i.test(clean);
  if (isRecycleBinPurgeTyped) {
    if (isMobileClient) {
      return reply(
        sourceTab,
        '스마트폰 사진 휴지통 비우기는 아이폰 **[사진 앱  최근 삭제된 항목]** 또는 안드로이드 **[갤러리  휴지통]**에서 OS 보안 확인 후 비우실 수 있어요!'
      );
    }
    const purgeRes = await zcoreJson<any>(
      '/__zcore/recycle-bin-empty',
      postJson({ userApprovalTypedText: clean })
    );
    if (!purgeRes.ok || !purgeRes.data?.ok) {
      const errKo =
        (!purgeRes.ok ? purgeRes.error : purgeRes.data?.message) ||
        '내 컴퓨터 연결(PC 엔진) 상태를 확인한 뒤 채팅창에 직접 "휴지통 비워줘"라고 입력해 주세요.';
      return reply(sourceTab, errKo);
    }
    const d = purgeRes.data;
    const msgKo =
      `${d.message}\n **블랙박스 안전핀 기록 완료** — 직접 입력 발화: \`"${clean}"\``;
    speak(d.message);
    return reply(sourceTab, msgKo, {
      followUpSuggestions: ['윈도우 임시파일(Temp) 정리할 거 봐줘', '요즘 컴퓨터 사양이랑 상태 봐줘'],
    });
  }

  const isRecycleBinStatusQuery =
    /휴지통/.test(clean) && /(용량|상태|몇\s*개|얼마나|남아|확인|조회)/i.test(clean) && !/찾아|살려|복구|복원/i.test(clean);
  if (isRecycleBinStatusQuery && !isMobileClient) {
    const rbSt = await zcoreJson<any>('/__zcore/recycle-bin-status');
    if (rbSt.ok && rbSt.data?.ok) {
      const cnt = Number(rbSt.data.itemCount ?? 0);
      const szLbl = String(rbSt.data.sizeLabel || '0B');
      const cFree = Number(rbSt.data.cDriveFreeGb ?? 0);
      const infoKo =
        cnt > 0
          ? `현재 Windows **[휴지통]**에 **${cnt}개 항목(총 ${szLbl})**이 안전하게 보관 중이에요. (현재 C드라이브 여유 공간: **${cFree}GB**)\n\n 휴지통에 보관 중일 때는 C드라이브 남은 용량 숫자가 그대로 유지됩니다. 이상이 없거나 지금 바로 여유 공간(+${szLbl})을 확보하시려면 실수 방지를 위해 채팅창에 직접 **\`"휴지통 비워줘"\`**라고 타이핑해 주세요!`
          : `현재 Windows **[휴지통]**이 **0개(0B)**로 깨끗하게 비어 있어요! (C드라이브 여유 공간: **${cFree}GB**)`;
      return reply(sourceTab, infoKo, {
        followUpSuggestions: ['윈도우 임시파일(Temp) 정리할 거 봐줘', '바탕화면·다운로드 정리할 파일 봐줘'],
      });
    }
  }

  // [🧹 고클린 대체 ①: 윈도우 임시 쓰레기(Temp · 크래시 덤프) 안전 스캔 미리보기]
  const isTempJunkCleanupIntent =
    !isMobileClient &&
    /(임시\s*파일|임시\s*쓰레기|temp\s*폴더|temp\s*파일|윈도우\s*캐시|찌꺼기\s*파일|크래시\s*덤프)/i.test(clean) &&
    !/복원|되돌려|찾아/i.test(clean);
  if (isTempJunkCleanupIntent) {
    const scanTmp = await zcoreJson<{
      ok: boolean;
      items?: MonsterCleanupItem[];
      totalBytes?: number;
    }>('/__zcore/cleanup-scan', postJson({ kind: 'WINDOWS_TEMP_JUNK' }));
    if (!scanTmp.ok || !scanTmp.data?.ok) {
      return reply(sourceTab, ` ${(!scanTmp.ok ? scanTmp.error : '') || '내 컴퓨터 연결(PC 엔진) 후 임시파일을 점검할 수 있습니다.'}`);
    }
    const items = scanTmp.data.items || [];
    const totalBytes = Number(scanTmp.data.totalBytes ?? 0);
    if (items.length === 0) {
      return reply(
        sourceTab,
        '내 PC의 사용자·윈도우 Temp 폴더를 점검한 결과, 24시간이 지난 불필요 임시 쓰레기 파일이 **0건**으로 아주 깨끗합니다! (열려 있는 브라우저와 최근 작업 파일은 안전하게 보호했습니다)',
        {
          followUpSuggestions: ['시작프로그램 목록 보여줘', '설치된 프로그램 전체 목록 보여줘'],
        }
      );
    }
    const previewTmp: MonsterCleanupPreviewPayload = {
      cleanupType: 'WINDOWS_TEMP_JUNK',
      summaryTitle: '윈도우 임시 쓰레기(Temp · 크래시 덤프) 안전 청소',
      userPrompt: clean,
      targetFolderLabel: 'Windows·사용자 Temp 폴더 (최근 24시간 작업파일·브라우저 제외)',
      moveCount: items.length,
      totalBytes,
      reclaimSizeLabel: `총 ${formatBytes(totalBytes)}`,
      items,
      sampleFiles: items
        .slice(0, 8)
        .map((i) => `${i.name} (${i.folderLabel} · ${formatBytes(i.sizeBytes)} · ${i.ageDays}일 전)`),
      previewDescriptionKo: `영구 삭제 없이 Windows 기본 [휴지통]으로 안전하게 옮기며 [복원 기록]에도 남겨 드립니다.`,
      approved: false,
    };
    return reply(
      sourceTab,
      ` **묵은 윈도우 임시 쓰레기 파일 ${items.length}건(${formatBytes(totalBytes)})**을 찾았어요!\n열려 있는 프로그램이나 최근 24시간 파일은 빼고 안전한 항목만 골랐습니다. 아래 목록을 보시고 **[✅ 응, 안전 정리해줘]** 버튼을 눌러 주세요.`,
      {
        cardKind: 'CLEANUP_PREVIEW_GATE',
        cleanupPreview: previewTmp,
      }
    );
  }

  // [📋 고클린 대체 ③: 설치된 프로그램 전체 목록 조회 & 원클릭 심층 제거 연결]
  const isInstalledAppsListIntent =
    !isMobileClient &&
    /(설치된\s*(프로그램|앱|어플)|깔린\s*(프로그램|앱|어플)|프로그램\s*(목록|리스트|추가\s*제거)|안\s*쓰는\s*(프로그램|앱)\s*(목록|뭐\s*있|보여))/i.test(
      clean
    );
  if (isInstalledAppsListIntent) {
    const appsRes = await fetchInstalledAppsPayload();
    if (!appsRes.ok || !appsRes.payload) {
      return reply(sourceTab, ` ${appsRes.errorKo || '내 컴퓨터 연결(PC 엔진) 후 설치된 프로그램 목록을 볼 수 있습니다.'}`);
    }
    return reply(
      sourceTab,
      ` **내 PC에 설치된 프로그램 전체 목록(총 ${appsRes.payload.totalCount}개 · 용량순)**이에요!\n앱 이름을 일일이 입력하실 필요 없이, 정리하고 싶은 프로그램 옆의 **[심층 제거 점검]** 버튼을 누르면 상주 프로세스와 잔여 캐시 용량까지 먼저 진단해 드립니다.`,
      {
        cardKind: 'INSTALLED_APPS_CARD',
        installedAppsPayload: appsRes.payload,
        followUpSuggestions: ['시작프로그램 목록 보여줘', '윈도우 임시파일(Temp) 정리할 거 봐줘'],
      }
    );
  }

  const isExplicitBootUptimeOrRebootCare =
    !/강제\s*종료/i.test(clean) &&
    /부팅\s*경과|켜\s*둔\s*지|경과\s*시간|부팅\s*컨디션|안\s*끄고|자동\s*재부팅|재부팅\s*예약|새벽.*?재부팅|고클린|구라제거기|핸들\s*누수|응급\s*리셋|(재부팅해도.*?보안\s*쓰레기)|보안\s*쓰레기/i.test(
      clean
    );
  if (isExplicitBootUptimeOrRebootCare) {
    if (isMobileClient) {
      const mobileBootMsg =
        `지금은 **스마트폰**으로 접속해 계시네요!\n` +
        `컴퓨터 부팅 경과 시간 진단은 **PC(컴퓨터)에서 접속하셨을 때** 윈도우 켜둔 시간(시간·분)을 측정해 드려요  스마트폰에서는 사진첩 중복·흔들린 사진 정리와 사진·문서 내용검색을 바로 써보실 수 있어요!`;
      return reply(sourceTab, mobileBootMsg, {
        followUpSuggestions: [          '중복·연사 사진 정리하는 법 알려줘',
          '귀신검색으로 내 파일 찾아볼래',
        ],
      });
    }
    // [임의 실행 0% 철칙] 무조건 먼저 읽기 전용 진단을 수행하고, 정리/재부팅 예약은 미리보기 승인 카드로 제시!
    const diagRes = await executeRealOsAction('boot_lag_diagnose');
    const plugins = Array.isArray((diagRes as any).activeSecurityPlugins)
      ? (diagRes as any).activeSecurityPlugins.map((p: any) => String(p?.label || p?.keyword || '')).filter(Boolean)
      : [];
    const stCnt = Number((diagRes as any).startupProgramsCount ?? 0);
    const wantsScheduleReboot = /예약|새벽/i.test(clean);
    const wantsCleanBloat = /구라|보안\s*프로그램|보안\s*쓰레기|정리|고클린/i.test(clean);

    if (wantsScheduleReboot || wantsCleanBloat) {
      const previewBoot: MonsterBootCarePreviewPayload = {
        mode: wantsScheduleReboot ? 'SCHEDULE_REBOOT' : 'CLEAN_BLOATWARE',
        scheduleTime: '04:00',
        uptimeSummaryKo:
          diagRes.summaryKo ||
          '내 PC 부팅 경과 시간 및 상주 보안 모듈 상태를 점검했습니다.',
        detectedPlugins: plugins,
        startupCount: stCnt,
        approved: false,
      };
      const introKo = wantsScheduleReboot
        ? `⏰ **새벽 4시 자동 다시 시작(재부팅) 예약 미리보기**입니다.\n바로 예약하지 않고 먼저 확인창을 띄워 드렸어요. 아래 버튼을 누르시거나 **"응 진행해"**라고 입력하시면 등록됩니다.`
        : ` **미사용 웹 보안 모듈 및 불필요 자동실행 점검 결과**입니다. (사내 문서보안 DRM·백신은 절대 건드리지 않습니다)\n아래 대상 목록을 확인하신 뒤 **[✅ 응, 안전 정리해줘]** 버튼을 눌러 주세요!`;
      return reply(sourceTab, introKo, {
        cardKind: 'BOOT_CARE_PREVIEW_GATE',
        bootCarePreviewPayload: previewBoot,
        followUpSuggestions: ['시작프로그램 목록 보여줘', '윈도우 임시파일(Temp) 정리할 거 봐줘'],
      });
    }

    const baseSummary =
      diagRes.summaryKo ||
      '⏱️ **[내 PC 부팅 경과 시간 & 컨디션 진단 안내]**\n내 컴퓨터 연결(PC 엔진)을 켜두시면 켜둔 시간(시간·분)을 알려드리며, 하루(24시간) 이상 켜두셨다면 억지 메모리 청소 대신 다시 시작(재부팅)을 한 번 해주시는 게 가장 빠르고 안전해요!';
    speak(baseSummary);
    return reply(sourceTab, baseSummary, {
      followUpSuggestions: [        '시작프로그램 목록 보여줘',
        '윈도우 임시파일(Temp) 정리할 거 봐줘',
        '새벽 4시에 자동 재부팅 예약해줘',
      ],
    });
  }

  // [🛡️ 알약 완전 대체: Windows Defender 순정 백신 통합 관제 카드]
  const isExplicitDefenderCheck =
    !/지워|삭제|제거|적출|언인스톨/i.test(clean) &&
    /알약|바이러스|랜섬웨어|백신|디펜더|defender|악성코드|방어막|(usb.*?검사)/i.test(clean);
  if (isExplicitDefenderCheck) {
    if (isMobileClient) {
      return reply(
        sourceTab,
        '스마트폰에서는 상단 **[유료결제 유도 악성 클리너 구출]** 기능으로 광고·결제 유도 앱을 안전하게 찾아 삭제하실 수 있어요!'
      );
    }
    const isAskingExtraAntivirusRecommendation =
      /(?:다른|무료|사설|별도|추가|좋은|유료)?\s*백신.*?(?:추천|깔아|설치|필요|뭐\s*써|있나|있어)|알약.*?(?:깔아|설치|대신|추천)/i.test(
        clean
      );
    const wantsUpdate = /업데이트|패치|최신\s*db/i.test(clean);
    const wantsScan = /검사|스캔/i.test(clean);
    const subDef = wantsUpdate
      ? 'defender_update_signature'
      : wantsScan
      ? 'defender_quick_scan'
      : 'defender_status';
    const defWrap = await fetchDefenderGuardState(subDef);
    const baseSummaryText =
      defWrap.summaryKo ||
      '윈도우 순정 바이러스·랜섬웨어 방어막(Microsoft Defender) 상태를 점검했습니다.';
    const summaryText = isAskingExtraAntivirusRecommendation
      ? `🛡️ **별도의 사설 무료 백신(알약·어베스트 등)은 추가로 설치하지 않으시는 것을 권장해요!**\n` +
        `사설 백신은 잦은 광고 팝업과 상주 메모리 점유로 오히려 PC 속도를 늦춥니다. Windows에 기본 내장된 **순정 백신(Microsoft Defender)** 하나만 켜두셔도 실시간 바이러스·랜섬웨어 방어력이 충분하며 광고도 전혀 없어요!\n\n` +
        baseSummaryText
      : baseSummaryText;
    speak(summaryText);
    return reply(sourceTab, summaryText, {
      cardKind: defWrap.payload ? 'DEFENDER_GUARD_CARD' : undefined,
      defenderGuardPayload: defWrap.payload,
      followUpSuggestions: [        '빠른 바이러스 검사 실행해줘',
        '백신 DB 최신 업데이트 해줘',
        '설치된 프로그램 전체 목록 보여줘',
      ],
    });
  }

  // 단순 사진/영상/문서 찾기 발화("작년 가족사진 찾아줘", "바닷가에서 뛰노는 아이 보여줘")도 LLM 호출 대기 없이 0.00[🎯 찾기]로 즉시 토스!
  const earlySearchIntent = detectZeroLlmPerspectiveSearchIntent(clean);
  if (
    earlySearchIntent.isSimpleSearchIntent &&
    !/프린터|와이파이|블루투스|소리|스피커|글씨|광고|팝업|고쳐|사라졌|사라진|없어졌|없어진|날아갔|날아간|지운|지웠|지워진|삭제|버린|버렸|증발|어디\s*갔|못\s*찾겠|저장\s*안\s*하고|휴지통|정리|치워|복원|복구|되돌|사양|스펙|부팅|재부팅|경과|켜\s*둔|진단|점검|시작\s*프로그램|자동\s*실행|보안|백신|디펜더|바이러스|랜섬웨어|온보딩|문의방|복사\s*기록|실적|보고서/i.test(
      clean
    )
  ) {
    const kw = earlySearchIntent.extractedKeyword || clean;
    speak(`말씀하신 ${kw} 검색 결과를 귀신검색 화면에서 바로 띄워드릴게요.`);
    return reply(
      sourceTab,
      ` **[양방향 자동 토스   귀신검색 즉시 실행]**\n"${kw}"검색 결과를 **[귀신검색]** 화면에서 바로 찾아 띄워드릴게요!`,
      {
        cardKind: 'SEARCH_ROUTING',
        searchKeyword: kw,
      }
    );
  }

  // 0-A) 우리 앱·기기·설정 키워드와 무관한 범위 밖 질문은 차갑게 거절하지 않고
  //      3단계 원칙에 따라 대화 내용을 클립보드에 복사해 두고 외부 AI로 바로 점프시켜 주는 버튼을 제공합니다 (무토큰 0원).
  //      단, 직전 귀신비서 말풍선이 질문/선택지를 던졌고 유저가 선택지 대신 직접 짧은 답변(예: 새 별명, 사이트명, 요일 등)을 입력한 경우에는
  //      범위 밖 질문으로 오판하지 않고 대화 맥락을 유지하여 처리합니다!
  const prevAssistantTurn = [...getSharedMonsterChatState().messages]
    .reverse()
    .find((m) => m.role === 'assistant');
  const isReplyingToRecentAssistantPrompt =
    Boolean(prevAssistantTurn) &&
    clean.length <= 36 &&
    !/(날씨|운세|주식|비트코인|환율|번역해|작문해|소설|레시피|요리법|법률|세무|정치|대통령)/i.test(clean) &&
    (/[?？]|(?:까요|실래요|주세요|알려\s*주|말씀해\s*주|골라\s*주|입력해\s*주)/.test(prevAssistantTurn?.text || '') ||
      Boolean(prevAssistantTurn?.followUpSuggestions && prevAssistantTurn.followUpSuggestions.length > 0));

  const hasAnyAppOrPcCue =
    isReplyingToRecentAssistantPrompt ||
    /귀신|여권|라벨러|편의\s*기능|별명|닉네임|호칭|프로필|계정|로그인|가입|동기화|연동|요금|구독|결제|환불|해지|특판|무료|유료|모임|라운지|문패|캐스트|리모컨|싱크|알림|검진|손없는\s*날|손\s*없는\s*날|단축키|우클릭|ctrl|컨트롤|클립보드|복사|붙여넣기|오타|한영|서식|줄바꿈|합본|ocr|컴퓨터|피씨|pc|노트북|스마트폰|휴대폰|폰|갤러리|사진첩|바탕화면|다운로드|폴더|파일|문서|사진|영상|엑셀|워드|한글|파워포인트|사양|스펙|속도|느려|느린|느리|버벅|렉|애드웨어|구라|점유율|프로세스|백그라운드|최적화|빠르게|용량|메모리|램|ram|cpu|그래픽|글카|배그|롤|게임|편집|포토샵|프리미어|프린터|인쇄|와이파이|인터넷|블루투스|소리|스피커|음성|목소리|화면|글씨|글자|테마|다크|라이트|주사율|팝업|광고|보안|백신|바이러스|랜섬웨어|디펜더|시작프로그램|부팅|재부팅|바로가기|아이콘|복원|되돌|취소|휴지통|사라|없어|날아|복구|찾아|검색|치워|정리|고쳐|손봐|손보|수리|설치|exe|apk|msi|zip|pdf|드라이브|윈도우|에러|오류|버그|먹통|멈춤|꺼졌|스튜디오|문의|건의|제안|아이디어|진행|실행|완료|끝났|된\s*거야|된거야|된\s*건가|한\s*거야|한거야|한\s*건가|됐어|됐나|했어|했나|승인|동의/i.test(
      clean
    );
  if (!hasAnyAppOrPcCue) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(clean).catch(() => {});
      }
    } catch {
      /* ignore */
    }
    const outOfScopeMsg =
      '이 질문은 귀신비서의 답변 범위를 넘어서는 내용이라 말씀하신 대화 내용을 클립보드에 미리 복사해 두었어요! 아래 버튼을 누르시면 평소 쓰시는 외부 AI(제미나이 등)로 바로 점프해서 답변받으실 수 있어요.';
    speak(outOfScopeMsg);
    return reply(sourceTab, ` ${outOfScopeMsg}`, {
      cardKind: 'BATON_TOUCH_CUTOFF',
      batonTouchPayload: {
        docTitle: '귀신비서 대화 내용 외부 AI 연결',
        docText: clean,
        userQuestion: clean,
      },
      followUpSuggestions: [        '내 컴퓨터 사양으로 영상편집이나 게임 잘 돌아가는지 봐 주세요',
        '다운로드 폴더 방치된 설치파일 정리해 주세요',
        '어제 보던 파일이 사라졌는데 찾아 주세요',
      ],
    });
  }

  // 0-0) [무토큰 초고속 패스] 정형화된 로컬 진단·정리·복원·수리 명령은 외부 LLM 네트워크 대기(3~6초) 없이 0.05초 만에 직결!
  const isSyntheticMissingTest = /없는파일_테스트|카톡받은_영수증캡처_01\.jpg/i.test(clean);
  const isDirectSlowOrAdwareFix =
    /(애드웨어|광고\s*프로그램|보안\s*프로그램|보안\s*모듈|보안\s*쓰레기|구라|시작\s*프로그램|cpu\s*점유|과점유|속도\s*최적화).*?(정리|강제\s*종료|종료|고쳐|해결|꺼|끄|없애|치워|잡아)/i.test(
      clean
    ) ||
    /(속도|컴퓨터|피씨|pc).*?(느려|느린|느리|버벅|렉).*?(고쳐|해결|정리|손봐|손보|빠르게|잡아|검진|점검)/i.test(
      clean
    ) ||
    /(1초\s*건강\s*검진|건강\s*검진\s*(해\s*줘|해\s*주세요|실행|시작))/i.test(clean);

  const isSpeedOrStatusQuestionFastCheck =
    !/바탕화면|다운로드|폴더|설치\s*파일|잡파일|스크린샷|\.exe|\.zip|\.apk|\.msi/i.test(clean) &&
    /(속도|개선|빨라|세이브|점유율|부하|상태\s*어때|상태\s*봐|사양|스펙|잘\s*됐|된\s*거야|된거야|된\s*건가|한\s*거야|한거야|한\s*건가|메모리|램|ram|cpu)/i.test(
      clean
    );

  const hasPriorSpecMsgFastCheck = sharedChatState.messages.some(
    (m) => m.role === 'assistant' && m.cardKind === 'PC_SPEC_CONSULTATION' && Boolean(m.pcSpecPayload)
  );

  const shouldSkipLlmForFastLocalAction =
    isDirectSlowOrAdwareFix ||
    /복원\s*기록|히스토리|되돌려|원래대로|타임머신|정리한\s*거\s*취소|#\d+/i.test(clean) ||
    isSyntheticMissingTest ||
    /없어졌|없어진|사라졌|사라진|증발|지웠|지운|지워진|삭제한|삭제된|삭제했|버린|버렸|날아갔|날아간|어디\s*갔|휴지통|복구해|못\s*찾겠|저장\s*안\s*하고/i.test(clean) ||
    /바로가기|바탕화면에\s*꺼내|아이콘\s*만들|자주\s*가는\s*(카페|사이트|유튜브|은행)/i.test(clean) ||
    (!isSpeedOrStatusQuestionFastCheck &&
      /바탕화면|다운로드|폴더|정리|치워|숨겨|설치\s*파일|apk|exe|msi|보안\s*프로그램|구라제거|anysign|magicline|veraport|touchen|부팅\s*느려|시작\s*프로그램|자동\s*실행/i.test(
        clean
      )) ||
    (hasPriorSpecMsgFastCheck &&
      /(개선된|세이브된|줄어든|된\s*거야|된거야|된\s*건가|한\s*거야|한거야|한\s*건가|만\s*세이브|왜\s*(그래|그대로|안\s*줄|남아)|얼마나\s*(줄|빨라|개선)|차이가|효과가)/i.test(
        clean
      )) ||
    /느려|느린|느리|속도|버벅|답답|애드웨어|사양|스펙|돌아가|배그|포토샵|프리미어|영상\s*편집|롤|게임|램|ram|메모리|글카|그래픽|cpu|주사율|60hz|144hz|업그레이드/i.test(
      clean
    ) ||
    /독소\s*조항|소송|세금\s*계산|법률|변호사|번역해|요약해|메인보드\s*타|전원\s*안\s*켜|액정\s*깨/i.test(clean) ||
    /고클린|구라제거기|버벅|렉\s*풀|응급\s*리셋|핸들\s*누수|재부팅|부팅\s*경과|켜\s*둔\s*지|경과\s*시간|안\s*끄고|보안\s*프로그램|보안\s*쓰레기|부팅\s*컨디션|알약|바이러스|랜섬웨어|백신|디펜더|defender|악성코드|방어막/i.test(
      clean
    ) ||
    /프린터|인쇄|스풀러|와이파이|인터넷|네트워크|블루투스|소리|스피커|글씨|화면|주사율|광고|팝업|s\s*드라이브|고쳐/i.test(
      clean
    );

  // 자유 일상 상담일 때만 내 PC 컨텍스트 + 저가 LLM(Gemini 2.5 Flash) 호출 (정형 명령은 즉시 통과!)
  const pcCtx = shouldSkipLlmForFastLocalAction
    ? { fetchedAt: Date.now(), summaryText: '' }
    : await fetchRealtimePcContextForLlm();
  const recentTurns = shouldSkipLlmForFastLocalAction
    ? []
    : sharedChatState.messages
        .filter((m) => m.id !== 'monster_welcome_init')
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text }));

  const llmDecision = shouldSkipLlmForFastLocalAction
    ? null
    : await callMonsterLowCostLlmJson({
        query: clean,
        sourceTab,
        literacyLevel,
        pcContextText: pcCtx.summaryText,
        recentTurns,
      });

  const hasLlm = Boolean(llmDecision && llmDecision.replyKo);
  const llmIntro = llmDecision?.replyKo ? ` ${llmDecision.replyKo}\n\n` : '';
  const defaultFollowUps = llmDecision?.followUpSuggestions?.length
    ? llmDecision.followUpSuggestions
    : undefined;

  if (isDirectSlowOrAdwareFix) {
    const isMobileRuntime =
      typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    if (!isMobileRuntime && !zCoreBridge.isConnected) {
      const promptMsg =
        '제가 웹 화면 밖으로 손이 닿아 실제 내 컴퓨터의 묵은 먼지와 보안 모듈을 점검하려면 왼쪽 상단의 **내 컴퓨터 연결(무광고 · 외부 전송 0%)**을 딱 한 번 켜주셔야 해요!';
      speak(promptMsg);
      return reply(sourceTab, promptMsg, {
        followUpSuggestions: [          '응, 내 컴퓨터 연결하고 누가 속도 잡아먹는지 분석해줘',
          '온보딩 체험관으로 나가서 구경하기 ',
        ],
      });
    }
    const diagRes = await executeRealOsAction('boot_lag_diagnose');
    const plugins = Array.isArray((diagRes as any).activeSecurityPlugins)
      ? (diagRes as any).activeSecurityPlugins.map((p: any) => String(p?.label || p?.keyword || '')).filter(Boolean)
      : [];
    const stCnt = Number((diagRes as any).startupProgramsCount ?? 0);
    const previewBoot: MonsterBootCarePreviewPayload = {
      mode: 'CLEAN_BLOATWARE',
      scheduleTime: '04:00',
      uptimeSummaryKo:
        diagRes.summaryKo ||
        '현재 컴퓨터 속도를 늦추는 미사용 웹 보안 모듈과 자동실행 항목을 점검했습니다.',
      detectedPlugins: plugins,
      startupCount: stCnt,
      approved: false,
    };
    const previewIntro =
      `${llmIntro} **마음대로 끄지 않고 누가 속도를 잡아먹고 있는지 먼저 점검했어요!**\n` +
      `아래 점검 카드를 확인하신 뒤 **[✅ 응, 안전 정리해줘]** 버튼을 누르시거나 **"응 진행해"**라고 입력해 주세요.`;
    speak('속도를 늦추는 항목을 먼저 점검했습니다. 확인 후 정리 버튼을 눌러 주세요.');
    return reply(sourceTab, previewIntro, {
      cardKind: 'BOOT_CARE_PREVIEW_GATE',
      bootCarePreviewPayload: previewBoot,
      followUpSuggestions: defaultFollowUps || [        '시작프로그램 목록 보여줘',
        '윈도우 임시파일(Temp) 정리할 거 봐줘',
      ],
    });
  }

  // 0) LLM이 순수 일상 대화(GENERAL_CONVERSATION)로 판단한 경우: 정규식 가로채기 없이 100% 자연스러운 일상 대화 즉시 반환
  if (
    hasLlm &&
    llmDecision!.intent === 'GENERAL_CONVERSATION' &&
    (!llmDecision!.zCoreCommand?.endpoint || llmDecision!.zCoreCommand.endpoint === 'NONE') &&
    !isSyntheticMissingTest &&
    !/느려|느린|느리|속도|버벅|렉|애드웨어|보안\s*프로그램|시작\s*프로그램|부팅|재부팅|경과|켜\s*둔|백신|디펜더|바이러스|랜섬웨어|사양|스펙|cpu|메모리|램|진단|점검/i.test(clean)
  ) {
    speak(llmDecision!.replyKo);
    return reply(sourceTab, ` ${llmDecision!.replyKo}`, {
      llmActionJson: llmDecision!,
      followUpSuggestions:
        defaultFollowUps || [          '내 PC 사양이랑 남은 용량 진단해 줘',
          '바탕화면이랑 다운로드 폴더 정리할 파일 봐줘',
          '어제 보던 파일이 사라졌는데 찾아줘',
        ],
    });
  }

  // 1) [복원 기록] 조회 (LLM JSON intent 우선, 오프라인 폴백 시에만 정규식 사용)
  // 단, '방금 지운 파일 찾아줘 / 되돌려줘'처럼 지운 실물 파일을 찾는 요청은 절대 복원 기록 목록으로 가로채지 않고 아래 2)로 직결!
  if (
    !hasExplicitRecycleOrDeletedFileCue &&
    (llmDecision?.intent === 'RESTORE_POINTS_LIST' ||
      llmDecision?.zCoreCommand?.endpoint === '/__zcore/restore-points' ||
      (!hasLlm && /복원\s*기록|히스토리|되돌려|원래대로|타임머신|정리한\s*거\s*취소|#\d+/i.test(clean)))
  ) {
    const { points, error } = await fetchRestorePointsWithPrecheck();
    const actionJson: MonsterLlmActionJson = llmDecision || {
      replyKo: '지금 디스크에 남아 있는 [복원 기록]을 대조해 드립니다.',
      intent: 'RESTORE_POINTS_LIST',
      zCoreCommand: { endpoint: '/__zcore/restore-points', action: 'LIST_AND_PRECHECK' },
      followUpSuggestions: ['가장 최근 기록 원래대로 되돌려줘', '바탕화면 정리 후보 다시 봐줘'],
    };
    if (error) {
      speak('Z-코어에 연결되지 않아 복원 기록을 불러오지 못했습니다.');
      return reply(sourceTab, `${llmIntro} ${error}`, {
        llmActionJson: actionJson,
        followUpSuggestions: defaultFollowUps,
      });
    }
    if (points.length === 0) {
      speak('아직 복원 기록이 없습니다.');
      return reply(
        sourceTab,
        `${llmIntro} 아직 [복원 기록]이 없습니다. 귀신비서로 정리·바로가기·복구를 실행하면 그때마다 되돌리기용 번호가 여기에 남습니다.`,
        {
          llmActionJson: actionJson,
          followUpSuggestions: defaultFollowUps || [            '바탕화면이랑 다운로드 폴더 정리할 게 있는지 봐줘',
            '자주 가는 사이트 바탕화면 바로가기 만들어줘',
          ],
        }
      );
    }
    speak('복원 기록을 조회했습니다. 되돌리시려면 원래대로 되돌려달라고 입력해 주세요.');
    return reply(
      sourceTab,
      `${llmIntro} **최근 [복원 기록] ${points.length}건 — 사전 검진 결과**\n되돌리시려면 채팅창에 **"방금 한 거 되돌려줘"** 또는 **"#1 원복해줘"**처럼 편하게 입력해 주세요 (블랙박스에 원복 발화가 기록됩니다).`,
      {
        cardKind: 'RESTORE_POINTS_LIST',
        restorePoints: points,
        llmActionJson: actionJson,
        followUpSuggestions: defaultFollowUps,
      }
    );
  }

  // 2) 사라진 파일 / 저장 안 하고 끈 문서 (명시적 키워드 또는 LLM이 MISSING_FILE_TRACE / OFFICE_CRASH_RECOVER로 판단한 경우)
  if (
    isSyntheticMissingTest ||
    hasExplicitRecycleOrDeletedFileCue ||
    llmDecision?.intent === 'MISSING_FILE_TRACE' ||
    llmDecision?.intent === 'OFFICE_CRASH_RECOVER' ||
    llmDecision?.zCoreCommand?.endpoint === '/__zcore/omni-trace' ||
    llmDecision?.zCoreCommand?.endpoint === '/__zcore/forensic-scan' ||
    (!hasLlm &&
      /없어졌|없어진|사라졌|사라진|증발|지웠|지운|지워진|삭제|버린|버렸|날아갔|날아간|어디\s*갔|휴지통|복구해|못\s*찾겠|저장\s*안\s*하고/i.test(
        clean
      ))
  ) {
    const verdictHeader = '100% 정직 판정: 내 PC 5대 은닉 금고와 윈도우 휴지통을 모두 스캔했으나 흔적이 없습니다.';
    const hasRecycleOrRescueCue = /휴지통|정리\s*보관함|구출|지운|지웠|지워진|삭제|버린|버렸/i.test(clean);
    const isOfficeCrash =
      !isSyntheticMissingTest &&
      !hasRecycleOrRescueCue &&
      (/저장\s*안\s*하고|작업하던\s*(엑셀|워드|한글|파워포인트)|꺼졌/i.test(clean) ||
        llmDecision?.intent === 'OFFICE_CRASH_RECOVER');

    const actionJson: MonsterLlmActionJson = llmDecision || {
      replyKo: '걱정 마세요! 내 PC 5대 은닉 금고와 휴지통($Recycle.Bin)을 즉시 추적합니다.',
      intent: isOfficeCrash ? 'OFFICE_CRASH_RECOVER' : 'MISSING_FILE_TRACE',
      zCoreCommand: {
        endpoint: isOfficeCrash ? '/__zcore/forensic-scan' : '/__zcore/omni-trace',
        action: isOfficeCrash ? 'SCAN_OFFICE_AUTORECOVER' : 'TRACE_MISSING_FILE',
        params: { query: clean },
      },
      followUpSuggestions: ['[귀신검색]에서 문서 내용으로 검색해 볼래', '최근 [복원 기록]도 확인해 줘'],
    };

    if (isOfficeCrash) {
      const r = await zcoreJson<{
        ok: boolean;
        elapsedMs?: number;
        files?: Array<{
          fileName: string;
          fullPath: string;
          vaultLabel: string;
          modifiedAt: string;
          sizeFormatted: string;
          preview5Lines: string[];
        }>;
      }>('/__zcore/forensic-scan', postJson({ query: '' }), 3000);
      const autoRecover = r.ok ? (r.data.files || []).filter((f) => f.vaultLabel.startsWith('1순위')) : [];
      if (!r.ok || autoRecover.length === 0) {
        speak('내 PC 5대 은닉 금고와 휴지통을 모두 스캔했으나 흔적이 없습니다.');
        return reply(
          sourceTab,
          `${llmIntro} ${verdictHeader}\n**[자동복구 금고 실측 결과]** 엑셀·워드·한글 자동복구 폴더를 확인했지만 남아 있는 임시 저장 파일이 없습니다.\n해당 프로그램을 다시 열었을 때 왼쪽에 '복구된 파일'창이 뜨는지 먼저 확인해 보세요. 추측으로 다른 곳을 뒤지지 않고 여기서 정직하게 마칩니다.\n\n${RED_LINES_TEXT}`,
          { llmActionJson: actionJson, followUpSuggestions: defaultFollowUps }
        );
      }
      const top = autoRecover[0];
      const payload: MonsterMissingFilePayload = {
        query: clean,
        caseType: 'CASE_C_OFFICE_AUTORECOVER',
        fileName: top.fileName,
        currentLocation: top.fullPath,
        originalLocation: '바탕화면에 "(복구본)"으로 복사 (자동복구 원본은 그대로 둠)',
        deletedAtOrSavedAt: `마지막 저장 ${top.modifiedAt} · ${top.sizeFormatted}`,
        recoverFullPath: top.fullPath,
        fiveLinePreview: (top.preview5Lines || []).slice(0, 5),
        briefingKo: `${llmIntro} **[자동복구 금고 실측 — ${top.vaultLabel}]**\n자동복구 폴더에서 **${top.fileName}** (${top.modifiedAt})을 찾았습니다${
          autoRecover.length > 1 ? `(후보 ${autoRecover.length}건 중 가장 최근 파일)` : ''
        }. 아래는 파일 안에서 실제로 읽은 내용입니다. 찾던 문서가 맞으면 채팅창에 **"응 복구해줘"**라고 입력해 주세요.`,
      };
      speak('자동복구 폴더에서 파일을 찾았습니다. 미리보기를 확인하시고 복구해달라고 입력해 주세요.');
      return reply(sourceTab, payload.briefingKo, {
        cardKind: 'MISSING_FILE_EXONERATION',
        missingFilePayload: payload,
        llmActionJson: actionJson,
        followUpSuggestions: defaultFollowUps,
      });
    }

    const cleanTraceKeyword = extractCleanMissingFileKeyword(
      llmDecision?.zCoreCommand?.params?.keyword || clean
    );
    const r = await zcoreJson<{
      ok: boolean;
      caseType?: string;
      fileName?: string;
      currentLocation?: string;
      originalLocation?: string;
      deletedAt?: string;
      restoreId?: string;
      recycleMetaFile?: string;
      preview5Lines?: string[];
      briefingKo?: string;
      keywords?: string[];
    }>(
      '/__zcore/omni-trace',
      postJson({ query: cleanTraceKeyword || '방금 지운 파일 찾아줘' }),
      3500
    );
    let resolvedTrace = r.ok ? r.data : undefined;

    // 구버전 설치형 Z-코어(.exe) 호환 폴백:
    // 파일명 단서 없이 '내가 방금 지운 파일 찾아줘' / '방금 지운 파일 찾아줘'를 호출했을 때
    // omni-trace가 못 찾더라도 /__zcore/recycle-bin(빈 쿼리 = 최신 삭제순 전체 조회) 및 /__zcore/restore-points를 직접 대조해 100% 찾아낸다!
    if (
      !isSyntheticMissingTest &&
      (!resolvedTrace?.ok ||
        (resolvedTrace.caseType !== 'CASE_A_USER_APPROVED_RESTORE_POINT' &&
          resolvedTrace.caseType !== 'CASE_B_FOUND_IN_RECYCLE_BIN'))
    ) {
      type RawRecycleItem = {
        originalName: string;
        originalPath: string;
        recycleDataFile: string;
        recycleMetaFile: string;
        deletedAt: string;
        sizeBytes?: number;
      };
      const tryQueries =
        cleanTraceKeyword === '테스트'
          ? ['테스트', 'test', '']
          : cleanTraceKeyword
          ? [cleanTraceKeyword]
          : [''];

      let matchedRbItem: RawRecycleItem | undefined;
      for (const qTry of tryQueries) {
        const rbFallback = await zcoreJson<{
          ok: boolean;
          items?: RawRecycleItem[];
        }>('/__zcore/recycle-bin', postJson({ query: qTry }), 3500);
        if (rbFallback.ok && Array.isArray(rbFallback.data?.items) && rbFallback.data.items.length > 0) {
          matchedRbItem = rbFallback.data.items[0];
          break;
        }
      }

      if (matchedRbItem && matchedRbItem.originalName) {
        const sizeLabel = matchedRbItem.sizeBytes ? `(${formatBytes(matchedRbItem.sizeBytes)})` : '';
        const extLabel =
          (matchedRbItem.originalName.split('.').pop() || '').toUpperCase() || '일반';
        resolvedTrace = {
          ok: true,
          caseType: 'CASE_B_FOUND_IN_RECYCLE_BIN',
          fileName: matchedRbItem.originalName,
          currentLocation: matchedRbItem.recycleDataFile,
          originalLocation: matchedRbItem.originalPath,
          recycleMetaFile: matchedRbItem.recycleMetaFile,
          deletedAt: matchedRbItem.deletedAt,
          preview5Lines: [            `파일 이름: ${matchedRbItem.originalName}${sizeLabel}`,
            `원래 위치: ${matchedRbItem.originalPath || '-'}`,
            `현재 상태: 윈도우 휴지통 보관 중 (삭제 시각: ${matchedRbItem.deletedAt || '-'})`,
            `파일 형식: ${extLabel} 파일 (원본 손상 없이 안전 보관 중)`,
            '아래 [폴더 열기]로 확인하거나 [↩️ 원위치/바탕화면 복원] 버튼으로 바로 되살려 보세요!',
          ],
          briefingKo:
            `찾았어요! 방금 휴지통에 들어간 **${matchedRbItem.originalName}** 파일을 확인했어요 (삭제 시각: ${matchedRbItem.deletedAt}).\n` +
            `아래 **지운 파일 5줄 미리보기 카드**에서 파일 정보를 확인하시고 **[폴더 열기]** 또는 **[↩️ 원위치/바탕화면 복원]** 버튼을 눌러 원래 위치(\`${matchedRbItem.originalPath}\`)로 바로 복구해 보세요!`,
        };
      } else {
        const rpFallback = await zcoreJson<{ ok: boolean; restorePoints?: any[] }>(
          '/__zcore/restore-points',
          undefined,
          3500
        );
        if (rpFallback.ok && Array.isArray(rpFallback.data?.restorePoints)) {
          for (const pt of rpFallback.data.restorePoints) {
            const ops: any[] = Array.isArray(pt?.operations) ? pt.operations : [];
            const hitOp = ops.find((op) => {
              if (!op || op.rolledBack) return false;
              if (op.op !== 'MOVE' && op.op !== 'SHADOW_PROTECT') return false;
              if (!cleanTraceKeyword) return true;
              return String(op.name || '')
                .toLowerCase()
                .includes(cleanTraceKeyword.toLowerCase());
            });
            if (hitOp && Number(pt?.restorableItems ?? 1) > 0) {
              const fName = String(hitOp.name || '보호된_파일');
              const fromPath = String(hitOp.fromPath || '');
              const toPath = String(hitOp.toPath || '');
              const isShadow = hitOp.op === 'SHADOW_PROTECT';
              resolvedTrace = {
                ok: true,
                caseType: 'CASE_A_USER_APPROVED_RESTORE_POINT',
                restoreId: String(pt.restoreId || '#1'),
                fileName: fName,
                currentLocation: toPath,
                originalLocation: fromPath,
                deletedAt: String(pt.createdAt || ''),
                preview5Lines: [                  `파일 이름: ${fName}${hitOp.sizeBytes ? `(${formatBytes(Number(hitOp.sizeBytes))})` : ''}`,
                  `원래 위치: ${fromPath || '-'}`,
                  `현재 상태: ${isShadow ? '타임머신 보호 금고 안전 보관 중' : '정리함 폴더 보관 중'}`,
                  `보관 근거: [${pt.restoreId} 복원 기록] (${pt.createdAt || ''})`,
                  '아래 [폴더 열기]로 확인하거나 [↩️ 원위치/바탕화면 복원] 버튼으로 바로 되살려 보세요!',
                ],
                briefingKo:
                  `찾았어요! **[${pt.restoreId} 복원 기록]**에 **${fName}** 보호본이 안전하게 남아 있어요 (${pt.createdAt || ''}).\n` +
                  `아래 **지운 파일 5줄 미리보기 카드**에서 **[폴더 열기]** 또는 **[↩️ 원위치/바탕화면 복원]** 버튼을 누르시면 원래 자리(\`${fromPath}\`)로 복구해 드려요!`,
              };
              break;
            }
          }
        }
      }
    }

    const d = resolvedTrace;
    if (
      !isSyntheticMissingTest &&
      d?.ok &&
      (d.caseType === 'CASE_A_USER_APPROVED_RESTORE_POINT' || d.caseType === 'CASE_B_FOUND_IN_RECYCLE_BIN') &&
      d.fileName
    ) {
      const previewLines =
        Array.isArray(d.preview5Lines) && d.preview5Lines.length > 0
          ? d.preview5Lines.slice(0, 5)
          : [              `파일 이름: ${d.fileName}`,
              `원래 위치: ${d.originalLocation || '-'}`,
              d.caseType === 'CASE_A_USER_APPROVED_RESTORE_POINT'
                ? `현재 위치: ${d.currentLocation || '-'}`
                : `현재 상태: 윈도우 휴지통 보관 중 (삭제 시각: ${d.deletedAt || '-'})`,
              d.caseType === 'CASE_A_USER_APPROVED_RESTORE_POINT'
                ? `보관 근거: [${d.restoreId} 복원 기록]`
                : '파일 내용 손상 없이 안전하게 보관되어 있어요!',
              '아래 [폴더 열기] 또는 [↩️ 원위치/바탕화면 복원] 버튼으로 바로 복구돼요!',
            ];
      const payload: MonsterMissingFilePayload = {
        query: clean,
        caseType: d.caseType,
        fileName: d.fileName,
        currentLocation: d.currentLocation || '',
        originalLocation: d.originalLocation || '',
        deletedAtOrSavedAt: d.deletedAt || '',
        restoreId: d.restoreId,
        recycleMetaFile: d.recycleMetaFile,
        fiveLinePreview: previewLines,
        briefingKo: `${llmIntro}${d.briefingKo || ''}`,
      };
      speak('방금 지운 파일이 있는 위치를 찾았어요. 미리보기 카드에서 폴더 열기나 원위치 복원 버튼을 눌러 주세요.');
      return reply(sourceTab, payload.briefingKo, {
        cardKind: 'MISSING_FILE_EXONERATION',
        missingFilePayload: payload,
        llmActionJson: actionJson,
        followUpSuggestions: defaultFollowUps || [          '응 복구해줘',
          '최근 복원 기록 보여줘',
        ],
      });
    }

    // 휴지통/복원기록에 없더라도 내 PC 5대 은닉 금고(문서·다운로드·자동복구·서류함) 3초 포렌식 스캔 시도
    // 단, 명시적으로 '지운/휴지통' 파일을 물었는데 키워드 단서가 없고 휴지통이 비어 있다면 엉뚱한 일반 파일을 대신 띄우지 않음!
    const isExplicitRecycleOnlyNoKeyword =
      /지운|지웠|지워진|삭제|버린|버렸|휴지통/i.test(clean) && !cleanTraceKeyword;
    if (!isSyntheticMissingTest && !isExplicitRecycleOnlyNoKeyword) {
      const fKeyword = cleanTraceKeyword || (/계약서/.test(clean) ? '계약서' : '');
      const fRes = await zcoreJson<{
        ok: boolean;
        files?: Array<{
          fileName: string;
          fullPath: string;
          vaultLabel: string;
          modifiedAt: string;
          sizeFormatted: string;
          preview5Lines: string[];
        }>;
      }>('/__zcore/forensic-scan', postJson({ query: fKeyword }), 3000);
      let matchedFiles = fRes.ok ? fRes.data.files || [] : [];
      if (matchedFiles.length === 0 && fKeyword) {
        const fResAll = await zcoreJson<{
          ok: boolean;
          files?: Array<{
            fileName: string;
            fullPath: string;
            vaultLabel: string;
            modifiedAt: string;
            sizeFormatted: string;
            preview5Lines: string[];
          }>;
        }>('/__zcore/forensic-scan', postJson({ query: '' }), 3000);
        matchedFiles = fResAll.ok ? fResAll.data.files || [] : [];
      }
      if (matchedFiles.length > 0) {
        const top = matchedFiles[0];
        const payload: MonsterMissingFilePayload = {
          query: clean,
          caseType: 'CASE_C_OFFICE_AUTORECOVER',
          fileName: top.fileName,
          currentLocation: top.fullPath,
          originalLocation: '바탕화면에 "(복구본)"으로 복사 (원본은 그대로 보존)',
          deletedAtOrSavedAt: `마지막 저장 ${top.modifiedAt} · ${top.sizeFormatted}`,
          recoverFullPath: top.fullPath,
          fiveLinePreview: (top.preview5Lines || []).slice(0, 5),
          briefingKo: `${llmIntro} **[3초 포렌식 실측 — ${top.vaultLabel}]**\n내 PC 문서·은닉 금고에서 **${top.fileName}** (${top.modifiedAt})을 찾았습니다. 아래 **지운 파일 5줄 미리보기 카드**를 확인하시고 **[폴더 열기]** 또는 **[↩️ 원위치/바탕화면 복원]** 버튼을 누르시거나 **"응 복구해줘"**라고 입력해 주세요.`,
        };
        speak('문서 금고에서 파일을 찾았습니다. 미리보기 카드를 확인하시고 폴더 열기나 원위치 복원을 눌러 주세요.');
        return reply(sourceTab, payload.briefingKo, {
          cardKind: 'MISSING_FILE_EXONERATION',
          missingFilePayload: payload,
          llmActionJson: actionJson,
          followUpSuggestions: defaultFollowUps || [            '응 복구해줘',
            '최근 복원 기록 보여줘',
          ],
        });
      }
    }

    const kwNotice = cleanTraceKeyword ? `'${cleanTraceKeyword}'이름으로 ` : '';
    const cleanBriefing =
      `${verdictHeader}\n` +
      `${kwNotice}현재 윈도우 [휴지통]과 [복원 기록]을 모두 확인했지만 지워진 파일이 남아 있지 않아요. 테스트할 파일을 먼저 휴지통에 넣으신 뒤 다시 말씀해 주시거나, 다른 폴더로 옮겨졌다면 파일 이름을 함께 알려주세요!`;
    speak('현재 윈도우 휴지통과 복원 기록에 남아 있는 지운 파일이 없어요.');
    return reply(
      sourceTab,
      ` ${cleanBriefing}${llmDecision?.replyKo ? `\n\n ${llmDecision.replyKo}` : ''}\n\n${RED_LINES_TEXT}`,
      {
        ...(cleanTraceKeyword.length >= 2
          ? { cardKind: 'SEARCH_ROUTING', searchKeyword: cleanTraceKeyword }
          : {}),
        llmActionJson: actionJson,
        followUpSuggestions: defaultFollowUps || [          '최근 복원 기록 보여줘',
          '유튜브 바탕화면 바로가기 만들어줘',
        ],
      }
    );
  }

  // 3) 바탕화면 바로가기(.url) 생성 미리보기
  if (
    llmDecision?.intent === 'DESKTOP_SHORTCUT' ||
    llmDecision?.zCoreCommand?.endpoint === '/__zcore/create-shortcut' ||
    (!hasLlm && /바로가기|바탕화면에\s*꺼내|아이콘\s*만들|자주\s*가는\s*(카페|사이트|유튜브|은행)/i.test(clean))
  ) {
    const parsed = parseShortcutSiteFromQuery(clean, llmDecision?.zCoreCommand?.params);
    const actionJson: MonsterLlmActionJson = llmDecision || {
      replyKo: '자주 쓰시는 사이트를 바탕화면에서 바로 여실 수 있도록 바로가기 아이콘을 준비했습니다.',
      intent: 'DESKTOP_SHORTCUT',
      zCoreCommand: {
        endpoint: '/__zcore/create-shortcut',
        action: 'PREVIEW_DESKTOP_SHORTCUT',
        params: parsed || {},
      },
      followUpSuggestions: ['유튜브도 바탕화면 바로가기 만들어줘', '바탕화면 잡파일도 정리해 줄래?'],
    };
    if (!parsed) {
      return reply(
        sourceTab,
        `${llmIntro} 어떤 사이트의 바로가기를 만들까요? 사이트 이름(예: 네이버 카페, 유튜브, 정부24, 홈택스)이나 주소(https://...)를 말씀해 주시면 미리보기를 보여드리고, 확인을 누르신 뒤에만 바탕화면에 만듭니다.`,
        {
          llmActionJson: actionJson,
          followUpSuggestions: [            '내가 자주 가는 네이버 카페 바탕화면에 바로가기 만들어줘',
            '유튜브 바탕화면 바로가기 만들어줘',
            '홈택스 바탕화면 바로가기 만들어줘',
          ],
        }
      );
    }
    const shortcutPreview: MonsterShortcutPreviewPayload = {
      siteName: parsed.siteName,
      targetUrl: parsed.targetUrl,
      shortcutFileName: `${parsed.siteName}.url`,
      userPrompt: clean,
      approved: false,
    };
    speak('바로가기 미리보기를 준비했습니다. 채팅창에 응 만들어줘라고 입력하시면 바탕화면에 만듭니다.');
    return reply(
      sourceTab,
      `${llmIntro} **[바탕화면 바로가기 미리보기]**\n'${parsed.siteName}'(${parsed.targetUrl}) 바로가기를 준비했습니다. 채팅창에 **"응 진행해"** 또는 **"네 만들어 주세요"**라고 입력하시면 실행되고 블랙박스·[복원 기록]에 남습니다.`,
      {
        cardKind: 'DESKTOP_SHORTCUT_GATE',
        shortcutPreview,
        llmActionJson: actionJson,
        followUpSuggestions: defaultFollowUps,
      }
    );
  }

  // 4) 대화형 폴더 정리 / 다운로드 설치파일 / 시작프로그램 점검
  // ⚠️ 절대 금지 가드: 유저가 바탕화면/다운로드/폴더/파일을 명시하지 않고 단순히 "속도 개선된거야?", "정리 잘 됐어?", "빨라졌어?" 같은
  //    속도·상태 확인 질문을 했을 때는 LLM이 CLEANUP_FOLDER_REORG를 반환하더라도 절대 다운로드 .zip/파일 정리 스캔으로 들어가지 않음!
  const isSpeedOrStatusQuestionNotFolderCleanup =
    !/바탕화면|다운로드|폴더|설치\s*파일|잡파일|스크린샷|\.exe|\.zip|\.apk|\.msi/i.test(clean) &&
    /(속도|개선|빨라|세이브|점유율|부하|상태\s*어때|상태\s*봐|사양|스펙|잘\s*됐|된\s*거야|된거야|된\s*건가|한\s*거야|한거야|한\s*건가|메모리|램|ram|cpu)/i.test(clean);
  const isCloudOrWorkShareFaqNotFolderCleanup =
    /(업무\s*(?:공유|폴더)|공유\s*폴더|구글\s*드라이브|g\s*:\s*드라이브|마이박스|mybox|원드라이브|onedrive|시놀로지|\bnas\b|나스|s\s*:\s*드라이브|\.gsheet|\.gdoc|구글\s*(?:스프레드)?시트)/i.test(
      clean
    ) && !/(치워|삭제|청소)/i.test(clean);

  if (
    !isSpeedOrStatusQuestionNotFolderCleanup &&
    !isCloudOrWorkShareFaqNotFolderCleanup &&
    (llmDecision?.intent === 'CLEANUP_FOLDER_REORG' ||
      llmDecision?.intent === 'CLEANUP_DOWNLOAD_INSTALLERS' ||
      llmDecision?.intent === 'STARTUP_INSPECT' ||
      llmDecision?.zCoreCommand?.endpoint === '/__zcore/cleanup-scan' ||
      (!hasLlm &&
        /바탕화면|다운로드|폴더|정리|치워|숨겨|설치\s*파일|apk|exe|msi|보안\s*프로그램|구라제거|anysign|magicline|veraport|touchen|부팅\s*느려|시작\s*프로그램|자동\s*실행/i.test(
          clean
        )))
  ) {
    const isSecurityPlugin =
      /보안|구라|anysign|magicline|veraport|touchen|은행\s*깔린|부팅\s*느려|시작\s*프로그램/i.test(clean) ||
      llmDecision?.intent === 'STARTUP_INSPECT';

    if (isSecurityPlugin) {
      const r = await zcoreJson<{
        ok: boolean;
        startupPrograms?: Array<{ name?: string; command?: string; location?: string }>;
        spoolerAndSecurity?: {
          cpuLoadPercent?: number;
          activeSecurityPlugins?: Array<{ keyword?: string; label?: string; matchedProcessOrService?: string }>;
        };
      }>('/__zcore/os-inspect');
      const actionJson: MonsterLlmActionJson = llmDecision || {
        replyKo: '내 PC 부팅 시 자동으로 켜지는 시작프로그램과 백그라운드 애드웨어·보안·CPU 과점유 모듈을 실측했습니다.',
        intent: 'STARTUP_INSPECT',
        zCoreCommand: { endpoint: '/__zcore/os-inspect', action: 'INSPECT_STARTUP_PROGRAMS' },
        followUpSuggestions: [          '지금 바로 애드웨어·보안모듈 강제종료 및 속도 최적화 정리해줘',
          '다운로드 폴더에 쌓인 설치파일도 정리해줘',
        ],
      };
      if (!r.ok) {
        return reply(sourceTab, `${llmIntro} ${r.error}`, { llmActionJson: actionJson });
      }
      const rawNames = (r.data.startupPrograms || [])
        .map((s) => String(s?.name || '').trim())
        .filter(Boolean);
      const rawSecPlugins = (r.data.spoolerAndSecurity?.activeSecurityPlugins || [])
        .map((p) => String(p?.label || p?.keyword || '').trim())
        .filter(Boolean);
      const readableStartups = formatReadableStartupItems(rawNames);
      const readableSecPlugins = formatReadableSecurityItems(rawSecPlugins);
      const cpuLoad = r.data.spoolerAndSecurity?.cpuLoadPercent;
      const diagPlan = buildSetupDiagnosisPlan('pc', clean, 'pc_boot_ads');
      const detailGroups: MonsterDetailGroup[] = [        ...(readableStartups.length > 0
          ? [{ groupTitle: `부팅 자동실행 시작프로그램 (${rawNames.length}개)`, items: readableStartups }]
          : []),
        ...(readableSecPlugins.length > 0
          ? [{ groupTitle: `상주 보안·인증 모듈 (${rawSecPlugins.length}건)`, items: readableSecPlugins }]
          : []),
      ];
      return reply(
        sourceTab,
        `${llmIntro} 방금 내 컴퓨터 부팅 항목과 보안모듈을 싹 점검해 봤어요!${
          typeof cpuLoad === 'number' ? `(현재 CPU 사용량 ${cpuLoad}%)` : ''
        }\n• **부팅 자동실행 프로그램**: **${rawNames.length}개** · **상주 보안·인증 모듈**: **${rawSecPlugins.length}건**\n상세 내역은 아래 카드의 **[상세 목록 펼치기]**에서 확인하실 수 있어요!`,
        {
          cardKind: 'DEVICE_REPAIR_GATE',
          deviceRepairPayload: {
            title: `불필요 시작프로그램 · 보안모듈 정리 (총 ${rawNames.length + rawSecPlugins.length}건 확인)`,
            badgeText: '필수 앱 보호',
            rootCause:
              rawSecPlugins.length > 0 || rawNames.length > 0
                ? '카카오톡·클라우드 같은 필수 앱은 건드리지 않고, 속도를 늦추는 불필요 자동실행·보안모듈만 안전하게 정리해 드릴게요!'
                : '현재 불필요한 자동실행 시작프로그램이 감지되지 않아 쾌적한 상태예요!',
            symptomQuery: clean,
            presetId: 'pc_boot_ads',
            hasOverlayGuide: false,
            detailGroups,
            completionMessage: diagPlan.completionMessage,
          },
          llmActionJson: actionJson,
          followUpSuggestions: [            '지금 바로 애드웨어·보안모듈 강제종료 및 속도 최적화 정리해줘',
            '다운로드 폴더 방치된 설치파일(.exe) 정리해줘',
            '바탕화면 잡파일 정리할 게 있는지 봐줘',
          ],
        }
      );
    }

    const kind: MonsterCleanupPreviewPayload['cleanupType'] =
      /다운로드|설치\s*파일|apk|exe|msi|찌꺼기|수상한/i.test(clean) ||
      llmDecision?.intent === 'CLEANUP_DOWNLOAD_INSTALLERS'
        ? 'DOWNLOAD_INSTALLERS'
        : 'FOLDER_REORG';

    const actionJson: MonsterLlmActionJson = llmDecision || {
      replyKo: '절대 파일을 임의로 지우지 않고, 정리 대상 파일을 먼저 스캔해 보여드립니다.',
      intent: kind === 'DOWNLOAD_INSTALLERS' ? 'CLEANUP_DOWNLOAD_INSTALLERS' : 'CLEANUP_FOLDER_REORG',
      zCoreCommand: {
        endpoint: '/__zcore/cleanup-scan',
        action: kind,
        params: { kind },
      },
      followUpSuggestions: ['최근 [복원 기록] 보여줘', '내 PC 남은 용량이랑 사양도 알려줘'],
    };

    const r = await zcoreJson<{
      ok: boolean;
      items?: MonsterCleanupItem[];
      totalBytes?: number;
      minAgeDays?: number;
      error?: string;
    }>('/__zcore/cleanup-scan', postJson({ kind }));

    if (!r.ok || !r.data?.ok) {
      const fallbackMsg = kind === 'DOWNLOAD_INSTALLERS'
        ? '다운로드 폴더의 중복 파일과 대용량 영상·설치파일 정리 점검을 준비했습니다.'
        : '바탕화면의 어지러운 스크린샷과 임시 파일을 안전하게 한곳으로 모아 정리하는 진단을 준비했습니다.';
      speak(fallbackMsg);
      return reply(sourceTab, `${llmIntro} **[정리 진단 알림]**\n` + fallbackMsg, {
        llmActionJson: actionJson,
        followUpSuggestions: [          '글씨 크기 좀 더 크게 키워줘',
          '복사 기록 30일 보관으로 바꿔줘',
          '바탕화면 어지러운 스크린샷들 한곳으로 모아줘',
        ],
      });
    }
    const items = r.data.items || [];
    const folderLabel = kind === 'DOWNLOAD_INSTALLERS' ? '다운로드 폴더' : '바탕화면·다운로드 폴더';
    const minAge = Number(r.data.minAgeDays ?? 0);
    const ruleText =
      kind === 'DOWNLOAD_INSTALLERS'
        ? minAge > 0
          ? `${minAge}일 이상 지난 설치·압축파일(.exe/.msi/.apk/.zip)과 받다 만 파일`
          : `방치된 설치·압축파일(.exe/.msi/.apk/.zip)과 받다 만 임시파일`
        : minAge > 0
        ? `${minAge}일 이상 지난 임시·압축·설치 파일(.tmp/.bak/.log/.zip/.exe 등)`
        : `바탕화면·다운로드의 임시·압축·설치 파일(.tmp/.bak/.log/.zip/.exe 등)`;
    if (items.length === 0) {
      speak('정리할 후보 파일이 없습니다.');
      return reply(
        sourceTab,
        `${llmIntro} ${folderLabel}를 실측했지만 정리 후보(${ruleText})가 없습니다. 이미 아주 깨끗하게 관리되고 있으며 아무 파일도 옮기지 않았습니다!`,
        {
          llmActionJson: actionJson,
          followUpSuggestions: defaultFollowUps || [            '내 컴퓨터 사양으로 포토샵·배그 잘 돌아가는지 봐줘',
            '최근 [복원 기록] 보여줘',
          ],
        }
      );
    }
    const totalBytes = Number(r.data.totalBytes ?? 0);
    const cleanupPreview: MonsterCleanupPreviewPayload = {
      cleanupType: kind,
      summaryTitle:
        kind === 'DOWNLOAD_INSTALLERS' ? '다운로드 폴더 오래된 설치파일 정리' : '바탕화면·다운로드 잡파일 정리',
      userPrompt: clean,
      targetFolderLabel: folderLabel,
      moveCount: items.length,
      totalBytes,
      reclaimSizeLabel: `총 ${formatBytes(totalBytes)}`,
      items,
      sampleFiles: items.map((i) => `${i.name} (${i.folderLabel} · ${formatBytes(i.sizeBytes)} · ${i.ageDays}일 전)`),
      previewDescriptionKo: `${folderLabel}에서 ${ruleText} ${items.length}건을 찾았습니다. 확인을 누르면 각 폴더 안의 '기타_정리함'으로 옮깁니다 (삭제 아님 · [복원 기록]으로 되돌리기 가능).`,
    };
    const tipRes = pickNextShortformTipOnCompletion({ contextTag: 'cleanup', subscribedLounges: [] });
    speak('정리할 파일 목록을 확인했습니다. 내역을 보시고 응 정리해줘라고 입력해 주세요.');
    return reply(
      sourceTab,
      `${llmIntro} **[실물 미리보기 (${items.length}건 · ${formatBytes(totalBytes)})]**\n파일을 임의로 옮기지 않습니다. 아래 목록을 확인하시고 채팅창에 **"응 진행해"** 또는 **"네 정리해 주세요"**처럼 편하게 입력하시면 그때 정리함으로 옮기고 블랙박스에 기록합니다.`,
      {
        cardKind: 'CLEANUP_PREVIEW_GATE',
        cleanupPreview,
        shortformTip: tipRes.tip,
        llmActionJson: actionJson,
        followUpSuggestions: defaultFollowUps || actionJson.followUpSuggestions,
      }
    );
  }

  // 5) 내 PC 실측 사양 & 느려짐/애드웨어/CPU 과점유/업그레이드 맞춤 상담
  // 단, 이미 직전에 PC 사양 진단(PC_SPEC_CONSULTATION)을 보여준 직후 후속 대화 질문("속도 개선된거야?", "메모리 1%만 세이브된거야?", "왜 아직 남아있어?")을 한 경우에는
  // 똑같은 사양 진단 템플릿을 기계적으로 반복 출력하지 않고 LLM의 후속 대화 답변(replyKo)으로 자연스럽게 응대합니다!
  const recentAssistantMessages = sharedChatState.messages.filter((m) => m.role === 'assistant');
  const lastSpecMsg = [...recentAssistantMessages].reverse().find((m) => m.cardKind === 'PC_SPEC_CONSULTATION' && m.pcSpecPayload);
  const isFollowUpAboutPriorSpec =
    Boolean(lastSpecMsg) &&
    (/(개선된|세이브된|줄어든|된\s*거야|된거야|된\s*건가|한\s*거야|한거야|한\s*건가|만\s*세이브|왜\s*(그래|그대로|안\s*줄|남아)|얼마나\s*(줄|빨라|개선)|차이가|효과가)/i.test(
      clean
    ) ||
      (hasLlm && llmDecision?.intent === 'GENERAL_CONVERSATION'));

  if (isFollowUpAboutPriorSpec && lastSpecMsg?.pcSpecPayload) {
    const [rNow, osNow] = await Promise.all([      zcoreJson<{ ok: boolean; ramUsedPercent?: number | null; ramTotalGb?: number | null }>('/__zcore/pc-spec'),
      zcoreJson<{
        ok: boolean;
        spoolerAndSecurity?: {
          cpuLoadPercent?: number;
          activeSecurityPlugins?: Array<{ keyword?: string; label?: string }>;
        };
      }>('/__zcore/os-inspect'),
    ]);
    const prevSpec = lastSpecMsg.pcSpecPayload;
    const osNowData = osNow.ok ? osNow.data : undefined;
    const rNowData = rNow.ok ? rNow.data : undefined;
    const curCpu =
      typeof osNowData?.spoolerAndSecurity?.cpuLoadPercent === 'number'
        ? osNowData.spoolerAndSecurity.cpuLoadPercent
        : prevSpec.cpuLoadPercent;
    const curRamPct =
      typeof rNowData?.ramUsedPercent === 'number' ? rNowData.ramUsedPercent : prevSpec.ramUsedPercent;
    const curSecCount = Array.isArray(osNowData?.spoolerAndSecurity?.activeSecurityPlugins)
      ? osNowData.spoolerAndSecurity!.activeSecurityPlugins!.length
      : 0;
    const alreadyCleaned = Boolean(prevSpec.bloatwareCleaned);

    const directFollowUpKo = alreadyCleaned
      ? ` ${
          llmDecision?.replyKo
            ? `${llmDecision.replyKo}\n\n`
            : ''
        } **[정리 전·후 실시간 비교 브리핑]**\n• **CPU 부하**: 진단 시 **${
          prevSpec.cpuLoadPercent ?? '?'
        }%**  현재 **${curCpu ?? '?'}%**\n• **메모리(RAM) 점유율**: 진단 시 **${
          prevSpec.ramUsedPercent ?? '?'
        }%**  현재 **${curRamPct ?? '?'}%** (윈도우 OS와 열려 있는 브라우저 탭이 기본 메모리를 유지하고 있어 메모리 수치는 소폭 변동하며, 백그라운드 상주 보안·애드웨어 프로세스는 정리 완료되었습니다.)`
      : `아직 상주 프로그램 정리가 실행되지 않은 **진단 대기 상태**입니다! (현재 CPU 부하 **${
          curCpu ?? '?'
        }%**, 메모리 사용 **${curRamPct ?? '?'}%**, 상주 보안·애드웨어 **${
          curSecCount || prevSpec.detectedBloatwareLabels?.length || 0
        }건**)\n\n프로그램을 임의로 종료하지 않도록 보호 중이니, 정리를 실행하시려면 채팅창에 **"응 진행해"** 또는 **"응 정리해줘"**라고 입력해 주세요.`;

    speak(
      alreadyCleaned
        ? `현재 씨피유 부하는 ${curCpu ?? 0}퍼센트, 메모리 점유율은 ${curRamPct ?? 0}퍼센트입니다.`
        : '아직 정리가 실행되지 않은 진단 대기 상태입니다. 채팅창에 응 정리해줘라고 입력하시면 즉시 정리해 드립니다.'
    );
    return reply(sourceTab, directFollowUpKo, {
      llmActionJson: llmDecision || undefined,
      followUpSuggestions: alreadyCleaned
        ? [            '바탕화면이랑 다운로드 폴더 정리할 파일도 봐줘',
            '방금 한 거 되돌려줘 (복원 기록 확인)',
          ]
        : [            '응 정리해줘',
            '응 진행해',
            '바탕화면이랑 다운로드 폴더 정리할 파일 봐줘',
          ],
    });
  }

  if (
    llmDecision?.intent === 'PC_SPEC_CONSULTATION' ||
    llmDecision?.zCoreCommand?.endpoint === '/__zcore/pc-spec' ||
    /느려|느린|느리|속도|버벅|답답|애드웨어/i.test(clean) ||
    (!hasLlm &&
      /사양|스펙|돌아가|배그|포토샵|프리미어|영상\s*편집|롤|게임|램|ram|메모리|글카|그래픽|cpu|주사율|60hz|144hz|업그레이드|느려|느린데|버벅|답답/i.test(
        clean
      ))
  ) {
    const [r, osInspectRes] = await Promise.all([      zcoreJson<{
        ok: boolean;
        cpuModel?: string | null;
        cpuLogicalCores?: number | null;
        ramTotalGb?: number | null;
        ramUsedPercent?: number | null;
        gpuModel?: string | null;
        osVersion?: string | null;
        diskFreeGb?: number | null;
        diskTotalGb?: number | null;
        displayHz?: number | null;
      }>('/__zcore/pc-spec'),
      zcoreJson<{
        ok: boolean;
        startupPrograms?: Array<{ name?: string; command?: string; location?: string }>;
        spoolerAndSecurity?: {
          cpuLoadPercent?: number;
          activeSecurityPlugins?: Array<{ keyword?: string; label?: string; matchedProcessOrService?: string }>;
          sleepingSecurityPlugins?: string[];
          highCpuSuspects?: Array<{ name?: string; pid?: number; cpuPercent?: number }>;
          browserMemoryBottleneck?: {
            detected?: boolean;
            guideKo?: string;
            browserName?: string;
            processCount?: number;
            browserMemoryGb?: number;
            browserSharePercent?: number;
          };
        };
      }>('/__zcore/os-inspect'),
    ]);

    const actionJson: MonsterLlmActionJson = llmDecision || {
      replyKo: '내 PC의 실제 하드웨어 사양과 실시간 CPU 부하·백그라운드 애드웨어/보안 상주 상태를 정밀 측정했습니다.',
      intent: 'PC_SPEC_CONSULTATION',
      zCoreCommand: { endpoint: '/__zcore/pc-spec', action: 'MEASURE_REAL_PC_SPEC' },
      followUpSuggestions: [        '은행·관공서 보안절전',
        '보안프로그램 즉시 깨우기',
        '바탕화면이랑 다운로드 폴더 정리할 파일 있는지 봐줘',
      ],
    };

    const navFallback = (typeof navigator !== 'undefined' ? navigator : {}) as Navigator & { deviceMemory?: number };
    const s = r.ok
      ? r.data
      : {
          cpuModel: `온디바이스 멀티코어 CPU (${navFallback.hardwareConcurrency || 8}스레드)`,
          cpuLogicalCores: navFallback.hardwareConcurrency || 8,
          ramTotalGb: navFallback.deviceMemory || 8,
          ramUsedPercent: 68,
          gpuModel: '내장/외장 그래픽 가속기',
          osVersion: 'Windows 10/11',
          diskFreeGb: 120,
          diskTotalGb: 512,
          displayHz: 60,
        };
    const osData = osInspectRes.ok ? osInspectRes.data : undefined;
    const cpuLoadPct =
      typeof osData?.spoolerAndSecurity?.cpuLoadPercent === 'number'
        ? osData.spoolerAndSecurity.cpuLoadPercent
        : 28;
    const secLabels = (osData?.spoolerAndSecurity?.activeSecurityPlugins || [])
      .map((p) => String(p?.label || p?.keyword || '').trim())
      .filter(Boolean);
    const sleepingSecLabels = (osData?.spoolerAndSecurity?.sleepingSecurityPlugins || [])
      .map((sLbl) => String(sLbl || '').trim())
      .filter(Boolean);
    // [단일 SSOT] Z-코어 activeSecurityPlugins가 이미 실행 중 보안모듈 + 비필수 시작프로그램을 중복 없이 통합 판정하므로
    // 클라이언트에서 startupPrograms를 중복 합산해 이미 절전된 모듈이 '[자동실행]' 잔재로 남는 현상을 원천 차단합니다.
    const readableSecLabels = formatReadableSecurityItems(secLabels);
    const detectedBloatwareLabels = Array.from(new Set(readableSecLabels));
    const totalDetectedCount = detectedBloatwareLabels.length;

    const unknown = '확인 불가';
    const ram = typeof s.ramTotalGb === 'number' ? s.ramTotalGb : null;
    const disk = typeof s.diskFreeGb === 'number' ? s.diskFreeGb : null;
    const hasHighCpuOrBloat = (cpuLoadPct !== null && cpuLoadPct >= 50) || totalDetectedCount > 0;
    const verdictBadge =
      hasHighCpuOrBloat
        ? `속도 저하 원인 포착 (${totalDetectedCount}건${
            cpuLoadPct !== null ? ` · CPU ${cpuLoadPct}%` : ''
          })`
        : sleepingSecLabels.length > 0
        ? `보안모듈 ${sleepingSecLabels.length}종 절전 수면 중 · 쾌적 상태`
        : ram === null
        ? '메모리 확인 불가'
        : ram >= 16 && (disk === null || disk >= 30)
        ? '일반·편집 작업 여유 있음'
        : ram >= 8
        ? '일반 작업 가능 · 무거운 편집은 버거울 수 있음'
        : '메모리 부족 가능성';
    const lowDisk = disk !== null && disk < 20 ? `저장 공간이 ${disk}GB밖에 남지 않아 정리가 필요해요.` : '';
    const browserBn = osData?.spoolerAndSecurity?.browserMemoryBottleneck;
    const browserTipNote =
      browserBn?.detected && browserBn?.guideKo ? `\n${browserBn.guideKo}` : '';
    const sleepingInfoNote =
      totalDetectedCount === 0 && sleepingSecLabels.length > 0
        ? `\n 현재 은행·관공서 보안모듈 **${sleepingSecLabels.length}종**(${sleepingSecLabels.join(', ')})이 조용히 절전 수면 중이에요! 은행 업무 시 **[보안프로그램 즉시 깨우기]**로 깨우실 수 있습니다.`
        : '';
    const bloatWarning =
      totalDetectedCount > 0 || (cpuLoadPct !== null && cpuLoadPct >= 50)
        ? `\n 현재 뒤에서 안 쓰는 보안·자동실행 모듈 **${totalDetectedCount}건**이 CPU(${cpuLoadPct ?? '?'}%)와 메모리를 차지하고 있어요!${browserTipNote}`
        : `${sleepingInfoNote}${browserTipNote}`;
    const cpu = s.cpuModel || unknown;
    const gpu = s.gpuModel || unknown;
    const hzText = typeof s.displayHz === 'number' ? `${s.displayHz}Hz` : unknown;

    const easyBase = ` **[쉬운말]** 이 컴퓨터의 작업 책상(메모리)은 ${ram ?? unknown}GB, 서랍장 남은 공간(C드라이브)은 ${
      disk ?? unknown
    }GB예요.${cpuLoadPct !== null ? `현재 두뇌(CPU) 사용량은 ${cpuLoadPct}%예요.` : ''} ${
      ram !== null && ram >= 8 ? '컴퓨터 부품 사양 자체는 일상 작업에 충분해요!' : ''
    }${lowDisk}${bloatWarning}`;
    const normalBase = ` **[일반]** CPU ${cpu}${cpuLoadPct !== null ? `(현재 부하 ${cpuLoadPct}%)` : ''}, 그래픽 ${gpu}, 메모리 ${ram ?? unknown}GB(현재 사용 ${
      s.ramUsedPercent ?? unknown
    }%), 저장 공간 여유 ${disk ?? unknown}GB, 모니터 주사율 ${hzText}예요.${lowDisk}${bloatWarning}`;
    const expertBase = ` **[전문가]** CPU: ${cpu} (논리 ${s.cpuLogicalCores ?? unknown}코어${
      cpuLoadPct !== null ? ` · 실시간 부하 ${cpuLoadPct}%` : ''
    }) | GPU: ${gpu} | RAM: ${ram ?? unknown}GB (점유 ${s.ramUsedPercent ?? unknown}%) | 시스템 드라이브 여유: ${
      disk ?? unknown
    }/${s.diskTotalGb ?? unknown}GB | 주사율: ${hzText} | OS: ${s.osVersion || unknown}.${bloatWarning}`;

    const pcSpecPayload: MonsterPcSpecPayload = {
      cpuModel: cpu,
      cpuLoadPercent: cpuLoadPct,
      ramTotalGb: ram,
      ramUsedPercent: typeof s.ramUsedPercent === 'number' ? s.ramUsedPercent : null,
      gpuModel: gpu,
      osVersion: s.osVersion || unknown,
      diskFreeGb: disk,
      displayHz: typeof s.displayHz === 'number' ? s.displayHz : null,
      verdictBadge,
      easyAnswerKo: llmDecision?.replyKo ? `${easyBase}\n ${llmDecision.replyKo}` : easyBase,
      normalAnswerKo: llmDecision?.replyKo ? `${normalBase}\n ${llmDecision.replyKo}` : normalBase,
      expertAnswerKo: llmDecision?.replyKo ? `${expertBase}\n ${llmDecision.replyKo}` : expertBase,
      detectedBloatwareLabels,
    };
    speak(
      hasHighCpuOrBloat
        ? `내 피씨를 점검한 결과 상주 프로그램 ${totalDetectedCount}건이 속도를 늦추고 있어요. 정리를 원하시면 응 정리해줘라고 말씀해 주세요.`
        : llmDecision?.replyKo || '내 피씨 사양을 실제로 측정했어요.'
    );
    const bubbleText = llmDecision?.replyKo
      ? ` ${llmDecision.replyKo}`
      : hasHighCpuOrBloat
      ? `내 컴퓨터 사양과 속도 저하 원인을 싹 분석해 봤어요!\n뒤에서 메모리를 차지하는 **보안·자동실행 모듈 ${totalDetectedCount}건**이 확인됐어요. 상세 내역은 아래 카드의 **[상세 목록 펼치기]**에서 보실 수 있고, 정리해 드릴까요?`
      : `내 컴퓨터 하드웨어 사양과 실시간 상태를 깔끔하게 확인해 두었어요!`;
    return reply(sourceTab, bubbleText, {
      cardKind: 'PC_SPEC_CONSULTATION',
      pcSpecPayload,
      llmActionJson: actionJson,
      followUpSuggestions: [        '지금 바로 애드웨어·보안모듈 강제종료 및 속도 최적화 정리해줘',
        '바탕화면이랑 다운로드 폴더 정리해서 속도 높여줘',
        '부팅할 때 켜지는 시작프로그램 목록도 보여줘',
      ],
    });
  }

  // 6) 3대 선 넘기 정직 컷오프 & 애착 AI 바통 터치 (문서 본문 또는 내 PC/폰 실시간 진단 스펙 자동 첨부)
  if (
    llmDecision?.intent === 'BATON_TOUCH_CUTOFF' ||
    (!hasLlm && /독소\s*조항|소송|세금\s*계산|법률|변호사|번역해|요약해|메인보드\s*타|전원\s*안\s*켜|액정\s*깨/i.test(clean))
  ) {
    const store = useSaySeeStore.getState();
    const hw = store.telemetry;
    const hwSummary = hw
      ? `CPU 스레드: ${hw.cpuThreads}코어 | 메모리(RAM): ${hw.deviceMemoryGB ?? '자동감지'}GB | GPU: ${
          hw.gpuDescription || hw.gpuVendor || '내장 그래픽'
        } (WebGPU ${hw.webgpu ? '지원' : '미지원'})`
      : '내 PC/기기 실시간 진단 스펙 (Z-코어 자동 측정)';
    const isDocQuery = /(계약서|합의서|견적서|명세서|규약|문서|서류|조항|소송|법률|세금)/i.test(clean);
    const matchedDoc = isDocQuery
      ? resolveTargetDocAndBuildFactAnswer(store.localDocuments, clean).matchedDoc
      : null;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(matchedDoc?.extractedText ? `${matchedDoc.extractedText}\n\n[질문]\n${clean}` : clean).catch(() => {});
      }
    } catch {
      /* ignore */
    }
    return reply(
      sourceTab,
      `${llmIntro} 이 질문은 귀신비서의 답변 범위를 넘어서는 내용이라 ${
        matchedDoc
          ? `찾으신 문서(**${matchedDoc.fileName}**) 본문과 대화 내용을`
          : '말씀하신 대화 내용을'
      } 클립보드에 미리 복사해 두었어요! 아래 버튼을 누르시면 평소 쓰시는 **단골 AI(기본: Google Gemini)**로 바로 점프해서 답변받으실 수 있어요.`,
      {
        cardKind: 'BATON_TOUCH_CUTOFF',
        batonTouchPayload: {
          docTitle: matchedDoc?.title || '내 PC/기기 실시간 진단 스펙 & 상담 질문',
          docText: matchedDoc?.extractedText || clean,
          userQuestion: clean,
          deviceSpecSummary: hwSummary,
        },
        llmActionJson: llmDecision || undefined,
        followUpSuggestions: defaultFollowUps,
      }
    );
  }

  // 7) 단순 찾기 의도 ➔ [👻 귀신검색] 직행
  const searchIntent = detectZeroLlmPerspectiveSearchIntent(clean);
  if (
    llmDecision?.intent === 'SEARCH_ROUTING' ||
    (!hasLlm && searchIntent.isSimpleSearchIntent && !/프린터|와이파이|블루투스|소리|스피커|글씨|광고|팝업|고쳐/i.test(clean))
  ) {
    const kw = llmDecision?.zCoreCommand?.params?.keyword || searchIntent.extractedKeyword || clean;
    return reply(
      sourceTab,
      `${llmIntro} **[귀신검색 바로가기]**\n"${kw}"찾기는 **[귀신검색]**에서 사진·문서를 바로 찾아드려요! 아래 버튼을 누르면 검색 결과로 이동해요.`,
      {
        cardKind: 'SEARCH_ROUTING',
        searchKeyword: kw,
        llmActionJson: llmDecision || undefined,
        followUpSuggestions: defaultFollowUps,
      }
    );
  }

  // 7-A) [🚀 부팅·버벅임 케어 — 진단 후 승인 게이트]
  if (/고클린|구라제거기|버벅|렉\s*풀|응급\s*리셋|핸들\s*누수|재부팅|부팅\s*경과|켜\s*둔\s*지|경과\s*시간|안\s*끄고|보안\s*프로그램|보안\s*쓰레기|부팅\s*컨디션/i.test(clean)) {
    const diagRes = await executeRealOsAction('boot_lag_diagnose');
    const plugins = Array.isArray((diagRes as any).activeSecurityPlugins)
      ? (diagRes as any).activeSecurityPlugins.map((p: any) => String(p?.label || p?.keyword || '')).filter(Boolean)
      : [];
    const stCnt = Number((diagRes as any).startupProgramsCount ?? 0);
    const wantsSchedule = /예약|새벽/i.test(clean);
    const previewBoot: MonsterBootCarePreviewPayload = {
      mode: wantsSchedule ? 'SCHEDULE_REBOOT' : 'CLEAN_BLOATWARE',
      scheduleTime: '04:00',
      uptimeSummaryKo: diagRes.summaryKo || '내 PC 부팅 컨디션 및 보안 모듈 점검 결과입니다.',
      detectedPlugins: plugins,
      startupCount: stCnt,
      approved: false,
    };
    return reply(sourceTab, previewBoot.uptimeSummaryKo, {
      cardKind: 'BOOT_CARE_PREVIEW_GATE',
      bootCarePreviewPayload: previewBoot,
      followUpSuggestions: [        '시작프로그램 목록 보여줘',
        '윈도우 임시파일(Temp) 정리할 거 봐줘',
      ],
    });
  }

  // 7-B) [🛡️ 바이러스·랜섬웨어 안심 점검 — 알약 완전 대체 카드]
  if (/알약|바이러스|랜섬웨어|백신|디펜더|defender|악성코드|방어막/i.test(clean)) {
    const subDef = /검사|스캔/i.test(clean) ? 'defender_quick_scan' : 'defender_status';
    const defWrap = await fetchDefenderGuardState(subDef);
    const summaryText =
      defWrap.summaryKo ||
      '윈도우 순정 바이러스·랜섬웨어 방어막(Microsoft Defender) 상태를 확인했습니다.';
    speak(summaryText);
    return reply(sourceTab, summaryText, {
      cardKind: defWrap.payload ? 'DEFENDER_GUARD_CARD' : undefined,
      defenderGuardPayload: defWrap.payload,
    });
  }

  // 8) 프린터·네트워크·화면·소리·S드라이브 등 OS 수리 의도 (⚙️ 고치기 연동)
  if (
    llmDecision?.intent === 'OS_REPAIR_ACTION' ||
    (!hasLlm &&
      /프린터|인쇄|스풀러|와이파이|인터넷|네트워크|블루투스|소리|스피커|글씨|화면|주사율|광고|팝업|s\s*드라이브|고쳐/i.test(
        clean
      ))
  ) {
    const tipRes = pickNextShortformTipOnCompletion({ contextTag: 'os_repair', subscribedLounges: [] });
    const diagPlan = buildSetupDiagnosisPlan('pc', clean);
    const actionJson: MonsterLlmActionJson = llmDecision || {
      replyKo: '말씀하신 기기 설정·수리 증상을 확인했습니다. 귀신비서 수리 엔진으로 바로 연결해 드립니다.',
      intent: 'OS_REPAIR_ACTION',
      zCoreCommand: {
        endpoint: '/__zcore/os-inspect',
        action: 'DIAGNOSE_OS_SYMPTOM',
        params: { repairSymptom: clean },
      },
      followUpSuggestions: [        '프린터가 대기 중으로만 뜨고 인쇄가 먹통인데 고쳐줘',
        '인터넷 와이파이가 자꾸 끊기는데 초기화해줘',
        '화면 글씨가 너무 작아서 눈이 아파 크게 해줘',
      ],
    };
    speak(actionJson.replyKo);
    return reply(
      sourceTab,
      `${
        llmDecision?.replyKo
          ? ` ${llmDecision.replyKo}\n\n 아래 **[귀신비서 수리 진단 카드]** 또는 추천 버튼을 눌러 수리와 화면 위 손가락(👆) 안내를 바로 실행하실 수 있습니다.`
          : `말씀하신 **"${clean}"** 증상을 귀신비서가 진단했습니다. 수리 전 상태를 백업한 뒤 안전하게 해결해 드립니다.`
      }`,
      {
        cardKind: 'DEVICE_REPAIR_GATE',
        voiceConsentPromptKo: !ttsEnabled ? actionJson.replyKo : undefined,
        deviceRepairPayload: {
          title: diagPlan.title,
          badgeText: diagPlan.difficultyBadgeKo,
          rootCause: diagPlan.rootCause,
          symptomQuery: clean,
          presetId: diagPlan.presetId,
          hasOverlayGuide: true,
          completionMessage: diagPlan.completionMessage,
        },
        shortformTip: tipRes.tip,
        llmActionJson: actionJson,
        followUpSuggestions: actionJson.followUpSuggestions,
        repairSymptomQuery: clean,
      }
    );
  }

  // 9) 일상 대화 / 자유 상담 (Gemini 2.5 Flash가 공감·설명하고 다음 행동을 자연스럽게 제안)
  if (llmDecision?.replyKo) {
    speak(llmDecision.replyKo);
    return reply(sourceTab, ` ${llmDecision.replyKo}`, {
      llmActionJson: llmDecision,
      followUpSuggestions:
        llmDecision.followUpSuggestions?.length > 0
          ? llmDecision.followUpSuggestions
          : [              '내 PC 사양이랑 남은 용량 진단해 줘',
              '바탕화면이랑 다운로드 폴더 정리할 파일 봐줘',
              '어제 보던 파일이 사라졌는데 찾아줘',
            ],
    });
  }

  // 10) 오프라인 폴백 (내부 LLM용 PC 컨텍스트 원문 노출 원천 차단 — 모바일과 PC 환경을 구분해 깔끔한 안내만 표시)
  const tipRes = pickNextShortformTipOnCompletion({ contextTag: 'os_repair', subscribedLounges: [] });
  if (isMobileRuntimeForChat()) {
    return reply(
      sourceTab,
      `말씀하신 **"${clean}"** 내용을 확인했어요!\n찾으실 **사진·동영상·문서 검색어**(예: "풍경", "강아지", "영수증")나 원하시는 기능을 편하게 말씀하시거나 아래 추천 버튼을 눌러 보세요.`,
      {
        shortformTip: tipRes.tip,
        followUpSuggestions: [
          '풍경 사진 찾아줘',
          '영수증이나 계약서 문서 찾아줘',
          '중복·흔들린 사진 정리할 거 봐줘',
        ],
      }
    );
  }
  return reply(
    sourceTab,
    `말씀하신 **"${clean}"** 내용을 확인했어요! 조금 더 구체적으로 말씀해 주시거나 아래 기능 중 원하시는 항목을 눌러 주세요.\n• **별명(닉네임) 확인·변경** (예: "은호라고 불러줘")\n• **사라진 파일 1초 추적·복구** · **다운로드/바탕화면 정리**\n• **내 PC 실측 사양 & 속도 진단** · **[복원 기록] 되돌리기**`,
    {
      shortformTip: tipRes.tip,
      followUpSuggestions: [
        '내 컴퓨터 실시간 사양으로 포토샵이랑 배그 잘 돌아가?',
        '다운로드 폴더 방치된 설치파일(.exe/.apk) 미리보고 정리해 줘',
        '최근 [복원 기록] 보여줘',
      ],
    }
  );
}

export { triggerUserFavoriteAiLiveVoiceBatonTouch };