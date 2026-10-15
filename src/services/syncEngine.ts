/**
 * 듀얼 동기화 엔진 (D-05, Q4 확정 반영)
 * - 기본값: Supabase 경량 WebP 썸네일 + 768차원 벡터 메타데이터 동기화
 * - 프라이버시 옵션: 로컬 P2P (WiFi 다이렉트, SaySee-Mesh) 100% 무서버 동기화
 */
import type { SyncMode, SyncState } from '../types/saysee';

const SYNC_STORAGE_KEY = 'saysee_sync_prefs';

export function loadSyncState(photoCount: number, totalBytes: number): SyncState {
  let saved: Partial<SyncState> = {};
  try {
    const raw = localStorage.getItem(SYNC_STORAGE_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch {
    /* ignore */
  }

  // 장당 약 13KB (WebP 썸네일 10KB + 768차원 양자화 벡터 3KB)
  const packSizeMB = +Math.max(1.2, (photoCount * 13) / 1024).toFixed(1);
  const originalSizeGB = +Math.max(0.1, totalBytes / 1024 / 1024 / 1024).toFixed(2);

  return {
    mode: saved.mode ?? 'p2p-wifi',
    wifiOnly: saved.wifiOnly ?? true,
    connectedPeer: saved.connectedPeer ?? 'Galaxy S24 Ultra / iPhone 15 Pro (PWA)',
    lastSyncedAt: saved.lastSyncedAt ?? '방금 전',
    packSizeMB,
    originalSizeGB,
    syncing: false,
  };
}

export function saveSyncPrefs(mode: SyncMode, wifiOnly: boolean) {
  try {
    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify({ mode, wifiOnly, lastSyncedAt: '방금 전' }));
  } catch {
    /* ignore */
  }
}
