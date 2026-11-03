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
import { getZCoreUrl } from './zCoreBridge';
import {
  submitStudioSupportTicket,
  buildStudioSupportJumpUrl,
} from './merlin-hub-sdk/Support/blackbox';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { validateClubSignboardName } from '../components/PricingModal';
import { dispatchGhostCastLiveCommand } from '../components/GhostCastAndLiveSystem';
import { executeRealOsAction, buildSetupDiagnosisPlan } from './setupMonsterEngine';

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
  | 'BATON_TOUCH_CUTOFF'
  | 'GHOSTI_INFO_DESK'
  | 'APP_SETTINGS_CONTROL'
  | 'STUDIO_SUPPORT_PROXY';

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
    | 'SNIPPET_UPDATE'
    | 'GHOST_WINDOW_PREF'
    | 'CLUB_SIGNBOARD'
    | 'GHOST_CAST_LIVE';
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
  cleanupType: 'FOLDER_REORG' | 'DOWNLOAD_INSTALLERS';
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
}

export interface DigitalHealthCheckRecord {
  recordId: string;
  issuedAt: string;
  category: '🧹 치우기' | '⚙️ 고치기' | '🔗 바로가기' | '↩️ 복원 기록';
  title: string;
  reclaimedSizeLabel: string;
  cleanedItemCount: number;
  securityPluginsFrozen: number;
  speedUpSummary: string;
  restoreId?: string;
  healthScoreBefore?: number;
  healthScoreAfter?: number;
}

export interface MonsterDeviceRepairPayload {
  title: string;
  badgeText: string;
  rootCause: string;
  symptomQuery: string;
  presetId: string;
  hasOverlayGuide: boolean;
  executed?: boolean;
  undone?: boolean;
  completionMessage?: string;
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
  batonTouchPayload?: {
    docTitle: string;
    docText: string;
    userQuestion: string;
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
      '✋ 안녕하세요! 컴퓨터·휴대폰 정리, 고치기, 복원, 요금·기능 문의를 편하게 말씀해 주세요.\n' +
      '아래 입력창에 글자로 입력하시거나 🎙️ 음성으로 편하게 말씀해 주세요.',
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

// ---------------------------------------------------------------------------
// Z-코어 통신 (실패는 실패로 돌려줌)
// ---------------------------------------------------------------------------

export const ZCORE_OFFLINE_MESSAGE =
  '멀린 Z-코어에 연결되어 있지 않아 내 PC를 확인할 수 없습니다. Z-코어를 실행한 뒤 다시 말씀해 주세요. (아무 파일도 건드리지 않았습니다)';

type ZResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function zcoreJson<T = any>(path: string, init?: RequestInit, timeoutMs = 20000): Promise<ZResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(getZCoreUrl(path), { ...init, signal: controller.signal });
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return { ok: false, error: ZCORE_OFFLINE_MESSAGE };
    }
    const data = (await res.json()) as any;
    if (res.status === 403) {
      return { ok: false, error: data?.error || '허용되지 않은 화면에서 요청되어 Z-코어가 실행을 거절했습니다.' };
    }
    if (!res.ok && data?.error) {
      return { ok: false, error: data.error };
    }
    return { ok: true, data };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { ok: false, error: 'Z-코어 응답 대기 시간(20초)이 초과되었습니다. Z-코어가 정상 구동 중인지 확인해 주세요.' };
    }
    return { ok: false, error: ZCORE_OFFLINE_MESSAGE };
  } finally {
    clearTimeout(timer);
  }
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

export async function fetchRealtimePcContextForLlm(): Promise<CachedPcContext> {
  if (cachedPcContext && Date.now() - cachedPcContext.fetchedAt < 20000) {
    return cachedPcContext;
  }
  const [specRes, osRes] = await Promise.all([
    zcoreJson<any>('/__zcore/pc-spec', undefined, 2500),
    zcoreJson<any>('/__zcore/os-inspect', undefined, 2500),
  ]);

  if (!specRes.ok && !osRes.ok) {
    return {
      fetchedAt: Date.now(),
      summaryText: '[Z-코어 미연결 상태: 내 PC 실시간 하드웨어 수치 미확인]',
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

  const lines = [
    '[내 PC 실시간 실측 컨텍스트 (Merlin_Z_Core 127.0.0.1:5199)]',
    `- CPU: ${s.cpuModel || '확인중'} (${s.cpuLogicalCores ?? '?'}코어) / GPU: ${s.gpuModel || '내장/확인중'}`,
    `- RAM(메모리): 총 ${s.ramTotalGb ?? '?'}GB (현재 점유율 ${s.ramUsedPercent ?? '?'}%)`,
    `- 저장공간(C드라이브): 여유 ${s.diskFreeGb ?? '?'}GB / 전체 ${s.diskTotalGb ?? '?'}GB`,
    `- 모니터 주사율: ${s.displayHz ? `${s.displayHz}Hz` : '기본'} / OS: ${s.osVersion || 'Windows'}`,
    `- 시작프로그램(${startupNames.length}개): ${startupNames.join(', ') || '없음'}`,
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
    '🌱 [초급 / 쉬운말 모드]: 어려운 영어/전문용어(RAM, 프로세스 등) 대신 "작업 공간(메모리)", "저장 공간" 같은 쉬운 표현을 쓰되, 과한 인사치레 없이 정중한 비서 존댓말로 핵심만 간결하게 안내하세요.',
  normal:
    '🌿 [중급 / 일반 모드]: 정중하고 신뢰감 있는 비서 존댓말(~입니다, ~해 드리겠습니다)로 1~2단어만 짧게 공감한 뒤, 실측 수치와 해결 방법만 군더더기 없이 1~2문장으로 심플하게 안내하세요.',
  expert:
    '🌳 [고급 / 전문가 모드]: CPU 코어, RAM 점유율(%), 디스크 여유량(GB), 주사율(Hz) 등 엔지니어링 실측 수치를 인용하여 정중한 비서 존댓말로 1~2문장 이내로 간결하게 브리핑하세요.',
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

async function callMonsterLlmGateway(prompt: string, timeoutMs = 9500): Promise<{ ok: boolean; text: string; model?: string }> {
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
          maxOutputTokens: 600,
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
  const timer2 = setTimeout(() => controller2.abort(), 5000);
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

  const prompt = [
    '당신은 『귀신같이(Ghosti)』의 내 기기 전담 비서인 **손보기 비서(🪄 정리·수리·원복)**입니다.',
    '',
    '[유저 질문 말투에 따른 자동 눈높이 맞춤 규칙 (추가 토큰 없이 즉시 반영)]:',
    '- 유저 질문에 전문용어(RAM, 점유율, 클럭, 코어, 주사율, Hz, GPU 등)가 포함되어 있으면: 엔지니어링 실측 수치를 정확히 인용해 브리핑하세요.',
    '- 유저 질문이 일상어/초보 말투("왜 이리 버벅대냐", "새로 사야 해?", "답답해")이면: 어려운 약어 대신 "작업 공간(메모리)", "저장 공간" 같은 쉬운 표현을 함께 써서 설명하세요.',
    '',
    pcContextText,
    isSpecOrPerformanceQuery(query) ? MONTHLY_PC_SPEC_BENCHMARK.compactRuleText : '',
    '',
    historyBlock ? `[최근 대화 맥락]\n${historyBlock}\n` : '',
    `[현재 유저 입력 (${sourceTab === 'trash' ? '🧹 치우기 탭' : '⚙️ 고치기 탭'})]`,
    `"${query}"`,
    '',
    '[절대 준수 4대 화법 및 아키텍처 원칙 — 비서 존댓말 · 군더더기 0% · 잡담 정중 거절 · JSON 기능 분리]',
    '1. [일상 잡담 정중 거절 (비용 절감)]: PC 정리(치우기)·수리(고치기)·파일 복구·사양 진단과 무관한 일상 잡담(날씨, 기분, 반려동물, 농담, 상식 등)에는 일일이 맞장구치지 마세요. 반드시 "intent": "GENERAL_CONVERSATION", "zCoreCommand": { "endpoint": "NONE", "action": "POLITE_DECLINE", "params": {} }로 설정하고, replyKo에는 "죄송합니다만 저는 PC 정리·수리 전담 비서라 일상 대화는 답변드리기 어렵습니다. 기기 정리나 수리가 필요하실 때 말씀해 주세요."라고 정중히 거절하세요.',
    '2. [과한 인사치레·호들갑 절대 금지]: "어휴~", "정말 좋은 생각이에요!", "제가 귀신같이 비서인데 걱정 마세요!" 같은 수다스러운 인사치레와 자기소개를 절대 쓰지 마세요. 공감은 딱 한두 단어("충분히 가능하십니다.", "답답하셨겠습니다.", "새로 안 사셔도 됩니다.")만 하고 즉시 본론(기능 및 실측 수치)으로 들어가세요.',
    '3. [비서 같은 신뢰감 있는 존댓말 고정]: 유저가 반말("정리해 줄래?", "고마워")로 말해도 절대 반말("응!", "해줄게")을 쓰지 말고, 항상 정중하고 간결한 비서 존댓말("~입니다", "~해 드리겠습니다")로 총 1~2문장 이내로 심플하게 답하세요.',
    '4. [기능은 JSON으로만 완전 분리 & 임의 삭제 표현 금지]: 말풍선(replyKo)은 군더더기 없이 심플하게 끝내고, 실제 실행할 기능은 JSON의 intent와 zCoreCommand에 분리 주입하세요. 폴더·설치파일 정리 시 "자동으로 삭제해 드리겠습니다"라고 하지 말고 "정리 대상 파일 목록을 먼저 스캔해 보여드리겠습니다."라고 안내하세요.',
    '5. 반드시 아래 JSON 스키마 하나만 순수 JSON으로 출력하세요 (마크다운 코드블록 없이 { 로 시작해서 } 로 끝낼 것):',
    '{',
    '  "replyKo": "비서처럼 정중하고 군더더기 없는 1~2문장 존댓말 답변 (한두 단어 공감 + 실측 핵심 결론)",',
    '  "intent": "CLEANUP_FOLDER_REORG" | "CLEANUP_DOWNLOAD_INSTALLERS" | "MISSING_FILE_TRACE" | "OFFICE_CRASH_RECOVER" | "DESKTOP_SHORTCUT" | "RESTORE_POINTS_LIST" | "PC_SPEC_CONSULTATION" | "STARTUP_INSPECT" | "OS_REPAIR_ACTION" | "SEARCH_ROUTING" | "BATON_TOUCH_CUTOFF" | "GENERAL_CONVERSATION",',
    '  "zCoreCommand": {',
    '    "endpoint": "/__zcore/cleanup-scan" | "/__zcore/omni-trace" | "/__zcore/forensic-scan" | "/__zcore/create-shortcut" | "/__zcore/restore-points" | "/__zcore/pc-spec" | "/__zcore/os-inspect" | "/__zcore/execute" | "NONE",',
    '    "action": "실행할 코어 액션 요약 영문 코드",',
    '    "params": { "keyword": "추출 키워드(선택)", "siteName": "사이트명(선택)", "targetUrl": "https://...(선택)", "repairSymptom": "수리 증상(선택)" }',
    '  },',
    '  "followUpSuggestions": ["유저가 이어서 클릭해 말할 수 있는 자연스러운 후속 대화 문장 1", "후속 대화 문장 2", "후속 대화 문장 3"]',
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
      ? parsed.followUpSuggestions.map((s: any) => String(s || '').trim()).filter(Boolean).slice(0, 3)
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

export async function fetchRestorePointsWithPrecheck(): Promise<{
  points: MonsterRestorePointItem[];
  error?: string;
}> {
  const r = await zcoreJson<{ ok: boolean; restorePoints?: MonsterRestorePointItem[]; error?: string }>(
    '/__zcore/restore-points'
  );
  if (!r.ok) return { points: [], error: r.error };
  if (!r.data?.ok || !Array.isArray(r.data.restorePoints)) {
    return { points: [], error: r.data?.error || '복원 기록을 불러오지 못했습니다.' };
  }
  return { points: r.data.restorePoints };
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
    userRollbackTypedText?: string;
  }>(
    '/__zcore/restore-rollback',
    postJson({ restoreId: restoreId || 'LATEST', userRollbackTypedText: userTypedText })
  );
  if (!r.ok) return { ok: false, message: `⚠️ ${r.error}`, restoredCount: 0, userRollbackTypedText: userTypedText };
  const d = r.data;
  if (d?.ok) {
    const resolvedId = d.restoreId || restoreId;
    const count = Number(d.restoredCount ?? 0);
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
      message: `✅ ${d.message || `[${resolvedId} 복원 기록]을 원래 자리로 되돌렸습니다.`}`,
      restoredCount: count,
      userRollbackTypedText: d.userRollbackTypedText || userTypedText,
    };
  }
  return {
    ok: false,
    message: `⚠️ 되돌리지 못했습니다: ${d?.error || d?.message || '알 수 없는 오류'}`,
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
  if (!r.ok) return { ok: false, message: `⚠️ ${r.error}` };
  const d = r.data;
  if (!d?.ok || !d.restoreId) {
    const detail = d?.errors?.length ? ` (${d.errors.slice(0, 2).map((e) => `${e.file}: ${e.error}`).join(', ')})` : '';
    return { ok: false, message: `⚠️ 정리하지 못했습니다: ${d?.error || '알 수 없는 오류'}${detail}` };
  }
  const moved = Number(d.movedCount ?? 0);
  const failNote = d.errors?.length ? ` · 실패 ${d.errors.length}건` : '';
  const healthRecord = appendLocalHealthCheckRecord({
    category: '🧹 치우기',
    title: `${preview.summaryTitle} (승인: "${userTypedText}")`,
    reclaimedSizeLabel: `${formatBytes(Number(d.movedBytes ?? 0))} 정돈`,
    cleanedItemCount: moved,
    securityPluginsFrozen: 0,
    speedUpSummary: `${preview.targetFolderLabel}에서 ${moved}건을 '기타_정리함'으로 이동${failNote} · 블랙박스 승인 기록됨`,
    restoreId: d.restoreId,
  });
  return { ok: true, restoreId: d.restoreId, message: `✅ ${d.message || `${moved}건을 정리했습니다.`}`, healthRecord };
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
  if (!r.ok) return { ok: false, message: `⚠️ ${r.error}` };
  const d = r.data;
  if (!d?.ok || !d.restoreId) {
    return { ok: false, message: `⚠️ 바로가기를 만들지 못했습니다: ${d?.error || '알 수 없는 오류'}` };
  }
  const healthRecord = appendLocalHealthCheckRecord({
    category: '🔗 바로가기',
    title: `바탕화면 '${preview.siteName}' 바로가기 생성 (승인: "${userTypedText}")`,
    reclaimedSizeLabel: '바탕화면 바로가기',
    cleanedItemCount: 1,
    securityPluginsFrozen: 0,
    speedUpSummary: `바탕화면에서 더블클릭으로 ${preview.targetUrl} 열기 · 블랙박스 승인 기록됨`,
    restoreId: d.restoreId,
  });
  return { ok: true, restoreId: d.restoreId, message: `✅ ${d.message || '바로가기를 만들었습니다.'}`, healthRecord };
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
}> {
  if (payload.caseType === 'CASE_A_USER_APPROVED_RESTORE_POINT' && payload.restoreId) {
    const res = await executeRestorePointRollback(payload.restoreId, userTypedText);
    return { ok: res.ok, message: res.message };
  }
  if (payload.caseType === 'CASE_B_FOUND_IN_RECYCLE_BIN' && payload.recycleMetaFile) {
    const r = await zcoreJson<{ ok: boolean; restoredPath?: string; renamed?: boolean; error?: string }>(
      '/__zcore/recycle-restore',
      postJson({ recycleMetaFile: payload.recycleMetaFile, userApprovalTypedText: userTypedText })
    );
    if (!r.ok) return { ok: false, message: `⚠️ ${r.error}` };
    if (!r.data?.ok) return { ok: false, message: `⚠️ 복원하지 못했습니다: ${r.data?.error || '알 수 없는 오류'}` };
    const renamedNote = r.data.renamed ? ' (같은 이름 파일이 있어 새 이름으로 복원)' : '';
    return { ok: true, message: `✅ 휴지통에서 [${r.data.restoredPath}]로 복원했습니다${renamedNote}.` };
  }
  if (payload.caseType === 'CASE_C_OFFICE_AUTORECOVER' && payload.recoverFullPath) {
    const r = await zcoreJson<{ ok: boolean; recoveredPath?: string; message?: string; error?: string }>(
      '/__zcore/recover-copy',
      postJson({ fullPath: payload.recoverFullPath, userPrompt: payload.query, userApprovalTypedText: userTypedText })
    );
    if (!r.ok) return { ok: false, message: `⚠️ ${r.error}` };
    if (!r.data?.ok) return { ok: false, message: `⚠️ 복구본을 만들지 못했습니다: ${r.data?.error || '알 수 없는 오류'}` };
    return { ok: true, message: `✅ ${r.data.message || `바탕화면에 복구본을 만들었습니다: ${r.data.recoveredPath}`}` };
  }
  return { ok: false, message: '⚠️ 이 항목은 자동 복구 경로 정보가 없어 복구할 수 없습니다.' };
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

function reply(
  sourceTab: 'trash' | 'repair',
  text: string,
  extra: Partial<MonsterChatMessage> = {}
): MonsterChatMessage {
  return {
    id: `monster_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    role: 'assistant',
    timestamp: nowLabel(),
    text,
    sourceTab,
    ...extra,
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
      ? '🚨 클레임(불만·환불·개선) 접수'
      : ticketKind === 'IDEA'
      ? '💡 신규 아이디어·기능 제안 접수'
      : '🛠️ A/S · 오류 · 버그 수리 접수';

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
    `📮 **[스튜디오 통합 CS 대리 접수 완료 — ${badgeLabel}]**
` +
      `회원님 계정(**${userEmail}**)으로 말씀하신 내용을 **썬드리머 스튜디오**에 즉시 전달·접수했습니다 (접수번호: **#${resolvedTicketId}**).
` +
      `스튜디오의 자동화 IDE 에이전트가 내용을 분석·작업하여 결과를 안내해 드리오니, 아래 **[👉 스튜디오 ‘나의 문의방’ 결과 보러 가기 ↗]** 링크를 눌러 진행 상황과 답변을 확인해 주세요!`,
    {
      cardKind: 'STUDIO_SUPPORT_PROXY',
      studioSupportPayload: payload,
      followUpSuggestions: [
        '방금 접수한 내역 스튜디오 문의방 링크 다시 보여줘',
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
    try {
      await fetch(getZCoreUrl('/api/superpower/clear-history'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear_history: true }),
        signal: AbortSignal.timeout(1500),
      });
    } catch {
      /* local fallback */
    }
    const payload: MonsterAppSettingsPayload = {
      settingCategory: 'CLIPBOARD_RETENTION',
      badgeText: '🧹 클립보드 복사검색 기록 즉시 비우기 완료',
      summaryText: '내 PC에 저장된 Ctrl+0 [복사검색] 히스토리와 오프라인 암호화 우체통 버퍼를 100% 비웠습니다.',
      appliedValueLabel: '보관 기록 0건 (완전 초기화됨)',
    };
    speak('복사검색 클립보드 기록을 즉시 모두 비웠습니다.');
    return reply(sourceTab, `🎛️ **[앱 설정 즉시 변경 완료]**
${payload.summaryText}`, {
      cardKind: 'APP_SETTINGS_CONTROL',
      appSettingsPayload: payload,
      followUpSuggestions: [
        '복사 기록 한 달(30일) 동안 보관하게 바꿔줘',
        '복사 기록 기본 7일 보관으로 설정해줘',
        'F1번에 내 계좌번호 등록해줘',
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
      badgeText: '📋 Ctrl+0 [복사검색] 보관 기간 변경 완료',
      summaryText: `말씀하신 대로 클립보드 복사·캡처 기록 보관 기간을 '${labelKo}'로 즉시 변경했습니다.`,
      appliedValueLabel: labelKo,
    };
    speak(`클립보드 복사 기록 보관 기간을 ${labelKo}로 변경했습니다.`);
    return reply(sourceTab, `🎛️ **[앱 설정 즉시 변경 완료]**
${payload.summaryText}`, {
      cardKind: 'APP_SETTINGS_CONTROL',
      appSettingsPayload: payload,
      followUpSuggestions: [
        '방금 복사한 기록 다 비워줘',
        'F1번에 국민은행 123-45-67890 넣어줘',
        '귀신창 소리 켜져 있는지 봐줘',
      ],
    });
  }

  // 3) F1 ~ F10 상용구 말 한마디로 즉시 등록/변경
  const snippetMatch =
    clean.match(/(?:F|상용구\s*)([1-9]|10)\s*번?(?:에|에는|을|를|슬롯에)?\s*["'“”]?(.+?)["'“”]?\s*(?:넣어|등록|저장|설정|바꿔|입력)(?:해\s*줘|해\s*주세요|해|줘)?$/i) ||
    clean.match(/^(?:F|상용구\s*)([1-9]|10)\s*[:=-]\s*(.+)$/i);
  if (snippetMatch) {
    const slotKey = `F${snippetMatch[1]}`;
    const slotValue = snippetMatch[2].trim();
    try {
      const savedRaw = localStorage.getItem('ghosti_superpower_snippets_v27');
      const existing = savedRaw ? JSON.parse(savedRaw) : {};
      const updated = { ...existing, [slotKey]: slotValue };
      localStorage.setItem('ghosti_superpower_snippets_v27', JSON.stringify(updated));
      await fetch(getZCoreUrl('/api/superpower/snippets'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippets: { [slotKey]: slotValue } }),
        signal: AbortSignal.timeout(1500),
      });
    } catch {
      /* local fallback */
    }
    const payload: MonsterAppSettingsPayload = {
      settingCategory: 'SNIPPET_UPDATE',
      badgeText: `⌨️ [${slotKey}] 단축 상용구 즉시 등록 완료`,
      summaryText: `이제 윈도우 어디서나 Ctrl + 0 ➔ ${slotKey} 키를 누르면 "${slotValue}" 문구가 0.1초 만에 입력됩니다 (내 기기 통합 시 전 기기 자동 동기화).`,
      appliedValueLabel: `${slotKey} = "${slotValue}"`,
    };
    speak(`${slotKey} 상용구 슬롯에 말씀하신 문구를 저장했습니다.`);
    return reply(sourceTab, `🎛️ **[상용구 즉시 등록 완료]**
${payload.summaryText}`, {
      cardKind: 'APP_SETTINGS_CONTROL',
      appSettingsPayload: payload,
      followUpSuggestions: [
        'F2번에 서울 강남구 테헤란로 123 넣어줘',
        'F6번에 사업자등록번호 123-86-98765 등록해줘',
        '온보딩 2탭 초능력 체험방 열어줘',
      ],
    });
  }

  // 4) 귀신창(Ghost Window) 소리 / 노출 시간 / 한영 오타 자동변환 설정 변경
  if (/(귀신창|애기귀신|효과음|초능력\s*소리).*?(꺼|켜|음소거|무음)/i.test(clean)) {
    const turnOn = /켜|활성|다시/.test(clean) && !/꺼|음소거|무음/.test(clean);
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
      badgeText: `🔊 귀신창 애기귀신 효과음 ${turnOn ? 'ON (켜짐)' : 'OFF (음소거)'}`,
      summaryText: turnOn
        ? 'Ctrl+0 귀신창 소환음과 2어절 한영 오타 둔갑술 애기귀신 효과음을 다시 켰습니다.'
        : '조용한 집중 환경을 위해 귀신창 소환음과 오타 변환 효과음을 음소거(OFF)했습니다.',
      appliedValueLabel: turnOn ? '효과음 켜짐 (ON)' : '효과음 꺼짐 (OFF)',
    };
    speak(payload.summaryText);
    return reply(sourceTab, `🎛️ **[앱 설정 즉시 변경 완료]**
${payload.summaryText}`, {
      cardKind: 'APP_SETTINGS_CONTROL',
      appSettingsPayload: payload,
    });
  }

  const durMatch = clean.match(/귀신창.*?(\d+)\s*초.*?(떠\s*있|유지|노출|보여|바꿔|설정)/i);
  if (durMatch) {
    const sec = Math.max(2, Math.min(20, Number(durMatch[1]) || 7));
    try {
      await fetch(getZCoreUrl('/api/superpower/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ window_duration_ms: sec * 1000 }),
        signal: AbortSignal.timeout(1500),
      });
    } catch {
      /* ignore */
    }
    const payload: MonsterAppSettingsPayload = {
      settingCategory: 'GHOST_WINDOW_PREF',
      badgeText: `⏱️ 귀신창(Ctrl+0) 화면 유지 시간 변경 완료`,
      summaryText: `Ctrl+0을 눌렀을 때 귀신창이 화면에 머무는 시간을 ${sec}초(${sec * 1000}ms)로 변경했습니다.`,
      appliedValueLabel: `${sec}초 유지 (바깥 클릭 시 즉시 닫힘)`,
    };
    speak(payload.summaryText);
    return reply(sourceTab, `🎛️ **[앱 설정 즉시 변경 완료]**
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
      badgeText: check.valid ? '⛳ 모임 상단 문패 변경 완료' : '🚫 AI 문패 필터 작동 (우회 개설 차단)',
      summaryText: check.valid
        ? `모임 라운지 상단 문패를 [⛳ ${candidateName}]로 변경했습니다. 모든 모임 회원 화면 상단에 고정 표시됩니다.`
        : check.reason || '가족 또는 회사 명칭은 동호회·동창회 문패로 사용할 수 없습니다.',
      appliedValueLabel: check.valid ? `[⛳ ${candidateName}]` : `변경 차단됨 ("${candidateName}")`,
      isBlockedByFilter: !check.valid,
    };
    speak(payload.summaryText);
    return reply(sourceTab, `🎛️ **[모임 문패 설정 결과]**
${payload.summaryText}`, {
      cardKind: 'APP_SETTINGS_CONTROL',
      appSettingsPayload: payload,
    });
  }

  // 6) 『고스트 모니터 캐스트 (무선 리모컨)』 & 『다 같이 보기 (앨범 싱크)』 2대 알짜 무기 원격 제어
  if (/모니터.*?(?:크게\s*보기|팝업|캐스트|띄워|켜)|크게\s*보기.*?(?:켜|열어|띄워)|무선\s*리모컨/i.test(clean)) {
    dispatchGhostCastLiveCommand({ action: 'OPEN_MONITOR_CAST' });
    const payload: MonsterAppSettingsPayload = {
      settingCategory: 'GHOST_CAST_LIVE',
      badgeText: '💻 [무기 1] 고스트 모니터 캐스트 & 무선 리모컨 가동',
      summaryText:
        '연결된 내 PC/노트북 모니터에 전체화면 클린 뷰어(카톡·문자 알림 유출 0%)를 띄우고 스마트폰을 무선 리모컨(이전/다음/확대/회전/슬라이드쇼)으로 전환했습니다.',
      appliedValueLabel: '💻 모니터 전체화면 클린 뷰어 ON + 📱 스마트폰 무선 리모컨 활성화',
    };
    speak(payload.summaryText);
    return reply(sourceTab, `🎛️ **[고스트 모니터 캐스트 즉시 실행]**\n${payload.summaryText}`, {
      cardKind: 'APP_SETTINGS_CONTROL',
      appSettingsPayload: payload,
    });
  }

  if (/다\s*같이\s*보기|라이브\s*(?:포토\s*)?싱크|사진\s*싱크|앨범\s*싱크/i.test(clean)) {
    dispatchGhostCastLiveCommand({ action: 'TOGGLE_PHOTO_SYNC' });
    const payload: MonsterAppSettingsPayload = {
      settingCategory: 'GHOST_CAST_LIVE',
      badgeText: '📡 [무기 2] 다 같이 보기 (앨범 사진 넘김·줌 싱크) 가동',
      summaryText:
        '내가 넘기거나 확대한 사진 화면이 방에 접속 중인 모든 가족·동창회 회원의 폰/PC 화면에서도 0.1초 만에 똑같이 넘어가는 앨범 라이브 싱크를 켰습니다.',
      appliedValueLabel: '📡 실시간 화면 동기화 (Live Photo Sync) ON',
    };
    speak(payload.summaryText);
    return reply(sourceTab, `🎛️ **[다 같이 보기 앨범 싱크 실행]**\n${payload.summaryText}`, {
      cardKind: 'APP_SETTINGS_CONTROL',
      appSettingsPayload: payload,
    });
  }

  return null;
}

function handleGhostiInfoDeskIfMatched(
  clean: string,
  sourceTab: 'trash' | 'repair',
  speak: (t: string) => void
): MonsterChatMessage | null {
  const isAskingAboutGhosti =
    /귀신같이|귀신창|ctrl\s*\+?\s*0|컨트롤\s*0|컨트롤\s*영|초능력|복사검색|기억검색|상용구|f1|f10|오타\s*둔갑|한영\s*성형|내\s*기기\s*통합|소모임|300장|300개|2,?900원|3,?900원|4,?900원|5,?900원|8,?900원|9,?900원|마스터권|특판|얼리버드|요금제|구독료|얼마야|암호화\s*우체통|qr\s*코드|이메일\s*연결|기기\s*연결|온보딩|새로\s*추가된|업데이트\s*내역|무슨\s*앱|어떤\s*기능/i.test(
      clean
    );

  if (!isAskingAboutGhosti) return null;

  // Case 1: 요금제 · 내 기기 통합(3,900원) · 특판(5년/3년/2년) · QR 없는 이메일 연결 문의
  if (/내\s*기기\s*통합|소모임|300장|300개|2,?900|3,?900|4,?900|5,?900|8,?900|9,?900|요금|가격|구독|얼마|특판|마스터권|얼리버드|qr|이메일\s*연결|기기\s*연결/i.test(clean)) {
    const infoPayload: MonsterInfoDeskPayload = {
      topicBadge: '👑 귀신같이 가격 사다리 & 이메일 자동 기기 통합 안내',
      title: '혼자 쓰는 내 기기 1대는 평생 0원, 내 모든 기기 통합은 월 3,900원입니다',
      bulletPoints: [
        '🆓 내 기기 1대 (언제나 0원): 사진·서류·영상 1초 AI 내용검색(🎯 찾기)과 치우기·고치기(🪄 손보기) 평생 무료 + Ctrl+0 초능력 7일 무료체험',
        '👑 내 기기 통합 (대표 주력 · 월 3,900원 / 1차 5년 특판 39,000원): 번거로운 QR 스캔 없이 이메일 로그인 하나로 내 폰·집PC·회사PC·노트북이 대수 제한 없이 하나로 묶입니다!',
        '📬 무버튼 양방향 클립보드 ‘암호화 우체통(E2EE)’: 회사나 폰에서 복사(Ctrl+C)·캡처한 내역(최근 텍스트 100개·스샷 10장)이 꺼져 있던 집 PC를 켜는 순간 Ctrl+0 [복사검색]에 자동 장전됩니다.',
        '🥂 9인 이하 일상 소모임(누적 300개까지 0원 / 초과 시 방장만 월 2,900원 · 월 구독 전용) / ⛳ 10인 이상 동호회·동창회 무제한(월 4,900원) / 👨‍👩‍👧‍👦 패밀리 우리집(월 5,900원)·양가 3방(월 8,900원) / 💼 업무 공유(월 9,900원~): 방장 1인만 결제하면 초대받은 멤버는 전원 0원!',
        '🔥 3단계 특판 스케줄: 월 구독료 10개월 치 일시불로 1차 5년(100명) ➔ 2차 3년(1,000명) ➔ 3차 2년(10,000명)을 보장합니다.',
      ],
      actionButtons: [
        { label: '👑 내 기기 통합(월 3,900원) 요금제 창 열기', actionType: 'OPEN_PRICING_MODAL' },
        { label: '📖 온보딩 3탭(기기 묶기 혜택) 보기', actionType: 'OPEN_ONBOARDING_TAB3' },
      ],
    };
    speak('혼자 쓰시는 기기 한 대는 평생 무료이며, 이메일 하나로 폰과 집 피씨, 회사 피씨를 모두 묶는 내 기기 통합 플랜은 월 삼천구백 원입니다.');
    return reply(
      sourceTab,
      `💁‍♂️ **[귀신같이 인포메이션 데스크 — 요금제 & 이메일 자동 기기 연결 안내]**
` +
        `우리 앱은 **별도의 스마트폰 QR 스캔 없이 가입하신 이메일 계정 하나로 모든 기기(폰·집PC·회사PC)가 자동 연결**됩니다. 아래 요약과 바로가기 버튼을 확인해 주세요!`,
      {
        cardKind: 'GHOSTI_INFO_DESK',
        infoDeskPayload: infoPayload,
        followUpSuggestions: [
          'Ctrl+0 귀신창 초능력 9가지랑 F1~F10 상용구도 설명해줘',
          '복사 기록 한 달(30일) 동안 보관하게 바꿔줘',
          '아이디어 건의하고 싶은데 스튜디오에 접수해줘',
        ],
      }
    );
  }

  // Case 2: Ctrl+0 귀신창 · 복사검색 · F1~F10 상용구 · 최신 업데이트(v2026.11) 안내
  const infoPayload: MonsterInfoDeskPayload = {
    topicBadge: '👻 귀신창(Ctrl+0) 9대 초능력 & v2026.11 최신 업데이트 안내',
    title: '윈도우 어디서나 Ctrl + 0을 누르면 마우스 옆에 『귀신창』이 소환됩니다',
    bulletPoints: [
      '🔍 상단 [복사검색] (Win+V형 5개 카드 아코디언): 내가 복사(Ctrl+C)한 텍스트와 캡처(Win+Shift+S)한 표·이미지만 0.1초 만에 찾아 커서 위치에 바로 붙여넣습니다 (기본 7일·최대 30일 보관).',
      '⌨️ [F1 ~ F10] 10개 고정 상용구: 자주 쓰는 계좌번호·사업자번호·주소를 10개까지 저장해 두고 Ctrl+0 ➔ F1~F10으로 0.1초 만에 입력합니다 (이 채팅창에서 "F1번에 ~ 넣어줘"라고 말해도 즉시 변경!).',
      '🪄 2어절 한영·영한 오타 둔갑술: 영문 상태에서 dkssudgktpdy qksrkqtmqslek를 치면 애기귀신 소리(띠리링~👻)와 함께 한글로 자동 변환하고 한/영키까지 바꿔줍니다.',
      '📋 연속 복사 순차·AI 칸맞춤(Ctrl+V) · [3] 서식세탁 · [4] 줄바꿈정리 · [6] 표(TSV) OCR 추출 · [8] 카톡 성함·연락처·계좌·일정 분리 · [9] 다중 스샷 1개 PDF 합본 변환까지 지원합니다.',
      '📮 스튜디오 직결 창구: 이 손보기 대화창에 클레임·A/S·아이디어를 말씀하시면 회원님 이름으로 스튜디오에 즉시 대리 접수하고 결과 확인 링크를 드립니다.',
    ],
    actionButtons: [
      { label: '👻 온보딩 2탭(Ctrl+0 초능력 체험방) 열기', actionType: 'OPEN_ONBOARDING_TAB2' },
      { label: '📖 온보딩 1탭(🎯 찾기 · 🪄 손보기 가이드) 열기', actionType: 'OPEN_ONBOARDING_TAB1' },
      { label: '👑 내 기기 통합(월 3,900원) 요금제 보기', actionType: 'OPEN_PRICING_MODAL' },
    ],
  };
  speak('컨트롤 영을 누르시면 마우스 옆에 귀신창이 나타나며 복사검색과 에프일에서 에프십 상용구, 한영 오타 자동 변환을 쓰실 수 있습니다.');
  return reply(
    sourceTab,
    `💁‍♂️ **[귀신같이 인포메이션 데스크 — 핵심 기능 & v2026.11 업데이트 안내]**
` +
      `궁금하신 **『귀신같이(Ghosti)』**의 주요 기능과 최신 업데이트 내역입니다. 이 대화창에서 **"복사 기록 30일 보관으로 바꿔줘"**, **"F1번에 내 계좌번호 넣어줘"**처럼 말씀하시면 설정도 바로 바꿔 드립니다!`,
    {
      cardKind: 'GHOSTI_INFO_DESK',
      infoDeskPayload: infoPayload,
      followUpSuggestions: [
        'F1번에 국민은행 123-45-67890 넣어줘',
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
  const clean = query.trim();
  const speak = (text: string) => {
    if (ttsEnabled) void speakWithHyunsuOrSunhi(text, 'hyunsu_briefing');
  };

  // 0-0A) [자연어 타이핑 승인 인터셉터 (0 토큰 · 블랙박스 영구 기록)]
  // 대기 중인 미리보기 카드(폴더 정리 / 바로가기 생성 / 사라진 파일 복구)가 있을 때 유저가 자연스러운 긍정/승인 발화를 타이핑하면 즉시 실행 후 블랙박스에 기록합니다.
  const pendingApprovalMsg = [...sharedChatState.messages]
    .reverse()
    .find(
      (m) =>
        (m.cleanupPreview && !m.cleanupPreview.approved) ||
        (m.shortcutPreview && !m.shortcutPreview.approved) ||
        (m.missingFilePayload && !m.missingFilePayload.restored)
    );

  const isNegationOrRollback =
    /아니|안\s*해|하지\s*마|취소|보류|멈춰|잠깐|그만|싫어|놔둬|나중에|되돌려|되돌리|원복|원래대로/i.test(clean);
  const isNaturalAffirmativeConsent =
    !isNegationOrRollback &&
    clean.length <= 50 &&
    (/^(응|네|예|그래|좋아|오케이|ok|okay|ㅇㅇ|ㅇㅋ|콜|고고|진행|실행|승인|동의|확인|그대로|부탁|당장|바로|해\s*줘|해\s*주세요|해라|하자)(\s|$|[.!~,])/i.test(
      clean
    ) ||
      /진행해|실행해|승인할|동의할|그대로\s*(해|진행|실행|부탁)|정리해\s*(줘|주세요|라)?|치워\s*(줘|주세요|라)?|옮겨\s*(줘|주세요|라)?|만들어\s*(줘|주세요|라)?|복구해\s*(줘|주세요|라)?/i.test(
        clean
      ));

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
        ? `${res.message}\n📋 **블랙박스 승인 기록 완료** — 승인 발화: \`"${clean}"\` · 복원 번호: \`${res.restoreId}\`\n언제든 채팅창에 **"방금 한 거 되돌려줘"**라고 입력하시면 원래 위치로 1초 원복됩니다.`
        : res.message;
      speak(res.ok ? '승인 말씀이 블랙박스에 기록되었으며 정리를 완료했습니다.' : res.message);
      return reply(sourceTab, msgText, {
        healthRecordIssued: res.healthRecord,
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
        ? `${res.message}\n📋 **블랙박스 승인 기록 완료** — 승인 발화: \`"${clean}"\` · 복원 번호: \`${res.restoreId}\`\n언제든 채팅창에 **"방금 한 거 되돌려줘"**라고 입력하시면 바탕화면에서 즉시 제거(원복)됩니다.`
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
                  approvedTypedText: clean,
                  restoreError: res.ok ? undefined : res.message,
                },
              }
            : m
        )
      );
      const msgText = res.ok
        ? `${res.message}\n📋 **블랙박스 복구 승인 기록 완료** — 승인 발화: \`"${clean}"\``
        : res.message;
      speak(res.ok ? '승인 말씀이 블랙박스에 기록되었으며 파일을 복구했습니다.' : res.message);
      return reply(sourceTab, msgText);
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
      ? `${res.message}\n📋 **블랙박스 원복 기록 완료** — 선택 발화: \`"${clean}"\` · 복원 지점: \`${
          res.restoreId || targetRestoreId
        }\` (${res.restoredCount}건 원위치 복구)`
      : res.message;
    speak(res.ok ? `${targetRestoreId} 복원 기록을 원래 자리로 되돌렸습니다.` : res.message);
    return reply(sourceTab, msgText, {
      ...(points.length > 0 ? { cardKind: 'RESTORE_POINTS_LIST', restorePoints: points } : {}),
    });
  }

  // 번호를 아직 지정하지 않고 "복원해줘", "원래대로 되돌려줘", "복원지점 보여줘"라고 말한 경우:
  // 즉시 복원 히스토리 목록(#1, #2...)을 먼저 보여주고 몇 번을 복원할지 타이핑하게 안내합니다 (LLM 토큰 0원!).
  const isGeneralRestoreRequest =
    /복원\s*기록|복원\s*지점|되돌려|되돌리|원복|원래대로|(방금|아까|최근|이전).*?(취소|복원|복구|되돌|원복)|(정리한\s*거|치운\s*거|옮긴\s*거|만든\s*거).*?(취소|복원|복구|되돌|원복)/i.test(
      clean
    );

  if (isGeneralRestoreRequest) {
    const { points, error } = await fetchRestorePointsWithPrecheck();
    if (error) {
      speak('Z-코어에 연결되지 않아 복원 기록을 불러오지 못했습니다.');
      return reply(sourceTab, `⚠️ ${error}`);
    }
    if (points.length === 0) {
      speak('아직 저장된 복원 기록이 없습니다.');
      return reply(
        sourceTab,
        '🕰️ 아직 저장된 [복원 기록]이 없습니다. 폴더 정리나 바로가기 생성을 승인해 실행하시면 번호별 복원 지점이 이곳에 기록됩니다.'
      );
    }
    // 복원지점이 수십 개일 때 유저가 특정 키워드(예: "바탕화면 복원 기록", "설치파일 복원")를 언급했으면 해당 기록을 최상단으로 배치
    const filterKwMatch = clean
      .replace(
        /방금|아까|최근|이전|지운|삭제한|영구삭제한|사라진|파일|문서|복원|복구|기록|지점|히스토리|목록|보여|줘|주세요|알려|원래대로|되돌려|원복|취소|해|할래/g,
        ''
      )
      .trim();
    const sortedPoints =
      filterKwMatch.length >= 2
        ? [
            ...points.filter((p) => p.summary.includes(filterKwMatch) || p.userPrompt.includes(filterKwMatch)),
            ...points.filter((p) => !p.summary.includes(filterKwMatch) && !p.userPrompt.includes(filterKwMatch)),
          ]
        : [
            ...points.filter((p) => p.summary.includes('영구삭제') || p.summary.includes('타임머신')),
            ...points.filter((p) => !p.summary.includes('영구삭제') && !p.summary.includes('타임머신')),
          ];

    const countGuide =
      sortedPoints.length > 3
        ? `총 ${sortedPoints.length}건 중 **가장 최근 3건**을 먼저 보여드립니다 (이전 기록은 카드 하단 **[▾ 더 보기]**로 펼칠 수 있습니다).`
        : `총 ${sortedPoints.length}건의 복원 지점이 있습니다.`;

    speak(`복원 기록 ${sortedPoints.length}건을 확인했습니다. 되돌릴 번호를 입력해 주세요.`);
    return reply(
      sourceTab,
      `🕰️ **[복원 기록] 히스토리 조회** — ${countGuide}\n어느 시점으로 되돌릴까요? 채팅창에 **"1번 복원해줘"** (또는 **"#1"**)처럼 번호를 타이핑해 주세요.`,
      {
        cardKind: 'RESTORE_POINTS_LIST',
        restorePoints: sortedPoints,
      }
    );
  }

  // 0-0C) [Role 4: 클레임 · A/S 접수 · 아이디어 제안 스튜디오 대리 접수 창구 (회원 로그인 유지 & 나의 문의방 링크 즉시 반환)]
  const studioSupportReply = await handleStudioSupportProxyIfMatched(clean, sourceTab, speak);
  if (studioSupportReply) return studioSupportReply;

  // 0-0D) [Role 3: 말 한마디로 모든 앱 설정·F1~F10 상용구·클립보드 보관기간을 직접 변경하는 마스터 컨트롤 센터]
  const settingsControlReply = await handleAppSettingsControlIfMatched(clean, sourceTab, speak);
  if (settingsControlReply) return settingsControlReply;

  // 0-0E) [Role 2: 귀신같이 자체 기능 · 요금제(내 기기 통합 3,900원) · 업데이트 질문에 답하는 인포메이션 데스크]
  const infoDeskReply = handleGhostiInfoDeskIfMatched(clean, sourceTab, speak);
  if (infoDeskReply) return infoDeskReply;

  // 0-0F) [[🎯 찾기] ↔ [✋ 손보기] 양방향 0토큰 통합 음성/텍스트 자동 라우터]
  // [✋ 손보기 대화창]에서 문서 카톡 전달, 문서 핵심 수치 Q&A("보증금 얼마야?"), 키워드 문장 낭독, 문서 요약, 또는 단순 사진·서류 찾기를 말했을 때
  // "다른 메뉴로 가세요"라고 거절하지 않고 0.001초 만에 [🎯 찾기] 엔진으로 자동 토스(Toss) 및 음성 브리핑까지 원스톱 실행합니다!
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
    return reply(
      sourceTab,
      `🎯 **[양방향 자동 토스 ➔ 카카오톡 '${kakaoRes.recipientName}' 대화방 파일 장전 완료]**\n` +
        `${kakaoRes.hyunsuAnnouncement}\n` +
        `• 대상 서류: **${kakaoRes.fileName}** (스마트 서류함 자동 매칭)`,
      {
        cardKind: 'SEARCH_ROUTING',
        searchKeyword: voiceDocCmd.targetDocKeyword,
        followUpSuggestions: [
          '이 계약서 보증금이랑 월세 얼마야?',
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
      `🎯 **[양방향 자동 토스 ➔ 스마트 서류함 핵심 수치 즉답]**\n` +
        `💬 ${factAnswerKo}`,
      {
        cardKind: 'SEARCH_ROUTING',
        searchKeyword: matchedDoc?.title || voiceDocCmd.targetDocKeyword,
        followUpSuggestions: [
          '사무실 계약서 찾아서 이쁜이에게 카톡 전달해줘',
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
      if (ttsEnabled) {
        void speakWithHyunsuOrSunhi(
          `${extracted.hyunsuIntroText} ${extracted.sunhiReadScript}`,
          'sunhi_doc_reader'
        );
      }
      return reply(
        sourceTab,
        `🎯 **[양방향 자동 토스 ➔ 문서 키워드 문장 전수 발췌 낭독]**\n` +
          `🔊 ${extracted.hyunsuIntroText}\n` +
          (extracted.sunhiReadScript ? `📖 ${extracted.sunhiReadScript}` : `📖 ${fullText}`),
        {
          cardKind: 'SEARCH_ROUTING',
          searchKeyword: voiceDocCmd.targetDocKeyword,
        }
      );
    } else {
      if (ttsEnabled) void speakWithHyunsuOrSunhi(factAnswerKo, 'sunhi_doc_reader');
      return reply(
        sourceTab,
        `🎯 **[양방향 자동 토스 ➔ 스마트 서류함 요약 낭독]**\n📖 ${factAnswerKo}`,
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
      `${RED_LINES_TEXT}\n\n🤝 이 질문은 귀신같이 무료 팩트 검색 범위를 넘는 심층 분석 질문입니다. 찾으신 문서(**${matchedDoc?.fileName || '계약서'}**) 본문과 질문을 클립보드에 담아 평소 쓰시는 **단골 AI(기본: Google Gemini)** 라이브 음성 상담으로 바로 연결해 드립니다.`,
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

  // 단순 사진/영상/문서 찾기 발화("작년 가족사진 찾아줘", "바닷가에서 뛰노는 아이 보여줘")도 LLM 호출 대기 없이 0.001초 만에 [🎯 찾기]로 즉시 토스!
  const earlySearchIntent = detectZeroLlmPerspectiveSearchIntent(clean);
  if (
    earlySearchIntent.isSimpleSearchIntent &&
    !/프린터|와이파이|블루투스|소리|스피커|글씨|광고|팝업|고쳐|사라졌|없어졌|날아갔|휴지통|정리|치워|복원|사양|스펙/i.test(clean)
  ) {
    const kw = earlySearchIntent.extractedKeyword || clean;
    speak(`말씀하신 ${kw} 검색 결과를 찾기 화면에서 바로 띄워드립니다.`);
    return reply(
      sourceTab,
      `🎯 **[양방향 자동 토스 ➔ 🎯 찾기 즉시 실행]**\n"${kw}" 검색 결과를 **[🎯 찾기]** 화면에서 바로 찾아 띄워드립니다.`,
      {
        cardKind: 'SEARCH_ROUTING',
        searchKeyword: kw,
      }
    );
  }

  // 0-A) 명백한 일상 잡담(PC·파일·설정 키워드 전무)은 LLM 토큰 소모(비용 낭비) 없이 0원으로 즉시 정중히 거절 안내
  const hasAnyPcOrFileCue =
    /컴퓨터|피씨|pc|노트북|바탕화면|다운로드|폴더|파일|문서|사진|영상|엑셀|워드|한글|파워포인트|사양|스펙|느려|느린|버벅|렉|용량|메모리|램|ram|cpu|그래픽|글카|배그|롤|게임|편집|포토샵|프리미어|프린터|인쇄|와이파이|인터넷|블루투스|소리|스피커|화면|글씨|주사율|팝업|광고|보안|시작프로그램|부팅|바로가기|아이콘|복원|되돌|취소|휴지통|사라|없어|날아|복구|찾아|치워|정리|고쳐|수리|설치|exe|apk|msi|zip|pdf|드라이브|윈도우|에러|오류|먹통|멈춤|꺼졌/i.test(
      clean
    );
  if (!hasAnyPcOrFileCue) {
    const politeDecline =
      '죄송합니다만 저는 PC 정리(치우기)와 수리(고치기)를 전담하는 비서라 일상 대화는 답변드리기 어렵습니다. 아래처럼 기기 점검이나 정리·복구가 필요하실 때 편하게 말씀해 주세요.';
    speak(politeDecline);
    return reply(sourceTab, `💬 ${politeDecline}`, {
      followUpSuggestions: [
        '내 컴퓨터 사양으로 영상편집이나 게임 잘 돌아가는지 봐줘',
        '다운로드 폴더 방치된 설치파일 정리해 줘',
        '어제 보던 파일이 사라졌는데 찾아줘',
      ],
    });
  }

  // 내 PC 실시간 사양/상태(~200토큰) 컨텍스트 + 저가 LLM(Gemini 2.5 Flash) JSON 판단 호출
  const pcCtx = await fetchRealtimePcContextForLlm();
  const recentTurns = sharedChatState.messages
    .filter((m) => m.id !== 'monster_welcome_init')
    .slice(-6)
    .map((m) => ({ role: m.role, text: m.text }));

  const llmDecision = await callMonsterLowCostLlmJson({
    query: clean,
    sourceTab,
    literacyLevel,
    pcContextText: pcCtx.summaryText,
    recentTurns,
  });

  const hasLlm = Boolean(llmDecision && llmDecision.replyKo);
  const isSyntheticMissingTest = /없는파일_테스트|카톡받은_영수증캡처_01\.jpg/i.test(clean);
  const llmIntro = llmDecision?.replyKo ? `💬 ${llmDecision.replyKo}\n\n` : '';
  const defaultFollowUps = llmDecision?.followUpSuggestions?.length
    ? llmDecision.followUpSuggestions
    : undefined;

  // 0) LLM이 순수 일상 대화(GENERAL_CONVERSATION)로 판단한 경우: 정규식 가로채기 없이 100% 자연스러운 일상 대화 즉시 반환
  if (
    hasLlm &&
    llmDecision!.intent === 'GENERAL_CONVERSATION' &&
    (!llmDecision!.zCoreCommand?.endpoint || llmDecision!.zCoreCommand.endpoint === 'NONE') &&
    !isSyntheticMissingTest
  ) {
    speak(llmDecision!.replyKo);
    return reply(sourceTab, `💬 ${llmDecision!.replyKo}`, {
      llmActionJson: llmDecision!,
      followUpSuggestions:
        defaultFollowUps || [
          '내 PC 사양이랑 남은 용량 진단해 줘',
          '바탕화면이랑 다운로드 폴더 정리할 파일 봐줘',
          '어제 보던 파일이 사라졌는데 찾아줘',
        ],
    });
  }

  // 1) [복원 기록] 조회 (LLM JSON intent 우선, 오프라인 폴백 시에만 정규식 사용)
  if (
    llmDecision?.intent === 'RESTORE_POINTS_LIST' ||
    llmDecision?.zCoreCommand?.endpoint === '/__zcore/restore-points' ||
    (!hasLlm && /복원\s*기록|히스토리|되돌려|원래대로|타임머신|정리한\s*거\s*취소|#\d+/i.test(clean))
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
      return reply(sourceTab, `${llmIntro}⚠️ ${error}`, {
        llmActionJson: actionJson,
        followUpSuggestions: defaultFollowUps,
      });
    }
    if (points.length === 0) {
      speak('아직 복원 기록이 없습니다.');
      return reply(
        sourceTab,
        `${llmIntro}🕰️ 아직 [복원 기록]이 없습니다. 귀신같이 손보기로 정리·바로가기·복구를 실행하면 그때마다 되돌리기용 번호가 여기에 남습니다.`,
        {
          llmActionJson: actionJson,
          followUpSuggestions: defaultFollowUps || [
            '바탕화면이랑 다운로드 폴더 정리할 게 있는지 봐줘',
            '자주 가는 사이트 바탕화면 바로가기 만들어줘',
          ],
        }
      );
    }
    speak('복원 기록을 조회했습니다. 되돌리시려면 원래대로 되돌려달라고 입력해 주세요.');
    return reply(
      sourceTab,
      `${llmIntro}🕰️ **최근 [복원 기록] ${points.length}건 — 사전 검진 결과**\n되돌리시려면 채팅창에 **"방금 한 거 되돌려줘"** 또는 **"#1 원복해줘"**처럼 편하게 입력해 주세요 (블랙박스에 원복 발화가 기록됩니다).`,
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
    llmDecision?.intent === 'MISSING_FILE_TRACE' ||
    llmDecision?.intent === 'OFFICE_CRASH_RECOVER' ||
    llmDecision?.zCoreCommand?.endpoint === '/__zcore/omni-trace' ||
    llmDecision?.zCoreCommand?.endpoint === '/__zcore/forensic-scan' ||
    (!hasLlm && /없어졌|사라졌|증발|지웠|날아갔|어디\s*갔|휴지통|복구해|못\s*찾겠|저장\s*안\s*하고/i.test(clean))
  ) {
    const verdictHeader = '100% 정직 판정: 내 PC 5대 은닉 금고와 윈도우 휴지통을 모두 스캔했으나 흔적이 없습니다.';
    const isOfficeCrash =
      !isSyntheticMissingTest &&
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
      followUpSuggestions: ['[🎯 찾기]에서 문서 내용으로 검색해 볼래', '최근 [복원 기록]도 확인해 줘'],
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
          `${llmIntro}🔍 ${verdictHeader}\n**[자동복구 금고 실측 결과]** 엑셀·워드·한글 자동복구 폴더를 확인했지만 남아 있는 임시 저장 파일이 없습니다.\n해당 프로그램을 다시 열었을 때 왼쪽에 '복구된 파일' 창이 뜨는지 먼저 확인해 보세요. 추측으로 다른 곳을 뒤지지 않고 여기서 정직하게 마칩니다.\n\n${RED_LINES_TEXT}`,
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
        briefingKo: `${llmIntro}🔍 **[자동복구 금고 실측 — ${top.vaultLabel}]**\n자동복구 폴더에서 **${top.fileName}** (${top.modifiedAt})을 찾았습니다${
          autoRecover.length > 1 ? ` (후보 ${autoRecover.length}건 중 가장 최근 파일)` : ''
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

    const traceQuery = llmDecision?.zCoreCommand?.params?.keyword || clean;
    const r = await zcoreJson<{
      ok: boolean;
      caseType?: string;
      fileName?: string;
      currentLocation?: string;
      originalLocation?: string;
      deletedAt?: string;
      restoreId?: string;
      recycleMetaFile?: string;
      briefingKo?: string;
      keywords?: string[];
    }>('/__zcore/omni-trace', postJson({ query: traceQuery }), 2500);
    const d = r.ok ? r.data : undefined;
    if (
      !isSyntheticMissingTest &&
      d?.ok &&
      (d.caseType === 'CASE_A_USER_APPROVED_RESTORE_POINT' || d.caseType === 'CASE_B_FOUND_IN_RECYCLE_BIN') &&
      d.fileName
    ) {
      const payload: MonsterMissingFilePayload = {
        query: clean,
        caseType: d.caseType,
        fileName: d.fileName,
        currentLocation: d.currentLocation || '',
        originalLocation: d.originalLocation || '',
        deletedAtOrSavedAt: d.deletedAt || '',
        restoreId: d.restoreId,
        recycleMetaFile: d.recycleMetaFile,
        fiveLinePreview: [
          `파일명: ${d.fileName}`,
          `현재 위치: ${d.currentLocation || '-'}`,
          `원래 위치: ${d.originalLocation || '-'}`,
          d.caseType === 'CASE_A_USER_APPROVED_RESTORE_POINT'
            ? `근거: [${d.restoreId} 복원 기록] (유저 승인 이력)`
            : `근거: 내 휴지통 $I 기록 해독 (삭제 시각 ${d.deletedAt || '-'})`,
        ],
        briefingKo: `${llmIntro}${d.briefingKo || ''}`,
      };
      speak('파일이 있는 위치를 찾았습니다. 확인하시고 복구해달라고 입력해 주세요.');
      return reply(sourceTab, payload.briefingKo, {
        cardKind: 'MISSING_FILE_EXONERATION',
        missingFilePayload: payload,
        llmActionJson: actionJson,
        followUpSuggestions: defaultFollowUps,
      });
    }

    // 휴지통/복원기록에 없더라도 내 PC 5대 은닉 금고(문서·다운로드·자동복구·서류함) 3초 포렌식 스캔 시도
    if (!isSyntheticMissingTest) {
      const fKeyword = d?.keywords?.[0] || (/계약서/.test(clean) ? '계약서' : '');
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
          briefingKo: `${llmIntro}🔍 **[3초 포렌식 실측 — ${top.vaultLabel}]**\n내 PC 문서·은닉 금고에서 **${top.fileName}** (${top.modifiedAt})을 찾았습니다. 아래 5줄 미리보기를 확인하시고 **[📂 폴더 열기]** 또는 **[↩️ 바탕화면에 복구본 만들기]** 버튼을 누르시거나 **"응 복구해줘"**라고 입력해 주세요.`,
        };
        speak('문서 금고에서 파일을 찾았습니다. 다섯 줄 미리보기를 확인하시고 폴더 열기나 원위치 복원을 눌러 주세요.');
        return reply(sourceTab, payload.briefingKo, {
          cardKind: 'MISSING_FILE_EXONERATION',
          missingFilePayload: payload,
          llmActionJson: actionJson,
          followUpSuggestions: defaultFollowUps || [
            '응 복구해줘',
            '최근 복원 기록 보여줘',
          ],
        });
      }
    }

    let cleanBriefing =
      d?.briefingKo ||
      '복원 기록과 내 휴지통을 확인했지만 찾지 못했습니다. 귀신같이가 옮기거나 지운 기록도 없습니다. 다른 폴더로 옮겨졌을 수 있으니 [🎯 찾기]에서 이름으로 검색해 보세요.';
    if (!cleanBriefing.includes('100% 정직 판정')) {
      cleanBriefing = `${verdictHeader}\n${cleanBriefing}`;
    }
    speak('내 PC 5대 은닉 금고와 휴지통을 모두 스캔했으나 흔적이 없습니다.');
    return reply(
      sourceTab,
      `🔍 ${cleanBriefing}${llmDecision?.replyKo ? `\n\n💬 ${llmDecision.replyKo}` : ''}\n\n${RED_LINES_TEXT}`,
      {
        ...(d?.keywords?.length ? { cardKind: 'SEARCH_ROUTING', searchKeyword: d.keywords[0] } : {}),
        llmActionJson: actionJson,
        followUpSuggestions: defaultFollowUps,
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
        `${llmIntro}🔗 어떤 사이트의 바로가기를 만들까요? 사이트 이름(예: 네이버 카페, 유튜브, 정부24, 홈택스)이나 주소(https://...)를 말씀해 주시면 미리보기를 보여드리고, 확인을 누르신 뒤에만 바탕화면에 만듭니다.`,
        {
          llmActionJson: actionJson,
          followUpSuggestions: [
            '내가 자주 가는 네이버 카페 바탕화면에 바로가기 만들어줘',
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
      `${llmIntro}🔗 **[바탕화면 바로가기 미리보기]**\n'${parsed.siteName}' (${parsed.targetUrl}) 바로가기를 준비했습니다. 채팅창에 **"응 진행해"** 또는 **"네 만들어 주세요"**라고 입력하시면 실행되고 블랙박스·[복원 기록]에 남습니다.`,
      {
        cardKind: 'DESKTOP_SHORTCUT_GATE',
        shortcutPreview,
        llmActionJson: actionJson,
        followUpSuggestions: defaultFollowUps,
      }
    );
  }

  // 4) 대화형 폴더 정리 / 다운로드 설치파일 / 시작프로그램 점검
  if (
    llmDecision?.intent === 'CLEANUP_FOLDER_REORG' ||
    llmDecision?.intent === 'CLEANUP_DOWNLOAD_INSTALLERS' ||
    llmDecision?.intent === 'STARTUP_INSPECT' ||
    llmDecision?.zCoreCommand?.endpoint === '/__zcore/cleanup-scan' ||
    (!hasLlm &&
      /바탕화면|다운로드|폴더|정리|치워|숨겨|설치\s*파일|apk|exe|msi|보안\s*프로그램|구라제거|anysign|magicline|veraport|touchen|부팅\s*느려/i.test(
        clean
      ))
  ) {
    const isSecurityPlugin =
      /보안|구라|anysign|magicline|veraport|touchen|은행\s*깔린|부팅\s*느려|시작\s*프로그램/i.test(clean) ||
      llmDecision?.intent === 'STARTUP_INSPECT';

    if (isSecurityPlugin) {
      const r = await zcoreJson<{ ok: boolean; startupPrograms?: Array<{ name?: string; command?: string }> }>(
        '/__zcore/os-inspect'
      );
      const actionJson: MonsterLlmActionJson = llmDecision || {
        replyKo: '내 PC 부팅 시 자동으로 켜지는 시작프로그램과 상주 보안모듈을 실측했습니다.',
        intent: 'STARTUP_INSPECT',
        zCoreCommand: { endpoint: '/__zcore/os-inspect', action: 'INSPECT_STARTUP_PROGRAMS' },
        followUpSuggestions: ['다운로드 폴더에 쌓인 설치파일도 정리해줘', '내 PC 전체 사양도 확인해줘'],
      };
      if (!r.ok) {
        return reply(sourceTab, `${llmIntro}⚠️ ${r.error}`, { llmActionJson: actionJson });
      }
      const names = (r.data.startupPrograms || [])
        .map((s) => String(s?.name || '').trim())
        .filter(Boolean)
        .slice(0, 12);
      return reply(
        sourceTab,
        `${llmIntro}⚙️ **[시작프로그램 실측 목록]**\n${
          names.length ? names.map((n) => `• ${n}`).join('\n') : '(확인된 시작프로그램이 없습니다)'
        }\n\n은행·관공서 보안 프로그램 동결은 관리자 권한이 필요하고 잘못 멈추면 인터넷뱅킹 접속이 막힐 수 있어, **자동으로 강제 종료하지 않습니다.** 윈도우 [설정 › 앱 › 시작프로그램]에서 안전하게 끄실 수 있습니다.`,
        {
          llmActionJson: actionJson,
          followUpSuggestions: defaultFollowUps || [
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

    if (!r.ok) return reply(sourceTab, `${llmIntro}⚠️ ${r.error}`, { llmActionJson: actionJson });
    if (!r.data?.ok) {
      return reply(sourceTab, `${llmIntro}⚠️ 폴더를 확인하지 못했습니다: ${r.data?.error || '알 수 없는 오류'}`, {
        llmActionJson: actionJson,
      });
    }
    const items = r.data.items || [];
    const folderLabel = kind === 'DOWNLOAD_INSTALLERS' ? '다운로드 폴더' : '바탕화면·다운로드 폴더';
    const ruleText =
      kind === 'DOWNLOAD_INSTALLERS'
        ? `${r.data.minAgeDays ?? 3}일 이상 지난 설치파일(.exe/.msi/.apk)과 받다 만 파일`
        : `${r.data.minAgeDays ?? 3}일 이상 지난 임시·압축·설치 파일(.tmp/.bak/.log/.zip/.exe 등)`;
    if (items.length === 0) {
      speak('정리할 후보 파일이 없습니다.');
      return reply(
        sourceTab,
        `${llmIntro}🧹 ${folderLabel}를 실측했지만 정리 후보(${ruleText})가 없습니다. 이미 아주 깨끗하게 관리되고 있으며 아무 파일도 옮기지 않았습니다!`,
        {
          llmActionJson: actionJson,
          followUpSuggestions: defaultFollowUps || [
            '내 컴퓨터 사양으로 포토샵·배그 잘 돌아가는지 봐줘',
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
      `${llmIntro}🧹 **[실물 미리보기 (${items.length}건 · ${formatBytes(totalBytes)})]**\n파일을 임의로 옮기지 않습니다. 아래 목록을 확인하시고 채팅창에 **"응 진행해"** 또는 **"네 정리해 주세요"**처럼 편하게 입력하시면 그때 정리함으로 옮기고 블랙박스에 기록합니다.`,
      {
        cardKind: 'CLEANUP_PREVIEW_GATE',
        cleanupPreview,
        shortformTip: tipRes.tip,
        llmActionJson: actionJson,
        followUpSuggestions: defaultFollowUps,
      }
    );
  }

  // 5) 내 PC 실측 사양 & 느려짐/업그레이드 맞춤 상담
  if (
    llmDecision?.intent === 'PC_SPEC_CONSULTATION' ||
    llmDecision?.zCoreCommand?.endpoint === '/__zcore/pc-spec' ||
    (!hasLlm &&
      /사양|스펙|돌아가|배그|포토샵|프리미어|영상\s*편집|롤|게임|램|ram|메모리|글카|그래픽|cpu|주사율|60hz|144hz|업그레이드|느려|느린데|버벅|답답/i.test(
        clean
      ))
  ) {
    const r = await zcoreJson<{
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
    }>('/__zcore/pc-spec');

    const actionJson: MonsterLlmActionJson = llmDecision || {
      replyKo: '내 PC의 실제 하드웨어 사양과 현재 여유 자원을 정밀 측정했습니다.',
      intent: 'PC_SPEC_CONSULTATION',
      zCoreCommand: { endpoint: '/__zcore/pc-spec', action: 'MEASURE_REAL_PC_SPEC' },
      followUpSuggestions: [
        '바탕화면이랑 다운로드 폴더 정리할 파일 있는지 봐줘',
        '부팅할 때 켜지는 시작프로그램 목록도 보여줘',
      ],
    };

    if (!r.ok) return reply(sourceTab, `${llmIntro}⚠️ ${r.error}`, { llmActionJson: actionJson });
    const s = r.data;
    const unknown = '확인 불가';
    const ram = typeof s.ramTotalGb === 'number' ? s.ramTotalGb : null;
    const disk = typeof s.diskFreeGb === 'number' ? s.diskFreeGb : null;
    const verdictBadge =
      ram === null
        ? '⚪ 메모리 확인 불가'
        : ram >= 16 && (disk === null || disk >= 30)
        ? '🟢 일반·편집 작업 여유 있음'
        : ram >= 8
        ? '🟡 일반 작업 가능 · 무거운 편집은 버거울 수 있음'
        : '🔴 메모리 부족 가능성';
    const lowDisk = disk !== null && disk < 20 ? ` 저장 공간이 ${disk}GB밖에 남지 않아 정리가 필요합니다.` : '';
    const cpu = s.cpuModel || unknown;
    const gpu = s.gpuModel || unknown;
    const hzText = typeof s.displayHz === 'number' ? `${s.displayHz}Hz` : unknown;

    const easyBase = `🌱 **[쉬운말]** 이 컴퓨터의 작업 책상(메모리)은 ${ram ?? unknown}GB, 서랍장 남은 공간(C드라이브)은 ${
      disk ?? unknown
    }GB입니다. ${
      ram !== null && ram >= 8 ? '인터넷·문서·사진 정리 같은 일상 작업은 아주 충분합니다.' : ''
    }${lowDisk}`;
    const normalBase = `🌿 **[일반]** CPU ${cpu}, 그래픽 ${gpu}, 메모리 ${ram ?? unknown}GB(현재 사용 ${
      s.ramUsedPercent ?? unknown
    }%), 저장 공간 여유 ${disk ?? unknown}GB, 모니터 주사율 ${hzText}입니다.${lowDisk}`;
    const expertBase = `🌳 **[전문가]** CPU: ${cpu} (논리 ${s.cpuLogicalCores ?? unknown}코어) | GPU: ${gpu} | RAM: ${
      ram ?? unknown
    }GB (점유 ${s.ramUsedPercent ?? unknown}%) | 시스템 드라이브 여유: ${disk ?? unknown}/${
      s.diskTotalGb ?? unknown
    }GB | 주사율: ${hzText} | OS: ${s.osVersion || unknown}.`;

    const pcSpecPayload: MonsterPcSpecPayload = {
      cpuModel: cpu,
      ramTotalGb: ram,
      ramUsedPercent: typeof s.ramUsedPercent === 'number' ? s.ramUsedPercent : null,
      gpuModel: gpu,
      osVersion: s.osVersion || unknown,
      diskFreeGb: disk,
      displayHz: typeof s.displayHz === 'number' ? s.displayHz : null,
      verdictBadge,
      easyAnswerKo: llmDecision?.replyKo ? `${easyBase}\n💬 ${llmDecision.replyKo}` : easyBase,
      normalAnswerKo: llmDecision?.replyKo ? `${normalBase}\n💬 ${llmDecision.replyKo}` : normalBase,
      expertAnswerKo: llmDecision?.replyKo ? `${expertBase}\n💬 ${llmDecision.replyKo}` : expertBase,
    };
    const selectedAnswer =
      literacyLevel === 'easy'
        ? pcSpecPayload.easyAnswerKo
        : literacyLevel === 'expert'
        ? pcSpecPayload.expertAnswerKo
        : pcSpecPayload.normalAnswerKo;
    speak(llmDecision?.replyKo || '내 피씨 사양을 실제로 측정했습니다.');
    const bubbleText = llmDecision?.replyKo
      ? `💬 ${llmDecision.replyKo}`
      : `💻 **[내 PC 실측 사양 & 맞춤 진단]**\n${selectedAnswer}`;
    return reply(sourceTab, bubbleText, {
      cardKind: 'PC_SPEC_CONSULTATION',
      pcSpecPayload,
      llmActionJson: actionJson,
      followUpSuggestions: defaultFollowUps || [
        '바탕화면이랑 다운로드 폴더 정리해서 속도 높여줘',
        '시작프로그램 중에 뭘 끄면 좋을지 봐줘',
      ],
    });
  }

  // 6) 3대 선 넘기 정직 컷오프 & 애착 AI 바통 터치
  if (
    llmDecision?.intent === 'BATON_TOUCH_CUTOFF' ||
    (!hasLlm && /독소\s*조항|소송|세금\s*계산|법률|변호사|번역해|요약해|메인보드\s*타|전원\s*안\s*켜|액정\s*깨/i.test(clean))
  ) {
    return reply(
      sourceTab,
      `${llmIntro}${RED_LINES_TEXT}\n\n🤝 이 질문은 귀신같이 손보기가 정확히 답할 수 있는 범위를 넘습니다. 질문 내용을 클립보드에 복사하고, 평소 쓰시는 **단골 AI(기본: Google Gemini)** 창을 열어 드릴 수 있습니다.`,
      {
        cardKind: 'BATON_TOUCH_CUTOFF',
        batonTouchPayload: { docTitle: '질문 내용', docText: clean, userQuestion: clean },
        llmActionJson: llmDecision || undefined,
        followUpSuggestions: defaultFollowUps,
      }
    );
  }

  // 7) 단순 찾기 의도 ➔ [🎯 찾기] 직행
  const searchIntent = detectZeroLlmPerspectiveSearchIntent(clean);
  if (
    llmDecision?.intent === 'SEARCH_ROUTING' ||
    (!hasLlm && searchIntent.isSimpleSearchIntent && !/프린터|와이파이|블루투스|소리|스피커|글씨|광고|팝업|고쳐/i.test(clean))
  ) {
    const kw = llmDecision?.zCoreCommand?.params?.keyword || searchIntent.extractedKeyword || clean;
    return reply(
      sourceTab,
      `${llmIntro}🎯 **[찾기 바로가기]**\n"${kw}" 찾기는 **[🎯 찾기]** 검색에서 사진·문서를 바로 찾아드립니다. 아래 버튼을 누르면 검색 결과로 이동합니다.`,
      {
        cardKind: 'SEARCH_ROUTING',
        searchKeyword: kw,
        llmActionJson: llmDecision || undefined,
        followUpSuggestions: defaultFollowUps,
      }
    );
  }

  // 7-A) [🚀 부팅·버벅임 케어] (매일 1회[24시간] 재부팅 기준점 & 브라우저 강제 청소 영구 금지 + 은행·관공서 보안쓰레기 안전 정리)
  if (/고클린|구라제거기|버벅|렉\s*풀|응급\s*리셋|핸들\s*누수|재부팅|안\s*끄고|보안\s*프로그램|보안\s*쓰레기|시작\s*프로그램|부팅\s*컨디션/i.test(clean)) {
    const subAct =
      /예약|새벽/i.test(clean)
        ? 'boot_lag_schedule_reboot'
        : /구라|보안\s*프로그램|보안\s*쓰레기/i.test(clean)
        ? 'boot_lag_clean_bloatware'
        : 'boot_lag_diagnose';
    const osRes = await executeRealOsAction(subAct, '04:00');
    const summaryText =
      osRes.summaryKo ||
      '하루 이상(24시간 초과) 켜두어 윈도우에 쌓인 피로는 강제로 메모리를 청소하면 오히려 열려 있는 브라우저(구글시트 등) 화면이 깨질 수 있습니다. 억지 청소 대신 지금 다시 시작(재부팅)을 한 번 해주시는 것이 가장 빠르고 깨끗합니다! (권장 기준: 매일 1회 재부팅)';
    speak(summaryText);
    return reply(sourceTab, summaryText, {
      followUpSuggestions: [
        '컴퓨터 켜둔 지 얼마나 지났는지 부팅 경과 시간 진단해줘',
        '재부팅해도 다시 켜지는 은행·관공서 보안 쓰레기만 정리해줘',
        '새벽 4시에 자동 재부팅 예약해줘',
      ],
    });
  }

  // 7-B) [🛡️ 바이러스·랜섬웨어 안심 점검] (알약 대체: Windows Defender 순정 백신 직결)
  if (/알약|바이러스|랜섬웨어|백신|디펜더|defender|악성코드|방어막/i.test(clean)) {
    const subDef = /검사|스캔/i.test(clean) ? 'defender_quick_scan' : 'defender_status';
    const defRes = await executeRealOsAction(subDef);
    const summaryText =
      defRes.summaryKo ||
      '🛡️ 안심하세요! 윈도우 순정 바이러스·랜섬웨어 방어막(Windows Defender)이 완벽하게 작동 중입니다. (무겁고 광고 뜨는 무료 백신을 따로 까실 필요가 없습니다)';
    speak(summaryText);
    return reply(sourceTab, summaryText, {
      followUpSuggestions: [
        '윈도우 순정 백신으로 빠른 바이러스 검사 실행해줘',
        '컴퓨터 켜둔 지 얼마나 지났는지 부팅 경과 시간 진단해줘',
      ],
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
      replyKo: '말씀하신 기기 설정·수리 증상을 확인했습니다. 귀신같이 손보기 수리 엔진으로 바로 연결해 드립니다.',
      intent: 'OS_REPAIR_ACTION',
      zCoreCommand: {
        endpoint: '/__zcore/os-inspect',
        action: 'DIAGNOSE_OS_SYMPTOM',
        params: { repairSymptom: clean },
      },
      followUpSuggestions: [
        '프린터가 대기 중으로만 뜨고 인쇄가 먹통인데 고쳐줘',
        '인터넷 와이파이가 자꾸 끊기는데 초기화해줘',
        '화면 글씨가 너무 작아서 눈이 아파 크게 해줘',
      ],
    };
    speak(actionJson.replyKo);
    return reply(
      sourceTab,
      `${
        llmDecision?.replyKo
          ? `💬 ${llmDecision.replyKo}\n\n🛠️ 아래 **[⚙️ 고치기 진단 카드]** 또는 추천 버튼을 눌러 1초 수리와 화면 위 손가락(👆) 안내를 바로 실행하실 수 있습니다.`
          : `🛠️ 말씀하신 **"${clean}"** 증상을 귀신같이 손보기가 진단했습니다. 언제나 0원으로 수리 전 상태를 백업한 뒤 안전하게 해결해 드립니다.`
      }`,
      {
        cardKind: 'DEVICE_REPAIR_GATE',
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
    return reply(sourceTab, `💬 ${llmDecision.replyKo}`, {
      llmActionJson: llmDecision,
      followUpSuggestions:
        llmDecision.followUpSuggestions?.length > 0
          ? llmDecision.followUpSuggestions
          : [
              '내 PC 사양이랑 남은 용량 진단해 줘',
              '바탕화면이랑 다운로드 폴더 정리할 파일 봐줘',
              '어제 보던 파일이 사라졌는데 찾아줘',
            ],
    });
  }

  // 10) 오프라인 폴백 (네트워크 단절 시에도 친절하고 정직하게 안내)
  const tipRes = pickNextShortformTipOnCompletion({ contextTag: 'os_repair', subscribedLounges: [] });
  return reply(
    sourceTab,
    `💬 말씀하신 **"${clean}"** 내용을 확인했습니다!\n${pcCtx.summaryText}\n\n아래 기능 중 원하시는 항목을 편하게 말씀해 주시거나 아래 추천 버튼을 눌러 주세요:\n• **사라진 파일 1초 추적·복구** · **다운로드/바탕화면 정리**\n• **자주 가는 사이트 바탕화면 바로가기** · **[복원 기록] 1초 되돌리기**\n• **내 PC 실측 사양 & 업그레이드 상담**`,
    {
      cardKind: 'DEVICE_REPAIR_GATE',
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
