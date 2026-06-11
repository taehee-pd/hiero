// Perf-characterization test for ListPane SVG memoization.
//
// Proves that:
//  1. 200 icons render without error.
//  2. exportSvgString is called at most once per unique icon (not per render).
//  3. A second render triggered by a selection change does NOT call
//     exportSvgString again — the SVG cache is still valid.
//
// Implementation note: mock.module must appear BEFORE the static
// import of the module-under-test (ListPane) so the bundler resolves
// the import to the stub. This is the same ordering used in
// tests/editor-redirect.test.tsx and tests/transition-stagger-override.test.ts.

import './setup/happy-dom';
import './setup/react';

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, act } from '@testing-library/react';

// --- Mock exportSvgString BEFORE importing ListPane ---
let exportCallCount = 0;
const exportSvgStringMock = mock((..._args: unknown[]) => {
  exportCallCount++;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>';
});

mock.module('@/lib/export/export-svg', () => ({
  exportSvgString: exportSvgStringMock,
}));

// These imports resolve AFTER the mock is registered.
import { ListPane } from '@/components/studio/ListPane';
import { editorStore } from '@/lib/editor-store/store';
import type { Icon, Workspace } from '@/lib/schema/types';

afterEach(() => {
  cleanup();
  exportCallCount = 0;
  exportSvgStringMock.mockClear();
});

// Build a workspace with `n` icons, each with a single variant and layer.
function buildWorkspace(n: number): Workspace {
  const icons: Record<string, Icon> = {};
  for (let i = 0; i < n; i++) {
    const id = `icon-${i}`;
    icons[id] = {
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
    };
  }

  return {
    version: '2.0',
    meta: {
      name: 'Perf Test',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    activeIconSetId: 'set1',
    iconSets: {
      set1: {
        version: '1.0',
        meta: {
          name: 'Set 1',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        icons,
      },
    },
  };
}

function bootstrap(n: number) {
  editorStore.getState().loadWorkspace(buildWorkspace(n));
  editorStore.setState({ listPaneExpanded: true });
}

describe('ListPane SVG memoization (perf characterization)', () => {
  describe('200-icon project', () => {
    beforeEach(() => {
      bootstrap(200);
    });

    test('renders 200 icon articles without error', () => {
      const { container } = render(<ListPane />);
      const articles = container.querySelectorAll('article[data-icon-id]');
      expect(articles.length).toBe(200);
    });

    test('exportSvgString is called at most once per icon on first render', () => {
      render(<ListPane />);
      // The SVG cache runs exportSvgString for ALL project icons (not just
      // filtered ones), so we expect exactly 200 calls on first mount.
      expect(exportCallCount).toBeLessThanOrEqual(200);
      expect(exportCallCount).toBeGreaterThan(0);
    });

    test('selection change does not re-invoke exportSvgString', () => {
      render(<ListPane />);
      const callsAfterMount = exportCallCount;
      // Trigger a state update that changes selection but NOT project.icons.
      act(() => {
        editorStore.getState().setSelectedIconIds(['icon-0', 'icon-1']);
      });
      // exportSvgString must NOT be called again — the cache is still valid.
      expect(exportCallCount).toBe(callsAfterMount);
    });

    test('search query change does not re-invoke exportSvgString', () => {
      // Render and capture baseline call count.
      const { getByLabelText } = render(<ListPane />);
      const callsAfterMount = exportCallCount;

      // Type into the search box — this filters `filtered` but must not
      // invalidate the SVG cache (different useMemo dep chain).
      act(() => {
        const input = getByLabelText('Search icons');
        input.focus();
        // Directly update the store-independent local state through DOM event.
        Object.defineProperty(input, 'value', { writable: true, value: 'icon-1' });
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });

      expect(exportCallCount).toBe(callsAfterMount);
    });
  });
});
