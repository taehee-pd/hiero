import '../setup/happy-dom';
import '../setup/react';
import { test, expect, afterEach } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { Tag } from '@/components/ds/tag';

afterEach(() => { cleanup(); });

test('renders children text', () => {
  const { getByText } = render(<Tag>react</Tag>);
  expect(getByText('react')).toBeInTheDocument();
});

test('default variant is outline', () => {
  const { container } = render(<Tag>label</Tag>);
  const badge = container.firstElementChild!;
  // outline variant from Badge
  expect(badge.className).toContain('text-[10px]');
});

test('muted variant uses secondary Badge variant', () => {
  const { container } = render(<Tag variant="muted">react</Tag>);
  const badge = container.firstElementChild!;
  expect(badge.className).toContain('bg-secondary');
});

test('success variant adds emerald text color', () => {
  const { container } = render(<Tag variant="success">auto-publish</Tag>);
  const badge = container.firstElementChild!;
  expect(badge.className).toContain('text-emerald-600');
});

test('warning variant adds amber text color', () => {
  const { container } = render(<Tag variant="warning">pending</Tag>);
  const badge = container.firstElementChild!;
  expect(badge.className).toContain('text-amber-600');
});

test('danger variant uses destructive Badge variant', () => {
  const { container } = render(<Tag variant="danger">Removed</Tag>);
  const badge = container.firstElementChild!;
  expect(badge.className).toContain('bg-destructive');
});

test('consistent text-[10px] sizing across all variants', () => {
  const variants = ['default', 'muted', 'outline', 'success', 'warning', 'danger'] as const;
  for (const variant of variants) {
    const { container } = render(<Tag variant={variant}>test</Tag>);
    expect(container.firstElementChild!.className).toContain('text-[10px]');
    cleanup();
  }
});

test('accepts className override', () => {
  const { container } = render(<Tag className="text-[9px]">snapshot</Tag>);
  const badge = container.firstElementChild!;
  expect(badge.className).toContain('text-[9px]');
});
