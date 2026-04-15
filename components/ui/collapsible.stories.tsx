import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible';

function CollapsibleFixture() {
  return (
    <Collapsible style={{ width: 280 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 550 }}>advanced options</span>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            toggle
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent style={{ marginTop: 8, fontSize: 12, color: 'var(--foreground-secondary)' }}>
        Interpolation strategy, keyframe density, and advanced easing controls live
        here. Collapsed by default to keep the panel quiet.
      </CollapsibleContent>
    </Collapsible>
  );
}

const meta = {
  title: 'Primitives/Collapsible',
  component: CollapsibleFixture,
  tags: ['autodocs'],
} satisfies Meta<typeof CollapsibleFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
