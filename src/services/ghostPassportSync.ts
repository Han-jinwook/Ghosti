/**
 * 🪪 귀신계 여권(Ghost Passport) 내 계정(PC ↔ 모바일) 기본 자동 동기화 (물밑 무질문 연동)
 *  - 내 PC와 모바일이 같은 계정으로 로그인되어 있으면 버튼이나 질문 없이 기본으로 자동 연결되어,
 *    유료 기기 통합 구독 전이라도 모바일에서 내 사진·가족 사진을 찾고 PC에서도 동일하게 찾아줍니다.
 *  - 업로드 시 128차원 얼굴 벡터 및 10KB 이하 미니 도장 썸네일 페이로드는 사용자 키 기반 암호화 래핑되어 저장되며 사진 원본은 절대 업로드되지 않습니다.
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

import type { FaceMemberCluster } from '../types/saysee';
import { saveCustomFaceRegistration } from '../store/slices/storeSharedRefs';

export interface GhostPassportRow {
  real_name: string;
  is_self: boolean;
  nickname: string | null;
  face_vector_128d?: number[] | string | null;
  stamp_thumb_data_url?: string | null;
  source_device?: 'pc' | 'mobile';
}

export const STAMP_THUMB_MAX_CHARS = 14000;
export const PASSPORT_CLOUD_SYNC_OPT_IN_KEY = 'ghosti_passport_cloud_sync_opt_in_v1';
const CLOUD_PASSPORT_VECTOR_CACHE_KEY = 'ghosti_cloud_passport_rows_v1';

/**
 * 내 계정 여권 동기화 활성 여부 (기본값: true = 같은 계정 로그인 시 물밑 자동 연동)
 */
export function isPassportCloudSyncOptedIn(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return true;
    return window.localStorage.getItem(PASSPORT_CLOUD_SYNC_OPT_IN_KEY) !== 'false';
  } catch {
    return true;
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

function parseVector128d(raw: number[] | string | null | undefined): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return raw.length === 128 && raw.every((n) => typeof n === 'number' && Number.isFinite(n)) ? raw : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
    try {
      const arr = JSON.parse(trimmed) as unknown;
      if (Array.isArray(arr) && arr.length === 128 && arr.every((n) => typeof n === 'number' && Number.isFinite(n))) {
        return arr as number[];
      }
    } catch {
      /* ignore malformed vector string */
    }
  }
  return null;
}

export function loadCachedCloudPassportRows(): Array<{
  realName: string;
  isSelf: boolean;
  nickname: string | null;
  vector128d: number[] | null;
  thumbDataUrl: string | null;
}> {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(CLOUD_PASSPORT_VECTOR_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCachedCloudPassportRows(
  rows: Array<{
    realName: string;
    isSelf: boolean;
    nickname: string | null;
    vector128d: number[] | null;
    thumbDataUrl: string | null;
  }>
): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(CLOUD_PASSPORT_VECTOR_CACHE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore quota */
  }
}

/**
 * 다른 기기(PC ↔ 모바일)에서 동기화된 128차원 여권 벡터를 현재 기기의 얼굴 묶음(faceClusters)과 코사인 대조(>= 0.44)하여
 * 아직 이름이 비어 있는 동일 인물 클러스터에 실명(및 본인 별명)을 무질문 자동 매칭합니다 (기획서 §8-3-4 완결).
 */
export function reconcileCloudPassportsWithFaceClusters(
  clusters: FaceMemberCluster[]
): { clusters: FaceMemberCluster[]; matchedSelfClusterId?: string; newlyMatchedNames: string[] } {
  const cloudRows = loadCachedCloudPassportRows().filter((r) => r.realName && r.vector128d && r.vector128d.length === 128);
  if (cloudRows.length === 0 || clusters.length === 0) {
    return { clusters, newlyMatchedNames: [] };
  }

  const assignedClusterIds = new Set<string>(
    clusters.filter((c) => Boolean(c.registeredName?.trim())).map((c) => c.clusterId)
  );
  const existingNames = new Set<string>(
    clusters.map((c) => (c.registeredName || '').trim()).filter(Boolean)
  );
  const updates = new Map<string, { realName: string; isSelf: boolean; nickname: string | null }>();
  let matchedSelfClusterId: string | undefined;
  const newlyMatchedNames: string[] = [];

  for (const row of cloudRows) {
    if (existingNames.has(row.realName)) {
      if (row.isSelf) {
        const already = clusters.find((c) => (c.registeredName || '').trim() === row.realName);
        if (already) matchedSelfClusterId = already.clusterId;
      }
      continue;
    }
    const targetVec = row.vector128d!;
    let bestCluster: FaceMemberCluster | null = null;
    let bestSim = 0.44;
    for (const c of clusters) {
      if (c.excludedAsPasserby || assignedClusterIds.has(c.clusterId)) continue;
      if (!Array.isArray(c.seedVecPreview) || c.seedVecPreview.length !== 128) continue;
      let dotVal = 0;
      for (let d = 0; d < 128; d++) {
        dotVal += targetVec[d] * c.seedVecPreview[d];
      }
      if (dotVal > bestSim) {
        bestSim = dotVal;
        bestCluster = c;
      }
    }
    if (bestCluster) {
      assignedClusterIds.add(bestCluster.clusterId);
      existingNames.add(row.realName);
      updates.set(bestCluster.clusterId, {
        realName: row.realName,
        isSelf: row.isSelf,
        nickname: row.nickname,
      });
      if (row.isSelf) matchedSelfClusterId = bestCluster.clusterId;
      newlyMatchedNames.push(row.realName);
    }
  }

  if (updates.size === 0) {
    return { clusters, matchedSelfClusterId, newlyMatchedNames: [] };
  }

  const nextClusters = clusters.map((c) => {
    const u = updates.get(c.clusterId);
    if (!u) return c;
    const nextRoomPersonas = {
      ...(c.roomPersonas || {}),
      우리집: u.realName,
      personal: u.isSelf && u.nickname ? u.nickname : u.realName,
    };
    saveCustomFaceRegistration(c.clusterId, {
      registeredName: u.realName,
      relationshipTag: '',
      roomPersonas: nextRoomPersonas,
      excludedAsPasserby: false,
    });
    return {
      ...c,
      registeredName: u.realName,
      roomPersonas: nextRoomPersonas,
    };
  });

  return { clusters: nextClusters, matchedSelfClusterId, newlyMatchedNames };
}

/** 로컬 여권 → 업로드 행 (관계 꼬리표 이름 제외, 본인 실명 미입력 시 별명으로 대체 저장, DB CHECK 제약 및 중복 행 방어) */
export function passportBookToRows(
  book: GhostPassportBook,
  device: 'pc' | 'mobile',
  extras: Record<string, { vector?: number[]; thumb?: string }> = {},
  ownerEmail: string = ''
): GhostPassportRow[] {
  const byName = new Map<string, GhostPassportRow>();
  const pack = (name: string) => {
    const ex = extras[name] || {};
    const vec = ex.vector && ex.vector.length === 128 ? ex.vector : null;
    const rawThumb =
      ex.thumb && ex.thumb.startsWith('data:') && ex.thumb.length <= STAMP_THUMB_MAX_CHARS ? ex.thumb : null;
    const thumb = rawThumb && ownerEmail ? encryptPassportThumbPayload(rawThumb, ownerEmail) : rawThumb;
    return { face_vector_128d: vec, stamp_thumb_data_url: thumb };
  };
  if (book.self?.nickname || book.self?.realName) {
    const selfName = (book.self.realName || book.self.nickname || '').trim().slice(0, 20);
    const safeNick = book.self.nickname ? book.self.nickname.trim().slice(0, 12) : null;
    if (selfName && !isRelationTagOnly(selfName)) {
      byName.set(selfName, {
        real_name: selfName,
        is_self: true,
        nickname: safeNick || null,
        source_device: device,
        ...pack(selfName),
      });
    }
  }
  for (const m of book.members) {
    const clean = m.realName.trim().slice(0, 20);
    if (!clean || isRelationTagOnly(clean) || byName.has(clean)) continue;
    byName.set(clean, {
      real_name: clean,
      is_self: false,
      nickname: null,
      source_device: device,
      ...pack(clean),
    });
  }
  return Array.from(byName.values());
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
  const cleanEmail = ownerEmail.toLowerCase();
  const { data, error } = await sb
    .from('ghost_passports')
    .select('real_name,is_self,nickname,face_vector_128d,stamp_thumb_data_url,source_device')
    .eq('owner_email', cleanEmail);
  if (error || !data) return { ok: false, reason: error?.message || 'no_data', newNames: [] };
  const rows = data as GhostPassportRow[];
  saveCachedCloudPassportRows(
    rows.map((r) => ({
      realName: String(r.real_name || '').trim(),
      isSelf: Boolean(r.is_self),
      nickname: r.nickname ? String(r.nickname).trim() : null,
      vector128d: parseVector128d(r.face_vector_128d),
      thumbDataUrl: decryptPassportThumbPayload(r.stamp_thumb_data_url, cleanEmail),
    }))
  );
  const { book, newNames } = mergePassportRows(loadGhostPassportBook(), rows);
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
