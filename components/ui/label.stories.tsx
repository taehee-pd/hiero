import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Input } from './input';
import { Label } from './label';

const meta = {
  title: 'Primitives/Label',
  component: Label,
  tags: ['autodocs'],
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 6 }}>
      <Label htmlFor="icon-name">icon name</Label>
      <Input id="icon-name" placeholder="chevron-down" />
    </div>
  ),
};

export const WithDisabledInput: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 6 }} data-disabled>
      <Label htmlFor="locked">locked</Label>
      <Input id="locked" defaultValue="read only" disabled />
    </div>
  ),
};
