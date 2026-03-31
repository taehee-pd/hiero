/**
 * Host-target output writer — writes compiled icon files to the locations
 * configured in hostTargets.
 *
 * Supports:
 *   - cache-dir: writes compiled JSON + manifest + React components to cacheDir
 *   - in-memory: no writes (host imports source directly)
 *   - vendored: no writes (managed by consumer's own build step)
 *
 * Node.js only — not imported by browser code.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { HostTarget } from '@/lib/install-config/types';
import type { WriteHostOutputResult } from './types';

export async function writeCompiledToHostTarget(
  repoRoot: string,
  target: HostTarget,
  files: Array<{ path: string; contents: string }>,
): Promise<WriteHostOutputResult> {
  if (target.runtimeMode === 'cache-dir') {
    if (!target.cacheDir) {
      return {
        target,
        writtenFiles: [],
        skipped: true,
        skipReason: 'cacheDir is not configured for this host target',
      };
    }

    const cacheDir = path.resolve(repoRoot, target.cacheDir);
    const writtenFiles: string[] = [];

    for (const file of files) {
      const targetPath = path.join(cacheDir, file.path);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, file.contents, 'utf8');
      writtenFiles.push(file.path);
    }

    return { target, writtenFiles, skipped: false };
  }

  if (target.runtimeMode === 'in-memory') {
    // No file writes: host imports compiled artifacts via the live registry
    // (populated by the dev server's in-process compile step).
    return {
      target,
      writtenFiles: [],
      skipped: true,
      skipReason: 'in-memory mode: host imports directly, no file writes needed',
    };
  }

  if (target.runtimeMode === 'vendored') {
    // Consumer's own build pipeline manages the vendored directory.
    return {
      target,
      writtenFiles: [],
      skipped: true,
      skipReason: 'vendored mode: managed by consumer build step',
    };
  }

  return {
    target,
    writtenFiles: [],
    skipped: true,
    skipReason: `unsupported runtimeMode: ${(target as { runtimeMode: string }).runtimeMode}`,
  };
}
