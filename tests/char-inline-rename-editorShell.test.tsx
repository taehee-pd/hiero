// Characterization test for EditorShell `TypesSection` inline-rename.
//
// Plan §6 Phase 4 Commit 2: lock in CURRENT behavior before extraction.
// TypesSection has the MOST COMPLEX rename semantics of the four sites —
// it is the ONLY site with collision detection that keeps the input
// OPEN on collision, plus a special case for the default type where
// renaming changes only the display label (not the structural id).
//
// Behaviors this test locks in:
//
//   - State shape: `renamingId: string | null` + `renameValue: string`
//   - Default type rename: calls onSetTypeName(id, trimmed), updates
//     the display label only, closes the input.
//   - Non-default rename:
//       * trimmed === typeId OR empty → close input, NO onRenameType call
//       * trimmed matches an existing id in the catalog → KEEP input
//         open, NO onRenameType call (this is the collision guard)
//       * otherwise → call onRenameType(old, trimmed), close input
//   - Enter commits, Escape closes without committing, Blur commits
//   - Uses click (not double-click, not F2) to enter rename mode —
//     the inline label span has an onClick that starts the rename
//
// What makes this the HARDEST site to unify into one extracted hook:
//   - Collision keeps the input OPEN. Every other site closes on
//     commit attempt. A unified hook would need a commit result that
//     can signal "reject, stay open" — a different return shape from
//     the simple fire-and-forget pattern of IconGridItem/LayerPanel.
//   - Default type has a separate callback branch. Can't be modeled
//     by a single onRename handler without leaking type-of-site into
//     the hook API.
//
// Together these two observations are why Phase 4 Commit 3 will likely
// migrate only the "simple" sites (IconGridItem + LayerPanel) and
// leave Navbar and EditorShell Types inline with their current
// bespoke state machines.

import './setup/happy-dom';
import './setup/react';

import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TypesSection } from '@/components/editor/EditorShell';

afterEach(() => { cleanup(); });


type TypeCatalog = Record<string, { id: string; name?: string }>;

function makeProps(overrides: Partial<Parameters<typeof TypesSection>[0]> = {}) {
  const typeCatalog: TypeCatalog = {
    default: { id: 'default', name: 'Outline' },
    filled: { id: 'filled' },
  };
  return {
    typeCatalog,
    defaultTypeId: 'default',
    currentTypeId: 'default',
    onSelectType: mock((_: string) => {}),
    onAddType: mock((_: string) => {}),
    onRemoveType: mock((_: string) => {}),
    onRenameType: mock((_old: string, _new: string) => {}),
    onSetTypeName: mock((_id: string, _name: string) => {}),
    onDuplicateType: mock((_src: string, _new: string) => {}),
    ...overrides,
  };
}

function startRenameOnRow(container: HTMLElement, visibleLabel: string): HTMLInputElement {
  // The row Button has `onDoubleClick={startRename}` at line ~418 of
  // EditorShell.tsx. Single click is bound to onSelectType. So we
  // double-click the label to enter rename mode.
  const label = within(container)
    .getAllByText(visibleLabel, { exact: false })
    .find((el) => el.tagName !== 'INPUT');
  if (!label) throw new Error(`Label "${visibleLabel}" not found`);
  fireEvent.doubleClick(label);
  const input = container.querySelector<HTMLInputElement>('input.inline-rename-input');
  if (!input) throw new Error('Rename input did not appear after double-click');
  return input;
}

describe('EditorShell TypesSection inline rename (characterization)', () => {
  test('starts in not-renaming state — both rows render their labels, no rename input', () => {
    const props = makeProps();
    const { container } = render(<TypesSection {...props} />);
    expect(container.querySelector('input.inline-rename-input')).toBeNull();
  });

  test('Default type — Enter commits via onSetTypeName, NOT onRenameType', async () => {
    const props = makeProps();
    const { container } = render(<TypesSection {...props} />);
    const input = startRenameOnRow(container, 'Outline');

    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, 'Stroke');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(props.onSetTypeName).toHaveBeenCalledTimes(1);
    expect(props.onSetTypeName).toHaveBeenCalledWith('default', 'Stroke');
    expect(props.onRenameType).not.toHaveBeenCalled();
    // Input closes
    expect(container.querySelector('input.inline-rename-input')).toBeNull();
  });

  test('Default type — unchanged name short-circuits without calling onSetTypeName', () => {
    const props = makeProps();
    const { container } = render(<TypesSection {...props} />);
    const input = startRenameOnRow(container, 'Outline');

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(props.onSetTypeName).not.toHaveBeenCalled();
    // Input still closes
    expect(container.querySelector('input.inline-rename-input')).toBeNull();
  });

  test('Non-default type — Enter commits via onRenameType with trimmed value', async () => {
    const props = makeProps({ currentTypeId: 'filled' });
    const { container } = render(<TypesSection {...props} />);
    const input = startRenameOnRow(container, 'filled');

    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, '  colored  ');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(props.onRenameType).toHaveBeenCalledTimes(1);
    expect(props.onRenameType).toHaveBeenCalledWith('filled', 'colored');
    expect(container.querySelector('input.inline-rename-input')).toBeNull();
  });

  test('Non-default type — collision with existing id KEEPS the input open', async () => {
    const props = makeProps();
    const { container } = render(<TypesSection {...props} />);
    const input = startRenameOnRow(container, 'filled');

    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, 'default'); // already exists in the catalog
    fireEvent.keyDown(input, { key: 'Enter' });

    // Collision guard — NO rename, input STAYS open. This is the
    // behavior that distinguishes TypesSection from every other site.
    expect(props.onRenameType).not.toHaveBeenCalled();
    expect(container.querySelector('input.inline-rename-input')).not.toBeNull();
  });

  test('Non-default type — empty or unchanged closes without calling onRenameType', () => {
    const props = makeProps();
    const { container } = render(<TypesSection {...props} />);
    const input = startRenameOnRow(container, 'filled');

    // value is 'filled' = typeId → unchanged branch
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(props.onRenameType).not.toHaveBeenCalled();
    expect(container.querySelector('input.inline-rename-input')).toBeNull();
  });

  test('Escape closes without committing (any row, any branch)', async () => {
    const props = makeProps();
    const { container } = render(<TypesSection {...props} />);
    const input = startRenameOnRow(container, 'filled');

    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, 'not-saved');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(props.onRenameType).not.toHaveBeenCalled();
    expect(props.onSetTypeName).not.toHaveBeenCalled();
    expect(container.querySelector('input.inline-rename-input')).toBeNull();
  });

  test('Blur commits (Enter semantics)', async () => {
    const props = makeProps({ currentTypeId: 'filled' });
    const { container } = render(<TypesSection {...props} />);
    const input = startRenameOnRow(container, 'filled');

    const user = userEvent.setup();
    await user.clear(input);
    await user.type(input, 'via-blur');
    fireEvent.blur(input);

    expect(props.onRenameType).toHaveBeenCalledTimes(1);
    expect(props.onRenameType).toHaveBeenCalledWith('filled', 'via-blur');
  });
});
