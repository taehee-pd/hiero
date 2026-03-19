/**
 * React hook that orchestrates the full PR sync lifecycle.
 *
 * Manages:
 *   - Source export from the current project
 *   - Diff computation (via sync-service diffSourcePayloads)
 *   - API call to POST /api/github-sync/pr
 *   - State machine transitions
 *   - Analytics events
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import type { Project } from '@/lib/schema/types';
import { exportSourcePayload } from '@/lib/sync-source/export-source-payload';
import { diffSourcePayloads } from '@/lib/sync-service/diff-source';
import type { SyncPrResult } from '@/lib/sync-service/sync-pr';
import type { Conflict, ConflictErrorCode } from '@/lib/sync-service/conflicts';
import { CONFLICT_ERROR_CODES, CONFLICT_SUGGESTED_ACTIONS } from '@/lib/sync-service/conflicts';
import { emitSyncEvent } from './analytics';
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
} from './sync-state';

export type UseSyncPrReturn = {
  state: SyncState;
  /** Configure repository connection. */
  connect: (settings: SyncConnectionSettings) => void;
  /** Preview changes without creating PR. */
  previewChanges: (project: Project) => void;
  /** Create a pull request with current changes. */
  createPullRequest: (project: Project, force?: boolean) => Promise<void>;
  /** Retry after a recoverable error. */
  retry: (project: Project) => Promise<void>;
  /** Reset to ready state (dismiss PR result or conflict). */
  dismiss: () => void;
};

export function useSyncPr(): UseSyncPrReturn {
  const [state, setState] = useState<SyncState>(INITIAL_SYNC_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const connect = useCallback((settings: SyncConnectionSettings) => {
    setState((s) => transitionToReady(s, settings));
  }, []);

  const previewChanges = useCallback((project: Project) => {
    try {
      const payload = exportSourcePayload(project);
      const previousFiles = state.revision?.previousFiles ?? [];
      const diff = diffSourcePayloads(previousFiles, payload.files);

      setState((s) =>
        transitionToChangesNotSynced(s, diff.iconChanges, payload.files),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed.';
      setState((s) => transitionToValidationFailed(s, message));
    }
  }, [state.revision]);

  const createPullRequest = useCallback(
    async (project: Project, force = false) => {
      if (!isConnected(state)) return;

      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;

      // 1. Export
      setState((s) => transitionToExporting(s));
      emitSyncEvent('sync_started');

      let files;
      try {
        const payload = exportSourcePayload(project);
        files = payload.files;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Source export failed.';
        setState((s) => transitionToValidationFailed(s, message));
        emitSyncEvent('sync_validation_failed', { reason: message });
        return;
      }

      // 2. Diff
      const previousFiles = state.revision?.previousFiles ?? [];
      const diff = diffSourcePayloads(previousFiles, files);

      setState((s) => transitionToValidating(s, files, diff.iconChanges));

      if (diff.isNoOp) {
        setState((s) =>
          transitionToValidationFailed(s, 'No changes to sync. All icons are up to date.'),
        );
        return;
      }

      // 3. API call
      setState((s) => transitionToCreatingPr(s));

      try {
        const response = await fetch('/api/github-sync/pr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abort.signal,
          body: JSON.stringify({
            owner: state.settings.owner,
            repo: state.settings.repo,
            baseBranch: state.settings.baseBranch,
            packagePath: state.settings.packagePath || undefined,
            actor: { name: 'Coniva User' },
            files,
            previousFiles: previousFiles.length > 0 ? previousFiles : undefined,
            baseSha: state.revision?.baseBranchHeadSha ?? undefined,
            force,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({ message: 'Request failed.' })) as {
            error?: string;
            message?: string;
          };

          if (response.status === 401) {
            setState((s) => transitionToAuthExpired(s));
            emitSyncEvent('sync_validation_failed', { reason: 'auth_expired' });
            return;
          }

          if (response.status === 409) {
            // Conflict response
            const conflictBody = body as {
              conflicts?: Array<{ kind: string; message: string }>;
            };
            const conflicts = (conflictBody.conflicts ?? []).map((c) => {
              const kind = c.kind as Conflict['kind'];
              return {
                kind,
                code: CONFLICT_ERROR_CODES[kind] ?? (c.kind as ConflictErrorCode),
                message: c.message,
                suggestedActions: CONFLICT_SUGGESTED_ACTIONS[kind] ?? [],
              } satisfies Conflict;
            });
            setState((s) => transitionToConflictDetected(s, conflicts));
            emitSyncEvent('sync_conflict_detected', {
              conflictCount: conflicts.length,
            });
            return;
          }

          const errorMsg = body.message ?? `Sync failed (${response.status}).`;
          setState((s) => transitionToValidationFailed(s, errorMsg));
          emitSyncEvent('sync_validation_failed', { reason: errorMsg });
          return;
        }

        const result = (await response.json()) as SyncPrResult;

        if (result.kind === 'no-op') {
          setState((s) =>
            transitionToValidationFailed(s, 'No changes detected. All icons are up to date.'),
          );
          return;
        }

        if (result.kind === 'conflict') {
          setState((s) => transitionToConflictDetected(s, result.conflicts));
          emitSyncEvent('sync_conflict_detected', {
            conflictCount: result.conflicts.length,
          });
          return;
        }

        // Success — narrow the discriminated union
        if (result.kind !== 'success') {
          // error variant — surface the message
          setState((s) =>
            transitionToValidationFailed(s, result.message ?? 'Unexpected sync error.'),
          );
          return;
        }

        setState((s) =>
          transitionToPrCreated(
            s,
            {
              number: result.pr.number,
              url: result.pr.url,
              branch: result.branch,
              commitSha: result.commitSha,
            },
            {
              baseBranchHeadSha: result.revision.baseBranchHeadSha,
              lastSyncedCommitSha: result.revision.lastSyncedCommitSha,
              previousFiles: files,
            },
          ),
        );
        emitSyncEvent('sync_pr_created', {
          prNumber: result.pr.number,
          fileCount: files.length,
        });
        emitSyncEvent('sync_completed');
      } catch (err) {
        if (abort.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
        setState((s) => transitionToValidationFailed(s, message));
        emitSyncEvent('sync_validation_failed', { reason: message });
      }
    },
    [state],
  );

  const retry = useCallback(
    async (project: Project) => {
      const force = state.phase === 'conflict_detected';
      await createPullRequest(project, force);
    },
    [state.phase, createPullRequest],
  );

  const dismiss = useCallback(() => {
    setState((s) => resetToReady(s));
  }, []);

  return { state, connect, previewChanges, createPullRequest, retry, dismiss };
}
