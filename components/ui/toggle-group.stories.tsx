import { Icon as UiIcon } from '@hiero/ui-icons';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ToggleGroup, ToggleGroupItem } from './toggle-group';

function ToggleGroupFixture() {
  return (
    <ToggleGroup type="single" defaultValue="left" aria-label="text alignment">
      <ToggleGroupItem value="left" aria-label="align left">
        <UiIcon name="align-left" />
      </ToggleGroupItem>
      <ToggleGroupItem value="center" aria-label="align center">
        <UiIcon name="align-center" />
      </ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="align right">
        <UiIcon name="align-right" />
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
