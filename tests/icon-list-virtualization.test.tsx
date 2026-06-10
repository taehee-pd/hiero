/**
 * D3 — icon list windowing (docs_canonical/IMPROVEMENT_BACKLOG.md).
 *
 * A 500-icon workspace must not mount 500 row buttons; below the
 * threshold the original (non-windowed) path stays intact.
 */
import './setup/happy-dom';
import './setup/react';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';

import { IconListPanel } from '@/components/editor/IconListPanel';
import { editorStore } from '@/lib/editor-store/store';
import { SAMPLE_PROJECT } from '@/lib/schema/sample-project';
import type { Icon, Project } from '@/lib/schema/types';

afterEach(() => {
  cleanup();
});

function projectWithIcons(count: number): Project {
  const base = structuredClone(SAMPLE_PROJECT);
  const template = Object.values(base.icons)[0]!;
  const icons: Record<string, Icon> = {};
  for (let i = 0; i < count; i++) {
    const id = `gen-icon-${String(i).padStart(4, '0')}`;
    icons[id] = { ...structuredClone(template), id, name: `Generated ${i}` };
  }
  return { ...base, icons };
}

test('windows large lists: 500 icons mount far fewer than 500 rows', () => {
  editorStore.getState().loadProject(projectWithIcons(500));
  const { container, getByTestId } = render(<IconListPanel />);
  expect(getByTestId('icon-list-virtual')).toBeInTheDocument();
  const rows = container.querySelectorAll('button[class*="rounded-lg"]');
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.length).toBeLessThan(100);
});

test('small lists keep the unwindowed path and render every row', () => {
  editorStore.getState().loadProject(projectWithIcons(20));
  const { container, queryByTestId } = render(<IconListPanel />);
  expect(queryByTestId('icon-list-virtual')).toBeNull();
  const rows = container.querySelectorAll('button[class*="rounded-lg"]');
  expect(rows.length).toBe(20);
});
