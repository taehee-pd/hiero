import type { InterpolatedValues } from './scheduler';

/**
 * Draw annotation from the runtime-json export.
 * Describes which layers are draw-capable and their guide-point ordering.
 */
export type DrawAnnotation = {
  mode: 'byLayer';
  layers: Record<
    string,
    {
      guidePoints: Array<{ t: number; direction?: 'forward' | 'reverse' }>;
    }
  >;
};

/**
 * Variable Draw participation metadata from the export.
 */
export type VariableDrawConfig = {
  participatingLayerIds: string[];
};

/**
 * Compute pathLength values for a Draw On animation.
 *
 * Each participating layer reveals from 0→1 in sequence
 * according to guide-point ordering. The overall progress (0-1)
 * is distributed evenly across layers.
 */
export function computeDrawOnValues(
  draw: DrawAnnotation,
  progress: number,
): InterpolatedValues {
  return computeDrawValues(draw, progress, false);
}

/**
 * Compute pathLength values for a Draw Off animation.
 *
 * Same as Draw On but in reverse: layers hide from 1→0
 * starting from the last layer.
 */
export function computeDrawOffValues(
  draw: DrawAnnotation,
  progress: number,
): InterpolatedValues {
  return computeDrawValues(draw, progress, true);
}

/**
 * Compute pathLength values for Variable Draw.
 *
 * Accepts a normalized progress (0-1) and maps it across
 * participatingLayerIds in sequence. Each layer fully reveals
 * before the next one begins.
 */
export function computeVariableDrawValues(
  config: VariableDrawConfig,
  progress: number,
): InterpolatedValues {
  const layerIds = config.participatingLayerIds;
  if (layerIds.length === 0) return {};

  const clamped = clamp01(progress);
  const values: InterpolatedValues = {};
  const perLayer = 1 / layerIds.length;

  for (let i = 0; i < layerIds.length; i++) {
    const layerId = layerIds[i]!;
    const layerStart = i * perLayer;
    const localProgress = clamp01((clamped - layerStart) / perLayer);
    values[layerId] = { pathLength: localProgress };
  }

  return values;
}

function computeDrawValues(
  draw: DrawAnnotation,
  progress: number,
  reverse: boolean,
): InterpolatedValues {
  const layerIds = Object.keys(draw.layers).sort();
  if (layerIds.length === 0) return {};

  const clamped = clamp01(progress);
  const values: InterpolatedValues = {};
  const perLayer = 1 / layerIds.length;

  const orderedIds = reverse ? [...layerIds].reverse() : layerIds;

  for (let i = 0; i < orderedIds.length; i++) {
    const layerId = orderedIds[i]!;
    const layerStart = i * perLayer;
    const localProgress = clamp01((clamped - layerStart) / perLayer);

    // For Draw On: reveal from 0→1
    // For Draw Off: hide from 1→0 (so we invert after reversing order)
    const pathLength = reverse ? 1 - localProgress : localProgress;
    values[layerId] = { pathLength };
  }

  return values;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
