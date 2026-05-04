/**
 * Contour tree — closed/fillable subpath hierarchy.
 *
 * Builds a parent/child tree of fillable subpaths from a canonical
 * path. Open subpaths are returned as a separate flat list and do not
 * participate in the tree. Parent/child relationship is determined by
 * polygon containment under the layer's `fillRule`. Depth alternates
 * `outer → hole → island → hole-in-island → …`.
 *
 * Plan: docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §2.2,
 * docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §4.2.
 *
 * @module
 */
import type { Point } from './intrinsic-interpolation';
import type { CanonicalPath } from './path-normalization';

export type FillRule = 'nonzero' | 'evenodd';

// `Point` re-export elided to avoid colliding with
// `intrinsic-interpolation.ts`'s identically-shaped `Point` when
// both modules are barrel-exported via `lib/runtime-core/index.ts`.
// Consumers needing the type import it from `intrinsic-interpolation`
// directly (or via the runtime-core barrel).
export type { Point };

/**
 * One subpath's outline as a polygon ring. The ring is always
 * sampled from the subpath's control-point endpoints (start +
 * each command's endpoint). For curve-heavy contours this is an
 * approximation suitable for *containment* testing — not for
 * rendering.
 */
export type ContourRing = {
  /** Index of the subpath inside the canonical path's subpath list. */
  subpathIndex: number;
  /** Sampled outline points. First point is the moveTo target. */
  points: Point[];
  /** Shoelace signed area. Positive = clockwise (in screen coords). */
  signedArea: number;
  /** `true` when the subpath ends with `Z` (or is otherwise closed). */
  closed: boolean;
  /** Bounding box of the sampled points. */
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
};

export type ContourNode = {
  /** Index into `ContourTree.rings`. */
  ringIndex: number;
  /** `null` for root rings (depth 0). */
  parent: number | null;
  /** Indices into `ContourTree.nodes`. */
  children: number[];
  /** 0 = outer, 1 = hole, 2 = island, … */
  depth: number;
};

export type ContourTree = {
  rings: ContourRing[];
  nodes: ContourNode[];
  /** Indices into `nodes` for root (depth-0) rings. */
  rootIds: number[];
  /** Indices into the canonical path's subpath list for *open* subpaths. */
  openSubpathIndices: number[];
  fillRule: FillRule;
};

/**
 * Build a contour tree from a canonical path. The `fillRule` controls
 * how containment is interpreted but does not change the tree shape —
 * the tree records geometric containment; consumers (resolver, cost
 * matrices) use `fillRule` plus the tree to decide rendering and
 * matching semantics.
 */
export function buildContourTree(
  canonical: CanonicalPath,
  fillRule: FillRule = 'nonzero',
): ContourTree {
  const subpaths = extractSubpaths(canonical.d, canonical.stats.closed);

  const rings: ContourRing[] = [];
  const openSubpathIndices: number[] = [];

  for (const sub of subpaths) {
    if (!sub.closed || sub.points.length < 3) {
      // Open subpaths and degenerate (≤ 2 point) "rings" are excluded
      // from the tree. The ≤ 2 point cutoff treats degenerate moveTo +
      // close as open, which matches what a renderer will draw.
      openSubpathIndices.push(sub.subpathIndex);
      continue;
    }
    rings.push({
      subpathIndex: sub.subpathIndex,
      points: sub.points,
      signedArea: signedArea(sub.points),
      closed: true,
      bbox: bboxOf(sub.points),
    });
  }

  const nodes: ContourNode[] = rings.map((_, i) => ({
    ringIndex: i,
    parent: null,
    children: [],
    depth: 0,
  }));

  // Parent = the smallest enclosing ring (largest |area| amongst
  // those that contain ring i's representative point and that are
  // not ring i itself). Smallest-enclosing scoping prevents a deep
  // ring from being attached to the outermost ancestor.
  for (let i = 0; i < rings.length; i++) {
    const repPoint = representativePoint(rings[i]!);
    let bestParent = -1;
    let bestParentArea = Number.POSITIVE_INFINITY;
    for (let j = 0; j < rings.length; j++) {
      if (i === j) continue;
      const candidate = rings[j]!;
      if (!pointInRing(repPoint, candidate)) continue;
      const area = Math.abs(candidate.signedArea);
      if (area < bestParentArea) {
        bestParentArea = area;
        bestParent = j;
      }
    }
    if (bestParent >= 0) {
      nodes[i]!.parent = bestParent;
      nodes[bestParent]!.children.push(i);
    }
  }

  // Compute depth by walking up from each node. Cycles are
  // impossible (containment is acyclic), so an upper bound of
  // `nodes.length` always terminates.
  for (let i = 0; i < nodes.length; i++) {
    let depth = 0;
    let cursor = nodes[i]!.parent;
    let safety = nodes.length;
    while (cursor !== null && safety > 0) {
      depth += 1;
      cursor = nodes[cursor]!.parent;
      safety -= 1;
    }
    nodes[i]!.depth = depth;
  }

  const rootIds = nodes
    .map((node, i) => (node.parent === null ? i : -1))
    .filter((i) => i >= 0);

  return { rings, nodes, rootIds, openSubpathIndices, fillRule };
}

// ---------------------------------------------------------------------------
// Subpath extraction
// ---------------------------------------------------------------------------

type ExtractedSubpath = {
  subpathIndex: number;
  points: Point[];
  closed: boolean;
};

/**
 * Pull subpaths out of a canonical `d` string, sampling each command's
 * *endpoint* as a polygon vertex. Curves are approximated by their
 * endpoints — adequate for containment testing on icon-scale shapes.
 *
 * `closedFlags` is the per-subpath `closed` array from `GeometryStats`,
 * used as the source of truth for closure.
 */
function extractSubpaths(d: string, closedFlags: boolean[]): ExtractedSubpath[] {
  const tokens = tokenize(d);
  const result: ExtractedSubpath[] = [];
  let current: ExtractedSubpath | null = null;
  let cursor = 0;
  // Cursor-position trackers for the SVG path parser. Written by
  // every command that consumes coordinates and read by the M case
  // when seeding a new subpath. The first valid path always begins
  // with M which overwrites the initial values; declared with the
  // definite-assignment assertion to satisfy TS without seeding a
  // dead `= 0` the lint would flag.
  let cx!: number;
  let cy!: number;

  function readNumber(): number {
    return Number.parseFloat(tokens[cursor++] ?? '0');
  }

  function pushPoint(x: number, y: number) {
    if (!current) return;
    current.points.push({ x, y });
    cx = x;
    cy = y;
  }

  while (cursor < tokens.length) {
    const token = tokens[cursor++];
    if (!token || !/^[a-zA-Z]$/.test(token)) continue;
    const upper = token.toUpperCase();
    switch (upper) {
      case 'M': {
        if (current) result.push(current);
        const subpathIndex = result.length;
        cx = readNumber();
        cy = readNumber();
        current = {
          subpathIndex,
          points: [{ x: cx, y: cy }],
          closed: closedFlags[subpathIndex] ?? false,
        };
        // Implicit lineTo for additional pairs after M.
        while (hasNumberPair(tokens, cursor)) {
          pushPoint(readNumber(), readNumber());
        }
        break;
      }
      case 'L':
        while (hasNumberPair(tokens, cursor)) {
          pushPoint(readNumber(), readNumber());
        }
        break;
      case 'Q':
        while (hasNumberPair(tokens, cursor) && hasNumberPair(tokens, cursor + 2)) {
          // skip control point; sample endpoint
          readNumber();
          readNumber();
          pushPoint(readNumber(), readNumber());
        }
        break;
      case 'C':
        while (
          hasNumberPair(tokens, cursor) &&
          hasNumberPair(tokens, cursor + 2) &&
          hasNumberPair(tokens, cursor + 4)
        ) {
          readNumber();
          readNumber();
          readNumber();
          readNumber();
          pushPoint(readNumber(), readNumber());
        }
        break;
      case 'A':
        while (
          hasNumber(tokens, cursor) &&
          hasNumber(tokens, cursor + 1) &&
          hasNumber(tokens, cursor + 2) &&
          hasNumber(tokens, cursor + 3) &&
          hasNumber(tokens, cursor + 4) &&
          hasNumberPair(tokens, cursor + 5)
        ) {
          readNumber(); // rx
          readNumber(); // ry
          readNumber(); // rotation
          readNumber(); // large-arc flag
          readNumber(); // sweep flag
          pushPoint(readNumber(), readNumber());
        }
        break;
      case 'Z':
        // Closure is recorded via `closedFlags`; the cursor
        // position is irrelevant after Z because the next
        // command in canonical output is always an M (which
        // re-seeds cx/cy).
        break;
      default:
        // canonicalizePath emits absolute M / L / Q / C / A / Z only.
        break;
    }
  }

  if (current) result.push(current);
  return result;
}

function tokenize(d: string): string[] {
  const matches = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g);
  return matches ?? [];
}

function hasNumber(tokens: string[], index: number): boolean {
  const token = tokens[index];
  if (!token) return false;
  return /^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(token);
}

function hasNumberPair(tokens: string[], index: number): boolean {
  return hasNumber(tokens, index) && hasNumber(tokens, index + 1);
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * Shoelace signed area. Positive = clockwise in screen coordinates
 * (where `+y` points down, so visually clockwise = mathematically
 * negative; we follow the SVG convention here).
 */
function signedArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function bboxOf(points: Point[]) {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = points[0]!.x;
  let minY = points[0]!.y;
  let maxX = minX;
  let maxY = minY;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Pick a point guaranteed to lie strictly inside the ring's interior
 * AND close enough to the ring's own boundary that it cannot
 * coincidentally lie inside an unrelated nested ring.
 *
 * The classic "polygon centroid" approach fails for the donut case:
 * an outer ring's centroid can sit inside its own hole. So we walk
 * the ring's edges, take each midpoint, and offset it by a small ε
 * perpendicular toward the interior side (sign determined by the
 * signed area). The first edge whose offset lands inside the ring
 * wins. As a degenerate fallback, fall back to the first vertex.
 */
function representativePoint(ring: ContourRing): Point {
  // Interior side of an edge: for a clockwise (positive signed
  // area in screen coords) ring, the *right-hand* normal points
  // outward, so the *left-hand* normal points inward. Negate for
  // counter-clockwise rings.
  const interiorSign = ring.signedArea >= 0 ? -1 : +1;
  const span = Math.max(
    ring.bbox.maxX - ring.bbox.minX,
    ring.bbox.maxY - ring.bbox.minY,
    1,
  );
  // ε is small relative to the ring's own size so that a) the offset
  // point is unambiguously inside this ring even at its narrowest
  // pinch, and b) it is far away from any unrelated ring's interior.
  const eps = span * 1e-3;
  for (let i = 0; i < ring.points.length; i++) {
    const a = ring.points[i]!;
    const b = ring.points[(i + 1) % ring.points.length]!;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;
    const nx = (-dy / len) * interiorSign;
    const ny = (dx / len) * interiorSign;
    const candidate = { x: mx + nx * eps, y: my + ny * eps };
    if (pointInRing(candidate, ring)) return candidate;
  }

  // Pathological fallback (vertex-only ring or all-collinear edges).
  // The first vertex sits on the boundary; pointInRing's outcome on
  // the boundary is undefined per Foley/van Dam, but at least it
  // gives the parent-finder *something* to work with.
  return ring.points[0] ?? { x: 0, y: 0 };
}

/**
 * Crossing-number point-in-polygon test (Sunday's algorithm,
 * generalised). Equivalent to a winding-number test for simple,
 * non-self-intersecting rings. Edge cases: points on the boundary
 * have an undefined classification per Foley/van Dam — we don't
 * treat boundary cases specially because the resolver always tests
 * representative points generated to lie strictly in the interior
 * (see {@link representativePoint}).
 */
export function pointInRing(p: Point, ring: ContourRing): boolean {
  // Quick reject by bbox.
  if (
    p.x < ring.bbox.minX ||
    p.x > ring.bbox.maxX ||
    p.y < ring.bbox.minY ||
    p.y > ring.bbox.maxY
  ) {
    return false;
  }
  const pts = ring.points;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i]!.x;
    const yi = pts[i]!.y;
    const xj = pts[j]!.x;
    const yj = pts[j]!.y;
    const intersects =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
