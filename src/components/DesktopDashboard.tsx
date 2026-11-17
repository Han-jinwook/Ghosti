import React, { useEffect, useState } from 'react';
import { zCoreBridge } from '../services/zCoreBridge';
import { useSaySeeStore } from '../store/useSaySeeStore';
import { GhostPhotoOcrTeleportModal } from './GhostWindowThreeStageMockup';
import { MerlinZCoreGuideModal } from './MerlinZCoreGuideModal';
import { GhostSecretaryFirstModal } from './GhostSecretaryFirstGuard';
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
import { FreePhotoShareOverlays } from '../domains/free_photo_share/FreePhotoShareOverlays';

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
    ocrModalPhoto,
    setOcrModalPhoto,
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
            className="sticky top-0 z-40 h-9 px-3.5 flex items-center justify-between bg-zinc-900 border-b border-white/15 text-white text-[12px] font-bold"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-[#2DD4BF] font-extrabold whitespace-nowrap">
                👻 귀신검색창
              </span>
            </span>
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

      <GhostPhotoOcrTeleportModal photo={ocrModalPhoto} onClose={() => setOcrModalPhoto(null)} />
      <GhostSecretaryFirstModal themeMode={themeMode} />
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
      <FreePhotoShareOverlays />
    </div>
  );
};
