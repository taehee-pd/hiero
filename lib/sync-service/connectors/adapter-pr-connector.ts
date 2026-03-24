/**
 * Adapter PR sync connector — generates adapter output and syncs it
 * to a remote git repository via pull request.
 *
 * This extends the existing `syncPr()` orchestrator for adapter output.
 * Instead of syncing raw icon source files, it first runs the configured
 * adapter to generate platform-specific code (React components, etc.),
 * then commits the generated files and opens a PR.
 *
 * @module
 */

import type { Icon } from '@/lib/schema/types';
import type {
  RuntimeIconMeta,
  RuntimeVariantPayload,
} from '@/lib/export/export-runtime-json';
import type { ReactAdapterOptions } from '@/lib/export/adapters/react-adapter';
import { generateReactFromRuntime } from '@/lib/export/adapters/react-adapter';
import {
  buildManifest,
  computeStaleFiles,
  serializeManifest,
  MANIFEST_FILENAME,
  type ConivaManifest,
} from '@/lib/export/adapters/manifest-cleanup';
import type { GitProvider } from '../git-provider';
import type { SyncAnalytics } from '../analytics';
import { createNoOpAnalytics } from '../analytics';
import { classifyGitHubError } from '../errors';
import type { SyncConnector } from '../contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdapterInput = {
  icon: Icon;
  meta: RuntimeIconMeta;
  variants: RuntimeVariantPayload[];
};

export type AdapterPrSyncRequest = {
  /** GitHub repository owner. */
  owner: string;
  /** GitHub repository name. */
  repo: string;
  /** Base branch (default: "main"). */
  baseBranch?: string;
  /** Path prefix inside the repo (e.g. "packages/icons"). */
  packagePath?: string;
  /** Target platform adapter. */
  platform: 'react';
  /** Icons to generate. */
  icons: AdapterInput[];
  /** Adapter-specific options. */
  adapterConfig?: ReactAdapterOptions;
  /** Actor for commit attribution. */
  actor: { name: string; email?: string };
  /** Previous manifest JSON for stale-file cleanup. Null on first sync. */
  previousManifest?: ConivaManifest | null;
};

export type AdapterPrSyncResult =
  | {
      kind: 'success';
      branch: string;
      pr: { number: number; url: string };
      written: string[];
      removed: string[];
      diagnostics: Array<{ level: string; message: string }>;
      manifest: ConivaManifest;
    }
  | { kind: 'no-op'; message: string }
  | { kind: 'error'; message: string; orphanBranch?: string };

export type AdapterPrSyncOptions = {
  provider: GitProvider;
  now?: Date;
  analytics?: SyncAnalytics;
};

// ---------------------------------------------------------------------------
// Connector
// ---------------------------------------------------------------------------

export async function syncAdapterPr(
  request: AdapterPrSyncRequest,
  options: AdapterPrSyncOptions,
): Promise<AdapterPrSyncResult> {
  const { provider } = options;
  const a = options.analytics ?? createNoOpAnalytics();
  const {
    owner,
    repo,
    baseBranch: baseBranchInput,
    packagePath: packagePathInput,
    platform,
    icons,
    adapterConfig,
    actor,
    previousManifest,
  } = request;

  const baseBranch = baseBranchInput || 'main';
  const packagePath = normalizePackagePath(packagePathInput ?? '');

  a.setContext({ repo: `${owner}/${repo}`, baseBranch });
  a.markStart();

  // --- 1. Run adapter (pure transform) ---
  const adapterResult = runAdapter(platform, icons, adapterConfig);
  if (adapterResult.files.length === 0) {
    return { kind: 'no-op', message: 'Adapter produced no files.' };
  }

  // --- 2. Compute stale files ---
  const currentFilePaths = adapterResult.files.map((f) => f.path);
  const staleFiles = computeStaleFiles(previousManifest ?? null, currentFilePaths);

  // --- 3. Build manifest ---
  const manifest = buildManifest(
    platform,
    currentFilePaths,
    (options.now ?? new Date()).toISOString(),
  );
  const manifestContents = serializeManifest(manifest);

  // Add manifest to the file list
  const allFiles = [
    ...adapterResult.files,
    { path: MANIFEST_FILENAME, contents: manifestContents },
  ];

  // --- 4. Resolve base branch SHA ---
  let baseRef: { sha: string };
  try {
    baseRef = await provider.getBranchRef(owner, repo, baseBranch);
  } catch (err) {
    return { kind: 'error', message: `Failed to resolve base branch: ${String(err)}` };
  }

  // --- 5. Create feature branch ---
  const branchName = generateAdapterBranchName(platform, options.now);
  let branch: string;
  try {
    await provider.createBranch(owner, repo, baseRef.sha, branchName);
    branch = branchName;
  } catch (err) {
    const syncErr = classifyGitHubError(err, 'branch');
    return { kind: 'error', message: syncErr.message };
  }

  // --- 6. List existing remote files ---
  const targetPrefix = packagePath || '';
  let existingFiles: Set<string>;
  try {
    existingFiles = targetPrefix
      ? await provider.listFiles(owner, repo, baseBranch, targetPrefix)
      : new Set<string>();
  } catch {
    existingFiles = new Set();
  }

  // --- 7. Commit generated files ---
  const written: string[] = [];

  try {
    for (const file of allFiles) {
      const remotePath = packagePath ? joinPath(packagePath, file.path) : file.path;
      const existingSha = existingFiles.has(remotePath)
        ? await provider.getFileSha(owner, repo, branch, remotePath)
        : undefined;

      await provider.createOrUpdateFile(
        owner,
        repo,
        branch,
        remotePath,
        file.contents,
        `chore(icons): sync ${file.path}`,
        existingSha ?? undefined,
      );
      written.push(file.path);
    }
  } catch (err) {
    const syncErr = classifyGitHubError(err, 'file-write');
    return { kind: 'error', message: syncErr.message, orphanBranch: branch };
  }

  // --- 8. Delete stale files ---
  const removed: string[] = [];
  for (const stalePath of staleFiles) {
    const remotePath = packagePath ? joinPath(packagePath, stalePath) : stalePath;
    try {
      const sha = await provider.getFileSha(owner, repo, branch, remotePath);
      if (sha) {
        await provider.deleteFile(
          owner, repo, branch, remotePath,
          `chore(icons): remove stale ${stalePath}`, sha,
        );
        removed.push(stalePath);
      }
    } catch {
      // File may already be gone — not a fatal error
    }
  }

  // --- 9. Create PR ---
  let pr: { number: number; url: string };
  try {
    const title = `chore(icons): sync ${platform} adapter output (${written.length} files)`;
    const body = generateAdapterPrBody(platform, written, removed, actor.name, adapterResult.diagnostics);
    const prResult = await provider.createPullRequest(owner, repo, branch, baseBranch, title, body);
    pr = { number: prResult.number, url: prResult.url };
  } catch (err) {
    const syncErr = classifyGitHubError(err, 'pr');
    return { kind: 'error', message: syncErr.message, orphanBranch: branch };
  }

  a.emit({
    name: 'sync_completed',
    branch,
    prNumber: pr.number,
    prUrl: pr.url,
    changedFileCount: written.length + removed.length,
    changedIconCount: icons.length,
    durationMs: 0,
  });

  return {
    kind: 'success',
    branch,
    pr,
    written,
    removed,
    diagnostics: adapterResult.diagnostics,
    manifest,
  };
}

// ---------------------------------------------------------------------------
// Adapter dispatch
// ---------------------------------------------------------------------------

function runAdapter(
  platform: string,
  icons: AdapterInput[],
  adapterConfig?: ReactAdapterOptions,
): {
  files: Array<{ path: string; contents: string }>;
  diagnostics: Array<{ level: string; message: string }>;
} {
  switch (platform) {
    case 'react': {
      const result = generateReactFromRuntime(icons, adapterConfig);
      return {
        files: result.files,
        diagnostics: result.diagnostics.map((d) => ({
          level: d.level,
          message: d.message,
        })),
      };
    }
    default:
      return { files: [], diagnostics: [{ level: 'error', message: `Unsupported platform: ${platform}` }] };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateAdapterBranchName(platform: string, now?: Date): string {
  const d = now ?? new Date();
  const date = d.toISOString().slice(0, 10).replace(/-/g, '');
  const time = d.toISOString().slice(11, 16).replace(':', '');
  return `icons/sync-${platform}-${date}-${time}`;
}

function generateAdapterPrBody(
  platform: string,
  written: string[],
  removed: string[],
  actorName: string,
  diagnostics: Array<{ level: string; message: string }>,
): string {
  const lines: string[] = [
    `## Coniva Icon Sync — ${platform} adapter`,
    '',
    `Triggered by **${actorName}**.`,
    '',
    `### Summary`,
    '',
    `- **${written.length}** file(s) written`,
    `- **${removed.length}** stale file(s) removed`,
    '',
  ];

  if (diagnostics.length > 0) {
    lines.push('### Diagnostics', '');
    for (const d of diagnostics) {
      lines.push(`- **${d.level}**: ${d.message}`);
    }
    lines.push('');
  }

  if (written.length > 0 && written.length <= 30) {
    lines.push('<details>', '<summary>Files written</summary>', '');
    for (const f of written) lines.push(`- \`${f}\``);
    lines.push('', '</details>', '');
  }

  if (removed.length > 0) {
    lines.push('<details>', '<summary>Files removed</summary>', '');
    for (const f of removed) lines.push(`- \`${f}\``);
    lines.push('', '</details>', '');
  }

  lines.push('---', '', '_Generated by Coniva sync service._');
  return lines.join('\n');
}

function normalizePackagePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

function joinPath(left: string, right: string): string {
  return `${left}/${right}`.replace(/\/+/g, '/');
}

// ---------------------------------------------------------------------------
// Class wrapper (implements SyncConnector interface)
// ---------------------------------------------------------------------------

export class AdapterPrSyncConnector
  implements SyncConnector<AdapterPrSyncRequest, AdapterPrSyncResult>
{
  constructor(private readonly options: AdapterPrSyncOptions) {}

  async push(request: AdapterPrSyncRequest): Promise<AdapterPrSyncResult> {
    return syncAdapterPr(request, this.options);
  }

  validate(request: AdapterPrSyncRequest): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!request.owner) errors.push('owner is required.');
    if (!request.repo) errors.push('repo is required.');
    if (!request.icons || request.icons.length === 0)
      errors.push('At least one icon is required.');
    return { ok: errors.length === 0, errors };
  }
}
