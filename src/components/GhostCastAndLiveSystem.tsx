import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import {
  filterVisibleGalleryPhotos,
  resolveLoungePhotoCorpus,
} from '../store/slices/storeSharedRefs';
import {
  broadcastRemoteMonitorCast,
  getThisDeviceIdentity,
  startDeviceIntegrationRealtimeRuntime,
  tryMakeCompactThumbDataUrl,
  type RemoteMonitorCastPacket,
} from '../services/deviceIntegrationService';
import {
  getOrCreateLiveSyncClientId,
  startRoomLivePhotoSyncSession,
  type LivePhotoSyncPacket,
  type LivePhotoSyncPeerSummary,
  type RoomLivePhotoSyncSession,
} from '../services/roomLivePhotoSyncService';
import { resolveAccountScopedNickname } from '../services/ghostSecretaryEngine';
import { hasAuthenticatedHubAccountSession } from '../services/supabaseClient';
import type { PhotoItem, PricingPlanId } from '../types/saysee';

export interface MonitorCastState {
  active: boolean;
  photoIndex: number;
  zoom: number;
  rotation: number;
  isPlaying: boolean;
  updatedAt: number;
  senderDevice: string;
}

export interface RoomLivePhotoSyncState {
  active: boolean;
  roomId: string;
  photoIndex: number;
  totalPhotos: number;
  photoId?: string;
  photoName?: string;
  remotePhotoThumbUrl?: string;
  zoom: number;
  rotation: number;
  presenterClientId: string;
  presenterName: string;
  seq: number;
  updatedAt: number;
}

interface PhotoSyncToolbarStatusDetail {
  active: boolean;
  isPresenter?: boolean;
  presenterName?: string;
  remoteOngoing?: boolean;
  connectedCount?: number;
}

const CAST_STORAGE_KEY = 'ghosti_monitor_cast_state_v1';
const BROADCAST_CHANNEL_NAME = 'ghosti_cast_live_bus_v1';

export function dispatchGhostCastLiveCommand(detail: {
  action: 'OPEN_MONITOR_CAST' | 'CLOSE_MONITOR_CAST' | 'TOGGLE_PHOTO_SYNC';
  photoId?: string;
}): void {
  window.dispatchEvent(new CustomEvent('ghosti_cast_live_command', { detail }));
}

function broadcastCastLiveMessage(payload: Record<string, unknown>): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      ch.postMessage(payload);
      ch.close();
    }
  } catch {}
  try {
    if (payload.type === 'MONITOR_CAST_UPDATE' && payload.state) {
      localStorage.setItem(CAST_STORAGE_KEY, JSON.stringify(payload.state));
    }
  } catch {}
}

function dispatchPhotoSyncToolbarStatus(detail: PhotoSyncToolbarStatusDetail): void {
  window.dispatchEvent(new CustomEvent('ghosti_photo_sync_status', { detail }));
}

/**
 * 📡 라운지 상단 『고스트 캐스트 & 라이브 싱크』 2대 알짜 무기 컨트롤 바
 * - [무기 1] 💻 모니터로 크게 보기: 스마트폰 무선 리모컨 ➔ 내 PC/노트북 모니터 0.5초 전체화면 클린 팝업 (카톡·사생활 알림 노출 0%, 화질 저하 0%)
 * - [무기 2] 📡 다 같이 보기 (앨범 싱크): 사진 공유방에서 발표자가 넘기거나 확대한 사진 화면이 방 멤버 전원에게 0.1초 만에 똑같이 동기화 (발열·트래픽 부담 0%)
 */
export const GhostCastLiveToolbar: React.FC<{ loungeLabel?: string }> = () => {
  const { activeLoungeType } = useSaySeeStore();
  const [syncToolbarStatus, setSyncToolbarStatus] = useState<PhotoSyncToolbarStatusDetail>({
    active: false,
  });

  useEffect(() => {
    const onSyncState = (e: Event) => {
      const ce = e as CustomEvent<PhotoSyncToolbarStatusDetail>;
      if (typeof ce.detail?.active === 'boolean') {
        setSyncToolbarStatus(ce.detail);
      }
    };
    window.addEventListener('ghosti_photo_sync_status', onSyncState);
    return () => {
      window.removeEventListener('ghosti_photo_sync_status', onSyncState);
    };
  }, []);

  if (activeLoungeType === 'work') return null;

  // 1) '내 기기(personal)'에서는 [💻 모니터로 크게 보기] 버튼만 심플하게 노출
  if (activeLoungeType === 'personal') {
    return (
      <div className="w-full flex items-center justify-end">
        <button
          type="button"
          onClick={() => dispatchGhostCastLiveCommand({ action: 'OPEN_MONITOR_CAST' })}
          className="px-3 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-cyan-400/40 text-cyan-300 text-[11.5px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <span>💻 모니터로 크게 보기</span>
        </button>
      </div>
    );
  }

  const photoSyncActive = syncToolbarStatus.active;
  const syncButtonLabel = photoSyncActive
    ? syncToolbarStatus.isPresenter
      ? '📡 다 같이 보기 (싱크 ON · 리드 중)'
      : '📡 다 같이 보기 (싱크 ON · 참여 중)'
    : syncToolbarStatus.remoteOngoing
    ? `📡 다 같이 보기 (${syncToolbarStatus.presenterName || '멤버'}님 진행 중 · 참여)`
    : '📡 다 같이 보기';

  // 2) '사진 공유방(패밀리 / 동호회·동창회)'에서는 [💻 모니터로 크게 보기] + [📡 다 같이 보기] 버튼만 깔끔하게 노출
  return (
    <div className="w-full flex flex-wrap items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={() => dispatchGhostCastLiveCommand({ action: 'OPEN_MONITOR_CAST' })}
        className="px-3 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-cyan-400/40 text-cyan-300 text-[11.5px] font-bold flex items-center gap-1 transition-all cursor-pointer"
      >
        <span>💻 모니터로 크게 보기</span>
      </button>

      <button
        type="button"
        onClick={() => dispatchGhostCastLiveCommand({ action: 'TOGGLE_PHOTO_SYNC' })}
        className={`px-3 py-1 rounded-xl border text-[11.5px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
          photoSyncActive
            ? 'bg-emerald-400 text-zinc-950 border-emerald-300'
            : syncToolbarStatus.remoteOngoing
            ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400 text-emerald-200'
            : 'bg-zinc-900 hover:bg-zinc-800 border-emerald-400/40 text-emerald-300'
        }`}
      >
        <span>{syncButtonLabel}</span>
      </button>
    </div>
  );
};

/**
 * 🌐 글로벌 『고스트 모니터 캐스트 (무선 리모컨)』 & 『다 같이 보기 (앨범 라이브 싱크)』 통합 오버레이
 */
export const GhostCastAndLiveGlobalOverlay: React.FC = () => {
  const {
    photos,
    sharedRoomHostPhotos,
    sharedRoomAddedPhotos,
    merlinAuth,
    isGuestPreviewMode,
    triggerGuestJoinWall,
    activeLoungeType,
    activeFamilyRoom,
    activeSharedRoomId,
    activeJoinedRoomMeta,
    alumniBannerTitle,
    alumniSchoolName,
    setDeviceIntegrationSnapshot,
    showToast,
  } = useSaySeeStore();

  const isAuthenticatedLiveSyncMember = useMemo(() => {
    const email = (merlinAuth?.email || '').trim();
    const uid = (merlinAuth?.userId || '').trim();
    return Boolean(
      !isGuestPreviewMode &&
        email &&
        uid &&
        uid !== 'guest' &&
        hasAuthenticatedHubAccountSession()
    );
  }, [isGuestPreviewMode, merlinAuth?.email, merlinAuth?.userId]);

  // [공유방 1:1 단일 SSOT]: 개인 라운지는 내 기기 사진, 사진 공유방(내 방·초대받은 방·게스트 초대방)은
  // 반드시 현재 열려 있는 단일 room_id의 공유 사진 전체(sharedRoomAddedPhotos/sharedRoomHostPhotos)를 표시합니다.
  const activePhotos = useMemo(() => {
    const scoped = resolveLoungePhotoCorpus({
      activeLoungeType,
      activeFamilyRoom,
      activeSharedRoomId,
      photos,
      sharedRoomHostPhotos,
      sharedRoomAddedPhotos,
    });
    return filterVisibleGalleryPhotos(scoped);
  }, [
    activeLoungeType,
    activeFamilyRoom,
    activeSharedRoomId,
    photos,
    sharedRoomHostPhotos,
    sharedRoomAddedPhotos,
  ]);

  // 1) 무기 1: 모니터로 크게 보기 & 스마트폰 무선 리모컨 상태
  const [monitorCastOpen, setMonitorCastOpen] = useState(false);
  const [remoteCastPhotoOverride, setRemoteCastPhotoOverride] = useState<PhotoItem | null>(null);
  const [monitorViewMode, setMonitorViewMode] = useState<
    'split_demo' | 'fullscreen_monitor' | 'phone_remote'
  >('split_demo');
  const [castState, setCastState] = useState<MonitorCastState>({
    active: false,
    photoIndex: 0,
    zoom: 1,
    rotation: 0,
    isPlaying: false,
    updatedAt: Date.now(),
    senderDevice: '내 스마트폰 리모컨',
  });

  // 2) 무기 2: 다 같이 사진 보기 (앨범 라이브 싱크) — 공용 Supabase Realtime 단일 SSOT 상태
  const mySyncClientId = useMemo(() => getOrCreateLiveSyncClientId(), []);
  const effectiveLiveSyncRoomId = useMemo(() => {
    if (activeLoungeType === 'personal' || activeLoungeType === 'work') return '';
    const explicit = (activeJoinedRoomMeta?.roomId || activeSharedRoomId || '').trim();
    if (explicit) return explicit;
    const fromPhotos = activePhotos
      .find((p) => (p.sharedRoomId || '').trim())
      ?.sharedRoomId?.trim();
    return fromPhotos || '';
  }, [activeLoungeType, activeJoinedRoomMeta?.roomId, activeSharedRoomId, activePhotos]);

  const mySyncDisplayName = useMemo(() => {
    const email = (merlinAuth?.email || '').trim().toLowerCase();
    const emailPrefix = email.split('@')[0]?.trim() || '';
    const isLoggedIn = Boolean(emailPrefix && merlinAuth?.userId && merlinAuth.userId !== 'guest');
    if (isLoggedIn) {
      const scopedNick = resolveAccountScopedNickname(email, '').trim();
      if (scopedNick && scopedNick !== '게스트' && scopedNick !== '방장') {
        return scopedNick;
      }
      return emailPrefix;
    }
    return activeJoinedRoomMeta ? '초대 게스트' : '게스트';
  }, [merlinAuth?.email, merlinAuth?.userId, activeJoinedRoomMeta]);

  const [photoSyncState, setPhotoSyncState] = useState<RoomLivePhotoSyncState>({
    active: false,
    roomId: '',
    photoIndex: 0,
    totalPhotos: 0,
    zoom: 1,
    rotation: 0,
    presenterClientId: '',
    presenterName: '',
    seq: 0,
    updatedAt: 0,
  });
  const [remoteOngoingSession, setRemoteOngoingSession] = useState<LivePhotoSyncPacket | null>(
    null
  );
  const [liveSyncPeers, setLiveSyncPeers] = useState<LivePhotoSyncPeerSummary>({
    connectedCount: 1,
    peerNames: [],
    channelStatus: 'connecting',
  });

  const liveSyncSessionRef = useRef<RoomLivePhotoSyncSession | null>(null);
  const syncSeqRef = useRef<number>(0);
  const photoSyncStateRef = useRef<RoomLivePhotoSyncState>(photoSyncState);
  photoSyncStateRef.current = photoSyncState;
  const mySyncDisplayNameRef = useRef<string>(mySyncDisplayName);
  mySyncDisplayNameRef.current = mySyncDisplayName;
  const activePhotosRef = useRef<PhotoItem[]>(activePhotos);
  activePhotosRef.current = activePhotos;
  const remoteOngoingRef = useRef<LivePhotoSyncPacket | null>(remoteOngoingSession);
  remoteOngoingRef.current = remoteOngoingSession;
  const pendingPublishAfterRoomIdRef = useRef<boolean>(false);

  const buildPhotoSyncPacketFromState = (
    st: RoomLivePhotoSyncState,
    roomId: string,
    targetPhoto?: PhotoItem | null
  ): LivePhotoSyncPacket => {
    const list = activePhotosRef.current;
    const p = targetPhoto || list[st.photoIndex] || list[0] || null;
    const rawThumb = (p?.thumbUrl || p?.fullUrl || '').trim();
    const thumb =
      rawThumb && rawThumb.startsWith('data:image/') && rawThumb.length <= 96000
        ? rawThumb
        : rawThumb && rawThumb.startsWith('https://')
        ? rawThumb
        : undefined;
    return {
      roomId,
      active: st.active,
      photoIndex: st.photoIndex,
      totalPhotos: Math.max(list.length, st.totalPhotos || 0),
      photoId: st.photoId || p?.id,
      photoName: st.photoName || p?.name,
      photoThumbUrl: thumb,
      zoom: st.zoom || 1,
      rotation: st.rotation || 0,
      presenterClientId: st.presenterClientId || mySyncClientId,
      presenterName: st.presenterName || mySyncDisplayNameRef.current || '멤버',
      seq: st.seq || ++syncSeqRef.current,
      updatedAt: st.updatedAt || Date.now(),
    };
  };

  const publishLivePhotoSyncState = (next: RoomLivePhotoSyncState, targetPhoto?: PhotoItem | null) => {
    const rid = (next.roomId || effectiveLiveSyncRoomId || '').trim();
    if (!rid || !liveSyncSessionRef.current) {
      if (next.active) {
        pendingPublishAfterRoomIdRef.current = true;
      }
      return;
    }
    pendingPublishAfterRoomIdRef.current = false;
    const pkt = buildPhotoSyncPacketFromState(next, rid, targetPhoto);
    liveSyncSessionRef.current.sendState(pkt);
  };

  const emitRemoteCastPacket = (nextState: MonitorCastState, targetPhoto?: PhotoItem | null) => {
    const p = targetPhoto || activePhotos[nextState.photoIndex] || activePhotos[0] || null;
    const directThumb =
      p?.thumbUrl && p.thumbUrl.startsWith('data:image/') && p.thumbUrl.length <= 48000
        ? p.thumbUrl
        : p?.thumbUrl && p.thumbUrl.startsWith('https://')
        ? p.thumbUrl
        : undefined;
    const basePacket = {
      ...nextState,
      senderDevice: getThisDeviceIdentity().displayName,
      photoId: p?.id,
      photoTitle: p?.name,
      photoThumbUrl: directThumb,
    };
    broadcastRemoteMonitorCast(basePacket);
    if (!directThumb && p && (p.thumbUrl || p.fullUrl) && nextState.active) {
      void tryMakeCompactThumbDataUrl(p.thumbUrl || p.fullUrl).then((compactThumb) => {
        if (compactThumb) {
          broadcastRemoteMonitorCast({
            ...basePacket,
            photoThumbUrl: compactThumb,
            updatedAt: Date.now(),
          });
        }
      });
    }
  };

  // [전역 5번 내 기기 통합 실시간 엔진]: 기기 바인딩 하트비트 · E2EE 클립보드(PC Ctrl+C ↔ 폰) · 무선 리모컨 · 0.2초 공간이동 수신
  useEffect(() => {
    if (!merlinAuth?.email || !merlinAuth?.userId || merlinAuth.userId === 'guest') {
      return undefined;
    }
    const stopRuntime = startDeviceIntegrationRealtimeRuntime({
      email: merlinAuth.email,
      userId: merlinAuth.userId,
      onDevicesUpdated: ({ devices, pairingCode, entitlement, revokedSelf }) => {
        setDeviceIntegrationSnapshot({ devices, pairingCode, entitlement, revokedSelf });
        if (
          entitlement?.isPaidUnlimited &&
          (entitlement.planId === 'personal_sub_3900' ||
            entitlement.planId === 'personal_year_35000')
        ) {
          const cur = useSaySeeStore.getState();
          if (cur.subscribedLounges.personal !== entitlement.planId) {
            useSaySeeStore.setState({
              subscribedLounges: {
                ...cur.subscribedLounges,
                personal: entitlement.planId as PricingPlanId,
              },
            });
          }
        }
      },
      onPairingCompleted: ({ ok, alreadyPaired, deviceCount, reason }) => {
        if (ok) {
          useSaySeeStore.setState({
            lastQuarantineToast: alreadyPaired
              ? `✅ 이미 연결된 기기입니다! 최신 연결 상태를 확인했습니다 (연결된 내 기기 ${deviceCount}대)`
              : `🎉 QR·6자리 보안 연결 완료! 내 PC와 스마트폰이 직결되었습니다 (연결된 내 기기 ${deviceCount}대)`,
          });
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ghosti_open_device_sync_section'));
          }
        } else {
          useSaySeeStore.setState({
            lastQuarantineToast:
              reason === 'AUTH_REQUIRED'
                ? '🔑 먼저 PC와 같은 이메일로 로그인하면 QR 연결이 바로 완료됩니다.'
                : '⚠️ QR 연결 번호가 만료되었거나 다른 계정 번호입니다. PC 화면의 최신 QR·6자리 번호를 다시 스캔해 주세요.',
          });
        }
      },
      onSelfRevoked: () => {
        useSaySeeStore.setState({
          lastQuarantineToast:
            '🔌 다른 기기에서 이 기기의 연결이 해제되었습니다. 다시 연결하려면 QR 스캔 또는 [이 기기 다시 연결]을 눌러 주세요.',
        });
      },
      onTeleportReceived: ({ fileName, sourceDevice }) => {
        useSaySeeStore.setState({
          lastQuarantineToast: `⚡ [${sourceDevice} ➔ PC전송 도착] '${fileName}' 글자·정보가 PC 귀신창(Ctrl+0)과 클립보드에 장전되었습니다! 메모장에서 Ctrl+0 또는 Ctrl+V를 눌러 바로 확인하세요.`,
        });
      },
      onIncomingClip: (clip, meta) => {
        setDeviceIntegrationSnapshot({ incomingClip: clip });
        useSaySeeStore.setState({
          lastQuarantineToast: meta?.isLocalAutoCapture
            ? '📋 방금 복사한 텍스트가 연결된 내 기기로 자동 암호화 전송되었습니다!'
            : `📋 [${clip.senderName}]에서 암호화 클립보드가 도착했습니다! 바로 붙여넣기 하세요.`,
        });
      },
      onClipsSynced: (clips) => {
        const cur = useSaySeeStore.getState().syncedClipboardItems;
        if (
          clips.length !== cur.length ||
          clips[0]?.clipHash !== cur[0]?.clipHash ||
          clips[0]?.createdAt !== cur[0]?.createdAt
        ) {
          setDeviceIntegrationSnapshot({ syncedClips: clips });
        }
      },
      onRemoteMonitorCast: (pkt: RemoteMonitorCastPacket) => {
        setCastState({
          active: pkt.active,
          photoIndex: pkt.photoIndex,
          zoom: pkt.zoom || 1,
          rotation: pkt.rotation || 0,
          isPlaying: Boolean(pkt.isPlaying),
          updatedAt: pkt.updatedAt || Date.now(),
          senderDevice: pkt.senderDevice || '내 스마트폰 리모컨',
        });
        if (pkt.active) {
          setMonitorViewMode('fullscreen_monitor');
          setMonitorCastOpen(true);
          if (pkt.photoThumbUrl) {
            setRemoteCastPhotoOverride({
              id: pkt.photoId || 'remote-cast-photo',
              name: pkt.photoTitle || '스마트폰 무선 전송 사진',
              size: 512000,
              date: '실시간 캐스트',
              mtimeMs: Date.now(),
              locationKo: pkt.senderDevice || '내 스마트폰',
              tags: ['모니터 캐스트'],
              captionKo: '',
              thumbUrl: pkt.photoThumbUrl,
              fullUrl: pkt.photoThumbUrl,
              bookmarked: false,
              quarantined: false,
            });
          } else {
            setRemoteCastPhotoOverride(null);
          }
        } else {
          setMonitorCastOpen(false);
          setRemoteCastPhotoOverride(null);
        }
      },
    });
    return () => {
      stopRuntime();
    };
  }, [merlinAuth?.email, merlinAuth?.userId, setDeviceIntegrationSnapshot]);

  // 슬라이드쇼 자동 재생 타이머 (모니터 캐스트)
  useEffect(() => {
    if (!monitorCastOpen || !castState.isPlaying || activePhotos.length <= 1) return;
    const timer = window.setInterval(() => {
      setCastState((prev) => {
        const nextIdx = (prev.photoIndex + 1) % activePhotos.length;
        const next = { ...prev, photoIndex: nextIdx, updatedAt: Date.now() };
        broadcastCastLiveMessage({ type: 'MONITOR_CAST_UPDATE', state: next });
        emitRemoteCastPacket(next, activePhotos[nextIdx]);
        return next;
      });
    }, 3200);
    return () => clearInterval(timer);
  }, [monitorCastOpen, castState.isPlaying, activePhotos.length]);

  // BroadcastChannel & Storage 이벤트 수신 (모니터 캐스트 동일 브라우저 멀티탭 즉시 연동)
  useEffect(() => {
    let ch: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        ch = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        ch.onmessage = (ev) => {
          const data = ev.data as { type?: string; state?: unknown };
          if (data?.type === 'MONITOR_CAST_UPDATE' && data.state) {
            const st = data.state as MonitorCastState;
            setCastState(st);
            if (st.active) setMonitorCastOpen(true);
            else setMonitorCastOpen(false);
          }
        };
      }
    } catch {}

    const onStorage = (e: StorageEvent) => {
      try {
        if (e.key === CAST_STORAGE_KEY && e.newValue) {
          const st = JSON.parse(e.newValue) as MonitorCastState;
          setCastState(st);
          setMonitorCastOpen(st.active);
        }
      } catch {}
    };

    window.addEventListener('storage', onStorage);
    return () => {
      if (ch) ch.close();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // [단일 SSOT 실시간 앨범 라이브 싱크 — 로그인 정식 방 멤버 전용]:
  // 비로그인 초대 링크 구경(게스트)은 실시간 동기화 채널에 연결하지 않으며, 버튼 클릭 시 로그인 전환 기회(Auth-Wall)로 안내합니다.
  useEffect(() => {
    if (!effectiveLiveSyncRoomId || !isAuthenticatedLiveSyncMember) {
      liveSyncSessionRef.current = null;
      setRemoteOngoingSession(null);
      setLiveSyncPeers({ connectedCount: 1, peerNames: [], channelStatus: 'connecting' });
      if (!isAuthenticatedLiveSyncMember && photoSyncStateRef.current.active) {
        setPhotoSyncState((prev) => ({ ...prev, active: false }));
      }
      return undefined;
    }

    const session = startRoomLivePhotoSyncSession({
      roomId: effectiveLiveSyncRoomId,
      clientId: mySyncClientId,
      getSelfName: () => mySyncDisplayNameRef.current || '멤버',
      getActivePresenterSnapshot: () => {
        const cur = photoSyncStateRef.current;
        if (
          cur.active &&
          cur.presenterClientId === mySyncClientId &&
          (!cur.roomId || cur.roomId === effectiveLiveSyncRoomId)
        ) {
          return buildPhotoSyncPacketFromState(cur, effectiveLiveSyncRoomId);
        }
        return null;
      },
      onPeersChanged: (summary) => {
        setLiveSyncPeers(summary);
      },
      onRemoteSyncState: (pkt) => {
        if (pkt.roomId !== effectiveLiveSyncRoomId) return;
        const cur = photoSyncStateRef.current;

        if (!pkt.active) {
          setRemoteOngoingSession((prev) =>
            prev?.presenterClientId === pkt.presenterClientId ? null : prev
          );
          if (cur.active && cur.presenterClientId === pkt.presenterClientId) {
            setPhotoSyncState((prev) => ({
              ...prev,
              active: false,
              updatedAt: pkt.updatedAt || Date.now(),
            }));
            showToast(`📡 ${pkt.presenterName}님이 다 같이 보기를 종료했습니다.`);
          }
          return;
        }

        if (
          cur.active &&
          cur.roomId === effectiveLiveSyncRoomId &&
          cur.presenterClientId === mySyncClientId &&
          cur.updatedAt > pkt.updatedAt
        ) {
          liveSyncSessionRef.current?.sendState(
            buildPhotoSyncPacketFromState(cur, effectiveLiveSyncRoomId)
          );
          return;
        }
        if (
          cur.active &&
          cur.roomId === effectiveLiveSyncRoomId &&
          cur.presenterClientId === mySyncClientId &&
          cur.updatedAt === pkt.updatedAt &&
          mySyncClientId < pkt.presenterClientId
        ) {
          return;
        }

        const list = activePhotosRef.current;
        let matchedIdx = pkt.photoIndex;
        if (pkt.photoId) {
          const byId = list.findIndex((p) => p.id === pkt.photoId);
          if (byId >= 0) matchedIdx = byId;
        } else if (pkt.photoName) {
          const byName = list.findIndex((p) => p.name === pkt.photoName);
          if (byName >= 0) matchedIdx = byName;
        }
        if (list.length > 0) {
          matchedIdx = Math.min(Math.max(0, matchedIdx), list.length - 1);
        } else {
          matchedIdx = Math.max(0, pkt.photoIndex || 0);
        }

        setRemoteOngoingSession(pkt);
        const wasInactive = !cur.active;
        const nextState: RoomLivePhotoSyncState = {
          active: true,
          roomId: effectiveLiveSyncRoomId,
          photoIndex: matchedIdx,
          totalPhotos: Math.max(list.length, pkt.totalPhotos || 0),
          photoId: pkt.photoId,
          photoName: pkt.photoName,
          remotePhotoThumbUrl: pkt.photoThumbUrl,
          zoom: pkt.zoom || 1,
          rotation: pkt.rotation || 0,
          presenterClientId: pkt.presenterClientId,
          presenterName: pkt.presenterName || '멤버',
          seq: pkt.seq || 0,
          updatedAt: pkt.updatedAt || Date.now(),
        };
        setPhotoSyncState(nextState);
        if (wasInactive) {
          showToast(`📡 ${nextState.presenterName}님이 [다 같이 보기]를 시작해 화면이 자동 동기화되었습니다!`);
        }
      },
    });

    liveSyncSessionRef.current = session;

    if (
      pendingPublishAfterRoomIdRef.current &&
      photoSyncStateRef.current.active &&
      photoSyncStateRef.current.presenterClientId === mySyncClientId
    ) {
      pendingPublishAfterRoomIdRef.current = false;
      const updated = { ...photoSyncStateRef.current, roomId: effectiveLiveSyncRoomId };
      setPhotoSyncState(updated);
      session.sendState(buildPhotoSyncPacketFromState(updated, effectiveLiveSyncRoomId));
    }

    return () => {
      const cur = photoSyncStateRef.current;
      if (
        cur.active &&
        cur.presenterClientId === mySyncClientId &&
        cur.roomId === effectiveLiveSyncRoomId
      ) {
        session.sendState(
          buildPhotoSyncPacketFromState({ ...cur, active: false, updatedAt: Date.now() }, effectiveLiveSyncRoomId)
        );
      }
      session.stop();
      if (liveSyncSessionRef.current === session) {
        liveSyncSessionRef.current = null;
      }
    };
  }, [effectiveLiveSyncRoomId, isAuthenticatedLiveSyncMember, mySyncClientId, showToast]);

  // 툴바 상단 [📡 다 같이 보기] 버튼 상태 실시간 동기화
  useEffect(() => {
    const isPresenter =
      photoSyncState.active && photoSyncState.presenterClientId === mySyncClientId;
    const remoteOngoing = Boolean(
      !photoSyncState.active &&
        remoteOngoingSession?.active &&
        remoteOngoingSession.roomId === effectiveLiveSyncRoomId
    );
    dispatchPhotoSyncToolbarStatus({
      active: photoSyncState.active,
      isPresenter,
      presenterName: photoSyncState.active
        ? photoSyncState.presenterName
        : remoteOngoingSession?.presenterName,
      remoteOngoing,
      connectedCount: liveSyncPeers.connectedCount,
    });
  }, [
    photoSyncState.active,
    photoSyncState.presenterClientId,
    photoSyncState.presenterName,
    remoteOngoingSession,
    effectiveLiveSyncRoomId,
    mySyncClientId,
    liveSyncPeers.connectedCount,
  ]);

  // 방 전환 시 캐스트/라이브 싱크 인덱스를 안전하게 초기화하고 사진 개수 축소 시 범위 초과를 방지
  useEffect(() => {
    setCastState((prev) => ({ ...prev, photoIndex: 0, zoom: 1, rotation: 0 }));
    setRemoteOngoingSession(null);
    setPhotoSyncState((prev) => ({
      ...prev,
      active: false,
      roomId: effectiveLiveSyncRoomId,
      photoIndex: 0,
      zoom: 1,
      rotation: 0,
      remotePhotoThumbUrl: undefined,
    }));
  }, [activeLoungeType, activeFamilyRoom, activeSharedRoomId]);

  useEffect(() => {
    const maxIdx = Math.max(0, activePhotos.length - 1);
    setCastState((prev) =>
      prev.photoIndex > maxIdx ? { ...prev, photoIndex: maxIdx } : prev
    );
    setPhotoSyncState((prev) =>
      prev.photoIndex > maxIdx ? { ...prev, photoIndex: maxIdx } : prev
    );
  }, [activePhotos.length]);

  // 전역 커맨드 버스 리스너 (툴바, 사진 상세창, 손보기 대화창에서 호출)
  useEffect(() => {
    const onCommand = (e: Event) => {
      const ce = e as CustomEvent<{
        action: 'OPEN_MONITOR_CAST' | 'CLOSE_MONITOR_CAST' | 'TOGGLE_PHOTO_SYNC';
        photoId?: string;
      }>;
      const d = ce.detail;
      if (!d) return;

      if (d.action === 'OPEN_MONITOR_CAST') {
        if (activeLoungeType !== 'personal' && !isAuthenticatedLiveSyncMember) {
          triggerGuestJoinWall('💻 모니터로 크게 보기 (스마트폰 무선 리모컨 · 전체화면)');
          return;
        }
        if (activePhotos.length === 0) {
          showToast('📸 현재 방에 크게 볼 사진이 아직 없습니다. 먼저 사진을 추가해 주세요.');
          return;
        }
        let idx = 0;
        if (d.photoId) {
          const foundIdx = activePhotos.findIndex((p) => p.id === d.photoId);
          if (foundIdx >= 0) idx = foundIdx;
        }
        const isMobileClient =
          typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
        setMonitorViewMode(isMobileClient ? 'phone_remote' : 'split_demo');
        setRemoteCastPhotoOverride(null);
        const next: MonitorCastState = {
          active: true,
          photoIndex: idx,
          zoom: 1,
          rotation: 0,
          isPlaying: false,
          updatedAt: Date.now(),
          senderDevice: getThisDeviceIdentity().displayName,
        };
        setCastState(next);
        setMonitorCastOpen(true);
        broadcastCastLiveMessage({ type: 'MONITOR_CAST_UPDATE', state: next });
        emitRemoteCastPacket(next, activePhotos[idx]);
      } else if (d.action === 'CLOSE_MONITOR_CAST') {
        const next: MonitorCastState = { ...castState, active: false, updatedAt: Date.now() };
        setCastState(next);
        setMonitorCastOpen(false);
        setRemoteCastPhotoOverride(null);
        broadcastCastLiveMessage({ type: 'MONITOR_CAST_UPDATE', state: next });
        emitRemoteCastPacket(next, null);
      } else if (d.action === 'TOGGLE_PHOTO_SYNC') {
        if (!isAuthenticatedLiveSyncMember) {
          triggerGuestJoinWall('📡 다 같이 보기 (가족·멤버와 실시간 사진 함께 보기)');
          return;
        }
        const prev = photoSyncStateRef.current;
        if (!prev.active) {
          const ongoing = remoteOngoingRef.current;
          if (ongoing && ongoing.active && ongoing.roomId === effectiveLiveSyncRoomId) {
            const byId = ongoing.photoId
              ? activePhotos.findIndex((p) => p.id === ongoing.photoId)
              : -1;
            const joinedIdx =
              byId >= 0
                ? byId
                : Math.min(Math.max(0, ongoing.photoIndex), Math.max(0, activePhotos.length - 1));
            setPhotoSyncState({
              active: true,
              roomId: effectiveLiveSyncRoomId,
              photoIndex: joinedIdx,
              totalPhotos: Math.max(activePhotos.length, ongoing.totalPhotos || 0),
              photoId: ongoing.photoId,
              photoName: ongoing.photoName,
              remotePhotoThumbUrl: ongoing.photoThumbUrl,
              zoom: ongoing.zoom || 1,
              rotation: ongoing.rotation || 0,
              presenterClientId: ongoing.presenterClientId,
              presenterName: ongoing.presenterName,
              seq: ongoing.seq || 0,
              updatedAt: ongoing.updatedAt || Date.now(),
            });
            liveSyncSessionRef.current?.requestCurrentState();
            return;
          }

          if (activePhotos.length === 0) {
            showToast('📸 현재 공유방에 다 같이 볼 사진이 아직 없습니다. 먼저 사진을 추가해 주세요.');
            return;
          }
          const safeNextIdx = prev.photoIndex >= activePhotos.length ? 0 : prev.photoIndex;
          const targetPhoto = activePhotos[safeNextIdx] || activePhotos[0];
          const next: RoomLivePhotoSyncState = {
            active: true,
            roomId: effectiveLiveSyncRoomId,
            photoIndex: safeNextIdx,
            totalPhotos: activePhotos.length,
            photoId: targetPhoto?.id,
            photoName: targetPhoto?.name,
            remotePhotoThumbUrl: undefined,
            zoom: 1,
            rotation: 0,
            presenterClientId: mySyncClientId,
            presenterName: mySyncDisplayNameRef.current || '멤버',
            seq: ++syncSeqRef.current,
            updatedAt: Date.now(),
          };
          setRemoteOngoingSession(null);
          setPhotoSyncState(next);
          publishLivePhotoSyncState(next, targetPhoto);
        } else {
          const isPresenter = prev.presenterClientId === mySyncClientId;
          const next: RoomLivePhotoSyncState = {
            ...prev,
            active: false,
            updatedAt: Date.now(),
          };
          setPhotoSyncState(next);
          if (isPresenter) {
            setRemoteOngoingSession(null);
            publishLivePhotoSyncState(next, null);
          } else {
            showToast('📡 다 같이 보기 참여를 잠시 닫았습니다. 상단 버튼으로 언제든 다시 합류할 수 있어요.');
          }
        }
      }
    };

    window.addEventListener('ghosti_cast_live_command', onCommand);
    return () => window.removeEventListener('ghosti_cast_live_command', onCommand);
  }, [
    activeLoungeType,
    activePhotos,
    castState,
    effectiveLiveSyncRoomId,
    isAuthenticatedLiveSyncMember,
    mySyncClientId,
    showToast,
    triggerGuestJoinWall,
  ]);

  const updateCastState = (patch: Partial<MonitorCastState>) => {
    setCastState((prev) => {
      const next = { ...prev, ...patch, updatedAt: Date.now() };
      broadcastCastLiveMessage({ type: 'MONITOR_CAST_UPDATE', state: next });
      const nextPhoto =
        patch.photoIndex !== undefined ? activePhotos[patch.photoIndex] : activePhotos[next.photoIndex];
      if (patch.photoIndex !== undefined) {
        setRemoteCastPhotoOverride(null);
      }
      emitRemoteCastPacket(next, nextPhoto);
      return next;
    });
  };

  const updatePhotoSync = (
    patch: Partial<RoomLivePhotoSyncState>,
    opts?: { takeLead?: boolean }
  ) => {
    const prev = photoSyncStateRef.current;
    const isCurrentlyPresenter = prev.presenterClientId === mySyncClientId;

    if (patch.active === false && !isCurrentlyPresenter) {
      setPhotoSyncState({ ...prev, active: false, updatedAt: Date.now() });
      showToast('📡 다 같이 보기 참여를 닫았습니다. 발표자가 계속 진행 중이면 상단 버튼으로 다시 합류할 수 있어요.');
      return;
    }

    const nextIdx =
      patch.photoIndex !== undefined ? patch.photoIndex : prev.photoIndex;
    const effectiveTotal = Math.max(activePhotos.length, prev.totalPhotos || 0);
    const clampedIdx =
      activePhotos.length > 0
        ? Math.min(Math.max(0, nextIdx), activePhotos.length - 1)
        : effectiveTotal > 0
        ? Math.min(Math.max(0, nextIdx), effectiveTotal - 1)
        : 0;
    const targetPhoto = activePhotos[clampedIdx] || null;
    const shouldTakeLead =
      opts?.takeLead === true ||
      patch.photoIndex !== undefined ||
      patch.zoom !== undefined ||
      patch.rotation !== undefined ||
      !prev.presenterClientId;
    const indexChangedWithoutLocalPhoto = patch.photoIndex !== undefined && !targetPhoto;

    const next: RoomLivePhotoSyncState = {
      ...prev,
      ...patch,
      roomId: effectiveLiveSyncRoomId || prev.roomId,
      photoIndex: clampedIdx,
      totalPhotos: Math.max(activePhotos.length, prev.totalPhotos || 0),
      photoId: indexChangedWithoutLocalPhoto ? undefined : targetPhoto?.id ?? prev.photoId,
      photoName: indexChangedWithoutLocalPhoto ? undefined : targetPhoto?.name ?? prev.photoName,
      remotePhotoThumbUrl:
        shouldTakeLead || indexChangedWithoutLocalPhoto ? undefined : prev.remotePhotoThumbUrl,
      presenterClientId: shouldTakeLead ? mySyncClientId : prev.presenterClientId,
      presenterName: shouldTakeLead
        ? mySyncDisplayNameRef.current || '멤버'
        : prev.presenterName,
      seq: ++syncSeqRef.current,
      updatedAt: Date.now(),
    };

    if (next.active === false || shouldTakeLead) {
      setRemoteOngoingSession(null);
    }
    setPhotoSyncState(next);
    publishLivePhotoSyncState(next, targetPhoto);
  };

  const safeCastIdx =
    activePhotos.length > 0
      ? Math.min(Math.max(0, castState.photoIndex), activePhotos.length - 1)
      : 0;
  const isLiveSyncPresenter =
    photoSyncState.active && photoSyncState.presenterClientId === mySyncClientId;
  const matchedLocalSyncIdx = useMemo(() => {
    if (activePhotos.length === 0) return 0;
    if (photoSyncState.photoId) {
      const byId = activePhotos.findIndex((p) => p.id === photoSyncState.photoId);
      if (byId >= 0) return byId;
    }
    if (photoSyncState.photoName) {
      const byName = activePhotos.findIndex((p) => p.name === photoSyncState.photoName);
      if (byName >= 0) return byName;
    }
    return Math.min(Math.max(0, photoSyncState.photoIndex), activePhotos.length - 1);
  }, [activePhotos, photoSyncState.photoId, photoSyncState.photoName, photoSyncState.photoIndex]);

  const safeSyncIdx = matchedLocalSyncIdx;
  const currentCastPhoto =
    remoteCastPhotoOverride || activePhotos[safeCastIdx] || activePhotos[0] || null;
  const currentSyncPhoto: PhotoItem | null = useMemo(() => {
    const exactById =
      photoSyncState.photoId && activePhotos.find((p) => p.id === photoSyncState.photoId);
    if (exactById) return exactById;
    const exactByName =
      photoSyncState.photoName && activePhotos.find((p) => p.name === photoSyncState.photoName);
    if (exactByName) return exactByName;
    if (!isLiveSyncPresenter && photoSyncState.remotePhotoThumbUrl) {
      return {
        id: photoSyncState.photoId || 'remote-live-sync-photo',
        name: photoSyncState.photoName || '공유방 사진',
        size: 13000,
        date: '실시간 싱크',
        mtimeMs: photoSyncState.updatedAt || Date.now(),
        locationKo: roomDisplayTitleFallback(activeJoinedRoomMeta, activeLoungeType, activeFamilyRoom),
        tags: ['다 같이 보기'],
        captionKo: '',
        thumbUrl: photoSyncState.remotePhotoThumbUrl,
        fullUrl: photoSyncState.remotePhotoThumbUrl,
        bookmarked: false,
        quarantined: false,
      };
    }
    return activePhotos[safeSyncIdx] || activePhotos[0] || null;
  }, [
    photoSyncState.photoId,
    photoSyncState.photoName,
    photoSyncState.remotePhotoThumbUrl,
    photoSyncState.updatedAt,
    isLiveSyncPresenter,
    activePhotos,
    safeSyncIdx,
    activeJoinedRoomMeta,
    activeLoungeType,
    activeFamilyRoom,
  ]);
  const displaySyncTotal = Math.max(activePhotos.length, photoSyncState.totalPhotos || 0, 1);
  const displaySyncPosition = Math.min(
    displaySyncTotal,
    (isLiveSyncPresenter ? safeSyncIdx : photoSyncState.photoIndex) + 1
  );

  const roomDisplayTitle = activeJoinedRoomMeta
    ? `💌 ${activeJoinedRoomMeta.masterNickname} · ${activeJoinedRoomMeta.roomTitle}`
    : activeLoungeType === 'family'
    ? `👨‍👩‍👧‍👦 패밀리 [${activeFamilyRoom}]`
    : activeLoungeType === 'club'
    ? '⛰️ 동호회·모임'
    : activeLoungeType === 'student'
    ? `🎓 동창회 [${alumniBannerTitle || alumniSchoolName || '동창회'}]`
    : '👑 내 기기 통합 (폰·PC·노트북)';

  return (
    <>
      {/* ====================================================================
          무기 1: [💻 모니터로 크게 보기] — PC/노트북 모니터 전체화면 클린 뷰어 + 내 폰 무선 리모컨
      ==================================================================== */}
      {monitorCastOpen && currentCastPhoto && (
        <div
          className="fixed inset-0 z-[140] bg-black/95 backdrop-blur-2xl flex flex-col p-3 md:p-6 pt-safe pb-safe overflow-y-auto"
          onClick={() => {
            updateCastState({ active: false });
            setMonitorCastOpen(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-6xl mx-auto my-auto rounded-3xl bg-zinc-950 border-2 border-cyan-400/50 shadow-[0_0_80px_rgba(34,211,238,0.25)] p-4 md:p-6 flex flex-col gap-4"
          >
            {/* 상단 상태 표시바 & 뷰 모드 전환 */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/60 text-cyan-300 text-xs font-black flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>💻 고스트 모니터 캐스트 (Ghost Monitor Cast)</span>
                </span>
                <span className="text-xs md:text-sm text-zinc-200 font-bold">
                  이메일({merlinAuth?.email || '내 계정'}) 자동 연결됨 — 카톡·사생활 알림 노출 0% 클린 전체화면
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMonitorViewMode('split_demo')}
                  className={`px-3 py-1 rounded-xl text-xs font-extrabold border cursor-pointer ${
                    monitorViewMode === 'split_demo'
                      ? 'bg-cyan-400 text-zinc-950 border-cyan-300'
                      : 'bg-zinc-900 text-zinc-300 border-white/15'
                  }`}
                >
                  🖥️+📱 모니터 &amp; 폰 리모컨 동시 보기
                </button>
                <button
                  type="button"
                  onClick={() => setMonitorViewMode('fullscreen_monitor')}
                  className={`px-3 py-1 rounded-xl text-xs font-extrabold border cursor-pointer ${
                    monitorViewMode === 'fullscreen_monitor'
                      ? 'bg-cyan-400 text-zinc-950 border-cyan-300'
                      : 'bg-zinc-900 text-zinc-300 border-white/15'
                  }`}
                >
                  🖥️ PC 모니터 단독 전체화면
                </button>
                <button
                  type="button"
                  onClick={() => setMonitorViewMode('phone_remote')}
                  className={`px-3 py-1 rounded-xl text-xs font-extrabold border cursor-pointer ${
                    monitorViewMode === 'phone_remote'
                      ? 'bg-cyan-400 text-zinc-950 border-cyan-300'
                      : 'bg-zinc-900 text-zinc-300 border-white/15'
                  }`}
                >
                  📱 내 폰 무선 리모컨 단독
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateCastState({ active: false });
                    setMonitorCastOpen(false);
                  }}
                  className="px-3 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/50 text-rose-200 text-xs font-extrabold cursor-pointer"
                >
                  ✕ 모니터 창 닫기
                </button>
              </div>
            </div>

            {/* 메인 본문: 좌측(PC/노트북 대화면 클린 뷰어) + 우측(내 스마트폰 무선 리모컨) */}
            <div
              className={`grid gap-5 ${
                monitorViewMode === 'split_demo'
                  ? 'grid-cols-1 lg:grid-cols-12'
                  : 'grid-cols-1'
              }`}
            >
              {/* PC/노트북 모니터 클린 뷰어 */}
              {monitorViewMode !== 'phone_remote' && (
                <div
                  className={`${
                    monitorViewMode === 'split_demo' ? 'lg:col-span-8' : ''
                  } rounded-2xl bg-black border border-cyan-400/30 p-4 flex flex-col justify-between min-h-[380px] md:min-h-[480px] relative overflow-hidden`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 z-10">
                    <span className="px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-white/15 text-[11px] text-emerald-300 font-bold break-keep">
                      🛡️ 사생활 보호 클린 뷰어 ON (카카오톡·문자·메신저 알림 원천 차단됨)
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-white/15 text-[11px] text-zinc-300 font-mono shrink-0">
                      {safeCastIdx + 1} / {activePhotos.length} • 배율 {castState.zoom.toFixed(1)}x • 회전 {castState.rotation}°
                    </span>
                  </div>

                  <div className="my-auto flex items-center justify-center py-4 overflow-hidden">
                    <img
                      src={currentCastPhoto.fullUrl || currentCastPhoto.thumbUrl}
                      alt={currentCastPhoto.name}
                      style={{
                        transform: `scale(${castState.zoom}) rotate(${castState.rotation}deg)`,
                        transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                      className="max-h-[340px] md:max-h-[410px] w-auto object-contain rounded-xl shadow-2xl select-none"
                    />
                  </div>

                  <div className="z-10 px-3.5 py-2.5 rounded-xl bg-zinc-900/90 border border-white/10 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-extrabold text-white">
                        {currentCastPhoto.name}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {currentCastPhoto.captionKo || currentCastPhoto.tags.join(' · ')} • 촬영일: {currentCastPhoto.date}
                      </div>
                    </div>
                    {castState.isPlaying && (
                      <span className="px-2.5 py-1 rounded-full bg-cyan-400/20 border border-cyan-400/50 text-cyan-200 text-xs font-extrabold animate-pulse">
                        ▶ 자동 슬라이드쇼 재생 중 (3.2초 간격)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 스마트폰 무선 리모컨 컨트롤러 */}
              {monitorViewMode !== 'fullscreen_monitor' && (
                <div
                  className={`${
                    monitorViewMode === 'split_demo' ? 'lg:col-span-4' : 'max-w-md mx-auto w-full'
                  } rounded-3xl bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-cyan-400/40 p-5 flex flex-col justify-between gap-4 shadow-xl`}
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div>
                      <div className="text-xs text-cyan-300 font-black">
                        📱 내 스마트폰 무선 리모컨
                      </div>
                      <div className="text-sm text-white font-extrabold mt-0.5">
                        버튼을 누르면 모니터 화면이 0.1초 만에 바뀝니다
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-[10.5px] font-extrabold">
                      실시간 직결
                    </span>
                  </div>

                  {/* 이전 / 다음 큼직한 터치 패드 */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        updateCastState({
                          photoIndex:
                            (safeCastIdx - 1 + activePhotos.length) %
                            Math.max(1, activePhotos.length),
                          zoom: 1,
                        })
                      }
                      className="py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 border border-white/15 text-white font-extrabold text-sm flex flex-col items-center gap-1 cursor-pointer transition-all"
                    >
                      <span className="text-xl">◀</span>
                      <span>이전 사진</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateCastState({
                          photoIndex:
                            (safeCastIdx + 1) % Math.max(1, activePhotos.length),
                          zoom: 1,
                        })
                      }
                      className="py-4 rounded-2xl bg-cyan-500/25 hover:bg-cyan-500/35 active:scale-95 border border-cyan-400/60 text-cyan-200 font-extrabold text-sm flex flex-col items-center gap-1 cursor-pointer transition-all"
                    >
                      <span className="text-xl">▶</span>
                      <span>다음 사진</span>
                    </button>
                  </div>

                  {/* 확대 / 축소 / 회전 / 슬라이드쇼 */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateCastState({ zoom: Math.min(3, Number((castState.zoom + 0.5).toFixed(1))) })
                      }
                      className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 text-xs font-extrabold cursor-pointer"
                    >
                      🔍 확대 (+0.5x)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateCastState({ zoom: Math.max(0.5, Number((castState.zoom - 0.5).toFixed(1))) })
                      }
                      className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 text-xs font-extrabold cursor-pointer"
                    >
                      🔎 축소 (-0.5x)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateCastState({ rotation: (castState.rotation + 90) % 360 })
                      }
                      className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 text-xs font-extrabold cursor-pointer"
                    >
                      🔄 90° 회전
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCastState({ zoom: 1, rotation: 0 })}
                      className="py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 text-xs font-extrabold cursor-pointer"
                    >
                      🎯 원본 크기(1.0x)
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateCastState({ isPlaying: !castState.isPlaying })}
                    className={`w-full py-3 rounded-2xl font-extrabold text-xs border transition-all cursor-pointer ${
                      castState.isPlaying
                        ? 'bg-amber-400 text-zinc-950 border-amber-300'
                        : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-400/50'
                    }`}
                  >
                    {castState.isPlaying
                      ? '⏸️ 자동 슬라이드쇼 일시정지'
                      : '▶️ 자동 슬라이드쇼 재생 (3초마다 넘김)'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      updateCastState({ active: false });
                      setMonitorCastOpen(false);
                    }}
                    className="w-full py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-rose-200 text-xs font-extrabold cursor-pointer"
                  >
                    ✕ 내 폰에서 모니터 팝업 창 즉시 닫기
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          무기 2: [📡 다 같이 사진 보기 — 앨범 라이브 싱크 (Live Photo Sync)] 플로팅 컨트롤러
      ==================================================================== */}
      {photoSyncState.active && (
        <div
          data-testid="live-photo-sync-overlay"
          className="fixed bottom-20 sm:bottom-6 mb-safe left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 z-[135] w-[94%] max-w-md rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border-2 border-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.4)] p-4 flex flex-col gap-3 text-white"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="text-xs font-black text-emerald-300 truncate">
                📡 다 같이 보기 (앨범 라이브 싱크 ON)
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                data-testid="live-sync-peer-badge"
                className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold border ${
                  liveSyncPeers.connectedCount >= 2
                    ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                    : liveSyncPeers.channelStatus === 'connected'
                    ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                    : 'bg-zinc-800 border-white/15 text-zinc-300'
                }`}
              >
                {liveSyncPeers.connectedCount >= 2
                  ? `🟢 ${liveSyncPeers.connectedCount}명 실시간 연결`
                  : liveSyncPeers.channelStatus === 'connected'
                  ? '🟡 1명 · 멤버 대기'
                  : '🔄 연결 중...'}
              </span>
              <button
                type="button"
                onClick={() => updatePhotoSync({ active: false })}
                className="px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 font-bold shrink-0 cursor-pointer"
              >
                {isLiveSyncPresenter ? '싱크 끄기 ✕' : '나만 닫기 ✕'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded-xl overflow-hidden border border-emerald-400/50 shrink-0 bg-black flex items-center justify-center">
              {currentSyncPhoto && (currentSyncPhoto.thumbUrl || currentSyncPhoto.fullUrl) ? (
                <img
                  src={currentSyncPhoto.thumbUrl || currentSyncPhoto.fullUrl}
                  alt={currentSyncPhoto.name}
                  style={{
                    transform: `scale(${photoSyncState.zoom}) rotate(${photoSyncState.rotation}deg)`,
                    transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                  className="w-full h-full object-cover select-none"
                />
              ) : (
                <span className="text-[11px] text-emerald-300 font-bold text-center px-1">
                  📸 동기화 중
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div
                data-testid="live-sync-role-label"
                className="text-xs font-extrabold text-emerald-200 truncate"
              >
                {isLiveSyncPresenter
                  ? `👑 ${mySyncDisplayName}(나)님이 화면을 리드하는 중`
                  : `👀 ${photoSyncState.presenterName}님의 화면을 함께 보는 중`}
              </div>
              <div className="text-sm font-black text-white truncate mt-0.5">
                {currentSyncPhoto?.name || photoSyncState.photoName || '공유방 사진'} ({displaySyncPosition}/{displaySyncTotal})
              </div>
              <div
                data-testid="live-sync-status-line"
                className="text-[11px] font-bold text-emerald-300 mt-0.5"
              >
                사진 {displaySyncPosition} / {displaySyncTotal} · 배율 {photoSyncState.zoom.toFixed(1)}x
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                {isLiveSyncPresenter
                  ? `내가 넘기거나 확대하면 ${roomDisplayTitle} 멤버 전원 화면이 0.1초 만에 똑같이 넘어갑니다.`
                  : `${photoSyncState.presenterName}님이 넘기거나 확대하면 내 화면도 0.1초 만에 똑같이 따라갑니다.`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => {
                const curPos = activePhotos.length > 0 ? safeSyncIdx : photoSyncState.photoIndex;
                updatePhotoSync(
                  {
                    photoIndex: (curPos - 1 + displaySyncTotal) % displaySyncTotal,
                    zoom: 1,
                  },
                  { takeLead: true }
                );
              }}
              className="py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-xs font-extrabold cursor-pointer"
            >
              ◀ 이전
            </button>
            <button
              type="button"
              onClick={() => {
                const curPos = activePhotos.length > 0 ? safeSyncIdx : photoSyncState.photoIndex;
                updatePhotoSync(
                  {
                    photoIndex: (curPos + 1) % displaySyncTotal,
                    zoom: 1,
                  },
                  { takeLead: true }
                );
              }}
              className="py-2 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/60 text-emerald-200 text-xs font-extrabold cursor-pointer"
            >
              다음 ▶
            </button>
            <button
              type="button"
              onClick={() =>
                updatePhotoSync(
                  {
                    zoom: photoSyncState.zoom >= 2 ? 1 : 2,
                  },
                  { takeLead: true }
                )
              }
              className="py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-xs font-extrabold cursor-pointer"
            >
              🔍 {photoSyncState.zoom >= 2 ? '1배' : '2배 줌'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isLiveSyncPresenter) {
                  updatePhotoSync({ photoIndex: safeSyncIdx, zoom: photoSyncState.zoom }, { takeLead: true });
                  return;
                }
                dispatchGhostCastLiveCommand({
                  action: 'OPEN_MONITOR_CAST',
                  photoId: currentSyncPhoto?.id,
                });
              }}
              className="py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 text-xs font-extrabold cursor-pointer"
            >
              {isLiveSyncPresenter ? '💻 모니터로' : '👑 내가 리드'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

function roomDisplayTitleFallback(
  joinedMeta: { masterNickname: string; roomTitle: string } | null,
  loungeType: string,
  familyRoom: string
): string {
  if (joinedMeta) return `${joinedMeta.masterNickname} · ${joinedMeta.roomTitle}`;
  if (loungeType === 'family') return familyRoom || '우리집';
  if (loungeType === 'club') return '동호회·모임';
  if (loungeType === 'student') return '동창회';
  return '사진 공유방';
}
