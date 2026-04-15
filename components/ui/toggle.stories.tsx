import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Bold, Italic, Underline } from 'lucide-react';
import { Toggle } from './toggle';

const meta = {
  title: 'Primitives/Toggle',
  component: Toggle,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['default', 'sm', 'lg'] },
    variant: { control: 'select', options: ['default', 'outline'] },
  },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { 'aria-label': 'toggle bold', children: <Bold /> },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <Toggle aria-label="bold">
        <Bold />
      </Toggle>
      <Toggle aria-label="italic" variant="outline">
        <Italic />
      </Toggle>
      <Toggle aria-label="underline" defaultPressed>
        <Underline />
      </Toggle>
    </div>
  ),
};
