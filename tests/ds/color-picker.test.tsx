import '../setup/happy-dom';
import '../setup/react';
import { test, expect, afterEach } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
} from '@/components/ds/color-picker';

afterEach(() => { cleanup(); });

test('ColorPicker renders without crashing', () => {
  const { container } = render(
    <ColorPicker value="#3186EE" onChange={() => {}}>
      <ColorPickerSelection className="h-36" />
      <ColorPickerHue />
    </ColorPicker>,
  );
  expect(container.firstElementChild).toBeInTheDocument();
});

test('ColorPicker renders children', () => {
  const { container } = render(
    <ColorPicker value="#FF0000" onChange={() => {}}>
      <div data-testid="child">content</div>
    </ColorPicker>,
  );
  expect(container.querySelector('[data-testid="child"]')).toBeInTheDocument();
});
