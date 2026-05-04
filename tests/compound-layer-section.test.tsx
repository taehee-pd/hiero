import './setup/happy-dom';
import './setup/react';
import { test, expect, afterEach } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { CompoundLayerSection } from '@/components/editor/CompoundLayerSection';
import { buildLeftLeaningCompound } from '@/lib/schema/compound';
import type { Layer } from '@/lib/schema/types';

afterEach(() => {
  cleanup();
});

const SQUARE_A = 'M0 0 L10 0 L10 10 L0 10 Z';
const SQUARE_B = 'M5 5 L15 5 L15 15 L5 15 Z';
const SQUARE_C = 'M2 2 L8 2 L8 8 L2 8 Z';

function compoundLayer(): Layer {
  return {
    id: 'L',
    style: { fill: { mode: 'fixed', value: '#000' } },
    path: { d: 'M0 0 L15 0 L15 15 L0 15 Z' },
    compound: buildLeftLeaningCompound(
      'subtract',
      [{ d: SQUARE_A }, { d: SQUARE_B }, { d: SQUARE_C }],
      'L',
    ),
  } as Layer;
}

test('renders the outermost op glyph and operand count', () => {
  const layer = compoundLayer();
  const { getAllByText, getByText } = render(
    <CompoundLayerSection
      layer={layer}
      onFlatten={() => {}}
      onConvertToGroup={() => {}}
    />,
  );
  // − appears twice: once as the section's outermost-op glyph in
  // the header, once inside the tree disclosure for the same
  // (root) op node.
  expect(getAllByText('−').length).toBeGreaterThanOrEqual(1);
  // Three operands → "3 operands"
  expect(getByText(/3 operands/)).toBeDefined();
});

test('Convert to group calls the handler immediately (no confirm)', () => {
  let convertCalls = 0;
  const { getByText } = render(
    <CompoundLayerSection
      layer={compoundLayer()}
      onFlatten={() => {}}
      onConvertToGroup={() => {
        convertCalls += 1;
      }}
    />,
  );
  fireEvent.click(getByText('Convert to group'));
  expect(convertCalls).toBe(1);
});

test('Flatten opens a confirm dialog and only fires on confirmation', () => {
  let flattenCalls = 0;
  const { getByText, queryByText } = render(
    <CompoundLayerSection
      layer={compoundLayer()}
      onFlatten={() => {
        flattenCalls += 1;
      }}
      onConvertToGroup={() => {}}
    />,
  );
  // Initial click opens the dialog; handler not called yet.
  fireEvent.click(getByText(/Flatten…/));
  expect(flattenCalls).toBe(0);
  expect(getByText(/Flatten this compound\?/)).toBeDefined();

  // Confirm.
  fireEvent.click(getByText('Flatten anyway'));
  expect(flattenCalls).toBe(1);
});

test('Flatten dialog cancel does not fire the handler', () => {
  let flattenCalls = 0;
  const { getByText } = render(
    <CompoundLayerSection
      layer={compoundLayer()}
      onFlatten={() => {
        flattenCalls += 1;
      }}
      onConvertToGroup={() => {}}
    />,
  );
  fireEvent.click(getByText(/Flatten…/));
  fireEvent.click(getByText('Keep compound'));
  expect(flattenCalls).toBe(0);
});

test('operand leaves are non-interactive when no onOperandSelect is provided', () => {
  const { container } = render(
    <CompoundLayerSection
      layer={compoundLayer()}
      onFlatten={() => {}}
      onConvertToGroup={() => {}}
    />,
  );
  // Read-only mode: no buttons inside the operand tree disclosure.
  // The tree renders divs only.
  const treeButtons = container.querySelectorAll(
    'button[aria-label^="Select operand"]',
  );
  expect(treeButtons.length).toBe(0);
});

test('operand leaves become clickable buttons when onOperandSelect is provided (W2-3)', () => {
  let selected: string | null = null;
  const { getAllByLabelText } = render(
    <CompoundLayerSection
      layer={compoundLayer()}
      onFlatten={() => {}}
      onConvertToGroup={() => {}}
      onOperandSelect={(id) => { selected = id; }}
    />,
  );
  // Three operands → three "Select operand …" buttons.
  const buttons = getAllByLabelText(/Select operand/);
  expect(buttons.length).toBe(3);
  fireEvent.click(buttons[1]!);
  expect(selected).not.toBeNull();
  expect((selected as unknown as string).endsWith('/op1')).toBe(true);
});

test('selectedOperandId reflects via aria-pressed on the matching leaf', () => {
  const layer = compoundLayer();
  const operandIds = Object.keys(layer.compound!.operands);
  const { getAllByLabelText } = render(
    <CompoundLayerSection
      layer={layer}
      onFlatten={() => {}}
      onConvertToGroup={() => {}}
      onOperandSelect={() => {}}
      selectedOperandId={operandIds[1]}
    />,
  );
  const buttons = getAllByLabelText(/Select operand/);
  expect(buttons[0]!.getAttribute('aria-pressed')).toBe('false');
  expect(buttons[1]!.getAttribute('aria-pressed')).toBe('true');
  expect(buttons[2]!.getAttribute('aria-pressed')).toBe('false');
});

test('returns null for layers without a compound', () => {
  const layer: Layer = {
    id: 'L',
    style: { fill: { mode: 'fixed', value: '#000' } },
    path: { d: SQUARE_A },
  } as Layer;
  const { container } = render(
    <CompoundLayerSection
      layer={layer}
      onFlatten={() => {}}
      onConvertToGroup={() => {}}
    />,
  );
  expect(container.innerHTML).toBe('');
});
