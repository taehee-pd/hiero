/**
 * Comprehensive tests for conflict handling, error wrapping, and
 * recovery UX in the PR sync pipeline.
 *
 * Covers:
 * - Every conflict category (base-sha-drift, icon-changed-remotely,
 *   icon-deleted-remotely, manifest-changed-remotely, branch-already-exists,
 *   auth-expired)
 * - Machine-readable error codes and suggested actions on each conflict
 * - Typed error wrapping for steps 7-10 (branch creation, file writes,
 *   file deletes, PR creation)
 * - Orphan branch reporting on partial failure
 * - No silent mutation guarantee: conflict detection never creates branches/files
 * - Retry-safe behavior: refreshedBaseSha in conflict response
 */

import { describe, expect, test, beforeEach } from 'bun:test';

import type {
  GitProvider,
  GitRef,
  FileCommitResult,
  PullRequestResult,
} from '../lib/sync-service/git-provider';
import type { SyncPrRequest } from '../lib/sync-service/contracts';
import { syncPr } from '../lib/sync-service/sync-pr';
import type { SyncPrResult } from '../lib/sync-service/sync-pr';
import {
  checkConflicts,
  resolveUniqueBranch,
} from '../lib/sync-service/conflicts';
import type {
  ConflictErrorCode,
  ConflictKind,
  SuggestedAction,
} from '../lib/sync-service/conflicts';
import {
  SyncError,
  BranchCreationError,
  FileWriteError,
  FileDeleteError,
  PrCreationError,
} from '../lib/sync-service/errors';

// ---------------------------------------------------------------------------
// Controllable mock — extends the shared MockGitProvider with fault injection
// ---------------------------------------------------------------------------

type ProviderFault = {
  method: string;
  error: Error;
  /** Fire once then clear. Default: true. */
  once?: boolean;
};

class FaultInjectionProvider implements GitProvider {
  calls: Array<{ method: string; args: unknown[] }> = [];
  private files = new Map<string, { contents: string; sha: string }>();
  private shaCounter = 0;
  private missingBranches = new Set<string>();
  private knownBranches = new Set<string>();
  private branchShas = new Map<string, string>();
  private listedFiles = new Map<string, Set<string>>();
  private faults: ProviderFault[] = [];

  private nextSha(): string {
    this.shaCounter++;
    return `sha-${String(this.shaCounter).padStart(6, '0')}`;
  }

  private bk(owner: string, repo: string, branch: string): string {
    return `${owner}\0${repo}\0${branch}`;
  }
  private fk(owner: string, repo: string, branch: string, path: string): string {
    return `${owner}\0${repo}\0${branch}\0${path}`;
  }

  // --- Seed helpers ---

  seedBranchSha(owner: string, repo: string, branch: string, sha: string) {
    this.branchShas.set(this.bk(owner, repo, branch), sha);
    this.knownBranches.add(this.bk(owner, repo, branch));
  }
  seedMissingBranch(branch: string) {
    this.missingBranches.add(branch);
  }
  seedListFiles(owner: string, repo: string, branch: string, paths: string[]) {
    this.listedFiles.set(this.bk(owner, repo, branch), new Set(paths));
    this.knownBranches.add(this.bk(owner, repo, branch));
  }
  seedFile(owner: string, repo: string, branch: string, path: string, contents: string) {
    const key = this.fk(owner, repo, branch, path);
    this.files.set(key, { contents, sha: this.nextSha() });
    this.knownBranches.add(this.bk(owner, repo, branch));
  }

  /** Inject a fault for the next call to `method`. */
  injectFault(method: string, error: Error, once = true) {
    this.faults.push({ method, error, once });
  }

  private checkFault(method: string): void {
    const idx = this.faults.findIndex((f) => f.method === method);
    if (idx >= 0) {
      const fault = this.faults[idx]!;
      if (fault.once !== false) this.faults.splice(idx, 1);
      throw fault.error;
    }
  }

  /** Whether any createOrUpdateFile / deleteFile / createBranch calls were made. */
  hasMutations(): boolean {
    return this.calls.some((c) =>
      ['createBranch', 'createOrUpdateFile', 'deleteFile', 'createPullRequest'].includes(c.method),
    );
  }

  // --- Interface ---

  async getBranchRef(owner: string, repo: string, branch: string): Promise<GitRef> {
    this.calls.push({ method: 'getBranchRef', args: [owner, repo, branch] });
    this.checkFault('getBranchRef');
    if (this.missingBranches.has(branch)) {
      throw new Error(`Branch ${branch} not found (404)`);
    }
    const bk = this.bk(owner, repo, branch);
    if (!this.knownBranches.has(bk)) {
      throw new Error(`Branch ${branch} not found (404)`);
    }
    const sha = this.branchShas.get(bk) ?? 'base-sha-000';
    return { sha, ref: `refs/heads/${branch}` };
  }

  async createBranch(owner: string, repo: string, baseSha: string, newBranch: string): Promise<GitRef> {
    this.calls.push({ method: 'createBranch', args: [owner, repo, baseSha, newBranch] });
    this.checkFault('createBranch');
    const bk = this.bk(owner, repo, newBranch);
    this.knownBranches.add(bk);
    if (!this.branchShas.has(bk)) this.branchShas.set(bk, baseSha);

    // Copy files from source branches that match the baseSha
    const snapshot = [...this.files.entries()];
    for (const [key, entry] of snapshot) {
      // Extract the branch from the key (owner\0repo\0branch\0path)
      const parts = key.split('\0');
      if (parts.length !== 4) continue;
      const [o, r, b, p] = parts as [string, string, string, string];
      if (o !== owner || r !== repo) continue;
      const sourceBk = this.bk(o, r, b);
      const sourceSha = this.branchShas.get(sourceBk) ?? 'base-sha-000';
      if (sourceSha === baseSha || b === 'main') {
        const newKey = this.fk(owner, repo, newBranch, p);
        if (!this.files.has(newKey)) {
          this.files.set(newKey, { ...entry });
        }
      }
    }

    return { sha: baseSha, ref: `refs/heads/${newBranch}` };
  }

  async getFileSha(owner: string, repo: string, branch: string, path: string): Promise<string | null> {
    this.calls.push({ method: 'getFileSha', args: [owner, repo, branch, path] });
    this.checkFault('getFileSha');
    const entry = this.files.get(this.fk(owner, repo, branch, path));
    return entry?.sha ?? null;
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    branch: string,
    path: string,
    content: string,
    message: string,
    existingSha?: string,
  ): Promise<FileCommitResult> {
    this.calls.push({ method: 'createOrUpdateFile', args: [owner, repo, branch, path, content, message, existingSha] });
    this.checkFault('createOrUpdateFile');
    const sha = this.nextSha();
    const commitSha = this.nextSha();
    this.files.set(this.fk(owner, repo, branch, path), { contents: content, sha });
    return { path, sha, commitSha };
  }

  async deleteFile(
    owner: string,
    repo: string,
    branch: string,
    path: string,
    message: string,
    sha: string,
  ): Promise<void> {
    this.calls.push({ method: 'deleteFile', args: [owner, repo, branch, path, message, sha] });
    this.checkFault('deleteFile');
    this.files.delete(this.fk(owner, repo, branch, path));
  }

  async createPullRequest(
    owner: string,
    repo: string,
    head: string,
    base: string,
    title: string,
    body: string,
  ): Promise<PullRequestResult> {
    this.calls.push({ method: 'createPullRequest', args: [owner, repo, head, base, title, body] });
    this.checkFault('createPullRequest');
    return { number: 42, url: `https://github.com/${owner}/${repo}/pull/42`, title, headBranch: head, baseBranch: base };
  }

  async listFiles(owner: string, repo: string, branch: string, pathPrefix: string): Promise<Set<string>> {
    this.calls.push({ method: 'listFiles', args: [owner, repo, branch, pathPrefix] });
    this.checkFault('listFiles');
    return this.listedFiles.get(this.bk(owner, repo, branch)) ?? new Set();
  }
}

// ---------------------------------------------------------------------------
// Shared constants and helpers
// ---------------------------------------------------------------------------

const OWNER = 'test-org';
const REPO = 'icons-repo';
const FIXED_DATE = new Date('2026-03-15T14:30:00Z');

function baseRequest(overrides?: Partial<SyncPrRequest>): SyncPrRequest {
  return {
    owner: OWNER,
    repo: REPO,
    baseBranch: 'main',
    actor: { name: 'Tester' },
    files: [
      { path: 'icons/chevron/icon.json', contents: '{"name":"chevron"}' },
      { path: 'icons/chevron/preview.svg', contents: '<svg/>' },
      { path: 'manifest.json', contents: '{"icons":["chevron"]}' },
    ],
    ...overrides,
  };
}

// ===========================================================================
// Conflict category tests
// ===========================================================================

describe('Conflict categories', () => {
  let provider: FaultInjectionProvider;

  beforeEach(() => {
    provider = new FaultInjectionProvider();
    provider.seedBranchSha(OWNER, REPO, 'main', 'sha-current');
  });

  // -----------------------------------------------------------------------
  // base-sha-drift
  // -----------------------------------------------------------------------

  describe('base-sha-drift', () => {
    test('detected when baseSha does not match remote HEAD', async () => {
      provider.seedMissingBranch('icons/update-chevron-20260315-1430');
      const result = await checkConflicts(
        {
          owner: OWNER,
          repo: REPO,
          baseBranch: 'main',
          baseSha: 'sha-stale',
          currentFiles: [{ path: 'icons/chevron/icon.json', contents: '{}' }],
          previousFiles: [],
          targetBranch: 'icons/update-chevron-20260315-1430',
        },
        provider,
      );

      expect(result.ok).toBe(false);
      const drift = result.conflicts.find((c) => c.kind === 'base-sha-drift');
      expect(drift).toBeDefined();
      expect(drift!.code).toBe('STALE_BASE_REVISION');
      expect(drift!.suggestedActions).toContain('refresh-and-re-export');
      expect(drift!.suggestedActions).toContain('force-sync');
      expect(drift!.message).toContain('sha-stale');
      expect(drift!.message).toContain('sha-current');
    });

    test('not triggered when baseSha matches remote', async () => {
      provider.seedMissingBranch('icons/update-chevron-20260315-1430');
      const result = await checkConflicts(
        {
          owner: OWNER,
          repo: REPO,
          baseBranch: 'main',
          baseSha: 'sha-current',
          currentFiles: [{ path: 'icons/chevron/icon.json', contents: '{}' }],
          previousFiles: [],
          targetBranch: 'icons/update-chevron-20260315-1430',
        },
        provider,
      );
      expect(result.ok).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // icon-changed-remotely
  // -----------------------------------------------------------------------

  describe('icon-changed-remotely', () => {
    test('detected when remote icon has extra files', async () => {
      provider.seedMissingBranch('branch-x');
      // Remote has an extra file for chevron that our previous sync didn't include
      provider.seedListFiles(OWNER, REPO, 'main', [
        'icons/chevron/icon.json',
        'icons/chevron/preview.svg',
        'icons/chevron/extra.json', // remote added this
      ]);
      const result = await checkConflicts(
        {
          owner: OWNER,
          repo: REPO,
          baseBranch: 'main',
          baseSha: 'sha-stale',
          currentFiles: [
            { path: 'icons/chevron/icon.json', contents: 'new' },
            { path: 'icons/chevron/preview.svg', contents: '<svg/>' },
          ],
          previousFiles: [
            { path: 'icons/chevron/icon.json', contents: 'old' },
            { path: 'icons/chevron/preview.svg', contents: '<svg/>' },
          ],
          targetBranch: 'branch-x',
        },
        provider,
      );

      const changed = result.conflicts.find((c) => c.kind === 'icon-changed-remotely');
      expect(changed).toBeDefined();
      expect(changed!.code).toBe('ICON_CHANGED_REMOTELY');
      expect(changed!.suggestedActions).toContain('pull-remote-changes');
      expect(changed!.iconDirs).toContain('chevron');
    });
  });

  // -----------------------------------------------------------------------
  // icon-deleted-remotely
  // -----------------------------------------------------------------------

  describe('icon-deleted-remotely', () => {
    test('detected when remote no longer has an icon we previously synced', async () => {
      provider.seedMissingBranch('branch-x');
      // Remote has NO chevron files — it was deleted
      provider.seedListFiles(OWNER, REPO, 'main', []);
      const result = await checkConflicts(
        {
          owner: OWNER,
          repo: REPO,
          baseBranch: 'main',
          baseSha: 'sha-stale',
          currentFiles: [
            { path: 'icons/chevron/icon.json', contents: 'new' },
            { path: 'icons/chevron/preview.svg', contents: '<svg/>' },
          ],
          previousFiles: [
            { path: 'icons/chevron/icon.json', contents: 'old' },
            { path: 'icons/chevron/preview.svg', contents: '<svg/>' },
          ],
          targetBranch: 'branch-x',
        },
        provider,
      );

      const deleted = result.conflicts.find((c) => c.kind === 'icon-deleted-remotely');
      expect(deleted).toBeDefined();
      expect(deleted!.code).toBe('ICON_DELETED_REMOTELY');
      expect(deleted!.suggestedActions).toContain('discard-deleted-icons');
      expect(deleted!.suggestedActions).toContain('refresh-and-re-export');
      expect(deleted!.iconDirs).toEqual(['chevron']);
      expect(deleted!.files).toEqual(['icons/chevron/icon.json']);
    });
  });

  // -----------------------------------------------------------------------
  // manifest-changed-remotely
  // -----------------------------------------------------------------------

  describe('manifest-changed-remotely', () => {
    test('detected when remote has manifest not in previous sync', async () => {
      provider.seedMissingBranch('branch-x');
      // Remote has manifest.json but our previous export didn't include it
      provider.seedListFiles(OWNER, REPO, 'main', ['manifest.json']);
      const result = await checkConflicts(
        {
          owner: OWNER,
          repo: REPO,
          baseBranch: 'main',
          baseSha: 'sha-stale',
          currentFiles: [
            { path: 'icons/chevron/icon.json', contents: '{}' },
            { path: 'manifest.json', contents: '{}' },
          ],
          previousFiles: [
            { path: 'icons/chevron/icon.json', contents: '{}' },
            // no manifest.json in previous
          ],
          targetBranch: 'branch-x',
        },
        provider,
      );

      const manifest = result.conflicts.find((c) => c.kind === 'manifest-changed-remotely');
      expect(manifest).toBeDefined();
      expect(manifest!.code).toBe('MANIFEST_CONFLICT');
      expect(manifest!.suggestedActions).toContain('resolve-manifest');
      expect(manifest!.files).toEqual(['manifest.json']);
    });
  });

  // -----------------------------------------------------------------------
  // branch-already-exists
  // -----------------------------------------------------------------------

  describe('branch-already-exists', () => {
    test('detected when target branch already exists on remote', async () => {
      // The target branch IS known (it exists)
      provider.seedBranchSha(OWNER, REPO, 'icons/update-chevron-20260315-1430', 'some-sha');

      const result = await checkConflicts(
        {
          owner: OWNER,
          repo: REPO,
          baseBranch: 'main',
          baseSha: 'sha-current', // no drift
          currentFiles: [{ path: 'icons/chevron/icon.json', contents: '{}' }],
          previousFiles: [],
          targetBranch: 'icons/update-chevron-20260315-1430',
        },
        provider,
      );

      const collision = result.conflicts.find((c) => c.kind === 'branch-already-exists');
      expect(collision).toBeDefined();
      expect(collision!.code).toBe('BRANCH_NAME_COLLISION');
      expect(collision!.suggestedActions).toEqual(['rename-branch']);
    });
  });

  // -----------------------------------------------------------------------
  // auth-expired
  // -----------------------------------------------------------------------

  describe('auth-expired', () => {
    test('detected on 401 error from provider', async () => {
      provider.injectFault('getBranchRef', new Error('Bad credentials (401)'));

      const result = await checkConflicts(
        {
          owner: OWNER,
          repo: REPO,
          baseBranch: 'main',
          baseSha: 'sha-old',
          currentFiles: [{ path: 'icons/chevron/icon.json', contents: '{}' }],
          previousFiles: [],
          targetBranch: 'branch-x',
        },
        provider,
      );

      expect(result.ok).toBe(false);
      const auth = result.conflicts.find((c) => c.kind === 'auth-expired');
      expect(auth).toBeDefined();
      expect(auth!.code).toBe('AUTH_TOKEN_EXPIRED');
      expect(auth!.suggestedActions).toEqual(['re-authenticate']);
      expect(result.remoteHeadSha).toBe('');
    });

    test('detected on token-related error', async () => {
      provider.injectFault('getBranchRef', new Error('token expired'));

      const result = await checkConflicts(
        {
          owner: OWNER,
          repo: REPO,
          baseBranch: 'main',
          baseSha: 'sha-old',
          currentFiles: [{ path: 'icons/chevron/icon.json', contents: '{}' }],
          previousFiles: [],
          targetBranch: 'branch-x',
        },
        provider,
      );

      expect(result.ok).toBe(false);
      expect(result.conflicts[0]!.kind).toBe('auth-expired');
    });

    test('non-auth errors rethrow', async () => {
      provider.injectFault('getBranchRef', new Error('network timeout'));

      await expect(
        checkConflicts(
          {
            owner: OWNER,
            repo: REPO,
            baseBranch: 'main',
            baseSha: 'sha-old',
            currentFiles: [],
            previousFiles: [],
            targetBranch: 'branch-x',
          },
          provider,
        ),
      ).rejects.toThrow('network timeout');
    });
  });
});

// ===========================================================================
// Conflict response structure tests
// ===========================================================================

describe('Conflict response structure', () => {
  let provider: FaultInjectionProvider;

  beforeEach(() => {
    provider = new FaultInjectionProvider();
    provider.seedBranchSha(OWNER, REPO, 'main', 'sha-new');
  });

  test('syncPr conflict response includes refreshedBaseSha', async () => {
    provider.seedMissingBranch('icons/update-chevron-20260315-1430');
    const result = await syncPr(
      baseRequest({ baseSha: 'sha-old' }),
      { provider, now: FIXED_DATE },
    );

    expect(result.kind).toBe('conflict');
    if (result.kind === 'conflict') {
      expect(result.refreshedBaseSha).toBe('sha-new');
      expect(result.remoteHeadSha).toBe('sha-new');
      expect(result.localBaseSha).toBe('sha-old');
    }
  });

  test('syncPr conflict response includes aggregated suggestedActions', async () => {
    // Create both base-sha-drift (which has refresh-and-re-export + force-sync)
    // and branch collision (which has rename-branch)
    provider.seedBranchSha(OWNER, REPO, 'icons/update-chevron-20260315-1430', 'some-sha');
    const result = await syncPr(
      baseRequest({ baseSha: 'sha-old' }),
      { provider, now: FIXED_DATE },
    );

    expect(result.kind).toBe('conflict');
    if (result.kind === 'conflict') {
      expect(result.suggestedActions).toContain('refresh-and-re-export');
      expect(result.suggestedActions).toContain('force-sync');
    }
  });

  test('every conflict has code and suggestedActions', async () => {
    provider.seedMissingBranch('icons/update-chevron-20260315-1430');
    const result = await syncPr(
      baseRequest({ baseSha: 'sha-old' }),
      { provider, now: FIXED_DATE },
    );

    expect(result.kind).toBe('conflict');
    if (result.kind === 'conflict') {
      for (const conflict of result.conflicts) {
        expect(typeof conflict.code).toBe('string');
        expect(conflict.code.length).toBeGreaterThan(0);
        expect(Array.isArray(conflict.suggestedActions)).toBe(true);
        expect(conflict.suggestedActions.length).toBeGreaterThan(0);
      }
    }
  });
});

// ===========================================================================
// Error wrapping for mutating steps (7-10)
// ===========================================================================

describe('Error wrapping for mutating steps', () => {
  let provider: FaultInjectionProvider;

  beforeEach(() => {
    provider = new FaultInjectionProvider();
    provider.seedBranchSha(OWNER, REPO, 'main', 'base-sha-000');
  });

  test('step 7: branch creation failure throws BranchCreationError', async () => {
    provider.injectFault('createBranch', new Error('ref update failed (422)'));

    await expect(
      syncPr(baseRequest(), { provider, now: FIXED_DATE }),
    ).rejects.toThrow(BranchCreationError);
  });

  test('step 8: listFiles failure returns error with orphanBranch', async () => {
    provider.injectFault('listFiles', new Error('tree listing failed (500)'));

    const result = await syncPr(baseRequest(), { provider, now: FIXED_DATE });

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.error).toBe('PROVIDER_ERROR');
      expect(result.orphanBranch).toBeDefined();
      expect(result.orphanBranch!.startsWith('icons/')).toBe(true);
    }
  });

  test('step 9: file write failure returns error with orphanBranch', async () => {
    provider.injectFault('createOrUpdateFile', new Error('blob creation failed (502)'));

    const result = await syncPr(baseRequest(), { provider, now: FIXED_DATE });

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.error).toBe('FILE_WRITE_FAILURE');
      expect(result.orphanBranch).toBeDefined();
    }
  });

  test('step 9: file delete failure returns error with orphanBranch', async () => {
    // Seed remote files so there's something to delete
    provider.seedListFiles(OWNER, REPO, 'main', ['icons/old-icon/icon.json']);
    // Seed the file on the branch so getFileSha returns a sha
    provider.seedFile(OWNER, REPO, 'main', 'icons/old-icon/icon.json', '{}');
    provider.injectFault('deleteFile', new Error('ref update failed'));

    const result = await syncPr(baseRequest(), { provider, now: FIXED_DATE });

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.error).toBe('FILE_DELETE_FAILURE');
      expect(result.orphanBranch).toBeDefined();
    }
  });

  test('step 10: PR creation failure returns error with orphanBranch', async () => {
    provider.injectFault('createPullRequest', new Error('Validation Failed (422)'));

    const result = await syncPr(baseRequest(), { provider, now: FIXED_DATE });

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.error).toBe('PR_CREATION_FAILURE');
      expect(result.orphanBranch).toBeDefined();
      expect(result.message).toContain('Validation Failed');
    }
  });

  test('auth failure (403) during file write is classified correctly', async () => {
    provider.injectFault('createOrUpdateFile', new Error('403 forbidden'));

    const result = await syncPr(baseRequest(), { provider, now: FIXED_DATE });

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.error).toBe('REPO_PERMISSION_FAILURE');
    }
  });
});

// ===========================================================================
// No silent mutation guarantee
// ===========================================================================

describe('No silent mutations on conflict', () => {
  let provider: FaultInjectionProvider;

  beforeEach(() => {
    provider = new FaultInjectionProvider();
    provider.seedBranchSha(OWNER, REPO, 'main', 'sha-new');
  });

  test('conflict detection never creates branches or writes files', async () => {
    provider.seedMissingBranch('icons/update-chevron-20260315-1430');
    const result = await syncPr(
      baseRequest({ baseSha: 'sha-old' }),
      { provider, now: FIXED_DATE },
    );

    expect(result.kind).toBe('conflict');

    // Verify no mutations were made
    const mutatingMethods = ['createBranch', 'createOrUpdateFile', 'deleteFile', 'createPullRequest'];
    const mutations = provider.calls.filter((c) => mutatingMethods.includes(c.method));
    expect(mutations).toHaveLength(0);
  });

  test('force=true skips conflict check and proceeds', async () => {
    // Same scenario: stale baseSha
    provider.seedMissingBranch('icons/update-chevron-20260315-1430');
    const result = await syncPr(
      baseRequest({ baseSha: 'sha-old', force: true }),
      { provider, now: FIXED_DATE },
    );

    expect(result.kind).toBe('success');
  });

  test('no-op never mutates even with stale baseSha', async () => {
    const files = [
      { path: 'icons/chevron/icon.json', contents: '{"name":"chevron"}' },
      { path: 'manifest.json', contents: '{}' },
    ];

    const result = await syncPr(
      baseRequest({
        baseSha: 'sha-old',
        files,
        previousFiles: files, // identical → no-op
      }),
      { provider, now: FIXED_DATE },
    );

    expect(result.kind).toBe('no-op');
    expect(provider.hasMutations()).toBe(false);
  });
});

// ===========================================================================
// Retry-safe behavior
// ===========================================================================

describe('Retry-safe behavior', () => {
  let provider: FaultInjectionProvider;

  beforeEach(() => {
    provider = new FaultInjectionProvider();
    provider.seedBranchSha(OWNER, REPO, 'main', 'sha-v2');
  });

  test('conflict response provides refreshedBaseSha for retry', async () => {
    provider.seedMissingBranch('icons/update-chevron-20260315-1430');
    const result = await syncPr(
      baseRequest({ baseSha: 'sha-v1' }),
      { provider, now: FIXED_DATE },
    );

    expect(result.kind).toBe('conflict');
    if (result.kind === 'conflict') {
      // Caller can use refreshedBaseSha for the next attempt
      expect(result.refreshedBaseSha).toBe('sha-v2');
    }
  });

  test('retrying with refreshed baseSha succeeds when no other conflicts', async () => {
    provider.seedMissingBranch('icons/update-chevron-20260315-1430');

    // First attempt — conflict due to stale SHA
    const first = await syncPr(
      baseRequest({ baseSha: 'sha-v1' }),
      { provider, now: FIXED_DATE },
    );
    expect(first.kind).toBe('conflict');

    // Second attempt — use the refreshed SHA
    if (first.kind === 'conflict') {
      const second = await syncPr(
        baseRequest({ baseSha: first.refreshedBaseSha! }),
        { provider, now: FIXED_DATE },
      );
      expect(second.kind).toBe('success');
    }
  });

  test('resolveUniqueBranch recovers from branch collision', async () => {
    // Preferred name is taken
    provider.seedBranchSha(OWNER, REPO, 'icons/update-chevron-20260315-1430', 'sha-x');

    const branch = await resolveUniqueBranch(
      provider,
      OWNER,
      REPO,
      'icons/update-chevron-20260315-1430',
    );

    // Should get a suffixed name
    expect(branch).toBe('icons/update-chevron-20260315-1430-2');
  });

  test('resolveUniqueBranch exhausts attempts and throws', async () => {
    // Fill all candidate names
    provider.seedBranchSha(OWNER, REPO, 'icons/sync', 'sha-1');
    provider.seedBranchSha(OWNER, REPO, 'icons/sync-2', 'sha-2');
    provider.seedBranchSha(OWNER, REPO, 'icons/sync-3', 'sha-3');
    provider.seedBranchSha(OWNER, REPO, 'icons/sync-4', 'sha-4');
    provider.seedBranchSha(OWNER, REPO, 'icons/sync-5', 'sha-5');
    provider.seedBranchSha(OWNER, REPO, 'icons/sync-6', 'sha-6');

    await expect(
      resolveUniqueBranch(provider, OWNER, REPO, 'icons/sync'),
    ).rejects.toThrow('Could not find a unique branch name');
  });
});

// ===========================================================================
// Error code / suggested action completeness
// ===========================================================================

describe('Error code and suggested action completeness', () => {
  const expectedMappings: Array<{
    kind: ConflictKind;
    code: ConflictErrorCode;
    actions: SuggestedAction[];
  }> = [
    { kind: 'base-sha-drift', code: 'STALE_BASE_REVISION', actions: ['refresh-and-re-export', 'force-sync'] },
    { kind: 'icon-changed-remotely', code: 'ICON_CHANGED_REMOTELY', actions: ['pull-remote-changes', 'refresh-and-re-export', 'force-sync'] },
    { kind: 'icon-deleted-remotely', code: 'ICON_DELETED_REMOTELY', actions: ['discard-deleted-icons', 'refresh-and-re-export', 'force-sync'] },
    { kind: 'manifest-changed-remotely', code: 'MANIFEST_CONFLICT', actions: ['resolve-manifest', 'refresh-and-re-export', 'force-sync'] },
    { kind: 'branch-already-exists', code: 'BRANCH_NAME_COLLISION', actions: ['rename-branch'] },
    { kind: 'auth-expired', code: 'AUTH_TOKEN_EXPIRED', actions: ['re-authenticate'] },
  ];

  for (const { kind, code, actions } of expectedMappings) {
    test(`${kind} → ${code} with correct actions`, () => {
      // Import the maps indirectly by constructing a conflict through checkConflicts
      // Instead, we test via the makeConflict path by examining the exports
      // We'll re-import and test the type mappings
      const { CONFLICT_ERROR_CODES, CONFLICT_SUGGESTED_ACTIONS } =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../lib/sync-service/conflicts') as {
          CONFLICT_ERROR_CODES: Record<ConflictKind, ConflictErrorCode>;
          CONFLICT_SUGGESTED_ACTIONS: Record<ConflictKind, SuggestedAction[]>;
        };

      expect(CONFLICT_ERROR_CODES[kind]).toBe(code);
      expect(CONFLICT_SUGGESTED_ACTIONS[kind]).toEqual(actions);
    });
  }
});
