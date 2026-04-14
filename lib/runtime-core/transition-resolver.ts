import type {
  Layer,
  LayerBinding,
  LayerSnapshot,
  SpringConfig,
  TimelineTrack,
  TransitionStagger,
} from '../schema';
import { attemptCrossIconMorph, bestGuessMorph, strictMorph, type MorphInterpolator } from './morph';
import { autoMorph } from './auto-morph';
import { canonicalizeLayerPath, type CanonicalPath } from './path-normalization';
import { analyzeTopologyCompatibility, type TopologyAnalysis } from './topology-detection';

/**
 * Local transition configuration accepted by the resolver.
 * Replaces the removed `Transition` schema type.
 */
export type TransitionConfig = {
  id?: string;
  strategy: 'auto' | 'strictMorph' | 'bestGuessMorph' | 'crossIconMorph' | 'lineAnimation' | 'replace';
  durationMs: number;
  easing?: string | SpringConfig;
  direction?: 'downUp' | 'upUp' | 'offUp' | 'automatic';
  layerBindings?: LayerBinding[];
  stagger?: TransitionStagger;
};

export type CrossIconContext = {
  sourceIconId: string;
  sourceVariantId: string;
  targetIconId: string;
  targetVariantId: string;
};

export type FallbackMode = 'fade-through' | 'scale-through' | 'slide-through' | 'replace-with-delay';
export type AnimationType = 'morph' | 'trim' | 'fade-out' | 'fade-in' | 'scale' | 'translate' | 'rotate' | 'replace';

export type MorphReadiness = {
  score: number;
  commandCompatibility: number;
  subpathCompatibility: number;
  closedCompatibility: number;
  bboxSimilarity: number;
  centroidSimilarity: number;
  semanticRoleMatch: number;
  recommendedStrategy: 'strictMorph' | 'bestGuessMorph' | 'crossIconMorph' | 'fallback';
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
  strategy: TransitionConfig['strategy'];
  durationMs: number;
  easing: string | SpringConfig;
  layerBindings: ResolvedLayerBinding[];
  diagnostics: string[];
  topologyAnalysis?: TopologyAnalysis;
  /** Directional slide+fade for replace transitions. */
  direction?: TransitionConfig['direction'];
};

export type ResolveTransitionOptions = {
  /** Layer IDs that should be preserved across the transition (Magic Replace). */
  preserveLayerIds?: string[];
  /** When provided, the transition spans two different icons rather than two
   *  states within the same icon/variant. Layer matching switches from ID-based
   *  equality to semantic matching (role, name, path similarity). */
  crossIconContext?: CrossIconContext;
};

export function resolveTransition(
  transition: TransitionConfig,
  fromSnapshot: LayerSnapshot,
  toSnapshot: LayerSnapshot,
  options: ResolveTransitionOptions = {},
): ResolvedTransition {
  const diagnostics: string[] = [];
  const preserveSet = new Set(options.preserveLayerIds ?? []);
  const crossIconContext = options.crossIconContext;

  // Determine whether the source and target are from different icons.
  const isCrossIcon = crossIconContext
    ? crossIconContext.sourceIconId !== crossIconContext.targetIconId
    : false;

  if (isCrossIcon) {
    diagnostics.push('crossIcon:true');
  }

  // 8.3 — Run topology detection BEFORE resolving individual layer bindings.
  // When topology is incompatible the analysis recommends 'crossfade' or
  // 'draw-crossfade', which we propagate to bindings that would otherwise
  // attempt a morph.
  const topologyAnalysis = analyzeTopologyCompatibility(fromSnapshot, toSnapshot);
  if (!topologyAnalysis.compatible) {
    diagnostics.push(`topologyIncompatible:${topologyAnalysis.incompatibilities.join(',')}`);
    diagnostics.push(`topologyRecommended:${topologyAnalysis.recommendedStrategy}`);
  }

  const plannedBindings = resolveBindings(transition, fromSnapshot, toSnapshot, isCrossIcon);
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

    // 8.3 — When topology is incompatible, override morph bindings with
    // the appropriate crossfade strategy so geometry never deforms
    // across incompatible topologies.
    //
    // However, subpath-count-mismatch alone should NOT prevent morphing
    // because the cross-icon morph pipeline handles differing sub-path
    // counts via sub-path matching, De Casteljau subdivision, and
    // centroid collapse.  Only override when there are "hard"
    // incompatibilities (closed/open mismatch, fill-mode change, etc.).
    const hardIncompatibilities = topologyAnalysis.incompatibilities.filter(
      (i) => i !== 'subpath-count-mismatch',
    );
    if (
      hardIncompatibilities.length > 0 &&
      !resolved.preserved &&
      resolved.animationType === 'morph'
    ) {
      resolved.morph = undefined;
      if (topologyAnalysis.recommendedStrategy === 'draw-crossfade') {
        resolved.fallback = 'fade-through';
        resolved.animationType = 'replace';
        resolved.diagnostics?.push('topologyOverride:draw-crossfade');
      } else {
        resolved.fallback = 'fade-through';
        resolved.animationType = 'replace';
        resolved.diagnostics?.push('topologyOverride:crossfade');
      }
    }

    return resolved;
  });

  return {
    strategy: transition.strategy,
    durationMs: computeResolvedTransitionDuration(transition, layerBindings),
    easing: transition.easing ?? 'linear',
    layerBindings,
    diagnostics,
    topologyAnalysis,
    direction: transition.direction,
  };
}

function computeResolvedTransitionDuration(
  transition: TransitionConfig,
  layerBindings: ResolvedLayerBinding[],
): number {
  const configuredDuration = Math.max(0, transition.durationMs);
  const lastBindingEnd = layerBindings.reduce((maxEnd, binding) => {
    const delay = Math.max(0, binding.delayMs ?? 0);
    const duration = Math.max(0, binding.durationMs ?? 0);
    return Math.max(maxEnd, delay + duration);
  }, 0);
  return Math.max(configuredDuration, lastBindingEnd);
}

function resolveBindings(
  transition: TransitionConfig,
  fromSnapshot: LayerSnapshot,
  toSnapshot: LayerSnapshot,
  isCrossIcon = false,
): Array<LayerBinding & { fromLayer?: Layer; toLayer?: Layer; source: string }> {
  const byFrom = new Map<string, Layer>();
  const byTo = new Map<string, Layer>();
  Object.values(fromSnapshot.layers).forEach((layer) => byFrom.set(layer.id, layer));
  Object.values(toSnapshot.layers).forEach((layer) => byTo.set(layer.id, layer));

  const resolved: Array<LayerBinding & { fromLayer?: Layer; toLayer?: Layer; source: string }> = [];
  const usedFrom = new Set<string>();
  const usedTo = new Set<string>();

  // Honour explicit author-defined bindings regardless of mode.
  for (const binding of transition.layerBindings ?? []) {
    const fromLayer = binding.fromLayerId ? byFrom.get(binding.fromLayerId) : undefined;
    const toLayer = binding.toLayerId ? byTo.get(binding.toLayerId) : undefined;
    if (fromLayer) usedFrom.add(fromLayer.id);
    if (toLayer) usedTo.add(toLayer.id);
    resolved.push({ ...binding, fromLayer, toLayer, source: 'explicit' });
  }

  // When layerBindings is a non-empty array the author has explicitly chosen which
  // layers to morph. Skip auto-matching for the remaining unbound layers so the
  // author's selection is honoured — those layers will snap (replace behaviour).
  // An empty [] or undefined both fall through to automatic id-matching below.
  if (transition.layerBindings !== undefined && transition.layerBindings.length > 0) {
    // Still register unmatched layers as replace-only entries so the renderer
    // knows which layers to display in the target state.
    Object.values(fromSnapshot.layers).filter((l) => !usedFrom.has(l.id)).forEach((layer) => {
      resolved.push({ fromLayerId: layer.id, fromLayer: layer, toLayer: undefined, source: 'explicit-unmatched' });
    });
    Object.values(toSnapshot.layers).filter((l) => !usedTo.has(l.id)).forEach((layer) => {
      resolved.push({ toLayerId: layer.id, toLayer: layer, fromLayer: undefined, source: 'explicit-unmatched' });
    });
    return resolved;
  }

  const unmatchedFrom = Object.values(fromSnapshot.layers).filter((layer) => !usedFrom.has(layer.id));
  const unmatchedTo = Object.values(toSnapshot.layers).filter((layer) => !usedTo.has(layer.id));

  if (isCrossIcon) {
    // Cross-icon matching: layers come from different icons so IDs will never
    // coincide.  Use a multi-pass semantic strategy:
    //   1. Match by role (primary/secondary/tertiary)
    //   2. Match by name equality (layer id serves as name)
    //   3. Match remaining layers by best geometry/readiness score

    // Pass 1 — role-based matching
    matchLayersByPredicate(unmatchedFrom, unmatchedTo, resolved, (from, to) => {
      if (from.role && from.role === to.role) return 1;
      return -1;
    }, 'semantic-role');

    // Pass 2 — name-based matching (layer id is the semantic name)
    matchLayersByPredicate(unmatchedFrom, unmatchedTo, resolved, (from, to) => {
      if (from.id === to.id) return 1;
      return -1;
    }, 'semantic-name');

    // Pass 3 — geometry/readiness scoring for remaining unmatched layers
    matchLayersByReadiness(unmatchedFrom, unmatchedTo, resolved, 'semantic-geometry-cross');
  } else {
    // Same-icon matching: rely on readiness score (existing behaviour).
    matchLayersByReadiness(unmatchedFrom, unmatchedTo, resolved, 'semantic-geometry');
  }

  // Any layers still unmatched become standalone fade-in / fade-out entries.
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

/**
 * Match layers using a caller-supplied scoring predicate.
 * A predicate returning a score >= 0 indicates a valid match; -1 means no match.
 * Matched layers are removed from the `from` and `to` arrays in-place.
 */
function matchLayersByPredicate(
  from: Layer[],
  to: Layer[],
  out: Array<LayerBinding & { fromLayer?: Layer; toLayer?: Layer; source: string }>,
  predicate: (from: Layer, to: Layer) => number,
  source: string,
): void {
  // Iterate backwards so splice indices remain stable.
  for (let fi = from.length - 1; fi >= 0; fi--) {
    const fromLayer = from[fi]!;
    let bestIndex = -1;
    let bestScore = -1;
    for (let ti = 0; ti < to.length; ti++) {
      const score = predicate(fromLayer, to[ti]!);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = ti;
      }
    }
    if (bestIndex >= 0) {
      const matchedTo = to.splice(bestIndex, 1)[0]!;
      from.splice(fi, 1);
      out.push({
        fromLayerId: fromLayer.id,
        toLayerId: matchedTo.id,
        fromLayer,
        toLayer: matchedTo,
        source,
      });
    }
  }
}

/**
 * Match remaining layers using the full morph-readiness score.
 * Greedy assignment: repeatedly pick the highest-scoring (from, to) pair.
 * Matched layers are removed from the `from` and `to` arrays in-place.
 */
function matchLayersByReadiness(
  from: Layer[],
  to: Layer[],
  out: Array<LayerBinding & { fromLayer?: Layer; toLayer?: Layer; source: string }>,
  source: string,
): void {
  while (from.length > 0 && to.length > 0) {
    let bestFi = -1;
    let bestTi = -1;
    let bestScore = -1;

    for (let fi = 0; fi < from.length; fi++) {
      for (let ti = 0; ti < to.length; ti++) {
        const readiness = computeReadiness(from[fi]!, to[ti]!);
        if (readiness.score > bestScore) {
          bestScore = readiness.score;
          bestFi = fi;
          bestTi = ti;
        }
      }
    }

    if (bestFi < 0 || bestTi < 0) {
      // No viable pair found — remaining layers become fallbacks.
      break;
    }

    const fromLayer = from.splice(bestFi, 1)[0]!;
    // After splicing `from`, adjust `bestTi` is not needed because `to` is independent.
    const matchedTo = to.splice(bestTi, 1)[0]!;
    out.push({
      fromLayerId: fromLayer.id,
      toLayerId: matchedTo.id,
      fromLayer,
      toLayer: matchedTo,
      source,
    });
  }
}

function resolveLayerBinding(
  binding: LayerBinding & { fromLayer?: Layer; toLayer?: Layer; source: string },
  transition: TransitionConfig,
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
    tracks: transition.strategy === 'lineAnimation' ? [...(binding.tracks ?? [])] : [],
    animationType: 'replace',
    readiness,
    delayMs: computeDelay(binding, transition, staggerIndex, total, fromLayer, toLayer),
    durationMs:
      binding.durationMs ??
      (transition.stagger?.mode === 'individually'
        ? transition.durationMs
        : Math.max(
            0,
            transition.durationMs -
              computeDelay(binding, transition, staggerIndex, total, fromLayer, toLayer),
          )),
    easing: transition.stagger?.easing ?? transition.easing ?? 'linear',
    diagnostics,
  };

  // lineAnimation-strategy bindings with explicit tracks are animated via their
  // track keyframes only. Path morphing would double-animate (morph + CSS transform).
  // The path geometry snaps when setState is called after animation completion.
  if (transition.strategy === 'lineAnimation' && resolved.tracks.length > 0) {
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

  // Auto morph: bypass the old cascade and use the unified algorithm
  if (transition.strategy === 'auto') {
    const fromCanonical = canonicalizeLayerPath(fromLayer)!.d;
    const toCanonical = canonicalizeLayerPath(toLayer)!.d;
    const result = autoMorph(fromCanonical, toCanonical);
    if (result) {
      resolved.morph = result.interpolator;
      resolved.animationType = 'morph';
      diagnostics.push(`autoMorph:${result.selectedStrategy}`);
      return resolved;
    }
    // autoMorph returned null — fall through to standard fallback
    resolved.fallback = chooseFallbackMode(index);
    resolved.animationType = fallbackToAnimationType(resolved.fallback, fromLayer, toLayer);
    diagnostics.push('autoMorphFailed');
    return resolved;
  }

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

  // 8.2 — Third-tier fallback: cross-icon morph.
  // When both strict and bestGuess morph fail (or when the runtime strategy
  // is explicitly 'crossIconMorph'), attempt the cross-icon morph pipeline
  // which handles differing sub-path counts via sub-path matching,
  // De Casteljau subdivision, and centroid collapse.
  if (runtimeStrategy === 'crossIconMorph' || runtimeStrategy === 'bestGuessMorph' || runtimeStrategy === 'fallback') {
    try {
      const fromCanonical = canonicalizeLayerPath(fromLayer)!.d;
      const toCanonical = canonicalizeLayerPath(toLayer)!.d;
      const crossMorph = attemptCrossIconMorph(fromCanonical, toCanonical);
      if (crossMorph) {
        resolved.morph = crossMorph;
        resolved.animationType = 'morph';
        diagnostics.push('crossIconMorphUsed');
        return resolved;
      }
      diagnostics.push('crossIconMorphFailed');
    } catch (error) {
      diagnostics.push(`crossIconMorphError:${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  resolved.fallback = chooseFallbackMode(index);
  resolved.animationType = fallbackToAnimationType(resolved.fallback, fromLayer, toLayer);
  return resolved;
}

function decideRuntimeStrategy(
  declared: TransitionConfig['strategy'],
  readiness: MorphReadiness | undefined,
): 'strictMorph' | 'bestGuessMorph' | 'crossIconMorph' | 'fallback' {
  if (!readiness) return 'fallback';
  // 'auto' strategy: use the readiness-recommended strategy directly
  if (declared === 'auto') {
    return readiness.recommendedStrategy ?? 'fallback';
  }
  if (declared === 'replace' || declared === 'lineAnimation') {
    // These strategies explicitly opt out of morphing — never silently upgrade them.
    return 'fallback';
  }
  if (declared === 'strictMorph' && readiness.commandCompatibility < 1) {
    return readiness.recommendedStrategy;
  }
  if (declared === 'bestGuessMorph' && readiness.score < 0.3) {
    // Even when the score is too low for bestGuessMorph proper, keep
    // trying via the cross-icon pipeline rather than dropping to a
    // crossfade — the engines themselves return null on truly hopeless
    // pairs and the resolver picks up the real fallback there.
    return 'crossIconMorph';
  }
  // When crossIconMorph is explicitly declared, always use it —
  // no readiness gate. The pipeline handles any sub-path topology.
  if (declared === 'crossIconMorph') {
    return 'crossIconMorph';
  }
  return declared;
}

export function computeReadiness(fromLayer: Layer, toLayer: Layer): MorphReadiness {
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
  // Graded similarity rather than binary equality: a 3-vs-4 sub-path pair
  // is much closer to morphable than a 1-vs-10 pair, but the previous
  // `=== ? 1 : 0` collapsed both to 0 and forced fallback. The morph
  // engines (alignCubicPaths) handle differing counts internally.
  const subpathCompatibility = (() => {
    const a = from.stats.subpathCount;
    const b = to.stats.subpathCount;
    if (a === 0 && b === 0) return 1;
    if (a === 0 || b === 0) return 0;
    return Math.min(a, b) / Math.max(a, b);
  })();
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

  // Thresholds relaxed 2026-04-14: the previous gates demanded near-exact
  // command/subpath/closed parity for any morph-class strategy, which
  // forced almost every transition through chooseFallbackMode (crossfade).
  // The actual morph engines tolerate far more variation than the
  // resolver was admitting; let them do their job.
  let recommendedStrategy: MorphReadiness['recommendedStrategy'] = 'crossIconMorph';
  if (
    commandCompatibility === 1 &&
    subpathCompatibility === 1 &&
    closedCompatibility === 1 &&
    bboxSimilarity >= 0.7 &&
    centroidSimilarity >= 0.65
  ) {
    recommendedStrategy = 'strictMorph';
  } else if (
    subpathCompatibility >= 0.5 &&
    commandCompatibility >= 0.55 &&
    centroidSimilarity >= 0.25 &&
    bboxSimilarity >= 0.25
  ) {
    recommendedStrategy = 'bestGuessMorph';
  }
  // Default tier (centroidSimilarity below the bestGuess gate) is
  // crossIconMorph rather than fallback — the cross-icon pipeline is the
  // catch-all and only fails for genuinely unparseable pairs, in which
  // case the resolver downstream still falls through to a real fallback.

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
  transition: TransitionConfig,
  staggerIndex: number,
  total: number,
  fromLayer: Layer | undefined,
  toLayer: Layer | undefined,
): number {
  if (binding.delayMs !== undefined) {
    return Math.max(0, binding.delayMs);
  }

  if (transition.stagger) {
    if (transition.stagger.mode === 'simultaneous') {
      // "Whole Symbol" — every layer starts at t=0. perLayerMs is ignored.
      return 0;
    }
    if (transition.stagger.mode === 'individually') {
      // Each layer completes its full animation before the next begins.
      // Use the binding's own duration (or the transition's duration) as the interval.
      const layerDuration = binding.durationMs ?? transition.durationMs;
      return Math.max(0, staggerIndex * layerDuration);
    }
    return Math.max(0, staggerIndex * transition.stagger.perLayerMs);
  }

  if (transition.strategy === 'lineAnimation') {
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
  mode: TransitionStagger['mode'] | undefined = 'linear',
): number[] {
  const baseOrder = bindings.map((_, index) => index);
  const sequence = (() => {
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
      case 'simultaneous':
      case 'individually':
      case 'linear':
      default:
        return baseOrder;
    }
  })();

  const orderByBindingIndex = new Array(bindings.length).fill(0);
  sequence.forEach((bindingIndex, order) => {
    orderByBindingIndex[bindingIndex] = order;
  });
  return orderByBindingIndex;
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
