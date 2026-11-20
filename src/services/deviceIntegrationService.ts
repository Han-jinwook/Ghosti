import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { LocalDocumentFile, PhotoItem, PrivateSyncStrategy } from '../types/saysee';
import {
  callGhostiServerBridge,
  ensureGhostiAuthedSupabaseClient,
  getGhostiAuthedSupabase,
  hasAuthenticatedHubAccountSession,
  supabase,
} from './supabaseClient';
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
const SEEN_CLIPS_STORAGE_KEY = 'ghosti_seen_clip_hashes_v1';
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

const seenClipHashes = new Set<string>();
const uploadedMirrorHashes = new Set<string>();
const pulledMirrorHashes = new Set<string>();

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

function loadSeenHashesOnce(): void {
  if (seenClipHashes.size > 0 || typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(SEEN_CLIPS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const h of arr.slice(0, 80)) {
          if (typeof h === 'string') seenClipHashes.add(h);
        }
      }
    }
  } catch {
    /* ignore */
  }
}

function rememberSeenClipHash(hash: string): void {
  if (!hash) return;
  loadSeenHashesOnce();
  seenClipHashes.add(hash);
  if (typeof window !== 'undefined') {
    try {
      const recent = Array.from(seenClipHashes).slice(-60);
      localStorage.setItem(SEEN_CLIPS_STORAGE_KEY, JSON.stringify(recent));
    } catch {
      /* ignore */
    }
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
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIos;
  const isMobile = isAndroid || isIos || /Mobile/i.test(ua);

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

let cachedE2eeKeyEmail = '';
let cachedE2eeCryptoKey: CryptoKey | null = null;

async function deriveAccountAesGcmKey(email: string, userId: string): Promise<CryptoKey> {
  const normEmail = (email || '').trim().toLowerCase();
  const cacheTag = `${normEmail}::${userId}`;
  if (cachedE2eeCryptoKey && cachedE2eeKeyEmail === cacheTag) {
    return cachedE2eeCryptoKey;
  }
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(`ghosti-e2ee-clip-v1::${normEmail}::${userId}`),
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
  cachedE2eeKeyEmail = cacheTag;
  cachedE2eeCryptoKey = derived;
  return derived;
}

export async function encryptClipboardE2ee(
  plainText: string,
  email: string,
  userId: string
): Promise<{ cipherB64: string; ivB64: string; clipHash: string }> {
  const key = await deriveAccountAesGcmKey(email, userId);
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
  userId: string
): Promise<string | null> {
  try {
    const key = await deriveAccountAesGcmKey(email, userId);
    const iv = base64ToBytes(ivB64);
    const cipherBytes = base64ToBytes(cipherB64);
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      cipherBytes as BufferSource
    );
    return new TextDecoder().decode(plainBuf);
  } catch {
    return null;
  }
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
let activeClipboardPollTimer: number | null = null;
let pendingDeviceStatePacket: {
  devices?: GhostiConnectedDeviceDto[];
  entitlement?: GhostiDeviceEntitlementView | null;
  senderDeviceId: string;
  updatedAt: number;
} | null = null;

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
}): Promise<{ ok: boolean; item?: GhostiSyncedClipItem; skippedDuplicate?: boolean }> {
  const cleanText = (opts.text || '').trim();
  if (!cleanText || !opts.email || !opts.userId || !hasAuthenticatedHubAccountSession()) {
    return { ok: false };
  }
  loadSeenHashesOnce();
  const clipHash = await sha256HexBrowser(cleanText);
  if (seenClipHashes.has(clipHash)) {
    return { ok: true, skippedDuplicate: true };
  }
  rememberSeenClipHash(clipHash);

  const ident = getThisDeviceIdentity();
  const encrypted = await encryptClipboardE2ee(cleanText, opts.email, opts.userId);
  const nowIso = new Date().toISOString();

  // 1) 오프라인 기기를 위한 24시간 지연 E2EE 암호화 우체통 보관 (서버는 평문 열람 0% 불가)
  await callGhostiServerBridge('device_push_e2ee_clip', {
    cipherB64: encrypted.cipherB64,
    ivB64: encrypted.ivB64,
    clipHash: encrypted.clipHash,
    senderDeviceId: ident.deviceId,
    senderName: ident.displayName,
  });

  // 2) 온라인 기기로 0.1초 즉시 Realtime 브로드캐스트
  if (activePairChannel) {
    void activePairChannel.send({
      type: 'broadcast',
      event: 'E2EE_CLIPBOARD_PUSH',
      payload: {
        clipHash: encrypted.clipHash,
        cipherB64: encrypted.cipherB64,
        ivB64: encrypted.ivB64,
        senderDeviceId: ident.deviceId,
        senderName: ident.displayName,
        createdAt: nowIso,
      },
    });
  }

  const item: GhostiSyncedClipItem = {
    clipHash: encrypted.clipHash,
    text: cleanText,
    senderDeviceId: ident.deviceId,
    senderName: `${ident.displayName} (발신)`,
    createdAt: nowIso,
    encryptedE2ee: true,
  };
  const nextList = [item, ...loadCachedSyncedClips().filter((c) => c.clipHash !== item.clipHash)].slice(
    0,
    15
  );
  saveCachedSyncedClips(nextList);
  return { ok: true, item };
}

export async function pullDelayedE2eeClipboardMailbox(opts: {
  email: string;
  userId: string;
  injectToOsClipboard?: boolean;
}): Promise<GhostiSyncedClipItem[]> {
  if (!opts.email || !opts.userId || !hasAuthenticatedHubAccountSession()) {
    return loadCachedSyncedClips();
  }
  loadSeenHashesOnce();
  const ident = getThisDeviceIdentity();
  const res = await callGhostiServerBridge<{
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
    return loadCachedSyncedClips();
  }

  const decryptedList: GhostiSyncedClipItem[] = [];
  let newestExternalPlain: string | null = null;

  for (const env of res.items) {
    if (!env?.cipherB64 || !env?.ivB64) continue;
    const plain = await decryptClipboardE2ee(env.cipherB64, env.ivB64, opts.email, opts.userId);
    if (!plain) continue;
    const isFromOtherDevice = env.senderDeviceId && env.senderDeviceId !== ident.deviceId;
    if (isFromOtherDevice && !seenClipHashes.has(env.clipHash) && !newestExternalPlain) {
      newestExternalPlain = plain;
    }
    rememberSeenClipHash(env.clipHash);
    decryptedList.push({
      clipHash: env.clipHash,
      text: plain,
      senderDeviceId: env.senderDeviceId,
      senderName: env.senderName || '연결된 내 기기',
      createdAt: env.createdAt,
      encryptedE2ee: true,
    });
  }

  // PC 엔진 연결 시: 스마트폰에서 잠들기 전 보내둔 최신 클립보드를 OS 클립보드에 자동 주입 (Echo-Loop 방지 해시 각인)
  if (opts.injectToOsClipboard && newestExternalPlain && zCoreBridge.isConnected) {
    try {
      await fetch(getZCoreUrl('/__sync/clipboard'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newestExternalPlain }),
      });
    } catch {
      /* ignore */
    }
  }

  saveCachedSyncedClips(decryptedList);
  return decryptedList;
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
  onIncomingClip: (clip: GhostiSyncedClipItem) => void;
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

  const cleanup = () => {
    disposed = true;
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
        }
      };
    }
  } catch {
    /* ignore */
  }

  const setupRealtimeChannel = async () => {
    const authedOk = await ensureGhostiAuthedSupabaseClient();
    const sbClient = getGhostiAuthedSupabase() || supabase;
    if (!authedOk || disposed || !sbClient) return;

    const emailHash = (await sha256HexBrowser(normEmail)).slice(0, 24);
    const topic = `ghosti:pair:${emailHash}`;
    if (activePairChannel && activePairTopic === topic && activePairClient === sbClient) {
      return;
    }
    if (activePairChannel && (activePairClient || supabase)) {
      void (activePairClient || supabase)?.removeChannel(activePairChannel);
      activePairChannel = null;
      activePairClient = null;
      activePairSubscribed = false;
    }

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
        if (hash && seenClipHashes.has(hash)) return;

        const plain = await decryptClipboardE2ee(
          String(payload.cipherB64),
          String(payload.ivB64),
          normEmail,
          opts.userId
        );
        if (!plain) return;
        rememberSeenClipHash(hash || (await sha256HexBrowser(plain)));

        if (zCoreBridge.isConnected) {
          try {
            await fetch(getZCoreUrl('/__sync/clipboard'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: plain }),
            });
          } catch {
            /* ignore */
          }
        } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          void navigator.clipboard.writeText(plain).catch(() => {});
        }

        const clipItem: GhostiSyncedClipItem = {
          clipHash: hash || (await sha256HexBrowser(plain)),
          text: plain,
          senderDeviceId: String(payload.senderDeviceId || ''),
          senderName: String(payload.senderName || '연결된 내 기기'),
          createdAt: String(payload.createdAt || new Date().toISOString()),
          encryptedE2ee: true,
        };
        const nextClips = [
          clipItem,
          ...loadCachedSyncedClips().filter((c) => c.clipHash !== clipItem.clipHash),
        ].slice(0, 15);
        saveCachedSyncedClips(nextClips);
        opts.onIncomingClip(clipItem);
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
        if (disposed) return;
        activePairSubscribed = status === 'SUBSCRIBED';
        if (activePairSubscribed && pendingDeviceStatePacket) {
          const pkt = pendingDeviceStatePacket;
          pendingDeviceStatePacket = null;
          void ch.send({
            type: 'broadcast',
            event: 'DEVICE_STATE_UPDATED',
            payload: pkt,
          });
        }
      });

    activePairChannel = ch;
  };

  const boot = async () => {
    loadSeenHashesOnce();

    // 실시간 채널 구독을 직렬 대기 없이 0ms 즉시 병렬 착수하여 기기 간 상태 전파 지연을 원천 제거
    const realtimePromise = setupRealtimeChannel();

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

    const [hb, delayed] = await Promise.all([
      pairedViaUrl ? Promise.resolve(null) : syncDeviceHeartbeatAndList(),
      pullDelayedE2eeClipboardMailbox({
        email: normEmail,
        userId: opts.userId,
        injectToOsClipboard: true,
      }),
      realtimePromise,
    ]);

    if (!disposed && hb?.ok && opts.onDevicesUpdated) {
      opts.onDevicesUpdated({
        devices: hb.devices,
        pairingCode: hb.pairingCode,
        entitlement: hb.entitlement,
      });
    }

    if (!disposed && delayed[0] && delayed[0].senderDeviceId !== ident.deviceId) {
      opts.onIncomingClip(delayed[0]);
    }

    // PC에서 Z코어 연결 시: 2.5초 주기로 윈도우 OS 클립보드(Ctrl+C) 감지 -> 스마트폰·서브PC로 즉시 암호화 전송
    if (activeClipboardPollTimer !== null) {
      window.clearInterval(activeClipboardPollTimer);
    }
    activeClipboardPollTimer = window.setInterval(async () => {
      if (disposed || !zCoreBridge.isConnected || !hasAuthenticatedHubAccountSession()) return;
      try {
        const res = await fetch(getZCoreUrl('/__sync/clipboard'));
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          text?: string;
          clipHash?: string;
          sha256?: string;
          isSelfInjected?: boolean;
        };
        if (!data?.ok || !data.text || data.isSelfInjected) return;
        const clean = data.text.trim();
        if (!clean || clean.length > 32000) return;
        const h = data.clipHash || data.sha256 || (await sha256HexBrowser(clean));
        if (seenClipHashes.has(h)) return;
        await pushCrossDeviceClipboardText({
          text: clean,
          email: normEmail,
          userId: opts.userId,
        });
      } catch {
        /* ignore */
      }
    }, 2500);
  };

  void boot();

  const onVisibility = () => {
    if (document.visibilityState === 'visible' && !disposed) {
      void pullDelayedE2eeClipboardMailbox({
        email: normEmail,
        userId: opts.userId,
        injectToOsClipboard: true,
      });
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
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }

  return () => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
    cleanup();
  };
}
