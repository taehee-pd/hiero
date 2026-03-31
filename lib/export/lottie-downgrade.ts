/**
 * Lottie-specific downgrade diagnostics.
 *
 * DO NOT modify `downgrade-rules.ts` — that file is coupled to TargetPlatform
 * and is unrelated to Lottie format conversion. This file handles Lottie-
 * specific feature incompatibilities.
 *
 * Flags features that cannot be represented in Lottie or have limited
 * player support, and surfaces them in the ExportPanel UI.
 *
 * @module
 */

import type { Icon, Variant, Effect, Transition } from '@/lib/schema/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LottieDowngradeSeverity = 'info' | 'warning' | 'error';

export type LottieDowngradeDiagnostic = {
  /** Feature that triggered the diagnostic. */
  feature: string;
  /** Severity level for UI display. */
  severity: LottieDowngradeSeverity;
  /** Human-readable description of the limitation. */
  message: string;
  /** Lottie fallback behavior (what will actually happen). */
  fallback: string;
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Collect all Lottie-incompatible features for a specific icon variant.
 * Returns an empty array if the icon is fully compatible.
 */
export function collectLottieDowngrades(
  icon: Icon,
  variantId: string,
): LottieDowngradeDiagnostic[] {
  const diagnostics: LottieDowngradeDiagnostic[] = [];
  const variant = icon.variants?.[variantId];
  if (!variant) return diagnostics;

  // Check variableValue (not representable in Lottie)
  checkVariableValue(variant, diagnostics);

  // Check paint styles for radialGradient — in variant layers and state layers
  const allLayers = new Map<string, typeof variant.layers[string]>();
  for (const [id, layer] of Object.entries(variant.layers ?? {})) {
    allLayers.set(id, layer);
  }
  for (const state of Object.values(variant.states ?? {})) {
    for (const [id, layer] of Object.entries(state.layers ?? {})) {
      allLayers.set(id, layer);
    }
  }
  for (const layer of allLayers.values()) {
    checkRadialGradient(layer.style?.fill, layer.id, diagnostics);
    checkRadialGradient(layer.style?.stroke, layer.id, diagnostics);
  }

  // Check transitions for this variant
  for (const transition of Object.values(icon.transitions ?? {})) {
    if (transition.fromVariantId !== variantId && transition.toVariantId !== variantId) {
      continue;
    }
    checkTransitionCompatibility(icon, variant, transition, diagnostics);
  }

  // Check effects
  for (const effect of Object.values(icon.effects ?? {})) {
    checkEffectCompatibility(effect, diagnostics);
  }

  // Check weight interpolation
  checkWeightInterpolation(variant, diagnostics);

  return diagnostics;
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkVariableValue(
  variant: Variant,
  diagnostics: LottieDowngradeDiagnostic[],
): void {
  if (variant.variableValue !== undefined) {
    diagnostics.push({
      feature: 'variableValue',
      severity: 'warning',
      message:
        'Variable value (SF Symbols-style weight/size interpolation) cannot be represented in Lottie.',
      fallback: 'Static rendering at the default variable value.',
    });
  }
}

function checkRadialGradient(
  paint: import('@/lib/schema/types').PaintRef | undefined,
  layerId: string,
  diagnostics: LottieDowngradeDiagnostic[],
): void {
  if (paint?.mode === 'radialGradient') {
    // Avoid duplicate diagnostics
    if (!diagnostics.some((d) => d.feature === 'radialGradient')) {
      diagnostics.push({
        feature: 'radialGradient',
        severity: 'warning',
        message:
          `Layer "${layerId}" uses radial gradient fill, which has limited Lottie player support.`,
        fallback: 'Emitted as Lottie type=2 (radial) gradient. May not render on all players.',
      });
    }
  }
}

function checkEffectCompatibility(
  effect: Effect,
  diagnostics: LottieDowngradeDiagnostic[],
): void {
  if (effect.kind === 'wiggle') {
    diagnostics.push({
      feature: 'wiggle-effect',
      severity: 'warning',
      message: `Effect "${effect.kind}" requires procedural randomness not available in Lottie.`,
      fallback: 'Omitted in Lottie output.',
    });
  }

  if (effect.kind === 'variableColor') {
    diagnostics.push({
      feature: 'variableColor-effect',
      severity: 'warning',
      message: `Variable color effect requires runtime palette, which Lottie cannot represent.`,
      fallback: 'First palette color used as static fill.',
    });
  }
}

function checkTransitionCompatibility(
  icon: Icon,
  variant: Variant,
  transition: Transition,
  diagnostics: LottieDowngradeDiagnostic[],
): void {
  // Check spring easing
  if (
    transition.easing &&
    typeof transition.easing === 'object' &&
    transition.easing.type === 'spring'
  ) {
    if (!diagnostics.some((d) => d.feature === 'spring-easing')) {
      diagnostics.push({
        feature: 'spring-easing',
        severity: 'warning',
        message:
          'Spring easing in transition cannot be exactly represented in Lottie.',
        fallback: 'Approximated as cubic-bezier ease-in-out.',
      });
    }
  }

  // Check bestGuessMorph with mismatched commands
  if (transition.strategy === 'bestGuessMorph') {
    for (const binding of transition.layerBindings ?? []) {
      if (!binding.morph || binding.morph.topology !== 'bestGuess') continue;
      const fromLayerId = binding.fromLayerId;
      const toLayerId = binding.toLayerId;
      if (!fromLayerId || !toLayerId) continue;

      const fromState = variant.states?.[transition.from ?? 'default'];
      const toState = variant.states?.[transition.to ?? 'default'];
      const fromLayer = fromState?.layers?.[fromLayerId] ?? variant.layers?.[fromLayerId];
      const toLayer = toState?.layers?.[toLayerId] ?? variant.layers?.[toLayerId];

      if (fromLayer?.path?.d && toLayer?.path?.d) {
        const fromCommands = extractPathCommands(fromLayer.path.d);
        const toCommands = extractPathCommands(toLayer.path.d);
        if (fromCommands !== toCommands) {
          diagnostics.push({
            feature: 'bestGuessMorph-mismatch',
            severity: 'warning',
            message: `bestGuessMorph between "${fromLayerId}" and "${toLayerId}" has mismatched path commands.`,
            fallback: 'Path will be interpolated with best-effort vertex matching.',
          });
        }
      }
    }
  }
}

function extractPathCommands(d: string): string {
  return (d.match(/[A-Za-z]/g) ?? []).join('');
}

function checkWeightInterpolation(
  variant: Variant,
  diagnostics: LottieDowngradeDiagnostic[],
): void {
  // Weight interpolation (cubic control points) is a Coniva-specific feature
  // with no Lottie equivalent
  if ((variant as Record<string, unknown>).weightControlPoints) {
    diagnostics.push({
      feature: 'weight-interpolation',
      severity: 'warning',
      message: 'Weight interpolation (cubic control points) cannot be represented in Lottie.',
      fallback: 'Regular weight variant only.',
    });
  }
}
