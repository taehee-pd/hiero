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
import type {
  Effect,
  Icon,
  Layer,
  PaintRef,
  Project,
  TimelineTrack,
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
    transitions: [],
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
  return {
    kind: effect.kind,
    durationMs: effect.durationMs,
    easing: effect.easing ?? 'linear',
  };
}

function cloneCompiledTrack(
  track: TimelineTrack,
): NonNullable<CompiledLayerBinding['tracks']>[number] {
  return {
    property: track.property,
    keyframes:
      [...track.keyframes] as NonNullable<CompiledLayerBinding['tracks']>[number]['keyframes'],
  };
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
