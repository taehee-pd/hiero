import '../setup/happy-dom';
import '../setup/react';
import { test, expect, afterEach } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { StatusBadge } from '@/components/ds/status-badge';

afterEach(() => { cleanup(); });

test('renders children text', () => {
  const { getByText } = render(<StatusBadge>Saved</StatusBadge>);
  expect(getByText('Saved')).toBeInTheDocument();
});

test('default variant is neutral', () => {
  const { container } = render(<StatusBadge>Saved</StatusBadge>);
  const badge = container.firstElementChild!;
  expect(badge.className).toContain('bg-background/80');
});

test('warning variant applies status-warning-surface', () => {
  const { container } = render(<StatusBadge variant="warning">Unsaved</StatusBadge>);
  const badge = container.firstElementChild!;
  expect(badge.className).toContain('status-warning-surface');
});

test('danger variant applies status-error-surface', () => {
  const { container } = render(<StatusBadge variant="danger">Error</StatusBadge>);
  const badge = container.firstElementChild!;
  expect(badge.className).toContain('status-error-surface');
});

test('success variant applies status-success-surface', () => {
  const { container } = render(<StatusBadge variant="success">Connected</StatusBadge>);
  const badge = container.firstElementChild!;
  expect(badge.className).toContain('status-success-surface');
});

test('info variant applies status-info-surface', () => {
  const { container } = render(<StatusBadge variant="info">PR created</StatusBadge>);
  const badge = container.firstElementChild!;
  expect(badge.className).toContain('status-info-surface');
});

test('renders with pill radius token', () => {
  const { container } = render(<StatusBadge>Test</StatusBadge>);
  const badge = container.firstElementChild!;
  expect(badge.className).toContain('rounded-[var(--radius-pill)]');
});

test('accepts className override', () => {
  const { container } = render(<StatusBadge className="custom-class">Test</StatusBadge>);
  const badge = container.firstElementChild!;
  expect(badge.className).toContain('custom-class');
});
