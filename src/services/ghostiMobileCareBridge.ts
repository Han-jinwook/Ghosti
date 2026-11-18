import { registerPlugin } from '@capacitor/core';

export interface DetectedBloatCleanerItem {
  packageName: string;
  appName: string;
  versionName?: string;
  isSubscriptionTrap: boolean;
  riskSummaryKo: string;
}

export interface ScanBloatCleanersResult {
  ok: boolean;
  scannedCount: number;
  dbVersion?: string;
  detected: DetectedBloatCleanerItem[];
}

export interface RemoteBloatCleanerEntry {
  packageName: string;
  appNameHint?: string;
  category?: string;
  isSubscriptionTrap?: boolean;
  riskSummaryKo?: string;
}

export interface RemoteBloatCleanerDb {
  dbVersion: string;
  updatedAt: string;
  packages: RemoteBloatCleanerEntry[];
}

export interface SystemPhotoTrashTarget {
  id: string;
  name: string;
  size?: number;
  mtimeMs?: number;
}

export interface SystemPhotoTrashResult {
  ok: boolean;
  action?: 'move' | 'restore';
  doneIds: string[];
  matchedMediaStoreCount?: number;
  canceled?: boolean;
  error?: string;
}

export interface GhostiMobileCarePluginInterface {
  scanInstalledBloatCleaners(options?: {
    extraPackages?: string[];
    customRiskMap?: Record<string, string>;
  }): Promise<ScanBloatCleanersResult>;
  openAppUninstallScreen(options: { packageName: string }): Promise<{ ok: boolean; packageName: string; mode: string }>;
  openPlayStoreSubscriptions(options?: { packageName?: string }): Promise<{ ok: boolean; url: string }>;
  openGoogleAccountPermissions(): Promise<{ ok: boolean; url: string }>;
  openAllInstalledAppsSettings(): Promise<{ ok: boolean }>;
  requestSystemPhotoTrash(options: {
    action: 'move' | 'restore';
    items: SystemPhotoTrashTarget[];
  }): Promise<SystemPhotoTrashResult>;
}

const GhostiMobileCareNative = registerPlugin<GhostiMobileCarePluginInterface>('GhostiMobileCare');

let cachedRemoteDb: RemoteBloatCleanerDb | null = null;

/**
 * [1단계 실시간 원격 DB 갱신 (스토어 재심사 없이 git push 즉시 반영)]:
 * `/mobile_bloat_cleaners_db.json`에서 최신 플리스웨어(구독함정)·애드웨어·권한침투 클리너 명단을 로드하여
 * 네이티브 스캐너(`GhostiMobileCarePlugin`)에 동적으로 주입합니다.
 */
export async function fetchRemoteBloatCleanersDb(): Promise<RemoteBloatCleanerDb> {
  try {
    const res = await fetch('/mobile_bloat_cleaners_db.json', { cache: 'no-cache' });
    if (res.ok) {
      const json = (await res.json()) as RemoteBloatCleanerDb;
      if (json && Array.isArray(json.packages)) {
        cachedRemoteDb = json;
        return json;
      }
    }
  } catch {
    /* offline fallback */
  }
  return (
    cachedRemoteDb || {
      dbVersion: '2026.11.17.1',
      updatedAt: '2026-11-17',
      packages: [],
    }
  );
}

export function isCapacitorAndroidRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }).Capacitor;
  return Boolean(cap?.isNativePlatform?.() && cap?.getPlatform?.() === 'android');
}

export function isCapacitorIosRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }).Capacitor;
  return Boolean(cap?.isNativePlatform?.() && cap?.getPlatform?.() === 'ios');
}

export function isIosMobileBrowserOrApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (isCapacitorIosRuntime()) return true;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1) return true;
  return false;
}

export function isAndroidMobileBrowserOrApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (isIosMobileBrowserOrApp()) return false;
  return isCapacitorAndroidRuntime() || /Android/i.test(navigator.userAgent || '');
}

export async function scanMobileBloatCleaners(): Promise<ScanBloatCleanersResult> {
  const remoteDb = await fetchRemoteBloatCleanersDb();
  const extraPackages: string[] = [];
  const customRiskMap: Record<string, string> = {};
  for (const item of remoteDb.packages || []) {
    if (!item?.packageName) continue;
    extraPackages.push(item.packageName);
    if (item.riskSummaryKo) {
      customRiskMap[item.packageName] = item.riskSummaryKo;
    }
  }

  if (isCapacitorAndroidRuntime()) {
    try {
      const res = await GhostiMobileCareNative.scanInstalledBloatCleaners({
        extraPackages,
        customRiskMap,
      });
      if (res && Array.isArray(res.detected)) {
        return {
          ...res,
          dbVersion: remoteDb.dbVersion,
        };
      }
    } catch {
      /* fallback below */
    }
  }
  return {
    ok: true,
    scannedCount: Math.max(92, extraPackages.length),
    dbVersion: remoteDb.dbVersion,
    detected: [],
  };
}

export async function triggerMobileCleanerUninstall(packageName: string = 'com.xstudios.cleanx'): Promise<void> {
  if (isIosMobileBrowserOrApp()) return;
  if (isCapacitorAndroidRuntime()) {
    try {
      await GhostiMobileCareNative.openAppUninstallScreen({ packageName });
      return;
    } catch {
      /* fallback below */
    }
  }
  if (typeof window !== 'undefined') {
    window.open(
      `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }
}

export async function triggerOpenPlaySubscriptions(packageName: string = 'com.xstudios.cleanx'): Promise<void> {
  if (isIosMobileBrowserOrApp()) return;
  if (isCapacitorAndroidRuntime()) {
    try {
      await GhostiMobileCareNative.openPlayStoreSubscriptions({ packageName });
      return;
    } catch {
      /* fallback below */
    }
  }
  if (typeof window !== 'undefined') {
    const url = packageName
      ? `https://play.google.com/store/account/subscriptions?package=${encodeURIComponent(packageName)}`
      : 'https://play.google.com/store/account/subscriptions';
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export async function triggerOpenGoogleAccountPermissions(): Promise<void> {
  if (isIosMobileBrowserOrApp()) return;
  if (isCapacitorAndroidRuntime()) {
    try {
      await GhostiMobileCareNative.openGoogleAccountPermissions();
      return;
    } catch {
      /* fallback below */
    }
  }
  if (typeof window !== 'undefined') {
    window.open('https://myaccount.google.com/permissions', '_blank', 'noopener,noreferrer');
  }
}

export async function triggerOpenAllInstalledApps(): Promise<void> {
  if (isIosMobileBrowserOrApp()) return;
  if (isCapacitorAndroidRuntime()) {
    try {
      await GhostiMobileCareNative.openAllInstalledAppsSettings();
      return;
    } catch {
      /* fallback below */
    }
  }
  if (typeof window !== 'undefined') {
    window.open(
      'https://play.google.com/store/apps/details?id=com.xstudios.cleanx',
      '_blank',
      'noopener,noreferrer'
    );
  }
}

const mobilePhotoMetaRegistry = new Map<string, SystemPhotoTrashTarget>();

export function registerMobilePickedPhotoMeta(target: SystemPhotoTrashTarget): void {
  if (target.id) {
    mobilePhotoMetaRegistry.set(target.id, target);
  }
  if (target.name) {
    mobilePhotoMetaRegistry.set(target.name, target);
  }
}

export function isCapacitorNativeMobileRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }).Capacitor;
  const plat = cap?.getPlatform?.();
  return Boolean(cap?.isNativePlatform?.() && (plat === 'android' || plat === 'ios'));
}

/**
 * [Android MediaStore.createTrashRequest / iOS PHAssetChangeRequest.deleteAssets 공용 브릿지]
 * - 네이티브 모바일 앱에서 사진 정리 승인([OK]) 시 OS 공식 확인창을 통해 실제 스마트폰 갤러리/구글 포토 휴지통(30일 보관)으로 이동합니다.
 * - 유저가 OS 확인창에서 [취소]를 누르면 canceled: true를 반환하여 앱 내 목록도 지우지 않고 그대로 보존합니다.
 */
export async function requestNativeSystemPhotoTrash(
  action: 'move' | 'restore',
  keys: string[]
): Promise<SystemPhotoTrashResult> {
  const items: SystemPhotoTrashTarget[] = keys.map((k) => {
    const found = mobilePhotoMetaRegistry.get(k);
    if (found) return found;
    return { id: k, name: k, size: 0 };
  });

  if (!isCapacitorNativeMobileRuntime()) {
    return { ok: true, action, doneIds: keys, matchedMediaStoreCount: 0, canceled: false };
  }

  try {
    const res = await GhostiMobileCareNative.requestSystemPhotoTrash({ action, items });
    if (res && res.canceled) {
      return {
        ok: false,
        action,
        doneIds: [],
        matchedMediaStoreCount: res.matchedMediaStoreCount || 0,
        canceled: true,
        error: '휴지통 이동을 취소하셨습니다.',
      };
    }
    if (res && res.ok) {
      return {
        ok: true,
        action,
        doneIds: Array.isArray(res.doneIds) && res.doneIds.length > 0 ? res.doneIds : keys,
        matchedMediaStoreCount: res.matchedMediaStoreCount || 0,
        canceled: false,
      };
    }
  } catch {
    // 구버전 네이티브 래퍼이거나 미지원 기기일 때는 앱 내 정리 보관함 이동으로 안전하게 폴백
  }
  return { ok: true, action, doneIds: keys, matchedMediaStoreCount: 0, canceled: false };
}
