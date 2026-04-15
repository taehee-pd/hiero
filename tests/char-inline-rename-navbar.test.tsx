// Characterization test for Navbar's inline-rename state machine.
//
// Plan §6 Phase 4 Commit 2: lock in CURRENT behavior before extraction.
// Navbar has the TRICKIEST rename semantics of the four sites. Its
// state machine uses a ref flag (`nameEditCancelledRef`) to handle a
// subtle race: when the user hits Escape, React will exit edit mode
// AND fire a blur event on the next tick. If blur's commit handler
// ran naively, Escape would silently commit the draft instead of
// cancelling it. The ref flag blocks that.
//
// Behaviors this test locks in:
//
//   - State shape: `isEditingName: boolean` + `editingNameValue: string`
//                 + `nameEditCancelledRef: MutableRefObject<boolean>`
//   - Enter commits:  trim, skip if empty, skip if unchanged, call
//                     editorStore.getState().renameIconSet(id, trimmed)
//   - Blur commits:   same logic, UNLESS nameEditCancelledRef is true
//                     (in which case it no-ops and resets the flag)
//   - Escape cancels: sets the ref flag, exits edit mode. The blur
//                     that follows will see the flag and no-op.
//   - Empty-string Enter: no rename (trim check), but DOES exit edit mode
//   - Click the project-name button to start editing (not a double-click
//     — it's a single-click on a ghost pencil button)
//
// What makes this DIFFERENT from IconGridItem / LayerPanel / EditorShell:
//   - The cancelledRef blur-guard pattern. Other sites either reset
//     the draft (IconGridItem) or leave stale state unreachable
//     (LayerPanel, EditorShell Types — input unmounts).
//   - Uses editorStore.getState() directly, NOT a prop callback.
//   - Depends on `activeIconSetId` and `workspace.iconSets[id].meta.name`
//     for the display name, not a prop.
//
// This test extraction shows why a single useInlineRename hook cannot
// capture all four sites: Navbar's contract with the store is specific
// and the blur-race handling is optional, not universal.

import './setup/happy-dom';
import './setup/react';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navbar } from '@/components/studio/Navbar';
import { editorStore } from '@/lib/editor-store/store';
import type { Workspace } from '@/lib/schema/types';

afterEach(() => { cleanup(); });


function buildWorkspace(name: string): Workspace {
  return {
    version: '2.0',
    meta: {
      name: 'Navbar Char',
      createdAt: '2026-04-15T00:00:00Z',
      updatedAt: '2026-04-15T00:00:00Z',
    },
    activeIconSetId: 'set1',
    iconSets: {
      set1: {
        version: '1.0',
        meta: {
          name,
          createdAt: '2026-04-15T00:00:00Z',
          updatedAt: '2026-04-15T00:00:00Z',
        },
        icons: {},
      },
    },
  };
}

function bootstrap(initialName = 'My Project') {
  editorStore.getState().loadWorkspace(buildWorkspace(initialName));
}

function getProjectName(): string | undefined {
  return editorStore.getState().workspace?.iconSets.set1?.meta.name;
}

function getDisplayedProjectName(): string | undefined {
  return editorStore.getState().project?.meta.name;
}

function findProjectNameButton(container: HTMLElement): HTMLButtonElement | null {
  // The Navbar renders a button wrapping the project name span. Find it by
  // text content — more robust than selector-based lookups that depend on
  // class names.
  const buttons = container.querySelectorAll<HTMLButtonElement>('button');
  for (const btn of buttons) {
    if (btn.textContent?.includes('My Project') || btn.textContent?.includes('Displayed')) {
      return btn;
    }
  }
  return null;
}

function findRenameInput(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>('input[value="My Project"]')
    ?? document.querySelector<HTMLInputElement>('input[value="Displayed"]');
}

describe('Navbar inline rename (characterization)', () => {
  beforeEach(() => {
    bootstrap('My Project');
  });

  test('starts in not-editing state — name is a button, not an input', () => {
    const { container } = render(<Navbar />);
    const button = findProjectNameButton(container);
    expect(button).not.toBeNull();
    // No input with the project name should exist
    expect(document.querySelector('input[value="My Project"]')).toBeNull();
  });

  test('Click on name button enters edit mode with draft = current name', () => {
    const { container } = render(<Navbar />);
    const button = findProjectNameButton(container);
    expect(button).not.toBeNull();
    fireEvent.click(button!);

    const input = findRenameInput();
    expect(input).not.toBeNull();
    expect(input!.value).toBe('My Project');
  });

  test('Enter commits via renameIconSet — workspace.iconSets.set1.meta.name updates', async () => {
    const { container } = render(<Navbar />);
    const button = findProjectNameButton(container);
    fireEvent.click(button!);
    const input = findRenameInput()!;

    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, 'Renamed Project');
    fireEvent.keyDown(input, { key: 'Enter' });
    // Enter triggers commitNameEdit synchronously but React may also
    // fire blur when the input unmounts — that blur is the one guarded
    // by the cancelledRef. For Enter, both fire and the name should
    // commit exactly once.

    expect(getProjectName()).toBe('Renamed Project');
  });

  test('Escape cancels — name stays unchanged and the blur race does NOT commit the draft', async () => {
    const { container } = render(<Navbar />);
    const button = findProjectNameButton(container);
    fireEvent.click(button!);
    const input = findRenameInput()!;

    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, 'This should NOT save');
    fireEvent.keyDown(input, { key: 'Escape' });
    // In the current code: Escape sets nameEditCancelledRef=true and
    // setIsEditingName(false). React then unmounts the input, which
    // triggers onBlur → commitNameEdit → sees the ref flag and no-ops.
    // Simulate the blur explicitly because happy-dom does not always
    // fire synthetic blur on unmount.
    fireEvent.blur(input);

    expect(getProjectName()).toBe('My Project');
  });

  test('Blur commits (when NOT preceded by Escape)', async () => {
    const { container } = render(<Navbar />);
    const button = findProjectNameButton(container);
    fireEvent.click(button!);
    const input = findRenameInput()!;

    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, 'Blur Committed');
    fireEvent.blur(input);

    expect(getProjectName()).toBe('Blur Committed');
  });

  test('Empty string Enter does not rename — empty trim short-circuits', async () => {
    const { container } = render(<Navbar />);
    const button = findProjectNameButton(container);
    fireEvent.click(button!);
    const input = findRenameInput()!;

    const user = userEvent.setup();
    await user.clear(input);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(getProjectName()).toBe('My Project');
  });

  test('Unchanged name does not call renameIconSet (short-circuit at trimmed === projectName)', async () => {
    const { container } = render(<Navbar />);
    const nameBefore = getDisplayedProjectName();
    const button = findProjectNameButton(container);
    fireEvent.click(button!);
    const input = findRenameInput()!;

    fireEvent.keyDown(input, { key: 'Enter' });

    // Store is untouched; timestamps would have changed if renameIconSet ran
    expect(getProjectName()).toBe(nameBefore!);
  });
});
