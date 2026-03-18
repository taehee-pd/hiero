import { describe, expect, test } from 'bun:test';

import type { IconChange } from '../lib/sync-service/diff-source';
import type { Conflict } from '../lib/sync-service/conflicts';
import {
  type SyncState,
  type SyncConnectionSettings,
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
} from '../lib/sync-ui/sync-state';
import {
  emitSyncEvent,
  onSyncEvent,
  type SyncEventName,
  type SyncEventPayload,
} from '../lib/sync-ui/analytics';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_SETTINGS: SyncConnectionSettings = {
  owner: 'test-org',
  repo: 'icons',
  baseBranch: 'main',
  packagePath: 'packages/icons',
};

const TEST_FILES = [
  { path: 'icons/chevron/icon.json', contents: '{}' },
  { path: 'icons/chevron/preview.svg', contents: '<svg/>' },
  { path: 'manifest.json', contents: '{}' },
];

const TEST_ICON_CHANGES: IconChange[] = [
  { iconDir: 'chevron', kind: 'updated' },
  { iconDir: 'play', kind: 'added' },
];

const TEST_CONFLICTS: Conflict[] = [
  {
    kind: 'base-sha-drift',
    code: 'STALE_BASE_REVISION',
    message: 'Branch advanced since export.',
    suggestedActions: ['refresh-and-re-export', 'force-sync'],
  },
  {
    kind: 'icon-deleted-remotely',
    code: 'ICON_DELETED_REMOTELY',
    message: 'play was deleted remotely.',
    suggestedActions: ['discard-deleted-icons', 'refresh-and-re-export', 'force-sync'],
    iconDirs: ['play'],
  },
];

// ===========================================================================
// Initial state
// ===========================================================================

describe('INITIAL_SYNC_STATE', () => {
  test('starts in not_connected phase', () => {
    expect(INITIAL_SYNC_STATE.phase).toBe('not_connected');
  });

  test('has empty settings', () => {
    expect(INITIAL_SYNC_STATE.settings.owner).toBe('');
    expect(INITIAL_SYNC_STATE.settings.repo).toBe('');
  });

  test('has no files, changes, or errors', () => {
    expect(INITIAL_SYNC_STATE.currentFiles).toHaveLength(0);
    expect(INITIAL_SYNC_STATE.iconChanges).toHaveLength(0);
    expect(INITIAL_SYNC_STATE.prResult).toBeNull();
    expect(INITIAL_SYNC_STATE.errorMessage).toBeNull();
  });
});

// ===========================================================================
// State transitions
// ===========================================================================

describe('transitionToReady', () => {
  test('sets phase to ready with settings', () => {
    const next = transitionToReady(INITIAL_SYNC_STATE, TEST_SETTINGS);
    expect(next.phase).toBe('ready');
    expect(next.settings).toEqual(TEST_SETTINGS);
    expect(next.errorMessage).toBeNull();
  });

  test('clears prior error and conflict state', () => {
    const errState: SyncState = {
      ...INITIAL_SYNC_STATE,
      phase: 'validation_failed',
      errorMessage: 'previous error',
      conflicts: TEST_CONFLICTS,
    };
    const next = transitionToReady(errState, TEST_SETTINGS);
    expect(next.errorMessage).toBeNull();
    expect(next.conflicts).toHaveLength(0);
  });
});

describe('transitionToExporting', () => {
  test('sets phase to exporting with status message', () => {
    const ready = transitionToReady(INITIAL_SYNC_STATE, TEST_SETTINGS);
    const next = transitionToExporting(ready);
    expect(next.phase).toBe('exporting');
    expect(next.statusMessage).toBeTruthy();
    expect(next.errorMessage).toBeNull();
  });
});

describe('transitionToValidating', () => {
  test('sets files and icon changes', () => {
    const exporting = transitionToExporting(
      transitionToReady(INITIAL_SYNC_STATE, TEST_SETTINGS),
    );
    const next = transitionToValidating(exporting, TEST_FILES, TEST_ICON_CHANGES);
    expect(next.phase).toBe('validating');
    expect(next.currentFiles).toEqual(TEST_FILES);
    expect(next.iconChanges).toEqual(TEST_ICON_CHANGES);
    expect(next.fileCount).toBe(3);
  });
});

describe('transitionToCreatingPr', () => {
  test('sets phase and status', () => {
    const next = transitionToCreatingPr(
      transitionToReady(INITIAL_SYNC_STATE, TEST_SETTINGS),
    );
    expect(next.phase).toBe('creating_pr');
    expect(next.statusMessage).toContain('pull request');
  });
});

describe('transitionToPrCreated', () => {
  test('stores PR result and revision', () => {
    const state = transitionToReady(INITIAL_SYNC_STATE, TEST_SETTINGS);
    const next = transitionToPrCreated(
      state,
      { number: 42, url: 'https://github.com/pr/42', branch: 'icons/update', commitSha: 'abc' },
      { baseBranchHeadSha: 'sha-1', lastSyncedCommitSha: 'sha-2', previousFiles: TEST_FILES },
    );

    expect(next.phase).toBe('pr_created');
    expect(next.prResult!.number).toBe(42);
    expect(next.prResult!.url).toBe('https://github.com/pr/42');
    expect(next.revision!.baseBranchHeadSha).toBe('sha-1');
    expect(next.revision!.previousFiles).toEqual(TEST_FILES);
    expect(next.errorMessage).toBeNull();
    expect(next.conflicts).toHaveLength(0);
  });

  test('clears current files (they are now in revision.previousFiles)', () => {
    const state = transitionToReady(INITIAL_SYNC_STATE, TEST_SETTINGS);
    const next = transitionToPrCreated(
      { ...state, currentFiles: TEST_FILES },
      { number: 1, url: '', branch: '', commitSha: '' },
      { baseBranchHeadSha: '', lastSyncedCommitSha: '', previousFiles: TEST_FILES },
    );
    expect(next.currentFiles).toHaveLength(0);
  });
});

describe('transitionToConflictDetected', () => {
  test('stores conflicts and sets error message', () => {
    const state = transitionToReady(INITIAL_SYNC_STATE, TEST_SETTINGS);
    const next = transitionToConflictDetected(state, TEST_CONFLICTS);

    expect(next.phase).toBe('conflict_detected');
    expect(next.conflicts).toEqual(TEST_CONFLICTS);
    expect(next.errorMessage).toContain('2 conflicts');
  });

  test('single conflict uses its message directly', () => {
    const next = transitionToConflictDetected(INITIAL_SYNC_STATE, [TEST_CONFLICTS[0]!]);
    expect(next.errorMessage).toBe('Branch advanced since export.');
  });
});

describe('transitionToValidationFailed', () => {
  test('stores error message', () => {
    const next = transitionToValidationFailed(INITIAL_SYNC_STATE, 'Schema invalid.');
    expect(next.phase).toBe('validation_failed');
    expect(next.errorMessage).toBe('Schema invalid.');
    expect(next.statusMessage).toBeNull();
  });
});

describe('transitionToAuthExpired', () => {
  test('sets auth expired phase with message', () => {
    const next = transitionToAuthExpired(INITIAL_SYNC_STATE);
    expect(next.phase).toBe('auth_expired');
    expect(next.errorMessage).toContain('Authentication expired');
  });
});

describe('transitionToChangesNotSynced', () => {
  test('sets icon changes and files', () => {
    const state = transitionToReady(INITIAL_SYNC_STATE, TEST_SETTINGS);
    const next = transitionToChangesNotSynced(state, TEST_ICON_CHANGES, TEST_FILES);

    expect(next.phase).toBe('changes_not_synced');
    expect(next.iconChanges).toEqual(TEST_ICON_CHANGES);
    expect(next.currentFiles).toEqual(TEST_FILES);
    expect(next.fileCount).toBe(3);
  });
});

describe('resetToReady', () => {
  test('clears all transient state', () => {
    const state: SyncState = {
      ...INITIAL_SYNC_STATE,
      phase: 'pr_created',
      settings: TEST_SETTINGS,
      currentFiles: TEST_FILES,
      iconChanges: TEST_ICON_CHANGES,
      prResult: { number: 42, url: '', branch: '', commitSha: '' },
      conflicts: TEST_CONFLICTS,
      errorMessage: 'error',
      statusMessage: 'status',
      fileCount: 5,
      revision: { baseBranchHeadSha: '', lastSyncedCommitSha: '', previousFiles: [] },
    };

    const next = resetToReady(state);
    expect(next.phase).toBe('ready');
    expect(next.settings).toEqual(TEST_SETTINGS); // preserved
    expect(next.revision).toBeTruthy(); // preserved
    expect(next.currentFiles).toHaveLength(0);
    expect(next.iconChanges).toHaveLength(0);
    expect(next.prResult).toBeNull();
    expect(next.conflicts).toHaveLength(0);
    expect(next.errorMessage).toBeNull();
    expect(next.statusMessage).toBeNull();
  });
});

// ===========================================================================
// Full lifecycle: not_connected → ready → exporting → validating → creating_pr → pr_created
// ===========================================================================

describe('full lifecycle', () => {
  test('happy path from not_connected to pr_created', () => {
    let s = INITIAL_SYNC_STATE;
    expect(s.phase).toBe('not_connected');

    s = transitionToReady(s, TEST_SETTINGS);
    expect(s.phase).toBe('ready');

    s = transitionToExporting(s);
    expect(s.phase).toBe('exporting');

    s = transitionToValidating(s, TEST_FILES, TEST_ICON_CHANGES);
    expect(s.phase).toBe('validating');

    s = transitionToCreatingPr(s);
    expect(s.phase).toBe('creating_pr');

    s = transitionToPrCreated(
      s,
      { number: 99, url: 'https://github.com/pr/99', branch: 'icons/update', commitSha: 'sha-x' },
      { baseBranchHeadSha: 'sha-base', lastSyncedCommitSha: 'sha-x', previousFiles: TEST_FILES },
    );
    expect(s.phase).toBe('pr_created');
    expect(s.prResult!.number).toBe(99);

    // After dismiss, back to ready
    s = resetToReady(s);
    expect(s.phase).toBe('ready');
    expect(s.revision).toBeTruthy();
  });

  test('conflict path: not_connected → ready → exporting → conflict → retry', () => {
    let s = transitionToReady(INITIAL_SYNC_STATE, TEST_SETTINGS);
    s = transitionToExporting(s);
    s = transitionToValidating(s, TEST_FILES, TEST_ICON_CHANGES);
    s = transitionToConflictDetected(s, TEST_CONFLICTS);

    expect(s.phase).toBe('conflict_detected');
    expect(canRetry(s)).toBe(true);

    // Retry goes back to exporting
    s = transitionToExporting(s);
    expect(s.phase).toBe('exporting');
    expect(s.conflicts).toHaveLength(0);
  });

  test('validation failure path with retry', () => {
    let s = transitionToReady(INITIAL_SYNC_STATE, TEST_SETTINGS);
    s = transitionToExporting(s);
    s = transitionToValidationFailed(s, 'Invalid schema');

    expect(s.phase).toBe('validation_failed');
    expect(canRetry(s)).toBe(true);

    // Retry
    s = transitionToExporting(s);
    expect(s.phase).toBe('exporting');
  });

  test('auth expired path', () => {
    let s = transitionToReady(INITIAL_SYNC_STATE, TEST_SETTINGS);
    s = transitionToExporting(s);
    s = transitionToAuthExpired(s);

    expect(s.phase).toBe('auth_expired');
    expect(canRetry(s)).toBe(true);

    // Re-connect
    s = transitionToReady(s, TEST_SETTINGS);
    expect(s.phase).toBe('ready');
  });
});

// ===========================================================================
// Derived state helpers
// ===========================================================================

describe('isConnected', () => {
  test('false when settings empty', () => {
    expect(isConnected(INITIAL_SYNC_STATE)).toBe(false);
  });

  test('true when owner, repo, and baseBranch set', () => {
    const s = transitionToReady(INITIAL_SYNC_STATE, TEST_SETTINGS);
    expect(isConnected(s)).toBe(true);
  });

  test('false when repo missing', () => {
    const s = transitionToReady(INITIAL_SYNC_STATE, { ...TEST_SETTINGS, repo: '' });
    expect(isConnected(s)).toBe(false);
  });
});

describe('canCreatePr', () => {
  test('true when ready and connected', () => {
    const s = transitionToReady(INITIAL_SYNC_STATE, TEST_SETTINGS);
    expect(canCreatePr(s)).toBe(true);
  });

  test('true when changes_not_synced and connected', () => {
    const s = transitionToChangesNotSynced(
      transitionToReady(INITIAL_SYNC_STATE, TEST_SETTINGS),
      TEST_ICON_CHANGES,
      TEST_FILES,
    );
    expect(canCreatePr(s)).toBe(true);
  });

  test('false when not connected', () => {
    expect(canCreatePr(INITIAL_SYNC_STATE)).toBe(false);
  });

  test('false when in progress', () => {
    const s = transitionToExporting(
      transitionToReady(INITIAL_SYNC_STATE, TEST_SETTINGS),
    );
    expect(canCreatePr(s)).toBe(false);
  });
});

describe('isInProgress', () => {
  test('true for exporting, validating, creating_pr', () => {
    const ready = transitionToReady(INITIAL_SYNC_STATE, TEST_SETTINGS);
    expect(isInProgress(transitionToExporting(ready))).toBe(true);
    expect(isInProgress(transitionToValidating(ready, [], []))).toBe(true);
    expect(isInProgress(transitionToCreatingPr(ready))).toBe(true);
  });

  test('false for other states', () => {
    expect(isInProgress(INITIAL_SYNC_STATE)).toBe(false);
    expect(isInProgress(transitionToReady(INITIAL_SYNC_STATE, TEST_SETTINGS))).toBe(false);
  });
});

describe('canRetry', () => {
  test('true for conflict_detected, validation_failed, auth_expired', () => {
    expect(canRetry(transitionToConflictDetected(INITIAL_SYNC_STATE, []))).toBe(true);
    expect(canRetry(transitionToValidationFailed(INITIAL_SYNC_STATE, 'err'))).toBe(true);
    expect(canRetry(transitionToAuthExpired(INITIAL_SYNC_STATE))).toBe(true);
  });

  test('false for other states', () => {
    expect(canRetry(INITIAL_SYNC_STATE)).toBe(false);
    expect(canRetry(transitionToReady(INITIAL_SYNC_STATE, TEST_SETTINGS))).toBe(false);
    expect(canRetry(transitionToExporting(INITIAL_SYNC_STATE))).toBe(false);
  });
});

describe('phaseLabel', () => {
  test('returns human-readable labels for all phases', () => {
    expect(phaseLabel('not_connected')).toBe('Not connected');
    expect(phaseLabel('ready')).toBe('Ready');
    expect(phaseLabel('changes_not_synced')).toBe('Changes ready');
    expect(phaseLabel('exporting')).toBe('Preparing...');
    expect(phaseLabel('validating')).toBe('Checking...');
    expect(phaseLabel('creating_pr')).toBe('Creating PR...');
    expect(phaseLabel('pr_created')).toBe('PR created');
    expect(phaseLabel('conflict_detected')).toBe('Conflict detected');
    expect(phaseLabel('validation_failed')).toBe('Validation failed');
    expect(phaseLabel('auth_expired')).toBe('Auth expired');
  });
});

// ===========================================================================
// Analytics
// ===========================================================================

describe('analytics', () => {
  test('emitSyncEvent calls registered listeners', () => {
    const events: Array<{ name: SyncEventName; payload?: SyncEventPayload }> = [];
    const unsub = onSyncEvent((name, payload) => {
      events.push({ name, payload });
    });

    emitSyncEvent('sync_started');
    emitSyncEvent('sync_pr_created', { prNumber: 42 });
    emitSyncEvent('sync_completed');

    expect(events).toHaveLength(3);
    expect(events[0]!.name).toBe('sync_started');
    expect(events[1]!.name).toBe('sync_pr_created');
    expect(events[1]!.payload).toEqual({ prNumber: 42 });
    expect(events[2]!.name).toBe('sync_completed');

    unsub();
  });

  test('unsubscribe stops events', () => {
    const events: SyncEventName[] = [];
    const unsub = onSyncEvent((name) => {
      events.push(name);
    });

    emitSyncEvent('sync_started');
    unsub();
    emitSyncEvent('sync_completed');

    expect(events).toHaveLength(1);
    expect(events[0]).toBe('sync_started');
  });

  test('listener errors do not break emit', () => {
    const events: SyncEventName[] = [];

    const unsub1 = onSyncEvent(() => {
      throw new Error('broken listener');
    });
    const unsub2 = onSyncEvent((name) => {
      events.push(name);
    });

    emitSyncEvent('sync_started');

    expect(events).toHaveLength(1);
    expect(events[0]).toBe('sync_started');

    unsub1();
    unsub2();
  });
});
