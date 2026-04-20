/**
 * @deprecated Use `lib/sync-service/sync-pr.ts` instead.
 * This legacy module predates the Phase C-F sync service refactor.
 * See `lib/sync-service/` for the production-ready implementation
 * with conflict detection, analytics, and structured error handling.
 */

import { exportSvgString } from '@/lib/export/export-svg';
import { generateIconLibrary, type FileMap } from '@/lib/export/export-react/generate-library';
import type { Project } from '@/lib/schema/types';
import { GitHubClient } from './github-client';

export type SyncOptions = {
  project: Project;
  owner: string;
  repo: string;
  baseBranch?: string;
  token: string;
  packagePath: string;
  exportFormat: 'react' | 'svg' | 'both';
};

export type SyncSummary = {
  added: string[];
  updated: string[];
  removed: string[];
};

export type SyncResult = {
  pullRequestUrl: string;
  branch: string;
  summary: SyncSummary;
  syncedFiles: number;
};

export async function syncIconsToGitHub(options: SyncOptions): Promise<SyncResult> {
  const client = new GitHubClient();
  const baseBranch = options.baseBranch ?? 'main';
  const packagePath = normalizePackagePath(options.packagePath);
  const fileMap = generateExportFileMap(options.project, options.exportFormat, packagePath);

  const existingFiles = await listFilesUnderPath(
    options.owner,
    options.repo,
    baseBranch,
    packagePath,
    options.token,
  );

  const branch = `hiero/update-icons-${formatTimestamp(new Date())}`;
  await client.createBranch(
    options.owner,
    options.repo,
    baseBranch,
    branch,
    options.token,
  );

  const updated: string[] = [];
  const added: string[] = [];

  for (const [path, content] of Object.entries(fileMap).sort(([a], [b]) => a.localeCompare(b))) {
    const existingSha = await client.getFileSha(
      options.owner,
      options.repo,
      branch,
      path,
      options.token,
    );

    await client.createOrUpdateFile(
      options.owner,
      options.repo,
      branch,
      path,
      content,
      `chore(icons): sync ${path}`,
      options.token,
      existingSha ?? undefined,
    );

    if (existingFiles.has(path)) {
      updated.push(path);
    } else {
      added.push(path);
    }
  }

  const removed = [...existingFiles].filter((path) => !(path in fileMap)).sort((a, b) => a.localeCompare(b));
  const summary: SyncSummary = {
    added: added.sort((a, b) => a.localeCompare(b)),
    updated: updated.sort((a, b) => a.localeCompare(b)),
    removed,
  };

  const pr = await client.createPullRequest(
    options.owner,
    options.repo,
    branch,
    baseBranch,
    'chore(icons): sync icon package updates',
    buildChangelog(summary),
    options.token,
  );

  return {
    pullRequestUrl: pr.html_url,
    branch,
    summary,
    syncedFiles: Object.keys(fileMap).length,
  };
}

export function buildChangelog(summary: SyncSummary): string {
  const lines: string[] = [];
  lines.push('## Icon Sync Summary');
  lines.push('');
  lines.push(`- Added: ${summary.added.length}`);
  lines.push(`- Updated: ${summary.updated.length}`);
  lines.push(`- Removed: ${summary.removed.length}`);
  lines.push('');
  lines.push('### Added');
  lines.push(...formatList(summary.added));
  lines.push('');
  lines.push('### Updated');
  lines.push(...formatList(summary.updated));
  lines.push('');
  lines.push('### Removed');
  lines.push(...formatList(summary.removed));
  return `${lines.join('\n')}\n`;
}

function formatList(items: string[]): string[] {
  if (items.length === 0) {
    return ['- _(none)_'];
  }
  return items.map((item) => `- \`${item}\``);
}

function generateExportFileMap(
  project: Project,
  exportFormat: SyncOptions['exportFormat'],
  packagePath: string,
): FileMap {
  const map: FileMap = {};

  if (exportFormat === 'react' || exportFormat === 'both') {
    const reactMap = generateIconLibrary(project, {
      outputDir: 'src',
      typescript: true,
      packageName: guessPackageName(packagePath),
    });
    for (const [path, content] of Object.entries(reactMap)) {
      map[joinPath(packagePath, path)] = content;
    }
  }

  if (exportFormat === 'svg' || exportFormat === 'both') {
    const svgMap = generateSvgFileMap(project);
    for (const [path, content] of Object.entries(svgMap)) {
      map[joinPath(packagePath, path)] = content;
    }
  }

  return map;
}

function generateSvgFileMap(project: Project): FileMap {
  const map: FileMap = {};
  for (const icon of Object.values(project.icons).sort((a, b) => a.name.localeCompare(b.name))) {
    const variant = Object.values(icon.variants)[0];
    if (!variant) continue;
    const stateId = variant.defaultType ?? 'default';
    const svg = exportSvgString(icon, variant.id, stateId, project.tokenSet?.colors, variant.renderingMode);
    map[`svg/${toKebab(icon.name || icon.id)}.svg`] = svg;
  }
  return map;
}

async function listFilesUnderPath(
  owner: string,
  repo: string,
  branch: string,
  packagePath: string,
  token: string,
): Promise<Set<string>> {
  const ref = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    { headers: githubHeaders(token) },
  );

  if (!ref.ok) {
    throw new Error(`Unable to read branch ref for ${branch}.`);
  }

  const refPayload = (await ref.json()) as { object: { sha: string } };
  const tree = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${refPayload.object.sha}?recursive=1`,
    { headers: githubHeaders(token) },
  );

  if (!tree.ok) {
    throw new Error('Unable to list repository files from GitHub.');
  }

  const treePayload = (await tree.json()) as {
    tree: Array<{ path: string; type: 'blob' | 'tree' }>;
  };

  const normalizedPrefix = `${packagePath}/`;
  const files = treePayload.tree
    .filter((entry) => entry.type === 'blob' && entry.path.startsWith(normalizedPrefix))
    .map((entry) => entry.path);

  return new Set(files);
}

function guessPackageName(packagePath: string): string {
  const segment = packagePath.split('/').filter(Boolean).pop();
  return segment ? `@hiero/${segment}` : '@hiero/icons';
}

function formatTimestamp(date: Date): string {
  const pad = (value: number) => `${value}`.padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}

function normalizePackagePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

function joinPath(left: string, right: string): string {
  return `${left}/${right}`.replace(/\/+/g, '/');
}

function toKebab(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function githubHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}
