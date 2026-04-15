import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from './toggle-group';

function ToggleGroupFixture() {
  return (
    <ToggleGroup type="single" defaultValue="left" aria-label="text alignment">
      <ToggleGroupItem value="left" aria-label="align left">
        <AlignLeft />
      </ToggleGroupItem>
      <ToggleGroupItem value="center" aria-label="align center">
        <AlignCenter />
      </ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="align right">
        <AlignRight />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

const meta = {
  title: 'Primitives/ToggleGroup',
  component: ToggleGroupFixture,
  tags: ['autodocs'],
} satisfies Meta<typeof ToggleGroupFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
