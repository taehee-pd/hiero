/**
 * Reusable helpers for building source export payloads and simulating
 * merged repo state in e2e PR sync tests.
 */

import type { Project } from '@/lib/schema/types';
import type { SourcePayloadFile, SyncSourceManifest } from '@/lib/sync-source/types';
import type { SourcePayload } from '@/lib/sync-source/types';
import { exportSourcePayload } from '@/lib/sync-source/export-source-payload';
import { projectFromSourceFiles } from '@/lib/sync-source/source-to-project';
import { compileProject } from '@/lib/export/compile-pipeline';
import { isPackageManifest, isCompiledIcon } from '@/lib/compiler-contracts';

import prSyncProjectFixture from '../fixtures/e2e/pr-sync-project.json';

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

const FIXED_GENERATED_AT = '2026-03-15T00:00:00.000Z';

/** Returns a deep clone of the multi-icon project fixture. */
export function makeProject(): Project {
  return structuredClone(prSyncProjectFixture) as unknown as Project;
}

/**
 * Exports canonical source files from a project with deterministic timestamps.
 */
export function exportSource(project: Project): SourcePayload {
  return exportSourcePayload(project, { generatedAt: FIXED_GENERATED_AT });
}

// ---------------------------------------------------------------------------
// Merge simulation
// ---------------------------------------------------------------------------

/**
 * Simulates a merged repo source state by applying PR changes on top of
 * a "base" set of source files.
 *
 * This replicates what happens after a PR merge:
 * - Files in `changedFiles.added` and `changedFiles.updated` overwrite the base
 * - Files in `changedFiles.deleted` are removed from the base
 * - Remaining base files are unchanged
 *
 * @param baseFiles  Source files from the previous state of the main branch.
 * @param prFiles    The full set of files from the current export (the PR payload).
 * @param changes    The changed file summary from syncPr result.
 */
export function simulateMergedState(
  baseFiles: SourcePayloadFile[],
  prFiles: SourcePayloadFile[],
  changes: { added: string[]; updated: string[]; deleted: string[] },
): SourcePayloadFile[] {
  const baseMap = new Map(baseFiles.map((f) => [f.path, f.contents]));
  const prMap = new Map(prFiles.map((f) => [f.path, f.contents]));

  // Strip any packagePath prefix from change paths for matching
  const changedPaths = new Set([...changes.added, ...changes.updated]);
  const deletedPaths = new Set(changes.deleted);

  // Apply additions and updates from PR
  for (const path of changedPaths) {
    const contents = prMap.get(path);
    if (contents !== undefined) {
      baseMap.set(path, contents);
    }
  }

  // Apply deletions
  for (const path of deletedPaths) {
    baseMap.delete(path);
  }

  return [...baseMap.entries()]
    .map(([path, contents]) => ({ path, contents }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Shortcut: given the full PR source files, treat them as the complete
 * merged state (as if the repo was empty before the first sync).
 */
export function mergedStateFromFullPayload(
  payload: SourcePayload,
): SourcePayloadFile[] {
  return payload.files.slice().sort((a, b) => a.path.localeCompare(b.path));
}

// ---------------------------------------------------------------------------
// Build simulation (post-merge compile)
// ---------------------------------------------------------------------------

export type BuildResult = {
  files: Array<{ path: string; contents: string }>;
  compiledIconCount: number;
  manifestValid: boolean;
  allCompiledIconsValid: boolean;
};

/**
 * Runs the post-merge build pipeline on a set of merged source files.
 * This mirrors what `scripts/compile-from-source.ts` does.
 */
export function buildFromMergedSource(
  mergedFiles: SourcePayloadFile[],
  options?: { tokenColors?: Record<string, string> },
): BuildResult {
  // Reconstruct project from source files
  const project = projectFromSourceFiles(mergedFiles, {
    name: '@coniva/icons',
    tokenColors: options?.tokenColors,
  });

  // Run compile pipeline
  const result = compileProject(project, {
    package: {
      name: '@coniva/icons',
      version: '1.0.0',
      builtAt: '2026-03-15T00:00:00.000Z',
    },
    generateReact: true,
  });

  // Validate outputs
  const manifestFile = result.files.find((f) => f.path === 'icons.manifest.json');
  const manifestValid = manifestFile ? isPackageManifest(JSON.parse(manifestFile.contents)) : false;

  const compiledFiles = result.files.filter((f) => f.path.endsWith('.compiled.json'));
  const allCompiledIconsValid = compiledFiles.every((f) =>
    isCompiledIcon(JSON.parse(f.contents)),
  );

  return {
    files: result.files,
    compiledIconCount: result.compiledIcons.length,
    manifestValid,
    allCompiledIconsValid,
  };
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Extracts and parses the manifest from a set of source payload files.
 */
export function extractManifest(files: SourcePayloadFile[]): SyncSourceManifest {
  const manifestFile = files.find((f) => f.path === 'manifest.json');
  if (!manifestFile) throw new Error('manifest.json not found in files');
  return JSON.parse(manifestFile.contents) as SyncSourceManifest;
}

/**
 * Returns the set of icon directory names present in a source payload.
 */
export function extractIconDirNames(files: SourcePayloadFile[]): Set<string> {
  const dirs = new Set<string>();
  for (const file of files) {
    const match = file.path.match(/^icons\/([^/]+)\//);
    if (match) dirs.add(match[1]!);
  }
  return dirs;
}

/**
 * Checks that there are no duplicate icon IDs in a manifest.
 */
export function hasDuplicateIcons(manifest: SyncSourceManifest): boolean {
  const ids = Object.keys(manifest.icons);
  return ids.length !== new Set(ids).size;
}
