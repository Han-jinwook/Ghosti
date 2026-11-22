import React from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { Stage1MinimalCarePreview } from '../../components/Stage1MinimalPreview';
import { LoungeIndexingWaitingRoom } from '../../components/LoungeView';
import { GhostSecretaryFirstGuard } from '../../components/GhostSecretaryFirstGuard';
import { MobileCleanerRescueBanner } from '../../components/MobileCleanerRescueBanner';

export const GhostAssistantPane: React.FC = () => {
  const { desktopTab, activeLoungeType } = useSaySeeStore();

  if (desktopTab !== 'trash') return null;

  return (
    <>
      {activeLoungeType === 'personal' ? (
        <>
          <Stage1MinimalCarePreview />
          <div className="w-full max-w-[1640px] mx-auto px-4 sm:px-6 md:px-8 pb-4">
            <MobileCleanerRescueBanner />
          </div>
        </>
      ) : (
        <GhostSecretaryFirstGuard>
          <LoungeIndexingWaitingRoom />
        </GhostSecretaryFirstGuard>
      )}
    </>
  );
};
