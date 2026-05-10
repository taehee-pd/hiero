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
  const tag = container.firstElementChild!;
  expect(tag.className).toContain('var(--tag-bg-outline)');
});

test('muted variant reads --tag-bg-muted', () => {
  const { container } = render(<Tag variant="muted">react</Tag>);
  expect(container.firstElementChild!.className).toContain('var(--tag-bg-muted)');
});

test('success variant reads --tag-bg-success', () => {
  const { container } = render(<Tag variant="success">auto-publish</Tag>);
  expect(container.firstElementChild!.className).toContain('var(--tag-bg-success)');
});

test('warning variant reads --tag-bg-warning', () => {
  const { container } = render(<Tag variant="warning">pending</Tag>);
  expect(container.firstElementChild!.className).toContain('var(--tag-bg-warning)');
});

test('danger variant reads --tag-bg-danger', () => {
  const { container } = render(<Tag variant="danger">Removed</Tag>);
  expect(container.firstElementChild!.className).toContain('var(--tag-bg-danger)');
});

test('default solid variant reads --primary', () => {
  const { container } = render(<Tag variant="default">added</Tag>);
  expect(container.firstElementChild!.className).toContain('var(--primary)');
});

test('font-size driven by --tag-font-size token', () => {
  const variants = ['default', 'muted', 'outline', 'success', 'warning', 'danger'] as const;
  for (const variant of variants) {
    const { container } = render(<Tag variant={variant}>test</Tag>);
    expect(container.firstElementChild!.className).toContain('var(--tag-font-size)');
    cleanup();
  }
});

test('uppercase variant adds uppercase class', () => {
  const { container } = render(<Tag uppercase>shipped</Tag>);
  expect(container.firstElementChild!.className).toContain('uppercase');
});

test('asChild renders as the provided child element', () => {
  const { container } = render(
    <Tag asChild>
      <a href="/x">link</a>
    </Tag>,
  );
  const child = container.firstElementChild!;
  expect(child.tagName).toBe('A');
  expect(child.className).toContain('var(--tag-bg-outline)');
});

test('accepts className override', () => {
  const { container } = render(<Tag className="text-[9px]">snapshot</Tag>);
  expect(container.firstElementChild!.className).toContain('text-[9px]');
});
