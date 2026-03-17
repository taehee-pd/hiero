/**
 * Reusable MockGitProvider for hermetic sync-service tests.
 *
 * Extracted from sync-service.test.ts so that both unit tests
 * and end-to-end regression tests can share the same mock.
 */

import type {
  GitProvider,
  GitRef,
  FileCommitResult,
  PullRequestResult,
} from '@/lib/sync-service/git-provider';

type FileEntry = { contents: string; sha: string };

/**
 * Key separator for the internal file store. Uses a character that
 * cannot appear in owner/repo/branch/path to avoid ambiguity when
 * branch names contain slashes (e.g. "icons/update-3-icons-...").
 */
const SEP = '\0';

function fileKey(owner: string, repo: string, branch: string, path: string): string {
  return `${owner}${SEP}${repo}${SEP}${branch}${SEP}${path}`;
}

function branchPrefix(owner: string, repo: string, branch: string): string {
  return `${owner}${SEP}${repo}${SEP}${branch}${SEP}`;
}

function branchKey(owner: string, repo: string, branch: string): string {
  return `${owner}${SEP}${repo}${SEP}${branch}`;
}

export class MockGitProvider implements GitProvider {
  /** Tracks every method call for assertion. */
  calls: Array<{ method: string; args: unknown[] }> = [];

  /** In-memory file store keyed by structured key. */
  private files = new Map<string, FileEntry>();

  /** Reverse map: file key → { owner, repo, branch, path } for iteration. */
  private fileMeta = new Map<string, { owner: string; repo: string; branch: string; path: string }>();

  /** Counter for generating SHAs. */
  private shaCounter = 0;

  /** Branches that should throw on getBranchRef (simulating nonexistence). */
  private missingBranches = new Set<string>();

  /** Branches that are known to exist (seeded or created). */
  private knownBranches = new Set<string>();

  /** Custom base SHA per branch. */
  private branchShas = new Map<string, string>();

  /** Registered existing files that listFiles will return. */
  private listedFiles = new Map<string, Set<string>>();

  /**
   * When true, getBranchRef throws for branches that haven't been
   * explicitly seeded or created. Default: true.
   * Set to false for backward-compatible "always resolve" behavior.
   */
  strictBranches = true;

  private nextSha(): string {
    this.shaCounter++;
    return `sha-${String(this.shaCounter).padStart(6, '0')}`;
  }

  /** Seed an existing file so the provider knows it's already on the branch. */
  seedFile(owner: string, repo: string, branch: string, path: string, contents: string) {
    const key = fileKey(owner, repo, branch, path);
    this.files.set(key, { contents, sha: this.nextSha() });
    this.fileMeta.set(key, { owner, repo, branch, path });
    this.knownBranches.add(branchKey(owner, repo, branch));
  }

  seedListFiles(owner: string, repo: string, branch: string, paths: string[]) {
    this.listedFiles.set(branchKey(owner, repo, branch), new Set(paths));
    this.knownBranches.add(branchKey(owner, repo, branch));
  }

  /** Mark a branch as missing so getBranchRef throws. */
  seedMissingBranch(branch: string) {
    this.missingBranches.add(branch);
  }

  /** Set a custom SHA for a branch. */
  seedBranchSha(owner: string, repo: string, branch: string, sha: string) {
    this.branchShas.set(branchKey(owner, repo, branch), sha);
    this.knownBranches.add(branchKey(owner, repo, branch));
  }

  /**
   * Returns a snapshot of all files stored on a given branch.
   * Useful for inspecting post-sync repo state in e2e tests.
   */
  getFilesOnBranch(
    owner: string,
    repo: string,
    branch: string,
  ): Array<{ path: string; contents: string }> {
    const prefix = branchPrefix(owner, repo, branch);
    const results: Array<{ path: string; contents: string }> = [];
    for (const [key, entry] of this.files) {
      if (key.startsWith(prefix)) {
        const meta = this.fileMeta.get(key);
        if (meta) {
          results.push({ path: meta.path, contents: entry.contents });
        }
      }
    }
    return results.sort((a, b) => a.path.localeCompare(b.path));
  }

  // --- Interface implementation ---

  async getBranchRef(owner: string, repo: string, branch: string): Promise<GitRef> {
    this.calls.push({ method: 'getBranchRef', args: [owner, repo, branch] });
    if (this.missingBranches.has(branch)) {
      throw new Error(`Branch ${branch} not found (404)`);
    }
    const bk = branchKey(owner, repo, branch);

    // In strict mode, unknown branches throw (simulating real GitHub behavior)
    if (this.strictBranches && !this.knownBranches.has(bk)) {
      throw new Error(`Branch ${branch} not found (404)`);
    }

    const sha = this.branchShas.get(bk) ?? 'base-sha-000';
    return { sha, ref: `refs/heads/${branch}` };
  }

  async createBranch(
    owner: string,
    repo: string,
    baseSha: string,
    newBranch: string,
  ): Promise<GitRef> {
    this.calls.push({ method: 'createBranch', args: [owner, repo, baseSha, newBranch] });

    // Register the branch so subsequent getBranchRef calls succeed
    const bk = branchKey(owner, repo, newBranch);
    this.knownBranches.add(bk);
    if (!this.branchShas.has(bk)) {
      this.branchShas.set(bk, baseSha);
    }

    // Copy files from source branches to the new branch.
    // Snapshot the current keys to avoid iterating over entries added during copy.
    const snapshot = [...this.fileMeta.entries()];
    for (const [key, meta] of snapshot) {
      if (meta.owner !== owner || meta.repo !== repo) continue;

      const sourceBk = branchKey(owner, repo, meta.branch);
      const sourceSha = this.branchShas.get(sourceBk) ?? 'base-sha-000';
      if (sourceSha === baseSha || meta.branch === 'main') {
        const newFileKey = fileKey(owner, repo, newBranch, meta.path);
        if (!this.files.has(newFileKey)) {
          const entry = this.files.get(key)!;
          this.files.set(newFileKey, { ...entry });
          this.fileMeta.set(newFileKey, { owner, repo, branch: newBranch, path: meta.path });
        }
      }
    }

    return { sha: baseSha, ref: `refs/heads/${newBranch}` };
  }

  async getFileSha(
    owner: string,
    repo: string,
    branch: string,
    path: string,
  ): Promise<string | null> {
    this.calls.push({ method: 'getFileSha', args: [owner, repo, branch, path] });
    const key = fileKey(owner, repo, branch, path);
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
    const key = fileKey(owner, repo, branch, path);
    this.files.set(key, { contents: content, sha });
    this.fileMeta.set(key, { owner, repo, branch, path });
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
    const key = fileKey(owner, repo, branch, path);
    this.files.delete(key);
    this.fileMeta.delete(key);
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
    const bk = branchKey(owner, repo, branch);
    return this.listedFiles.get(bk) ?? new Set();
  }
}
