/**
 * Incremental rebuild engine — Lane 1 compile step.
 *
 * On every source change detected by the file watcher, this module:
 *   1. Loads the current project from sourceDir via projectFromSourceDir
 *   2. Exports the canonical source payload (for diff tracking)
 *   3. Compares against the previous source snapshot to detect a no-op
 *   4. Runs compileProject (pure, fast — typically < 100ms for < 1000 icons)
 *   5. Writes compiled output to all cache-dir hostTarget locations
 *
 * "Incremental" here means:
 *   - File reads only happen when the watcher fires (not on a timer)
 *   - No-op detection avoids writes when source is unchanged
 *   - The compile step itself is always full (project-wide) for correctness
 *     and determinism; per-icon partial compilation is a future optimization
 *
 * Node.js only — not imported by browser code.
 */

import path from 'node:path';

import { exportSourcePayload } from '@/lib/sync-source';
import { projectFromSourceDir } from '@/lib/sync-source';
import { compileProject } from '@/lib/export/compile-pipeline';
import { diffSourcePayloads } from '@/lib/sync-service/diff-source';
import type { ConivaConfig } from '@/lib/install-config/types';
import type { LiveBuildResult } from './types';
import { writeCompiledToHostTarget } from './output-writer';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Full rebuild from scratch. Called on first start or after cache clearing.
 * Skips the no-op check (always compiles and writes).
 */
export async function fullRebuild(
  repoRoot: string,
  config: ConivaConfig,
  opts?: { builtAt?: string },
): Promise<LiveBuildResult> {
  return runBuild(repoRoot, config, null, opts);
}

/**
 * Incremental rebuild. Called by the file watcher on any source change.
 * Skips if source payload is identical to `previousSourceFiles`.
 */
export async function incrementalRebuild(
  repoRoot: string,
  config: ConivaConfig,
  previousSourceFiles: Array<{ path: string; contents: string }> | null,
  opts?: { builtAt?: string },
): Promise<LiveBuildResult> {
  return runBuild(repoRoot, config, previousSourceFiles, opts);
}

// ---------------------------------------------------------------------------
// Shared implementation
// ---------------------------------------------------------------------------

async function runBuild(
  repoRoot: string,
  config: ConivaConfig,
  previousSourceFiles: Array<{ path: string; contents: string }> | null,
  opts?: { builtAt?: string },
): Promise<LiveBuildResult> {
  const startMs = Date.now();
  const sourceDir = path.resolve(repoRoot, config.sourceDir);
  const builtAt = opts?.builtAt ?? new Date().toISOString();

  // Step 1: Load project from source files on disk
  let project;
  try {
    project = await projectFromSourceDir(sourceDir);
  } catch (err) {
    return {
      kind: 'error',
      durationMs: Date.now() - startMs,
      error: `Failed to read source directory "${config.sourceDir}": ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Step 2: Export canonical source payload for diff tracking.
  // Use a fixed sentinel timestamp so the manifest's generatedAt field doesn't
  // cause false no-op misses — we only care whether icon sources changed.
  let currentPayload;
  try {
    currentPayload = exportSourcePayload(project, { generatedAt: '1970-01-01T00:00:00.000Z' });
  } catch (err) {
    return {
      kind: 'error',
      durationMs: Date.now() - startMs,
      error: `Source export failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Step 3: No-op check (skip if nothing changed)
  if (previousSourceFiles !== null) {
    const diff = diffSourcePayloads(previousSourceFiles, currentPayload.files);
    if (diff.isNoOp) {
      return {
        kind: 'no-op',
        durationMs: Date.now() - startMs,
        changedIcons: 0,
        sourceFiles: previousSourceFiles,
      };
    }
  }

  // Step 4: Compile (pure function — deterministic, no I/O)
  let compiled;
  try {
    compiled = compileProject(project, {
      package: {
        name: 'coniva-live',
        version: '0.0.0',
        builtAt,
      },
    });
  } catch (err) {
    return {
      kind: 'error',
      durationMs: Date.now() - startMs,
      error: `Compile failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Step 5: Write compiled output to all host target locations
  const writtenFiles: string[] = [];
  for (const target of config.hostTargets) {
    try {
      const result = await writeCompiledToHostTarget(repoRoot, target, compiled.files);
      if (!result.skipped) {
        writtenFiles.push(...result.writtenFiles);
      }
    } catch (err) {
      return {
        kind: 'error',
        durationMs: Date.now() - startMs,
        error: `Write to host target "${target.kind}" failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // Compute changed icon count against previous snapshot
  let changedIcons = compiled.compiledIcons.length; // first build = all icons
  if (previousSourceFiles !== null) {
    const diff = diffSourcePayloads(previousSourceFiles, currentPayload.files);
    changedIcons = diff.iconChanges.filter(
      (c) => c.kind === 'added' || c.kind === 'updated' || c.kind === 'removed',
    ).length;
  }

  return {
    kind: 'success',
    durationMs: Date.now() - startMs,
    changedIcons,
    totalIcons: compiled.compiledIcons.length,
    writtenFiles,
    sourceFiles: currentPayload.files,
  };
}
