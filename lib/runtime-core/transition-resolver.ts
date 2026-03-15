import type { Layer, LayerBinding, State, TimelineTrack, Transition } from '../schema';
import { bestGuessMorph, strictMorph, type MorphInterpolator } from './morph';

export type ResolvedLayerBinding = {
  fromLayer?: Layer;
  toLayer?: Layer;
  tracks: TimelineTrack[];
  morph?: MorphInterpolator;
  fallback?: 'crossfade';
};

export type ResolvedTransition = {
  strategy: Transition['strategy'];
  durationMs: number;
  easing: string;
  layerBindings: ResolvedLayerBinding[];
};

export function resolveTransition(
  transition: Transition,
  fromState: State,
  toState: State,
): ResolvedTransition {
  return {
    strategy: transition.strategy,
    durationMs: transition.durationMs,
    easing: transition.easing ?? 'linear',
    layerBindings: transition.layerBindings.map((binding) =>
      resolveLayerBinding(binding, fromState, toState, transition.strategy),
    ),
  };
}

function resolveLayerBinding(
  binding: LayerBinding,
  fromState: State,
  toState: State,
  strategy: Transition['strategy'],
): ResolvedLayerBinding {
  const fromLayer = binding.fromLayerId ? fromState.layers[binding.fromLayerId] : undefined;
  const toLayer = binding.toLayerId ? toState.layers[binding.toLayerId] : undefined;
  const resolved: ResolvedLayerBinding = {
    fromLayer,
    toLayer,
    tracks: strategy === 'track' ? [...(binding.tracks ?? [])] : [],
  };

  const fromD = fromLayer?.path?.d;
  const toD = toLayer?.path?.d;
  if (!fromD || !toD) {
    return resolved;
  }

  if (strategy === 'strictMorph') {
    resolved.morph = strictMorph(fromD, toD);
  }

  if (strategy === 'bestGuessMorph') {
    resolved.morph = bestGuessMorph(fromD, toD) ?? undefined;
    if (!resolved.morph) {
      resolved.fallback = 'crossfade';
    }
  }

  return resolved;
}
