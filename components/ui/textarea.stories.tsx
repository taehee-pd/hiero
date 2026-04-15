import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Label } from './label';
import { Textarea } from './textarea';

const meta = {
  title: 'Primitives/Textarea',
  component: Textarea,
  tags: ['autodocs'],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 6, width: 320 }}>
      <Label htmlFor="notes">release notes</Label>
      <Textarea id="notes" placeholder="What changed in this release?" />
    </div>
  ),
};

export const Disabled: Story = {
  args: { placeholder: 'read only', disabled: true },
  render: (args) => <Textarea {...args} style={{ width: 320 }} />,
};
