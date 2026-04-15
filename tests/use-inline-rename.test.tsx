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
});
