import { createHash } from 'node:crypto';

import type {
  CompiledEffect,
  CompiledIcon,
  CompiledLayer,
  CompiledLayerBinding,
  CompiledRenderingMode,
  CompiledTransition,
} from '@/lib/compiler-contracts';
import {
  COMPILED_ICON_SCHEMA_URI,
  isCompiledIcon,
} from '@/lib/compiler-contracts';
import { resolveMorph } from '@/lib/runtime-core/cascade';
import { sampleForCompiledIcon } from '@/lib/runtime-core/cascade-export';
import { isResolverV2Enabled } from '@/lib/runtime-core/resolver-flag';
import type {
  Effect,
  Icon,
  Layer,
  LayerBinding,
  PaintRef,
  Project,
  Transition,
  Variant,
} from '@/lib/schema/types';

export function exportCompiledIcon(project: Project, iconId: string): CompiledIcon {
  const icon = project.icons[iconId];
  if (!icon) {
    throw new Error(`Icon "${iconId}" not found.`);
  }

  const compiledWithoutHash: CompiledIcon = {
    $schema: COMPILED_ICON_SCHEMA_URI,
    id: icon.id,
    name: icon.name,
    componentName: toComponentName(icon.id),
    meta: {
      category: icon.category ?? 'uncategorized',
      tags: [...(icon.tags ?? [])].sort((a, b) => a.localeCompare(b)),
      updatedAt: project.meta.updatedAt,
      version: project.version,
      contentHash: '',
    },
    variants: buildCompiledVariants(project, icon),
    transitions: buildCompiledTransitions(icon),
    effects: buildCompiledEffects(icon),
  };

  const contentHash = computeContentHash(compiledWithoutHash);
  const compiled: CompiledIcon = {
    ...compiledWithoutHash,
    meta: {
      ...compiledWithoutHash.meta,
      contentHash,
    },
  };

  validateCompiledIconOrThrow(compiled);
  return compiled;
}

export function exportCompiledIconFile(
  project: Project,
  iconId: string,
): { path: string; contents: string; compiled: CompiledIcon } {
  const compiled = exportCompiledIcon(project, iconId);
  return {
    path: `${compiled.id}.compiled.json`,
    contents: serializeCompiledJson(compiled),
    compiled,
  };
}

export function validateCompiledIconOrThrow(value: unknown): asserts value is CompiledIcon {
  if (!isCompiledIcon(value)) {
    throw new Error('Malformed CompiledIcon payload.');
  }
}

export function serializeCompiledJson(value: unknown): string {
  return `${JSON.stringify(sortJsonValue(value), null, 2)}\n`;
}

function buildCompiledVariants(project: Project, icon: Icon): CompiledIcon['variants'] {
  return Object.keys(icon.variants)
    .sort((a, b) => a.localeCompare(b))
    .reduce<CompiledIcon['variants']>((acc, variantId) => {
      const variant = icon.variants[variantId]!;
      const modeLayers = buildResolvedLayers(project, variant.layers);

      acc[variantId] = {
        size: variant.size,
        viewBox: [...variant.viewBox],
        layers: { layers: modeLayers.monochrome },
      };
      return acc;
    }, {});
}

function buildResolvedLayers(
  project: Project,
  layers: Record<string, Layer>,
): Record<CompiledRenderingMode, CompiledLayer[]> {
  const ordered = Object.keys(layers)
    .sort((a, b) => a.localeCompare(b))
    .map((layerId) => layers[layerId]!)
    .filter((layer) => layer.visible !== false && !layer.isClipMask && Boolean(layer.path?.d));

  return {
    monochrome: ordered.map((layer) => toCompiledLayer(layer, project, 'monochrome')),
    hierarchical: ordered.map((layer) => toCompiledLayer(layer, project, 'hierarchical')),
    palette: ordered.map((layer) => toCompiledLayer(layer, project, 'palette')),
    multicolor: ordered.map((layer) => toCompiledLayer(layer, project, 'multicolor')),
  };
}

function toCompiledLayer(
  layer: Layer,
  project: Project,
  _mode: CompiledRenderingMode,
): CompiledLayer {
  const compiled: CompiledLayer = {
    id: layer.id,
    role: layer.role ?? 'primary',
    path: {
      d: layer.path!.d,
      fillRule: layer.path?.fillRule,
    },
    style: {
      fill: resolveCompiledPaint(layer.style.fill, project),
      fillOpacity: layer.style.fillOpacity ?? 1,
      stroke: resolveCompiledPaint(layer.style.stroke, project),
      strokeOpacity: layer.style.strokeOpacity ?? 1,
      strokeWidth: layer.style.strokeWidth ?? 0,
      lineCap: layer.style.lineCap,
      lineJoin: layer.style.lineJoin,
    },
  };

  const transform = toCompiledTransform(layer);
  if (transform) {
    compiled.transform = transform;
  }

  return compiled;
}

function resolveCompiledPaint(
  paint: PaintRef | undefined,
  project: Project,
): string {
  if (!paint) return 'none';

  switch (paint.mode) {
    case 'currentColor':
      return 'currentColor';
    case 'fixed':
      return paint.value;
    case 'token':
      return project.tokenSet?.colors?.[paint.token] ?? 'currentColor';
    case 'linearGradient':
    case 'radialGradient':
      return 'currentColor';
    default:
      return 'none';
  }
}

function toCompiledTransform(layer: Layer): CompiledLayer['transform'] | undefined {
  if (!layer.transform) return undefined;

  const x = layer.transform.x ?? 0;
  const y = layer.transform.y ?? 0;
  const rotate = layer.transform.rotate ?? 0;
  const scaleX = layer.transform.scaleX ?? 1;
  const scaleY = layer.transform.scaleY ?? 1;

  if (x === 0 && y === 0 && rotate === 0 && scaleX === 1 && scaleY === 1) {
    return undefined;
  }

  return { x, y, rotate, scaleX, scaleY };
}

function buildCompiledEffects(icon: Icon): CompiledEffect[] {
  if (!icon.effects) return [];

  return Object.keys(icon.effects)
    .sort((a, b) => a.localeCompare(b))
    .map((effectId) => toCompiledEffect(icon.effects![effectId]!))
    .filter((effect): effect is CompiledEffect => effect !== null);
}

function toCompiledEffect(effect: Effect): CompiledEffect | null {
  if (effect.kind === 'appear' || effect.kind === 'disappear') {
    return null;
  }
  const compiled: CompiledEffect = {
    kind: effect.kind,
    durationMs: effect.durationMs,
    easing: effect.easing ?? 'linear',
  };
  // Serialize drawConfig into params for the 'draw' effect kind
  if (effect.kind === 'draw' && effect.drawConfig) {
    compiled.params = {
      mode: effect.drawConfig.mode,
      ...(effect.drawConfig.windowSize !== undefined && { windowSize: effect.drawConfig.windowSize }),
      ...(effect.drawConfig.initialOffset !== undefined && { initialOffset: effect.drawConfig.initialOffset }),
      ...(effect.drawConfig.compoundTrimMode !== undefined && { compoundTrimMode: effect.drawConfig.compoundTrimMode }),
    };
  }
  return compiled;
}

function computeContentHash(compiled: CompiledIcon): string {
  const canonical = serializeCompiledJson({
    ...compiled,
    meta: {
      ...compiled.meta,
      contentHash: '',
    },
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function toComponentName(iconId: string): string {
  const words = iconId
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1));

  const normalized = words.join('');
  if (!normalized) return 'IcIcon';
  if (normalized.startsWith('Ic')) return normalized;
  return `Ic${normalized}`;
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortJsonValue(entry)] as const),
    );
  }

  return value;
}

// ---------------------------------------------------------------------------
// Compiled transitions (W4 D9 wiring)
// ---------------------------------------------------------------------------

/**
 * Build the compiled-icon transitions array from an authored
 * `Icon.transitions`. When the resolver V2 flag is on, each layer
 * binding's morph carries pre-baked path keyframes sampled from
 * the cascade — the SDK runtime interpolates between adjacent
 * frames at playback so preview, runtime, and export stay
 * frame-for-frame identical (the §3 invariant 5).
 *
 * When the flag is off, this returns the same data structure but
 * without `morph.keyframes` — the legacy SDK behaviour (snap on
 * variant change) is preserved.
 *
 * **V2-rollout gating.** The `NEXT_PUBLIC_HIERO_RESOLVER_V2` flag
 * is a *deployment-level* switch during the V2 rollout: every
 * artifact built within a given deployment uses the same flag
 * value, so output is deterministic per-deployment. Two
 * deployments with different flag values will produce different
 * `contentHash` for the same project — that is the intended
 * behaviour while V2 is staged behind the flag, since the
 * non-V2 path (no keyframes) and the V2 path (keyframes) are
 * substantively different artifacts. When V2 graduates from the
 * flag (W5 calibration sign-off, see `export-lottie.ts:251`),
 * this gate is removed and emission becomes unconditional.
 *
 * Cross-icon transitions (`fromIconId !== iconId`) are skipped:
 * the compiled-icon JSON describes one icon; a cross-icon morph
 * needs both icons' compiled forms to play. Cross-icon emission
 * lands when the package-level export grows that contract. Each
 * skip emits a `console.warn` so authors can see when a
 * cross-icon transition is being dropped from the per-icon
 * output rather than wondering where it went.
 */
function buildCompiledTransitions(icon: Icon): CompiledTransition[] {
  const transitions = icon.transitions;
  if (!transitions) return [];
  // Compiled transitions are gated on the V2 resolver flag. When
  // off (default), the legacy SDK behaviour stands and the source
  // roundtrip's not-yet-restored transition path doesn't drift the
  // content hash. When V2 flips on, emission is real and the
  // source roundtrip's transition restore lands alongside.
  const v2 = isResolverV2Enabled();
  if (!v2) return [];
  const out: CompiledTransition[] = [];
  for (const transition of Object.values(transitions)) {
    // Cross-icon transitions live at the package layer, not the
    // per-icon compiled JSON — see header note. Surface the skip
    // so authors can correlate "missing transition in compiled
    // output" with the architectural limitation.
    if (transition.fromIconId && transition.fromIconId !== icon.id) {
      console.warn(
        `[export-compiled-icon] skipping cross-icon transition ${transition.id} ` +
          `for icon "${icon.id}" (fromIconId="${transition.fromIconId}"): ` +
          `cross-icon emission lands at the package layer, not per-icon JSON.`,
      );
      continue;
    }
    if (transition.toIconId && transition.toIconId !== icon.id) {
      console.warn(
        `[export-compiled-icon] skipping cross-icon transition ${transition.id} ` +
          `for icon "${icon.id}" (toIconId="${transition.toIconId}"): ` +
          `cross-icon emission lands at the package layer, not per-icon JSON.`,
      );
      continue;
    }

    const fromVariant = icon.variants?.[transition.fromVariantId];
    const toVariant = icon.variants?.[transition.toVariantId];
    if (!fromVariant || !toVariant) continue;

    const bindings = (transition.layerBindings ?? []).map((binding) =>
      compileBinding(binding, fromVariant, toVariant, transition),
    );

    out.push({
      from: transition.fromVariantId,
      to: transition.toVariantId,
      durationMs: transition.durationMs,
      easing: transition.easing ?? 'ease-in-out',
      strategy: compileStrategy(transition.strategy),
      bindings,
    });
  }
  // Stable ordering for content-hash determinism.
  out.sort((a, b) => {
    const k1 = `${a.from}->${a.to}`;
    const k2 = `${b.from}->${b.to}`;
    return k1.localeCompare(k2);
  });
  return out;
}

function compileBinding(
  binding: LayerBinding,
  fromVariant: Variant,
  toVariant: Variant,
  transition: Transition,
): CompiledLayerBinding {
  const compiled: CompiledLayerBinding = {};
  if (binding.fromLayerId) compiled.fromLayerId = binding.fromLayerId;
  if (binding.toLayerId) compiled.toLayerId = binding.toLayerId;

  if (binding.morph && binding.fromLayerId && binding.toLayerId) {
    const fromLayer = fromVariant.layers?.[binding.fromLayerId];
    const toLayer = toVariant.layers?.[binding.toLayerId];
    const morph: NonNullable<CompiledLayerBinding['morph']> = {
      topology: binding.morph.topology ?? 'bestGuess',
    };
    // V2 gate is on the outer caller (buildCompiledTransitions).
    // When we get here the flag is true, so always sample.
    if (fromLayer?.path?.d && toLayer?.path?.d) {
      try {
        const resolution = resolveMorph(fromLayer, toLayer, {
          cadence: transition.cadence ?? 'soft',
          hints: transition.correspondenceHints,
        });
        morph.keyframes = sampleForCompiledIcon(
          resolution,
          transition.durationMs,
        );
      } catch (err) {
        // Cascade failure (degenerate input) — leave keyframes
        // absent so the SDK falls back to snap. Surface the
        // failure so a real cascade bug doesn't ship silently:
        // graceful degradation is intentional, but observability
        // is not optional. Authors and CI logs see the layer pair
        // and the underlying error.
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(
          `[export-compiled-icon] morph cascade failed for transition ` +
            `${transition.id} layer pair ` +
            `"${binding.fromLayerId}" → "${binding.toLayerId}": ${reason}. ` +
            `Emitting morph block without keyframes — SDK will snap.`,
        );
      }
    }
    compiled.morph = morph;
  }

  return compiled;
}

function compileStrategy(
  strategy: Transition['strategy'],
): CompiledTransition['strategy'] {
  switch (strategy) {
    case 'strictMorph':
      return 'strictMorph';
    case 'bestGuessMorph':
    case 'crossIconMorph':
      return 'bestGuessMorph';
    case 'replace':
      return 'replace';
    case 'lineAnimation':
    case 'auto':
    default:
      return 'track';
  }
}
