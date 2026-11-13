import React from 'react';
import { GhostAssistantPane } from '../assistant/GhostAssistantPane';
import { GhostSearchPane } from '../search/GhostSearchPane';

export { GhostAssistantPane } from '../assistant/GhostAssistantPane';
export { GhostSearchPane } from '../search/GhostSearchPane';

export const FreePersonalPane: React.FC<{
  ghostSearchWindowStage: 'small' | 'medium' | 'large' | null;
}> = ({ ghostSearchWindowStage }) => (
  <>
    <GhostSearchPane ghostSearchWindowStage={ghostSearchWindowStage} />
    <GhostAssistantPane />
  </>
);
