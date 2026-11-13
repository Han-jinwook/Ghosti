import React, { useState } from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { SmartTrashView } from '../../components/SmartTrashView';
import { Stage1MinimalCarePreview } from '../../components/Stage1MinimalPreview';
import { LoungeIndexingWaitingRoom } from '../../components/LoungeView';
import { GhostSecretaryFirstGuard } from '../../components/GhostSecretaryFirstGuard';

/**
 * [1번 창: 🎯 [1귀신] 전담 UI 패널]
 * - 좌측 👻 귀신비서 사진정리 · 브리핑 · 대화창 및 대기실 화면
 */
export const GhostAssistantPane: React.FC = () => {
  const { desktopTab, activeLoungeType } = useSaySeeStore();

  const [isStage1MinimalPreview] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    if (new URLSearchParams(window.location.search).get('ghostSearchWindow')) return false;
    return !window.location.search.includes('preview=legacy');
  });

  if (desktopTab !== 'trash') return null;

  return (
    <>
      {activeLoungeType === 'personal' ? (
        isStage1MinimalPreview ? (
          <Stage1MinimalCarePreview />
        ) : (
          <GhostSecretaryFirstGuard>
            <SmartTrashView />
          </GhostSecretaryFirstGuard>
        )
      ) : (
        <GhostSecretaryFirstGuard>
          <LoungeIndexingWaitingRoom />
        </GhostSecretaryFirstGuard>
      )}
    </>
  );
};
