import React from 'react';
import { GhostSecretaryFirstGuard } from '../../components/GhostSecretaryFirstGuard';
import { WorkLoungeB2BHub } from './WorkLoungeB2BHub';

export const PaidWorkSharePane: React.FC = () => {
  return (
    <GhostSecretaryFirstGuard>
      <main className="flex-1 w-full max-w-[1320px] mx-auto px-4 sm:px-6 md:px-10 py-6 sm:py-8 flex flex-col gap-6">
        <WorkLoungeB2BHub />
      </main>
    </GhostSecretaryFirstGuard>
  );
};
