import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { LocalDocumentFile, PhotoItem, PrivateSyncStrategy } from '../types/saysee';
import {
  callGhostiServerBridge,
  ensureGhostiPublicSupabaseClient,
  hasAuthenticatedHubAccountSession,
  readGhostiAuthedJwtClaims,
  resolveHubSupabaseBridgeEndpoint,
  supabase,
} from './supabaseClient';
import { getSessionToken } from './merlin-hub-sdk/CoreLogic/client';
import {
  consumePendingNativeClipboardOutbound,
  isCapacitorAndroidRuntime,
  isCapacitorNativeMobileRuntime,
  readNativeMobileClipboardText,
  syncSharedNativeClipboardAuth,
  syncSharedNativeClipboardHistory,
  writeNativeMobileClipboardText,
} from './ghostiMobileCareBridge';
import { getZCoreUrl, zCoreBridge } from './zCoreBridge';

export interface GhostiConnectedDeviceDto {
  device_id: string;
  owner_email: string;
  device_kind: 'pc_master' | 'mobile';
  display_name: string;
  platform: 'windows' | 'macos' | 'android' | 'ios' | 'web';
  app_version?: string;
  last_seen_at: string;
}

export interface GhostiDeviceEntitlementView {
  planId: string;
  trialOptInStartedAt: string | null;
  activatedAt: string | null;
  paidExpiresAt?: string | null;
  lastOrderId?: string | null;
  activeDeviceCount: number;
  trialActive: boolean;
  trialDaysLeft: number;
  trialExpired?: boolean;
  isPaidUnlimited: boolean;
  paidDaysLeft?: number;
  workPlanId?: string | null;
  workTrialOptInStartedAt?: string | null;
  workTrialActive?: boolean;
  workTrialDaysLeft?: number;
  workTrialExpired?: boolean;
  workPaidExpiresAt?: string | null;
  workPaidActive?: boolean;
  workPaidDaysLeft?: number;
  workSubscriptionUnlocked?: boolean;
  workSeatLimit?: number;
  ghostkeyPlanId?: string | null;
  ghostkeyTrialOptInStartedAt?: string | null;
  ghostkeyTrialActive?: boolean;
  ghostkeyTrialDaysLeft?: number;
  ghostkeyTrialExpired?: boolean;
  ghostkeyPaidExpiresAt?: string | null;
  ghostkeyPaidActive?: boolean;
  ghostkeyPaidDaysLeft?: number;
  ghostkeySubscriptionUnlocked?: boolean;
  ocrAndLabelerUnlocked?: boolean;
  unlimitedBindingUnlocked: boolean;
}

export interface GhostiSyncedClipItem {
  clipHash: string;
  text: string;
  senderDeviceId: string;
  senderName: string;
  createdAt: string;
  encryptedE2ee: true;
}

export interface GhostiShadowCatalogItem {
  id: string;
  kind: 'photo' | 'doc';
  title: string;
  thumbWebp?: string;
  keywords: string[];
  ocrSnippet: string;
  shotDate: string;
  sourceDeviceId: string;
  sourceDeviceName: string;
  byteSize: number;
  sha256: string;
  hasMirrorBlob: boolean;
  syncedAt: string;
}

export interface RemoteMonitorCastPacket {
  active: boolean;
  photoIndex: number;
  zoom: number;
  rotation: number;
  isPlaying: boolean;
  updatedAt: number;
  senderDevice: string;
  photoId?: string;
  photoTitle?: string;
  photoThumbUrl?: string;
}

const THIS_DEVICE_ID_KEY = 'ghosti_this_device_uuid_v1';
const SCOPED_DEVICE_ID_PREFIX = 'ghosti_this_device_uuid_v2::';
const LEGACY_DEVICE_ID_OWNER_KEY = 'ghosti_legacy_device_uuid_owner_v1';
const DELIVERED_ENVELOPES_PREFIX = 'ghosti_delivered_clip_envelopes_v1::';
const CACHED_RECEIVED_CLIPS_PREFIX = 'ghosti_received_e2ee_clips_v2::';
const CACHED_DEVICE_SNAPSHOT_PREFIX = 'ghosti_device_integration_cache_v1::';
const CANONICAL_E2EE_UID_PREFIX = 'ghosti_e2ee_canonical_uid_v1::';
const LAST_SYNCED_OS_CLIP_HASH_PREFIX = 'ghosti_last_synced_os_clip_hash_v1::';
const PENDING_PAIR_CODE_SESSION_KEY = 'ghosti_pending_pair_code_v1';
const DEVICE_SYNC_BROADCAST_CHANNEL = 'ghosti_device_sync_bus_v1';

const canonicalUidMemoryCache = new Map<string, string>();
let thisDeviceRevokedLocally = false;

export function isThisDeviceRevokedLocally(): boolean {
  return thisDeviceRevokedLocally;
}

export function setThisDeviceRevokedLocally(revoked: boolean): void {
  thisDeviceRevokedLocally = Boolean(revoked);
}

export function savePendingQrPairCode(code: string): void {
  const clean = (code || '').replace(/\D/g, '').slice(0, 6);
  if (clean.length !== 6 || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(PENDING_PAIR_CODE_SESSION_KEY, clean);
  } catch {
    /* ignore */
  }
}

export function readPendingQrPairCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = (sessionStorage.getItem(PENDING_PAIR_CODE_SESSION_KEY) || '').replace(/\D/g, '').slice(0, 6);
    return raw.length === 6 ? raw : null;
  } catch {
    return null;
  }
}

const LAST_QR_PAIR_RESULT_KEY = 'ghosti_last_qr_pair_result_v1';

export interface StoredQrPairResult {
  code: string;
  ok: boolean;
  reason?: string;
  expectedEmailHint?: string;
  ts: number;
}

export function saveLastQrPairResult(result: Omit<StoredQrPairResult, 'ts'>): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      LAST_QR_PAIR_RESULT_KEY,
      JSON.stringify({ ...result, ts: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

export function readLastQrPairResult(expectedCode?: string): StoredQrPairResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(LAST_QR_PAIR_RESULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredQrPairResult>;
    if (!parsed || typeof parsed.ts !== 'number' || Date.now() - parsed.ts > 120_000) {
      sessionStorage.removeItem(LAST_QR_PAIR_RESULT_KEY);
      return null;
    }
    if (expectedCode && parsed.code && parsed.code !== expectedCode) return null;
    return {
      code: String(parsed.code || ''),
      ok: Boolean(parsed.ok),
      reason: parsed.reason,
      expectedEmailHint: parsed.expectedEmailHint,
      ts: parsed.ts,
    };
  } catch {
    return null;
  }
}

export function clearLastQrPairResult(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(LAST_QR_PAIR_RESULT_KEY);
  } catch {
    /* ignore */
  }
}

export function clearPendingQrPairCode(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PENDING_PAIR_CODE_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function saveCanonicalE2eeUid(email: string, uid: string): void {
  const normEmail = (email || '').trim().toLowerCase();
  const normUid = (uid || '').trim();
  if (!normEmail || !normUid) return;
  canonicalUidMemoryCache.set(normEmail, normUid);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${CANONICAL_E2EE_UID_PREFIX}${normEmail}`, normUid);
    } catch {
      /* ignore */
    }
  }
}

function loadCanonicalE2eeUid(email?: string): string {
  const normEmail = (
    email ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('ghosti_hub_user_email') || localStorage.getItem('userEmail') || ''
      : '')
  )
    .trim()
    .toLowerCase();
  if (!normEmail) return '';
  const mem = canonicalUidMemoryCache.get(normEmail);
  if (mem) return mem;
  if (typeof window !== 'undefined') {
    try {
      const saved = (localStorage.getItem(`${CANONICAL_E2EE_UID_PREFIX}${normEmail}`) || '').trim();
      if (saved) {
        canonicalUidMemoryCache.set(normEmail, saved);
        return saved;
      }
    } catch {
      /* ignore */
    }
  }
  return '';
}

export interface CachedDeviceIntegrationSnapshot {
  devices: GhostiConnectedDeviceDto[];
  pairingCode: string | null;
  entitlement: GhostiDeviceEntitlementView | null;
  updatedAt: number;
}

function resolveScopedDeviceSnapshotKey(explicitEmail?: string): string | null {
  if (typeof window === 'undefined') return null;
  if (!explicitEmail && !hasAuthenticatedHubAccountSession()) return null;
  try {
    const email = (
      explicitEmail ||
      localStorage.getItem('ghosti_hub_user_email') ||
      localStorage.getItem('userEmail') ||
      ''
    )
      .trim()
      .toLowerCase();
    return email ? `${CACHED_DEVICE_SNAPSHOT_PREFIX}${email}` : null;
  } catch {
    return null;
  }
}

export function loadCachedDeviceIntegrationSnapshot(
  explicitEmail?: string
): CachedDeviceIntegrationSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = resolveScopedDeviceSnapshotKey(explicitEmail);
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedDeviceIntegrationSnapshot>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      devices: Array.isArray(parsed.devices) ? parsed.devices : [],
      pairingCode: typeof parsed.pairingCode === 'string' ? parsed.pairingCode : null,
      entitlement: parsed.entitlement ?? null,
      updatedAt: Number(parsed.updatedAt || 0),
    };
  } catch {
    return null;
  }
}

export function saveCachedDeviceIntegrationSnapshot(
  patch: Partial<CachedDeviceIntegrationSnapshot>,
  explicitEmail?: string
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = resolveScopedDeviceSnapshotKey(explicitEmail);
    if (!key) return;
    const prev = loadCachedDeviceIntegrationSnapshot(explicitEmail);
    const next: CachedDeviceIntegrationSnapshot = {
      devices: patch.devices !== undefined ? patch.devices : prev?.devices || [],
      pairingCode: patch.pairingCode !== undefined ? patch.pairingCode : prev?.pairingCode ?? null,
      entitlement: patch.entitlement !== undefined ? patch.entitlement : prev?.entitlement ?? null,
      updatedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function buildOptimisticTrialEntitlement(
  prev: GhostiDeviceEntitlementView | null | undefined,
  activeDeviceCount: number
): GhostiDeviceEntitlementView {
  const nowIso = new Date().toISOString();
  const isPaidUnlimited = Boolean(prev?.isPaidUnlimited);
  const trialDaysLeft =
    prev?.trialActive && typeof prev.trialDaysLeft === 'number' && prev.trialDaysLeft > 0
      ? prev.trialDaysLeft
      : 30;
  return {
    planId: prev?.planId || 'free_trial',
    trialOptInStartedAt: prev?.trialOptInStartedAt || nowIso,
    activatedAt: prev?.activatedAt ?? null,
    activeDeviceCount: Math.max(1, activeDeviceCount),
    trialActive: !isPaidUnlimited,
    trialDaysLeft: isPaidUnlimited ? 0 : trialDaysLeft,
    isPaidUnlimited,
    unlimitedBindingUnlocked: true,
  };
}

const uploadedMirrorHashes = new Set<string>();
const loadedUploadedMirrorEmails = new Set<string>();
const packedThumbCache = new Map<string, string>();
const UPLOADED_MIRROR_CACHE_PREFIX = 'ghosti_uploaded_mirror_hashes_v1::';
const SYNCED_CATALOG_SIGS_PREFIX = 'ghosti_synced_catalog_sigs_v1::';
const syncedCatalogSigsByEmail = new Map<string, Set<string>>();

function getSyncedCatalogSigSet(email?: string): Set<string> {
  const normEmail = (
    email ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('ghosti_hub_user_email') || localStorage.getItem('userEmail') || ''
      : '')
  )
    .trim()
    .toLowerCase();
  if (!normEmail) return new Set<string>();
  const existing = syncedCatalogSigsByEmail.get(normEmail);
  if (existing) return existing;
  const loaded = new Set<string>();
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`${SYNCED_CATALOG_SIGS_PREFIX}${normEmail}`);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          for (const s of arr.slice(-4000)) {
            if (typeof s === 'string' && s) loaded.add(s);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
  syncedCatalogSigsByEmail.set(normEmail, loaded);
  return loaded;
}

function persistSyncedCatalogSigSet(email?: string): void {
  if (typeof window === 'undefined') return;
  const normEmail = (
    email ||
    localStorage.getItem('ghosti_hub_user_email') ||
    localStorage.getItem('userEmail') ||
    ''
  )
    .trim()
    .toLowerCase();
  if (!normEmail) return;
  const set = syncedCatalogSigsByEmail.get(normEmail);
  if (!set) return;
  try {
    const recent = Array.from(set).slice(-4000);
    localStorage.setItem(`${SYNCED_CATALOG_SIGS_PREFIX}${normEmail}`, JSON.stringify(recent));
  } catch {
    /* ignore */
  }
}
const pulledMirrorHashes = new Set<string>();
const loadedEnvelopeEmails = new Set<string>();
const osInjectedEnvelopeKeys = new Set<string>();

function loadPersistedUploadedMirrorHashes(email?: string): void {
  if (typeof window === 'undefined') return;
  const normEmail = (
    email ||
    localStorage.getItem('ghosti_hub_user_email') ||
    localStorage.getItem('userEmail') ||
    ''
  )
    .trim()
    .toLowerCase();
  if (!normEmail || loadedUploadedMirrorEmails.has(normEmail)) return;
  loadedUploadedMirrorEmails.add(normEmail);
  try {
    const raw = localStorage.getItem(`${UPLOADED_MIRROR_CACHE_PREFIX}${normEmail}`);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      for (const h of arr.slice(-5000)) {
        if (typeof h === 'string' && h) uploadedMirrorHashes.add(h);
      }
    }
  } catch {
    /* ignore */
  }
}

function persistUploadedMirrorHashes(email?: string): void {
  if (typeof window === 'undefined') return;
  const normEmail = (
    email ||
    localStorage.getItem('ghosti_hub_user_email') ||
    localStorage.getItem('userEmail') ||
    ''
  )
    .trim()
    .toLowerCase();
  if (!normEmail) return;
  try {
    const recent = Array.from(uploadedMirrorHashes).slice(-5000);
    localStorage.setItem(`${UPLOADED_MIRROR_CACHE_PREFIX}${normEmail}`, JSON.stringify(recent));
  } catch {
    /* ignore */
  }
}

function resolveScopedClipStorageKey(explicitEmail?: string): string | null {
  if (typeof window === 'undefined' || !hasAuthenticatedHubAccountSession()) return null;
  try {
    const email = (
      explicitEmail ||
      localStorage.getItem('ghosti_hub_user_email') ||
      localStorage.getItem('userEmail') ||
      ''
    )
      .trim()
      .toLowerCase();
    return email ? `${CACHED_RECEIVED_CLIPS_PREFIX}${email}` : null;
  } catch {
    return null;
  }
}

function loadDeliveredEnvelopesOnce(email?: string): void {
  if (typeof window === 'undefined') return;
  const normEmail = (
    email ||
    localStorage.getItem('ghosti_hub_user_email') ||
    localStorage.getItem('userEmail') ||
    ''
  )
    .trim()
    .toLowerCase();
  if (!normEmail || loadedEnvelopeEmails.has(normEmail)) return;
  loadedEnvelopeEmails.add(normEmail);
  try {
    // 구형 해시 영구 차단 키는 동일 문구 재복사 시 OS 주입을 막던 결함 원인이므로 소거
    localStorage.removeItem('ghosti_seen_clip_hashes_v1');
    const raw = localStorage.getItem(`${DELIVERED_ENVELOPES_PREFIX}${normEmail}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const k of arr.slice(-80)) {
          if (typeof k === 'string' && k) {
            deliveredRemoteEnvelopeKeys.add(k);
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
}

function rememberDeliveredEnvelope(envKey: string, email?: string): void {
  if (!envKey) return;
  deliveredRemoteEnvelopeKeys.add(envKey);
  if (typeof window === 'undefined') return;
  const normEmail = (
    email ||
    localStorage.getItem('ghosti_hub_user_email') ||
    localStorage.getItem('userEmail') ||
    ''
  )
    .trim()
    .toLowerCase();
  if (!normEmail) return;
  try {
    const recent = Array.from(deliveredRemoteEnvelopeKeys).slice(-80);
    localStorage.setItem(`${DELIVERED_ENVELOPES_PREFIX}${normEmail}`, JSON.stringify(recent));
  } catch {
    /* ignore */
  }
}

export const SYNCED_CLIPBOARD_RETENTION_MS = 7 * 24 * 3600 * 1000; // 7일(168시간) 보관 통일
export const SYNCED_CLIPBOARD_MAX_ITEMS = 500;

export function pruneSyncedClipsToSevenDays(items: GhostiSyncedClipItem[]): GhostiSyncedClipItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const cutoffMs = Date.now() - SYNCED_CLIPBOARD_RETENTION_MS;
  const seen = new Set<string>();
  const out: GhostiSyncedClipItem[] = [];
  for (const it of items) {
    if (!it || typeof it.text !== 'string' || !it.text.trim()) continue;
    const ts = Date.parse(it.createdAt || '');
    if (Number.isFinite(ts) && ts > 0 && ts < cutoffMs) continue;
    const key = it.clipHash || it.text;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
    if (out.length >= SYNCED_CLIPBOARD_MAX_ITEMS) break;
  }
  return out;
}

export function loadCachedSyncedClips(explicitEmail?: string): GhostiSyncedClipItem[] {
  if (typeof window === 'undefined') return [];
  try {
    // 구형 무격리 전역 키 즉시 소거 (계정 간 클립보드 혼입 방지)
    localStorage.removeItem('ghosti_received_e2ee_clips_v1');
    const scopedKey = resolveScopedClipStorageKey(explicitEmail);
    if (!scopedKey) return [];
    const raw = localStorage.getItem(scopedKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? pruneSyncedClipsToSevenDays(parsed as GhostiSyncedClipItem[]) : [];
  } catch {
    return [];
  }
}

function saveCachedSyncedClips(items: GhostiSyncedClipItem[], explicitEmail?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const scopedKey = resolveScopedClipStorageKey(explicitEmail);
    if (!scopedKey) return;
    const pruned = pruneSyncedClipsToSevenDays(items);
    localStorage.setItem(scopedKey, JSON.stringify(pruned));
    if (isCapacitorNativeMobileRuntime()) {
      void syncSharedNativeClipboardHistory(pruned);
    }
  } catch {
    /* ignore */
  }
}

function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const tpl = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return tpl.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getThisDeviceIdentity(explicitEmail?: string): {
  deviceId: string;
  deviceKind: 'pc_master' | 'mobile';
  platform: 'windows' | 'macos' | 'android' | 'ios' | 'web';
  displayName: string;
} {
  const uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let deviceId = '';
  if (typeof window !== 'undefined') {
    try {
      const normEmail = (
        explicitEmail ||
        localStorage.getItem('ghosti_hub_user_email') ||
        localStorage.getItem('userEmail') ||
        ''
      )
        .trim()
        .toLowerCase();
      if (normEmail) {
        const scopedKey = `${SCOPED_DEVICE_ID_PREFIX}${normEmail}`;
        deviceId = (localStorage.getItem(scopedKey) || '').trim();
        if (!uuidRx.test(deviceId)) {
          // 기존 단일 계정 사용자 기기 ID는 최초 1개 계정에만 승계하고,
          // 동일 PC/브라우저에서 다른 계정(B계정 등)으로 로그인 시 전용 UUID를 분리 발급하여 서로의 기기 행을 덮어쓰지 못하게 격리
          const legacyId = (localStorage.getItem(THIS_DEVICE_ID_KEY) || '').trim();
          const legacyOwner = (localStorage.getItem(LEGACY_DEVICE_ID_OWNER_KEY) || '').trim().toLowerCase();
          if (uuidRx.test(legacyId) && (!legacyOwner || legacyOwner === normEmail)) {
            deviceId = legacyId;
            localStorage.setItem(LEGACY_DEVICE_ID_OWNER_KEY, normEmail);
          } else {
            deviceId = generateUuidV4();
          }
          localStorage.setItem(scopedKey, deviceId);
        }
      } else {
        deviceId = (localStorage.getItem(THIS_DEVICE_ID_KEY) || '').trim();
      }
    } catch {
      deviceId = '';
    }
  }
  if (!uuidRx.test(deviceId)) {
    deviceId = generateUuidV4();
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(THIS_DEVICE_ID_KEY, deviceId);
      } catch {
        /* ignore */
      }
    }
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isAndroid = /Android/i.test(ua);
  const isIpadDesktopUa =
    /Macintosh/i.test(ua) &&
    typeof navigator !== 'undefined' &&
    (navigator.maxTouchPoints || 0) > 1;
  const isIos = /iPhone|iPad|iPod/i.test(ua) || isIpadDesktopUa;
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIos;
  const isMobile = isAndroid || isIos || /Mobile/i.test(ua) || isCapacitorNativeMobileRuntime();

  const platform: 'windows' | 'macos' | 'android' | 'ios' | 'web' = isAndroid
    ? 'android'
    : isIos
    ? 'ios'
    : isMac
    ? 'macos'
    : 'windows';

  const isNativeCap = isCapacitorNativeMobileRuntime();
  const shortSuffix = deviceId.slice(0, 4).toUpperCase();
  const displayName = isAndroid
    ? isNativeCap
      ? `갤럭시·안드로이드 앱 (${shortSuffix})`
      : `안드로이드·웹 (${shortSuffix})`
    : isIos
    ? isNativeCap
      ? `아이폰·iOS 앱 (${shortSuffix})`
      : `아이폰·웹 (${shortSuffix})`
    : isMac
    ? `Mac 데스크톱 (${shortSuffix})`
    : zCoreBridge.isConnected
    ? `Windows PC · Z코어 (${shortSuffix})`
    : `Windows PC (${shortSuffix})`;

  return {
    deviceId,
    deviceKind: isMobile ? 'mobile' : 'pc_master',
    platform,
    displayName,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export async function sha256HexBrowser(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const e2eeKeyCache = new Map<string, CryptoKey>();

function resolveCanonicalE2eeUserId(fallbackUserId: string, email?: string): string {
  const cachedServerUid = loadCanonicalE2eeUid(email);
  if (cachedServerUid) return cachedServerUid;
  const jwtSub = readGhostiAuthedJwtClaims()?.sub?.trim() || '';
  if (jwtSub) return jwtSub;
  return (fallbackUserId || '').trim();
}

export async function prewarmAccountE2eeKey(email: string, userId: string): Promise<void> {
  const normEmail = (email || '').trim().toLowerCase();
  if (!normEmail) return;
  const candidates = new Set<string>();
  const primary = resolveCanonicalE2eeUserId(userId, normEmail);
  if (primary) candidates.add(primary);
  const jwtSub = readGhostiAuthedJwtClaims()?.sub?.trim() || '';
  if (jwtSub) candidates.add(jwtSub);
  if (userId && userId.trim()) candidates.add(userId.trim());
  for (const uid of candidates) {
    try {
      await deriveAccountAesGcmKey(normEmail, uid);
    } catch {
      /* ignore */
    }
  }
}

async function deriveAccountAesGcmKey(email: string, userId: string): Promise<CryptoKey> {
  const normEmail = (email || '').trim().toLowerCase();
  const normUid = (userId || '').trim();
  const cacheTag = `${normEmail}::${normUid}`;
  const cached = e2eeKeyCache.get(cacheTag);
  if (cached) {
    return cached;
  }
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(`ghosti-e2ee-clip-v1::${normEmail}::${normUid}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  const derived = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(`ghosti-salt-v1::${normEmail}`),
      iterations: 60000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  if (e2eeKeyCache.size > 12) {
    e2eeKeyCache.clear();
  }
  e2eeKeyCache.set(cacheTag, derived);
  return derived;
}

export async function encryptClipboardE2ee(
  plainText: string,
  email: string,
  userId: string
): Promise<{ cipherB64: string; ivB64: string; clipHash: string }> {
  const canonicalUid = resolveCanonicalE2eeUserId(userId, email);
  const key = await deriveAccountAesGcmKey(email, canonicalUid);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = new TextEncoder().encode(plainText);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plainBytes);
  const clipHash = await sha256HexBrowser(plainText);
  return {
    cipherB64: bytesToBase64(new Uint8Array(cipherBuf)),
    ivB64: bytesToBase64(iv),
    clipHash,
  };
}

export async function decryptClipboardE2ee(
  cipherB64: string,
  ivB64: string,
  email: string,
  userId: string,
  extraCandidateUserIds?: string[]
): Promise<string | null> {
  const iv = base64ToBytes(ivB64);
  const cipherBytes = base64ToBytes(cipherB64);
  const candidateSet = new Set<string>();
  const primaryUid = resolveCanonicalE2eeUserId(userId, email);
  if (primaryUid) candidateSet.add(primaryUid);
  const jwtSub = readGhostiAuthedJwtClaims()?.sub?.trim() || '';
  if (jwtSub) candidateSet.add(jwtSub);
  if (userId && userId.trim()) {
    candidateSet.add(userId.trim());
    candidateSet.add(userId.trim().toLowerCase());
  }
  if (Array.isArray(extraCandidateUserIds)) {
    for (const c of extraCandidateUserIds) {
      if (c && c.trim()) {
        candidateSet.add(c.trim());
        candidateSet.add(c.trim().toLowerCase());
      }
    }
  }
  for (const uidCandidate of candidateSet) {
    try {
      const key = await deriveAccountAesGcmKey(email, uidCandidate);
      const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        cipherBytes as BufferSource
      );
      return new TextDecoder().decode(plainBuf);
    } catch {
      /* try next canonical userId candidate */
    }
  }
  return null;
}

export async function syncDeviceHeartbeatAndList(opts?: {
  explicitTrialOptIn?: boolean;
  explicitReconnect?: boolean;
  forceRefreshPairingCode?: boolean;
}): Promise<{
  ok: boolean;
  thisDeviceId: string;
  revokedSelf: boolean;
  devices: GhostiConnectedDeviceDto[];
  pairingCode: string | null;
  entitlement: GhostiDeviceEntitlementView | null;
}> {
  const ident = getThisDeviceIdentity();
  if (!hasAuthenticatedHubAccountSession()) {
    return {
      ok: false,
      thisDeviceId: ident.deviceId,
      revokedSelf: false,
      devices: [],
      pairingCode: null,
      entitlement: null,
    };
  }
  let consumeExplicitReconnect = Boolean(opts?.explicitReconnect);
  if (!consumeExplicitReconnect && typeof window !== 'undefined') {
    try {
      if (sessionStorage.getItem('ghosti_explicit_reconnect_once') === '1') {
        sessionStorage.removeItem('ghosti_explicit_reconnect_once');
        consumeExplicitReconnect = true;
      }
      if (localStorage.getItem('ghosti_revoked_by_own_logout') === '1') {
        localStorage.removeItem('ghosti_revoked_by_own_logout');
        consumeExplicitReconnect = true;
      }
    } catch {
      /* ignore */
    }
  }

  const isMobileWeb = ident.deviceKind === 'mobile' && !isCapacitorNativeMobileRuntime();
  const res = await callGhostiServerBridge<{
    deviceId?: string;
    revokedSelf?: boolean;
    devices?: GhostiConnectedDeviceDto[];
    pairingCode?: string | null;
    entitlement?: GhostiDeviceEntitlementView;
    canonicalUserId?: string;
  }>('device_heartbeat_and_list', {
    deviceId: ident.deviceId,
    deviceKind: ident.deviceKind,
    platform: ident.platform,
    displayName: ident.displayName,
    appVersion: '1.0.122',
    mobileWebSkipRegister: isMobileWeb,
    explicitTrialOptIn: Boolean(opts?.explicitTrialOptIn),
    explicitReconnect: consumeExplicitReconnect,
    forceRefreshPairingCode: Boolean(opts?.forceRefreshPairingCode),
  });

  if (!res.ok) {
    return {
      ok: false,
      thisDeviceId: ident.deviceId,
      revokedSelf: false,
      devices: [],
      pairingCode: null,
      entitlement: null,
    };
  }
  const safeDevices = Array.isArray(res.devices) ? res.devices : [];
  const safePairingCode = res.pairingCode || null;
  const safeEntitlement = res.entitlement || null;
  const revokedSelf = Boolean(res.revokedSelf);
  thisDeviceRevokedLocally = revokedSelf;
  if (res.canonicalUserId) {
    const emailFromStorage =
      typeof window !== 'undefined'
        ? localStorage.getItem('ghosti_hub_user_email') || localStorage.getItem('userEmail') || ''
        : '';
    if (emailFromStorage) {
      saveCanonicalE2eeUid(emailFromStorage, res.canonicalUserId);
    }
  }
  saveCachedDeviceIntegrationSnapshot({
    devices: safeDevices,
    ...(safePairingCode ? { pairingCode: safePairingCode } : {}),
    entitlement: safeEntitlement,
  });
  if (opts?.explicitTrialOptIn || opts?.explicitReconnect || safeDevices.length >= 2) {
    broadcastDeviceIntegrationStateUpdate({
      devices: safeDevices,
      entitlement: safeEntitlement,
    });
  }
  return {
    ok: true,
    thisDeviceId: res.deviceId || ident.deviceId,
    revokedSelf,
    devices: safeDevices,
    pairingCode: safePairingCode,
    entitlement: safeEntitlement,
  };
}

export async function consumeDevicePairingCode6(code: string): Promise<{
  ok: boolean;
  alreadyPaired?: boolean;
  reason?: string;
  expectedEmailHint?: string;
  devices: GhostiConnectedDeviceDto[];
  entitlement: GhostiDeviceEntitlementView | null;
}> {
  const ident = getThisDeviceIdentity();
  const clean = (code || '').replace(/\D/g, '').slice(0, 6);
  if (clean.length !== 6) {
    return { ok: false, reason: 'INVALID_CODE_FORMAT', devices: [], entitlement: null };
  }
  if (!hasAuthenticatedHubAccountSession()) {
    return { ok: false, reason: 'AUTH_REQUIRED', devices: [], entitlement: null };
  }
  const isMobileWeb = ident.deviceKind === 'mobile' && !isCapacitorNativeMobileRuntime();
  const res = await callGhostiServerBridge<{
    alreadyPaired?: boolean;
    mobileWebBridgeOnly?: boolean;
    expectedEmailHint?: string;
    devices?: GhostiConnectedDeviceDto[];
    entitlement?: GhostiDeviceEntitlementView;
    canonicalUserId?: string;
  }>('device_consume_pairing_code', {
    code: clean,
    deviceId: ident.deviceId,
    deviceKind: ident.deviceKind,
    displayName: ident.displayName,
    platform: ident.platform,
    mobileWebBridgeOnly: isMobileWeb,
  });
  const safeDevices = Array.isArray(res.devices) ? res.devices : [];
  const safeEntitlement = res.entitlement || null;
  if (res.ok && res.mobileWebBridgeOnly) {
    return {
      ok: true,
      alreadyPaired: false,
      devices: [],
      entitlement: safeEntitlement,
    };
  }
  if (res.ok) {
    thisDeviceRevokedLocally = false;
    if (res.canonicalUserId && typeof window !== 'undefined') {
      const emailFromStorage =
        localStorage.getItem('ghosti_hub_user_email') || localStorage.getItem('userEmail') || '';
      if (emailFromStorage) {
        saveCanonicalE2eeUid(emailFromStorage, res.canonicalUserId);
      }
    }
    saveCachedDeviceIntegrationSnapshot({
      devices: safeDevices,
      entitlement: safeEntitlement,
    });
    broadcastDeviceIntegrationStateUpdate({
      devices: safeDevices,
      entitlement: safeEntitlement,
    });
  }
  return {
    ok: Boolean(res.ok),
    alreadyPaired: Boolean(res.alreadyPaired),
    reason: res.reason,
    expectedEmailHint: res.expectedEmailHint,
    devices: safeDevices,
    entitlement: safeEntitlement,
  };
}

export async function revokeConnectedDevice(targetDeviceId: string): Promise<{
  ok: boolean;
  revokedDeviceId: string;
  revokedSelf: boolean;
  devices: GhostiConnectedDeviceDto[];
  entitlement: GhostiDeviceEntitlementView | null;
}> {
  const cleanId = (targetDeviceId || '').trim();
  const ident = getThisDeviceIdentity();
  if (!cleanId || !hasAuthenticatedHubAccountSession()) {
    return {
      ok: false,
      revokedDeviceId: cleanId,
      revokedSelf: false,
      devices: [],
      entitlement: null,
    };
  }
  const res = await callGhostiServerBridge<{
    revokedDeviceId?: string;
    devices?: GhostiConnectedDeviceDto[];
    entitlement?: GhostiDeviceEntitlementView;
    canonicalUserId?: string;
  }>('device_revoke_device', { targetDeviceId: cleanId });
  if (!res.ok) {
    return {
      ok: false,
      revokedDeviceId: cleanId,
      revokedSelf: false,
      devices: [],
      entitlement: null,
    };
  }
  const safeDevices = Array.isArray(res.devices) ? res.devices : [];
  const safeEntitlement = res.entitlement || null;
  const revokedSelf = cleanId === ident.deviceId;
  if (revokedSelf) {
    thisDeviceRevokedLocally = true;
  }
  saveCachedDeviceIntegrationSnapshot({
    devices: safeDevices,
    entitlement: safeEntitlement,
  });
  broadcastDeviceIntegrationStateUpdate({
    devices: safeDevices,
    entitlement: safeEntitlement,
    revokedDeviceId: cleanId,
  });
  return {
    ok: true,
    revokedDeviceId: cleanId,
    revokedSelf,
    devices: safeDevices,
    entitlement: safeEntitlement,
  };
}

export async function reconnectConnectedDevice(targetDeviceId: string): Promise<{
  ok: boolean;
  reconnectedDeviceId: string;
  devices: GhostiConnectedDeviceDto[];
  entitlement: GhostiDeviceEntitlementView | null;
}> {
  const cleanId = (targetDeviceId || '').trim();
  const ident = getThisDeviceIdentity();
  if (!cleanId || !hasAuthenticatedHubAccountSession()) {
    return {
      ok: false,
      reconnectedDeviceId: cleanId,
      devices: [],
      entitlement: null,
    };
  }
  const res = await callGhostiServerBridge<{
    reconnectedDeviceId?: string;
    devices?: GhostiConnectedDeviceDto[];
    entitlement?: GhostiDeviceEntitlementView;
    canonicalUserId?: string;
  }>('device_reconnect_device', { targetDeviceId: cleanId });
  if (!res.ok) {
    return {
      ok: false,
      reconnectedDeviceId: cleanId,
      devices: [],
      entitlement: null,
    };
  }
  const safeDevices = Array.isArray(res.devices) ? res.devices : [];
  const safeEntitlement = res.entitlement || null;
  if (cleanId === ident.deviceId) {
    thisDeviceRevokedLocally = false;
  }
  saveCachedDeviceIntegrationSnapshot({
    devices: safeDevices,
    entitlement: safeEntitlement,
  });
  broadcastDeviceIntegrationStateUpdate({
    devices: safeDevices,
    entitlement: safeEntitlement,
  });
  return {
    ok: true,
    reconnectedDeviceId: cleanId,
    devices: safeDevices,
    entitlement: safeEntitlement,
  };
}

export function isCurrentAccountSyncUnlocked(email?: string): boolean {
  const snap = loadCachedDeviceIntegrationSnapshot(email);
  const ent = snap?.entitlement;
  if (!ent) return false;
  if (ent.isPaidUnlimited) {
    if (ent.paidExpiresAt) {
      const expMs = Date.parse(ent.paidExpiresAt);
      if (Number.isFinite(expMs) && expMs <= Date.now()) return false;
    }
    return true;
  }
  if (ent.trialActive && ent.trialDaysLeft > 0) return true;
  return Boolean(ent.unlimitedBindingUnlocked);
}

export function isCurrentAccountWorkShareUnlocked(email?: string): boolean {
  const snap = loadCachedDeviceIntegrationSnapshot(email);
  const ent = snap?.entitlement;
  if (!ent) return false;
  if (ent.workPaidActive) {
    if (ent.workPaidExpiresAt) {
      const expMs = Date.parse(ent.workPaidExpiresAt);
      if (Number.isFinite(expMs) && expMs <= Date.now()) return false;
    }
    return true;
  }
  if (ent.workTrialActive && Number(ent.workTrialDaysLeft || 0) > 0) return true;
  return Boolean(ent.workSubscriptionUnlocked);
}

import { isLocalPcBlockedByOtherAccount } from './pcSingleAccountGuard';
import {
  readCachedJoinedWorkRoomMeta,
  readCachedMyWorkRoomMeta,
  resolveCurrentWorkAccountEmail,
} from './workRoomSyncService';

let lastSyncedPcEngineSubFlag: string | null = null;
let lastSyncedPcEngineAtMs = 0;
export async function syncEntitlementToLocalPcEngine(
  entitlement: GhostiDeviceEntitlementView | null,
  accountEmail?: string,
  workOverride?: {
    unlocked?: boolean;
    roomId?: string;
    isHost?: boolean;
    planId?: string;
    purgeInvitedVault?: boolean;
    force?: boolean;
  }
): Promise<void> {
  if (typeof window === 'undefined' || !zCoreBridge.isConnected || isLocalPcBlockedByOtherAccount()) {
    return;
  }
  const isSub = Boolean(entitlement?.isPaidUnlimited);
  const resolvedWorkEmail = resolveCurrentWorkAccountEmail(accountEmail);
  const cleanEmail = resolvedWorkEmail !== 'anonymous' ? resolvedWorkEmail : '';

  // 업무 공유 탭 밖(내 기기 통합·구독 결제창 등)에서 호출되더라도 기존 소속 업무방(방장방·정식 합류 팀원방) 권한·roomId가 덮어써지지 않게 보호
  // (주의: 미검증 URL 초대 파라미터 activeInvite.hasWorkInvite만으로는 절대 선해금하지 않으며, 서버 work_accept_invite/work_list_my_rooms 검증 후 저장된 cachedJoinedRoom만 신뢰!)
  const cachedHostRoom = readCachedMyWorkRoomMeta(cleanEmail || undefined);
  const cachedJoinedRoom = readCachedJoinedWorkRoomMeta(cleanEmail || undefined);
  const ownWorkUnlocked = Boolean(
    entitlement?.workSubscriptionUnlocked ||
      entitlement?.workPaidActive ||
      entitlement?.workTrialActive
  );
  const invitedWorkUnlocked = Boolean(
    cachedJoinedRoom && !cachedJoinedRoom.isHost && cachedJoinedRoom.ownerUnlocked !== false
  );
  const isWorkUnlocked =
    workOverride?.unlocked !== undefined
      ? Boolean(workOverride.unlocked)
      : Boolean(ownWorkUnlocked || invitedWorkUnlocked);

  const fallbackRoomId =
    ownWorkUnlocked && cachedHostRoom?.roomId
      ? cachedHostRoom.roomId
      : cachedJoinedRoom?.roomId || cachedHostRoom?.roomId || '';
  const roomId = (workOverride?.roomId ?? fallbackRoomId).trim();

  const fallbackIsHost =
    cachedJoinedRoom && !cachedJoinedRoom.isHost && roomId === cachedJoinedRoom.roomId
      ? false
      : Boolean(ownWorkUnlocked);
  const isHost =
    workOverride?.isHost !== undefined ? Boolean(workOverride.isHost) : fallbackIsHost;

  const devCnt = Math.max(1, Number(entitlement?.activeDeviceCount || 1));
  const sig = `${cleanEmail}::${isSub ? '1' : '0'}::${isWorkUnlocked ? '1' : '0'}::${devCnt}::${roomId}::${isHost ? '1' : '0'}`;
  const nowMs = Date.now();
  if (
    !workOverride?.force &&
    lastSyncedPcEngineSubFlag === sig &&
    (!isWorkUnlocked || nowMs - lastSyncedPcEngineAtMs < 12_000)
  ) {
    return;
  }
  lastSyncedPcEngineSubFlag = sig;
  lastSyncedPcEngineAtMs = nowMs;
  try {
    const qs = new URLSearchParams({
      accountId: cleanEmail || 'local_user',
      isSubscribed: isSub ? 'true' : 'false',
      linkedDeviceCount: String(devCnt),
    });

    await Promise.all([
      fetch(getZCoreUrl(`/api/superpower/status?${qs.toString()}`), { method: 'GET' }),
      fetch(getZCoreUrl('/__work/entitlement'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unlocked: isWorkUnlocked,
          email: cleanEmail,
          roomId,
          isHost,
          ...(workOverride?.purgeInvitedVault ? { purgeInvitedVault: true } : {}),
          planId:
            workOverride?.planId ||
            (!isHost && invitedWorkUnlocked
              ? 'work_invited_member'
              : entitlement?.workPlanId || (entitlement?.workTrialActive ? 'work_trial_30d' : '')),
          reason: entitlement?.workTrialExpired ? 'WORK_TRIAL_EXPIRED' : 'WORK_SUBSCRIPTION_REQUIRED',
        }),
      }).catch(() => null),
    ]);
  } catch {
    lastSyncedPcEngineSubFlag = null;
  }
}

export async function activateDevicePlanPersistent(
  planId: string
): Promise<{
  ok: boolean;
  entitlement: GhostiDeviceEntitlementView | null;
  reason?: string;
  message?: string;
}> {
  if (!hasAuthenticatedHubAccountSession()) {
    return { ok: false, entitlement: null, reason: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' };
  }
  const res = await callGhostiServerBridge<{
    entitlement?: GhostiDeviceEntitlementView;
    reason?: string;
    message?: string;
  }>('device_activate_plan', { planId });
  if (res.ok && res.entitlement) {
    saveCachedDeviceIntegrationSnapshot({ entitlement: res.entitlement });
    broadcastDeviceIntegrationStateUpdate({ entitlement: res.entitlement });
    void syncEntitlementToLocalPcEngine(res.entitlement);
    return { ok: true, entitlement: res.entitlement };
  }
  if (res.entitlement) {
    saveCachedDeviceIntegrationSnapshot({ entitlement: res.entitlement });
  }
  return {
    ok: false,
    entitlement: res.entitlement || null,
    reason: res.reason,
    message: res.message,
  };
}

export interface PurchaseDevicePlanResult {
  ok: boolean;
  reason?: string;
  message?: string;
  orderId?: string;
  planId?: string;
  category?: 'personal' | 'work';
  paidCoins?: number;
  remainingBalance?: number;
  currentBalance?: number;
  requiredCoins?: number;
  shortfall?: number;
  expiresAt?: string;
  entitlement?: GhostiDeviceEntitlementView | null;
}

export async function purchaseDeviceSubscriptionPlan(
  planId: string,
  requestId?: string
): Promise<PurchaseDevicePlanResult> {
  if (!hasAuthenticatedHubAccountSession()) {
    return { ok: false, reason: 'AUTH_REQUIRED', message: '먼저 이메일로 로그인해 주세요.' };
  }
  const safeReqId =
    requestId || `ghosti_sub_${planId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const res = await callGhostiServerBridge<PurchaseDevicePlanResult>('device_purchase_plan', {
    planId,
    requestId: safeReqId,
  });
  if (res.ok && res.entitlement) {
    saveCachedDeviceIntegrationSnapshot({ entitlement: res.entitlement });
    broadcastDeviceIntegrationStateUpdate({ entitlement: res.entitlement });
    void syncEntitlementToLocalPcEngine(res.entitlement);
  }
  return res;
}

// ============================================================================
// [타 기기 섀도우 영구 IndexedDB 캐시] — 새로고침(F5) 증발 방지 + 만료 시 원격만 깔끔 숨김
// ============================================================================
const REMOTE_SHADOW_DB_NAME = 'ghosti_remote_shadow_cache_v1';
const REMOTE_SHADOW_STORE = 'snapshots';

interface RemoteShadowCachePayload {
  email: string;
  updatedAt: string;
  photos: PhotoItem[];
  docs: LocalDocumentFile[];
}

function openRemoteShadowDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(REMOTE_SHADOW_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(REMOTE_SHADOW_STORE)) {
          db.createObjectStore(REMOTE_SHADOW_STORE, { keyPath: 'email' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveRemoteShadowCache(
  email: string,
  photos: PhotoItem[],
  docs: LocalDocumentFile[]
): Promise<void> {
  const norm = String(email || '').trim().toLowerCase();
  if (!norm) return;
  const db = await openRemoteShadowDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(REMOTE_SHADOW_STORE, 'readwrite');
      const payload: RemoteShadowCachePayload = {
        email: norm,
        updatedAt: new Date().toISOString(),
        photos: photos.filter((p) => p.id.startsWith('shadow-remote-')).slice(0, 600),
        docs: docs.filter((d) => d.id.startsWith('shadow-remote-doc-')).slice(0, 400),
      };
      tx.objectStore(REMOTE_SHADOW_STORE).put(payload);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadRemoteShadowCache(
  email: string
): Promise<{ photos: PhotoItem[]; docs: LocalDocumentFile[] }> {
  const norm = String(email || '').trim().toLowerCase();
  if (!norm) return { photos: [], docs: [] };
  const db = await openRemoteShadowDb();
  if (!db) return { photos: [], docs: [] };
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(REMOTE_SHADOW_STORE, 'readonly');
      const req = tx.objectStore(REMOTE_SHADOW_STORE).get(norm);
      req.onsuccess = () => {
        const row = req.result as RemoteShadowCachePayload | undefined;
        resolve({
          photos: Array.isArray(row?.photos) ? row.photos : [],
          docs: Array.isArray(row?.docs) ? row.docs : [],
        });
      };
      req.onerror = () => resolve({ photos: [], docs: [] });
    } catch {
      resolve({ photos: [], docs: [] });
    }
  });
}

export async function clearRemoteShadowCache(email: string): Promise<void> {
  const norm = String(email || '').trim().toLowerCase();
  if (!norm) return;
  const db = await openRemoteShadowDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(REMOTE_SHADOW_STORE, 'readwrite');
      tx.objectStore(REMOTE_SHADOW_STORE).delete(norm);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}


// ============================================================================
// 실시간 기기 페어링 채널 (ghosti:pair:<emailHash>) + 클립보드·모니터캐스트·공간이동·기기상태 즉시전파
// ============================================================================
let activePairChannel: RealtimeChannel | null = null;
let activePairClient: SupabaseClient | null = null;
let activePairSubscribed = false;
let activePairTopic = '';
let activePairReconnectTrigger: (() => void) | null = null;
let activeClipboardPollTimer: number | null = null;
let activeClipboardWorker: Worker | null = null;
let lastObservedOsClipHash = '';
let lastAutoPushedClipHash = '';
let lastAutoPushedAtMs = 0;
const recentRemoteInjectedHashes = new Map<string, number>();
const deliveredRemoteEnvelopeKeys = new Set<string>();
const lastDeliveredRemoteHashBySender = new Map<string, { hash: string; atMs: number }>();
const inflightMailboxPullByEmail = new Map<
  string,
  Promise<{
    ok?: boolean;
    canonicalUserId?: string;
    items?: Array<{
      clipHash: string;
      cipherB64: string;
      ivB64: string;
      senderDeviceId: string;
      senderName: string;
      createdAt: string;
    }>;
  }>
>();
let pendingOsInjectClip: {
  envKey: string;
  item: GhostiSyncedClipItem;
  createdAtMs: number;
} | null = null;
let lastLocalPushTimestampMs = 0;

function buildCanonicalEnvelopeKey(
  senderDeviceId?: string,
  clipHash?: string,
  createdAt?: string
): string {
  const parsedMs = createdAt ? Date.parse(createdAt) : NaN;
  const secTag = Number.isFinite(parsedMs) && parsedMs > 0 ? String(Math.floor(parsedMs / 1000)) : String(createdAt || '');
  return `${senderDeviceId || ''}:${clipHash || ''}:${secTag}`;
}

function isDuplicateBurstFromSameSender(senderDeviceId: string, clipHash: string): boolean {
  if (!senderDeviceId || !clipHash) return false;
  const prev = lastDeliveredRemoteHashBySender.get(senderDeviceId);
  if (!prev) return false;
  return prev.hash === clipHash && Date.now() - prev.atMs < 4000;
}

function recordDeliveredSenderClipHash(senderDeviceId: string, clipHash: string): void {
  if (!senderDeviceId || !clipHash) return;
  if (lastDeliveredRemoteHashBySender.size > 40) {
    lastDeliveredRemoteHashBySender.clear();
  }
  lastDeliveredRemoteHashBySender.set(senderDeviceId, { hash: clipHash, atMs: Date.now() });
}

function isRealtimeChannelActuallyHealthy(): boolean {
  if (!activePairChannel || !activePairSubscribed) return false;
  try {
    const chState = (activePairChannel as unknown as { state?: string }).state;
    if (chState && chState !== 'joined') return false;
    const rt = (activePairClient as unknown as {
      realtime?: { isConnected?: () => boolean; connectionState?: () => string };
    })?.realtime;
    if (typeof rt?.isConnected === 'function' && !rt.isConnected()) return false;
    if (typeof rt?.connectionState === 'function') {
      const conn = rt.connectionState();
      if (conn && conn !== 'open') return false;
    }
  } catch {
    /* ignore */
  }
  return true;
}
let pendingDeviceStatePacket: {
  devices?: GhostiConnectedDeviceDto[];
  entitlement?: GhostiDeviceEntitlementView | null;
  revokedDeviceId?: string;
  senderDeviceId: string;
  updatedAt: number;
} | null = null;
let pendingTeleportPacket: Record<string, unknown> | null = null;
let pendingClipBroadcastPacket: {
  clipHash: string;
  cipherB64: string;
  ivB64: string;
  senderDeviceId: string;
  senderName: string;
  createdAt: string;
} | null = null;

function saveLastSyncedOsClipHash(hash: string, email?: string): void {
  if (!hash || typeof window === 'undefined') return;
  const normEmail = (
    email ||
    localStorage.getItem('ghosti_hub_user_email') ||
    localStorage.getItem('userEmail') ||
    ''
  )
    .trim()
    .toLowerCase();
  if (!normEmail) return;
  try {
    localStorage.setItem(`${LAST_SYNCED_OS_CLIP_HASH_PREFIX}${normEmail}`, hash);
  } catch {
    /* ignore */
  }
}

function loadLastSyncedOsClipHash(email?: string): string {
  if (typeof window === 'undefined') return '';
  const normEmail = (
    email ||
    localStorage.getItem('ghosti_hub_user_email') ||
    localStorage.getItem('userEmail') ||
    ''
  )
    .trim()
    .toLowerCase();
  if (!normEmail) return '';
  try {
    return (localStorage.getItem(`${LAST_SYNCED_OS_CLIP_HASH_PREFIX}${normEmail}`) || '').trim();
  } catch {
    return '';
  }
}

export function formatAccountBackupSubfolder(explicitEmail?: string): string {
  const raw = (
    explicitEmail ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('ghosti_hub_user_email') || localStorage.getItem('userEmail') || ''
      : '')
  )
    .trim()
    .toLowerCase();
  if (!raw) return '';
  return raw
    .replace(/@/g, '_')
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 64);
}

export function markLocalClipboardSelfInjected(clipHash: string): void {
  if (!clipHash) return;
  recentRemoteInjectedHashes.set(clipHash, Date.now());
  lastObservedOsClipHash = clipHash;
  saveLastSyncedOsClipHash(clipHash);
}

export async function writeTextToLocalOsClipboard(
  text: string,
  clipHash?: string
): Promise<boolean> {
  const clean = (text || '').trim();
  if (!clean) return false;
  const resolvedHash = clipHash || (await sha256HexBrowser(clean));
  // OS 클립보드 쓰기 직전에 Echo-Loop 가드 해시를 먼저 각인하여 역전송 원천 차단
  markLocalClipboardSelfInjected(resolvedHash);

  const ident = getThisDeviceIdentity();
  if (ident.deviceKind === 'pc_master') {
    if (isLocalPcBlockedByOtherAccount()) return false;
    const ownerEmail = (
      typeof window !== 'undefined'
        ? localStorage.getItem('ghosti_hub_user_email') || localStorage.getItem('userEmail') || ''
        : ''
    )
      .trim()
      .toLowerCase();
    if (zCoreBridge.isConnected) {
      try {
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const tid = ctrl ? window.setTimeout(() => ctrl.abort(), 2500) : null;
        const res = await fetch(getZCoreUrl('/__sync/clipboard'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: clean, accountEmail: ownerEmail }),
          ...(ctrl ? { signal: ctrl.signal } : {}),
        });
        if (tid !== null) window.clearTimeout(tid);
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
          if (data?.ok !== false) return true;
          return false;
        }
      } catch {
        /* fallback to navigator.clipboard */
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(clean);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  // 모바일(안드로이드·아이폰 네이티브 래퍼 우선 ➔ 모바일 웹 폴백)
  // 네이티브 앱 런타임은 Swift(UIApplication.applicationState == .active)·Android(Activity 활성)에서
  // 직접 정확히 검증하므로 WKWebView의 지연된 document.visibilityState로 조기 차단하지 않습니다.
  if (isCapacitorNativeMobileRuntime()) {
    const nat = await writeNativeMobileClipboardText(clean);
    if (nat.supported) return Boolean(nat.ok);
  }
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    return false;
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(clean);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function createVisibilityAwareInterval(intervalMs: number, onTick: () => void): {
  stop: () => void;
} {
  if (typeof window === 'undefined') {
    return { stop: () => {} };
  }
  const safeMs = Math.max(500, intervalMs);
  const timerId = window.setInterval(() => {
    // 크롬 백그라운드 탭 절전(Throttling)을 방해하지 않도록 hidden 상태에서는 깨우지 않음
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    onTick();
  }, safeMs);
  const onWake = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    onTick();
  };
  document.addEventListener('visibilitychange', onWake, { passive: true });
  window.addEventListener('focus', onWake, { passive: true });
  return {
    stop: () => {
      window.clearInterval(timerId);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    },
  };
}

export function broadcastDeviceIntegrationStateUpdate(payload: {
  devices?: GhostiConnectedDeviceDto[];
  entitlement?: GhostiDeviceEntitlementView | null;
  revokedDeviceId?: string;
  mirrorBackupReadyCount?: number;
}): void {
  const ident = getThisDeviceIdentity();
  const packet = {
    devices: payload.devices,
    entitlement: payload.entitlement,
    ...(payload.revokedDeviceId ? { revokedDeviceId: payload.revokedDeviceId } : {}),
    ...(typeof payload.mirrorBackupReadyCount === 'number'
      ? { mirrorBackupReadyCount: payload.mirrorBackupReadyCount }
      : {}),
    senderDeviceId: ident.deviceId,
    updatedAt: Date.now(),
  };
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(DEVICE_SYNC_BROADCAST_CHANNEL);
      bc.postMessage({ type: 'DEVICE_STATE_UPDATED', payload: packet });
      bc.close();
    }
  } catch {
    /* ignore */
  }
  if (activePairChannel && activePairSubscribed) {
    pendingDeviceStatePacket = null;
    void activePairChannel.send({
      type: 'broadcast',
      event: 'DEVICE_STATE_UPDATED',
      payload: packet,
    });
  } else {
    pendingDeviceStatePacket = packet;
  }
}

export async function pushCrossDeviceClipboardText(opts: {
  text: string;
  email: string;
  userId: string;
  isAutoOsCapture?: boolean;
  allowBypassEchoGuard?: boolean;
}): Promise<{ ok: boolean; item?: GhostiSyncedClipItem; skippedDuplicate?: boolean }> {
  const cleanText = (opts.text || '').trim();
  const normEmail = (opts.email || '').trim().toLowerCase();
  if (!cleanText || !normEmail || !opts.userId || !hasAuthenticatedHubAccountSession()) {
    return { ok: false };
  }
  if (thisDeviceRevokedLocally) {
    return { ok: false };
  }
  loadDeliveredEnvelopesOnce(normEmail);
  const clipHash = await sha256HexBrowser(cleanText);
  const nowMs = Date.now();

  // 타 기기에서 방금 수신해 내 OS 클립보드에 주입한 텍스트는 절대 역전송(Echo-Loop)하지 않음 (사용자가 수동 버튼/입력으로 명시 전송한 경우만 예외)
  if (!opts.allowBypassEchoGuard) {
    const injectedAt = recentRemoteInjectedHashes.get(clipHash);
    if (injectedAt && nowMs - injectedAt < 60_000) {
      lastObservedOsClipHash = clipHash;
      return { ok: true, skippedDuplicate: true };
    }
  }

  // 단일 Ctrl+C 시 copy 이벤트와 백그라운드 워커 폴링이 동시에 감지할 때 1.5초 중복 발송만 방지 (사용자가 재복사한 경우는 정상 전송 허용)
  if (opts.isAutoOsCapture && clipHash === lastAutoPushedClipHash && nowMs - lastAutoPushedAtMs < 1500) {
    return { ok: true, skippedDuplicate: true };
  }
  lastAutoPushedClipHash = clipHash;
  lastAutoPushedAtMs = nowMs;
  lastObservedOsClipHash = clipHash;
  saveLastSyncedOsClipHash(clipHash, normEmail);
  lastLocalPushTimestampMs = nowMs;

  const ident = getThisDeviceIdentity(normEmail);
  const encrypted = await encryptClipboardE2ee(cleanText, normEmail, opts.userId);
  const nowIso = new Date(nowMs).toISOString();
  const broadcastPayload = {
    clipHash: encrypted.clipHash,
    cipherB64: encrypted.cipherB64,
    ivB64: encrypted.ivB64,
    senderDeviceId: ident.deviceId,
    senderName: ident.displayName,
    createdAt: nowIso,
  };

  const item: GhostiSyncedClipItem = {
    clipHash: encrypted.clipHash,
    text: cleanText,
    senderDeviceId: ident.deviceId,
    senderName: `${ident.displayName} (발신)`,
    createdAt: nowIso,
    encryptedE2ee: true,
  };
  const nextList = pruneSyncedClipsToSevenDays([
    item,
    ...loadCachedSyncedClips(normEmail).filter((c) => c.clipHash !== item.clipHash),
  ]);
  saveCachedSyncedClips(nextList, normEmail);
  if (isCapacitorNativeMobileRuntime()) {
    void syncSharedNativeClipboardHistory(nextList);
  }

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(DEVICE_SYNC_BROADCAST_CHANNEL);
      bc.postMessage({ type: 'LOCAL_CLIP_SYNCED', payload: item });
      bc.close();
    }
  } catch {
    /* ignore */
  }

  // 1) 온라인 기기로 0.05초 즉시 Realtime 브로드캐스트 (실제 소켓 연결 상태를 확인하고 끊겼으면 즉시 재연결)
  const isRealtimeReady = isRealtimeChannelActuallyHealthy();
  const realtimeSendPromise = isRealtimeReady
    ? activePairChannel!.send({
        type: 'broadcast',
        event: 'E2EE_CLIPBOARD_PUSH',
        payload: broadcastPayload,
      })
    : (() => {
        activePairSubscribed = false;
        pendingClipBroadcastPacket = broadcastPayload;
        if (activePairReconnectTrigger) {
          activePairReconnectTrigger();
        }
        return Promise.resolve('queued');
      })();

  // 2) 오프라인/백그라운드 기기를 위한 7일(168시간) 지연 E2EE 암호화 우체통 병렬 보관 (서버 평문 열람 0% 불가)
  const mailboxPersistPromise = callGhostiServerBridge<{
    count?: number;
    canonicalUserId?: string;
  }>('device_push_e2ee_clip', broadcastPayload, { keepalive: true })
    .then((res) => {
      if (res?.ok && res.canonicalUserId) {
        saveCanonicalE2eeUid(normEmail, res.canonicalUserId);
      }
      return res;
    })
    .catch(() => ({ ok: false }));

  // PC에서 Realtime이 실제 정상 연결이면 ~50ms 브로드캐스트 확인 즉시 반환하고 우체통은 비차단 저장.
  // 모바일은 사용자가 바로 다른 앱으로 전환할 수 있어 우체통 저장 완료까지 보장하고, Realtime 전송 실패 시 즉시 재연결 트리거.
  if (isRealtimeReady) {
    const rtStatus = await Promise.race([
      realtimeSendPromise.catch(() => 'error'),
      new Promise<string>((resolve) => window.setTimeout(() => resolve('timeout'), 650)),
    ]);
    if (rtStatus === 'ok') {
      if (ident.deviceKind === 'mobile') {
        await Promise.race([
          mailboxPersistPromise,
          new Promise((resolve) => window.setTimeout(resolve, 1800)),
        ]);
      } else {
        void mailboxPersistPromise;
      }
      return { ok: true, item };
    }
    // 실제 소켓이 백그라운드에서 죽어있었던 경우 즉시 상태 리셋 + 재연결
    activePairSubscribed = false;
    pendingClipBroadcastPacket = broadcastPayload;
    if (activePairReconnectTrigger) {
      activePairReconnectTrigger();
    }
  }

  const [, bridgeRes] = await Promise.all([
    realtimeSendPromise.catch(() => 'error'),
    mailboxPersistPromise,
  ]);

  return { ok: Boolean(bridgeRes?.ok || isRealtimeReady), item };
}

export async function pullDelayedE2eeClipboardMailbox(opts: {
  email: string;
  userId: string;
  injectToOsClipboard?: boolean;
}): Promise<{ items: GhostiSyncedClipItem[]; newlyDeliveredExternal: GhostiSyncedClipItem | null }> {
  const normEmail = (opts.email || '').trim().toLowerCase();
  if (!normEmail || !opts.userId || !hasAuthenticatedHubAccountSession()) {
    return { items: loadCachedSyncedClips(normEmail), newlyDeliveredExternal: null };
  }
  loadDeliveredEnvelopesOnce(normEmail);
  const ident = getThisDeviceIdentity(normEmail);
  let inflight = inflightMailboxPullByEmail.get(normEmail);
  if (!inflight) {
    inflight = callGhostiServerBridge<{
      canonicalUserId?: string;
      items?: Array<{
        clipHash: string;
        cipherB64: string;
        ivB64: string;
        senderDeviceId: string;
        senderName: string;
        createdAt: string;
      }>;
    }>('device_pull_e2ee_clips', {}).finally(() => {
      inflightMailboxPullByEmail.delete(normEmail);
    });
    inflightMailboxPullByEmail.set(normEmail, inflight);
  }
  const res = await inflight;

  if (!res.ok || !Array.isArray(res.items)) {
    return { items: loadCachedSyncedClips(normEmail), newlyDeliveredExternal: null };
  }

  if (res.canonicalUserId) {
    saveCanonicalE2eeUid(normEmail, res.canonicalUserId);
  }
  const extraUids = res.canonicalUserId ? [res.canonicalUserId] : undefined;
  const decryptedList: GhostiSyncedClipItem[] = [];
  let newestExternalItem: GhostiSyncedClipItem | null = null;
  let newestExternalEnvKey = '';

  for (const env of res.items) {
    if (!env?.cipherB64 || !env?.ivB64) continue;
    const plain = await decryptClipboardE2ee(
      env.cipherB64,
      env.ivB64,
      normEmail,
      opts.userId,
      extraUids
    );
    if (!plain) continue;
    const resolvedHash = env.clipHash || (await sha256HexBrowser(plain));
    const isFromOtherDevice = Boolean(env.senderDeviceId && env.senderDeviceId !== ident.deviceId);
    const itemObj: GhostiSyncedClipItem = {
      clipHash: resolvedHash,
      text: plain,
      senderDeviceId: env.senderDeviceId,
      senderName: isFromOtherDevice
        ? env.senderName || '연결된 내 기기'
        : `${env.senderName || ident.displayName} (발신)`,
      createdAt: env.createdAt,
      encryptedE2ee: true,
    };
    const envKey = buildCanonicalEnvelopeKey(env.senderDeviceId, resolvedHash, env.createdAt);
    if (isFromOtherDevice && !deliveredRemoteEnvelopeKeys.has(envKey)) {
      if (isDuplicateBurstFromSameSender(env.senderDeviceId, resolvedHash)) {
        rememberDeliveredEnvelope(envKey, normEmail);
      } else if (!newestExternalItem) {
        newestExternalItem = itemObj;
        newestExternalEnvKey = envKey;
      } else {
        rememberDeliveredEnvelope(envKey, normEmail);
      }
    }
    decryptedList.push(itemObj);
  }

  // 타 기기에서 새로 도착한 최신 클립보드를 내 OS 클립보드에 1회 자동 주입 (Echo-Loop 원천 차단)
  // 주의: 모바일(Android 포커스 직전·iOS .inactive 전환 애니메이션 중)에서 OS 주입이 실패한 경우에는
  // 절대 봉투를 완료 각인하거나 도착 토스트를 조기 소진하지 않고 pendingOsInjectClip에 보관하여 포커스 확보 즉시 주입+토스트를 함께 실행합니다!
  let confirmedDeliveredExternal: GhostiSyncedClipItem | null = null;
  if (newestExternalItem && newestExternalEnvKey) {
    const createdMs = Date.parse(newestExternalItem.createdAt || '') || Date.now();
    const isFresh = Date.now() - createdMs <= 10 * 60 * 1000;
    const justPushedLocallyNow =
      lastLocalPushTimestampMs > 0 && Date.now() - lastLocalPushTimestampMs < 2200;
    if (!isFresh || justPushedLocallyNow) {
      rememberDeliveredEnvelope(newestExternalEnvKey, normEmail);
    } else if (opts.injectToOsClipboard) {
      if (!osInjectedEnvelopeKeys.has(newestExternalEnvKey)) {
        const injected = await writeTextToLocalOsClipboard(
          newestExternalItem.text,
          newestExternalItem.clipHash
        );
        if (injected) {
          osInjectedEnvelopeKeys.add(newestExternalEnvKey);
          rememberDeliveredEnvelope(newestExternalEnvKey, normEmail);
          recordDeliveredSenderClipHash(
            newestExternalItem.senderDeviceId,
            newestExternalItem.clipHash
          );
          if (pendingOsInjectClip?.envKey === newestExternalEnvKey) {
            pendingOsInjectClip = null;
          }
          confirmedDeliveredExternal = newestExternalItem;
        } else {
          pendingOsInjectClip = {
            envKey: newestExternalEnvKey,
            item: newestExternalItem,
            createdAtMs: createdMs,
          };
          if (ident.deviceKind === 'pc_master') {
            confirmedDeliveredExternal = newestExternalItem;
          }
        }
      } else {
        rememberDeliveredEnvelope(newestExternalEnvKey, normEmail);
      }
    } else if (!osInjectedEnvelopeKeys.has(newestExternalEnvKey)) {
      pendingOsInjectClip = {
        envKey: newestExternalEnvKey,
        item: newestExternalItem,
        createdAtMs: createdMs,
      };
    }
  }

  if (decryptedList.length > 0) {
    saveCachedSyncedClips(decryptedList, normEmail);
    if (isCapacitorNativeMobileRuntime()) {
      void syncSharedNativeClipboardHistory(decryptedList);
    }
  }
  return { items: decryptedList, newlyDeliveredExternal: confirmedDeliveredExternal };
}

export function clearPcZCoreClipboardAuthContext(): void {
  if (typeof window === 'undefined') return;
  try {
    void fetch(getZCoreUrl('/__sync/auth-context'), {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clear: true }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export async function readCurrentOsClipboardForDevice(opts?: {
  isUserGesture?: boolean;
  isBaselineOnly?: boolean;
}): Promise<{
  text: string;
  clipHash?: string;
  isSelfInjected?: boolean;
  unchanged?: boolean;
  seqNum?: number;
  nativeDirectActive?: boolean;
  lastNativePushedHash?: string;
  recentNativePushed?: Array<{
    clipHash: string;
    text: string;
    senderDeviceId?: string;
    senderName?: string;
    createdAt?: string;
  }>;
  source: 'zcore' | 'native_mobile' | 'web_clipboard' | 'none';
}> {
  const ident = getThisDeviceIdentity();

  if (ident.deviceKind === 'pc_master') {
    if (isLocalPcBlockedByOtherAccount()) {
      return { text: '', source: 'none' };
    }
    const ownerEmail = (
      typeof window !== 'undefined'
        ? localStorage.getItem('ghosti_hub_user_email') || localStorage.getItem('userEmail') || ''
        : ''
    )
      .trim()
      .toLowerCase();
    if (zCoreBridge.isConnected) {
      try {
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const tid = ctrl ? window.setTimeout(() => ctrl.abort(), 2200) : null;
        const clipUrl = ownerEmail
          ? `${getZCoreUrl('/__sync/clipboard')}?email=${encodeURIComponent(ownerEmail)}`
          : getZCoreUrl('/__sync/clipboard');
        const res = await fetch(
          clipUrl,
          ctrl ? { signal: ctrl.signal } : undefined
        );
        if (tid !== null) window.clearTimeout(tid);
        if (res.ok) {
          const data = (await res.json()) as {
            ok?: boolean;
            text?: string;
            clipHash?: string;
            sha256?: string;
            isSelfInjected?: boolean;
            seqNum?: number;
            nativeDirectActive?: boolean;
            lastNativePushedHash?: string;
            recentNativePushed?: Array<{
              clipHash: string;
              text: string;
              senderDeviceId?: string;
              senderName?: string;
              createdAt?: string;
            }>;
          };
          if (data?.ok) {
            return {
              text: (data.text || '').trim(),
              clipHash: data.clipHash || data.sha256 || undefined,
              isSelfInjected: Boolean(data.isSelfInjected),
              seqNum: typeof data.seqNum === 'number' ? data.seqNum : undefined,
              nativeDirectActive: Boolean(data.nativeDirectActive),
              lastNativePushedHash: data.lastNativePushedHash || undefined,
              recentNativePushed: Array.isArray(data.recentNativePushed)
                ? data.recentNativePushed
                : undefined,
              source: 'zcore',
            };
          }
        }
      } catch {
        /* fallback to web clipboard below */
      }
    }

    // Z-코어 미연결 PC에서도 브라우저 포커스·복사·수동 버튼 시 navigator.clipboard.readText() 폴백 지원
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard?.readText &&
      (opts?.isUserGesture || (typeof document !== 'undefined' && document.hasFocus()))
    ) {
      try {
        const raw = (await navigator.clipboard.readText()).trim();
        return { text: raw, source: 'web_clipboard' };
      } catch {
        /* permission not granted */
      }
    }
    return { text: '', source: 'none' };
  }

  // 모바일(안드로이드·아이폰 네이티브 래퍼 우선 ➔ 모바일 웹 폴백)
  if (isCapacitorNativeMobileRuntime()) {
    const nat = await readNativeMobileClipboardText(
      Boolean(opts?.isUserGesture),
      Boolean(opts?.isBaselineOnly)
    );
    if (nat.supported && nat.ok) {
      return {
        text: nat.text,
        clipHash: nat.clipHash,
        isSelfInjected: Boolean(nat.isSelfInjected),
        unchanged: Boolean(nat.unchanged),
        source: 'native_mobile',
      };
    }
  }

  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard?.readText &&
    (opts?.isUserGesture || (typeof document !== 'undefined' && document.hasFocus()))
  ) {
    try {
      const raw = (await navigator.clipboard.readText()).trim();
      return { text: raw, source: 'web_clipboard' };
    } catch {
      /* browser requires explicit user gesture */
    }
  }
  return { text: '', source: 'none' };
}

export async function captureAndPushCurrentOsClipboard(opts: {
  email: string;
  userId: string;
  isUserGesture?: boolean;
  isBaselineOnly?: boolean;
}): Promise<{
  ok: boolean;
  item?: GhostiSyncedClipItem;
  reason?: 'EMPTY' | 'UNCHANGED' | 'SELF_INJECTED' | 'PERMISSION_NEEDED' | 'FAILED';
}> {
  const normEmail = (opts.email || '').trim().toLowerCase();
  if (!normEmail || !opts.userId || !hasAuthenticatedHubAccountSession()) {
    return { ok: false, reason: 'FAILED' };
  }
  const read = await readCurrentOsClipboardForDevice({
    isUserGesture: opts.isUserGesture,
    isBaselineOnly: opts.isBaselineOnly,
  });
  if (read.source === 'none') {
    return { ok: false, reason: 'PERMISSION_NEEDED' };
  }
  if (read.unchanged) {
    return { ok: false, reason: 'UNCHANGED' };
  }
  const clean = (read.text || '').trim();
  if (!clean || clean.length > 32000) {
    if (opts.isBaselineOnly) lastObservedOsClipHash = '';
    return { ok: false, reason: 'EMPTY' };
  }
  const h = read.clipHash || (await sha256HexBrowser(clean));
  if (opts.isBaselineOnly) {
    if (!lastObservedOsClipHash) {
      lastObservedOsClipHash = h;
    }
    return { ok: false, reason: 'UNCHANGED' };
  }

  if (!opts.isUserGesture) {
    const injectedAt = recentRemoteInjectedHashes.get(h);
    const isWithinEchoWindow = Boolean(injectedAt && Date.now() - injectedAt < 60_000);
    if (isWithinEchoWindow) {
      lastObservedOsClipHash = h;
      return { ok: false, reason: 'SELF_INJECTED' };
    }
    if (read.isSelfInjected) {
      // 신형 Z-코어(seqNum 포함) 및 네이티브 모바일은 시퀀스/60초 가드가 정확하므로 즉시 Echo 차단.
      // 구형 Z-코어(seqNum 미포함)는 60초 경과 후 사용자가 다른 글을 복사했다가 재복사한 경우 허용.
      const isLegacyLatched = read.source === 'zcore' && read.seqNum === undefined;
      if (!isLegacyLatched || !lastObservedOsClipHash || h === lastObservedOsClipHash) {
        lastObservedOsClipHash = h;
        return { ok: false, reason: 'SELF_INJECTED' };
      }
    }
    if (h === lastObservedOsClipHash) {
      return { ok: false, reason: 'UNCHANGED' };
    }
  }

  if (read.source === 'zcore' && Array.isArray(read.recentNativePushed) && read.recentNativePushed.length > 0) {
    const existing = loadCachedSyncedClips(normEmail);
    const existingHashes = new Set(existing.map((c) => c.clipHash));
    const newlyAdded: GhostiSyncedClipItem[] = [];
    for (const np of read.recentNativePushed) {
      const npText = (np?.text || '').trim();
      const npHash = (np?.clipHash || '').trim();
      if (!npText || !npHash || existingHashes.has(npHash)) continue;
      existingHashes.add(npHash);
      newlyAdded.push({
        clipHash: npHash,
        text: npText,
        senderDeviceId: np.senderDeviceId || getThisDeviceIdentity(normEmail).deviceId,
        senderName: np.senderName || `${getThisDeviceIdentity(normEmail).displayName} (발신)`,
        createdAt: np.createdAt || new Date().toISOString(),
        encryptedE2ee: true,
      });
    }
    if (newlyAdded.length > 0) {
      saveCachedSyncedClips(pruneSyncedClipsToSevenDays([...newlyAdded, ...existing]), normEmail);
    }
  }

  lastObservedOsClipHash = h;

  // [PC Z-코어 v2.9.20+ 직통 배치 발송 단일화 & Realtime 보조]:
  // Z-코어 네이티브 데몬(nativeDirectActive=true)이 이미 0.12초 주기로 OS 클립보드를 배치 직통 발송하고 있으므로,
  // 크롬 워커가 Z-코어보다 수 ms 먼저 읽더라도 중복 HTTP 쓰기 경쟁(덮어쓰기 레이스)을 일으키지 않고 WebSocket 즉시 전파만 보조합니다.
  if (
    !opts.isUserGesture &&
    read.source === 'zcore' &&
    read.nativeDirectActive
  ) {
    saveLastSyncedOsClipHash(h, normEmail);
    lastLocalPushTimestampMs = Date.now();
    const ident = getThisDeviceIdentity(normEmail);
    const matchedNative = read.recentNativePushed?.find((x) => x.clipHash === h);
    const createdIso = matchedNative?.createdAt || new Date().toISOString();
    const item: GhostiSyncedClipItem = {
      clipHash: h,
      text: clean,
      senderDeviceId: ident.deviceId,
      senderName: `${ident.displayName} (발신)`,
      createdAt: createdIso,
      encryptedE2ee: true,
    };
    if (isRealtimeChannelActuallyHealthy() && activePairChannel) {
      void encryptClipboardE2ee(clean, normEmail, opts.userId)
        .then((enc) => {
          void activePairChannel?.send({
            type: 'broadcast',
            event: 'E2EE_CLIPBOARD_PUSH',
            payload: {
              clipHash: enc.clipHash,
              cipherB64: enc.cipherB64,
              ivB64: enc.ivB64,
              senderDeviceId: ident.deviceId,
              senderName: ident.displayName,
              createdAt: createdIso,
            },
          });
        })
        .catch(() => {});
    }
    return { ok: true, item };
  }

  const pushed = await pushCrossDeviceClipboardText({
    text: clean,
    email: normEmail,
    userId: opts.userId,
    isAutoOsCapture: !opts.isUserGesture,
    allowBypassEchoGuard: Boolean(opts.isUserGesture),
  });
  if (!pushed.ok || !pushed.item) {
    return { ok: false, reason: 'FAILED' };
  }
  return { ok: true, item: pushed.item };
}

export function broadcastRemoteMonitorCast(packet: RemoteMonitorCastPacket): void {
  if (!activePairChannel) return;
  if (!isCurrentAccountSyncUnlocked()) return;
  void activePairChannel.send({
    type: 'broadcast',
    event: 'MONITOR_CAST_REMOTE',
    payload: packet,
  });
}

export function pushTeleportPhotoToPcVanguard(opts: {
  fileName: string;
  ocrText: string;
  summary?: string;
  thumbWebpBase64?: string;
  chips?: string[];
}): boolean {
  if (!isCurrentAccountSyncUnlocked()) return false;
  const ident = getThisDeviceIdentity();
  const cleanFileName = (opts.fileName || '스마트폰 사진').trim();
  const cleanOcr = (opts.ocrText || '').trim();
  const cleanSummary = (opts.summary || `[모바일 전송] ${cleanFileName}`).trim();
  const fullText = cleanOcr || cleanSummary;
  const payload: Record<string, unknown> = {
    file_name: cleanFileName,
    fileName: cleanFileName,
    ocr_text: fullText,
    fullText,
    summary: cleanSummary,
    source_device: ident.displayName,
    sourceDevice: ident.displayName,
    senderDeviceId: ident.deviceId,
    ...(opts.thumbWebpBase64 ? { thumbWebpBase64: opts.thumbWebpBase64 } : {}),
    ...(Array.isArray(opts.chips) && opts.chips.length > 0 ? { chips: opts.chips.slice(0, 24) } : {}),
    sent_at: new Date().toISOString(),
  };
  if (activePairChannel && activePairSubscribed) {
    pendingTeleportPacket = null;
    void activePairChannel.send({
      type: 'broadcast',
      event: 'TELEPORT_OCR_VANGUARD',
      payload,
    });
    return true;
  }
  pendingTeleportPacket = payload;
  if (activePairReconnectTrigger) {
    activePairReconnectTrigger();
  }
  return Boolean(activePairChannel);
}

function encodeCanvasCompactThumb(img: HTMLImageElement): string | undefined {
  const attempts: Array<{ maxSide: number; quality: number }> = [
    { maxSide: 220, quality: 0.66 },
    { maxSide: 176, quality: 0.56 },
    { maxSide: 136, quality: 0.46 },
  ];
  for (const { maxSide, quality } of attempts) {
    const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
    const w = Math.max(1, Math.round((img.width || 160) * scale));
    const h = Math.max(1, Math.round((img.height || 120) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(img, 0, 0, w, h);
    try {
      const webp = canvas.toDataURL('image/webp', quality);
      if (webp.startsWith('data:image/webp') && webp.length <= 32000) {
        return webp;
      }
    } catch {
      /* fallback to jpeg */
    }
    try {
      // iOS Safari/WKWebView는 image/webp 인코딩 미지원(image/png 폴백으로 용량 폭증)이므로 표준 JPEG 폴백 적용
      const jpeg = canvas.toDataURL('image/jpeg', quality);
      if (jpeg.startsWith('data:image/jpeg') && jpeg.length <= 32000) {
        return jpeg;
      }
    } catch {
      /* try smaller dimensions */
    }
  }
  return undefined;
}

export async function tryMakeCompactThumbDataUrl(srcUrl?: string): Promise<string | undefined> {
  if (!srcUrl || typeof document === 'undefined') return undefined;
  if (srcUrl.startsWith('data:image/') && srcUrl.length <= 30000) {
    return srcUrl;
  }
  const loadOnce = (useCors: boolean) =>
    new Promise<string | undefined>((resolve) => {
      const img = new Image();
      if (useCors && !srcUrl.startsWith('data:') && !srcUrl.startsWith('blob:')) {
        img.crossOrigin = 'anonymous';
      }
      const timeout = window.setTimeout(() => resolve(undefined), 1800);
      img.onload = () => {
        window.clearTimeout(timeout);
        try {
          resolve(encodeCanvasCompactThumb(img));
        } catch {
          resolve(undefined);
        }
      };
      img.onerror = () => {
        window.clearTimeout(timeout);
        resolve(undefined);
      };
      img.src = srcUrl;
    });

  const first = await loadOnce(true);
  if (first) return first;
  if (!srcUrl.startsWith('data:') && !srcUrl.startsWith('blob:')) {
    return loadOnce(false);
  }
  return undefined;
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  let nextIdx = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const cur = nextIdx++;
        if (cur >= items.length) break;
        await worker(items[cur], cur);
      }
    })
  );
}

/**
 * PC 마스터(Z-코어 실행 중)가 모바일에서 업로드된 미수신 원본 백업 파일들을
 * 내 PC [사진/Ghosti_Phone_Backup] 폴더로 병렬(4x) 자동 저장합니다.
 */
let mirrorPullInFlight: Promise<{ pulledCount: number; backupDirPath: string | null }> | null = null;
export async function pullPendingMirrorOriginalsToPcBackupFolder(
  preloadedCatalog?: GhostiShadowCatalogItem[]
): Promise<{ pulledCount: number; backupDirPath: string | null }> {
  const ident = getThisDeviceIdentity();
  if (
    ident.deviceKind !== 'pc_master' ||
    !zCoreBridge.isConnected ||
    !hasAuthenticatedHubAccountSession() ||
    isLocalPcBlockedByOtherAccount()
  ) {
    return { pulledCount: 0, backupDirPath: null };
  }
  const ownerEmail = (
    typeof window !== 'undefined'
      ? localStorage.getItem('ghosti_hub_user_email') || localStorage.getItem('userEmail') || ''
      : ''
  )
    .trim()
    .toLowerCase();
  if (mirrorPullInFlight) return mirrorPullInFlight;

  const task = (async () => {
    let catalog = preloadedCatalog;
    if (!catalog) {
      const res = await callGhostiServerBridge<{ items?: GhostiShadowCatalogItem[] }>(
        'device_sync_shadow_catalog',
        { items: [], stripThumbs: true }
      );
      catalog = res.ok && Array.isArray(res.items) ? res.items : [];
    }
    const candidates = catalog.filter(
      (item) =>
        Boolean(item) &&
        item.sourceDeviceId !== ident.deviceId &&
        item.hasMirrorBlob &&
        Boolean(item.sha256) &&
        !pulledMirrorHashes.has(item.sha256!)
    );
    let pulledCount = 0;
    let backupDirPath: string | null = null;
    // 60장 단위 배치 서명 URL 일괄 발급으로 Netlify 왕복 50배 축소 + 6x 병렬 PC 저장
    const signedDlMap = new Map<string, string>();
    const dlBatchSize = 60;
    for (let i = 0; i < candidates.length; i += dlBatchSize) {
      const batchShas = candidates.slice(i, i + dlBatchSize).map((c) => c.sha256!);
      const batchRes = await callGhostiServerBridge<{ urls?: Record<string, string> }>(
        'device_sign_mirror_downloads_batch',
        { sha256List: batchShas }
      );
      if (batchRes.ok && batchRes.urls) {
        for (const [k, v] of Object.entries(batchRes.urls)) {
          if (v) signedDlMap.set(k, v);
        }
      }
    }
    await runWithConcurrency(candidates, 6, async (item) => {
      const sha = item.sha256!;
      let signedDownloadUrl = signedDlMap.get(sha);
      if (!signedDownloadUrl) {
        const dlSign = await callGhostiServerBridge<{ signedDownloadUrl?: string }>(
          'device_sign_mirror_download',
          { sha256: sha }
        );
        if (dlSign.ok && dlSign.signedDownloadUrl) {
          signedDownloadUrl = dlSign.signedDownloadUrl;
        }
      }
      if (!signedDownloadUrl) return;
      try {
        const pullRes = await fetch(getZCoreUrl('/__sync/mirror-pull'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: item.title || sha,
            signedDownloadUrl,
            sha256: sha,
            accountEmail: ownerEmail,
          }),
        });
        const pj = (await pullRes.json().catch(() => ({}))) as {
          ok?: boolean;
          alreadyExists?: boolean;
          savedPath?: string;
          backupDir?: string;
        };
        if (pj.ok) {
          pulledMirrorHashes.add(sha);
          if (!pj.alreadyExists) pulledCount += 1;
          if (pj.backupDir) {
            backupDirPath = pj.backupDir;
          } else if (pj.savedPath) {
            const lastSep = Math.max(pj.savedPath.lastIndexOf('\\'), pj.savedPath.lastIndexOf('/'));
            if (lastSep > 0) backupDirPath = pj.savedPath.slice(0, lastSep);
          }
        }
      } catch {
        /* ignore single file pull failure */
      }
    });
    return { pulledCount, backupDirPath };
  })().finally(() => {
    mirrorPullInFlight = null;
  });

  mirrorPullInFlight = task;
  return task;
}

export async function executeRealDeviceSyncNow(opts: {
  strategy: PrivateSyncStrategy;
  photos: PhotoItem[];
  localDocuments: LocalDocumentFile[];
  email?: string;
  onProgress?: (progress: { phase: string; current: number; total: number }) => void;
}): Promise<{
  ok: boolean;
  reason?: string;
  message?: string;
  mergedCatalog: GhostiShadowCatalogItem[];
  totalCatalogCount: number;
  remotePhotosToMerge: PhotoItem[];
  remoteDocsToMerge: LocalDocumentFile[];
  mirroredUploadCount: number;
  mirroredPullCount: number;
  backupDirPath: string | null;
  packSizeMB: number;
}> {
  if (!hasAuthenticatedHubAccountSession()) {
    return {
      ok: false,
      reason: 'AUTH_REQUIRED',
      mergedCatalog: [],
      totalCatalogCount: 0,
      remotePhotosToMerge: [],
      remoteDocsToMerge: [],
      mirroredUploadCount: 0,
      mirroredPullCount: 0,
      backupDirPath: null,
      packSizeMB: 0,
    };
  }

  const ident = getThisDeviceIdentity(opts.email);
  loadPersistedUploadedMirrorHashes(opts.email);
  const activeLocalPhotos = opts.photos.filter(
    (p) => !p.quarantined && !p.id.startsWith('shadow-remote-')
  );
  const activeLocalDocs = opts.localDocuments.filter(
    (d) => !d.id.startsWith('shadow-remote-doc-')
  );

  let mirroredUploadCount = 0;

  // 1) 양쪽 원본 보관(mirror) 모드일 때: 아직 업로드되지 않은 원본 사진만 증분 병렬 업로드 (이미 백업된 항목은 영구 캐시 + 서버 대조로 0.05초 즉시 스킵)
  const mirrorUploadedIds = new Set<string>();
  const photoShaMap = new Map<string, string>();
  for (const p of activeLocalPhotos) {
    const hashSeed = await sha256HexBrowser(`${p.id}::${p.name}::${p.size}`);
    photoShaMap.set(p.id, `${hashSeed.slice(0, 40)}.jpg`);
  }

  if (opts.strategy === 'mirror') {
    const pendingOriginals: Array<{ photo: PhotoItem; shaKey: string }> = [];
    for (const p of activeLocalPhotos) {
      const shaKey = photoShaMap.get(p.id)!;
      if (uploadedMirrorHashes.has(shaKey)) {
        mirrorUploadedIds.add(p.id);
      } else {
        pendingOriginals.push({ photo: p, shaKey });
      }
    }

    if (pendingOriginals.length > 0) {
      opts.onProgress?.({
        phase: '원본 안전 백업 확인 중',
        current: 0,
        total: pendingOriginals.length,
      });
    }

    const dataUrlToBlobFast = (dataUrl: string): Blob | null => {
      try {
        const commaIdx = dataUrl.indexOf(',');
        if (commaIdx < 0) return null;
        const header = dataUrl.slice(0, commaIdx);
        const mimeMatch = header.match(/data:([^;]+)/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const b64 = dataUrl.slice(commaIdx + 1);
        const bin = atob(b64);
        const len = bin.length;
        const bytes = new Uint8Array(len);
        for (let k = 0; k < len; k += 1) bytes[k] = bin.charCodeAt(k);
        return new Blob([bytes], { type: mime });
      } catch {
        return null;
      }
    };

    const fetchWithTimeout = async (url: string, init?: RequestInit, timeoutMs = 12_000): Promise<Response> => {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const tid = ctrl ? window.setTimeout(() => ctrl.abort(), timeoutMs) : null;
      try {
        return await fetch(url, { ...(init || {}), ...(ctrl ? { signal: ctrl.signal } : {}) });
      } finally {
        if (tid !== null) window.clearTimeout(tid);
      }
    };

    let trialAbortError: { reason?: string; message?: string } | null = null;
    // [기백업 서버 대조 + 60장 배치 서명 일괄 발급]: 이미 서버 mirror_blobs에 있는 파일은 서명·재전송 없이 0.05초 즉시 스킵!
    const signedUploadMap = new Map<string, string>();
    const serverAlreadyUploadedSet = new Set<string>();
    const SIGN_BATCH_SIZE = 60;
    for (let sIdx = 0; sIdx < pendingOriginals.length; sIdx += SIGN_BATCH_SIZE) {
      const batchShas = pendingOriginals.slice(sIdx, sIdx + SIGN_BATCH_SIZE).map((x) => x.shaKey);
      const batchSign = await callGhostiServerBridge<{
        urls?: Record<string, string>;
        alreadyUploaded?: string[];
        reason?: string;
        message?: string;
      }>('device_sign_mirror_uploads_batch', { sha256List: batchShas, skipExisting: true });
      if (
        !batchSign.ok &&
        (batchSign.reason === 'TRIAL_EXPIRED' || batchSign.reason === 'TRIAL_OPT_IN_REQUIRED')
      ) {
        trialAbortError = { reason: batchSign.reason, message: batchSign.message };
        break;
      }
      if (batchSign.ok) {
        if (Array.isArray(batchSign.alreadyUploaded)) {
          for (const existSha of batchSign.alreadyUploaded) {
            if (existSha) {
              serverAlreadyUploadedSet.add(existSha);
              uploadedMirrorHashes.add(existSha);
            }
          }
        }
        if (batchSign.urls) {
          for (const [k, v] of Object.entries(batchSign.urls)) {
            if (v) signedUploadMap.set(k, v);
          }
        }
      }
    }

    const pendingToActuallyUpload: Array<{ photo: PhotoItem; shaKey: string }> = [];
    for (const entry of pendingOriginals) {
      if (serverAlreadyUploadedSet.has(entry.shaKey)) {
        mirrorUploadedIds.add(entry.photo.id);
      } else {
        pendingToActuallyUpload.push(entry);
      }
    }

    if (pendingToActuallyUpload.length > 0 && !trialAbortError) {
      opts.onProgress?.({
        phase: '원본 안전 백업 업로드 중',
        current: 0,
        total: pendingToActuallyUpload.length,
      });
    }

    let uploadDone = 0;
    if (!trialAbortError && pendingToActuallyUpload.length > 0) {
      await runWithConcurrency(pendingToActuallyUpload, 10, async ({ photo: p, shaKey }) => {
        if (trialAbortError) return;
        const candidates = Array.from(
          new Set(
            [p.fullUrl, p.thumbUrl].filter((u): u is string => Boolean(u && u.trim()))
          )
        );
        if (candidates.length === 0) {
          uploadDone += 1;
          opts.onProgress?.({
            phase: '원본 안전 백업 업로드 중',
            current: uploadDone,
            total: pendingToActuallyUpload.length,
          });
          return;
        }
        let blob: Blob | null = null;
        for (const src of candidates) {
          if (src.startsWith('data:')) {
            const fastB = dataUrlToBlobFast(src);
            if (fastB && fastB.size > 0 && fastB.size <= 25 * 1024 * 1024) {
              blob = fastB;
              break;
            }
          }
          try {
            const blobRes = await fetchWithTimeout(src, undefined, 8_000);
            if (!blobRes.ok) continue;
            const b = await blobRes.blob();
            if (b.size > 0 && b.size <= 25 * 1024 * 1024) {
              blob = b;
              break;
            }
          } catch {
            /* try next candidate */
          }
        }
        if (!blob) {
          try {
            const compactFallback = await tryMakeCompactThumbDataUrl(p.thumbUrl || p.fullUrl);
            if (compactFallback) {
              blob = dataUrlToBlobFast(compactFallback);
            }
          } catch {
            /* ignore */
          }
        }
        if (!blob) {
          uploadDone += 1;
          opts.onProgress?.({
            phase: '원본 안전 백업 업로드 중',
            current: uploadDone,
            total: pendingToActuallyUpload.length,
          });
          return;
        }
        try {
          let signedUrl = signedUploadMap.get(shaKey);
          if (!signedUrl) {
            const signUp = await callGhostiServerBridge<{
              signedUploadUrl?: string;
              reason?: string;
              message?: string;
            }>('device_sign_mirror_upload', { sha256: shaKey });
            if (
              !signUp.ok &&
              (signUp.reason === 'TRIAL_EXPIRED' || signUp.reason === 'TRIAL_OPT_IN_REQUIRED')
            ) {
              trialAbortError = { reason: signUp.reason, message: signUp.message };
              return;
            }
            if (signUp.ok && signUp.signedUploadUrl) {
              signedUrl = signUp.signedUploadUrl;
            }
          }
          if (signedUrl) {
            const putRes = await fetchWithTimeout(
              signedUrl,
              {
                method: 'PUT',
                headers: {
                  'Content-Type': blob.type || 'image/jpeg',
                  'x-upsert': 'true',
                },
                body: blob,
              },
              15_000
            );
            let alreadyOnServer = putRes.status === 409;
            if (!putRes.ok && !alreadyOnServer && putRes.status === 400) {
              const errBody = await putRes.text().catch(() => '');
              if (/duplicate|already exists/i.test(errBody)) {
                alreadyOnServer = true;
              }
            }
            if (putRes.ok || alreadyOnServer) {
              uploadedMirrorHashes.add(shaKey);
              mirrorUploadedIds.add(p.id);
              if (putRes.ok) mirroredUploadCount += 1;
            }
          }
        } catch {
          /* continue */
        } finally {
          uploadDone += 1;
          opts.onProgress?.({
            phase: '원본 안전 백업 업로드 중',
            current: uploadDone,
            total: pendingToActuallyUpload.length,
          });
        }
      });
    }
    if (mirroredUploadCount > 0 || serverAlreadyUploadedSet.size > 0) {
      persistUploadedMirrorHashes(opts.email);
    }
    if (trialAbortError) {
      const errObj = trialAbortError as { reason?: string; message?: string };
      return {
        ok: false,
        reason: errObj.reason,
        message: errObj.message,
        mergedCatalog: [],
        totalCatalogCount: 0,
        remotePhotosToMerge: [],
        remoteDocsToMerge: [],
        mirroredUploadCount,
        mirroredPullCount: 0,
        backupDirPath: null,
        packSizeMB: 0,
      };
    }
  }

  // 이미 클라이언트에 반영된 타 기기 카탈로그 ID 목록을 서버에 함께 전달해 수십 MB 중복 썸네일 응답을 원천 차단
  const knownRemoteIds: string[] = [];
  for (const p of opts.photos) {
    if (p.id.startsWith('shadow-remote-')) {
      knownRemoteIds.push(p.id.slice('shadow-remote-'.length));
    }
  }
  for (const d of opts.localDocuments) {
    if (d.id.startsWith('shadow-remote-doc-')) {
      const rawId = d.id.slice('shadow-remote-doc-'.length);
      knownRemoteIds.push(`doc-${rawId}`);
      knownRemoteIds.push(rawId);
    }
  }

  // 2) 장당 ~13KB 초경량 섀도우 카탈로그 증분(Delta) 패킹:
  // 이미 서버 카탈로그에 올라간 항목(동일 shaKey + 동일 mirror 상태)은 재압축·재전송을 생략해 2회차 동기화를 0.5초 내로 단축!
  const syncedCatalogSigs = getSyncedCatalogSigSet(opts.email);
  const deltaPhotos: Array<{ photo: PhotoItem; shaKey: string; sig: string }> = [];
  for (const p of activeLocalPhotos) {
    const shaKey =
      photoShaMap.get(p.id) ||
      `${(await sha256HexBrowser(`${p.id}::${p.name}::${p.size}`)).slice(0, 40)}.jpg`;
    const hasMirror = mirrorUploadedIds.has(p.id);
    const sig = `p::${p.id}::${shaKey}::${hasMirror ? 1 : 0}`;
    if (!syncedCatalogSigs.has(sig)) {
      deltaPhotos.push({ photo: p, shaKey, sig });
    }
  }

  const deltaDocs: Array<{ doc: LocalDocumentFile; shaShort: string; sig: string }> = [];
  for (const doc of activeLocalDocs) {
    const shaShort = (await sha256HexBrowser(`doc::${doc.id}::${doc.fileName}`)).slice(0, 40);
    const sig = `d::${doc.id}::${shaShort}`;
    if (!syncedCatalogSigs.has(sig)) {
      deltaDocs.push({ doc, shaShort, sig });
    }
  }

  const packDeltaAndSync = async (
    photosToPack: Array<{ photo: PhotoItem; shaKey: string; sig: string }>,
    docsToPack: Array<{ doc: LocalDocumentFile; shaShort: string; sig: string }>
  ): Promise<{
    ok: boolean;
    items: GhostiShadowCatalogItem[];
    totalCatalogCount?: number;
    hasCallerDeviceItems?: boolean;
    reason?: string;
    message?: string;
  }> => {
    const outgoing: Array<{ payload: Record<string, unknown>; sig: string }> = new Array(
      photosToPack.length
    );
    const totalToPack = photosToPack.length + docsToPack.length;
    if (totalToPack > 0) {
      opts.onProgress?.({
        phase: '사진·문서 미리보기 준비 중',
        current: 0,
        total: Math.max(1, totalToPack),
      });
    }
    let packedCount = 0;
    await runWithConcurrency(photosToPack, 12, async ({ photo: p, shaKey, sig }, i) => {
      const rawThumb = (p.thumbUrl || p.fullUrl || '').trim();
      let thumbWebp = packedThumbCache.get(shaKey);
      if (!thumbWebp) {
        thumbWebp =
          rawThumb.startsWith('data:image/') && rawThumb.length <= 28_000
            ? rawThumb
            : await tryMakeCompactThumbDataUrl(rawThumb);
        if (thumbWebp) {
          if (packedThumbCache.size > 600) packedThumbCache.clear();
          packedThumbCache.set(shaKey, thumbWebp);
        }
      }
      outgoing[i] = {
        sig,
        payload: {
          id: p.id,
          kind: 'photo',
          title: p.name,
          thumbWebp,
          keywords: (p.tags || []).slice(0, 12),
          ocrSnippet: p.captionKo || (p.keywordsKo || []).join(' ') || '',
          shotDate: p.date || '',
          sourceDeviceId: ident.deviceId,
          sourceDeviceName: ident.displayName,
          byteSize: p.size || 512000,
          sha256: shaKey,
          hasMirrorBlob: mirrorUploadedIds.has(p.id),
        },
      };
      packedCount += 1;
      if (packedCount % 2 === 0 || packedCount === photosToPack.length) {
        opts.onProgress?.({
          phase: '사진·문서 미리보기 준비 중',
          current: packedCount,
          total: Math.max(1, totalToPack),
        });
      }
    });

    for (const { doc, shaShort, sig } of docsToPack) {
      outgoing.push({
        sig,
        payload: {
          id: `doc-${doc.id}`,
          kind: 'doc',
          title: doc.fileName,
          keywords: (doc.keywords || []).slice(0, 14),
          ocrSnippet: (doc.extractedText || doc.title || '').slice(0, 750),
          shotDate: doc.date || '',
          sourceDeviceId: ident.deviceId,
          sourceDeviceName: ident.displayName,
          byteSize: Math.round((doc.sizeKB || 120) * 1024),
          sha256: shaShort,
          hasMirrorBlob: false,
        },
      });
    }

    // 80건 단위 경량 배치 전송(중간 배치는 응답 생략, 최종/2회차는 신규 원격 항목만 경량 수신하여 0.4초 내 완료!)
    const BATCH_SIZE = 80;
    const totalBatches = Math.max(1, Math.ceil(outgoing.length / BATCH_SIZE));
    let latestCatalog: GhostiShadowCatalogItem[] = [];
    let latestTotalCount: number | undefined;
    let latestHasCallerItems: boolean | undefined;
    for (let b = 0; b < totalBatches; b++) {
      const isFinalBatch = b === totalBatches - 1;
      opts.onProgress?.({
        phase: '연결 기기와 목록 맞추는 중',
        current: b,
        total: totalBatches,
      });
      const slice = outgoing.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
      const syncRes = await callGhostiServerBridge<{
        items?: GhostiShadowCatalogItem[];
        totalCatalogCount?: number;
        hasCallerDeviceItems?: boolean;
        reason?: string;
        message?: string;
        entitlement?: GhostiDeviceEntitlementView;
      }>('device_sync_shadow_catalog', {
        items: slice.map((x) => x.payload),
        returnItems: isFinalBatch,
        callerDeviceId: ident.deviceId,
        callerKind: ident.deviceKind,
        knownRemoteIds: isFinalBatch ? knownRemoteIds : undefined,
      });
      if (!syncRes.ok) {
        if (syncRes.entitlement) {
          saveCachedDeviceIntegrationSnapshot({ entitlement: syncRes.entitlement }, opts.email);
        }
        return {
          ok: false,
          items: [],
          reason: syncRes.reason,
          message: syncRes.message,
        };
      }
      for (const x of slice) {
        if (x?.sig) syncedCatalogSigs.add(x.sig);
      }
      if (slice.length > 0) {
        persistSyncedCatalogSigSet(opts.email);
      }
      if (typeof syncRes.totalCatalogCount === 'number') {
        latestTotalCount = syncRes.totalCatalogCount;
      }
      if (typeof syncRes.hasCallerDeviceItems === 'boolean') {
        latestHasCallerItems = syncRes.hasCallerDeviceItems;
      }
      if (isFinalBatch && Array.isArray(syncRes.items)) {
        latestCatalog = syncRes.items;
      }
      opts.onProgress?.({
        phase: '연결 기기와 목록 맞추는 중',
        current: b + 1,
        total: totalBatches,
      });
    }
    return {
      ok: true,
      items: latestCatalog,
      totalCatalogCount: latestTotalCount,
      hasCallerDeviceItems: latestHasCallerItems,
    };
  };

  let syncAttempt = await packDeltaAndSync(deltaPhotos, deltaDocs);
  const serverHasOwnItems =
    typeof syncAttempt.hasCallerDeviceItems === 'boolean'
      ? syncAttempt.hasCallerDeviceItems
      : syncAttempt.items.some((it) => it && it.sourceDeviceId === ident.deviceId);
  // 서버 카탈로그가 비어 있거나 초기화된 상태인데 로컬 시그니처만 남아 스킵된 경우 1회 전체 자동 복구 전송
  if (
    syncAttempt.ok &&
    deltaPhotos.length === 0 &&
    activeLocalPhotos.length > 0 &&
    !serverHasOwnItems
  ) {
    syncedCatalogSigs.clear();
    persistSyncedCatalogSigSet(opts.email);
    const allPhotosToPack = activeLocalPhotos.map((p) => {
      const shaKey = photoShaMap.get(p.id)!;
      const hasMirror = mirrorUploadedIds.has(p.id);
      return { photo: p, shaKey, sig: `p::${p.id}::${shaKey}::${hasMirror ? 1 : 0}` };
    });
    const allDocsToPack = [];
    for (const doc of activeLocalDocs) {
      const shaShort = (await sha256HexBrowser(`doc::${doc.id}::${doc.fileName}`)).slice(0, 40);
      allDocsToPack.push({ doc, shaShort, sig: `d::${doc.id}::${shaShort}` });
    }
    syncAttempt = await packDeltaAndSync(allPhotosToPack, allDocsToPack);
  }

  const mergedCatalog = syncAttempt.items;
  const syncOk = syncAttempt.ok;
  const syncErrorReason = syncAttempt.reason;
  const syncErrorMessage = syncAttempt.message;

  if (!syncOk) {
    return {
      ok: false,
      reason: syncErrorReason,
      message: syncErrorMessage,
      mergedCatalog: [],
      totalCatalogCount: 0,
      remotePhotosToMerge: [],
      remoteDocsToMerge: [],
      mirroredUploadCount,
      mirroredPullCount: 0,
      backupDirPath: null,
      packSizeMB: 0,
    };
  }

  // 3) 다른 내 기기에서 올라온 섀도우 사진 + PC 문서를 현재 기기 검색 풀에 양방향 병합
  const existingPhotoIds = new Set(opts.photos.map((p) => p.id));
  const existingDocIds = new Set(opts.localDocuments.map((d) => d.id));
  const remotePhotosToMerge: PhotoItem[] = [];
  const remoteDocsToMerge: LocalDocumentFile[] = [];
  let mirroredPullCount = 0;
  let backupDirPath: string | null = null;

  // 모바일에서 원본 백업을 올렸다면 실시간 채널로 PC 마스터에 즉시 수신 신호 발송
  if (
    ident.deviceKind !== 'pc_master' &&
    opts.strategy === 'mirror' &&
    (mirroredUploadCount > 0 || mirrorUploadedIds.size > 0)
  ) {
    broadcastDeviceIntegrationStateUpdate({
      mirrorBackupReadyCount: mirroredUploadCount || mirrorUploadedIds.size,
    });
  }

  // PC 마스터(Z-코어 실행 중)라면 모바일에서 올린 미수신 원본 백업을 병렬(4x)로 즉시 내 PC 백업 폴더에 저장
  if (ident.deviceKind === 'pc_master' && zCoreBridge.isConnected) {
    const pullRes = await pullPendingMirrorOriginalsToPcBackupFolder(mergedCatalog);
    mirroredPullCount = pullRes.pulledCount;
    backupDirPath = pullRes.backupDirPath;
  }

  for (const item of mergedCatalog) {
    if (!item || item.sourceDeviceId === ident.deviceId) continue;

    if (item.kind === 'photo' && item.thumbWebp) {
      const remoteId = `shadow-remote-${item.id}`;
      if (!existingPhotoIds.has(remoteId) && !existingPhotoIds.has(item.id)) {
        remotePhotosToMerge.push({
          id: remoteId,
          name: item.title || '연결 기기 사진',
          size: item.byteSize || 512000,
          date: item.shotDate || item.syncedAt.slice(0, 10),
          mtimeMs: Date.parse(item.syncedAt) || Date.now(),
          locationKo: `${item.sourceDeviceName}`,
          tags: Array.from(new Set([...(item.keywords || []), item.sourceDeviceName])),
          captionKo:
            item.ocrSnippet || `${item.sourceDeviceName}에서 동기화된 미리보기 항목`,
          keywordsKo: item.keywords || [],
          thumbUrl: item.thumbWebp,
          fullUrl: item.thumbWebp,
          bookmarked: false,
          quarantined: false,
        });
      }
    } else if (item.kind === 'doc') {
      const rawDocId = item.id.startsWith('doc-') ? item.id.slice(4) : item.id;
      const remoteDocId = `shadow-remote-doc-${rawDocId}`;
      if (!existingDocIds.has(remoteDocId) && !existingDocIds.has(rawDocId)) {
        const cleanFileName = item.title || '연결된 PC 문서';
        const extRaw = cleanFileName.includes('.')
          ? cleanFileName.slice(cleanFileName.lastIndexOf('.') + 1).toUpperCase()
          : 'DOC';
        remoteDocsToMerge.push({
          id: remoteDocId,
          fileName: cleanFileName,
          ext: extRaw || 'DOC',
          title: cleanFileName,
          categoryBadge: `${item.sourceDeviceName}`,
          extractedText: item.ocrSnippet || cleanFileName,
          keywords: Array.from(new Set([...(item.keywords || []), item.sourceDeviceName])),
          date: item.shotDate || item.syncedAt.slice(0, 10),
          sizeKB: Math.max(1, Math.round((item.byteSize || 122880) / 1024)),
          deviceSource: `${item.sourceDeviceName}`,
        });
      }
    }
  }

  const totalCatalogCount = Math.max(
    syncAttempt.totalCatalogCount ?? 0,
    mergedCatalog.length,
    activeLocalPhotos.length + activeLocalDocs.length
  );
  const packSizeMB = Number(Math.max(0.1, (totalCatalogCount * 13) / 1024).toFixed(2));
  return {
    ok: true,
    mergedCatalog,
    totalCatalogCount,
    remotePhotosToMerge,
    remoteDocsToMerge,
    mirroredUploadCount,
    mirroredPullCount,
    backupDirPath,
    packSizeMB,
  };
}

export function startDeviceIntegrationRealtimeRuntime(opts: {
  email: string;
  userId: string;
  onIncomingClip: (clip: GhostiSyncedClipItem, meta?: { isLocalAutoCapture?: boolean }) => void;
  onClipsSynced?: (clips: GhostiSyncedClipItem[]) => void;
  onRemoteMonitorCast?: (packet: RemoteMonitorCastPacket) => void;
  onDevicesUpdated?: (payload: {
    devices: GhostiConnectedDeviceDto[];
    pairingCode: string | null;
    entitlement: GhostiDeviceEntitlementView | null;
    revokedSelf?: boolean;
  }) => void;
  onPairingCompleted?: (info: {
    ok: boolean;
    alreadyPaired?: boolean;
    deviceCount: number;
    reason?: string;
    expectedEmailHint?: string;
  }) => void;
  onSelfRevoked?: (devices: GhostiConnectedDeviceDto[]) => void;
  onTeleportReceived?: (info: {
    fileName: string;
    fullText: string;
    sourceDevice: string;
  }) => void;
}): () => void {
  let disposed = false;
  const normEmail = (opts.email || '').trim().toLowerCase();
  const ident = getThisDeviceIdentity(normEmail);

  let localBus: BroadcastChannel | null = null;
  let osClipTicker: { stop: () => void } | null = null;
  let mobileMailboxTicker: { stop: () => void } | null = null;
  let checkingOsClip = false;

  const cleanup = () => {
    disposed = true;
    if (osClipTicker) {
      osClipTicker.stop();
      osClipTicker = null;
    }
    if (mobileMailboxTicker) {
      mobileMailboxTicker.stop();
      mobileMailboxTicker = null;
    }
    if (activeClipboardWorker) {
      try {
        activeClipboardWorker.terminate();
      } catch {
        /* ignore */
      }
      activeClipboardWorker = null;
    }
    if (localBus) {
      try {
        localBus.close();
      } catch {
        /* ignore */
      }
      localBus = null;
    }
    if (activeClipboardPollTimer !== null) {
      window.clearInterval(activeClipboardPollTimer);
      activeClipboardPollTimer = null;
    }
    if (activePairChannel && (activePairClient || supabase)) {
      void (activePairClient || supabase)?.removeChannel(activePairChannel);
      activePairChannel = null;
      activePairClient = null;
      activePairSubscribed = false;
      activePairTopic = '';
    }
  };

  if (!normEmail || !opts.userId || opts.userId === 'guest' || !hasAuthenticatedHubAccountSession()) {
    cleanup();
    return cleanup;
  }

  // 0.00ms 계정 격리 로컬 캐시 즉시 복원 (새로고침·탭 이동 시 2초 대기 없이 D-30 및 연결 기기 상태 즉시 표시)
  const cachedSnap = loadCachedDeviceIntegrationSnapshot(normEmail);
  if (cachedSnap && opts.onDevicesUpdated) {
    opts.onDevicesUpdated({
      devices: cachedSnap.devices,
      pairingCode: cachedSnap.pairingCode,
      entitlement: cachedSnap.entitlement,
    });
  }

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      localBus = new BroadcastChannel(DEVICE_SYNC_BROADCAST_CHANNEL);
      localBus.onmessage = (ev) => {
        if (disposed || !opts.onDevicesUpdated) return;
        const msg = ev.data as {
          type?: string;
          payload?: {
            devices?: GhostiConnectedDeviceDto[];
            entitlement?: GhostiDeviceEntitlementView | null;
          };
        };
        if (msg?.type === 'DEVICE_STATE_UPDATED' && msg.payload) {
          saveCachedDeviceIntegrationSnapshot(
            {
              ...(msg.payload.devices ? { devices: msg.payload.devices } : {}),
              ...(msg.payload.entitlement !== undefined
                ? { entitlement: msg.payload.entitlement }
                : {}),
            },
            normEmail
          );
          opts.onDevicesUpdated({
            devices: msg.payload.devices || loadCachedDeviceIntegrationSnapshot(normEmail)?.devices || [],
            pairingCode: loadCachedDeviceIntegrationSnapshot(normEmail)?.pairingCode ?? null,
            entitlement:
              msg.payload.entitlement !== undefined
                ? msg.payload.entitlement
                : loadCachedDeviceIntegrationSnapshot(normEmail)?.entitlement ?? null,
          });
        } else if (
          (ev.data as { type?: string })?.type === 'LOCAL_CLIP_SYNCED' &&
          (ev.data as { payload?: GhostiSyncedClipItem })?.payload
        ) {
          const clip = (ev.data as { payload: GhostiSyncedClipItem }).payload;
          opts.onIncomingClip(clip, { isLocalAutoCapture: true });
        }
      };
    }
  } catch {
    /* ignore */
  }

  let realtimeReconnectTimer: number | null = null;
  let realtimeWatchdogTimer: number | null = null;
  let mobileResumeCaptureTimer: number | null = null;
  let settingUpRealtime = false;
  let zCoreUnsubscribe: (() => void) | null = null;
  let capAppStateHandle: { remove?: () => Promise<void> | void } | null = null;

  const clearRealtimeTimers = () => {
    if (realtimeReconnectTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(realtimeReconnectTimer);
      realtimeReconnectTimer = null;
    }
    if (realtimeWatchdogTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(realtimeWatchdogTimer);
      realtimeWatchdogTimer = null;
    }
  };

  const scheduleRealtimeReconnect = (delayMs = 800) => {
    if (disposed || typeof window === 'undefined') return;
    if (realtimeReconnectTimer !== null) return;
    realtimeReconnectTimer = window.setTimeout(() => {
      realtimeReconnectTimer = null;
      if (!disposed && !activePairSubscribed) {
        void setupRealtimeChannel();
      }
    }, delayMs);
  };

  const setupRealtimeChannel = async (forceReconnect = false) => {
    if (disposed || settingUpRealtime) return;
    settingUpRealtime = true;
    try {
      // 모든 클립보드 페이로드가 클라이언트에서 AES-256-GCM 종단간 암호화되며 채널 토픽도 SHA-256 해시로 격리되므로
      // hub-supabase-bridge 왕복·5초 JWT 워치독 대기 없이 공개 Realtime 클라이언트로 0.1초 만에 즉시 직결합니다.
      const sbClient: SupabaseClient | null =
        (await ensureGhostiPublicSupabaseClient()) || supabase;
      if (disposed || !sbClient) {
        scheduleRealtimeReconnect(1200);
        return;
      }

      const emailHash = (await sha256HexBrowser(normEmail)).slice(0, 24);
      const topic = `ghosti:pair:${emailHash}`;
      if (
        !forceReconnect &&
        isRealtimeChannelActuallyHealthy() &&
        activePairTopic === topic &&
        activePairClient === sbClient
      ) {
        return;
      }
      if (activePairChannel && (activePairClient || supabase)) {
        try {
          void (activePairClient || supabase)?.removeChannel(activePairChannel);
        } catch {
          /* ignore */
        }
        activePairChannel = null;
        activePairClient = null;
        activePairSubscribed = false;
      }

      clearRealtimeTimers();
      activePairTopic = topic;
      activePairClient = sbClient;
      const ch = sbClient.channel(topic, {
        config: { broadcast: { self: false } },
      });

      ch.on('broadcast', { event: 'DEVICE_STATE_UPDATED' }, ({ payload }) => {
        if (disposed || !payload || !opts.onDevicesUpdated) return;
        const incomingDevices = Array.isArray(payload.devices)
          ? (payload.devices as GhostiConnectedDeviceDto[])
          : undefined;
        const incomingEnt =
          payload.entitlement !== undefined
            ? (payload.entitlement as GhostiDeviceEntitlementView | null)
            : undefined;
        const revokedDevId =
          typeof payload.revokedDeviceId === 'string' ? payload.revokedDeviceId.trim() : '';
        const prevSnap = loadCachedDeviceIntegrationSnapshot(normEmail);
        const mergedDevices = incomingDevices ?? prevSnap?.devices ?? [];
        const mergedEnt = incomingEnt !== undefined ? incomingEnt : prevSnap?.entitlement ?? null;
        const isSelfNowRevoked = Boolean(revokedDevId && revokedDevId === ident.deviceId);
        const isSelfActiveInBroadcast = Boolean(
          !isSelfNowRevoked && mergedDevices.some((d) => d.device_id === ident.deviceId)
        );
        if (isSelfNowRevoked) {
          thisDeviceRevokedLocally = true;
        } else if (isSelfActiveInBroadcast) {
          thisDeviceRevokedLocally = false;
        }
        saveCachedDeviceIntegrationSnapshot(
          {
            devices: mergedDevices,
            entitlement: mergedEnt,
          },
          normEmail
        );
        opts.onDevicesUpdated({
          devices: mergedDevices,
          pairingCode: prevSnap?.pairingCode ?? null,
          entitlement: mergedEnt,
          revokedSelf: isSelfNowRevoked ? true : isSelfActiveInBroadcast ? false : undefined,
        });
        if (isSelfNowRevoked && opts.onSelfRevoked) {
          opts.onSelfRevoked(mergedDevices);
        }
        const mirrorReadyCount = Number(payload.mirrorBackupReadyCount || 0);
        if (
          mirrorReadyCount > 0 &&
          payload.senderDeviceId !== ident.deviceId &&
          ident.deviceKind === 'pc_master' &&
          zCoreBridge.isConnected
        ) {
          void pullPendingMirrorOriginalsToPcBackupFolder();
        }
      })
        .on('broadcast', { event: 'E2EE_CLIPBOARD_PUSH' }, async ({ payload }) => {
          if (disposed || thisDeviceRevokedLocally || !payload?.cipherB64 || !payload?.ivB64) return;
          if (!isCurrentAccountSyncUnlocked(normEmail)) return;
          const senderId = String(payload.senderDeviceId || '');
          if (senderId === ident.deviceId) return;
          const hash = String(payload.clipHash || '');
          const createdAtStr = String(payload.createdAt || new Date().toISOString());
          const envKey = buildCanonicalEnvelopeKey(senderId, hash, createdAtStr);
          if (deliveredRemoteEnvelopeKeys.has(envKey)) return;
          if (hash && isDuplicateBurstFromSameSender(senderId, hash)) {
            rememberDeliveredEnvelope(envKey, normEmail);
            return;
          }

          const cachedUid = loadCanonicalE2eeUid(normEmail);
          const plain = await decryptClipboardE2ee(
            String(payload.cipherB64),
            String(payload.ivB64),
            normEmail,
            opts.userId,
            cachedUid ? [cachedUid] : undefined
          );
          if (!plain) return;
          const resolvedHash = hash || (await sha256HexBrowser(plain));
          const resolvedEnvKey = buildCanonicalEnvelopeKey(senderId, resolvedHash, createdAtStr);
          if (deliveredRemoteEnvelopeKeys.has(resolvedEnvKey)) return;
          if (isDuplicateBurstFromSameSender(senderId, resolvedHash)) {
            rememberDeliveredEnvelope(resolvedEnvKey, normEmail);
            return;
          }

          const createdAtMs = Date.parse(createdAtStr) || Date.now();
          const justPushedLocallyNow =
            lastLocalPushTimestampMs > 0 && Date.now() - lastLocalPushTimestampMs < 2200;

          const clipItem: GhostiSyncedClipItem = {
            clipHash: resolvedHash,
            text: plain,
            senderDeviceId: senderId,
            senderName: String(payload.senderName || '연결된 내 기기'),
            createdAt: createdAtStr,
            encryptedE2ee: true,
          };
          const nextClips = pruneSyncedClipsToSevenDays([
            clipItem,
            ...loadCachedSyncedClips(normEmail).filter((c) => c.clipHash !== clipItem.clipHash),
          ]);
          saveCachedSyncedClips(nextClips, normEmail);
          if (opts.onClipsSynced) {
            opts.onClipsSynced(nextClips);
          }

          if (justPushedLocallyNow) {
            rememberDeliveredEnvelope(resolvedEnvKey, normEmail);
            return;
          }

          const injected = await writeTextToLocalOsClipboard(plain, resolvedHash);
          if (injected) {
            osInjectedEnvelopeKeys.add(resolvedEnvKey);
            rememberDeliveredEnvelope(resolvedEnvKey, normEmail);
            recordDeliveredSenderClipHash(senderId, resolvedHash);
            if (pendingOsInjectClip?.envKey === resolvedEnvKey) {
              pendingOsInjectClip = null;
            }
            opts.onIncomingClip(clipItem, { isLocalAutoCapture: false });
          } else {
            // 모바일 백그라운드·포커스 전환 직전에는 토스트를 백그라운드에서 소모하지 않고,
            // 창 포커스 확보 직후 실제 OS 클립보드 주입 성공과 동시에 도착 토스트를 띄웁니다.
            pendingOsInjectClip = { envKey: resolvedEnvKey, item: clipItem, createdAtMs };
            if (ident.deviceKind === 'pc_master') {
              opts.onIncomingClip(clipItem, { isLocalAutoCapture: false });
            } else {
              schedulePendingOsInjectFlush();
            }
          }
        })
        .on('broadcast', { event: 'MONITOR_CAST_REMOTE' }, ({ payload }) => {
          if (disposed || !payload) return;
          if (!isCurrentAccountSyncUnlocked(normEmail)) return;
          const pkt = payload as RemoteMonitorCastPacket;
          if (opts.onRemoteMonitorCast) {
            opts.onRemoteMonitorCast(pkt);
          }
          window.dispatchEvent(new CustomEvent('ghosti_remote_monitor_cast', { detail: pkt }));
        })
        .on('broadcast', { event: 'TELEPORT_OCR_VANGUARD' }, async ({ payload }) => {
          if (disposed || thisDeviceRevokedLocally || !payload) return;
          if (!isCurrentAccountSyncUnlocked(normEmail)) return;
          if (payload.senderDeviceId && payload.senderDeviceId === ident.deviceId) return;
          const fileName = String(payload.fileName || payload.file_name || '스마트폰 사진').trim();
          const sourceDevice = String(payload.sourceDevice || payload.source_device || '내 스마트폰').trim();
          const fullText = String(
            payload.fullText || payload.ocr_text || payload.summary || fileName
          ).trim();
          if (!fullText) return;

          // 1) PC 엔진(/api/teleport/ocr-vanguard)에 선발대 패킷 저장 ➔ Ctrl+0 귀신창 헤더 표시 + Windows OS 클립보드 자동 장전
          if (zCoreBridge.isConnected) {
            try {
              await fetch(getZCoreUrl('/api/teleport/ocr-vanguard'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...payload,
                  fileName,
                  file_name: fileName,
                  fullText,
                  ocr_text: fullText,
                  sourceDevice,
                  source_device: sourceDevice,
                }),
              });
            } catch {
              /* ignore */
            }
          }

          // 2) PC OS 클립보드에도 이중 안전 장전 (구버전 엔진·브라우저 환경에서도 메모장 Ctrl+V 즉시 붙여넣기 보장)
          const clipHash = await sha256HexBrowser(fullText);
          await writeTextToLocalOsClipboard(fullText, clipHash);

          // 3) 웹 화면 클립보드 목록 및 도착 토스트 즉시 갱신
          const clipItem: GhostiSyncedClipItem = {
            clipHash,
            text: fullText,
            senderDeviceId: String(payload.senderDeviceId || 'mobile-teleport'),
            senderName: `${sourceDevice} · ${fileName}`,
            createdAt: String(payload.sent_at || new Date().toISOString()),
            encryptedE2ee: true,
          };
          const nextClips = pruneSyncedClipsToSevenDays([
            clipItem,
            ...loadCachedSyncedClips(normEmail).filter((c) => c.clipHash !== clipItem.clipHash),
          ]);
          saveCachedSyncedClips(nextClips, normEmail);
          opts.onIncomingClip(clipItem, { isLocalAutoCapture: false });
          if (opts.onTeleportReceived) {
            opts.onTeleportReceived({ fileName, fullText, sourceDevice });
          }
        })
        .subscribe((status) => {
          if (disposed || activePairChannel !== ch) return;
          if (status === 'SUBSCRIBED') {
            activePairSubscribed = true;
            clearRealtimeTimers();
            if (pendingDeviceStatePacket) {
              const pkt = pendingDeviceStatePacket;
              pendingDeviceStatePacket = null;
              void ch.send({
                type: 'broadcast',
                event: 'DEVICE_STATE_UPDATED',
                payload: pkt,
              });
            }
            if (pendingClipBroadcastPacket) {
              const clipPkt = pendingClipBroadcastPacket;
              pendingClipBroadcastPacket = null;
              void ch.send({
                type: 'broadcast',
                event: 'E2EE_CLIPBOARD_PUSH',
                payload: clipPkt,
              });
            }
            if (pendingTeleportPacket) {
              const tpPkt = pendingTeleportPacket;
              pendingTeleportPacket = null;
              void ch.send({
                type: 'broadcast',
                event: 'TELEPORT_OCR_VANGUARD',
                payload: tpPkt,
              });
            }
          } else if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT' ||
            status === 'CLOSED'
          ) {
            activePairSubscribed = false;
            scheduleRealtimeReconnect(800);
          }
        });

      activePairChannel = ch;
    } finally {
      settingUpRealtime = false;
    }
  };

  activePairReconnectTrigger = () => {
    if (!disposed && !isRealtimeChannelActuallyHealthy()) {
      void setupRealtimeChannel(true);
    }
  };

  const inspectAndPushLocalOsClipboard = async (
    isBaselineOnly = false,
    isUserGesture = false
  ): Promise<'PUSHED' | 'EMPTY' | 'SKIPPED'> => {
    if (disposed || checkingOsClip || thisDeviceRevokedLocally || !hasAuthenticatedHubAccountSession()) {
      return 'SKIPPED';
    }
    if (!isBaselineOnly && !isCurrentAccountSyncUnlocked(normEmail)) return 'SKIPPED';
    checkingOsClip = true;
    try {
      const res = await captureAndPushCurrentOsClipboard({
        email: normEmail,
        userId: opts.userId,
        isBaselineOnly,
        isUserGesture,
      });
      if (!disposed && res.ok && res.item) {
        opts.onIncomingClip(res.item, { isLocalAutoCapture: true });
        return 'PUSHED';
      }
      return res.reason === 'EMPTY' ? 'EMPTY' : 'SKIPPED';
    } catch {
      return 'SKIPPED';
    } finally {
      checkingOsClip = false;
    }
  };

  const syncRemoteMailboxToUi = async (injectToOs: boolean): Promise<void> => {
    if (disposed || thisDeviceRevokedLocally || !hasAuthenticatedHubAccountSession()) return;
    if (!isCurrentAccountSyncUnlocked(normEmail)) return;
    const pulled = await pullDelayedE2eeClipboardMailbox({
      email: normEmail,
      userId: opts.userId,
      injectToOsClipboard: injectToOs,
    });
    if (disposed) return;
    if (pulled.items.length > 0 && opts.onClipsSynced) {
      opts.onClipsSynced(pulled.items);
    }
    if (pulled.newlyDeliveredExternal) {
      opts.onIncomingClip(pulled.newlyDeliveredExternal, { isLocalAutoCapture: false });
    } else if (injectToOs && pendingOsInjectClip && ident.deviceKind === 'mobile') {
      schedulePendingOsInjectFlush();
    }
  };

  let pendingInjectFlushTimer: number | null = null;
  let pendingInjectAttempts = 0;

  const tryFlushPendingOsInjectClip = async (): Promise<boolean> => {
    if (disposed || !pendingOsInjectClip) return false;
    const pending = pendingOsInjectClip;
    if (Date.now() - pending.createdAtMs > 10 * 60 * 1000) {
      rememberDeliveredEnvelope(pending.envKey, normEmail);
      pendingOsInjectClip = null;
      return false;
    }
    const justPushedLocallyNow =
      lastLocalPushTimestampMs > 0 && Date.now() - lastLocalPushTimestampMs < 2200;
    if (justPushedLocallyNow) {
      rememberDeliveredEnvelope(pending.envKey, normEmail);
      pendingOsInjectClip = null;
      return false;
    }
    const ok = await writeTextToLocalOsClipboard(pending.item.text, pending.item.clipHash);
    if (!ok) return false;

    osInjectedEnvelopeKeys.add(pending.envKey);
    rememberDeliveredEnvelope(pending.envKey, normEmail);
    recordDeliveredSenderClipHash(pending.item.senderDeviceId, pending.item.clipHash);
    if (pendingOsInjectClip?.envKey === pending.envKey) {
      pendingOsInjectClip = null;
    }
    opts.onIncomingClip(pending.item, { isLocalAutoCapture: false });
    return true;
  };

  function schedulePendingOsInjectFlush(resetAttempts = true): void {
    if (disposed || typeof window === 'undefined' || !pendingOsInjectClip) return;
    if (resetAttempts) {
      pendingInjectAttempts = 0;
    }
    if (pendingInjectFlushTimer !== null) {
      window.clearTimeout(pendingInjectFlushTimer);
      pendingInjectFlushTimer = null;
    }
    const delays = [75, 180, 380, 750];
    const delayMs = delays[Math.min(pendingInjectAttempts, delays.length - 1)];
    pendingInjectFlushTimer = window.setTimeout(async () => {
      pendingInjectFlushTimer = null;
      if (disposed || !pendingOsInjectClip) return;
      const flushed = await tryFlushPendingOsInjectClip();
      if (!flushed && pendingOsInjectClip && pendingInjectAttempts < delays.length - 1) {
        pendingInjectAttempts += 1;
        schedulePendingOsInjectFlush(false);
      }
    }, delayMs);
  }

  const flushPendingNativeMobileClips = async (): Promise<void> => {
    if (
      disposed ||
      thisDeviceRevokedLocally ||
      !isCapacitorNativeMobileRuntime() ||
      !hasAuthenticatedHubAccountSession() ||
      !isCurrentAccountSyncUnlocked(normEmail)
    ) {
      return;
    }
    try {
      const pending = await consumePendingNativeClipboardOutbound();
      if (disposed || pending.length === 0) return;
      for (const entry of pending.reverse()) {
        if (disposed) break;
        const cleanTxt = String(entry.text || '').trim();
        if (!cleanTxt) continue;
        const pushed = await pushCrossDeviceClipboardText({
          text: cleanTxt,
          email: normEmail,
          userId: opts.userId,
          isAutoOsCapture: true,
        });
        if (!disposed && pushed.ok && pushed.item) {
          opts.onIncomingClip(pushed.item, { isLocalAutoCapture: true });
        }
      }
    } catch {
      /* ignore */
    }
  };

  let mobileResumeRetryTimer: number | null = null;
  let mobileResumeCaptureRunning = false;
  let mobileResumeSyncPending = false;
  let mobileResumeFireAtMs = 0;
  const isMobileRuntimeVisibleOrNativeActive = (bypassVisibilityGuard: boolean): boolean => {
    if (bypassVisibilityGuard || isCapacitorNativeMobileRuntime()) return true;
    return typeof document === 'undefined' || document.visibilityState === 'visible';
  };

  const finishMobileForegroundSync = async (
    pushedLocalNow: boolean,
    alsoSyncRemoteAfter: boolean,
    bypassVisibilityGuard = false,
    prefetchedRemote?: Promise<{
      items: GhostiSyncedClipItem[];
      newlyDeliveredExternal: GhostiSyncedClipItem | null;
    } | null> | null
  ) => {
    const shouldSyncRemote = alsoSyncRemoteAfter || mobileResumeSyncPending;
    mobileResumeSyncPending = false;
    if (!shouldSyncRemote || disposed || !isMobileRuntimeVisibleOrNativeActive(bypassVisibilityGuard)) {
      return;
    }
    if (prefetchedRemote) {
      const pulled = await prefetchedRemote.catch(() => null);
      if (disposed) return;
      if (pulled && pulled.items.length > 0 && opts.onClipsSynced) {
        opts.onClipsSynced(pulled.items);
      }
    }
    if (pushedLocalNow && pendingOsInjectClip) {
      rememberDeliveredEnvelope(pendingOsInjectClip.envKey, normEmail);
      pendingOsInjectClip = null;
      return;
    }
    if (!pushedLocalNow && pendingOsInjectClip) {
      const flushed = await tryFlushPendingOsInjectClip();
      if (!flushed && pendingOsInjectClip) {
        schedulePendingOsInjectFlush();
      }
      if (prefetchedRemote) return;
    }
    if (!prefetchedRemote) {
      await syncRemoteMailboxToUi(!pushedLocalNow);
    }
  };

  const triggerMobileForegroundCapture = (
    alsoSyncRemoteAfter = false,
    initialDelayMs = 25,
    bypassVisibilityGuard = false
  ) => {
    if (disposed || thisDeviceRevokedLocally || ident.deviceKind !== 'mobile' || typeof window === 'undefined') return;
    if (alsoSyncRemoteAfter) {
      mobileResumeSyncPending = true;
    }
    // [0ms 병렬 원격 우체통 선행 조회]: 로컬 클립보드 점검(25~100ms)이 끝나기를 직렬 대기하지 않고,
    // 앱을 여는 0ms 즉시 서버 우체통 조회를 병렬 출발시켜 도착 토스트·클립보드 장전 체감 지연을 ~0.2초로 단축합니다!
    const prefetchedRemotePromise =
      alsoSyncRemoteAfter &&
      hasAuthenticatedHubAccountSession() &&
      isCurrentAccountSyncUnlocked(normEmail)
        ? pullDelayedE2eeClipboardMailbox({
            email: normEmail,
            userId: opts.userId,
            injectToOsClipboard: false,
          }).catch(() => null)
        : null;

    if (mobileResumeCaptureRunning) {
      if (alsoSyncRemoteAfter && !pushedLocalGuardActive()) {
        void prefetchedRemotePromise?.then(async (pulled) => {
          if (disposed) return;
          if (pulled && pulled.items.length > 0 && opts.onClipsSynced) {
            opts.onClipsSynced(pulled.items);
          }
          if (pendingOsInjectClip) {
            const flushed = await tryFlushPendingOsInjectClip();
            if (!flushed && pendingOsInjectClip) schedulePendingOsInjectFlush();
          }
        });
      }
      return;
    }
    const clampedDelay = Math.max(15, initialDelayMs);
    const targetFireAt = Date.now() + clampedDelay;
    if (mobileResumeCaptureTimer !== null && mobileResumeFireAtMs > 0 && mobileResumeFireAtMs <= targetFireAt + 30) {
      return;
    }
    if (mobileResumeCaptureTimer !== null) {
      window.clearTimeout(mobileResumeCaptureTimer);
    }
    if (mobileResumeRetryTimer !== null) {
      window.clearTimeout(mobileResumeRetryTimer);
      mobileResumeRetryTimer = null;
    }
    mobileResumeFireAtMs = targetFireAt;
    mobileResumeCaptureTimer = window.setTimeout(async () => {
      mobileResumeCaptureTimer = null;
      mobileResumeFireAtMs = 0;
      if (disposed || !isMobileRuntimeVisibleOrNativeActive(bypassVisibilityGuard)) return;
      mobileResumeCaptureRunning = true;
      try {
        await flushPendingNativeMobileClips();
        const firstResult = await inspectAndPushLocalOsClipboard(false, false);
        if (disposed) {
          mobileResumeCaptureRunning = false;
          return;
        }
        // 안드로이드 10+ 포커스 전환 찰나에 EMPTY였다면 75ms 뒤 1회만 빠르게 재확인 후 병렬 조회된 원격 우체통 즉시 주입
        if (firstResult === 'EMPTY' && isCapacitorAndroidRuntime()) {
          mobileResumeRetryTimer = window.setTimeout(async () => {
            mobileResumeRetryTimer = null;
            try {
              if (disposed || !isMobileRuntimeVisibleOrNativeActive(bypassVisibilityGuard)) return;
              const secondResult = await inspectAndPushLocalOsClipboard(false, false);
              await finishMobileForegroundSync(
                secondResult === 'PUSHED',
                alsoSyncRemoteAfter,
                bypassVisibilityGuard,
                prefetchedRemotePromise
              );
            } finally {
              mobileResumeCaptureRunning = false;
            }
          }, 75);
          return;
        }
        await finishMobileForegroundSync(
          firstResult === 'PUSHED',
          alsoSyncRemoteAfter,
          bypassVisibilityGuard,
          prefetchedRemotePromise
        );
        mobileResumeCaptureRunning = false;
      } catch {
        mobileResumeCaptureRunning = false;
      }
    }, clampedDelay);
  };

  function pushedLocalGuardActive(): boolean {
    return lastLocalPushTimestampMs > 0 && Date.now() - lastLocalPushTimestampMs < 2200;
  }

  const pushNativeClipboardAuthContext = () => {
    if (typeof window === 'undefined') return;
    const hubToken = (getSessionToken() || localStorage.getItem('merlin_session_token') || '').trim();
    const canonicalUid = resolveCanonicalE2eeUserId(opts.userId, normEmail);
    const bridgeUrl = resolveHubSupabaseBridgeEndpoint();
    if (!hubToken || !canonicalUid || !normEmail) return;

    if (isCapacitorNativeMobileRuntime()) {
      void syncSharedNativeClipboardAuth({
        email: normEmail,
        canonicalUserId: canonicalUid,
        hubToken,
        deviceId: ident.deviceId,
        deviceName: ident.displayName,
        bridgeUrl,
      });
      return;
    }

    if (ident.deviceKind === 'pc_master' && zCoreBridge.isConnected && !isLocalPcBlockedByOtherAccount()) {
      void fetch(getZCoreUrl('/__sync/auth-context'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normEmail,
          canonicalUserId: canonicalUid,
          hubToken,
          deviceId: ident.deviceId,
          deviceName: ident.displayName,
          bridgeUrl,
          syncUnlocked: isCurrentAccountSyncUnlocked(normEmail),
        }),
      }).catch(() => {});
    }
  };

  const boot = async () => {
    loadDeliveredEnvelopesOnce(normEmail);
    if (isCapacitorNativeMobileRuntime()) {
      const existingCached = loadCachedSyncedClips(normEmail);
      if (existingCached.length > 0) {
        void syncSharedNativeClipboardHistory(existingCached);
      }
      pushNativeClipboardAuthContext();
      void flushPendingNativeMobileClips();
    }

    // 0) PBKDF2 AES-256-GCM 암호화 키를 백그라운드에서 선행 예열 (첫 Ctrl+C 시 ~400ms 지연 제거)
    void prewarmAccountE2eeKey(normEmail, opts.userId);

    // 1) 실시간 채널 구독을 최우선 0ms 즉시 병렬 착수
    const realtimePromise = setupRealtimeChannel();

    // 2) 초기 클립보드 기준점 비차단 기록 (iOS는 baselineOnly로 changeCount만 기록하여 불필요한 OS 붙여넣기 배너 0회)
    if (ident.deviceKind === 'pc_master') {
      if (zCoreBridge.isConnected) {
        pushNativeClipboardAuthContext();
        void inspectAndPushLocalOsClipboard(true, false);
      }
      zCoreUnsubscribe = zCoreBridge.subscribe((connected) => {
        if (disposed || !connected) return;
        pushNativeClipboardAuthContext();
        if (pendingOsInjectClip) {
          void tryFlushPendingOsInjectClip();
        } else if (!lastObservedOsClipHash) {
          void inspectAndPushLocalOsClipboard(true, false);
        }
      });
    } else {
      // [안드로이드 AOS 신규 복사 삼킴 버그 수정]:
      // 안드로이드에서는 앱 새로 열기·새로고침 시 방금 타 앱에서 복사해 온 글자를 baselineOnly로 삼키지 않고,
      // 직전 동기화 해시(localStorage)와 다르면 즉시 PC로 전송합니다. (iOS는 불필요한 부팅 팝업 방지를 위해 baselineOnly 유지)
      const persistedHash = loadLastSyncedOsClipHash(normEmail);
      if (persistedHash && !lastObservedOsClipHash) {
        lastObservedOsClipHash = persistedHash;
      }
      if (isCapacitorAndroidRuntime()) {
        triggerMobileForegroundCapture(false, 120);
      } else {
        void inspectAndPushLocalOsClipboard(true, false);
      }
      // Capacitor 네이티브 앱(Android/iOS) 백그라운드 복귀 이벤트(appStateChange) 직접 감지
      try {
        const capApp = (
          window as unknown as {
            Capacitor?: {
              Plugins?: {
                App?: {
                  addListener?: (
                    ev: string,
                    cb: (st: { isActive?: boolean }) => void
                  ) => Promise<{ remove?: () => Promise<void> | void }> | { remove?: () => void };
                };
              };
            };
          }
        ).Capacitor?.Plugins?.App;
        if (capApp?.addListener) {
          Promise.resolve(
            capApp.addListener('appStateChange', (st) => {
              if (disposed || !st?.isActive) return;
              if (!isRealtimeChannelActuallyHealthy()) void setupRealtimeChannel(true);
              // 모바일 복귀 시 로컬 복사본을 먼저 PC로 올린 뒤 원격 우체통 수신 (원격 주입이 방금 복사한 글자를 덮어쓰는 레이스 차단)
              triggerMobileForegroundCapture(true);
            })
          )
            .then((handle) => {
              if (disposed) {
                void handle?.remove?.();
              } else {
                capAppStateHandle = handle || null;
              }
            })
            .catch(() => {});
        }
      } catch {
        /* ignore */
      }
    }

    // URL ?pairCode=XXXXXX 또는 로그인 전 보관된 sessionStorage pendingPairCode 소비 즉시 UI 및 상대 기기에 전파
    let pairedViaUrl = false;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRawCode = (params.get('pairCode') || '').replace(/\D/g, '').slice(0, 6);
      const pendingSessionCode = readPendingQrPairCode() || '';
      const effectivePairCode = urlRawCode.length === 6 ? urlRawCode : pendingSessionCode;
      if (effectivePairCode.length === 6) {
        clearPendingQrPairCode();
        if (params.has('pairCode')) {
          params.delete('pairCode');
          const nextQs = params.toString();
          const cleanUrl = `${window.location.pathname}${nextQs ? `?${nextQs}` : ''}${window.location.hash}`;
          window.history.replaceState(window.history.state, '', cleanUrl);
        }
        const pairRes = await consumeDevicePairingCode6(effectivePairCode);
        if (!disposed) {
          if (pairRes.ok) {
            pairedViaUrl = true;
            saveLastQrPairResult({ code: effectivePairCode, ok: true });
            if (opts.onDevicesUpdated) {
              opts.onDevicesUpdated({
                devices: pairRes.devices,
                pairingCode: loadCachedDeviceIntegrationSnapshot(normEmail)?.pairingCode ?? null,
                entitlement: pairRes.entitlement,
                revokedSelf: false,
              });
            }
            if (opts.onPairingCompleted) {
              opts.onPairingCompleted({
                ok: true,
                alreadyPaired: pairRes.alreadyPaired,
                deviceCount: pairRes.devices.length,
              });
            }
          } else {
            saveLastQrPairResult({
              code: effectivePairCode,
              ok: false,
              reason: pairRes.reason,
              expectedEmailHint: pairRes.expectedEmailHint,
            });
            if (pairRes.reason === 'ACCOUNT_MISMATCH' || pairRes.reason === 'AUTH_REQUIRED') {
              savePendingQrPairCode(effectivePairCode);
            }
            if (opts.onPairingCompleted) {
              opts.onPairingCompleted({
                ok: false,
                deviceCount: loadCachedDeviceIntegrationSnapshot(normEmail)?.devices.length || 0,
                reason: pairRes.reason,
                expectedEmailHint: pairRes.expectedEmailHint,
              });
            }
          }
        }
      }
    }

    const wasUnlockedBeforeBootHb = isCurrentAccountSyncUnlocked(normEmail);
    const [hb] = await Promise.all([
      pairedViaUrl ? Promise.resolve(null) : syncDeviceHeartbeatAndList(),
      syncRemoteMailboxToUi(true),
      realtimePromise,
    ]);

    if (!disposed && hb?.ok && opts.onDevicesUpdated) {
      const hasPendingPair = Boolean(readPendingQrPairCode());
      const effectiveRevoked = hasPendingPair ? false : hb.revokedSelf;
      opts.onDevicesUpdated({
        devices: effectiveRevoked ? [] : hb.devices,
        pairingCode: hb.pairingCode,
        entitlement: hb.entitlement,
        revokedSelf: effectiveRevoked,
      });
      // 앱 진입/QR 스캔 중에는 이미 해제 상태였던 기기에 대해 중복 '연결 끊김' 토스트를 띄우지 않음
      // (실시간 브로드캐스트 또는 활성 연결 -> 해제 전환 시에만 1회 안내)
      void prewarmAccountE2eeKey(normEmail, opts.userId);
      pushNativeClipboardAuthContext();
      if (!wasUnlockedBeforeBootHb && isCurrentAccountSyncUnlocked(normEmail)) {
        void syncRemoteMailboxToUi(true);
      }
    }

    // PC 마스터: 다른 앱(메모장·카톡·다른 크롬 탭)에서 Ctrl+C / Ctrl+V 할 때도 크롬 백그라운드 탭 60초 절전(Throttling)에 걸리지 않도록
    // 전용 Web Worker 800ms 타이머로 송신(/__sync/clipboard 0.2ms)과 수신(Realtime 점검 + 우체통 폴링)을 동시에 무중단 구동!
    let mailboxTickCounter = 0;
    if (osClipTicker) osClipTicker.stop();
    if (mobileMailboxTicker) mobileMailboxTicker.stop();
    if (ident.deviceKind === 'pc_master') {
      let pcWorkerTickCount = 0;
      const onPcWorkerTick = () => {
        if (disposed || thisDeviceRevokedLocally) return;
        pcWorkerTickCount += 1;
        if (zCoreBridge.isConnected) {
          void inspectAndPushLocalOsClipboard(false, false);
        }
        // 매 3틱(약 2.4초)마다 원격 우체통·Realtime 건강성 점검 (다른 앱에서 Ctrl+V 대기 중에도 2.4초 내 100% 도착 보장)
        if (pcWorkerTickCount % 3 === 0) {
          mailboxTickCounter += 1;
          const rtHealthy = isRealtimeChannelActuallyHealthy();
          if (!rtHealthy) {
            void setupRealtimeChannel(true);
            void syncRemoteMailboxToUi(true);
          } else if (mailboxTickCounter % 2 === 0) {
            void syncRemoteMailboxToUi(true);
          }
          const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
          if (!isHidden) {
            const cachedDevCount = loadCachedDeviceIntegrationSnapshot(normEmail)?.devices?.length || 0;
            const shouldSyncDevicesNow = cachedDevCount <= 1 ? true : mailboxTickCounter % 125 === 0;
            if (shouldSyncDevicesNow) {
              void syncDeviceHeartbeatAndList().then((hbNext) => {
                if (!disposed && hbNext.ok && opts.onDevicesUpdated) {
                  opts.onDevicesUpdated({
                    devices: hbNext.devices,
                    pairingCode: hbNext.pairingCode,
                    entitlement: hbNext.entitlement,
                    revokedSelf: hbNext.revokedSelf,
                  });
                }
              });
            }
          }
        }
      };

      // [무중단 이중 안전망]:
      // 1) Blob URL은 반드시 워커가 첫 틱(onmessage)을 정상 수신한 뒤에만 revoke하여 비동기 스크립트 로드 전 파기 결함을 원천 차단합니다.
      // 2) 보조 setInterval(900ms)도 항상 함께 가동하여, 워커가 정상 작동 중일 때는 0비용 스킵하고
      //    브라우저 정책/확장프로그램 등으로 워커가 응답하지 않을 때만 즉시 자동 인계합니다.
      let lastWorkerHeartbeatMs = 0;
      let workerInstance: Worker | null = null;
      let pendingBlobUrlToRevoke: string | null = null;

      if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
        try {
          const workerCode = 'postMessage(0); setInterval(function(){ postMessage(1); }, 800);';
          const blob = new Blob([workerCode], { type: 'application/javascript' });
          const blobUrl = URL.createObjectURL(blob);
          pendingBlobUrlToRevoke = blobUrl;
          const w = new Worker(blobUrl);
          w.onmessage = (ev) => {
            lastWorkerHeartbeatMs = Date.now();
            if (pendingBlobUrlToRevoke) {
              const urlToFree = pendingBlobUrlToRevoke;
              pendingBlobUrlToRevoke = null;
              try {
                URL.revokeObjectURL(urlToFree);
              } catch {
                /* ignore */
              }
            }
            if (ev.data === 1) {
              onPcWorkerTick();
            }
          };
          w.onerror = () => {
            lastWorkerHeartbeatMs = 0;
            if (pendingBlobUrlToRevoke) {
              const urlToFree = pendingBlobUrlToRevoke;
              pendingBlobUrlToRevoke = null;
              try {
                URL.revokeObjectURL(urlToFree);
              } catch {
                /* ignore */
              }
            }
          };
          workerInstance = w;
          activeClipboardWorker = w;
        } catch {
          workerInstance = null;
        }
      }

      const backupTimerId = window.setInterval(() => {
        if (lastWorkerHeartbeatMs > 0 && Date.now() - lastWorkerHeartbeatMs < 1800) {
          return;
        }
        onPcWorkerTick();
      }, 900);

      osClipTicker = {
        stop: () => {
          window.clearInterval(backupTimerId);
          if (pendingBlobUrlToRevoke) {
            try {
              URL.revokeObjectURL(pendingBlobUrlToRevoke);
            } catch {
              /* ignore */
            }
            pendingBlobUrlToRevoke = null;
          }
          if (workerInstance) {
            try {
              workerInstance.terminate();
            } catch {
              /* ignore */
            }
            if (activeClipboardWorker === workerInstance) {
              activeClipboardWorker = null;
            }
            workerInstance = null;
          }
        },
      };
    } else {
      // 모바일: 포그라운드 체류 중 1.5초마다 원격 우체통(Z-코어 직통 HTTPS 발송 포함)을 확인해 PC 연속 복사본도 즉시 주입
      const mobileTimerId = window.setInterval(() => {
        if (disposed || thisDeviceRevokedLocally || mobileResumeCaptureRunning) return;
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
        mailboxTickCounter += 1;
        if (typeof document === 'undefined' || document.hasFocus()) {
          void inspectAndPushLocalOsClipboard(false, false);
        }
        if (!isRealtimeChannelActuallyHealthy()) {
          void setupRealtimeChannel(true);
        }
        void syncRemoteMailboxToUi(true);
      }, 1500);
      mobileMailboxTicker = {
        stop: () => window.clearInterval(mobileTimerId),
      };
    }
  };

  void boot();

  const onBrowserCopy = () => {
    if (disposed) return;
    // 브라우저/앱 내부에서 직접 복사 시 선택 텍스트를 0.06초 내 즉시 감지·암호화 전송 (PC Z-코어 미실행·모바일 모두 작동)
    window.setTimeout(() => {
      if (disposed) return;
      const sel =
        typeof window !== 'undefined' && window.getSelection
          ? window.getSelection()?.toString().trim() || ''
          : '';
      if (ident.deviceKind === 'pc_master' && zCoreBridge.isConnected) {
        void inspectAndPushLocalOsClipboard(false, false);
        return;
      }
      if (sel && sel.length <= 32000) {
        void pushCrossDeviceClipboardText({
          text: sel,
          email: normEmail,
          userId: opts.userId,
          isAutoOsCapture: true,
        }).then((pushed) => {
          if (!disposed && pushed.ok && pushed.item) {
            opts.onIncomingClip(pushed.item, { isLocalAutoCapture: true });
          }
        });
      } else {
        void inspectAndPushLocalOsClipboard(false, false);
      }
    }, 60);
  };

  const onWindowFocus = () => {
    if (disposed) return;
    if (!isRealtimeChannelActuallyHealthy()) {
      void setupRealtimeChannel(true);
    }
    if (ident.deviceKind === 'pc_master') {
      void inspectAndPushLocalOsClipboard(false, false);
      void syncRemoteMailboxToUi(true);
    } else {
      triggerMobileForegroundCapture(true);
    }
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible' && !disposed) {
      if (!isRealtimeChannelActuallyHealthy()) {
        void setupRealtimeChannel(true);
      }
      if (ident.deviceKind === 'pc_master') {
        void inspectAndPushLocalOsClipboard(false, false);
        void syncRemoteMailboxToUi(true);
      } else {
        triggerMobileForegroundCapture(true);
      }
      const wasAlreadyRevoked = thisDeviceRevokedLocally;
      void syncDeviceHeartbeatAndList().then((hb) => {
        if (!disposed && hb.ok && opts.onDevicesUpdated) {
          opts.onDevicesUpdated({
            devices: hb.revokedSelf ? [] : hb.devices,
            pairingCode: hb.pairingCode,
            entitlement: hb.entitlement,
            revokedSelf: hb.revokedSelf,
          });
          if (hb.revokedSelf && !wasAlreadyRevoked && opts.onSelfRevoked) {
            opts.onSelfRevoked(hb.devices);
          }
        }
      });
    }
  };

  const onOnline = () => {
    if (disposed) return;
    if (!activePairSubscribed) {
      void setupRealtimeChannel();
    }
    void syncRemoteMailboxToUi(true);
  };

  const onNativeClipCaptured = () => {
    if (disposed) return;
    void flushPendingNativeMobileClips();
  };

  // Android MainActivity(onWindowFocusChanged/onResume) & iOS SceneDelegate(sceneDidBecomeActive)에서
  // 직접 발사되는 네이티브 포그라운드 복귀 이벤트 — 새로고침 없이 0.1초 만에 양방향 클립보드 즉시 동기화!
  const onNativeAppResumed = (ev: Event) => {
    if (disposed) return;
    const detail = (ev as CustomEvent<{ hasWindowFocus?: boolean }>).detail;
    if (!isRealtimeChannelActuallyHealthy()) {
      void setupRealtimeChannel(true);
    }
    if (ident.deviceKind === 'mobile') {
      triggerMobileForegroundCapture(true, detail?.hasWindowFocus ? 20 : 85, true);
    } else {
      void inspectAndPushLocalOsClipboard(false, false);
      void syncRemoteMailboxToUi(true);
    }
  };

  const onNativePairDeepLink = (ev: Event) => {
    if (disposed) return;
    const rawUrl = String((ev as CustomEvent<{ url?: string }>).detail?.url || '').trim();
    const m = rawUrl.match(/pairCode=(\d{6})/i);
    if (!m || !m[1]) return;
    const code = m[1];
    clearPendingQrPairCode();
    void consumeDevicePairingCode6(code).then((pairRes) => {
      if (disposed) return;
      if (pairRes.ok) {
        saveLastQrPairResult({ code, ok: true });
        if (opts.onDevicesUpdated) {
          opts.onDevicesUpdated({
            devices: pairRes.devices,
            pairingCode: loadCachedDeviceIntegrationSnapshot(normEmail)?.pairingCode ?? null,
            entitlement: pairRes.entitlement,
            revokedSelf: false,
          });
        }
        if (opts.onPairingCompleted) {
          opts.onPairingCompleted({
            ok: true,
            alreadyPaired: pairRes.alreadyPaired,
            deviceCount: pairRes.devices.length,
          });
        }
      } else {
        saveLastQrPairResult({
          code,
          ok: false,
          reason: pairRes.reason,
          expectedEmailHint: pairRes.expectedEmailHint,
        });
        if (pairRes.reason === 'ACCOUNT_MISMATCH' || pairRes.reason === 'AUTH_REQUIRED') {
          savePendingQrPairCode(code);
        }
        if (opts.onPairingCompleted) {
          opts.onPairingCompleted({
            ok: false,
            deviceCount: loadCachedDeviceIntegrationSnapshot(normEmail)?.devices.length || 0,
            reason: pairRes.reason,
            expectedEmailHint: pairRes.expectedEmailHint,
          });
        }
      }
    });
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy', onBrowserCopy);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('online', onOnline);
    window.addEventListener('ghostiNativeClipCaptured', onNativeClipCaptured);
    window.addEventListener('ghostiNativeAppResumed', onNativeAppResumed);
    window.addEventListener('ghostiNativePairDeepLink', onNativePairDeepLink);
  }

  return () => {
    clearRealtimeTimers();
    if (mobileResumeCaptureTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(mobileResumeCaptureTimer);
      mobileResumeCaptureTimer = null;
    }
    if (mobileResumeRetryTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(mobileResumeRetryTimer);
      mobileResumeRetryTimer = null;
    }
    if (pendingInjectFlushTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(pendingInjectFlushTimer);
      pendingInjectFlushTimer = null;
    }
    if (zCoreUnsubscribe) {
      zCoreUnsubscribe();
      zCoreUnsubscribe = null;
    }
    if (capAppStateHandle?.remove) {
      try {
        void capAppStateHandle.remove();
      } catch {
        /* ignore */
      }
      capAppStateHandle = null;
    }
    activePairReconnectTrigger = null;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('copy', onBrowserCopy);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('ghostiNativeClipCaptured', onNativeClipCaptured);
      window.removeEventListener('ghostiNativeAppResumed', onNativeAppResumed);
      window.removeEventListener('ghostiNativePairDeepLink', onNativePairDeepLink);
    }
    cleanup();
  };
}
