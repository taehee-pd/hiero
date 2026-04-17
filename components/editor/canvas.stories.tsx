import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Canvas } from './Canvas';
import { seedEditorStoryState } from './story-fixtures';

const meta: Meta<typeof Canvas> = {
  title: 'Feature/Smoke/Canvas',
  component: Canvas,
  tags: ['autodocs'],
  decorators: [
    (Story) => {
      seedEditorStoryState();
      return (
        <div className="h-[560px] w-[720px] border border-border/60 bg-muted/20 p-2">
          <Story />
        </div>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof Canvas>;

export const Default: Story = {
  args: {
    showStatusHud: true,
  },
};
