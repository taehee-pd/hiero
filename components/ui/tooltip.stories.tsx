import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './button';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

// TooltipProvider is already mounted in .storybook/preview.tsx — stories
// do not need to wrap their own.
function TooltipFixture() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="add layer">
          +
        </Button>
      </TooltipTrigger>
      <TooltipContent>add layer (n)</TooltipContent>
    </Tooltip>
  );
}

const meta = {
  title: 'Primitives/Tooltip',
  component: TooltipFixture,
  tags: ['autodocs'],
} satisfies Meta<typeof TooltipFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
