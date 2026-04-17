import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TimelineEditor } from './TimelineEditor';
import { seedEditorStoryState } from './story-fixtures';

const meta: Meta<typeof TimelineEditor> = {
  title: 'Feature/Smoke/TimelineEditor',
  component: TimelineEditor,
  tags: ['autodocs'],
  decorators: [
    (Story) => {
      seedEditorStoryState();
      return (
        <div className="h-[420px] w-[760px] border border-border/60 bg-background p-2">
          <Story />
        </div>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof TimelineEditor>;

export const Default: Story = {};
