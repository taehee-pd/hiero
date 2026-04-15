import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Info, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './alert';

const meta = {
  title: 'Primitives/Alert',
  component: Alert,
  tags: ['autodocs'],
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Informational: Story = {
  render: () => (
    <Alert style={{ width: 380 }}>
      <Info />
      <AlertTitle>morph target detected</AlertTitle>
      <AlertDescription>
        The incoming variant has two more segments than the current one. Contour will
        interpolate the extras from the nearest vertices.
      </AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive" style={{ width: 380 }}>
      <TriangleAlert />
      <AlertTitle>validation failed</AlertTitle>
      <AlertDescription>
        The path contains unmatched bezier handles. Fix the geometry before exporting.
      </AlertDescription>
    </Alert>
  ),
};
