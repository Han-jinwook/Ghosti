import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { LocalDocumentFile, PhotoItem, PrivateSyncStrategy } from '../types/saysee';
import {
  callGhostiServerBridge,
  ensureGhostiPublicSupabaseClient,
  hasAuthenticatedHubAccountSession,
  readGhostiAuthedJwtClaims,
  supabase,
} from './supabaseClient';
import {
  isCapacitorNativeMobileRuntime,
  readNativeMobileClipboardText,
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
const DELIVERED_ENVELOPES_PREFIX = 'ghosti_delivered_clip_envelopes_v1::';
const CACHED_RECEIVED_CLIPS_PREFIX = 'ghosti_received_e2ee_clips_v2::';
const CACHED_DEVICE_SNAPSHOT_PREFIX = 'ghosti_device_integration_cache_v1::';
const CANONICAL_E2EE_UID_PREFIX = 'ghosti_e2ee_canonical_uid_v1::';
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
const pulledMirrorHashes = new Set<string>();
const loadedEnvelopeEmails = new Set<string>();
const osInjectedEnvelopeKeys = new Set<string>();

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
    return Array.isArray(parsed) ? (parsed as GhostiSyncedClipItem[]).slice(0, 15) : [];
  } catch {
    return [];
  }
}

function saveCachedSyncedClips(items: GhostiSyncedClipItem[], explicitEmail?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const scopedKey = resolveScopedClipStorageKey(explicitEmail);
    if (!scopedKey) return;
    localStorage.setItem(scopedKey, JSON.stringify(items.slice(0, 15)));
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

export function getThisDeviceIdentity(): {
  deviceId: string;
  deviceKind: 'pc_master' | 'mobile';
  platform: 'windows' | 'macos' | 'android' | 'ios' | 'web';
  displayName: string;
} {
  let deviceId = '';
  if (typeof window !== 'undefined') {
    try {
      deviceId = (localStorage.getItem(THIS_DEVICE_ID_KEY) || '').trim();
    } catch {
      deviceId = '';
    }
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deviceId)) {
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

  const shortSuffix = deviceId.slice(0, 4).toUpperCase();
  const displayName = isAndroid
    ? `갤럭시·안드로이드폰 (${shortSuffix})`
    : isIos
    ? `아이폰·iOS (${shortSuffix})`
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
    appVersion: '1.0.67',
    explicitTrialOptIn: Boolean(opts?.explicitTrialOptIn),
    explicitReconnect: Boolean(opts?.explicitReconnect),
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
  const res = await callGhostiServerBridge<{
    alreadyPaired?: boolean;
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
  });
  const safeDevices = Array.isArray(res.devices) ? res.devices : [];
  const safeEntitlement = res.entitlement || null;
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

let lastSyncedPcEngineSubFlag: string | null = null;
export async function syncEntitlementToLocalPcEngine(
  entitlement: GhostiDeviceEntitlementView | null,
  accountEmail?: string
): Promise<void> {
  if (typeof window === 'undefined' || !zCoreBridge.isConnected) return;
  const isSub = Boolean(entitlement?.isPaidUnlimited);
  const isWorkUnlocked = Boolean(
    entitlement?.workSubscriptionUnlocked || entitlement?.workPaidActive || entitlement?.workTrialActive
  );
  const devCnt = Math.max(1, Number(entitlement?.activeDeviceCount || 1));
  const cleanEmail = (accountEmail || '').trim().toLowerCase();
  const sig = `${cleanEmail}::${isSub ? '1' : '0'}::${isWorkUnlocked ? '1' : '0'}::${devCnt}`;
  if (lastSyncedPcEngineSubFlag === sig) return;
  lastSyncedPcEngineSubFlag = sig;
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
          planId: entitlement?.workPlanId || (entitlement?.workTrialActive ? 'work_trial_30d' : ''),
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
let pendingOsInjectClip: { envKey: string; clipHash: string; text: string } | null = null;
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

export function markLocalClipboardSelfInjected(clipHash: string): void {
  if (!clipHash) return;
  recentRemoteInjectedHashes.set(clipHash, Date.now());
  lastObservedOsClipHash = clipHash;
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
    if (zCoreBridge.isConnected) {
      try {
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const tid = ctrl ? window.setTimeout(() => ctrl.abort(), 2500) : null;
        const res = await fetch(getZCoreUrl('/__sync/clipboard'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: clean }),
          ...(ctrl ? { signal: ctrl.signal } : {}),
        });
        if (tid !== null) window.clearTimeout(tid);
        if (res.ok) return true;
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
  if (isCapacitorNativeMobileRuntime()) {
    const nat = await writeNativeMobileClipboardText(clean);
    if (nat.supported && nat.ok) return true;
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
}): void {
  const ident = getThisDeviceIdentity();
  const packet = {
    devices: payload.devices,
    entitlement: payload.entitlement,
    ...(payload.revokedDeviceId ? { revokedDeviceId: payload.revokedDeviceId } : {}),
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

  const ident = getThisDeviceIdentity();
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
  const nextList = [
    item,
    ...loadCachedSyncedClips(normEmail).filter((c) => c.clipHash !== item.clipHash),
  ].slice(0, 15);
  saveCachedSyncedClips(nextList, normEmail);

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(DEVICE_SYNC_BROADCAST_CHANNEL);
      bc.postMessage({ type: 'LOCAL_CLIP_SYNCED', payload: item });
      bc.close();
    }
  } catch {
    /* ignore */
  }

  // 1) 온라인 기기로 0.05초 즉시 Realtime 브로드캐스트 (아직 구독 핸드셰이크 중이면 큐에 보관 후 SUBSCRIBED 즉시 발송 + 재연결 트리거)
  const isRealtimeReady = Boolean(activePairChannel && activePairSubscribed);
  const realtimeSendPromise = isRealtimeReady
    ? activePairChannel!.send({
        type: 'broadcast',
        event: 'E2EE_CLIPBOARD_PUSH',
        payload: broadcastPayload,
      })
    : (() => {
        pendingClipBroadcastPacket = broadcastPayload;
        if (activePairReconnectTrigger) {
          activePairReconnectTrigger();
        }
        return Promise.resolve('queued');
      })();

  // 2) 오프라인/백그라운드 기기를 위한 24시간 지연 E2EE 암호화 우체통 병렬 보관 (서버 평문 열람 0% 불가)
  const mailboxPersistPromise = callGhostiServerBridge<{
    count?: number;
    canonicalUserId?: string;
  }>('device_push_e2ee_clip', broadcastPayload)
    .then((res) => {
      if (res?.ok && res.canonicalUserId) {
        saveCanonicalE2eeUid(normEmail, res.canonicalUserId);
      }
      return res;
    })
    .catch(() => ({ ok: false }));

  // Realtime 채널이 이미 연결되어 있으면 ~50ms 브로드캐스트 완료 즉시 반환하고 24h 우체통은 백그라운드로 비차단 저장
  if (isRealtimeReady) {
    const rtStatus = await Promise.race([
      realtimeSendPromise.catch(() => 'error'),
      new Promise<string>((resolve) => window.setTimeout(() => resolve('timeout'), 650)),
    ]);
    if (rtStatus === 'ok') {
      void mailboxPersistPromise;
      return { ok: true, item };
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
  const ident = getThisDeviceIdentity();
  const res = await callGhostiServerBridge<{
    canonicalUserId?: string;
    items?: Array<{
      clipHash: string;
      cipherB64: string;
      ivB64: string;
      senderDeviceId: string;
      senderName: string;
      createdAt: string;
    }>;
  }>('device_pull_e2ee_clips', {});

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
    const envKey = `${env.senderDeviceId || ''}:${resolvedHash}:${env.createdAt || ''}`;
    if (isFromOtherDevice && !deliveredRemoteEnvelopeKeys.has(envKey)) {
      rememberDeliveredEnvelope(envKey, normEmail);
      if (!newestExternalItem) {
        newestExternalItem = itemObj;
        newestExternalEnvKey = envKey;
      }
    }
    decryptedList.push(itemObj);
  }

  // 타 기기에서 새로 도착한 최신 클립보드를 내 OS 클립보드에 1회 자동 주입 (Echo-Loop 원천 차단)
  if (opts.injectToOsClipboard && newestExternalItem && newestExternalEnvKey) {
    const createdMs = Date.parse(newestExternalItem.createdAt || '') || Date.now();
    const isFresh = Date.now() - createdMs <= 10 * 60 * 1000;
    if (isFresh && !osInjectedEnvelopeKeys.has(newestExternalEnvKey)) {
      const injected = await writeTextToLocalOsClipboard(
        newestExternalItem.text,
        newestExternalItem.clipHash
      );
      if (injected) {
        osInjectedEnvelopeKeys.add(newestExternalEnvKey);
        if (pendingOsInjectClip?.envKey === newestExternalEnvKey) {
          pendingOsInjectClip = null;
        }
      } else if (ident.deviceKind === 'pc_master') {
        // Z-코어가 아직 연결 핸드셰이크 중이면 연결 직후 자동 주입하도록 대기열에 보관
        pendingOsInjectClip = {
          envKey: newestExternalEnvKey,
          clipHash: newestExternalItem.clipHash,
          text: newestExternalItem.text,
        };
      }
    }
  }

  if (decryptedList.length > 0) {
    saveCachedSyncedClips(decryptedList, normEmail);
  }
  return { items: decryptedList, newlyDeliveredExternal: newestExternalItem };
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
  source: 'zcore' | 'native_mobile' | 'web_clipboard' | 'none';
}> {
  const ident = getThisDeviceIdentity();

  if (ident.deviceKind === 'pc_master') {
    if (zCoreBridge.isConnected) {
      try {
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const tid = ctrl ? window.setTimeout(() => ctrl.abort(), 2200) : null;
        const res = await fetch(
          getZCoreUrl('/__sync/clipboard'),
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
          };
          if (data?.ok) {
            return {
              text: (data.text || '').trim(),
              clipHash: data.clipHash || data.sha256 || undefined,
              isSelfInjected: Boolean(data.isSelfInjected),
              seqNum: typeof data.seqNum === 'number' ? data.seqNum : undefined,
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

  lastObservedOsClipHash = h;
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
      remotePhotosToMerge: [],
      remoteDocsToMerge: [],
      mirroredUploadCount: 0,
      mirroredPullCount: 0,
      backupDirPath: null,
      packSizeMB: 0,
    };
  }

  const ident = getThisDeviceIdentity();
  const activeLocalPhotos = opts.photos.filter(
    (p) => !p.quarantined && !p.id.startsWith('shadow-remote-')
  );
  const activeLocalDocs = opts.localDocuments.filter(
    (d) => !d.id.startsWith('shadow-remote-doc-')
  );

  let mirroredUploadCount = 0;

  // 1) 양쪽 원본 보관(mirror) 모드일 때: 아직 업로드되지 않은 원본 사진 전체를 증분 업로드
  const mirrorUploadedIds = new Set<string>();
  if (opts.strategy === 'mirror') {
    const pendingOriginals: Array<{ photo: PhotoItem; shaKey: string }> = [];
    for (const p of activeLocalPhotos) {
      const hashSeed = await sha256HexBrowser(`${p.id}::${p.name}::${p.size}`);
      const shaKey = `${hashSeed.slice(0, 40)}.jpg`;
      if (uploadedMirrorHashes.has(shaKey)) {
        mirrorUploadedIds.add(p.id);
      } else {
        pendingOriginals.push({ photo: p, shaKey });
      }
    }

    for (let i = 0; i < pendingOriginals.length; i++) {
      const { photo: p, shaKey } = pendingOriginals[i];
      opts.onProgress?.({
        phase: '원본 안전 백업 업로드 중',
        current: i + 1,
        total: pendingOriginals.length,
      });
      const candidates = [p.fullUrl, p.thumbUrl].filter(
        (u): u is string => Boolean(u && u.trim())
      );
      if (candidates.length === 0) continue;
      let blob: Blob | null = null;
      for (const src of candidates) {
        try {
          const blobRes = await fetch(src);
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
            const fbRes = await fetch(compactFallback);
            if (fbRes.ok) {
              const fbBlob = await fbRes.blob();
              if (fbBlob.size > 0) blob = fbBlob;
            }
          }
        } catch {
          /* ignore */
        }
      }
      if (!blob) continue;
      try {
        const signUp = await callGhostiServerBridge<{
          signedUploadUrl?: string;
          reason?: string;
          message?: string;
        }>('device_sign_mirror_upload', { sha256: shaKey });
        if (!signUp.ok && (signUp.reason === 'TRIAL_EXPIRED' || signUp.reason === 'TRIAL_OPT_IN_REQUIRED')) {
          return {
            ok: false,
            reason: signUp.reason,
            message: signUp.message,
            mergedCatalog: [],
            remotePhotosToMerge: [],
            remoteDocsToMerge: [],
            mirroredUploadCount,
            mirroredPullCount: 0,
            backupDirPath: null,
            packSizeMB: 0,
          };
        }
        if (signUp.ok && signUp.signedUploadUrl) {
          const putRes = await fetch(signUp.signedUploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': blob.type || 'image/jpeg' },
            body: blob,
          });
          if (putRes.ok) {
            uploadedMirrorHashes.add(shaKey);
            mirrorUploadedIds.add(p.id);
            mirroredUploadCount += 1;
          }
        }
      } catch {
        /* continue */
      }
    }
  }

  // 2) 장당 ~13KB 초경량 섀도우 카탈로그 패킹 후 기기 간 양방향 병합 (사진 + PC 문서 동시)
  const outgoingItems: Array<Record<string, unknown>> = [];
  const totalPackCount = activeLocalPhotos.length + activeLocalDocs.length;
  for (let i = 0; i < activeLocalPhotos.length; i++) {
    const p = activeLocalPhotos[i];
    if (i % 10 === 0 || i === activeLocalPhotos.length - 1) {
      opts.onProgress?.({
        phase: '사진·문서 목록 동기화 중',
        current: i + 1,
        total: Math.max(1, totalPackCount),
      });
    }
    const hashSeed = await sha256HexBrowser(`${p.id}::${p.name}::${p.size}`);
    const shaKey = `${hashSeed.slice(0, 40)}.jpg`;
    const thumbWebp = await tryMakeCompactThumbDataUrl(p.thumbUrl || p.fullUrl);
    outgoingItems.push({
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
    });
  }

  for (const doc of activeLocalDocs) {
    const hashSeed = await sha256HexBrowser(`doc::${doc.id}::${doc.fileName}`);
    outgoingItems.push({
      id: `doc-${doc.id}`,
      kind: 'doc',
      title: doc.fileName,
      keywords: (doc.keywords || []).slice(0, 14),
      ocrSnippet: (doc.extractedText || doc.title || '').slice(0, 750),
      shotDate: doc.date || '',
      sourceDeviceId: ident.deviceId,
      sourceDeviceName: ident.displayName,
      byteSize: Math.round((doc.sizeKB || 120) * 1024),
      sha256: hashSeed.slice(0, 40),
      hasMirrorBlob: false,
    });
  }

  // 서버 250건 단위 배치 전송으로 대량 사진·문서도 끊김 없이 동기화
  let mergedCatalog: GhostiShadowCatalogItem[] = [];
  let syncOk = true;
  let syncErrorReason: string | undefined;
  let syncErrorMessage: string | undefined;
  const BATCH_SIZE = 200;
  const totalBatches = Math.max(1, Math.ceil(outgoingItems.length / BATCH_SIZE));
  for (let b = 0; b < totalBatches; b++) {
    const chunk = outgoingItems.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
    const syncRes = await callGhostiServerBridge<{
      items?: GhostiShadowCatalogItem[];
      reason?: string;
      message?: string;
      entitlement?: GhostiDeviceEntitlementView;
    }>('device_sync_shadow_catalog', { items: chunk });
    if (!syncRes.ok) {
      syncOk = false;
      syncErrorReason = syncRes.reason;
      syncErrorMessage = syncRes.message;
      if (syncRes.entitlement) {
        saveCachedDeviceIntegrationSnapshot({ entitlement: syncRes.entitlement }, opts.email);
      }
      break;
    }
    if (Array.isArray(syncRes.items)) {
      mergedCatalog = syncRes.items;
    }
  }

  if (!syncOk) {
    return {
      ok: false,
      reason: syncErrorReason,
      message: syncErrorMessage,
      mergedCatalog: [],
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

  for (const item of mergedCatalog) {
    if (!item || item.sourceDeviceId === ident.deviceId) continue;

    // PC에서 양쪽 원본 보관(mirror) 모드일 때 스마트폰이 올린 원본을 PC 로컬 백업 폴더로 자동 다운로드
    if (
      opts.strategy === 'mirror' &&
      item.hasMirrorBlob &&
      item.sha256 &&
      zCoreBridge.isConnected &&
      !pulledMirrorHashes.has(item.sha256)
    ) {
      const dlSign = await callGhostiServerBridge<{ signedDownloadUrl?: string }>(
        'device_sign_mirror_download',
        { sha256: item.sha256 }
      );
      if (dlSign.ok && dlSign.signedDownloadUrl) {
        try {
          const pullRes = await fetch(getZCoreUrl('/__sync/mirror-pull'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: item.title || item.sha256,
              signedDownloadUrl: dlSign.signedDownloadUrl,
              sha256: item.sha256,
            }),
          });
          const pj = (await pullRes.json().catch(() => ({}))) as {
            ok?: boolean;
            alreadyExists?: boolean;
            savedPath?: string;
            backupDir?: string;
          };
          if (pj.ok) {
            pulledMirrorHashes.add(item.sha256);
            if (!pj.alreadyExists) mirroredPullCount += 1;
            if (pj.backupDir) {
              backupDirPath = pj.backupDir;
            } else if (pj.savedPath) {
              const lastSep = Math.max(pj.savedPath.lastIndexOf('\\'), pj.savedPath.lastIndexOf('/'));
              if (lastSep > 0) backupDirPath = pj.savedPath.slice(0, lastSep);
            }
          }
        } catch {
          /* ignore */
        }
      }
    }

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

  const packSizeMB = Number(Math.max(0.1, (mergedCatalog.length * 13) / 1024).toFixed(2));
  return {
    ok: true,
    mergedCatalog,
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
  }) => void;
  onSelfRevoked?: (devices: GhostiConnectedDeviceDto[]) => void;
  onTeleportReceived?: (info: {
    fileName: string;
    fullText: string;
    sourceDevice: string;
  }) => void;
}): () => void {
  let disposed = false;
  const ident = getThisDeviceIdentity();
  const normEmail = (opts.email || '').trim().toLowerCase();

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

  const setupRealtimeChannel = async () => {
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
        activePairChannel &&
        activePairSubscribed &&
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
        if (isSelfNowRevoked) {
          thisDeviceRevokedLocally = true;
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
          revokedSelf: isSelfNowRevoked ? true : undefined,
        });
        if (isSelfNowRevoked && opts.onSelfRevoked) {
          opts.onSelfRevoked(mergedDevices);
        }
      })
        .on('broadcast', { event: 'E2EE_CLIPBOARD_PUSH' }, async ({ payload }) => {
          if (disposed || thisDeviceRevokedLocally || !payload?.cipherB64 || !payload?.ivB64) return;
          if (!isCurrentAccountSyncUnlocked(normEmail)) return;
          if (payload.senderDeviceId === ident.deviceId) return;
          const hash = String(payload.clipHash || '');
          const envKey = `${String(payload.senderDeviceId || '')}:${hash}:${String(payload.createdAt || '')}`;
          if (deliveredRemoteEnvelopeKeys.has(envKey)) return;

          const cachedUid = loadCanonicalE2eeUid(normEmail);
          const plain = await decryptClipboardE2ee(
            String(payload.cipherB64),
            String(payload.ivB64),
            normEmail,
            opts.userId,
            cachedUid ? [cachedUid] : undefined
          );
          if (!plain) return;
          rememberDeliveredEnvelope(envKey, normEmail);
          const resolvedHash = hash || (await sha256HexBrowser(plain));

          const injected = await writeTextToLocalOsClipboard(plain, resolvedHash);
          if (injected) {
            osInjectedEnvelopeKeys.add(envKey);
          } else if (ident.deviceKind === 'pc_master') {
            pendingOsInjectClip = { envKey, clipHash: resolvedHash, text: plain };
          }

          const clipItem: GhostiSyncedClipItem = {
            clipHash: resolvedHash,
            text: plain,
            senderDeviceId: String(payload.senderDeviceId || ''),
            senderName: String(payload.senderName || '연결된 내 기기'),
            createdAt: String(payload.createdAt || new Date().toISOString()),
            encryptedE2ee: true,
          };
          const nextClips = [
            clipItem,
            ...loadCachedSyncedClips(normEmail).filter((c) => c.clipHash !== clipItem.clipHash),
          ].slice(0, 15);
          saveCachedSyncedClips(nextClips, normEmail);
          opts.onIncomingClip(clipItem, { isLocalAutoCapture: false });
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
          const nextClips = [
            clipItem,
            ...loadCachedSyncedClips(normEmail).filter((c) => c.clipHash !== clipItem.clipHash),
          ].slice(0, 15);
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
    if (!disposed && !activePairSubscribed) {
      void setupRealtimeChannel();
    }
  };

  const inspectAndPushLocalOsClipboard = async (
    isBaselineOnly = false,
    isUserGesture = false
  ): Promise<void> => {
    if (disposed || checkingOsClip || thisDeviceRevokedLocally || !hasAuthenticatedHubAccountSession()) return;
    if (!isBaselineOnly && !isCurrentAccountSyncUnlocked(normEmail)) return;
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
      }
    } catch {
      /* ignore */
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
    }
  };

  const triggerMobileForegroundCapture = () => {
    if (disposed || thisDeviceRevokedLocally || ident.deviceKind !== 'mobile' || typeof window === 'undefined') return;
    if (mobileResumeCaptureTimer !== null) {
      window.clearTimeout(mobileResumeCaptureTimer);
    }
    // 안드로이드 10+ WindowFocus 확보 직후(120ms) 빠르게 OS 클립보드 읽기 실행
    mobileResumeCaptureTimer = window.setTimeout(() => {
      mobileResumeCaptureTimer = null;
      if (!disposed && document.visibilityState === 'visible') {
        void inspectAndPushLocalOsClipboard(false, false);
      }
    }, 120);
  };

  const boot = async () => {
    loadDeliveredEnvelopesOnce(normEmail);

    // 0) PBKDF2 AES-256-GCM 암호화 키를 백그라운드에서 선행 예열 (첫 Ctrl+C 시 ~400ms 지연 제거)
    void prewarmAccountE2eeKey(normEmail, opts.userId);

    // 1) 실시간 채널 구독을 최우선 0ms 즉시 병렬 착수
    const realtimePromise = setupRealtimeChannel();

    // 2) 초기 클립보드 기준점 비차단 기록 (iOS는 baselineOnly로 changeCount만 기록하여 불필요한 OS 붙여넣기 배너 0회)
    if (ident.deviceKind === 'pc_master') {
      if (zCoreBridge.isConnected) {
        void inspectAndPushLocalOsClipboard(true, false);
      }
      zCoreUnsubscribe = zCoreBridge.subscribe((connected) => {
        if (disposed || !connected) return;
        if (pendingOsInjectClip) {
          const pending = pendingOsInjectClip;
          pendingOsInjectClip = null;
          void writeTextToLocalOsClipboard(pending.text, pending.clipHash).then((ok) => {
            if (ok) osInjectedEnvelopeKeys.add(pending.envKey);
          });
        } else if (!lastObservedOsClipHash) {
          void inspectAndPushLocalOsClipboard(true, false);
        }
      });
    } else {
      void inspectAndPushLocalOsClipboard(true, false);
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
              if (!activePairSubscribed) void setupRealtimeChannel();
              triggerMobileForegroundCapture();
              void syncRemoteMailboxToUi(true);
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
        if (opts.onDevicesUpdated) {
          const prev = loadCachedDeviceIntegrationSnapshot(normEmail);
          opts.onDevicesUpdated({
            devices: prev?.devices || [],
            pairingCode: prev?.pairingCode ?? null,
            entitlement: buildOptimisticTrialEntitlement(prev?.entitlement, 2),
            revokedSelf: false,
          });
        }
        const pairRes = await consumeDevicePairingCode6(effectivePairCode);
        if (!disposed) {
          if (pairRes.ok) {
            pairedViaUrl = true;
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
          } else if (opts.onPairingCompleted) {
            opts.onPairingCompleted({
              ok: false,
              deviceCount: loadCachedDeviceIntegrationSnapshot(normEmail)?.devices.length || 0,
              reason: pairRes.reason,
            });
          }
        }
      }
    }

    const [hb] = await Promise.all([
      pairedViaUrl ? Promise.resolve(null) : syncDeviceHeartbeatAndList(),
      syncRemoteMailboxToUi(true),
      realtimePromise,
    ]);

    if (!disposed && hb?.ok && opts.onDevicesUpdated) {
      opts.onDevicesUpdated({
        devices: hb.devices,
        pairingCode: hb.pairingCode,
        entitlement: hb.entitlement,
        revokedSelf: hb.revokedSelf,
      });
      if (hb.revokedSelf && opts.onSelfRevoked) {
        opts.onSelfRevoked(hb.devices);
      }
      // 서버가 확정한 canonicalUserId로 키 추가 예열
      void prewarmAccountE2eeKey(normEmail, opts.userId);
    }

    // PC 마스터: 탭 활성(visible) 중에만 0.8초 주기로 OS 클립보드 감지, 백그라운드(hidden) 시 크롬 절전 존중(복귀/포커스 즉시 동기화)
    if (ident.deviceKind === 'pc_master') {
      if (osClipTicker) osClipTicker.stop();
      osClipTicker = createVisibilityAwareInterval(800, () => {
        if (!zCoreBridge.isConnected || thisDeviceRevokedLocally) return;
        void inspectAndPushLocalOsClipboard(false, false);
      });
    }

    // 전 기기 공통: 탭 활성(visible) 중에만 2.4초 보조 동기화 (Realtime 수신 우선 · 백그라운드 hidden 시 0회 호출 · 복귀 즉시 동기화)
    let mailboxTickCounter = 0;
    if (mobileMailboxTicker) mobileMailboxTicker.stop();
    mobileMailboxTicker = createVisibilityAwareInterval(2400, () => {
      if (thisDeviceRevokedLocally) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      mailboxTickCounter += 1;
      if (!activePairSubscribed) {
        void setupRealtimeChannel();
        void syncRemoteMailboxToUi(true);
      } else if (mailboxTickCounter % 2 === 0) {
        void syncRemoteMailboxToUi(true);
      }
      // PC 마스터: 5분마다(2.4s * 125) 6자리 연결 번호 만료 전 자동 갱신
      if (ident.deviceKind === 'pc_master' && mailboxTickCounter % 125 === 0) {
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
    });
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
    if (!activePairSubscribed) {
      void setupRealtimeChannel();
    }
    if (ident.deviceKind === 'pc_master') {
      void inspectAndPushLocalOsClipboard(false, false);
    } else {
      triggerMobileForegroundCapture();
    }
    void syncRemoteMailboxToUi(true);
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible' && !disposed) {
      if (!activePairSubscribed) {
        void setupRealtimeChannel();
      }
      if (ident.deviceKind === 'pc_master') {
        void inspectAndPushLocalOsClipboard(false, false);
      } else {
        triggerMobileForegroundCapture();
      }
      void syncRemoteMailboxToUi(true);
      void syncDeviceHeartbeatAndList().then((hb) => {
        if (!disposed && hb.ok && opts.onDevicesUpdated) {
          opts.onDevicesUpdated({
            devices: hb.devices,
            pairingCode: hb.pairingCode,
            entitlement: hb.entitlement,
            revokedSelf: hb.revokedSelf,
          });
          if (hb.revokedSelf && opts.onSelfRevoked) {
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

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy', onBrowserCopy);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('online', onOnline);
  }

  return () => {
    clearRealtimeTimers();
    if (mobileResumeCaptureTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(mobileResumeCaptureTimer);
      mobileResumeCaptureTimer = null;
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
    }
    cleanup();
  };
}
