import type {
  CompiledEffect,
  CompiledIcon,
  CompiledLayer,
  CompiledRenderingMode,
  IconChange,
  IconChangeRecord,
  IconVersionBump,
} from '@/lib/compiler-contracts';
import {
  ICON_CHANGE_RECORD_SCHEMA_URI,
  isIconChangeRecord,
} from '@/lib/compiler-contracts';

export type DiffCompiledIconsOptions = {
  publishedAt?: string;
  designerNote?: string;
  breakingOverride?: boolean;
};

const MODE_ORDER: CompiledRenderingMode[] = [
  'monochrome',
  'hierarchical',
  'palette',
  'multicolor',
];

export function diffCompiledIcons(
  previous: CompiledIcon,
  next: CompiledIcon,
  options?: DiffCompiledIconsOptions,
): IconChangeRecord {
  const changes: IconChange[] = [];

  diffMetadata(previous, next, changes);
  diffVariants(previous, next, changes);
  diffAnimation(previous, next, changes);
  diffEffects(previous.effects, next.effects, changes);

  const isBreakingByChanges = changes.some((change) => change.breaking);
  const isBreaking = options?.breakingOverride ?? isBreakingByChanges;

  if (isBreaking) {
    const hasBreakingChange = changes.some((change) => change.kind === 'breaking');
    if (!hasBreakingChange) {
      changes.push({
        kind: 'breaking',
        summary:
          options?.breakingOverride === true
            ? 'Marked as breaking by manual override.'
            : 'Contains one or more breaking removals.',
        breaking: true,
      });
    }
  }

  const record: IconChangeRecord = {
    $schema: ICON_CHANGE_RECORD_SCHEMA_URI,
    iconId: next.id,
    iconName: next.name,
    componentName: next.componentName,
    fromVersion: previous.meta.version,
    toVersion: next.meta.version,
    publishedAt: options?.publishedAt ?? new Date().toISOString(),
    bump: deriveBump(changes, isBreaking),
    isBreaking,
    designerNote: options?.designerNote,
    changes,
  };

  validateIconChangeRecordOrThrow(record);
  return record;
}

export function validateIconChangeRecordOrThrow(
  value: unknown,
): asserts value is IconChangeRecord {
  if (!isIconChangeRecord(value)) {
    throw new Error('Malformed IconChangeRecord payload.');
  }
}

function diffMetadata(previous: CompiledIcon, next: CompiledIcon, changes: IconChange[]): void {
  const metadataChanges: string[] = [];

  if (previous.name !== next.name) {
    metadataChanges.push(`name: "${previous.name}" -> "${next.name}"`);
  }
  if (previous.componentName !== next.componentName) {
    metadataChanges.push(
      `componentName: "${previous.componentName}" -> "${next.componentName}"`,
    );
  }
  if (previous.meta.category !== next.meta.category) {
    metadataChanges.push(
      `category: "${previous.meta.category}" -> "${next.meta.category}"`,
    );
  }

  const prevTags = [...previous.meta.tags].sort((a, b) => a.localeCompare(b));
  const nextTags = [...next.meta.tags].sort((a, b) => a.localeCompare(b));
  if (prevTags.join('|') !== nextTags.join('|')) {
    metadataChanges.push(
      `tags: [${prevTags.join(', ')}] -> [${nextTags.join(', ')}]`,
    );
  }

  if (metadataChanges.length > 0) {
    changes.push({
      kind: 'metadata',
      summary: `Metadata updated (${metadataChanges.join('; ')}).`,
      breaking: false,
    });
  }
}

function diffVariants(previous: CompiledIcon, next: CompiledIcon, changes: IconChange[]): void {
  const previousVariantIds = new Set(Object.keys(previous.variants));
  const nextVariantIds = new Set(Object.keys(next.variants));

  for (const variantId of [...nextVariantIds].sort((a, b) => a.localeCompare(b))) {
    if (!previousVariantIds.has(variantId)) {
      const size = next.variants[variantId]!.size;
      changes.push({
        kind: 'variant-added',
        summary: `Added variant ${variantId} (${size}px).`,
        breaking: false,
        scope: { variantSize: size },
      });
    }
  }

  for (const variantId of [...previousVariantIds].sort((a, b) => a.localeCompare(b))) {
    if (!nextVariantIds.has(variantId)) {
      const size = previous.variants[variantId]!.size;
      changes.push({
        kind: 'variant-removed',
        summary: `Removed variant ${variantId} (${size}px).`,
        breaking: true,
        scope: { variantSize: size },
      });
    }
  }

  for (const variantId of [...previousVariantIds].sort((a, b) => a.localeCompare(b))) {
    if (!nextVariantIds.has(variantId)) continue;
    const prevVariant = previous.variants[variantId]!;
    const nextVariant = next.variants[variantId]!;
    diffStates(prevVariant.size, prevVariant.states, nextVariant.states, changes);
  }
}

function diffStates(
  variantSize: number,
  previousStates: Record<string, { modes: Record<CompiledRenderingMode, { layers: CompiledLayer[] }> }>,
  nextStates: Record<string, { modes: Record<CompiledRenderingMode, { layers: CompiledLayer[] }> }>,
  changes: IconChange[],
): void {
  const previousStateIds = new Set(Object.keys(previousStates));
  const nextStateIds = new Set(Object.keys(nextStates));

  for (const stateId of [...nextStateIds].sort((a, b) => a.localeCompare(b))) {
    if (!previousStateIds.has(stateId)) {
      changes.push({
        kind: 'state-added',
        summary: `Added state "${stateId}" for ${variantSize}px variant.`,
        breaking: false,
        scope: { variantSize, stateId },
      });
    }
  }

  for (const stateId of [...previousStateIds].sort((a, b) => a.localeCompare(b))) {
    if (!nextStateIds.has(stateId)) {
      changes.push({
        kind: 'state-removed',
        summary: `Removed state "${stateId}" for ${variantSize}px variant.`,
        breaking: true,
        scope: { variantSize, stateId },
      });
    }
  }

  for (const stateId of [...previousStateIds].sort((a, b) => a.localeCompare(b))) {
    if (!nextStateIds.has(stateId)) continue;
    const previousModes = previousStates[stateId]!.modes;
    const nextModes = nextStates[stateId]!.modes;

    const previousModeKeys = new Set(Object.keys(previousModes) as CompiledRenderingMode[]);
    const nextModeKeys = new Set(Object.keys(nextModes) as CompiledRenderingMode[]);

    for (const mode of MODE_ORDER) {
      const had = previousModeKeys.has(mode);
      const has = nextModeKeys.has(mode);

      if (!had && has) {
        changes.push({
          kind: 'mode-added',
          summary: `Added ${mode} mode to state "${stateId}" (${variantSize}px).`,
          breaking: false,
          scope: { variantSize, stateId, renderingMode: mode },
        });
        continue;
      }

      if (had && !has) {
        changes.push({
          kind: 'mode-removed',
          summary: `Removed ${mode} mode from state "${stateId}" (${variantSize}px).`,
          breaking: true,
          scope: { variantSize, stateId, renderingMode: mode },
        });
        continue;
      }

      if (!had || !has) continue;

      diffLayerSets(
        variantSize,
        stateId,
        mode,
        previousModes[mode].layers,
        nextModes[mode].layers,
        changes,
      );
    }
  }
}

function diffLayerSets(
  variantSize: number,
  stateId: string,
  mode: CompiledRenderingMode,
  previousLayers: CompiledLayer[],
  nextLayers: CompiledLayer[],
  changes: IconChange[],
): void {
  const previousById = new Map(previousLayers.map((layer) => [layer.id, layer]));
  const nextById = new Map(nextLayers.map((layer) => [layer.id, layer]));

  const commonLayerIds = [...previousById.keys()]
    .filter((layerId) => nextById.has(layerId))
    .sort((a, b) => a.localeCompare(b));

  for (const layerId of commonLayerIds) {
    const prevLayer = previousById.get(layerId)!;
    const nextLayer = nextById.get(layerId)!;

    if (hasGeometryChange(prevLayer, nextLayer)) {
      changes.push({
        kind: 'geometry',
        summary: `Geometry updated for layer "${layerId}" in ${mode}/${stateId} (${variantSize}px).`,
        breaking: false,
        scope: { variantSize, stateId, layerId, renderingMode: mode },
      });
    }

    if (hasStyleChange(prevLayer, nextLayer)) {
      changes.push({
        kind: 'style',
        summary: `Style updated for layer "${layerId}" in ${mode}/${stateId} (${variantSize}px).`,
        breaking: false,
        scope: { variantSize, stateId, layerId, renderingMode: mode },
      });
    }
  }
}

function hasGeometryChange(previous: CompiledLayer, next: CompiledLayer): boolean {
  return (
    previous.path.d !== next.path.d ||
    previous.path.fillRule !== next.path.fillRule ||
    serializeCanonical(previous.transform) !== serializeCanonical(next.transform)
  );
}

function hasStyleChange(previous: CompiledLayer, next: CompiledLayer): boolean {
  return (
    previous.style.fill !== next.style.fill ||
    previous.style.fillOpacity !== next.style.fillOpacity ||
    previous.style.stroke !== next.style.stroke ||
    previous.style.strokeOpacity !== next.style.strokeOpacity ||
    previous.style.strokeWidth !== next.style.strokeWidth ||
    previous.style.lineCap !== next.style.lineCap ||
    previous.style.lineJoin !== next.style.lineJoin
  );
}

function diffAnimation(previous: CompiledIcon, next: CompiledIcon, changes: IconChange[]): void {
  const hadAnimation = previous.transitions.length > 0 || previous.effects.length > 0;
  const hasAnimation = next.transitions.length > 0 || next.effects.length > 0;

  if (!hadAnimation && hasAnimation) {
    changes.push({
      kind: 'animation-added',
      summary: 'Animation capability added.',
      breaking: false,
    });
    return;
  }

  if (hadAnimation && !hasAnimation) {
    changes.push({
      kind: 'animation-removed',
      summary: 'Animation capability removed.',
      breaking: true,
    });
    return;
  }

  if (hadAnimation && hasAnimation) {
    const previousSignature = serializeCanonical(previous.transitions);
    const nextSignature = serializeCanonical(next.transitions);

    if (previousSignature !== nextSignature) {
      changes.push({
        kind: 'animation-changed',
        summary: 'Animation transitions changed.',
        breaking: false,
      });
    }
  }
}

function diffEffects(previous: CompiledEffect[], next: CompiledEffect[], changes: IconChange[]): void {
  const previousCounts = countByKind(previous);
  const nextCounts = countByKind(next);
  const allKinds = new Set([...Object.keys(previousCounts), ...Object.keys(nextCounts)]);

  for (const kind of [...allKinds].sort((a, b) => a.localeCompare(b))) {
    const prevCount = previousCounts[kind] ?? 0;
    const nextCount = nextCounts[kind] ?? 0;

    if (nextCount > prevCount) {
      changes.push({
        kind: 'effect-added',
        summary: `Added effect "${kind}".`,
        breaking: false,
        scope: { effectKind: kind as CompiledEffect['kind'] },
      });
    }

    if (nextCount < prevCount) {
      changes.push({
        kind: 'effect-removed',
        summary: `Removed effect "${kind}".`,
        breaking: true,
        scope: { effectKind: kind as CompiledEffect['kind'] },
      });
    }
  }
}

function deriveBump(changes: IconChange[], isBreaking: boolean): IconVersionBump {
  if (isBreaking || changes.some((change) => change.breaking)) return 'major';

  const hasAdditiveChange = changes.some((change) =>
    [
      'state-added',
      'variant-added',
      'mode-added',
      'animation-added',
      'effect-added',
    ].includes(change.kind),
  );

  if (hasAdditiveChange) return 'minor';
  return 'patch';
}

function countByKind(effects: CompiledEffect[]): Record<string, number> {
  return effects.reduce<Record<string, number>>((acc, effect) => {
    acc[effect.kind] = (acc[effect.kind] ?? 0) + 1;
    return acc;
  }, {});
}

function serializeCanonical(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);

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
