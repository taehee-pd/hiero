/**
 * Manifest cleanup utility — tracks generated files across export runs
 * so stale files from previous generations can be detected and removed.
 *
 * @module
 */

export type CuneiformManifest = {
  version: '1.0';
  generatedAt: string;
  platform: string;
  files: string[];
};

export const MANIFEST_FILENAME = '.cuneiform-manifest.json';

/**
 * Compare a previous manifest against the current file list and return
 * paths that existed before but are no longer generated.
 */
export function computeStaleFiles(
  previousManifest: CuneiformManifest | null,
  currentFiles: string[],
): string[] {
  if (!previousManifest) return [];
  const currentSet = new Set(currentFiles);
  return previousManifest.files.filter(f => !currentSet.has(f));
}

/**
 * Build a new manifest for the current export run.
 * Files are sorted alphabetically for deterministic output.
 */
export function buildManifest(
  platform: string,
  files: string[],
  generatedAt: string,
): CuneiformManifest {
  return {
    version: '1.0',
    generatedAt,
    platform,
    files: [...files].sort(),
  };
}

/**
 * Parse a JSON string into a CuneiformManifest. Returns null for invalid
 * or incompatible manifests (wrong version, missing fields).
 */
export function parseManifest(json: string): CuneiformManifest | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed?.version !== '1.0' || !Array.isArray(parsed?.files)) return null;
    return parsed as CuneiformManifest;
  } catch {
    return null;
  }
}

/**
 * Serialize a manifest to a formatted JSON string (trailing newline).
 */
export function serializeManifest(manifest: CuneiformManifest): string {
  return JSON.stringify(manifest, null, 2) + '\n';
}
