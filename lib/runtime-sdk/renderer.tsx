import React, { forwardRef, useEffect, useMemo, useRef } from 'react';

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
  resolveRequestedRenderingMode,
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
      easing: string;
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
    const compiledState = variant.states[resolvedStateId]!;
    const resolvedMode = resolveRequestedRenderingMode(
      compiledState,
      renderingMode,
      fallback.modeFallback,
    );

    const resolvedPalette = resolvePaletteColors(resolvedMode, paletteColors);
    const layerSet = compiledState.modes[resolvedMode]!;

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
          return (
            <path
              key={layer.id}
              d={layer.path.d}
              fill={style.fill}
              fillOpacity={style.fillOpacity}
              stroke={style.stroke}
              strokeOpacity={style.strokeOpacity}
              strokeWidth={style.strokeWidth}
              strokeLinecap={style.lineCap}
              strokeLinejoin={style.lineJoin}
              fillRule={layer.path.fillRule}
              transform={buildLayerTransform(layer)}
            />
          );
        })}
      </svg>
    );
  },
);
