/**
 * Local-directory sync connector — writes adapter-generated files to a
 * local filesystem path, with stale-file cleanup via manifest diffing.
 *
 * This is the simplest sync connector: no network, no auth, no PRs.
 * It runs the configured adapter, writes the output, and removes stale
 * files from a previous generation.
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
import type { SyncConnector } from '../contracts';
import {
  MANIFEST_FILENAME,
  buildManifest,
  computeStaleFiles,
  parseManifest,
  serializeManifest,
} from '@/lib/export/adapters/manifest-cleanup';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdapterInput = {
  icon: Icon;
  meta: RuntimeIconMeta;
  variants: RuntimeVariantPayload[];
};

export type LocalDirectorySyncRequest = {
  /** Absolute path to the target directory. */
  targetDir: string;
  /** Target platform adapter to use. */
  platform: 'react';
  /** Icons to generate. */
  icons: AdapterInput[];
  /** Adapter-specific options. */
  adapterConfig?: ReactAdapterOptions;
};

export type LocalDirectorySyncResult = {
  kind: 'success';
  /** Files written to disk. */
  written: string[];
  /** Stale files removed from disk. */
  removed: string[];
  /** Diagnostic messages from the adapter. */
  diagnostics: Array<{ level: string; message: string }>;
};

/**
 * File system abstraction for testability.
 * Production callers pass Node.js fs functions; tests pass in-memory mocks.
 */
export type FileSystem = {
  readFile(path: string): Promise<string | null>;
  writeFile(path: string, contents: string): Promise<void>;
  removeFile(path: string): Promise<void>;
  mkdirp(path: string): Promise<void>;
};

// ---------------------------------------------------------------------------
// Connector
// ---------------------------------------------------------------------------

export async function syncLocalDirectory(
  request: LocalDirectorySyncRequest,
  fs: FileSystem,
): Promise<LocalDirectorySyncResult> {
  const { targetDir, platform, icons, adapterConfig } = request;

  // --- 1. Run the adapter (pure transform) ---
  const adapterResult = runAdapter(platform, icons, adapterConfig);

  // --- 2. Read existing manifest ---
  const manifestPath = joinPath(targetDir, MANIFEST_FILENAME);
  const existingManifestJson = await fs.readFile(manifestPath);
  const previousManifest = existingManifestJson ? parseManifest(existingManifestJson) : null;

  // --- 3. Write generated files ---
  const written: string[] = [];
  for (const file of adapterResult.files) {
    const fullPath = joinPath(targetDir, file.path);
    const dir = parentDir(fullPath);
    await fs.mkdirp(dir);
    await fs.writeFile(fullPath, file.contents);
    written.push(file.path);
  }

  // --- 4. Compute and remove stale files ---
  const currentFilePaths = adapterResult.files.map((f) => f.path);
  const staleFiles = computeStaleFiles(previousManifest, currentFilePaths);
  const removed: string[] = [];

  for (const stalePath of staleFiles) {
    const fullPath = joinPath(targetDir, stalePath);
    try {
      await fs.removeFile(fullPath);
      removed.push(stalePath);
    } catch {
      // File may have been manually deleted — not an error
    }
  }

  // --- 5. Write updated manifest ---
  const manifest = buildManifest(
    platform,
    currentFilePaths,
    new Date().toISOString(),
  );
  await fs.writeFile(manifestPath, serializeManifest(manifest));

  return {
    kind: 'success',
    written,
    removed,
    diagnostics: adapterResult.diagnostics.map((d) => ({
      level: d.level,
      message: d.message,
    })),
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
// Path helpers
// ---------------------------------------------------------------------------

function joinPath(left: string, right: string): string {
  if (left.endsWith('/')) return left + right;
  return `${left}/${right}`;
}

function parentDir(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash > 0 ? path.slice(0, lastSlash) : path;
}

// ---------------------------------------------------------------------------
// Class wrapper (implements SyncConnector interface)
// ---------------------------------------------------------------------------

export class LocalDirectorySyncConnector
  implements SyncConnector<LocalDirectorySyncRequest, LocalDirectorySyncResult>
{
  constructor(private readonly fs: FileSystem) {}

  async push(request: LocalDirectorySyncRequest): Promise<LocalDirectorySyncResult> {
    return syncLocalDirectory(request, this.fs);
  }

  validate(request: LocalDirectorySyncRequest): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!request.targetDir) errors.push('targetDir is required.');
    if (!request.icons || request.icons.length === 0)
      errors.push('At least one icon is required.');
    return { ok: errors.length === 0, errors };
  }
}
