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
  const ranges = resolveLayerRanges(draw, layerIds);

  for (const layerId of layerIds) {
    const range = ranges[layerId] ?? { start: 0, end: 1 };
    const span = Math.max(range.end - range.start, 1e-6);
    const localProgress = clamp01((clamped - range.start) / span);

    // For Draw On: reveal from 0→1
    // For Draw Off: hide from 1→0 while preserving guide timing windows.
    const pathLength = reverse ? 1 - localProgress : localProgress;
    values[layerId] = { pathLength };
  }

  return values;
}

function resolveLayerRanges(
  draw: DrawAnnotation,
  layerIds: string[],
): Record<string, { start: number; end: number }> {
  const guideRanges = Object.fromEntries(
    layerIds.map((layerId) => {
      const guidePoints = draw.layers[layerId]?.guidePoints ?? [];
      const tValues = guidePoints
        .map((point) => point.t)
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => left - right);

      if (tValues.length >= 2) {
        const start = clamp01(tValues[0]!);
        const end = clamp01(tValues[tValues.length - 1]!);
        if (end > start) {
          return [layerId, { start, end }] as const;
        }
      }

      return [layerId, null] as const;
    }),
  );

  const distinctRanges = new Set(
    layerIds
      .map((layerId) => guideRanges[layerId])
      .filter((range): range is { start: number; end: number } => Boolean(range))
      .map((range) => `${range.start}:${range.end}`),
  );

  if (layerIds.every((layerId) => guideRanges[layerId]) && distinctRanges.size > 1) {
    return guideRanges as Record<string, { start: number; end: number }>;
  }

  const fallback: Record<string, { start: number; end: number }> = {};
  const perLayer = 1 / layerIds.length;
  layerIds.forEach((layerId, index) => {
    fallback[layerId] = {
      start: index * perLayer,
      end: (index + 1) * perLayer,
    };
  });
  return fallback;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
