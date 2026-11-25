import { create } from 'zustand';
import type { PhotoItem } from '../../types/saysee';
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
  ocrModalPhoto: PhotoItem | null;
  setOcrModalPhoto: (v: PhotoItem | null) => void;
}

const NAV_STATE_STORAGE_KEY = 'ghosti_dashboard_nav_state_v1';

interface PersistedDashboardNavSlice {
  isDeviceIntegrationOpen: boolean;
}

function loadPersistedNavSlice(): PersistedDashboardNavSlice {
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(NAV_STATE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedDashboardNavSlice>;
        return {
          isDeviceIntegrationOpen: Boolean(parsed.isDeviceIntegrationOpen),
        };
      }
    } catch {
      /* ignore */
    }
  }
  return {
    isDeviceIntegrationOpen: false,
  };
}

function savePersistedNavSlice(next: Partial<PersistedDashboardNavSlice>): void {
  if (typeof window === 'undefined') return;
  try {
    const cur = loadPersistedNavSlice();
    sessionStorage.setItem(NAV_STATE_STORAGE_KEY, JSON.stringify({ ...cur, ...next }));
  } catch {
    /* ignore */
  }
}

const initialPersistedNav = loadPersistedNavSlice();

export const useDashboardNavStore = create<DashboardNavState>((set) => ({
  isSidebarCollapsed: false,
  setIsSidebarCollapsed: (v) => set({ isSidebarCollapsed: v }),
  isMobileDrawerOpen: false,
  setIsMobileDrawerOpen: (v) => set({ isMobileDrawerOpen: v }),
  isDeviceIntegrationOpen: initialPersistedNav.isDeviceIntegrationOpen,
  setIsDeviceIntegrationOpen: (v) => {
    savePersistedNavSlice({ isDeviceIntegrationOpen: v });
    set({ isDeviceIntegrationOpen: v });
  },
  ocrModalPhoto: null,
  setOcrModalPhoto: (v) => set({ ocrModalPhoto: v }),
}));
