/**
 * Source-level diff engine for PR sync.
 *
 * Compares a previous canonical source export against a current one and
 * produces a classified change set. Only changed files are forwarded to
 * the git provider — unchanged files are skipped entirely.
 */

import type { SourcePayloadFile } from '@/lib/sync-source/types';

// ---------------------------------------------------------------------------
// Change classification
// ---------------------------------------------------------------------------

export type ChangeKind =
  | 'icon-added'
  | 'icon-removed'
  | 'icon-updated'
  | 'preview-only'
  | 'metadata-only'
  | 'manifest-changed';

export type FileChange = {
  path: string;
  kind: ChangeKind;
  /** The icon directory name extracted from the path, or null for root files. */
  iconDir: string | null;
  contents?: string;
};

export type SourceDiffResult = {
  /** Files that need to be created or updated in the repo. */
  filesToWrite: FileChange[];
  /** Files that need to be deleted from the repo. */
  filesToDelete: FileChange[];
  /** True when previous and current payloads are identical. */
  isNoOp: boolean;
  /** Per-icon summary of what changed. */
  iconChanges: IconChange[];
};

export type IconChange = {
  iconDir: string;
  kind: 'added' | 'removed' | 'updated' | 'preview-only' | 'metadata-only';
};

// ---------------------------------------------------------------------------
// Diff engine
// ---------------------------------------------------------------------------

/**
 * Compare two source payloads and return a classified diff.
 *
 * @param previous  Files from the last successful sync (or empty for first sync).
 * @param current   Files from the current export.
 */
export function diffSourcePayloads(
  previous: SourcePayloadFile[],
  current: SourcePayloadFile[],
): SourceDiffResult {
  const prevMap = toMap(previous);
  const currMap = toMap(current);

  const filesToWrite: FileChange[] = [];
  const filesToDelete: FileChange[] = [];

  // --- Added or updated files ---
  for (const [path, contents] of currMap) {
    const prevContents = prevMap.get(path);

    if (prevContents === undefined) {
      // New file
      filesToWrite.push({
        path,
        kind: classifyNewFile(path, currMap),
        iconDir: extractIconDir(path),
        contents,
      });
    } else if (prevContents !== contents) {
      // Changed file
      filesToWrite.push({
        path,
        kind: classifyChangedFile(path),
        iconDir: extractIconDir(path),
        contents,
      });
    }
    // else: identical — skip
  }

  // --- Deleted files ---
  for (const [path] of prevMap) {
    if (!currMap.has(path)) {
      filesToDelete.push({
        path,
        kind: classifyDeletedFile(path, currMap),
        iconDir: extractIconDir(path),
      });
    }
  }

  // Sort for determinism
  filesToWrite.sort((a, b) => a.path.localeCompare(b.path));
  filesToDelete.sort((a, b) => a.path.localeCompare(b.path));

  // --- Per-icon summary ---
  const iconChanges = computeIconChanges(prevMap, currMap);

  return {
    filesToWrite,
    filesToDelete,
    isNoOp: filesToWrite.length === 0 && filesToDelete.length === 0,
    iconChanges,
  };
}

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

function classifyNewFile(path: string, currMap: Map<string, string>): ChangeKind {
  if (path === 'manifest.json') return 'manifest-changed';

  const dir = extractIconDir(path);
  if (!dir) return 'manifest-changed';

  // If the icon.json for this dir also exists as new, it's a new icon
  const iconJsonPath = `icons/${dir}/icon.json`;
  if (path === iconJsonPath || currMap.has(iconJsonPath)) {
    return 'icon-added';
  }
  return 'icon-added';
}

function classifyChangedFile(path: string): ChangeKind {
  if (path === 'manifest.json') return 'manifest-changed';
  if (path.endsWith('/preview.svg')) return 'preview-only';
  if (path.endsWith('/icon.json')) return 'icon-updated';
  return 'metadata-only';
}

function classifyDeletedFile(path: string, currMap: Map<string, string>): ChangeKind {
  if (path === 'manifest.json') return 'manifest-changed';

  const dir = extractIconDir(path);
  if (!dir) return 'manifest-changed';

  // If the icon.json for this dir is also gone, the whole icon was removed
  const iconJsonPath = `icons/${dir}/icon.json`;
  if (!currMap.has(iconJsonPath)) {
    return 'icon-removed';
  }
  // Only preview deleted but icon.json still exists
  if (path.endsWith('/preview.svg')) return 'preview-only';
  return 'icon-updated';
}

/**
 * Build per-icon change summaries by looking at which icon dirs exist
 * in previous vs current, and what changed within each.
 */
function computeIconChanges(
  prevMap: Map<string, string>,
  currMap: Map<string, string>,
): IconChange[] {
  const prevDirs = extractAllIconDirs(prevMap);
  const currDirs = extractAllIconDirs(currMap);

  const changes: IconChange[] = [];

  // Added icons
  for (const dir of currDirs) {
    if (!prevDirs.has(dir)) {
      changes.push({ iconDir: dir, kind: 'added' });
    }
  }

  // Removed icons
  for (const dir of prevDirs) {
    if (!currDirs.has(dir)) {
      changes.push({ iconDir: dir, kind: 'removed' });
    }
  }

  // Updated icons — check what changed within existing dirs
  for (const dir of currDirs) {
    if (!prevDirs.has(dir)) continue; // already handled as added

    const iconJsonPath = `icons/${dir}/icon.json`;
    const previewPath = `icons/${dir}/preview.svg`;

    const iconJsonChanged = prevMap.get(iconJsonPath) !== currMap.get(iconJsonPath);
    const previewChanged = prevMap.get(previewPath) !== currMap.get(previewPath);

    if (iconJsonChanged) {
      changes.push({ iconDir: dir, kind: 'updated' });
    } else if (previewChanged) {
      changes.push({ iconDir: dir, kind: 'preview-only' });
    }
    // else: no change within this icon dir — skip
  }

  return changes.sort((a, b) => a.iconDir.localeCompare(b.iconDir));
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function toMap(files: SourcePayloadFile[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of files) {
    map.set(f.path, f.contents);
  }
  return map;
}

/** Extract the icon directory name from a path like `icons/chevron/icon.json`. */
export function extractIconDir(path: string): string | null {
  const match = path.match(/^icons\/([^/]+)\//);
  return match ? match[1]! : null;
}

function extractAllIconDirs(fileMap: Map<string, string>): Set<string> {
  const dirs = new Set<string>();
  for (const path of fileMap.keys()) {
    const dir = extractIconDir(path);
    if (dir) dirs.add(dir);
  }
  return dirs;
}
