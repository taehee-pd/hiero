'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import type { Icon, Layer, PaintRef, Variant } from '../schema';
import { createIconDriver, type IconDriver } from '../runtime-dom';
import { getRenderableLayers, resolvePaintToString } from '../runtime-dom/renderer';

export type VibeIconProps = {
  icon: Icon;
  variant?: string | number;
  state?: string;
  animate?: boolean;
  /** Accessible label. Sets role="img" + aria-label. Omit for decorative icons (aria-hidden). */
  label?: string;
  /** Motion preference: true=skip animations, false=always animate, 'system'=respect OS. */
  reduceMotion?: boolean | 'system';
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
};

export function VibeIcon({
  icon,
  variant,
  state,
  animate = true,
  label,
  reduceMotion = 'system',
  size,
  color,
  className,
  style,
}: VibeIconProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const driverRef = useRef<IconDriver | null>(null);

  const resolvedVariant = resolveVariant(icon, variant);
  const resolvedState = resolveState(resolvedVariant, state);
  const renderedSize = size ?? resolvedVariant.size;
  const [vx, vy, vw, vh] = resolvedVariant.viewBox;

  // Driver lifecycle: create/destroy when icon identity, variant, or size change.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // The SVG was server-rendered with static paths. The driver takes over
    // by mounting onto the existing SVG element (hydration).
    const container = svg.parentElement;
    if (!container) return;

    const driver = createIconDriver(container, icon, resolvedVariant.id, {
      initialState: resolvedState,
      size: renderedSize,
      label,
      reduceMotion,
      existingSvg: svg,
    });
    driverRef.current = driver;

    return () => {
      driver.destroy();
      if (driverRef.current === driver) {
        driverRef.current = null;
      }
    };
  }, [icon, renderedSize, resolvedVariant.id]);

  // Subscribe to the driver's current state via useSyncExternalStore.
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const driver = driverRef.current;
      if (!driver) return () => {};
      return driver.subscribe(onStoreChange);
    },
    [icon, renderedSize, resolvedVariant.id],
  );

  const getSnapshot = useCallback(() => {
    return driverRef.current?.getCurrentState() ?? resolvedState;
  }, [resolvedState]);

  const currentDriverState = useSyncExternalStore(subscribe, getSnapshot, () => resolvedState);

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
      });
      driverRef.current = nextDriver;
      return;
    }

    driver.transitionTo(resolvedState);
  }, [animate, currentDriverState, icon, renderedSize, resolvedState, resolvedVariant.id]);

  // Render static SVG with layers for SSR. The driver replaces this on hydration.
  const resolvedStateDef = resolvedVariant.states[resolvedState];
  const layers = resolvedStateDef ? getRenderableLayers(resolvedStateDef.layers) : [];

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
}

function buildLayerCssTransform(layer: Layer): React.CSSProperties | undefined {
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

function resolveVariant(icon: Icon, requestedVariant?: string | number): Variant {
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
    const sizedVariant = variants.find((candidate) => candidate.size === asSize);
    if (sizedVariant) {
      return sizedVariant;
    }
  }

  return fallback;
}

function resolveState(variant: Variant, requestedState?: string): string {
  if (requestedState && variant.states[requestedState]) {
    return requestedState;
  }

  if (variant.states[variant.defaultState]) {
    return variant.defaultState;
  }

  const fallback = Object.values(variant.states)[0];
  if (!fallback) {
    throw new Error(`Variant "${variant.id}" does not define any states.`);
  }

  return fallback.id;
}
