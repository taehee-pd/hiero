'use client';

import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ColorField } from './color-field';

const meta: Meta<typeof ColorField> = {
  title: 'DS/ColorField',
  component: ColorField,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ColorField>;

function ControlledColorField() {
  const [color, setColor] = useState('#3186EE');
  return <ColorField value={color} onChange={setColor} />;
}

export const Default: Story = {
  render: () => <ControlledColorField />,
};

function ColorFieldWithOpacity() {
  const [color, setColor] = useState('#1e293b');
  const [opacity, setOpacity] = useState(0.8);
  return (
    <ColorField
      value={color}
      onChange={setColor}
      opacity={opacity}
      onOpacityChange={setOpacity}
    />
  );
}

export const WithOpacity: Story = {
  render: () => <ColorFieldWithOpacity />,
};

export const Disabled: Story = {
  args: {
    value: '#94a3b8',
    onChange: () => {},
    disabled: true,
  },
};

export const MultipleFields: Story = {
  render: () => {
    function Demo() {
      const [fill, setFill] = useState('#3186EE');
      const [stroke, setStroke] = useState('#0A0A0A');
      return (
        <div className="flex flex-col gap-3 max-w-xs">
          <div className="flex items-center gap-2">
            <span className="w-16 text-xs text-muted-foreground">Fill</span>
            <ColorField value={fill} onChange={setFill} />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-16 text-xs text-muted-foreground">Stroke</span>
            <ColorField value={stroke} onChange={setStroke} />
          </div>
        </div>
      );
    }
    return <Demo />;
  },
};
