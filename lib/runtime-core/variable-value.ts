/**
 * Variable Value System (Phase H, Task H1)
 *
 * Computes per-layer opacity and visibility based on a normalised
 * variableValue (0.0–1.0).  Layers are bucketed by their `role`:
 *
 *   primary   → visible when value >  0      (range 0.00 – 0.33)
 *   secondary → visible when value > 0.33    (range 0.33 – 0.66)
 *   tertiary  → visible when value > 0.66    (range 0.66 – 1.00)
 *
 * Within each tier the opacity ramps linearly from 0 to 1.
 * Layers that are explicitly hidden (visible === false) are skipped.
 */

export type VariableValueResult = Record<
  string,
  { opacity: number; visible: boolean }
>;

// Threshold ranges per role
const ROLE_THRESHOLDS: Record<string, [start: number, end: number]> = {
  primary: [0, 0.33],
  secondary: [0.33, 0.66],
  tertiary: [0.66, 1.0],
};

/**
 * Compute layer opacity/visibility based on variableValue (0.0-1.0).
 *
 * Layer roles determine fill order:
 * - primary layers: visible when value > 0
 * - secondary layers: visible when value > 0.33
 * - tertiary layers: visible when value > 0.66
 *
 * Within each tier, opacity ramps from 0 to 1 across the tier's range.
 * Layers without roles are treated as primary.
 */
export function computeVariableValue(
  layers: Record<string, { role?: string; visible?: boolean }>,
  variableValue: number,
): VariableValueResult {
  const clamped = Math.max(0, Math.min(1, variableValue));
  const result: VariableValueResult = {};

  for (const [layerId, layer] of Object.entries(layers)) {
    // Skip explicitly hidden layers — preserve their hidden state
    if (layer.visible === false) {
      result[layerId] = { opacity: 0, visible: false };
      continue;
    }

    const role = layer.role ?? 'primary';
    const [start, end] = ROLE_THRESHOLDS[role] ?? ROLE_THRESHOLDS.primary;

    if (clamped <= start) {
      result[layerId] = { opacity: 0, visible: false };
    } else if (clamped >= end) {
      result[layerId] = { opacity: 1, visible: true };
    } else {
      const opacity = (clamped - start) / (end - start);
      result[layerId] = { opacity, visible: true };
    }
  }

  return result;
}
