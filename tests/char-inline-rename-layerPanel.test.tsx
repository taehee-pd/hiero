// Characterization test for LayerPanel's inline-rename state machine.
//
// Plan §6 Phase 4 Commit 2: lock in CURRENT behavior before extraction.
// LayerPanel's rename semantics are DIFFERENT from IconGridItem's:
//
//   - State shape: `renamingLayerId: string | null` + `renameValue: string`
//     (multi-item state keyed by layer id, not a per-instance boolean)
//   - Enter commits:  trim, skip if empty, skip if trimmed === layerId,
//                     call renameLayer(currentIconId, oldLayerId, trimmed)
//   - Escape cancels: sets renamingLayerId = null, NO draft reset
//                     (input unmounts, so draft state is stranded but
//                     never observed again)
//   - Blur commits:   same logic as Enter
//   - The store action renameLayer() is itself the collision guard —
//     it no-ops if the new id already exists in the variant's layers.
//     LayerPanel's state machine does NOT keep the input open on
//     collision (unlike EditorShell Types), so from the user's
//     perspective an attempted rename to a colliding id silently
//     exits edit mode and the old name stays.
//   - Empty-string commit with Enter: state machine still closes the
//     input (setRenamingLayerId(null) always runs in commitRename)
//
// Differences from IconGridItem that this test locks in:
//   - NO cancelRename() function
//   - Escape does not reset renameValue
//   - Collision is enforced at the store layer, not the component
//   - Empty/unchanged DO exit edit mode (vs IconGridItem where empty
//     exits too but via different code path)

import './setup/happy-dom';
import './setup/react';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LayerPanel } from '@/components/editor/LayerPanel';
import { editorStore } from '@/lib/editor-store/store';
import type { Project } from '@/lib/schema/types';

afterEach(() => { cleanup(); });


function buildProject(): Project {
  return {
    version: '1.0',
    meta: {
      name: 'LayerPanel Char',
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
  const state = editorStore.getState();
  state.loadProject(structuredClone(buildProject()));
  editorStore.getState().setCurrentIcon('icon1');
  editorStore.getState().setCurrentVariant('v24');
}

function getAlphaRow(container: HTMLElement): HTMLElement {
  // The layer row exposes the layer id via data-layer-id or data-testid; if
  // neither is present, fall back to matching by visible label text.
  const byAttr = container.querySelector<HTMLElement>(
    '[data-layer-id="alpha"], [data-testid="layer-row-alpha"]',
  );
  if (byAttr) return byAttr;
  const byText = within(container).getAllByText('alpha').find((el) => el.tagName !== 'INPUT');
  if (!byText) throw new Error('Could not locate alpha layer row');
  return byText.closest('[role="listitem"], [role="button"], div') as HTMLElement;
}

function enterRenameMode(container: HTMLElement): HTMLInputElement {
  // Double-click the visible name to enter rename mode — this is the
  // public entry point and matches what a user actually does. F2 navigation
  // is keyboard-first and requires focused-index wiring that is brittle
  // across test renders; double-click on the label element is the common
  // path both user docs and the current code expose.
  const alphaText = within(container)
    .getAllByText('alpha')
    .find((el) => el.tagName !== 'INPUT');
  if (!alphaText) throw new Error('alpha label not found');
  fireEvent.doubleClick(alphaText);
  const input = container.querySelector<HTMLInputElement>('input[aria-label*="rename" i], input[value="alpha"]');
  if (!input) throw new Error('Rename input did not appear after double-click');
  return input;
}

function readLayerKeys(): string[] {
  const state = editorStore.getState();
  const icon = state.project?.icons.icon1;
  const variant = icon?.variants.v24;
  return variant ? Object.keys(variant.layers) : [];
}

describe('LayerPanel inline rename (characterization)', () => {
  beforeEach(() => {
    bootstrap();
  });

  test('starts in not-renaming state (no rename input mounted)', () => {
    const { container } = render(<LayerPanel />);
    expect(container.querySelector('input[value="alpha"]')).toBeNull();
  });

  test('double-click on layer name enters rename mode with draft = layerId', () => {
    const { container } = render(<LayerPanel />);
    const input = enterRenameMode(container);
    expect(input.value).toBe('alpha');
  });

  test('Enter commits via store.renameLayer — layer key becomes the new name', async () => {
    const { container } = render(<LayerPanel />);
    const input = enterRenameMode(container);
    const user = userEvent.setup();

    await user.clear(input);
    await user.type(input, 'renamed-alpha');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(readLayerKeys()).toContain('renamed-alpha');
    expect(readLayerKeys()).not.toContain('alpha');
  });

  test('Escape exits edit mode WITHOUT committing', async () => {
    const { container } = render(<LayerPanel />);
    const input = enterRenameMode(container);
    const user = userEvent.setup();

    await user.clear(input);
    await user.type(input, 'should-not-save');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(readLayerKeys()).toContain('alpha');
    expect(readLayerKeys()).not.toContain('should-not-save');
    // Input unmounted
    expect(container.querySelector('input[value="should-not-save"]')).toBeNull();
  });

  test('Blur commits (same semantics as Enter)', async () => {
    const { container } = render(<LayerPanel />);
    const input = enterRenameMode(container);
    const user = userEvent.setup();

    await user.clear(input);
    await user.type(input, 'blurred-alpha');
    fireEvent.blur(input);

    expect(readLayerKeys()).toContain('blurred-alpha');
  });

  test('Empty string does NOT rename, but DOES exit edit mode', async () => {
    const { container } = render(<LayerPanel />);
    const input = enterRenameMode(container);
    const user = userEvent.setup();

    await user.clear(input);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(readLayerKeys()).toContain('alpha');
    // Input should be unmounted (setRenamingLayerId(null) ran)
    expect(container.querySelector('input[value=""]')).toBeNull();
  });

  test('Collision with existing layer id is silently absorbed by the store — name unchanged', async () => {
    const { container } = render(<LayerPanel />);
    const input = enterRenameMode(container);
    const user = userEvent.setup();

    await user.clear(input);
    await user.type(input, 'beta'); // already exists on the variant
    fireEvent.keyDown(input, { key: 'Enter' });

    // renameLayer() no-ops on collision — both keys survive
    expect(readLayerKeys()).toContain('alpha');
    expect(readLayerKeys()).toContain('beta');
  });
});
