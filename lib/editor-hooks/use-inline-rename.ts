// useInlineRename — shared state machine for inline-editing a label.
//
// Scope note (Phase 4 §6): this hook deliberately captures ONLY the
// "simple" rename pattern shared by IconGridItem and LayerPanel:
//
//   - Two states: not renaming / renaming
//   - A string draft seeded from the current name when renaming starts
//   - Enter / blur commits the trimmed draft
//   - Escape cancels (discards the draft)
//   - Empty string and unchanged name short-circuit the commit
//
// The other two rename sites in the Phase 4 characterization test set
// have semantics this hook DOES NOT attempt to model, because doing so
// would balloon the API and leak site-specific behavior:
//
//   - Navbar uses a ref flag to guard the blur-after-escape race.
//     Its commit is driven by a ref check, not the hook's state.
//   - EditorShell `TypesSection` has a collision branch that keeps
//     the input OPEN when the new name matches an existing entry,
//     plus a separate "default type" branch that calls a different
//     store action. A "commit rejected, stay open" signal and a
//     per-branch callback surface would break the hook's single
//     responsibility.
//
// Both sites remain inline with their bespoke state machines. Their
// characterization tests (tests/char-inline-rename-{navbar,editorShell}
// .test.tsx) lock in the divergent behaviors so future regressions are
// still caught even though the code is not migrated.

import { useCallback, useState } from 'react';

export type InlineRenameApi = {
  /** True while the user is editing. */
  isRenaming: boolean;
  /** The current draft string — feed this to the input's `value`. */
  draft: string;
  /** Plain setter — wire to the input's onChange. */
  setDraft: (next: string) => void;
  /**
   * Enter rename mode. Seeds the draft with `currentName`. Call from
   * the double-click / F2 / menu trigger.
   */
  start: (currentName: string) => void;
  /**
   * Commit the current draft. Returns the sanitized value that was
   * passed to onCommit (or undefined if the commit short-circuited
   * on empty / unchanged).
   *
   * Wire this to both the input's onBlur AND to onKeyDown on Enter.
   * The hook handles the blur-after-commit re-entry by checking
   * isRenaming first.
   *
   * `currentName` must be passed each call so the "unchanged" short
   * circuit can compare against the latest prop value without the
   * hook having to hold a reference or re-render.
   */
  commit: (currentName: string) => string | undefined;
  /**
   * Cancel and exit. Call from onKeyDown on Escape.
   */
  cancel: () => void;
};

export type InlineRenameOptions = {
  /**
   * Called exactly once per successful commit with the sanitized
   * (trimmed, non-empty, changed) value. The hook will NOT call this
   * for empty or unchanged commits.
   */
  onCommit: (nextName: string) => void;
};

export function useInlineRename({ onCommit }: InlineRenameOptions): InlineRenameApi {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState('');

  const start = useCallback((currentName: string) => {
    setDraft(currentName);
    setIsRenaming(true);
  }, []);

  const cancel = useCallback(() => {
    setIsRenaming(false);
    // Draft reset on cancel matches IconGridItem's cancelRename contract.
    // LayerPanel did not reset the draft because its input unmounts, so
    // the stranded state was unobservable. The hook resets unconditionally
    // so no call site leaks stale drafts into a re-entry of rename mode.
    setDraft('');
  }, []);

  const commit = useCallback(
    (currentName: string): string | undefined => {
      // Re-entry guard: if the input fires blur right after Escape or
      // Enter already committed, isRenaming is already false and we
      // should no-op. This keeps the characterization-test contract
      // that each commit happens exactly once per user gesture.
      if (!isRenaming) return undefined;

      const trimmed = draft.trim();
      setIsRenaming(false);

      if (!trimmed) return undefined;
      if (trimmed === currentName) return undefined;

      onCommit(trimmed);
      return trimmed;
    },
    [isRenaming, draft, onCommit],
  );

  return {
    isRenaming,
    draft,
    setDraft,
    start,
    commit,
    cancel,
  };
}
