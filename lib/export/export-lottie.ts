/**
 * Lottie 5.x JSON exporter.
 *
 * Converts a compiled Coniva icon to the Lottie JSON format for
 * cross-platform animated icon delivery (Android, iOS, React Native, web).
 *
 * Entry point: `exportLottie(icon, variantId, options?)`
 *
 * Architecture:
 *
 *   Icon → Variant → Layers → Lottie shape layers (M2)
 *                   → Effects → Lottie effect animations (M6)
 *
 * @module
 */

import type {
  Icon,
  Variant,
  Layer,
  TimelineTrack,
  Effect,
  PaintRef,
  GradientStop,
  SpringConfig,
} from '@/lib/schema/types';

// ---------------------------------------------------------------------------
// Lottie JSON types (subset of Lottie 5.x schema)
// ---------------------------------------------------------------------------

export type LottieJson = {
  v: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  nm: string;
  layers: LottieLayer[];
  assets: unknown[];
};

export type LottieLayer = {
  ty: number; // 4 = shape layer
  nm: string;
  ind: number;
  ip: number;
  op: number;
  st: number;
  ks: LottieTransform;
  shapes: LottieShape[];
};

export type LottieTransform = {
  o: LottieAnimatedValue; // opacity
  r: LottieAnimatedValue; // rotation
  p: LottieAnimatedMultiValue; // position
  s: LottieAnimatedMultiValue; // scale
  a: LottieAnimatedMultiValue; // anchor
};

export type LottieAnimatedValue = {
  a: 0 | 1; // animated flag
  k: number | LottieKeyframe[];
};

export type LottieAnimatedMultiValue = {
  a: 0 | 1;
  k: number[] | LottieKeyframe[];
};

export type LottieKeyframe = {
  t: number; // time (frame)
  s: number[]; // start value
  e?: number[]; // end value
  o?: { x: number[]; y: number[] }; // out handle
  i?: { x: number[]; y: number[] }; // in handle
};

export type LottieShape =
  | LottiePathShape
  | LottieFillShape
  | LottieStrokeShape
  | LottieGradientFillShape
  | LottieTrimShape
  | LottieGroupShape;

export type LottiePathShape = {
  ty: 'sh';
  nm: string;
  ks: {
    a: 0 | 1;
    k: LottieBezier | LottieShapeKeyframe[];
  };
};

export type LottieShapeKeyframe = {
  t: number;
  s: [LottieBezier];
  e?: [LottieBezier];
  o?: { x: number[]; y: number[] };
  i?: { x: number[]; y: number[] };
};

export type LottieBezier = {
  v: number[][]; // vertices
  i: number[][]; // in-tangents (relative to vertex)
  o: number[][]; // out-tangents (relative to vertex)
  c: boolean; // closed
};

export type LottieFillShape = {
  ty: 'fl';
  nm: string;
  c: { a: 0; k: number[] }; // [r, g, b, a] each 0-1
  o: { a: 0; k: number }; // opacity 0-100
};

export type LottieStrokeShape = {
  ty: 'st';
  nm: string;
  c: { a: 0; k: number[] };
  o: { a: 0; k: number };
  w: { a: 0; k: number };
  lc?: number; // linecap: 1=butt, 2=round, 3=square
  lj?: number; // linejoin: 1=miter, 2=round, 3=bevel
};

export type LottieGradientFillShape = {
  ty: 'gf';
  nm: string;
  t: 1 | 2; // 1=linear, 2=radial
  s: { a: 0; k: number[] }; // start point
  e: { a: 0; k: number[] }; // end point
  g: { p: number; k: { a: 0; k: number[] } }; // gradient stops
  o: { a: 0; k: number };
};

export type LottieTrimShape = {
  ty: 'tm';
  nm: string;
  s: LottieAnimatedValue; // start
  e: LottieAnimatedValue; // end
  o: LottieAnimatedValue; // offset
  m: 1 | 2; // 1=simultaneously, 2=individually
};

export type LottieGroupShape = {
  ty: 'gr';
  nm: string;
  it: LottieShape[];
};

// ---------------------------------------------------------------------------
// Export options
// ---------------------------------------------------------------------------

export type LottieExportOptions = {
  /** Frames per second. Default: 60. */
  fps?: number;
  /** Morph quality: number of interpolation steps. */
  morphQuality?: 'low' | 'medium' | 'high' | 'max';
};

// ---------------------------------------------------------------------------
// M1 — Core exporter entry point
// ---------------------------------------------------------------------------

export function exportLottie(
  icon: Icon,
  variantId: string,
  options?: LottieExportOptions,
): LottieJson {
  const fr = options?.fps ?? 60;

  // Resolve variant
  const variant = icon.variants?.[variantId];
  if (!variant) {
    throw new Error(`Variant "${variantId}" not found on icon "${icon.id}".`);
  }

  // Calculate op from longest transition duration, defaulting to 1 second
  const transitions = Object.values(icon.transitions ?? {}).filter(
    (t) => t.fromVariantId === variantId || t.toVariantId === variantId,
  );
  const longestMs = transitions.reduce((max, t) => Math.max(max, t.durationMs), 0);
  const op = longestMs > 0 ? Math.round((longestMs / 1000) * fr) : fr;

  const viewBox = variant.viewBox;

  // Build layers from variant layers (M2)
  const layers = buildShapeLayers(variant, fr, op);

  // Apply transition track animations (M3/M5)
  for (const transition of transitions) {
    const durationFrames = Math.round((transition.durationMs / 1000) * fr);
    for (const binding of transition.layerBindings ?? []) {
      const targetLayer = layers.find((l) => l.nm === binding.fromLayerId);
      if (!targetLayer) continue;

      const tracks = binding.tracks ?? [];
      const trimTracks = tracks.filter(
        (t) => t.property === 'trimStart' || t.property === 'trimEnd' || t.property === 'trimOffset',
      );
      const nonTrimTracks = tracks.filter(
        (t) => t.property !== 'trimStart' && t.property !== 'trimEnd' && t.property !== 'trimOffset',
      );

      // Apply non-trim track animations
      for (const track of nonTrimTracks) {
        applyTrackToLayer(targetLayer, track, 0, durationFrames, fr, transition.easing ?? 'ease-in-out');
      }

      // Apply trim tracks
      if (trimTracks.length > 0) {
        applyTrimShape(
          targetLayer,
          trimTracks,
          binding.compoundTrimMode ?? 'simultaneously',
          0,
          durationFrames,
          fr,
          transition.easing ?? 'ease-in-out',
        );
      }
    }
  }

  // Apply effects (M6)
  const effects = Object.values(icon.effects ?? {});
  for (const effect of effects) {
    applyEffectAnimations(layers, effect, fr);
  }

  return {
    v: '5.12.1',
    fr,
    ip: 0,
    op,
    w: viewBox[2],
    h: viewBox[3],
    nm: icon.name ?? icon.id,
    layers,
    assets: [],
  };
}

// ---------------------------------------------------------------------------
// M2 — Layer geometry → Lottie shape layers
// ---------------------------------------------------------------------------

function buildShapeLayers(
  variant: Variant,
  fr: number,
  op: number,
): LottieLayer[] {
  const layerEntries = Object.entries(variant.layers ?? {});
  return layerEntries.map(([layerId, layer], index) => {
    const shapes: LottieShape[] = [];

    // Path shape
    if (layer.path?.d) {
      shapes.push({
        ty: 'sh',
        nm: `path-${layerId}`,
        ks: {
          a: 0,
          k: svgPathToLottieBezier(layer.path.d),
        },
      });
    }

    // Fill shape
    if (layer.style?.fill) {
      const fillShape = buildFillShape(layer.style.fill, layer.style.fillOpacity);
      if (fillShape) shapes.push(fillShape);
    }

    // Stroke shape
    if (layer.style?.stroke) {
      const strokeShape = buildStrokeShape(layer);
      if (strokeShape) shapes.push(strokeShape);
    }

    return {
      ty: 4, // shape layer
      nm: layerId,
      ind: index,
      ip: 0,
      op,
      st: 0,
      ks: buildStaticTransform(layer),
      shapes,
    };
  });
}

function buildStaticTransform(layer: Layer): LottieTransform {
  const tx = layer.transform?.x ?? 0;
  const ty = layer.transform?.y ?? 0;
  const rot = layer.transform?.rotate ?? 0;
  const sx = (layer.transform?.scaleX ?? 1) * 100;
  const sy = (layer.transform?.scaleY ?? 1) * 100;

  return {
    o: { a: 0, k: (layer.style?.fillOpacity ?? 1) * 100 },
    r: { a: 0, k: rot },
    p: { a: 0, k: [tx, ty, 0] },
    s: { a: 0, k: [sx, sy, 100] },
    a: { a: 0, k: [0, 0, 0] },
  };
}

// ---------------------------------------------------------------------------
// SVG path → Lottie bezier conversion
// ---------------------------------------------------------------------------

export function svgPathToLottieBezier(d: string): LottieBezier {
  const vertices: number[][] = [];
  const inTangents: number[][] = [];
  const outTangents: number[][] = [];
  let closed = false;

  // Parse SVG path commands (expecting normalized cubic-only: M, C, Z)
  const commands = d.match(/[MCLZ][^MCLZ]*/gi) ?? [];

  for (const cmd of commands) {
    const type = cmd[0]!.toUpperCase();
    const nums = cmd
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);

    if (type === 'M') {
      vertices.push([nums[0] ?? 0, nums[1] ?? 0]);
      inTangents.push([0, 0]); // First vertex has no in-tangent
      outTangents.push([0, 0]); // Will be overwritten by next C
    } else if (type === 'C') {
      // C c1x c1y c2x c2y ex ey
      for (let i = 0; i < nums.length; i += 6) {
        const c1x = nums[i] ?? 0;
        const c1y = nums[i + 1] ?? 0;
        const c2x = nums[i + 2] ?? 0;
        const c2y = nums[i + 3] ?? 0;
        const ex = nums[i + 4] ?? 0;
        const ey = nums[i + 5] ?? 0;

        // Out-tangent of previous vertex (relative)
        const prevIdx = vertices.length - 1;
        if (prevIdx >= 0) {
          outTangents[prevIdx] = [
            c1x - (vertices[prevIdx]![0] ?? 0),
            c1y - (vertices[prevIdx]![1] ?? 0),
          ];
        }

        // Add new vertex with in-tangent (relative to new vertex)
        vertices.push([ex, ey]);
        inTangents.push([c2x - ex, c2y - ey]);
        outTangents.push([0, 0]); // May be overwritten by next C
      }
    } else if (type === 'L') {
      // Line segments — zero tangents
      for (let i = 0; i < nums.length; i += 2) {
        vertices.push([nums[i] ?? 0, nums[i + 1] ?? 0]);
        inTangents.push([0, 0]);
        outTangents.push([0, 0]);
      }
    } else if (type === 'Z') {
      closed = true;
    }
  }

  return { v: vertices, i: inTangents, o: outTangents, c: closed };
}

// ---------------------------------------------------------------------------
// Paint shapes (fill, stroke, gradient)
// ---------------------------------------------------------------------------

function buildFillShape(
  paint: PaintRef,
  opacity?: number,
): LottieFillShape | LottieGradientFillShape | null {
  if (paint.mode === 'currentColor' || paint.mode === 'fixed') {
    const color = paint.mode === 'fixed' ? paint.value : '#000000';
    const [r, g, b] = hexToRgb01(color);
    return {
      ty: 'fl',
      nm: 'fill',
      c: { a: 0, k: [r, g, b, 1] },
      o: { a: 0, k: (opacity ?? 1) * 100 },
    };
  }

  if (paint.mode === 'linearGradient') {
    return buildGradientFill(1, paint.stops, paint.angle, opacity);
  }

  if (paint.mode === 'radialGradient') {
    return buildGradientFill(2, paint.stops, 0, opacity);
  }

  return null;
}

function buildGradientFill(
  type: 1 | 2,
  stops: GradientStop[],
  angle: number,
  opacity?: number,
): LottieGradientFillShape {
  // Convert angle to start/end points (normalized 0-1 space)
  const rad = (angle * Math.PI) / 180;
  const sx = 0.5 - Math.cos(rad) * 0.5;
  const sy = 0.5 - Math.sin(rad) * 0.5;
  const ex = 0.5 + Math.cos(rad) * 0.5;
  const ey = 0.5 + Math.sin(rad) * 0.5;

  // Build gradient color data: [offset, r, g, b, ...] flattened
  const colorData: number[] = [];
  for (const stop of stops) {
    const [r, g, b] = hexToRgb01(stop.color);
    colorData.push(stop.offset, r, g, b);
  }

  return {
    ty: 'gf',
    nm: 'gradient-fill',
    t: type,
    s: { a: 0, k: [sx, sy] },
    e: { a: 0, k: [ex, ey] },
    g: { p: stops.length, k: { a: 0, k: colorData } },
    o: { a: 0, k: (opacity ?? 1) * 100 },
  };
}

function buildStrokeShape(layer: Layer): LottieStrokeShape | null {
  const stroke = layer.style?.stroke;
  if (!stroke) return null;

  const color = stroke.mode === 'fixed' ? stroke.value : '#000000';
  const [r, g, b] = hexToRgb01(color);

  const lcMap = { butt: 1, round: 2, square: 3 } as const;
  const ljMap = { miter: 1, round: 2, bevel: 3 } as const;

  return {
    ty: 'st',
    nm: 'stroke',
    c: { a: 0, k: [r, g, b, 1] },
    o: { a: 0, k: (layer.style?.strokeOpacity ?? 1) * 100 },
    w: { a: 0, k: layer.style?.strokeWidth ?? 1 },
    lc: lcMap[layer.style?.lineCap ?? 'butt'] ?? 1,
    lj: ljMap[layer.style?.lineJoin ?? 'miter'] ?? 1,
  };
}

// ---------------------------------------------------------------------------
// M3 — TimelineTrack → Lottie animated properties
// ---------------------------------------------------------------------------

function applyTrackToLayer(
  layer: LottieLayer,
  track: TimelineTrack,
  delayFrames: number,
  durationFrames: number,
  _fr: number,
  easing: string | SpringConfig,
): void {
  const keyframes = track.keyframes as number[];
  if (!keyframes || keyframes.length < 2) return;

  const easingHandles = easingToLottie(easing);
  const frameStep = durationFrames / (keyframes.length - 1);

  switch (track.property) {
    case 'opacity': {
      const kf: LottieKeyframe[] = keyframes.map((v, i) => ({
        t: delayFrames + Math.round(i * frameStep),
        s: [v * 100],
        ...(i < keyframes.length - 1 ? { e: [(keyframes[i + 1] ?? v) * 100] } : {}),
        ...easingHandles,
      }));
      layer.ks.o = { a: 1, k: kf };
      break;
    }
    case 'rotate': {
      const kf: LottieKeyframe[] = keyframes.map((v, i) => ({
        t: delayFrames + Math.round(i * frameStep),
        s: [v],
        ...(i < keyframes.length - 1 ? { e: [keyframes[i + 1] ?? v] } : {}),
        ...easingHandles,
      }));
      layer.ks.r = { a: 1, k: kf };
      break;
    }
    case 'translateX':
    case 'translateY': {
      // Position is combined — need to handle x/y together
      // For now, animate the individual axis
      const currentP = layer.ks.p;
      const baseP = currentP.a === 0 ? (currentP.k as number[]) : [0, 0, 0];
      const isX = track.property === 'translateX';

      const kf: LottieKeyframe[] = keyframes.map((v, i) => ({
        t: delayFrames + Math.round(i * frameStep),
        s: isX ? [v, baseP[1] ?? 0, 0] : [baseP[0] ?? 0, v, 0],
        ...(i < keyframes.length - 1
          ? {
              e: isX
                ? [keyframes[i + 1] ?? v, baseP[1] ?? 0, 0]
                : [baseP[0] ?? 0, keyframes[i + 1] ?? v, 0],
            }
          : {}),
        ...easingHandles,
      }));
      layer.ks.p = { a: 1, k: kf };
      break;
    }
    case 'scale': {
      const kf: LottieKeyframe[] = keyframes.map((v, i) => ({
        t: delayFrames + Math.round(i * frameStep),
        s: [v * 100, v * 100, 100],
        ...(i < keyframes.length - 1
          ? { e: [(keyframes[i + 1] ?? v) * 100, (keyframes[i + 1] ?? v) * 100, 100] }
          : {}),
        ...easingHandles,
      }));
      layer.ks.s = { a: 1, k: kf };
      break;
    }
    // trimStart, trimEnd, trimOffset handled separately by M5
    // fill, stroke, strokeWidth, etc. — simplified for now
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// M4 — Morph keyframes → Lottie shape-path animation
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// M5 — Trim path tracks → Lottie trim shape
// ---------------------------------------------------------------------------

function applyTrimShape(
  layer: LottieLayer,
  trimTracks: TimelineTrack[],
  compoundTrimMode: 'simultaneously' | 'individually',
  delayFrames: number,
  durationFrames: number,
  _fr: number,
  easing: string | SpringConfig,
): void {
  const easingHandles = easingToLottie(easing);

  const makeAnimatedValue = (track: TimelineTrack | undefined): LottieAnimatedValue => {
    if (!track) return { a: 0, k: 0 };
    const keyframes = track.keyframes as number[];
    if (!keyframes || keyframes.length < 2) {
      return { a: 0, k: (keyframes?.[0] ?? 0) * 100 };
    }
    const frameStep = durationFrames / (keyframes.length - 1);
    return {
      a: 1,
      k: keyframes.map((v, i) => ({
        t: delayFrames + Math.round(i * frameStep),
        s: [v * 100],
        ...(i < keyframes.length - 1 ? { e: [(keyframes[i + 1] ?? v) * 100] } : {}),
        ...easingHandles,
      })),
    };
  };

  const trimStart = trimTracks.find((t) => t.property === 'trimStart');
  const trimEnd = trimTracks.find((t) => t.property === 'trimEnd');
  const trimOffset = trimTracks.find((t) => t.property === 'trimOffset');

  const trimShape: LottieTrimShape = {
    ty: 'tm',
    nm: 'trim',
    s: makeAnimatedValue(trimStart),
    e: makeAnimatedValue(trimEnd),
    o: makeAnimatedValue(trimOffset),
    m: compoundTrimMode === 'simultaneously' ? 1 : 2,
  };

  layer.shapes.push(trimShape);
}

// ---------------------------------------------------------------------------
// M6 — Effect kinds → Lottie shape layer animations
// ---------------------------------------------------------------------------

function applyEffectAnimations(
  layers: LottieLayer[],
  effect: Effect,
  fr: number,
): void {
  if (layers.length === 0) return;
  const layer = layers[0]!;
  const durationFrames = Math.round((effect.durationMs / 1000) * fr);
  const delayFrames = Math.round(((effect.delay ?? 0) / 1000) * fr);
  const easingHandles = easingToLottie(effect.easing ?? 'ease-in-out');

  switch (effect.kind) {
    case 'bounce': {
      // Scale oscillation: 1.0 → 1.2 → 1.0
      layer.ks.s = {
        a: 1,
        k: [
          { t: delayFrames, s: [100, 100, 100], e: [120, 120, 100], ...easingHandles },
          { t: delayFrames + Math.round(durationFrames / 2), s: [120, 120, 100], e: [100, 100, 100], ...easingHandles },
          { t: delayFrames + durationFrames, s: [100, 100, 100] },
        ],
      };
      break;
    }
    case 'pulse': {
      // Opacity oscillation: 1.0 → 0.3 → 1.0
      layer.ks.o = {
        a: 1,
        k: [
          { t: delayFrames, s: [100], e: [30], ...easingHandles },
          { t: delayFrames + Math.round(durationFrames / 2), s: [30], e: [100], ...easingHandles },
          { t: delayFrames + durationFrames, s: [100] },
        ],
      };
      break;
    }
    case 'breathe': {
      // Scale breathe: 1.0 → 1.05 → 1.0
      layer.ks.s = {
        a: 1,
        k: [
          { t: delayFrames, s: [100, 100, 100], e: [105, 105, 100], ...easingHandles },
          { t: delayFrames + Math.round(durationFrames / 2), s: [105, 105, 100], e: [100, 100, 100], ...easingHandles },
          { t: delayFrames + durationFrames, s: [100, 100, 100] },
        ],
      };
      break;
    }
    case 'rotate': {
      // Full rotation: 0 → 360
      layer.ks.r = {
        a: 1,
        k: [
          { t: delayFrames, s: [0], e: [360], ...easingHandles },
          { t: delayFrames + durationFrames, s: [360] },
        ],
      };
      break;
    }
    case 'lineDrawOn': {
      // Trim path 0% → 100%
      layer.shapes.push({
        ty: 'tm',
        nm: 'line-draw-on',
        s: { a: 0, k: 0 },
        e: {
          a: 1,
          k: [
            { t: delayFrames, s: [0], e: [100], ...easingHandles },
            { t: delayFrames + durationFrames, s: [100] },
          ],
        },
        o: { a: 0, k: 0 },
        m: 1,
      });
      break;
    }
    case 'lineDrawOff': {
      // Trim path 100% → 0%
      layer.shapes.push({
        ty: 'tm',
        nm: 'line-draw-off',
        s: {
          a: 1,
          k: [
            { t: delayFrames, s: [0], e: [100], ...easingHandles },
            { t: delayFrames + durationFrames, s: [100] },
          ],
        },
        e: { a: 0, k: 100 },
        o: { a: 0, k: 0 },
        m: 1,
      });
      break;
    }
    case 'custom': {
      // Custom effects emit their customTracks as animated properties
      if (effect.customTracks) {
        for (const track of effect.customTracks) {
          applyTrackToLayer(
            layer,
            track,
            delayFrames,
            durationFrames,
            fr,
            effect.easing ?? 'ease-in-out',
          );
        }
      }
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Easing helpers
// ---------------------------------------------------------------------------

const EASING_MAP: Record<string, { o: { x: number[]; y: number[] }; i: { x: number[]; y: number[] } }> = {
  linear: { o: { x: [0], y: [0] }, i: { x: [1], y: [1] } },
  'ease-in': { o: { x: [0.42], y: [0] }, i: { x: [1], y: [1] } },
  'ease-out': { o: { x: [0], y: [0] }, i: { x: [0.58], y: [1] } },
  'ease-in-out': { o: { x: [0.42], y: [0] }, i: { x: [0.58], y: [1] } },
  ease: { o: { x: [0.25], y: [0.1] }, i: { x: [0.25], y: [1] } },
};

export function easingToLottie(
  easing: string | SpringConfig,
): { o?: { x: number[]; y: number[] }; i?: { x: number[]; y: number[] } } {
  if (typeof easing === 'string') {
    // Check for cubic-bezier(x1, y1, x2, y2)
    const cubicMatch = easing.match(
      /cubic-bezier\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/,
    );
    if (cubicMatch) {
      return {
        o: { x: [parseFloat(cubicMatch[1]!)], y: [parseFloat(cubicMatch[2]!)] },
        i: { x: [parseFloat(cubicMatch[3]!)], y: [parseFloat(cubicMatch[4]!)] },
      };
    }
    return EASING_MAP[easing] ?? EASING_MAP['ease-in-out']!;
  }

  // Spring config → approximate as ease-in-out cubic
  // Spring easing doesn't have a direct Lottie equivalent
  return EASING_MAP['ease-in-out']!;
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}
