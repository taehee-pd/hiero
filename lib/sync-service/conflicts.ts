/**
 * Optimistic concurrency and conflict detection for PR sync.
 *
 * Detects conflicts BEFORE creating a branch or PR so the caller can
 * decide whether to re-export rather than silently overwriting.
 */

import type { GitProvider } from './git-provider';
import type { SourcePayloadFile } from '@/lib/sync-source/types';
import { extractIconDir } from './diff-source';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConflictKind =
  | 'base-sha-drift'
  | 'icon-changed-remotely'
  | 'icon-deleted-remotely'
  | 'manifest-changed-remotely'
  | 'branch-already-exists'
  | 'auth-expired';

/**
 * Machine-readable error codes for each conflict category.
 * These are stable identifiers that callers can switch on.
 */
export type ConflictErrorCode =
  | 'STALE_BASE_REVISION'
  | 'ICON_CHANGED_REMOTELY'
  | 'ICON_DELETED_REMOTELY'
  | 'MANIFEST_CONFLICT'
  | 'BRANCH_NAME_COLLISION'
  | 'AUTH_TOKEN_EXPIRED';

export const CONFLICT_ERROR_CODES: Record<ConflictKind, ConflictErrorCode> = {
  'base-sha-drift': 'STALE_BASE_REVISION',
  'icon-changed-remotely': 'ICON_CHANGED_REMOTELY',
  'icon-deleted-remotely': 'ICON_DELETED_REMOTELY',
  'manifest-changed-remotely': 'MANIFEST_CONFLICT',
  'branch-already-exists': 'BRANCH_NAME_COLLISION',
  'auth-expired': 'AUTH_TOKEN_EXPIRED',
};

/**
 * Suggested recovery actions the caller can present to the user.
 */
export type SuggestedAction =
  | 'refresh-and-re-export'
  | 'pull-remote-changes'
  | 'force-sync'
  | 'rename-branch'
  | 're-authenticate'
  | 'discard-deleted-icons'
  | 'resolve-manifest';

export const CONFLICT_SUGGESTED_ACTIONS: Record<ConflictKind, SuggestedAction[]> = {
  'base-sha-drift': ['refresh-and-re-export', 'force-sync'],
  'icon-changed-remotely': ['pull-remote-changes', 'refresh-and-re-export', 'force-sync'],
  'icon-deleted-remotely': ['discard-deleted-icons', 'refresh-and-re-export', 'force-sync'],
  'manifest-changed-remotely': ['resolve-manifest', 'refresh-and-re-export', 'force-sync'],
  'branch-already-exists': ['rename-branch'],
  'auth-expired': ['re-authenticate'],
};

export type Conflict = {
  kind: ConflictKind;
  /** Machine-readable error code for programmatic handling. */
  code: ConflictErrorCode;
  /** Human-readable explanation of the conflict. */
  message: string;
  /** Suggested recovery actions, ordered by preference. */
  suggestedActions: SuggestedAction[];
  /** Icon directory names involved, if applicable. */
  iconDirs?: string[];
  /** Specific file paths involved. */
  files?: string[];
};

/** Build a Conflict with automatic code and suggestedActions from the kind. */
function makeConflict(
  kind: ConflictKind,
  message: string,
  extra?: { iconDirs?: string[]; files?: string[] },
): Conflict {
  return {
    kind,
    code: CONFLICT_ERROR_CODES[kind],
    message,
    suggestedActions: CONFLICT_SUGGESTED_ACTIONS[kind],
    ...extra,
  };
}

export type ConflictCheckResult = {
  /** True when no conflicts were detected. */
  ok: boolean;
  conflicts: Conflict[];
  /** The current HEAD SHA of the remote base branch. */
  remoteHeadSha: string;
  /** The SHA the export was based on (from the request). */
  localBaseSha: string | null;
};

export type ConflictCheckInput = {
  owner: string;
  repo: string;
  baseBranch: string;
  /** SHA the caller believes the base branch was at when exporting. */
  baseSha: string | null;
  /** Files being sent in the current sync payload. */
  currentFiles: SourcePayloadFile[];
  /** Files from the previous successful sync (empty for first sync). */
  previousFiles: SourcePayloadFile[];
  /** The branch name we intend to create. */
  targetBranch: string;
  /** Optional package path prefix. */
  packagePath?: string;
};

// ---------------------------------------------------------------------------
// Conflict checker
// ---------------------------------------------------------------------------

/**
 * Run all conflict checks against the remote repository state.
 * Returns structured conflict data so the caller can present it
 * to the user and offer a re-export path.
 */
export async function checkConflicts(
  input: ConflictCheckInput,
  provider: GitProvider,
): Promise<ConflictCheckResult> {
  const {
    owner,
    repo,
    baseBranch,
    baseSha,
    currentFiles,
    previousFiles,
    targetBranch,
    packagePath,
  } = input;

  const conflicts: Conflict[] = [];

  // 1. Resolve remote HEAD (also serves as auth/connectivity check)
  let remoteHeadSha: string;
  try {
    const remoteRef = await provider.getBranchRef(owner, repo, baseBranch);
    remoteHeadSha = remoteRef.sha;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('401') || message.includes('Bad credentials') || message.includes('token')) {
      conflicts.push(
        makeConflict(
          'auth-expired',
          'Authentication token has expired or been revoked. Re-authenticate and retry.',
        ),
      );
      return {
        ok: false,
        conflicts,
        remoteHeadSha: '',
        localBaseSha: baseSha,
      };
    }
    // Not an auth error — rethrow so caller gets a proper provider error
    throw err;
  }

  // 2. Base SHA drift — the branch moved since the export was generated
  if (baseSha && baseSha !== remoteHeadSha) {
    conflicts.push(
      makeConflict(
        'base-sha-drift',
        `Base branch "${baseBranch}" has advanced since export. ` +
        `Expected ${baseSha}, remote is now ${remoteHeadSha}. ` +
        `Re-export recommended to incorporate latest changes.`,
      ),
    );

    // If the branch moved, check which icons changed remotely
    const remoteConflicts = await detectRemoteIconConflicts(
      provider,
      owner,
      repo,
      baseBranch,
      previousFiles,
      currentFiles,
      packagePath,
    );
    conflicts.push(...remoteConflicts);
  }

  // 3. Branch name collision
  const branchConflict = await detectBranchCollision(
    provider,
    owner,
    repo,
    targetBranch,
  );
  if (branchConflict) {
    conflicts.push(branchConflict);
  }

  return {
    ok: conflicts.length === 0,
    conflicts,
    remoteHeadSha,
    localBaseSha: baseSha,
  };
}

// ---------------------------------------------------------------------------
// Branch collision
// ---------------------------------------------------------------------------

async function detectBranchCollision(
  provider: GitProvider,
  owner: string,
  repo: string,
  targetBranch: string,
): Promise<Conflict | null> {
  try {
    await provider.getBranchRef(owner, repo, targetBranch);
    // If it didn't throw, the branch exists
    return makeConflict(
      'branch-already-exists',
      `Branch "${targetBranch}" already exists. A unique branch name is required.`,
    );
  } catch {
    // Expected: branch doesn't exist yet
    return null;
  }
}

// ---------------------------------------------------------------------------
// Remote icon conflict detection
// ---------------------------------------------------------------------------

/**
 * When the base branch has drifted, compare the remote file listing
 * against what we expect to find (our previous sync state) and flag
 * any icons that were changed or deleted remotely while we were
 * editing locally.
 */
async function detectRemoteIconConflicts(
  provider: GitProvider,
  owner: string,
  repo: string,
  baseBranch: string,
  previousFiles: SourcePayloadFile[],
  currentFiles: SourcePayloadFile[],
  packagePath?: string,
): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];
  const prefix = packagePath ? `${packagePath}/icons` : 'icons';

  let remoteFiles: Set<string>;
  try {
    remoteFiles = await provider.listFiles(owner, repo, baseBranch, prefix);
  } catch {
    // If we can't list, we can't detect — not a conflict itself
    return conflicts;
  }

  const prevMap = new Map<string, string>();
  for (const f of previousFiles) {
    const prefixed = packagePath ? `${packagePath}/${f.path}` : f.path;
    prevMap.set(prefixed, f.contents);
  }

  const currMap = new Map<string, string>();
  for (const f of currentFiles) {
    const prefixed = packagePath ? `${packagePath}/${f.path}` : f.path;
    currMap.set(prefixed, f.contents);
  }

  // Icons we're trying to update that were also changed remotely
  const locallyChangedDirs = new Set<string>();
  for (const path of currMap.keys()) {
    const dir = extractIconDir(stripPrefix(path, packagePath));
    if (dir) locallyChangedDirs.add(dir);
  }

  // Check for icons deleted remotely that we're trying to update
  const deletedRemotely: string[] = [];
  for (const dir of locallyChangedDirs) {
    const iconJsonPath = packagePath
      ? `${packagePath}/icons/${dir}/icon.json`
      : `icons/${dir}/icon.json`;

    // Was in our previous export but no longer on remote
    if (prevMap.has(iconJsonPath) && !remoteFiles.has(iconJsonPath)) {
      deletedRemotely.push(dir);
    }
  }

  if (deletedRemotely.length > 0) {
    conflicts.push(
      makeConflict(
        'icon-deleted-remotely',
        `${deletedRemotely.length} icon(s) were deleted on the remote branch ` +
        `since your last sync: ${deletedRemotely.join(', ')}.`,
        {
          iconDirs: deletedRemotely.sort(),
          files: deletedRemotely
            .map((d) =>
              packagePath ? `${packagePath}/icons/${d}/icon.json` : `icons/${d}/icon.json`,
            )
            .sort(),
        },
      ),
    );
  }

  // Check for icons that exist both locally and remotely but whose
  // remote version differs from our previous sync baseline —
  // meaning someone else changed the same icon
  const changedRemotely: string[] = [];
  for (const dir of locallyChangedDirs) {
    const iconJsonPath = packagePath
      ? `${packagePath}/icons/${dir}/icon.json`
      : `icons/${dir}/icon.json`;

    // Icon exists in both our previous export and on remote
    if (prevMap.has(iconJsonPath) && remoteFiles.has(iconJsonPath)) {
      // We need to check content — fetch remote SHA vs our previous SHA
      // Since we only have path listings (not content), we use a heuristic:
      // if the remote file listing has files we don't recognize for this icon,
      // or if icon.json SHA differs, there was a remote change.
      // For now, we flag when the remote listing has additional files
      // for a dir that our previous export also contained.
      const prevIconFiles = [...prevMap.keys()].filter((p) => {
        const d = extractIconDir(stripPrefix(p, packagePath));
        return d === dir;
      });

      const remoteIconFiles = [...remoteFiles].filter((p) => {
        const d = extractIconDir(stripPrefix(p, packagePath));
        return d === dir;
      });

      // Different file count = something changed remotely
      if (prevIconFiles.length !== remoteIconFiles.length) {
        changedRemotely.push(dir);
      }
    }
  }

  if (changedRemotely.length > 0) {
    conflicts.push(
      makeConflict(
        'icon-changed-remotely',
        `${changedRemotely.length} icon(s) may have been modified on the remote branch ` +
        `since your last sync: ${changedRemotely.join(', ')}. ` +
        `Re-export to incorporate remote changes.`,
        { iconDirs: changedRemotely.sort() },
      ),
    );
  }

  // Manifest conflict — check if manifest.json exists on remote
  // but wasn't in our previous export (different tool wrote it)
  const manifestPath = packagePath ? `${packagePath}/manifest.json` : 'manifest.json';
  if (remoteFiles.has(manifestPath) && !prevMap.has(manifestPath)) {
    conflicts.push(
      makeConflict(
        'manifest-changed-remotely',
        'manifest.json exists on the remote branch but was not part of your previous sync. ' +
        'Another tool or user may have modified it.',
        { files: [manifestPath] },
      ),
    );
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// Branch name recovery
// ---------------------------------------------------------------------------

/**
 * Generates a unique branch name by appending a counter suffix
 * when the preferred name is already taken.
 */
export async function resolveUniqueBranch(
  provider: GitProvider,
  owner: string,
  repo: string,
  preferredBranch: string,
  maxAttempts = 5,
): Promise<string> {
  // Try preferred first
  if (!(await branchExists(provider, owner, repo, preferredBranch))) {
    return preferredBranch;
  }

  // Try with suffix
  for (let i = 2; i <= maxAttempts + 1; i++) {
    const candidate = `${preferredBranch}-${i}`;
    if (!(await branchExists(provider, owner, repo, candidate))) {
      return candidate;
    }
  }

  throw new Error(
    `Could not find a unique branch name after ${maxAttempts} attempts ` +
    `(base: "${preferredBranch}").`,
  );
}

async function branchExists(
  provider: GitProvider,
  owner: string,
  repo: string,
  branch: string,
): Promise<boolean> {
  try {
    await provider.getBranchRef(owner, repo, branch);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripPrefix(path: string, packagePath?: string): string {
  if (!packagePath) return path;
  const prefix = packagePath.endsWith('/') ? packagePath : `${packagePath}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}
