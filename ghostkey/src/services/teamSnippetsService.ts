import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  callGhostiServerBridge,
  ensureGhostiPublicSupabaseClient,
  getGhostiAuthedSupabase,
  hasAuthenticatedHubAccountSession,
  readGhostiAuthedJwtClaims,
  supabase,
} from '@shared/services/supabaseClient';
import { getThisDeviceIdentity } from '@shared/services/deviceIntegrationService';
import { getZCoreUrl, zCoreBridge } from '@shared/services/zCoreBridge';

export const TEAM_SNIPPET_KEYS = ['F7', 'F8', 'F9', 'F10', 'F11', 'F12'] as const;
export type TeamSnippetKey = (typeof TEAM_SNIPPET_KEYS)[number];

export interface WorkTeamRoomOption {
  roomId: string;
  roomTitle: string;
  role: 'host' | 'editor' | 'viewer';
  masterEmail: string;
}

export interface TeamSnippetsSyncResult {
  ok: boolean;
  reason?: string;
  message?: string;
  roomId?: string;
  roomTitle?: string;
  role?: 'host' | 'editor' | 'viewer';
  realtimeChannel?: string;
  snippets: Record<string, string>;
  version?: number;
  updatedAt?: string | null;
  updatedByEmail?: string;
  updatedByNickname?: string;
  updatedByDeviceName?: string;
}

const TEAM_SNIPPETS_CACHE_PREFIX = 'ghostkey_team_snippets_v1::';
const PERSONAL_SNIPPETS_STORAGE_KEY = 'ghosti_superpower_snippets_v27';
const ACTIVE_WORK_ROOM_STORAGE_KEY = 'ghosti_active_work_room_id';

export const DEFAULT_TEAM_SNIPPETS_PLACEHOLDERS: Record<TeamSnippetKey, string> = {
  F7: '예: 신한은행 110-123-456789 (예금주: 썬드림주식회사)',
  F8: '예: 사업자등록번호 333-87-00482 / 대표 백은숙',
  F9: '예: 세금계산서 발행 이메일 tax@company.co.kr',
  F10: '예: 안녕하세요, 요청하신 견적서 및 서류 전달드립니다.',
  F11: '예: 택배 마감은 평일 오후 3시이며 당일 출고됩니다.',
  F12: '예: 대표번호 070-7424-2695 (평일 09:00~18:00)',
};

export function sanitizeTeamSnippetsMap(raw?: Record<string, unknown> | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of TEAM_SNIPPET_KEYS) {
    const val = raw && typeof raw[key] === 'string' ? String(raw[key]).slice(0, 2000) : '';
    out[key] = val;
  }
  return out;
}

export function loadCachedTeamSnippets(roomId?: string | null): Record<string, string> {
  if (typeof window === 'undefined' || !roomId) {
    return sanitizeTeamSnippetsMap(null);
  }
  try {
    const raw = localStorage.getItem(`${TEAM_SNIPPETS_CACHE_PREFIX}${roomId}`);
    if (raw) {
      return sanitizeTeamSnippetsMap(JSON.parse(raw));
    }
  } catch {
    /* ignore */
  }
  return sanitizeTeamSnippetsMap(null);
}

function saveCachedTeamSnippets(roomId: string, snippets: Record<string, string>): void {
  if (typeof window === 'undefined' || !roomId) return;
  try {
    localStorage.setItem(`${TEAM_SNIPPETS_CACHE_PREFIX}${roomId}`, JSON.stringify(snippets));
    localStorage.setItem(ACTIVE_WORK_ROOM_STORAGE_KEY, roomId);
  } catch {
    /* ignore */
  }
}

/**
 * 로컬 PC Z-Core (`127.0.0.1:5199`) 상용구 저장 시 개인 `F1~F6`과 팀 `F7~F12`가 서로 덮어쓰지 않도록 안전 병합합니다.
 */
export async function applyMergedSnippetsToLocalZCore(opts: {
  personalF1toF6?: Record<string, string>;
  teamF7toF12?: Record<string, string>;
}): Promise<boolean> {
  if (!zCoreBridge.isConnected) return false;

  let baseSnippets: Record<string, string> = {};
  try {
    const rawLocal = localStorage.getItem(PERSONAL_SNIPPETS_STORAGE_KEY);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (parsed && typeof parsed === 'object') {
        baseSnippets = { ...parsed };
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const curRes = await fetch(getZCoreUrl('/api/superpower/settings'), {
      signal: AbortSignal.timeout(1800),
    });
    if (curRes.ok) {
      const curJson = (await curRes.json().catch(() => ({}))) as {
        snippets?: Record<string, string>;
      };
      if (curJson?.snippets && typeof curJson.snippets === 'object') {
        baseSnippets = { ...baseSnippets, ...curJson.snippets };
      }
    }
  } catch {
    /* ignore */
  }

  const merged: Record<string, string> = { ...baseSnippets };
  if (opts.personalF1toF6) {
    for (const k of ['F1', 'F2', 'F3', 'F4', 'F5', 'F6']) {
      if (Object.prototype.hasOwnProperty.call(opts.personalF1toF6, k)) {
        merged[k] = String(opts.personalF1toF6[k] ?? '');
      }
    }
  }
  if (opts.teamF7toF12) {
    for (const k of TEAM_SNIPPET_KEYS) {
      if (Object.prototype.hasOwnProperty.call(opts.teamF7toF12, k)) {
        merged[k] = String(opts.teamF7toF12[k] ?? '');
      }
    }
  }

  try {
    const res = await fetch(getZCoreUrl('/api/superpower/snippets'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snippets: merged }),
      signal: AbortSignal.timeout(2500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 현재 로그인 계정이 소속된 업무 공유방(`lounge_type = 'work'`) 목록을 조회합니다.
 * 업무 공유 구독자(방장)인데 아직 방이 생성되지 않은 경우 `work_ensure_room`으로 자동 개설합니다.
 */
export async function resolveMyWorkTeamRooms(opts?: {
  workSubscriptionUnlocked?: boolean;
}): Promise<WorkTeamRoomOption[]> {
  if (!hasAuthenticatedHubAccountSession()) return [];
  await ensureGhostiPublicSupabaseClient();

  const claims = readGhostiAuthedJwtClaims();
  const authed = getGhostiAuthedSupabase();
  const rooms: WorkTeamRoomOption[] = [];

  if (authed && claims?.email) {
    try {
      const { data: memRows } = await authed
        .from('ghosti_lounge_members')
        .select('room_id, role')
        .eq('member_email', claims.email)
        .limit(30);

      const roomIds = Array.from(
        new Set(
          (memRows || [])
            .map((m: { room_id?: string }) => String(m?.room_id || '').trim())
            .filter(Boolean)
        )
      );

      if (roomIds.length > 0) {
        const { data: roomRows } = await authed
          .from('ghosti_lounge_rooms')
          .select('room_id, room_title, master_email, lounge_type')
          .in('room_id', roomIds)
          .eq('lounge_type', 'work');

        const roleByRoom = new Map<string, string>();
        for (const m of memRows || []) {
          if (m?.room_id) roleByRoom.set(String(m.room_id), String(m.role || 'editor'));
        }

        for (const r of roomRows || []) {
          const rId = String(r?.room_id || '').trim();
          if (!rId) continue;
          const mEmail = String(r?.master_email || '').trim().toLowerCase();
          const isMaster = mEmail === claims.email;
          const rawRole = (roleByRoom.get(rId) || 'editor').toLowerCase();
          rooms.push({
            roomId: rId,
            roomTitle: String(r?.room_title || '업무 공유방 (S:)'),
            role: isMaster || rawRole === 'master' ? 'host' : rawRole === 'viewer' ? 'viewer' : 'editor',
            masterEmail: mEmail,
          });
        }
      }
    } catch {
      /* fallback to server bridge */
    }
  }

  if (rooms.length === 0 && opts?.workSubscriptionUnlocked) {
    const ensured = await callGhostiServerBridge<{
      roomId?: string;
      roomTitle?: string;
    }>('work_ensure_room', {});
    if (ensured.ok && ensured.roomId) {
      rooms.push({
        roomId: ensured.roomId,
        roomTitle: ensured.roomTitle || '우리팀 업무 공유방 (S:)',
        role: 'host',
        masterEmail: claims?.email || '',
      });
    }
  }

  // 본인이 방장인 방을 최우선으로 정렬
  rooms.sort((a, b) => (a.role === 'host' ? -1 : b.role === 'host' ? 1 : 0));
  return rooms;
}

export async function pullTeamSnippetsFromBridge(roomId?: string): Promise<TeamSnippetsSyncResult> {
  if (!hasAuthenticatedHubAccountSession()) {
    return { ok: false, reason: 'HUB_AUTH_REQUIRED', snippets: sanitizeTeamSnippetsMap(null) };
  }

  const res = await callGhostiServerBridge<{
    role?: 'host' | 'editor' | 'viewer';
    roomTitle?: string;
    realtimeChannel?: string;
    roomId?: string;
    snippets?: Record<string, string>;
    version?: number;
    updatedAt?: string | null;
    updatedByEmail?: string;
    updatedByNickname?: string;
    updatedByDeviceName?: string;
    message?: string;
  }>('work_sync_team_snippets', {
    ...(roomId ? { roomId } : {}),
    mode: 'pull',
  });

  if (!res.ok) {
    return {
      ok: false,
      reason: res.reason || 'PULL_FAILED',
      message: res.message,
      snippets: loadCachedTeamSnippets(roomId),
    };
  }

  const resolvedRoomId = res.roomId || roomId || '';
  const cleanSnippets = sanitizeTeamSnippetsMap(res.snippets);
  if (resolvedRoomId) {
    saveCachedTeamSnippets(resolvedRoomId, cleanSnippets);
  }

  const hasAnyText = Object.values(cleanSnippets).some((v) => v.trim().length > 0);
  if (hasAnyText) {
    await applyMergedSnippetsToLocalZCore({ teamF7toF12: cleanSnippets });
  }

  return {
    ok: true,
    roomId: resolvedRoomId,
    roomTitle: res.roomTitle,
    role: res.role,
    realtimeChannel: res.realtimeChannel || (resolvedRoomId ? `ghosti:room:${resolvedRoomId}` : undefined),
    snippets: cleanSnippets,
    version: res.version,
    updatedAt: res.updatedAt || null,
    updatedByEmail: res.updatedByEmail,
    updatedByNickname: res.updatedByNickname,
    updatedByDeviceName: res.updatedByDeviceName,
  };
}

export async function pushTeamSnippetsToBridge(
  roomId: string,
  draftSnippets: Record<string, string>
): Promise<TeamSnippetsSyncResult> {
  if (!hasAuthenticatedHubAccountSession()) {
    return { ok: false, reason: 'HUB_AUTH_REQUIRED', snippets: sanitizeTeamSnippetsMap(draftSnippets) };
  }
  const cleanRoomId = roomId.trim();
  if (!cleanRoomId) {
    return { ok: false, reason: 'MISSING_ROOM_ID', snippets: sanitizeTeamSnippetsMap(draftSnippets) };
  }

  const cleanSnippets = sanitizeTeamSnippetsMap(draftSnippets);
  const ident = getThisDeviceIdentity();

  const res = await callGhostiServerBridge<{
    role?: 'host' | 'editor' | 'viewer';
    roomTitle?: string;
    realtimeChannel?: string;
    roomId?: string;
    snippets?: Record<string, string>;
    version?: number;
    updatedAt?: string | null;
    updatedByEmail?: string;
    updatedByNickname?: string;
    updatedByDeviceName?: string;
    message?: string;
  }>('work_sync_team_snippets', {
    roomId: cleanRoomId,
    mode: 'push',
    snippets: cleanSnippets,
    deviceId: ident.deviceId,
    deviceName: ident.displayName,
  });

  if (!res.ok) {
    return {
      ok: false,
      reason: res.reason || 'PUSH_FAILED',
      message: res.message,
      roomId: cleanRoomId,
      snippets: cleanSnippets,
    };
  }

  const savedSnippets = sanitizeTeamSnippetsMap(res.snippets || cleanSnippets);
  saveCachedTeamSnippets(cleanRoomId, savedSnippets);
  await applyMergedSnippetsToLocalZCore({ teamF7toF12: savedSnippets });

  // 같은 업무방 팀원들에게 실시간 브로드캐스트 전파
  await broadcastTeamSnippetsUpdated({
    roomId: cleanRoomId,
    version: res.version || 1,
    updatedAt: res.updatedAt || new Date().toISOString(),
    senderDeviceId: ident.deviceId,
  });

  return {
    ok: true,
    roomId: cleanRoomId,
    roomTitle: res.roomTitle,
    role: res.role,
    realtimeChannel: res.realtimeChannel || `ghosti:room:${cleanRoomId}`,
    snippets: savedSnippets,
    version: res.version,
    updatedAt: res.updatedAt || new Date().toISOString(),
    updatedByEmail: res.updatedByEmail,
    updatedByNickname: res.updatedByNickname,
    updatedByDeviceName: res.updatedByDeviceName,
  };
}

let activeTeamRoomChannel: RealtimeChannel | null = null;
let activeTeamRoomId = '';

async function broadcastTeamSnippetsUpdated(payload: {
  roomId: string;
  version: number;
  updatedAt: string;
  senderDeviceId: string;
}): Promise<void> {
  try {
    await ensureGhostiPublicSupabaseClient();
    const client = getGhostiAuthedSupabase() || supabase;
    if (!client) return;

    if (activeTeamRoomChannel && activeTeamRoomId === payload.roomId) {
      await activeTeamRoomChannel.send({
        type: 'broadcast',
        event: 'TEAM_SNIPPETS_UPDATED',
        payload,
      });
      return;
    }

    const tempCh = client.channel(`ghosti:room:${payload.roomId}`, {
      config: { broadcast: { self: false } },
    });
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      const timer = window.setTimeout(done, 1800);
      tempCh.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer);
          done();
        }
      });
    });
    await tempCh.send({
      type: 'broadcast',
      event: 'TEAM_SNIPPETS_UPDATED',
      payload,
    });
    void client.removeChannel(tempCh);
  } catch {
    /* ignore realtime broadcast failure — pull fallback still persists */
  }
}

export function subscribeWorkTeamSnippetsRealtime(
  roomId: string,
  onUpdated?: (result: TeamSnippetsSyncResult) => void
): () => void {
  const cleanRoomId = roomId.trim();
  if (!cleanRoomId || typeof window === 'undefined') return () => {};

  let disposed = false;
  let localChannel: RealtimeChannel | null = null;
  const myDeviceId = getThisDeviceIdentity().deviceId;

  void (async () => {
    await ensureGhostiPublicSupabaseClient();
    if (disposed) return;
    const client = getGhostiAuthedSupabase() || supabase;
    if (!client) return;

    if (activeTeamRoomChannel && activeTeamRoomId && activeTeamRoomId !== cleanRoomId) {
      try {
        void client.removeChannel(activeTeamRoomChannel);
      } catch {
        /* ignore */
      }
      activeTeamRoomChannel = null;
      activeTeamRoomId = '';
    }

    localChannel = client
      .channel(`ghosti:room:${cleanRoomId}`, {
        config: { broadcast: { self: false } },
      })
      .on('broadcast', { event: 'TEAM_SNIPPETS_UPDATED' }, (msg) => {
        if (disposed) return;
        const senderId = String(msg?.payload?.senderDeviceId || '');
        if (senderId && senderId === myDeviceId) return;
        void pullTeamSnippetsFromBridge(cleanRoomId).then((pulled) => {
          if (!disposed && pulled.ok) {
            onUpdated?.(pulled);
          }
        });
      })
      .subscribe();

    activeTeamRoomChannel = localChannel;
    activeTeamRoomId = cleanRoomId;
  })();

  return () => {
    disposed = true;
    if (localChannel) {
      const client = getGhostiAuthedSupabase() || supabase;
      if (client) {
        try {
          void client.removeChannel(localChannel);
        } catch {
          /* ignore */
        }
      }
      if (activeTeamRoomChannel === localChannel) {
        activeTeamRoomChannel = null;
        activeTeamRoomId = '';
      }
    }
  };
}
