// Public API for sync-ui module.

export { useSyncPr, type UseSyncPrReturn } from './use-sync-pr';
export {
  type SyncPhase,
  type SyncState,
  type SyncConnectionSettings,
  type PrResult,
  type SyncRevision,
  INITIAL_SYNC_STATE,
  transitionToReady,
  transitionToExporting,
  transitionToValidating,
  transitionToCreatingPr,
  transitionToPrCreated,
  transitionToConflictDetected,
  transitionToValidationFailed,
  transitionToAuthExpired,
  transitionToChangesNotSynced,
  resetToReady,
  isConnected,
  canCreatePr,
  isInProgress,
  canRetry,
  phaseLabel,
} from './sync-state';
export {
  emitSyncEvent,
  onSyncEvent,
  type SyncEventName,
  type SyncEventPayload,
} from './analytics';
