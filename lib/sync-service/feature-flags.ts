/**
 * Feature flags and staged rollout guards for the sync pipeline.
 *
 * Provides a simple, server-side feature flag system that controls
 * whether sync is enabled and at what capacity. Flags are read from
 * environment variables so they can be changed without a deploy via
 * platform config (Vercel, Railway, etc.).
 *
 * No external feature flag service is required — this is intentionally
 * minimal and self-contained.
 */

// ---------------------------------------------------------------------------
// Flag definitions
// ---------------------------------------------------------------------------

export type SyncFeatureFlags = {
  /** Master kill switch. When false, all sync API requests return 503. */
  syncEnabled: boolean;

  /**
   * Maximum number of files allowed in a single sync request.
   * Prevents runaway payloads from creating hundreds of commits.
   * 0 = unlimited.
   */
  maxFilesPerSync: number;

  /**
   * When true, sync runs in dry-run mode: validates and diffs but
   * does not create branches, commits, or PRs. Useful for staged
   * rollout where you want to verify payloads before going live.
   */
  dryRunOnly: boolean;

  /**
   * Comma-separated list of allowed repository slugs (owner/repo).
   * Empty string = all repos allowed.
   * Example: "myorg/icons,myorg/icons-staging"
   */
  allowedRepos: string[];

  /**
   * When true, the preflight permission check runs before every sync.
   * Adds one extra API call but catches misconfigured tokens early.
   */
  preflightCheckEnabled: boolean;
};

const DEFAULT_FLAGS: SyncFeatureFlags = {
  syncEnabled: true,
  dryRunOnly: false,
  maxFilesPerSync: 500,
  allowedRepos: [],
  preflightCheckEnabled: true,
};

// ---------------------------------------------------------------------------
// Read flags from environment
// ---------------------------------------------------------------------------

/**
 * Read sync feature flags from environment variables.
 *
 * Environment variable mapping:
 *   SYNC_ENABLED          = "true" | "false"   (default: true)
 *   SYNC_DRY_RUN_ONLY     = "true" | "false"   (default: false)
 *   SYNC_MAX_FILES         = number             (default: 500)
 *   SYNC_ALLOWED_REPOS     = "owner/repo,..."   (default: "" = all)
 *   SYNC_PREFLIGHT_CHECK   = "true" | "false"   (default: true)
 */
export function readSyncFlags(env: Record<string, string | undefined> = process.env): SyncFeatureFlags {
  return {
    syncEnabled: envBool(env, 'SYNC_ENABLED', DEFAULT_FLAGS.syncEnabled),
    dryRunOnly: envBool(env, 'SYNC_DRY_RUN_ONLY', DEFAULT_FLAGS.dryRunOnly),
    maxFilesPerSync: envInt(env, 'SYNC_MAX_FILES', DEFAULT_FLAGS.maxFilesPerSync),
    allowedRepos: envList(env, 'SYNC_ALLOWED_REPOS'),
    preflightCheckEnabled: envBool(env, 'SYNC_PREFLIGHT_CHECK', DEFAULT_FLAGS.preflightCheckEnabled),
  };
}

// ---------------------------------------------------------------------------
// Guard checks
// ---------------------------------------------------------------------------

export type FlagCheckResult = {
  ok: boolean;
  reason?: string;
  statusCode?: number;
};

/**
 * Check whether a sync request is allowed by the current flags.
 * Call this at the top of the API route before executing syncPr.
 */
export function checkSyncAllowed(
  flags: SyncFeatureFlags,
  owner: string,
  repo: string,
  fileCount: number,
): FlagCheckResult {
  if (!flags.syncEnabled) {
    return {
      ok: false,
      reason: 'Icon sync is currently disabled. Contact your admin.',
      statusCode: 503,
    };
  }

  if (flags.allowedRepos.length > 0) {
    const slug = `${owner}/${repo}`;
    if (!flags.allowedRepos.includes(slug)) {
      return {
        ok: false,
        reason: `Repository "${slug}" is not in the allowed list for sync.`,
        statusCode: 403,
      };
    }
  }

  if (flags.maxFilesPerSync > 0 && fileCount > flags.maxFilesPerSync) {
    return {
      ok: false,
      reason: `Payload contains ${fileCount} files, exceeding the limit of ${flags.maxFilesPerSync}.`,
      statusCode: 400,
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function envBool(
  env: Record<string, string | undefined>,
  key: string,
  fallback: boolean,
): boolean {
  const val = env[key];
  if (val === undefined || val === '') return fallback;
  return val.toLowerCase() === 'true';
}

function envInt(
  env: Record<string, string | undefined>,
  key: string,
  fallback: number,
): number {
  const val = env[key];
  if (val === undefined || val === '') return fallback;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function envList(
  env: Record<string, string | undefined>,
  key: string,
): string[] {
  const val = env[key];
  if (!val || val.trim() === '') return [];
  return val.split(',').map((s) => s.trim()).filter(Boolean);
}
