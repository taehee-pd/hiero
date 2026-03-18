/**
 * Sync analytics — structured event instrumentation for the PR sync
 * pipeline.
 *
 * Design:
 * - Every event carries structured metadata (repo, branch, counts,
 *   durations, error categories) — never secrets or tokens.
 * - Pluggable sinks: callers register listeners that receive typed
 *   events. Wire to PostHog, Mixpanel, Datadog, or console.
 * - Debug mode: when enabled, each event is printed as a collapsed
 *   console group with full metadata for local dev diagnostics.
 * - Dev diagnostics: `SyncTimeline` records all events from a single
 *   sync run so callers can inspect the full phase-transition history.
 *
 * Usage:
 *   const analytics = createSyncAnalytics({ debug: true });
 *   const result = await syncPr(request, { provider, analytics });
 *   console.log(analytics.getTimeline());
 */

import type { SyncErrorCode } from './errors';
import type { ConflictKind, ConflictErrorCode } from './conflicts';

// ---------------------------------------------------------------------------
// Event names — the 10 required lifecycle events
// ---------------------------------------------------------------------------

export type SyncEventName =
  | 'sync_started'
  | 'export_completed'
  | 'diff_completed'
  | 'sync_validation_failed'
  | 'sync_branch_created'
  | 'sync_commit_created'
  | 'sync_pr_created'
  | 'sync_conflict_detected'
  | 'sync_failed'
  | 'sync_completed';

// ---------------------------------------------------------------------------
// Structured metadata — common fields + per-event extras
// ---------------------------------------------------------------------------

/** Fields present on every event. */
export type SyncEventBase = {
  /** Monotonic event index within the current sync run. */
  seq: number;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Milliseconds since sync_started (0 for the first event). */
  elapsedMs: number;
  /** Repository identifier (`owner/repo`). Never includes tokens. */
  repo: string;
  /** Target base branch. */
  baseBranch: string;
  /** Number of sync retries for this run (0 = first attempt). */
  retryCount: number;
};

export type SyncStartedEvent = SyncEventBase & {
  name: 'sync_started';
  /** Total files in the payload. */
  fileCount: number;
  /** Whether `force` mode is enabled. */
  force: boolean;
};

export type ExportCompletedEvent = SyncEventBase & {
  name: 'export_completed';
  /** Number of icon directories in the export. */
  iconCount: number;
  /** Number of files in the export payload. */
  fileCount: number;
  /** Milliseconds the export took. */
  durationMs: number;
};

export type DiffCompletedEvent = SyncEventBase & {
  name: 'diff_completed';
  /** Number of icons that changed (added + updated + removed). */
  changedIconCount: number;
  /** Files to write. */
  filesToWrite: number;
  /** Files to delete. */
  filesToDelete: number;
  /** True when diff found no changes. */
  isNoOp: boolean;
  durationMs: number;
};

export type ValidationFailedEvent = SyncEventBase & {
  name: 'sync_validation_failed';
  /** Validation error messages. */
  errors: string[];
};

export type BranchCreatedEvent = SyncEventBase & {
  name: 'sync_branch_created';
  branch: string;
  baseSha: string;
  durationMs: number;
};

export type CommitCreatedEvent = SyncEventBase & {
  name: 'sync_commit_created';
  branch: string;
  /** Number of files written so far. */
  filesWritten: number;
  /** Number of files deleted so far. */
  filesDeleted: number;
  /** Last commit SHA. */
  commitSha: string;
  durationMs: number;
};

export type PrCreatedEvent = SyncEventBase & {
  name: 'sync_pr_created';
  branch: string;
  prNumber: number;
  prUrl: string;
  /** Total changed file count. */
  changedFileCount: number;
  /** Total changed icon count. */
  changedIconCount: number;
  durationMs: number;
};

export type ConflictDetectedEvent = SyncEventBase & {
  name: 'sync_conflict_detected';
  /** Conflict kinds found. */
  conflictKinds: ConflictKind[];
  /** Machine-readable codes. */
  conflictCodes: ConflictErrorCode[];
  conflictCount: number;
  /** Remote HEAD SHA at detection time. */
  remoteHeadSha: string;
};

export type SyncFailedEvent = SyncEventBase & {
  name: 'sync_failed';
  /** Typed error code from the errors module. */
  errorCode: SyncErrorCode | string;
  /** Human-readable error message. Never contains tokens. */
  errorMessage: string;
  /** HTTP status code if applicable. */
  statusCode?: number;
  /** Phase in which the failure occurred. */
  failedPhase: string;
  /** Duration from sync_started to failure. */
  durationMs: number;
  /** Branch that was created but may be orphaned. */
  orphanBranch?: string;
};

export type SyncCompletedEvent = SyncEventBase & {
  name: 'sync_completed';
  branch: string;
  prNumber: number;
  prUrl: string;
  /** Total files changed (added + updated + deleted). */
  changedFileCount: number;
  changedIconCount: number;
  /** End-to-end duration in milliseconds. */
  durationMs: number;
};

export type SyncEvent =
  | SyncStartedEvent
  | ExportCompletedEvent
  | DiffCompletedEvent
  | ValidationFailedEvent
  | BranchCreatedEvent
  | CommitCreatedEvent
  | PrCreatedEvent
  | ConflictDetectedEvent
  | SyncFailedEvent
  | SyncCompletedEvent;

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

export type SyncEventListener = (event: SyncEvent) => void;

// ---------------------------------------------------------------------------
// SyncAnalytics — the instrumentation interface
// ---------------------------------------------------------------------------

export type SyncAnalyticsOptions = {
  /**
   * Enable debug mode: events are printed to console with collapsed
   * groups showing full metadata. Default: false.
   */
  debug?: boolean;
  /**
   * External listeners to register at creation time.
   * Additional listeners can be added later via `addListener()`.
   */
  listeners?: SyncEventListener[];
  /**
   * Custom clock for deterministic tests. Returns ISO timestamp.
   */
  now?: () => string;
};

/** Helper: distribute Omit over a discriminated union. */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/** The shape callers pass to `emit()` — event-specific fields only, base fields are auto-filled. */
export type SyncEventInput = DistributiveOmit<SyncEvent, 'seq' | 'timestamp' | 'elapsedMs' | 'repo' | 'baseBranch' | 'retryCount'>;

export interface SyncAnalytics {
  /** Emit a sync event. Called by the orchestrator at each phase. */
  emit(event: SyncEventInput): void;

  /** Configure the repo/branch context for this run. */
  setContext(ctx: { repo: string; baseBranch: string; retryCount?: number }): void;

  /** Mark the start time (called automatically on sync_started). */
  markStart(): void;

  /** Add an event listener. Returns an unsubscribe function. */
  addListener(fn: SyncEventListener): () => void;

  /** Get the full event timeline for this run (dev diagnostics). */
  getTimeline(): SyncEvent[];

  /** Get a human-readable summary of the run. */
  getSummary(): SyncRunSummary;

  /** Reset state for a new run. */
  reset(): void;
}

// ---------------------------------------------------------------------------
// Run summary (dev diagnostics)
// ---------------------------------------------------------------------------

export type SyncRunSummary = {
  /** Total events emitted. */
  eventCount: number;
  /** Final outcome: success, conflict, no-op, error, or incomplete. */
  outcome: 'success' | 'conflict' | 'no-op' | 'error' | 'incomplete';
  /** End-to-end duration, or time since start if still running. */
  totalDurationMs: number;
  /** Phase durations (rough, derived from event timestamps). */
  phases: Array<{ name: string; durationMs: number }>;
  /** Errors encountered. */
  errors: string[];
  /** Repo context. */
  repo: string;
  baseBranch: string;
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createSyncAnalytics(opts: SyncAnalyticsOptions = {}): SyncAnalytics {
  const {
    debug = false,
    listeners: initialListeners = [],
    now = () => new Date().toISOString(),
  } = opts;

  const listeners = new Set<SyncEventListener>(initialListeners);
  const timeline: SyncEvent[] = [];
  let seq = 0;
  let startTime: number | null = null;
  let context = { repo: '', baseBranch: 'main', retryCount: 0 };

  function elapsed(): number {
    if (startTime === null) return 0;
    return Math.round(performance.now() - startTime);
  }

  function emit(partial: SyncEventInput): void {
    const event = {
      ...partial,
      seq: seq++,
      timestamp: now(),
      elapsedMs: elapsed(),
      repo: context.repo,
      baseBranch: context.baseBranch,
      retryCount: context.retryCount,
    } as SyncEvent;

    timeline.push(event);

    // Notify listeners — never let a listener error break the sync
    for (const fn of listeners) {
      try {
        fn(event);
      } catch {
        // Swallow listener errors
      }
    }

    // Debug mode: console group with metadata
    if (debug && typeof console !== 'undefined') {
      printDebugEvent(event);
    }
  }

  function setContext(ctx: { repo: string; baseBranch: string; retryCount?: number }): void {
    context = {
      repo: ctx.repo,
      baseBranch: ctx.baseBranch,
      retryCount: ctx.retryCount ?? 0,
    };
  }

  function markStart(): void {
    startTime = performance.now();
  }

  function addListener(fn: SyncEventListener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }

  function getTimeline(): SyncEvent[] {
    return [...timeline];
  }

  function getSummary(): SyncRunSummary {
    const errors: string[] = [];
    let outcome: SyncRunSummary['outcome'] = 'incomplete';
    const phases: Array<{ name: string; durationMs: number }> = [];

    for (const evt of timeline) {
      if (evt.name === 'sync_completed') outcome = 'success';
      if (evt.name === 'sync_conflict_detected') outcome = 'conflict';
      if (evt.name === 'sync_failed') {
        outcome = 'error';
        errors.push((evt as SyncFailedEvent).errorMessage);
      }
      if (evt.name === 'sync_validation_failed') {
        outcome = 'error';
        errors.push(...(evt as ValidationFailedEvent).errors);
      }

      // Extract phases with durations
      if ('durationMs' in evt && typeof evt.durationMs === 'number') {
        phases.push({ name: evt.name, durationMs: evt.durationMs });
      }
    }

    // Check for no-op by inspecting diff_completed
    const diffEvt = timeline.find((e) => e.name === 'diff_completed') as DiffCompletedEvent | undefined;
    if (diffEvt?.isNoOp && outcome === 'incomplete') {
      outcome = 'no-op';
    }

    return {
      eventCount: timeline.length,
      outcome,
      totalDurationMs: elapsed(),
      phases,
      errors,
      repo: context.repo,
      baseBranch: context.baseBranch,
    };
  }

  function reset(): void {
    seq = 0;
    startTime = null;
    timeline.length = 0;
  }

  return { emit, setContext, markStart, addListener, getTimeline, getSummary, reset };
}

// ---------------------------------------------------------------------------
// No-op analytics (for callers that don't want instrumentation)
// ---------------------------------------------------------------------------

export function createNoOpAnalytics(): SyncAnalytics {
  return {
    emit() {},
    setContext() {},
    markStart() {},
    addListener() { return () => {}; },
    getTimeline() { return []; },
    getSummary() {
      return {
        eventCount: 0,
        outcome: 'incomplete',
        totalDurationMs: 0,
        phases: [],
        errors: [],
        repo: '',
        baseBranch: '',
      };
    },
    reset() {},
  };
}

// ---------------------------------------------------------------------------
// Debug console output
// ---------------------------------------------------------------------------

const PHASE_ICONS: Record<SyncEventName, string> = {
  sync_started: '🚀',
  export_completed: '📦',
  diff_completed: '🔍',
  sync_validation_failed: '⛔',
  sync_branch_created: '🌿',
  sync_commit_created: '💾',
  sync_pr_created: '📝',
  sync_conflict_detected: '⚠️',
  sync_failed: '❌',
  sync_completed: '✅',
};

function printDebugEvent(event: SyncEvent): void {
  const icon = PHASE_ICONS[event.name] ?? '•';
  const label = `${icon} [sync] ${event.name}  +${event.elapsedMs}ms`;

  // Extract display-safe metadata (exclude base fields)
  const { seq: _s, timestamp: _t, elapsedMs: _e, repo: _r, baseBranch: _b, retryCount: _rc, name: _n, ...meta } = event;

  if (typeof console.groupCollapsed === 'function') {
    console.groupCollapsed(label);
    if (Object.keys(meta).length > 0) {
      console.table(meta);
    }
    console.log(`repo: ${event.repo}  branch: ${event.baseBranch}  retry: ${event.retryCount}`);
    console.groupEnd();
  } else {
    console.log(label, meta);
  }
}

// ---------------------------------------------------------------------------
// Dev diagnostics — formatted timeline printer
// ---------------------------------------------------------------------------

/**
 * Formats a SyncAnalytics timeline into a human-readable string for
 * dev console or diagnostics panel. Call after a sync completes.
 *
 * Example output:
 *   ┌ sync_started           +0ms     repo: org/icons  branch: main
 *   │ export_completed       +12ms    3 icons, 9 files
 *   │ diff_completed         +15ms    2 changed, 0 deleted
 *   │ sync_branch_created    +120ms   icons/update-2-icons-20260315
 *   │ sync_commit_created    +340ms   3 written, 1 deleted
 *   │ sync_pr_created        +450ms   PR #42
 *   └ sync_completed         +455ms   total: 455ms
 */
export function formatSyncTimeline(events: SyncEvent[]): string {
  if (events.length === 0) return '(no events recorded)';

  const lines: string[] = [];
  const last = events.length - 1;

  for (let i = 0; i < events.length; i++) {
    const evt = events[i]!;
    const prefix = i === 0 ? '┌' : i === last ? '└' : '│';
    const icon = PHASE_ICONS[evt.name] ?? '•';
    const elapsed = `+${evt.elapsedMs}ms`.padStart(8);
    const detail = formatEventDetail(evt);

    lines.push(`${prefix} ${icon} ${evt.name.padEnd(26)} ${elapsed}  ${detail}`);
  }

  return lines.join('\n');
}

function formatEventDetail(evt: SyncEvent): string {
  switch (evt.name) {
    case 'sync_started':
      return `${evt.fileCount} files, force=${evt.force}`;
    case 'export_completed':
      return `${evt.iconCount} icons, ${evt.fileCount} files`;
    case 'diff_completed':
      return evt.isNoOp
        ? 'no-op (no changes)'
        : `${evt.changedIconCount} icons changed, ${evt.filesToWrite} write, ${evt.filesToDelete} delete`;
    case 'sync_validation_failed':
      return evt.errors.join('; ').slice(0, 80);
    case 'sync_branch_created':
      return evt.branch;
    case 'sync_commit_created':
      return `${evt.filesWritten} written, ${evt.filesDeleted} deleted`;
    case 'sync_pr_created':
      return `PR #${evt.prNumber}`;
    case 'sync_conflict_detected':
      return `${evt.conflictCount} conflict(s): ${evt.conflictKinds.join(', ')}`;
    case 'sync_failed':
      return `${evt.errorCode}: ${evt.errorMessage.slice(0, 60)}`;
    case 'sync_completed':
      return `PR #${evt.prNumber}, ${evt.changedFileCount} files, ${evt.durationMs}ms total`;
    default:
      return '';
  }
}
