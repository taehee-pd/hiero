import type {
  Layer,
  LayerBinding,
  SpringConfig,
  State,
  TimelineTrack,
  Transition,
} from '../schema';
import { bestGuessMorph, strictMorph, type MorphInterpolator } from './morph';
import { canonicalizeLayerPath, type CanonicalPath } from './path-normalization';

export type FallbackMode = 'fade-through' | 'scale-through' | 'slide-through' | 'replace-with-delay';
export type AnimationType = 'morph' | 'fade-out' | 'fade-in' | 'scale' | 'translate' | 'rotate' | 'replace';

export type MorphReadiness = {
  score: number;
  commandCompatibility: number;
  subpathCompatibility: number;
  closedCompatibility: number;
  bboxSimilarity: number;
  centroidSimilarity: number;
  semanticRoleMatch: number;
  recommendedStrategy: 'strictMorph' | 'bestGuessMorph' | 'fallback';
  reasons: string[];
};

export type ResolvedLayerBinding = {
  fromLayer?: Layer;
  toLayer?: Layer;
  tracks: TimelineTrack[];
  morph?: MorphInterpolator;
  fallback?: FallbackMode;
  animationType?: AnimationType;
  readiness?: MorphReadiness;
  delayMs?: number;
  durationMs?: number;
  easing?: string | SpringConfig;
  diagnostics?: string[];
  /** When true, this layer is preserved across a Magic Replace transition
   *  and should not be crossfaded or removed/recreated. */
  preserved?: boolean;
};

export type ResolvedTransition = {
  strategy: Transition['strategy'];
  durationMs: number;
  easing: string | SpringConfig;
  layerBindings: ResolvedLayerBinding[];
  diagnostics: string[];
};

export type ResolveTransitionOptions = {
  /** Layer IDs that should be preserved across the transition (Magic Replace). */
  preserveLayerIds?: string[];
};

export function resolveTransition(
  transition: Transition,
  fromState: State,
  toState: State,
  options: ResolveTransitionOptions = {},
): ResolvedTransition {
  const diagnostics: string[] = [];
  const preserveSet = new Set(options.preserveLayerIds ?? []);
  const plannedBindings = resolveBindings(transition, fromState, toState);
  const staggerOrder = computeStaggerOrder(plannedBindings, transition.stagger?.mode);
  const layerBindings = plannedBindings.map((binding, index) => {
    const resolved = resolveLayerBinding(
      binding,
      transition,
      index,
      plannedBindings.length,
      staggerOrder[index] ?? index,
    );
    // Mark preserved layers — skip crossfade/morph, keep stable
    const layerId = resolved.fromLayer?.id ?? resolved.toLayer?.id;
    if (layerId && preserveSet.has(layerId)) {
      resolved.preserved = true;
      resolved.fallback = undefined;
      resolved.morph = undefined;
      resolved.animationType = 'replace';
    }
    return resolved;
  });

  return {
    strategy: transition.strategy,
    durationMs: transition.durationMs,
    easing: transition.easing ?? 'linear',
    layerBindings,
    diagnostics,
  };
}

function resolveBindings(
  transition: Transition,
  fromState: State,
  toState: State,
): Array<LayerBinding & { fromLayer?: Layer; toLayer?: Layer; source: string }> {
  const byFrom = new Map<string, Layer>();
  const byTo = new Map<string, Layer>();
  Object.values(fromState.layers).forEach((layer) => byFrom.set(layer.id, layer));
  Object.values(toState.layers).forEach((layer) => byTo.set(layer.id, layer));

  const resolved: Array<LayerBinding & { fromLayer?: Layer; toLayer?: Layer; source: string }> = [];
  const usedFrom = new Set<string>();
  const usedTo = new Set<string>();

  for (const binding of transition.layerBindings) {
    const fromLayer = binding.fromLayerId ? byFrom.get(binding.fromLayerId) : undefined;
    const toLayer = binding.toLayerId ? byTo.get(binding.toLayerId) : undefined;
    if (fromLayer) usedFrom.add(fromLayer.id);
    if (toLayer) usedTo.add(toLayer.id);
    resolved.push({ ...binding, fromLayer, toLayer, source: 'explicit' });
  }

  const unmatchedFrom = Object.values(fromState.layers).filter((layer) => !usedFrom.has(layer.id));
  const unmatchedTo = Object.values(toState.layers).filter((layer) => !usedTo.has(layer.id));

  while (unmatchedFrom.length > 0 && unmatchedTo.length > 0) {
    const fromLayer = unmatchedFrom.shift()!;
    let bestIndex = -1;
    let bestScore = -1;

    unmatchedTo.forEach((toLayer, index) => {
      const readiness = computeReadiness(fromLayer, toLayer);
      if (readiness.score > bestScore) {
        bestIndex = index;
        bestScore = readiness.score;
      }
    });

    if (bestIndex < 0) {
      resolved.push({ fromLayerId: fromLayer.id, fromLayer, toLayer: undefined, source: 'fallback' });
      continue;
    }

    const matchedTo = unmatchedTo.splice(bestIndex, 1)[0]!;
    resolved.push({ fromLayerId: fromLayer.id, toLayerId: matchedTo.id, fromLayer, toLayer: matchedTo, source: 'semantic-geometry' });
  }

  unmatchedFrom.forEach((layer) => {
    resolved.push({ fromLayerId: layer.id, fromLayer: layer, toLayer: undefined, source: 'fallback' });
  });
  unmatchedTo.forEach((layer) => {
    resolved.push({ toLayerId: layer.id, toLayer: layer, fromLayer: undefined, source: 'fallback' });
  });

  // Sort auto-matched and fallback bindings deterministically, but preserve
  // the authored order of explicit bindings so track keyframes stay aligned
  // with the correct layers.
  const explicit = resolved.filter((b) => b.source === 'explicit');
  const auto = resolved.filter((b) => b.source !== 'explicit');
  auto.sort((a, b) => {
    const aid = `${a.fromLayer?.id ?? ''}|${a.toLayer?.id ?? ''}`;
    const bid = `${b.fromLayer?.id ?? ''}|${b.toLayer?.id ?? ''}`;
    return aid.localeCompare(bid);
  });
  return [...explicit, ...auto];
}

function resolveLayerBinding(
  binding: LayerBinding & { fromLayer?: Layer; toLayer?: Layer; source: string },
  transition: Transition,
  index: number,
  total: number,
  staggerIndex: number,
): ResolvedLayerBinding {
  const fromLayer = binding.fromLayer;
  const toLayer = binding.toLayer;
  const readiness = fromLayer && toLayer ? computeReadiness(fromLayer, toLayer) : undefined;
  const diagnostics = [`bindingSource:${binding.source}`];

  const resolved: ResolvedLayerBinding = {
    fromLayer,
    toLayer,
    tracks: transition.strategy === 'track' ? [...(binding.tracks ?? [])] : [],
    animationType: 'replace',
    readiness,
    delayMs: computeDelay(binding, transition, staggerIndex, total, fromLayer, toLayer),
    durationMs:
      binding.durationMs ??
      Math.max(
        0,
        transition.durationMs -
          computeDelay(binding, transition, staggerIndex, total, fromLayer, toLayer),
      ),
    easing: transition.stagger?.easing ?? transition.easing ?? 'linear',
    diagnostics,
  };

  // Track-strategy bindings with explicit tracks are animated via their track
  // keyframes only. Path morphing would double-animate (morph + CSS transform).
  // The path geometry snaps when setState is called after animation completion.
  if (transition.strategy === 'track' && resolved.tracks.length > 0) {
    resolved.animationType = 'replace';
    return resolved;
  }

  const fromD = fromLayer?.path?.d;
  const toD = toLayer?.path?.d;

  if (!fromD || !toD) {
    resolved.fallback = fromD ? 'fade-through' : 'replace-with-delay';
    resolved.animationType = fromD ? 'fade-out' : 'fade-in';
    return resolved;
  }

  const runtimeStrategy = decideRuntimeStrategy(transition.strategy, readiness);
  diagnostics.push(`runtimeStrategy:${runtimeStrategy}`);

  if (runtimeStrategy === 'strictMorph') {
    try {
      const fromCanonical = canonicalizeLayerPath(fromLayer)!.d;
      const toCanonical = canonicalizeLayerPath(toLayer)!.d;
      resolved.morph = strictMorph(fromCanonical, toCanonical);
      resolved.animationType = 'morph';
      return resolved;
    } catch (error) {
      diagnostics.push(`strictMorphError:${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  if (runtimeStrategy === 'bestGuessMorph') {
    const fromCanonical = canonicalizeLayerPath(fromLayer)!.d;
    const toCanonical = canonicalizeLayerPath(toLayer)!.d;
    resolved.morph = bestGuessMorph(fromCanonical, toCanonical) ?? undefined;
    if (resolved.morph) {
      resolved.animationType = 'morph';
      return resolved;
    }
    diagnostics.push('bestGuessMorphFailed');
  }

  resolved.fallback = chooseFallbackMode(index);
  resolved.animationType = fallbackToAnimationType(resolved.fallback, fromLayer, toLayer);
  return resolved;
}

function decideRuntimeStrategy(
  declared: Transition['strategy'],
  readiness: MorphReadiness | undefined,
): 'strictMorph' | 'bestGuessMorph' | 'fallback' {
  if (!readiness) return 'fallback';
  if (declared === 'replace' || declared === 'track') {
    return readiness.recommendedStrategy;
  }
  if (declared === 'strictMorph' && readiness.commandCompatibility < 1) {
    return readiness.recommendedStrategy;
  }
  if (declared === 'bestGuessMorph' && readiness.score < 0.45) {
    return 'fallback';
  }
  return declared;
}

function computeReadiness(fromLayer: Layer, toLayer: Layer): MorphReadiness {
  const from = canonicalizeLayerPath(fromLayer);
  const to = canonicalizeLayerPath(toLayer);

  if (!from || !to) {
    return {
      score: 0,
      commandCompatibility: 0,
      subpathCompatibility: 0,
      closedCompatibility: 0,
      bboxSimilarity: 0,
      centroidSimilarity: 0,
      semanticRoleMatch: 0,
      recommendedStrategy: 'fallback',
      reasons: ['missing-path'],
    };
  }

  const commandCompatibility = compareSignature(from, to);
  const subpathCompatibility = from.stats.subpathCount === to.stats.subpathCount ? 1 : 0;
  const closedCompatibility = compareBooleans(from.stats.closed, to.stats.closed);
  const bboxSimilarity = compareBBox(from.stats.bbox, to.stats.bbox);
  const centroidSimilarity = compareCentroid(from.stats.centroid, to.stats.centroid, from, to);
  const semanticRoleMatch = fromLayer.role && fromLayer.role === toLayer.role ? 1 : 0;

  const score = clamp01(
    commandCompatibility * 0.3 +
      subpathCompatibility * 0.15 +
      closedCompatibility * 0.15 +
      bboxSimilarity * 0.15 +
      centroidSimilarity * 0.15 +
      semanticRoleMatch * 0.1,
  );

  const reasons: string[] = [];
  if (commandCompatibility < 1) reasons.push('command-mismatch');
  if (subpathCompatibility < 1) reasons.push('subpath-mismatch');
  if (closedCompatibility < 1) reasons.push('closed-open-mismatch');

  let recommendedStrategy: MorphReadiness['recommendedStrategy'] = 'fallback';
  if (
    commandCompatibility === 1 &&
    subpathCompatibility === 1 &&
    closedCompatibility === 1 &&
    bboxSimilarity >= 0.85 &&
    centroidSimilarity >= 0.8
  ) {
    recommendedStrategy = 'strictMorph';
  } else if (
    subpathCompatibility === 1 &&
    commandCompatibility >= 0.8 &&
    centroidSimilarity >= 0.45 &&
    bboxSimilarity >= 0.4
  ) {
    recommendedStrategy = 'bestGuessMorph';
  }

  return {
    score,
    commandCompatibility,
    subpathCompatibility,
    closedCompatibility,
    bboxSimilarity,
    centroidSimilarity,
    semanticRoleMatch,
    recommendedStrategy,
    reasons,
  };
}

function compareSignature(from: CanonicalPath, to: CanonicalPath): number {
  const max = Math.max(from.stats.commandSignature.length, to.stats.commandSignature.length, 1);
  let matches = 0;
  for (let i = 0; i < Math.min(from.stats.commandSignature.length, to.stats.commandSignature.length); i += 1) {
    if (from.stats.commandSignature[i] === to.stats.commandSignature[i]) {
      matches += 1;
    }
  }
  return matches / max;
}

function compareBooleans(a: boolean[], b: boolean[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const max = Math.max(a.length, b.length, 1);
  let matches = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (a[i] === b[i]) matches += 1;
  }
  return matches / max;
}

function compareBBox(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
): number {
  const aw = Math.max(a.maxX - a.minX, 1e-4);
  const ah = Math.max(a.maxY - a.minY, 1e-4);
  const bw = Math.max(b.maxX - b.minX, 1e-4);
  const bh = Math.max(b.maxY - b.minY, 1e-4);
  return clamp01(1 - (Math.abs(aw - bw) / Math.max(aw, bw) + Math.abs(ah - bh) / Math.max(ah, bh)) / 2);
}

function compareCentroid(
  a: { x: number; y: number },
  b: { x: number; y: number },
  from: CanonicalPath,
  to: CanonicalPath,
): number {
  const maxSpan = Math.max(
    from.stats.bbox.maxX - from.stats.bbox.minX,
    from.stats.bbox.maxY - from.stats.bbox.minY,
    to.stats.bbox.maxX - to.stats.bbox.minX,
    to.stats.bbox.maxY - to.stats.bbox.minY,
    1,
  );
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  return clamp01(1 - distance / maxSpan);
}

function chooseFallbackMode(index: number): FallbackMode {
  const modes: FallbackMode[] = ['fade-through', 'scale-through', 'slide-through', 'replace-with-delay'];
  return modes[index % modes.length]!;
}

function fallbackToAnimationType(
  mode: FallbackMode,
  fromLayer: Layer | undefined,
  toLayer: Layer | undefined,
): AnimationType {
  if (!toLayer) return 'fade-out';
  if (!fromLayer) return 'fade-in';
  if (mode === 'scale-through') return 'scale';
  if (mode === 'slide-through') return 'translate';
  return 'replace';
}

function computeDelay(
  binding: LayerBinding,
  transition: Transition,
  staggerIndex: number,
  total: number,
  fromLayer: Layer | undefined,
  toLayer: Layer | undefined,
): number {
  if (binding.delayMs !== undefined) {
    return Math.max(0, binding.delayMs);
  }

  if (transition.stagger) {
    return Math.max(0, staggerIndex * transition.stagger.perLayerMs);
  }

  if (transition.strategy === 'track') {
    return 0;
  }

  const role = toLayer?.role ?? fromLayer?.role;
  if (!fromLayer && toLayer) {
    return Math.max(0, total - staggerIndex) * 12;
  }
  if (fromLayer && !toLayer) {
    return 0;
  }
  if (role === 'primary') return 0;
  if (role === 'secondary') return 24;
  return 16 + staggerIndex * 8;
}

function computeStaggerOrder(
  bindings: Array<LayerBinding & { fromLayer?: Layer; toLayer?: Layer; source: string }>,
  mode: Transition['stagger'] extends infer T
    ? T extends { mode: infer Mode }
      ? Mode
      : never
    : never = 'linear',
): number[] {
  const baseOrder = bindings.map((_, index) => index);
  switch (mode) {
    case 'from-center':
      return [...baseOrder].sort((left, right) => {
        const center = (bindings.length - 1) / 2;
        return Math.abs(left - center) - Math.abs(right - center) || left - right;
      });
    case 'from-edges':
      return [...baseOrder].sort((left, right) => {
        const edgeDistanceLeft = Math.min(left, bindings.length - 1 - left);
        const edgeDistanceRight = Math.min(right, bindings.length - 1 - right);
        return edgeDistanceLeft - edgeDistanceRight || left - right;
      });
    case 'random':
      return [...baseOrder].sort((left, right) => {
        const leftId = bindings[left]?.toLayer?.id ?? bindings[left]?.fromLayer?.id ?? String(left);
        const rightId = bindings[right]?.toLayer?.id ?? bindings[right]?.fromLayer?.id ?? String(right);
        return hashString(leftId) - hashString(rightId);
      });
    case 'linear':
    default:
      return baseOrder;
  }
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
