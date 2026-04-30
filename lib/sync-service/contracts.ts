/**
 * Request/response TypeScript contracts for the GitHub PR sync API.
 */

import type { SourcePayloadFile } from '@/lib/sync-source/types';
import type { SyncErrorCode } from './errors';
import type { Conflict, SuggestedAction } from './conflicts';
import type { IconChange } from './diff-source';

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export type SyncPrRequest = {
  /** GitHub repository owner (user or org). */
  owner: string;
  /** GitHub repository name. */
  repo: string;
  /** Base branch to branch from and target with the PR (default: "main"). */
  baseBranch?: string;
  /** Optional path prefix in the repo (e.g. "packages/icons"). */
  packagePath?: string;
  /** Actor metadata for audit trail. */
  actor: {
    /** Display name of the user triggering the sync. */
    name: string;
    /** Optional email for commit attribution. */
    email?: string;
  };
  /** The canonical source files to commit. */
  files: SourcePayloadFile[];
  /**
   * SHA of the base branch HEAD at the time the export was generated.
   * Used for optimistic concurrency — if the branch has advanced, the
   * service detects drift and returns structured conflict data.
   */
  baseSha?: string;
  /**
   * Files from the previous successful sync (empty array for first sync).
   * Enables source-level diffing so only changed files are committed.
   */
  previousFiles?: SourcePayloadFile[];
  /**
   * Commit SHA of the last successful sync. Stored by the caller after
   * each successful PR creation and sent back on the next sync.
   */
  lastSyncedCommitSha?: string;
  /**
   * When true, skip conflict checks and force the sync even if
   * the base branch has drifted. Default: false.
   */
  force?: boolean;
  /**
   * Optional release context surfaced into the generated PR body.
   * Set by `lib/sync-ui/publish-target-executor.ts` when the publish
   * orchestrator (`executePublishTransaction`) drives a `git-pr`
   * target. Threaded through to `generatePrBody` so the PR carries
   * the release notes blockquote, version line, and JSON metadata
   * block. Phase 2.5 wiring fix.
   */
  releaseMetadata?: {
    version: string;
    releaseNotes: string;
  };
};

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

export type ChangedFileSummary = {
  added: string[];
  updated: string[];
  deleted: string[];
};

export type SyncPrResponse = {
  branch: string;
  commitSha: string;
  pr: {
    number: number;
    url: string;
  };
  changedFiles: ChangedFileSummary;
  /** Per-icon classification of changes (added/removed/updated/preview-only/metadata-only). */
  iconChanges: IconChange[];
  /** Revision tracking — store this and send it back on the next sync. */
  revision: {
    /** SHA of the base branch HEAD when this sync was created. */
    baseBranchHeadSha: string;
    /** Commit SHA of the last file write in this sync. */
    lastSyncedCommitSha: string;
  };
  validation: {
    ok: boolean;
    errors: string[];
  };
};

// ---------------------------------------------------------------------------
// Conflict response — returned instead of SyncPrResponse when conflicts exist
// ---------------------------------------------------------------------------

export type SyncConflictResponse = {
  /** Always true for conflict responses. */
  hasConflicts: true;
  conflicts: Conflict[];
  /** Current HEAD SHA of the remote base branch. */
  remoteHeadSha: string;
  /** SHA the export was based on. */
  localBaseSha: string | null;
  /**
   * The up-to-date remote HEAD SHA the caller can use to retry
   * without re-fetching. Null when the remote was unreachable
   * (e.g. auth-expired).
   */
  refreshedBaseSha: string | null;
  /** Deduplicated union of all suggested actions across conflicts. */
  suggestedActions: SuggestedAction[];
  /** Per-icon classification of what the local diff would change. */
  iconChanges: IconChange[];
};

// ---------------------------------------------------------------------------
// Error response
// ---------------------------------------------------------------------------

export type SyncErrorResponse = {
  error: SyncErrorCode;
  message: string;
  statusCode: number;
};

// ---------------------------------------------------------------------------
// Generic sync connector interface
// ---------------------------------------------------------------------------

/**
 * A sync connector pushes compiled output to a delivery target.
 * Each delivery mode (local-directory, git-pr, npm-registry) implements this.
 */
export interface SyncConnector<TRequest, TResult> {
  /** Execute the sync operation. */
  push(request: TRequest): Promise<TResult>;
  /** Optional pre-flight validation (no side effects). */
  validate?(request: TRequest): { ok: boolean; errors: string[] };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export function validateSyncPrRequest(body: unknown): {
  ok: boolean;
  errors: string[];
  request?: SyncPrRequest;
} {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { ok: false, errors: ['Request body must be a JSON object.'] };
  }

  const obj = body as Record<string, unknown>;

  if (typeof obj.owner !== 'string' || !obj.owner) {
    errors.push('owner is required and must be a non-empty string.');
  }
  if (typeof obj.repo !== 'string' || !obj.repo) {
    errors.push('repo is required and must be a non-empty string.');
  }
  if (obj.baseBranch !== undefined && typeof obj.baseBranch !== 'string') {
    errors.push('baseBranch must be a string if provided.');
  }
  if (obj.packagePath !== undefined && typeof obj.packagePath !== 'string') {
    errors.push('packagePath must be a string if provided.');
  }

  // actor
  if (!obj.actor || typeof obj.actor !== 'object') {
    errors.push('actor is required and must be an object.');
  } else {
    const actor = obj.actor as Record<string, unknown>;
    if (typeof actor.name !== 'string' || !actor.name) {
      errors.push('actor.name is required and must be a non-empty string.');
    }
  }

  // files
  if (!Array.isArray(obj.files)) {
    errors.push('files is required and must be an array.');
  } else {
    for (let i = 0; i < obj.files.length; i++) {
      const file = obj.files[i] as Record<string, unknown> | undefined;
      if (!file || typeof file !== 'object') {
        errors.push(`files[${i}] must be an object.`);
        continue;
      }
      if (typeof file.path !== 'string' || !file.path) {
        errors.push(`files[${i}].path is required.`);
      }
      if (typeof file.contents !== 'string') {
        errors.push(`files[${i}].contents must be a string.`);
      }
    }
  }

  // previousFiles (optional)
  if (obj.previousFiles !== undefined && !Array.isArray(obj.previousFiles)) {
    errors.push('previousFiles must be an array if provided.');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors: [], request: obj as unknown as SyncPrRequest };
}
