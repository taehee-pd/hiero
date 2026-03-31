/**
 * Converts an editor Icon into a canonical IconSourceFile for sync.
 *
 * Strips editor-only metadata:
 * - `importMeta` on layers (SVG import provenance — not needed for versioned storage)
 * - `isClipMask` internal flag (derivable from clipPathLayerId references)
 * - `groupId` (editor grouping state)
 * - `guideMasterId` on variants (editor guide binding)
 * - `customGuides` on icons (editor guide overrides)
 * - `components` on icons (editor symbol components — not canonical source)
 */

import type { Icon, Layer } from '@/lib/schema/types';
import type {
  IconSourceFile,
  SourceLayer,
  SourceVariant,
} from './types';
import { ICON_SOURCE_SCHEMA_VERSION } from './types';

export function exportIconSource(icon: Icon): IconSourceFile {
  const variants: Record<string, SourceVariant> = {};

  for (const [variantId, variant] of sortedEntries(icon.variants)) {
    const layers: Record<string, SourceLayer> = {};

    for (const [layerId, layer] of sortedEntries(variant.layers)) {
      layers[layerId] = stripLayer(layer);
    }

    variants[variantId] = {
      id: variant.id,
      ...(variant.name ? { name: variant.name } : {}),
      size: variant.size,
      viewBox: variant.viewBox,
      ...(variant.renderingMode ? { renderingMode: variant.renderingMode } : {}),
      ...(variant.weight ? { weight: variant.weight } : {}),
      ...(variant.scale ? { scale: variant.scale } : {}),
      layers,
      ...(variant.topology ? { topology: variant.topology } : {}),
    };
  }

  const source: IconSourceFile = {
    schemaVersion: ICON_SOURCE_SCHEMA_VERSION,
    id: icon.id,
    name: icon.name,
    ...(icon.category ? { category: icon.category } : {}),
    ...(icon.tags && icon.tags.length > 0
      ? { tags: [...icon.tags].sort((a, b) => a.localeCompare(b)) }
      : {}),
    variants,
    ...(icon.transitions && Object.keys(icon.transitions).length > 0
      ? { transitions: icon.transitions }
      : {}),
    ...(icon.effects && Object.keys(icon.effects).length > 0
      ? { effects: icon.effects }
      : {}),
  };

  return source;
}

function stripLayer(layer: Layer): SourceLayer {
  const source: SourceLayer = {
    id: layer.id,
    ...(layer.role ? { role: layer.role } : {}),
    ...(layer.visible === false ? { visible: false } : {}),
    ...(layer.clipPathLayerId ? { clipPathLayerId: layer.clipPathLayerId } : {}),
    ...(layer.path ? { path: layer.path } : {}),
    style: layer.style,
    ...(layer.transform ? { transform: layer.transform } : {}),
  };

  // Intentionally omit: importMeta, isClipMask, groupId
  return source;
}

function sortedEntries<T>(record: Record<string, T>): [string, T][] {
  return Object.entries(record).sort(([a], [b]) => a.localeCompare(b));
}
