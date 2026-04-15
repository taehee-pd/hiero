import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Skeleton } from './skeleton';

const meta = {
  title: 'Primitives/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IconCardPlaceholder: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        width: 360,
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ display: 'grid', gap: 6 }}>
          <Skeleton style={{ aspectRatio: '1 / 1', borderRadius: 14 }} />
          <Skeleton style={{ height: 10, width: '70%' }} />
        </div>
      ))}
    </div>
  ),
};
