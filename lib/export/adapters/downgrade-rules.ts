/**
 * Downgrade rules for non-React targets (Phase 7.3).
 *
 * When a RuntimeVariantPayload uses features that a target platform cannot
 * support, these rules define the fallback behavior.
 *
 * ## V1 Downgrade Rules
 *
 * | Feature               | Swift fallback        | Flutter fallback      |
 * |-----------------------|-----------------------|-----------------------|
 * | morph transition      | crossfade (opacity)   | crossfade (opacity)   |
 * | track transition      | snap (instant)        | snap (instant)        |
 * | spring easing         | ease-in-out           | ease-in-out           |
 * | variable draw         | omit                  | omit                  |
 * | clip paths            | preserve (supported)  | omit                  |
 * | effects               | preserve (supported)  | preserve (supported)  |
 * | draw annotations      | preserve (supported)  | preserve (supported)  |
 * | gradients             | preserve (supported)  | preserve (supported)  |
 *
 * @module
 */

import type { RuntimeVariantPayload } from '@/lib/export/export-runtime-json';
import type { PlatformDiagnostic, TargetPlatform } from '@/lib/platform/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DowngradeAction = 'snap' | 'crossfade' | 'omit' | 'ease-fallback' | 'preserve';

export type DowngradeRule = {
  feature: string;
  action: DowngradeAction;
  description: string;
};

export type DowngradedPayload = {
  original: RuntimeVariantPayload;
  downgrades: DowngradeRule[];
};

export type PlatformDowngradeConfig = {
  morph: DowngradeAction;
  trackTransition: DowngradeAction;
  springEasing: DowngradeAction;
  variableDraw: DowngradeAction;
  clipPaths: DowngradeAction;
  effects: DowngradeAction;
  draw: DowngradeAction;
  gradients: DowngradeAction;
};

// ---------------------------------------------------------------------------
// Built-in downgrade configs
// ---------------------------------------------------------------------------

const SWIFT_DOWNGRADES: PlatformDowngradeConfig = {
  morph: 'crossfade',
  trackTransition: 'snap',
  springEasing: 'ease-fallback',
  variableDraw: 'omit',
  clipPaths: 'preserve',
  effects: 'preserve',
  draw: 'preserve',
  gradients: 'preserve',
};

const FLUTTER_DOWNGRADES: PlatformDowngradeConfig = {
  morph: 'crossfade',
  trackTransition: 'snap',
  springEasing: 'ease-fallback',
  variableDraw: 'omit',
  clipPaths: 'omit',
  effects: 'preserve',
  draw: 'preserve',
  gradients: 'preserve',
};

const WEB_COMPONENT_DOWNGRADES: PlatformDowngradeConfig = {
  morph: 'preserve',
  trackTransition: 'preserve',
  springEasing: 'preserve',
  variableDraw: 'preserve',
  clipPaths: 'preserve',
  effects: 'preserve',
  draw: 'preserve',
  gradients: 'preserve',
};

const REACT_DOWNGRADES: PlatformDowngradeConfig = {
  morph: 'preserve',
  trackTransition: 'preserve',
  springEasing: 'preserve',
  variableDraw: 'preserve',
  clipPaths: 'preserve',
  effects: 'preserve',
  draw: 'preserve',
  gradients: 'preserve',
};

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Get the downgrade config for a target platform.
 */
export function getDowngradeConfig(platform: TargetPlatform): PlatformDowngradeConfig {
  switch (platform) {
    case 'swift':
      return SWIFT_DOWNGRADES;
    case 'flutter':
      return FLUTTER_DOWNGRADES;
    case 'web-component':
      return WEB_COMPONENT_DOWNGRADES;
    case 'react':
      return REACT_DOWNGRADES;
  }
}

/**
 * Apply downgrade rules to a runtime variant payload.
 *
 * This inspects the payload's features and records which downgrades
 * are needed for the target platform. The returned `DowngradedPayload`
 * carries the original payload plus the list of applied downgrades.
 *
 * Adapters consume these downgrades to generate appropriate fallback code.
 */
export function applyDowngradeRules(
  platform: TargetPlatform,
  payload: RuntimeVariantPayload,
  diagnostics: PlatformDiagnostic[],
  iconId: string,
): DowngradedPayload {
  const config = getDowngradeConfig(platform);
  const downgrades: DowngradeRule[] = [];

  // Check variable draw
  if (payload.variableDraw) {
    if (config.variableDraw !== 'preserve') {
      downgrades.push({
        feature: 'variable-draw',
        action: config.variableDraw,
        description: `Variable draw ${config.variableDraw === 'omit' ? 'omitted' : 'downgraded'} on ${platform}`,
      });
    }
  }

  // Check transitions for morph bindings and spring easing
  const transitions = (payload as Record<string, unknown>).transitions as Record<string, Record<string, unknown>> | undefined;
  if (transitions) {
    let hasMorph = false;
    let hasSpring = false;
    for (const transition of Object.values(transitions)) {
      if (!hasMorph && Array.isArray(transition?.layerBindings)) {
        if ((transition.layerBindings as Array<Record<string, unknown>>).some((b) => b?.morph)) {
          hasMorph = true;
        }
      }
      if (!hasSpring && transition?.easing && typeof transition.easing === 'object' && (transition.easing as Record<string, unknown>).type === 'spring') {
        hasSpring = true;
      }
    }
    if (hasMorph && config.morph !== 'preserve') {
      downgrades.push({
        feature: 'morph',
        action: config.morph,
        description: `Morph transition ${config.morph === 'crossfade' ? 'replaced with crossfade' : 'downgraded'} on ${platform}`,
      });
    }
    if (hasSpring && config.springEasing !== 'preserve') {
      downgrades.push({
        feature: 'spring-easing',
        action: config.springEasing,
        description: `Spring easing ${config.springEasing === 'ease-fallback' ? 'replaced with ease-in-out' : 'downgraded'} on ${platform}`,
      });
    }
  }

  // Check clip paths
  for (const layer of payload.layers) {
    if (layer.clipPath && config.clipPaths !== 'preserve') {
      downgrades.push({
        feature: 'clip-path',
        action: config.clipPaths,
        description: `Clip path ${config.clipPaths === 'omit' ? 'omitted' : 'downgraded'} on ${platform}`,
      });
      break;
    }
  }

  // Emit downgrade-applied diagnostics
  for (const downgrade of downgrades) {
    diagnostics.push({
      level: 'info',
      code: 'downgrade-applied',
      platform,
      iconId,
      variantId: payload.variant.id,
      feature: downgrade.feature as PlatformDiagnostic['feature'],
      message: downgrade.description,
      downgradeAction: downgrade.action === 'crossfade' ? 'snap' : downgrade.action === 'ease-fallback' ? 'snap' : downgrade.action as 'omit' | 'snap' | 'static-fallback',
    });
  }

  return { original: payload, downgrades };
}

/**
 * Check whether a feature needs downgrade for a given platform.
 */
export function needsDowngrade(
  platform: TargetPlatform,
  feature: keyof PlatformDowngradeConfig,
): boolean {
  return getDowngradeConfig(platform)[feature] !== 'preserve';
}

/**
 * Get the fallback easing string for platforms that don't support spring.
 */
export function getFallbackEasing(
  _platform: TargetPlatform,
  easing: string | { type: 'spring'; stiffness: number; damping: number; mass?: number },
): string {
  if (typeof easing === 'string') return easing;
  // Convert spring config to a reasonable cubic-bezier approximation
  // Standard ease-in-out is a safe universal fallback
  return 'cubic-bezier(0.42, 0, 0.58, 1)';
}
