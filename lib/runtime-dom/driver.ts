import type { Icon, TimelineTrack } from '../schema';
import {
  BlendScheduler,
  StateMachine,
  TransitionScheduler,
  EffectScheduler,
  getEasingFunction,
  resolveTransition,
  computeVariableDrawValues,
  shouldReduceMotion,
  type InterpolatedValues,
  type DrawAnnotation,
  type VariableDrawConfig,
  type EffectDefinition,
  type ResolvedTransition,
} from '../runtime-core';
import { DomRenderer, type CssTrackTransitionPlan } from './renderer';

const CSS_FALLBACK_TRACKS = new Set<TimelineTrack['property']>([
  'opacity',
  'rotate',
  'translateX',
  'translateY',
  'scale',
]);

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

export type CreateIconOptions = CreateIconDriverOptions & {
  /** Optional variant selector (ID or size). Defaults to the first variant. */
  variant?: string | number;
};

/**
 * Framework-agnostic runtime API. This is the first-class vanilla JS entry point.
 */
export function createIcon(
  container: HTMLElement,
  iconData: Icon,
  options: CreateIconOptions = {},
): IconDriver {
  const variantId = resolveVariantId(iconData, options.variant);
  const { variant: _variant, ...driverOptions } = options;
  return createIconDriver(container, iconData, variantId, driverOptions);
}

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
  let activeBlendScheduler: BlendScheduler | null = null;
  let activeEffectScheduler: EffectScheduler | null = null;
  let activeCssFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let activeCssFallbackPlan: CssTrackTransitionPlan | null = null;
  let activeCssFallbackStartedAt = 0;
  let activeTransitionValues: InterpolatedValues = {};
  let activeBlendValues: InterpolatedValues = {};
  const stateListeners = new Set<IconDriverStateListener>();

  function notifyStateListeners() {
    for (const listener of stateListeners) {
      listener();
    }
  }

  function clearAnimatedFrames() {
    activeTransitionValues = {};
    activeBlendValues = {};
  }

  function renderAnimatedFrame(
    stateId: string,
    progress: number,
    transition?: ResolvedTransition,
  ) {
    renderer.applyFrame(
      stateId,
      progress,
      composeInterpolatedValues(activeBlendValues, activeTransitionValues),
      transition,
    );
  }

  function cancelActiveTransitions() {
    activeScheduler?.cancel();
    activeScheduler = null;
    activeBlendScheduler?.cancel();
    activeBlendScheduler = null;
    if (activeCssFallbackTimer !== null) {
      clearTimeout(activeCssFallbackTimer);
      activeCssFallbackTimer = null;
    }
    activeCssFallbackPlan = null;
    activeCssFallbackStartedAt = 0;
    clearAnimatedFrames();
    renderer.clearCssTrackTransitions();
  }

  const unsubscribe = stateMachine.onStateChange((state, transition) => {
    notifyStateListeners();

    const interruptedBlend = activeScheduler?.interrupt(80, {
      onFrame: (_progress, values) => {
        activeBlendValues = values;
        renderAnimatedFrame(state.id, 0);
      },
    });
    const interruptedCssValues =
      !activeScheduler && activeCssFallbackPlan
        ? captureCssTrackTransitionValues(
            activeCssFallbackPlan,
            defaultNow() - activeCssFallbackStartedAt,
          )
        : null;
    activeScheduler = null;
    activeBlendScheduler?.cancel();
    activeBlendScheduler =
      interruptedBlend ??
      (interruptedCssValues && Object.keys(interruptedCssValues).length > 0
        ? new BlendScheduler(interruptedCssValues, 80, {
            onFrame: (_progress, values) => {
              activeBlendValues = values;
              renderAnimatedFrame(state.id, 0);
            },
          })
        : null);
    activeBlendScheduler?.onComplete(() => {
      if (activeBlendScheduler) {
        activeBlendValues = {};
        activeBlendScheduler = null;
      }
    });
    activeBlendScheduler?.start();
    const forceJsScheduler = Boolean(interruptedCssValues);

    if (activeCssFallbackTimer !== null) {
      clearTimeout(activeCssFallbackTimer);
      activeCssFallbackTimer = null;
    }
    activeCssFallbackPlan = null;
    activeCssFallbackStartedAt = 0;
    renderer.clearCssTrackTransitions();

    if (!transition || shouldReduceMotion(reduceMotionSetting)) {
      cancelActiveTransitions();
      renderer.setState(state.id);
      return;
    }

    const variant = icon.variants[variantId];
    const fromState = variant.states[transition.from];
    const toState = variant.states[transition.to];
    if (!fromState || !toState) {
      cancelActiveTransitions();
      renderer.setState(state.id);
      return;
    }

    const resolved = resolveTransition(transition, fromState, toState, {
      preserveLayerIds: options.preserveLayerIds,
    });

    const cssPlan = planCssTrackTransition(resolved);
    if (cssPlan && !forceJsScheduler) {
      activeCssFallbackPlan = cssPlan;
      activeCssFallbackStartedAt = defaultNow();
      renderer.applyCssTrackTransition(state.id, cssPlan);
      activeCssFallbackTimer = setTimeout(() => {
        renderer.clearCssTrackTransitions();
        activeCssFallbackPlan = null;
        activeCssFallbackStartedAt = 0;
        activeCssFallbackTimer = null;
      }, cssPlan.durationMs + 20);
      return;
    }

    const scheduler = new TransitionScheduler(resolved, {
      onFrame: (progress, interpolatedValues: InterpolatedValues) => {
        activeTransitionValues = interpolatedValues;
        renderAnimatedFrame(state.id, progress, resolved);
      },
    });

    scheduler.onComplete(() => {
      if (activeScheduler === scheduler) {
        activeScheduler = null;
      }
      activeTransitionValues = {};
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
      cancelActiveTransitions();
      activeEffectScheduler?.cancel();
      activeEffectScheduler = null;
      stateListeners.clear();
      unsubscribe();
      stateMachine.dispose();
      renderer.unmount();
    },
  };
}

export function planCssTrackTransition(
  resolved: ResolvedTransition,
): CssTrackTransitionPlan | null {
  const bindings: CssTrackTransitionPlan['bindings'] = [];

  for (const binding of resolved.layerBindings) {
    if (binding.preserved) return null;
    if (binding.morph || binding.fallback) return null;
    if (binding.tracks.length === 0) return null;

    const fromId = binding.fromLayer?.id;
    const toId = binding.toLayer?.id;
    if (!fromId || !toId || fromId !== toId) {
      return null;
    }

    const fromValues: Record<string, number> = {};
    const toValues: Record<string, number> = {};

    for (const track of binding.tracks) {
      if (!CSS_FALLBACK_TRACKS.has(track.property)) {
        return null;
      }
      if (track.keyframes.length === 0) {
        return null;
      }
      fromValues[track.property] = track.keyframes[0] as number;
      toValues[track.property] = track.keyframes[track.keyframes.length - 1] as number;
    }

    const easing = binding.easing ?? resolved.easing;
    if (typeof easing !== 'string') {
      return null;
    }

    bindings.push({
      layerId: toId,
      fromValues,
      toValues,
      durationMs: Math.max(0, binding.durationMs ?? resolved.durationMs),
      delayMs: Math.max(0, binding.delayMs ?? 0),
      easing,
    });
  }

  if (bindings.length === 0) {
    return null;
  }

  const durationMs = Math.max(...bindings.map((binding) => binding.delayMs + binding.durationMs), 0);
  return {
    durationMs,
    bindings,
  };
}

function composeInterpolatedValues(
  blendValues: InterpolatedValues,
  transitionValues: InterpolatedValues,
): InterpolatedValues {
  const result: InterpolatedValues = {};
  const layerIds = new Set([
    ...Object.keys(blendValues),
    ...Object.keys(transitionValues),
  ]);

  for (const layerId of layerIds) {
    const blended = blendValues[layerId] ?? {};
    const transitioned = transitionValues[layerId] ?? {};
    const nextValues: InterpolatedValues[string] = {
      ...blended,
      ...transitioned,
    };

    for (const property of ['translateX', 'translateY', 'rotate'] as const) {
      const blendValue = blended[property];
      const transitionValue = transitioned[property];
      if (typeof blendValue === 'number' && typeof transitionValue === 'number') {
        nextValues[property] = blendValue + transitionValue;
      }
    }

    const blendScale = blended.scale;
    const transitionScale = transitioned.scale;
    if (typeof blendScale === 'number' && typeof transitionScale === 'number') {
      nextValues.scale = 1 + (blendScale - 1) + (transitionScale - 1);
    }

    result[layerId] = nextValues;
  }

  return result;
}

export function captureCssTrackTransitionValues(
  plan: CssTrackTransitionPlan,
  elapsedMs: number,
): InterpolatedValues {
  const values: InterpolatedValues = {};

  for (const binding of plan.bindings) {
    const layerValues = (values[binding.layerId] ??= {});
    const effectiveElapsed = Math.max(elapsedMs - binding.delayMs, 0);
    const rawProgress =
      binding.durationMs <= 0 ? 1 : effectiveElapsed / binding.durationMs;
    const easedProgress = getEasingFunction(binding.easing)(clamp01(rawProgress));

    for (const [property, fromValue] of Object.entries(binding.fromValues)) {
      const toValue = binding.toValues[property];
      if (toValue === undefined) {
        layerValues[property] = fromValue;
        continue;
      }

      layerValues[property] =
        fromValue + (toValue - fromValue) * easedProgress;
    }
  }

  return values;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function defaultNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function resolveVariantId(icon: Icon, requestedVariant?: string | number): string {
  if (requestedVariant !== undefined) {
    const explicit = icon.variants[String(requestedVariant)];
    if (explicit) {
      return explicit.id;
    }

    const numeric = typeof requestedVariant === 'number' ? requestedVariant : Number.parseFloat(requestedVariant);
    if (Number.isFinite(numeric)) {
      const match = Object.values(icon.variants).find((variant) => variant.size === numeric);
      if (match) {
        return match.id;
      }
    }
  }

  const first = Object.values(icon.variants)[0];
  if (!first) {
    throw new Error(`Icon "${icon.id}" does not define any variants.`);
  }
  return first.id;
}
