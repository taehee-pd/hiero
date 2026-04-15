// Characterization test for LayerPanel's marquee multi-select.
//
// Plan §6 Phase 4 Commit 2: lock in CURRENT behavior before extraction.
// See char-marquee-listPane.test.tsx for the SCOPE NOTE on why this
// only exercises the drag LIFECYCLE and not the full hit-test math.
//
// LayerPanel's marquee is structurally identical to ListPane's but
// operates on `selection.layerIds` (via useSelection + setSelection
// from the editor store) instead of `selectedIconIds`, and hit-tests
// `[data-layer-id]` elements instead of `article[data-icon-id]`.
//
// Behaviors this test locks in:
//
//   - Pointerdown on layer-list background (not inside [data-layer-id]
//     and not on a scrollbar) begins a marquee drag.
//   - Pointerdown WITHOUT shift/meta clears layer selection at start.
//   - Pointerdown WITH shift/meta preserves existing layer selection
//     as the drag base.
//   - Pointerdown on a layer row ([data-layer-id]) does NOT start a drag.
//   - Non-primary button is a no-op.
//
// Extraction implication: the logic is 100% shared with ListPane
// except for the `data-*` attribute name and the selection store
// binding. A shared useMarqueeSelection hook should accept both as
// parameters — one itemSelector string, one (ids) => void writer.

import './setup/happy-dom';
import './setup/react';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { LayerPanel } from '@/components/editor/LayerPanel';
import { editorStore } from '@/lib/editor-store/store';
import type { Project } from '@/lib/schema/types';

afterEach(() => { cleanup(); });


function buildProject(): Project {
  return {
    version: '1.0',
    meta: {
      name: 'LayerPanel Marquee Char',
      createdAt: '2026-04-15T00:00:00Z',
      updatedAt: '2026-04-15T00:00:00Z',
    },
    icons: {
      icon1: {
        id: 'icon1',
        name: 'Icon 1',
        variants: {
          v24: {
            id: 'v24',
            size: 24,
            viewBox: [0, 0, 24, 24],
            layers: {
              alpha: {
                id: 'alpha',
                path: { d: 'M0 0 H10 V10 H0 Z' },
                style: { fill: { mode: 'fixed', value: '#111' } },
                transform: { x: 0, y: 0 },
              },
              beta: {
                id: 'beta',
                path: { d: 'M0 0 H6 V6 H0 Z' },
                style: { fill: { mode: 'fixed', value: '#222' } },
                transform: { x: 12, y: 12 },
              },
            },
            defaultType: 'default',
            types: {
              default: {
                id: 'default',
                layers: {
                  alpha: {
                    id: 'alpha',
                    path: { d: 'M0 0 H10 V10 H0 Z' },
                    style: { fill: { mode: 'fixed', value: '#111' } },
                    transform: { x: 0, y: 0 },
                  },
                  beta: {
                    id: 'beta',
                    path: { d: 'M0 0 H6 V6 H0 Z' },
                    style: { fill: { mode: 'fixed', value: '#222' } },
                    transform: { x: 12, y: 12 },
                  },
                },
              },
            },
          },
        },
        transitions: {},
      },
    },
  };
}

function bootstrap() {
  editorStore.getState().loadProject(structuredClone(buildProject()));
  editorStore.getState().setCurrentIcon('icon1');
  editorStore.getState().setCurrentVariant('v24');
}

function getSelectedLayerIds(): string[] {
  return [...editorStore.getState().selection.layerIds];
}

function findLayerListContainer(root: HTMLElement): HTMLElement | null {
  // The pointerdown handler lives on the div that wraps the layer
  // list items. Find it by walking up from the first [data-layer-id].
  const firstRow = root.querySelector<HTMLElement>('[data-layer-id]');
  if (!firstRow) return null;
  return firstRow.parentElement ?? null;
}

describe('LayerPanel marquee multi-select (characterization)', () => {
  beforeEach(() => {
    bootstrap();
  });

  test('renders [data-layer-id] rows for each seed layer', () => {
    const { container } = render(<LayerPanel />);
    const rows = container.querySelectorAll('[data-layer-id]');
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  test('pointerdown on a layer row does NOT start a marquee drag', () => {
    const { container } = render(<LayerPanel />);
    const row = container.querySelector<HTMLElement>('[data-layer-id="alpha"]');
    expect(row).not.toBeNull();

    // Seed existing selection. Marquee-on-start would clear it; the
    // layer-row path does NOT.
    editorStore.getState().setSelection({ layerIds: ['beta'], pointIds: [] });

    fireEvent.pointerDown(row!, { button: 0, clientX: 10, clientY: 10 });

    expect(getSelectedLayerIds()).toContain('beta');
  });

  test('pointerdown on list background without modifiers clears selection and starts drag', () => {
    const { container } = render(<LayerPanel />);
    const list = findLayerListContainer(container);
    expect(list).not.toBeNull();

    editorStore.getState().setSelection({ layerIds: ['alpha', 'beta'], pointIds: [] });

    // Dispatch pointerdown on the list background (avoid hitting a row).
    // Use the container element itself as the target to ensure closest
    // [data-layer-id] returns null.
    fireEvent.pointerDown(list!, { button: 0, clientX: 500, clientY: 500 });

    expect(getSelectedLayerIds()).toEqual([]);
  });

  test('pointerdown on list background WITH shift preserves base layer selection', () => {
    const { container } = render(<LayerPanel />);
    const list = findLayerListContainer(container);
    expect(list).not.toBeNull();

    editorStore.getState().setSelection({ layerIds: ['alpha'], pointIds: [] });

    fireEvent.pointerDown(list!, {
      button: 0,
      clientX: 500,
      clientY: 500,
      shiftKey: true,
    });

    expect(getSelectedLayerIds()).toEqual(['alpha']);
  });

  test('pointerdown with a non-primary button is a no-op', () => {
    const { container } = render(<LayerPanel />);
    const list = findLayerListContainer(container);
    expect(list).not.toBeNull();

    editorStore.getState().setSelection({ layerIds: ['alpha'], pointIds: [] });

    fireEvent.pointerDown(list!, { button: 2, clientX: 500, clientY: 500 });

    expect(getSelectedLayerIds()).toEqual(['alpha']);
  });

  test('pointercancel ends the drag (codex finding #2)', () => {
    const { container } = render(<LayerPanel />);
    const list = findLayerListContainer(container);
    expect(list).not.toBeNull();

    fireEvent.pointerDown(list!, { button: 0, clientX: 500, clientY: 500 });
    fireEvent.pointerMove(list!, { clientX: 510, clientY: 510 });
    expect(document.body.querySelector('[data-marquee-overlay]')).not.toBeNull();

    fireEvent.pointerCancel(list!, { clientX: 510, clientY: 510 });
    expect(document.body.querySelector('[data-marquee-overlay]')).toBeNull();
  });

  test('lostpointercapture ends the drag (codex finding #2)', () => {
    const { container } = render(<LayerPanel />);
    const list = findLayerListContainer(container);
    expect(list).not.toBeNull();

    fireEvent.pointerDown(list!, { button: 0, clientX: 500, clientY: 500 });
    fireEvent.pointerMove(list!, { clientX: 510, clientY: 510 });
    expect(document.body.querySelector('[data-marquee-overlay]')).not.toBeNull();

    fireEvent.lostPointerCapture(list!, { clientX: 510, clientY: 510 });
    expect(document.body.querySelector('[data-marquee-overlay]')).toBeNull();
  });
});
