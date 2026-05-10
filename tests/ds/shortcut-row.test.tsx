import '../setup/happy-dom';
import '../setup/react';
import { test, expect, afterEach } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { ShortcutRow } from '@/components/ds/shortcut-row';

afterEach(() => { cleanup(); });

test('renders label text', () => {
  const { getByText } = render(<ShortcutRow label="Pen tool" keys={['P']} />);
  expect(getByText('Pen tool')).toBeInTheDocument();
});

test('renders single key via KbdHint', () => {
  const { container } = render(<ShortcutRow label="Pen tool" keys={['P']} />);
  const kbds = container.querySelectorAll('[data-slot="kbd"]');
  expect(kbds.length).toBe(1);
  expect(kbds[0]?.textContent).toBe('P');
});

test('renders multi-key combo as a KbdGroup', () => {
  const { container } = render(<ShortcutRow label="Redo" keys={['Shift', 'Cmd', 'Z']} />);
  const kbds = container.querySelectorAll('[data-slot="kbd"]');
  expect(kbds.length).toBe(3);
});

test('forwards className alongside the row defaults', () => {
  const { container } = render(<ShortcutRow label="Test" keys={['V']} className="custom-extra" />);
  const row = container.firstElementChild as HTMLElement;
  expect(row.className).toContain('custom-extra');
  expect(row.className).toContain('rounded-[var(--shortcut-row-radius)]');
});
