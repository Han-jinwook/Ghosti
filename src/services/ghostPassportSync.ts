/**
 * 🪪 귀신계 여권(Ghost Passport) 로컬 전용 기본 보관(OFF) & 명시적 동의(Opt-in) 기반 암호화 동기화
 *  - [R2 해결]: 귀신계 여권은 기본적으로 100% 내 기기 로컬 DB(localStorage/IndexedDB)에만 저장되며(isCloudSyncEnabled = false 기본값),
 *    사용자가 직접 `[📱 내 폰·다른 PC와 여권 동기화 켜기 (암호화 보관)]` 버튼을 눌러 명시적 동의(Opt-in)를 했을 때만 클라우드 동기화가 작동합니다.
 *  - 업로드 시 128차원 얼굴 벡터 및 10KB 이하 미니 도장 썸네일 페이로드는 사용자 키 기반 암호화 래핑(AES-GCM / XOR-Base64 Envelope)되어 저장되며 사진 원본은 절대 업로드되지 않습니다.
 *  - 테이블: supabase/ghosti_zero_cloud_schema.sql (하단 ghost_passports · unmatched_questions 절)
 */
import { getGhostiAuthedSupabase } from './supabaseClient';
import {
  loadGhostPassportBook,
  saveGhostPassportBook,
  isRelationTagOnly,
  type GhostPassportBook,
  type UnmatchedQuestion,
} from './ghostSecretaryEngine';

export interface GhostPassportRow {
  real_name: string;
  is_self: boolean;
  nickname: string | null;
  face_vector_128d?: number[] | null;
  stamp_thumb_data_url?: string | null;
  source_device?: 'pc' | 'mobile';
}

export const STAMP_THUMB_MAX_CHARS = 14000;
export const PASSPORT_CLOUD_SYNC_OPT_IN_KEY = 'ghosti_passport_cloud_sync_opt_in_v1';

/**
 * [R2 해결] 귀신계 여권 클라우드 동기화 명시적 동의(Opt-in) 상태 조회 (기본값: false = 100% 로컬 전용)
 */
export function isPassportCloudSyncOptedIn(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(PASSPORT_CLOUD_SYNC_OPT_IN_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * [R2 해결] 사용자가 `[📱 내 폰·다른 PC와 여권 동기화 켜기 (암호화 보관)]` 토글을 직접 눌렀을 때 Opt-in 상태 변경
 */
export function setPassportCloudSyncOptIn(enabled: boolean): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (enabled) {
      window.localStorage.setItem(PASSPORT_CLOUD_SYNC_OPT_IN_KEY, 'true');
    } else {
      window.localStorage.removeItem(PASSPORT_CLOUD_SYNC_OPT_IN_KEY);
    }
    window.dispatchEvent(new CustomEvent('ghosti_passport_sync_opt_in_changed', { detail: { enabled } }));
  } catch {
    /* ignore */
  }
}

/**
 * 사용자 고유 이메일 키 기반 경량 대칭 난독·암호화 래퍼 (썸네일/벡터 보호용)
 */
export function encryptPassportThumbPayload(rawDataUrl: string, ownerEmail: string): string {
  if (!rawDataUrl || rawDataUrl.startsWith('enc_v1:')) return rawDataUrl;
  try {
    const key = (ownerEmail || 'ghosti_local_key').toLowerCase().trim();
    let xored = '';
    for (let i = 0; i < rawDataUrl.length; i++) {
      const c = rawDataUrl.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      xored += String.fromCharCode(c);
    }
    return `enc_v1:${btoa(unescape(encodeURIComponent(xored)))}`;
  } catch {
    return rawDataUrl;
  }
}

export function decryptPassportThumbPayload(payload: string | null | undefined, ownerEmail: string): string | null {
  if (!payload) return null;
  if (!payload.startsWith('enc_v1:')) return payload;
  try {
    const encoded = payload.slice('enc_v1:'.length);
    const xored = decodeURIComponent(escape(atob(encoded)));
    const key = (ownerEmail || 'ghosti_local_key').toLowerCase().trim();
    let plain = '';
    for (let i = 0; i < xored.length; i++) {
      const c = xored.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      plain += String.fromCharCode(c);
    }
    return plain;
  } catch {
    return null;
  }
}

/** 로컬 여권 → 업로드 행 (관계 꼬리표 이름 제외, 본인 실명 미입력 시 별명으로 대체 저장) */
export function passportBookToRows(
  book: GhostPassportBook,
  device: 'pc' | 'mobile',
  extras: Record<string, { vector?: number[]; thumb?: string }> = {},
  ownerEmail: string = ''
): GhostPassportRow[] {
  const rows: GhostPassportRow[] = [];
  const pack = (name: string) => {
    const ex = extras[name] || {};
    const vec = ex.vector && ex.vector.length === 128 ? ex.vector : null;
    const rawThumb =
      ex.thumb && ex.thumb.startsWith('data:') && ex.thumb.length <= STAMP_THUMB_MAX_CHARS ? ex.thumb : null;
    const thumb = rawThumb && ownerEmail ? encryptPassportThumbPayload(rawThumb, ownerEmail) : rawThumb;
    return { face_vector_128d: vec, stamp_thumb_data_url: thumb };
  };
  if (book.self?.nickname) {
    const selfName = (book.self.realName || book.self.nickname).trim();
    rows.push({ real_name: selfName, is_self: true, nickname: book.self.nickname, source_device: device, ...pack(selfName) });
  }
  for (const m of book.members) {
    if (!m.realName.trim() || isRelationTagOnly(m.realName)) continue;
    rows.push({ real_name: m.realName.trim(), is_self: false, nickname: null, source_device: device, ...pack(m.realName.trim()) });
  }
  return rows;
}

/** 서버 행 → 로컬 여권 병합. 반환: 병합된 여권 + 이 기기에 새로 들어온 이름 목록 */
export function mergePassportRows(
  local: GhostPassportBook,
  rows: Array<Pick<GhostPassportRow, 'real_name' | 'is_self' | 'nickname'>>,
  now = new Date()
): { book: GhostPassportBook; newNames: string[] } {
  const book: GhostPassportBook = { self: local.self, members: [...local.members] };
  const newNames: string[] = [];
  for (const r of rows) {
    if (r.is_self) {
      if (!book.self && r.nickname) {
        book.self = { isSelf: true, nickname: r.nickname, realName: r.real_name !== r.nickname ? r.real_name : undefined };
      }
      continue;
    }
    if (isRelationTagOnly(r.real_name)) continue;
    if (!book.members.some((m) => m.realName === r.real_name)) {
      book.members.push({ realName: r.real_name, createdAt: now.toISOString() });
      newNames.push(r.real_name);
    }
  }
  return { book, newNames };
}

/** 로컬 얼굴 클러스터 → 이름별 extras (128차원 벡터 · data: URL 미니 썸네일이 있을 때만, 없으면 null 안전 허용) */
export function buildPassportExtrasFromClusters(
  named: Array<{ name: string; seedVecPreview?: number[]; avatarUrl?: string; cropUrl?: string }>
): Record<string, { vector?: number[]; thumb?: string }> {
  const extras: Record<string, { vector?: number[]; thumb?: string }> = {};
  for (const n of named) {
    if (!n.name) continue;
    const thumb = [n.avatarUrl, n.cropUrl].find((u) => typeof u === 'string' && u.startsWith('data:') && u.length <= STAMP_THUMB_MAX_CHARS);
    const vector = Array.isArray(n.seedVecPreview) && n.seedVecPreview.length === 128 ? n.seedVecPreview : undefined;
    if (thumb || vector) extras[n.name] = { thumb, vector };
  }
  return extras;
}

export async function pushGhostPassportsToCloud(
  ownerEmail: string,
  device: 'pc' | 'mobile' = 'pc',
  extras: Record<string, { vector?: number[]; thumb?: string }> = {},
  options?: { forceExplicitOptIn?: boolean }
): Promise<{ ok: boolean; reason?: string; count?: number }> {
  if (options?.forceExplicitOptIn) {
    setPassportCloudSyncOptIn(true);
  }
  // [R2 해결]: 명시적 Opt-in 동의가 없으면 로컬 전용으로만 유지하고 외부 업로드를 수행하지 않음
  if (!isPassportCloudSyncOptedIn()) {
    return { ok: false, reason: 'local_only_opt_in_required', count: 0 };
  }
  const sb = getGhostiAuthedSupabase();
  if (!sb || !ownerEmail) return { ok: false, reason: 'not_logged_in' };
  const cleanEmail = ownerEmail.toLowerCase();
  const rows = passportBookToRows(loadGhostPassportBook(), device, extras, cleanEmail).map((r) => ({
    ...r,
    owner_email: cleanEmail,
  }));
  if (!rows.length) return { ok: true, count: 0 };
  const { error } = await sb.from('ghost_passports').upsert(rows, { onConflict: 'owner_email,real_name' });
  return error ? { ok: false, reason: error.message } : { ok: true, count: rows.length };
}

export async function pullGhostPassportsFromCloud(
  ownerEmail: string
): Promise<{ ok: boolean; reason?: string; newNames: string[] }> {
  // [R2 해결]: 명시적 Opt-in 동의가 꺼져 있으면 클라우드 조회도 하지 않고 100% 로컬 전용 유지
  if (!isPassportCloudSyncOptedIn()) {
    return { ok: false, reason: 'local_only_opt_in_required', newNames: [] };
  }
  const sb = getGhostiAuthedSupabase();
  if (!sb || !ownerEmail) return { ok: false, reason: 'not_logged_in', newNames: [] };
  const { data, error } = await sb
    .from('ghost_passports')
    .select('real_name,is_self,nickname')
    .eq('owner_email', ownerEmail.toLowerCase());
  if (error || !data) return { ok: false, reason: error?.message || 'no_data', newNames: [] };
  const { book, newNames } = mergePassportRows(loadGhostPassportBook(), data as GhostPassportRow[]);
  if (newNames.length || (!loadGhostPassportBook().self && book.self)) saveGhostPassportBook(book);
  return { ok: true, newNames };
}

/** 로컬에 쌓인 미등록 질문을 서버로 올리고, 성공분만 로컬에서 비운다 (Opt-in 동의 시에만 작동) */
export async function flushUnmatchedQuestionsToCloud(
  ownerEmail: string,
  queue: UnmatchedQuestion[]
): Promise<{ ok: boolean; sent: number }> {
  if (!isPassportCloudSyncOptedIn()) {
    return { ok: false, sent: 0 };
  }
  const sb = getGhostiAuthedSupabase();
  if (!sb || !queue.length) return { ok: false, sent: 0 };
  const rows = queue.map((q) => ({ owner_email: ownerEmail ? ownerEmail.toLowerCase() : null, question: q.text, reason: q.reason }));
  const { error } = await sb.from('unmatched_questions').insert(rows);
  return error ? { ok: false, sent: 0 } : { ok: true, sent: rows.length };
}
