// Characterization test for IconGridItem's inline-rename state machine.
//
// Plan §6 Phase 4 Commit 2: lock in the CURRENT behavior before any
// hook extraction so Commit 3 can assert parity. Each site has subtly
// different semantics — IconGridItem specifically:
//
//   - starts in the not-renaming state
//   - Enter commits  (trim, skip if empty or unchanged, call onRename)
//   - Escape cancels (resets draft to original, exits edit mode)
//   - Blur commits   (same trim/skip/call semantics as Enter)
//   - Empty string:  NO-op (handled by the `if (trimmed)` check)
//   - Unchanged:     NO-op (handled by `trimmed !== iconName` check)
//   - Enter rename via F2 key on the card OR double-click on the label
//
// These assertions reflect behavior observed at
// components/explorer/IconGridItem.tsx (Phase 2 HEAD). If Phase 4
// Commit 3's hook extraction changes any of them, this test must be
// updated in the SAME commit — silent divergence is the failure mode
// codex flagged during Phase 2's adversarial review.

import './setup/happy-dom';
import './setup/react';

import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconGridItem } from '@/components/explorer/IconGridItem';

afterEach(() => { cleanup(); });


function makeProps(overrides: Partial<Parameters<typeof IconGridItem>[0]> = {}) {
  const props = {
    iconId: 'arrow-right',
    iconName: 'arrow-right',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>',
    active: false,
    selected: false,
    favorite: false,
    onOpen: mock(() => {}),
    onSelect: mock(() => {}),
    onShiftClick: mock(() => {}),
    onToggleFavorite: mock(() => {}),
    onRename: mock((_next: string) => {}),
    ...overrides,
  };
  return props;
}

async function enterRenameMode(container: HTMLElement) {
  // The state machine supports two entry points:
  //   1. F2 on the card
  //   2. Double-click on the <p> label
  // We use F2 here because it does not race with pointerdown/pointerup
  // the way double-click does under happy-dom.
  // The card is role="button" (it activates on Enter/Space to open the icon);
  // see IconGridItem. It used to be role="listitem".
  const card = container.querySelector('article[role="button"]');
  expect(card).not.toBeNull();
  (card as HTMLElement).focus();
  fireEvent.keyDown(card as Element, { key: 'F2' });
  const input = container.querySelector('input[aria-label^="Rename"]') as HTMLInputElement | null;
  expect(input).not.toBeNull();
  return input!;
}

describe('IconGridItem inline rename (characterization)', () => {
  test('starts in not-renaming state', () => {
    const props = makeProps();
    const { container } = render(<IconGridItem {...props} />);
    // In not-renaming state the label is a <p>, not an <input>.
    expect(container.querySelector('input[aria-label^="Rename"]')).toBeNull();
    expect(container.querySelector('p')).not.toBeNull();
  });

  test('F2 on the card enters rename mode with draft = iconName', async () => {
    const props = makeProps();
    const { container } = render(<IconGridItem {...props} />);
    const input = await enterRenameMode(container);
    expect(input.value).toBe('arrow-right');
  });

  test('Enter commits the trimmed draft via onRename', async () => {
    const props = makeProps();
    const user = userEvent.setup();
    const { container } = render(<IconGridItem {...props} />);
    const input = await enterRenameMode(container);

    await user.clear(input);
    await user.type(input, '  arrow-right-v2  ');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(props.onRename).toHaveBeenCalledTimes(1);
    expect(props.onRename).toHaveBeenCalledWith('arrow-right-v2');
  });

  test('Escape cancels — draft is discarded and onRename is NOT called', async () => {
    const props = makeProps();
    const user = userEvent.setup();
    const { container } = render(<IconGridItem {...props} />);
    const input = await enterRenameMode(container);

    await user.clear(input);
    await user.type(input, 'changed');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(props.onRename).not.toHaveBeenCalled();
    // Exits edit mode — input is unmounted, label is back.
    expect(container.querySelector('input[aria-label^="Rename"]')).toBeNull();
  });

  test('Blur commits the draft (matches Enter semantics)', async () => {
    const props = makeProps();
    const user = userEvent.setup();
    const { container } = render(<IconGridItem {...props} />);
    const input = await enterRenameMode(container);

    await user.clear(input);
    await user.type(input, 'via-blur');
    fireEvent.blur(input);

    expect(props.onRename).toHaveBeenCalledTimes(1);
    expect(props.onRename).toHaveBeenCalledWith('via-blur');
  });

  test('Empty string does NOT trigger onRename (commit is skipped)', async () => {
    const props = makeProps();
    const user = userEvent.setup();
    const { container } = render(<IconGridItem {...props} />);
    const input = await enterRenameMode(container);

    await user.clear(input);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(props.onRename).not.toHaveBeenCalled();
  });

  test('Unchanged name does NOT trigger onRename (commit is skipped)', async () => {
    const props = makeProps({ iconName: 'same' });
    const { container } = render(<IconGridItem {...props} />);
    const input = await enterRenameMode(container);

    // value is already 'same' from the draft seed
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(props.onRename).not.toHaveBeenCalled();
  });
});
