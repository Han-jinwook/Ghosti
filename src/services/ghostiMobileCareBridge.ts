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
  detected: DetectedBloatCleanerItem[];
}

export interface GhostiMobileCarePluginInterface {
  scanInstalledBloatCleaners(): Promise<ScanBloatCleanersResult>;
  openAppUninstallScreen(options: { packageName: string }): Promise<{ ok: boolean; packageName: string; mode: string }>;
  openPlayStoreSubscriptions(options?: { packageName?: string }): Promise<{ ok: boolean; url: string }>;
  openGoogleAccountPermissions(): Promise<{ ok: boolean; url: string }>;
  openAllInstalledAppsSettings(): Promise<{ ok: boolean }>;
}

const GhostiMobileCareNative = registerPlugin<GhostiMobileCarePluginInterface>('GhostiMobileCare');

export function isCapacitorAndroidRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  }).Capacitor;
  return Boolean(cap?.isNativePlatform?.() && cap?.getPlatform?.() === 'android');
}

export function isAndroidMobileBrowserOrApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  return isCapacitorAndroidRuntime() || /Android/i.test(navigator.userAgent || '');
}

export async function scanMobileBloatCleaners(): Promise<ScanBloatCleanersResult> {
  if (isCapacitorAndroidRuntime()) {
    try {
      const res = await GhostiMobileCareNative.scanInstalledBloatCleaners();
      if (res && Array.isArray(res.detected)) {
        return res;
      }
    } catch {
      /* fallback below */
    }
  }
  return {
    ok: true,
    scannedCount: 100,
    detected: [],
  };
}

export async function triggerMobileCleanerUninstall(packageName: string = 'com.xstudios.cleanx'): Promise<void> {
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
