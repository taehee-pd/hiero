/**
 * Abstract git provider interface for PR-based sync.
 *
 * This abstraction allows swapping GitHub for another provider
 * (GitLab, Bitbucket, etc.) without touching the sync orchestrator.
 */

// ---------------------------------------------------------------------------
// Provider-agnostic types
// ---------------------------------------------------------------------------

export type GitRef = {
  sha: string;
  ref: string;
};

export type FileCommitResult = {
  path: string;
  sha: string;
  commitSha: string;
};

export type PullRequestResult = {
  number: number;
  url: string;
  title: string;
  headBranch: string;
  baseBranch: string;
};

export type TreeEntry = {
  path: string;
  type: 'blob' | 'tree';
};

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface GitProvider {
  /**
   * Resolve the HEAD SHA of a branch.
   */
  getBranchRef(
    owner: string,
    repo: string,
    branch: string,
  ): Promise<GitRef>;

  /**
   * Create a new branch from a base SHA.
   */
  createBranch(
    owner: string,
    repo: string,
    baseSha: string,
    newBranch: string,
  ): Promise<GitRef>;

  /**
   * Get the blob SHA of a file (or null if not found).
   */
  getFileSha(
    owner: string,
    repo: string,
    branch: string,
    path: string,
  ): Promise<string | null>;

  /**
   * Create or update a file on a branch.
   */
  createOrUpdateFile(
    owner: string,
    repo: string,
    branch: string,
    path: string,
    content: string,
    message: string,
    existingSha?: string,
  ): Promise<FileCommitResult>;

  /**
   * Delete a file from a branch.
   */
  deleteFile(
    owner: string,
    repo: string,
    branch: string,
    path: string,
    message: string,
    sha: string,
  ): Promise<void>;

  /**
   * Create a pull request.
   */
  createPullRequest(
    owner: string,
    repo: string,
    head: string,
    base: string,
    title: string,
    body: string,
  ): Promise<PullRequestResult>;

  /**
   * List all file paths under a given directory prefix on a branch.
   */
  listFiles(
    owner: string,
    repo: string,
    branch: string,
    pathPrefix: string,
  ): Promise<Set<string>>;
}
