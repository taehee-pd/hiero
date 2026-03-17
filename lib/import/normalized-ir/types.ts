/**
 * Normalized Intermediate Representation (IR)
 *
 * This is the shared data format between:
 *   - Upstream: adapter output → sanitization → SVG parsing
 *   - Downstream: internal schema conversion (IR → Layer/Icon)
 *
 * Design principles:
 *   1. Plain data — no DOM types, no class instances, fully serializable.
 *   2. Deterministic ordering — nodes are in an ordered array (document order),
 *      not a keyed record.
 *   3. Preserves source shape kind — downstream can set `importMeta.sourceTag`
 *      without re-parsing.
 *   4. Reuses the schema's `PaintRef` and `SvgUnsupportedFeature` rather than
 *      inventing parallel models.
 *   5. Carries warnings alongside data so the pipeline can accumulate them
 *      without side channels.
 */

import type {
  PaintRef,
  GradientStop,
  SvgUnsupportedFeature,
} from '@/lib/schema/types';
import type {
  ExternalIconProvenance,
  ExternalIconWarning,
} from '../adapter-sdk/types';

// ---------------------------------------------------------------------------
// Top-level document
// ---------------------------------------------------------------------------

/**
 * A fully parsed, sanitised, normalised SVG icon ready for schema conversion.
 * This is the single handoff point between the normalisation layer and the
 * schema conversion layer.
 */
export type NormalizedIcon = {
  /** Suggested display name (from adapter or filename). */
  name: string;
  /** Suggested tags for the icon (from library metadata). */
  tags: string[];
  /** SVG viewBox as `[minX, minY, width, height]`. */
  viewBox: [number, number, number, number];
  /** Drawable nodes in document order. Order is deterministic and meaningful. */
  nodes: NormalizedNode[];
  /** Adapter-level provenance — becomes `Icon.meta.externalImport`. */
  provenance?: ExternalIconProvenance;
  /** Accumulated warnings from all pipeline stages. */
  warnings: ExternalIconWarning[];
};

// ---------------------------------------------------------------------------
// Node kinds
// ---------------------------------------------------------------------------

/**
 * The set of SVG element types the IR can represent.
 * `group` is included so the IR can faithfully model `<g>` containers when
 * the normalisation layer preserves tree structure (e.g. for clip paths).
 */
export type NormalizedNodeKind =
  | 'path'
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'polyline'
  | 'polygon'
  | 'group';

// ---------------------------------------------------------------------------
// Geometry payloads
// ---------------------------------------------------------------------------

/** Raw SVG path data. */
export type PathGeometry = {
  kind: 'path';
  /** The `d` attribute value. */
  d: string;
  fillRule?: 'nonzero' | 'evenodd';
};

export type RectGeometry = {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
  ry?: number;
};

export type CircleGeometry = {
  kind: 'circle';
  cx: number;
  cy: number;
  r: number;
};

export type EllipseGeometry = {
  kind: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

export type LineGeometry = {
  kind: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type PolylineGeometry = {
  kind: 'polyline';
  /** Flat array of [x, y] coordinate pairs. */
  points: number[];
};

export type PolygonGeometry = {
  kind: 'polygon';
  /** Flat array of [x, y] coordinate pairs. */
  points: number[];
};

export type GroupGeometry = {
  kind: 'group';
};

/**
 * Discriminated union of all geometry payloads.
 * The `kind` field matches the parent node's `kind`.
 */
export type NormalizedGeometry =
  | PathGeometry
  | RectGeometry
  | CircleGeometry
  | EllipseGeometry
  | LineGeometry
  | PolylineGeometry
  | PolygonGeometry
  | GroupGeometry;

// ---------------------------------------------------------------------------
// Style payload
// ---------------------------------------------------------------------------

/**
 * Resolved visual style for a node. Uses the schema's `PaintRef` for fills
 * and strokes so no conversion is needed downstream.
 *
 * All values are fully resolved — CSS inheritance and `currentColor` have
 * already been applied by the normalisation layer.
 */
export type NormalizedStyle = {
  fill?: PaintRef;
  stroke?: PaintRef;
  strokeWidth?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  visible?: boolean;
};

// ---------------------------------------------------------------------------
// Transform payload
// ---------------------------------------------------------------------------

/**
 * A decomposed affine transform.
 *
 * The normalisation layer decomposes the inherited SVG transform matrix into
 * these components when possible. When decomposition is not possible (e.g.
 * skew transforms), the transform is baked into the geometry and this field
 * is omitted.
 */
export type NormalizedTransform = {
  x?: number;
  y?: number;
  rotate?: number;
  scaleX?: number;
  scaleY?: number;
};

// ---------------------------------------------------------------------------
// Source metadata (per-node)
// ---------------------------------------------------------------------------

/**
 * Per-node metadata about the original SVG element.
 * Downstream uses this to populate `Layer.importMeta`.
 */
export type NormalizedSourceMeta = {
  /** The original SVG element tag name. */
  sourceTag: NormalizedNodeKind;
  /** The original `id` attribute, if present. */
  sourceNodeId?: string;
  /** The original `class` attribute, if present. */
  sourceClassName?: string;
  /** The original `transform` attribute string before decomposition. */
  originalTransform?: string;
  /** Unsupported SVG features encountered on this node. */
  unsupported: SvgUnsupportedFeature[];
};

// ---------------------------------------------------------------------------
// Normalized node
// ---------------------------------------------------------------------------

/**
 * A single drawable element in the normalised IR.
 *
 * Nodes are ordered by document order in the parent `NormalizedIcon.nodes`
 * array.  The `index` field captures the original insertion position so
 * ordering is deterministic even after filtering or transformation.
 */
export type NormalizedNode = {
  /** Deterministic insertion-order index (0-based). */
  index: number;
  /** Element kind — matches the geometry's `kind` discriminator. */
  kind: NormalizedNodeKind;
  /** Shape geometry. For groups, this is `{ kind: 'group' }`. */
  geometry: NormalizedGeometry;
  /** Fully resolved style (inheritance and currentColor already applied). */
  style: NormalizedStyle;
  /** Decomposed affine transform, if representable. */
  transform?: NormalizedTransform;
  /** Source SVG element metadata. */
  sourceMeta: NormalizedSourceMeta;
  /**
   * Children, only populated when `kind === 'group'`.
   * Leaf nodes have `undefined` children.
   */
  children?: NormalizedNode[];
};

// ---------------------------------------------------------------------------
// Re-exports for downstream convenience
// ---------------------------------------------------------------------------

export type { PaintRef, GradientStop, SvgUnsupportedFeature };
