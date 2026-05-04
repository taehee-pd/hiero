import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';

import type {
  CompiledEffect,
  CompiledIcon,
  CompiledLayer,
  CompiledRenderingMode,
  CompiledTransition,
} from '@/lib/compiler-contracts';
import type { IconBaseProps, IconFallbackBehavior } from './primitives';
import {
  DEFAULT_ICON_FALLBACK_BEHAVIOR,
  resolvePaletteColors,
  resolveRequestedSize,
  resolveRequestedState,
} from './primitives';

export type IconEffectDriver = {
  trigger: (
    effect: CompiledEffect,
    context: {
      iconId: string;
      stateId: string;
      repeat: IconBaseProps['animateRepeat'];
    },
  ) => void;
};

export const DEFAULT_EFFECT_DRIVER: IconEffectDriver = {
  trigger: () => {
    // minimal no-op default implementation
  },
};

export type TransitionResolution =
  | { mode: 'snap' }
  | {
      mode: 'transition';
      transition: CompiledTransition;
      durationMs: number;
      easing: CompiledTransition['easing'];
    };

export function resolveTransitionPlan(
  icon: CompiledIcon,
  fromState: string,
  toState: string,
  transition: IconBaseProps['transition'],
): TransitionResolution {
  if (!transition || fromState === toState) {
    return { mode: 'snap' };
  }

  const compiledTransition = icon.transitions.find(
    (candidate) => candidate.from === fromState && candidate.to === toState,
  );

  if (!compiledTransition) {
    return { mode: 'snap' };
  }

  return {
    mode: 'transition',
    transition: compiledTransition,
    durationMs:
      typeof transition === 'object' && transition.durationMs !== undefined
        ? transition.durationMs
        : compiledTransition.durationMs,
    easing:
      typeof transition === 'object' && transition.easing !== undefined
        ? transition.easing
        : compiledTransition.easing,
  };
}

export function resolveEffectForAnimate(
  icon: CompiledIcon,
  animate: IconBaseProps['animate'],
): CompiledEffect | undefined {
  if (!animate) return undefined;
  return icon.effects.find((effect) => effect.kind === animate);
}

export function applyModeStyling(
  layer: CompiledLayer,
  mode: CompiledRenderingMode,
  paletteColors?: Partial<Record<string, string>>,
): CompiledLayer['style'] {
  const style = { ...layer.style };

  if (mode === 'monochrome') {
    return {
      ...style,
      fill: style.fill === 'none' ? 'none' : 'currentColor',
      stroke: style.stroke === 'none' ? 'none' : 'currentColor',
    };
  }

  if (mode === 'palette') {
    const override = paletteColors?.[layer.role];
    if (!override) return style;
    return {
      ...style,
      fill: style.fill === 'none' ? 'none' : override,
      stroke: style.stroke === 'none' ? 'none' : override,
    };
  }

  return style;
}


export function triggerAnimateEffect(
  icon: CompiledIcon,
  animate: IconBaseProps['animate'],
  stateId: string,
  repeat: IconBaseProps['animateRepeat'],
  effectDriver: IconEffectDriver,
): boolean {
  const effect = resolveEffectForAnimate(icon, animate);
  if (!effect) return false;

  effectDriver.trigger(effect, {
    iconId: icon.id,
    stateId,
    repeat,
  });
  return true;
}

export function buildLayerTransform(layer: CompiledLayer): string | undefined {
  if (!layer.transform) return undefined;
  const { x, y, rotate, scaleX, scaleY } = layer.transform;
  return `translate(${x}, ${y}) rotate(${rotate}) scale(${scaleX}, ${scaleY})`;
}

export type RuntimeIconRendererProps = IconBaseProps & {
  icon: CompiledIcon;
  fallbackBehavior?: Partial<IconFallbackBehavior>;
  effectDriver?: IconEffectDriver;
};

export const RuntimeIconRenderer = forwardRef<SVGSVGElement, RuntimeIconRendererProps>(
  function RuntimeIconRenderer(
    {
      icon,
      size,
      state,
      renderingMode = 'monochrome',
      paletteColors,
      transition,
      animate,
      animateRepeat = 'once',
      fallbackBehavior,
      effectDriver = DEFAULT_EFFECT_DRIVER,
      ...svgProps
    },
    ref,
  ) {
    const fallback: IconFallbackBehavior = {
      ...DEFAULT_ICON_FALLBACK_BEHAVIOR,
      ...fallbackBehavior,
    };

    const resolvedSize = resolveRequestedSize(icon, size, fallback.sizeFallback);
    const variant = icon.variants[resolvedSize.resolvedVariantId]!;
    const resolvedStateId = resolveRequestedState(
      variant,
      state,
      fallback.stateFallback,
    );
    // Compiled variants are now flat — layers live directly on the variant.
    // However, if states are present (e.g. from tests or extended payloads),
    // resolve the state's layers.
    const resolvedMode: CompiledRenderingMode = renderingMode ?? fallback.modeFallback;
    const resolvedPalette = resolvePaletteColors(resolvedMode, paletteColors);
    const variantWithStates = variant as typeof variant & {
      states?: Record<string, typeof variant.layers>;
    };
    const layerSet =
      variantWithStates.states?.[resolvedStateId] ?? variant.layers;

    const previousStateRef = useRef(resolvedStateId);
    const transitionPlan = useMemo(
      () =>
        resolveTransitionPlan(
          icon,
          previousStateRef.current,
          resolvedStateId,
          transition,
        ),
      [icon, resolvedStateId, transition],
    );

    // Per-layer keyframe samples driven by a rAF progress tick. When
    // `transitionPlan.mode === 'transition'` and the binding carries
    // `morph.keyframes`, the path's `d` is overridden frame-by-frame
    // for the duration. The progress tick resets whenever the
    // transitionPlan changes (a new variant is being morphed to).
    const interpolatedFrames = useTransitionKeyframes(transitionPlan);

    useEffect(() => {
      previousStateRef.current = resolvedStateId;
    }, [resolvedStateId]);

    useEffect(() => {
      triggerAnimateEffect(icon, animate, resolvedStateId, animateRepeat, effectDriver);
    }, [animate, animateRepeat, effectDriver, icon, resolvedStateId]);

    return (
      <svg
        {...svgProps}
        ref={ref}
        width={resolvedSize.renderSize}
        height={resolvedSize.renderSize}
        viewBox={variant.viewBox.join(' ')}
        data-transition-mode={transitionPlan.mode}
      >
        {layerSet.layers.map((layer) => {
          const style = applyModeStyling(layer, resolvedMode, resolvedPalette);
          const sample = interpolatedFrames.get(layer.id);
          return (
            <path
              key={layer.id}
              d={sample?.d ?? layer.path.d}
              fill={style.fill}
              fillOpacity={style.fillOpacity}
              stroke={style.stroke}
              strokeOpacity={style.strokeOpacity}
              strokeWidth={style.strokeWidth}
              strokeLinecap={style.lineCap}
              strokeLinejoin={style.lineJoin}
              fillRule={layer.path.fillRule}
              transform={buildLayerTransform(layer)}
              opacity={sample?.alpha}
            />
          );
        })}
      </svg>
    );
  },
);

// ---------------------------------------------------------------------------
// W4 D9 — keyframe playback
// ---------------------------------------------------------------------------

type KeyframeSample = { d: string; alpha: number };

/**
 * Drive per-layer keyframe playback for a `TransitionResolution`.
 *
 * When the plan's mode is `'transition'` and at least one of the
 * compiled bindings carries `morph.keyframes`, this hook starts a
 * rAF loop that samples the keyframes at the current elapsed
 * fraction of `durationMs`. Returns a map from layer id (chosen
 * from the binding's `toLayerId` when present, falling back to
 * `fromLayerId`) to the current sample. Layers not present in the
 * map render their static path verbatim.
 *
 * No-op (returns empty map) when:
 *   - The plan is `'snap'`
 *   - No binding has keyframes (legacy compile path)
 *   - The runtime lacks `requestAnimationFrame` (SSR / test) — in
 *     which case the snap behaviour is the safe fallback
 */
function useTransitionKeyframes(
  plan: TransitionResolution,
): Map<string, KeyframeSample> {
  const [progress, setProgress] = useState(0);
  const planRef = useRef(plan);

  useEffect(() => {
    planRef.current = plan;
    setProgress(0);
    if (plan.mode !== 'transition') return;
    if (typeof requestAnimationFrame !== 'function') return;
    const hasKeyframes = plan.transition.bindings.some(
      (b) => b.morph?.keyframes && b.morph.keyframes.length > 0,
    );
    if (!hasKeyframes) return;

    const start =
      typeof performance !== 'undefined'
        ? performance.now()
        : Date.now();
    let handle = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / Math.max(plan.durationMs, 1), 1);
      setProgress(t);
      if (t < 1 && planRef.current === plan) {
        handle = requestAnimationFrame(tick);
      }
    };
    handle = requestAnimationFrame(tick);
    return () => {
      if (handle) cancelAnimationFrame(handle);
    };
  }, [plan]);

  if (plan.mode !== 'transition') return new Map();
  const out = new Map<string, KeyframeSample>();
  for (const binding of plan.transition.bindings) {
    const keyframes = binding.morph?.keyframes;
    if (!keyframes || keyframes.length === 0) continue;
    const layerId = binding.toLayerId ?? binding.fromLayerId;
    if (!layerId) continue;
    out.set(layerId, sampleKeyframes(keyframes, progress));
  }
  return out;
}

/**
 * Find the keyframe that brackets `t` and emit its `d` + `alpha`.
 * The cascade samples densely enough (16 frames per
 * `sampleForCompiledIcon` call) that nearest-prior lookup is
 * imperceptible at typical 240-300 ms transition durations.
 */
export function sampleKeyframes(
  keyframes: ReadonlyArray<{ t: number; d: string; alpha: number }>,
  t: number,
): KeyframeSample {
  if (keyframes.length === 0) return { d: '', alpha: 1 };
  if (t <= keyframes[0]!.t) {
    return { d: keyframes[0]!.d, alpha: keyframes[0]!.alpha };
  }
  const last = keyframes[keyframes.length - 1]!;
  if (t >= last.t) return { d: last.d, alpha: last.alpha };
  let lo = 0;
  let hi = keyframes.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (keyframes[mid]!.t <= t) lo = mid;
    else hi = mid;
  }
  const a = keyframes[lo]!;
  const b = keyframes[hi]!;
  // Linear interpolation on alpha; nearest-prior `d` (path strings
  // can't safely linearly interpolate without aligned vertex
  // counts; the cascade's pre-baked samples are already at the
  // resolved cadence's frame density).
  const span = Math.max(b.t - a.t, 1e-9);
  const u = (t - a.t) / span;
  return { d: a.d, alpha: a.alpha * (1 - u) + b.alpha * u };
}
