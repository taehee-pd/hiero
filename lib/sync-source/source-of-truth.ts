/**
 * Source-of-truth guardrails for the icon build pipeline.
 *
 * ## Decision: Canonical source export is the single post-merge build input
 *
 * After a PR sync merges icon data into the target repo, the canonical source
 * files (`icons/<name>/icon.json` + `manifest.json`) are the ONLY authoritative
 * input for compilation and packaging. Raw project/workspace JSON files are
 * editor-internal documents and MUST NOT be used as direct build inputs in CI.
 *
 * ### Schema boundaries
 *
 *   Editor document model (Project/Workspace)
 *     ↓  exportSourcePayload()
 *   Canonical source export (icon.json + manifest.json + preview.svg)
 *     ↓  projectFromSourceFiles() — adapter layer
 *   Reconstructed Project (in-memory only, never persisted in repo)
 *     ↓  compileProject()
 *   Compiled runtime/package outputs (*.compiled.json + icons.manifest.json)
 *
 * ### What this module prevents
 *
 * 1. Accidentally compiling from a stale project.json when source export files
 *    exist in the repo.
 * 2. Having both a project.json and icons/ directory in the same repo root
 *    without detecting the conflict.
 * 3. Producing divergent package outputs depending on which script was invoked.
 */

import { stat as fsStat } from 'node:fs/promises';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SourceOfTruthCheckResult = {
  /** Which build input source was detected. */
  detected: 'source-export' | 'project-json' | 'both' | 'neither';
  /** True when exactly one authoritative source is present. */
  ok: boolean;
  errors: string[];
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Guard: check what build inputs exist on disk
// ---------------------------------------------------------------------------

/**
 * Inspects a directory (typically the repo root) and determines which build
 * input sources are present. Fails fast when both source export files and a
 * raw project/workspace JSON coexist at the same level — a sign of drift.
 *
 * @param rootDir  The directory to inspect (repo root or package root).
 * @param opts     Optional overrides for file names/paths.
 */
export async function checkSourceOfTruth(
  rootDir: string,
  opts?: {
    /** Name of the project JSON file to check for (default: "project.json"). */
    projectFileName?: string;
    /** Subdirectory of source export icons (default: "icons"). */
    iconsDir?: string;
    /** Manifest file name (default: "manifest.json"). */
    manifestFileName?: string;
  },
): Promise<SourceOfTruthCheckResult> {
  const projectFileName = opts?.projectFileName ?? 'project.json';
  const iconsDir = opts?.iconsDir ?? 'icons';
  const manifestFileName = opts?.manifestFileName ?? 'manifest.json';

  const errors: string[] = [];
  const warnings: string[] = [];

  const hasProjectJson = await fileExists(path.join(rootDir, projectFileName));
  const hasIconsDir = await dirExists(path.join(rootDir, iconsDir));
  const hasManifest = await fileExists(path.join(rootDir, manifestFileName));

  const hasSourceExport = hasIconsDir && hasManifest;

  if (hasSourceExport && hasProjectJson) {
    errors.push(
      `Both source export files (${iconsDir}/ + ${manifestFileName}) and ` +
      `${projectFileName} exist in "${rootDir}". ` +
      `This creates ambiguity about which is the authoritative build input. ` +
      `Post-merge builds MUST use source export files exclusively. ` +
      `Remove or relocate ${projectFileName} to prevent drift.`,
    );
    return { detected: 'both', ok: false, errors, warnings };
  }

  if (hasSourceExport) {
    return { detected: 'source-export', ok: true, errors, warnings };
  }

  if (hasProjectJson) {
    warnings.push(
      `Only ${projectFileName} found (no ${iconsDir}/ directory). ` +
      `This is valid for editor-local workflows and test fixtures, ` +
      `but post-merge CI builds should use source export files.`,
    );
    return { detected: 'project-json', ok: true, errors, warnings };
  }

  return { detected: 'neither', ok: true, errors, warnings };
}

// ---------------------------------------------------------------------------
// Guard: validate that a compile-from-source invocation is authoritative
// ---------------------------------------------------------------------------

/**
 * Asserts that source export files are the canonical input and that no
 * conflicting project.json exists alongside them. Call this at the start
 * of any post-merge build script.
 *
 * Throws if both input sources exist to prevent silent drift.
 */
export async function assertSourceExportIsCanonical(
  rootDir: string,
): Promise<void> {
  const result = await checkSourceOfTruth(rootDir);

  if (result.detected === 'both') {
    throw new Error(
      `[source-of-truth] ${result.errors[0]}\n` +
      `Hint: The post-merge build path uses scripts/compile-from-source.ts ` +
      `which reads from icons/ + manifest.json. A stale project.json in the ` +
      `same directory can cause divergent builds.`,
    );
  }

  if (result.detected === 'neither') {
    throw new Error(
      `[source-of-truth] No build input found in "${rootDir}". ` +
      `Expected either icons/ + manifest.json (source export) or project.json.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Guard: warn when using project.json if source export also exists
// ---------------------------------------------------------------------------

/**
 * For the legacy `compile-icons.ts` path: check whether source export files
 * exist alongside the project file. If so, emit a warning that the source
 * export should be preferred.
 */
export async function warnIfSourceExportExists(
  projectPath: string,
): Promise<string | null> {
  const rootDir = path.dirname(projectPath);
  const result = await checkSourceOfTruth(rootDir);

  if (result.detected === 'both') {
    return (
      `WARNING: Source export files (icons/ + manifest.json) exist alongside ` +
      `"${path.basename(projectPath)}". The source export is the canonical ` +
      `post-merge build input. Consider using scripts/compile-from-source.ts instead.`
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const s = await fsStat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const s = await fsStat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}
