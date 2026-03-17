/**
 * Structural validation for NormalizedIcon and NormalizedNode.
 *
 * Used in tests and at the pipeline boundary to catch malformed IR early.
 * Returns an array of human-readable error strings (empty = valid).
 */

import type { NormalizedIcon, NormalizedNode, NormalizedNodeKind } from './types';

const VALID_KINDS = new Set<NormalizedNodeKind>([
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'group',
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a `NormalizedIcon` for structural correctness.
 * Returns an empty array if valid, or an array of error messages.
 */
export function validateNormalizedIcon(icon: unknown): string[] {
  const errors: string[] = [];

  if (!icon || typeof icon !== 'object') {
    return ['Expected an object'];
  }

  const obj = icon as Record<string, unknown>;

  // name
  if (typeof obj.name !== 'string' || obj.name.length === 0) {
    errors.push('name: must be a non-empty string');
  }

  // tags
  if (!Array.isArray(obj.tags)) {
    errors.push('tags: must be an array');
  }

  // viewBox
  if (!isViewBox(obj.viewBox)) {
    errors.push('viewBox: must be a [number, number, number, number] tuple');
  }

  // warnings
  if (!Array.isArray(obj.warnings)) {
    errors.push('warnings: must be an array');
  }

  // nodes
  if (!Array.isArray(obj.nodes)) {
    errors.push('nodes: must be an array');
  } else {
    const nodes = obj.nodes as unknown[];
    // Verify deterministic ordering
    for (let i = 0; i < nodes.length; i++) {
      const nodeErrors = validateNormalizedNode(nodes[i], `nodes[${i}]`);
      errors.push(...nodeErrors);

      // Index must match array position
      if (
        nodes[i] &&
        typeof nodes[i] === 'object' &&
        (nodes[i] as Record<string, unknown>).index !== i
      ) {
        errors.push(
          `nodes[${i}].index: expected ${i}, got ${(nodes[i] as Record<string, unknown>).index}`,
        );
      }
    }
  }

  return errors;
}

/**
 * Validate a single `NormalizedNode`.
 */
export function validateNormalizedNode(node: unknown, path = 'node'): string[] {
  const errors: string[] = [];

  if (!node || typeof node !== 'object') {
    errors.push(`${path}: expected an object`);
    return errors;
  }

  const obj = node as Record<string, unknown>;

  // index
  if (typeof obj.index !== 'number' || !Number.isInteger(obj.index) || obj.index < 0) {
    errors.push(`${path}.index: must be a non-negative integer`);
  }

  // kind
  if (typeof obj.kind !== 'string' || !VALID_KINDS.has(obj.kind as NormalizedNodeKind)) {
    errors.push(`${path}.kind: must be one of ${Array.from(VALID_KINDS).join(', ')}`);
  }

  // geometry
  if (!obj.geometry || typeof obj.geometry !== 'object') {
    errors.push(`${path}.geometry: must be an object`);
  } else {
    const geo = obj.geometry as Record<string, unknown>;
    if (geo.kind !== obj.kind) {
      errors.push(
        `${path}.geometry.kind: must match node kind "${obj.kind}", got "${geo.kind}"`,
      );
    }
    const geoErrors = validateGeometry(geo, obj.kind as NormalizedNodeKind, path);
    errors.push(...geoErrors);
  }

  // style
  if (!obj.style || typeof obj.style !== 'object') {
    errors.push(`${path}.style: must be an object`);
  }

  // sourceMeta
  if (!obj.sourceMeta || typeof obj.sourceMeta !== 'object') {
    errors.push(`${path}.sourceMeta: must be an object`);
  } else {
    const meta = obj.sourceMeta as Record<string, unknown>;
    if (!VALID_KINDS.has(meta.sourceTag as NormalizedNodeKind)) {
      errors.push(`${path}.sourceMeta.sourceTag: must be a valid node kind`);
    }
    if (!Array.isArray(meta.unsupported)) {
      errors.push(`${path}.sourceMeta.unsupported: must be an array`);
    }
  }

  // children — only valid for groups
  if (obj.kind === 'group' && obj.children !== undefined) {
    if (!Array.isArray(obj.children)) {
      errors.push(`${path}.children: must be an array when present`);
    } else {
      for (let i = 0; i < (obj.children as unknown[]).length; i++) {
        const childErrors = validateNormalizedNode(
          (obj.children as unknown[])[i],
          `${path}.children[${i}]`,
        );
        errors.push(...childErrors);
      }
    }
  } else if (obj.kind !== 'group' && obj.children !== undefined) {
    errors.push(`${path}.children: only group nodes may have children`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Geometry validation
// ---------------------------------------------------------------------------

function validateGeometry(
  geo: Record<string, unknown>,
  kind: NormalizedNodeKind,
  path: string,
): string[] {
  const errors: string[] = [];
  const prefix = `${path}.geometry`;

  switch (kind) {
    case 'path':
      if (typeof geo.d !== 'string' || geo.d.length === 0) {
        errors.push(`${prefix}.d: must be a non-empty string`);
      }
      break;
    case 'rect':
      for (const field of ['x', 'y', 'width', 'height'] as const) {
        if (typeof geo[field] !== 'number') {
          errors.push(`${prefix}.${field}: must be a number`);
        }
      }
      break;
    case 'circle':
      for (const field of ['cx', 'cy', 'r'] as const) {
        if (typeof geo[field] !== 'number') {
          errors.push(`${prefix}.${field}: must be a number`);
        }
      }
      break;
    case 'ellipse':
      for (const field of ['cx', 'cy', 'rx', 'ry'] as const) {
        if (typeof geo[field] !== 'number') {
          errors.push(`${prefix}.${field}: must be a number`);
        }
      }
      break;
    case 'line':
      for (const field of ['x1', 'y1', 'x2', 'y2'] as const) {
        if (typeof geo[field] !== 'number') {
          errors.push(`${prefix}.${field}: must be a number`);
        }
      }
      break;
    case 'polyline':
    case 'polygon':
      if (!Array.isArray(geo.points)) {
        errors.push(`${prefix}.points: must be an array`);
      } else if ((geo.points as number[]).length % 2 !== 0) {
        errors.push(`${prefix}.points: must have an even number of values (x,y pairs)`);
      }
      break;
    case 'group':
      // No geometry fields required
      break;
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isViewBox(value: unknown): value is [number, number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((v) => typeof v === 'number' && Number.isFinite(v))
  );
}
