import type { LayerSnapshot } from '../schema';
import { resolveTransition, type TransitionConfig } from './transition-resolver';

export type TransitionInspection = {
  transitionId?: string;
  strategy: TransitionConfig['strategy'];
  bindings: Array<{
    fromLayerId?: string;
    toLayerId?: string;
    readinessScore?: number;
    recommendedStrategy?: string;
    runtimeFallback?: string;
    diagnostics: string[];
  }>;
  diagnostics: string[];
};

export function inspectTransitionPlan(
  transition: TransitionConfig,
  fromSnapshot: LayerSnapshot,
  toSnapshot: LayerSnapshot,
): TransitionInspection {
  const resolved = resolveTransition(transition, fromSnapshot, toSnapshot);
  return {
    transitionId: transition.id,
    strategy: transition.strategy,
    diagnostics: resolved.diagnostics,
    bindings: resolved.layerBindings.map((binding) => ({
      fromLayerId: binding.fromLayer?.id,
      toLayerId: binding.toLayer?.id,
      readinessScore: binding.readiness?.score,
      recommendedStrategy: binding.readiness?.recommendedStrategy,
      runtimeFallback: binding.fallback,
      diagnostics: binding.diagnostics ?? [],
    })),
  };
}
