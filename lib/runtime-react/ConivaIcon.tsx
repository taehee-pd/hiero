'use client';

import type React from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useSyncExternalStore,
} from 'react';

import type { Icon, Layer, Variant } from '../schema';
import { createIconDriver, type IconDriver } from '../runtime-dom';
import { getRenderableLayers, resolvePaintToString } from '../runtime-dom/renderer';
import type { AnimationEvent } from '../runtime-core/animation-events';

// ---------------------------------------------------------------------------
// D1 — Imperative ref handle
// ---------------------------------------------------------------------------

/**
 * Imperative handle exposed via `ref` on `ConivaIcon`.
 *
 * Enables parent components to control the icon programmatically:
 * ```tsx
 * const iconRef = useRef<ConivaIconHandle>(null);
 * iconRef.current?.transitionTo('active'); // 'active' is a variant ID
 * ```
 */
export type ConivaIconHandle = {
  /** Trigger a transition to the given variant ID. */
  transitionTo: (variantId: string) => void;
  /** Trigger a named effect. */
  triggerEffect: (effectId: string) => void;
  /** Cancel a specific running effect by ID. */
  cancelEffect: (effectId: string) => void;
  /** Cancel all running effects. */
  cancelAllEffects: () => void;
  /** Get the current state ID. */
  getCurrentState: () => string;
  /** Set Variable Draw progress (0-1). */
  setVariableDrawProgress: (progress: number) => void;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type ConivaIconProps = {
  icon: Icon;
  variant?: string | number;
  state?: string;
  animate?: boolean;
  effect?: string | null;
  /** Accessible label. Sets role="img" + aria-label. Omit for decorative icons (aria-hidden). */
  label?: string;
  /** Motion preference: true=skip animations, false=always animate, 'system'=respect OS. */
  reduceMotion?: boolean | 'system';
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;

  // --- D2: Gesture props ---
  /** State to transition to on hover. Explicit `state` prop takes precedence. */
  hoverState?: string;
  /** State to transition to on tap/click. Explicit `state` prop takes precedence. */
  tapState?: string;
  /** Called when pointer enters the icon container. */
  onHoverStart?: () => void;
  /** Called when pointer leaves the icon container. */
  onHoverEnd?: () => void;
  /** Called when pointer down on the icon container. */
  onTapStart?: () => void;
  /** Called when pointer up on the icon container. */
  onTapEnd?: () => void;

  // --- D3: Animation callbacks ---
  /** Called when a state transition begins. */
  onTransitionStart?: (fromState: string, toState: string) => void;
  /** Called when a state transition completes. */
  onTransitionComplete?: (fromState: string, toState: string) => void;
  /** Called when an effect starts playing. */
  onEffectStart?: (effectId: string) => void;
  /** Called when an effect completes. */
  onEffectComplete?: (effectId: string) => void;

  // --- D4: Animation progress ---
  /** Called on every animation frame with the current progress (0-1) and state ID. */
  onFrame?: (progress: number, stateId: string) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ConivaIcon = forwardRef<ConivaIconHandle, ConivaIconProps>(
  function ConivaIcon(
    {
      icon,
      variant,
      state,
      animate = true,
      effect = null,
      label,
      reduceMotion = 'system',
      size,
      color,
      className,
      style,
      hoverState,
      tapState,
      onHoverStart,
      onHoverEnd,
      onTapStart,
      onTapEnd,
      onTransitionStart,
      onTransitionComplete,
      onEffectStart,
      onEffectComplete,
      onFrame,
    },
    ref,
  ) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const driverRef = useRef<IconDriver | null>(null);
    // After the driver mounts it creates its own <path> elements. React
    // must stop rendering paths to avoid duplication and reconciliation
    // conflicts with the driver's CSS/JS animations.
    const hydratedRef = useRef(false);

    // Track whether gesture state is controlling the icon (vs explicit `state` prop)
    const gestureStateRef = useRef<string | null>(null);
    const restStateRef = useRef<string | null>(null);

    // Stable refs for callbacks — avoid driver re-creation on callback change
    const callbacksRef = useRef({
      onTransitionStart,
      onTransitionComplete,
      onEffectStart,
      onEffectComplete,
      onFrame,
    });
    callbacksRef.current = {
      onTransitionStart,
      onTransitionComplete,
      onEffectStart,
      onEffectComplete,
      onFrame,
    };

    const resolvedVariant = resolveVariant(icon, variant);
    const resolvedState = resolveState(resolvedVariant, state);
    const renderedSize = size ?? resolvedVariant.size;
    const [vx, vy, vw, vh] = resolvedVariant.viewBox;
    const initialStateRef = useRef(resolvedState);

    useEffect(() => {
      initialStateRef.current = resolvedState;
    }, [resolvedState]);

    // D1: Imperative handle exposed via ref
    useImperativeHandle(
      ref,
      () => ({
        transitionTo(variantId: string) {
          driverRef.current?.transitionTo(variantId);
        },
        triggerEffect(effectId: string) {
          driverRef.current?.triggerEffect(effectId);
        },
        cancelEffect(effectId: string) {
          driverRef.current?.cancelEffect(effectId);
        },
        cancelAllEffects() {
          driverRef.current?.cancelAllEffects();
        },
        getCurrentState() {
          return driverRef.current?.getCurrentState() ?? resolvedState;
        },
        setVariableDrawProgress(progress: number) {
          driverRef.current?.setVariableDrawProgress(progress);
        },
      }),
      [resolvedState],
    );

    // Driver lifecycle: create/destroy when icon identity, variant, or size change.
    useEffect(() => {
      const svg = svgRef.current;
      if (!svg) return;

      const container = svg.parentElement;
      if (!container) return;

      const driver = createIconDriver(container, icon, resolvedVariant.id, {
        initialState: initialStateRef.current,
        size: renderedSize,
        label,
        reduceMotion,
        existingSvg: svg,
        // React manages the same <path> elements; CSS transitions applied by the
        // driver would be overwritten during React's reconciliation cycle.
        preferJsScheduler: true,
        onAnimationEvent: (event: AnimationEvent) => {
          const cbs = callbacksRef.current;
          switch (event.type) {
            case 'transitionStart':
              cbs.onTransitionStart?.(event.fromState!, event.toState!);
              break;
            case 'transitionComplete':
              cbs.onTransitionComplete?.(event.fromState!, event.toState!);
              break;
            case 'effectStart':
              cbs.onEffectStart?.(event.effectId!);
              break;
            case 'effectComplete':
              cbs.onEffectComplete?.(event.effectId!);
              break;
          }
        },
      });
      driverRef.current = driver;
      hydratedRef.current = true;

      return () => {
        driver.destroy();
        if (driverRef.current === driver) {
          driverRef.current = null;
        }
        hydratedRef.current = false;
      };
      // Driver is created once per icon/variant/size identity.
      // `label`, `reduceMotion`, and `resolvedState` are intentionally excluded:
      // state changes are handled via `driver.transitionTo()` without recreating the driver.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [icon, renderedSize, resolvedVariant.id]);

    // Subscribe to the driver's current state via useSyncExternalStore.
    const subscribe = useCallback(
      (onStoreChange: () => void) => {
        const driver = driverRef.current;
        if (!driver) return () => {};
        return driver.subscribe(onStoreChange);
      },
      [],
    );

    const getSnapshot = useCallback(() => {
      return driverRef.current?.getCurrentState() ?? resolvedState;
    }, [resolvedState]);

    const currentDriverState = useSyncExternalStore(
      subscribe,
      getSnapshot,
      () => resolvedState,
    );

    // State transition: respond to external state prop changes.
    useEffect(() => {
      const driver = driverRef.current;
      const svg = svgRef.current;
      if (!driver || !svg) return;

      if (currentDriverState === resolvedState) return;

      const container = svg.parentElement;
      if (!container) return;

      if (animate === false) {
        driver.destroy();
        const nextDriver = createIconDriver(container, icon, resolvedVariant.id, {
          initialState: resolvedState,
          size: renderedSize,
          label,
          reduceMotion,
          existingSvg: svg,
          preferJsScheduler: true,
        });
        driverRef.current = nextDriver;
        return;
      }

      driver.transitionTo(resolvedState);
      // `label` and `reduceMotion` are intentionally excluded: they are only
      // used when `animate === false` forces a full driver recreation, which is
      // already covered by the driver lifecycle effect above.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      animate,
      currentDriverState,
      icon,
      renderedSize,
      resolvedState,
      resolvedVariant.id,
    ]);

    // Trigger named effect when requested.
    useEffect(() => {
      const driver = driverRef.current;
      if (!driver || !effect || animate === false) return;
      driver.triggerEffect(effect);
    }, [animate, effect]);

    // D2: Gesture handlers
    const hasExplicitState = state !== undefined;
    const gestureCallbacksRef = useRef({ hoverState, tapState, onHoverStart, onHoverEnd, onTapStart, onTapEnd });
    gestureCallbacksRef.current = { hoverState, tapState, onHoverStart, onHoverEnd, onTapStart, onTapEnd };

    const handlePointerEnter = useCallback(() => {
      const gc = gestureCallbacksRef.current;
      gc.onHoverStart?.();
      if (hasExplicitState || !gc.hoverState) return;
      const driver = driverRef.current;
      if (!driver) return;
      restStateRef.current = driver.getCurrentState();
      gestureStateRef.current = gc.hoverState;
      driver.transitionTo(gc.hoverState);
    }, [hasExplicitState]);

    const handlePointerLeave = useCallback(() => {
      const gc = gestureCallbacksRef.current;
      gc.onHoverEnd?.();
      if (hasExplicitState) return;
      const driver = driverRef.current;
      if (!driver) return;
      if (gestureStateRef.current === gc.hoverState && restStateRef.current) {
        driver.transitionTo(restStateRef.current);
        gestureStateRef.current = null;
      }
    }, [hasExplicitState]);

    const handlePointerDown = useCallback(() => {
      const gc = gestureCallbacksRef.current;
      gc.onTapStart?.();
      if (hasExplicitState || !gc.tapState) return;
      const driver = driverRef.current;
      if (!driver) return;
      // Only save rest state if not already in a gesture
      if (!gestureStateRef.current) {
        restStateRef.current = driver.getCurrentState();
      }
      gestureStateRef.current = gc.tapState;
      driver.transitionTo(gc.tapState);
    }, [hasExplicitState]);

    const handlePointerUp = useCallback(() => {
      const gc = gestureCallbacksRef.current;
      gc.onTapEnd?.();
      if (hasExplicitState) return;
      const driver = driverRef.current;
      if (!driver) return;
      if (gestureStateRef.current === gc.tapState && restStateRef.current) {
        // If hover state is active and pointer is still over, go to hover state
        // Otherwise go back to rest state
        const nextState = gc.hoverState ?? restStateRef.current;
        driver.transitionTo(nextState);
        gestureStateRef.current = gc.hoverState ? gc.hoverState : null;
        if (!gc.hoverState) restStateRef.current = null;
      }
    }, [hasExplicitState]);

    const hasGestures = Boolean(hoverState || tapState || onHoverStart || onHoverEnd || onTapStart || onTapEnd);

    // Render static SVG with layers for SSR. After the driver mounts, it
    // creates its own <path> elements inside the SVG and we stop rendering
    // React-managed paths to avoid duplication and reconciliation conflicts.
    const resolvedStateDef = resolvedVariant.states?.[resolvedState];
    const ssrLayers = resolvedStateDef?.layers ?? resolvedVariant.layers ?? {};
    const layers =
      !hydratedRef.current && Object.keys(ssrLayers).length > 0
        ? getRenderableLayers(ssrLayers)
        : [];

    const a11yProps: Record<string, string> = label
      ? { role: 'img', 'aria-label': label }
      : { 'aria-hidden': 'true' };

    return (
      <div
        className={className}
        style={{
          ...style,
          color,
          width: renderedSize,
          height: renderedSize,
          overflow: 'hidden',
          flexShrink: 0,
        }}
        {...(hasGestures
          ? {
              onPointerEnter: handlePointerEnter,
              onPointerLeave: handlePointerLeave,
              onPointerDown: handlePointerDown,
              onPointerUp: handlePointerUp,
            }
          : undefined)}
      >
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`${vx} ${vy} ${vw} ${vh}`}
          width={renderedSize}
          height={renderedSize}
          fill="none"
          overflow="hidden"
          focusable="false"
          style={{ display: 'block' }}
          {...a11yProps}
        >
          {layers.map((layer) => (
            <path
              key={layer.id}
              data-layer-id={layer.id}
              d={layer.path!.d}
              fillRule={layer.path?.fillRule}
              fill={resolvePaintToString(layer.style.fill)}
              stroke={resolvePaintToString(layer.style.stroke)}
              strokeWidth={layer.style.strokeWidth}
              fillOpacity={layer.style.fillOpacity}
              strokeOpacity={layer.style.strokeOpacity}
              strokeLinecap={layer.style.lineCap}
              strokeLinejoin={layer.style.lineJoin}
              style={buildLayerCssTransform(layer)}
            />
          ))}
        </svg>
      </div>
    );
  },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildLayerCssTransform(
  layer: Layer,
): React.CSSProperties | undefined {
  const t = layer.transform;
  if (!t) return undefined;

  const parts: string[] = [];
  if (t.x !== undefined || t.y !== undefined) {
    parts.push(`translate(${t.x ?? 0}px, ${t.y ?? 0}px)`);
  }
  if (t.rotate !== undefined) {
    parts.push(`rotate(${t.rotate}deg)`);
  }
  if (t.scaleX !== undefined || t.scaleY !== undefined) {
    const sx = t.scaleX ?? 1;
    const sy = t.scaleY ?? 1;
    parts.push(sx === sy ? `scale(${sx})` : `scale(${sx}, ${sy})`);
  }
  if (parts.length === 0) return undefined;

  return {
    transform: parts.join(' '),
    transformBox: 'fill-box' as const,
    transformOrigin: 'center',
  };
}

function resolveVariant(
  icon: Icon,
  requestedVariant?: string | number,
): Variant {
  const variants = Object.values(icon.variants);
  const fallback = variants[0];
  if (!fallback) {
    throw new Error(`Icon "${icon.id}" does not define any variants.`);
  }

  if (requestedVariant === undefined) {
    return fallback;
  }

  const exactId = icon.variants[String(requestedVariant)];
  if (exactId) {
    return exactId;
  }

  const asSize =
    typeof requestedVariant === 'number'
      ? requestedVariant
      : Number.parseFloat(requestedVariant);
  if (Number.isFinite(asSize)) {
    const sizedVariant = variants.find(
      (candidate) => candidate.size === asSize,
    );
    if (sizedVariant) {
      return sizedVariant;
    }
  }

  return fallback;
}

function resolveState(variant: Variant, requestedState?: string): string {
  if (requestedState && variant.states?.[requestedState]) {
    return requestedState;
  }

  if (variant.defaultState && variant.states?.[variant.defaultState]) {
    return variant.defaultState;
  }

  const fallback = Object.values(variant.states ?? {})[0];
  if (!fallback) {
    // Variant-centric model: no states map — use defaultState or 'default'.
    return variant.defaultState ?? 'default';
  }

  return fallback.id;
}
