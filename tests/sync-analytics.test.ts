/**
 * Tests for the sync analytics instrumentation.
 *
 * Covers:
 * - SyncAnalytics creation, context, and reset
 * - All 10 event types emitted at the right phases
 * - Structured metadata (repo, branch, counts, durations)
 * - No secrets in event payloads
 * - Listener registration and unsubscription
 * - Listener errors don't break the sync
 * - Timeline and summary diagnostics
 * - formatSyncTimeline output
 * - No-op analytics instance
 * - Integration with syncPr orchestrator
 */

import { describe, expect, test, beforeEach } from 'bun:test';

import {
  createSyncAnalytics,
  createNoOpAnalytics,
  formatSyncTimeline,
} from '../lib/sync-service/analytics';
import type {
  SyncAnalytics,
  SyncEvent,
  SyncEventName,
  SyncStartedEvent,
  DiffCompletedEvent,
  BranchCreatedEvent,
  CommitCreatedEvent,
  PrCreatedEvent,
  SyncCompletedEvent,
  SyncFailedEvent,
  ConflictDetectedEvent,
  ValidationFailedEvent,
} from '../lib/sync-service/analytics';
import { syncPr } from '../lib/sync-service/sync-pr';
import type { SyncPrRequest } from '../lib/sync-service/contracts';
import type {
  GitProvider,
  GitRef,
  FileCommitResult,
  PullRequestResult,
} from '../lib/sync-service/git-provider';

// ---------------------------------------------------------------------------
// Minimal mock provider for integration tests
// ---------------------------------------------------------------------------

class MinimalMockProvider implements GitProvider {
  private branchShas = new Map<string, string>();
  private known = new Set<string>();
  private shaCounter = 0;

  constructor() {
    this.seedBranch('main', 'base-sha-000');
  }

  seedBranch(branch: string, sha: string) {
    this.branchShas.set(branch, sha);
    this.known.add(branch);
  }

  async getBranchRef(_o: string, _r: string, branch: string): Promise<GitRef> {
    if (!this.known.has(branch)) throw new Error(`Branch ${branch} not found (404)`);
    return { sha: this.branchShas.get(branch) ?? 'base-sha-000', ref: `refs/heads/${branch}` };
  }
  async createBranch(_o: string, _r: string, baseSha: string, newBranch: string): Promise<GitRef> {
    this.known.add(newBranch);
    this.branchShas.set(newBranch, baseSha);
    return { sha: baseSha, ref: `refs/heads/${newBranch}` };
  }
  async getFileSha(): Promise<string | null> { return null; }
  async createOrUpdateFile(_o: string, _r: string, _b: string, path: string): Promise<FileCommitResult> {
    const sha = `sha-${++this.shaCounter}`;
    return { path, sha, commitSha: `commit-${this.shaCounter}` };
  }
  async deleteFile(): Promise<void> {}
  async createPullRequest(_o: string, _r: string, head: string, base: string, title: string): Promise<PullRequestResult> {
    return { number: 42, url: 'https://github.com/org/repo/pull/42', title, headBranch: head, baseBranch: base };
  }
  async listFiles(): Promise<Set<string>> { return new Set(); }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const FIXED_DATE = new Date('2026-03-15T14:30:00Z');
const FIXED_NOW = () => '2026-03-15T14:30:00.000Z';

function baseRequest(overrides?: Partial<SyncPrRequest>): SyncPrRequest {
  return {
    owner: 'test-org',
    repo: 'icons-repo',
    baseBranch: 'main',
    actor: { name: 'Tester' },
    files: [
      { path: 'icons/chevron/icon.json', contents: '{"name":"chevron"}' },
      { path: 'icons/chevron/preview.svg', contents: '<svg/>' },
      { path: 'manifest.json', contents: '{}' },
    ],
    ...overrides,
  };
}

function eventNames(events: SyncEvent[]): SyncEventName[] {
  return events.map((e) => e.name);
}

// ===========================================================================
// Unit tests for SyncAnalytics
// ===========================================================================

describe('createSyncAnalytics', () => {
  let analytics: SyncAnalytics;

  beforeEach(() => {
    analytics = createSyncAnalytics({ now: FIXED_NOW });
  });

  test('emits events with sequential seq numbers', () => {
    analytics.setContext({ repo: 'org/repo', baseBranch: 'main' });
    analytics.markStart();
    analytics.emit({ name: 'sync_started', fileCount: 3, force: false });
    analytics.emit({ name: 'diff_completed', changedIconCount: 1, filesToWrite: 2, filesToDelete: 0, isNoOp: false, durationMs: 5 });

    const timeline = analytics.getTimeline();
    expect(timeline).toHaveLength(2);
    expect(timeline[0]!.seq).toBe(0);
    expect(timeline[1]!.seq).toBe(1);
  });

  test('stamps repo and baseBranch from context', () => {
    analytics.setContext({ repo: 'acme/icons', baseBranch: 'develop' });
    analytics.markStart();
    analytics.emit({ name: 'sync_started', fileCount: 1, force: false });

    const evt = analytics.getTimeline()[0]!;
    expect(evt.repo).toBe('acme/icons');
    expect(evt.baseBranch).toBe('develop');
  });

  test('stamps retryCount from context', () => {
    analytics.setContext({ repo: 'a/b', baseBranch: 'main', retryCount: 2 });
    analytics.markStart();
    analytics.emit({ name: 'sync_started', fileCount: 1, force: true });

    expect(analytics.getTimeline()[0]!.retryCount).toBe(2);
  });

  test('stamps timestamp from now()', () => {
    analytics.setContext({ repo: 'a/b', baseBranch: 'main' });
    analytics.markStart();
    analytics.emit({ name: 'sync_started', fileCount: 1, force: false });

    expect(analytics.getTimeline()[0]!.timestamp).toBe('2026-03-15T14:30:00.000Z');
  });

  test('reset clears timeline and seq', () => {
    analytics.setContext({ repo: 'a/b', baseBranch: 'main' });
    analytics.markStart();
    analytics.emit({ name: 'sync_started', fileCount: 1, force: false });
    expect(analytics.getTimeline()).toHaveLength(1);

    analytics.reset();
    expect(analytics.getTimeline()).toHaveLength(0);

    analytics.markStart();
    analytics.emit({ name: 'sync_started', fileCount: 1, force: false });
    expect(analytics.getTimeline()[0]!.seq).toBe(0);
  });
});

// ===========================================================================
// Listener tests
// ===========================================================================

describe('Listeners', () => {
  test('registered listeners receive events', () => {
    const received: SyncEvent[] = [];
    const analytics = createSyncAnalytics({
      now: FIXED_NOW,
      listeners: [(evt) => received.push(evt)],
    });

    analytics.setContext({ repo: 'a/b', baseBranch: 'main' });
    analytics.markStart();
    analytics.emit({ name: 'sync_started', fileCount: 1, force: false });

    expect(received).toHaveLength(1);
    expect(received[0]!.name).toBe('sync_started');
  });

  test('addListener and unsubscribe work', () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });
    const received: SyncEvent[] = [];

    const unsub = analytics.addListener((evt) => received.push(evt));

    analytics.setContext({ repo: 'a/b', baseBranch: 'main' });
    analytics.markStart();
    analytics.emit({ name: 'sync_started', fileCount: 1, force: false });
    expect(received).toHaveLength(1);

    unsub();
    analytics.emit({ name: 'sync_completed', branch: 'b', prNumber: 1, prUrl: '', changedFileCount: 0, changedIconCount: 0, durationMs: 0 });
    expect(received).toHaveLength(1); // no more events
  });

  test('listener errors do not break emit', () => {
    const received: SyncEvent[] = [];
    const analytics = createSyncAnalytics({
      now: FIXED_NOW,
      listeners: [
        () => { throw new Error('listener crash'); },
        (evt) => received.push(evt),
      ],
    });

    analytics.setContext({ repo: 'a/b', baseBranch: 'main' });
    analytics.markStart();
    analytics.emit({ name: 'sync_started', fileCount: 1, force: false });

    // Second listener still received the event
    expect(received).toHaveLength(1);
  });
});

// ===========================================================================
// Summary diagnostics
// ===========================================================================

describe('getSummary', () => {
  test('reports success outcome', () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });
    analytics.setContext({ repo: 'org/icons', baseBranch: 'main' });
    analytics.markStart();
    analytics.emit({ name: 'sync_started', fileCount: 3, force: false });
    analytics.emit({ name: 'sync_completed', branch: 'b', prNumber: 42, prUrl: '', changedFileCount: 3, changedIconCount: 1, durationMs: 100 });

    const summary = analytics.getSummary();
    expect(summary.outcome).toBe('success');
    expect(summary.eventCount).toBe(2);
    expect(summary.repo).toBe('org/icons');
  });

  test('reports conflict outcome', () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });
    analytics.setContext({ repo: 'a/b', baseBranch: 'main' });
    analytics.markStart();
    analytics.emit({ name: 'sync_started', fileCount: 3, force: false });
    analytics.emit({ name: 'sync_conflict_detected', conflictKinds: ['base-sha-drift'], conflictCodes: ['STALE_BASE_REVISION'], conflictCount: 1, remoteHeadSha: 'sha-x' });

    expect(analytics.getSummary().outcome).toBe('conflict');
  });

  test('reports error outcome with messages', () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });
    analytics.setContext({ repo: 'a/b', baseBranch: 'main' });
    analytics.markStart();
    analytics.emit({ name: 'sync_started', fileCount: 3, force: false });
    analytics.emit({ name: 'sync_failed', errorCode: 'PR_CREATION_FAILURE', errorMessage: 'PR limit', failedPhase: 'create_pr', durationMs: 50 });

    const summary = analytics.getSummary();
    expect(summary.outcome).toBe('error');
    expect(summary.errors).toContain('PR limit');
  });

  test('reports no-op outcome', () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });
    analytics.setContext({ repo: 'a/b', baseBranch: 'main' });
    analytics.markStart();
    analytics.emit({ name: 'sync_started', fileCount: 3, force: false });
    analytics.emit({ name: 'diff_completed', changedIconCount: 0, filesToWrite: 0, filesToDelete: 0, isNoOp: true, durationMs: 1 });

    expect(analytics.getSummary().outcome).toBe('no-op');
  });

  test('reports incomplete when no terminal event', () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });
    analytics.setContext({ repo: 'a/b', baseBranch: 'main' });
    analytics.markStart();
    analytics.emit({ name: 'sync_started', fileCount: 3, force: false });

    expect(analytics.getSummary().outcome).toBe('incomplete');
  });
});

// ===========================================================================
// formatSyncTimeline
// ===========================================================================

describe('formatSyncTimeline', () => {
  test('returns placeholder for empty timeline', () => {
    expect(formatSyncTimeline([])).toBe('(no events recorded)');
  });

  test('renders events with tree-style prefixes', () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });
    analytics.setContext({ repo: 'a/b', baseBranch: 'main' });
    analytics.markStart();
    analytics.emit({ name: 'sync_started', fileCount: 3, force: false });
    analytics.emit({ name: 'diff_completed', changedIconCount: 2, filesToWrite: 3, filesToDelete: 0, isNoOp: false, durationMs: 5 });
    analytics.emit({ name: 'sync_completed', branch: 'b', prNumber: 42, prUrl: '', changedFileCount: 3, changedIconCount: 2, durationMs: 100 });

    const output = formatSyncTimeline(analytics.getTimeline());
    expect(output).toContain('┌');
    expect(output).toContain('│');
    expect(output).toContain('└');
    expect(output).toContain('sync_started');
    expect(output).toContain('diff_completed');
    expect(output).toContain('sync_completed');
  });
});

// ===========================================================================
// No-op analytics
// ===========================================================================

describe('createNoOpAnalytics', () => {
  test('all methods are callable without error', () => {
    const noop = createNoOpAnalytics();
    noop.setContext({ repo: 'a/b', baseBranch: 'main' });
    noop.markStart();
    noop.emit({ name: 'sync_started', fileCount: 1, force: false });
    expect(noop.getTimeline()).toHaveLength(0);
    expect(noop.getSummary().outcome).toBe('incomplete');
    noop.reset();
  });

  test('addListener returns callable unsubscribe', () => {
    const noop = createNoOpAnalytics();
    const unsub = noop.addListener(() => {});
    expect(typeof unsub).toBe('function');
    unsub(); // should not throw
  });
});

// ===========================================================================
// Integration: syncPr emits analytics events
// ===========================================================================

describe('syncPr analytics integration', () => {
  let provider: MinimalMockProvider;

  beforeEach(() => {
    provider = new MinimalMockProvider();
  });

  test('successful sync emits full event sequence', async () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });

    await syncPr(baseRequest(), { provider, now: FIXED_DATE, analytics });

    const names = eventNames(analytics.getTimeline());
    expect(names).toContain('sync_started');
    expect(names).toContain('diff_completed');
    expect(names).toContain('sync_branch_created');
    expect(names).toContain('sync_commit_created');
    expect(names).toContain('sync_pr_created');
    expect(names).toContain('sync_completed');
  });

  test('sync_started has correct metadata', async () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });

    await syncPr(baseRequest(), { provider, now: FIXED_DATE, analytics });

    const started = analytics.getTimeline().find((e) => e.name === 'sync_started') as SyncStartedEvent;
    expect(started).toBeDefined();
    expect(started.fileCount).toBe(3);
    expect(started.force).toBe(false);
    expect(started.repo).toBe('test-org/icons-repo');
    expect(started.baseBranch).toBe('main');
  });

  test('diff_completed has icon and file counts', async () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });

    await syncPr(baseRequest(), { provider, now: FIXED_DATE, analytics });

    const diff = analytics.getTimeline().find((e) => e.name === 'diff_completed') as DiffCompletedEvent;
    expect(diff).toBeDefined();
    expect(diff.filesToWrite).toBeGreaterThan(0);
    expect(diff.isNoOp).toBe(false);
  });

  test('sync_branch_created has branch name', async () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });

    await syncPr(baseRequest(), { provider, now: FIXED_DATE, analytics });

    const branch = analytics.getTimeline().find((e) => e.name === 'sync_branch_created') as BranchCreatedEvent;
    expect(branch).toBeDefined();
    expect(branch.branch).toContain('icons/');
    expect(branch.baseSha).toBe('base-sha-000');
  });

  test('sync_commit_created has file counts', async () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });

    await syncPr(baseRequest(), { provider, now: FIXED_DATE, analytics });

    const commit = analytics.getTimeline().find((e) => e.name === 'sync_commit_created') as CommitCreatedEvent;
    expect(commit).toBeDefined();
    expect(commit.filesWritten).toBeGreaterThan(0);
  });

  test('sync_pr_created has PR number and counts', async () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });

    await syncPr(baseRequest(), { provider, now: FIXED_DATE, analytics });

    const prEvt = analytics.getTimeline().find((e) => e.name === 'sync_pr_created') as PrCreatedEvent;
    expect(prEvt).toBeDefined();
    expect(prEvt.prNumber).toBe(42);
    expect(prEvt.changedFileCount).toBeGreaterThan(0);
  });

  test('sync_completed has total file and icon counts', async () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });

    await syncPr(baseRequest(), { provider, now: FIXED_DATE, analytics });

    const completed = analytics.getTimeline().find((e) => e.name === 'sync_completed') as SyncCompletedEvent;
    expect(completed).toBeDefined();
    expect(completed.prNumber).toBe(42);
    expect(completed.changedFileCount).toBeGreaterThan(0);
  });

  test('no-op sync emits sync_started and diff_completed only', async () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });
    const files = [
      { path: 'icons/chevron/icon.json', contents: '{}' },
      { path: 'manifest.json', contents: '{}' },
    ];

    await syncPr(
      baseRequest({ files, previousFiles: files }),
      { provider, now: FIXED_DATE, analytics },
    );

    const names = eventNames(analytics.getTimeline());
    expect(names).toContain('sync_started');
    expect(names).toContain('diff_completed');
    expect(names).not.toContain('sync_branch_created');
    expect(names).not.toContain('sync_completed');
  });

  test('conflict emits sync_conflict_detected', async () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });
    provider.seedBranch('main', 'sha-new');

    await syncPr(
      baseRequest({ baseSha: 'sha-old' }),
      { provider, now: FIXED_DATE, analytics },
    );

    const conflict = analytics.getTimeline().find((e) => e.name === 'sync_conflict_detected') as ConflictDetectedEvent;
    expect(conflict).toBeDefined();
    expect(conflict.conflictCount).toBeGreaterThan(0);
    expect(conflict.conflictKinds).toContain('base-sha-drift');
  });

  test('validation failure emits sync_validation_failed', async () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });

    try {
      await syncPr(
        baseRequest({ files: [] }),
        { provider, now: FIXED_DATE, analytics },
      );
    } catch {
      // expected
    }

    const failed = analytics.getTimeline().find((e) => e.name === 'sync_validation_failed') as ValidationFailedEvent;
    expect(failed).toBeDefined();
    expect(failed.errors.length).toBeGreaterThan(0);
  });

  test('PR creation failure emits sync_failed with correct phase', async () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });
    // Note: can't use spread on class instances — prototype methods aren't copied.
    const failProvider = Object.create(provider) as GitProvider;
    failProvider.createPullRequest = async () => { throw new Error('PR limit (422)'); };

    const result = await syncPr(baseRequest(), {
      provider: failProvider,
      now: FIXED_DATE,
      analytics,
    });

    expect(result.kind).toBe('error');
    const failed = analytics.getTimeline().find((e) => e.name === 'sync_failed') as SyncFailedEvent;
    expect(failed).toBeDefined();
    expect(failed.failedPhase).toBe('create_pr');
    expect(failed.errorCode).toBe('PR_CREATION_FAILURE');
  });

  test('analytics never contains token or credential strings', async () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });

    await syncPr(baseRequest(), { provider, now: FIXED_DATE, analytics });

    const json = JSON.stringify(analytics.getTimeline());
    expect(json).not.toContain('token');
    expect(json).not.toContain('Bearer');
    expect(json).not.toContain('ghp_');
    expect(json).not.toContain('password');
  });

  test('getSummary reports success after full sync', async () => {
    const analytics = createSyncAnalytics({ now: FIXED_NOW });

    await syncPr(baseRequest(), { provider, now: FIXED_DATE, analytics });

    const summary = analytics.getSummary();
    expect(summary.outcome).toBe('success');
    expect(summary.repo).toBe('test-org/icons-repo');
    expect(summary.baseBranch).toBe('main');
    expect(summary.eventCount).toBeGreaterThanOrEqual(5);
  });

  test('syncPr works without analytics (defaults to no-op)', async () => {
    // No analytics option — should not throw
    const result = await syncPr(baseRequest(), { provider, now: FIXED_DATE });
    expect(result.kind).toBe('success');
  });
});
