import type { Icon, TimelineTrack } from '../schema';
import { variantToSnapshot } from '../schema/types';
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
import { composeValues } from '../runtime-core/compose-values';
import type { AnimationEvent, AnimationEventCallback } from '../runtime-core/animation-events';
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
  transitionTo: (variantId: string) => void;
  getCurrentState: () => string;
  /** Subscribe to state changes. Returns an unsubscribe function.
   *  Compatible with React's useSyncExternalStore. */
  subscribe: (listener: IconDriverStateListener) => () => void;
  /**
   * Trigger a named effect. Multiple effects can run in parallel.
   *
   * **Effect composition (stacking) semantics:**
   * - `translateX`, `translateY`, `rotate`: **additive** (effects add to transition values)
   * - `scale`, `opacity`: **multiplicative** (identity = 1; effects multiply with transition values)
   * - `fill`, `stroke`, and other properties: **override** (last effect wins)
   *
   * Composition is handled by {@link composeValues} and applied every frame
   * via {@link renderComposed}.
   */
  triggerEffect: (effectId: string) => void;
  /**
   * Cancel a specific running effect by ID.
   * Removes its interpolated values and color overrides from the composition pipeline.
   */
  cancelEffect: (effectId: string) => void;
  /**
   * Cancel all running effects and clear their interpolated values.
   * The transition animation (if active) continues unaffected.
   */
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
  /**
   * Always use the JS `TransitionScheduler` instead of CSS `transition`
   * fallback. Set to `true` when the host framework (React, Vue, etc.)
   * manages the same DOM elements — CSS transitions applied by the driver
   * would be overwritten by the framework's reconciliation cycle.
   */
  preferJsScheduler?: boolean;
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

  let currentVariantId = variantId;
  if (options.initialState && options.initialState !== variantId && icon.variants[options.initialState]) {
    stateMachine.transitionTo(options.initialState);
    currentVariantId = options.initialState;
  }
  renderer.setState(currentVariantId);

  let activeScheduler: TransitionScheduler | null = null;
  let activeBlendScheduler: BlendScheduler | null = null;
  /**
   * Running effect schedulers keyed by effect ID.
   * Multiple effects compose in parallel via {@link composeValues}:
   * additive transforms, multiplicative opacity/scale, override for colors.
   */
  const activeEffectSchedulers = new Map<string, EffectScheduler>();
  let activeCssFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let activeCssFallbackPlan: CssTrackTransitionPlan | null = null;
  let activeCssFallbackStartedAt = 0;
  let activeTransitionValues: InterpolatedValues = {};
  let activeBlendValues: InterpolatedValues = {};
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

  /**
   * Re-render the current frame by composing transition values with all active
   * effect values. Called on every animation frame when effects are running.
   *
   * Composition order: transition base values -> effect deltas (in Map insertion order).
   * See {@link composeValues} for per-property stacking rules.
   */
  function renderComposed() {
    const stateId = latestTransitionStateId ?? currentVariantId;
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

  // Store latest effect values and color overrides per effect ID
  const effectLatestValues = new Map<string, InterpolatedValues>();
  const effectColorOverrides = new Map<string, Record<string, Record<string, string>>>();

  const unsubscribe = stateMachine.onStateChange((snapshot, transition) => {
    // Determine the target variant ID. Prefer the transition's explicit toVariantId
    // (which may differ from the state machine's current ID during rapid switches),
    // but always fall back to the state machine's current variant rather than the
    // stale driver-local ID — critical for replace-strategy transitions where no
    // Transition object is defined.
    const targetVariantId = transition?.toVariantId ?? stateMachine.currentVariantId;
    currentVariantId = targetVariantId;
    notifyStateListeners();

    // Update targetLayerIds on any running effect schedulers so that subsequent
    // frames apply to the new variant's layers rather than the stale pre-transition ones.
    if (activeEffectSchedulers.size > 0) {
      const newLayerIds = Object.keys(snapshot.layers).sort();
      for (const scheduler of activeEffectSchedulers.values()) {
        scheduler.setTargetLayerIds(newLayerIds);
      }
    }

    const interruptedBlend = activeScheduler?.interrupt(80, {
      onFrame: (_progress, values) => {
        activeBlendValues = values;
        renderAnimatedFrame(targetVariantId, 0);
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
              renderAnimatedFrame(targetVariantId, 0);
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
      renderer.setState(targetVariantId);
      return;
    }

    emitEvent({
      type: 'transitionStart',
      fromState: transition.fromVariantId,
      toState: transition.toVariantId,
      timestamp: Date.now(),
    });

    const fromVariant = icon.variants[transition.fromVariantId];
    const toVariant = icon.variants[transition.toVariantId];
    if (!fromVariant || !toVariant) {
      cancelActiveTransitions();
      renderer.setState(targetVariantId);
      return;
    }

    const fromSnapshot = variantToSnapshot(fromVariant);
    const toSnapshot = variantToSnapshot(toVariant);

    const resolved = resolveTransition(transition, fromSnapshot, toSnapshot, {
      preserveLayerIds: options.preserveLayerIds,
    });
    latestTransitionResolved = resolved;
    latestTransitionStateId = targetVariantId;

    const cssPlan = planCssTrackTransition(resolved);
    if (cssPlan && !forceJsScheduler && !options.preferJsScheduler) {
      activeCssFallbackPlan = cssPlan;
      activeCssFallbackStartedAt = defaultNow();
      renderer.applyCssTrackTransition(targetVariantId, cssPlan);
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
        latestTransitionValues = interpolatedValues;
        activeTransitionValues = interpolatedValues;
        // If effects are active, compose; otherwise render via blend
        if (activeEffectSchedulers.size > 0) {
          renderComposed();
        } else {
          renderAnimatedFrame(targetVariantId, progress, resolved);
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
      activeTransitionValues = {};
      renderer.setState(targetVariantId);
      emitEvent({
        type: 'transitionComplete',
        fromState: transition.fromVariantId,
        toState: transition.toVariantId,
        timestamp: Date.now(),
      });
    });

    activeScheduler = scheduler;
    scheduler.start();
  });

  return {
    transitionTo(variantId: string) {
      // Guard: skip if the target variant doesn't exist in the icon
      // (e.g. variant-centric icons where resolveState returns a state name
      // like "default" that isn't a top-level variant ID).
      if (!icon.variants[variantId]) return;
      stateMachine.transitionTo(variantId);
    },
    getCurrentState() {
      return currentVariantId;
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

      const currentSnapshot = stateMachine.currentSnapshot;
      const layerIds = Object.keys(currentSnapshot.layers).sort();

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
            renderer.applyFrame(currentVariantId, 0, composed, undefined, hasColors ? mergedColors : undefined);
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
      renderer.applyFrame(currentVariantId, 0, values);
    },
    destroy() {
      cancelActiveTransitions();
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
