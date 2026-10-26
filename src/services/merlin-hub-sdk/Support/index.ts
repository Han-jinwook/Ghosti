export {
  initBlackbox,
  addBreadcrumb,
  getBreadcrumbs,
  getDeviceContext,
  parseErrorMetadata,
  openBugReporter,
  getStudioAuthToken,
  submitStudioSupportTicket,
  buildStudioSupportJumpUrl,
  normalizeStudioProductId,
} from './blackbox';
export type {
  HubBreadcrumb,
  HubDeviceContext,
  HubErrorMetadata,
  HubBugReportPayload,
  OpenBugReporterDetail,
} from './blackbox';

export { HubErrorBoundary } from './HubErrorBoundary';
export type { HubErrorBoundaryProps } from './HubErrorBoundary';

export { HubBugReporter } from './HubBugReporter';
export type { HubBugReporterProps } from './HubBugReporter';

export { HubSupportLink } from './HubSupportLink';
export type { HubSupportLinkProps } from './HubSupportLink';
