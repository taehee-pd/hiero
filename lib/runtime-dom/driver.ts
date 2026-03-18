import type { Icon } from '../schema';
import {
  StateMachine,
  TransitionScheduler,
  EffectScheduler,
  resolveTransition,
  computeVariableDrawValues,
  shouldReduceMotion,
  type InterpolatedValues,
  type DrawAnnotation,
  type VariableDrawConfig,
  type EffectDefinition,
} from '../runtime-core';
import { DomRenderer } from './renderer';

export type IconDriverStateListener = () => void;

export type IconDriver = {
  transitionTo: (stateId: string) => void;
  getCurrentState: () => string;
  /** Subscribe to state changes. Returns an unsubscribe function.
   *  Compatible with React's useSyncExternalStore. */
  subscribe: (listener: IconDriverStateListener) => () => void;
  /** Trigger a named effect. Requires effect definitions and optionally draw annotations. */
  triggerEffect: (effectId: string) => void;
  /** Set Variable Draw progress (0-1). Requires variableDraw config. */
  setVariableDrawProgress: (progress: number) => void;
  destroy: () => void;
};

export type CreateIconDriverOptions = {
  initialState?: string;
  size?: number;
  /** Accessible label. Sets role="img" + aria-label. Omit for decorative icons. */
  label?: string;
  /** Motion preference: true=always skip, false=always animate, 'system'=respect OS setting. */
  reduceMotion?: boolean | 'system';
  /** Pre-existing SVG element to attach to (for SSR hydration). */
  existingSvg?: SVGSVGElement;
  /** Effect definitions keyed by effect ID. */
  effects?: Record<string, EffectDefinition>;
  /** Draw annotation for lineDrawOn/Off effects. */
  drawAnnotation?: DrawAnnotation;
  /** Variable Draw configuration. */
  variableDraw?: VariableDrawConfig;
  /** Layer IDs preserved across Magic Replace transitions. */
  preserveLayerIds?: string[];
};

export function createIconDriver(
  container: HTMLElement,
  icon: Icon,
  variantId: string,
  options: CreateIconDriverOptions = {},
): IconDriver {
  const renderer = new DomRenderer(container, icon);
  const stateMachine = new StateMachine(icon, variantId);
  const reduceMotionSetting = options.reduceMotion ?? 'system';
  renderer.mount(variantId, options.size, {
    label: options.label,
    existingSvg: options.existingSvg,
  });

  if (options.initialState && options.initialState !== stateMachine.currentState.id) {
    stateMachine.transitionTo(options.initialState);
  }
  renderer.setState(stateMachine.currentState.id);

  let activeScheduler: TransitionScheduler | null = null;
  let activeEffectScheduler: EffectScheduler | null = null;
  const stateListeners = new Set<IconDriverStateListener>();

  function notifyStateListeners() {
    for (const listener of stateListeners) {
      listener();
    }
  }

  const unsubscribe = stateMachine.onStateChange((state, transition) => {
    activeScheduler?.cancel();
    activeScheduler = null;
    notifyStateListeners();

    if (!transition || shouldReduceMotion(reduceMotionSetting)) {
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

    const resolved = resolveTransition(transition, fromState, toState, {
      preserveLayerIds: options.preserveLayerIds,
    });
    const scheduler = new TransitionScheduler(resolved, {
      onFrame: (progress, interpolatedValues: InterpolatedValues) => {
        renderer.applyFrame(state.id, progress, interpolatedValues, resolved);
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
    subscribe(listener: IconDriverStateListener) {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
    triggerEffect(effectId: string) {
      const effect = options.effects?.[effectId];
      if (!effect || shouldReduceMotion(reduceMotionSetting)) return;

      activeEffectScheduler?.cancel();

      // Determine target layer IDs from the current state
      const currentState = stateMachine.currentState;
      const layerIds = Object.keys(currentState.layers).sort();

      activeEffectScheduler = new EffectScheduler(effect, {
        onFrame: (values) => {
          renderer.applyFrame(
            currentState.id,
            0,
            values,
          );
        },
        drawAnnotation: options.drawAnnotation,
        targetLayerIds: layerIds,
      });

      activeEffectScheduler.onComplete(() => {
        activeEffectScheduler = null;
      });

      activeEffectScheduler.start();
    },
    setVariableDrawProgress(progress: number) {
      if (!options.variableDraw) return;
      const values = computeVariableDrawValues(options.variableDraw, progress);
      renderer.applyFrame(stateMachine.currentState.id, 0, values);
    },
    destroy() {
      activeScheduler?.cancel();
      activeScheduler = null;
      activeEffectScheduler?.cancel();
      activeEffectScheduler = null;
      stateListeners.clear();
      unsubscribe();
      stateMachine.dispose();
      renderer.unmount();
    },
  };
}
