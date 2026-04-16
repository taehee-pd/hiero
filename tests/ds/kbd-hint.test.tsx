import '../setup/happy-dom';
import '../setup/react';
import { test, expect, afterEach } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { KbdHint, resolveKey } from '@/components/ds/kbd-hint';

afterEach(() => { cleanup(); });

test('renders nothing for empty keys', () => {
  const { container } = render(<KbdHint keys={[]} />);
  expect(container.innerHTML).toBe('');
});

test('renders single key as Kbd', () => {
  const { getByText } = render(<KbdHint keys={['V']} />);
  expect(getByText('V')).toBeInTheDocument();
});

test('renders multiple keys in KbdGroup', () => {
  const { container } = render(<KbdHint keys={['Shift', 'Cmd', 'Z']} />);
  const kbds = container.querySelectorAll('[data-slot="kbd"]');
  expect(kbds.length).toBe(3);
});

test('resolveKey uppercases single character keys', () => {
  expect(resolveKey('v')).toBe('V');
  expect(resolveKey('a')).toBe('A');
});

test('resolveKey passes through unknown multi-char keys', () => {
  expect(resolveKey('Space')).toBe('Space');
});

test('resolveKey handles escape', () => {
  const result = resolveKey('Escape');
  expect(result).toBe('Esc');
});

test('resolveKey handles arrow keys', () => {
  expect(resolveKey('Up')).toBe('↑');
  expect(resolveKey('Down')).toBe('↓');
  expect(resolveKey('Left')).toBe('←');
  expect(resolveKey('Right')).toBe('→');
});

test('accepts className', () => {
  const { container } = render(<KbdHint keys={['A']} className="custom" />);
  const kbd = container.querySelector('[data-slot="kbd"]')!;
  expect(kbd.className).toContain('custom');
});
