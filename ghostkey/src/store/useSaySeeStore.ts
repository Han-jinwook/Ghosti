import { create } from 'zustand';
import type {
  LocalDocumentFile,
  LoungeType,
  PhotoItem,
  SearchSpaceMode,
} from '@shared/types/saysee';
import type { GhostKeyPricingPlanId as PricingPlanId } from '../services/subscriptionPlanCatalog';
import {
  activateDevicePlanPersistent,
  type GhostiConnectedDeviceDto,
  type GhostiDeviceEntitlementView,
  type GhostiSyncedClipItem,
} from '@shared/services/deviceIntegrationService';

export type ViewportLayout = 'desktop' | 'mobile';
export type MobileTab = 'trial' | 'trash' | 'search' | 'share' | 'settings';
export type DesktopTab =
  | 'trial'
  | 'trash'
  | 'dashboard'
  | 'sync'
  | 'share'
  | 'settings'
  | 'superpower_dojo'
  | 'search_dojo';
export type ThemeMode = 'light' | 'dark';

export function resolveViewportLayout(): ViewportLayout {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < 860 ? 'mobile' : 'desktop';
}

export function applyHtmlThemeClass(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  if (mode === 'light') {
    html.classList.add('theme-warm-light');
    html.classList.remove('dark');
  } else {
    html.classList.remove('theme-warm-light');
    html.classList.add('dark');
  }
}

export interface MerlinAuthState {
  token: string;
  userId: string;
  email: string;
  coinBalance: number;
  provider?: string;
}

export interface SaySeeStore {
  themeMode: ThemeMode;
  layout: ViewportLayout;
  mobileTab: MobileTab;
  desktopTab: DesktopTab;
  activeLoungeType: LoungeType;
  isStoreAppMode: boolean;
  enableMobileCoinDisplay: boolean;

  merlinAuth: MerlinAuthState;
  deviceEntitlement: GhostiDeviceEntitlementView | null;
  connectedDevices: GhostiConnectedDeviceDto[];
  devicePairingCode6: string | null;
  pcAgentPairedMobile: boolean;
  syncedClipboardItems: GhostiSyncedClipItem[];

  activePricingPlan: PricingPlanId;
  subscribedLounges: Partial<Record<LoungeType, PricingPlanId>>;
  subscriptionCheckoutPlanId: PricingPlanId | null;
  showProModal: boolean;
  lastQuarantineToast: string | null;

  // 하위 호환용 경량 필드 (귀신Key 웹에서는 빈 값 유지)
  photos: PhotoItem[];
  videoSceneItems: unknown[];
  localDocuments: LocalDocumentFile[];
  matchedVaultPhotos: PhotoItem[];
  activeSharedRoomId: string | null;
  activeJoinedRoomMeta: unknown | null;
  joinedSharedRooms: unknown[];
  sharedRoomAddedPhotos: PhotoItem[];
  sharedRoomHostPhotos: PhotoItem[];
  searchResults: PhotoItem[];
  isInvitedMemberSession: boolean;
  showSharedPhotoUploadModal: boolean;
  doorplatePickerClusterId: string | null;
  hasUserSelectedSearchTab: boolean;

  setLayout: (layout: ViewportLayout) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setDesktopTab: (tab: DesktopTab) => void;
  setMobileTab: (tab: MobileTab) => void;
  setActiveLoungeType: (lounge: LoungeType) => void;
  setShowProModal: (open: boolean) => void;
  openSubscriptionCheckout: (planId: PricingPlanId) => void;
  closeSubscriptionCheckout: () => void;
  dismissQuarantineToast: () => void;
  setLastQuarantineToast: (msg: string | null) => void;
  setDoorplatePickerClusterId: (id: string | null) => void;
  activate30DayDeviceTrialNow: () => Promise<boolean>;
  setDeviceIntegrationSnapshot: (snap: {
    devices?: GhostiConnectedDeviceDto[];
    pairingCode?: string | null;
    entitlement?: GhostiDeviceEntitlementView | null;
  }) => void;
  initApp: (_force?: boolean) => Promise<void>;
  setSearchSpace: (_mode: SearchSpaceMode) => void;
  resetSearchSpaceToAll: (_mode?: SearchSpaceMode) => void;
}

export const useSaySeeStore = create<SaySeeStore>()((set, get) => {
  applyHtmlThemeClass('light');
  return {
    themeMode: 'light',
    layout: resolveViewportLayout(),
    mobileTab: 'settings',
    desktopTab: 'superpower_dojo',
    activeLoungeType: 'personal',
    isStoreAppMode: false,
    enableMobileCoinDisplay: true,

    merlinAuth: {
      token: '',
      userId: 'guest',
      email: '',
      coinBalance: 0,
    },
    deviceEntitlement: null,
    connectedDevices: [],
    devicePairingCode6: null,
    pcAgentPairedMobile: false,
    syncedClipboardItems: [],

    activePricingPlan: 'free_trial',
    subscribedLounges: {},
    subscriptionCheckoutPlanId: null,
    showProModal: false,
    lastQuarantineToast: null,

    photos: [],
    videoSceneItems: [],
    localDocuments: [],
    matchedVaultPhotos: [],
    activeSharedRoomId: null,
    activeJoinedRoomMeta: null,
    joinedSharedRooms: [],
    sharedRoomAddedPhotos: [],
    sharedRoomHostPhotos: [],
    searchResults: [],
    isInvitedMemberSession: false,
    showSharedPhotoUploadModal: false,
    doorplatePickerClusterId: null,
    hasUserSelectedSearchTab: false,

    setLayout: (layout) => set({ layout }),
    setThemeMode: () => {
      applyHtmlThemeClass('light');
      set({ themeMode: 'light' });
    },
    setDesktopTab: (desktopTab) => set({ desktopTab }),
    setMobileTab: (mobileTab) => set({ mobileTab }),
    setActiveLoungeType: (activeLoungeType) => set({ activeLoungeType }),
    setShowProModal: (showProModal) => set({ showProModal }),
    openSubscriptionCheckout: (planId) =>
      set({ subscriptionCheckoutPlanId: planId, showProModal: false }),
    closeSubscriptionCheckout: () => set({ subscriptionCheckoutPlanId: null }),
    dismissQuarantineToast: () => set({ lastQuarantineToast: null }),
    setLastQuarantineToast: (lastQuarantineToast) => set({ lastQuarantineToast }),
    setDoorplatePickerClusterId: (doorplatePickerClusterId) => set({ doorplatePickerClusterId }),

    activate30DayDeviceTrialNow: async () => {
      const res = await activateDevicePlanPersistent('ghostkey_trial_opt_in_30d');
      if (res.ok && res.entitlement) {
        set({
          deviceEntitlement: res.entitlement,
          lastQuarantineToast: '🎁 귀신Key 30일 무카드 풀파워 체험이 시작되었습니다!',
        });
        return true;
      }
      if (res.message) {
        set({ lastQuarantineToast: res.message });
      }
      return false;
    },

    setDeviceIntegrationSnapshot: (snap) =>
      set((state) => ({
        ...(snap.devices ? { connectedDevices: snap.devices } : {}),
        ...(snap.pairingCode !== undefined ? { devicePairingCode6: snap.pairingCode } : {}),
        ...(snap.entitlement !== undefined
          ? {
              deviceEntitlement: snap.entitlement,
              activePricingPlan: snap.entitlement?.isPaidUnlimited
                ? ((snap.entitlement.planId as PricingPlanId) || 'ghostkey_sub_1900')
                : state.activePricingPlan,
            }
          : {}),
      })),

    initApp: async () => {
      /* GhostKey 웹은 온디바이스 사진/문서 인덱싱을 실행하지 않음 */
    },
    setSearchSpace: () => {
      /* no-op in GhostKey */
    },
    resetSearchSpaceToAll: () => {
      /* no-op in GhostKey */
    },
  };
});

export const useGhostiStore = useSaySeeStore;
