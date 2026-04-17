'use client';

import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { WeightCurveEditor } from './WeightCurveEditor';
import type { Variant } from '@/lib/schema/types';

const meta: Meta<typeof WeightCurveEditor> = {
  title: 'Feature/WeightCurveEditor',
  component: WeightCurveEditor,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof WeightCurveEditor>;

// Weight control points are SVG path d-strings keyed by symbol weight.
const defaultPoints: Variant['weightControlPoints'] = {
  ultralight: 'M0 0 L10 10',
  thin: 'M0 0 L12 12',
  light: 'M0 0 L15 15',
  regular: 'M0 0 L20 20',
  medium: 'M0 0 L25 25',
  semibold: 'M0 0 L30 30',
  bold: 'M0 0 L35 35',
  heavy: 'M0 0 L40 40',
  black: 'M0 0 L50 50',
};

function ControlledWeightCurve() {
  const [points, setPoints] = useState<Variant['weightControlPoints']>(defaultPoints);
  return (
    <div className="w-80">
      <WeightCurveEditor
        weightControlPoints={points}
        onPatchVariant={(patch) => {
          if (patch.weightControlPoints) setPoints(patch.weightControlPoints);
        }}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <ControlledWeightCurve />,
};
