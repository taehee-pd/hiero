import type { InterpolatedValues, LayerInterpolatedValues } from './scheduler';

/**
 * Compose transition interpolated values with effect deltas.
 *
 * Composition rules:
 * - translateX, translateY, rotate: additive (effect adds to transition)
 * - scale: multiplicative (identity = 1)
 * - opacity: multiplicative (identity = 1)
 * - pathLength, strokeWidth, fillOpacity, strokeOpacity, fill, stroke: effect overrides
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
    const composed: LayerInterpolatedValues = base ? { ...base } : {};

    for (const effectValues of effectValueSets) {
      const effect = effectValues[layerId];
      if (!effect) continue;

      for (const [prop, value] of Object.entries(effect)) {
        // String values (e.g. fill/stroke colors) always override
        if (typeof value === 'string') {
          composed[prop] = value;
          continue;
        }

        const numValue = value as number;
        switch (prop) {
          // Additive properties
          case 'translateX':
          case 'translateY':
          case 'rotate': {
            const existing = composed[prop];
            composed[prop] = (typeof existing === 'number' ? existing : 0) + numValue;
            break;
          }

          // Multiplicative properties (identity = 1)
          case 'scale':
          case 'opacity': {
            const existing = composed[prop];
            composed[prop] = (typeof existing === 'number' ? existing : 1) * numValue;
            break;
          }

          // Override properties — effect replaces transition
          default:
            composed[prop] = numValue;
            break;
        }
      }
    }

    result[layerId] = composed;
  }

  return result;
}
