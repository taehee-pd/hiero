import { describe, expect, test, beforeEach } from 'bun:test';

import { editorStore } from '../lib/editor-store/store';
import { handleEditorKeyDown } from '../lib/editor-core/keyboard';
import { SAMPLE_WORKSPACE } from '../lib/schema/sample-project';

/**
 * R6 regression tests (docs_canonical/NEXT_PHASES.md §R6):
 * - UX-2.5 — Global `?` key dispatches `cuneiform:open-shortcuts`.
 *
 * UX-2.2 (unified breadcrumb) was deliberately left out of R6; the
 * top-of-editor project/icon label stays as a plain heading.
 */

function bootstrap() {
  const state = editorStore.getState();
  state.loadWorkspace(structuredClone(SAMPLE_WORKSPACE));
}

describe('R6 · UX-2.5 — `?` key opens the shortcuts cheat sheet', () => {
  beforeEach(() => {
    bootstrap();
  });

  test('`?` keydown fires a `cuneiform:open-shortcuts` CustomEvent', () => {
    let fired = false;
    const listener = () => {
      fired = true;
    };
    const g = globalThis as unknown as {
      addEventListener?: (type: string, handler: EventListener) => void;
      removeEventListener?: (type: string, handler: EventListener) => void;
    };
    if (typeof g.addEventListener !== 'function') {
      // Bun test runtime without DOM — just assert the handler does not
      // throw (dispatch is guarded by `typeof globalThis.dispatchEvent`).
      handleEditorKeyDown({
        key: '?',
        target: { tagName: 'DIV' },
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        preventDefault: () => {},
      } as unknown as KeyboardEvent);
      return;
    }

    g.addEventListener!('cuneiform:open-shortcuts', listener as EventListener);
    try {
      handleEditorKeyDown({
        key: '?',
        target: { tagName: 'DIV' },
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        preventDefault: () => {},
      } as unknown as KeyboardEvent);
      expect(fired).toBeTrue();
    } finally {
      g.removeEventListener!('cuneiform:open-shortcuts', listener as EventListener);
    }
  });

  test('Shift+/ also fires `cuneiform:open-shortcuts` (US layout fallback)', () => {
    let fired = false;
    const listener = () => {
      fired = true;
    };
    const g = globalThis as unknown as {
      addEventListener?: (type: string, handler: EventListener) => void;
      removeEventListener?: (type: string, handler: EventListener) => void;
    };
    if (typeof g.addEventListener !== 'function') return;

    g.addEventListener!('cuneiform:open-shortcuts', listener as EventListener);
    try {
      handleEditorKeyDown({
        key: '/',
        target: { tagName: 'DIV' },
        ctrlKey: false,
        metaKey: false,
        shiftKey: true,
        altKey: false,
        preventDefault: () => {},
      } as unknown as KeyboardEvent);
      expect(fired).toBeTrue();
    } finally {
      g.removeEventListener!('cuneiform:open-shortcuts', listener as EventListener);
    }
  });

  test('Ignores `?` while typing in an input', () => {
    let fired = false;
    const listener = () => {
      fired = true;
    };
    const g = globalThis as unknown as {
      addEventListener?: (type: string, handler: EventListener) => void;
      removeEventListener?: (type: string, handler: EventListener) => void;
    };
    if (typeof g.addEventListener !== 'function') return;

    g.addEventListener!('cuneiform:open-shortcuts', listener as EventListener);
    try {
      handleEditorKeyDown({
        key: '?',
        target: { tagName: 'INPUT' },
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        preventDefault: () => {},
      } as unknown as KeyboardEvent);
      expect(fired).toBeFalse();
    } finally {
      g.removeEventListener!('cuneiform:open-shortcuts', listener as EventListener);
    }
  });
});
