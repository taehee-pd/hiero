/**
 * Generates a sync-source manifest.json — an index of all icons in the
 * source payload with summary metadata for each.
 */

import type { IconSourceFile, SyncSourceManifest, SyncSourceManifestEntry } from './types';
import { SYNC_SOURCE_MANIFEST_SCHEMA_VERSION } from './types';

export type ManifestInput = {
  source: IconSourceFile;
  /** Relative path to icon.json from payload root, e.g. "icons/chevron/icon.json" */
  sourcePath: string;
  /** Relative path to preview.svg from payload root, e.g. "icons/chevron/preview.svg" */
  previewPath: string;
};

export function generateSyncSourceManifest(
  entries: ManifestInput[],
  generatedAt: string,
): SyncSourceManifest {
  const sorted = [...entries].sort((a, b) => a.source.id.localeCompare(b.source.id));

  const icons: Record<string, SyncSourceManifestEntry> = {};
  for (const entry of sorted) {
    const { source } = entry;

    const sizes = Object.values(source.variants)
      .map((v) => v.size)
      .sort((a, b) => a - b);

    // Deduplicate sizes (multiple variants may share a size)
    const uniqueSizes = [...new Set(sizes)];

    icons[source.id] = {
      id: source.id,
      name: source.name,
      ...(source.category ? { category: source.category } : {}),
      ...(source.tags && source.tags.length > 0 ? { tags: source.tags } : {}),
      variantCount: Object.keys(source.variants).length,
      sizes: uniqueSizes,
      hasTransitions: Boolean(source.transitions && Object.keys(source.transitions).length > 0),
      hasEffects: Boolean(source.effects && Object.keys(source.effects).length > 0),
      sourcePath: entry.sourcePath,
      previewPath: entry.previewPath,
    };
  }

  return {
    schemaVersion: SYNC_SOURCE_MANIFEST_SCHEMA_VERSION,
    generatedAt,
    iconCount: sorted.length,
    icons,
  };
}
