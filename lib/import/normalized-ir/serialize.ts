/**
 * Deterministic serialization for the Normalized IR.
 *
 * Used by tests to assert structural equality and by debugging tools to
 * produce reproducible snapshots.  The output is valid JSON with keys in
 * a stable, human-readable order.
 */

import type { NormalizedIcon, NormalizedNode } from './types';

// ---------------------------------------------------------------------------
// Key ordering tables
// ---------------------------------------------------------------------------

/** Canonical key order for NormalizedIcon. */
const ICON_KEY_ORDER: readonly (keyof NormalizedIcon)[] = [
  'name',
  'tags',
  'viewBox',
  'nodes',
  'provenance',
  'warnings',
];

/** Canonical key order for NormalizedNode. */
const NODE_KEY_ORDER: readonly (keyof NormalizedNode)[] = [
  'index',
  'kind',
  'geometry',
  'style',
  'transform',
  'sourceMeta',
  'children',
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Serialize a `NormalizedIcon` to a deterministic JSON string.
 *
 * Guarantees:
 *   - Top-level keys appear in the canonical order defined above.
 *   - Node keys appear in the canonical order defined above.
 *   - Nested objects use alphabetically sorted keys (for paint refs,
 *     unsupported features, etc.).
 *   - `undefined` values are omitted (standard JSON.stringify behaviour).
 *   - Output is formatted with 2-space indentation for readability.
 */
export function serializeNormalizedIcon(icon: NormalizedIcon): string {
  return JSON.stringify(icon, orderedReplacer(ICON_KEY_ORDER, NODE_KEY_ORDER), 2);
}

/**
 * Deserialize a JSON string back into a `NormalizedIcon`.
 * No validation is performed — use `validateNormalizedIcon` for that.
 */
export function deserializeNormalizedIcon(json: string): NormalizedIcon {
  return JSON.parse(json) as NormalizedIcon;
}

// ---------------------------------------------------------------------------
// Replacer
// ---------------------------------------------------------------------------

/**
 * Build a JSON.stringify replacer that enforces key ordering.
 *
 * Strategy:
 *   - If the value looks like a NormalizedIcon (has `nodes` + `viewBox`),
 *     apply ICON_KEY_ORDER.
 *   - If the value looks like a NormalizedNode (has `kind` + `geometry`),
 *     apply NODE_KEY_ORDER.
 *   - For all other objects, sort keys alphabetically.
 *   - Arrays and primitives pass through unchanged.
 */
function orderedReplacer(
  iconKeys: readonly string[],
  nodeKeys: readonly string[],
): (this: unknown, key: string, value: unknown) => unknown {
  return function (_key: string, value: unknown): unknown {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }

    const obj = value as Record<string, unknown>;

    // Detect NormalizedIcon
    if ('nodes' in obj && 'viewBox' in obj) {
      return reorderKeys(obj, iconKeys);
    }

    // Detect NormalizedNode
    if ('kind' in obj && 'geometry' in obj && 'sourceMeta' in obj) {
      return reorderKeys(obj, nodeKeys);
    }

    // Default: alphabetical key order
    return reorderKeys(obj, Object.keys(obj).sort());
  };
}

/**
 * Return a new object with keys in the specified order.
 * Keys present in `order` come first (in that order), followed by any
 * remaining keys in alphabetical order.
 */
function reorderKeys(
  obj: Record<string, unknown>,
  order: readonly string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const seen = new Set<string>();

  for (const key of order) {
    if (key in obj && obj[key] !== undefined) {
      result[key] = obj[key];
      seen.add(key);
    }
  }

  // Append any remaining keys not in the order table
  const remaining = Object.keys(obj).filter((k) => !seen.has(k)).sort();
  for (const key of remaining) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }

  return result;
}
