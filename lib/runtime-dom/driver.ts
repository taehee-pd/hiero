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
import { composeValues } from '../runtime-core/compose-values';
import type { AnimationEvent, AnimationEventCallback } from '../runtime-core/animation-events';
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
  /** Cancel a specific running effect by ID. */
  cancelEffect: (effectId: string) => void;
  /** Cancel all running effects. */
  cancelAllEffects: () => void;
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
  /** Callback for animation lifecycle events. */
  onAnimationEvent?: AnimationEventCallback;
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
  const activeEffectSchedulers = new Map<string, EffectScheduler>();
  const stateListeners = new Set<IconDriverStateListener>();

  // Track latest interpolated values for composition
  let latestTransitionValues: InterpolatedValues = {};
  let latestTransitionResolved: ReturnType<typeof resolveTransition> | undefined;
  let latestTransitionStateId: string | undefined;

  function emitEvent(event: AnimationEvent) {
    options.onAnimationEvent?.(event);
  }

  function notifyStateListeners() {
    for (const listener of stateListeners) {
      listener();
    }
  }

  function renderComposed() {
    const stateId = latestTransitionStateId ?? stateMachine.currentState.id;
    const composed = composeValues(latestTransitionValues, ...Array.from(effectLatestValues.values()));
    // Merge all color overrides from effects
    const mergedColors: Record<string, Record<string, string>> = {};
    for (const colors of effectColorOverrides.values()) {
      for (const [layerId, props] of Object.entries(colors)) {
        mergedColors[layerId] = { ...mergedColors[layerId], ...props };
      }
    }
    const hasColors = Object.keys(mergedColors).length > 0;
    renderer.applyFrame(stateId, 0, composed, latestTransitionResolved, hasColors ? mergedColors : undefined);
  }

  // Store latest effect values and color overrides per effect ID
  const effectLatestValues = new Map<string, InterpolatedValues>();
  const effectColorOverrides = new Map<string, Record<string, Record<string, string>>>();

  const unsubscribe = stateMachine.onStateChange((state, transition) => {
    activeScheduler?.cancel();
    activeScheduler = null;
    latestTransitionValues = {};
    latestTransitionResolved = undefined;
    notifyStateListeners();

    if (!transition || shouldReduceMotion(reduceMotionSetting)) {
      renderer.setState(state.id);
      return;
    }

    emitEvent({
      type: 'transitionStart',
      fromState: transition.from,
      toState: transition.to,
      timestamp: Date.now(),
    });

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
    latestTransitionResolved = resolved;
    latestTransitionStateId = state.id;

    const scheduler = new TransitionScheduler(resolved, {
      onFrame: (_progress, interpolatedValues: InterpolatedValues) => {
        latestTransitionValues = interpolatedValues;
        // If effects are active, compose; otherwise render directly
        if (activeEffectSchedulers.size > 0) {
          renderComposed();
        } else {
          renderer.applyFrame(state.id, _progress, interpolatedValues, resolved);
        }
      },
    });

    scheduler.onComplete(() => {
      if (activeScheduler === scheduler) {
        activeScheduler = null;
        latestTransitionValues = {};
        latestTransitionResolved = undefined;
        latestTransitionStateId = undefined;
      }
      renderer.setState(state.id);
      emitEvent({
        type: 'transitionComplete',
        fromState: transition.from,
        toState: transition.to,
        timestamp: Date.now(),
      });
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

      // Cancel existing scheduler for this specific effect ID
      const existing = activeEffectSchedulers.get(effectId);
      if (existing) {
        existing.cancel();
        activeEffectSchedulers.delete(effectId);
        effectLatestValues.delete(effectId);
      }

      emitEvent({
        type: 'effectStart',
        effectId,
        timestamp: Date.now(),
      });

      const currentState = stateMachine.currentState;
      const layerIds = Object.keys(currentState.layers).sort();

      const scheduler = new EffectScheduler(effect, {
        onFrame: (values, colorOverrides) => {
          effectLatestValues.set(effectId, values);
          if (colorOverrides) {
            effectColorOverrides.set(effectId, colorOverrides);
          }
          if (activeScheduler) {
            renderComposed();
          } else {
            const composed = composeValues({}, ...Array.from(effectLatestValues.values()));
            const mergedColors: Record<string, Record<string, string>> = {};
            for (const colors of effectColorOverrides.values()) {
              for (const [lid, props] of Object.entries(colors)) {
                mergedColors[lid] = { ...mergedColors[lid], ...props };
              }
            }
            const hasColors = Object.keys(mergedColors).length > 0;
            renderer.applyFrame(currentState.id, 0, composed, undefined, hasColors ? mergedColors : undefined);
          }
        },
        drawAnnotation: options.drawAnnotation,
        targetLayerIds: layerIds,
      });

      scheduler.onComplete(() => {
        activeEffectSchedulers.delete(effectId);
        effectLatestValues.delete(effectId);
        effectColorOverrides.delete(effectId);
        emitEvent({
          type: 'effectComplete',
          effectId,
          timestamp: Date.now(),
        });
      });

      activeEffectSchedulers.set(effectId, scheduler);
      scheduler.start();
    },
    cancelEffect(effectId: string) {
      const scheduler = activeEffectSchedulers.get(effectId);
      if (scheduler) {
        scheduler.cancel();
        activeEffectSchedulers.delete(effectId);
        effectLatestValues.delete(effectId);
        effectColorOverrides.delete(effectId);
      }
    },
    cancelAllEffects() {
      for (const scheduler of activeEffectSchedulers.values()) {
        scheduler.cancel();
      }
      activeEffectSchedulers.clear();
      effectLatestValues.clear();
      effectColorOverrides.clear();
    },
    setVariableDrawProgress(progress: number) {
      if (!options.variableDraw) return;
      const values = computeVariableDrawValues(options.variableDraw, progress);
      renderer.applyFrame(stateMachine.currentState.id, 0, values);
    },
    destroy() {
      activeScheduler?.cancel();
      activeScheduler = null;
      for (const scheduler of activeEffectSchedulers.values()) {
        scheduler.cancel();
      }
      activeEffectSchedulers.clear();
      effectLatestValues.clear();
      effectColorOverrides.clear();
      stateListeners.clear();
      unsubscribe();
      stateMachine.dispose();
      renderer.unmount();
    },
  };
}
