import './setup/happy-dom';
import './setup/react';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { FallbackPicker } from '@/components/editor/FallbackPicker';
import type { FallbackName } from '@/lib/schema/types';

afterEach(() => {
  cleanup();
});

test('renders every named fallback as a radio chip', () => {
  const { getAllByRole } = render(
    <FallbackPicker resolverPicked="radial-pop" override={undefined} onChange={() => {}} />,
  );
  // 9 fallbacks in the closed FallbackName union; Radix
  // ToggleGroup type="single" maps each item to role="radio".
  expect(getAllByRole('radio').length).toBe(9);
});

test('the resolver-picked chip shows an Auto badge when no override is set', () => {
  const { getByLabelText } = render(
    <FallbackPicker
      resolverPicked="draw-replace"
      override={undefined}
      onChange={() => {}}
    />,
  );
  expect(getByLabelText('Auto-picked by the resolver')).toBeDefined();
});

test('the override chip is selected; resolver pick is not when override differs', () => {
  const { getByRole } = render(
    <FallbackPicker
      resolverPicked="radial-pop"
      override="draw-replace"
      onChange={() => {}}
    />,
  );
  expect(getByRole('radio', { name: /Draw Replace/ }).getAttribute('aria-checked')).toBe('true');
  expect(getByRole('radio', { name: /Radial Pop/ }).getAttribute('aria-checked')).toBe('false');
});

test('clicking a chip pins it explicitly via override (W4 audit §5 fix)', () => {
  let override: FallbackName | undefined;
  const { getByRole } = render(
    <FallbackPicker
      resolverPicked="radial-pop"
      override={undefined}
      onChange={(next) => { override = next; }}
    />,
  );
  fireEvent.click(getByRole('radio', { name: /Slide Up/ }));
  expect(override).toBe('directional-replace-up');
});

test('clicking the resolver-picked chip while no override exists pins it explicitly', () => {
  // The W4-audit-fix invariant: clicking the auto-picked chip
  // does NOT silently un-pin a different override; it explicitly
  // pins the resolver's value as the override. Radix returns ''
  // on re-click of the active item; the component treats that as
  // "re-pin to the currently effective value".
  let captured: FallbackName | undefined = undefined;
  const handleChange = (next: FallbackName | undefined) => {
    captured = next;
  };
  const { getByRole } = render(
    <FallbackPicker
      resolverPicked="radial-pop"
      override={undefined}
      onChange={handleChange}
    />,
  );
  fireEvent.click(getByRole('radio', { name: /resolver's pick/ }));
  expect(captured as FallbackName | undefined).toBe('radial-pop');
});

test('the "Use auto" affordance appears only when override is set, and clears it', () => {
  let override: FallbackName | undefined = 'draw-replace';
  const { queryByText, rerender } = render(
    <FallbackPicker
      resolverPicked="radial-pop"
      override={override}
      onChange={(next) => { override = next; }}
    />,
  );
  const useAuto = queryByText(/Use auto/);
  expect(useAuto).not.toBeNull();
  fireEvent.click(useAuto!);
  expect(override).toBeUndefined();

  rerender(
    <FallbackPicker
      resolverPicked="radial-pop"
      override={override}
      onChange={(next) => { override = next; }}
    />,
  );
  expect(queryByText(/Use auto/)).toBeNull();
});

test('built on the shadcn ToggleGroup primitive (data-slot tag)', () => {
  const { container } = render(
    <FallbackPicker resolverPicked="radial-pop" override={undefined} onChange={() => {}} />,
  );
  expect(container.querySelector('[data-slot="toggle-group"]')).not.toBeNull();
  expect(container.querySelectorAll('[data-slot="toggle-group-item"]').length).toBe(9);
});
