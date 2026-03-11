import type { Icon } from '../schema';
import {
  StateMachine,
  TransitionScheduler,
  resolveTransition,
  type InterpolatedValues,
} from '../runtime-core';
import { DomRenderer } from './renderer';

export type IconDriver = {
  transitionTo: (stateId: string) => void;
  getCurrentState: () => string;
  destroy: () => void;
};

export type CreateIconDriverOptions = {
  initialState?: string;
  size?: number;
};

export function createIconDriver(
  container: HTMLElement,
  icon: Icon,
  variantId: string,
  options: CreateIconDriverOptions = {},
): IconDriver {
  const renderer = new DomRenderer(container, icon);
  const stateMachine = new StateMachine(icon, variantId);
  renderer.mount(variantId, options.size);

  if (options.initialState && options.initialState !== stateMachine.currentState.id) {
    stateMachine.transitionTo(options.initialState);
  }
  renderer.setState(stateMachine.currentState.id);

  let activeScheduler: TransitionScheduler | null = null;

  const unsubscribe = stateMachine.onStateChange((state, transition) => {
    activeScheduler?.cancel();
    activeScheduler = null;

    if (!transition) {
      renderer.setState(state.id);
      return;
    }

    const variant = icon.variants[variantId];
    const fromState = variant.states[transition.from];
    const toState = variant.states[transition.to];
    if (!fromState || !toState) {
      renderer.setState(state.id);
      return;
    }

    const resolved = resolveTransition(transition, fromState, toState);
    const scheduler = new TransitionScheduler(resolved, {
      onFrame: (_progress, interpolatedValues: InterpolatedValues) => {
        renderer.applyFrame(state.id, interpolatedValues);
      },
    });

    scheduler.onComplete(() => {
      if (activeScheduler === scheduler) {
        activeScheduler = null;
      }
      renderer.setState(state.id);
    });

    activeScheduler = scheduler;
    scheduler.start();
  });

  return {
    transitionTo(stateId: string) {
      stateMachine.transitionTo(stateId);
    },
    getCurrentState() {
      return stateMachine.currentState.id;
    },
    destroy() {
      activeScheduler?.cancel();
      activeScheduler = null;
      unsubscribe();
      stateMachine.dispose();
      renderer.unmount();
    },
  };
}
