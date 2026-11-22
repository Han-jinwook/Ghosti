import type { StateCreator } from 'zustand';
import type { SaySeeStore } from '../useSaySeeStore';

export interface PaidWorkShareSlice {
  workSDriveMounted: boolean;
  workSDriveMountLetter: string;
  setWorkSDriveMounted: (mounted: boolean, letter?: string) => void;
  activateWorkSharePlanShortcut: (
    planId: 'work_soho_9900' | 'work_biz_19000' | 'work_pro_29000' | 'work_biz_19900'
  ) => void;
}

export const createPaidWorkShareSlice: StateCreator<SaySeeStore, [], [], PaidWorkShareSlice> = (set, get) => ({
  workSDriveMounted: false,
  workSDriveMountLetter: 'S:',
  setWorkSDriveMounted: (workSDriveMounted, letter = 'S:') =>
    set({
      workSDriveMounted,
      workSDriveMountLetter: letter,
    }),
  activateWorkSharePlanShortcut: (planId) => {
    get().activatePricingPlan(planId);
  },
});
