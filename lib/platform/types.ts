/**
 * Platform capability layer — target platform types for multi-platform
 * code generation and export.
 *
 * These types describe the *output target* for code generation (React,
 * Swift, Flutter, Web Components), not the editor hosting environment
 * (that's handled by `bridge.ts`).
 *
 * @module
 */

import type { RuntimeVariantPayload } from '@/lib/export/export-runtime-json';

// ---------------------------------------------------------------------------
// 5A.1 — Target platform types
// ---------------------------------------------------------------------------

/** Target platform for code generation output. */
export type TargetPlatform = 'react' | 'swift' | 'flutter' | 'web-component';

/**
 * How generated output is delivered to the consumer.
 * - `package`: npm/pub/SPM package with its own manifest
 * - `repo`: files committed directly into a consuming repository
 * - `asset-bundle`: standalone archive (zip, xcassets, etc.)
 */
export type DeliveryMode = 'package' | 'repo' | 'asset-bundle';

/**
 * Capabilities that may or may not be supported by a target platform.
 * String literals keep the set extensible without schema migration.
 */
export type PlatformCapability =
  | 'draw'
  | 'morph'
  | 'effects'
  | 'gradients'
  | 'clip-paths'
  | 'track-transitions'
  | 'spring-easing'
  | 'variable-draw';

/** Describes a target platform's supported capabilities. */
export type PlatformCapabilityProfile = {
  platform: TargetPlatform;
  capabilities: Set<PlatformCapability>;
};

/** Result of adapter code generation for a single icon. */
export type ExportOutcome = {
  iconId: string;
  files: Array<{ path: string; contents: string }>;
  diagnostics: PlatformDiagnostic[];
};

/** Result of adapter code generation for an entire project. */
export type AdapterExportResult = {
  platform: TargetPlatform;
  deliveryMode: DeliveryMode;
  outcomes: ExportOutcome[];
  diagnostics: PlatformDiagnostic[];
};

// ---------------------------------------------------------------------------
// Built-in capability profiles
// ---------------------------------------------------------------------------

/** React — full capability (same JS runtime engine). */
export const REACT_CAPABILITIES: PlatformCapabilityProfile = {
  platform: 'react',
  capabilities: new Set<PlatformCapability>([
    'draw', 'morph', 'effects', 'gradients',
    'clip-paths', 'track-transitions', 'spring-easing', 'variable-draw',
  ]),
};

/** Swift — draw and effects supported; morph, spring easing excluded. */
export const SWIFT_CAPABILITIES: PlatformCapabilityProfile = {
  platform: 'swift',
  capabilities: new Set<PlatformCapability>([
    'draw', 'effects', 'gradients', 'clip-paths',
  ]),
};

/** Flutter — draw and effects supported; morph, clip-paths, spring excluded. */
export const FLUTTER_CAPABILITIES: PlatformCapabilityProfile = {
  platform: 'flutter',
  capabilities: new Set<PlatformCapability>([
    'draw', 'effects', 'gradients',
  ]),
};

/** Web Component — full capability (same JS runtime engine as React). */
export const WEB_COMPONENT_CAPABILITIES: PlatformCapabilityProfile = {
  platform: 'web-component',
  capabilities: new Set<PlatformCapability>([
    'draw', 'morph', 'effects', 'gradients',
    'clip-paths', 'track-transitions', 'spring-easing', 'variable-draw',
  ]),
};

// ---------------------------------------------------------------------------
// 5A.2 — Downgrade diagnostics
// ---------------------------------------------------------------------------

/** Diagnostic emitted when an icon uses a feature the target platform cannot support. */
export type PlatformDiagnostic = {
  level: 'info' | 'warning' | 'error';
  code:
    | 'unsupported-morph'
    | 'unsupported-draw'
    | 'unsupported-effect'
    | 'unsupported-gradient'
    | 'unsupported-clip-path'
    | 'unsupported-track-transition'
    | 'unsupported-spring-easing'
    | 'unsupported-variable-draw'
    | 'downgrade-applied'
    | 'feature-omitted';
  platform: TargetPlatform;
  iconId: string;
  variantId?: string;
  feature: PlatformCapability;
  message: string;
  /** What the adapter did instead. */
  downgradeAction?: 'omit' | 'snap' | 'static-fallback';
};

/**
 * Check a runtime variant payload against a platform profile and emit
 * diagnostics for any features the platform cannot support.
 */
export function checkPlatformCapabilities(
  profile: PlatformCapabilityProfile,
  iconId: string,
  variantId: string,
  payload: RuntimeVariantPayload,
): PlatformDiagnostic[] {
  const diagnostics: PlatformDiagnostic[] = [];
  const { capabilities, platform } = profile;

  // Check transitions for morph and track-transition usage
  if (payload.transitions) {
    for (const [transitionId, transition] of Object.entries(payload.transitions)) {
      if (
        (transition.strategy === 'morph' || transition.strategy === 'replace') &&
        transition.layerBindings?.some((b) => b.morph)
      ) {
        if (!capabilities.has('morph')) {
          diagnostics.push({
            level: 'warning',
            code: 'unsupported-morph',
            platform,
            iconId,
            variantId,
            feature: 'morph',
            message: `Transition "${transitionId}" uses morph which is not supported on ${platform}. Falling back to crossfade.`,
            downgradeAction: 'snap',
          });
        }
      }

      if (transition.strategy === 'track' && !capabilities.has('track-transitions')) {
        diagnostics.push({
          level: 'warning',
          code: 'unsupported-track-transition',
          platform,
          iconId,
          variantId,
          feature: 'track-transitions',
          message: `Transition "${transitionId}" uses track strategy which is not supported on ${platform}.`,
          downgradeAction: 'snap',
        });
      }

      // Check easing for spring config
      if (typeof transition.easing === 'object' && !capabilities.has('spring-easing')) {
        diagnostics.push({
          level: 'info',
          code: 'unsupported-spring-easing',
          platform,
          iconId,
          variantId,
          feature: 'spring-easing',
          message: `Transition "${transitionId}" uses spring easing which is not supported on ${platform}. Using linear fallback.`,
          downgradeAction: 'snap',
        });
      }
    }
  }

  // Check effects
  if (payload.effects && !capabilities.has('effects')) {
    for (const effectId of Object.keys(payload.effects)) {
      diagnostics.push({
        level: 'warning',
        code: 'unsupported-effect',
        platform,
        iconId,
        variantId,
        feature: 'effects',
        message: `Effect "${effectId}" is not supported on ${platform} and will be omitted.`,
        downgradeAction: 'omit',
      });
    }
  }

  // Check variable draw
  if (payload.variableDraw && !capabilities.has('variable-draw')) {
    diagnostics.push({
      level: 'warning',
      code: 'unsupported-variable-draw',
      platform,
      iconId,
      variantId,
      feature: 'variable-draw',
      message: `Variable draw is not supported on ${platform} and will be omitted.`,
      downgradeAction: 'omit',
    });
  }

  // Check draw annotations
  if (payload.draw && !capabilities.has('draw')) {
    diagnostics.push({
      level: 'warning',
      code: 'unsupported-draw',
      platform,
      iconId,
      variantId,
      feature: 'draw',
      message: `Draw annotations are not supported on ${platform} and will be omitted.`,
      downgradeAction: 'omit',
    });
  }

  // Check states for gradient fills and clip paths
  if (payload.states) {
    for (const [stateId, state] of Object.entries(payload.states)) {
      for (const layer of state.layers) {
        if (layer.clipPath && !capabilities.has('clip-paths')) {
          diagnostics.push({
            level: 'warning',
            code: 'unsupported-clip-path',
            platform,
            iconId,
            variantId: `${variantId}/${stateId}`,
            feature: 'clip-paths',
            message: `Layer "${layer.id}" uses a clip path which is not supported on ${platform}.`,
            downgradeAction: 'omit',
          });
          break; // One diagnostic per state is enough
        }
      }
    }
  }

  return diagnostics;
}
