import type { EditorStore } from './store';
import type { Icon, Variant, Layer, LayerSnapshot, GuideMaster } from '@/lib/schema/types';
import { variantToSnapshot } from '@/lib/schema/types';

export type LayerPanelRow = {
  layer: Layer;
  depth: number;
  maskLayerId: string | null;
  clippedLayerIds: string[];
};

export function selectCurrentIcon(s: EditorStore): Icon | null {
  if (!s.project || !s.currentIconId) return null;
  return s.project.icons[s.currentIconId] ?? null;
}

export function selectCurrentVariant(s: EditorStore): Variant | null {
  const icon = selectCurrentIcon(s);
  if (!icon || !s.currentVariantId) return null;
  return icon.variants[s.currentVariantId] ?? null;
}

export function selectCurrentState(s: EditorStore): LayerSnapshot | null {
  const variant = selectCurrentVariant(s);
  if (!variant) return null;
  return variantToSnapshot(variant, s.currentStateId);
}

export function selectCurrentGuideMaster(s: EditorStore): GuideMaster | null {
  const variant = selectCurrentVariant(s);
  const guideMasters = s.project?.guideMasters;
  if (!variant || !guideMasters) return null;

  return (
    (variant.guideMasterId ? guideMasters[variant.guideMasterId] : null) ??
    Object.values(guideMasters).find((guideMaster) => guideMaster.targetSize === variant.size) ??
    null
  );
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

export function selectCurrentLayerPanelRows(s: EditorStore): LayerPanelRow[] {
  const variant = selectCurrentVariant(s);
  if (!variant) return [];
  return buildLayerPanelRows(Object.values(variant.layers));
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
