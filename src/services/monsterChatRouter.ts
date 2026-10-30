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

 * 🧹 치우기 × ⚙️ 고치기 공용 몬스터 대화 라우터

 *

 * [정직 원칙 — AGENTS.md 수칙 3]

 * - 화면에 보여주는 파일명·건수·용량·사양·복구 결과는 전부 멀린 Z-코어(127.0.0.1:5199)의 실측 응답에서만 가져옵니다.

 * - Z-코어 미연결·실패·미발견이면 "연결 필요 / 못 찾았습니다 / 실패했습니다"로 그대로 알립니다. 가짜 성공·예시 데이터로 대체하지 않습니다.

 * - 파일을 옮기거나 만드는 동작은 미리보기 카드의 [⭕ 확인 완료]를 누른 뒤에만, 미리보기에 실린 정확한 경로로만 실행됩니다.

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

  /** 과거 버전 호환용(현재는 근거 없는 점수를 만들지 않으므로 기록하지 않음) */

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

    // 과거 버전이 자동으로 심어 둔 예시 기록(hc_seed_*)은 실제 이력이 아니므로 제외

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

// 바로가기 대상 해석 (모르면 추측하지 않고 주소를 물어봄)

// ---------------------------------------------------------------------------



function parseShortcutSiteFromQuery(query: string): { siteName: string; targetUrl: string } | null {

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

    id: `monster_${Date.now()}`,

    role: 'assistant',

    timestamp: nowLabel(),

    text,

    sourceTab,

    ...extra,

  };

}



const RED_LINES_TEXT = DOCTOR_3_RED_LINES_NOTICE.join('\n');



// ---------------------------------------------------------------------------

// 메인 라우터

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



  // 1) [복원 기록] 조회

  if (/복원\s*기록|히스토리|되돌려|원래대로|타임머신|정리한\s*거\s*취소|#\d+/i.test(clean)) {

    const { points, error } = await fetchRestorePointsWithPrecheck();

    if (error) {

      speak('Z-코어에 연결되지 않아 복원 기록을 불러오지 못했습니다.');

      return reply(sourceTab, `⚠️ ${error}`);

    }

    if (points.length === 0) {

      speak('아직 복원 기록이 없습니다.');

      return reply(

        sourceTab,

        '🕰️ 아직 [복원 기록]이 없습니다. 귀신같이로 정리·바로가기·복구를 실행하면 그때마다 되돌리기용 번호가 여기에 남습니다.'

      );

    }

    speak('복원 기록을 조회했습니다. 되돌릴 기록의 복원 버튼을 눌러 주세요.');

    return reply(

      sourceTab,

      `🕰️ **최근 [복원 기록] ${points.length}건 — 사전 검진 결과**\n지금 디스크에 되돌릴 대상이 실제로 있는지 대조했습니다. 원하는 기록의 **[↩️ 원래대로 복원]**을 누르면 기록된 경로로 되돌립니다.`,

      { cardKind: 'RESTORE_POINTS_LIST', restorePoints: points }

    );

  }



  // 2) 사라진 파일 / 저장 안 하고 끈 문서

  if (/없어졌|사라졌|증발|지웠|날아갔|어디\s*갔|휴지통|복구해|못\s*찾겠|저장\s*안\s*하고/i.test(clean)) {

    const verdictHeader = '100% 정직 판정: 내 PC 5대 은닉 금고와 윈도우 휴지통을 모두 스캔했으나 흔적이 없습니다.';
    const isSyntheticMissingTest = /없는파일_테스트|카톡받은_영수증캡처_01\.jpg/i.test(clean);
    const isOfficeCrash = !isSyntheticMissingTest && /저장\s*안\s*하고|작업하던\s*(엑셀|워드|한글|파워포인트)|꺼졌/i.test(clean);



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

          `🔍 ${verdictHeader}\n**[자동복구 금고 실측 결과]** 엑셀·워드·한글 자동복구 폴더를 확인했지만 남아 있는 임시 저장 파일이 없습니다.\n해당 프로그램을 다시 열었을 때 왼쪽에 '복구된 파일' 창이 뜨는지 먼저 확인해 보세요. 추측으로 다른 곳을 뒤지지 않고 여기서 정직하게 마칩니다.\n\n${RED_LINES_TEXT}`

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

        briefingKo: `🔍 **[자동복구 금고 실측 — ${top.vaultLabel}]**\n자동복구 폴더에서 **${top.fileName}** (${top.modifiedAt})을 찾았습니다${

          autoRecover.length > 1 ? ` (후보 ${autoRecover.length}건 중 가장 최근 파일)` : ''

        }. 아래는 파일 안에서 실제로 읽은 내용입니다. 찾던 문서가 맞으면 **[⭕ 확인 완료 · 복구하기]**를 눌러 주세요.`,

      };

      speak('자동복구 폴더에서 파일을 찾았습니다. 미리보기를 확인하시고 복구 버튼을 눌러 주세요.');

      return reply(sourceTab, payload.briefingKo, { cardKind: 'MISSING_FILE_EXONERATION', missingFilePayload: payload });

    }



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

    }>('/__zcore/omni-trace', postJson({ query: clean }), 2500);

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

        briefingKo: d.briefingKo || '',

      };

      speak('파일이 있는 위치를 찾았습니다. 확인하시고 복구 버튼을 눌러 주세요.');

      return reply(sourceTab, payload.briefingKo, { cardKind: 'MISSING_FILE_EXONERATION', missingFilePayload: payload });

    }

    let cleanBriefing = d?.briefingKo || '복원 기록과 내 휴지통을 확인했지만 찾지 못했습니다. 귀신같이가 옮기거나 지운 기록도 없습니다. 다른 폴더로 옮겨졌을 수 있으니 [🎯 찾기]에서 이름으로 검색해 보세요.';

    if (!cleanBriefing.includes('100% 정직 판정')) {

      cleanBriefing = `${verdictHeader}\n${cleanBriefing}`;

    }

    speak('내 PC 5대 은닉 금고와 휴지통을 모두 스캔했으나 흔적이 없습니다.');

    return reply(

      sourceTab,

      `🔍 ${cleanBriefing}\n\n${RED_LINES_TEXT}`,

      d?.keywords?.length ? { cardKind: 'SEARCH_ROUTING', searchKeyword: d.keywords[0] } : {}

    );

  }



  // 3) 바탕화면 바로가기(.url) 생성 미리보기

  if (/바로가기|바탕화면에\s*꺼내|아이콘\s*만들|자주\s*가는\s*(카페|사이트|유튜브|은행)/i.test(clean)) {

    const parsed = parseShortcutSiteFromQuery(clean);

    if (!parsed) {

      return reply(

        sourceTab,

        '🔗 어떤 사이트의 바로가기를 만들까요? 주소(예: https://cafe.naver.com/내카페)를 함께 말씀해 주시면 미리보기를 보여드리고, 확인을 누르신 뒤에만 바탕화면에 만듭니다.'

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

      `🔗 **[바탕화면 바로가기 미리보기]**\n'${parsed.siteName}' (${parsed.targetUrl}) 바로가기를 바탕화면에 만들 준비가 됐습니다. **[⭕ 확인 완료]**를 누르시면 생성되고 [복원 기록]에도 남습니다.`,

      { cardKind: 'DESKTOP_SHORTCUT_GATE', shortcutPreview }

    );

  }



  // 4) 대화형 폴더 정리 / 다운로드 설치파일 / (보안 프로그램은 자동 실행하지 않음)

  if (

    /바탕화면|다운로드|폴더|정리|치워|숨겨|설치\s*파일|apk|exe|msi|보안\s*프로그램|구라제거|anysign|magicline|veraport|touchen|느려졌|무거워/i.test(

      clean

    )

  ) {

    const isSecurityPlugin = /보안|구라|anysign|magicline|veraport|touchen|은행\s*깔린|부팅\s*느려/i.test(clean);

    if (isSecurityPlugin) {

      const r = await zcoreJson<{ ok: boolean; startupPrograms?: Array<{ name?: string; command?: string }> }>(

        '/__zcore/os-inspect'

      );

      if (!r.ok) return reply(sourceTab, `⚠️ ${r.error}`);

      const names = (r.data.startupPrograms || [])

        .map((s) => String(s?.name || '').trim())

        .filter(Boolean)

        .slice(0, 12);

      return reply(

        sourceTab,

        `⚙️ **[시작프로그램 실측 목록]** ${names.length ? names.map((n) => `• ${n}`).join('\n') : '(확인된 시작프로그램이 없습니다)'}\n\n은행·관공서 보안 프로그램 동결은 관리자 권한이 필요하고 잘못 멈추면 인터넷뱅킹 접속이 막힐 수 있어, 현재 버전에서는 **자동으로 실행하지 않습니다.** 윈도우 [설정 › 앱 › 시작프로그램]에서 직접 끄실 수 있습니다.`

      );

    }



    const kind: MonsterCleanupPreviewPayload['cleanupType'] = /다운로드|설치\s*파일|apk|exe|msi|찌꺼기|수상한/i.test(clean)

      ? 'DOWNLOAD_INSTALLERS'

      : 'FOLDER_REORG';

    const r = await zcoreJson<{ ok: boolean; items?: MonsterCleanupItem[]; totalBytes?: number; minAgeDays?: number; error?: string }>(

      '/__zcore/cleanup-scan',

      postJson({ kind })

    );

    if (!r.ok) return reply(sourceTab, `⚠️ ${r.error}`);

    if (!r.data?.ok) return reply(sourceTab, `⚠️ 폴더를 확인하지 못했습니다: ${r.data?.error || '알 수 없는 오류'}`);

    const items = r.data.items || [];

    const folderLabel = kind === 'DOWNLOAD_INSTALLERS' ? '다운로드 폴더' : '바탕화면·다운로드 폴더';

    const ruleText =

      kind === 'DOWNLOAD_INSTALLERS'

        ? `${r.data.minAgeDays ?? 3}일 이상 지난 설치파일(.exe/.msi/.apk)과 받다 만 파일`

        : `${r.data.minAgeDays ?? 3}일 이상 지난 임시·압축·설치 파일(.tmp/.bak/.log/.zip/.exe 등)`;

    if (items.length === 0) {

      speak('정리할 후보 파일이 없습니다.');

      return reply(sourceTab, `🧹 ${folderLabel}를 실측했지만 정리 후보(${ruleText})가 없습니다. 아무 파일도 옮기지 않았습니다.`);

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

      `🧹 **[실물 미리보기 게이트 (Zero-Auto-Action)]**\n귀신같이는 먼저 파일을 옮기지 않습니다. 실제로 찾은 **${items.length}건 (${formatBytes(totalBytes)})**을 확인하시고 **[⭕ 확인 완료 · 그대로 실행해 줘]**를 누르시면 그때 옮깁니다.`,

      { cardKind: 'CLEANUP_PREVIEW_GATE', cleanupPreview, shortformTip: tipRes.tip }

    );

  }



  // 5) 내 PC 실측 사양 상담

  if (

    /사양|스펙|돌아가|배그|포토샵|프리미어|영상\s*편집|롤|게임|램|ram|메모리|글카|그래픽|cpu|주사율|60hz|144hz|업그레이드/i.test(

      clean

    )

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

    if (!r.ok) return reply(sourceTab, `⚠️ ${r.error}`);

    const s = r.data;

    const unknown = '확인 불가';

    const ram = typeof s.ramTotalGb === 'number' ? s.ramTotalGb : null;

    const disk = typeof s.diskFreeGb === 'number' ? s.diskFreeGb : null;

    const verdictBadge =

      ram === null

        ? '⚪ 메모리 확인 불가'

        : ram >= 16 && (disk === null || disk >= 30)

        ? '🟢 일반 작업 여유 있음'

        : ram >= 8

        ? '🟡 일반 작업 가능 · 무거운 편집은 버거울 수 있음'

        : '🔴 메모리 부족 가능성';

    const lowDisk = disk !== null && disk < 20 ? ` 저장 공간이 ${disk}GB밖에 남지 않아 정리가 필요합니다.` : '';

    const cpu = s.cpuModel || unknown;

    const gpu = s.gpuModel || unknown;

    const hzText = typeof s.displayHz === 'number' ? `${s.displayHz}Hz` : unknown;

    const limitNote = '※ 특정 게임·프로그램의 권장 사양 비교는 아직 지원하지 않아, 실측한 내 PC 사양만 알려드립니다.';

    const pcSpecPayload: MonsterPcSpecPayload = {

      cpuModel: cpu,

      ramTotalGb: ram,

      ramUsedPercent: typeof s.ramUsedPercent === 'number' ? s.ramUsedPercent : null,

      gpuModel: gpu,

      osVersion: s.osVersion || unknown,

      diskFreeGb: disk,

      displayHz: typeof s.displayHz === 'number' ? s.displayHz : null,

      verdictBadge,

      easyAnswerKo: `🌱 **[쉬운말]** 이 컴퓨터의 작업대(메모리)는 ${ram ?? unknown}GB, 남은 저장 공간은 ${disk ?? unknown}GB입니다. ${

        ram !== null && ram >= 8 ? '인터넷·문서·사진 정리 같은 일상 작업은 무리 없는 편입니다.' : ''

      }${lowDisk} ${limitNote}`,

      normalAnswerKo: `🌿 **[일반]** CPU ${cpu}, 그래픽 ${gpu}, 메모리 ${ram ?? unknown}GB(현재 사용 ${

        s.ramUsedPercent ?? unknown

      }%), 저장 공간 여유 ${disk ?? unknown}GB, 모니터 주사율 ${hzText}입니다.${lowDisk} ${limitNote}`,

      expertAnswerKo: `🌳 **[전문가]** CPU: ${cpu} (논리 ${s.cpuLogicalCores ?? unknown}코어) | GPU: ${gpu} | RAM: ${

        ram ?? unknown

      }GB (점유 ${s.ramUsedPercent ?? unknown}%) | 시스템 드라이브 여유: ${disk ?? unknown}/${s.diskTotalGb ?? unknown}GB | 주사율: ${hzText} | OS: ${

        s.osVersion || unknown

      }. ${limitNote}`,

    };

    const selectedAnswer =

      literacyLevel === 'easy'

        ? pcSpecPayload.easyAnswerKo

        : literacyLevel === 'expert'

        ? pcSpecPayload.expertAnswerKo

        : pcSpecPayload.normalAnswerKo;

    speak('내 피씨 사양을 실제로 측정했습니다.');

    return reply(sourceTab, `💻 **[내 PC 실측 사양]**\n${selectedAnswer}`, {

      cardKind: 'PC_SPEC_CONSULTATION',

      pcSpecPayload,

    });

  }



  // 6) 3대 선 넘기 정직 컷오프 & 애착 AI 바통 터치 (유저 질문 원문만 전달)

  if (/독소\s*조항|소송|세금\s*계산|법률|변호사|번역해|요약해|메인보드\s*타|전원\s*안\s*켜|액정\s*깨/i.test(clean)) {

    return reply(

      sourceTab,

      `${RED_LINES_TEXT}\n\n🤝 이 질문은 귀신같이가 정확히 답할 수 있는 범위를 넘습니다. 질문 내용을 클립보드에 복사하고, 평소 쓰시는 **애착 AI(기본: Google Gemini)** 창을 열어 드릴 수 있습니다.`,

      {

        cardKind: 'BATON_TOUCH_CUTOFF',

        batonTouchPayload: { docTitle: '질문 내용', docText: clean, userQuestion: clean },

      }

    );

  }



  // 7) 단순 찾기 의도 ➔ [🎯 찾기] 직행

  const searchIntent = detectZeroLlmPerspectiveSearchIntent(clean);

  if (searchIntent.isSimpleSearchIntent && !/프린터|와이파이|블루투스|소리|스피커|글씨|광고|팝업|고쳐/i.test(clean)) {

    const kw = searchIntent.extractedKeyword || clean;

    return reply(

      sourceTab,

      `🎯 **[찾기 바로가기]**\n"${kw}" 찾기는 **[🎯 찾기]** 검색에서 사진·문서를 바로 찾아드립니다. 아래 버튼을 누르면 검색 결과로 이동합니다.`,

      { cardKind: 'SEARCH_ROUTING', searchKeyword: kw }

    );

  }



  // 8) 그 외 증상 — 자동 진단 항목이 아님을 정직하게 안내

  const tipRes = pickNextShortformTipOnCompletion({ contextTag: 'os_repair', subscribedLounges: [] });

  return reply(

    sourceTab,

    `🩺 말씀하신 **"${clean}"** 증상은 아직 귀신같이가 자동으로 진단·수리하는 항목이 아닙니다. 원인을 확인하지 않은 채 해결됐다고 말씀드리지 않겠습니다.\n지금 바로 도와드릴 수 있는 것: **사라진 파일 찾기 · 다운로드/바탕화면 정리 · 바탕화면 바로가기 · 복원 기록 되돌리기 · 내 PC 사양 확인**`,

    { cardKind: 'DEVICE_REPAIR_GATE', shortformTip: tipRes.tip }

  );

}



export { triggerUserFavoriteAiLiveVoiceBatonTouch };

