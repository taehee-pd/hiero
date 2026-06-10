/**
 * D2 — Canvas smoke coverage (docs_canonical/IMPROVEMENT_BACKLOG.md).
 *
 * The canvas had zero unit coverage. These pin the two macro states:
 * an icon renders into the editor SVG (focusable, labelled), and the
 * empty state offers the actionable CTAs.
 */
import './setup/happy-dom';
import './setup/react';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';

import { Canvas } from '@/components/editor/Canvas';
import { editorStore } from '@/lib/editor-store/store';
import { SAMPLE_WORKSPACE } from '@/lib/schema/sample-project';

afterEach(() => {
  cleanup();
});

test('renders the editor SVG as a focusable, labelled region when an icon is open', () => {
  editorStore.getState().loadWorkspace(structuredClone(SAMPLE_WORKSPACE));
  const { container } = render(<Canvas />);

  const region = container.querySelector('[data-canvas-interaction-root]')!;
  expect(region).toBeInTheDocument();
  // B5: the canvas is a keyboard tab stop with SR instructions.
  expect(region.getAttribute('tabindex')).toBe('0');
  expect(region.getAttribute('aria-label')).toBe('Icon editor canvas');
  expect(region.getAttribute('aria-describedby')).toBe('canvas-keyboard-help');

  expect(container.querySelector('svg[data-editor-canvas="true"]')).toBeInTheDocument();
});

test('empty state offers New icon / Import / Search / Example CTAs', () => {
  editorStore.getState().loadWorkspace(structuredClone(SAMPLE_WORKSPACE));
  editorStore.setState({ currentIconId: null, currentVariantId: null });
  const { getByText } = render(<Canvas />);

  expect(getByText('No icon selected')).toBeInTheDocument();
  expect(getByText('New icon')).toBeInTheDocument();
  expect(getByText('Import existing SVG')).toBeInTheDocument();
  expect(getByText('Search icons')).toBeInTheDocument();
  expect(getByText('Start from an example')).toBeInTheDocument();
});
