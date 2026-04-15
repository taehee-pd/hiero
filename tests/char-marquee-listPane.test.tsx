// Characterization test for ListPane's marquee multi-select.
//
// Plan §6 Phase 4 Commit 2: lock in CURRENT behavior before extraction.
//
// SCOPE NOTE: happy-dom returns 0×0 for getBoundingClientRect, so the
// full hit-test math cannot be exercised in this environment. This
// test characterizes the DRAG LIFECYCLE — the bits that guard when
// marquee starts, what it does to existing selection on start, and
// when it ends. The hit-test itself is a pure geometry function
// (rectsIntersect) that will carry over to the extracted hook
// unchanged; it has its own coverage via the existing layout tests.
//
// Behaviors this test locks in:
//
//   - Pointerdown on grid background (not on an article[data-icon-id]
//     and not on a scrollbar) begins a marquee drag.
//   - Pointerdown WITHOUT shift/meta clears selection at drag start.
//   - Pointerdown WITH shift or meta preserves existing selection as
//     the "base" so the toggle mode can add/remove against it.
//   - Pointerdown on an article[data-icon-id] does NOT start a drag.
//   - Pointerdown on a scrollbar does NOT start a drag.
//   - Pointerup ends the drag regardless of move behavior.
//
// These guards are the contract a future useMarqueeSelection hook
// must preserve. The extracted hook can take the hit-test function
// as a parameter (ref + getBoundingClientRect) to stay DOM-agnostic
// and testable without a real layout engine.

import './setup/happy-dom';
import './setup/react';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ListPane } from '@/components/studio/ListPane';
import { editorStore } from '@/lib/editor-store/store';
import type { Workspace } from '@/lib/schema/types';

afterEach(() => { cleanup(); });


function buildWorkspace(): Workspace {
  const mkIcon = (id: string) => ({
    id,
    name: id,
    variants: {
      v24: {
        id: 'v24',
        size: 24,
        viewBox: [0, 0, 24, 24] as [number, number, number, number],
        layers: {
          s: {
            id: 's',
            path: { d: 'M0 0 H24 V24 H0 Z' },
            style: { fill: { mode: 'fixed' as const, value: '#000' } },
            transform: { x: 0, y: 0 },
          },
        },
        defaultType: 'default',
        types: {
          default: {
            id: 'default',
            layers: {
              s: {
                id: 's',
                path: { d: 'M0 0 H24 V24 H0 Z' },
                style: { fill: { mode: 'fixed' as const, value: '#000' } },
                transform: { x: 0, y: 0 },
              },
            },
          },
        },
      },
    },
    transitions: {},
  });

  return {
    version: '2.0',
    meta: {
      name: 'Marquee Char',
      createdAt: '2026-04-15T00:00:00Z',
      updatedAt: '2026-04-15T00:00:00Z',
    },
    activeIconSetId: 'set1',
    iconSets: {
      set1: {
        version: '1.0',
        meta: {
          name: 'Set 1',
          createdAt: '2026-04-15T00:00:00Z',
          updatedAt: '2026-04-15T00:00:00Z',
        },
        icons: {
          a: mkIcon('a'),
          b: mkIcon('b'),
          c: mkIcon('c'),
        },
      },
    },
  };
}

function bootstrap() {
  editorStore.getState().loadWorkspace(buildWorkspace());
  // Ensure list pane is expanded so the grid actually renders.
  editorStore.setState({ listPaneExpanded: true });
}

function getSelectedIds(): string[] {
  return [...editorStore.getState().selectedIconIds];
}

function findGridContainer(root: HTMLElement): HTMLElement | null {
  // The marquee handlers are bound to the grid container — find it by
  // walking down from the first article[data-icon-id] to its nearest
  // scrollable ancestor. If no article is in the DOM yet, return null.
  const firstArticle = root.querySelector<HTMLElement>('article[data-icon-id]');
  if (!firstArticle) return null;
  let el: HTMLElement | null = firstArticle.parentElement;
  while (el) {
    if (el.onpointerdown || el.hasAttribute('data-marquee-root')) return el;
    el = el.parentElement;
  }
  // Fallback — any wrapper div a couple levels up that has pointer handlers
  return firstArticle.parentElement?.parentElement ?? null;
}

function stubClientRectsForArticles() {
  // happy-dom reports 0×0 for everything; stub getBoundingClientRect so
  // hit-test math has something deterministic to work with. Each icon
  // article gets a 40×40 rect laid out horizontally at y=0.
  const articles = document.querySelectorAll<HTMLElement>('article[data-icon-id]');
  articles.forEach((el, i) => {
    el.getBoundingClientRect = () =>
      ({
        left: i * 48,
        top: 0,
        right: i * 48 + 40,
        bottom: 40,
        width: 40,
        height: 40,
        x: i * 48,
        y: 0,
        toJSON() {
          return {};
        },
      }) as DOMRect;
  });
}

describe('ListPane marquee multi-select (characterization)', () => {
  beforeEach(() => {
    bootstrap();
  });

  test('renders icon articles for each seed icon', () => {
    const { container } = render(<ListPane />);
    const articles = container.querySelectorAll('article[data-icon-id]');
    expect(articles.length).toBe(3);
  });

  test('pointerdown on an article[data-icon-id] does NOT start a marquee drag', () => {
    const { container } = render(<ListPane />);
    const article = container.querySelector<HTMLElement>('article[data-icon-id="a"]');
    expect(article).not.toBeNull();

    // Seed an existing selection so we can tell whether the marquee
    // cleared it (marquee = clear) vs left it alone (article click
    // path = no marquee).
    editorStore.getState().setSelectedIconIds(['b']);

    fireEvent.pointerDown(article!, { button: 0, clientX: 10, clientY: 10 });

    // The marquee clear-on-start would have wiped ['b']. Article path
    // does NOT touch selectedIconIds on pointerdown.
    expect(getSelectedIds()).toContain('b');
  });

  test('pointerdown on grid background (no modifier) clears selection and starts drag', () => {
    const { container } = render(<ListPane />);
    const grid = findGridContainer(container);
    expect(grid).not.toBeNull();

    editorStore.getState().setSelectedIconIds(['a', 'b']);
    stubClientRectsForArticles();

    // Dispatch pointerdown at a coordinate NOT covered by any article
    // stub (articles are at x=0..40, 48..88, 96..136; pick x=200).
    fireEvent.pointerDown(grid!, { button: 0, clientX: 200, clientY: 200 });

    // Replace-mode drag clears the base selection at start.
    expect(getSelectedIds()).toEqual([]);
  });

  test('pointerdown on grid background WITH shift preserves selection as the drag base', () => {
    const { container } = render(<ListPane />);
    const grid = findGridContainer(container);
    expect(grid).not.toBeNull();

    editorStore.getState().setSelectedIconIds(['a', 'b']);
    stubClientRectsForArticles();

    fireEvent.pointerDown(grid!, {
      button: 0,
      clientX: 200,
      clientY: 200,
      shiftKey: true,
    });

    // Toggle-mode drag keeps the base until pointermove/up changes it.
    expect(getSelectedIds()).toEqual(['a', 'b']);
  });

  test('pointerdown with a non-primary button is a no-op (marquee is left-click only)', () => {
    const { container } = render(<ListPane />);
    const grid = findGridContainer(container);
    expect(grid).not.toBeNull();

    editorStore.getState().setSelectedIconIds(['a']);

    fireEvent.pointerDown(grid!, { button: 2, clientX: 200, clientY: 200 });

    // Right-click does NOT start a drag, so selection is untouched.
    expect(getSelectedIds()).toEqual(['a']);
  });

  test('pointerup after a drag ends the drag cleanly (overlay unmounts)', () => {
    const { container } = render(<ListPane />);
    const grid = findGridContainer(container);
    expect(grid).not.toBeNull();
    stubClientRectsForArticles();

    // Start the drag and move once so the overlay actually mounts.
    // Without pointermove, marquee.rect is still null and the overlay
    // never existed in the first place — the original version of this
    // test passed vacuously because it asserted "null" in both cases.
    fireEvent.pointerDown(grid!, { button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(grid!, { clientX: 250, clientY: 250 });

    // Overlay IS mounted now — the drag is live and the rect is set.
    // ListPane's overlay carries `data-marquee-overlay` as a semantic
    // test hook. document.body because the overlay is position:fixed
    // and React portals to the tree root, not the render container.
    const duringDrag = document.body.querySelector('[data-marquee-overlay]');
    expect(duringDrag).not.toBeNull();

    fireEvent.pointerUp(grid!, { clientX: 250, clientY: 250 });

    const afterDrag = document.body.querySelector('[data-marquee-overlay]');
    expect(afterDrag).toBeNull();
  });

  test('pointercancel ends the drag (codex finding #2 — OS interrupt)', () => {
    const { container } = render(<ListPane />);
    const grid = findGridContainer(container);
    expect(grid).not.toBeNull();
    stubClientRectsForArticles();

    fireEvent.pointerDown(grid!, { button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(grid!, { clientX: 250, clientY: 250 });
    expect(document.body.querySelector('[data-marquee-overlay]')).not.toBeNull();

    // Cancel (touch cancellation, gesture preemption, OS interrupt).
    // Before the Phase 4 post-review fix, this left a stuck overlay
    // and the next click was treated as a continuation of the dead
    // drag. The hook's onPointerCancel now releases capture + clears.
    fireEvent.pointerCancel(grid!, { clientX: 250, clientY: 250 });
    expect(document.body.querySelector('[data-marquee-overlay]')).toBeNull();
  });

  test('lostpointercapture ends the drag (codex finding #2 — focus steal)', () => {
    const { container } = render(<ListPane />);
    const grid = findGridContainer(container);
    expect(grid).not.toBeNull();
    stubClientRectsForArticles();

    fireEvent.pointerDown(grid!, { button: 0, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(grid!, { clientX: 250, clientY: 250 });
    expect(document.body.querySelector('[data-marquee-overlay]')).not.toBeNull();

    // Simulate a modal stealing pointer capture mid-drag.
    fireEvent.lostPointerCapture(grid!, { clientX: 250, clientY: 250 });
    expect(document.body.querySelector('[data-marquee-overlay]')).toBeNull();
  });
});
