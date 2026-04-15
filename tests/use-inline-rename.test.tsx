// Unit tests for useInlineRename — Phase 4 Commit 3 follow-up.
//
// Characterization tests (char-inline-rename-*.test.tsx) prove the
// migrated call sites preserve behavior. These unit tests cover the
// hook's isolated state machine through every branch: start, commit,
// cancel, empty, unchanged, and the re-entry guard that stops blur
// from double-committing after Enter already handled the keystroke.

import './setup/happy-dom';
import './setup/react';

import { afterEach, describe, expect, mock, test } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useInlineRename } from '@/lib/editor-hooks';

afterEach(() => { cleanup(); });


describe('useInlineRename', () => {
  test('starts in not-renaming state with an empty draft', () => {
    const onCommit = mock(() => {});
    const { result } = renderHook(() => useInlineRename({ onCommit }));
    expect(result.current.isRenaming).toBe(false);
    expect(result.current.draft).toBe('');
  });

  test('start() seeds the draft and flips isRenaming to true', () => {
    const onCommit = mock(() => {});
    const { result } = renderHook(() => useInlineRename({ onCommit }));

    act(() => {
      result.current.start('arrow-right');
    });

    expect(result.current.isRenaming).toBe(true);
    expect(result.current.draft).toBe('arrow-right');
  });

  test('commit() with a new trimmed draft calls onCommit and exits edit mode', () => {
    const onCommit = mock((_: string) => {});
    const { result } = renderHook(() => useInlineRename({ onCommit }));

    act(() => result.current.start('arrow-right'));
    act(() => result.current.setDraft('  arrow-down  '));
    let returned: string | undefined;
    act(() => {
      returned = result.current.commit('arrow-right');
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('arrow-down');
    expect(returned).toBe('arrow-down');
    expect(result.current.isRenaming).toBe(false);
  });

  test('commit() with empty draft short-circuits — onCommit NOT called, edit mode exits', () => {
    const onCommit = mock(() => {});
    const { result } = renderHook(() => useInlineRename({ onCommit }));

    act(() => result.current.start('arrow-right'));
    act(() => result.current.setDraft('   '));
    let returned: string | undefined;
    act(() => {
      returned = result.current.commit('arrow-right');
    });

    expect(onCommit).not.toHaveBeenCalled();
    expect(returned).toBeUndefined();
    expect(result.current.isRenaming).toBe(false);
  });

  test('commit() with unchanged draft short-circuits — onCommit NOT called, edit mode exits', () => {
    const onCommit = mock(() => {});
    const { result } = renderHook(() => useInlineRename({ onCommit }));

    act(() => result.current.start('arrow-right'));
    let returned: string | undefined;
    act(() => {
      returned = result.current.commit('arrow-right');
    });

    expect(onCommit).not.toHaveBeenCalled();
    expect(returned).toBeUndefined();
    expect(result.current.isRenaming).toBe(false);
  });

  test('cancel() exits edit mode without calling onCommit and clears the draft', () => {
    const onCommit = mock(() => {});
    const { result } = renderHook(() => useInlineRename({ onCommit }));

    act(() => result.current.start('arrow-right'));
    act(() => result.current.setDraft('changed'));
    act(() => result.current.cancel());

    expect(onCommit).not.toHaveBeenCalled();
    expect(result.current.isRenaming).toBe(false);
    expect(result.current.draft).toBe('');
  });

  test('re-entry guard: a second commit() during the same rename session no-ops', () => {
    // This is the pattern that occurs when Enter commits synchronously,
    // the input subsequently unmounts, and React fires a blur that
    // calls commit() a second time. The first commit set isRenaming
    // to false, so the second commit hits the isRenaming guard and
    // returns early without calling onCommit again.
    const onCommit = mock((_: string) => {});
    const { result } = renderHook(() => useInlineRename({ onCommit }));

    act(() => result.current.start('arrow-right'));
    act(() => result.current.setDraft('arrow-down'));
    act(() => {
      result.current.commit('arrow-right'); // Enter path
    });
    act(() => {
      result.current.commit('arrow-right'); // Blur-after-Enter path
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  test('synchronous re-entry guard: same-tick commit() + commit() fires onCommit exactly once (codex adversarial #1)', () => {
    // Before Phase 4 post-review, the re-entry guard read `isRenaming`
    // from the render closure. If Enter's onKeyDown and the input's
    // onBlur both fire within the same React event tick, React batches
    // the setIsRenaming(false) from the first commit and the second
    // commit sees the stale `true` — both commits fire onCommit.
    //
    // The fix moves the guard into a ref that mutates synchronously.
    // This test exercises the exact "no act() flush between calls"
    // path that the earlier test missed. Both commits run inside a
    // single act() block, so neither sees any intervening React flush.
    const onCommit = mock((_: string) => {});
    const { result } = renderHook(() => useInlineRename({ onCommit }));

    act(() => result.current.start('arrow-right'));
    act(() => result.current.setDraft('arrow-down'));
    act(() => {
      // Both commits in the SAME act(). Before the fix, React's
      // batching means isRenaming is still true when the second
      // commit runs, and onCommit fires twice.
      result.current.commit('arrow-right'); // Enter path
      result.current.commit('arrow-right'); // Blur-after-Enter path
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  test('cold commit(): calling commit() on a hook that never started is a no-op', () => {
    // The guard's other purpose: a fresh hook has isRenaming=false,
    // so commit() should do nothing. Gstack testing specialist finding
    // — previously implied by the re-entry test but never explicitly
    // asserted.
    const onCommit = mock(() => {});
    const { result } = renderHook(() => useInlineRename({ onCommit }));

    let returned: string | undefined = 'not-undefined';
    act(() => {
      returned = result.current.commit('whatever');
    });

    expect(onCommit).not.toHaveBeenCalled();
    expect(returned).toBeUndefined();
    expect(result.current.isRenaming).toBe(false);
  });
});
