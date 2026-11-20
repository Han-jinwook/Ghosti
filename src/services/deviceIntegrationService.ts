import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { LocalDocumentFile, PhotoItem, PrivateSyncStrategy } from '../types/saysee';
import {
  callGhostiServerBridge,
  ensureGhostiAuthedSupabaseClient,
  ensureGhostiPublicSupabaseClient,
  getGhostiAuthedSupabase,
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
  activeDeviceCount: number;
  trialActive: boolean;
  trialDaysLeft: number;
  isPaidUnlimited: boolean;
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
const DEVICE_SYNC_BROADCAST_CHANNEL = 'ghosti_device_sync_bus_v1';

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

function resolveCanonicalE2eeUserId(fallbackUserId: string): string {
  const jwtSub = readGhostiAuthedJwtClaims()?.sub?.trim() || '';
  if (jwtSub) return jwtSub;
  return (fallbackUserId || '').trim();
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
  const canonicalUid = resolveCanonicalE2eeUserId(userId);
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
  const primaryUid = resolveCanonicalE2eeUserId(userId);
  if (primaryUid) candidateSet.add(primaryUid);
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
}): Promise<{
  ok: boolean;
  thisDeviceId: string;
  devices: GhostiConnectedDeviceDto[];
  pairingCode: string | null;
  entitlement: GhostiDeviceEntitlementView | null;
}> {
  const ident = getThisDeviceIdentity();
  if (!hasAuthenticatedHubAccountSession()) {
    return {
      ok: false,
      thisDeviceId: ident.deviceId,
      devices: [],
      pairingCode: null,
      entitlement: null,
    };
  }
  const res = await callGhostiServerBridge<{
    deviceId?: string;
    devices?: GhostiConnectedDeviceDto[];
    pairingCode?: string | null;
    entitlement?: GhostiDeviceEntitlementView;
  }>('device_heartbeat_and_list', {
    deviceId: ident.deviceId,
    deviceKind: ident.deviceKind,
    platform: ident.platform,
    displayName: ident.displayName,
    appVersion: '1.0.39',
    explicitTrialOptIn: Boolean(opts?.explicitTrialOptIn),
  });

  if (!res.ok) {
    return {
      ok: false,
      thisDeviceId: ident.deviceId,
      devices: [],
      pairingCode: null,
      entitlement: null,
    };
  }
  const safeDevices = Array.isArray(res.devices) ? res.devices : [];
  const safePairingCode = res.pairingCode || null;
  const safeEntitlement = res.entitlement || null;
  saveCachedDeviceIntegrationSnapshot({
    devices: safeDevices,
    ...(safePairingCode ? { pairingCode: safePairingCode } : {}),
    entitlement: safeEntitlement,
  });
  if (opts?.explicitTrialOptIn || safeDevices.length >= 2) {
    broadcastDeviceIntegrationStateUpdate({
      devices: safeDevices,
      entitlement: safeEntitlement,
    });
  }
  return {
    ok: true,
    thisDeviceId: res.deviceId || ident.deviceId,
    devices: safeDevices,
    pairingCode: safePairingCode,
    entitlement: safeEntitlement,
  };
}

export async function consumeDevicePairingCode6(code: string): Promise<{
  ok: boolean;
  reason?: string;
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
    devices?: GhostiConnectedDeviceDto[];
    entitlement?: GhostiDeviceEntitlementView;
  }>('device_consume_pairing_code', {
    code: clean,
    deviceId: ident.deviceId,
    displayName: ident.displayName,
    platform: ident.platform,
  });
  const safeDevices = Array.isArray(res.devices) ? res.devices : [];
  const safeEntitlement = res.entitlement || null;
  if (res.ok) {
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
    reason: res.reason,
    devices: safeDevices,
    entitlement: safeEntitlement,
  };
}

export async function activateDevicePlanPersistent(
  planId: string
): Promise<GhostiDeviceEntitlementView | null> {
  if (!hasAuthenticatedHubAccountSession()) return null;
  const res = await callGhostiServerBridge<{ entitlement?: GhostiDeviceEntitlementView }>(
    'device_activate_plan',
    { planId }
  );
  if (res.ok && res.entitlement) {
    saveCachedDeviceIntegrationSnapshot({ entitlement: res.entitlement });
    broadcastDeviceIntegrationStateUpdate({ entitlement: res.entitlement });
    return res.entitlement;
  }
  return null;
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
  senderDeviceId: string;
  updatedAt: number;
} | null = null;
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

function createUnthrottledIntervalWorker(intervalMs: number, onTick: () => void): {
  stop: () => void;
} {
  if (typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
    try {
      const code = `const id = setInterval(() => postMessage(1), ${Math.max(250, intervalMs)}); onmessage = (e) => { if (e.data === 'stop') clearInterval(id); };`;
      const blobUrl = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
      const worker = new Worker(blobUrl);
      worker.onmessage = () => onTick();
      return {
        stop: () => {
          try {
            worker.postMessage('stop');
            worker.terminate();
            URL.revokeObjectURL(blobUrl);
          } catch {
            /* ignore */
          }
        },
      };
    } catch {
      /* fallback to window.setInterval */
    }
  }
  const timerId = typeof window !== 'undefined' ? window.setInterval(onTick, intervalMs) : null;
  return {
    stop: () => {
      if (timerId !== null && typeof window !== 'undefined') {
        window.clearInterval(timerId);
      }
    },
  };
}

export function broadcastDeviceIntegrationStateUpdate(payload: {
  devices?: GhostiConnectedDeviceDto[];
  entitlement?: GhostiDeviceEntitlementView | null;
}): void {
  const ident = getThisDeviceIdentity();
  const packet = {
    devices: payload.devices,
    entitlement: payload.entitlement,
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
  const realtimeSendPromise =
    activePairChannel && activePairSubscribed
      ? activePairChannel.send({
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
  const [, bridgeRes] = await Promise.all([
    realtimeSendPromise.catch(() => 'error'),
    callGhostiServerBridge<{ count?: number }>('device_push_e2ee_clip', broadcastPayload).catch(
      () => ({ ok: false })
    ),
  ]);

  return { ok: Boolean(bridgeRes?.ok || (activePairChannel && activePairSubscribed)), item };
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
}): void {
  if (!activePairChannel) return;
  const ident = getThisDeviceIdentity();
  void activePairChannel.send({
    type: 'broadcast',
    event: 'TELEPORT_OCR_VANGUARD',
    payload: {
      file_name: opts.fileName,
      ocr_text: opts.ocrText,
      summary: opts.summary || `[모바일 0.2초 공간이동] ${opts.fileName}`,
      source_device: ident.displayName,
      sent_at: new Date().toISOString(),
    },
  });
}

async function tryMakeCompactThumbDataUrl(srcUrl?: string): Promise<string | undefined> {
  if (!srcUrl || typeof document === 'undefined') return undefined;
  if (srcUrl.startsWith('data:image/') && srcUrl.length <= 28000) {
    return srcUrl;
  }
  return new Promise<string | undefined>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timeout = window.setTimeout(() => resolve(undefined), 1500);
    img.onload = () => {
      window.clearTimeout(timeout);
      try {
        const maxSide = 220;
        const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round((img.width || 160) * scale));
        const h = Math.max(1, Math.round((img.height || 120) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(undefined);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const webp = canvas.toDataURL('image/webp', 0.62);
        resolve(webp.length <= 34000 ? webp : undefined);
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
}

export async function executeRealDeviceSyncNow(opts: {
  strategy: PrivateSyncStrategy;
  photos: PhotoItem[];
  localDocuments: LocalDocumentFile[];
}): Promise<{
  ok: boolean;
  mergedCatalog: GhostiShadowCatalogItem[];
  remotePhotosToMerge: PhotoItem[];
  mirroredUploadCount: number;
  mirroredPullCount: number;
  packSizeMB: number;
}> {
  if (!hasAuthenticatedHubAccountSession()) {
    return {
      ok: false,
      mergedCatalog: [],
      remotePhotosToMerge: [],
      mirroredUploadCount: 0,
      mirroredPullCount: 0,
      packSizeMB: 0,
    };
  }

  const ident = getThisDeviceIdentity();
  const activeLocalPhotos = opts.photos
    .filter((p) => !p.quarantined && !p.id.startsWith('shadow-remote-'))
    .slice(0, 60);

  let mirroredUploadCount = 0;

  // 1) 양쪽 원본 보관(mirror) 모드일 때: 내 기기 원본 이미지 바이트를 암호화 서명 URL로 업로드
  const mirrorUploadedIds = new Set<string>();
  if (opts.strategy === 'mirror') {
    for (const p of activeLocalPhotos.slice(0, 12)) {
      const src = p.fullUrl || p.thumbUrl;
      if (!src) continue;
      const hashSeed = await sha256HexBrowser(`${p.id}::${p.name}::${p.size}`);
      const shaKey = `${hashSeed.slice(0, 40)}.jpg`;
      if (uploadedMirrorHashes.has(shaKey)) {
        mirrorUploadedIds.add(p.id);
        continue;
      }
      try {
        const blobRes = await fetch(src);
        if (!blobRes.ok) continue;
        const blob = await blobRes.blob();
        if (blob.size <= 0 || blob.size > 25 * 1024 * 1024) continue;
        const signUp = await callGhostiServerBridge<{ signedUploadUrl?: string }>(
          'device_sign_mirror_upload',
          { sha256: shaKey }
        );
        if (signUp.ok && signUp.signedUploadUrl) {
          const putRes = await fetch(signUp.signedUploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': blob.type || 'application/octet-stream' },
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

  // 2) 장당 ~13KB 초경량 섀도우 카탈로그 패킹 후 기기 간 양방향 병합
  const outgoingItems: Array<Record<string, unknown>> = [];
  for (const p of activeLocalPhotos.slice(0, 45)) {
    const hashSeed = await sha256HexBrowser(`${p.id}::${p.name}::${p.size}`);
    const shaKey = `${hashSeed.slice(0, 40)}.jpg`;
    const thumbWebp = await tryMakeCompactThumbDataUrl(p.thumbUrl);
    outgoingItems.push({
      id: p.id,
      kind: 'photo',
      title: p.name,
      thumbWebp,
      keywords: (p.tags || []).slice(0, 10),
      ocrSnippet: p.captionKo || (p.keywordsKo || []).join(' ') || '',
      shotDate: p.date || '',
      sourceDeviceId: ident.deviceId,
      sourceDeviceName: ident.displayName,
      byteSize: p.size || 512000,
      sha256: shaKey,
      hasMirrorBlob: mirrorUploadedIds.has(p.id),
    });
  }

  for (const doc of opts.localDocuments.slice(0, 25)) {
    const hashSeed = await sha256HexBrowser(`doc::${doc.id}::${doc.fileName}`);
    outgoingItems.push({
      id: `doc-${doc.id}`,
      kind: 'doc',
      title: doc.fileName,
      keywords: (doc.keywords || []).slice(0, 10),
      ocrSnippet: (doc.extractedText || doc.title || '').slice(0, 450),
      shotDate: doc.date || '',
      sourceDeviceId: ident.deviceId,
      sourceDeviceName: ident.displayName,
      byteSize: Math.round((doc.sizeKB || 120) * 1024),
      sha256: hashSeed.slice(0, 40),
      hasMirrorBlob: false,
    });
  }

  const syncRes = await callGhostiServerBridge<{ items?: GhostiShadowCatalogItem[] }>(
    'device_sync_shadow_catalog',
    { items: outgoingItems }
  );
  const mergedCatalog = Array.isArray(syncRes.items) ? syncRes.items : [];

  // 3) 다른 내 기기에서 올라온 섀도우 사진들을 현재 기기 갤러리 검색 풀에 병합
  const existingIds = new Set(opts.photos.map((p) => p.id));
  const remotePhotosToMerge: PhotoItem[] = [];
  let mirroredPullCount = 0;

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
          };
          if (pj.ok) {
            pulledMirrorHashes.add(item.sha256);
            if (!pj.alreadyExists) mirroredPullCount += 1;
          }
        } catch {
          /* ignore */
        }
      }
    }

    if (item.kind === 'photo' && item.thumbWebp) {
      const remoteId = `shadow-remote-${item.id}`;
      if (!existingIds.has(remoteId) && !existingIds.has(item.id)) {
        remotePhotosToMerge.push({
          id: remoteId,
          name: item.title || '연결 기기 사진',
          size: item.byteSize || 512000,
          date: item.shotDate || item.syncedAt.slice(0, 10),
          mtimeMs: Date.parse(item.syncedAt) || Date.now(),
          locationKo: `🔗 ${item.sourceDeviceName}`,
          tags: Array.from(new Set([...(item.keywords || []), item.sourceDeviceName])),
          captionKo:
            item.ocrSnippet || `${item.sourceDeviceName}에서 동기화된 13KB 초경량 섀도우 캐시`,
          keywordsKo: item.keywords || [],
          thumbUrl: item.thumbWebp,
          fullUrl: item.thumbWebp,
          bookmarked: false,
          quarantined: false,
        });
      }
    }
  }

  const packSizeMB = Number(Math.max(0.1, (mergedCatalog.length * 13) / 1024).toFixed(2));
  return {
    ok: Boolean(syncRes.ok),
    mergedCatalog,
    remotePhotosToMerge,
    mirroredUploadCount,
    mirroredPullCount,
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

  const scheduleRealtimeReconnect = (delayMs = 2500, usePublicFallback = false) => {
    if (disposed || typeof window === 'undefined') return;
    if (realtimeReconnectTimer !== null) return;
    realtimeReconnectTimer = window.setTimeout(() => {
      realtimeReconnectTimer = null;
      if (!disposed && !activePairSubscribed) {
        void setupRealtimeChannel(usePublicFallback);
      }
    }, delayMs);
  };

  const setupRealtimeChannel = async (usePublicFallback = false) => {
    if (disposed || settingUpRealtime) return;
    settingUpRealtime = true;
    try {
      const publicClient = (await ensureGhostiPublicSupabaseClient()) || supabase;
      let sbClient: SupabaseClient | null = null;
      let usingAuthedClient = false;
      if (!usePublicFallback) {
        const authed = await ensureGhostiAuthedSupabaseClient();
        if (authed) {
          sbClient = authed;
          usingAuthedClient = true;
        }
      }
      if (!sbClient) {
        sbClient = publicClient;
        usingAuthedClient = false;
      }
      if (disposed || !sbClient) {
        scheduleRealtimeReconnect(3000, true);
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
        const prevSnap = loadCachedDeviceIntegrationSnapshot(normEmail);
        const mergedDevices = incomingDevices ?? prevSnap?.devices ?? [];
        const mergedEnt = incomingEnt !== undefined ? incomingEnt : prevSnap?.entitlement ?? null;
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
        });
      })
        .on('broadcast', { event: 'E2EE_CLIPBOARD_PUSH' }, async ({ payload }) => {
          if (disposed || !payload?.cipherB64 || !payload?.ivB64) return;
          if (payload.senderDeviceId === ident.deviceId) return;
          const hash = String(payload.clipHash || '');
          const envKey = `${String(payload.senderDeviceId || '')}:${hash}:${String(payload.createdAt || '')}`;
          if (deliveredRemoteEnvelopeKeys.has(envKey)) return;
          rememberDeliveredEnvelope(envKey, normEmail);

          const plain = await decryptClipboardE2ee(
            String(payload.cipherB64),
            String(payload.ivB64),
            normEmail,
            opts.userId
          );
          if (!plain) return;
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
          const pkt = payload as RemoteMonitorCastPacket;
          if (opts.onRemoteMonitorCast) {
            opts.onRemoteMonitorCast(pkt);
          }
          window.dispatchEvent(new CustomEvent('ghosti_remote_monitor_cast', { detail: pkt }));
        })
        .on('broadcast', { event: 'TELEPORT_OCR_VANGUARD' }, async ({ payload }) => {
          if (disposed || !payload || !zCoreBridge.isConnected) return;
          try {
            await fetch(getZCoreUrl('/api/teleport/ocr-vanguard'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          } catch {
            /* ignore */
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
          } else if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT' ||
            status === 'CLOSED'
          ) {
            activePairSubscribed = false;
            if (usingAuthedClient) {
              // 인증 JWT 만료·거부 시 페이로드가 이미 E2EE 암호화되어 있으므로 공개 Realtime 브로드캐스트로 즉시 폴백
              scheduleRealtimeReconnect(400, true);
            } else {
              scheduleRealtimeReconnect(2500, true);
            }
          }
        });

      activePairChannel = ch;
      if (typeof window !== 'undefined' && usingAuthedClient) {
        realtimeWatchdogTimer = window.setTimeout(() => {
          realtimeWatchdogTimer = null;
          if (!disposed && !activePairSubscribed && activePairChannel === ch) {
            void setupRealtimeChannel(true);
          }
        }, 5000);
      }
    } finally {
      settingUpRealtime = false;
    }
  };

  activePairReconnectTrigger = () => {
    if (!disposed && !activePairSubscribed) {
      void setupRealtimeChannel(false);
    }
  };

  const inspectAndPushLocalOsClipboard = async (
    isBaselineOnly = false,
    isUserGesture = false
  ): Promise<void> => {
    if (disposed || checkingOsClip || !hasAuthenticatedHubAccountSession()) return;
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
    if (disposed || !hasAuthenticatedHubAccountSession()) return;
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
    if (disposed || ident.deviceKind !== 'mobile' || typeof window === 'undefined') return;
    if (mobileResumeCaptureTimer !== null) {
      window.clearTimeout(mobileResumeCaptureTimer);
    }
    // 안드로이드 10+ WindowFocus 확보 직후(180ms) 안전하게 OS 클립보드 읽기 실행
    mobileResumeCaptureTimer = window.setTimeout(() => {
      mobileResumeCaptureTimer = null;
      if (!disposed && document.visibilityState === 'visible') {
        void inspectAndPushLocalOsClipboard(false, false);
      }
    }, 180);
  };

  const boot = async () => {
    loadDeliveredEnvelopesOnce(normEmail);

    // 1) 실시간 채널 구독을 최우선 0ms 즉시 병렬 착수 (Z-코어 미설치 시 checkHealth 13초 대기로 차단되던 결함 원천 제거)
    const realtimePromise = setupRealtimeChannel(false);

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
              if (!activePairSubscribed) void setupRealtimeChannel(false);
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

    // URL에 ?pairCode=XXXXXX가 있으면 낙관적 D-30 반영 + 소비 즉시 UI 및 상대 기기에 전파
    let pairedViaUrl = false;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlPairCode = (params.get('pairCode') || '').replace(/\D/g, '').slice(0, 6);
      if (urlPairCode.length === 6) {
        params.delete('pairCode');
        const nextQs = params.toString();
        const cleanUrl = `${window.location.pathname}${nextQs ? `?${nextQs}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', cleanUrl);
        if (opts.onDevicesUpdated) {
          const prev = loadCachedDeviceIntegrationSnapshot(normEmail);
          opts.onDevicesUpdated({
            devices: prev?.devices || [],
            pairingCode: prev?.pairingCode ?? null,
            entitlement: buildOptimisticTrialEntitlement(prev?.entitlement, 2),
          });
        }
        const pairRes = await consumeDevicePairingCode6(urlPairCode);
        if (!disposed && pairRes.ok && opts.onDevicesUpdated) {
          pairedViaUrl = true;
          opts.onDevicesUpdated({
            devices: pairRes.devices,
            pairingCode: loadCachedDeviceIntegrationSnapshot(normEmail)?.pairingCode ?? null,
            entitlement: pairRes.entitlement,
          });
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
      });
    }

    // PC 마스터: 백그라운드 탭(메모장·노션·카톡 등에서 Ctrl+C 복사 중)에서도 60초 스로틀링 없이 0.8초 내에 감지하는 전용 Web Worker 기동
    if (ident.deviceKind === 'pc_master') {
      if (osClipTicker) osClipTicker.stop();
      osClipTicker = createUnthrottledIntervalWorker(800, () => {
        if (!zCoreBridge.isConnected) return;
        void inspectAndPushLocalOsClipboard(false, false);
      });
    }

    // 전 기기 공통: Realtime 일시 순단(LTE↔Wi-Fi 전환·절전 복귀 등)까지 100% 보완하는 2.5초 경량 우체통 동기화
    if (mobileMailboxTicker) mobileMailboxTicker.stop();
    mobileMailboxTicker = createUnthrottledIntervalWorker(2500, () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void syncRemoteMailboxToUi(true);
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
      void setupRealtimeChannel(false);
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
        void setupRealtimeChannel(false);
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
          });
        }
      });
    }
  };

  const onOnline = () => {
    if (disposed) return;
    if (!activePairSubscribed) {
      void setupRealtimeChannel(false);
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
