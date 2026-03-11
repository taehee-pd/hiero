'use client';

import type React from 'react';
import { useEffect, useRef } from 'react';

import type { Icon, Variant } from '../schema';
import { createIconDriver, type IconDriver } from '../runtime-dom';

export type VibeIconProps = {
  icon: Icon;
  variant?: string | number;
  state?: string;
  animate?: boolean;
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
  size,
  color,
  className,
  style,
}: VibeIconProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const driverRef = useRef<IconDriver | null>(null);

  const resolvedVariant = resolveVariant(icon, variant);
  const resolvedState = resolveState(resolvedVariant, state);
  const renderedSize = size ?? resolvedVariant.size;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const driver = createIconDriver(container, icon, resolvedVariant.id, {
      initialState: resolvedState,
      size: renderedSize,
    });
    driverRef.current = driver;

    return () => {
      driver.destroy();
      if (driverRef.current === driver) {
        driverRef.current = null;
      }
    };
  }, [icon, renderedSize, resolvedVariant.id]);

  useEffect(() => {
    const container = containerRef.current;
    const driver = driverRef.current;
    if (!container || !driver) {
      return;
    }

    if (driver.getCurrentState() === resolvedState) {
      return;
    }

    if (animate === false) {
      driver.destroy();
      const nextDriver = createIconDriver(container, icon, resolvedVariant.id, {
        initialState: resolvedState,
        size: renderedSize,
      });
      driverRef.current = nextDriver;
      return;
    }

    driver.transitionTo(resolvedState);
  }, [animate, icon, renderedSize, resolvedState, resolvedVariant.id]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...style,
        color,
        width: renderedSize,
        height: renderedSize,
      }}
    />
  );
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
