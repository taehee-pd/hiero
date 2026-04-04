/**
 * Open-Path Guard
 *
 * Utilities for determining whether paths/layers are eligible for
 * draw (trim-based) animations. Draw animations require:
 * 1. ALL subpaths in the layer must be open (no Z command)
 * 2. The layer must have a stroke style with positive width
 *
 * Used by both the editor (authoring-time guard) and the runtime
 * (soft guard that silently skips ineligible layers).
 */

import type { Layer } from '../schema/types';

/**
 * Returns true if ALL subpaths in the SVG path `d` string are open
 * (none end with a Z/z command).
 *
 * Note: This is a syntactic check. A path that is "visually closed"
 * (endpoint returns to startpoint without Z) is treated as open.
 * This is intentional — the Z command is the canonical marker.
 */
export function isPathFullyOpen(d: string): boolean {
  if (!d || d.trim().length === 0) return false;

  // Check for any Z or z command in the path data.
  // Z can appear as standalone or after numbers/whitespace.
  // We check for the Z/z character that isn't part of a longer token.
  return !/[Zz]/i.test(d);
}

/**
 * Returns true if ANY subpath in the d string is open.
 * Useful for mixed-topology paths where some subpaths are open.
 */
export function hasOpenSubpath(d: string): boolean {
  if (!d || d.trim().length === 0) return false;

  // Split by M commands to get subpath regions
  const subpathRegions = d.split(/(?=[Mm])/);

  for (const region of subpathRegions) {
    const trimmed = region.trim();
    if (trimmed.length === 0) continue;

    // A subpath is open if it doesn't end with Z/z
    if (!/[Zz]\s*$/.test(trimmed)) {
      return true;
    }
  }

  return false;
}

/**
 * Returns true if the layer has a stroke style with positive width.
 * Draw animations are meaningless on fill-only paths since stroke-dasharray
 * only affects the stroke.
 */
export function isStrokedLayer(layer: Layer): boolean {
  if (!layer.style.stroke) return false;

  // A stroke paint must be defined and not 'none'-equivalent
  const stroke = layer.style.stroke;
  if (stroke.mode === 'fixed' && stroke.value === 'none') return false;

  // strokeWidth defaults to 1 per SVG spec when unset.
  // Accept undefined (treated as default 1) or any positive value.
  const width = layer.style.strokeWidth ?? 1;
  return width > 0;
}

/**
 * Returns true if a layer is eligible for draw (trim-based) animation.
 * Requirements:
 * 1. Layer has a path with `d` data
 * 2. ALL subpaths are open (no Z command)
 * 3. Layer has a stroke with positive width
 */
export function isDrawEligible(layer: Layer): boolean {
  if (!layer.path?.d) return false;
  if (!isPathFullyOpen(layer.path.d)) return false;
  if (!isStrokedLayer(layer)) return false;
  return true;
}

/**
 * Filter layer IDs to only those eligible for draw animation.
 *
 * @param layers  The full layer record from a variant/state
 * @param layerIds  Optional subset of IDs to filter. If omitted, all layers are checked.
 * @returns Array of layer IDs that are draw-eligible
 */
export function filterDrawEligibleLayers(
  layers: Record<string, Layer>,
  layerIds?: string[],
): string[] {
  const candidates = layerIds ?? Object.keys(layers);
  return candidates.filter((id) => {
    const layer = layers[id];
    return layer ? isDrawEligible(layer) : false;
  });
}
