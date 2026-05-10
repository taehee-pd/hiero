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
  expect(container.firstElementChild!.className).toContain('var(--badge-bg-neutral)');
});

test('warning variant reads --badge-bg-unsaved', () => {
  const { container } = render(<StatusBadge variant="warning">Unsaved</StatusBadge>);
  expect(container.firstElementChild!.className).toContain('var(--badge-bg-unsaved)');
});

test('danger variant reads --badge-bg-error', () => {
  const { container } = render(<StatusBadge variant="danger">Error</StatusBadge>);
  expect(container.firstElementChild!.className).toContain('var(--badge-bg-error)');
});

test('success variant reads --badge-bg-saved', () => {
  const { container } = render(<StatusBadge variant="success">Connected</StatusBadge>);
  expect(container.firstElementChild!.className).toContain('var(--badge-bg-saved)');
});

test('info variant reads --badge-bg-connected', () => {
  const { container } = render(<StatusBadge variant="info">PR created</StatusBadge>);
  expect(container.firstElementChild!.className).toContain('var(--badge-bg-connected)');
});

test('renders with badge radius token', () => {
  const { container } = render(<StatusBadge>Test</StatusBadge>);
  expect(container.firstElementChild!.className).toContain('rounded-[var(--badge-radius)]');
});

test('asChild renders the provided child element', () => {
  const { container } = render(
    <StatusBadge asChild>
      <button type="button">Saved</button>
    </StatusBadge>,
  );
  expect(container.firstElementChild!.tagName).toBe('BUTTON');
});

test('accepts className override', () => {
  const { container } = render(<StatusBadge className="custom-class">Test</StatusBadge>);
  expect(container.firstElementChild!.className).toContain('custom-class');
});
