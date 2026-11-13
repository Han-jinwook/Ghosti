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
import {
  createAssistantOnboardingSlice,
  type AssistantOnboardingSlice,
} from './slices/assistantOnboardingSlice';
import { createSearchSlice, type SearchSlice } from './slices/searchSlice';
import {
  createPhotoShareAndSyncSlice,
  type PhotoShareAndSyncSlice,
} from './slices/photoShareAndSyncSlice';
import {
  createPaidWorkShareSlice,
  type PaidWorkShareSlice,
} from './slices/paidWorkShareSlice';

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
  AssistantOnboardingSlice &
  SearchSlice &
  PhotoShareAndSyncSlice &
  PaidWorkShareSlice;

export const useSaySeeStore = create<SaySeeStore>()((...a) => {
  applyHtmlThemeClass('light');
  return {
    ...createAssistantOnboardingSlice(...a),
    ...createSearchSlice(...a),
    ...createPhotoShareAndSyncSlice(...a),
    ...createPaidWorkShareSlice(...a),
  };
});

export const useGhostiStore = useSaySeeStore;
