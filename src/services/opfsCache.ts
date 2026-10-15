/**
 * OPFS 영구 모델 캐시 (D-19 설계)
 *
 * Transformers.js의 `env.customCache` 인터페이스(match/put)를 OPFS로 구현.
 * - 최초 실행: Hugging Face에서 받은 모델 파일을 OPFS에 저장
 * - 재실행: 네트워크 없이 OPFS에서 0초대 즉시 읽음
 * - navigator.storage.persist()로 브라우저의 자동 삭제(eviction) 방지
 */

const DIR_NAME = 'saysee-model-cache';
const FALLBACK_CACHE = 'saysee-model-cache-fallback';

export interface CacheStats {
  backend: 'opfs' | 'cache-api';
  hits: Set<string>;
  hitBytes: number;
  puts: number;
  putBytes: number;
  writeMs: number;
}

export const cacheStats: CacheStats = {
  backend: 'opfs',
  hits: new Set(),
  hitBytes: 0,
  puts: 0,
  putBytes: 0,
  writeMs: 0,
};

export function resetCacheStats() {
  cacheStats.hits = new Set();
  cacheStats.hitBytes = 0;
  cacheStats.puts = 0;
  cacheStats.putBytes = 0;
  cacheStats.writeMs = 0;
}

async function keyName(key: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function dir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIR_NAME, { create: true });
}

export function opfsSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;
}

export const opfsCache = {
  async match(key: string): Promise<Response | undefined> {
    try {
      const fh = await (await dir()).getFileHandle(await keyName(key));
      const file = await fh.getFile();
      if (!file.size) return undefined;
      if (!cacheStats.hits.has(key)) {
        cacheStats.hits.add(key);
        cacheStats.hitBytes += file.size;
      }
      return new Response(file, { headers: { 'content-length': String(file.size) } });
    } catch {
      try {
        const c = await caches.open(FALLBACK_CACHE);
        const r = await c.match(key);
        if (r && !cacheStats.hits.has(key)) {
          cacheStats.hits.add(key);
          cacheStats.hitBytes += Number(r.headers.get('content-length') ?? 0);
        }
        return r ?? undefined;
      } catch {
        return undefined;
      }
    }
  },

  async put(key: string, response: Response): Promise<void> {
    const t0 = performance.now();
    const buf = await response.arrayBuffer();
    try {
      const fh = await (await dir()).getFileHandle(await keyName(key), { create: true });
      if (!('createWritable' in fh)) throw new Error('createWritable 미지원');
      const w = await (fh as any).createWritable();
      await w.write(buf);
      await w.close();
      cacheStats.backend = 'opfs';
    } catch {
      const c = await caches.open(FALLBACK_CACHE);
      await c.put(key, new Response(buf, { headers: { 'content-length': String(buf.byteLength) } }));
      cacheStats.backend = 'cache-api';
    }
    cacheStats.puts++;
    cacheStats.putBytes += buf.byteLength;
    cacheStats.writeMs += performance.now() - t0;
  },
};

export async function storageInfo() {
  const persisted = (await navigator.storage?.persisted?.()) ?? false;
  const est = (await navigator.storage?.estimate?.()) ?? {};
  let opfsBytes = 0;
  let opfsFiles = 0;
  try {
    for await (const [, h] of (await dir()) as any) {
      if (h.kind === 'file') {
        opfsFiles++;
        opfsBytes += (await h.getFile()).size;
      }
    }
  } catch {
    /* ignore */
  }
  return { persisted, usage: est.usage ?? 0, quota: est.quota ?? 0, opfsBytes, opfsFiles };
}

export async function requestPersist(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
