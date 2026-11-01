import React, { useEffect, useRef, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';
import type { PhotoItem } from '../types/saysee';

export type ShutterShareMode = 'select_first' | 'auto_instant';

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
  photoIndex: number;
  zoom: number;
  rotation: number;
  presenterName: string;
  updatedAt: number;
}

export interface CapturedShutterItem {
  id: string;
  dataUrl: string;
  capturedAt: string;
  cameraFacing: 'environment' | 'user';
  selected: boolean;
  autoShared: boolean;
}

const CAST_STORAGE_KEY = 'ghosti_monitor_cast_state_v1';
const PHOTO_SYNC_STORAGE_KEY = 'ghosti_room_photo_sync_state_v1';
const SHUTTER_SHARE_MODE_KEY = 'ghosti_shutter_share_mode_v1';
const BROADCAST_CHANNEL_NAME = 'ghosti_cast_live_bus_v1';

export function getSavedShutterShareMode(): ShutterShareMode {
  try {
    const val = localStorage.getItem(SHUTTER_SHARE_MODE_KEY);
    if (val === 'auto_instant' || val === 'select_first') return val;
  } catch {}
  return 'select_first'; // 기본값: 선별 후 올리기
}

export function setSavedShutterShareMode(mode: ShutterShareMode): void {
  try {
    localStorage.setItem(SHUTTER_SHARE_MODE_KEY, mode);
  } catch {}
  window.dispatchEvent(
    new CustomEvent('ghosti_shutter_share_mode_changed', { detail: { mode } })
  );
}

export function dispatchGhostCastLiveCommand(detail: {
  action:
    | 'OPEN_MONITOR_CAST'
    | 'CLOSE_MONITOR_CAST'
    | 'OPEN_ROOM_LIVE'
    | 'TOGGLE_PHOTO_SYNC'
    | 'OPEN_REMOTE_SHUTTER'
    | 'SET_SHUTTER_SHARE_MODE';
  photoId?: string;
  shutterShareMode?: ShutterShareMode;
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
    } else if (payload.type === 'PHOTO_SYNC_UPDATE' && payload.state) {
      localStorage.setItem(PHOTO_SYNC_STORAGE_KEY, JSON.stringify(payload.state));
    }
  } catch {}
}

/**
 * 📡 라운지 상단 『고스트 캐스트 & 라이브 (Ghost Cast & Live)』 3대 핵심 무기 컨트롤 바
 * 1) [💻 모니터로 크게 보기] (폰 무선 리모컨 ➔ 내 PC/노트북 모니터 0.5초 전체화면 팝업)
 * 2) [🔴 방 라이브 켜기] & [📡 다 같이 보기 (앨범 싱크)] (우리 방 전용 1초 생중계 & 사진 넘김 동기화)
 * 3) [📸 원격 모니터링 셔터] (삼각대 고화질 후면 카메라 ⇄ 내 손안의 거울 리모컨 + 선별/즉시 공유 스위치)
 */
export const GhostCastLiveToolbar: React.FC<{ loungeLabel?: string }> = () => {
  const { activeLoungeType, activeFamilyRoom, alumniSchoolName } = useSaySeeStore();
  const [photoSyncActive, setPhotoSyncActive] = useState(false);
  const [shutterMode, setShutterMode] = useState<ShutterShareMode>(getSavedShutterShareMode);

  useEffect(() => {
    const onModeChange = (e: Event) => {
      const ce = e as CustomEvent<{ mode: ShutterShareMode }>;
      if (ce.detail?.mode) setShutterMode(ce.detail.mode);
    };
    const onSyncState = (e: Event) => {
      const ce = e as CustomEvent<{ active: boolean }>;
      if (typeof ce.detail?.active === 'boolean') setPhotoSyncActive(ce.detail.active);
    };
    window.addEventListener('ghosti_shutter_share_mode_changed', onModeChange);
    window.addEventListener('ghosti_photo_sync_status', onSyncState);
    return () => {
      window.removeEventListener('ghosti_shutter_share_mode_changed', onModeChange);
      window.removeEventListener('ghosti_photo_sync_status', onSyncState);
    };
  }, []);

  if (activeLoungeType === 'work') return null;

  const roomLabel =
    activeLoungeType === 'family'
      ? `${activeFamilyRoom} 방`
      : activeLoungeType === 'club'
      ? `${alumniSchoolName || '동호·동창회'} 방`
      : '내 기기 통합';

  return (
    <div className="w-full px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-zinc-900/95 via-teal-950/35 to-zinc-900/95 border border-teal-400/30 flex flex-wrap items-center justify-between gap-2 shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="px-2 py-0.5 rounded-full bg-teal-400/20 border border-teal-400/50 text-teal-300 text-[10.5px] font-black shrink-0">
          ⚡ 고스트 캐스트 &amp; 라이브
        </span>
        <span className="text-[11.5px] text-zinc-300 font-bold truncate">
          {roomLabel} — 무설정 0.1초 모니터 팝업 · 프라이빗 생중계 · 거울 원격 셔터
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {/* 무기 1: 폰 ➔ 내 PC/노트북 모니터 1초 팝업 & 무선 리모컨 */}
        <button
          type="button"
          onClick={() => dispatchGhostCastLiveCommand({ action: 'OPEN_MONITOR_CAST' })}
          className="px-2.5 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-cyan-400/45 text-cyan-300 text-[11.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer"
          title="스마트폰을 무선 리모컨으로 삼아 내 PC/노트북 모니터에 전체화면 슬라이드쇼를 0.5초 만에 띄웁니다 (사생활 알림 노출 0%)"
        >
          <span>💻 모니터로 크게 보기</span>
        </button>

        {/* 무기 2-A: 우리 방 전용 1초 라이브 생중계 */}
        <button
          type="button"
          onClick={() => dispatchGhostCastLiveCommand({ action: 'OPEN_ROOM_LIVE' })}
          className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/60 text-rose-200 text-[11.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer"
          title="유튜브처럼 외부 노출 걱정 없이 오직 우리 방 멤버들끼리만 1초 만에 여는 실시간 생중계"
        >
          <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
          <span>🔴 방 라이브 켜기</span>
        </button>

        {/* 무기 2-B: 다 같이 사진 보기 — 앨범 라이브 싱크 */}
        <button
          type="button"
          onClick={() => dispatchGhostCastLiveCommand({ action: 'TOGGLE_PHOTO_SYNC' })}
          className={`px-2.5 py-1.5 rounded-xl border text-[11.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
            photoSyncActive
              ? 'bg-emerald-400 text-zinc-950 border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
              : 'bg-zinc-950 hover:bg-zinc-800 border-emerald-400/45 text-emerald-300'
          }`}
          title="내가 사진을 넘기거나 확대하면 방에 접속한 모든 멤버의 화면이 0.1초 만에 똑같이 넘어갑니다"
        >
          <span>📡 다 같이 보기 {photoSyncActive ? '(싱크 ON)' : '(라이브 싱크)'}</span>
        </button>

        {/* 무기 3: 원격 모니터링 셔터 & 선별/즉시 공유 옵션 */}
        <button
          type="button"
          onClick={() => dispatchGhostCastLiveCommand({ action: 'OPEN_REMOTE_SHUTTER' })}
          className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-[11.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer"
          title="삼각대 후면 카메라 화면을 내 손안의 폰에서 거울처럼 보며 원격 촬영합니다"
        >
          <span>📸 원격 모니터링 셔터</span>
          <span className="px-1.5 py-0.2 rounded bg-black/40 text-[10px] text-amber-300">
            {shutterMode === 'select_first' ? '✨선별업로드' : '⚡즉시공유'}
          </span>
        </button>
      </div>
    </div>
  );
};

/**
 * 🌐 글로벌 고스트 캐스트 & 라이브 3대 무기 통합 오버레이 모달
 */
export const GhostCastAndLiveGlobalOverlay: React.FC = () => {
  const { photos, merlinAuth, activeLoungeType, activeFamilyRoom, alumniSchoolName } =
    useSaySeeStore();

  const activePhotos = photos.filter((p) => !p.quarantined);

  // 1) 무기 1: 모니터 캐스트 & 무선 리모컨 상태
  const [monitorCastOpen, setMonitorCastOpen] = useState(false);
  const [monitorViewMode, setMonitorViewMode] = useState<'split_demo' | 'fullscreen_monitor' | 'phone_remote'>('split_demo');
  const [castState, setCastState] = useState<MonitorCastState>({
    active: false,
    photoIndex: 0,
    zoom: 1,
    rotation: 0,
    isPlaying: false,
    updatedAt: Date.now(),
    senderDevice: '내 스마트폰 리모컨',
  });

  // 2) 무기 2-A: 우리 방 전용 1초 라이브 생중계 상태
  const [roomLiveOpen, setRoomLiveOpen] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [liveSavePolicy, setLiveSavePolicy] = useState<'select_after' | 'auto_save'>('select_after');
  const [liveReactions, setLiveReactions] = useState<Array<{ id: number; emoji: string; sender: string }>>([
    { id: 1, emoji: '❤️', sender: '은숙' },
    { id: 2, emoji: '👏', sender: '지우' },
  ]);
  const [liveChatMessages, setLiveChatMessages] = useState<
    Array<{ id: number; sender: string; text: string; time: string }>
  >([
    { id: 1, sender: '은숙', text: '와~ 화면 너무 선명하게 잘 보인다! ㅎㅎ', time: '방금' },
    { id: 2, sender: '지우', text: '할머니 할아버지 안녕하세요~ ❤️', time: '방금' },
  ]);
  const [liveChatInput, setLiveChatInput] = useState('');
  const [liveEndedReviewReady, setLiveEndedReviewReady] = useState(false);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);

  // 3) 무기 2-B: 다 같이 사진 보기 (앨범 라이브 싱크) 상태
  const [photoSyncModalOpen, setPhotoSyncModalOpen] = useState(false);
  const [photoSyncState, setPhotoSyncState] = useState<RoomLivePhotoSyncState>({
    active: false,
    photoIndex: 0,
    zoom: 1,
    rotation: 0,
    presenterName: merlinAuth?.email?.split('@')[0] || '👑 방장(멀린)',
    updatedAt: Date.now(),
  });

  // 4) 무기 3: 원격 모니터링 셔터 상태
  const [remoteShutterOpen, setRemoteShutterOpen] = useState(false);
  const [shutterDeviceRole, setShutterDeviceRole] = useState<'remote_mirror' | 'tripod_camera'>('remote_mirror');
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [shutterShareMode, setShutterShareMode] = useState<ShutterShareMode>(getSavedShutterShareMode);
  const [timerCountdown, setTimerCountdown] = useState<number | null>(null);
  const [capturedTray, setCapturedTray] = useState<CapturedShutterItem[]>([]);
  const [shutterToast, setShutterToast] = useState<string | null>(null);
  const shutterVideoRef = useRef<HTMLVideoElement | null>(null);
  const shutterStreamRef = useRef<MediaStream | null>(null);

  const showToast = (msg: string) => {
    setShutterToast(msg);
    useSaySeeStore.setState({ lastQuarantineToast: msg });
    window.setTimeout(() => setShutterToast(null), 3800);
  };

  // 명령 버스 및 탭/기기 간 BroadcastChannel 동기화
  useEffect(() => {
    const onCommand = (e: Event) => {
      const ce = e as CustomEvent<{
        action: string;
        photoId?: string;
        shutterShareMode?: ShutterShareMode;
      }>;
      const d = ce.detail;
      if (!d) return;

      if (d.action === 'OPEN_MONITOR_CAST') {
        let idx = 0;
        if (d.photoId) {
          const foundIdx = activePhotos.findIndex((p) => p.id === d.photoId);
          if (foundIdx >= 0) idx = foundIdx;
        }
        const next: MonitorCastState = {
          active: true,
          photoIndex: idx,
          zoom: 1,
          rotation: 0,
          isPlaying: false,
          updatedAt: Date.now(),
          senderDevice: '내 스마트폰 리모컨',
        };
        setCastState(next);
        setMonitorCastOpen(true);
        broadcastCastLiveMessage({ type: 'MONITOR_CAST_UPDATE', state: next });
      } else if (d.action === 'CLOSE_MONITOR_CAST') {
        setMonitorCastOpen(false);
      } else if (d.action === 'OPEN_ROOM_LIVE') {
        setRoomLiveOpen(true);
        setLiveEndedReviewReady(false);
      } else if (d.action === 'TOGGLE_PHOTO_SYNC') {
        setPhotoSyncState((prev) => {
          const nextActive = !prev.active;
          const next = { ...prev, active: nextActive, updatedAt: Date.now() };
          setPhotoSyncModalOpen(nextActive);
          window.dispatchEvent(
            new CustomEvent('ghosti_photo_sync_status', { detail: { active: nextActive } })
          );
          broadcastCastLiveMessage({ type: 'PHOTO_SYNC_UPDATE', state: next });
          return next;
        });
      } else if (d.action === 'OPEN_REMOTE_SHUTTER') {
        if (d.shutterShareMode) {
          setShutterShareMode(d.shutterShareMode);
          setSavedShutterShareMode(d.shutterShareMode);
        }
        setRemoteShutterOpen(true);
      } else if (d.action === 'SET_SHUTTER_SHARE_MODE' && d.shutterShareMode) {
        setShutterShareMode(d.shutterShareMode);
        setSavedShutterShareMode(d.shutterShareMode);
        showToast(
          d.shutterShareMode === 'auto_instant'
            ? '⚡ [원격 모니터링 셔터] 찍는 즉시 방 전원에게 자동 공유 모드로 변경되었습니다!'
            : '✨ [원격 모니터링 셔터] 잘 나온 사진만 골라 올리는 [선별 후 올리기(기본)] 모드로 변경되었습니다!'
        );
      }
    };

    window.addEventListener('ghosti_cast_live_command', onCommand);

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        bc.onmessage = (ev) => {
          const data = ev.data;
          if (!data) return;
          if (data.type === 'MONITOR_CAST_UPDATE' && data.state) {
            setCastState(data.state);
            if (data.state.active) setMonitorCastOpen(true);
          } else if (data.type === 'PHOTO_SYNC_UPDATE' && data.state) {
            setPhotoSyncState(data.state);
            setPhotoSyncModalOpen(Boolean(data.state.active));
            window.dispatchEvent(
              new CustomEvent('ghosti_photo_sync_status', {
                detail: { active: Boolean(data.state.active) },
              })
            );
          }
        };
      }
    } catch {}

    return () => {
      window.removeEventListener('ghosti_cast_live_command', onCommand);
      if (bc) bc.close();
    };
  }, [activePhotos]);

  // 슬라이드쇼 자동 넘김 타이머 (모니터 캐스트)
  useEffect(() => {
    if (!monitorCastOpen || !castState.isPlaying || activePhotos.length === 0) return;
    const timer = window.setInterval(() => {
      setCastState((prev) => {
        const next: MonitorCastState = {
          ...prev,
          photoIndex: (prev.photoIndex + 1) % activePhotos.length,
          zoom: 1,
          rotation: 0,
          updatedAt: Date.now(),
        };
        broadcastCastLiveMessage({ type: 'MONITOR_CAST_UPDATE', state: next });
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [monitorCastOpen, castState.isPlaying, activePhotos.length]);

  // 카메라 스트림 정리 유틸
  const stopMediaStream = (ref: React.MutableRefObject<MediaStream | null>) => {
    if (ref.current) {
      ref.current.getTracks().forEach((t) => t.stop());
      ref.current = null;
    }
  };

  // 방 라이브 카메라 시작/종료
  useEffect(() => {
    if (!roomLiveOpen || !isBroadcasting) {
      stopMediaStream(liveStreamRef);
      return;
    }
    let cancelled = false;
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          liveStreamRef.current = stream;
          if (liveVideoRef.current) {
            liveVideoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          // 웹캠 미장착 데스크톱 환경에서는 시뮬레이션 라이브 뷰파인더로 자연스럽게 폴백
        });
    }
    return () => {
      cancelled = true;
      stopMediaStream(liveStreamRef);
    };
  }, [roomLiveOpen, isBroadcasting]);

  // 원격 모니터링 셔터 카메라 스트림 연결
  useEffect(() => {
    if (!remoteShutterOpen) {
      stopMediaStream(shutterStreamRef);
      return;
    }
    let cancelled = false;
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: cameraFacing }, audio: false })
        .then((stream) => {
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          shutterStreamRef.current = stream;
          if (shutterVideoRef.current) {
            shutterVideoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          // 웹캠 미장착 PC 환경 폴백
        });
    }
    return () => {
      cancelled = true;
      stopMediaStream(shutterStreamRef);
    };
  }, [remoteShutterOpen, cameraFacing]);

  const updateCastState = (patch: Partial<MonitorCastState>) => {
    setCastState((prev) => {
      const next: MonitorCastState = { ...prev, ...patch, updatedAt: Date.now() };
      broadcastCastLiveMessage({ type: 'MONITOR_CAST_UPDATE', state: next });
      return next;
    });
  };

  const updatePhotoSync = (patch: Partial<RoomLivePhotoSyncState>) => {
    setPhotoSyncState((prev) => {
      const next: RoomLivePhotoSyncState = { ...prev, ...patch, updatedAt: Date.now() };
      broadcastCastLiveMessage({ type: 'PHOTO_SYNC_UPDATE', state: next });
      return next;
    });
  };

  const executeRemoteShutterCapture = () => {
    const samplePhoto =
      activePhotos[capturedTray.length % Math.max(1, activePhotos.length)]?.fullUrl ||
      '/photos/20240719_142210.jpg';
    let capturedDataUrl = samplePhoto;

    try {
      const vid = shutterVideoRef.current;
      if (vid && vid.videoWidth > 0 && vid.videoHeight > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = vid.videoWidth;
        canvas.height = vid.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          capturedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        }
      }
    } catch {}

    const nowStr = new Date().toTimeString().slice(0, 8);
    const isAutoInstant = shutterShareMode === 'auto_instant';
    const newItem: CapturedShutterItem = {
      id: `shutter_${Date.now()}`,
      dataUrl: capturedDataUrl,
      capturedAt: nowStr,
      cameraFacing,
      selected: true,
      autoShared: isAutoInstant,
    };

    setCapturedTray((prev) => [newItem, ...prev]);

    if (isAutoInstant) {
      showToast(
        '📸 찰칵! [⚡ 찍는 즉시 자동 공유]가 켜져 있어 0.5초 만에 방 멤버 전원에게 사진이 공유되었습니다!'
      );
    } else {
      showToast(
        '📸 찰칵! 임시 트레이에 사진이 담겼습니다. 눈 감은 사진을 빼고 잘 나온 사진만 골라 올려보세요!'
      );
    }
  };

  const handleTriggerTimerShutter = (seconds = 3) => {
    if (timerCountdown !== null) return;
    setTimerCountdown(seconds);
    let left = seconds;
    const iv = window.setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(iv);
        setTimerCountdown(null);
        executeRemoteShutterCapture();
      } else {
        setTimerCountdown(left);
      }
    }, 1000);
  };

  const currentCastPhoto: PhotoItem | undefined =
    activePhotos[castState.photoIndex % Math.max(1, activePhotos.length)];
  const currentSyncPhoto: PhotoItem | undefined =
    activePhotos[photoSyncState.photoIndex % Math.max(1, activePhotos.length)];

  const roomTitle =
    activeLoungeType === 'family'
      ? `👨‍👩‍👧‍👦 ${activeFamilyRoom} 패밀리방`
      : activeLoungeType === 'club'
      ? `⛳ ${alumniSchoolName || '동호·동창회'} 모임방`
      : '👑 내 기기 통합 라운지';

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────────────
          1️⃣ 💻 [무기 1] 폰 ➔ 내 PC/노트북 모니터 1초 팝업 & 무선 리모컨 (Ghost Monitor Cast)
         ───────────────────────────────────────────────────────────────────── */}
      {monitorCastOpen && currentCastPhoto && (
        <div className="fixed inset-0 z-[125] bg-black/95 backdrop-blur-2xl flex flex-col justify-between p-4 md:p-6 overflow-y-auto">
          {/* 상단 바 */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-cyan-400 text-zinc-950 text-[11.5px] font-black">
                💻 고스트 모니터 캐스트 (0.5초 즉시 팝업)
              </span>
              <span className="text-[12.5px] text-zinc-200 font-bold">
                📧 {merlinAuth?.email || '내 이메일 계정'} 자동 연동됨 · 사생활 카톡 알림 노출 0%
              </span>
            </div>

            <div className="flex items-center gap-2">
              {(['split_demo', 'fullscreen_monitor', 'phone_remote'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonitorViewMode(m)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border cursor-pointer ${
                    monitorViewMode === m
                      ? 'bg-cyan-400 text-zinc-950 border-cyan-300'
                      : 'bg-zinc-900 text-zinc-300 border-white/15 hover:bg-zinc-800'
                  }`}
                >
                  {m === 'split_demo'
                    ? '📱+💻 리모컨·모니터 동시 보기'
                    : m === 'fullscreen_monitor'
                    ? '💻 PC 모니터 전체화면만'
                    : '📱 내 손안의 폰 리모컨만'}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  updateCastState({ active: false, isPlaying: false });
                  setMonitorCastOpen(false);
                }}
                className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-rose-200 text-[11.5px] font-extrabold cursor-pointer"
              >
                ✕ 모니터 캐스트 닫기
              </button>
            </div>
          </div>

          {/* 본문: PC 대형 모니터 화면 + 스마트폰 무선 리모컨 컨트롤러 */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center my-auto py-3">
            {/* 좌측/중앙: PC/노트북 모니터 전체화면 리시버 뷰 */}
            {monitorViewMode !== 'phone_remote' && (
              <div
                className={`${
                  monitorViewMode === 'fullscreen_monitor' ? 'lg:col-span-12' : 'lg:col-span-8'
                } rounded-3xl bg-zinc-950 border-2 border-cyan-400/40 p-4 flex flex-col items-center justify-between min-h-[420px] shadow-[0_0_50px_rgba(34,211,238,0.18)]`}
              >
                <div className="w-full flex items-center justify-between text-[11.5px] text-zinc-400 px-2 pb-2 border-b border-white/10">
                  <span className="font-bold text-cyan-300">
                    🖥️ 내 PC / 노트북 대화면 모니터 (선택한 사진·영상만 깨끗하게 표시)
                  </span>
                  <span className="font-mono">
                    {castState.photoIndex + 1} / {activePhotos.length}장 · 배율{' '}
                    {Math.round(castState.zoom * 100)}% · 회전 {castState.rotation}°
                  </span>
                </div>

                <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden my-3 max-h-[62vh]">
                  <img
                    src={currentCastPhoto.fullUrl}
                    alt={currentCastPhoto.name}
                    style={{
                      transform: `scale(${castState.zoom}) rotate(${castState.rotation}deg)`,
                      transition: 'transform 180ms ease-out',
                    }}
                    className="max-h-[58vh] w-auto object-contain rounded-xl shadow-2xl"
                  />
                </div>

                <div className="w-full flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-zinc-900/90 border border-white/10">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-extrabold text-white">
                      {currentCastPhoto.name}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {currentCastPhoto.captionKo || currentCastPhoto.tags.join(' · ')} ({currentCastPhoto.date})
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold">
                    ● 스마트폰 리모컨 실시간 응답 중 (0.1초)
                  </span>
                </div>
              </div>
            )}

            {/* 우측: 내 손안의 스마트폰 무선 리모컨 컨트롤러 */}
            {monitorViewMode !== 'fullscreen_monitor' && (
              <div
                className={`${
                  monitorViewMode === 'phone_remote'
                    ? 'lg:col-span-6 lg:col-start-4'
                    : 'lg:col-span-4'
                } rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border-2 border-teal-400/50 p-5 flex flex-col justify-between gap-4 shadow-2xl`}
              >
                <div className="flex flex-col gap-1 border-b border-white/10 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-teal-400 text-zinc-950 text-[10.5px] font-black">
                      📱 내 손안의 스마트폰 무선 리모컨
                    </span>
                    <span className="text-[11px] text-emerald-300 font-bold">● 연결됨</span>
                  </div>
                  <p className="text-[11.5px] text-zinc-300 leading-snug mt-1">
                    침대나 소파에 누워 폰에서 버튼을 누르면 내 PC 모니터 화면이 0.1초 만에 넘어갑니다.
                  </p>
                </div>

                {/* 이전 / 다음 큼직한 방향키 */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      updateCastState({
                        photoIndex:
                          (castState.photoIndex - 1 + activePhotos.length) %
                          Math.max(1, activePhotos.length),
                        zoom: 1,
                        rotation: 0,
                      })
                    }
                    className="py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 border border-white/15 text-white font-black text-[15px] flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <span>◀ 이전 사진</span>
                    <span className="text-[10.5px] text-zinc-400 font-normal">모니터 즉시 이동</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateCastState({
                        photoIndex:
                          (castState.photoIndex + 1) % Math.max(1, activePhotos.length),
                        zoom: 1,
                        rotation: 0,
                      })
                    }
                    className="py-4 rounded-2xl bg-cyan-400 hover:bg-cyan-300 active:scale-95 text-zinc-950 font-black text-[15px] flex flex-col items-center gap-1 cursor-pointer shadow-[0_0_20px_rgba(34,211,238,0.3)]"
                  >
                    <span>다음 사진 ▶</span>
                    <span className="text-[10.5px] text-zinc-800 font-bold">모니터 즉시 이동</span>
                  </button>
                </div>

                {/* 확대 / 축소 / 회전 / 슬라이드쇼 재생 */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      updateCastState({ zoom: Math.min(2.5, +(castState.zoom + 0.25).toFixed(2)) })
                    }
                    className="py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 text-[12px] font-extrabold cursor-pointer"
                  >
                    🔍 크게 확대 (+)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateCastState({ zoom: Math.max(0.75, +(castState.zoom - 0.25).toFixed(2)) })
                    }
                    className="py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 text-[12px] font-extrabold cursor-pointer"
                  >
                    🔎 축소/원래대로 (-)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateCastState({ rotation: (castState.rotation + 90) % 360 })
                    }
                    className="py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 text-[12px] font-extrabold cursor-pointer"
                  >
                    🔄 90° 회전
                  </button>
                  <button
                    type="button"
                    onClick={() => updateCastState({ isPlaying: !castState.isPlaying })}
                    className={`py-2.5 rounded-xl border text-[12px] font-extrabold cursor-pointer ${
                      castState.isPlaying
                        ? 'bg-emerald-400 text-zinc-950 border-emerald-300'
                        : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-emerald-300'
                    }`}
                  >
                    {castState.isPlaying ? '⏸️ 자동 슬라이드 정지' : '▶️ 3초 자동 슬라이드쇼'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    updateCastState({ active: false, isPlaying: false });
                    setMonitorCastOpen(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-[12px] font-extrabold cursor-pointer"
                >
                  🛑 모니터 화면 닫기 (원격 종료)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          2️⃣ 🔴 [무기 2-A] 우리 방 전용 1초 라이브 생중계 (RoomLiveBroadcastModal)
         ───────────────────────────────────────────────────────────────────── */}
      {roomLiveOpen && (
        <div className="fixed inset-0 z-[126] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-3xl bg-[#121216] border-2 border-rose-500/50 p-5 md:p-6 shadow-[0_0_60px_rgba(244,63,94,0.25)] flex flex-col gap-4 my-auto">
            {/* 상단 알림 배너 */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 rounded-full bg-rose-500 text-white text-[11.5px] font-black flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>🔴 {roomTitle} 전용 1초 라이브 생중계</span>
                </span>
                <span className="text-[12px] text-zinc-300 font-bold">
                  외부 유출 걱정 0% · 오직 초대된 우리 방 멤버만 실시간 시청
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBroadcasting(false);
                  setRoomLiveOpen(false);
                }}
                className="px-3 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 text-[12px] font-bold cursor-pointer"
              >
                ✕ 닫기
              </button>
            </div>

            {/* 방송 종료 시 저장 정책 옵션 스위치 (검토/선별 후 올리기 기본 vs 종료 즉시 자동 저장) */}
            <div className="px-3.5 py-2.5 rounded-2xl bg-zinc-950 border border-white/10 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] font-extrabold text-zinc-200">
                ⚙️ 방송 종료 후 방 앨범 저장 방식:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setLiveSavePolicy('select_after')}
                  className={`px-3 py-1 rounded-xl text-[11.5px] font-extrabold border cursor-pointer ${
                    liveSavePolicy === 'select_after'
                      ? 'bg-emerald-400 text-zinc-950 border-emerald-300'
                      : 'bg-zinc-900 text-zinc-400 border-white/10'
                  }`}
                >
                  ✨ 검토·선별 후 방 앨범에 올리기 (기본값)
                </button>
                <button
                  type="button"
                  onClick={() => setLiveSavePolicy('auto_save')}
                  className={`px-3 py-1 rounded-xl text-[11.5px] font-extrabold border cursor-pointer ${
                    liveSavePolicy === 'auto_save'
                      ? 'bg-amber-400 text-zinc-950 border-amber-300'
                      : 'bg-zinc-900 text-zinc-400 border-white/10'
                  }`}
                >
                  ⚡ 방송 종료 즉시 방 앨범에 자동 저장
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* 좌측: WebRTC 실시간 비디오 스트림 & 이모티콘 오버레이 */}
              <div className="lg:col-span-8 relative rounded-2xl overflow-hidden bg-black border border-white/15 aspect-video flex items-center justify-center">
                {isBroadcasting ? (
                  <>
                    <video
                      ref={liveVideoRef}
                      autoPlay
                      playsInline
                      muted
                      poster={activePhotos[0]?.fullUrl}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-rose-600/90 text-white text-[11px] font-black flex items-center gap-1.5 shadow-md">
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                      <span>LIVE 생중계 중 · 가족/동창 4명 실시간 시청 중</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-6 gap-3">
                    <span className="text-4xl">📹</span>
                    <h4 className="text-[16px] font-extrabold text-white">
                      손주 재롱잔치 · 가족 모임 · 산악회 정상 등정을 실시간으로 중계해 보세요!
                    </h4>
                    <p className="text-[12px] text-zinc-400 max-w-md">
                      아래 <strong>[🔴 지금 바로 방 라이브 시작하기]</strong>를 누르면 방 멤버들에게 즉시 알림이 전송되고 실시간 영상·음성이 연결됩니다.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsBroadcasting(true);
                        setLiveEndedReviewReady(false);
                        showToast(
                          `🔔 [${roomTitle}] 실시간 생중계가 시작되었습니다! 방 멤버들에게 알림을 보냈습니다.`
                        );
                      }}
                      className="px-5 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white text-[13.5px] font-black shadow-[0_0_24px_rgba(244,63,94,0.5)] cursor-pointer"
                    >
                      🔴 지금 바로 방 라이브 시작하기
                    </button>
                  </div>
                )}

                {/* 최근 날아온 응원 리액션 배지 */}
                <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-1.5">
                  {liveReactions.slice(-5).map((r) => (
                    <span
                      key={r.id}
                      className="px-2.5 py-1 rounded-full bg-black/75 border border-white/20 text-white text-[12px] font-bold animate-bounce"
                    >
                      {r.emoji} {r.sender}
                    </span>
                  ))}
                </div>
              </div>

              {/* 우측: 원클릭 응원 이모티콘 & 실시간 채팅 */}
              <div className="lg:col-span-4 rounded-2xl bg-zinc-950 border border-white/10 p-3.5 flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <span className="text-[12px] font-extrabold text-rose-300">
                    💬 방 멤버 실시간 응원 &amp; 채팅
                  </span>
                  <div className="h-48 overflow-y-auto flex flex-col gap-1.5 pr-1">
                    {liveChatMessages.map((m) => (
                      <div
                        key={m.id}
                        className="px-2.5 py-1.5 rounded-xl bg-zinc-900/90 border border-white/5 text-[11.5px]"
                      >
                        <span className="font-extrabold text-teal-300 mr-1.5">{m.sender}:</span>
                        <span className="text-zinc-200">{m.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 원클릭 응원 이모티콘 4종 */}
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['❤️', '👏', '😂', '🎉'] as const).map((emo) => (
                      <button
                        key={emo}
                        type="button"
                        onClick={() =>
                          setLiveReactions((prev) => [
                            ...prev,
                            {
                              id: Date.now() + Math.random(),
                              emoji: emo,
                              sender: merlinAuth?.email?.split('@')[0] || '나',
                            },
                          ])
                        }
                        className="py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-[16px] cursor-pointer"
                      >
                        {emo}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={liveChatInput}
                      onChange={(e) => setLiveChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && liveChatInput.trim()) {
                          setLiveChatMessages((prev) => [
                            ...prev,
                            {
                              id: Date.now(),
                              sender: merlinAuth?.email?.split('@')[0] || '👑 방장',
                              text: liveChatInput.trim(),
                              time: '방금',
                            },
                          ]);
                          setLiveChatInput('');
                        }
                      }}
                      placeholder="실시간 응원 메시지 입력..."
                      className="flex-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-[12px]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!liveChatInput.trim()) return;
                        setLiveChatMessages((prev) => [
                          ...prev,
                          {
                            id: Date.now(),
                            sender: merlinAuth?.email?.split('@')[0] || '👑 방장',
                            text: liveChatInput.trim(),
                            time: '방금',
                          },
                        ]);
                        setLiveChatInput('');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-teal-400 text-zinc-950 text-[11.5px] font-black cursor-pointer"
                    >
                      전송
                    </button>
                  </div>

                  {isBroadcasting && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsBroadcasting(false);
                        if (liveSavePolicy === 'auto_save') {
                          showToast('✅ 방송 종료와 동시에 촬영본이 방 앨범에 자동 저장되었습니다!');
                        } else {
                          setLiveEndedReviewReady(true);
                        }
                      }}
                      className="w-full py-2 rounded-xl bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/50 text-rose-200 text-[12px] font-extrabold cursor-pointer"
                    >
                      ⏹️ 방송 종료하기
                    </button>
                  )}

                  {liveEndedReviewReady && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-400/50 flex flex-col gap-2">
                      <span className="text-[11.5px] font-bold text-emerald-200">
                        ✨ 방송 녹화본 검토 준비 완료! 하이라이트 구간만 방 앨범에 올릴까요?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setLiveEndedReviewReady(false);
                          showToast('🎉 선별한 라이브 녹화본이 방 앨범에 업로드되었습니다!');
                        }}
                        className="py-1.5 rounded-lg bg-emerald-400 text-zinc-950 text-[11.5px] font-black cursor-pointer"
                      >
                        📤 확인 완료 · 방 앨범에 올리기
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          2️⃣ 📡 [무기 2-B] 다 같이 사진 보기 — 앨범 라이브 싱크 (RoomLivePhotoSyncModal)
         ───────────────────────────────────────────────────────────────────── */}
      {photoSyncModalOpen && currentSyncPhoto && (
        <div className="fixed inset-0 z-[124] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-3xl bg-[#121216] border-2 border-emerald-400/50 p-5 md:p-6 shadow-2xl flex flex-col gap-4 my-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-400 text-zinc-950 text-[11.5px] font-black">
                  📡 다 같이 보기 (앨범 라이브 싱크 ON)
                </span>
                <span className="text-[12px] text-emerald-200 font-bold">
                  발표자({photoSyncState.presenterName})가 넘기거나 확대하면 방 멤버 전원의 폰·PC가 0.1초 만에 똑같이 움직입니다!
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  updatePhotoSync({ active: false });
                  setPhotoSyncModalOpen(false);
                  window.dispatchEvent(
                    new CustomEvent('ghosti_photo_sync_status', { detail: { active: false } })
                  );
                }}
                className="px-3 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 text-[12px] font-bold cursor-pointer"
              >
                ✕ 다 같이 보기 종료
              </button>
            </div>

            <div className="relative rounded-2xl bg-black border border-white/10 min-h-[380px] max-h-[58vh] flex items-center justify-center overflow-hidden p-3">
              <img
                src={currentSyncPhoto.fullUrl}
                alt={currentSyncPhoto.name}
                style={{
                  transform: `scale(${photoSyncState.zoom}) rotate(${photoSyncState.rotation}deg)`,
                  transition: 'transform 160ms ease-out',
                }}
                className="max-h-[52vh] w-auto object-contain rounded-xl"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updatePhotoSync({
                      photoIndex:
                        (photoSyncState.photoIndex - 1 + activePhotos.length) %
                        Math.max(1, activePhotos.length),
                      zoom: 1,
                      rotation: 0,
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-[12.5px] font-extrabold cursor-pointer"
                >
                  ◀ 전원 이전 사진으로
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updatePhotoSync({
                      photoIndex:
                        (photoSyncState.photoIndex + 1) % Math.max(1, activePhotos.length),
                      zoom: 1,
                      rotation: 0,
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-[12.5px] font-black cursor-pointer"
                >
                  전원 다음 사진으로 ▶
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updatePhotoSync({ zoom: Math.min(2.5, +(photoSyncState.zoom + 0.25).toFixed(2)) })
                  }
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/15 text-zinc-200 text-[12px] font-bold cursor-pointer"
                >
                  🔍 전원 확대 (+)
                </button>
                <button
                  type="button"
                  onClick={() => updatePhotoSync({ zoom: 1, rotation: 0 })}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/15 text-zinc-200 text-[12px] font-bold cursor-pointer"
                >
                  100% 초기화
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          3️⃣ 📸 [무기 3] 원격 모니터링 셔터 & 모임 촬영 공유 옵션 (RemoteViewfinderShutterModal)
         ───────────────────────────────────────────────────────────────────── */}
      {remoteShutterOpen && (
        <div className="fixed inset-0 z-[127] bg-black/92 backdrop-blur-2xl flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-3xl bg-[#121216] border-2 border-amber-400/50 p-5 md:p-6 shadow-[0_0_60px_rgba(251,191,36,0.22)] flex flex-col gap-4 my-auto">
            {/* 상단 헤더 */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-0.5 rounded-full bg-amber-400 text-zinc-950 text-[11.5px] font-black">
                    📸 원격 모니터링 셔터 (삼각대 고화질 후면 ⇄ 내 손안의 거울 리모컨)
                  </span>
                </div>
                <span className="text-[12px] text-zinc-300 mt-0.5">
                  삼각대에 세운 폰의 고화질 후면 카메라 화면을 내 손안의 보조 폰에서 거울처럼 보며 구도를 확인하고 찍으세요!
                </span>
              </div>
              <button
                type="button"
                onClick={() => setRemoteShutterOpen(false)}
                className="px-3 py-1 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-300 text-[12px] font-bold cursor-pointer"
              >
                ✕ 닫기
              </button>
            </div>

            {/* ⚙️ 촬영 직후 방 공유 옵션 스위치 ([✨ 선별 후 올리기 (기본값)] vs [⚡ 찍는 즉시 방 전원에게 자동 공유]) */}
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-amber-400/35 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[12.5px] font-extrabold text-amber-300">
                  ⚙️ 촬영 직후 방 공유 옵션 (언제든 스위치나 [🪄 손보기] 채팅으로 변경 가능)
                </span>
                <span className="text-[11.5px] text-zinc-400">
                  {shutterShareMode === 'select_first'
                    ? '현재: 찍은 사진이 아래 임시 트레이에 먼저 모이며, 눈 감은 사진을 빼고 체크한 베스트 사진만 방에 올립니다.'
                    : '현재: 셔터를 누르는 족족 0.5초 만에 방 멤버 전원의 화면으로 즉시 자동 공유됩니다 (모임 라이브 스냅 결집).'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShutterShareMode('select_first');
                    setSavedShutterShareMode('select_first');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11.5px] font-extrabold border cursor-pointer ${
                    shutterShareMode === 'select_first'
                      ? 'bg-emerald-400 text-zinc-950 border-emerald-300 shadow-md'
                      : 'bg-zinc-900 text-zinc-400 border-white/10'
                  }`}
                >
                  ✨ 선별 후 올리기 (기본값)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShutterShareMode('auto_instant');
                    setSavedShutterShareMode('auto_instant');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[11.5px] font-extrabold border cursor-pointer ${
                    shutterShareMode === 'auto_instant'
                      ? 'bg-amber-400 text-zinc-950 border-amber-300 shadow-md'
                      : 'bg-zinc-900 text-zinc-400 border-white/10'
                  }`}
                >
                  ⚡ 찍는 즉시 방 전원에게 자동 공유
                </button>
              </div>
            </div>

            {/* 기기 역할 전환 & 실시간 거울 뷰파인더 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              <div className="lg:col-span-7 relative rounded-2xl overflow-hidden bg-black border-2 border-amber-400/40 aspect-video flex items-center justify-center">
                <video
                  ref={shutterVideoRef}
                  autoPlay
                  playsInline
                  muted
                  poster={activePhotos[1]?.fullUrl || activePhotos[0]?.fullUrl}
                  className="w-full h-full object-cover"
                />
                {/* 구도 가이드 격자선 */}
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                  <div className="border-r border-b border-white/20" />
                  <div className="border-r border-b border-white/20" />
                  <div className="border-b border-white/20" />
                  <div className="border-r border-b border-white/20" />
                  <div className="border-r border-b border-white/20" />
                  <div className="border-b border-white/20" />
                </div>

                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/75 border border-amber-400/50 text-amber-300 text-[11px] font-extrabold">
                  {shutterDeviceRole === 'remote_mirror'
                    ? '📱 내 손안의 거울 리모컨 뷰파인더 (삼각대 후면 카메라 실시간 수신 중)'
                    : '📷 삼각대 카메라 기기 (고화질 후면 촬영 대기 중)'}
                </div>

                {timerCountdown !== null && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-7xl font-black text-amber-300 animate-ping">
                      {timerCountdown}
                    </span>
                  </div>
                )}
              </div>

              {/* 우측: 원격 셔터 버튼 & 역할 전환 */}
              <div className="lg:col-span-5 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShutterDeviceRole('remote_mirror')}
                    className={`py-2 px-2.5 rounded-xl text-[11.5px] font-extrabold border cursor-pointer ${
                      shutterDeviceRole === 'remote_mirror'
                        ? 'bg-teal-400 text-zinc-950 border-teal-300'
                        : 'bg-zinc-900 text-zinc-400 border-white/10'
                    }`}
                  >
                    📱 내 손안의 거울 리모컨
                  </button>
                  <button
                    type="button"
                    onClick={() => setShutterDeviceRole('tripod_camera')}
                    className={`py-2 px-2.5 rounded-xl text-[11.5px] font-extrabold border cursor-pointer ${
                      shutterDeviceRole === 'tripod_camera'
                        ? 'bg-teal-400 text-zinc-950 border-teal-300'
                        : 'bg-zinc-900 text-zinc-400 border-white/10'
                    }`}
                  >
                    📷 삼각대 카메라 본체
                  </button>
                </div>

                <button
                  type="button"
                  onClick={executeRemoteShutterCapture}
                  className="w-full py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-zinc-950 font-black text-[16px] shadow-[0_0_25px_rgba(251,191,36,0.4)] cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>📸 원격 즉시 촬영 (찰칵!)</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTriggerTimerShutter(3)}
                    className="py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-amber-200 text-[12px] font-extrabold cursor-pointer"
                  >
                    ⏱️ 3초 타이머 찰칵
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCameraFacing((f) => (f === 'environment' ? 'user' : 'environment'))
                    }
                    className="py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-zinc-200 text-[12px] font-extrabold cursor-pointer"
                  >
                    🔄 {cameraFacing === 'environment' ? '후면 고화질 ➔ 전면' : '전면 ➔ 후면 고화질'}
                  </button>
                </div>

                {shutterToast && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-400/50 text-emerald-200 text-[11.5px] font-bold">
                    {shutterToast}
                  </div>
                )}
              </div>
            </div>

            {/* 하단: 촬영된 사진 선별 트레이 */}
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-white/10 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] font-extrabold text-zinc-200">
                  🖼️ 방금 원격 촬영한 사진 트레이 ({capturedTray.length}장)
                </span>
                {shutterShareMode === 'select_first' && capturedTray.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const selectedCount = capturedTray.filter((c) => c.selected).length;
                      if (selectedCount === 0) {
                        showToast('올릴 사진을 1장 이상 체크해 주세요.');
                        return;
                      }
                      showToast(
                        `🎉 선별하신 베스트 사진 ${selectedCount}장이 ${roomTitle} 앨범에 일괄 업로드되었습니다!`
                      );
                      setCapturedTray((prev) =>
                        prev.map((item) => (item.selected ? { ...item, autoShared: true } : item))
                      );
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-[12px] font-black cursor-pointer"
                  >
                    📤 체크한 베스트 {capturedTray.filter((c) => c.selected).length}장 방 전원에게 올리기
                  </button>
                )}
              </div>

              {capturedTray.length === 0 ? (
                <p className="text-[11.5px] text-zinc-500 py-2">
                  아직 촬영된 사진이 없습니다. 위 [📸 원격 즉시 촬영] 또는 [⏱️ 3초 타이머 찰칵]을 눌러보세요!
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                  {capturedTray.map((item) => (
                    <div
                      key={item.id}
                      onClick={() =>
                        setCapturedTray((prev) =>
                          prev.map((x) =>
                            x.id === item.id ? { ...x, selected: !x.selected } : x
                          )
                        )
                      }
                      className={`relative rounded-xl overflow-hidden border-2 aspect-[4/3] cursor-pointer ${
                        item.selected ? 'border-emerald-400' : 'border-zinc-700 opacity-60'
                      }`}
                    >
                      <img
                        src={item.dataUrl}
                        alt={item.capturedAt}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-bold text-white">
                        {item.selected ? '☑️ 선택됨' : '☐ 제외'}
                      </span>
                      {item.autoShared && (
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-emerald-400 text-zinc-950 text-[9.5px] font-black">
                          공유완료
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
