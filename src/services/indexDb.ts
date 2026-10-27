import { openDB, type IDBPDatabase } from 'idb';
import type { PhotoItem, TrashCategory } from '../types/saysee';

const DB_NAME = 'ghosti-local-vault-v1';
const STORE_PHOTOS = 'photos';
const STORE_META = 'meta';

export interface StoredPhotoRecord {
  id: string;
  name: string;
  size: number;
  date: string;
  mtimeMs: number;
  tags: string[];
  trashCategory?: TrashCategory;
  trashConfidence?: number;
  quarantined?: boolean;
  queuedForQuarantine?: boolean;
  bookmarked?: boolean;
  vecBuffer?: ArrayBufferLike;
  presetScores?: Record<string, number>;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
          db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META);
        }
      },
    });
  }
  return dbPromise;
}

export async function savePhotoToIdb(photo: PhotoItem): Promise<void> {
  try {
    const db = await getDb();
    const record: StoredPhotoRecord = {
      id: photo.id,
      name: photo.name,
      size: photo.size,
      date: photo.date,
      mtimeMs: photo.mtimeMs,
      tags: photo.tags,
      trashCategory: photo.trashCategory,
      trashConfidence: photo.trashConfidence,
      quarantined: photo.quarantined,
      queuedForQuarantine: photo.queuedForQuarantine,
      bookmarked: photo.bookmarked,
      vecBuffer: photo.vec ? photo.vec.buffer.slice(0) : undefined,
      presetScores: photo.presetScores,
    };
    await db.put(STORE_PHOTOS, record);
  } catch {
    /* ignore idb quota errors */
  }
}

export async function savePhotosBatchToIdb(photos: PhotoItem[]): Promise<void> {
  try {
    const db = await getDb();
    const tx = db.transaction(STORE_PHOTOS, 'readwrite');
    for (const photo of photos) {
      const record: StoredPhotoRecord = {
        id: photo.id,
        name: photo.name,
        size: photo.size,
        date: photo.date,
        mtimeMs: photo.mtimeMs,
        tags: photo.tags,
        trashCategory: photo.trashCategory,
        trashConfidence: photo.trashConfidence,
        quarantined: photo.quarantined,
        queuedForQuarantine: photo.queuedForQuarantine,
        bookmarked: photo.bookmarked,
        vecBuffer: photo.vec ? photo.vec.buffer.slice(0) : undefined,
        presetScores: photo.presetScores,
      };
      tx.store.put(record);
    }
    await tx.done;
  } catch {
    /* ignore */
  }
}

export async function loadPhotosFromIdb(): Promise<Map<string, StoredPhotoRecord>> {
  const map = new Map<string, StoredPhotoRecord>();
  try {
    const db = await getDb();
    const all = (await db.getAll(STORE_PHOTOS)) as StoredPhotoRecord[];
    for (const r of all) {
      map.set(r.id, r);
    }
  } catch {
    /* ignore */
  }
  return map;
}

export async function setMetaValue(key: string, val: any): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE_META, val, key);
  } catch {
    /* ignore */
  }
}

export async function getMetaValue<T>(key: string): Promise<T | undefined> {
  try {
    const db = await getDb();
    return await db.get(STORE_META, key);
  } catch {
    return undefined;
  }
}
