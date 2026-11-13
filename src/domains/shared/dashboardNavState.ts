import { create } from 'zustand';
import type { PhotoItem } from '../../types/saysee';
import type {
  GhostWindowTierMode,
  GhostWindowUiTab,
} from '../../components/GhostWindowThreeStageMockup';
import { useSaySeeStore } from '../../store/useSaySeeStore';

export function scrollAppToTop(): void {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
}

export function resetToZenCanvas(): void {
  useSaySeeStore.setState({
    hasExecutedUserSearch: false,
    hasUserSelectedSearchTab: false,
  });
}

interface DashboardNavState {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
  isMobileDrawerOpen: boolean;
  setIsMobileDrawerOpen: (v: boolean) => void;
  isDeviceIntegrationOpen: boolean;
  setIsDeviceIntegrationOpen: (v: boolean) => void;
  activeIntegrationSubTab: 'devices' | 'superpower';
  setActiveIntegrationSubTab: (v: 'devices' | 'superpower') => void;
  ghostWindowTier: GhostWindowTierMode;
  setGhostWindowTier: (v: GhostWindowTierMode) => void;
  ghostWindowInitialTab: GhostWindowUiTab;
  setGhostWindowInitialTab: (v: GhostWindowUiTab) => void;
  ocrModalPhoto: PhotoItem | null;
  setOcrModalPhoto: (v: PhotoItem | null) => void;
  showZCoreGuideModal: boolean;
  setShowZCoreGuideModal: (v: boolean) => void;
}

export const useDashboardNavStore = create<DashboardNavState>((set) => ({
  isSidebarCollapsed: false,
  setIsSidebarCollapsed: (v) => set({ isSidebarCollapsed: v }),
  isMobileDrawerOpen: false,
  setIsMobileDrawerOpen: (v) => set({ isMobileDrawerOpen: v }),
  isDeviceIntegrationOpen: false,
  setIsDeviceIntegrationOpen: (v) => set({ isDeviceIntegrationOpen: v }),
  activeIntegrationSubTab: 'devices',
  setActiveIntegrationSubTab: (v) => set({ activeIntegrationSubTab: v }),
  ghostWindowTier: 'pc_free',
  setGhostWindowTier: (v) => set({ ghostWindowTier: v }),
  ghostWindowInitialTab: 'ui1_basic',
  setGhostWindowInitialTab: (v) => set({ ghostWindowInitialTab: v }),
  ocrModalPhoto: null,
  setOcrModalPhoto: (v) => set({ ocrModalPhoto: v }),
  showZCoreGuideModal: false,
  setShowZCoreGuideModal: (v) => set({ showZCoreGuideModal: v }),
}));
