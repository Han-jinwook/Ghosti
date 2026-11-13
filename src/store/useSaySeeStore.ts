import { create } from 'zustand';
import {
  applyHtmlThemeClass,
  buildBidirectionalStickKeywords,
  buildYearEquivalenceTokens,
  deriveLoungeProperNounTokens,
  getActivePersonaForCluster,
  SEASON_TO_MONTH_SYNONYM_INDEX,
} from './slices/storeSharedRefs';
import type {
  DesktopTab,
  MobileTab,
  ThemeMode,
  ViewportLayout,
} from './slices/storeSharedRefs';
import { createFreePersonalSlice, type FreePersonalSlice } from './slices/freePersonalSlice';
import { createFreePhotoShareSlice, type FreePhotoShareSlice } from './slices/freePhotoShareSlice';
import { createPaidDeviceSyncSlice, type PaidDeviceSyncSlice } from './slices/paidDeviceSyncSlice';
import { createPaidWorkShareSlice, type PaidWorkShareSlice } from './slices/paidWorkShareSlice';

export type { ViewportLayout, MobileTab, DesktopTab, ThemeMode };
export {
  SEASON_TO_MONTH_SYNONYM_INDEX,
  buildYearEquivalenceTokens,
  deriveLoungeProperNounTokens,
  buildBidirectionalStickKeywords,
  getActivePersonaForCluster,
};

export interface SaySeeCoreState {
  themeMode: ThemeMode;
  layout: ViewportLayout;
  mobileTab: MobileTab;
  desktopTab: DesktopTab;
}

export type SaySeeStore = SaySeeCoreState &
  FreePersonalSlice &
  FreePhotoShareSlice &
  PaidDeviceSyncSlice &
  PaidWorkShareSlice;

export const useSaySeeStore = create<SaySeeStore>()((...a) => {
  applyHtmlThemeClass('light');
  return {
    ...createFreePersonalSlice(...a),
    ...createFreePhotoShareSlice(...a),
    ...createPaidDeviceSyncSlice(...a),
    ...createPaidWorkShareSlice(...a),
  };
});

export const useGhostiStore = useSaySeeStore;
