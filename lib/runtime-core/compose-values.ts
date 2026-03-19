import type { InterpolatedValues } from './scheduler';

/**
 * Compose transition interpolated values with effect deltas.
 *
 * Composition rules:
 * - translateX, translateY, rotate: additive (effect adds to transition)
 * - scale: multiplicative (identity = 1)
 * - opacity: multiplicative (identity = 1)
 * - pathLength, strokeWidth, fillOpacity, strokeOpacity: effect overrides
 */
export function composeValues(
  transitionValues: InterpolatedValues,
  ...effectValueSets: InterpolatedValues[]
): InterpolatedValues {
  if (effectValueSets.length === 0) return transitionValues;

  // Collect all layer IDs across all sources
  const allLayerIds = new Set<string>();
  for (const key of Object.keys(transitionValues)) allLayerIds.add(key);
  for (const effectValues of effectValueSets) {
    for (const key of Object.keys(effectValues)) allLayerIds.add(key);
  }

  const result: InterpolatedValues = {};

  for (const layerId of allLayerIds) {
    const base = transitionValues[layerId];
    const composed: Record<string, number> = base ? { ...base } : {};

    for (const effectValues of effectValueSets) {
      const effect = effectValues[layerId];
      if (!effect) continue;

      for (const [prop, value] of Object.entries(effect)) {
        switch (prop) {
          // Additive properties
          case 'translateX':
          case 'translateY':
          case 'rotate':
            composed[prop] = (composed[prop] ?? 0) + value;
            break;

          // Multiplicative properties (identity = 1)
          case 'scale':
          case 'opacity':
            composed[prop] = (composed[prop] ?? 1) * value;
            break;

          // Override properties — effect replaces transition
          default:
            composed[prop] = value;
            break;
        }
      }
    }

    result[layerId] = composed;
  }

  return result;
}
