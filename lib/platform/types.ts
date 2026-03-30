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

  // Check transitions for morph bindings
  const payloadRecord = payload as unknown as Record<string, unknown>;
  if (payloadRecord.transitions && !capabilities.has('morph')) {
    const transitions = payloadRecord.transitions as Record<string, Record<string, unknown>>;
    for (const [transitionId, transition] of Object.entries(transitions)) {
      const bindings = transition?.layerBindings;
      if (Array.isArray(bindings) && (bindings as Array<Record<string, unknown>>).some((b) => b?.morph)) {
        diagnostics.push({
          level: 'warning',
          code: 'unsupported-morph',
          platform,
          iconId,
          variantId,
          feature: 'morph',
          message: `Transition "${transitionId}" uses morph which is not supported on ${platform}.`,
          downgradeAction: 'omit',
        });
        break;
      }
    }
  }

  // Check layers for clip paths (both top-level and in states)
  const allLayers: Array<Record<string, unknown>> = [...(payload.layers as Array<Record<string, unknown>>)];
  if (payload.states) {
    for (const state of Object.values(payload.states)) {
      if (Array.isArray((state as Record<string, unknown>).layers)) {
        allLayers.push(...((state as Record<string, unknown>).layers as Array<Record<string, unknown>>));
      }
    }
  }
  for (const layer of allLayers) {
    if (layer.clipPath && !capabilities.has('clip-paths')) {
      diagnostics.push({
        level: 'warning',
        code: 'unsupported-clip-path',
        platform,
        iconId,
        variantId,
        feature: 'clip-paths',
        message: `Layer "${layer.id}" uses a clip path which is not supported on ${platform}.`,
        downgradeAction: 'omit',
      });
      break;
    }
  }

  return diagnostics;
}
