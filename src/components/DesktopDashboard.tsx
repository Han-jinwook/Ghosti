import React, { useEffect, useState } from 'react';
import { getZCoreUrl, zCoreBridge } from '../services/zCoreBridge';
import { computeGhostSearchWindowRect, DEFAULT_WORK_AREA } from '../services/ghostSearchWindowGeometry';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { markGhostDojoStep } from './ghostDojo/ghostSearchDojoShared';
import { MerlinZCoreGuideModal } from './MerlinZCoreGuideModal';
import { GhostPhotoOcrTeleportModal } from './GhostPhotoOcrTeleportModal';
import {
  scrollAppToTop,
  useDashboardNavStore,
} from '../domains/shared/dashboardNavState';
import {
  DesktopSidebarContainer,
  DesktopTopHeaderAndLoungeBar,
} from '../domains/shared/DesktopSidebarAndHeader';
import { GhostAssistantPane } from '../domains/assistant/GhostAssistantPane';
import { GhostSearchPane } from '../domains/search/GhostSearchPane';
import { PaidDeviceSyncPane } from '../domains/paid_device_sync/PaidDeviceSyncPane';
import { PaidWorkSharePane } from '../domains/paid_work_share/PaidWorkSharePane';

declare const __GHOSTI_BUILD_ID__: string | undefined;
const CURRENT_DASHBOARD_BUILD_ID =
  typeof __GHOSTI_BUILD_ID__ !== 'undefined' ? __GHOSTI_BUILD_ID__ : '';

export const DesktopDashboard: React.FC = () => {
  const {
    desktopTab,
    setDesktopTab,
    activeLoungeType,
    setActiveLoungeType,
    activeFamilyRoom,
    initialized,
  } = useSaySeeStore();

  const {
    isMobileDrawerOpen,
    showZCoreGuideModal,
    setShowZCoreGuideModal,
    ocrModalPhoto,
    setOcrModalPhoto,
  } = useDashboardNavStore();

  useEffect(() => {
    const onOpenZCoreGuide = () => setShowZCoreGuideModal(true);
    window.addEventListener('openZCoreGuideModal', onOpenZCoreGuide);
    const unsub = zCoreBridge.subscribe(() => {});
    void zCoreBridge.checkHealth();
    return () => {
      window.removeEventListener('openZCoreGuideModal', onOpenZCoreGuide);
      unsub();
    };
  }, [setShowZCoreGuideModal]);

  const [ghostSearchWindowStage] = useState<'small' | 'medium' | 'large' | null>(() => {
    if (typeof window === 'undefined') return null;
    const v = new URLSearchParams(window.location.search).get('ghostSearchWindow');
    if (!v) return null;
    return v === 'small' || v === 'large' ? v : 'medium';
  });

  const [isInsideIframe] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  });

  const consumedUrlQueryRef = React.useRef<string>('');
  const [isGalleryViewport, setIsGalleryViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return ghostSearchWindowStage === 'large';
    const v = new URLSearchParams(window.location.search).get('ghostSearchWindow');
    if (v === 'large') return true;
    return (window.innerWidth || 0) >= 1180;
  });

  useEffect(() => {
    if (!ghostSearchWindowStage || isInsideIframe) return;
    document.title = '귀신검색창 — 귀신같이';
    const onPassiveResize = () => {
      const wide = (window.innerWidth || 0) >= 1180;
      setIsGalleryViewport((prev) => (prev === wide ? prev : wide));
    };
    window.addEventListener('resize', onPassiveResize, { passive: true });

    let bc: BroadcastChannel | null = null;
    const bornAt = Date.now() + Math.random();
    const winId = `gsw_${Math.floor(bornAt)}_${Math.random().toString(36).slice(2, 7)}`;
    const HB_KEY = 'ghosti_search_win_hb_v1';

    const writeLocalHeartbeat = () => {
      try {
        localStorage.setItem(HB_KEY, JSON.stringify({ winId, ts: Date.now() }));
      } catch {
        /* ignore */
      }
    };
    const clearLocalHeartbeat = () => {
      try {
        const raw = localStorage.getItem(HB_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { winId?: string } | null;
          if (!parsed?.winId || parsed.winId === winId) {
            localStorage.removeItem(HB_KEY);
          }
        }
      } catch {
        /* ignore */
      }
    };
    const sendZCoreHeartbeat = (closing = false) => {
      if (!zCoreBridge.isConnected) return;
      try {
        void fetch(getZCoreUrl('/api/superpower/open_search_window'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            closing ? { closing: true, win_id: winId } : { heartbeat: true, win_id: winId }
          ),
          keepalive: closing,
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    };

    writeLocalHeartbeat();
    sendZCoreHeartbeat(false);
    const localHbTimer = window.setInterval(writeLocalHeartbeat, 1000);
    const zcoreHbTimer = window.setInterval(() => sendZCoreHeartbeat(false), 2500);
    const onUnloadCleanup = () => {
      clearLocalHeartbeat();
      sendZCoreHeartbeat(true);
    };
    window.addEventListener('beforeunload', onUnloadCleanup);
    window.addEventListener('pagehide', onUnloadCleanup);
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('ghosti_search_window_singleton_v1');
        bc.onmessage = (ev: MessageEvent) => {
          const msg = ev.data as {
            type?: string;
            bornAt?: number;
            query?: string;
          } | null;
          if (!msg || typeof msg !== 'object') return;
          if (msg.type === 'PROBE_EXISTING' && typeof msg.bornAt === 'number' && msg.bornAt > bornAt) {
            bc?.postMessage({ type: 'EXISTING_ALIVE', bornAt });
            try {
              window.focus();
            } catch {
              /* ignore */
            }
          } else if (
            msg.type === 'EXISTING_ALIVE' &&
            typeof msg.bornAt === 'number' &&
            msg.bornAt < bornAt
          ) {
            try {
              window.close();
            } catch {
              /* ignore */
            }
          } else if (msg.type === 'FOCUS_AND_QUERY') {
            const incomingBuildId = typeof (msg as { buildId?: string }).buildId === 'string'
              ? (msg as { buildId?: string }).buildId || ''
              : '';
            if (
              incomingBuildId &&
              CURRENT_DASHBOARD_BUILD_ID &&
              incomingBuildId !== CURRENT_DASHBOARD_BUILD_ID
            ) {
              const nextQ = (msg.query || '').trim();
              if (nextQ) {
                const u = new URL(window.location.href);
                u.searchParams.set('q', nextQ);
                window.location.replace(u.toString());
              } else {
                window.location.reload();
              }
              return;
            }
            try {
              window.focus();
            } catch {
              /* ignore */
            }
            const st = useSaySeeStore.getState();
            void st.refreshLiveLocalFilesInSearchWindow();
            const nextQ = (msg.query || '').trim();
            if (nextQ && (!st.hasExecutedUserSearch || st.activeQuery !== nextQ)) {
              void st.runTextQuery(nextQ);
            }
          }
        };
        bc.postMessage({ type: 'PROBE_EXISTING', bornAt });
      }
    } catch {
      /* ignore */
    }

    return () => {
      window.removeEventListener('resize', onPassiveResize);
      window.removeEventListener('beforeunload', onUnloadCleanup);
      window.removeEventListener('pagehide', onUnloadCleanup);
      window.clearInterval(localHbTimer);
      window.clearInterval(zcoreHbTimer);
      clearLocalHeartbeat();
      sendZCoreHeartbeat(true);
      try {
        bc?.close();
      } catch {
        /* ignore */
      }
    };
  }, [ghostSearchWindowStage, isInsideIframe]);

  const switchStandaloneWindowSize = (targetMode: 'compact' | 'large') => {
    const nextIsLarge = targetMode === 'large';
    setIsGalleryViewport(nextIsLarge);
    const stNow = useSaySeeStore.getState();
    const hasQ = Boolean(stNow.hasExecutedUserSearch && stNow.activeQuery?.trim());
    const compactStage = hasQ ? 'medium' : 'small';
    const nextStage = nextIsLarge ? 'large' : compactStage;
    markGhostDojoStep(nextIsLarge ? 'large' : 'summon');
    try {
      const availW = window.screen?.availWidth || DEFAULT_WORK_AREA.right;
      const availH = window.screen?.availHeight || DEFAULT_WORK_AREA.bottom;
      const rect = computeGhostSearchWindowRect(
        nextStage,
        window.screenX || 120,
        window.screenY || 80,
        { left: 0, top: 0, right: availW, bottom: availH },
        nextStage === 'small' ? 340 : 20
      );
      window.resizeTo(rect.width, rect.height);
      window.moveTo(rect.x, rect.y);
    } catch {
      /* ignore */
    }
    const daemonStage = nextIsLarge ? 'gallery' : compactStage;
    if (zCoreBridge.isConnected) {
      void fetch(getZCoreUrl('/api/superpower/open_search_window'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: daemonStage, ui_mode: 'web_monitor', resize_existing: true }),
        signal: AbortSignal.timeout(2000),
      }).catch(() => {});
    }
  };

  useEffect(() => {
    if (!ghostSearchWindowStage) return;
    try {
      localStorage.setItem('ghosti_dojo_last_summon_ts', String(Date.now()));
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('ghosti_search_window_singleton_v1');
        bc.postMessage({ type: 'DOJO_SUMMON_OBSERVED', ts: Date.now() });
        bc.close();
      }
    } catch {
      /* ignore */
    }
    setActiveLoungeType('personal');
    setDesktopTab('dashboard');
    if (!initialized) return;
    const q = (new URLSearchParams(window.location.search).get('q') || '').trim();
    if (q && consumedUrlQueryRef.current !== q) {
      consumedUrlQueryRef.current = q;
      const st = useSaySeeStore.getState();
      if (!st.hasExecutedUserSearch || st.activeQuery !== q) {
        void st.runTextQuery(q);
      }
    }
  }, [ghostSearchWindowStage, initialized, setActiveLoungeType, setDesktopTab]);

  useEffect(() => {
    if (isMobileDrawerOpen) return;
    scrollAppToTop();
  }, [activeLoungeType, desktopTab, activeFamilyRoom, isMobileDrawerOpen]);

  return (
    <div className="min-h-screen flex bg-white text-slate-900">
      <DesktopSidebarContainer ghostSearchWindowStage={ghostSearchWindowStage} />

      <div className="flex-1 min-w-0 flex flex-col">
        {ghostSearchWindowStage && !isInsideIframe && (
          <div className="sticky top-0 z-40 h-9 px-3.5 flex items-center justify-between gap-2 bg-slate-50 border-b border-slate-200 text-slate-800 text-[12px] font-semibold">
            <span className="font-bold text-slate-900 whitespace-nowrap">
              귀신검색창
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void switchStandaloneWindowSize('compact')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  !isGalleryViewport
                    ? 'bg-slate-900 text-white'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                ⤡ 작게
              </button>
              <button
                type="button"
                onClick={() => void switchStandaloneWindowSize('large')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  isGalleryViewport
                    ? 'bg-slate-900 text-white'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                ⤢ 크게(갤러리)
              </button>
            </div>
          </div>
        )}

        <DesktopTopHeaderAndLoungeBar ghostSearchWindowStage={ghostSearchWindowStage} />

        {ghostSearchWindowStage ? (
          <GhostSearchPane ghostSearchWindowStage={ghostSearchWindowStage} />
        ) : activeLoungeType === 'work' ? (
          <PaidWorkSharePane />
        ) : desktopTab === 'sync' ? (
          <PaidDeviceSyncPane />
        ) : (
          <>
            <GhostSearchPane ghostSearchWindowStage={ghostSearchWindowStage} />
            <GhostAssistantPane />
          </>
        )}
      </div>

      <GhostPhotoOcrTeleportModal
        photo={ocrModalPhoto}
        onClose={() => setOcrModalPhoto(null)}
      />

      <MerlinZCoreGuideModal
        isOpen={showZCoreGuideModal}
        onClose={() => {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('ghosti_zcore_prompt_dismissed', '1');
          }
          setShowZCoreGuideModal(false);
        }}
      />
    </div>
  );
};
