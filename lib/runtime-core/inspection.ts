import type { State, Transition } from '../schema';
import { resolveTransition } from './transition-resolver';

export type TransitionInspection = {
  transitionId: string;
  strategy: Transition['strategy'];
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
  transition: Transition,
  fromState: State,
  toState: State,
): TransitionInspection {
  const resolved = resolveTransition(transition, fromState, toState);
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
      diagnostics: binding.diagnostics,
    })),
  };
}
