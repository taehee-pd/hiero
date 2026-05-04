import './setup/happy-dom';
import './setup/react';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';

import { TimingCurveEditor } from '@/components/editor/TimingCurveEditor';
import type { TimingOverride } from '@/lib/runtime-core/timing-override';

afterEach(() => {
  cleanup();
});

const SOFT: TimingOverride = {
  g: 'ease-in-out',
  alpha: 'ease-out-cubic',
  alphaOffsetRatio: 0.08,
};

const SNAPPY: TimingOverride = {
  g: 'ease-out',
  alpha: 'ease-out-cubic',
  alphaOffsetRatio: 0.04,
};

test('renders both easing pickers and the offset input', () => {
  const { getByLabelText, getAllByRole } = render(
    <TimingCurveEditor value={SOFT} onChange={() => {}} />,
  );
  // Two Select triggers (rendered as combobox role by Radix Select).
  expect(getAllByRole('combobox').length).toBe(2);
  expect(getByLabelText(/Opacity offset/)).toBeDefined();
});

test('the offset input reflects the current value', () => {
  const { getByLabelText } = render(
    <TimingCurveEditor value={SOFT} onChange={() => {}} />,
  );
  const input = getByLabelText(/Opacity offset/) as HTMLInputElement;
  expect(input.value).toBe('0.08');
});

test('switching to a snappy override updates the rendered offset', () => {
  const { getByLabelText, rerender } = render(
    <TimingCurveEditor value={SOFT} onChange={() => {}} />,
  );
  expect((getByLabelText(/Opacity offset/) as HTMLInputElement).value).toBe('0.08');
  rerender(<TimingCurveEditor value={SNAPPY} onChange={() => {}} />);
  expect((getByLabelText(/Opacity offset/) as HTMLInputElement).value).toBe('0.04');
});

test('the geometry-curve trigger surfaces the current g easing', () => {
  const { container, rerender } = render(
    <TimingCurveEditor value={SOFT} onChange={() => {}} />,
  );
  // Radix Select's trigger renders the value text inside a span.
  expect(container.textContent).toContain('ease-in-out');
  rerender(<TimingCurveEditor value={SNAPPY} onChange={() => {}} />);
  expect(container.textContent).toContain('ease-out');
});

test('built on shadcn primitives (Select + Input + Label data-slot anchors)', () => {
  const { container } = render(
    <TimingCurveEditor value={SOFT} onChange={() => {}} />,
  );
  // Anchors the primitive choice — surfaces a regression if a
  // future refactor hand-rolls the form elements.
  expect(container.querySelectorAll('[data-slot="select-trigger"]').length).toBe(2);
  expect(container.querySelector('[data-slot="input"]')).not.toBeNull();
});

test('the offset input has min=0 and max=0.5 (validator-aligned)', () => {
  const { getByLabelText } = render(
    <TimingCurveEditor value={SOFT} onChange={() => {}} />,
  );
  const input = getByLabelText(/Opacity offset/) as HTMLInputElement;
  // Native HTML constraints aligned with `isValidTimingOverride`'s
  // 0..0.5 range. The runtime validator is the source of truth;
  // the input attributes are a UX-affordance mirror.
  expect(input.getAttribute('min')).toBe('0');
  expect(input.getAttribute('max')).toBe('0.5');
});
