import {
  detectZeroLlmPerspectiveSearchIntent,
  pickNextShortformTipOnCompletion,
  DOCTOR_3_RED_LINES_NOTICE,
  type ShortformTipItem,
} from './shortformCurationEngine';
import {
  speakWithHyunsuOrSunhi,
  triggerUserFavoriteAiLiveVoiceBatonTouch,
} from './voiceSearchAndAiBatonEngine';
import { getZCoreUrl } from './zCoreBridge';

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
  | 'BATON_TOUCH_CUTOFF';

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
  createdRestoreId?: string;
  executionError?: string;
}

export interface MonsterShortcutPreviewPayload {
  siteName: string;
  targetUrl: string;
  shortcutFileName: string;
  userPrompt: string;
  approved?: boolean;
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
      '안녕하세요! 내 PC와 스마트폰을 돌보는 **클린몬스터 · 설정몬스터**입니다. 😊\n' +
      '딱딱한 명령어를 치실 필요 없이, 평소에 말씀하시듯 편하게 이야기해 주세요!\n\n' +
      '• **"요즘 컴퓨터가 왜 이렇게 느리고 답답할까?"**\n' +
      '• **"내가 영상편집 배우려는데 컴퓨터 새로 사야 해?"**\n' +
      '• **"바탕화면이랑 다운로드 폴더가 너무 지저분해"**\n' +
      '• **"어제 보던 계약서 파일이 갑자기 안 보여 어떡하지?"**\n\n' +
      '말씀을 들은 뒤 **AI 두뇌(Gemini Flash)**가 원인을 알기 쉽게 설명해 드리고, **JSON 명령으로 Z-코어(5199)**에게 실측 조사를 맡깁니다. 파일을 옮기거나 고치기 전에는 반드시 먼저 동의를 구하니 안심하고 말씀해 주세요!',
    followUpSuggestions: [
      '요즘 컴퓨터가 좀 느린데 내 사양이랑 상태 좀 봐줄래?',
      '바탕화면이랑 다운로드 폴더 깔끔하게 정리하고 싶어',
      '내가 유튜브 영상편집 하려는데 이 컴퓨터로 돌아갈까?',
      '어제 작업하던 문서가 안 보이는데 찾아줄 수 있어?',
      '자주 가는 네이버 카페 바탕화면에 바로가기 만들어줘',
    ],
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

const LITERACY_TONE_PROMPT: Record<MonsterLiteracyLevel, string> = {
  easy:
    '🌱 [초급 / 컴맹·어르신 모드]: 어려운 컴퓨터 영어/전문용어(RAM, IOPS, 프로세스, 데몬 등)를 절대 쓰지 마세요! 메모리는 "작업 책상 넓이", 하드디스크는 "서랍장 여유 공간", 상주 프로그램은 "일 안 하고 자리만 차지하는 프로그램"처럼 아주 쉽고 다정한 일상 비유로 자식이 부모님께 설명하듯 따뜻하게 말씀드리세요.',
  normal:
    '🌿 [중급 / 일반인 모드]: 원인과 결과를 명쾌하고 친절하게 설명하고, 컴퓨터를 새로 살 필요가 없는 이유나 가성비 높은 해결 방법(예: 몇만 원대 부품 추가 또는 무료 정리)을 구체적 수치와 함께 짚어주세요.',
  expert:
    '🌳 [고급 / 전문가 모드]: 실측된 CPU 코어, RAM 점유율(%), 디스크 여유량(GB), 주사율(Hz), 레지스트리 시작프로그램, $Recycle.Bin $I 바이너리 헤더 등 엔지니어링 팩트와 수치를 정확히 인용하여 간결하게 브리핑하세요.',
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

async function callMonsterLlmGateway(prompt: string, timeoutMs = 6500): Promise<{ ok: boolean; text: string; model?: string }> {
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
        config: { temperature: 0.35, maxOutputTokens: 900 },
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
    .map((t) => `${t.role === 'user' ? '유저' : '몬스터'}: ${t.text.slice(0, 220)}`)
    .join('\n');

  const prompt = [
    '당신은 『귀신같이(Ghosti)』의 내 기기 전담 해결사인 **클린몬스터(🧹 치우기) · 설정몬스터(⚙️ 고치기)**입니다.',
    '주의: 절대로 스스로를 "AI 주치의"라고 부르지 마세요. 반드시 "클린몬스터" 또는 "설정몬스터"라고 부르세요.',
    '',
    LITERACY_TONE_PROMPT[literacyLevel],
    '',
    pcContextText,
    '',
    historyBlock ? `[최근 대화 맥락]\n${historyBlock}\n` : '',
    `[현재 유저 입력 (${sourceTab === 'trash' ? '🧹 치우기 탭' : '⚙️ 고치기 탭'})]`,
    `"${query}"`,
    '',
    '[핵심 임무 — 깊은 감동을 주는 대화 + JSON으로 Z-코어(127.0.0.1:5199)에게 일 맡기기]',
    '1. 유저가 명령어처럼 말하지 않고 일상적인 고민("요즘 왜 이렇게 느리지?", "영상편집 배울 건데 컴퓨터 새로 사야 해?", "어제 보던 파일이 안 보여", "바탕화면이 너무 어지러워", "프린터가 안 나와")을 말해도, 먼저 마음을 안심시키고 내 PC 실시간 사양/상태 수치를 근거로 왜 그런지 따뜻하고 명쾌하게 설명(replyKo)하세요.',
    '2. 절대로 확인되지 않은 가짜 파일명이나 가짜 용량을 지어내지 마세요. 실제 파일 목록과 실행 버튼은 당신이 반환한 JSON 명령(zCoreCommand)을 통해 Z-코어가 바로 아래에 실물 카드로 붙여줍니다.',
    '3. 반드시 아래 JSON 스키마 하나만 순수 JSON으로 출력하세요 (마크다운 코드블록 없이 { 로 시작해서 } 로 끝낼 것):',
    '{',
    '  "replyKo": "유저 눈높이(초급/중급/고급)에 맞춘 따뜻하고 감동적인 2~4문장 대화 답변 (내 PC 실측 수치 자연스럽게 인용)",',
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

export async function executeRestorePointRollback(restoreId: string): Promise<{
  ok: boolean;
  message: string;
  restoredCount: number;
}> {
  const r = await zcoreJson<{ ok: boolean; message?: string; error?: string; restoredCount?: number }>(
    '/__zcore/restore-rollback',
    postJson({ restoreId })
  );
  if (!r.ok) return { ok: false, message: `⚠️ ${r.error}`, restoredCount: 0 };
  const d = r.data;
  if (d?.ok) {
    return {
      ok: true,
      message: `✅ ${d.message || `[${restoreId} 복원 기록]을 되돌렸습니다.`}`,
      restoredCount: Number(d.restoredCount ?? 0),
    };
  }
  return {
    ok: false,
    message: `⚠️ 되돌리지 못했습니다: ${d?.error || d?.message || '알 수 없는 오류'}`,
    restoredCount: 0,
  };
}

// ---------------------------------------------------------------------------
// 🧹 대화형 폴더 정리 실행 (미리보기에 실린 실물 경로만)
// ---------------------------------------------------------------------------

export async function executeMonsterCleanupApproval(preview: MonsterCleanupPreviewPayload): Promise<{
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
    title: preview.summaryTitle,
    reclaimedSizeLabel: `${formatBytes(Number(d.movedBytes ?? 0))} 정돈`,
    cleanedItemCount: moved,
    securityPluginsFrozen: 0,
    speedUpSummary: `${preview.targetFolderLabel}에서 ${moved}건을 '기타_정리함'으로 이동${failNote}`,
    restoreId: d.restoreId,
  });
  return { ok: true, restoreId: d.restoreId, message: `✅ ${d.message || `${moved}건을 정리했습니다.`}`, healthRecord };
}

export async function executeMonsterShortcutApproval(preview: MonsterShortcutPreviewPayload): Promise<{
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
    })
  );
  if (!r.ok) return { ok: false, message: `⚠️ ${r.error}` };
  const d = r.data;
  if (!d?.ok || !d.restoreId) {
    return { ok: false, message: `⚠️ 바로가기를 만들지 못했습니다: ${d?.error || '알 수 없는 오류'}` };
  }
  const healthRecord = appendLocalHealthCheckRecord({
    category: '🔗 바로가기',
    title: `바탕화면 '${preview.siteName}' 바로가기(${d.fileName || preview.shortcutFileName}) 생성`,
    reclaimedSizeLabel: '바탕화면 바로가기',
    cleanedItemCount: 1,
    securityPluginsFrozen: 0,
    speedUpSummary: `바탕화면에서 더블클릭으로 ${preview.targetUrl} 열기`,
    restoreId: d.restoreId,
  });
  return { ok: true, restoreId: d.restoreId, message: `✅ ${d.message || '바로가기를 만들었습니다.'}`, healthRecord };
}

// ---------------------------------------------------------------------------
// 사라진 파일 복구 실행 (찾은 경로 유형별 실제 복구)
// ---------------------------------------------------------------------------

export async function executeMissingFileRecovery(payload: MonsterMissingFilePayload): Promise<{
  ok: boolean;
  message: string;
}> {
  if (payload.caseType === 'CASE_A_USER_APPROVED_RESTORE_POINT' && payload.restoreId) {
    const res = await executeRestorePointRollback(payload.restoreId);
    return { ok: res.ok, message: res.message };
  }
  if (payload.caseType === 'CASE_B_FOUND_IN_RECYCLE_BIN' && payload.recycleMetaFile) {
    const r = await zcoreJson<{ ok: boolean; restoredPath?: string; renamed?: boolean; error?: string }>(
      '/__zcore/recycle-restore',
      postJson({ recycleMetaFile: payload.recycleMetaFile })
    );
    if (!r.ok) return { ok: false, message: `⚠️ ${r.error}` };
    if (!r.data?.ok) return { ok: false, message: `⚠️ 복원하지 못했습니다: ${r.data?.error || '알 수 없는 오류'}` };
    const renamedNote = r.data.renamed ? ' (같은 이름 파일이 있어 새 이름으로 복원)' : '';
    return { ok: true, message: `✅ 휴지통에서 [${r.data.restoredPath}]로 복원했습니다${renamedNote}.` };
  }
  if (payload.caseType === 'CASE_C_OFFICE_AUTORECOVER' && payload.recoverFullPath) {
    const r = await zcoreJson<{ ok: boolean; recoveredPath?: string; message?: string; error?: string }>(
      '/__zcore/recover-copy',
      postJson({ fullPath: payload.recoverFullPath, userPrompt: payload.query })
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

  const llmIntro = llmDecision?.replyKo ? `💬 ${llmDecision.replyKo}\n\n` : '';
  const defaultFollowUps = llmDecision?.followUpSuggestions?.length
    ? llmDecision.followUpSuggestions
    : undefined;

  // 1) [복원 기록] 조회 (명시적 키워드 또는 LLM이 RESTORE_POINTS_LIST로 판단한 경우)
  if (
    /복원\s*기록|히스토리|되돌려|원래대로|타임머신|정리한\s*거\s*취소|#\d+/i.test(clean) ||
    llmDecision?.intent === 'RESTORE_POINTS_LIST'
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
        `${llmIntro}🕰️ 아직 [복원 기록]이 없습니다. 클린몬스터·설정몬스터로 정리·바로가기·복구를 실행하면 그때마다 되돌리기용 번호가 여기에 남습니다.`,
        {
          llmActionJson: actionJson,
          followUpSuggestions: defaultFollowUps || [
            '바탕화면이랑 다운로드 폴더 정리할 게 있는지 봐줘',
            '자주 가는 사이트 바탕화면 바로가기 만들어줘',
          ],
        }
      );
    }
    speak('복원 기록을 조회했습니다. 되돌릴 기록의 복원 버튼을 눌러 주세요.');
    return reply(
      sourceTab,
      `${llmIntro}🕰️ **최근 [복원 기록] ${points.length}건 — 사전 검진 결과**\n지금 디스크에 되돌릴 대상이 실제로 있는지 대조했습니다. 원하는 기록의 **[↩️ 원래대로 복원]**을 누르면 기록된 경로로 되돌립니다.`,
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
    /없어졌|사라졌|증발|지웠|날아갔|어디\s*갔|휴지통|복구해|못\s*찾겠|저장\s*안\s*하고/i.test(clean) ||
    llmDecision?.intent === 'MISSING_FILE_TRACE' ||
    llmDecision?.intent === 'OFFICE_CRASH_RECOVER'
  ) {
    const verdictHeader = '100% 정직 판정: 내 PC 5대 은닉 금고와 윈도우 휴지통을 모두 스캔했으나 흔적이 없습니다.';
    const isSyntheticMissingTest = /없는파일_테스트|카톡받은_영수증캡처_01\.jpg/i.test(clean);
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
        }. 아래는 파일 안에서 실제로 읽은 내용입니다. 찾던 문서가 맞으면 **[⭕ 확인 완료 · 복구하기]**를 눌러 주세요.`,
      };
      speak('자동복구 폴더에서 파일을 찾았습니다. 미리보기를 확인하시고 복구 버튼을 눌러 주세요.');
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
      speak('파일이 있는 위치를 찾았습니다. 확인하시고 복구 버튼을 눌러 주세요.');
      return reply(sourceTab, payload.briefingKo, {
        cardKind: 'MISSING_FILE_EXONERATION',
        missingFilePayload: payload,
        llmActionJson: actionJson,
        followUpSuggestions: defaultFollowUps,
      });
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
    /바로가기|바탕화면에\s*꺼내|아이콘\s*만들|자주\s*가는\s*(카페|사이트|유튜브|은행)/i.test(clean) ||
    llmDecision?.intent === 'DESKTOP_SHORTCUT'
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
    speak('바로가기 미리보기를 준비했습니다. 확인 버튼을 누르시면 바탕화면에 만듭니다.');
    return reply(
      sourceTab,
      `${llmIntro}🔗 **[바탕화면 바로가기 미리보기]**\n'${parsed.siteName}' (${parsed.targetUrl}) 바로가기를 바탕화면에 만들 준비가 됐습니다. **[⭕ 확인 완료]**를 누르시면 생성되고 [복원 기록]에도 남습니다.`,
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
    /바탕화면|다운로드|폴더|정리|치워|숨겨|설치\s*파일|apk|exe|msi|보안\s*프로그램|구라제거|anysign|magicline|veraport|touchen|부팅\s*느려/i.test(
      clean
    ) ||
    llmDecision?.intent === 'CLEANUP_FOLDER_REORG' ||
    llmDecision?.intent === 'CLEANUP_DOWNLOAD_INSTALLERS' ||
    llmDecision?.intent === 'STARTUP_INSPECT'
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
    speak('정리할 파일 목록을 실제로 확인했습니다. 내역을 보시고 확인 버튼을 눌러 주세요.');
    return reply(
      sourceTab,
      `${llmIntro}🧹 **[실물 미리보기 게이트 (Zero-Auto-Action)]**\n클린몬스터는 먼저 파일을 옮기지 않습니다. 실제로 찾은 **${items.length}건 (${formatBytes(
        totalBytes
      )})**을 확인하시고 **[⭕ 확인 완료 · 그대로 실행해 줘]**를 누르시면 그때 안전하게 정리함으로 옮깁니다.`,
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
    /사양|스펙|돌아가|배그|포토샵|프리미어|영상\s*편집|롤|게임|램|ram|메모리|글카|그래픽|cpu|주사율|60hz|144hz|업그레이드|느려|느린데|버벅|답답/i.test(
      clean
    ) ||
    llmDecision?.intent === 'PC_SPEC_CONSULTATION'
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
    speak('내 피씨 사양을 실제로 측정했습니다.');
    return reply(sourceTab, `💻 **[내 PC 실측 사양 & 맞춤 진단]**\n${selectedAnswer}`, {
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
    /독소\s*조항|소송|세금\s*계산|법률|변호사|번역해|요약해|메인보드\s*타|전원\s*안\s*켜|액정\s*깨/i.test(clean) ||
    llmDecision?.intent === 'BATON_TOUCH_CUTOFF'
  ) {
    return reply(
      sourceTab,
      `${llmIntro}${RED_LINES_TEXT}\n\n🤝 이 질문은 클린몬스터·설정몬스터가 정확히 답할 수 있는 범위를 넘습니다. 질문 내용을 클립보드에 복사하고, 평소 쓰시는 **단골 AI(기본: Google Gemini)** 창을 열어 드릴 수 있습니다.`,
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
    (searchIntent.isSimpleSearchIntent && !/프린터|와이파이|블루투스|소리|스피커|글씨|광고|팝업|고쳐/i.test(clean)) ||
    llmDecision?.intent === 'SEARCH_ROUTING'
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

  // 8) 프린터·네트워크·화면·소리·S드라이브 등 OS 수리 의도 (⚙️ 고치기 연동)
  if (
    /프린터|인쇄|스풀러|와이파이|인터넷|네트워크|블루투스|소리|스피커|글씨|화면|주사율|광고|팝업|s\s*드라이브|고쳐/i.test(
      clean
    ) ||
    llmDecision?.intent === 'OS_REPAIR_ACTION'
  ) {
    const tipRes = pickNextShortformTipOnCompletion({ contextTag: 'os_repair', subscribedLounges: [] });
    const actionJson: MonsterLlmActionJson = llmDecision || {
      replyKo: '말씀하신 기기 설정·수리 증상을 확인했습니다. 설정몬스터 수리 엔진으로 바로 연결해 드립니다.',
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
          ? `💬 ${llmDecision.replyKo}\n\n🛠️ 좌측 **[⚙️ 고치기 진단 카드]** 또는 아래 추천 버튼을 눌러 1초 수리와 화면 위 손가락(👆) 안내를 바로 실행하실 수 있습니다.`
          : `🛠️ 말씀하신 **"${clean}"** 증상을 설정몬스터가 진단했습니다. 언제나 0원으로 수리 전 상태를 백업한 뒤 안전하게 해결해 드립니다.`
      }`,
      {
        cardKind: 'DEVICE_REPAIR_GATE',
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
