/**
 * Correspondence-hint plumbing (W4-4).
 *
 * Bridges author-supplied {@link CorrespondenceHints} from the
 * `Transition` schema into the cascade tiers that consume them.
 * Subpath hints become hard constraints on hierarchical-match
 * assignment; vertex hints anchor per-pair correspondence inside
 * intrinsic-strict.
 *
 * The hints' addressing is path-agnostic: `subpath.fromId` /
 * `subpath.toId` are stable subpath identifiers derived during
 * canonicalisation. Today the canonical path emits a flat
 * subpath ordering after `normalizeSubpathOrdering`; hint ids are
 * the deterministic 0-based indices `subpath:0`, `subpath:1`, etc.
 * When W5 introduces hash-based subpath identity, the hint
 * addressing migrates to that namespace without schema changes.
 *
 * Plan: docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §2.1,
 * docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §4.4,
 * docs_canonical/ICON_TRANSITION_ROADMAP.md W4-4.
 *
 * @module
 */
import type {
  CorrespondenceHints,
  VertexAddr,
} from '../schema/types';

export type SubpathPin = {
  fromIndex: number;
  toIndex: number;
};

export type VertexPin = {
  fromAddr: VertexAddr;
  toAddr: VertexAddr;
};

/**
 * Resolve subpath hints to numeric (fromIndex, toIndex) pins.
 *
 * The resolver's hint addressing format is `subpath:N`. Anything
 * else (a fragment id, a reserved name) is rejected at the
 * resolver boundary so a bad hint never silently mis-pins. This
 * mirrors the schema lint's "no algorithm vocabulary in non-debug
 * UI" stance — a malformed pin is a bug, not a soft fallback.
 */
export function resolveSubpathPins(
  hints: CorrespondenceHints,
  fromSubpathCount: number,
  toSubpathCount: number,
): SubpathPin[] {
  const pins: SubpathPin[] = [];
  const seenFrom = new Set<number>();
  const seenTo = new Set<number>();
  for (const [fromId, toId] of hints.subpath) {
    const fromIndex = parseSubpathId(fromId);
    const toIndex = parseSubpathId(toId);
    if (fromIndex === null || toIndex === null) continue;
    if (fromIndex < 0 || fromIndex >= fromSubpathCount) continue;
    if (toIndex < 0 || toIndex >= toSubpathCount) continue;
    // One-to-one — drop conflicting hints (W4 audit will validate
    // at write time so the schema never carries them).
    if (seenFrom.has(fromIndex) || seenTo.has(toIndex)) continue;
    seenFrom.add(fromIndex);
    seenTo.add(toIndex);
    pins.push({ fromIndex, toIndex });
  }
  return pins;
}

/**
 * Resolve vertex hints to per-pair correspondence pins. Vertex
 * pins inherit the subpath addressing of their `VertexAddr.subpathId`
 * field. Returns vertex pins grouped by their resolved subpath
 * indices for downstream consumption by the intrinsic-strict tier.
 */
export function resolveVertexPins(
  hints: CorrespondenceHints,
  fromSubpathCount: number,
  toSubpathCount: number,
): VertexPin[] {
  const pins: VertexPin[] = [];
  for (const [fromAddr, toAddr] of hints.vertex) {
    const fromIndex = parseSubpathId(fromAddr.subpathId);
    const toIndex = parseSubpathId(toAddr.subpathId);
    if (fromIndex === null || toIndex === null) continue;
    if (fromIndex < 0 || fromIndex >= fromSubpathCount) continue;
    if (toIndex < 0 || toIndex >= toSubpathCount) continue;
    if (
      !Number.isFinite(fromAddr.vertexIndex) ||
      !Number.isFinite(toAddr.vertexIndex)
    ) {
      continue;
    }
    pins.push({ fromAddr, toAddr });
  }
  return pins;
}

function parseSubpathId(id: string): number | null {
  const match = /^subpath:(\d+)$/.exec(id);
  if (!match) return null;
  const idx = Number.parseInt(match[1]!, 10);
  if (!Number.isFinite(idx)) return null;
  return idx;
}

/**
 * Construct a stable subpath id from an index. Mirror of
 * {@link parseSubpathId}. Used by Inspector pinning UI to address
 * subpaths consistently.
 */
export function subpathIdFromIndex(index: number): string {
  return `subpath:${index}`;
}
