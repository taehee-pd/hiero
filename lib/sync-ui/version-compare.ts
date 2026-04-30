/**
 * Workspace-level diff for Version History compare view.
 *
 * Operates on two `Workspace` objects (icons-by-name) instead of the
 * source-payload arrays that `lib/sync-service/diff-source.ts` consumes.
 * That's a deliberate split: diff-source works against the canonical
 * GitHub source layout (per-icon directory of files); this compare
 * works against the in-memory workspace snapshots stored in
 * VersionSnapshot.workspaceSnapshot.
 *
 * Phase 3 keeps the comparison shallow on purpose: added / removed /
 * modified at the icon level, with modified resolved by serialized
 * equality. Deeper layer/transition diff is future work — capture
 * fidelity should not delay shipping the compare UI.
 */

import type { Workspace } from '@/lib/schema/types';

/**
 * Each entry in `added` / `removed` / `modified` is a globally unique
 * `${setId}/${iconId}` key. Same icon id across two different sets is
 * NOT collapsed — both retain their set-namespaced identity in the
 * output so Version History can render the change accurately. Callers
 * that need to display only the icon name should split on the first
 * `/` (the setId can never contain a `/` because it's an iconSets key).
 */
export type WorkspaceDiff = {
  added: string[];
  removed: string[];
  modified: string[];
  /** Total number of icons in the newer workspace (denominator for %). */
  totalAfter: number;
  /** True when the two workspaces are byte-equal — UI can short-circuit. */
  isIdentical: boolean;
};

type IconRef = {
  setId: string;
  iconId: string;
  /** Globally unique key combining setId + iconId. */
  key: string;
  /** Stable serialized form for equality checks. */
  payload: string;
};

function flattenIcons(workspace: Workspace): Map<string, IconRef> {
  const out = new Map<string, IconRef>();
  for (const [setId, set] of Object.entries(workspace.iconSets)) {
    for (const [iconId, icon] of Object.entries(set.icons)) {
      const key = `${setId}/${iconId}`;
      out.set(key, {
        setId,
        iconId,
        key,
        payload: JSON.stringify(icon),
      });
    }
  }
  return out;
}

export function diffWorkspaces(
  before: Workspace,
  after: Workspace,
): WorkspaceDiff {
  const beforeMap = flattenIcons(before);
  const afterMap = flattenIcons(after);

  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  for (const [key, ref] of afterMap) {
    const prior = beforeMap.get(key);
    if (!prior) {
      added.push(ref.key);
    } else if (prior.payload !== ref.payload) {
      modified.push(ref.key);
    }
  }
  for (const [key, ref] of beforeMap) {
    if (!afterMap.has(key)) removed.push(ref.key);
  }

  added.sort();
  removed.sort();
  modified.sort();

  return {
    added,
    removed,
    modified,
    totalAfter: afterMap.size,
    isIdentical:
      added.length === 0 && removed.length === 0 && modified.length === 0,
  };
}
