/**
 * GitHub implementation of the GitProvider interface.
 *
 * Wraps raw GitHub REST API calls. The token is injected at construction
 * time and never exposed to callers — suitable for server-side use only.
 */

import type {
  GitProvider,
  GitRef,
  FileCommitResult,
  PullRequestResult,
} from './git-provider';
import { classifyGitHubError } from './errors';

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class GitHubProvider implements GitProvider {
  private readonly token: string;

  constructor(token: string) {
    if (!token) {
      throw new Error('GitHubProvider requires a non-empty access token.');
    }
    this.token = token;
  }

  async getBranchRef(owner: string, repo: string, branch: string): Promise<GitRef> {
    try {
      const data = await this.request<{ ref: string; object: { sha: string } }>(
        owner,
        repo,
        `/git/ref/heads/${encodeURIComponent(branch)}`,
      );
      return { sha: data.object.sha, ref: data.ref };
    } catch (err) {
      throw classifyGitHubError(err, 'branch');
    }
  }

  async createBranch(
    owner: string,
    repo: string,
    baseSha: string,
    newBranch: string,
  ): Promise<GitRef> {
    try {
      const data = await this.request<{ ref: string; object: { sha: string } }>(
        owner,
        repo,
        '/git/refs',
        {
          method: 'POST',
          body: JSON.stringify({
            ref: `refs/heads/${newBranch}`,
            sha: baseSha,
          }),
        },
      );
      return { sha: data.object.sha, ref: data.ref };
    } catch (err) {
      throw classifyGitHubError(err, 'branch');
    }
  }

  async getFileSha(
    owner: string,
    repo: string,
    branch: string,
    path: string,
  ): Promise<string | null> {
    const url =
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(path)}` +
      `?ref=${encodeURIComponent(branch)}`;

    const response = await fetch(url, { headers: this.headers() });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw classifyGitHubError(
        new Error(await formatError(response)),
        'file-write',
      );
    }
    const payload = (await response.json()) as { sha: string };
    return payload.sha;
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
    try {
      const data = await this.request<{
        content: { path: string; sha: string };
        commit: { sha: string };
      }>(owner, repo, `/contents/${encodePath(path)}`, {
        method: 'PUT',
        body: JSON.stringify({
          message,
          content: toBase64(content),
          branch,
          sha: existingSha,
        }),
      });
      return {
        path: data.content.path,
        sha: data.content.sha,
        commitSha: data.commit.sha,
      };
    } catch (err) {
      throw classifyGitHubError(err, 'file-write');
    }
  }

  async deleteFile(
    owner: string,
    repo: string,
    branch: string,
    path: string,
    message: string,
    sha: string,
  ): Promise<void> {
    try {
      await this.request(owner, repo, `/contents/${encodePath(path)}`, {
        method: 'DELETE',
        body: JSON.stringify({ message, sha, branch }),
      });
    } catch (err) {
      throw classifyGitHubError(err, 'file-delete');
    }
  }

  async createPullRequest(
    owner: string,
    repo: string,
    head: string,
    base: string,
    title: string,
    body: string,
  ): Promise<PullRequestResult> {
    try {
      const data = await this.request<{
        number: number;
        html_url: string;
        title: string;
        head: { ref: string };
        base: { ref: string };
      }>(owner, repo, '/pulls', {
        method: 'POST',
        body: JSON.stringify({ head, base, title, body }),
      });
      return {
        number: data.number,
        url: data.html_url,
        title: data.title,
        headBranch: data.head.ref,
        baseBranch: data.base.ref,
      };
    } catch (err) {
      throw classifyGitHubError(err, 'pr');
    }
  }

  async listFiles(
    owner: string,
    repo: string,
    branch: string,
    pathPrefix: string,
  ): Promise<Set<string>> {
    try {
      const ref = await this.getBranchRef(owner, repo, branch);
      const treeUrl =
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref.sha}?recursive=1`;

      const response = await fetch(treeUrl, { headers: this.headers() });
      if (!response.ok) {
        throw new Error(await formatError(response));
      }

      const payload = (await response.json()) as {
        tree: Array<{ path: string; type: 'blob' | 'tree' }>;
      };

      const normalized = pathPrefix.endsWith('/') ? pathPrefix : `${pathPrefix}/`;
      const files = payload.tree
        .filter((entry) => entry.type === 'blob' && entry.path.startsWith(normalized))
        .map((entry) => entry.path);

      return new Set(files);
    } catch (err) {
      if (err instanceof Error && err.name === 'BranchCreationError') throw err;
      throw classifyGitHubError(err, 'generic');
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private headers(): HeadersInit {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  private async request<T>(
    owner: string,
    repo: string,
    endpoint: string,
    init?: RequestInit,
  ): Promise<T> {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}${endpoint}`,
      { ...init, headers: { ...this.headers(), ...(init?.headers ?? {}) } },
    );
    if (!response.ok) {
      throw new Error(await formatError(response));
    }
    return (await response.json()) as T;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function toBase64(content: string): string {
  return Buffer.from(content, 'utf8').toString('base64');
}

async function formatError(response: Response): Promise<string> {
  const fallback = `GitHub API ${response.status} ${response.statusText}`;
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ? `${fallback}: ${body.message}` : fallback;
  } catch {
    return fallback;
  }
}
