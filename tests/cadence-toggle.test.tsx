import './setup/happy-dom';
import './setup/react';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { CadenceToggle } from '@/components/editor/CadenceToggle';

afterEach(() => {
  cleanup();
});

test('renders both Soft and Snappy radio items inside a group', () => {
  const { getByRole, getAllByRole } = render(
    <CadenceToggle value="soft" onChange={() => {}} />,
  );
  // Radix `ToggleGroup` with `type="single"` renders the root as
  // role="group" and items as role="radio". This contract is
  // inherited from the primitive — we don't add it ourselves.
  expect(getByRole('group', { name: /Cadence/ })).toBeDefined();
  expect(getAllByRole('radio').length).toBe(2);
  expect(getByRole('radio', { name: /Soft cadence/ })).toBeDefined();
  expect(getByRole('radio', { name: /Snappy cadence/ })).toBeDefined();
});

test('selected state is reflected in aria-checked', () => {
  const { getByRole } = render(<CadenceToggle value="soft" onChange={() => {}} />);
  expect(getByRole('radio', { name: /Soft cadence/ }).getAttribute('aria-checked')).toBe('true');
  expect(getByRole('radio', { name: /Snappy cadence/ }).getAttribute('aria-checked')).toBe('false');
});

test('selected state is reflected in data-state="on" (visual targeting)', () => {
  const { getByRole } = render(<CadenceToggle value="snappy" onChange={() => {}} />);
  expect(getByRole('radio', { name: /Snappy cadence/ }).getAttribute('data-state')).toBe('on');
  expect(getByRole('radio', { name: /Soft cadence/ }).getAttribute('data-state')).toBe('off');
});

test('clicking a non-selected radio fires onChange with its value', () => {
  let value = 'soft' as 'soft' | 'snappy';
  const { getByRole, rerender } = render(
    <CadenceToggle value={value} onChange={(next) => { value = next; }} />,
  );
  fireEvent.click(getByRole('radio', { name: /Snappy cadence/ }));
  expect(value).toBe('snappy');
  rerender(<CadenceToggle value={value} onChange={(next) => { value = next; }} />);
  expect(getByRole('radio', { name: /Snappy cadence/ }).getAttribute('aria-checked')).toBe('true');
});

test('clicking the selected radio does not fire a deselect (cadence is mandatory)', () => {
  let value = 'soft' as 'soft' | 'snappy';
  const { getByRole } = render(
    <CadenceToggle value={value} onChange={(next) => { value = next; }} />,
  );
  // Radix `type="single"` would normally return '' on re-click of
  // the active item; the component intercepts and ignores so the
  // cadence axis is always set to a valid value.
  fireEvent.click(getByRole('radio', { name: /Soft cadence/ }));
  expect(value).toBe('soft');
});

test('disabled prop is propagated to the group', () => {
  const { getAllByRole } = render(
    <CadenceToggle value="soft" onChange={() => {}} disabled />,
  );
  for (const button of getAllByRole('radio')) {
    expect((button as HTMLButtonElement).disabled).toBe(true);
  }
});

test('built on the shadcn ToggleGroup primitive (data-slot tag)', () => {
  // Anchors the primitive choice — if a future refactor swaps to a
  // different primitive without updating the W4-5 audit notes, this
  // test surfaces the change.
  const { container } = render(
    <CadenceToggle value="soft" onChange={() => {}} />,
  );
  expect(container.querySelector('[data-slot="toggle-group"]')).not.toBeNull();
  expect(container.querySelectorAll('[data-slot="toggle-group-item"]').length).toBe(2);
});
