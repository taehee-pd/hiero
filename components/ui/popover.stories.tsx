import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

function PopoverFixture() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">rename</Button>
      </PopoverTrigger>
      <PopoverContent style={{ width: 220 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <Label htmlFor="rename-input">new name</Label>
          <Input id="rename-input" defaultValue="arrow-right" />
        </div>
      </PopoverContent>
    </Popover>
  );
}

const meta = {
  title: 'Primitives/Popover',
  component: PopoverFixture,
  tags: ['autodocs'],
} satisfies Meta<typeof PopoverFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
