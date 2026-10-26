/**
 * Version: v2.0.0
 * Last Updated: 2026-10-24
 */
import React from 'react';

export interface HistoryItem {
  id: string;
  inviteeNickname: string;
  inviteeEmail?: string;
  joinedAt: string;
  firstAppId?: string;
  registeredApps?: string[];
  appJoinDates?: Record<string, string>;
}

export interface HubHistoryListProps {
  className?: string;
  history?: HistoryItem[];
  isLoading?: boolean;
}

/**
 * [Deprecated] 전사 순수 공유 정책 전환에 따라 앱 초대 List UI는 비활성화되었습니다.
 * 하위 호환성을 위해 빈 컴포넌트(null)로 유지됩니다.
 */
export const HubHistoryList: React.FC<HubHistoryListProps> = () => {
  return null;
};
