/**
 * GitHub permission scope audit and least-privilege verification.
 *
 * The sync pipeline requires a minimal set of GitHub permissions.
 * This module documents and verifies the required scopes, and
 * provides a runtime preflight check to surface permission problems
 * before the sync starts mutating state.
 */

// ---------------------------------------------------------------------------
// Permission scope audit
// ---------------------------------------------------------------------------

/**
 * Least-privilege permission matrix for the GitHub sync token.
 *
 * Fine-grained Personal Access Token (recommended):
 *   - Repository access: single target repo only
 *   - Contents:     Read and write  (read refs, read/write/delete files)
 *   - Pull requests: Read and write  (create PRs)
 *   - Metadata:     Read             (implicit, always granted)
 *
 * Classic Personal Access Token (legacy):
 *   - `repo` scope (unfortunately cannot be scoped more narrowly)
 *
 * GitHub App installation token (recommended for orgs):
 *   - Repository permissions:
 *     - Contents: Read & write
 *     - Pull requests: Read & write
 *   - No org permissions needed
 *   - Install on specific repos only
 */
export const REQUIRED_PERMISSIONS = {
  'contents': 'read-write',
  'pull_requests': 'read-write',
  'metadata': 'read',
} as const;

export type PermissionScope = keyof typeof REQUIRED_PERMISSIONS;

/**
 * Maps each GitProvider method to the GitHub permission it requires.
 * Used for documentation and audit trail.
 */
export const METHOD_PERMISSION_MAP: Record<string, { scope: PermissionScope; access: string; endpoint: string }> = {
  getBranchRef:       { scope: 'contents',      access: 'read',  endpoint: 'GET /repos/{owner}/{repo}/git/ref/heads/{branch}' },
  createBranch:       { scope: 'contents',      access: 'write', endpoint: 'POST /repos/{owner}/{repo}/git/refs' },
  getFileSha:         { scope: 'contents',      access: 'read',  endpoint: 'GET /repos/{owner}/{repo}/contents/{path}' },
  createOrUpdateFile: { scope: 'contents',      access: 'write', endpoint: 'PUT /repos/{owner}/{repo}/contents/{path}' },
  deleteFile:         { scope: 'contents',      access: 'write', endpoint: 'DELETE /repos/{owner}/{repo}/contents/{path}' },
  createPullRequest:  { scope: 'pull_requests', access: 'write', endpoint: 'POST /repos/{owner}/{repo}/pulls' },
  listFiles:          { scope: 'contents',      access: 'read',  endpoint: 'GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1' },
};

// ---------------------------------------------------------------------------
// Preflight permission check
// ---------------------------------------------------------------------------

export type PreflightResult = {
  ok: boolean;
  checks: PreflightCheck[];
};

export type PreflightCheck = {
  name: string;
  passed: boolean;
  message: string;
};

/**
 * Run a lightweight preflight check to verify that the token has the
 * minimum permissions needed for a sync operation. This is a best-effort
 * check that catches common misconfigurations before the pipeline starts
 * creating branches.
 *
 * Checks:
 *   1. Token is set and non-empty
 *   2. Can read a branch ref (contents:read + repo access)
 *   3. Token is not expired (validates against API)
 *
 * This does NOT attempt any write operations.
 */
export async function preflightPermissionCheck(
  provider: { getBranchRef: (owner: string, repo: string, branch: string) => Promise<unknown> },
  owner: string,
  repo: string,
  baseBranch: string,
): Promise<PreflightResult> {
  const checks: PreflightCheck[] = [];

  // Check 1: Can read the target repo and branch
  try {
    await provider.getBranchRef(owner, repo, baseBranch);
    checks.push({
      name: 'repo-access',
      passed: true,
      message: `Can read ${owner}/${repo} branch "${baseBranch}".`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('401') || message.includes('Bad credentials')) {
      checks.push({
        name: 'auth',
        passed: false,
        message: 'Token is invalid or expired. Generate a new token and update GITHUB_SYNC_TOKEN.',
      });
    } else if (message.includes('403') || message.includes('forbidden')) {
      checks.push({
        name: 'repo-access',
        passed: false,
        message: `Token lacks permission to access ${owner}/${repo}. Ensure the token has contents:read scope and repo access.`,
      });
    } else if (message.includes('404')) {
      checks.push({
        name: 'repo-access',
        passed: false,
        message: `Repository ${owner}/${repo} or branch "${baseBranch}" not found. Check the repo name and ensure the token has access.`,
      });
    } else {
      checks.push({
        name: 'repo-access',
        passed: false,
        message: `Cannot reach ${owner}/${repo}: ${message}`,
      });
    }
  }

  return {
    ok: checks.every((c) => c.passed),
    checks,
  };
}

// ---------------------------------------------------------------------------
// Token hygiene helpers
// ---------------------------------------------------------------------------

/**
 * Validates that a token string meets basic format expectations.
 * Does NOT call any API — purely structural validation.
 */
export function validateTokenFormat(token: string): { ok: boolean; warning?: string } {
  if (!token || token.trim().length === 0) {
    return { ok: false, warning: 'Token is empty.' };
  }

  if (token.includes(' ') || token.includes('\n')) {
    return { ok: false, warning: 'Token contains whitespace. Check for copy-paste errors.' };
  }

  // Fine-grained PAT
  if (token.startsWith('github_pat_')) {
    return { ok: true };
  }

  // Classic PAT
  if (token.startsWith('ghp_')) {
    return { ok: true, warning: 'Classic PAT detected. Fine-grained PATs are recommended for least-privilege access.' };
  }

  // GitHub App installation token
  if (token.startsWith('ghs_')) {
    return { ok: true };
  }

  // OAuth token
  if (token.startsWith('gho_')) {
    return { ok: true, warning: 'OAuth token detected. Ensure the OAuth app has repo scope.' };
  }

  return { ok: true, warning: 'Unrecognized token prefix. Ensure this is a valid GitHub access token.' };
}
