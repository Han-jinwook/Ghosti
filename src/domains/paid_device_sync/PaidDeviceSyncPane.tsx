import React from 'react';
import { useSaySeeStore } from '../../store/useSaySeeStore';
import { isMobileOrStoreRuntime } from '../../store/slices/storeSharedRefs';
import { LoungeCustomSettingsHeader } from '../../components/LoungeView';
import { GhostSecretaryFirstGuard } from '../../components/GhostSecretaryFirstGuard';
import { DeviceIntegrationBeforeAfterShowcase } from './DeviceIntegrationBeforeAfterShowcase';

export const PaidDeviceSyncPane: React.FC = () => {
  const { desktopTab, activeLoungeType, isStoreAppMode } = useSaySeeStore();
  const hidePricingForStore = Boolean(isStoreAppMode) || isMobileOrStoreRuntime();

  return (
    <>
      {desktopTab === 'sync' && (
        <main className="flex-1 w-full max-w-[1160px] mx-auto px-5 md:px-8 py-7 flex flex-col gap-4">
          <GhostSecretaryFirstGuard>
            {activeLoungeType === 'personal' ? (
              <>
                <DeviceIntegrationBeforeAfterShowcase isStoreAppMode={hidePricingForStore} />
                <LoungeCustomSettingsHeader />
              </>
            ) : (
              <LoungeCustomSettingsHeader />
            )}
          </GhostSecretaryFirstGuard>
        </main>
      )}
    </>
  );
};
