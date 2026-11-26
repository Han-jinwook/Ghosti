import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  callGhostiServerBridge,
  ensureGhostiAuthedSupabaseClient,
  hasAuthenticatedHubAccountSession,
  supabase,
} from './supabaseClient';
import { getZCoreUrl, zCoreBridge } from './zCoreBridge';

export interface WorkLoungeDocDto {
  id: string;
  relPath: string;
  folderId: string;
  folderPath: string;
  fileName: string;
  ext: string;
  byteSize: number;
  sizeLabel: string;
  updatedAt: string;
  fileMtimeIso: string;
  author: string;
  lockedBy: string | null;
  sha256: string;
  cacheSizeLabel: string;
  summaryTitle: string;
  matchedSnippet: string;
  tableHeaders: string[];
  tableRows: string[][];
  fullTextPreview: string;
  isImage?: boolean;
  imageBase64?: string;
  inlineSyncBase64?: string;
  hasCloudBlob?: boolean;
}

export interface WorkRoomInviteMeta {
  hasWorkInvite: boolean;
  roomId: string;
  inviteToken: string;
  hostNickname: string;
  roomTitle: string;
}

export interface WorkRoomPresenceMember {
  peerId: string;
  email?: string;
  nickname: string;
  role: 'host' | 'editor' | 'viewer';
  sDriveConnected: boolean;
  onlineAt: string;
}

export interface WorkBackupServerNodeDto {
  id: string;
  slot?: number;
  label: string;
  role: string;
  status: string;
  updatedAt?: string;
}

export interface WorkHostTunnelEndpointDto {
  tunnelUrl: string;
  accessKey: string;
  updatedAt?: string | null;
  masterServerName?: string;
  backupServers?: WorkBackupServerNodeDto[];
}

export interface WorkRoomServerMemberDto {
  email: string;
  nickname: string;
  role: 'master' | 'editor' | 'viewer';
  joinedAt?: string | null;
}

const GENERIC_WORK_PLACEHOLDER_NICKS = new Set([
  '초대 팀원',
  '초대팀원',
  '팀원',
  '방장(나)',
  '방장',
  '게스트',
  '익명',
  'anonymous',
  'guest',
  'member',
]);

export function isGenericWorkPlaceholderNickname(raw?: string | null): boolean {
  const clean = String(raw || '').trim();
  if (!clean) return true;
  return (
    GENERIC_WORK_PLACEHOLDER_NICKS.has(clean) ||
    GENERIC_WORK_PLACEHOLDER_NICKS.has(clean.toLowerCase())
  );
}

export function resolveCleanWorkClientNickname(
  explicitNick?: string | null,
  explicitEmail?: string | null
): string {
  const cand = String(explicitNick || '').trim();
  if (cand && !isGenericWorkPlaceholderNickname(cand)) {
    return cand.slice(0, 32);
  }
  const resolvedEmail = String(
    explicitEmail ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('merlin_hub_user_email') ||
          localStorage.getItem('ghosti_hub_user_email') ||
          localStorage.getItem('userEmail') ||
          ''
        : '')
  )
    .trim()
    .toLowerCase();
  if (typeof window !== 'undefined') {
    try {
      // 1순위: 귀신비서(ghost_secretary_state_v1)에 현재 로그인 이메일 소유로 저장된 최신 별명
      const rawSec = localStorage.getItem('ghosti_ghost_secretary_state_v1');
      if (rawSec) {
        const parsedSec = JSON.parse(rawSec) as { ownerEmail?: string; nickname?: string };
        const secOwner = String(parsedSec?.ownerEmail || '').trim().toLowerCase();
        const secNick = String(parsedSec?.nickname || '').trim();
        if (
          secNick &&
          !isGenericWorkPlaceholderNickname(secNick) &&
          (!resolvedEmail || !secOwner || secOwner === resolvedEmail)
        ) {
          return secNick.slice(0, 32);
        }
      }
      // 2순위: 현재 계정의 프로필/허브 닉네임
      const savedHubEmail = (localStorage.getItem('ghosti_hub_user_email') || '').trim().toLowerCase();
      const savedHubNick = (localStorage.getItem('ghosti_hub_user_nickname') || '').trim();
      if (
        savedHubNick &&
        !isGenericWorkPlaceholderNickname(savedHubNick) &&
        (!resolvedEmail || !savedHubEmail || savedHubEmail === resolvedEmail)
      ) {
        return savedHubNick.slice(0, 32);
      }
      const rawUser =
        localStorage.getItem('merlin_hub_user') || localStorage.getItem('merlin_cached_user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser) as { nickname?: string; email?: string };
        const cachedEmail = String(parsed?.email || '').trim().toLowerCase();
        const userNick = String(parsed?.nickname || '').trim();
        if (
          userNick &&
          !isGenericWorkPlaceholderNickname(userNick) &&
          (!resolvedEmail || !cachedEmail || cachedEmail === resolvedEmail)
        ) {
          return userNick.slice(0, 32);
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (resolvedEmail && resolvedEmail.includes('@') && resolvedEmail !== 'anonymous') {
    return resolvedEmail.split('@')[0].slice(0, 32);
  }
  return '';
}

/**
 * 팀원 권한 및 S: 드라이브 연결 관리 카드 순서 고정 정렬 (F5·권한 변경 시 순서 변동 0%):
 * 1순위: 방장(role === 'master') 1번 고정
 * 2순위: 합류 시각(joinedAt) 오름차순
 * 3순위: 이메일(email) 사전순 오름차순
 */
export function sortWorkRoomServerMembers(
  members?: WorkRoomServerMemberDto[] | null
): WorkRoomServerMemberDto[] {
  if (!Array.isArray(members) || members.length === 0) return [];
  const dedup = new Map<string, WorkRoomServerMemberDto>();
  for (const m of members) {
    const cleanEmail = String(m?.email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) continue;
    const cleanNick = !isGenericWorkPlaceholderNickname(m.nickname)
      ? String(m.nickname).trim()
      : cleanEmail.split('@')[0];
    dedup.set(cleanEmail, {
      email: cleanEmail,
      nickname: cleanNick,
      role: m.role === 'master' ? 'master' : m.role === 'viewer' ? 'viewer' : 'editor',
      joinedAt: m.joinedAt || null,
    });
  }
  return Array.from(dedup.values()).sort((a, b) => {
    const aHost = a.role === 'master' ? 0 : 1;
    const bHost = b.role === 'master' ? 0 : 1;
    if (aHost !== bHost) return aHost - bHost;
    const aTs = a.joinedAt ? Date.parse(a.joinedAt) : NaN;
    const bTs = b.joinedAt ? Date.parse(b.joinedAt) : NaN;
    const aValid = Number.isFinite(aTs);
    const bValid = Number.isFinite(bTs);
    if (aValid && bValid && aTs !== bTs) return aTs - bTs;
    if (aValid !== bValid) return aValid ? -1 : 1;
    return a.email.localeCompare(b.email);
  });
}

export type WorkDeletedTombstoneMap = Record<string, { deletedAt: string; deletedBy?: string; relPath?: string }>;

const WORK_INVITE_SESSION_KEY = 'ghosti_active_work_room_invite_v1';
const MY_WORK_ROOM_CACHE_PREFIX = 'ghosti_my_work_room_meta_v2::';
const JOINED_WORK_ROOM_CACHE_PREFIX = 'ghosti_joined_work_room_meta_v1::';
const LOCAL_WORK_TOMBSTONES_PREFIX = 'ghosti_work_tombstones_v2::';
const PENDING_INVITED_VAULT_PURGE_PREFIX = 'ghosti_pending_invited_vault_purge_v1::';

let activeHostTunnelSession: {
  roomId: string;
  tunnelUrl: string;
  accessKey: string;
  masterServerName?: string;
  backupServers?: WorkBackupServerNodeDto[];
} | null = null;

export function getActiveHostTunnelSession(): typeof activeHostTunnelSession {
  return activeHostTunnelSession;
}

export function clearActiveHostTunnelSession(): void {
  activeHostTunnelSession = null;
}

export function markPendingInvitedVaultPurge(accountEmail?: string, roomId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const scopeEmail = resolveCurrentWorkAccountEmail(accountEmail);
    if (!scopeEmail || scopeEmail === 'anonymous') return;
    localStorage.setItem(
      `${PENDING_INVITED_VAULT_PURGE_PREFIX}${scopeEmail}`,
      JSON.stringify({ roomId: roomId || '', markedAt: new Date().toISOString() })
    );
  } catch {
    /* ignore */
  }
}

export function consumePendingInvitedVaultPurge(accountEmail?: string): { pending: boolean; roomId: string } {
  if (typeof window === 'undefined') return { pending: false, roomId: '' };
  try {
    const scopeEmail = resolveCurrentWorkAccountEmail(accountEmail);
    if (!scopeEmail || scopeEmail === 'anonymous') return { pending: false, roomId: '' };
    const key = `${PENDING_INVITED_VAULT_PURGE_PREFIX}${scopeEmail}`;
    const raw = localStorage.getItem(key);
    if (!raw) return { pending: false, roomId: '' };
    localStorage.removeItem(key);
    const parsed = JSON.parse(raw) as { roomId?: string };
    return { pending: true, roomId: String(parsed?.roomId || '') };
  } catch {
    return { pending: false, roomId: '' };
  }
}

export function setActiveHostTunnelSession(
  roomId: string,
  tunnel?: Partial<WorkHostTunnelEndpointDto> | null
): void {
  const cleanRoom = (roomId || '').trim();
  const cleanUrl = (tunnel?.tunnelUrl || '').trim().replace(/\/+$/, '');
  const cleanKey = (tunnel?.accessKey || '').trim();
  if (!cleanRoom || !cleanUrl) {
    if (activeHostTunnelSession?.roomId === cleanRoom && !cleanUrl) {
      activeHostTunnelSession = null;
    }
    return;
  }
  activeHostTunnelSession = {
    roomId: cleanRoom,
    tunnelUrl: cleanUrl,
    accessKey: cleanKey,
    masterServerName: tunnel?.masterServerName,
    backupServers: tunnel?.backupServers,
  };
}

export function resolveCurrentWorkAccountEmail(explicitEmail?: string): string {
  const clean = (explicitEmail || '').trim().toLowerCase();
  if (clean && clean !== 'anonymous') return clean;
  if (typeof window !== 'undefined') {
    try {
      const directKeys = ['ghosti_hub_user_email', 'userEmail', 'merlin_hub_user_email'];
      for (const k of directKeys) {
        const v = (localStorage.getItem(k) || '').trim().toLowerCase();
        if (v && v.includes('@') && v !== 'anonymous') return v;
      }
      const rawUser =
        localStorage.getItem('merlin_cached_user') || localStorage.getItem('merlin_hub_user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser) as { email?: string };
        const ce = String(parsed?.email || '').trim().toLowerCase();
        if (ce && ce.includes('@') && ce !== 'anonymous') return ce;
      }
    } catch {
      /* ignore */
    }
  }
  return 'anonymous';
}

export function normalizeWorkTombstoneMap(
  raw?: WorkDeletedTombstoneMap | null
): WorkDeletedTombstoneMap {
  const out: WorkDeletedTombstoneMap = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    const cleanRel = String(v?.relPath || k || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .trim();
    if (!cleanRel || !v?.deletedAt) continue;
    const low = cleanRel.toLowerCase();
    const prevMs = Date.parse(out[low]?.deletedAt || '') || 0;
    const nextMs = Date.parse(v.deletedAt || '') || 0;
    if (!out[low] || nextMs >= prevMs) {
      out[low] = {
        relPath: cleanRel,
        deletedAt: v.deletedAt,
        deletedBy: v.deletedBy,
      };
    }
  }
  return out;
}

export function lookupWorkTombstone(
  tombstones: WorkDeletedTombstoneMap | null | undefined,
  relPath: string
): { deletedAt: string; deletedBy?: string } | undefined {
  if (!tombstones || !relPath) return undefined;
  const clean = relPath.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  return tombstones[clean] || tombstones[clean.toLowerCase()];
}

const INVALID_WORK_LOCK_OWNER_RE =
  /(hcell|hwpshare|hshowshare|sharefileinfo|hancom|libreoffice|soffice|microsoft|msoffice|lockfile|winword|powerpnt)/i;

export function sanitizeWorkLockOwner(
  rawOwner: string | null | undefined,
  fallbackName = '팀원'
): string | null {
  const s = String(rawOwner || '').trim();
  if (!s) return null;
  if (INVALID_WORK_LOCK_OWNER_RE.test(s)) {
    const cleanFallback = String(fallbackName || '').trim();
    return cleanFallback && !INVALID_WORK_LOCK_OWNER_RE.test(cleanFallback) ? cleanFallback : '팀원';
  }
  return s.slice(0, 32);
}

export function loadCachedWorkTombstones(
  roomId: string,
  accountEmail?: string
): WorkDeletedTombstoneMap {
  if (typeof window === 'undefined' || !roomId) return {};
  try {
    const scopeEmail = resolveCurrentWorkAccountEmail(accountEmail);
    const raw = localStorage.getItem(`${LOCAL_WORK_TOMBSTONES_PREFIX}${scopeEmail}::${roomId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? normalizeWorkTombstoneMap(parsed as WorkDeletedTombstoneMap)
      : {};
  } catch {
    return {};
  }
}

export function saveCachedWorkTombstones(
  roomId: string,
  tombstones: WorkDeletedTombstoneMap,
  accountEmail?: string
): void {
  if (typeof window === 'undefined' || !roomId) return;
  try {
    const scopeEmail = resolveCurrentWorkAccountEmail(accountEmail);
    localStorage.setItem(
      `${LOCAL_WORK_TOMBSTONES_PREFIX}${scopeEmail}::${roomId}`,
      JSON.stringify(normalizeWorkTombstoneMap(tombstones))
    );
  } catch {
    /* ignore */
  }
}

function formatBytesLabel(bytes: number): string {
  if (!bytes || bytes <= 0) return '0.1 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(0.1, bytes / 1024).toFixed(1)} KB`;
}

function formatMtimeKo(isoOrText?: string): string {
  if (!isoOrText) return '최근';
  const parsed = Date.parse(isoOrText);
  if (Number.isNaN(parsed)) return isoOrText;
  const d = new Date(parsed);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hh}:${mm}`;
}

function isLocalDevServerAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function resolveWorkApiUrl(path: string): string | null {
  if (zCoreBridge.isConnected) {
    return getZCoreUrl(path);
  }
  if (isLocalDevServerAvailable()) {
    return path;
  }
  return null;
}

export function parseWorkInviteInput(
  rawInput: string | null | undefined
): WorkRoomInviteMeta | null {
  if (!rawInput) return null;
  let text = rawInput.trim();
  if (!text) return null;

  const clipMatch = text.match(/GHOSTI_WORK_INVITE_V1:([A-Za-z0-9+/=%._?&=-]+)/i);
  if (clipMatch && clipMatch[1]) {
    try {
      text = `ghosti://work?${decodeURIComponent(clipMatch[1])}`;
    } catch {
      text = `ghosti://work?${clipMatch[1]}`;
    }
  } else {
    const urlMatch = text.match(/(https?:\/\/[^\s]+|ghosti:\/\/[^\s]+)/i);
    if (urlMatch && urlMatch[1]) {
      text = urlMatch[1];
    }
  }

  let params: URLSearchParams | null = null;
  let isWorkSchemeHost = false;
  try {
    if (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('ghosti://')) {
      isWorkSchemeHost = /^ghosti:\/\/work(?:\b|\/|\?|$)/i.test(text);
      const normalized = text.startsWith('ghosti://')
        ? text.replace(/^ghosti:\/\//i, 'https://ghosti.local/')
        : text;
      const u = new URL(normalized);
      params = u.searchParams;
    } else if (text.includes('workRoom=')) {
      params = new URLSearchParams(text.startsWith('?') ? text.slice(1) : text);
    }
  } catch {
    const qIdx = text.indexOf('?');
    if (qIdx >= 0) {
      params = new URLSearchParams(text.slice(qIdx + 1));
    }
  }

  if (!params) return null;
  const roomId = (params.get('workRoom') || '').trim();
  if (!roomId && !isWorkSchemeHost) return null;
  if (!roomId) return null;

  const rawToken = (params.get('inviteToken') || params.get('token') || '').trim();
  const inviteToken =
    rawToken.startsWith('eyJ') && rawToken.split('.').length === 3 ? '' : rawToken;
  const hostNickname = (params.get('host') || '').trim() || '방장';
  const roomTitle = (params.get('title') || '').trim() || '우리팀 업무 공유방 (S:)';

  return {
    hasWorkInvite: true,
    roomId,
    inviteToken,
    hostNickname,
    roomTitle,
  };
}

export function saveActiveWorkRoomInviteMeta(meta: WorkRoomInviteMeta): void {
  if (typeof window === 'undefined' || !meta.roomId) return;
  const resolved: WorkRoomInviteMeta = {
    hasWorkInvite: true,
    roomId: meta.roomId.trim(),
    inviteToken: (meta.inviteToken || '').trim(),
    hostNickname: (meta.hostNickname || '').trim() || '방장',
    roomTitle: (meta.roomTitle || '').trim() || '우리팀 업무 공유방 (S:)',
  };
  try {
    sessionStorage.setItem(WORK_INVITE_SESSION_KEY, JSON.stringify(resolved));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent('ghostiWorkInviteApplied', { detail: resolved }));
  } catch {
    /* ignore */
  }
}

/**
 * 초대 링크 수락 완료 직후 또는 방장에게 내보내진(Kicked) 경우,
 * URL 쿼리스트링(?workRoom=...&inviteToken=...) 및 sessionStorage 초대 잔상을 깨끗이 소거합니다.
 * (내보내진 팀원 화면에 옛 초대 배너·가짜 방장 카드가 남거나 F5 시 구 토큰으로 재입장하는 현상을 100% 차단)
 */
export function clearActiveWorkRoomInviteMeta(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(WORK_INVITE_SESSION_KEY);
  } catch {
    /* ignore */
  }
  try {
    const u = new URL(window.location.href);
    let mutated = false;
    for (const key of ['workRoom', 'inviteToken', 'token', 'host', 'title']) {
      if (u.searchParams.has(key)) {
        u.searchParams.delete(key);
        mutated = true;
      }
    }
    if (mutated) {
      const nextRel = `${u.pathname}${u.search ? u.search : ''}${u.hash || ''}`;
      window.history.replaceState(window.history.state, '', nextRel);
    }
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent('ghostiWorkInviteCleared'));
  } catch {
    /* ignore */
  }
}

export function buildWorkRoomNativeSchemeUrl(meta: {
  roomId: string;
  inviteToken?: string;
  hostNickname?: string;
  roomTitle?: string;
}): string {
  const qs = new URLSearchParams();
  qs.set('lounge', 'work');
  qs.set('tab', 'dashboard');
  qs.set('workRoom', meta.roomId.trim());
  if (meta.inviteToken?.trim()) {
    qs.set('inviteToken', meta.inviteToken.trim());
  }
  if (meta.hostNickname?.trim()) {
    qs.set('host', meta.hostNickname.trim());
  }
  if (meta.roomTitle?.trim()) {
    qs.set('title', meta.roomTitle.trim());
  }
  return `ghosti://work?${qs.toString()}`;
}

export function buildDeferredWorkInviteClipboardToken(meta: {
  roomId: string;
  inviteToken?: string;
  hostNickname?: string;
  roomTitle?: string;
}): string {
  const qs = new URLSearchParams();
  qs.set('workRoom', meta.roomId.trim());
  if (meta.inviteToken?.trim()) qs.set('inviteToken', meta.inviteToken.trim());
  if (meta.hostNickname?.trim()) qs.set('host', meta.hostNickname.trim());
  if (meta.roomTitle?.trim()) qs.set('title', meta.roomTitle.trim());
  return `GHOSTI_WORK_INVITE_V1:${encodeURIComponent(qs.toString())}`;
}

export function buildAndroidPlayStoreWorkInviteUrl(meta: {
  roomId: string;
  inviteToken?: string;
  hostNickname?: string;
  roomTitle?: string;
}): string {
  const qs = new URLSearchParams();
  qs.set('workRoom', meta.roomId.trim());
  if (meta.inviteToken?.trim()) qs.set('inviteToken', meta.inviteToken.trim());
  if (meta.hostNickname?.trim()) qs.set('host', meta.hostNickname.trim());
  if (meta.roomTitle?.trim()) qs.set('title', meta.roomTitle.trim());
  return `https://play.google.com/store/apps/details?id=app.sundreamer.ghosti&referrer=${encodeURIComponent(
    qs.toString()
  )}`;
}

export function readActiveWorkRoomInviteMeta(): WorkRoomInviteMeta {
  const empty: WorkRoomInviteMeta = {
    hasWorkInvite: false,
    roomId: '',
    inviteToken: '',
    hostNickname: '방장',
    roomTitle: '우리팀 업무 공유방 (S:)',
  };
  if (typeof window === 'undefined') return empty;

  try {
    const params = new URLSearchParams(window.location.search);
    const urlRoomId = (params.get('workRoom') || '').trim();
    const rawUrlToken = (params.get('inviteToken') || params.get('token') || '').trim();
    const urlToken =
      rawUrlToken.startsWith('eyJ') && rawUrlToken.split('.').length === 3 ? '' : rawUrlToken;
    const urlHost = (params.get('host') || '').trim();
    const urlTitle = (params.get('title') || '').trim();

    let savedParsed: Partial<WorkRoomInviteMeta> | null = null;
    try {
      const rawSaved = sessionStorage.getItem(WORK_INVITE_SESSION_KEY);
      if (rawSaved) {
        savedParsed = JSON.parse(rawSaved) as Partial<WorkRoomInviteMeta>;
      }
    } catch {
      savedParsed = null;
    }

    if (urlRoomId) {
      const preservedToken =
        urlToken ||
        (savedParsed?.roomId === urlRoomId ? (savedParsed.inviteToken || '').trim() : '');
      const resolved: WorkRoomInviteMeta = {
        hasWorkInvite: true,
        roomId: urlRoomId,
        inviteToken: preservedToken,
        hostNickname: urlHost || savedParsed?.hostNickname || '방장',
        roomTitle: urlTitle || savedParsed?.roomTitle || '우리팀 업무 공유방 (S:)',
      };
      try {
        sessionStorage.setItem(WORK_INVITE_SESSION_KEY, JSON.stringify(resolved));
      } catch {
        /* ignore */
      }
      return resolved;
    }

    if (savedParsed?.roomId) {
      const cleanSavedTok = String(savedParsed.inviteToken || '').trim();
      return {
        hasWorkInvite: true,
        roomId: savedParsed.roomId,
        inviteToken:
          cleanSavedTok.startsWith('eyJ') && cleanSavedTok.split('.').length === 3
            ? ''
            : cleanSavedTok,
        hostNickname: savedParsed.hostNickname || '방장',
        roomTitle: savedParsed.roomTitle || '우리팀 업무 공유방 (S:)',
      };
    }
  } catch {
    /* ignore */
  }
  return empty;
}

export async function ensureMyWorkRoomAndInvite(opts: {
  roomTitle?: string;
  hostNickname?: string;
  accountEmail?: string;
}): Promise<{
  ok: boolean;
  roomId?: string;
  inviteToken?: string;
  inviteUrl?: string;
  seatLimit?: number;
  reason?: string;
  message?: string;
}> {
  if (!hasAuthenticatedHubAccountSession()) {
    return { ok: false, reason: 'AUTH_REQUIRED' };
  }
  const roomTitle = (opts.roomTitle || '우리팀 업무 공유방 (S:)').trim();
  const hostNickname = (opts.hostNickname || '방장').trim();

  const bridgeRes = await callGhostiServerBridge<{
    roomId?: string;
    inviteToken?: string;
    seatLimit?: number;
    reason?: string;
    message?: string;
  }>('work_ensure_room', {
    roomTitle,
    hostNickname,
  });

  if (!bridgeRes.ok || !bridgeRes.roomId || !bridgeRes.inviteToken) {
    return {
      ok: false,
      roomId: bridgeRes.roomId,
      reason: bridgeRes.reason || 'BRIDGE_ENSURE_ROOM_FAILED',
      message: bridgeRes.message,
    };
  }

  try {
    const scopeEmail = resolveCurrentWorkAccountEmail(opts.accountEmail);
    localStorage.setItem(
      `${MY_WORK_ROOM_CACHE_PREFIX}${scopeEmail}`,
      JSON.stringify({
        roomId: bridgeRes.roomId,
        inviteToken: bridgeRes.inviteToken,
        roomTitle,
        hostNickname,
      })
    );
  } catch {
    /* ignore */
  }

  const origin =
    typeof window !== 'undefined' && window.location.origin.startsWith('http')
      ? window.location.origin
      : 'https://ghosti.sundreamer.app';
  const qs = new URLSearchParams({
    lounge: 'work',
    tab: 'dashboard',
    workRoom: bridgeRes.roomId,
    inviteToken: bridgeRes.inviteToken,
    host: hostNickname,
    title: roomTitle,
  });

  return {
    ok: true,
    roomId: bridgeRes.roomId,
    inviteToken: bridgeRes.inviteToken,
    seatLimit: bridgeRes.seatLimit,
    inviteUrl: `${origin}/?${qs.toString()}`,
  };
}

/**
 * 초대받은 팀원(?workRoom=...&inviteToken=...)이 로그인 완료 시 정식 DB 멤버(ghosti_lounge_members)로 자동 편입합니다.
 * 정원(5인/20인/50인) 초과 시 reason: 'WORK_SEAT_LIMIT_EXCEEDED'를 반환합니다.
 */
export async function acceptWorkRoomInvite(opts: {
  inviteToken: string;
  roomId?: string;
  nickname: string;
}): Promise<{
  ok: boolean;
  roomId?: string;
  roomTitle?: string;
  hostNickname?: string;
  role?: 'host' | 'editor' | 'viewer';
  seatLimit?: number;
  members?: WorkRoomServerMemberDto[];
  deletedTombstones?: WorkDeletedTombstoneMap;
  hostTunnel?: WorkHostTunnelEndpointDto;
  reason?: string;
  message?: string;
}> {
  const cleanTok = (opts.inviteToken || '').trim();
  const cleanRoomId = (opts.roomId || '').trim();
  if ((!cleanTok && !cleanRoomId) || !hasAuthenticatedHubAccountSession()) {
    return { ok: false };
  }
  const res = await callGhostiServerBridge<{
    roomId?: string;
    roomTitle?: string;
    hostNickname?: string;
    role?: 'host' | 'editor' | 'viewer';
    seatLimit?: number;
    members?: WorkRoomServerMemberDto[];
    deletedTombstones?: WorkDeletedTombstoneMap;
    hostTunnel?: WorkHostTunnelEndpointDto;
    reason?: string;
    message?: string;
  }>('work_accept_invite', {
    inviteToken: cleanTok,
    ...(cleanRoomId ? { roomId: cleanRoomId } : {}),
    nickname: resolveCleanWorkClientNickname(opts.nickname),
  });
  if (res.ok && res.roomId && res.hostTunnel?.tunnelUrl) {
    setActiveHostTunnelSession(res.roomId, res.hostTunnel);
  }
  const sortedMembers = Array.isArray(res.members)
    ? sortWorkRoomServerMembers(res.members)
    : undefined;
  return {
    ok: Boolean(res.ok && res.roomId),
    roomId: res.roomId,
    roomTitle: res.roomTitle,
    hostNickname: res.hostNickname,
    role: res.role,
    seatLimit: res.seatLimit,
    members: sortedMembers,
    deletedTombstones: normalizeWorkTombstoneMap(res.deletedTombstones),
    hostTunnel: res.hostTunnel,
    reason: res.reason,
    message: res.message,
  };
}

export interface JoinedWorkRoomSummary {
  roomId: string;
  roomTitle: string;
  hostEmail: string;
  hostNickname?: string;
  isHost: boolean;
  role: 'host' | 'editor' | 'viewer';
  ownerUnlocked: boolean;
  seatLimit: number;
  lockReason: string | null;
  members?: WorkRoomServerMemberDto[];
  deletedTombstones?: WorkDeletedTombstoneMap;
  hostTunnel?: WorkHostTunnelEndpointDto;
}

/**
 * 로그인한 계정이 DB(ghosti_lounge_members)에 소속된 모든 업무 공유방(방장 + 초대받은 팀원방)을 조회합니다.
 * 재로그인·F5 새로고침·모바일 웹 수락 후 모바일 앱 재접속 시에도 초대 링크 없이 소속 업무방과 전체 팀원 목록을 단일 왕복으로 즉시 복원합니다.
 */
export async function fetchMyJoinedWorkRooms(): Promise<{
  ok: boolean;
  rooms: JoinedWorkRoomSummary[];
}> {
  if (!hasAuthenticatedHubAccountSession()) {
    return { ok: false, rooms: [] };
  }
  const res = await callGhostiServerBridge<{
    rooms?: JoinedWorkRoomSummary[];
  }>('work_list_my_rooms', {
    nickname: resolveCleanWorkClientNickname(),
  });
  if (!res.ok || !Array.isArray(res.rooms)) {
    return { ok: false, rooms: [] };
  }
  const normalizedRooms = res.rooms.map((r) => {
    if (r.roomId && r.hostTunnel?.tunnelUrl) {
      setActiveHostTunnelSession(r.roomId, r.hostTunnel);
    }
    return {
      ...r,
      members: Array.isArray(r.members) ? sortWorkRoomServerMembers(r.members) : undefined,
      deletedTombstones: r.deletedTombstones
        ? normalizeWorkTombstoneMap(r.deletedTombstones)
        : undefined,
    };
  });
  return { ok: true, rooms: normalizedRooms };
}

export function readCachedJoinedWorkRoomMeta(accountEmail?: string): JoinedWorkRoomSummary | null {
  if (typeof window === 'undefined') return null;
  try {
    const scopeEmail = resolveCurrentWorkAccountEmail(accountEmail);
    if (scopeEmail === 'anonymous') return null;
    const raw = localStorage.getItem(`${JOINED_WORK_ROOM_CACHE_PREFIX}${scopeEmail}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<JoinedWorkRoomSummary>;
    if (!parsed?.roomId) return null;
    return {
      roomId: parsed.roomId,
      roomTitle: parsed.roomTitle || '우리팀 업무 공유방 (S:)',
      hostEmail: parsed.hostEmail || '',
      hostNickname: parsed.hostNickname || '방장',
      isHost: Boolean(parsed.isHost),
      role: parsed.role === 'viewer' ? 'viewer' : parsed.role === 'host' ? 'host' : 'editor',
      ownerUnlocked: parsed.ownerUnlocked !== false,
      seatLimit: Number(parsed.seatLimit || 5),
      lockReason: parsed.lockReason || null,
    };
  } catch {
    return null;
  }
}

export function saveCachedJoinedWorkRoomMeta(
  summary: JoinedWorkRoomSummary,
  accountEmail?: string
): void {
  if (typeof window === 'undefined' || !summary?.roomId) return;
  try {
    const scopeEmail = resolveCurrentWorkAccountEmail(accountEmail);
    if (scopeEmail === 'anonymous') return;
    localStorage.setItem(
      `${JOINED_WORK_ROOM_CACHE_PREFIX}${scopeEmail}`,
      JSON.stringify({
        roomId: summary.roomId,
        roomTitle: summary.roomTitle,
        hostEmail: summary.hostEmail,
        hostNickname: summary.hostNickname,
        isHost: summary.isHost,
        role: summary.role,
        ownerUnlocked: summary.ownerUnlocked,
        seatLimit: summary.seatLimit,
        lockReason: summary.lockReason,
      })
    );
  } catch {
    /* ignore */
  }
}

export function clearCachedJoinedWorkRoomMeta(accountEmail?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const scopeEmail = resolveCurrentWorkAccountEmail(accountEmail);
    if (scopeEmail !== 'anonymous') {
      localStorage.removeItem(`${JOINED_WORK_ROOM_CACHE_PREFIX}${scopeEmail}`);
    }
  } catch {
    /* ignore */
  }
}

export function readCachedMyWorkRoomMeta(accountEmail?: string): {
  roomId: string;
  inviteToken: string;
  roomTitle: string;
  hostNickname: string;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const scopeEmail = resolveCurrentWorkAccountEmail(accountEmail);
    if (scopeEmail === 'anonymous') return null;
    const raw = localStorage.getItem(`${MY_WORK_ROOM_CACHE_PREFIX}${scopeEmail}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      roomId?: string;
      inviteToken?: string;
      roomTitle?: string;
      hostNickname?: string;
    };
    if (parsed?.roomId) {
      return {
        roomId: parsed.roomId,
        inviteToken: parsed.inviteToken || '',
        roomTitle: parsed.roomTitle || '우리팀 업무 공유방 (S:)',
        hostNickname: parsed.hostNickname || '방장',
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function syncCachedMyWorkRoomMetaFromServer(
  meta: { roomId: string; roomTitle?: string; hostNickname?: string },
  accountEmail?: string
): void {
  if (typeof window === 'undefined' || !meta.roomId) return;
  try {
    const scopeEmail = resolveCurrentWorkAccountEmail(accountEmail);
    if (scopeEmail === 'anonymous') return;
    const key = `${MY_WORK_ROOM_CACHE_PREFIX}${scopeEmail}`;
    const prevRaw = localStorage.getItem(key);
    const prev = prevRaw ? (JSON.parse(prevRaw) as { roomId?: string; inviteToken?: string }) : null;
    localStorage.setItem(
      key,
      JSON.stringify({
        roomId: meta.roomId,
        inviteToken: prev?.roomId === meta.roomId ? prev.inviteToken || '' : '',
        roomTitle: meta.roomTitle || '우리팀 업무 공유방 (S:)',
        hostNickname: meta.hostNickname || '방장',
      })
    );
  } catch {
    /* ignore */
  }
}

const KICKED_WORK_ROOM_NOTICE_PREFIX = 'ghosti_kicked_work_room_notice_v1::';

export function readPendingKickedWorkRoomNotice(accountEmail?: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const scopeEmail = resolveCurrentWorkAccountEmail(accountEmail);
    if (!scopeEmail || scopeEmail === 'anonymous') return null;
    const raw = localStorage.getItem(`${KICKED_WORK_ROOM_NOTICE_PREFIX}${scopeEmail}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { roomTitle?: string };
    const title = (parsed?.roomTitle || '').trim();
    return title || null;
  } catch {
    return null;
  }
}

export function savePendingKickedWorkRoomNotice(roomTitle: string, accountEmail?: string): void {
  if (typeof window === 'undefined') return;
  const cleanTitle = (roomTitle || '').trim();
  if (!cleanTitle) return;
  try {
    const scopeEmail = resolveCurrentWorkAccountEmail(accountEmail);
    if (!scopeEmail || scopeEmail === 'anonymous') return;
    localStorage.setItem(
      `${KICKED_WORK_ROOM_NOTICE_PREFIX}${scopeEmail}`,
      JSON.stringify({ roomTitle: cleanTitle, kickedAt: new Date().toISOString() })
    );
  } catch {
    /* ignore */
  }
}

export function clearPendingKickedWorkRoomNotice(accountEmail?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const scopeEmail = resolveCurrentWorkAccountEmail(accountEmail);
    if (scopeEmail && scopeEmail !== 'anonymous') {
      localStorage.removeItem(`${KICKED_WORK_ROOM_NOTICE_PREFIX}${scopeEmail}`);
    }
  } catch {
    /* ignore */
  }
}

import {
  isLocalPcBlockedByOtherAccount,
  releaseLocalPcAccountOwner,
} from './pcSingleAccountGuard';

export function clearWorkRoomLocalCachesOnLogout(explicitPrevEmail?: string): void {
  const cleanExplicit = (explicitPrevEmail || '').trim().toLowerCase();
  const prevEmail = cleanExplicit || resolveCurrentWorkAccountEmail();
  const wasBlocked = isLocalPcBlockedByOtherAccount();
  activeHostTunnelSession = null;
  if (typeof window === 'undefined') return;
  if (prevEmail && prevEmail !== 'anonymous' && !wasBlocked) {
    void releaseLocalPcAccountOwner(prevEmail);
  }
  try {
    localStorage.removeItem('ghosti_my_work_room_meta_v1');
    sessionStorage.removeItem(WORK_INVITE_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export async function mountWorkSDriveNative(opts?: {
  action?: 'mount' | 'unmount' | 'pick_folder' | 'reset_default';
  openExplorer?: boolean;
  targetDir?: string;
  accountEmail?: string;
  purgeInvitedVault?: boolean;
  roomId?: string;
}): Promise<{
  ok: boolean;
  cancelled?: boolean;
  mounted?: boolean;
  driveLetter?: string;
  targetDir?: string;
  isCustomTarget?: boolean;
  message?: string;
}> {
  if (isLocalPcBlockedByOtherAccount()) {
    return {
      ok: false,
      mounted: false,
      message: '현재 이 PC는 다른 계정에 연결되어 있습니다. 한 PC에서는 한 번에 하나의 계정만 사용할 수 있습니다.',
    };
  }
  const url = resolveWorkApiUrl('/__work/s-drive');
  if (!url) return { ok: false };
  const resolvedEmail = resolveCurrentWorkAccountEmail(opts?.accountEmail);
  const action = opts?.action || 'mount';
  const timeoutMs = action === 'pick_folder' ? 185_000 : 20_000;
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          openExplorer: Boolean(opts?.openExplorer),
          ...(opts?.purgeInvitedVault ? { purgeInvitedVault: true } : {}),
          ...(opts?.roomId ? { roomId: opts.roomId } : {}),
          ...(resolvedEmail && resolvedEmail !== 'anonymous' ? { email: resolvedEmail } : {}),
          ...(opts?.targetDir ? { targetDir: opts.targetDir } : {}),
        }),
      },
      timeoutMs
    );
    const parsed = (await res.json().catch(() => null)) as {
      ok?: boolean;
      cancelled?: boolean;
      mounted?: boolean;
      driveLetter?: string;
      targetDir?: string;
      isCustomTarget?: boolean;
      message?: string;
    } | null;
    if (parsed && typeof parsed === 'object') {
      return {
        ok: Boolean(res.ok && parsed.ok),
        cancelled: parsed.cancelled,
        mounted: parsed.mounted,
        driveLetter: parsed.driveLetter,
        targetDir: parsed.targetDir,
        isCustomTarget: parsed.isCustomTarget,
        message: parsed.message,
      };
    }
    return {
      ok: false,
      message: 'PC 엔진과 통신하지 못했습니다. 트레이의 귀신같이(Merlin Z-Core) 엔진 상태를 확인해 주세요.',
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      ...(isAbort && action === 'pick_folder' ? { cancelled: true } : {}),
      message: isAbort
        ? '폴더 선택 대기 시간이 초과되었습니다. 다시 [업무 폴더 변경]을 눌러 선택해 주세요.'
        : 'PC 엔진 연결이 일시 중단되었습니다. 잠시 후 다시 눌러 주세요.',
    };
  }
}

export function mapRawWorkFileToDto(rf: Record<string, unknown>, idx: number): WorkLoungeDocDto {
  const name = String(rf.name || rf.fileName || `업무파일_${idx + 1}`);
  const relPath = String(rf.relPath || name).replace(/\\/g, '/').replace(/^\/+/, '');
  const ext = String(rf.ext || name.split('.').pop() || 'FILE').toUpperCase();
  const byteSize = Number(rf.size ?? rf.byteSize ?? 0);
  const sizeLabel = String(rf.sizeFormatted || rf.sizeLabel || formatBytesLabel(byteSize));
  const mtimeIso = String(rf.mtime || rf.fileMtimeIso || rf.fileMtime || new Date().toISOString());
  const updatedAt = String(rf.mtimeFormatted || formatMtimeKo(mtimeIso));
  const folderId = String(rf.folderId || 'root');
  const folderPath = String(rf.folderPath || 'S:\\');
  const author = String(rf.author || rf.uploaderNickname || '팀원');
  const lockedBy = sanitizeWorkLockOwner(rf.lockedBy ? String(rf.lockedBy) : null, author);
  const isImage = Boolean(rf.isImage);
  const previewText = String(rf.previewText || rf.fullTextPreview || '').trim();
  const rawHeaders = Array.isArray(rf.tableHeaders) ? (rf.tableHeaders as string[]) : [];
  const rawRows = Array.isArray(rf.tableRows) ? (rf.tableRows as string[][]) : [];

  const defaultSnippet = isImage
    ? `현장·증빙 이미지: ${name} (${sizeLabel}) — 실시간 미리보기 지원`
    : previewText
    ? previewText.slice(0, 160).replace(/\s+/g, ' ')
    : `S: 드라이브 공유 문서 — ${relPath}`;

  return {
    id: `work-${relPath}`,
    relPath,
    folderId,
    folderPath,
    fileName: name,
    ext,
    byteSize,
    sizeLabel,
    updatedAt,
    fileMtimeIso: mtimeIso,
    author,
    lockedBy,
    sha256: typeof rf.sha256 === 'string' ? rf.sha256.trim() : '',
    cacheSizeLabel: zCoreBridge.isConnected ? 'S:\\ 실시간 직결' : '웹 미리보기 동기화됨',
    summaryTitle: String(
      rf.summaryTitle || (isImage ? `[이미지 미리보기] ${name}` : `[문서 미리보기] ${name}`)
    ),
    matchedSnippet: String(rf.matchedSnippet || defaultSnippet),
    tableHeaders: rawHeaders.length > 0 ? rawHeaders : ['속성', '상세 정보'],
    tableRows:
      rawRows.length > 0
        ? rawRows
        : [            ['파일명', name],
            ['경로', `${folderPath}\\${name}`],
            ['용량', sizeLabel],
            ['최근 수정일', updatedAt],
          ],
    fullTextPreview:
      previewText ||
      (isImage
        ? `[현장·증빙 이미지 미리보기 지원] ${name}`
        : `S: 드라이브에 보관된 ${name} 원본 문서입니다.`),
    isImage,
    imageBase64: rf.imageBase64 ? String(rf.imageBase64) : undefined,
    inlineSyncBase64: rf.syncBase64
      ? String(rf.syncBase64)
      : rf.inlineSyncBase64
      ? String(rf.inlineSyncBase64)
      : undefined,
    hasCloudBlob: Boolean(rf.hasCloudBlob),
  };
}

export async function fetchLocalWorkFilesNative(opts?: {
  includeSyncBase64?: boolean;
  author?: string;
  knownSig?: string;
}): Promise<{
  ok: boolean;
  unchanged?: boolean;
  listSig?: string;
  mounted: boolean;
  targetDir?: string;
  previewPendingCount?: number;
  docs: WorkLoungeDocDto[];
  locallyDeletedRelPaths: string[];
  localDeletedTombstones: WorkDeletedTombstoneMap;
}> {
  const base = resolveWorkApiUrl('/__work/files');
  if (!base) {
    return {
      ok: false,
      mounted: false,
      docs: [],
      locallyDeletedRelPaths: [],
      localDeletedTombstones: {},
    };
  }
  try {
    const qs = new URLSearchParams();
    if (opts?.includeSyncBase64) qs.set('includeSyncBase64', '1');
    if (opts?.author) qs.set('author', opts.author);
    if (opts?.knownSig) qs.set('knownSig', opts.knownSig);
    const fullUrl = qs.toString() ? `${base}?${qs.toString()}` : base;
    const res = await fetch(fullUrl);
    if (!res.ok) {
      return {
        ok: false,
        mounted: false,
        docs: [],
        locallyDeletedRelPaths: [],
        localDeletedTombstones: {},
      };
    }
    const data = (await res.json()) as {
      ok?: boolean;
      unchanged?: boolean;
      listSig?: string;
      mounted?: boolean;
      targetDir?: string;
      previewPendingCount?: number;
      files?: Array<Record<string, unknown>>;
      locallyDeletedRelPaths?: string[];
      localDeletedTombstones?: WorkDeletedTombstoneMap;
    };
    if (data?.ok && data.unchanged === true) {
      return {
        ok: true,
        unchanged: true,
        listSig: typeof data.listSig === 'string' ? data.listSig : opts?.knownSig,
        mounted: Boolean(data.mounted),
        targetDir: data.targetDir,
        previewPendingCount: Number(data.previewPendingCount || 0),
        docs: [],
        locallyDeletedRelPaths: [],
        localDeletedTombstones:
          data.localDeletedTombstones && typeof data.localDeletedTombstones === 'object'
            ? data.localDeletedTombstones
            : {},
      };
    }
    if (!data?.ok || !Array.isArray(data.files)) {
      return {
        ok: false,
        mounted: false,
        docs: [],
        locallyDeletedRelPaths: [],
        localDeletedTombstones: {},
      };
    }
    return {
      ok: true,
      unchanged: false,
      listSig: typeof data.listSig === 'string' ? data.listSig : '',
      mounted: Boolean(data.mounted),
      targetDir: data.targetDir,
      previewPendingCount: Number(data.previewPendingCount || 0),
      docs: data.files.map((rf, i) => mapRawWorkFileToDto(rf, i)),
      locallyDeletedRelPaths: Array.isArray(data.locallyDeletedRelPaths)
        ? data.locallyDeletedRelPaths
        : [],
      localDeletedTombstones:
        data.localDeletedTombstones && typeof data.localDeletedTombstones === 'object'
          ? data.localDeletedTombstones
          : {},
    };
  } catch {
    return {
      ok: false,
      mounted: false,
      docs: [],
      locallyDeletedRelPaths: [],
      localDeletedTombstones: {},
    };
  }
}

export async function fetchLocalWorkLocksFast(author?: string): Promise<{
  ok: boolean;
  locks: Record<string, string | null>;
  fileCount: number;
  unsupported?: boolean;
}> {
  const base = resolveWorkApiUrl('/__work/locks');
  if (!base) return { ok: false, locks: {}, fileCount: 0 };
  try {
    const qs = new URLSearchParams();
    if (author) qs.set('author', author);
    const fullUrl = qs.toString() ? `${base}?${qs.toString()}` : base;
    const res = await fetch(fullUrl);
    if (res.status === 404) {
      return { ok: false, locks: {}, fileCount: 0, unsupported: true };
    }
    if (!res.ok) return { ok: false, locks: {}, fileCount: 0 };
    const data = (await res.json()) as {
      ok?: boolean;
      locks?: Record<string, string | null>;
      fileCount?: number;
    };
    if (!data?.ok || !data.locks || typeof data.locks !== 'object') {
      return { ok: false, locks: {}, fileCount: 0 };
    }
    const cleanLocks: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(data.locks)) {
      const sanitized = sanitizeWorkLockOwner(v, author || '팀원');
      if (sanitized) cleanLocks[k] = sanitized;
    }
    return {
      ok: true,
      locks: cleanLocks,
      fileCount: Number(data.fileCount || 0),
    };
  } catch {
    return { ok: false, locks: {}, fileCount: 0 };
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    return await fetch(url, {
      ...init,
      ...(ctrl ? { signal: ctrl.signal } : {}),
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function uploadWorkFileToNativeSDrive(opts: {
  file: File;
  folderId?: string;
  author?: string;
  roomId?: string;
  isHost?: boolean;
}): Promise<{ ok: boolean; relPath?: string; sDrivePath?: string; error?: string }> {
  if (opts.file.size > 50 * 1024 * 1024) {
    return { ok: false, error: 'EXCEEDS_50MB_LIMIT' };
  }
  const localUrl = resolveWorkApiUrl('/__work/upload');
  let tunnel =
    !opts.isHost &&
    activeHostTunnelSession &&
    (!opts.roomId || activeHostTunnelSession.roomId === opts.roomId) &&
    activeHostTunnelSession.tunnelUrl
      ? activeHostTunnelSession
      : null;

  // 초대 팀원이 업로드할 때 아직 메모리에 대장 PC 터널 주소가 없다면 서버에서 최신 터널 주소를 즉시 1회 확보
  if (!opts.isHost && !tunnel && opts.roomId && hasAuthenticatedHubAccountSession()) {
    try {
      const freshState = await callGhostiServerBridge<{ hostTunnel?: WorkHostTunnelEndpointDto }>(
        'work_get_room_state',
        { roomId: opts.roomId }
      );
      if (freshState.ok && freshState.hostTunnel?.tunnelUrl) {
        setActiveHostTunnelSession(opts.roomId, freshState.hostTunnel);
        tunnel = getActiveHostTunnelSession();
      }
    } catch {
      /* ignore */
    }
  }

  if (!localUrl && !tunnel) {
    return { ok: false, error: 'PC_ENGINE_OR_TUNNEL_NOT_CONNECTED' };
  }
  const base64Data = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(opts.file);
  });
  if (!base64Data) {
    return { ok: false, error: 'READ_FILE_FAILED' };
  }

  const bodyPayload = JSON.stringify({
    fileName: opts.file.name,
    folderId: opts.folderId && opts.folderId !== 'all' ? opts.folderId : '',
    base64Data,
    author: opts.author || '',
  });

  // 1) 내 PC 엔진 연결 시 로컬 S:\에 즉시 기록 (15초 타임아웃으로 무한 대기 원천 차단)
  let localResult: { ok: boolean; relPath?: string; sDrivePath?: string; error?: string } | null =
    null;
  if (localUrl) {
    try {
      const res = await fetchWithTimeout(
        localUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyPayload,
        },
        15000
      );
      localResult = (await res.json()) as {
        ok: boolean;
        relPath?: string;
        sDrivePath?: string;
        error?: string;
      };
    } catch (err) {
      localResult = { ok: false, error: String(err) };
    }
  }

  // 2) 초대 팀원(또는 모바일)인 경우 대장 PC 직통 HTTPS 터널로도 전송해 방장 S:\에도 즉시 반영 (12초 타임아웃 + 터널 회전 시 1회 자동 재획득)
  if (!opts.isHost && tunnel) {
    const pushToTunnel = async (ep: NonNullable<typeof tunnel>) => {
      const tRes = await fetchWithTimeout(
        `${ep.tunnelUrl}/__work/upload`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(ep.accessKey ? { 'X-Ghosti-Work-Key': ep.accessKey } : {}),
          },
          body: bodyPayload,
        },
        12000
      );
      if (!tRes.ok) return null;
      const tj = (await tRes.json()) as {
        ok: boolean;
        relPath?: string;
        sDrivePath?: string;
        error?: string;
      };
      return tj?.ok ? tj : null;
    };

    try {
      const pushed = await pushToTunnel(tunnel);
      if (pushed) {
        return localResult?.ok ? localResult : pushed;
      }
    } catch {
      /* retry once with refreshed tunnel URL below */
    }

    if (opts.roomId && hasAuthenticatedHubAccountSession()) {
      try {
        const refreshed = await callGhostiServerBridge<{ hostTunnel?: WorkHostTunnelEndpointDto }>(
          'work_get_room_state',
          { roomId: opts.roomId }
        );
        const nextUrl = (refreshed.hostTunnel?.tunnelUrl || '').trim().replace(/\/+$/, '');
        if (refreshed.ok && nextUrl && nextUrl !== tunnel.tunnelUrl) {
          setActiveHostTunnelSession(opts.roomId, refreshed.hostTunnel);
          const nextSession = getActiveHostTunnelSession();
          if (nextSession) {
            const retried = await pushToTunnel(nextSession).catch(() => null);
            if (retried) {
              return localResult?.ok ? localResult : retried;
            }
          }
        }
      } catch {
        /* fallback to localResult */
      }
    }
  }

  return localResult || { ok: false, error: 'UPLOAD_FAILED' };
}

/**
 * [Zero-Cloud 직통 터널 조회] 외부 팀원(집·현장·LTE·모바일)이 대장 PC의 상시 아웃바운드 HTTPS 터널에서
 * S:\ 파일 목록과 본문·표 미리보기를 대기시간 0초로 직접 가져옵니다 (서버 파일 저장 0 Byte).
 */
export async function fetchWorkFilesFromHostTunnel(
  tunnelUrl?: string,
  accessKey?: string
): Promise<{
  ok: boolean;
  docs: WorkLoungeDocDto[];
  deletedTombstones: WorkDeletedTombstoneMap;
}> {
  const cleanUrl = (tunnelUrl || activeHostTunnelSession?.tunnelUrl || '').trim().replace(/\/+$/, '');
  const cleanKey = (accessKey ?? activeHostTunnelSession?.accessKey ?? '').trim();
  if (!cleanUrl) {
    return { ok: false, docs: [], deletedTombstones: {} };
  }
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 5000) : null;
  try {
    const res = await fetch(`${cleanUrl}/__work/files`, {
      method: 'GET',
      headers: cleanKey ? { 'X-Ghosti-Work-Key': cleanKey } : {},
      ...(ctrl ? { signal: ctrl.signal } : {}),
    });
    if (!res.ok) {
      return { ok: false, docs: [], deletedTombstones: {} };
    }
    const data = (await res.json()) as {
      ok?: boolean;
      files?: Array<Record<string, unknown>>;
      localDeletedTombstones?: WorkDeletedTombstoneMap;
    };
    if (!data?.ok || !Array.isArray(data.files)) {
      return { ok: false, docs: [], deletedTombstones: {} };
    }
    return {
      ok: true,
      docs: data.files.map((rf, idx) => mapRawWorkFileToDto(rf, idx)),
      deletedTombstones: normalizeWorkTombstoneMap(data.localDeletedTombstones),
    };
  } catch {
    return { ok: false, docs: [], deletedTombstones: {} };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function fetchWorkLocksFromHostTunnel(
  tunnelUrl?: string,
  accessKey?: string
): Promise<{
  ok: boolean;
  locks: Record<string, string | null>;
}> {
  const cleanUrl = (tunnelUrl || activeHostTunnelSession?.tunnelUrl || '').trim().replace(/\/+$/, '');
  const cleanKey = (accessKey ?? activeHostTunnelSession?.accessKey ?? '').trim();
  if (!cleanUrl) return { ok: false, locks: {} };
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 2500) : null;
  try {
    const res = await fetch(`${cleanUrl}/__work/locks`, {
      method: 'GET',
      headers: cleanKey ? { 'X-Ghosti-Work-Key': cleanKey } : {},
      ...(ctrl ? { signal: ctrl.signal } : {}),
    });
    if (!res.ok) return { ok: false, locks: {} };
    const data = (await res.json()) as {
      ok?: boolean;
      locks?: Record<string, string | null>;
    };
    if (!data?.ok || !data.locks || typeof data.locks !== 'object') {
      return { ok: false, locks: {} };
    }
    const cleanLocks: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(data.locks)) {
      const sanitized = sanitizeWorkLockOwner(v, '팀원');
      if (sanitized) cleanLocks[k] = sanitized;
    }
    return { ok: true, locks: cleanLocks };
  } catch {
    return { ok: false, locks: {} };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

let lastRegisteredHostTunnelSig = '';

export async function ensureLocalHostOutboundTunnelAndRegister(
  roomId: string,
  extra?: {
    masterServerName?: string;
    backupServers?: WorkBackupServerNodeDto[];
    forceRegister?: boolean;
  }
): Promise<{
  ok: boolean;
  status: string;
  tunnelUrl: string;
  accessKey: string;
}> {
  const cleanRoomId = (roomId || '').trim();
  if (!zCoreBridge.isConnected || !cleanRoomId) {
    return { ok: false, status: 'disconnected', tunnelUrl: '', accessKey: '' };
  }
  try {
    const res = await fetch(getZCoreUrl('/__work/tunnel'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    });
    if (!res.ok) {
      return { ok: false, status: 'error', tunnelUrl: '', accessKey: '' };
    }
    let data = (await res.json()) as {
      ok?: boolean;
      status?: string;
      tunnelUrl?: string;
      accessKey?: string;
    };
    let tunnelUrl = (data.tunnelUrl || '').trim().replace(/\/+$/, '');
    let accessKey = (data.accessKey || '').trim();
    let status = data.status || (tunnelUrl ? 'connected' : 'starting');

    // cloudflared 최초 기동(starting / downloading_binary) 시 20초 주기까지 방치하지 않고 1초 간격으로 즉시 대기 후 서버에 터널 등록!
    if (!tunnelUrl && (status === 'starting' || status === 'downloading_binary')) {
      for (let attempt = 0; attempt < 15; attempt += 1) {
        await new Promise((r) => setTimeout(r, 1000));
        if (!zCoreBridge.isConnected) break;
        try {
          const pollRes = await fetch(getZCoreUrl('/__work/tunnel'), { method: 'GET' });
          if (!pollRes.ok) break;
          data = (await pollRes.json()) as typeof data;
          tunnelUrl = (data.tunnelUrl || '').trim().replace(/\/+$/, '');
          accessKey = (data.accessKey || accessKey).trim();
          status = data.status || (tunnelUrl ? 'connected' : 'starting');
          if (tunnelUrl || (status !== 'starting' && status !== 'downloading_binary')) {
            break;
          }
        } catch {
          break;
        }
      }
    }

    if (tunnelUrl && hasAuthenticatedHubAccountSession()) {
      const regSig = `${cleanRoomId}::${tunnelUrl}::${accessKey}::${extra?.masterServerName || ''}::${JSON.stringify(extra?.backupServers || [])}`;
      if (extra?.forceRegister || regSig !== lastRegisteredHostTunnelSig) {
        const regRes = await callGhostiServerBridge('work_register_tunnel', {
          roomId: cleanRoomId,
          tunnelUrl,
          accessKey,
          ...(extra?.masterServerName ? { masterServerName: extra.masterServerName } : {}),
          ...(extra?.backupServers ? { backupServers: extra.backupServers } : {}),
        });
        if (!regRes.ok) {
          return { ok: false, status: 'forbidden_not_host', tunnelUrl: '', accessKey: '' };
        }
        lastRegisteredHostTunnelSig = regSig;
      }
      setActiveHostTunnelSession(cleanRoomId, {
        tunnelUrl,
        accessKey,
        masterServerName: extra?.masterServerName,
        backupServers: extra?.backupServers,
      });
    }
    return {
      ok: Boolean(data.ok && tunnelUrl),
      status: tunnelUrl ? 'connected' : status,
      tunnelUrl,
      accessKey,
    };
  } catch {
    return { ok: false, status: 'error', tunnelUrl: '', accessKey: '' };
  }
}

export async function pullSyncRemoteWorkFilesToLocalSDrive(
  remoteDocs: WorkLoungeDocDto[],
  opts?: {
    roomId?: string;
    inviteToken?: string;
    deletedTombstones?: WorkDeletedTombstoneMap;
  }
): Promise<{ ok: boolean; syncedCount: number; removedCount: number }> {
  if (!zCoreBridge.isConnected) {
    return { ok: false, syncedCount: 0, removedCount: 0 };
  }
  const tombstones = normalizeWorkTombstoneMap(opts?.deletedTombstones);
  const inlineItems = remoteDocs
    .filter((d) => Boolean(d.inlineSyncBase64) && !lookupWorkTombstone(tombstones, d.relPath))
    .map((d) => ({
      relPath: d.relPath,
      sha256: d.sha256,
      byteSize: d.byteSize,
      fileMtimeIso: d.fileMtimeIso,
      uploaderNickname: d.author,
      base64Data: d.inlineSyncBase64,
    }));

  // 인라인 Base64가 없는 파일은 대장 PC의 상시 HTTPS 직통 터널(/__work/file-sync-payload)에서 직접 가져와 동기화 (서버 저장 0 Byte)
  const tunnel = activeHostTunnelSession;
  if (tunnel?.tunnelUrl) {
    const needFetchDocs = remoteDocs.filter(
      (d) =>
        !d.inlineSyncBase64 &&
        !lookupWorkTombstone(tombstones, d.relPath) &&
        d.byteSize > 0 &&
        d.byteSize <= 15 * 1024 * 1024
    );
    for (const d of needFetchDocs.slice(0, 15)) {
      try {
        const pRes = await fetchWithTimeout(
          `${tunnel.tunnelUrl}/__work/file-sync-payload?relPath=${encodeURIComponent(d.relPath)}`,
          {
            method: 'GET',
            headers: tunnel.accessKey ? { 'X-Ghosti-Work-Key': tunnel.accessKey } : {},
          },
          8000
        );
        if (pRes.ok) {
          const pj = (await pRes.json()) as {
            ok?: boolean;
            base64Data?: string;
            size?: number;
            mtime?: string;
          };
          if (pj?.ok && pj.base64Data) {
            inlineItems.push({
              relPath: d.relPath,
              sha256: d.sha256,
              byteSize: Number(pj.size || d.byteSize || 0),
              fileMtimeIso: pj.mtime || d.fileMtimeIso,
              uploaderNickname: d.author,
              base64Data: pj.base64Data,
            });
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  let syncedTotal = 0;
  let removedTotal = 0;

  if (inlineItems.length > 0 || Object.keys(tombstones).length > 0) {
    try {
      const res = await fetchWithTimeout(
        getZCoreUrl('/__work/pull-sync'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: inlineItems,
            deletedTombstones: tombstones,
          }),
        },
        15000
      );
      if (res.ok) {
        const json = (await res.json()) as {
          ok?: boolean;
          syncedCount?: number;
          removedByTombstoneCount?: number;
        };
        syncedTotal += Number(json?.syncedCount || 0);
        removedTotal += Number(json?.removedByTombstoneCount || 0);
      }
    } catch {
      /* ignore */
    }
  }

  return { ok: true, syncedCount: syncedTotal, removedCount: removedTotal };
}

export async function downloadWorkFileOriginal(
  doc: WorkLoungeDocDto,
  _opts?: { roomId?: string; inviteToken?: string }
): Promise<boolean> {
  // 1순위: 내 PC 엔진 연결 시 로컬 S:\에서 즉시 다운로드
  if (zCoreBridge.isConnected) {
    try {
      const res = await fetch(
        getZCoreUrl(`/__work/download?relPath=${encodeURIComponent(doc.relPath)}`)
      );
      if (res.ok) {
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = doc.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(objUrl), 3000);
        return true;
      }
    } catch {
      /* fallback below */
    }
  }
  // 2순위: 대장 PC 상시 아웃바운드 HTTPS 직통 터널에서 직접 스트리밍 다운로드 (서버 저장 0 Byte)
  if (activeHostTunnelSession?.tunnelUrl) {
    try {
      const res = await fetch(
        `${activeHostTunnelSession.tunnelUrl}/__work/download?relPath=${encodeURIComponent(doc.relPath)}`,
        {
          method: 'GET',
          headers: activeHostTunnelSession.accessKey
            ? { 'X-Ghosti-Work-Key': activeHostTunnelSession.accessKey }
            : {},
        }
      );
      if (res.ok) {
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = doc.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(objUrl), 3000);
        return true;
      }
    } catch {
      /* fallback below */
    }
  }
  // 3순위: Realtime Broadcast로 이미 수신된 경량 인라인 데이터
  if (doc.inlineSyncBase64) {
    try {
      const raw = doc.inlineSyncBase64.includes(',')
        ? doc.inlineSyncBase64.split(',', 2)[1]
        : doc.inlineSyncBase64;
      const bin = atob(raw);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) {
        bytes[i] = bin.charCodeAt(i);
      }
      const blob = new Blob([bytes]);
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objUrl), 3000);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function deleteWorkFileShared(opts: {
  roomId?: string;
  relPath: string;
  actorNickname?: string;
  deletedAt?: string;
}): Promise<{ ok: boolean; deletedTombstones?: WorkDeletedTombstoneMap; message?: string }> {
  const cleanRel = (opts.relPath || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!cleanRel) return { ok: false };
  const deletedAt = opts.deletedAt || new Date().toISOString();
  const actor = opts.actorNickname || '팀원';

  let localTombstones: WorkDeletedTombstoneMap | undefined;
  if (zCoreBridge.isConnected) {
    try {
      const lRes = await fetch(getZCoreUrl('/__work/delete-file'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relPath: cleanRel,
          actorNickname: actor,
          deletedAt,
        }),
      });
      if (lRes.ok) {
        const lj = (await lRes.json().catch(() => ({}))) as {
          ok?: boolean;
          localDeletedTombstones?: WorkDeletedTombstoneMap;
          message?: string;
        };
        if (lj?.ok === false) {
          return { ok: false, message: lj.message };
        }
        if (lj?.localDeletedTombstones) {
          localTombstones = normalizeWorkTombstoneMap(lj.localDeletedTombstones);
        }
      }
    } catch {
      /* ignore */
    }
  } else if (activeHostTunnelSession?.tunnelUrl) {
    // 외부 팀원이 삭제 권한으로 삭제 시 대장 PC 직통 터널을 통해 대장 PC의 OS [휴지통]으로 안전 이동
    try {
      await fetch(`${activeHostTunnelSession.tunnelUrl}/__work/delete-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeHostTunnelSession.accessKey
            ? { 'X-Ghosti-Work-Key': activeHostTunnelSession.accessKey }
            : {}),
        },
        body: JSON.stringify({
          relPath: cleanRel,
          actorNickname: actor,
          deletedAt,
        }),
      });
    } catch {
      /* ignore */
    }
  }

  const effectiveRoomId =
    (opts.roomId || '').trim() || readCachedMyWorkRoomMeta()?.roomId || '';
  if (effectiveRoomId && hasAuthenticatedHubAccountSession()) {
    const srv = await callGhostiServerBridge<{
      deletedTombstones?: WorkDeletedTombstoneMap;
      message?: string;
    }>('work_delete_file', {
      roomId: effectiveRoomId,
      relPath: cleanRel,
      actorNickname: actor,
    });
    return {
      ok: Boolean(srv.ok),
      message: srv.message,
      deletedTombstones: normalizeWorkTombstoneMap({
        ...(localTombstones || {}),
        ...(srv.deletedTombstones || {}),
      }),
    };
  }
  return { ok: true, deletedTombstones: localTombstones };
}

export async function toggleHideWorkFileNative(relPath: string): Promise<boolean> {
  if (!zCoreBridge.isConnected) return false;
  try {
    const res = await fetch(getZCoreUrl('/__work/toggle-hide'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ relPath }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function setWorkNightPowerSaveNative(
  enabled: boolean,
  turnOffMonitor = true
): Promise<{
  ok: boolean;
  enabled: boolean;
  monitorTurnedOff?: boolean;
  message?: string;
}> {
  if (!zCoreBridge.isConnected) {
    return {
      ok: false,
      enabled: false,
      message: 'PC 엔진을 연결하면 퇴근 시 모니터만 끄고 S: 드라이브 직통 연결을 24시간 유지합니다.',
    };
  }
  try {
    const res = await fetch(getZCoreUrl('/__work/night-power-save'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, turnOffMonitor }),
    });
    if (!res.ok) return { ok: false, enabled: false };
    return (await res.json()) as {
      ok: boolean;
      enabled: boolean;
      monitorTurnedOff?: boolean;
      message?: string;
    };
  } catch {
    return { ok: false, enabled: false };
  }
}

export async function manageWorkBackupServersNative(opts: {
  subAction: 'get' | 'save' | 'sync-now';
  masterServerName?: string;
  backupServers?: WorkBackupServerNodeDto[];
  localBackupServerDir?: string;
}): Promise<{
  ok: boolean;
  masterServerName?: string;
  backupServers?: WorkBackupServerNodeDto[];
  localBackupServerDir?: string;
  lastBackupSyncedAt?: string;
  lastBackupSyncedCount?: number;
  newlyCopiedCount?: number;
}> {
  if (!zCoreBridge.isConnected) {
    return { ok: false };
  }
  try {
    const res = await fetch(getZCoreUrl('/__work/backup-servers'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    });
    if (!res.ok) return { ok: false };
    return (await res.json()) as {
      ok: boolean;
      masterServerName?: string;
      backupServers?: WorkBackupServerNodeDto[];
      localBackupServerDir?: string;
      lastBackupSyncedAt?: string;
      lastBackupSyncedCount?: number;
      newlyCopiedCount?: number;
    };
  } catch {
    return { ok: false };
  }
}

export async function updateWorkRoomMemberRoleOnServer(opts: {
  roomId: string;
  memberEmail: string;
  role: 'editor' | 'viewer';
}): Promise<{ ok: boolean; members?: WorkRoomServerMemberDto[] }> {
  if (!opts.roomId || !opts.memberEmail || !hasAuthenticatedHubAccountSession()) {
    return { ok: false };
  }
  // 권한 변경 직후 즉시 F5를 눌러도 브라우저 커널이 DB PATCH 요청을 끝까지 완수하도록 keepalive 활성화
  const res = await callGhostiServerBridge<{ members?: WorkRoomServerMemberDto[] }>(
    'work_set_member_role',
    opts,
    { keepalive: true }
  );
  return {
    ok: Boolean(res.ok),
    members: Array.isArray(res.members) ? sortWorkRoomServerMembers(res.members) : undefined,
  };
}

export async function removeWorkRoomMemberOnServer(opts: {
  roomId: string;
  memberEmail?: string;
}): Promise<{ ok: boolean; members?: WorkRoomServerMemberDto[]; inviteToken?: string }> {
  if (!opts.roomId || !hasAuthenticatedHubAccountSession()) return { ok: false };
  const res = await callGhostiServerBridge<{
    members?: WorkRoomServerMemberDto[];
    inviteToken?: string;
  }>('work_remove_member', opts, { keepalive: true });
  if (res.ok && res.inviteToken && typeof window !== 'undefined') {
    try {
      const scopeEmail = resolveCurrentWorkAccountEmail();
      const prevRaw = localStorage.getItem(`${MY_WORK_ROOM_CACHE_PREFIX}${scopeEmail}`);
      if (prevRaw) {
        const prevObj = JSON.parse(prevRaw) as Record<string, unknown>;
        if (prevObj?.roomId === opts.roomId) {
          localStorage.setItem(
            `${MY_WORK_ROOM_CACHE_PREFIX}${scopeEmail}`,
            JSON.stringify({ ...prevObj, inviteToken: res.inviteToken })
          );
        }
      }
    } catch {
      /* ignore */
    }
  }
  return {
    ok: Boolean(res.ok),
    members: Array.isArray(res.members) ? sortWorkRoomServerMembers(res.members) : undefined,
    inviteToken: res.inviteToken,
  };
}

export async function revokeAndRotateWorkInviteOnServer(roomId: string): Promise<{
  ok: boolean;
  inviteToken?: string;
}> {
  if (!roomId || !hasAuthenticatedHubAccountSession()) return { ok: false };
  const res = await callGhostiServerBridge<{ inviteToken?: string }>('work_revoke_invite', {
    roomId,
  });
  return { ok: Boolean(res.ok && res.inviteToken), inviteToken: res.inviteToken };
}

export async function openGhostSearchForWorkSDrive(query?: string): Promise<boolean> {
  if (!zCoreBridge.isConnected) return false;
  const cleanQ = (query || '').trim();
  try {
    const res = await fetch(getZCoreUrl('/__merlin/open-ghost-search'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage: cleanQ ? 'medium' : 'small',
        query: cleanQ,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const LOCAL_WORK_PREVIEW_PREFIX = 'ghosti_work_preview_cache_v3::';

export async function cacheWorkRoomPreviewLocally(
  roomId: string,
  docs: WorkLoungeDocDto[],
  accountEmail?: string
): Promise<void> {
  if (typeof window === 'undefined' || !roomId) return;
  try {
    const scopeEmail = resolveCurrentWorkAccountEmail(accountEmail);
    const slim = docs.slice(0, 120).map((d) => ({
      ...d,
      inlineSyncBase64: undefined,
      imageBase64: d.imageBase64 && d.imageBase64.length <= 45_000 ? d.imageBase64 : undefined,
    }));
    localStorage.setItem(
      `${LOCAL_WORK_PREVIEW_PREFIX}${scopeEmail}::${roomId}`,
      JSON.stringify(slim)
    );
  } catch {
    /* ignore quota */
  }
}

export async function loadCachedWorkRoomPreview(
  roomId: string,
  accountEmail?: string
): Promise<WorkLoungeDocDto[]> {
  if (typeof window === 'undefined' || !roomId) return [];
  try {
    const scopeEmail = resolveCurrentWorkAccountEmail(accountEmail);
    const raw = localStorage.getItem(`${LOCAL_WORK_PREVIEW_PREFIX}${scopeEmail}::${roomId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WorkLoungeDocDto[]) : [];
  } catch {
    return [];
  }
}

export async function fetchWorkRoomCloudPreview(inviteToken: string): Promise<{
  ok: boolean;
  roomTitle?: string;
  hostNickname?: string;
  requiresLoginForDirectTunnel?: boolean;
  docs: WorkLoungeDocDto[];
  deletedTombstones: WorkDeletedTombstoneMap;
}> {
  const cleanToken = (inviteToken || '').trim();
  if (!cleanToken) return { ok: false, docs: [], deletedTombstones: {} };
  const res = await callGhostiServerBridge<{
    requiresLoginForDirectTunnel?: boolean;
    room?: { roomTitle?: string; hostNickname?: string };
    files?: Array<Record<string, unknown>>;
    deletedTombstones?: WorkDeletedTombstoneMap;
  }>('work_get_preview', { inviteToken: cleanToken }, { allowAnonymous: true });

  if (!res.ok) {
    return { ok: false, docs: [], deletedTombstones: {} };
  }
  return {
    ok: true,
    roomTitle: res.room?.roomTitle,
    hostNickname: res.room?.hostNickname,
    requiresLoginForDirectTunnel: Boolean(res.requiresLoginForDirectTunnel),
    docs: Array.isArray(res.files) ? res.files.map((f, idx) => mapRawWorkFileToDto(f, idx)) : [],
    deletedTombstones: normalizeWorkTombstoneMap(res.deletedTombstones),
  };
}

export async function fetchWorkRoomAuthedState(
  roomId: string,
  inviteToken?: string,
  opts?: { skipBlockingTunnelFetch?: boolean }
): Promise<{
  ok: boolean;
  role?: 'host' | 'editor' | 'viewer';
  seatLimit?: number;
  members?: WorkRoomServerMemberDto[];
  hostTunnel?: WorkHostTunnelEndpointDto;
  docs: WorkLoungeDocDto[];
  deletedTombstones: WorkDeletedTombstoneMap;
  reason?: string;
  message?: string;
}> {
  if (!roomId || !hasAuthenticatedHubAccountSession()) {
    return { ok: false, docs: [], deletedTombstones: {} };
  }
  const res = await callGhostiServerBridge<{
    role?: 'host' | 'editor' | 'viewer';
    seatLimit?: number;
    members?: WorkRoomServerMemberDto[];
    hostTunnel?: WorkHostTunnelEndpointDto;
    files?: Array<Record<string, unknown>>;
    deletedTombstones?: WorkDeletedTombstoneMap;
    reason?: string;
    message?: string;
  }>('work_get_room_state', {
    roomId,
    inviteToken: inviteToken || '',
    nickname: resolveCleanWorkClientNickname(),
  });

  if (!res.ok) {
    return {
      ok: false,
      docs: [],
      deletedTombstones: {},
      reason: res.reason,
      message: res.message,
    };
  }

  const tombstones = normalizeWorkTombstoneMap(res.deletedTombstones);
  const sortedMembers = Array.isArray(res.members)
    ? sortWorkRoomServerMembers(res.members)
    : undefined;
  let tunnelDocs: WorkLoungeDocDto[] = [];
  if (res.hostTunnel?.tunnelUrl) {
    setActiveHostTunnelSession(roomId, res.hostTunnel);
    // skipBlockingTunnelFetch 활성화 시 팀원 목록(members)·권한을 0ms 먼저 반환하고 터널 파일 조회는 비동기로 분리
    if (!opts?.skipBlockingTunnelFetch && (!zCoreBridge.isConnected || res.role !== 'host')) {
      const fromTunnel = await fetchWorkFilesFromHostTunnel(
        res.hostTunnel.tunnelUrl,
        res.hostTunnel.accessKey
      );
      if (fromTunnel.ok) {
        tunnelDocs = fromTunnel.docs;
      }
    }
  }

  return {
    ok: true,
    role: res.role,
    seatLimit: res.seatLimit,
    members: sortedMembers,
    hostTunnel: res.hostTunnel,
    docs: tunnelDocs,
    deletedTombstones: tombstones,
  };
}

export async function upsertWorkFilesToSupabase(opts: {
  roomId: string;
  docs: WorkLoungeDocDto[];
  actorNickname: string;
  isHost?: boolean;
}): Promise<{
  ok: boolean;
  mergedDocs?: WorkLoungeDocDto[];
  deletedTombstones?: WorkDeletedTombstoneMap;
  uploadedLargeBlob?: boolean;
}> {
  // [Zero-Cloud 원칙]: 서버에는 파일·본문을 업로드하지 않으며, 대장 PC(방장 전용)의 상시 HTTPS 직통 터널과 Tombstone 상태만 동기화합니다.
  if (!opts.roomId || !hasAuthenticatedHubAccountSession()) {
    return { ok: false };
  }
  if (opts.isHost) {
    await ensureLocalHostOutboundTunnelAndRegister(opts.roomId);
  }
  const res = await callGhostiServerBridge<{
    deletedTombstones?: WorkDeletedTombstoneMap;
    hostTunnel?: WorkHostTunnelEndpointDto;
  }>('work_get_room_state', {
    roomId: opts.roomId,
  });
  if (res.ok && res.hostTunnel?.tunnelUrl) {
    setActiveHostTunnelSession(opts.roomId, res.hostTunnel);
  }
  return {
    ok: Boolean(res.ok),
    deletedTombstones: normalizeWorkTombstoneMap(res.deletedTombstones),
    uploadedLargeBlob: false,
  };
}

export function connectWorkRoomRealtimeChannel(opts: {
  roomId: string;
  peerId: string;
  email?: string;
  nickname: string;
  role: 'host' | 'editor' | 'viewer';
  getLocalDocs: () => WorkLoungeDocDto[];
  getLocalMembers?: () => WorkRoomServerMemberDto[];
  onSubscribed?: () => void;
  onRemoteSnapshot: (docs: WorkLoungeDocDto[]) => void;
  onRemoteFileDeleted: (relPath: string, deletedAt: string) => void;
  onRemoteLockMap: (locksByRelPath: Record<string, string | null>) => void;
  onPresenceMembers: (members: WorkRoomPresenceMember[]) => void;
  onRemoteTunnelEndpoint?: (tunnel: WorkHostTunnelEndpointDto) => void;
  onRemoteMembersUpdated?: (members: WorkRoomServerMemberDto[]) => void;
}): {
  broadcastSnapshot: (docs: WorkLoungeDocDto[]) => void;
  broadcastFileDeleted: (relPath: string, deletedAt: string) => void;
  broadcastLocks: (locksByRelPath: Record<string, string | null>) => void;
  broadcastTunnelEndpoint: (tunnel: WorkHostTunnelEndpointDto) => void;
  broadcastMembersUpdated: (members: WorkRoomServerMemberDto[]) => void;
  dispose: () => void;
} {
  let channel: RealtimeChannel | null = null;
  let activeSbClient: typeof supabase = null;
  let disposed = false;

  const stripHeavyPayload = (docs: WorkLoungeDocDto[]) => {
    // Supabase Realtime WebSocket 프레임 한도(~250KB) 초과로 전체 브로드캐스트가 드롭되는 현상 원천 차단:
    // 본문 요약·썸네일을 경량화하고 inlineSyncBase64 총합을 140KB 이내로 제한 (원본·전체 미리보기는 대장 PC HTTPS 직통 터널에서 무손실 수신)
    let inlineBudgetRemaining = 140_000;
    return docs.slice(0, 120).map((d) => {
      let safeInline: string | undefined;
      if (
        d.inlineSyncBase64 &&
        d.inlineSyncBase64.length <= 60_000 &&
        d.inlineSyncBase64.length <= inlineBudgetRemaining
      ) {
        safeInline = d.inlineSyncBase64;
        inlineBudgetRemaining -= d.inlineSyncBase64.length;
      }
      return {
        ...d,
        fullTextPreview: d.fullTextPreview ? d.fullTextPreview.slice(0, 900) : d.fullTextPreview,
        imageBase64: d.imageBase64 && d.imageBase64.length <= 18_000 ? d.imageBase64 : undefined,
        inlineSyncBase64: safeInline,
      };
    });
  };

  const start = async () => {
    // 비로그인 상태에서는 업무방 Realtime 채널 연결을 허용하지 않음 (Fail-Closed)
    if (!hasAuthenticatedHubAccountSession()) return;
    // RLS 보호 Realtime 채널(ghosti:room:<roomId>, to authenticated) 통과를 위해 반드시 인증 JWT가 탑재된 authedSb 사용!
    const authedSb = await ensureGhostiAuthedSupabaseClient();
    if (disposed) return;
    const sbClient = authedSb || supabase;
    if (!sbClient) return;
    activeSbClient = sbClient;

    channel = sbClient.channel(`ghosti:room:${opts.roomId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: opts.peerId },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        if (!channel || disposed) return;
        const state = channel.presenceState<WorkRoomPresenceMember>();
        const list: WorkRoomPresenceMember[] = [];
        for (const entries of Object.values(state)) {
          if (Array.isArray(entries) && entries[0]) {
            list.push(entries[0]);
          }
        }
        opts.onPresenceMembers(list);
      })
      .on('broadcast', { event: 'REQUEST_WORK_SNAPSHOT' }, () => {
        if (!channel || disposed) return;
        const curDocs = opts.getLocalDocs();
        if (curDocs.length > 0) {
          void channel.send({
            type: 'broadcast',
            event: 'WORK_SNAPSHOT',
            payload: { sender: opts.peerId, docs: stripHeavyPayload(curDocs) },
          });
        }
        if (
          opts.role === 'host' &&
          activeHostTunnelSession &&
          activeHostTunnelSession.roomId === opts.roomId &&
          activeHostTunnelSession.tunnelUrl
        ) {
          void channel.send({
            type: 'broadcast',
            event: 'WORK_TUNNEL_ENDPOINT',
            payload: activeHostTunnelSession,
          });
        }
      })
      .on('broadcast', { event: 'WORK_SNAPSHOT' }, ({ payload }) => {
        if (disposed || !payload?.docs || !Array.isArray(payload.docs)) return;
        opts.onRemoteSnapshot(payload.docs as WorkLoungeDocDto[]);
      })
      .on('broadcast', { event: 'WORK_FILE_DELETED' }, ({ payload }) => {
        if (disposed || !payload?.relPath) return;
        opts.onRemoteFileDeleted(
          String(payload.relPath),
          String(payload.deletedAt || new Date().toISOString())
        );
      })
      .on('broadcast', { event: 'WORK_LOCK_UPDATE' }, ({ payload }) => {
        if (disposed || !payload?.locks) return;
        opts.onRemoteLockMap(payload.locks as Record<string, string | null>);
      })
      .on('broadcast', { event: 'WORK_TUNNEL_ENDPOINT' }, ({ payload }) => {
        if (disposed || !payload?.tunnelUrl) return;
        const ep: WorkHostTunnelEndpointDto = {
          tunnelUrl: String(payload.tunnelUrl),
          accessKey: String(payload.accessKey || ''),
          updatedAt: new Date().toISOString(),
          masterServerName: payload.masterServerName,
          backupServers: payload.backupServers,
        };
        setActiveHostTunnelSession(opts.roomId, ep);
        opts.onRemoteTunnelEndpoint?.(ep);
      })
      .on('broadcast', { event: 'WORK_MEMBERS_UPDATED' }, ({ payload }) => {
        if (disposed || !Array.isArray(payload?.members)) return;
        opts.onRemoteMembersUpdated?.(
          sortWorkRoomServerMembers(payload.members as WorkRoomServerMemberDto[])
        );
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED' || !channel || disposed) return;
        await channel.track({
          peerId: opts.peerId,
          email: (opts.email || '').trim().toLowerCase() || undefined,
          nickname: opts.nickname,
          role: opts.role,
          sDriveConnected: zCoreBridge.isConnected,
          onlineAt: new Date().toISOString(),
        });
        opts.onSubscribed?.();
        void channel.send({
          type: 'broadcast',
          event: 'REQUEST_WORK_SNAPSHOT',
          payload: { requester: opts.peerId },
        });
        const curDocs = opts.getLocalDocs();
        if (curDocs.length > 0) {
          void channel.send({
            type: 'broadcast',
            event: 'WORK_SNAPSHOT',
            payload: { sender: opts.peerId, docs: stripHeavyPayload(curDocs) },
          });
        }
      });
  };

  void start();

  return {
    broadcastSnapshot: (docs: WorkLoungeDocDto[]) => {
      if (!channel || disposed) return;
      void channel.send({
        type: 'broadcast',
        event: 'WORK_SNAPSHOT',
        payload: { sender: opts.peerId, docs: stripHeavyPayload(docs) },
      });
    },
    broadcastFileDeleted: (relPath: string, deletedAt: string) => {
      if (!channel || disposed) return;
      void channel.send({
        type: 'broadcast',
        event: 'WORK_FILE_DELETED',
        payload: { sender: opts.peerId, relPath, deletedAt },
      });
    },
    broadcastLocks: (locksByRelPath: Record<string, string | null>) => {
      if (!channel || disposed) return;
      void channel.send({
        type: 'broadcast',
        event: 'WORK_LOCK_UPDATE',
        payload: { sender: opts.peerId, locks: locksByRelPath },
      });
    },
    broadcastTunnelEndpoint: (tunnel: WorkHostTunnelEndpointDto) => {
      if (!channel || disposed) return;
      void channel.send({
        type: 'broadcast',
        event: 'WORK_TUNNEL_ENDPOINT',
        payload: tunnel,
      });
    },
    broadcastMembersUpdated: (members: WorkRoomServerMemberDto[]) => {
      if (!channel || disposed) return;
      void channel.send({
        type: 'broadcast',
        event: 'WORK_MEMBERS_UPDATED',
        payload: { sender: opts.peerId, members: sortWorkRoomServerMembers(members) },
      });
    },
    dispose: () => {
      disposed = true;
      if (channel && activeSbClient) {
        void activeSbClient.removeChannel(channel);
        channel = null;
      }
    },
  };
}
