'use client';

import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { NumericField } from './numeric-field';

const meta: Meta<typeof NumericField> = {
  title: 'Feature/NumericField',
  component: NumericField,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof NumericField>;

function ControlledField() {
  const [value, setValue] = useState<number | undefined>(100);
  return (
    <div className="w-64">
      <NumericField label="Opacity" value={value} onChange={setValue} min={0} max={100} unit="%" />
    </div>
  );
}

export const Default: Story = {
  render: () => <ControlledField />,
};

function WithSliderField() {
  const [value, setValue] = useState<number | undefined>(0.5);
  return (
    <div className="w-64">
      <NumericField
        label="Scale"
        value={value}
        onChange={setValue}
        min={0}
        max={1}
        step={0.01}
        withSlider
      />
    </div>
  );
}

export const WithSlider: Story = {
  render: () => <WithSliderField />,
};

function WithIconField() {
  const [value, setValue] = useState<number | undefined>(45);
  return (
    <div className="w-64">
      <NumericField label="Angle" icon="∠" value={value} onChange={setValue} unit="°" />
    </div>
  );
}

export const WithIcon: Story = {
  render: () => <WithIconField />,
};

export const Disabled: Story = {
  args: {
    label: 'Width',
    value: 24,
    onChange: () => {},
    disabled: true,
  },
  decorators: [(Story) => <div className="w-64"><Story /></div>],
};

export const WithPlaceholder: Story = {
  args: {
    label: 'X',
    value: undefined,
    onChange: () => {},
    placeholder: 'Mixed',
  },
  decorators: [(Story) => <div className="w-64"><Story /></div>],
};

function FieldGroup() {
  const [x, setX] = useState<number | undefined>(10);
  const [y, setY] = useState<number | undefined>(20);
  const [w, setW] = useState<number | undefined>(100);
  const [h, setH] = useState<number | undefined>(100);
  return (
    <div className="flex w-80 flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <NumericField label="X" value={x} onChange={setX} labelWidth="w-8" />
        <NumericField label="Y" value={y} onChange={setY} labelWidth="w-8" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumericField label="W" value={w} onChange={setW} labelWidth="w-8" unit="px" />
        <NumericField label="H" value={h} onChange={setH} labelWidth="w-8" unit="px" />
      </div>
    </div>
  );
}

export const CoordinateGroup: Story = {
  render: () => <FieldGroup />,
};
