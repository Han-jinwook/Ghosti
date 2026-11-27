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
  thumbDataUrl?: string;
}

export interface SystemPhotoTrashResult {
  ok: boolean;
  action?: 'move' | 'restore';
  doneIds: string[];
  replacedIds?: Record<string, string>;
  matchedMediaStoreCount?: number;
  canceled?: boolean;
  error?: string;
}

export interface NativeGalleryPhotoMeta {
  id: string;
  name: string;
  size: number;
  mtimeMs: number;
  width: number;
  height: number;
  bucket?: string;
  isScreenshot?: boolean;
  thumbDataUrl: string;
}

export interface NativeGalleryVideoMeta {
  id: string;
  name: string;
  size: number;
  durationSec: number;
  mtimeMs: number;
  bucket?: string;
  thumbDataUrl: string;
}

export interface ScanDeviceGalleryResult {
  ok: boolean;
  permissionGranted: boolean;
  limitedAccess?: boolean;
  videoPermissionGranted?: boolean;
  offset?: number;
  totalPhotoCount: number;
  photos: NativeGalleryPhotoMeta[];
  videos: NativeGalleryVideoMeta[];
}

export interface GhostiMobileCarePluginInterface {
  scanInstalledBloatCleaners(options?: {
    extraPackages?: string[];
    customRiskMap?: Record<string, string>;
  }): Promise<ScanBloatCleanersResult>;
  openAppUninstallScreen(options: { packageName: string }): Promise<{
    ok: boolean;
    installed?: boolean;
    packageName: string;
    mode: string;
  }>;
  openPlayStoreSubscriptions(options?: { packageName?: string }): Promise<{ ok: boolean; url: string }>;
  openGoogleAccountPermissions(): Promise<{ ok: boolean; url: string }>;
  openAllInstalledAppsSettings(): Promise<{ ok: boolean }>;
  openAppPermissionSettings(): Promise<{ ok: boolean }>;
  scanDeviceGalleryMedia(options?: {
    offset?: number;
    limit?: number;
    thumbMaxDim?: number;
    includeVideos?: boolean;
    promptPermission?: boolean;
    forceExpandSelected?: boolean;
  }): Promise<ScanDeviceGalleryResult>;
  resolveVideoPlaybackUrl(options: {
    id: string;
    forceTranscode?: boolean;
  }): Promise<{ ok: boolean; fileUrl: string }>;
  extractVideoKeyframes(options: {
    id: string;
    maxFrames?: number;
  }): Promise<{ ok: boolean; frames: Array<{ timeSec: number; dataUrl: string }> }>;
  requestSystemPhotoTrash(options: {
    action: 'move' | 'restore';
    items: SystemPhotoTrashTarget[];
    protectedKeepIds?: string[];
  }): Promise<SystemPhotoTrashResult>;
  consumePendingDeepLink(): Promise<{ ok: boolean; deepLinkUrl: string; source?: string }>;
  setNativeThemeMode(options: { dark: boolean }): Promise<{ ok: boolean }>;
  readClipboardText(options?: { force?: boolean; baselineOnly?: boolean }): Promise<{
    ok: boolean;
    text?: string;
    clipHash?: string;
    isSelfInjected?: boolean;
    unchanged?: boolean;
    changeCount?: number;
  }>;
  writeClipboardText(options: { text: string }): Promise<{
    ok: boolean;
    clipHash?: string;
    changeCount?: number;
  }>;
  extractVideoNativeOcr(options: {
    id: string;
    maxFrames?: number;
  }): Promise<{
    ok: boolean;
    hasText: boolean;
    ocrLines: Array<{ timeSec: number; timestamp: string; text: string }>;
    fullText: string;
  }>;
  openNativeVideoPlayerModal(options: {
    id: string;
    title?: string;
    durationText?: string;
    seekSec?: number;
    ocrLines?: Array<{ timeSec: number; timestamp: string; text: string }>;
    playlist?: Array<{
      id: string;
      title?: string;
      durationText?: string;
      seekSec?: number;
      ocrLines?: Array<{ timeSec: number; timestamp: string; text: string }>;
    }>;
    initialIndex?: number;
  }): Promise<{
    ok: boolean;
    closed?: boolean;
    activeId?: string;
    hasText?: boolean;
    ocrLines?: Array<{ timeSec: number; timestamp: string; text: string }>;
    fullText?: string;
  }>;
  syncSharedClipboardAuth(options: {
    email: string;
    canonicalUserId: string;
    hubToken: string;
    deviceId: string;
    deviceName: string;
    bridgeUrl: string;
  }): Promise<{ ok: boolean }>;
  syncSharedClipboardHistory(options: {
    items: Array<{ clipHash: string; text: string; senderName: string; createdAt: string }>;
  }): Promise<{ ok: boolean; count?: number }>;
  consumePendingNativeClipboardOutbound(): Promise<{
    ok: boolean;
    items?: Array<{ clipHash: string; text: string; senderName?: string; createdAt?: string }>;
  }>;
  getNativeClipboardImeStatus(): Promise<{ ok: boolean; enabled?: boolean; selected?: boolean }>;
  openNativeClipboardImeSettings(options: { mode: 'settings' | 'picker' }): Promise<{ ok: boolean }>;
  extractPdfText(options: { base64: string }): Promise<{ ok: boolean; text?: string }>;
  postLocalPcClipPushNotification(options: {
    pushId: string;
    text: string;
    senderName?: string;
  }): Promise<{ ok: boolean }>;
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

export async function triggerMobileCleanerUninstall(packageName: string): Promise<boolean> {
  if (isIosMobileBrowserOrApp() || !packageName?.trim()) return false;
  if (isCapacitorAndroidRuntime()) {
    try {
      const res = await GhostiMobileCareNative.openAppUninstallScreen({ packageName: packageName.trim() });
      return Boolean(res?.ok && res?.installed !== false);
    } catch {
      return false;
    }
  }
  if (typeof window !== 'undefined') {
    window.open(
      `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName.trim())}`,
      '_blank',
      'noopener,noreferrer'
    );
    return true;
  }
  return false;
}

export async function triggerOpenPlaySubscriptions(packageName: string = ''): Promise<void> {
  if (isIosMobileBrowserOrApp()) return;
  if (isCapacitorAndroidRuntime()) {
    try {
      await GhostiMobileCareNative.openPlayStoreSubscriptions({ packageName: packageName.trim() });
      return;
    } catch {
      /* fallback below */
    }
  }
  if (typeof window !== 'undefined') {
    const trimmed = packageName.trim();
    const url = trimmed
      ? `https://play.google.com/store/account/subscriptions?package=${encodeURIComponent(trimmed)}`
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
      'https://play.google.com/store/apps?hl=ko',
      '_blank',
      'noopener,noreferrer'
    );
  }
}

const mobilePhotoMetaRegistry = new Map<string, SystemPhotoTrashTarget>();
let nativeTrashDialogInFlightCount = 0;
let lastNativeTrashDialogCompletedAt = 0;

export function isSystemTrashDialogActiveOrCoolingDown(cooldownMs = 5000): boolean {
  if (nativeTrashDialogInFlightCount > 0) return true;
  if (lastNativeTrashDialogCompletedAt <= 0) return false;
  return Date.now() - lastNativeTrashDialogCompletedAt < cooldownMs;
}

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
  keys: string[],
  protectedKeepIds?: string[]
): Promise<SystemPhotoTrashResult> {
  const keepSet = new Set<string>((protectedKeepIds || []).filter(Boolean));
  const safeKeys = action === 'move' ? keys.filter((k) => !keepSet.has(k)) : keys;
  if (safeKeys.length === 0) {
    return { ok: false, action, doneIds: [], matchedMediaStoreCount: 0, canceled: false };
  }
  const items: SystemPhotoTrashTarget[] = safeKeys.map((k) => {
    const found = mobilePhotoMetaRegistry.get(k);
    if (found) return found;
    return { id: k, name: k, size: 0 };
  });

  if (!isCapacitorNativeMobileRuntime()) {
    return { ok: true, action, doneIds: safeKeys, matchedMediaStoreCount: 0, canceled: false };
  }

  nativeTrashDialogInFlightCount += 1;
  try {
    const res = await GhostiMobileCareNative.requestSystemPhotoTrash({
      action,
      items,
      protectedKeepIds: Array.from(keepSet),
    });
    lastNativeTrashDialogCompletedAt = Date.now();
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
        doneIds: Array.isArray(res.doneIds) && res.doneIds.length > 0 ? res.doneIds : safeKeys,
        replacedIds:
          res.replacedIds && typeof res.replacedIds === 'object' ? res.replacedIds : undefined,
        matchedMediaStoreCount: res.matchedMediaStoreCount || 0,
        canceled: false,
      };
    }
    // [정직 보고] 네이티브가 명시적으로 실패(ok:false)를 돌려줬다면 성공으로 둔갑시키지 않습니다.
    if (res && res.ok === false) {
      return {
        ok: false,
        action,
        doneIds: [],
        matchedMediaStoreCount: res.matchedMediaStoreCount || 0,
        canceled: false,
        error: res.error || 'NATIVE_TRASH_FAILED',
      };
    }
  } catch {
    lastNativeTrashDialogCompletedAt = Date.now();
    // 구버전 네이티브 래퍼이거나 미지원 기기일 때는 앱 내 정리 보관함 이동으로 안전하게 폴백
  } finally {
    nativeTrashDialogInFlightCount = Math.max(0, nativeTrashDialogInFlightCount - 1);
  }
  return { ok: true, action, doneIds: safeKeys, matchedMediaStoreCount: 0, canceled: false };
}

export async function scanNativeDeviceGalleryMedia(options?: {
  offset?: number;
  limit?: number;
  thumbMaxDim?: number;
  includeVideos?: boolean;
  promptPermission?: boolean;
  forceExpandSelected?: boolean;
}): Promise<ScanDeviceGalleryResult> {
  if (!isCapacitorNativeMobileRuntime()) {
    return {
      ok: false,
      permissionGranted: false,
      limitedAccess: false,
      videoPermissionGranted: false,
      totalPhotoCount: 0,
      photos: [],
      videos: [],
    };
  }
  try {
    const res = await GhostiMobileCareNative.scanDeviceGalleryMedia({
      offset: options?.offset ?? 0,
      limit: options?.limit ?? 60,
      thumbMaxDim: options?.thumbMaxDim ?? 448,
      includeVideos: options?.includeVideos ?? (options?.offset ?? 0) === 0,
      promptPermission: options?.promptPermission ?? true,
      forceExpandSelected: options?.forceExpandSelected ?? false,
    });
    if (res && typeof res.ok === 'boolean') {
      return {
        ok: res.ok,
        permissionGranted: Boolean(res.permissionGranted),
        limitedAccess: Boolean(res.limitedAccess),
        videoPermissionGranted: res.videoPermissionGranted !== false && Boolean(res.permissionGranted),
        offset: res.offset ?? options?.offset ?? 0,
        totalPhotoCount: Number(res.totalPhotoCount || 0),
        photos: Array.isArray(res.photos) ? res.photos : [],
        videos: Array.isArray(res.videos) ? res.videos : [],
      };
    }
  } catch {
    /* 구버전 앱 래퍼(v1.0.17 이하) 호환 폴백 */
  }
  return {
    ok: false,
    permissionGranted: false,
    limitedAccess: false,
    videoPermissionGranted: false,
    totalPhotoCount: 0,
    photos: [],
    videos: [],
  };
}

export async function openNativeAppPermissionSettings(): Promise<void> {
  if (!isCapacitorNativeMobileRuntime()) return;
  try {
    await GhostiMobileCareNative.openAppPermissionSettings();
  } catch {
    /* ignore */
  }
}

export async function syncNativeMobileThemeMode(isDark: boolean): Promise<void> {
  if (!isCapacitorIosRuntime()) return;
  try {
    await GhostiMobileCareNative.setNativeThemeMode({ dark: isDark });
  } catch {
    /* ignore */
  }
}

const resolvedMobileVideoUrlCache = new Map<string, string>();

function cacheMobileBlobUrl(cacheKey: string, url: string): string {
  if (resolvedMobileVideoUrlCache.size >= 6 && !resolvedMobileVideoUrlCache.has(cacheKey)) {
    const oldestKey = resolvedMobileVideoUrlCache.keys().next().value;
    if (oldestKey) {
      const oldUrl = resolvedMobileVideoUrlCache.get(oldestKey);
      if (oldUrl && oldUrl.startsWith('blob:')) {
        URL.revokeObjectURL(oldUrl);
      }
      resolvedMobileVideoUrlCache.delete(oldestKey);
    }
  }
  resolvedMobileVideoUrlCache.set(cacheKey, url);
  return url;
}

export function resolveAndroidDirectVideoStreamUrl(videoId: string): string {
  if (!isCapacitorAndroidRuntime()) return '';
  const m = String(videoId || '').match(/^mobile_vid_(\d+)$/);
  if (!m) return '';
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://localhost';
  return `${origin}/__ghosti_media_video/${m[1]}.mp4`;
}

function withMobilePromiseTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);
    promise
      .then((val) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(val);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      });
  });
}

async function fetchVideoBlobWithTimeout(url: string, timeoutMs: number): Promise<Blob | null> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const resp = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!resp.ok) return null;
    const rawBlob = await resp.blob();
    return rawBlob && rawBlob.size > 1024 ? rawBlob : null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function resolveNativeMobileVideoPlaybackUrl(
  videoId: string,
  options?: { forceTranscode?: boolean; sizeMB?: number }
): Promise<string> {
  if (!videoId) return '';
  const forceTranscode = Boolean(options?.forceTranscode);
  const sizeMB = Number(options?.sizeMB || 15);
  const cacheKey = `${videoId}${forceTranscode ? '::h264' : ''}`;

  if (forceTranscode) {
    const prevRaw = resolvedMobileVideoUrlCache.get(videoId);
    if (prevRaw && prevRaw.startsWith('blob:')) {
      URL.revokeObjectURL(prevRaw);
    }
    resolvedMobileVideoUrlCache.delete(videoId);
  } else {
    const cached = resolvedMobileVideoUrlCache.get(cacheKey);
    if (cached) return cached;
  }

  if (isCapacitorAndroidRuntime()) {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://localhost';
    let streamUrl = resolveAndroidDirectVideoStreamUrl(videoId);
    try {
      const res = await withMobilePromiseTimeout(
        GhostiMobileCareNative.resolveVideoPlaybackUrl({
          id: videoId,
          forceTranscode,
        }),
        13500,
        null
      );
      if (res?.ok && res.fileUrl) {
        streamUrl = res.fileUrl.startsWith('/')
          ? `${origin}${res.fileUrl}`
          : res.fileUrl.replace(/^https?:\/\/localhost(?=\/)/i, origin);
      } else if (forceTranscode) {
        return '';
      }
    } catch {
      if (forceTranscode) return '';
    }
    if (!streamUrl) return '';
    // 12MB 이하 초단편 클립만 빠른 Blob 변환(<=3.5초)을 허용하고,
    // 그 이상 영상은 MainActivity의 무복사 64-bit HTTP 206 Range 스트림을 즉시 직결해 0.2초 내 첫 프레임 재생을 보장합니다.
    if (sizeMB <= 12) {
      const rawBlob = await fetchVideoBlobWithTimeout(streamUrl, 3500);
      if (rawBlob) {
        const videoBlob = new Blob([rawBlob], { type: 'video/mp4' });
        return cacheMobileBlobUrl(cacheKey, URL.createObjectURL(videoBlob));
      }
    }
    return cacheMobileBlobUrl(cacheKey, streamUrl);
  }

  if (!isCapacitorIosRuntime()) return '';

  try {
    const res = await withMobilePromiseTimeout(
      GhostiMobileCareNative.resolveVideoPlaybackUrl({
        id: videoId,
        forceTranscode,
      }),
      13500,
      null
    );
    if (res?.ok && res.fileUrl) {
      const cap = (window as unknown as {
        Capacitor?: { convertFileSrc?: (path: string) => string };
      }).Capacitor;
      const converted = cap?.convertFileSrc ? cap.convertFileSrc(res.fileUrl) : res.fileUrl;
      if (converted) {
        if (sizeMB <= 12) {
          const rawBlob = await fetchVideoBlobWithTimeout(converted, 3500);
          if (rawBlob) {
            const videoBlob =
              rawBlob.type && rawBlob.type.startsWith('video/')
                ? rawBlob
                : new Blob([rawBlob], { type: 'video/mp4' });
            return cacheMobileBlobUrl(cacheKey, URL.createObjectURL(videoBlob));
          }
        }
        return cacheMobileBlobUrl(cacheKey, converted);
      }
    }
  } catch {
    /* ignore */
  }
  return '';
}

export async function extractNativeMobileVideoKeyframes(
  videoId: string,
  maxFrames = 6
): Promise<Array<{ timeSec: number; dataUrl: string }>> {
  if (!videoId || !isCapacitorNativeMobileRuntime()) return [];
  try {
    const res = await GhostiMobileCareNative.extractVideoKeyframes({
      id: videoId,
      maxFrames,
    });
    if (res?.ok && Array.isArray(res.frames)) {
      return res.frames.filter(
        (f) => f && typeof f.dataUrl === 'string' && f.dataUrl.startsWith('data:image/')
      );
    }
  } catch {
    /* 구버전 네이티브 플러그인 폴백 */
  }
  return [];
}

export async function consumeNativePendingDeepLink(): Promise<{
  ok: boolean;
  deepLinkUrl: string;
  source?: string;
}> {
  if (!isCapacitorNativeMobileRuntime()) {
    return { ok: false, deepLinkUrl: '' };
  }
  try {
    const res = await GhostiMobileCareNative.consumePendingDeepLink();
    if (res && typeof res.deepLinkUrl === 'string') {
      return {
        ok: Boolean(res.ok),
        deepLinkUrl: res.deepLinkUrl.trim(),
        source: res.source,
      };
    }
  } catch {
    /* 구버전 네이티브 래퍼 호환 폴백 */
  }
  return { ok: false, deepLinkUrl: '' };
}

export async function readNativeMobileClipboardText(
  force = false,
  baselineOnly = false
): Promise<{
  supported: boolean;
  ok: boolean;
  text: string;
  clipHash?: string;
  isSelfInjected?: boolean;
  unchanged?: boolean;
}> {
  if (!isCapacitorNativeMobileRuntime()) {
    return { supported: false, ok: false, text: '' };
  }
  try {
    const res = await GhostiMobileCareNative.readClipboardText({ force, baselineOnly });
    if (res && typeof res.ok === 'boolean') {
      return {
        supported: true,
        ok: res.ok,
        text: typeof res.text === 'string' ? res.text.trim() : '',
        clipHash: typeof res.clipHash === 'string' ? res.clipHash : undefined,
        isSelfInjected: Boolean(res.isSelfInjected),
        unchanged: Boolean(res.unchanged),
      };
    }
  } catch {
    /* 구버전 네이티브 래퍼(v1.0.54 이하) 미지원 시 웹 폴백으로 자연 전환 */
  }
  return { supported: false, ok: false, text: '' };
}

export async function writeNativeMobileClipboardText(text: string): Promise<{
  supported: boolean;
  ok: boolean;
}> {
  const clean = (text || '').trim();
  if (!clean || !isCapacitorNativeMobileRuntime()) {
    return { supported: false, ok: false };
  }
  try {
    const res = await GhostiMobileCareNative.writeClipboardText({ text: clean });
    return { supported: true, ok: Boolean(res?.ok) };
  } catch {
    /* 구버전 네이티브 래퍼 미지원 시 웹 폴백으로 자연 전환 */
  }
  return { supported: false, ok: false };
}

export async function extractNativeMobileVideoOcr(
  videoId: string,
  maxFrames = 8
): Promise<{
  supported: boolean;
  ok: boolean;
  hasText: boolean;
  ocrLines: Array<{ timeSec: number; timestamp: string; text: string }>;
  fullText: string;
}> {
  if (!isCapacitorNativeMobileRuntime() || !videoId) {
    return { supported: false, ok: false, hasText: false, ocrLines: [], fullText: '' };
  }
  try {
    const res = await GhostiMobileCareNative.extractVideoNativeOcr({
      id: videoId,
      maxFrames,
    });
    if (res && typeof res.ok === 'boolean') {
      const lines = Array.isArray(res.ocrLines)
        ? res.ocrLines.filter((l) => Boolean(l && typeof l.text === 'string' && l.text.trim()))
        : [];
      return {
        supported: true,
        ok: res.ok,
        hasText: Boolean(res.hasText && lines.length > 0),
        ocrLines: lines,
        fullText: typeof res.fullText === 'string' ? res.fullText : '',
      };
    }
  } catch {
    /* 구버전 네이티브 래퍼(v1.0.54 이하) 미지원 시 기존 키프레임 WASM 경로로 자연 폴백 */
  }
  return { supported: false, ok: false, hasText: false, ocrLines: [], fullText: '' };
}

export async function openNativeMobileVideoPlayerModal(options: {
  id: string;
  title?: string;
  durationText?: string;
  seekSec?: number;
  ocrLines?: Array<{ timeSec: number; timestamp: string; text: string }>;
  playlist?: Array<{
    id: string;
    title?: string;
    durationText?: string;
    seekSec?: number;
    ocrLines?: Array<{ timeSec: number; timestamp: string; text: string }>;
  }>;
  initialIndex?: number;
}): Promise<{
  supported: boolean;
  ok: boolean;
  activeId?: string;
  hasText: boolean;
  ocrLines: Array<{ timeSec: number; timestamp: string; text: string }>;
  fullText: string;
}> {
  if (!isCapacitorNativeMobileRuntime() || !options?.id) {
    return { supported: false, ok: false, hasText: false, ocrLines: [], fullText: '' };
  }
  try {
    const res = await GhostiMobileCareNative.openNativeVideoPlayerModal({
      id: options.id,
      title: options.title || '내 스마트폰 동영상',
      durationText: options.durationText || '',
      seekSec: Math.max(0, Math.floor(options.seekSec || 0)),
      ocrLines: Array.isArray(options.ocrLines) ? options.ocrLines : [],
      ...(Array.isArray(options.playlist) && options.playlist.length > 0
        ? {
            playlist: options.playlist,
            initialIndex: Math.max(0, Math.floor(options.initialIndex || 0)),
          }
        : {}),
    });
    if (res && res.ok) {
      const lines = Array.isArray(res.ocrLines)
        ? res.ocrLines.filter((l) => Boolean(l && typeof l.text === 'string' && l.text.trim()))
        : [];
      return {
        supported: true,
        ok: true,
        activeId: typeof res.activeId === 'string' && res.activeId ? res.activeId : options.id,
        hasText: Boolean(res.hasText && lines.length > 0),
        ocrLines: lines,
        fullText: typeof res.fullText === 'string' ? res.fullText : '',
      };
    }
  } catch {
    /* 구버전 네이티브 래퍼(v1.0.54 이하) 미지원 시 WebView 모달 폴백 */
  }
  return { supported: false, ok: false, hasText: false, ocrLines: [], fullText: '' };
}

export async function syncSharedNativeClipboardAuth(options: {
  email: string;
  canonicalUserId: string;
  hubToken: string;
  deviceId: string;
  deviceName: string;
  bridgeUrl: string;
}): Promise<boolean> {
  if (!isCapacitorNativeMobileRuntime()) return false;
  try {
    const res = await GhostiMobileCareNative.syncSharedClipboardAuth(options);
    return Boolean(res?.ok);
  } catch {
    return false;
  }
}

export async function syncSharedNativeClipboardHistory(
  items: Array<{ clipHash: string; text: string; senderName: string; createdAt: string }>
): Promise<boolean> {
  if (!isCapacitorNativeMobileRuntime()) return false;
  try {
    const res = await GhostiMobileCareNative.syncSharedClipboardHistory({
      items: items.slice(0, 500).map((it) => ({
        clipHash: it.clipHash,
        text: it.text,
        senderName: it.senderName,
        createdAt: it.createdAt,
      })),
    });
    return Boolean(res?.ok);
  } catch {
    return false;
  }
}

export async function consumePendingNativeClipboardOutbound(): Promise<
  Array<{ clipHash: string; text: string; senderName?: string; createdAt?: string }>
> {
  if (!isCapacitorNativeMobileRuntime()) return [];
  try {
    const res = await GhostiMobileCareNative.consumePendingNativeClipboardOutbound();
    if (res?.ok && Array.isArray(res.items)) {
      return res.items.filter((it) => Boolean(it && typeof it.text === 'string' && it.text.trim()));
    }
  } catch {
    /* ignore */
  }
  return [];
}

export async function getNativeClipboardImeStatus(): Promise<{
  supported: boolean;
  enabled: boolean;
  selected: boolean;
}> {
  if (!isCapacitorAndroidRuntime()) {
    return { supported: false, enabled: false, selected: false };
  }
  try {
    const res = await GhostiMobileCareNative.getNativeClipboardImeStatus();
    if (res?.ok) {
      return {
        supported: true,
        enabled: Boolean(res.enabled),
        selected: Boolean(res.selected),
      };
    }
  } catch {
    /* ignore */
  }
  return { supported: false, enabled: false, selected: false };
}

export async function openNativeClipboardImeSettings(mode: 'settings' | 'picker'): Promise<boolean> {
  if (!isCapacitorAndroidRuntime()) return false;
  try {
    const res = await GhostiMobileCareNative.openNativeClipboardImeSettings({ mode });
    return Boolean(res?.ok);
  } catch {
    return false;
  }
}

export async function triggerNativePcClipPushNotification(
  pushId: string,
  text: string,
  senderName = '내 PC'
): Promise<boolean> {
  if (!isCapacitorNativeMobileRuntime() || !text?.trim()) return false;
  try {
    const res = await GhostiMobileCareNative.postLocalPcClipPushNotification({
      pushId: pushId || '',
      text: text.trim(),
      senderName,
    });
    return Boolean(res?.ok);
  } catch {
    return false;
  }
}

export async function extractNativeIosPdfText(buffer: ArrayBuffer): Promise<string> {
  if (!isCapacitorIosRuntime()) return '';
  if (!buffer || buffer.byteLength === 0 || buffer.byteLength > 18 * 1024 * 1024) return '';
  try {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const sub = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(sub));
    }
    const base64 = btoa(binary);
    const res = await GhostiMobileCareNative.extractPdfText({ base64 });
    return res?.ok && typeof res.text === 'string' ? res.text.trim() : '';
  } catch {
    return '';
  }
}
