import type { StateCreator } from 'zustand';
import type { SaySeeStore } from '../useSaySeeStore';
import {
  createAssistantOnboardingSlice,
  type AssistantOnboardingSlice,
} from './assistantOnboardingSlice';
import { createSearchSlice, type SearchSlice } from './searchSlice';

export type FreePersonalSlice = AssistantOnboardingSlice & SearchSlice;

export const createFreePersonalSlice: StateCreator<
  SaySeeStore,
  [],
  [],
  FreePersonalSlice
> = (...a) => ({
  ...createAssistantOnboardingSlice(...a),
  ...createSearchSlice(...a),
});
