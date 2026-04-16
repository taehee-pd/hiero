import '../setup/happy-dom';
import '../setup/react';
import { test, expect, afterEach } from 'bun:test';
import { cleanup, render, fireEvent } from '@testing-library/react';
import { IconButton } from '@/components/ds/icon-button';

// Minimal icon stub
function TestIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg data-testid="test-icon" {...props}><path d="M0 0" /></svg>;
}

afterEach(() => { cleanup(); });

test('renders with required aria-label', () => {
  const { getByLabelText } = render(
    <IconButton icon={<TestIcon />} aria-label="Save" />,
  );
  expect(getByLabelText('Save')).toBeInTheDocument();
});

test('fires onClick handler', () => {
  let clicked = false;
  const { getByLabelText } = render(
    <IconButton icon={<TestIcon />} aria-label="Save" onClick={() => { clicked = true; }} />,
  );
  fireEvent.click(getByLabelText('Save'));
  expect(clicked).toBe(true);
});

test('disabled state prevents click', () => {
  let clicked = false;
  const { getByLabelText } = render(
    <IconButton icon={<TestIcon />} aria-label="Save" disabled onClick={() => { clicked = true; }} />,
  );
  const btn = getByLabelText('Save');
  expect(btn).toBeDisabled();
  fireEvent.click(btn);
  expect(clicked).toBe(false);
});

test('loading state sets aria-busy and disables', () => {
  const { getByLabelText } = render(
    <IconButton icon={<TestIcon />} aria-label="Save" loading />,
  );
  const btn = getByLabelText('Save');
  expect(btn.getAttribute('aria-busy')).toBe('true');
  expect(btn).toBeDisabled();
});

test('loading state replaces icon with spinner', () => {
  const { container } = render(
    <IconButton icon={<TestIcon />} aria-label="Save" loading />,
  );
  // Spinner has role="status"
  expect(container.querySelector('[role="status"]')).toBeInTheDocument();
  // Original icon should not be present
  expect(container.querySelector('[data-testid="test-icon"]')).toBeNull();
});

test('tooltip=false suppresses tooltip wrapper', () => {
  const { container } = render(
    <IconButton icon={<TestIcon />} aria-label="Save" tooltip={false} />,
  );
  // No tooltip trigger should be present
  expect(container.querySelector('[data-slot="tooltip-trigger"]')).toBeNull();
});

test('size md is the default', () => {
  const { getByLabelText } = render(
    <IconButton icon={<TestIcon />} aria-label="Save" tooltip={false} />,
  );
  const btn = getByLabelText('Save');
  expect(btn.className).toContain('--button-icon-size-md');
});

test('size sm applies sm token', () => {
  const { getByLabelText } = render(
    <IconButton icon={<TestIcon />} aria-label="Save" size="sm" tooltip={false} />,
  );
  expect(getByLabelText('Save').className).toContain('--button-icon-size-sm');
});

test('size lg applies lg token', () => {
  const { getByLabelText } = render(
    <IconButton icon={<TestIcon />} aria-label="Save" size="lg" tooltip={false} />,
  );
  expect(getByLabelText('Save').className).toContain('--button-icon-size-lg');
});

test('radius defaults to toolbar', () => {
  const { getByLabelText } = render(
    <IconButton icon={<TestIcon />} aria-label="Save" tooltip={false} />,
  );
  expect(getByLabelText('Save').className).toContain('--radius-toolbar-action');
});

test('variant defaults to ghost', () => {
  const { getByLabelText } = render(
    <IconButton icon={<TestIcon />} aria-label="Save" tooltip={false} />,
  );
  expect(getByLabelText('Save').className).toContain('bg-transparent');
});
