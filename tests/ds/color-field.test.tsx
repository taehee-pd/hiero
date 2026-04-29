import '../setup/happy-dom';
import '../setup/react';
import { test, expect, afterEach } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { ColorField } from '@/components/ds/color-field';

afterEach(() => { cleanup(); });

test('renders color swatch with correct background', () => {
  const { container } = render(
    <ColorField value="#9E64D4" onChange={() => {}} />,
  );
  const swatch = container.querySelector('button')!;
  expect(swatch.style.backgroundColor).toBe('#9E64D4');
});

test('renders hex input with uppercase value', () => {
  const { container } = render(
    <ColorField value="#aabbcc" onChange={() => {}} />,
  );
  const input = container.querySelector('input[type="text"]')!;
  expect((input as HTMLInputElement).value).toBe('AABBCC');
});

test('renders opacity input when onOpacityChange is provided', () => {
  const { container } = render(
    <ColorField
      value="#9E64D4"
      onChange={() => {}}
      opacity={0.8}
      onOpacityChange={() => {}}
    />,
  );
  const inputs = container.querySelectorAll('input');
  expect(inputs.length).toBe(2); // hex + opacity
});

test('hides opacity input when onOpacityChange is absent', () => {
  const { container } = render(
    <ColorField value="#9E64D4" onChange={() => {}} />,
  );
  const inputs = container.querySelectorAll('input');
  expect(inputs.length).toBe(1); // hex only
});

test('disabled state disables swatch and input', () => {
  const { container } = render(
    <ColorField value="#9E64D4" onChange={() => {}} disabled />,
  );
  const inputs = container.querySelectorAll('input');
  for (const input of inputs) {
    expect(input).toBeDisabled();
  }
});

test('renders aria-label on swatch', () => {
  const { container } = render(
    <ColorField value="#FF0000" onChange={() => {}} aria-label="Fill color" />,
  );
  const swatch = container.querySelector('button')!;
  expect(swatch.getAttribute('aria-label')).toBe('Fill color');
});

test('defaults aria-label to color value', () => {
  const { container } = render(
    <ColorField value="#FF0000" onChange={() => {}} />,
  );
  const swatch = container.querySelector('button')!;
  expect(swatch.getAttribute('aria-label')).toBe('Color: #FF0000');
});
