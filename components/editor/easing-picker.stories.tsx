'use client';

import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { EasingPicker, type EasingValue } from './EasingPicker';

const meta: Meta<typeof EasingPicker> = {
  title: 'Feature/EasingPicker',
  component: EasingPicker,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof EasingPicker>;

function ControlledPicker() {
  const [value, setValue] = useState<EasingValue>('ease-in-out');
  return <EasingPicker value={value} onSelect={setValue} />;
}

export const Default: Story = {
  render: () => <ControlledPicker />,
};

function SpringPicker() {
  const [value, setValue] = useState<EasingValue>('spring');
  return <EasingPicker value={value} onSelect={setValue} />;
}

export const WithSpring: Story = {
  render: () => <SpringPicker />,
};
