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

import type { Icon, Variant, Transition, Effect, SpringConfig } from '@/lib/schema/types';

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

  // Check transitions for downgrade-worthy features
  const transitions = Object.values(icon.transitions ?? {}).filter(
    (t) =>
      Object.keys(variant.states ?? {}).includes(t.from) &&
      Object.keys(variant.states ?? {}).includes(t.to),
  );

  for (const transition of transitions) {
    checkSpringEasing(transition, diagnostics);
    checkMorphBindings(transition, variant, diagnostics);
  }

  // Check paint styles for radialGradient
  for (const state of Object.values(variant.states ?? {})) {
    for (const layer of Object.values(state.layers ?? {})) {
      checkRadialGradient(layer.style?.fill, layer.id, diagnostics);
      checkRadialGradient(layer.style?.stroke, layer.id, diagnostics);
    }
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

function checkSpringEasing(
  transition: Transition,
  diagnostics: LottieDowngradeDiagnostic[],
): void {
  const isSpring = (e: string | SpringConfig | undefined): boolean =>
    !!e && typeof e === 'object' && e.type === 'spring';

  if (isSpring(transition.easing)) {
    diagnostics.push({
      feature: 'spring-easing',
      severity: 'info',
      message:
        `Transition "${transition.from}→${transition.to}" uses spring easing, which has no direct Lottie equivalent.`,
      fallback: 'Approximated as ease-in-out cubic-bezier.',
    });
  }

  // Also check per-binding track easings
  for (const binding of transition.layerBindings ?? []) {
    for (const track of binding.tracks ?? []) {
      if (isSpring(track.easing)) {
        if (!diagnostics.some((d) => d.feature === 'spring-easing')) {
          diagnostics.push({
            feature: 'spring-easing',
            severity: 'info',
            message: `Track "${track.property}" uses spring easing.`,
            fallback: 'Approximated as ease-in-out cubic-bezier.',
          });
        }
      }
    }
  }
}

function checkMorphBindings(
  transition: Transition,
  variant: Variant,
  diagnostics: LottieDowngradeDiagnostic[],
): void {
  for (const binding of transition.layerBindings ?? []) {
    if (binding.morph?.topology === 'bestGuess') {
      const fromLayer = variant.states?.[transition.from]?.layers?.[binding.fromLayerId ?? ''];
      const toLayer = variant.states?.[transition.to]?.layers?.[binding.toLayerId ?? ''];

      if (fromLayer?.path?.d && toLayer?.path?.d) {
        // Check if command counts match — if not, bestGuessMorph may degrade
        const fromCommands = (fromLayer.path.d.match(/[MCLZ]/gi) ?? []).length;
        const toCommands = (toLayer.path.d.match(/[MCLZ]/gi) ?? []).length;

        if (fromCommands !== toCommands) {
          diagnostics.push({
            feature: 'bestGuessMorph-mismatch',
            severity: 'warning',
            message:
              `Morph "${binding.fromLayerId}→${binding.toLayerId}" uses bestGuess topology with mismatched path commands (${fromCommands} vs ${toCommands}).`,
            fallback: 'Falls back to crossfade if morph normalization fails.',
          });
        }
      }
    }
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
