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
 */

import type { GitProvider } from './git-provider';
import type {
  SyncPrRequest,
  SyncPrResponse,
  SyncConflictResponse,
  ChangedFileSummary,
} from './contracts';
import { ValidationFailureError } from './errors';
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
};

export type SyncPrResult =
  | ({ kind: 'success' } & SyncPrResponse)
  | ({ kind: 'conflict' } & SyncConflictResponse)
  | { kind: 'no-op'; message: string };

export async function syncPr(
  request: SyncPrRequest,
  options: SyncPrOptions,
): Promise<SyncPrResult> {
  const { provider, now } = options;
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
    throw new ValidationFailureError(
      `Payload validation failed: ${validationErrors.join('; ')}`,
    );
  }

  // ------ 2. Source-level diff ------
  const diff = diffSourcePayloads(previousFiles, files);

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
      return {
        kind: 'conflict',
        hasConflicts: true,
        conflicts: conflictResult.conflicts,
        remoteHeadSha: conflictResult.remoteHeadSha,
        localBaseSha: conflictResult.localBaseSha,
        iconChanges: diff.iconChanges,
      };
    }
  }

  // ------ 6. Resolve unique branch name ------
  const branch = await resolveUniqueBranch(provider, owner, repo, preferredBranch);

  // ------ 7. Create branch ------
  await provider.createBranch(owner, repo, baseRef.sha, branch);

  // ------ 8. List existing remote files ------
  const targetPrefix = packagePath || 'icons';
  const existingFiles = await provider.listFiles(owner, repo, baseBranch, targetPrefix);

  // ------ 9. Commit changed files ------
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

  changes.added.sort((a, b) => a.localeCompare(b));
  changes.updated.sort((a, b) => a.localeCompare(b));
  changes.deleted.sort((a, b) => a.localeCompare(b));

  // ------ 10. Create PR ------
  const title = generatePrTitle(changes);
  const body = generatePrBody(changes, actor.name);
  const pr = await provider.createPullRequest(owner, repo, branch, baseBranch, title, body);

  // ------ 11. Return ------
  return {
    kind: 'success',
    branch,
    commitSha: lastCommitSha,
    pr: {
      number: pr.number,
      url: pr.url,
    },
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
