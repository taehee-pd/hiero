'use client';

import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BezierCurveEditor } from './BezierCurveEditor';
import type { EasingValue } from './EasingPicker';

const meta: Meta<typeof BezierCurveEditor> = {
  title: 'Feature/BezierCurveEditor',
  component: BezierCurveEditor,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof BezierCurveEditor>;

function ControlledBezier() {
  const [value, setValue] = useState<EasingValue>('cubic-bezier(0.4, 0.0, 0.2, 1)');
  return (
    <div className="w-64">
      <BezierCurveEditor value={value} onChange={setValue} />
    </div>
  );
}

export const Default: Story = {
  render: () => <ControlledBezier />,
};

function LinearBezier() {
  const [value, setValue] = useState<EasingValue>('cubic-bezier(0, 0, 1, 1)');
  return (
    <div className="w-64">
      <BezierCurveEditor value={value} onChange={setValue} />
    </div>
  );
}

export const Linear: Story = {
  render: () => <LinearBezier />,
};

function SpringBezier() {
  const [value, setValue] = useState<EasingValue>({
    type: 'spring',
    stiffness: 100,
    damping: 10,
    mass: 1,
  });
  return (
    <div className="w-64">
      <BezierCurveEditor value={value} onChange={setValue} />
    </div>
  );
}

export const Spring: Story = {
  render: () => <SpringBezier />,
};
