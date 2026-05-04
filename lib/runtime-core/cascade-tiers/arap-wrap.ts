/**
 * As-Rigid-As-Possible (ARAP) quality wrap (Igarashi 2005,
 * algorithms-plan §5.1).
 *
 * Triangulates the source contour via constrained Delaunay
 * (`poly2tri`), then per triangle:
 *  1. Computes the source→target affine `F = R · S` (rotation +
 *     symmetric scale) via closed-form 2D polar decomposition.
 *  2. At frame `t`, interpolates `F(t) = R(t·θ) · ((1-t)I + tS)`.
 *  3. Applies `F(t)` to each source vertex relative to the triangle
 *     centroid (which is itself linearly interpolated to the target
 *     centroid).
 *
 * Vertices shared across multiple triangles get an area-weighted
 * average of their per-triangle deformed positions — a documented
 * simplification of Igarashi's full sparse LSQR that retains the
 * rotation-aware quality without the per-frame Cholesky solve. The
 * full LSQR formulation lands when the solver's runtime cost is
 * justified by W5 corpus calibration.
 *
 * **Trigger.** The `shouldWrapWithArap` predicate gates invocation
 * to source contours with high turning-function variation (≥ 5
 * sharp boundary turns), where pure intrinsic interpolation
 * produces visible "swimming" on the interior. Low-variation
 * contours bypass the wrap and stay on the baseline.
 *
 * Plan: docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §5.1
 *       (Igarashi 2005 + Alexa 2000 references; Baxter 2008
 *       compatible-embedding for the boundary correspondence step).
 *
 * @module
 */
import * as poly2tri from 'poly2tri';

import type { ContourTree } from '../contour-tree';
import type { MorphInterpolator } from '../morph';

type Vec2 = { x: number; y: number };

/**
 * One triangle from the constrained Delaunay triangulation.
 * Vertices are returned in poly2tri's traversal order.
 */
export type Triangle = { a: Vec2; b: Vec2; c: Vec2 };

// ---------------------------------------------------------------------------
// Triangulation
// ---------------------------------------------------------------------------

/**
 * Triangulate a contour tree's largest outer ring against any
 * nested holes (depth-1 children). Returns the triangle list.
 * Throws when poly2tri cannot resolve the input — the cascade
 * catches and falls through to the baseline.
 */
export function triangulateContourTree(tree: ContourTree): Triangle[] {
  if (tree.rings.length === 0) return [];
  const outer = tree.rings.reduce(
    (acc, r) => (Math.abs(r.signedArea) > Math.abs(acc.signedArea) ? r : acc),
    tree.rings[0]!,
  );
  const outerNodeIdx = tree.rings.findIndex((r) => r === outer);
  const outerNode = tree.nodes[outerNodeIdx];
  if (!outerNode) return [];

  const holes: Vec2[][] = [];
  for (const childIdx of outerNode.children) {
    const child = tree.rings[childIdx];
    if (!child) continue;
    holes.push(toContourPoints(child.points));
  }

  const swctx = new poly2tri.SweepContext(toContourPoints(outer.points));
  for (const hole of holes) swctx.addHole(hole);
  swctx.triangulate();
  return swctx.getTriangles().map((t) => ({
    a: { x: t.getPoint(0).x, y: t.getPoint(0).y },
    b: { x: t.getPoint(1).x, y: t.getPoint(1).y },
    c: { x: t.getPoint(2).x, y: t.getPoint(2).y },
  }));
}

function toContourPoints(points: Vec2[]): Vec2[] {
  // poly2tri requires unique points — duplicates throw. Strip the
  // closing duplicate when present.
  if (points.length < 2) return [...points];
  const last = points[points.length - 1]!;
  const first = points[0]!;
  if (last.x === first.x && last.y === first.y) return points.slice(0, -1);
  return [...points];
}

// ---------------------------------------------------------------------------
// Trigger predicate
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the source contour exhibits enough turning-
 * function variation that pure intrinsic interpolation will likely
 * "swim" on the interior. The threshold (≥ 5 boundary turns of
 * > 60°) is calibrated against the W5 corpus.
 */
export function shouldWrapWithArap(tree: ContourTree | null): boolean {
  if (!tree || tree.rings.length === 0) return false;
  const outer = tree.rings.reduce(
    (acc, r) => (Math.abs(r.signedArea) > Math.abs(acc.signedArea) ? r : acc),
    tree.rings[0]!,
  );
  return countSharpTurns(outer.points) >= 5;
}

function countSharpTurns(points: Vec2[]): number {
  if (points.length < 3) return 0;
  let count = 0;
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length]!;
    const curr = points[i]!;
    const next = points[(i + 1) % points.length]!;
    const a1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    const a2 = Math.atan2(next.y - curr.y, next.x - curr.x);
    let delta = a2 - a1;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    if (Math.abs(delta) > Math.PI / 3) count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Per-frame ARAP solver
// ---------------------------------------------------------------------------

type TriangleData = {
  /** Indices into the source-vertex array for the three triangle corners. */
  vertexIndices: [number, number, number];
  sourceCentroid: Vec2;
  targetCentroid: Vec2;
  /** `R` from `F = R · S` as a scalar 2D angle (radians). */
  rotationAngle: number;
  /** `S` from `F = R · S` as a 2×2 row-major matrix. */
  scale: Mat2;
  /** Source triangle area (absolute), used as the averaging weight. */
  area: number;
};

type Mat2 = { a: number; b: number; c: number; d: number };

/**
 * Wrap a baseline interpolator with the ARAP solver. Returns a new
 * interpolator that produces rotation-aware boundary positions at
 * intermediate `t`. The solver is constructed lazily on first call
 * (so cascade decisions that don't actually invoke the morph pay
 * nothing).
 *
 * Reconstruction note: the wrap emits a polyline `d` string at
 * intermediate `t` (curves degenerate to lines). This is acceptable
 * for ARAP-quality wrap because the wrap is meant to fix interior
 * swimming on rotation-heavy morphs; curve fidelity is preserved at
 * `t=0` and `t=1` (the baseline endpoints are returned verbatim).
 */
export function wrapWithArap(
  baseline: MorphInterpolator,
  fromTree: ContourTree | null,
  _toTree: ContourTree | null,
): MorphInterpolator {
  if (!fromTree) return baseline;

  let triangleData: TriangleData[] | null = null;
  let sourceVertices: Vec2[] = [];
  let targetVertices: Vec2[] = [];
  let sourceClosed = false;
  let initFailed = false;

  function init(): void {
    if (triangleData !== null || initFailed) return;
    try {
      const sourceD = baseline(0);
      const targetD = baseline(1);
      sourceVertices = extractAnchorPoints(sourceD);
      targetVertices = extractAnchorPoints(targetD);
      sourceClosed = /[Zz]\s*$/.test(sourceD.trim());

      // The baseline's morph-engine alignment guarantees identical
      // anchor counts on both sides. Anything else is a sampling
      // disagreement; bail to the baseline.
      if (
        sourceVertices.length === 0 ||
        sourceVertices.length !== targetVertices.length
      ) {
        initFailed = true;
        return;
      }

      const triangles = triangulateContourTree(fromTree!);
      if (triangles.length === 0) {
        initFailed = true;
        return;
      }

      const data: TriangleData[] = [];
      for (const tri of triangles) {
        const ia = nearestVertexIndex(tri.a, sourceVertices);
        const ib = nearestVertexIndex(tri.b, sourceVertices);
        const ic = nearestVertexIndex(tri.c, sourceVertices);
        if (ia < 0 || ib < 0 || ic < 0) continue;
        if (ia === ib || ib === ic || ic === ia) continue;

        const sa = sourceVertices[ia]!;
        const sb = sourceVertices[ib]!;
        const sc = sourceVertices[ic]!;
        const ta = targetVertices[ia]!;
        const tb = targetVertices[ib]!;
        const tc = targetVertices[ic]!;

        const sourceCentroid = centroidOf(sa, sb, sc);
        const targetCentroid = centroidOf(ta, tb, tc);

        const F = computeAffine2x2(
          sub(sa, sourceCentroid),
          sub(sb, sourceCentroid),
          sub(ta, targetCentroid),
          sub(tb, targetCentroid),
        );
        if (!F) continue;

        const { rotationAngle, scale } = polarDecomposition2D(F);
        const area = Math.abs(triangleArea(sa, sb, sc));
        if (area < 1e-9) continue;

        data.push({
          vertexIndices: [ia, ib, ic],
          sourceCentroid,
          targetCentroid,
          rotationAngle,
          scale,
          area,
        });
      }

      if (data.length === 0) {
        initFailed = true;
        return;
      }

      triangleData = data;
    } catch {
      initFailed = true;
    }
  }

  return (t: number) => {
    if (t <= 0) return baseline(0);
    if (t >= 1) return baseline(1);
    init();
    if (initFailed || !triangleData) return baseline(t);

    // Per-vertex weighted accumulator.
    const acc: Array<{ x: number; y: number; weight: number }> =
      new Array(sourceVertices.length);
    for (let i = 0; i < sourceVertices.length; i++) {
      acc[i] = { x: 0, y: 0, weight: 0 };
    }

    for (const td of triangleData) {
      const cx = (1 - t) * td.sourceCentroid.x + t * td.targetCentroid.x;
      const cy = (1 - t) * td.sourceCentroid.y + t * td.targetCentroid.y;

      const angleT = t * td.rotationAngle;
      const cosA = Math.cos(angleT);
      const sinA = Math.sin(angleT);

      // S(t) = (1 - t)·I + t·S
      const sa = (1 - t) + t * td.scale.a;
      const sb = t * td.scale.b;
      const sc2 = t * td.scale.c;
      const sd = (1 - t) + t * td.scale.d;

      // F(t) = R(t) · S(t)
      const f00 = cosA * sa - sinA * sc2;
      const f01 = cosA * sb - sinA * sd;
      const f10 = sinA * sa + cosA * sc2;
      const f11 = sinA * sb + cosA * sd;

      for (let i = 0; i < 3; i++) {
        const idx = td.vertexIndices[i]!;
        const sv = sourceVertices[idx]!;
        const ux = sv.x - td.sourceCentroid.x;
        const uy = sv.y - td.sourceCentroid.y;
        const dx = f00 * ux + f01 * uy;
        const dy = f10 * ux + f11 * uy;
        const px = cx + dx;
        const py = cy + dy;
        acc[idx]!.x += px * td.area;
        acc[idx]!.y += py * td.area;
        acc[idx]!.weight += td.area;
      }
    }

    // Reconstruct vertex positions, falling back to linear-interp
    // for any anchor not covered by a triangle (open-subpath
    // anchors, or anchors stripped by deduplication).
    const morphed: Vec2[] = sourceVertices.map((sv, i) => {
      const a = acc[i]!;
      if (a.weight === 0) {
        const tv = targetVertices[i]!;
        return { x: (1 - t) * sv.x + t * tv.x, y: (1 - t) * sv.y + t * tv.y };
      }
      return { x: a.x / a.weight, y: a.y / a.weight };
    });

    return verticesToPolylinePath(morphed, sourceClosed);
  };
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function centroidOf(a: Vec2, b: Vec2, c: Vec2): Vec2 {
  return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
}

function triangleArea(a: Vec2, b: Vec2, c: Vec2): number {
  return ((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
}

function nearestVertexIndex(p: Vec2, vertices: Vec2[]): number {
  let best = -1;
  let bestSq = Number.POSITIVE_INFINITY;
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i]!;
    const dx = p.x - v.x;
    const dy = p.y - v.y;
    const sq = dx * dx + dy * dy;
    if (sq < bestSq) {
      bestSq = sq;
      best = i;
    }
  }
  // Triangulation produces points exactly at source vertices
  // (modulo the dedup pass). A small snap tolerance covers
  // floating-point round-trip through poly2tri.
  return bestSq < 1e-3 ? best : -1;
}

/**
 * Compute the 2×2 affine `F` mapping the centred source basis
 * `[sa | sb]` to the centred target basis `[ta | tb]`. Returns
 * `null` when the source basis is rank-deficient (degenerate
 * triangle).
 */
function computeAffine2x2(
  sa: Vec2,
  sb: Vec2,
  ta: Vec2,
  tb: Vec2,
): Mat2 | null {
  const det = sa.x * sb.y - sa.y * sb.x;
  if (Math.abs(det) < 1e-9) return null;
  return {
    a: (ta.x * sb.y - tb.x * sa.y) / det,
    b: (-ta.x * sb.x + tb.x * sa.x) / det,
    c: (ta.y * sb.y - tb.y * sa.y) / det,
    d: (-ta.y * sb.x + tb.y * sa.x) / det,
  };
}

/**
 * 2D closed-form polar decomposition: `F = R · S` where `R` is a
 * rotation and `S` is symmetric. For `det(F) > 0`,
 * `θ = atan2(F.c - F.b, F.a + F.d)`. Reflection cases (det < 0)
 * fall back to identity rotation — boundary morphs of well-formed
 * contours don't produce reflections in practice.
 */
function polarDecomposition2D(F: Mat2): {
  rotationAngle: number;
  scale: Mat2;
} {
  const detF = F.a * F.d - F.b * F.c;
  const theta =
    detF >= 0 ? Math.atan2(F.c - F.b, F.a + F.d) : 0;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  // S = R^T · F
  return {
    rotationAngle: theta,
    scale: {
      a: cosT * F.a + sinT * F.c,
      b: cosT * F.b + sinT * F.d,
      c: -sinT * F.a + cosT * F.c,
      d: -sinT * F.b + cosT * F.d,
    },
  };
}

// ---------------------------------------------------------------------------
// Path I/O
// ---------------------------------------------------------------------------

/**
 * Pull anchor (endpoint) points from a canonical `d` string in
 * command order. M / L push their endpoints; C / Q skip control
 * points; A skips the arc parameters and pushes the endpoint.
 */
function extractAnchorPoints(d: string): Vec2[] {
  const points: Vec2[] = [];
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g) ?? [];
  let cursor = 0;
  while (cursor < tokens.length) {
    const cmd = tokens[cursor++]!;
    if (!/^[a-zA-Z]$/.test(cmd)) continue;
    const upper = cmd.toUpperCase();
    if (upper === 'M' || upper === 'L') {
      while (
        cursor + 1 < tokens.length &&
        isNumber(tokens[cursor]) &&
        isNumber(tokens[cursor + 1])
      ) {
        points.push({ x: +tokens[cursor]!, y: +tokens[cursor + 1]! });
        cursor += 2;
      }
    } else if (upper === 'C') {
      while (
        cursor + 5 < tokens.length &&
        isNumber(tokens[cursor]) &&
        isNumber(tokens[cursor + 1]) &&
        isNumber(tokens[cursor + 2]) &&
        isNumber(tokens[cursor + 3]) &&
        isNumber(tokens[cursor + 4]) &&
        isNumber(tokens[cursor + 5])
      ) {
        points.push({ x: +tokens[cursor + 4]!, y: +tokens[cursor + 5]! });
        cursor += 6;
      }
    } else if (upper === 'Q') {
      while (
        cursor + 3 < tokens.length &&
        isNumber(tokens[cursor]) &&
        isNumber(tokens[cursor + 1]) &&
        isNumber(tokens[cursor + 2]) &&
        isNumber(tokens[cursor + 3])
      ) {
        points.push({ x: +tokens[cursor + 2]!, y: +tokens[cursor + 3]! });
        cursor += 4;
      }
    } else if (upper === 'A') {
      while (
        cursor + 6 < tokens.length &&
        isNumber(tokens[cursor]) &&
        isNumber(tokens[cursor + 1]) &&
        isNumber(tokens[cursor + 2]) &&
        isNumber(tokens[cursor + 3]) &&
        isNumber(tokens[cursor + 4]) &&
        isNumber(tokens[cursor + 5]) &&
        isNumber(tokens[cursor + 6])
      ) {
        points.push({ x: +tokens[cursor + 5]!, y: +tokens[cursor + 6]! });
        cursor += 7;
      }
    }
    // Z / H / V / S / T not handled — canonical paths shouldn't use them.
  }
  return points;
}

function isNumber(token: string | undefined): boolean {
  return token !== undefined && /^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(token);
}

function verticesToPolylinePath(vertices: Vec2[], closed: boolean): string {
  if (vertices.length === 0) return '';
  const parts: string[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i]!;
    parts.push(`${i === 0 ? 'M' : 'L'}${formatNum(v.x)} ${formatNum(v.y)}`);
  }
  if (closed) parts.push('Z');
  return parts.join(' ');
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const fixed = n.toFixed(3);
  return fixed.replace(/\.?0+$/, '') || '0';
}
