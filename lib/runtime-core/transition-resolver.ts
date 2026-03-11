import type { Layer, LayerBinding, State, TimelineTrack, Transition } from '../schema';

export type ResolvedLayerBinding = {
  fromLayer?: Layer;
  toLayer?: Layer;
  tracks: TimelineTrack[];
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

  return {
    fromLayer,
    toLayer,
    tracks: strategy === 'track' ? [...(binding.tracks ?? [])] : [],
  };
}
