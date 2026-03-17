/**
 * Builder utilities for constructing NormalizedNode instances.
 *
 * These helpers enforce structural invariants (geometry.kind must match
 * node.kind, index must be assigned, sourceMeta.sourceTag must match kind)
 * and reduce boilerplate in adapters, the normalization layer, and tests.
 */

import type {
  NormalizedNode,
  NormalizedNodeKind,
  NormalizedGeometry,
  NormalizedStyle,
  NormalizedTransform,
  NormalizedSourceMeta,
  PathGeometry,
  RectGeometry,
  CircleGeometry,
  EllipseGeometry,
  LineGeometry,
  PolylineGeometry,
  PolygonGeometry,
  SvgUnsupportedFeature,
} from './types';

// ---------------------------------------------------------------------------
// Node builder options
// ---------------------------------------------------------------------------

type BaseNodeOptions = {
  style?: NormalizedStyle;
  transform?: NormalizedTransform;
  sourceNodeId?: string;
  sourceClassName?: string;
  originalTransform?: string;
  unsupported?: SvgUnsupportedFeature[];
};

// ---------------------------------------------------------------------------
// Index counter
// ---------------------------------------------------------------------------

/**
 * A simple counter that produces deterministic insertion-order indices.
 * Create one per `NormalizedIcon` being built.
 */
export class NodeIndexCounter {
  private current = 0;

  next(): number {
    return this.current++;
  }

  /** Current count (total nodes emitted). */
  get count(): number {
    return this.current;
  }
}

// ---------------------------------------------------------------------------
// Generic node builder
// ---------------------------------------------------------------------------

function buildNode(
  kind: NormalizedNodeKind,
  geometry: NormalizedGeometry,
  index: number,
  options: BaseNodeOptions,
): NormalizedNode {
  return {
    index,
    kind,
    geometry,
    style: options.style ?? {},
    transform: options.transform,
    sourceMeta: {
      sourceTag: kind,
      sourceNodeId: options.sourceNodeId,
      sourceClassName: options.sourceClassName,
      originalTransform: options.originalTransform,
      unsupported: options.unsupported ?? [],
    },
  };
}

// ---------------------------------------------------------------------------
// Per-kind builders
// ---------------------------------------------------------------------------

export function buildPathNode(
  geometry: Omit<PathGeometry, 'kind'>,
  index: number,
  options: BaseNodeOptions = {},
): NormalizedNode {
  return buildNode('path', { kind: 'path', ...geometry }, index, options);
}

export function buildRectNode(
  geometry: Omit<RectGeometry, 'kind'>,
  index: number,
  options: BaseNodeOptions = {},
): NormalizedNode {
  return buildNode('rect', { kind: 'rect', ...geometry }, index, options);
}

export function buildCircleNode(
  geometry: Omit<CircleGeometry, 'kind'>,
  index: number,
  options: BaseNodeOptions = {},
): NormalizedNode {
  return buildNode('circle', { kind: 'circle', ...geometry }, index, options);
}

export function buildEllipseNode(
  geometry: Omit<EllipseGeometry, 'kind'>,
  index: number,
  options: BaseNodeOptions = {},
): NormalizedNode {
  return buildNode('ellipse', { kind: 'ellipse', ...geometry }, index, options);
}

export function buildLineNode(
  geometry: Omit<LineGeometry, 'kind'>,
  index: number,
  options: BaseNodeOptions = {},
): NormalizedNode {
  return buildNode('line', { kind: 'line', ...geometry }, index, options);
}

export function buildPolylineNode(
  geometry: Omit<PolylineGeometry, 'kind'>,
  index: number,
  options: BaseNodeOptions = {},
): NormalizedNode {
  return buildNode('polyline', { kind: 'polyline', ...geometry }, index, options);
}

export function buildPolygonNode(
  geometry: Omit<PolygonGeometry, 'kind'>,
  index: number,
  options: BaseNodeOptions = {},
): NormalizedNode {
  return buildNode('polygon', { kind: 'polygon', ...geometry }, index, options);
}

export function buildGroupNode(
  children: NormalizedNode[],
  index: number,
  options: BaseNodeOptions = {},
): NormalizedNode {
  return {
    ...buildNode('group', { kind: 'group' }, index, options),
    children,
  };
}
