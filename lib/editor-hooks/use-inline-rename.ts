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
//
// ── Synchronous re-entry guard (codex adversarial finding #1) ─────
//
// The re-entry guard CANNOT rely on React state, because Enter's
// onKeyDown and the input's onBlur can fire within the same React
// event tick. React batches state updates from event handlers, so
// setIsRenaming(false) from the first commit() does not flush before
// the second commit() reads the closed-over `isRenaming`. The stale
// value passes the guard and both commits fire onCommit.
//
// Fix: mirror isRenaming and draft into a ref that mutates
// synchronously. The guard reads from the ref; state still exists for
// re-render signaling. Keystrokes update both. start/commit/cancel
// each update the ref immediately before (or instead of) scheduling
// the state update.

import { useCallback, useRef, useState } from 'react';

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
   * the synchronous ref guard first.
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
   *
   * IMPORTANT: onCommit should be wrapped in useCallback by the caller
   * so its identity is stable. The hook does NOT depend on onCommit in
   * its internal useCallback arrays — it reads via a ref — so the only
   * downstream consequence of an unstable onCommit is whether the
   * caller's own memoization chain stays stable.
   */
  onCommit: (nextName: string) => void;
};

type MirrorState = {
  isRenaming: boolean;
  draft: string;
};

export function useInlineRename({ onCommit }: InlineRenameOptions): InlineRenameApi {
  // React state is kept for re-render signaling (so consumers reading
  // the returned isRenaming/draft get updated UI). The ref is the
  // source of truth for the synchronous guards inside the callbacks.
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState('');

  const mirrorRef = useRef<MirrorState>({ isRenaming: false, draft: '' });
  const onCommitRef = useRef(onCommit);
  // Keep onCommit's latest value readable inside the synchronous
  // commit() without putting it in a dep array — caller may pass an
  // unmemoized function and we do not want to churn commit's identity.
  onCommitRef.current = onCommit;

  const setDraftStable = useCallback((next: string) => {
    mirrorRef.current = { ...mirrorRef.current, draft: next };
    setDraft(next);
  }, []);

  const start = useCallback((currentName: string) => {
    mirrorRef.current = { isRenaming: true, draft: currentName };
    setDraft(currentName);
    setIsRenaming(true);
  }, []);

  const cancel = useCallback(() => {
    // Draft reset on cancel matches IconGridItem's cancelRename contract.
    // LayerPanel did not reset the draft because its input unmounts, so
    // the stranded state was unobservable. The hook resets unconditionally
    // so no call site leaks stale drafts into a re-entry of rename mode.
    mirrorRef.current = { isRenaming: false, draft: '' };
    setIsRenaming(false);
    setDraft('');
  }, []);

  const commit = useCallback((currentName: string): string | undefined => {
    // SYNCHRONOUS guard via ref. React may not have flushed the state
    // update from a prior commit() yet (Enter + blur in the same
    // tick), so we MUST NOT read `isRenaming` from closure. If the
    // ref says the user is no longer renaming, this call is a
    // blur-after-Enter re-entry and should no-op.
    if (!mirrorRef.current.isRenaming) return undefined;

    const trimmed = mirrorRef.current.draft.trim();

    // Flip the mirror immediately so a second synchronous commit()
    // hits the early return above. The state update is scheduled but
    // doesn't need to land before that guard fires.
    mirrorRef.current = { isRenaming: false, draft: mirrorRef.current.draft };
    setIsRenaming(false);

    if (!trimmed) return undefined;
    if (trimmed === currentName) return undefined;

    onCommitRef.current(trimmed);
    return trimmed;
  }, []);

  return {
    isRenaming,
    draft,
    setDraft: setDraftStable,
    start,
    commit,
    cancel,
  };
}
