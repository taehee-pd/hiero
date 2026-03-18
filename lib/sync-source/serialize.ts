/**
 * Deterministic JSON serializer for sync-source payloads.
 *
 * Guarantees:
 * - Object keys are sorted lexicographically at every nesting level
 * - `undefined` values are omitted (JSON.stringify does this, but we also
 *   strip them from intermediate objects to keep snapshots clean)
 * - Output is stable across runs for the same input
 */

export function serializeSourceJson(value: unknown): string {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortValue(v)] as const),
    );
  }

  return value;
}
