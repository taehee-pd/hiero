/**
 * VersionSnapshot — durable record of a Publish transaction.
 *
 * Created by `lib/sync-service/publish-transaction.ts` whenever at least
 * one release target succeeds. Persisted via the persistence adapter so
 * Version History (Phase 3) can browse, compare, and restore historical
 * versions.
 *
 * One snapshot per publish *attempt*. If the user kicks off a publish
 * that targets git-pr + npm-registry and only the PR succeeds, we still
 * record a snapshot with `targetResults: [{ kind: 'git-pr', status:
 * 'success', ... }, { kind: 'npm-registry', status: 'failed', ... }]`.
 * That makes "the PR went up but npm 401'd" visible in history. If
 * every target fails, no snapshot is written — the failure is surfaced
 * to the user via toast/dialog and they can retry.
 *
 * Schema rules:
 *   - `id` is opaque, monotonic-ish.
 *   - `version` is a semver string ("1.2.0"). The publish UI helps
 *     users pick patch/minor/major; we don't validate format here.
 *   - `sourceHash` is a deterministic content hash so Compare (Phase 3)
 *     can short-circuit "are these the same source?".
 *   - `changesSummary` is shaped to match the existing
 *     `lib/sync-service/diff-source.ts` IconChange union — precomputed
 *     at publish time so Version History doesn't have to re-diff.
 */

import type { Workspace } from '@/lib/schema/types';

export type ReleaseTargetKind =
  | 'local-directory'
  | 'git-pr'
  | 'npm-registry';

export type TargetResultStatus = 'success' | 'failed';

export type TargetResult = {
  kind: ReleaseTargetKind;
  status: TargetResultStatus;
  /**
   * Human-meaningful external reference for the target (PR URL, npm
   * package URL, local file path). Required on success; optional on
   * failure (we may not have one).
   */
  url?: string;
  /** ISO timestamp of when the target completed. */
  timestamp: string;
  /** Failure reason for status='failed'. Never set on success. */
  error?: string;
};

export type ChangesSummary = {
  added: string[];
  modified: string[];
  removed: string[];
};

export type VersionSnapshot = {
  id: string;
  /** Semver version string ("1.2.0"). Not validated at write time. */
  version: string;
  releaseNotes: string;
  /** ISO timestamp. */
  publishedAt: string;
  publishedBy: string;
  changesSummary: ChangesSummary;
  /**
   * Deterministic hash of the published source. Used by Compare to
   * short-circuit identical-source diffs and by Restore to detect
   * tampering.
   */
  sourceHash: string;
  /** Per-target outcome of the publish transaction. */
  targetResults: TargetResult[];
  /**
   * Workspace snapshot at publish time. Stored alongside the metadata
   * so Restore (Phase 3) can reconstitute the published state without
   * needing the original release artifacts.
   */
  workspaceSnapshot: Workspace;
};

/**
 * Lightweight metadata view of a snapshot — used by Version History
 * lists where loading the full workspace per row would be wasteful.
 */
export type VersionSnapshotMeta = Omit<VersionSnapshot, 'workspaceSnapshot'>;

export function toSnapshotMeta(
  snapshot: VersionSnapshot,
): VersionSnapshotMeta {
  const { workspaceSnapshot: _drop, ...meta } = snapshot;
  return meta;
}
