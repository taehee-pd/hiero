import './setup/happy-dom';
import './setup/react';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { CadenceToggle } from '@/components/editor/CadenceToggle';

afterEach(() => {
  cleanup();
});

test('renders both Soft and Snappy radio buttons', () => {
  const { getByRole } = render(<CadenceToggle value="soft" onChange={() => {}} />);
  // ARIA radiogroup pattern.
  expect(getByRole('radiogroup')).toBeDefined();
  const soft = getByRole('radio', { name: /Soft cadence/ });
  const snappy = getByRole('radio', { name: /Snappy cadence/ });
  expect(soft).toBeDefined();
  expect(snappy).toBeDefined();
});

test('selected state is reflected in aria-checked', () => {
  const { getByRole } = render(<CadenceToggle value="soft" onChange={() => {}} />);
  expect(getByRole('radio', { name: /Soft cadence/ }).getAttribute('aria-checked')).toBe('true');
  expect(getByRole('radio', { name: /Snappy cadence/ }).getAttribute('aria-checked')).toBe('false');
});

test('roving tabindex: only the selected radio has tabIndex 0', () => {
  // ARIA radiogroup pattern — Tab lands on the group once; arrow
  // keys navigate within. Unselected radios get tabIndex=-1.
  const { getByRole } = render(<CadenceToggle value="soft" onChange={() => {}} />);
  expect(getByRole('radio', { name: /Soft cadence/ }).getAttribute('tabindex')).toBe('0');
  expect(getByRole('radio', { name: /Snappy cadence/ }).getAttribute('tabindex')).toBe('-1');
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

test('arrow-right cycles to the next cadence; arrow-left cycles back', () => {
  let value = 'soft' as 'soft' | 'snappy';
  const { getByRole, rerender } = render(
    <CadenceToggle value={value} onChange={(next) => { value = next; }} />,
  );
  const soft = getByRole('radio', { name: /Soft cadence/ });
  fireEvent.keyDown(soft, { key: 'ArrowRight' });
  expect(value).toBe('snappy');
  rerender(<CadenceToggle value={value} onChange={(next) => { value = next; }} />);
  fireEvent.keyDown(getByRole('radio', { name: /Snappy cadence/ }), { key: 'ArrowLeft' });
  expect(value).toBe('soft');
});

test('disabled prop is propagated to every radio', () => {
  const { getAllByRole } = render(
    <CadenceToggle value="soft" onChange={() => {}} disabled />,
  );
  for (const button of getAllByRole('radio')) {
    expect((button as HTMLButtonElement).disabled).toBe(true);
  }
});
