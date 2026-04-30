/**
 * Publish transaction orchestrator.
 *
 * Wraps the existing per-target transports (git-pr, npm-registry,
 * local-directory) into a single user-facing operation:
 *
 *   1. Build a per-target plan from the input.
 *   2. Execute each target via the provided transport callback.
 *   3. Collect TargetResults (success | failed) with urls + timestamps.
 *   4. If at least one target succeeded, write a VersionSnapshot via the
 *      persistence adapter and surface the snapshot to the caller.
 *   5. If every target failed, return outcome='all-failed' with no
 *      snapshot — the user retries from the dialog.
 *
 * The orchestrator is intentionally transport-agnostic: it does NOT
 * import `sync-pr.ts` or `npm-publish-client.ts` directly. Those wirings
 * happen at the call site (PublishDialog) so this module stays unit-
 * testable without provider mocks. This also satisfies the eng-review
 * "PublishTransaction can't be atomic across heterogeneous remotes" rule
 * — we don't pretend; partial-failure is a first-class outcome.
 */

import type { Workspace } from '@/lib/schema/types';
import type { PersistenceAdapter } from '@/lib/persistence/adapter';
import type {
  ChangesSummary,
  ReleaseTargetKind,
  TargetResult,
  VersionSnapshot,
} from './version-snapshot';

export type PublishTargetSpec = {
  kind: ReleaseTargetKind;
  /** Free-form payload passed to the executor for this target kind. */
  payload?: unknown;
};

export type PublishTransactionInput = {
  /** Semver version string the user picked. Not validated here. */
  version: string;
  releaseNotes: string;
  publishedBy: string;
  /** The workspace being published, snapshotted into the record. */
  workspace: Workspace;
  /** What changed since the prior published version (precomputed). */
  changesSummary: ChangesSummary;
  /** Targets to execute, in the order they should run. */
  targets: PublishTargetSpec[];
};

export type PublishOutcome =
  | { kind: 'success'; snapshot: VersionSnapshot }
  | {
      kind: 'partial-failure';
      snapshot: VersionSnapshot;
      failedTargets: TargetResult[];
    }
  | { kind: 'all-failed'; targetResults: TargetResult[] };

export type TargetExecutor = (
  spec: PublishTargetSpec,
) => Promise<{ status: 'success'; url?: string } | { status: 'failed'; error: string; url?: string }>;

export type PublishTransactionOptions = {
  /** Per-target executor; called once per target in input order. */
  execute: TargetExecutor;
  /** Persistence layer for the resulting VersionSnapshot. */
  persistence: PersistenceAdapter;
  /** Override the clock — useful for deterministic tests. */
  now?: () => Date;
  /** Override id generation — useful for deterministic tests. */
  generateId?: () => string;
};

/**
 * Deterministic, fast 32-bit hash of a workspace's JSON representation.
 *
 * FNV-1a — not cryptographic. We only need change detection ("are these
 * two snapshots identical?") and stable identity for caching diffs.
 * Returned as a zero-padded hex string.
 */
export function hashWorkspace(workspace: Workspace): string {
  const json = JSON.stringify(workspace);
  let hash = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    hash ^= json.charCodeAt(i);
    // FNV prime: 16777619. Use Math.imul to stay in 32-bit territory.
    hash = Math.imul(hash, 0x01000193);
  }
  // Convert to unsigned 32-bit and zero-pad to 8 hex chars.
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function defaultId(): string {
  return `vsnap_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function executePublishTransaction(
  input: PublishTransactionInput,
  options: PublishTransactionOptions,
): Promise<PublishOutcome> {
  const now = options.now ?? (() => new Date());
  const generateId = options.generateId ?? defaultId;

  const targetResults: TargetResult[] = [];
  for (const spec of input.targets) {
    const result = await options.execute(spec);
    targetResults.push({
      kind: spec.kind,
      status: result.status,
      url: result.url,
      timestamp: now().toISOString(),
      error: result.status === 'failed' ? result.error : undefined,
    });
  }

  const anySuccess = targetResults.some((r) => r.status === 'success');
  if (!anySuccess) {
    return { kind: 'all-failed', targetResults };
  }

  const snapshot: VersionSnapshot = {
    id: generateId(),
    version: input.version,
    releaseNotes: input.releaseNotes,
    publishedAt: now().toISOString(),
    publishedBy: input.publishedBy,
    changesSummary: input.changesSummary,
    sourceHash: hashWorkspace(input.workspace),
    targetResults,
    workspaceSnapshot: input.workspace,
  };

  await options.persistence.saveVersionSnapshot(snapshot);

  const failedTargets = targetResults.filter((r) => r.status === 'failed');
  if (failedTargets.length > 0) {
    return { kind: 'partial-failure', snapshot, failedTargets };
  }
  return { kind: 'success', snapshot };
}
