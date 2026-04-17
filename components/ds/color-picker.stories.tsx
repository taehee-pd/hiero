'use client';

import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerAlpha,
  ColorPickerEyeDropper,
  ColorPickerFormat,
  ColorPickerOutput,
} from './color-picker';

const meta: Meta<typeof ColorPicker> = {
  title: 'DS/ColorPicker',
  component: ColorPicker,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ColorPicker>;

function FullPicker() {
  const [color, setColor] = useState('#3186EE');
  return (
    <div className="w-64 rounded-lg border border-border p-3">
      <ColorPicker value={color} onChange={(v) => setColor(String(v))}>
        <ColorPickerSelection className="h-36 rounded-md" />
        <ColorPickerHue />
        <ColorPickerAlpha />
        <div className="flex items-center gap-2">
          <ColorPickerOutput />
          <ColorPickerEyeDropper />
        </div>
        <ColorPickerFormat />
      </ColorPicker>
    </div>
  );
}

export const Default: Story = {
  render: () => <FullPicker />,
};

function MinimalPicker() {
  const [color, setColor] = useState('#FF6B6B');
  return (
    <div className="w-64 rounded-lg border border-border p-3">
      <ColorPicker value={color} onChange={(v) => setColor(String(v))}>
        <ColorPickerSelection className="h-36 rounded-md" />
        <ColorPickerHue />
      </ColorPicker>
    </div>
  );
}

export const Minimal: Story = {
  render: () => <MinimalPicker />,
};
