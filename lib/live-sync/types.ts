/**
 * Live-sync types — Lane 1 (live integration) boundary.
 *
 * These types define the contract between:
 *   - the dev server (running in the consumer repo)
 *   - the file watcher (watches sourceDir)
 *   - the incremental rebuild engine (source → compiled output)
 *   - the editor's publish action (source export → transport → dev server)
 */

import type { HostTarget } from '@/lib/install-config/types';

// ---------------------------------------------------------------------------
// Build results
// ---------------------------------------------------------------------------

export type LiveBuildSuccess = {
  kind: 'success';
  durationMs: number;
  /** Icons added, updated, or removed in this build. */
  changedIcons: number;
  totalIcons: number;
  writtenFiles: string[];
  /** Current source files snapshot — used as input to next incremental diff. */
  sourceFiles: Array<{ path: string; contents: string }>;
};

export type LiveBuildNoOp = {
  kind: 'no-op';
  durationMs: number;
  changedIcons: 0;
  /** Unchanged source snapshot passed through. */
  sourceFiles: Array<{ path: string; contents: string }>;
};

export type LiveBuildError = {
  kind: 'error';
  durationMs: number;
  error: string;
};

export type LiveBuildResult = LiveBuildSuccess | LiveBuildNoOp | LiveBuildError;

// ---------------------------------------------------------------------------
// Host-target write result
// ---------------------------------------------------------------------------

export type WriteHostOutputResult = {
  target: HostTarget;
  writtenFiles: string[];
  skipped: boolean;
  skipReason?: string;
};

// ---------------------------------------------------------------------------
// Dev server configuration
// ---------------------------------------------------------------------------

export type DevServerConfig = {
  /** Absolute path to the consumer repo root. */
  repoRoot: string;
  hiero: import('@/lib/install-config/types').HieroConfig;
  port: number;
  /**
   * Shared secret for local API authentication.
   * Used in Authorization: Bearer <secret> header.
   * Scoped to localhost only — never leaves the machine.
   */
  apiSecret?: string;
};

// ---------------------------------------------------------------------------
// Dev server in-memory state
// ---------------------------------------------------------------------------

export type DevServerState = {
  iconCount: number;
  lastBuildAt: string | null;
  lastBuildDurationMs: number | null;
  watching: boolean;
  /** Source file snapshot used for incremental diff on next change. */
  previousSourceFiles: Array<{ path: string; contents: string }> | null;
};

// ---------------------------------------------------------------------------
// HTTP API types (matches spec endpoints)
// ---------------------------------------------------------------------------

/** Body for POST /api/source/icons */
export type SourceIngestRequest = {
  files: Array<{ path: string; contents: string }>;
};

/** Response for GET /api/status */
export type DevServerStatus = {
  ok: boolean;
  repoRoot: string;
  sourceDir: string;
  iconCount: number;
  lastBuildAt: string | null;
  lastBuildDurationMs: number | null;
  watching: boolean;
  port: number;
  hostTargets: Array<{
    kind: string;
    runtimeMode: string;
    cacheDir?: string;
  }>;
  /** Release targets from hiero.config.ts — rendered by PublishDialog as target cards. */
  releaseTargets: Array<{
    kind: 'local-directory' | 'git-pr' | 'npm-registry';
    outputMode: 'snapshot';
    /** local-directory */
    outputDir?: string;
    /** git-pr */
    owner?: string;
    repo?: string;
    baseBranch?: string;
    packagePath?: string;
    /** npm-registry */
    packageName?: string;
    registry?: string;
    scope?: string;
  }>;
};

/** Entry in GET /api/icons response */
export type DevServerIconEntry = {
  id: string;
  name: string;
  dirName: string;
  variantCount: number;
  sizes: number[];
  hasTransitions: boolean;
  hasEffects: boolean;
};

// ---------------------------------------------------------------------------
// Publish transport (editor → consumer repo)
// ---------------------------------------------------------------------------

/**
 * Transport mode for pushing canonical source files from the editor to the
 * consumer repo.
 *
 * - 'api-push': POST to hiero dev server HTTP API (default; works from any
 *   editor context including web).
 * - 'direct-write': Write files directly to consumer repo via platform bridge
 *   (desktop editor, same machine, no dev server needed — future work).
 */
export type PublishTransportMode = 'api-push' | 'direct-write';

export type PublishRequest = {
  files: Array<{ path: string; contents: string }>;
  /**
   * Dev server base URL. Defaults to http://localhost:4400.
   * Used for api-push transport.
   */
  devServerUrl?: string;
  /** Shared secret for API auth (matches devServerConfig.apiSecret). */
  apiSecret?: string;
};

export type PublishResult =
  | { kind: 'success'; transport: PublishTransportMode; changedFiles: number }
  | { kind: 'error'; transport: PublishTransportMode; error: string };
