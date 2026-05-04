/**
 * Hungarian-assignment subpath matcher (W3-4 / W4-4 upgrade).
 *
 * Replaces the W3 greedy ring matcher's "pair by canonical-sorted
 * index" with optimal rectangular assignment via the
 * `hungarian-on3` package. Hints from {@link CorrespondenceHints}
 * become HARD constraints by inflating the cost of all forbidden
 * pairings (pinned `from` against any non-pinned `to`, etc.) to a
 * sentinel large value the Hungarian solver will avoid.
 *
 * Cost matrix entries combine:
 *   - centroid distance (normalised by joint diagonal)
 *   - bbox aspect/scale similarity
 *   - signed-area similarity
 *   - command-signature length similarity (cheap proxy for the
 *     turning-function distance the algorithms-plan §5.3 calls for;
 *     a future commit can swap in the full Arkin 1991 metric
 *     without changing the call site)
 *
 * The optimal assignment is then translated into a per-side
 * subpath reordering — both canonical `d` strings are re-emitted
 * with subpaths placed at matched indices, so the existing
 * `bestGuessMorph` / `attemptCrossIconMorph` engines naturally
 * pair by Hungarian-optimal correspondence.
 *
 * Plan: docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §5.3,
 *       docs_canonical/ICON_TRANSITION_ROADMAP.md W4-4.
 *
 * @module
 */
import hungarian from 'hungarian-on3';

import type { CorrespondenceHints } from '../../schema/types';
import { resolveSubpathPins } from '../correspondence-hints';
import type { CanonicalPath } from '../path-normalization';

const FORBIDDEN_COST = 1e9;
const PIN_REWARD = 0;

export type SubpathMatch = {
  fromIndex: number;
  toIndex: number;
  cost: number;
};

export type HungarianMatchResult = {
  matches: SubpathMatch[];
  /** `from` subpath indices that have no `to` partner (birth/death). */
  fromOrphans: number[];
  /** `to` subpath indices that have no `from` partner (birth/death). */
  toOrphans: number[];
};

/**
 * Run rectangular Hungarian assignment over the cost matrix and
 * return the matched pairs + orphans (rectangular: when subpath
 * counts differ, the smaller side gets full assignment, the larger
 * side has orphans).
 */
export function hungarianMatch(
  fromCanonical: CanonicalPath,
  toCanonical: CanonicalPath,
  hints: CorrespondenceHints,
): HungarianMatchResult {
  const fromCount = fromCanonical.stats.subpathCount;
  const toCount = toCanonical.stats.subpathCount;
  if (fromCount === 0 || toCount === 0) {
    return {
      matches: [],
      fromOrphans: Array.from({ length: fromCount }, (_, i) => i),
      toOrphans: Array.from({ length: toCount }, (_, i) => i),
    };
  }

  const stats = perSubpathStats(fromCanonical, toCanonical);
  const pins = resolveSubpathPins(hints, fromCount, toCount);
  const pinFromMap = new Map<number, number>();
  const pinToMap = new Map<number, number>();
  for (const pin of pins) {
    pinFromMap.set(pin.fromIndex, pin.toIndex);
    pinToMap.set(pin.toIndex, pin.fromIndex);
  }

  // Build the cost matrix. hungarian-on3 expects an array of arrays
  // where `m[from][to]` is the cost of assigning `from` to `to`.
  // For rectangular inputs the library auto-pads internally.
  const matrix: number[][] = [];
  for (let f = 0; f < fromCount; f++) {
    const row: number[] = [];
    const pinnedTo = pinFromMap.get(f);
    for (let t = 0; t < toCount; t++) {
      if (pinnedTo !== undefined) {
        row.push(pinnedTo === t ? PIN_REWARD : FORBIDDEN_COST);
      } else if (pinToMap.has(t)) {
        // `t` is reserved for a different `from` pin — forbidden.
        row.push(FORBIDDEN_COST);
      } else {
        row.push(pairCost(stats.from[f]!, stats.to[t]!, stats.span));
      }
    }
    matrix.push(row);
  }

  const assignment = hungarian(matrix) as Array<[number, number]>;

  const matches: SubpathMatch[] = [];
  const fromUsed = new Set<number>();
  const toUsed = new Set<number>();
  for (const [f, t] of assignment) {
    if (f < 0 || f >= fromCount) continue;
    if (t < 0 || t >= toCount) continue;
    const cost = matrix[f]![t]!;
    if (cost >= FORBIDDEN_COST) continue;
    matches.push({ fromIndex: f, toIndex: t, cost });
    fromUsed.add(f);
    toUsed.add(t);
  }

  const fromOrphans: number[] = [];
  for (let f = 0; f < fromCount; f++) if (!fromUsed.has(f)) fromOrphans.push(f);
  const toOrphans: number[] = [];
  for (let t = 0; t < toCount; t++) if (!toUsed.has(t)) toOrphans.push(t);

  return { matches, fromOrphans, toOrphans };
}

// ---------------------------------------------------------------------------
// Cost matrix
// ---------------------------------------------------------------------------

type SubpathStat = {
  centroid: { x: number; y: number };
  bbox: { width: number; height: number };
  signedArea: number;
  commandLength: number;
  closed: boolean;
};

function perSubpathStats(
  from: CanonicalPath,
  to: CanonicalPath,
): { from: SubpathStat[]; to: SubpathStat[]; span: number } {
  // Use the contour-tree representation for closed subpaths so we
  // get accurate centroids + signed areas. For W3 the inputs are
  // canonical paths whose stats only track per-path bbox; we
  // reconstruct per-subpath stats by walking the path's command
  // signature.
  const fromStats = buildPerSubpathStats(from);
  const toStats = buildPerSubpathStats(to);

  // Joint diagonal for centroid normalisation.
  const span = Math.max(
    diagonalOf(from),
    diagonalOf(to),
    1,
  );
  return { from: fromStats, to: toStats, span };
}

function diagonalOf(p: CanonicalPath): number {
  const { minX, minY, maxX, maxY } = p.stats.bbox;
  return Math.hypot(maxX - minX, maxY - minY);
}

function buildPerSubpathStats(canonical: CanonicalPath): SubpathStat[] {
  const subpaths = splitSubpaths(canonical.d);
  return subpaths.map((d, i) => {
    const points = subpathPoints(d);
    const closed = canonical.stats.closed[i] ?? false;
    return {
      centroid: meanPoint(points),
      bbox: bboxSize(points),
      signedArea: closed ? signedArea(points) : 0,
      commandLength: d.split(' ').length,
      closed,
    };
  });
}

function pairCost(a: SubpathStat, b: SubpathStat, span: number): number {
  // Closed↔open type mismatch is highly undesirable but not
  // forbidden — flag with a large but finite penalty so the solver
  // prefers same-type pairings when available.
  const typePenalty = a.closed === b.closed ? 0 : 0.6;
  const centroidDist = Math.hypot(
    a.centroid.x - b.centroid.x,
    a.centroid.y - b.centroid.y,
  ) / span;
  const areaDiff = a.closed && b.closed
    ? Math.abs(Math.abs(a.signedArea) - Math.abs(b.signedArea)) /
      Math.max(Math.abs(a.signedArea), Math.abs(b.signedArea), 1)
    : 0;
  const aw = Math.max(a.bbox.width, 0.001);
  const ah = Math.max(a.bbox.height, 0.001);
  const bw = Math.max(b.bbox.width, 0.001);
  const bh = Math.max(b.bbox.height, 0.001);
  const bboxDiff =
    Math.abs(aw - bw) / Math.max(aw, bw) +
    Math.abs(ah - bh) / Math.max(ah, bh);
  const sigDiff =
    Math.abs(a.commandLength - b.commandLength) /
    Math.max(a.commandLength, b.commandLength, 1);
  return (
    typePenalty +
    0.40 * centroidDist +
    0.25 * bboxDiff +
    0.20 * areaDiff +
    0.15 * sigDiff
  );
}

// ---------------------------------------------------------------------------
// Subpath / point helpers (light-touch parsing — same shape as the
// W3 hierarchical-match's reorderSubpaths helper)
// ---------------------------------------------------------------------------

export function splitSubpaths(d: string): string[] {
  const parts = d.split(/(?=\bM)/);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/**
 * Re-order a canonical `d` string so the priority indices come
 * first (in their listed order), then any remaining subpaths in
 * canonical order.
 */
export function reorderCanonicalSubpaths(d: string, priority: number[]): string {
  const subpaths = splitSubpaths(d);
  if (subpaths.length === 0) return d;
  const seen = new Set<number>();
  const out: string[] = [];
  for (const idx of priority) {
    if (idx < 0 || idx >= subpaths.length || seen.has(idx)) continue;
    out.push(subpaths[idx]!);
    seen.add(idx);
  }
  for (let i = 0; i < subpaths.length; i++) {
    if (!seen.has(i)) out.push(subpaths[i]!);
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

function subpathPoints(d: string): Array<{ x: number; y: number }> {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+/g) ?? [];
  const points: Array<{ x: number; y: number }> = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (!/^[a-zA-Z]$/.test(t)) {
      i += 1;
      continue;
    }
    i += 1;
    const cmd = t.toUpperCase();
    if (cmd === 'M' || cmd === 'L') {
      while (
        i + 1 < tokens.length &&
        /^-?\d*\.?\d+$/.test(tokens[i] ?? '') &&
        /^-?\d*\.?\d+$/.test(tokens[i + 1] ?? '')
      ) {
        points.push({
          x: Number.parseFloat(tokens[i]!),
          y: Number.parseFloat(tokens[i + 1]!),
        });
        i += 2;
      }
    } else if (cmd === 'C') {
      while (i + 5 < tokens.length) {
        // Skip control points; capture endpoint.
        const ok = [0, 1, 2, 3, 4, 5].every(
          (k) => /^-?\d*\.?\d+$/.test(tokens[i + k] ?? ''),
        );
        if (!ok) break;
        points.push({
          x: Number.parseFloat(tokens[i + 4]!),
          y: Number.parseFloat(tokens[i + 5]!),
        });
        i += 6;
      }
    } else if (cmd === 'Q') {
      while (i + 3 < tokens.length) {
        const ok = [0, 1, 2, 3].every(
          (k) => /^-?\d*\.?\d+$/.test(tokens[i + k] ?? ''),
        );
        if (!ok) break;
        points.push({
          x: Number.parseFloat(tokens[i + 2]!),
          y: Number.parseFloat(tokens[i + 3]!),
        });
        i += 4;
      }
    } else if (cmd === 'A') {
      // arc — endpoint is at offsets 5,6
      while (i + 6 < tokens.length) {
        const ok = [0, 1, 2, 3, 4, 5, 6].every(
          (k) => /^-?\d*\.?\d+$/.test(tokens[i + k] ?? ''),
        );
        if (!ok) break;
        points.push({
          x: Number.parseFloat(tokens[i + 5]!),
          y: Number.parseFloat(tokens[i + 6]!),
        });
        i += 7;
      }
    } else if (cmd === 'Z') {
      // closure — no coords
    }
  }
  return points;
}

function meanPoint(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

function bboxSize(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return { width: 0, height: 0 };
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
  return { width: maxX - minX, height: maxY - minY };
}

function signedArea(points: Array<{ x: number; y: number }>): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}
