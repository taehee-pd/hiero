export type GitHubRefResponse = {
  ref: string;
  node_id: string;
  url: string;
  object: {
    sha: string;
    type: string;
    url: string;
  };
};

export type GitHubCreateFileResponse = {
  content: {
    name: string;
    path: string;
    sha: string;
    size: number;
    url: string;
    html_url: string;
    git_url: string;
    download_url: string | null;
    type: 'file';
  };
  commit: {
    sha: string;
    url: string;
    html_url: string;
  };
};

export type GitHubPullRequestResponse = {
  id: number;
  number: number;
  html_url: string;
  url: string;
  state: 'open' | 'closed';
  title: string;
  body: string | null;
  head: {
    ref: string;
  };
  base: {
    ref: string;
  };
};

export class GitHubClient {
  async createBranch(
    owner: string,
    repo: string,
    baseBranch: string,
    newBranch: string,
    token: string,
  ): Promise<GitHubRefResponse> {
    const baseRef = await this.request<GitHubRefResponse>(
      owner,
      repo,
      `/git/ref/heads/${encodeURIComponent(baseBranch)}`,
      token,
    );

    return this.request<GitHubRefResponse>(
      owner,
      repo,
      '/git/refs',
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${newBranch}`,
          sha: baseRef.object.sha,
        }),
      },
    );
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    branch: string,
    path: string,
    content: string,
    message: string,
    token: string,
    existingSha?: string,
  ): Promise<GitHubCreateFileResponse> {
    return this.request<GitHubCreateFileResponse>(
      owner,
      repo,
      `/contents/${encodePath(path)}`,
      token,
      {
        method: 'PUT',
        body: JSON.stringify({
          message,
          content: toBase64(content),
          branch,
          sha: existingSha,
        }),
      },
    );
  }

  async createPullRequest(
    owner: string,
    repo: string,
    head: string,
    base: string,
    title: string,
    body: string,
    token: string,
  ): Promise<GitHubPullRequestResponse> {
    return this.request<GitHubPullRequestResponse>(
      owner,
      repo,
      '/pulls',
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          head,
          base,
          title,
          body,
        }),
      },
    );
  }

  async getFileSha(
    owner: string,
    repo: string,
    branch: string,
    path: string,
    token: string,
  ): Promise<string | null> {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
      {
        headers: buildHeaders(token),
      },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(await formatGitHubError(response));
    }

    const payload = (await response.json()) as { sha: string };
    return payload.sha;
  }

  private async request<T>(
    owner: string,
    repo: string,
    endpoint: string,
    token: string,
    init?: RequestInit,
  ): Promise<T> {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}${endpoint}`, {
      ...init,
      headers: {
        ...buildHeaders(token),
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(await formatGitHubError(response));
    }

    return (await response.json()) as T;
  }
}

function buildHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function formatGitHubError(response: Response): Promise<string> {
  const fallback = `GitHub API request failed (${response.status} ${response.statusText}).`;
  try {
    const payload = (await response.json()) as { message?: string };
    if (!payload.message) return fallback;
    return `${fallback} ${payload.message}`;
  } catch {
    return fallback;
  }
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function toBase64(content: string): string {
  if (typeof window !== 'undefined') {
    const bytes = new TextEncoder().encode(content);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return window.btoa(binary);
  }
  return Buffer.from(content, 'utf8').toString('base64');
}
