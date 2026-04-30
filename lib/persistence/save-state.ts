/**
 * Save-state taxonomy for the navbar badge.
 *
 * Three durability tiers map onto four user-visible states:
 *
 *   isDirty                                            -> 'unsaved'
 *   !isDirty && lastPublishedAt is most-recent-tier    -> 'published'
 *   !isDirty && lastCheckpointAt is most-recent-tier   -> 'draft-saved'
 *   !isDirty && lastAutosaveAt only                    -> 'autosaved'
 *   !isDirty && nothing happened yet                   -> 'autosaved'
 *
 * Precedence rule: dirty wins; otherwise the badge shows the most recent
 * of {published, checkpoint}, falling back to autosave. Equal timestamps
 * favor 'published' over 'draft-saved' (publish is the stronger guarantee).
 *
 * Pure function — no react/zustand imports — so it's trivially testable
 * in the bun core suite without DOM.
 */

export type SaveState =
  | 'unsaved'
  | 'autosaved'
  | 'draft-saved'
  | 'published';

export type SaveStateInput = {
  isDirty: boolean;
  /** ms epoch of the last successful autosave; null if never autosaved. */
  lastAutosaveAt: number | null;
  /** ms epoch of the last draft checkpoint; null if no checkpoint yet. */
  lastCheckpointAt: number | null;
  /** ms epoch of the last successful publish; null if never published. */
  lastPublishedAt: number | null;
};

export function deriveSaveState(input: SaveStateInput): SaveState {
  if (input.isDirty) return 'unsaved';

  const checkpointAt = input.lastCheckpointAt ?? -Infinity;
  const publishedAt = input.lastPublishedAt ?? -Infinity;
  const autosaveAt = input.lastAutosaveAt ?? -Infinity;

  // Published wins ties — it's the stronger durability guarantee.
  if (publishedAt >= checkpointAt && publishedAt > -Infinity) {
    return 'published';
  }
  if (checkpointAt > -Infinity) {
    return 'draft-saved';
  }
  if (autosaveAt > -Infinity) {
    return 'autosaved';
  }
  // No save event of any kind has happened — treat as autosaved (clean
  // freshly-loaded workspace), not unsaved (user hasn't dirtied anything).
  return 'autosaved';
}

/**
 * Render the user-facing badge label for a save state. Copy is locked
 * to the spec's taxonomy ("Unsaved changes" / "Autosaved locally" /
 * "Saved draft" / "Published vX.Y.Z") and only varies via two pieces of
 * runtime context: the "X ago" relative time and the published version.
 */
export function formatSaveStateLabel(
  state: SaveState,
  agoLabel: string | null,
  publishedVersion: string | null,
): string {
  switch (state) {
    case 'unsaved':
      return 'Unsaved changes';
    case 'published':
      return publishedVersion ? `Published v${publishedVersion}` : 'Published';
    case 'draft-saved':
      return agoLabel ? `Saved draft ${agoLabel}` : 'Saved draft';
    case 'autosaved':
      return agoLabel ? `Autosaved ${agoLabel}` : 'Autosaved locally';
  }
}
