import React, { useEffect, useState } from 'react';
import { useSaySeeStore } from '../store/useSaySeeStore';

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

const CAST_STORAGE_KEY = 'ghosti_monitor_cast_state_v1';
const PHOTO_SYNC_STORAGE_KEY = 'ghosti_room_photo_sync_state_v1';
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
    } else if (payload.type === 'PHOTO_SYNC_UPDATE' && payload.state) {
      localStorage.setItem(PHOTO_SYNC_STORAGE_KEY, JSON.stringify(payload.state));
    }
  } catch {}
}

/**
 * 📡 라운지 상단 『고스트 캐스트 & 라이브 싱크』 2대 알짜 무기 컨트롤 바
 * - [무기 1] 💻 모니터로 크게 보기: 스마트폰 무선 리모컨 ➔ 내 PC/노트북 모니터 0.5초 전체화면 클린 팝업 (카톡·사생활 알림 노출 0%, 화질 저하 0%)
 * - [무기 2] 📡 다 같이 보기 (앨범 싱크): 사진 공유방에서 발표자가 넘기거나 확대한 사진 화면이 방 멤버 전원에게 0.1초 만에 똑같이 동기화 (발열·트래픽 부담 0%)
 */
export const GhostCastLiveToolbar: React.FC<{ loungeLabel?: string }> = () => {
  const { activeLoungeType, activeFamilyRoom, alumniSchoolName } = useSaySeeStore();
  const [photoSyncActive, setPhotoSyncActive] = useState(false);

  useEffect(() => {
    const onSyncState = (e: Event) => {
      const ce = e as CustomEvent<{ active: boolean }>;
      if (typeof ce.detail?.active === 'boolean') setPhotoSyncActive(ce.detail.active);
    };
    window.addEventListener('ghosti_photo_sync_status', onSyncState);
    return () => {
      window.removeEventListener('ghosti_photo_sync_status', onSyncState);
    };
  }, []);

  if (activeLoungeType === 'work') return null;

  // 1) '내 기기(personal)'에서는 [💻 모니터로 크게 보기] 1개만 심플하게 노출
  if (activeLoungeType === 'personal') {
    return (
      <div className="w-full px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-cyan-400/25 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11.5px] text-zinc-300 font-bold flex items-center gap-1.5">
          <span className="text-cyan-300 font-extrabold">👑 내 기기 통합</span>
          <span>— 내 폰에서 누르면 내 노트북/PC 모니터에 0.5초 전체화면 팝업 (카톡 알림 노출 0%)</span>
        </span>
        <button
          type="button"
          onClick={() => dispatchGhostCastLiveCommand({ action: 'OPEN_MONITOR_CAST' })}
          className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/50 text-cyan-200 text-[11.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer"
        >
          <span>💻 모니터로 크게 보기 (폰 무선 리모컨)</span>
        </button>
      </div>
    );
  }

  // 2) '사진 공유방(패밀리 / 동호회·동창회)'에서는 [💻 모니터로 크게 보기] + [📡 다 같이 보기 (앨범 싱크)] 2대 알짜만 깔끔하게 노출
  const roomLabel =
    activeLoungeType === 'family'
      ? `${activeFamilyRoom} 방`
      : `${alumniSchoolName || '동호·동창회'} 방`;

  return (
    <div className="w-full px-3.5 py-2 rounded-2xl bg-gradient-to-r from-zinc-900/95 via-teal-950/35 to-zinc-900/95 border border-teal-400/30 flex flex-wrap items-center justify-between gap-2 shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="px-2 py-0.5 rounded-full bg-teal-400/20 border border-teal-400/50 text-teal-300 text-[10.5px] font-black shrink-0">
          ⚡ 고스트 캐스트 &amp; 싱크
        </span>
        <span className="text-[11.5px] text-zinc-300 font-bold truncate">
          {roomLabel} — 카톡 알림 노출 없는 0.5초 모니터 팝업 &amp; 0.1초 다 같이 보기 앨범 싱크
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => dispatchGhostCastLiveCommand({ action: 'OPEN_MONITOR_CAST' })}
          className="px-2.5 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-cyan-400/45 text-cyan-300 text-[11.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer"
          title="스마트폰을 무선 리모컨으로 삼아 내 PC/노트북 모니터에 전체화면 슬라이드쇼를 0.5초 만에 띄웁니다 (사생활 알림 노출 0%)"
        >
          <span>💻 모니터로 크게 보기</span>
        </button>

        <button
          type="button"
          onClick={() => dispatchGhostCastLiveCommand({ action: 'TOGGLE_PHOTO_SYNC' })}
          className={`px-2.5 py-1.5 rounded-xl border text-[11.5px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
            photoSyncActive
              ? 'bg-emerald-400 text-zinc-950 border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
              : 'bg-zinc-950 hover:bg-zinc-800 border-emerald-400/45 text-emerald-300'
          }`}
          title="내가 사진을 넘기거나 확대하면 방에 접속한 모든 멤버의 화면이 0.1초 만에 똑같이 넘어갑니다 (다수 인원 방에서도 발열·트래픽 부담 0%)"
        >
          <span>📡 다 같이 보기 {photoSyncActive ? '(싱크 ON)' : '(앨범 싱크)'}</span>
        </button>
      </div>
    </div>
  );
};

/**
 * 🌐 글로벌 『고스트 모니터 캐스트 (무선 리모컨)』 & 『다 같이 보기 (앨범 라이브 싱크)』 통합 오버레이
 */
export const GhostCastAndLiveGlobalOverlay: React.FC = () => {
  const { photos, merlinAuth, activeLoungeType, activeFamilyRoom, alumniSchoolName } =
    useSaySeeStore();

  const activePhotos = photos.filter((p) => !p.quarantined);

  // 1) 무기 1: 모니터로 크게 보기 & 스마트폰 무선 리모컨 상태
  const [monitorCastOpen, setMonitorCastOpen] = useState(false);
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

  // 2) 무기 2: 다 같이 사진 보기 (앨범 라이브 싱크) 상태
  const [photoSyncState, setPhotoSyncState] = useState<RoomLivePhotoSyncState>({
    active: false,
    photoIndex: 0,
    zoom: 1,
    rotation: 0,
    presenterName: merlinAuth?.email ? merlinAuth.email.split('@')[0] : '방장(나)',
    updatedAt: Date.now(),
  });

  // 슬라이드쇼 자동 재생 타이머 (모니터 캐스트)
  useEffect(() => {
    if (!monitorCastOpen || !castState.isPlaying || activePhotos.length <= 1) return;
    const timer = window.setInterval(() => {
      setCastState((prev) => {
        const nextIdx = (prev.photoIndex + 1) % activePhotos.length;
        const next = { ...prev, photoIndex: nextIdx, updatedAt: Date.now() };
        broadcastCastLiveMessage({ type: 'MONITOR_CAST_UPDATE', state: next });
        return next;
      });
    }, 3200);
    return () => clearInterval(timer);
  }, [monitorCastOpen, castState.isPlaying, activePhotos.length]);

  // BroadcastChannel & Storage 이벤트 수신 (같은 이메일로 열린 다른 탭/창과 0.05초 실시간 연동)
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
          } else if (data?.type === 'PHOTO_SYNC_UPDATE' && data.state) {
            const st = data.state as RoomLivePhotoSyncState;
            setPhotoSyncState(st);
            window.dispatchEvent(
              new CustomEvent('ghosti_photo_sync_status', { detail: { active: st.active } })
            );
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
        } else if (e.key === PHOTO_SYNC_STORAGE_KEY && e.newValue) {
          const st = JSON.parse(e.newValue) as RoomLivePhotoSyncState;
          setPhotoSyncState(st);
          window.dispatchEvent(
            new CustomEvent('ghosti_photo_sync_status', { detail: { active: st.active } })
          );
        }
      } catch {}
    };

    window.addEventListener('storage', onStorage);
    return () => {
      if (ch) ch.close();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

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
        const next: MonitorCastState = { ...castState, active: false, updatedAt: Date.now() };
        setCastState(next);
        setMonitorCastOpen(false);
        broadcastCastLiveMessage({ type: 'MONITOR_CAST_UPDATE', state: next });
      } else if (d.action === 'TOGGLE_PHOTO_SYNC') {
        setPhotoSyncState((prev) => {
          const nextActive = !prev.active;
          const next: RoomLivePhotoSyncState = {
            ...prev,
            active: nextActive,
            updatedAt: Date.now(),
          };
          broadcastCastLiveMessage({ type: 'PHOTO_SYNC_UPDATE', state: next });
          window.dispatchEvent(
            new CustomEvent('ghosti_photo_sync_status', { detail: { active: nextActive } })
          );
          return next;
        });
      }
    };

    window.addEventListener('ghosti_cast_live_command', onCommand);
    return () => window.removeEventListener('ghosti_cast_live_command', onCommand);
  }, [activePhotos, castState]);

  const updateCastState = (patch: Partial<MonitorCastState>) => {
    setCastState((prev) => {
      const next = { ...prev, ...patch, updatedAt: Date.now() };
      broadcastCastLiveMessage({ type: 'MONITOR_CAST_UPDATE', state: next });
      return next;
    });
  };

  const updatePhotoSync = (patch: Partial<RoomLivePhotoSyncState>) => {
    setPhotoSyncState((prev) => {
      const next = { ...prev, ...patch, updatedAt: Date.now() };
      broadcastCastLiveMessage({ type: 'PHOTO_SYNC_UPDATE', state: next });
      if (typeof patch.active === 'boolean') {
        window.dispatchEvent(
          new CustomEvent('ghosti_photo_sync_status', { detail: { active: patch.active } })
        );
      }
      return next;
    });
  };

  const currentCastPhoto =
    activePhotos[castState.photoIndex] || activePhotos[0] || null;
  const currentSyncPhoto =
    activePhotos[photoSyncState.photoIndex] || activePhotos[0] || null;

  const roomDisplayTitle =
    activeLoungeType === 'family'
      ? `👨‍👩‍👧‍👦 패밀리 [${activeFamilyRoom}]`
      : activeLoungeType === 'club'
      ? `⛳ 동호·동창회 [${alumniSchoolName || '모임방'}]`
      : '👑 내 기기 통합 (폰·PC·노트북)';

  return (
    <>
      {/* ====================================================================
          무기 1: [💻 모니터로 크게 보기] — PC/노트북 모니터 전체화면 클린 뷰어 + 내 폰 무선 리모컨
      ==================================================================== */}
      {monitorCastOpen && currentCastPhoto && (
        <div
          className="fixed inset-0 z-[140] bg-black/95 backdrop-blur-2xl flex flex-col p-3 md:p-6 overflow-y-auto"
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
                  <div className="flex items-center justify-between z-10">
                    <span className="px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-white/15 text-[11px] text-emerald-300 font-bold">
                      🛡️ 사생활 보호 클린 뷰어 ON (카카오톡·문자·메신저 알림 원천 차단됨)
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-zinc-900/90 border border-white/15 text-[11px] text-zinc-300 font-mono">
                      {castState.photoIndex + 1} / {activePhotos.length} • 배율 {castState.zoom.toFixed(1)}x • 회전 {castState.rotation}°
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
                            (castState.photoIndex - 1 + activePhotos.length) %
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
                            (castState.photoIndex + 1) % Math.max(1, activePhotos.length),
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
      {photoSyncState.active && currentSyncPhoto && (
        <div className="fixed bottom-6 right-6 z-[135] w-[92%] max-w-md rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border-2 border-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.4)] p-4 flex flex-col gap-3 text-white">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-black text-emerald-300">
                📡 다 같이 보기 (앨범 라이브 싱크 ON)
              </span>
            </div>
            <button
              type="button"
              onClick={() => updatePhotoSync({ active: false })}
              className="px-2.5 py-0.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 font-bold cursor-pointer"
            >
              싱크 끄기 ✕
            </button>
          </div>

          <div className="flex items-center gap-3">
            <img
              src={currentSyncPhoto.thumbUrl || currentSyncPhoto.fullUrl}
              alt={currentSyncPhoto.name}
              style={{
                transform: `scale(${photoSyncState.zoom}) rotate(${photoSyncState.rotation}deg)`,
              }}
              className="w-20 h-20 rounded-xl object-cover border border-emerald-400/50 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-extrabold text-emerald-200 truncate">
                👑 {photoSyncState.presenterName}님이 화면을 리드하는 중
              </div>
              <div className="text-sm font-black text-white truncate mt-0.5">
                {currentSyncPhoto.name} ({photoSyncState.photoIndex + 1}/{activePhotos.length})
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                내가 넘기거나 확대하면 {roomDisplayTitle} 멤버 전원 화면이 0.1초 만에 똑같이 넘어갑니다.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() =>
                updatePhotoSync({
                  photoIndex:
                    (photoSyncState.photoIndex - 1 + activePhotos.length) %
                    Math.max(1, activePhotos.length),
                  zoom: 1,
                })
              }
              className="py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-xs font-extrabold cursor-pointer"
            >
              ◀ 이전
            </button>
            <button
              type="button"
              onClick={() =>
                updatePhotoSync({
                  photoIndex:
                    (photoSyncState.photoIndex + 1) % Math.max(1, activePhotos.length),
                  zoom: 1,
                })
              }
              className="py-2 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/60 text-emerald-200 text-xs font-extrabold cursor-pointer"
            >
              다음 ▶
            </button>
            <button
              type="button"
              onClick={() =>
                updatePhotoSync({
                  zoom: photoSyncState.zoom >= 2 ? 1 : 2,
                })
              }
              className="py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-xs font-extrabold cursor-pointer"
            >
              🔍 {photoSyncState.zoom >= 2 ? '1배' : '2배 줌'}
            </button>
            <button
              type="button"
              onClick={() => {
                dispatchGhostCastLiveCommand({
                  action: 'OPEN_MONITOR_CAST',
                  photoId: currentSyncPhoto.id,
                });
              }}
              className="py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 text-xs font-extrabold cursor-pointer"
            >
              💻 모니터로
            </button>
          </div>
        </div>
      )}
    </>
  );
};
