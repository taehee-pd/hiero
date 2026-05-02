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
  const { getByText } = render(
    <CompoundLayerSection
      layer={layer}
      onFlatten={() => {}}
      onConvertToGroup={() => {}}
    />,
  );
  // − is the outermost glyph for `subtract`.
  expect(getByText('−')).toBeDefined();
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
