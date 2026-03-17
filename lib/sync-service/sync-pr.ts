/**
 * PR sync orchestrator — the core backend service.
 *
 * Lifecycle:
 *   1. Validate request
 *   2. Source-level diff (skip unchanged files)
 *   3. No-op short-circuit
 *   4. Resolve base branch SHA
 *   5. Conflict detection (optimistic concurrency)
 *   6. Resolve unique branch name
 *   7. Create feature branch
 *   8. List existing remote files
 *   9. Commit changed files (create/update/delete)
 *  10. Create pull request
 *  11. Return response with revision tracking
 *
 * Error handling:
 *   Steps 1-6 are read-only — failures propagate without side effects.
 *   Steps 7-10 mutate the remote repo. Each step is wrapped with typed
 *   error classification so callers get structured errors, not raw
 *   provider exceptions.
 *
 * Observability:
 *   When an analytics instance is provided, every phase transition emits
 *   a structured event with timing, counts, and error metadata.
 *   Analytics never contain secrets, tokens, or raw file contents.
 */

import type { GitProvider } from './git-provider';
import type {
  SyncPrRequest,
  SyncPrResponse,
  SyncConflictResponse,
  SyncErrorResponse,
  ChangedFileSummary,
} from './contracts';
import type { SuggestedAction } from './conflicts';
import type { SyncAnalytics } from './analytics';
import { createNoOpAnalytics } from './analytics';
import {
  ValidationFailureError,
  SyncError,
  classifyGitHubError,
} from './errors';
import { diffSourcePayloads } from './diff-source';
import { checkConflicts, resolveUniqueBranch } from './conflicts';
import {
  generateBranchName,
  generatePrTitle,
  generatePrBody,
} from './metadata';

export type SyncPrOptions = {
  /** The git provider to use (GitHub, GitLab, etc.). */
  provider: GitProvider;
  /** Override the clock for deterministic branch names in tests. */
  now?: Date;
  /** Optional analytics instance for observability. */
  analytics?: SyncAnalytics;
};

export type SyncPrResult =
  | ({ kind: 'success' } & SyncPrResponse)
  | ({ kind: 'conflict' } & SyncConflictResponse)
  | { kind: 'no-op'; message: string }
  | ({ kind: 'error' } & SyncErrorResponse & {
      /** Branch that was created before the failure, if any. */
      orphanBranch?: string;
    });

export async function syncPr(
  request: SyncPrRequest,
  options: SyncPrOptions,
): Promise<SyncPrResult> {
  const { provider, now } = options;
  const a = options.analytics ?? createNoOpAnalytics();
  const {
    owner,
    repo,
    baseBranch: baseBranchInput,
    packagePath: packagePathInput,
    actor,
    files,
    previousFiles = [],
    force = false,
  } = request;

  const baseBranch = baseBranchInput || 'main';
  const packagePath = normalizePackagePath(packagePathInput ?? '');

  // --- Analytics context ---
  a.setContext({ repo: `${owner}/${repo}`, baseBranch });
  a.markStart();
  a.emit({
    name: 'sync_started',
    fileCount: files.length,
    force,
  });

  // ------ 1. Validate ------
  const validationErrors: string[] = [];
  if (files.length === 0) {
    validationErrors.push('files array is empty — nothing to sync.');
  }
  for (const file of files) {
    if (file.path.includes('..')) {
      validationErrors.push(`Path traversal detected: "${file.path}".`);
    }
  }
  if (validationErrors.length > 0) {
    a.emit({ name: 'sync_validation_failed', errors: validationErrors });
    throw new ValidationFailureError(
      `Payload validation failed: ${validationErrors.join('; ')}`,
    );
  }

  // ------ 2. Source-level diff ------
  const diffStart = performance.now();
  const diff = diffSourcePayloads(previousFiles, files);
  const diffMs = Math.round(performance.now() - diffStart);

  a.emit({
    name: 'diff_completed',
    changedIconCount: diff.iconChanges.length,
    filesToWrite: diff.filesToWrite.length,
    filesToDelete: diff.filesToDelete.length,
    isNoOp: diff.isNoOp,
    durationMs: diffMs,
  });

  // ------ 3. No-op short-circuit ------
  if (diff.isNoOp) {
    return {
      kind: 'no-op',
      message: 'No changes detected between previous and current export.',
    };
  }

  // ------ 4. Resolve base branch ------
  const baseRef = await provider.getBranchRef(owner, repo, baseBranch);

  // ------ 5. Conflict detection ------
  const preferredBranch = generateBranchName(files, now);

  if (!force && (request.baseSha || previousFiles.length > 0)) {
    const conflictResult = await checkConflicts(
      {
        owner,
        repo,
        baseBranch,
        baseSha: request.baseSha ?? null,
        currentFiles: files,
        previousFiles,
        targetBranch: preferredBranch,
        packagePath: packagePath || undefined,
      },
      provider,
    );

    if (!conflictResult.ok) {
      // Deduplicate suggested actions across all conflicts
      const allActions = new Set<SuggestedAction>();
      for (const c of conflictResult.conflicts) {
        for (const act of c.suggestedActions) allActions.add(act);
      }

      a.emit({
        name: 'sync_conflict_detected',
        conflictKinds: conflictResult.conflicts.map((c) => c.kind),
        conflictCodes: conflictResult.conflicts.map((c) => c.code),
        conflictCount: conflictResult.conflicts.length,
        remoteHeadSha: conflictResult.remoteHeadSha,
      });

      return {
        kind: 'conflict',
        hasConflicts: true,
        conflicts: conflictResult.conflicts,
        remoteHeadSha: conflictResult.remoteHeadSha,
        localBaseSha: conflictResult.localBaseSha,
        refreshedBaseSha: conflictResult.remoteHeadSha || null,
        suggestedActions: [...allActions],
        iconChanges: diff.iconChanges,
      };
    }
  }

  // ------ 6. Resolve unique branch name ------
  const branch = await resolveUniqueBranch(provider, owner, repo, preferredBranch);

  // ------ Steps 7-10 mutate the remote — wrap with typed errors ------

  // ------ 7. Create branch ------
  const branchStart = performance.now();
  try {
    await provider.createBranch(owner, repo, baseRef.sha, branch);
  } catch (err) {
    const syncErr = classifyGitHubError(err, 'branch');
    a.emit({
      name: 'sync_failed',
      errorCode: syncErr.code,
      errorMessage: syncErr.message,
      statusCode: syncErr.statusCode,
      failedPhase: 'create_branch',
      durationMs: Math.round(performance.now() - branchStart),
    });
    throw syncErr;
  }
  const branchMs = Math.round(performance.now() - branchStart);

  a.emit({
    name: 'sync_branch_created',
    branch,
    baseSha: baseRef.sha,
    durationMs: branchMs,
  });

  // ------ 8. List existing remote files ------
  const targetPrefix = packagePath || 'icons';
  let existingFiles: Set<string>;
  try {
    existingFiles = await provider.listFiles(owner, repo, baseBranch, targetPrefix);
  } catch (err) {
    // Branch was already created — report it as orphan in the error
    const syncErr = classifyGitHubError(err, 'generic');
    a.emit({
      name: 'sync_failed',
      errorCode: syncErr.code,
      errorMessage: syncErr.message,
      statusCode: syncErr.statusCode,
      failedPhase: 'list_files',
      durationMs: 0,
      orphanBranch: branch,
    });
    return {
      kind: 'error',
      error: syncErr.code,
      message: syncErr.message,
      statusCode: syncErr.statusCode,
      orphanBranch: branch,
    };
  }

  // ------ 9. Commit changed files ------
  const commitStart = performance.now();
  let lastCommitSha = baseRef.sha;

  // Build the full change summary from remote perspective
  const allPrefixedFiles = files.map((f) => ({
    path: packagePath ? joinPath(packagePath, f.path) : f.path,
    contents: f.contents,
  }));

  const allPrefixedPaths = new Set(allPrefixedFiles.map((f) => f.path));
  const changes: ChangedFileSummary = { added: [], updated: [], deleted: [] };

  // Only write files that actually changed (from diff)
  const filesToWritePrefixed = diff.filesToWrite.map((f) => ({
    path: packagePath ? joinPath(packagePath, f.path) : f.path,
    contents: f.contents!,
  }));

  try {
    for (const pf of [...filesToWritePrefixed].sort((a, b) => a.path.localeCompare(b.path))) {
      const isUpdate = existingFiles.has(pf.path);
      const existingSha = isUpdate
        ? await provider.getFileSha(owner, repo, branch, pf.path)
        : undefined;

      const result = await provider.createOrUpdateFile(
        owner,
        repo,
        branch,
        pf.path,
        pf.contents,
        `chore(icons): sync ${pf.path}`,
        existingSha ?? undefined,
      );
      lastCommitSha = result.commitSha;

      if (isUpdate) {
        changes.updated.push(pf.path);
      } else {
        changes.added.push(pf.path);
      }
    }
  } catch (err) {
    const syncErr = classifyGitHubError(err, 'file-write');
    a.emit({
      name: 'sync_failed',
      errorCode: syncErr.code,
      errorMessage: syncErr.message,
      statusCode: syncErr.statusCode,
      failedPhase: 'commit_files',
      durationMs: Math.round(performance.now() - commitStart),
      orphanBranch: branch,
    });
    return {
      kind: 'error',
      error: syncErr.code,
      message: syncErr.message,
      statusCode: syncErr.statusCode,
      orphanBranch: branch,
    };
  }

  // Delete files: union of diff-detected deletions and remote files not in current payload
  const filesToDeletePrefixed = new Set(
    diff.filesToDelete.map((f) =>
      packagePath ? joinPath(packagePath, f.path) : f.path,
    ),
  );

  // Also delete remote files not in current payload at all
  for (const existing of existingFiles) {
    if (!allPrefixedPaths.has(existing)) {
      filesToDeletePrefixed.add(existing);
    }
  }

  try {
    const sortedDeletes = [...filesToDeletePrefixed].sort((a, b) => a.localeCompare(b));
    for (const deletePath of sortedDeletes) {
      const sha = await provider.getFileSha(owner, repo, branch, deletePath);
      if (sha) {
        await provider.deleteFile(
          owner,
          repo,
          branch,
          deletePath,
          `chore(icons): remove ${deletePath}`,
          sha,
        );
        changes.deleted.push(deletePath);
      }
    }
  } catch (err) {
    const syncErr = classifyGitHubError(err, 'file-delete');
    a.emit({
      name: 'sync_failed',
      errorCode: syncErr.code,
      errorMessage: syncErr.message,
      statusCode: syncErr.statusCode,
      failedPhase: 'delete_files',
      durationMs: Math.round(performance.now() - commitStart),
      orphanBranch: branch,
    });
    return {
      kind: 'error',
      error: syncErr.code,
      message: syncErr.message,
      statusCode: syncErr.statusCode,
      orphanBranch: branch,
    };
  }

  const commitMs = Math.round(performance.now() - commitStart);

  changes.added.sort((a, b) => a.localeCompare(b));
  changes.updated.sort((a, b) => a.localeCompare(b));
  changes.deleted.sort((a, b) => a.localeCompare(b));

  a.emit({
    name: 'sync_commit_created',
    branch,
    filesWritten: changes.added.length + changes.updated.length,
    filesDeleted: changes.deleted.length,
    commitSha: lastCommitSha,
    durationMs: commitMs,
  });

  // ------ 10. Create PR ------
  const prStart = performance.now();
  let pr: { number: number; url: string };
  try {
    const title = generatePrTitle(changes);
    const body = generatePrBody(changes, actor.name, {
      iconChanges: diff.iconChanges,
    });
    const prResult = await provider.createPullRequest(owner, repo, branch, baseBranch, title, body);
    pr = { number: prResult.number, url: prResult.url };
  } catch (err) {
    const syncErr = classifyGitHubError(err, 'pr');
    a.emit({
      name: 'sync_failed',
      errorCode: syncErr.code,
      errorMessage: syncErr.message,
      statusCode: syncErr.statusCode,
      failedPhase: 'create_pr',
      durationMs: Math.round(performance.now() - prStart),
      orphanBranch: branch,
    });
    return {
      kind: 'error',
      error: syncErr.code,
      message: syncErr.message,
      statusCode: syncErr.statusCode,
      orphanBranch: branch,
    };
  }
  const prMs = Math.round(performance.now() - prStart);

  const totalChangedFiles = changes.added.length + changes.updated.length + changes.deleted.length;

  a.emit({
    name: 'sync_pr_created',
    branch,
    prNumber: pr.number,
    prUrl: pr.url,
    changedFileCount: totalChangedFiles,
    changedIconCount: diff.iconChanges.length,
    durationMs: prMs,
  });

  // ------ 11. Return ------
  a.emit({
    name: 'sync_completed',
    branch,
    prNumber: pr.number,
    prUrl: pr.url,
    changedFileCount: totalChangedFiles,
    changedIconCount: diff.iconChanges.length,
    durationMs: 0, // elapsedMs carries the total
  });

  return {
    kind: 'success',
    branch,
    commitSha: lastCommitSha,
    pr,
    changedFiles: changes,
    iconChanges: diff.iconChanges,
    revision: {
      baseBranchHeadSha: baseRef.sha,
      lastSyncedCommitSha: lastCommitSha,
    },
    validation: {
      ok: true,
      errors: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizePackagePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

function joinPath(left: string, right: string): string {
  return `${left}/${right}`.replace(/\/+/g, '/');
}
