import type { EditorStore } from './store';
import type { Icon, Variant, Layer, LayerSnapshot, GuideMaster } from '@/lib/schema/types';
import { variantToSnapshot } from '@/lib/schema/types';

export type LayerPanelRow = {
  layer: Layer;
  depth: number;
  maskLayerId: string | null;
  clippedLayerIds: string[];
};

/**
 * Read the guide master that `editScope` currently points at, if any. Only
 * returns non-null while `editScope.kind === 'guideMaster'` AND the master
 * still exists (it may have just been deleted, in which case the store's
 * own lifecycle will snap scope back to icon).
 */
export function selectEditingGuideMaster(s: EditorStore): GuideMaster | null {
  if (s.editScope.kind !== 'guideMaster') return null;
  return s.project?.guideMasters?.[s.editScope.masterId] ?? null;
}

export function selectCurrentIcon(s: EditorStore): Icon | null {
  // In guide scope there is no icon context — the canvas edits the master.
  // Returning null here hides layer-unaware "icon" affordances (variant
  // matrix, symbol tagging, icon-scoped paste) from subscribers.
  if (s.editScope.kind === 'guideMaster') return null;
  if (!s.project || !s.currentIconId) return null;
  return s.project.icons[s.currentIconId] ?? null;
}

export function selectCurrentVariant(s: EditorStore): Variant | null {
  // Guide scope: synthesise a Variant-shaped view over the master so the
  // LayerPanel / Inspector / runtime renderer consume it transparently.
  const master = selectEditingGuideMaster(s);
  if (master) return guideMasterAsVariant(master);

  if (s.editScope.kind !== 'icon') return null;
  if (!s.project || !s.currentIconId || !s.currentVariantId) return null;
  const icon = s.project.icons[s.currentIconId];
  if (!icon) return null;
  return icon.variants[s.currentVariantId] ?? null;
}

export function selectCurrentType(s: EditorStore): LayerSnapshot | null {
  const variant = selectCurrentVariant(s);
  if (!variant) return null;
  // In guide scope, types don't apply — the master doesn't have per-type
  // layer snapshots. `variantToSnapshot(variant, null)` returns the base
  // layer set directly.
  if (s.editScope.kind === 'guideMaster') return variantToSnapshot(variant, null);
  return variantToSnapshot(variant, s.currentTypeId);
}

export function selectCurrentGuideMaster(s: EditorStore): GuideMaster | null {
  // Prefer the explicitly-edited master when in guide scope.
  const editing = selectEditingGuideMaster(s);
  if (editing) return editing;

  const variant = selectCurrentVariant(s);
  const guideMasters = s.project?.guideMasters;
  if (!variant || !guideMasters) return null;

  return (
    (variant.guideMasterId ? guideMasters[variant.guideMasterId] : null) ??
    Object.values(guideMasters).find((guideMaster) => guideMaster.targetSize === variant.size) ??
    null
  );
}

/**
 * Stable view of a GuideMaster as a Variant so Inspector / LayerPanel /
 * runtime renderer can consume it uniformly. The cache is keyed by master
 * reference — since the project state is rebuilt immutably on every write,
 * a new master reference naturally invalidates the cached synthetic view,
 * and panels that memoize by variant identity stop thrashing.
 */
const guideVariantCache = new WeakMap<GuideMaster, Variant>();
function guideMasterAsVariant(master: GuideMaster): Variant {
  const cached = guideVariantCache.get(master);
  if (cached) return cached;
  const variant: Variant = {
    // Master-scoped synthetic id. Non-persisted; exists so `currentVariantId`
    // consumers (render keys, memo keys, selection restore) stay unique per
    // master and can't alias across concurrently-loaded masters.
    id: `guide-master:${master.id}`,
    size: master.targetSize,
    viewBox: master.viewBox,
    // Guide masters are authored as semantic `items` (rect / hline / vline /
    // ellipse / drawPoint), rendered by the editor-overlay-canvas pipeline
    // as thin dashed strokes. They are *not* icon paths, so the synthetic
    // variant exposes an empty layer set — the icon-renderer path stays
    // out of the guide overlay's territory regardless of any legacy
    // `master.layers` data left over from an earlier migration model.
    layers: {},
  };
  guideVariantCache.set(master, variant);
  return variant;
}

export function selectVariantSnapshotById(
  icon: Icon | null | undefined,
  variantId: string | null | undefined,
): LayerSnapshot | null {
  if (!icon || !variantId) return null;
  const variant = icon.variants[variantId];
  if (!variant) return null;
  return variantToSnapshot(variant, null);
}

export function selectCurrentLayers(s: EditorStore): Layer[] {
  const variant = selectCurrentVariant(s);
  if (!variant) return [];
  return Object.values(variant.layers);
}

export function selectLayerById(
  s: EditorStore,
  layerId: string,
): Layer | null {
  const variant = selectCurrentVariant(s);
  if (!variant) return null;
  return variant.layers[layerId] ?? null;
}

export function selectIconList(
  s: EditorStore,
): Array<{ id: string; name: string }> {
  if (!s.project) return [];
  return Object.values(s.project.icons).map((icon) => ({
    id: icon.id,
    name: icon.name,
  }));
}

export function buildLayerPanelRows(layers: Layer[]): LayerPanelRow[] {
  const clippedByMask = new Map<string, Layer[]>();
  const topLevelLayers: Layer[] = [];
  const layerById = new Map(layers.map((layer) => [layer.id, layer]));

  for (const layer of layers) {
    const maskLayerId = layer.clipPathLayerId;
    if (maskLayerId && layerById.has(maskLayerId)) {
      const bucket = clippedByMask.get(maskLayerId) ?? [];
      bucket.push(layer);
      clippedByMask.set(maskLayerId, bucket);
      continue;
    }
    topLevelLayers.push(layer);
  }

  const rows: LayerPanelRow[] = [];
  const visited = new Set<string>();
  const appendLayer = (layer: Layer, depth: number, maskLayerId: string | null) => {
    if (visited.has(layer.id)) return;
    visited.add(layer.id);

    const children = clippedByMask.get(layer.id) ?? [];
    rows.push({
      layer,
      depth,
      maskLayerId,
      clippedLayerIds: children.map((child) => child.id),
    });

    for (const child of children) {
      appendLayer(child, depth + 1, layer.id);
    }
  };

  for (const layer of topLevelLayers) {
    appendLayer(layer, 0, null);
  }

  for (const layer of layers) {
    appendLayer(layer, 0, null);
  }

  return rows;
}
