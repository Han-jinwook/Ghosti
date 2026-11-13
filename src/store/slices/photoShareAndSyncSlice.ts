import type { StateCreator } from 'zustand';
import type { SaySeeStore } from '../useSaySeeStore';
import {
  createFreePhotoShareSlice,
  type FreePhotoShareSlice,
} from './freePhotoShareSlice';
import {
  createPaidDeviceSyncSlice,
  type PaidDeviceSyncSlice,
} from './paidDeviceSyncSlice';

export type { FreePhotoShareSlice, PaidDeviceSyncSlice };
export { createFreePhotoShareSlice, createPaidDeviceSyncSlice };

/**
 * [3번 창: 🎯 [3귀신] 전담 통합 스토어 Slice]
 * - 📸 사진 공유(가족·동호회·동창회 무제한 0원 · 얼굴 여권) + 👑 내 기기 통합(폰↔PC 연동)
 */
export type PhotoShareAndSyncSlice = FreePhotoShareSlice & PaidDeviceSyncSlice;

export const createPhotoShareAndSyncSlice: StateCreator<
  SaySeeStore,
  [],
  [],
  PhotoShareAndSyncSlice
> = (...a) => ({
  ...createFreePhotoShareSlice(...a),
  ...createPaidDeviceSyncSlice(...a),
});
