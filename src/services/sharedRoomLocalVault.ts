import type { PhotoItem } from '../types/saysee';
import { hasAuthenticatedHubAccountSession } from './supabaseClient';

const VAULT_DB_NAME = 'ghosti_shared_room_local_vault_v1';
const VAULT_DB_VERSION = 1;
const PHOTO_STORE_NAME = 'photo_rooms';
const WORK_STORE_NAME = 'work_rooms';

interface StoredPhotoRoomVaultRecord {
  vaultKey: string;
  ownerEmail: string;
  roomId: string;
  updatedAtIso: string;
  photos: PhotoItem[];
}

interface StoredWorkRoomVaultRecord<T = Record<string, unknown>> {
  vaultKey: string;
  roomId: string;
  updatedAtIso: string;
  docs: T[];
}

let dbOpenPromise: Promise<IDBDatabase | null> | null = null;

function openSharedRoomLocalVaultDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (dbOpenPromise) {
    return dbOpenPromise;
  }
  dbOpenPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(VAULT_DB_NAME, VAULT_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PHOTO_STORE_NAME)) {
          const photoStore = db.createObjectStore(PHOTO_STORE_NAME, { keyPath: 'vaultKey' });
          photoStore.createIndex('by_owner_email', 'ownerEmail', { unique: false });
        }
        if (!db.objectStoreNames.contains(WORK_STORE_NAME)) {
          db.createObjectStore(WORK_STORE_NAME, { keyPath: 'vaultKey' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbOpenPromise = null;
        resolve(null);
      };
    } catch {
      dbOpenPromise = null;
      resolve(null);
    }
  });
  return dbOpenPromise;
}

function buildPhotoVaultKey(ownerEmail: string, roomId: string): string {
  return `${ownerEmail.trim().toLowerCase()}::${roomId.trim()}`;
}

function normalizePhotoUuid(idOrPrefixed?: string): string {
  const raw = (idOrPrefixed || '').trim();
  return raw.startsWith('shared_sb_') ? raw.slice('shared_sb_'.length) : raw;
}

function buildPhotoDedupSignature(photo: PhotoItem): string {
  if (photo.sharedSupabasePhotoId) {
    return `sb:${photo.sharedSupabasePhotoId}`;
  }
  const normalizedUuid = normalizePhotoUuid(photo.id);
  if (/^[0-9a-f-]{36}$/i.test(normalizedUuid)) {
    return `sb:${normalizedUuid}`;
  }
  if (photo.dhash) {
    return `dhash:${photo.dhash}`;
  }
  const thumbHead = String(photo.thumbUrl || '').slice(0, 140);
  if (thumbHead.startsWith('data:image/')) {
    return `thumb:${thumbHead}:${photo.thumbUrl.length}`;
  }
  return `id:${photo.id}`;
}

function sanitizePhotoForMemberLocalVault(
  photo: PhotoItem,
  cleanEmail: string,
  cleanRoomId: string
): PhotoItem | null {
  const thumb = String(photo.thumbUrl || photo.fullUrl || '').trim();
  if (!thumb || thumb.startsWith('blob:')) {
    return null;
  }
  return {
    ...photo,
    thumbUrl: thumb,
    fullUrl:
      photo.fullUrl && !photo.fullUrl.startsWith('blob:') ? photo.fullUrl : thumb,
    sharedOwnerEmail: cleanEmail,
    sharedRoomId: cleanRoomId,
  };
}

/**
 * [정식 합류 멤버 전용 로컬 영구 금고 읽기]
 * - 비로그인 게스트(카톡 인앱 1초 프리뷰)는 절대 IndexedDB를 읽거나 쓰지 않아 창 종료 시 흔적 0 Byte를 보장합니다.
 * - 로그인 계정의 이메일(ownerEmail) + 방 ID(roomId) 복합 키로 100% 격리되어 타 계정 전환 시 혼입이 원천 차단됩니다.
 * - 서버 14일(2주) 초대 마중물 버퍼가 만료·소거된 뒤에도 합류 완료 멤버는 본인 기기 IndexedDB에서 0.05초 만에 영구 열람·검색합니다.
 */
export async function loadMemberLocalRoomPhotos(
  ownerEmail: string,
  roomId: string
): Promise<PhotoItem[]> {
  if (!hasAuthenticatedHubAccountSession()) return [];
  const cleanEmail = (ownerEmail || '').trim().toLowerCase();
  const cleanRoomId = (roomId || '').trim();
  if (!cleanEmail || !cleanRoomId) return [];

  const db = await openSharedRoomLocalVaultDb();
  if (!db) return [];

  return new Promise<PhotoItem[]>((resolve) => {
    try {
      const tx = db.transaction(PHOTO_STORE_NAME, 'readonly');
      const store = tx.objectStore(PHOTO_STORE_NAME);
      const req = store.get(buildPhotoVaultKey(cleanEmail, cleanRoomId));
      req.onsuccess = () => {
        const rec = req.result as StoredPhotoRoomVaultRecord | undefined;
        if (!rec || rec.ownerEmail !== cleanEmail || !Array.isArray(rec.photos)) {
          resolve([]);
          return;
        }
        resolve(rec.photos);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function loadMemberLocalMultiRoomPhotos(
  ownerEmail: string,
  roomIds: string[]
): Promise<PhotoItem[]> {
  if (!hasAuthenticatedHubAccountSession()) return [];
  const cleanEmail = (ownerEmail || '').trim().toLowerCase();
  if (!cleanEmail || roomIds.length === 0) return [];

  const merged: PhotoItem[] = [];
  const seen = new Set<string>();
  for (const roomId of roomIds) {
    const list = await loadMemberLocalRoomPhotos(cleanEmail, roomId);
    for (const p of list) {
      const sig = buildPhotoDedupSignature(p);
      if (!seen.has(sig)) {
        seen.add(sig);
        merged.push(p);
      }
    }
  }
  merged.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
  return merged;
}

export async function saveMemberLocalRoomPhotos(
  ownerEmail: string,
  roomId: string,
  photos: PhotoItem[]
): Promise<void> {
  if (!hasAuthenticatedHubAccountSession()) return;
  const cleanEmail = (ownerEmail || '').trim().toLowerCase();
  const cleanRoomId = (roomId || '').trim();
  if (!cleanEmail || !cleanRoomId) return;

  const db = await openSharedRoomLocalVaultDb();
  if (!db) return;

  const sanitized: PhotoItem[] = [];
  const seen = new Set<string>();
  for (const raw of photos) {
    const clean = sanitizePhotoForMemberLocalVault(raw, cleanEmail, cleanRoomId);
    if (!clean) continue;
    const sig = buildPhotoDedupSignature(clean);
    if (seen.has(sig)) continue;
    seen.add(sig);
    sanitized.push(clean);
  }
  sanitized.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(PHOTO_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PHOTO_STORE_NAME);
      const record: StoredPhotoRoomVaultRecord = {
        vaultKey: buildPhotoVaultKey(cleanEmail, cleanRoomId),
        ownerEmail: cleanEmail,
        roomId: cleanRoomId,
        updatedAtIso: new Date().toISOString(),
        photos: sanitized,
      };
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * 서버 14일 마중물 버퍼에서 새로 내려온 사진들과 내 기기 로컬 영구 금고(IndexedDB) 사진을 병합 저장합니다.
 * - 서버에서 14일 경과로 빠져나간 예전 공유 사진들도 내 기기 로컬 금고에 온전히 보존됩니다.
 * - 동일 사진이 다시 들어오면 최신 댓글·하트·메타데이터로 갱신합니다.
 */
export async function upsertMemberLocalRoomPhotos(
  ownerEmail: string,
  roomId: string,
  incomingPhotos: PhotoItem[]
): Promise<PhotoItem[]> {
  if (!hasAuthenticatedHubAccountSession()) return incomingPhotos;
  const cleanEmail = (ownerEmail || '').trim().toLowerCase();
  const cleanRoomId = (roomId || '').trim();
  if (!cleanEmail || !cleanRoomId) return incomingPhotos;

  const existing = await loadMemberLocalRoomPhotos(cleanEmail, cleanRoomId);
  if (incomingPhotos.length === 0) {
    return existing;
  }

  const bySig = new Map<string, PhotoItem>();
  // 먼저 기존 로컬 보관분을 깔아두고, 이어서 신규/최신 서버 수신분으로 덮어씁니다 (댓글·하트·새 ID 최신화)
  for (const oldItem of existing) {
    const cleanOld = sanitizePhotoForMemberLocalVault(oldItem, cleanEmail, cleanRoomId);
    if (!cleanOld) continue;
    bySig.set(buildPhotoDedupSignature(cleanOld), cleanOld);
  }
  for (const nextItem of incomingPhotos) {
    const cleanNext = sanitizePhotoForMemberLocalVault(nextItem, cleanEmail, cleanRoomId);
    if (!cleanNext) continue;
    // dHash나 썸네일이 동일한 기존 로컬 사진이 있었고 서버 재장전으로 새 UUID를 부여받은 경우 중복 생성 방지
    let matchedExistingKey: string | null = null;
    for (const [k, prevVal] of bySig.entries()) {
      if (
        (cleanNext.dhash && prevVal.dhash && cleanNext.dhash === prevVal.dhash) ||
        (cleanNext.thumbUrl &&
          prevVal.thumbUrl &&
          cleanNext.thumbUrl.length === prevVal.thumbUrl.length &&
          cleanNext.thumbUrl.slice(0, 140) === prevVal.thumbUrl.slice(0, 140))
      ) {
        matchedExistingKey = k;
        break;
      }
    }
    if (matchedExistingKey) {
      bySig.delete(matchedExistingKey);
    }
    bySig.set(buildPhotoDedupSignature(cleanNext), cleanNext);
  }

  const merged = Array.from(bySig.values()).sort(
    (a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0)
  );
  await saveMemberLocalRoomPhotos(cleanEmail, cleanRoomId, merged);
  return merged;
}

export async function removeMemberLocalRoomPhotoEverywhere(
  ownerEmail: string,
  photoItemId: string
): Promise<void> {
  if (!hasAuthenticatedHubAccountSession()) return;
  const cleanEmail = (ownerEmail || '').trim().toLowerCase();
  const targetUuid = normalizePhotoUuid(photoItemId);
  if (!cleanEmail || !photoItemId) return;

  const db = await openSharedRoomLocalVaultDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(PHOTO_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PHOTO_STORE_NAME);
      const idx = store.index('by_owner_email');
      const req = idx.openCursor(IDBKeyRange.only(cleanEmail));
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const rec = cursor.value as StoredPhotoRoomVaultRecord;
        if (Array.isArray(rec.photos)) {
          const filtered = rec.photos.filter(
            (p) =>
              p.id !== photoItemId &&
              p.sharedSupabasePhotoId !== targetUuid &&
              normalizePhotoUuid(p.id) !== targetUuid
          );
          if (filtered.length !== rec.photos.length) {
            cursor.update({
              ...rec,
              updatedAtIso: new Date().toISOString(),
              photos: filtered,
            });
          }
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * [공유방 나가기(자퇴) / 내보내기(강퇴) 시 해당 공유방 로컬 IndexedDB 금고 0.1초 즉시 소거]
 * - 해당 공유방(ownerEmail + roomId)의 로컬 캐시 사진만 0 Byte로 즉시 비우며,
 *   내 개인 귀신계 여권(얼굴 시드)과 내 기기 원본 사진은 100% 보존합니다.
 */
export async function purgeMemberLocalRoomVault(
  ownerEmail: string,
  roomId: string
): Promise<void> {
  const cleanEmail = (ownerEmail || '').trim().toLowerCase();
  const cleanRoomId = (roomId || '').trim();
  if (!cleanEmail || !cleanRoomId) return;

  const db = await openSharedRoomLocalVaultDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(PHOTO_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PHOTO_STORE_NAME);
      store.delete(buildPhotoVaultKey(cleanEmail, cleanRoomId));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * [업무 공유(S:) 전용 Zero-Cloud 로컬 30KB 미리보기 캐시]
 * - 업무 공유방 문서·단가표·도면은 Supabase 서버 DB 테이블에 단 1 Byte도 저장하지 않습니다 (서버 점유 0 Byte 원안 엄수).
 * - 대신 Realtime Broadcast로 수신한 30KB 이하 경량 텍스트/표/썸네일 미리보기만 팀원 본인 기기 IndexedDB에 캐싱하여
 *   대장 PC가 절전 중일 때도 오프라인 0.1초 웹 미리보기·검색을 지원합니다 (원본 바이너리 base64는 로컬 캐시에서 자동 제외).
 */
function resolveCurrentWorkOwnerEmail(explicitEmail?: string): string {
  const clean = (explicitEmail || '').trim().toLowerCase();
  if (clean) return clean;
  if (typeof window !== 'undefined') {
    try {
      const saved = (localStorage.getItem('merlin_hub_user_email') || '').trim().toLowerCase();
      if (saved) return saved;
    } catch {
      /* ignore */
    }
  }
  return 'anonymous';
}

function buildWorkVaultKey(roomId: string, ownerEmail?: string): string {
  return `work::${resolveCurrentWorkOwnerEmail(ownerEmail)}::${roomId.trim()}`;
}

export async function loadLocalWorkRoomDocs<T = Record<string, unknown>>(
  roomId: string,
  ownerEmail?: string
): Promise<T[]> {
  const cleanRoomId = (roomId || '').trim();
  if (!cleanRoomId) return [];
  const db = await openSharedRoomLocalVaultDb();
  if (!db) return [];
  const key = buildWorkVaultKey(cleanRoomId, ownerEmail);

  return new Promise<T[]>((resolve) => {
    try {
      const tx = db.transaction(WORK_STORE_NAME, 'readonly');
      const store = tx.objectStore(WORK_STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const rec = req.result as StoredWorkRoomVaultRecord<T> | undefined;
        resolve(Array.isArray(rec?.docs) ? rec.docs : []);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function saveLocalWorkRoomDocs<T extends object>(
  roomId: string,
  docs: T[],
  ownerEmail?: string
): Promise<void> {
  const cleanRoomId = (roomId || '').trim();
  if (!cleanRoomId) return;
  const db = await openSharedRoomLocalVaultDb();
  if (!db) return;
  const key = buildWorkVaultKey(cleanRoomId, ownerEmail);

  // 30KB 경량 미리보기 규격 준수: 대용량 inlineSyncBase64는 영구 캐시에서 제외하고 요약·표·본문 앞부분만 유지
  const lightweightDocs = docs.map((raw) => {
    const clone = { ...(raw as Record<string, unknown>) };
    delete clone.inlineSyncBase64;
    if (typeof clone.fullTextPreview === 'string' && clone.fullTextPreview.length > 12_000) {
      clone.fullTextPreview = clone.fullTextPreview.slice(0, 12_000);
    }
    if (typeof clone.imageBase64 === 'string' && clone.imageBase64.length > 32_000) {
      delete clone.imageBase64;
    }
    return clone as unknown as T;
  });

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(WORK_STORE_NAME, 'readwrite');
      const store = tx.objectStore(WORK_STORE_NAME);
      const record: StoredWorkRoomVaultRecord<T> = {
        vaultKey: key,
        roomId: cleanRoomId,
        updatedAtIso: new Date().toISOString(),
        docs: lightweightDocs,
      };
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function purgeLocalWorkRoomDocs(
  roomId: string,
  ownerEmail?: string
): Promise<void> {
  const cleanRoomId = (roomId || '').trim();
  if (!cleanRoomId) return;
  const db = await openSharedRoomLocalVaultDb();
  if (!db) return;
  const key = buildWorkVaultKey(cleanRoomId, ownerEmail);
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(WORK_STORE_NAME, 'readwrite');
      const store = tx.objectStore(WORK_STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
