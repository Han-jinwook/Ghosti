import React, { useEffect, useState } from 'react';
import { getZCoreUrl, zCoreBridge } from '../services/zCoreBridge';
import { computeGhostSearchWindowRect, DEFAULT_WORK_AREA } from '../services/ghostSearchWindowGeometry';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { MerlinZCoreGuideModal } from './MerlinZCoreGuideModal';
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

export const DesktopDashboard: React.FC = () => {
  const {
    desktopTab,
    setDesktopTab,
    activeLoungeType,
    setActiveLoungeType,
    activeFamilyRoom,
    themeMode,
    initialized,
  } = useSaySeeStore();

  const {
    isMobileDrawerOpen,
    showZCoreGuideModal,
    setShowZCoreGuideModal,
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
    document.title = '👻 귀신검색창 — 귀신같이(Ghosti)';
    const onPassiveResize = () => {
      const wide = (window.innerWidth || 0) >= 1180;
      setIsGalleryViewport((prev) => (prev === wide ? prev : wide));
    };
    window.addEventListener('resize', onPassiveResize, { passive: true });

    let bc: BroadcastChannel | null = null;
    const bornAt = Date.now() + Math.random();
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
            try {
              window.focus();
            } catch {
              /* ignore */
            }
            const nextQ = (msg.query || '').trim();
            if (nextQ) {
              const st = useSaySeeStore.getState();
              if (!st.hasExecutedUserSearch || st.activeQuery !== nextQ) {
                void st.runTextQuery(nextQ);
              }
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
      try {
        bc?.close();
      } catch {
        /* ignore */
      }
    };
  }, [ghostSearchWindowStage, isInsideIframe]);

  const switchStandaloneWindowSize = async (targetMode: 'compact' | 'large') => {
    const nextIsLarge = targetMode === 'large';
    setIsGalleryViewport(nextIsLarge);
    try {
      const saved = JSON.parse(localStorage.getItem('ghosti_search_game_v1') || '{}');
      localStorage.setItem(
        'ghosti_search_game_v1',
        JSON.stringify({ ...saved, summon: true, medium: true, ...(nextIsLarge ? { large: true } : {}) })
      );
    } catch {
      /* ignore */
    }
    const daemonStage = nextIsLarge ? 'gallery' : 'medium';
    if (zCoreBridge.isConnected) {
      try {
        const res = await fetch(getZCoreUrl('/api/superpower/open_search_window'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: daemonStage, ui_mode: 'web_monitor', resize_existing: true }),
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) return;
      } catch {
        /* fallback below */
      }
    }
    try {
      const availW = window.screen?.availWidth || DEFAULT_WORK_AREA.right;
      const availH = window.screen?.availHeight || DEFAULT_WORK_AREA.bottom;
      const rect = computeGhostSearchWindowRect(
        nextIsLarge ? 'large' : 'medium',
        window.screenX || 120,
        window.screenY || 80,
        { left: 0, top: 0, right: availW, bottom: availH },
        20
      );
      window.resizeTo(rect.width, rect.height);
      window.moveTo(rect.x, rect.y);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!ghostSearchWindowStage) return;
    try {
      const saved = JSON.parse(localStorage.getItem('ghosti_search_game_v1') || '{}');
      localStorage.setItem(
        'ghosti_search_game_v1',
        JSON.stringify({ ...saved, summon: true, medium: true, large: true })
      );
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
    <div className="min-h-screen flex bg-[#09090B] text-zinc-100">
      <DesktopSidebarContainer ghostSearchWindowStage={ghostSearchWindowStage} />

      <div className="flex-1 min-w-0 flex flex-col">
        {ghostSearchWindowStage && !isInsideIframe && (
          <div
            data-keep-dark="true"
            className="sticky top-0 z-40 h-9 px-3.5 flex items-center justify-between gap-2 bg-zinc-900 border-b border-white/15 text-white text-[12px] font-bold"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-[#2DD4BF] font-extrabold whitespace-nowrap">
                👻 귀신검색창
              </span>
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void switchStandaloneWindowSize('compact')}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold transition-colors cursor-pointer ${
                  !isGalleryViewport
                    ? 'bg-[#2DD4BF] text-zinc-950'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-[#5EEAD4] border border-white/10'
                }`}
              >
                ⤡ 작게
              </button>
              <button
                type="button"
                onClick={() => void switchStandaloneWindowSize('large')}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold transition-colors cursor-pointer ${
                  isGalleryViewport
                    ? 'bg-[#2DD4BF] text-zinc-950'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-[#5EEAD4] border border-white/10'
                }`}
              >
                ⤢ 크게(갤러리)
              </button>
            </div>
          </div>
        )}

        <DesktopTopHeaderAndLoungeBar ghostSearchWindowStage={ghostSearchWindowStage} />

        {/* 3창 무충돌 도메인 라우팅 스위치 (1귀신 비서 / 2귀신 검색 / 3귀신 공유·통합 / 업무 공유 S:) */}
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

      <MerlinZCoreGuideModal
        isOpen={showZCoreGuideModal}
        onClose={() => {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('ghosti_zcore_prompt_dismissed', '1');
          }
          setShowZCoreGuideModal(false);
        }}
        themeMode={themeMode}
      />
    </div>
  );
};
