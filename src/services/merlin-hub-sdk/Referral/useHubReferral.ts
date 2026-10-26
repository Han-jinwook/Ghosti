/**
 * Version: v2.0.0
 * Last Updated: 2026-10-24
 */
import { useState, useCallback } from 'react';

/**
 * [Core] 전사 순수 공유 전환에 따라 초대 코드 및 추천 실적 조회는 무동작(No-op) 호환 훅으로 유지됩니다.
 */
export function useHubReferral() {
  const [isLoading] = useState(false);

  const getMyReferralInfo = useCallback(async () => {
    return {
      code: '',
      inviteCount: 0,
      totalReward: 0,
    };
  }, []);

  const registerInviter = useCallback(async (_code: string) => {
    return false;
  }, []);

  const getReferralHistory = useCallback(async () => {
    return [] as any[];
  }, []);

  return {
    isLoading,
    getMyReferralInfo,
    registerInviter,
    getReferralHistory,
    registerInviteeFlow: registerInviter,
  };
}
