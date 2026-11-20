import type { RealtimeChannel } from '@supabase/supabase-js';
import { ensureGhostiPublicSupabaseClient } from './supabaseClient';

export interface LivePhotoSyncPacket {
  roomId: string;
  active: boolean;
  photoIndex: number;
  totalPhotos: number;
  photoId?: string;
  photoName?: string;
  photoThumbUrl?: string;
  zoom: number;
  rotation: number;
  presenterClientId: string;
  presenterName: string;
  seq: number;
  updatedAt: number;
}

export interface LivePhotoSyncPeerSummary {
  connectedCount: number;
  peerNames: string[];
  channelStatus: 'connecting' | 'connected' | 'reconnecting';
}

export interface RoomLivePhotoSyncSession {
  sendState: (packet: LivePhotoSyncPacket) => void;
  requestCurrentState: () => void;
  stop: () => void;
}

const CLIENT_ID_SESSION_KEY = 'ghosti_live_sync_client_id_v1';
const LOCAL_LIVE_SYNC_BC_NAME = 'ghosti_live_photo_sync_bus_v2';
const PEER_TTL_MS = 45_000;
const HEARTBEAT_INTERVAL_MS = 18_000;

let cachedClientId = '';

export function getOrCreateLiveSyncClientId(): string {
  if (cachedClientId) return cachedClientId;
  if (typeof window !== 'undefined') {
    try {
      const existing = (sessionStorage.getItem(CLIENT_ID_SESSION_KEY) || '').trim();
      if (existing) {
        cachedClientId = existing;
        return cachedClientId;
      }
      const rand =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID().slice(0, 12)
          : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      cachedClientId = `sync_${rand}`;
      sessionStorage.setItem(CLIENT_ID_SESSION_KEY, cachedClientId);
      return cachedClientId;
    } catch {
      /* ignore sessionStorage restriction */
    }
  }
  cachedClientId = `sync_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return cachedClientId;
}

/**
 * 📡 [공유방 다 같이 보기 (RoomLivePhotoSync)] 단일 SSOT 실시간 세션 엔진
 * - 로그인 방장 · 초대받은 타 계정 · 비로그인 카톡 초대 링크 게스트 · PC 웹 · 모바일 앱 모두
 *   동일 `roomId`의 공용 Realtime Broadcast + Presence 채널(`ghosti:live-sync:<roomId>`)로 0.05초 직결됩니다.
 * - 한쪽만 [📡 다 같이 보기]를 켜도 같은 방에 있는 다른 기기·계정 화면에 즉시 싱크 ON 전파되며,
 *   뒤늦게 입장한 멤버도 `PHOTO_SYNC_HELLO` 핸드셰이크로 현재 발표자의 사진·배율을 0.1초 만에 자동 수신합니다.
 */
export function startRoomLivePhotoSyncSession(options: {
  roomId: string;
  clientId: string;
  getSelfName: () => string;
  getActivePresenterSnapshot: () => LivePhotoSyncPacket | null;
  onRemoteSyncState: (packet: LivePhotoSyncPacket) => void;
  onPeersChanged: (summary: LivePhotoSyncPeerSummary) => void;
}): RoomLivePhotoSyncSession {
  const cleanRoomId = (options.roomId || '').trim();
  const selfClientId = options.clientId;
  let stopped = false;
  let activeChannel: RealtimeChannel | null = null;
  let activeClientRef: Awaited<ReturnType<typeof ensureGhostiPublicSupabaseClient>> = null;
  let channelReady = false;
  let channelStatus: 'connecting' | 'connected' | 'reconnecting' = 'connecting';
  let pendingStatePacket: LivePhotoSyncPacket | null = null;
  let reconnectTimer: number | null = null;
  let subscribeWatchdogTimer: number | null = null;
  let heartbeatTimer: number | null = null;
  let localBc: BroadcastChannel | null = null;

  const remotePeers = new Map<string, { name: string; lastSeenAt: number }>();
  const presencePeers = new Map<string, string>();

  const emitPeersSummary = () => {
    if (stopped) return;
    const now = Date.now();
    for (const [pid, meta] of remotePeers.entries()) {
      if (now - meta.lastSeenAt > PEER_TTL_MS) {
        remotePeers.delete(pid);
      }
    }
    const merged = new Map<string, string>();
    merged.set(selfClientId, options.getSelfName() || '나');
    for (const [pid, name] of presencePeers.entries()) {
      if (pid && pid !== selfClientId) merged.set(pid, name || '멤버');
    }
    for (const [pid, meta] of remotePeers.entries()) {
      if (pid && pid !== selfClientId) merged.set(pid, meta.name || '멤버');
    }
    options.onPeersChanged({
      connectedCount: merged.size,
      peerNames: Array.from(merged.values()),
      channelStatus,
    });
  };

  const rememberPeer = (peerId?: string, peerName?: string) => {
    const pid = (peerId || '').trim();
    if (!pid || pid === selfClientId) return;
    remotePeers.set(pid, {
      name: (peerName || '').trim() || remotePeers.get(pid)?.name || '멤버',
      lastSeenAt: Date.now(),
    });
    emitPeersSummary();
  };

  const postLocalBc = (event: string, payload: Record<string, unknown>) => {
    try {
      if (localBc) {
        localBc.postMessage({
          roomId: cleanRoomId,
          senderClientId: selfClientId,
          event,
          payload,
        });
      }
    } catch {
      /* ignore BroadcastChannel error */
    }
  };

  const sendRealtimeEvent = (event: string, payload: Record<string, unknown>) => {
    postLocalBc(event, payload);
    if (!activeChannel || !channelReady) {
      if (event === 'PHOTO_SYNC_STATE') {
        pendingStatePacket = payload as unknown as LivePhotoSyncPacket;
      }
      return;
    }
    void activeChannel
      .send({
        type: 'broadcast',
        event,
        payload,
      })
      .catch(() => {
        /* reconnect watchdog handles transient drops */
      });
  };

  const handleIncomingPacket = (event: string, rawPayload: unknown) => {
    if (stopped || !rawPayload || typeof rawPayload !== 'object') return;
    const p = rawPayload as Record<string, unknown>;
    if (String(p.roomId || '').trim() !== cleanRoomId) return;

    if (event === 'PHOTO_SYNC_STATE') {
      const pkt = p as unknown as LivePhotoSyncPacket;
      if (!pkt.presenterClientId || pkt.presenterClientId === selfClientId) return;
      rememberPeer(pkt.presenterClientId, pkt.presenterName);
      options.onRemoteSyncState(pkt);
      return;
    }

    if (event === 'PHOTO_SYNC_HELLO') {
      const senderId = String(p.clientId || '').trim();
      const senderName = String(p.name || '').trim();
      if (!senderId || senderId === selfClientId) return;
      rememberPeer(senderId, senderName);
      sendRealtimeEvent('PHOTO_SYNC_PEER_ACK', {
        roomId: cleanRoomId,
        clientId: selfClientId,
        name: options.getSelfName(),
        ts: Date.now(),
      });
      // 내가 현재 발표자로 리드 중이라면 방금 들어온 멤버에게 최신 상태를 즉시 전달
      const activeSnap = options.getActivePresenterSnapshot();
      if (activeSnap && activeSnap.active && activeSnap.presenterClientId === selfClientId) {
        sendRealtimeEvent('PHOTO_SYNC_STATE', {
          ...activeSnap,
          roomId: cleanRoomId,
        });
      }
      return;
    }

    if (event === 'PHOTO_SYNC_PEER_ACK') {
      const senderId = String(p.clientId || '').trim();
      const senderName = String(p.name || '').trim();
      if (!senderId || senderId === selfClientId) return;
      rememberPeer(senderId, senderName);
      return;
    }

    if (event === 'PHOTO_SYNC_BYE') {
      const senderId = String(p.clientId || '').trim();
      if (senderId && senderId !== selfClientId) {
        remotePeers.delete(senderId);
        presencePeers.delete(senderId);
        emitPeersSummary();
      }
    }
  };

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      localBc = new BroadcastChannel(LOCAL_LIVE_SYNC_BC_NAME);
      localBc.onmessage = (ev) => {
        const data = ev.data as {
          roomId?: string;
          senderClientId?: string;
          event?: string;
          payload?: unknown;
        };
        if (!data || data.roomId !== cleanRoomId || data.senderClientId === selfClientId) return;
        if (data.event) {
          handleIncomingPacket(data.event, data.payload);
        }
      };
    }
  } catch {
    localBc = null;
  }

  const teardownChannel = () => {
    if (subscribeWatchdogTimer !== null) {
      window.clearTimeout(subscribeWatchdogTimer);
      subscribeWatchdogTimer = null;
    }
    if (activeChannel && activeClientRef) {
      try {
        void activeClientRef.removeChannel(activeChannel);
      } catch {
        /* ignore */
      }
    }
    activeChannel = null;
    channelReady = false;
  };

  const scheduleReconnect = (delayMs = 1400) => {
    if (stopped) return;
    if (reconnectTimer !== null) return;
    channelStatus = 'reconnecting';
    emitPeersSummary();
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      if (!stopped) {
        void connectRealtime();
      }
    }, delayMs);
  };

  const connectRealtime = async () => {
    if (stopped || !cleanRoomId) return;
    teardownChannel();
    channelStatus = 'connecting';
    emitPeersSummary();

    const sb = await ensureGhostiPublicSupabaseClient();
    if (stopped) return;
    if (!sb) {
      scheduleReconnect(2500);
      return;
    }
    activeClientRef = sb;
    const topic = `ghosti:live-sync:${cleanRoomId}`;
    const ch = sb.channel(topic, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: selfClientId },
      },
    });
    activeChannel = ch;

    const syncPresenceFromChannel = () => {
      if (stopped || activeChannel !== ch) return;
      try {
        const state = ch.presenceState<Record<string, unknown>>();
        presencePeers.clear();
        for (const [key, metas] of Object.entries(state || {})) {
          if (!key || key === selfClientId) continue;
          const first = Array.isArray(metas) && metas.length > 0 ? metas[0] : null;
          const nm =
            first && typeof first === 'object' && typeof first.name === 'string'
              ? first.name
              : '멤버';
          presencePeers.set(key, nm);
        }
        emitPeersSummary();
      } catch {
        /* ignore presence parse error */
      }
    };

    ch.on('broadcast', { event: 'PHOTO_SYNC_STATE' }, ({ payload }) => {
      handleIncomingPacket('PHOTO_SYNC_STATE', payload);
    })
      .on('broadcast', { event: 'PHOTO_SYNC_HELLO' }, ({ payload }) => {
        handleIncomingPacket('PHOTO_SYNC_HELLO', payload);
      })
      .on('broadcast', { event: 'PHOTO_SYNC_PEER_ACK' }, ({ payload }) => {
        handleIncomingPacket('PHOTO_SYNC_PEER_ACK', payload);
      })
      .on('broadcast', { event: 'PHOTO_SYNC_BYE' }, ({ payload }) => {
        handleIncomingPacket('PHOTO_SYNC_BYE', payload);
      })
      .on('presence', { event: 'sync' }, syncPresenceFromChannel)
      .on('presence', { event: 'join' }, syncPresenceFromChannel)
      .on('presence', { event: 'leave' }, syncPresenceFromChannel)
      .subscribe((status) => {
        if (stopped || activeChannel !== ch) return;
        if (status === 'SUBSCRIBED') {
          if (subscribeWatchdogTimer !== null) {
            window.clearTimeout(subscribeWatchdogTimer);
            subscribeWatchdogTimer = null;
          }
          channelReady = true;
          channelStatus = 'connected';
          emitPeersSummary();
          void ch
            .track({
              clientId: selfClientId,
              name: options.getSelfName(),
              joinedAt: Date.now(),
            })
            .catch(() => {});
          // 1) 방에 이미 리드 중인 발표자가 있는지 묻고, 내 접속을 알림
          sendRealtimeEvent('PHOTO_SYNC_HELLO', {
            roomId: cleanRoomId,
            clientId: selfClientId,
            name: options.getSelfName(),
            ts: Date.now(),
          });
          // 2) 구독 전에 대기 중이던 발표 상태가 있으면 즉시 송출
          if (pendingStatePacket && pendingStatePacket.roomId === cleanRoomId) {
            const toFlush = pendingStatePacket;
            pendingStatePacket = null;
            sendRealtimeEvent('PHOTO_SYNC_STATE', toFlush as unknown as Record<string, unknown>);
          } else {
            const activeSnap = options.getActivePresenterSnapshot();
            if (activeSnap && activeSnap.active && activeSnap.presenterClientId === selfClientId) {
              sendRealtimeEvent('PHOTO_SYNC_STATE', {
                ...activeSnap,
                roomId: cleanRoomId,
              });
            }
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          channelReady = false;
          scheduleReconnect(1500);
        }
      });

    subscribeWatchdogTimer = window.setTimeout(() => {
      if (!stopped && activeChannel === ch && !channelReady) {
        scheduleReconnect(1200);
      }
    }, 5500);
  };

  const onVisibilityOrOnline = () => {
    if (stopped) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (!channelReady) {
      void connectRealtime();
    } else {
      sendRealtimeEvent('PHOTO_SYNC_HELLO', {
        roomId: cleanRoomId,
        clientId: selfClientId,
        name: options.getSelfName(),
        ts: Date.now(),
      });
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', onVisibilityOrOnline);
    document.addEventListener('visibilitychange', onVisibilityOrOnline);
    heartbeatTimer = window.setInterval(() => {
      if (stopped) return;
      emitPeersSummary();
      if (channelReady) {
        sendRealtimeEvent('PHOTO_SYNC_PEER_ACK', {
          roomId: cleanRoomId,
          clientId: selfClientId,
          name: options.getSelfName(),
          ts: Date.now(),
        });
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  emitPeersSummary();
  void connectRealtime();

  return {
    sendState: (packet: LivePhotoSyncPacket) => {
      if (stopped) return;
      const scoped: LivePhotoSyncPacket = {
        ...packet,
        roomId: cleanRoomId,
      };
      sendRealtimeEvent('PHOTO_SYNC_STATE', scoped as unknown as Record<string, unknown>);
    },
    requestCurrentState: () => {
      if (stopped) return;
      sendRealtimeEvent('PHOTO_SYNC_HELLO', {
        roomId: cleanRoomId,
        clientId: selfClientId,
        name: options.getSelfName(),
        ts: Date.now(),
      });
    },
    stop: () => {
      if (stopped) return;
      if (channelReady && activeChannel) {
        sendRealtimeEvent('PHOTO_SYNC_BYE', {
          roomId: cleanRoomId,
          clientId: selfClientId,
        });
      }
      stopped = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (heartbeatTimer !== null) {
        window.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onVisibilityOrOnline);
        document.removeEventListener('visibilitychange', onVisibilityOrOnline);
      }
      teardownChannel();
      if (localBc) {
        try {
          localBc.close();
        } catch {
          /* ignore */
        }
        localBc = null;
      }
    },
  };
}
