import type { InterpolatedValues } from './scheduler';
import type { CompoundTrimMode } from '../schema/types';

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

/**
 * Trim path values (Lottie-style).
 *
 * All inputs are normalised 0-1:
 *  - trimStart:  where the visible stroke begins (0 = path start)
 *  - trimEnd:    where the visible stroke ends   (1 = path end)
 *  - trimOffset: rotates the start/end positions along the path
 *  - pathLength: total measured length of the SVG path
 *
 * Returns the SVG `stroke-dasharray` and `stroke-dashoffset` needed
 * to render only the visible portion of the path.
 */
export type TrimValues = {
  dashArray: string;   // SVG stroke-dasharray value
  dashOffset: string;  // SVG stroke-dashoffset value
};

export function computeTrimValues(
  trimStart: number,
  trimEnd: number,
  trimOffset: number,
  pathLength: number,
): TrimValues {
  const s = clamp01(trimStart);
  const e = clamp01(trimEnd);
  const o = clamp01(trimOffset);

  // Visible length wraps around when trimStart > trimEnd
  let visibleLength: number;
  if (e >= s) {
    visibleLength = (e - s) * pathLength;
  } else {
    visibleLength = (1 - s + e) * pathLength;
  }

  // Dash offset: negative so the visible segment starts at the right place
  const offset = -(s + o) * pathLength;

  return {
    dashArray: `${visibleLength} ${pathLength}`,
    dashOffset: String(offset),
  };
}

// ---------------------------------------------------------------------------
// Compound-path trim modes
// ---------------------------------------------------------------------------

export type CompoundTrimResult = {
  /** One TrimValues per subpath, matching the order of `subPathLengths`. */
  subPathTrims: TrimValues[];
};

/**
 * Compute per-subpath trim values for a compound path composed of multiple
 * open subpaths.
 *
 * @param trimStart   Normalised 0-1 start of the visible stroke.
 * @param trimEnd     Normalised 0-1 end of the visible stroke.
 * @param trimOffset  Normalised 0-1 rotational offset applied to start/end.
 * @param subPathLengths  Measured length of each subpath (same order as the
 *                        subpaths appear in the SVG `d` string).
 * @param mode        `'simultaneously'` treats all subpaths as one continuous
 *                    path; `'individually'` trims each subpath independently.
 */
export function computeCompoundTrim(
  trimStart: number,
  trimEnd: number,
  trimOffset: number,
  subPathLengths: number[],
  mode: CompoundTrimMode,
): CompoundTrimResult {
  // Filter out zero-length subpaths while remembering their indices so we
  // can place results back in the correct slots.
  const indexed: Array<{ index: number; length: number }> = [];
  for (let i = 0; i < subPathLengths.length; i++) {
    const len = subPathLengths[i]!;
    if (len > 0) {
      indexed.push({ index: i, length: len });
    }
  }

  // Edge case: no valid subpaths.
  if (indexed.length === 0) {
    return { subPathTrims: [] };
  }

  // Build the output array pre-filled with "invisible" defaults for every
  // subpath (including zero-length ones).
  const result: TrimValues[] = subPathLengths.map((len) => ({
    dashArray: `0 ${len}`,
    dashOffset: '0',
  }));

  if (mode === 'individually') {
    // Each subpath is trimmed independently using its own length.
    for (const { index, length } of indexed) {
      result[index] = computeTrimValues(trimStart, trimEnd, trimOffset, length);
    }
  } else {
    // 'simultaneously' — treat all non-zero subpaths as one continuous path.
    computeSimultaneousTrim(trimStart, trimEnd, trimOffset, indexed, result);
  }

  return { subPathTrims: result };
}

/**
 * Internal helper for `'simultaneously'` mode.
 *
 * Maps a single trim range across the combined total length of all subpaths,
 * then slices it into per-subpath dash values.
 */
function computeSimultaneousTrim(
  trimStart: number,
  trimEnd: number,
  trimOffset: number,
  indexed: Array<{ index: number; length: number }>,
  out: TrimValues[],
): void {
  const s = clamp01(trimStart);
  const e = clamp01(trimEnd);
  const o = clamp01(trimOffset);

  const totalLength = indexed.reduce((sum, sp) => sum + sp.length, 0);
  if (totalLength <= 0) return;

  // Absolute start position along the combined path, with offset applied.
  // Wrapping is handled: the visible region may wrap around the total length.
  const absStart = ((s + o) % 1) * totalLength;

  // Visible length (accounts for wrap-around).
  const visibleLength = e >= s
    ? (e - s) * totalLength
    : (1 - s + e) * totalLength;

  // Nothing visible → leave all subpaths invisible (already the default).
  if (visibleLength <= 0) return;

  // Walk each subpath and compute the portion of the visible range that
  // overlaps with it.
  let cursor = 0; // running start-position of current subpath along the total
  for (const { index, length } of indexed) {
    const segStart = cursor;
    const segEnd = cursor + length;
    cursor = segEnd;

    // Determine how much of the visible region overlaps this subpath.
    const overlap = computeOverlap(
      absStart,
      visibleLength,
      segStart,
      segEnd,
      totalLength,
    );

    if (overlap.visible <= 0) {
      // Subpath is entirely outside the visible range.
      out[index] = { dashArray: `0 ${length}`, dashOffset: '0' };
      continue;
    }

    out[index] = {
      dashArray: `${overlap.visible} ${length}`,
      dashOffset: String(-overlap.offset),
    };
  }
}

/**
 * Compute the overlap between a visible range (which may wrap around
 * `totalLength`) and a segment `[segStart, segEnd)`.
 *
 * Returns the visible portion length and the offset from the segment start
 * where the visible portion begins.
 */
function computeOverlap(
  visStart: number,
  visLength: number,
  segStart: number,
  segEnd: number,
  totalLength: number,
): { visible: number; offset: number } {
  const segLen = segEnd - segStart;
  const visEnd = visStart + visLength;

  if (visEnd <= totalLength) {
    // No wrap-around: the visible range is a single contiguous interval.
    return overlapSingle(visStart, visEnd, segStart, segEnd, segLen);
  }

  // Wrap-around: the visible range is split into two intervals:
  //   [visStart, totalLength)  and  [0, visEnd - totalLength)
  const tailEnd = visEnd - totalLength;

  // First interval [visStart, totalLength)
  const a = overlapSingle(visStart, totalLength, segStart, segEnd, segLen);
  // Second interval [0, tailEnd)
  const b = overlapSingle(0, tailEnd, segStart, segEnd, segLen);

  if (a.visible > 0 && b.visible > 0) {
    // Subpath straddles the wrap point — both intervals overlap it.
    // The second interval starts at the beginning of the segment, so use
    // the first interval's offset (it comes first spatially on the subpath).
    return { visible: a.visible + b.visible, offset: a.offset };
  }
  if (a.visible > 0) return a;
  if (b.visible > 0) return b;
  return { visible: 0, offset: 0 };
}

/**
 * Non-wrapping overlap between interval [iStart, iEnd) and segment
 * [segStart, segEnd).
 */
function overlapSingle(
  iStart: number,
  iEnd: number,
  segStart: number,
  segEnd: number,
  segLen: number,
): { visible: number; offset: number } {
  const oStart = Math.max(iStart, segStart);
  const oEnd = Math.min(iEnd, segEnd);
  const visible = Math.max(0, oEnd - oStart);
  if (visible <= 0) return { visible: 0, offset: 0 };

  // Offset within the segment where the visible region begins.
  const offset = oStart - segStart;
  return { visible: Math.min(visible, segLen), offset };
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
