import React, { useEffect, useState } from 'react';
import { zCoreBridge } from '../services/zCoreBridge';
import { useSaySeeStore } from '../store/useSaySeeStore';
import {
  computeGhostSearchWindowRect,
  resolveGhostSearchResponsiveSpec,
  type GhostSearchStage,
} from '../services/ghostSearchWindowGeometry';
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
import { FreePersonalPane } from '../domains/free_personal/FreePersonalPane';
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
    matchedLocalDocs,
    matchedVaultPhotos,
    matchedVideoScenes,
    activeQuery,
    searchResults,
    themeMode,
    hasExecutedUserSearch,
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

  const [ghostSearchWindowStage, setGhostSearchWindowStage] = useState<
    'small' | 'medium' | 'large' | null
  >(() => {
    if (typeof window === 'undefined') return null;
    const v = new URLSearchParams(window.location.search).get('ghostSearchWindow');
    if (v === 'compact') return 'small';
    return v === 'small' || v === 'medium' || v === 'large' ? v : null;
  });

  const [ghostSearchAnchor] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 200, y: 120 };
    return { x: window.screenX || 200, y: window.screenY || 120 };
  });

  const [isInsideIframe] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  });

  const applyStandaloneWindowGeometry = (nextStage: GhostSearchStage, customHeight?: number) => {
    setGhostSearchWindowStage(nextStage);
    try {
      const prev = JSON.parse(localStorage.getItem('ghosti_search_game_v1') || '{}');
      const next = {
        ...prev,
        summon: true,
        ...(nextStage === 'medium' ? { medium: true } : {}),
        ...(nextStage === 'large' ? { medium: true, large: true } : {}),
      };
      localStorage.setItem('ghosti_search_game_v1', JSON.stringify(next));
    } catch {
      /* ignore */
    }
    try {
      const rect = computeGhostSearchWindowRect(
        nextStage,
        ghostSearchAnchor.x,
        ghostSearchAnchor.y,
        {
          left: 0,
          top: 0,
          right: window.screen?.availWidth || 1920,
          bottom: window.screen?.availHeight || 1040,
        },
        20,
        customHeight
      );
      window.resizeTo(rect.width, rect.height);
      window.moveTo(rect.x, rect.y);
    } catch {
      /* ignore */
    }
  };

  const toggleStandaloneGhostSearchLargeMode = () => {
    if (!ghostSearchWindowStage) return;
    if (ghostSearchWindowStage === 'large') {
      const totalMatched =
        searchResults.length +
        matchedLocalDocs.length +
        matchedVaultPhotos.length +
        matchedVideoScenes.length;
      const spec = resolveGhostSearchResponsiveSpec({
        mode: 'compact',
        hasQuery: Boolean(hasExecutedUserSearch && activeQuery.trim()),
        resultCount: totalMatched,
        hasRichPreview:
          searchResults.length > 0 || matchedVaultPhotos.length > 0 || matchedLocalDocs.length > 0,
      });
      applyStandaloneWindowGeometry(spec.stage, spec.customHeight);
    } else {
      applyStandaloneWindowGeometry('large');
    }
  };

  useEffect(() => {
    if (!ghostSearchWindowStage || ghostSearchWindowStage === 'large' || isInsideIframe) return;
    const timer = window.setTimeout(() => {
      const cleanQ =
        hasExecutedUserSearch &&
        activeQuery &&
        !activeQuery.startsWith('전체 갤러리 사진') &&
        !activeQuery.startsWith('동영상 ') &&
        !activeQuery.startsWith('최근 서류 ')
          ? activeQuery.trim()
          : '';
      const totalMatched =
        searchResults.length +
        matchedLocalDocs.length +
        matchedVaultPhotos.length +
        matchedVideoScenes.length;
      const spec = resolveGhostSearchResponsiveSpec({
        mode: 'compact',
        hasQuery: Boolean(cleanQ),
        resultCount: totalMatched,
        hasRichPreview:
          searchResults.length > 0 || matchedVaultPhotos.length > 0 || matchedLocalDocs.length > 0,
      });
      applyStandaloneWindowGeometry(spec.stage, spec.customHeight);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [
    ghostSearchWindowStage,
    isInsideIframe,
    hasExecutedUserSearch,
    activeQuery,
    searchResults.length,
    matchedLocalDocs.length,
    matchedVaultPhotos.length,
    matchedVideoScenes.length,
  ]);

  useEffect(() => {
    if (!ghostSearchWindowStage) return;
    setActiveLoungeType('personal');
    setDesktopTab('dashboard');
    if (!initialized) return;
    const q = (new URLSearchParams(window.location.search).get('q') || '').trim();
    const st = useSaySeeStore.getState();
    if (q && (!st.hasExecutedUserSearch || st.activeQuery !== q)) {
      void st.runTextQuery(q);
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
          <div className="sticky top-0 z-40 h-9 px-3 flex items-center justify-between bg-zinc-900 border-b border-white/15 text-white text-[12px] font-bold">
            <span className="flex items-center gap-1.5">
              <span>👻 귀신검색창</span>
              <span className="text-[11px] text-[#5EEAD4]">
                {ghostSearchWindowStage === 'large'
                  ? '· 크게 (갤러리 1440×900)'
                  : ghostSearchWindowStage === 'medium'
                    ? '· 작게 (검색량 반응형 확장 · 960×640)'
                    : '· 작게 (자율 슬림 · 520px)'}
              </span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleStandaloneGhostSearchLargeMode}
                title="크게(갤러리) / 작게(자율 반응형) 전환"
                className={`px-2.5 py-0.5 rounded cursor-pointer transition-colors ${
                  ghostSearchWindowStage === 'large'
                    ? 'bg-[#2DD4BF] text-zinc-950 font-extrabold'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-[#5EEAD4] font-extrabold border border-[#2DD4BF]/40'
                }`}
              >
                {ghostSearchWindowStage === 'large' ? '⤡ 작게' : '⤢ 크게(갤러리)'}
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    window.close();
                  } catch {
                    /* ignore */
                  }
                }}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <DesktopTopHeaderAndLoungeBar ghostSearchWindowStage={ghostSearchWindowStage} />

        {/* 3대 도메인 라우팅 스위치 (1·2번 무료 / 3번 내 기기 통합·귀신창 / 4번 업무 공유 S:) */}
        {activeLoungeType === 'work' ? (
          <PaidWorkSharePane />
        ) : desktopTab === 'sync' ? (
          <PaidDeviceSyncPane />
        ) : (
          <FreePersonalPane ghostSearchWindowStage={ghostSearchWindowStage} />
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
