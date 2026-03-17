/**
 * Generates branch names, commit messages, and PR title/body
 * from the sync payload and change summary.
 */

import type { ChangedFileSummary } from './contracts';
import type { SourcePayloadFile } from '@/lib/sync-source/types';

// ---------------------------------------------------------------------------
// Branch name
// ---------------------------------------------------------------------------

/**
 * Generates a branch name like:
 *   icons/update-chevron-right-20260315-1430
 *   icons/update-3-icons-20260315-1430
 */
export function generateBranchName(files: SourcePayloadFile[], now?: Date): string {
  const timestamp = formatTimestamp(now ?? new Date());
  const iconNames = extractIconDirNames(files);

  if (iconNames.length === 0) {
    return `icons/sync-${timestamp}`;
  }

  if (iconNames.length === 1) {
    return `icons/update-${iconNames[0]}-${timestamp}`;
  }

  return `icons/update-${iconNames.length}-icons-${timestamp}`;
}

// ---------------------------------------------------------------------------
// Commit message
// ---------------------------------------------------------------------------

export function generateCommitMessage(
  changes: ChangedFileSummary,
  actorName: string,
): string {
  const parts: string[] = [];

  if (changes.added.length > 0) {
    parts.push(`add ${changes.added.length}`);
  }
  if (changes.updated.length > 0) {
    parts.push(`update ${changes.updated.length}`);
  }
  if (changes.deleted.length > 0) {
    parts.push(`remove ${changes.deleted.length}`);
  }

  const summary = parts.length > 0 ? parts.join(', ') : 'sync';
  const totalFiles =
    changes.added.length + changes.updated.length + changes.deleted.length;

  return [
    `chore(icons): ${summary} icon source files`,
    '',
    `${totalFiles} file(s) changed.`,
    '',
    `Synced by ${actorName} via Icophone.`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// PR title and body
// ---------------------------------------------------------------------------

export function generatePrTitle(changes: ChangedFileSummary): string {
  const iconNames = extractIconNamesFromChanges(changes);

  if (iconNames.length === 0) {
    return 'chore(icons): sync icon sources';
  }

  if (iconNames.length === 1) {
    return `chore(icons): update ${iconNames[0]}`;
  }

  if (iconNames.length <= 3) {
    return `chore(icons): update ${iconNames.join(', ')}`;
  }

  return `chore(icons): update ${iconNames.length} icons`;
}

export function generatePrBody(
  changes: ChangedFileSummary,
  actorName: string,
): string {
  const lines: string[] = [];

  lines.push('## Icon Source Sync');
  lines.push('');
  lines.push(`Synced by **${escapeMarkdown(actorName)}** via Icophone.`);
  lines.push('');
  lines.push('### Summary');
  lines.push('');
  lines.push(`| Change | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Added | ${changes.added.length} |`);
  lines.push(`| Updated | ${changes.updated.length} |`);
  lines.push(`| Deleted | ${changes.deleted.length} |`);
  lines.push('');

  if (changes.added.length > 0) {
    lines.push('### Added');
    lines.push(...formatFileList(changes.added));
    lines.push('');
  }

  if (changes.updated.length > 0) {
    lines.push('### Updated');
    lines.push(...formatFileList(changes.updated));
    lines.push('');
  }

  if (changes.deleted.length > 0) {
    lines.push('### Deleted');
    lines.push(...formatFileList(changes.deleted));
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(date: Date): string {
  const pad = (v: number) => String(v).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    '-',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
  ].join('');
}

function extractIconDirNames(files: SourcePayloadFile[]): string[] {
  const names = new Set<string>();
  for (const file of files) {
    const match = file.path.match(/^icons\/([^/]+)\//);
    if (match) names.add(match[1]!);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function extractIconNamesFromChanges(changes: ChangedFileSummary): string[] {
  const allPaths = [...changes.added, ...changes.updated, ...changes.deleted];
  const names = new Set<string>();
  for (const p of allPaths) {
    const match = p.match(/^icons\/([^/]+)\//);
    if (match) names.add(match[1]!);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function formatFileList(items: string[]): string[] {
  return items.map((item) => `- \`${item}\``);
}

function escapeMarkdown(text: string): string {
  return text.replace(/[*_`~\[\]]/g, '\\$&');
}
