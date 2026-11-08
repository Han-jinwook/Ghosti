/**
 * 🪪 귀신계 여권 Supabase 계정 간 무료 동기화 (v1.3 공문 20261108_1600 #7)
 *  - 업로드 대상: 실제 이름 + (있을 때) 128차원 얼굴 벡터 + (있을 때) 10KB 이하 미니 도장 썸네일 — 사진 원본 업로드 없음
 *  - 로그인 토큰이 없으면 아무것도 하지 않고 로컬 여권만 유지 (실패해도 앱 동작에 영향 없음)
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

/** 로컬 여권 → 업로드 행 (관계 꼬리표 이름 제외, 본인 실명 미입력 시 별명으로 대체 저장) */
export function passportBookToRows(
  book: GhostPassportBook,
  device: 'pc' | 'mobile',
  extras: Record<string, { vector?: number[]; thumb?: string }> = {}
): GhostPassportRow[] {
  const rows: GhostPassportRow[] = [];
  const pack = (name: string) => {
    const ex = extras[name] || {};
    const vec = ex.vector && ex.vector.length === 128 ? ex.vector : null;
    const thumb = ex.thumb && ex.thumb.startsWith('data:') && ex.thumb.length <= STAMP_THUMB_MAX_CHARS ? ex.thumb : null;
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

export async function pushGhostPassportsToCloud(
  ownerEmail: string,
  device: 'pc' | 'mobile' = 'pc'
): Promise<{ ok: boolean; reason?: string; count?: number }> {
  const sb = getGhostiAuthedSupabase();
  if (!sb || !ownerEmail) return { ok: false, reason: 'not_logged_in' };
  const rows = passportBookToRows(loadGhostPassportBook(), device).map((r) => ({ ...r, owner_email: ownerEmail.toLowerCase() }));
  if (!rows.length) return { ok: true, count: 0 };
  const { error } = await sb.from('ghost_passports').upsert(rows, { onConflict: 'owner_email,real_name' });
  return error ? { ok: false, reason: error.message } : { ok: true, count: rows.length };
}

export async function pullGhostPassportsFromCloud(
  ownerEmail: string
): Promise<{ ok: boolean; reason?: string; newNames: string[] }> {
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

/** 로컬에 쌓인 미등록 질문을 서버로 올리고, 성공분만 로컬에서 비운다 */
export async function flushUnmatchedQuestionsToCloud(
  ownerEmail: string,
  queue: UnmatchedQuestion[]
): Promise<{ ok: boolean; sent: number }> {
  const sb = getGhostiAuthedSupabase();
  if (!sb || !queue.length) return { ok: false, sent: 0 };
  const rows = queue.map((q) => ({ owner_email: ownerEmail ? ownerEmail.toLowerCase() : null, question: q.text, reason: q.reason }));
  const { error } = await sb.from('unmatched_questions').insert(rows);
  return error ? { ok: false, sent: 0 } : { ok: true, sent: rows.length };
}
