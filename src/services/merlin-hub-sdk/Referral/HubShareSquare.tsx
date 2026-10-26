/**
 * Version: v3.0.0
 * Last Updated: 2026-10-27
 * [전사 정책 확정]:
 * - 허브 차원의 일반 공유 카드(HubShareSquare)는 전면 영구 폐지되었습니다.
 * - 모든 공유/초대는 각 앱의 고유 실무 기능 내부에서만 수행합니다.
 */
import React from 'react';

export interface HubShareSquareProps {
  className?: string;
  customTitle?: string;
  customUrl?: string;
  description?: string;
  shareMessage?: string;
  shareOutgoingTitle?: string;
}

export const HubShareSquare: React.FC<HubShareSquareProps> = () => {
  return null;
};
