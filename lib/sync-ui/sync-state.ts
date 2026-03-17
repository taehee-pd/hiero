/**
 * Sync state machine for PR-based GitHub sync.
 *
 * States:
 *   not_connected  → ready (after settings configured)
 *   ready          → exporting | changes_not_synced
 *   changes_not_synced → exporting
 *   exporting      → validating | validation_failed
 *   validating     → creating_pr | conflict_detected | validation_failed
 *   creating_pr    → pr_created | conflict_detected | validation_failed
 *   pr_created     → ready (reset)
 *   conflict_detected → exporting (retry after re-export)
 *   validation_failed → exporting (retry)
 *   auth_expired   → ready (after re-auth)
 */

import type { SourcePayloadFile } from '@/lib/sync-source/types';
import type { IconChange } from '@/lib/sync-service/diff-source';
import type { Conflict } from '@/lib/sync-service/conflicts';

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export type SyncPhase =
  | 'not_connected'
  | 'ready'
  | 'changes_not_synced'
  | 'exporting'
  | 'validating'
  | 'creating_pr'
  | 'pr_created'
  | 'conflict_detected'
  | 'validation_failed'
  | 'auth_expired';

// ---------------------------------------------------------------------------
// Sync state
// ---------------------------------------------------------------------------

export type SyncConnectionSettings = {
  owner: string;
  repo: string;
  baseBranch: string;
  packagePath: string;
};

export type PrResult = {
  number: number;
  url: string;
  branch: string;
  commitSha: string;
};

export type SyncRevision = {
  baseBranchHeadSha: string;
  lastSyncedCommitSha: string;
  /** Files from the last successful sync. */
  previousFiles: SourcePayloadFile[];
};

export type SyncState = {
  phase: SyncPhase;
  settings: SyncConnectionSettings;

  /** Populated during export. */
  currentFiles: SourcePayloadFile[];
  /** Populated after diff. */
  iconChanges: IconChange[];
  fileCount: number;

  /** Set after successful PR creation. */
  prResult: PrResult | null;
  /** Revision tracking from last successful sync. */
  revision: SyncRevision | null;

  /** Set when conflicts are detected. */
  conflicts: Conflict[];

  /** Human-readable error message for failed states. */
  errorMessage: string | null;
  /** Short status for progress display. */
  statusMessage: string | null;
};

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const INITIAL_SYNC_STATE: SyncState = {
  phase: 'not_connected',
  settings: { owner: '', repo: '', baseBranch: 'main', packagePath: '' },
  currentFiles: [],
  iconChanges: [],
  fileCount: 0,
  prResult: null,
  revision: null,
  conflicts: [],
  errorMessage: null,
  statusMessage: null,
};

// ---------------------------------------------------------------------------
// Transitions (pure functions)
// ---------------------------------------------------------------------------

export function transitionToReady(
  state: SyncState,
  settings: SyncConnectionSettings,
): SyncState {
  return {
    ...state,
    phase: 'ready',
    settings,
    errorMessage: null,
    statusMessage: null,
    prResult: null,
    conflicts: [],
  };
}

export function transitionToExporting(state: SyncState): SyncState {
  return {
    ...state,
    phase: 'exporting',
    statusMessage: 'Preparing icon sources for review...',
    errorMessage: null,
    conflicts: [],
  };
}

export function transitionToValidating(
  state: SyncState,
  files: SourcePayloadFile[],
  iconChanges: IconChange[],
): SyncState {
  return {
    ...state,
    phase: 'validating',
    currentFiles: files,
    iconChanges,
    fileCount: files.length,
    statusMessage: 'Checking for conflicts...',
  };
}

export function transitionToCreatingPr(state: SyncState): SyncState {
  return {
    ...state,
    phase: 'creating_pr',
    statusMessage: 'Opening pull request...',
  };
}

export function transitionToPrCreated(
  state: SyncState,
  result: PrResult,
  revision: SyncRevision,
): SyncState {
  return {
    ...state,
    phase: 'pr_created',
    prResult: result,
    revision,
    currentFiles: [],
    statusMessage: 'Pull request created successfully.',
    errorMessage: null,
    conflicts: [],
  };
}

export function transitionToConflictDetected(
  state: SyncState,
  conflicts: Conflict[],
): SyncState {
  return {
    ...state,
    phase: 'conflict_detected',
    conflicts,
    statusMessage: null,
    errorMessage: conflictsToMessage(conflicts),
  };
}

export function transitionToValidationFailed(
  state: SyncState,
  errorMessage: string,
): SyncState {
  return {
    ...state,
    phase: 'validation_failed',
    statusMessage: null,
    errorMessage,
  };
}

export function transitionToAuthExpired(state: SyncState): SyncState {
  return {
    ...state,
    phase: 'auth_expired',
    statusMessage: null,
    errorMessage: 'Authentication expired. Please reconnect your repository.',
  };
}

export function transitionToChangesNotSynced(
  state: SyncState,
  iconChanges: IconChange[],
  files: SourcePayloadFile[],
): SyncState {
  return {
    ...state,
    phase: 'changes_not_synced',
    iconChanges,
    currentFiles: files,
    fileCount: files.length,
    statusMessage: null,
    errorMessage: null,
  };
}

export function resetToReady(state: SyncState): SyncState {
  return {
    ...state,
    phase: 'ready',
    currentFiles: [],
    iconChanges: [],
    fileCount: 0,
    prResult: null,
    conflicts: [],
    errorMessage: null,
    statusMessage: null,
  };
}

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------

export function isConnected(state: SyncState): boolean {
  const { owner, repo, baseBranch } = state.settings;
  return Boolean(owner && repo && baseBranch);
}

export function canCreatePr(state: SyncState): boolean {
  return (
    state.phase === 'changes_not_synced' ||
    state.phase === 'ready'
  ) && isConnected(state);
}

export function isInProgress(state: SyncState): boolean {
  return (
    state.phase === 'exporting' ||
    state.phase === 'validating' ||
    state.phase === 'creating_pr'
  );
}

export function canRetry(state: SyncState): boolean {
  return (
    state.phase === 'conflict_detected' ||
    state.phase === 'validation_failed' ||
    state.phase === 'auth_expired'
  );
}

export function phaseLabel(phase: SyncPhase): string {
  switch (phase) {
    case 'not_connected':
      return 'Not connected';
    case 'ready':
      return 'Ready';
    case 'changes_not_synced':
      return 'Changes ready';
    case 'exporting':
      return 'Preparing...';
    case 'validating':
      return 'Checking...';
    case 'creating_pr':
      return 'Creating PR...';
    case 'pr_created':
      return 'PR created';
    case 'conflict_detected':
      return 'Conflict detected';
    case 'validation_failed':
      return 'Validation failed';
    case 'auth_expired':
      return 'Auth expired';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function conflictsToMessage(conflicts: Conflict[]): string {
  if (conflicts.length === 0) return 'Unknown conflict.';
  if (conflicts.length === 1) return conflicts[0]!.message;
  return `${conflicts.length} conflicts detected:\n${conflicts.map((c) => `- ${c.message}`).join('\n')}`;
}
