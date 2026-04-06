/**
 * Generates branch names, commit messages, PR title/body, CI job
 * summaries, and review comments from the sync payload and change
 * summary.
 *
 * Design goals:
 * - PR body shows icon-level deltas (added / updated / removed /
 *   preview-only / metadata-only) so reviewers never need to read
 *   raw JSON unless they choose to
 * - Validation checklist is embedded so reviewers can scan pass/fail
 * - Schema version is stamped for auditability
 * - File-level detail is collapsed by default to keep the body short
 */

import type { ChangedFileSummary } from './contracts';
import type { SourcePayloadFile } from '@/lib/sync-source/types';
import type { IconChange } from './diff-source';
import {
  ICON_SOURCE_SCHEMA_VERSION,
  SYNC_SOURCE_MANIFEST_SCHEMA_VERSION,
} from '@/lib/sync-source/types';

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
    `Synced by ${actorName} via Contour.`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// PR title
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

// ---------------------------------------------------------------------------
// PR body — the rich, reviewer-friendly description
// ---------------------------------------------------------------------------

export type PrBodyOptions = {
  changes: ChangedFileSummary;
  actorName: string;
  /** Per-icon classification from the diff engine. */
  iconChanges?: IconChange[];
  /** Validation result from the sync pipeline. */
  validation?: { ok: boolean; errors: string[] };
};

export function generatePrBody(
  changes: ChangedFileSummary,
  actorName: string,
  options?: Omit<PrBodyOptions, 'changes' | 'actorName'>,
): string {
  const iconChanges = options?.iconChanges ?? [];
  const validation = options?.validation;
  const lines: string[] = [];

  // --- Header ---
  lines.push('## Icon Source Sync');
  lines.push('');
  lines.push(`Synced by **${escapeMarkdown(actorName)}** via Contour.`);
  lines.push('');

  // --- Schema version ---
  lines.push(`**Schema version:** icon \`${ICON_SOURCE_SCHEMA_VERSION}\` · manifest \`${SYNC_SOURCE_MANIFEST_SCHEMA_VERSION}\``);
  lines.push('');

  // --- High-level counts ---
  const totalFiles = changes.added.length + changes.updated.length + changes.deleted.length;
  const iconCount = countUniqueIcons(changes);

  lines.push('### Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Icons changed | ${iconCount} |`);
  lines.push(`| Files added | ${changes.added.length} |`);
  lines.push(`| Files updated | ${changes.updated.length} |`);
  lines.push(`| Files deleted | ${changes.deleted.length} |`);
  lines.push(`| Total files changed | ${totalFiles} |`);
  lines.push('');

  // --- Icon-level delta table ---
  if (iconChanges.length > 0) {
    lines.push('### Icon Changes');
    lines.push('');
    lines.push('| Icon | Change |');
    lines.push('|------|--------|');
    for (const ic of iconChanges) {
      lines.push(`| \`${ic.iconDir}\` | ${formatIconChangeKind(ic.kind)} |`);
    }
    lines.push('');
  }

  // --- File-level detail (collapsed for scan-ability) ---
  const hasFileDetail =
    changes.added.length > 0 ||
    changes.updated.length > 0 ||
    changes.deleted.length > 0;

  if (hasFileDetail) {
    lines.push('<details>');
    lines.push('<summary>📂 File-level detail</summary>');
    lines.push('');

    if (changes.added.length > 0) {
      lines.push('**Added**');
      lines.push(...formatFileList(changes.added));
      lines.push('');
    }

    if (changes.updated.length > 0) {
      lines.push('**Updated**');
      lines.push(...formatFileList(changes.updated));
      lines.push('');
    }

    if (changes.deleted.length > 0) {
      lines.push('**Deleted**');
      lines.push(...formatFileList(changes.deleted));
      lines.push('');
    }

    lines.push('</details>');
    lines.push('');
  }

  // --- Validation checklist ---
  lines.push('### Validation Checklist');
  lines.push('');
  if (validation) {
    lines.push(`- [${validation.ok ? 'x' : ' '}] Schema compliance`);
    lines.push(`- [${validation.ok ? 'x' : ' '}] Manifest consistency`);
    lines.push(`- [${validation.ok ? 'x' : ' '}] Preview presence`);
    lines.push(`- [${validation.ok ? 'x' : ' '}] Deterministic export`);
    lines.push(`- [${validation.ok ? 'x' : ' '}] No duplicate icons`);
    lines.push(`- [${validation.ok ? 'x' : ' '}] Compile pipeline`);
    if (!validation.ok && validation.errors.length > 0) {
      lines.push('');
      lines.push('**Errors:**');
      for (const err of validation.errors) {
        lines.push(`- ${err}`);
      }
    }
  } else {
    lines.push('- [ ] Schema compliance — *will be verified by CI*');
    lines.push('- [ ] Manifest consistency — *will be verified by CI*');
    lines.push('- [ ] Preview presence — *will be verified by CI*');
    lines.push('- [ ] Deterministic export — *will be verified by CI*');
    lines.push('- [ ] No duplicate icons — *will be verified by CI*');
    lines.push('- [ ] Compile pipeline — *will be verified by CI*');
  }
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// PR summary comment — posted by CI after validation
// ---------------------------------------------------------------------------

export type PrSummaryCommentOptions = {
  /** Per-icon delta from the diff engine. */
  iconChanges: IconChange[];
  /** File-level changes. */
  changes: ChangedFileSummary;
  /** Validation check results. */
  validationChecks: Array<{ name: string; passed: boolean; errors: string[]; warnings: string[] }>;
  /** Number of compiled icons produced. */
  compiledIconCount?: number;
  /** Schema version from the source files. */
  schemaVersion?: string;
  /** Whether preview artifacts were uploaded. */
  hasPreviewArtifacts?: boolean;
};

/**
 * Generates a concise markdown comment suitable for posting on the PR
 * after CI validation completes. Lets reviewers inspect icon deltas
 * without reading raw JSON.
 */
export function generatePrSummaryComment(opts: PrSummaryCommentOptions): string {
  const {
    iconChanges,
    changes,
    validationChecks,
    compiledIconCount,
    schemaVersion,
    hasPreviewArtifacts,
  } = opts;

  const lines: string[] = [];
  const allPassed = validationChecks.every((c) => c.passed);
  const statusEmoji = allPassed ? '✅' : '❌';

  lines.push(`## ${statusEmoji} Icon Sync — Validation ${allPassed ? 'Passed' : 'Failed'}`);
  lines.push('');

  // --- Quick stats ---
  const totalFiles = changes.added.length + changes.updated.length + changes.deleted.length;
  lines.push(`**${countUniqueIcons(changes)} icon(s)** · **${totalFiles} file(s)** · schema \`${schemaVersion ?? ICON_SOURCE_SCHEMA_VERSION}\``);
  if (compiledIconCount !== undefined) {
    lines.push(` · **${compiledIconCount}** compiled`);
  }
  lines.push('');

  // --- Icon delta table ---
  if (iconChanges.length > 0) {
    lines.push('### Icon Delta');
    lines.push('');
    lines.push('| Icon | Change |');
    lines.push('|------|--------|');
    for (const ic of iconChanges) {
      lines.push(`| \`${ic.iconDir}\` | ${formatIconChangeKind(ic.kind)} |`);
    }
    lines.push('');
  }

  // --- Validation checks ---
  lines.push('### Validation');
  lines.push('');
  for (const check of validationChecks) {
    const icon = check.passed ? '✅' : '❌';
    lines.push(`${icon} ${check.name}`);
    if (!check.passed) {
      for (const err of check.errors.slice(0, 3)) {
        lines.push(`  - ${err}`);
      }
      if (check.errors.length > 3) {
        lines.push(`  - _…and ${check.errors.length - 3} more_`);
      }
    }
    if (check.warnings.length > 0) {
      for (const warn of check.warnings.slice(0, 2)) {
        lines.push(`  - ⚠️ ${warn}`);
      }
    }
  }
  lines.push('');

  // --- Preview artifacts hint ---
  if (hasPreviewArtifacts) {
    lines.push('> 📎 Preview SVGs for changed icons are available in the **icon-previews** CI artifact.');
    lines.push('');
  }

  lines.push('---');
  lines.push('*Auto-generated by Contour CI*');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CI job summary markdown
// ---------------------------------------------------------------------------

export type JobSummaryOptions = {
  /** Per-icon delta. */
  iconChanges: IconChange[];
  /** File-level changes. */
  changes: ChangedFileSummary;
  /** Validation results. */
  validationChecks: Array<{ name: string; passed: boolean; errors: string[]; warnings: string[] }>;
  /** Number of compiled icons. */
  compiledIconCount?: number;
  /** List of preview SVG paths extracted. */
  previewPaths?: string[];
};

/**
 * Generates a GitHub Actions job summary (written to $GITHUB_STEP_SUMMARY)
 * with icon deltas, validation results, and artifact links.
 */
export function generateJobSummaryMarkdown(opts: JobSummaryOptions): string {
  const {
    iconChanges,
    changes,
    validationChecks,
    compiledIconCount,
    previewPaths,
  } = opts;

  const lines: string[] = [];
  const allPassed = validationChecks.every((c) => c.passed);

  lines.push(`# ${allPassed ? '✅' : '❌'} Icon Source Validation`);
  lines.push('');

  // --- Counts ---
  const totalFiles = changes.added.length + changes.updated.length + changes.deleted.length;
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Icons changed | ${countUniqueIcons(changes)} |`);
  lines.push(`| Files changed | ${totalFiles} |`);
  lines.push(`| Schema version | \`${ICON_SOURCE_SCHEMA_VERSION}\` |`);
  if (compiledIconCount !== undefined) {
    lines.push(`| Compiled icons | ${compiledIconCount} |`);
  }
  lines.push('');

  // --- Icon delta ---
  if (iconChanges.length > 0) {
    lines.push('## Icon Changes');
    lines.push('');
    lines.push('| Icon | Change |');
    lines.push('|------|--------|');
    for (const ic of iconChanges) {
      lines.push(`| \`${ic.iconDir}\` | ${formatIconChangeKind(ic.kind)} |`);
    }
    lines.push('');
  }

  // --- Validation ---
  lines.push('## Validation Checks');
  lines.push('');
  for (const check of validationChecks) {
    const icon = check.passed ? '✅' : '❌';
    lines.push(`- ${icon} **${check.name}**`);
    if (!check.passed) {
      for (const err of check.errors) {
        lines.push(`  - ${err}`);
      }
    }
    for (const warn of check.warnings) {
      lines.push(`  - ⚠️ ${warn}`);
    }
  }
  lines.push('');

  // --- Preview artifacts ---
  if (previewPaths && previewPaths.length > 0) {
    lines.push('## Preview Artifacts');
    lines.push('');
    lines.push(`${previewPaths.length} preview SVG(s) extracted for changed icons.`);
    lines.push('');
    lines.push('<details>');
    lines.push('<summary>Files</summary>');
    lines.push('');
    for (const p of previewPaths) {
      lines.push(`- \`${p}\``);
    }
    lines.push('');
    lines.push('</details>');
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

export function extractIconDirNames(files: SourcePayloadFile[]): string[] {
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
    const match = p.match(/^(?:[^/]+\/)?icons\/([^/]+)\//);
    if (match) names.add(match[1]!);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function countUniqueIcons(changes: ChangedFileSummary): number {
  return extractIconNamesFromChanges(changes).length;
}

function formatFileList(items: string[]): string[] {
  return items.map((item) => `- \`${item}\``);
}

export function escapeMarkdown(text: string): string {
  return text.replace(/[*_`~[\]]/g, '\\$&');
}

function formatIconChangeKind(kind: IconChange['kind']): string {
  switch (kind) {
    case 'added': return '🟢 Added';
    case 'removed': return '🔴 Removed';
    case 'updated': return '🟡 Updated';
    case 'preview-only': return '🖼️ Preview only';
    case 'metadata-only': return '📝 Metadata only';
    default: return kind;
  }
}
