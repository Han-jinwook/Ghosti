import React from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import {
  LoungeFeedContextBanner,
  LoungeIndexingWaitingRoom,
  LoungeView,
} from '../../components/LoungeView';
import { GhostSecretaryFirstGuard } from '../../components/GhostSecretaryFirstGuard';
import { PaidDeviceSyncPane } from '../paid_device_sync/PaidDeviceSyncPane';

export const PaidWorkSharePane: React.FC = () => {
  const { desktopTab } = useSaySeeStore();

  if (desktopTab === 'sync') {
    return <PaidDeviceSyncPane />;
  }

  return (
    <>
      {desktopTab === 'trial' && (
        <GhostSecretaryFirstGuard>
          <LoungeView />
        </GhostSecretaryFirstGuard>
      )}
      {desktopTab === 'dashboard' && (
        <GhostSecretaryFirstGuard>
          <main className="flex-1 w-full max-w-[1320px] mx-auto px-4 sm:px-6 md:px-10 py-6 sm:py-8 flex flex-col gap-6">
            <LoungeFeedContextBanner />
          </main>
        </GhostSecretaryFirstGuard>
      )}
      {desktopTab === 'trash' && (
        <GhostSecretaryFirstGuard>
          <LoungeIndexingWaitingRoom />
        </GhostSecretaryFirstGuard>
      )}
    </>
  );
};
