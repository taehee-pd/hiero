import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ScrollArea } from './scroll-area';

function ScrollAreaFixture() {
  return (
    <ScrollArea style={{ width: 240, height: 200, border: '1px solid var(--border)', borderRadius: 8 }}>
      <div style={{ padding: 12, display: 'grid', gap: 4 }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} style={{ fontSize: 13 }}>
            icon-{String(i + 1).padStart(2, '0')}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

const meta = {
  title: 'Primitives/ScrollArea',
  component: ScrollAreaFixture,
  tags: ['autodocs'],
} satisfies Meta<typeof ScrollAreaFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
