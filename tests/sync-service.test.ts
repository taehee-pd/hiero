import { describe, expect, test, beforeEach } from 'bun:test';

import type {
  GitProvider,
  GitRef,
  FileCommitResult,
  PullRequestResult,
} from '../lib/sync-service/git-provider';
import type { SyncPrRequest, ChangedFileSummary } from '../lib/sync-service/contracts';
import { validateSyncPrRequest } from '../lib/sync-service/contracts';
import { syncPr } from '../lib/sync-service/sync-pr';
import type { SyncPrResult } from '../lib/sync-service/sync-pr';
import {
  generateBranchName,
  generateCommitMessage,
  generatePrTitle,
  generatePrBody,
} from '../lib/sync-service/metadata';
import {
  diffSourcePayloads,
  extractIconDir,
} from '../lib/sync-service/diff-source';
import type { SourceDiffResult } from '../lib/sync-service/diff-source';
import {
  checkConflicts,
  resolveUniqueBranch,
} from '../lib/sync-service/conflicts';
import {
  SyncError,
  AuthFailureError,
  RepoPermissionError,
  BranchCreationError,
  FileWriteError,
  FileDeleteError,
  PrCreationError,
  ValidationFailureError,
  classifyGitHubError,
} from '../lib/sync-service/errors';

// ---------------------------------------------------------------------------
// Mock git provider
// ---------------------------------------------------------------------------

type FileStore = Map<string, { contents: string; sha: string }>;

class MockGitProvider implements GitProvider {
  /** Tracks every method call for assertion. */
  calls: Array<{ method: string; args: unknown[] }> = [];

  /** In-memory file store keyed by `owner/repo/branch/path`. */
  private files: FileStore = new Map();

  /** Counter for generating SHAs. */
  private shaCounter = 0;

  /** Branches that should throw on getBranchRef (simulating nonexistence). */
  private missingBranches = new Set<string>();

  /** Custom base SHA per branch. */
  private branchShas = new Map<string, string>();

  private nextSha(): string {
    this.shaCounter++;
    return `sha-${String(this.shaCounter).padStart(6, '0')}`;
  }

  /** Seed an existing file so the provider knows it's already on the branch. */
  seedFile(owner: string, repo: string, branch: string, path: string, contents: string) {
    const key = `${owner}/${repo}/${branch}/${path}`;
    this.files.set(key, { contents, sha: this.nextSha() });
  }

  /** Registered existing files that listFiles will return. */
  private listedFiles = new Map<string, Set<string>>();

  seedListFiles(owner: string, repo: string, branch: string, paths: string[]) {
    this.listedFiles.set(`${owner}/${repo}/${branch}`, new Set(paths));
  }

  /** Mark a branch as missing so getBranchRef throws. */
  seedMissingBranch(branch: string) {
    this.missingBranches.add(branch);
  }

  /** Set a custom SHA for a branch. */
  seedBranchSha(owner: string, repo: string, branch: string, sha: string) {
    this.branchShas.set(`${owner}/${repo}/${branch}`, sha);
  }

  // --- Interface implementation ---

  async getBranchRef(owner: string, repo: string, branch: string): Promise<GitRef> {
    this.calls.push({ method: 'getBranchRef', args: [owner, repo, branch] });
    if (this.missingBranches.has(branch)) {
      throw new Error(`Branch ${branch} not found (404)`);
    }
    const key = `${owner}/${repo}/${branch}`;
    const sha = this.branchShas.get(key) ?? 'base-sha-000';
    return { sha, ref: `refs/heads/${branch}` };
  }

  async createBranch(
    owner: string,
    repo: string,
    baseSha: string,
    newBranch: string,
  ): Promise<GitRef> {
    this.calls.push({ method: 'createBranch', args: [owner, repo, baseSha, newBranch] });
    return { sha: baseSha, ref: `refs/heads/${newBranch}` };
  }

  async getFileSha(
    owner: string,
    repo: string,
    branch: string,
    path: string,
  ): Promise<string | null> {
    this.calls.push({ method: 'getFileSha', args: [owner, repo, branch, path] });
    const key = `${owner}/${repo}/${branch}/${path}`;
    const entry = this.files.get(key);
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
    this.calls.push({
      method: 'createOrUpdateFile',
      args: [owner, repo, branch, path, content, message, existingSha],
    });
    const sha = this.nextSha();
    const commitSha = this.nextSha();
    const key = `${owner}/${repo}/${branch}/${path}`;
    this.files.set(key, { contents: content, sha });
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
    const key = `${owner}/${repo}/${branch}/${path}`;
    this.files.delete(key);
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
    return {
      number: 42,
      url: `https://github.com/${owner}/${repo}/pull/42`,
      title,
      headBranch: head,
      baseBranch: base,
    };
  }

  async listFiles(
    owner: string,
    repo: string,
    branch: string,
    pathPrefix: string,
  ): Promise<Set<string>> {
    this.calls.push({ method: 'listFiles', args: [owner, repo, branch, pathPrefix] });
    const key = `${owner}/${repo}/${branch}`;
    return this.listedFiles.get(key) ?? new Set();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXED_DATE = new Date('2026-03-15T14:30:00.000Z');

function makeRequest(overrides?: Partial<SyncPrRequest>): SyncPrRequest {
  return {
    owner: 'test-org',
    repo: 'design-icons',
    baseBranch: 'main',
    actor: { name: 'Test User', email: 'test@example.com' },
    files: [
      { path: 'icons/chevron/icon.json', contents: '{"schemaVersion":"1.0.0"}' },
      { path: 'icons/chevron/preview.svg', contents: '<svg></svg>' },
      { path: 'manifest.json', contents: '{"iconCount":1}' },
    ],
    ...overrides,
  };
}

/** Assert result is a success and return it typed. */
function expectSuccess(result: SyncPrResult) {
  expect(result.kind).toBe('success');
  if (result.kind !== 'success') throw new Error('Expected success');
  return result;
}

// ===========================================================================
// Error classes
// ===========================================================================

describe('SyncError classes', () => {
  test('AuthFailureError has correct code and status', () => {
    const err = new AuthFailureError();
    expect(err.code).toBe('AUTH_FAILURE');
    expect(err.statusCode).toBe(401);
    expect(err instanceof SyncError).toBe(true);
  });

  test('RepoPermissionError has correct code and status', () => {
    const err = new RepoPermissionError();
    expect(err.code).toBe('REPO_PERMISSION_FAILURE');
    expect(err.statusCode).toBe(403);
  });

  test('BranchCreationError has correct code and status', () => {
    const err = new BranchCreationError();
    expect(err.code).toBe('BRANCH_CREATION_FAILURE');
    expect(err.statusCode).toBe(502);
  });

  test('FileWriteError has correct code and status', () => {
    const err = new FileWriteError();
    expect(err.code).toBe('FILE_WRITE_FAILURE');
    expect(err.statusCode).toBe(502);
  });

  test('FileDeleteError has correct code and status', () => {
    const err = new FileDeleteError();
    expect(err.code).toBe('FILE_DELETE_FAILURE');
    expect(err.statusCode).toBe(502);
  });

  test('PrCreationError has correct code and status', () => {
    const err = new PrCreationError();
    expect(err.code).toBe('PR_CREATION_FAILURE');
    expect(err.statusCode).toBe(502);
  });

  test('ValidationFailureError has correct code and status', () => {
    const err = new ValidationFailureError();
    expect(err.code).toBe('VALIDATION_FAILURE');
    expect(err.statusCode).toBe(400);
  });

  test('toJSON produces a serializable object', () => {
    const err = new AuthFailureError('Custom message');
    const json = err.toJSON();
    expect(json).toEqual({
      error: 'AUTH_FAILURE',
      message: 'Custom message',
      statusCode: 401,
    });
  });

  test('classifyGitHubError detects 401', () => {
    const err = classifyGitHubError(new Error('401 Unauthorized'), 'generic');
    expect(err).toBeInstanceOf(AuthFailureError);
  });

  test('classifyGitHubError detects 403', () => {
    const err = classifyGitHubError(new Error('403 forbidden'), 'generic');
    expect(err).toBeInstanceOf(RepoPermissionError);
  });

  test('classifyGitHubError uses context for branch 404', () => {
    const err = classifyGitHubError(new Error('404 Not Found'), 'branch');
    expect(err).toBeInstanceOf(BranchCreationError);
  });

  test('classifyGitHubError maps file-write context', () => {
    const err = classifyGitHubError(new Error('some error'), 'file-write');
    expect(err).toBeInstanceOf(FileWriteError);
  });

  test('classifyGitHubError maps pr context', () => {
    const err = classifyGitHubError(new Error('some error'), 'pr');
    expect(err).toBeInstanceOf(PrCreationError);
  });
});

// ===========================================================================
// Request validation
// ===========================================================================

describe('validateSyncPrRequest', () => {
  test('accepts valid request', () => {
    const result = validateSyncPrRequest(makeRequest());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.request).toBeDefined();
  });

  test('rejects non-object body', () => {
    const result = validateSyncPrRequest('not an object');
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('JSON object');
  });

  test('rejects missing owner', () => {
    const result = validateSyncPrRequest({ ...makeRequest(), owner: '' });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('owner'))).toBe(true);
  });

  test('rejects missing repo', () => {
    const result = validateSyncPrRequest({ ...makeRequest(), repo: '' });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('repo'))).toBe(true);
  });

  test('rejects missing actor', () => {
    const result = validateSyncPrRequest({ ...makeRequest(), actor: undefined });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('actor'))).toBe(true);
  });

  test('rejects missing actor.name', () => {
    const result = validateSyncPrRequest({
      ...makeRequest(),
      actor: { name: '' },
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('actor.name'))).toBe(true);
  });

  test('rejects non-array files', () => {
    const result = validateSyncPrRequest({ ...makeRequest(), files: 'not-array' });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('files'))).toBe(true);
  });

  test('rejects file missing path', () => {
    const result = validateSyncPrRequest({
      ...makeRequest(),
      files: [{ path: '', contents: 'data' }],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('files[0].path'))).toBe(true);
  });

  test('allows optional baseBranch and packagePath', () => {
    const result = validateSyncPrRequest({
      ...makeRequest(),
      baseBranch: undefined,
      packagePath: undefined,
    });
    expect(result.ok).toBe(true);
  });

  test('allows optional previousFiles', () => {
    const result = validateSyncPrRequest({
      ...makeRequest(),
      previousFiles: [{ path: 'icons/old/icon.json', contents: '{}' }],
    });
    expect(result.ok).toBe(true);
  });

  test('rejects non-array previousFiles', () => {
    const result = validateSyncPrRequest({
      ...makeRequest(),
      previousFiles: 'not-array',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('previousFiles'))).toBe(true);
  });
});

// ===========================================================================
// Metadata generators
// ===========================================================================

describe('generateBranchName', () => {
  test('single icon produces named branch', () => {
    const files = [
      { path: 'icons/chevron/icon.json', contents: '' },
      { path: 'icons/chevron/preview.svg', contents: '' },
      { path: 'manifest.json', contents: '' },
    ];
    const branch = generateBranchName(files, FIXED_DATE);
    expect(branch).toBe('icons/update-chevron-20260315-1430');
  });

  test('multiple icons produces count-based branch', () => {
    const files = [
      { path: 'icons/chevron/icon.json', contents: '' },
      { path: 'icons/play/icon.json', contents: '' },
      { path: 'manifest.json', contents: '' },
    ];
    const branch = generateBranchName(files, FIXED_DATE);
    expect(branch).toBe('icons/update-2-icons-20260315-1430');
  });

  test('no icons produces generic sync branch', () => {
    const files = [{ path: 'manifest.json', contents: '' }];
    const branch = generateBranchName(files, FIXED_DATE);
    expect(branch).toBe('icons/sync-20260315-1430');
  });
});

describe('generateCommitMessage', () => {
  test('includes counts for all change types', () => {
    const changes: ChangedFileSummary = {
      added: ['icons/play/icon.json'],
      updated: ['icons/chevron/icon.json'],
      deleted: ['icons/old/icon.json'],
    };
    const msg = generateCommitMessage(changes, 'Alice');
    expect(msg).toContain('add 1');
    expect(msg).toContain('update 1');
    expect(msg).toContain('remove 1');
    expect(msg).toContain('Alice');
  });

  test('omits zero-count change types', () => {
    const changes: ChangedFileSummary = { added: ['a'], updated: [], deleted: [] };
    const msg = generateCommitMessage(changes, 'Bob');
    expect(msg).toContain('add 1');
    expect(msg).not.toContain('update');
    expect(msg).not.toContain('remove');
  });
});

describe('generatePrTitle', () => {
  test('single icon names it', () => {
    const changes: ChangedFileSummary = {
      added: ['icons/chevron/icon.json'],
      updated: [],
      deleted: [],
    };
    expect(generatePrTitle(changes)).toBe('chore(icons): update chevron');
  });

  test('2-3 icons lists them', () => {
    const changes: ChangedFileSummary = {
      added: ['icons/chevron/icon.json'],
      updated: ['icons/play/icon.json'],
      deleted: [],
    };
    expect(generatePrTitle(changes)).toBe('chore(icons): update chevron, play');
  });

  test('4+ icons uses count', () => {
    const changes: ChangedFileSummary = {
      added: [
        'icons/a/icon.json',
        'icons/b/icon.json',
        'icons/c/icon.json',
        'icons/d/icon.json',
      ],
      updated: [],
      deleted: [],
    };
    expect(generatePrTitle(changes)).toBe('chore(icons): update 4 icons');
  });

  test('no icon paths produces generic title', () => {
    const changes: ChangedFileSummary = { added: [], updated: [], deleted: [] };
    expect(generatePrTitle(changes)).toBe('chore(icons): sync icon sources');
  });
});

describe('generatePrBody', () => {
  test('includes markdown summary table with counts', () => {
    const changes: ChangedFileSummary = {
      added: ['icons/play/icon.json'],
      updated: ['icons/chevron/icon.json'],
      deleted: ['icons/old/icon.json'],
    };
    const body = generatePrBody(changes, 'Alice');
    expect(body).toContain('## Icon Source Sync');
    expect(body).toContain('Alice');
    expect(body).toContain('| Files added | 1 |');
    expect(body).toContain('| Files updated | 1 |');
    expect(body).toContain('| Files deleted | 1 |');
    expect(body).toContain('| Total files changed | 3 |');
    expect(body).toContain('| Icons changed |');
  });

  test('includes schema version', () => {
    const changes: ChangedFileSummary = { added: ['icons/play/icon.json'], updated: [], deleted: [] };
    const body = generatePrBody(changes, 'Alice');
    expect(body).toContain('**Schema version:**');
    expect(body).toContain('icon `');
    expect(body).toContain('manifest `');
  });

  test('includes validation checklist', () => {
    const changes: ChangedFileSummary = { added: [], updated: ['icons/chevron/icon.json'], deleted: [] };
    const body = generatePrBody(changes, 'Alice');
    expect(body).toContain('### Validation Checklist');
    expect(body).toContain('Schema compliance');
    expect(body).toContain('Compile pipeline');
  });

  test('includes icon change table when iconChanges provided', () => {
    const changes: ChangedFileSummary = {
      added: ['icons/play/icon.json'],
      updated: ['icons/chevron/icon.json'],
      deleted: [],
    };
    const body = generatePrBody(changes, 'Alice', {
      iconChanges: [
        { iconDir: 'chevron', kind: 'updated' },
        { iconDir: 'play', kind: 'added' },
      ],
    });
    expect(body).toContain('### Icon Changes');
    expect(body).toContain('`chevron`');
    expect(body).toContain('`play`');
    expect(body).toContain('Updated');
    expect(body).toContain('Added');
  });

  test('file-level detail is in collapsed section', () => {
    const changes: ChangedFileSummary = {
      added: ['icons/play/icon.json'],
      updated: [],
      deleted: [],
    };
    const body = generatePrBody(changes, 'Bob');
    expect(body).toContain('<details>');
    expect(body).toContain('**Added**');
    expect(body).not.toContain('**Updated**');
    expect(body).not.toContain('**Deleted**');
  });
});

// ===========================================================================
// Source diff engine
// ===========================================================================

describe('diffSourcePayloads', () => {
  test('identical payloads produce no-op', () => {
    const files = [
      { path: 'icons/chevron/icon.json', contents: '{"id":"c"}' },
      { path: 'icons/chevron/preview.svg', contents: '<svg/>' },
      { path: 'manifest.json', contents: '{}' },
    ];
    const result = diffSourcePayloads(files, files);
    expect(result.isNoOp).toBe(true);
    expect(result.filesToWrite).toHaveLength(0);
    expect(result.filesToDelete).toHaveLength(0);
    expect(result.iconChanges).toHaveLength(0);
  });

  test('detects added icon', () => {
    const previous = [
      { path: 'icons/chevron/icon.json', contents: '{"id":"c"}' },
      { path: 'manifest.json', contents: '{}' },
    ];
    const current = [
      { path: 'icons/chevron/icon.json', contents: '{"id":"c"}' },
      { path: 'icons/play/icon.json', contents: '{"id":"p"}' },
      { path: 'icons/play/preview.svg', contents: '<svg/>' },
      { path: 'manifest.json', contents: '{"iconCount":2}' },
    ];
    const result = diffSourcePayloads(previous, current);

    expect(result.isNoOp).toBe(false);
    expect(result.filesToWrite.length).toBeGreaterThanOrEqual(2); // play + manifest
    expect(result.filesToDelete).toHaveLength(0);

    const addedIcon = result.iconChanges.find((c) => c.iconDir === 'play');
    expect(addedIcon).toBeDefined();
    expect(addedIcon!.kind).toBe('added');
  });

  test('detects removed icon', () => {
    const previous = [
      { path: 'icons/chevron/icon.json', contents: '{"id":"c"}' },
      { path: 'icons/chevron/preview.svg', contents: '<svg/>' },
      { path: 'icons/play/icon.json', contents: '{"id":"p"}' },
      { path: 'icons/play/preview.svg', contents: '<svg/>' },
      { path: 'manifest.json', contents: '{}' },
    ];
    const current = [
      { path: 'icons/chevron/icon.json', contents: '{"id":"c"}' },
      { path: 'icons/chevron/preview.svg', contents: '<svg/>' },
      { path: 'manifest.json', contents: '{"iconCount":1}' },
    ];
    const result = diffSourcePayloads(previous, current);

    expect(result.isNoOp).toBe(false);
    expect(result.filesToDelete.length).toBe(2); // play icon.json + preview.svg

    const removedIcon = result.iconChanges.find((c) => c.iconDir === 'play');
    expect(removedIcon).toBeDefined();
    expect(removedIcon!.kind).toBe('removed');
  });

  test('detects updated icon (icon.json changed)', () => {
    const previous = [
      { path: 'icons/chevron/icon.json', contents: '{"v":1}' },
      { path: 'icons/chevron/preview.svg', contents: '<svg/>' },
      { path: 'manifest.json', contents: '{}' },
    ];
    const current = [
      { path: 'icons/chevron/icon.json', contents: '{"v":2}' },
      { path: 'icons/chevron/preview.svg', contents: '<svg/>' },
      { path: 'manifest.json', contents: '{}' },
    ];
    const result = diffSourcePayloads(previous, current);

    expect(result.isNoOp).toBe(false);
    expect(result.filesToWrite).toHaveLength(1); // only icon.json
    expect(result.filesToWrite[0]!.path).toBe('icons/chevron/icon.json');
    expect(result.filesToWrite[0]!.kind).toBe('icon-updated');

    const updatedIcon = result.iconChanges.find((c) => c.iconDir === 'chevron');
    expect(updatedIcon).toBeDefined();
    expect(updatedIcon!.kind).toBe('updated');
  });

  test('detects preview-only change', () => {
    const previous = [
      { path: 'icons/chevron/icon.json', contents: '{"v":1}' },
      { path: 'icons/chevron/preview.svg', contents: '<svg>old</svg>' },
      { path: 'manifest.json', contents: '{}' },
    ];
    const current = [
      { path: 'icons/chevron/icon.json', contents: '{"v":1}' },
      { path: 'icons/chevron/preview.svg', contents: '<svg>new</svg>' },
      { path: 'manifest.json', contents: '{}' },
    ];
    const result = diffSourcePayloads(previous, current);

    expect(result.isNoOp).toBe(false);
    expect(result.filesToWrite).toHaveLength(1);
    expect(result.filesToWrite[0]!.kind).toBe('preview-only');

    const chevronChange = result.iconChanges.find((c) => c.iconDir === 'chevron');
    expect(chevronChange).toBeDefined();
    expect(chevronChange!.kind).toBe('preview-only');
  });

  test('detects manifest-only change', () => {
    const previous = [
      { path: 'icons/chevron/icon.json', contents: '{"v":1}' },
      { path: 'manifest.json', contents: '{"iconCount":1}' },
    ];
    const current = [
      { path: 'icons/chevron/icon.json', contents: '{"v":1}' },
      { path: 'manifest.json', contents: '{"iconCount":1,"generatedAt":"new"}' },
    ];
    const result = diffSourcePayloads(previous, current);

    expect(result.isNoOp).toBe(false);
    expect(result.filesToWrite).toHaveLength(1);
    expect(result.filesToWrite[0]!.kind).toBe('manifest-changed');
    // No icon-level changes
    expect(result.iconChanges).toHaveLength(0);
  });

  test('output is deterministic (sorted)', () => {
    const previous = [
      { path: 'manifest.json', contents: '{}' },
    ];
    const current = [
      { path: 'icons/zebra/icon.json', contents: '{}' },
      { path: 'icons/alpha/icon.json', contents: '{}' },
      { path: 'manifest.json', contents: '{"new":true}' },
    ];
    const result = diffSourcePayloads(previous, current);
    const paths = result.filesToWrite.map((f) => f.path);
    expect(paths).toEqual([...paths].sort());
  });

  test('extractIconDir parses icon paths', () => {
    expect(extractIconDir('icons/chevron/icon.json')).toBe('chevron');
    expect(extractIconDir('icons/my-icon/preview.svg')).toBe('my-icon');
    expect(extractIconDir('manifest.json')).toBeNull();
    expect(extractIconDir('other/file.txt')).toBeNull();
  });

  test('first sync (empty previous) treats all files as added', () => {
    const current = [
      { path: 'icons/chevron/icon.json', contents: '{}' },
      { path: 'icons/chevron/preview.svg', contents: '<svg/>' },
      { path: 'manifest.json', contents: '{}' },
    ];
    const result = diffSourcePayloads([], current);

    expect(result.isNoOp).toBe(false);
    expect(result.filesToWrite).toHaveLength(3);
    expect(result.filesToDelete).toHaveLength(0);
    expect(result.iconChanges).toHaveLength(1);
    expect(result.iconChanges[0]!.kind).toBe('added');
  });
});

// ===========================================================================
// Conflict detection
// ===========================================================================

describe('checkConflicts', () => {
  let provider: MockGitProvider;

  beforeEach(() => {
    provider = new MockGitProvider();
  });

  test('no conflicts when baseSha matches remote HEAD', async () => {
    provider.seedBranchSha('org', 'repo', 'main', 'sha-abc');
    // Target branch doesn't exist
    provider.seedMissingBranch('icons/update-chevron-20260315-1430');

    const result = await checkConflicts(
      {
        owner: 'org',
        repo: 'repo',
        baseBranch: 'main',
        baseSha: 'sha-abc',
        currentFiles: [{ path: 'icons/chevron/icon.json', contents: '{}' }],
        previousFiles: [],
        targetBranch: 'icons/update-chevron-20260315-1430',
      },
      provider,
    );

    expect(result.ok).toBe(true);
    expect(result.conflicts).toHaveLength(0);
    expect(result.remoteHeadSha).toBe('sha-abc');
  });

  test('detects base SHA drift', async () => {
    provider.seedBranchSha('org', 'repo', 'main', 'sha-new');
    provider.seedMissingBranch('icons/update-chevron-20260315-1430');

    const result = await checkConflicts(
      {
        owner: 'org',
        repo: 'repo',
        baseBranch: 'main',
        baseSha: 'sha-old',
        currentFiles: [{ path: 'icons/chevron/icon.json', contents: '{}' }],
        previousFiles: [],
        targetBranch: 'icons/update-chevron-20260315-1430',
      },
      provider,
    );

    expect(result.ok).toBe(false);
    const drift = result.conflicts.find((c) => c.kind === 'base-sha-drift');
    expect(drift).toBeDefined();
    expect(drift!.message).toContain('sha-old');
    expect(drift!.message).toContain('sha-new');
  });

  test('detects branch name collision', async () => {
    // Target branch already exists (getBranchRef won't throw)
    const result = await checkConflicts(
      {
        owner: 'org',
        repo: 'repo',
        baseBranch: 'main',
        baseSha: 'base-sha-000', // matches default
        currentFiles: [{ path: 'icons/chevron/icon.json', contents: '{}' }],
        previousFiles: [],
        targetBranch: 'main', // using an existing branch name
      },
      provider,
    );

    expect(result.ok).toBe(false);
    const collision = result.conflicts.find((c) => c.kind === 'branch-already-exists');
    expect(collision).toBeDefined();
  });

  test('detects icon deleted remotely', async () => {
    provider.seedBranchSha('org', 'repo', 'main', 'sha-new');
    provider.seedMissingBranch('icons/update-chevron-20260315-1430');
    // Remote has chevron but NOT play (play was deleted remotely)
    provider.seedListFiles('org', 'repo', 'main', [
      'icons/chevron/icon.json',
      'icons/chevron/preview.svg',
    ]);

    const result = await checkConflicts(
      {
        owner: 'org',
        repo: 'repo',
        baseBranch: 'main',
        baseSha: 'sha-old',
        currentFiles: [
          { path: 'icons/play/icon.json', contents: '{"new":true}' },
        ],
        previousFiles: [
          { path: 'icons/play/icon.json', contents: '{"old":true}' },
          { path: 'icons/play/preview.svg', contents: '<svg/>' },
        ],
        targetBranch: 'icons/update-chevron-20260315-1430',
      },
      provider,
    );

    expect(result.ok).toBe(false);
    const deleted = result.conflicts.find((c) => c.kind === 'icon-deleted-remotely');
    expect(deleted).toBeDefined();
    expect(deleted!.iconDirs).toContain('play');
  });

  test('detects manifest changed remotely by another tool', async () => {
    provider.seedBranchSha('org', 'repo', 'main', 'sha-new');
    provider.seedMissingBranch('icons/update-chevron-20260315-1430');
    // Remote has manifest.json that wasn't in our previous sync
    provider.seedListFiles('org', 'repo', 'main', [
      'icons/chevron/icon.json',
      'manifest.json',
    ]);

    const result = await checkConflicts(
      {
        owner: 'org',
        repo: 'repo',
        baseBranch: 'main',
        baseSha: 'sha-old',
        currentFiles: [
          { path: 'icons/chevron/icon.json', contents: '{}' },
          { path: 'manifest.json', contents: '{}' },
        ],
        previousFiles: [
          { path: 'icons/chevron/icon.json', contents: '{}' },
          // No manifest in previous
        ],
        targetBranch: 'icons/update-chevron-20260315-1430',
      },
      provider,
    );

    expect(result.ok).toBe(false);
    const manifestConflict = result.conflicts.find(
      (c) => c.kind === 'manifest-changed-remotely',
    );
    expect(manifestConflict).toBeDefined();
  });

  test('returns structured conflict data with remoteHeadSha and localBaseSha', async () => {
    provider.seedBranchSha('org', 'repo', 'main', 'sha-remote');
    provider.seedMissingBranch('branch-x');

    const result = await checkConflicts(
      {
        owner: 'org',
        repo: 'repo',
        baseBranch: 'main',
        baseSha: 'sha-local',
        currentFiles: [],
        previousFiles: [],
        targetBranch: 'branch-x',
      },
      provider,
    );

    expect(result.remoteHeadSha).toBe('sha-remote');
    expect(result.localBaseSha).toBe('sha-local');
  });
});

// ===========================================================================
// Branch name collision recovery
// ===========================================================================

describe('resolveUniqueBranch', () => {
  let provider: MockGitProvider;

  beforeEach(() => {
    provider = new MockGitProvider();
  });

  test('returns preferred name when branch does not exist', async () => {
    provider.seedMissingBranch('icons/update-chevron-20260315-1430');
    const name = await resolveUniqueBranch(
      provider,
      'org',
      'repo',
      'icons/update-chevron-20260315-1430',
    );
    expect(name).toBe('icons/update-chevron-20260315-1430');
  });

  test('appends suffix when preferred branch exists', async () => {
    // Default mock returns success (branch exists) for the base name
    // but throws for -2
    provider.seedMissingBranch('icons/update-chevron-20260315-1430-2');

    const name = await resolveUniqueBranch(
      provider,
      'org',
      'repo',
      'icons/update-chevron-20260315-1430',
    );
    expect(name).toBe('icons/update-chevron-20260315-1430-2');
  });

  test('increments suffix until unique name found', async () => {
    // -2 also exists, -3 doesn't
    provider.seedMissingBranch('icons/update-chevron-20260315-1430-3');

    const name = await resolveUniqueBranch(
      provider,
      'org',
      'repo',
      'icons/update-chevron-20260315-1430',
    );
    expect(name).toBe('icons/update-chevron-20260315-1430-3');
  });

  test('throws after maxAttempts exhausted', async () => {
    // All branches exist (no seedMissingBranch calls)
    await expect(
      resolveUniqueBranch(provider, 'org', 'repo', 'taken-branch', 2),
    ).rejects.toThrow('Could not find a unique branch name');
  });
});

// ===========================================================================
// Sync PR orchestrator — integration tests with mock provider
// ===========================================================================

describe('syncPr', () => {
  let provider: MockGitProvider;

  beforeEach(() => {
    provider = new MockGitProvider();
    // Default: the generated branch name doesn't exist yet
    provider.seedMissingBranch('icons/update-chevron-20260315-1430');
  });

  test('creates branch, commits files, and opens PR for new icons (first sync)', async () => {
    const request = makeRequest();
    const result = expectSuccess(await syncPr(request, { provider, now: FIXED_DATE }));

    expect(result.branch).toBe('icons/update-chevron-20260315-1430');
    expect(result.pr.number).toBe(42);
    expect(result.pr.url).toContain('test-org/design-icons/pull/42');
    expect(result.changedFiles.added).toHaveLength(3);
    expect(result.changedFiles.updated).toHaveLength(0);
    expect(result.changedFiles.deleted).toHaveLength(0);
    expect(result.validation.ok).toBe(true);

    // Revision tracking
    expect(result.revision.baseBranchHeadSha).toBe('base-sha-000');
    expect(result.revision.lastSyncedCommitSha).toMatch(/^sha-/);

    // Icon changes
    expect(result.iconChanges.length).toBeGreaterThanOrEqual(1);
    expect(result.iconChanges.some((c) => c.iconDir === 'chevron' && c.kind === 'added')).toBe(true);
  });

  test('detects updated and deleted files when existing files are present', async () => {
    provider.seedListFiles('test-org', 'design-icons', 'main', [
      'icons/chevron/icon.json',
      'icons/chevron/preview.svg',
      'icons/old-icon/icon.json',
      'icons/old-icon/preview.svg',
    ]);

    provider.seedFile('test-org', 'design-icons', 'icons/update-chevron-20260315-1430', 'icons/chevron/icon.json', 'old');
    provider.seedFile('test-org', 'design-icons', 'icons/update-chevron-20260315-1430', 'icons/chevron/preview.svg', 'old');
    provider.seedFile('test-org', 'design-icons', 'icons/update-chevron-20260315-1430', 'icons/old-icon/icon.json', 'old');
    provider.seedFile('test-org', 'design-icons', 'icons/update-chevron-20260315-1430', 'icons/old-icon/preview.svg', 'old');

    const request = makeRequest();
    const result = expectSuccess(await syncPr(request, { provider, now: FIXED_DATE }));

    expect(result.changedFiles.updated).toContain('icons/chevron/icon.json');
    expect(result.changedFiles.updated).toContain('icons/chevron/preview.svg');
    expect(result.changedFiles.added).toContain('manifest.json');
    expect(result.changedFiles.deleted).toContain('icons/old-icon/icon.json');
    expect(result.changedFiles.deleted).toContain('icons/old-icon/preview.svg');

    const deleteCalls = provider.calls.filter((c) => c.method === 'deleteFile');
    expect(deleteCalls).toHaveLength(2);
  });

  test('applies packagePath prefix to file paths', async () => {
    const request = makeRequest({ packagePath: 'packages/icons' });
    const result = expectSuccess(await syncPr(request, { provider, now: FIXED_DATE }));

    const createCalls = provider.calls.filter((c) => c.method === 'createOrUpdateFile');
    const paths = createCalls.map((c) => (c.args as string[])[3]);

    expect(paths.every((p) => p!.startsWith('packages/icons/'))).toBe(true);
    expect(paths).toContain('packages/icons/icons/chevron/icon.json');
  });

  test('defaults baseBranch to main', async () => {
    const request = makeRequest({ baseBranch: undefined });
    await syncPr(request, { provider, now: FIXED_DATE });

    const branchRefCalls = provider.calls.filter((c) => c.method === 'getBranchRef');
    // Should resolve main at some point
    expect(branchRefCalls.some((c) => (c.args as string[])[2] === 'main')).toBe(true);
  });

  test('rejects empty files array', async () => {
    const request = makeRequest({ files: [] });
    await expect(syncPr(request, { provider, now: FIXED_DATE })).rejects.toThrow(
      ValidationFailureError,
    );
  });

  test('rejects path traversal in files', async () => {
    const request = makeRequest({
      files: [{ path: '../../../etc/passwd', contents: 'hack' }],
    });
    await expect(syncPr(request, { provider, now: FIXED_DATE })).rejects.toThrow(
      ValidationFailureError,
    );
  });

  test('never pushes directly to base branch (always creates feature branch)', async () => {
    const request = makeRequest();
    const result = expectSuccess(await syncPr(request, { provider, now: FIXED_DATE }));

    const createBranchCalls = provider.calls.filter((c) => c.method === 'createBranch');
    expect(createBranchCalls).toHaveLength(1);

    const branchName = (createBranchCalls[0]!.args as string[])[3];
    expect(branchName).toMatch(/^icons\//);
    expect(branchName).not.toBe('main');

    const fileCalls = provider.calls.filter((c) => c.method === 'createOrUpdateFile');
    for (const call of fileCalls) {
      const branch = (call.args as string[])[2];
      expect(branch).toBe(branchName);
    }
  });

  test('PR targets the base branch, not the feature branch', async () => {
    const request = makeRequest({ baseBranch: 'develop' });
    await syncPr(request, { provider, now: FIXED_DATE });

    const prCall = provider.calls.find((c) => c.method === 'createPullRequest');
    const [, , , base] = prCall!.args as string[];
    expect(base).toBe('develop');
  });

  test('returns commitSha from last file write', async () => {
    const request = makeRequest();
    const result = expectSuccess(await syncPr(request, { provider, now: FIXED_DATE }));
    expect(result.commitSha).toMatch(/^sha-/);
  });

  test('handles custom baseBranch', async () => {
    const request = makeRequest({ baseBranch: 'release/v2' });
    await syncPr(request, { provider, now: FIXED_DATE });

    const refCalls = provider.calls.filter((c) => c.method === 'getBranchRef');
    expect(refCalls.some((c) => (c.args as string[])[2] === 'release/v2')).toBe(true);
  });
});

// ===========================================================================
// No-op sync (Phase 3)
// ===========================================================================

describe('syncPr no-op detection', () => {
  let provider: MockGitProvider;

  beforeEach(() => {
    provider = new MockGitProvider();
    provider.seedMissingBranch('icons/update-chevron-20260315-1430');
  });

  test('returns no-op when previous and current files are identical', async () => {
    const files = [
      { path: 'icons/chevron/icon.json', contents: '{"schemaVersion":"1.0.0"}' },
      { path: 'icons/chevron/preview.svg', contents: '<svg></svg>' },
      { path: 'manifest.json', contents: '{"iconCount":1}' },
    ];

    const request = makeRequest({ files, previousFiles: files });
    const result = await syncPr(request, { provider, now: FIXED_DATE });

    expect(result.kind).toBe('no-op');
    if (result.kind === 'no-op') {
      expect(result.message).toContain('No changes');
    }

    // No branch/PR calls should have been made
    expect(provider.calls.filter((c) => c.method === 'createBranch')).toHaveLength(0);
    expect(provider.calls.filter((c) => c.method === 'createPullRequest')).toHaveLength(0);
  });
});

// ===========================================================================
// Single icon update (Phase 3 — only changed files committed)
// ===========================================================================

describe('syncPr differential sync', () => {
  let provider: MockGitProvider;

  beforeEach(() => {
    provider = new MockGitProvider();
    provider.seedMissingBranch('icons/update-chevron-20260315-1430');
  });

  test('only commits changed files when previousFiles is provided', async () => {
    const previousFiles = [
      { path: 'icons/chevron/icon.json', contents: '{"v":1}' },
      { path: 'icons/chevron/preview.svg', contents: '<svg>old</svg>' },
      { path: 'manifest.json', contents: '{"iconCount":1}' },
    ];
    const currentFiles = [
      { path: 'icons/chevron/icon.json', contents: '{"v":2}' }, // changed
      { path: 'icons/chevron/preview.svg', contents: '<svg>old</svg>' }, // unchanged
      { path: 'manifest.json', contents: '{"iconCount":1}' }, // unchanged
    ];

    const request = makeRequest({ files: currentFiles, previousFiles });
    const result = expectSuccess(await syncPr(request, { provider, now: FIXED_DATE }));

    // Only 1 file should have been written (the changed icon.json)
    const createCalls = provider.calls.filter((c) => c.method === 'createOrUpdateFile');
    expect(createCalls).toHaveLength(1);
    expect((createCalls[0]!.args as string[])[3]).toBe('icons/chevron/icon.json');

    // iconChanges should classify this as an update
    expect(result.iconChanges.some((c) => c.iconDir === 'chevron' && c.kind === 'updated')).toBe(true);
  });

  test('add + remove icons in single sync', async () => {
    // Branch name from current files (only `fresh` icon dir)
    provider.seedMissingBranch('icons/update-fresh-20260315-1430');
    provider.seedListFiles('test-org', 'design-icons', 'main', [
      'icons/old/icon.json',
      'icons/old/preview.svg',
    ]);
    provider.seedFile('test-org', 'design-icons', 'icons/update-fresh-20260315-1430', 'icons/old/icon.json', 'x');
    provider.seedFile('test-org', 'design-icons', 'icons/update-fresh-20260315-1430', 'icons/old/preview.svg', 'x');

    const previousFiles = [
      { path: 'icons/old/icon.json', contents: '{"id":"old"}' },
      { path: 'icons/old/preview.svg', contents: '<svg/>' },
      { path: 'manifest.json', contents: '{}' },
    ];
    const currentFiles = [
      { path: 'icons/fresh/icon.json', contents: '{"id":"fresh"}' },
      { path: 'icons/fresh/preview.svg', contents: '<svg/>' },
      { path: 'manifest.json', contents: '{"new":true}' },
    ];

    const request = makeRequest({
      files: currentFiles,
      previousFiles,
    });
    const result = expectSuccess(await syncPr(request, { provider, now: FIXED_DATE }));

    // fresh should be added
    expect(result.changedFiles.added.some((p) => p.includes('fresh'))).toBe(true);
    // old should be deleted
    expect(result.changedFiles.deleted.some((p) => p.includes('old'))).toBe(true);

    // iconChanges
    expect(result.iconChanges.some((c) => c.iconDir === 'fresh' && c.kind === 'added')).toBe(true);
    expect(result.iconChanges.some((c) => c.iconDir === 'old' && c.kind === 'removed')).toBe(true);
  });
});

// ===========================================================================
// Conflict handling in syncPr (Phase 3)
// ===========================================================================

describe('syncPr conflict handling', () => {
  let provider: MockGitProvider;

  beforeEach(() => {
    provider = new MockGitProvider();
    provider.seedMissingBranch('icons/update-chevron-20260315-1430');
  });

  test('returns conflict when baseSha drifted', async () => {
    // Remote is at sha-new, but request says sha-old
    provider.seedBranchSha('test-org', 'design-icons', 'main', 'sha-new');

    const previousFiles = [
      { path: 'icons/chevron/icon.json', contents: '{"v":1}' },
      { path: 'manifest.json', contents: '{}' },
    ];
    const currentFiles = [
      { path: 'icons/chevron/icon.json', contents: '{"v":2}' },
      { path: 'manifest.json', contents: '{}' },
    ];

    const request = makeRequest({
      files: currentFiles,
      previousFiles,
      baseSha: 'sha-old',
    });
    const result = await syncPr(request, { provider, now: FIXED_DATE });

    expect(result.kind).toBe('conflict');
    if (result.kind === 'conflict') {
      expect(result.hasConflicts).toBe(true);
      expect(result.remoteHeadSha).toBe('sha-new');
      expect(result.localBaseSha).toBe('sha-old');
      expect(result.conflicts.some((c) => c.kind === 'base-sha-drift')).toBe(true);
      // iconChanges still reported so UI can show what would change
      expect(result.iconChanges.length).toBeGreaterThanOrEqual(1);
    }

    // No branch should have been created
    expect(provider.calls.filter((c) => c.method === 'createBranch')).toHaveLength(0);
  });

  test('force=true bypasses conflict checks', async () => {
    provider.seedBranchSha('test-org', 'design-icons', 'main', 'sha-new');

    const previousFiles = [
      { path: 'icons/chevron/icon.json', contents: '{"v":1}' },
      { path: 'manifest.json', contents: '{}' },
    ];
    const currentFiles = [
      { path: 'icons/chevron/icon.json', contents: '{"v":2}' },
      { path: 'manifest.json', contents: '{}' },
    ];

    const request = makeRequest({
      files: currentFiles,
      previousFiles,
      baseSha: 'sha-old',
      force: true,
    });
    const result = await syncPr(request, { provider, now: FIXED_DATE });

    expect(result.kind).toBe('success');
  });

  test('conflict on icon deleted remotely', async () => {
    provider.seedBranchSha('test-org', 'design-icons', 'main', 'sha-new');
    // Remote does NOT have chevron anymore
    provider.seedListFiles('test-org', 'design-icons', 'main', []);

    const previousFiles = [
      { path: 'icons/chevron/icon.json', contents: '{"v":1}' },
      { path: 'icons/chevron/preview.svg', contents: '<svg/>' },
      { path: 'manifest.json', contents: '{}' },
    ];
    const currentFiles = [
      { path: 'icons/chevron/icon.json', contents: '{"v":2}' },
      { path: 'icons/chevron/preview.svg', contents: '<svg/>' },
      { path: 'manifest.json', contents: '{}' },
    ];

    const request = makeRequest({
      files: currentFiles,
      previousFiles,
      baseSha: 'sha-old',
    });
    const result = await syncPr(request, { provider, now: FIXED_DATE });

    expect(result.kind).toBe('conflict');
    if (result.kind === 'conflict') {
      const deleted = result.conflicts.find((c) => c.kind === 'icon-deleted-remotely');
      expect(deleted).toBeDefined();
      expect(deleted!.iconDirs).toContain('chevron');
    }
  });

  test('skips conflict checks when no baseSha and no previousFiles', async () => {
    // Even though remote SHA differs from some hypothetical, no baseSha provided
    provider.seedBranchSha('test-org', 'design-icons', 'main', 'sha-whatever');

    const request = makeRequest({
      // No previousFiles, no baseSha — first sync
    });
    const result = await syncPr(request, { provider, now: FIXED_DATE });

    // Should succeed since no conflict checks are triggered
    expect(result.kind).toBe('success');
  });
});

// ===========================================================================
// Branch naming collision recovery in syncPr
// ===========================================================================

describe('syncPr branch collision recovery', () => {
  test('appends suffix when preferred branch exists', async () => {
    const provider = new MockGitProvider();
    // Default branch name exists; -2 doesn't
    provider.seedMissingBranch('icons/update-chevron-20260315-1430-2');

    const request = makeRequest();
    const result = expectSuccess(await syncPr(request, { provider, now: FIXED_DATE }));

    expect(result.branch).toBe('icons/update-chevron-20260315-1430-2');
  });
});

// ===========================================================================
// Revision tracking
// ===========================================================================

describe('syncPr revision tracking', () => {
  test('response includes baseBranchHeadSha and lastSyncedCommitSha', async () => {
    const provider = new MockGitProvider();
    provider.seedMissingBranch('icons/update-chevron-20260315-1430');
    provider.seedBranchSha('test-org', 'design-icons', 'main', 'sha-base-123');

    const request = makeRequest();
    const result = expectSuccess(await syncPr(request, { provider, now: FIXED_DATE }));

    expect(result.revision.baseBranchHeadSha).toBe('sha-base-123');
    expect(result.revision.lastSyncedCommitSha).toMatch(/^sha-/);
    // lastSyncedCommitSha should be the commitSha
    expect(result.revision.lastSyncedCommitSha).toBe(result.commitSha);
  });
});

// ===========================================================================
// Error propagation through orchestrator
// ===========================================================================

describe('syncPr error propagation', () => {
  test('propagates branch creation failure', async () => {
    const failProvider: GitProvider = {
      getBranchRef: async (_o, _r, branch) => {
        if (branch !== 'main') throw new Error('404 not found');
        return { sha: 'abc', ref: 'refs/heads/main' };
      },
      createBranch: async () => {
        throw new BranchCreationError('Branch already exists');
      },
      getFileSha: async () => null,
      createOrUpdateFile: async () => ({ path: '', sha: '', commitSha: '' }),
      deleteFile: async () => {},
      createPullRequest: async () => ({
        number: 1,
        url: '',
        title: '',
        headBranch: '',
        baseBranch: '',
      }),
      listFiles: async () => new Set(),
    };

    const request = makeRequest();
    await expect(syncPr(request, { provider: failProvider, now: FIXED_DATE })).rejects.toThrow(
      BranchCreationError,
    );
  });

  test('propagates file write failure as error result', async () => {
    const failProvider: GitProvider = {
      getBranchRef: async (_o, _r, branch) => {
        if (branch !== 'main') throw new Error('404 not found');
        return { sha: 'abc', ref: 'refs/heads/main' };
      },
      createBranch: async () => ({ sha: 'abc', ref: 'refs/heads/feature' }),
      getFileSha: async () => null,
      createOrUpdateFile: async () => {
        throw new FileWriteError('Quota exceeded');
      },
      deleteFile: async () => {},
      createPullRequest: async () => ({
        number: 1,
        url: '',
        title: '',
        headBranch: '',
        baseBranch: '',
      }),
      listFiles: async () => new Set(),
    };

    const request = makeRequest();
    const result = await syncPr(request, { provider: failProvider, now: FIXED_DATE });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.error).toBe('FILE_WRITE_FAILURE');
      expect(result.message).toContain('Quota exceeded');
      expect(result.orphanBranch).toBeDefined();
    }
  });

  test('propagates PR creation failure as error result', async () => {
    const failProvider: GitProvider = {
      getBranchRef: async (_o, _r, branch) => {
        if (branch !== 'main') throw new Error('404 not found');
        return { sha: 'abc', ref: 'refs/heads/main' };
      },
      createBranch: async () => ({ sha: 'abc', ref: 'refs/heads/feature' }),
      getFileSha: async () => null,
      createOrUpdateFile: async () => ({ path: 'p', sha: 's', commitSha: 'c' }),
      deleteFile: async () => {},
      createPullRequest: async () => {
        throw new PrCreationError('PR limit reached');
      },
      listFiles: async () => new Set(),
    };

    const request = makeRequest();
    const result = await syncPr(request, { provider: failProvider, now: FIXED_DATE });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.error).toBe('PR_CREATION_FAILURE');
      expect(result.message).toContain('PR limit reached');
      expect(result.orphanBranch).toBeDefined();
    }
  });
});
