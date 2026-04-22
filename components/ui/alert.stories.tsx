import { Icon as UiIcon } from '@hiero/ui-icons';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

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
      <UiIcon name="info" />
      <AlertTitle>morph target detected</AlertTitle>
      <AlertDescription>
        The incoming variant has two more segments than the current one. Hiero will
        interpolate the extras from the nearest vertices.
      </AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive" style={{ width: 380 }}>
      <UiIcon name="triangle-alert" />
      <AlertTitle>validation failed</AlertTitle>
      <AlertDescription>
        The path contains unmatched bezier handles. Fix the geometry before exporting.
      </AlertDescription>
    </Alert>
  ),
};
