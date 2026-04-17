import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LayerPanel } from './LayerPanel';
import { seedEditorStoryState } from './story-fixtures';

const meta: Meta<typeof LayerPanel> = {
  title: 'Feature/Smoke/LayerPanel',
  component: LayerPanel,
  tags: ['autodocs'],
  decorators: [
    (Story) => {
      seedEditorStoryState();
      return (
        <div className="h-[560px] w-[340px] border border-border/60 bg-background p-2">
          <Story />
        </div>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof LayerPanel>;

export const Default: Story = {};
