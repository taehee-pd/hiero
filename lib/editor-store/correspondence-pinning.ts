/**
 * Correspondence-pinning editor actions (W4-7 scaffolding).
 *
 * Pure helpers that the editor store + path-editor canvas use to
 * mutate `Transition.correspondenceHints`. The full drag-vertex-
 * onto-vertex canvas interaction lands in a follow-up commit
 * alongside the path-editor handle work; the helpers below are
 * the stable contract that interaction will call into.
 *
 * UX ref: docs_canonical/ICON_TRANSITION_UX_PLAN.md §3 Layer 2.
 *
 * @module
 */
import type {
  CorrespondenceHints,
  VertexAddr,
} from '@/lib/schema/types';

const EMPTY: CorrespondenceHints = { subpath: [], vertex: [] };

/**
 * Pin a subpath correspondence. One-to-one — replaces any existing
 * pin involving either endpoint.
 */
export function pinSubpath(
  hints: CorrespondenceHints | undefined,
  fromId: string,
  toId: string,
): CorrespondenceHints {
  const base = hints ?? EMPTY;
  const filtered = base.subpath.filter(
    ([f, t]) => f !== fromId && t !== toId,
  );
  return {
    subpath: [...filtered, [fromId, toId]],
    vertex: base.vertex,
  };
}

/**
 * Pin a vertex correspondence. One-to-one on each endpoint.
 */
export function pinVertex(
  hints: CorrespondenceHints | undefined,
  fromAddr: VertexAddr,
  toAddr: VertexAddr,
): CorrespondenceHints {
  const base = hints ?? EMPTY;
  const filtered = base.vertex.filter(
    ([f, t]) =>
      !(f.subpathId === fromAddr.subpathId && f.vertexIndex === fromAddr.vertexIndex) &&
      !(t.subpathId === toAddr.subpathId && t.vertexIndex === toAddr.vertexIndex),
  );
  return {
    subpath: base.subpath,
    vertex: [...filtered, [fromAddr, toAddr]],
  };
}

/**
 * Remove a subpath pin by either endpoint id. Used when the user
 * deletes the source or target subpath, or explicitly unpins.
 */
export function unpinSubpath(
  hints: CorrespondenceHints | undefined,
  endpointId: string,
): CorrespondenceHints {
  const base = hints ?? EMPTY;
  return {
    subpath: base.subpath.filter(
      ([f, t]) => f !== endpointId && t !== endpointId,
    ),
    vertex: base.vertex,
  };
}

/**
 * Remove a vertex pin by either endpoint address. Same lifecycle
 * rule as `unpinSubpath`.
 */
export function unpinVertex(
  hints: CorrespondenceHints | undefined,
  endpoint: VertexAddr,
): CorrespondenceHints {
  const base = hints ?? EMPTY;
  return {
    subpath: base.subpath,
    vertex: base.vertex.filter(
      ([f, t]) =>
        !(f.subpathId === endpoint.subpathId && f.vertexIndex === endpoint.vertexIndex) &&
        !(t.subpathId === endpoint.subpathId && t.vertexIndex === endpoint.vertexIndex),
    ),
  };
}

/**
 * Remove every pin that references a deleted subpath. The path
 * editor calls this when the user deletes a subpath outright so
 * pins don't outlive their addresses.
 */
export function pruneForDeletedSubpath(
  hints: CorrespondenceHints | undefined,
  deletedSubpathId: string,
): CorrespondenceHints {
  const base = hints ?? EMPTY;
  return {
    subpath: base.subpath.filter(
      ([f, t]) => f !== deletedSubpathId && t !== deletedSubpathId,
    ),
    vertex: base.vertex.filter(
      ([f, t]) =>
        f.subpathId !== deletedSubpathId && t.subpathId !== deletedSubpathId,
    ),
  };
}
