import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { InspectorPanel } from './InspectorPanel';
import { seedEditorStoryState } from './story-fixtures';

const meta: Meta<typeof InspectorPanel> = {
  title: 'Feature/Smoke/InspectorPanel',
  component: InspectorPanel,
  tags: ['autodocs'],
  decorators: [
    (Story) => {
      seedEditorStoryState();
      return (
        <div className="h-[760px] w-[360px] border border-border/60 bg-background">
          <Story />
        </div>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof InspectorPanel>;

export const Default: Story = {};
