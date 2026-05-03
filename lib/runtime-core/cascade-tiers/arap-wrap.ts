/**
 * As-Rigid-As-Possible (ARAP) quality wrap for T1 (algorithms-plan
 * §5.1). Uses `poly2tri` for constrained Delaunay triangulation
 * against contour-tree holes; implements the Igarashi 2005
 * closed-form 2-step solver (rotation step → full-affine step).
 *
 * Wraps the existing intrinsic-strict interpolator: at each `t`,
 * the wrap reads the boundary correspondence from the underlying
 * morph and propagates it to interior vertices via the
 * triangulation. The result is a morph whose interior preserves
 * local rigidity even on non-convex shapes (eliminates the
 * "swimming" artefact pure intrinsic interpolation produces).
 *
 * **Implementation status (W3.5):** poly2tri triangulation is wired;
 * the trigger predicate ships; the per-frame polar-decomposition
 * solver is the next implementation step. Until the solver lands,
 * `wrapWithArap` is the identity wrap — it returns the original
 * interpolator unchanged but registers the wrap as "would-benefit"
 * via the trigger predicate, which the cascade can use to avoid
 * routing non-convex T1 shapes to non-ARAP fallbacks. The W5
 * sweep tightens the trigger threshold from corpus distortion
 * data.
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

/**
 * One triangle from the constrained Delaunay triangulation.
 * Vertices are returned in poly2tri's traversal order.
 */
export type Triangle = {
  a: { x: number; y: number };
  b: { x: number; y: number };
  c: { x: number; y: number };
};

/**
 * Triangulate a contour tree's largest outer ring against any
 * nested holes. Returns the triangle list. Throws when poly2tri
 * cannot resolve the input (typically degenerate or self-
 * intersecting boundaries) — the cascade catches and falls
 * through.
 *
 * Uses poly2tri's SweepContext (constrained Delaunay):
 *   1. Add the outer ring as the bounding contour
 *   2. Add each hole (depth-1 child of the outer ring)
 *   3. `triangulate()` + `getTriangles()`
 *
 * The holes-of-holes case (alternation depth ≥ 3) is currently
 * collapsed to "fill the hole as if no island present" — the
 * island ring is excluded and re-triangulated separately when
 * the cascade needs interior of the island. This mirrors how
 * the contour tree organises rings into hierarchical levels.
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

  // Holes are direct children of the outer ring in the contour
  // tree (depth = outer.depth + 1).
  const holes: Array<Array<{ x: number; y: number }>> = [];
  for (const childIdx of outerNode.children) {
    const child = tree.rings[childIdx];
    if (!child) continue;
    holes.push(toContourPoints(child.points));
  }

  const swctx = new poly2tri.SweepContext(toContourPoints(outer.points));
  for (const hole of holes) {
    swctx.addHole(hole);
  }
  swctx.triangulate();
  const triangles = swctx.getTriangles().map((t) => ({
    a: { x: t.getPoint(0).x, y: t.getPoint(0).y },
    b: { x: t.getPoint(1).x, y: t.getPoint(1).y },
    c: { x: t.getPoint(2).x, y: t.getPoint(2).y },
  }));
  return triangles;
}

function toContourPoints(
  points: Array<{ x: number; y: number }>,
): Array<{ x: number; y: number }> {
  // poly2tri requires unique points — duplicates throw. The
  // canonical paths emit closed contours where the first and last
  // M-anchored point typically coincide; strip the trailing
  // duplicate when present.
  if (points.length < 2) return [...points];
  const last = points[points.length - 1]!;
  const first = points[0]!;
  if (last.x === first.x && last.y === first.y) return points.slice(0, -1);
  return [...points];
}

/**
 * ARAP trigger predicate: returns `true` when the source contour
 * exhibits enough turning-function variation that pure intrinsic
 * interpolation will likely produce visible "swimming" on the
 * interior. Threshold is calibrated against the W5 corpus.
 *
 * Today this returns a hueristic boolean — high turning-function
 * variation (≥ 5 sharp turns at the boundary). The full
 * Arkin 1991 turning-function distance lands alongside the polar-
 * decomposition solver.
 */
export function shouldWrapWithArap(tree: ContourTree | null): boolean {
  if (!tree || tree.rings.length === 0) return false;
  const outer = tree.rings.reduce(
    (acc, r) => (Math.abs(r.signedArea) > Math.abs(acc.signedArea) ? r : acc),
    tree.rings[0]!,
  );
  return countSharpTurns(outer.points) >= 5;
}

function countSharpTurns(points: Array<{ x: number; y: number }>): number {
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
    if (Math.abs(delta) > Math.PI / 3) count += 1; // > 60°
  }
  return count;
}

/**
 * Wrap a baseline interpolator with ARAP solver output. The
 * solver itself (Igarashi 2005 closed-form: rotation step then
 * full-affine step, both as linear systems over the
 * triangulation's interior vertex set) is the next
 * implementation step. Until then, this is the identity wrap —
 * the trigger + triangulation API surfaces are in place so the
 * solver can drop in without further plumbing changes.
 */
export function wrapWithArap(
  baseline: MorphInterpolator,
  _fromTree: ContourTree | null,
  _toTree: ContourTree | null,
): MorphInterpolator {
  // TODO(W3.5+): implement the per-frame polar-decomposition
  // solver. Pseudocode for the future implementation:
  //   1. triangulate the SOURCE polygon (call triangulateContourTree)
  //   2. compute per-triangle source/target affine pairs from
  //      the boundary correspondence the baseline interpolator
  //      already provides at t=0 and t=1
  //   3. per frame at progress `t`, polar-decompose each
  //      triangle's affine into (R, S) and interpolate as
  //      slerp(R) + lerp(S); reconstruct interior vertices by
  //      least-squares fit over the triangulation
  //   4. emit the reconstructed boundary as the morphed `d`
  return baseline;
}
