import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

// Phase 3 gated primitive story for Tabs.
// Interaction tests (plan §6 Phase 3):
//   - Arrow-Left/Right moves active
//   - Home/End jump to first/last
//   - role="tablist" present
// Visual values come from DESIGN.md §4 (navigation and tabs section).

function TabsFixture() {
  return (
    <Tabs defaultValue="layers" style={{ width: 320 }}>
      <TabsList>
        <TabsTrigger value="layers">layers</TabsTrigger>
        <TabsTrigger value="types">types</TabsTrigger>
        <TabsTrigger value="transitions">transitions</TabsTrigger>
      </TabsList>
      <TabsContent value="layers">Layers panel content.</TabsContent>
      <TabsContent value="types">Types panel content.</TabsContent>
      <TabsContent value="transitions">Transitions panel content.</TabsContent>
    </Tabs>
  );
}

const meta = {
  title: 'Primitives/Tabs',
  component: TabsFixture,
  tags: ['autodocs'],
} satisfies Meta<typeof TabsFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// ── Interaction tests ────────────────────────────────────────────────

export const TablistRoleExists: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const list = await canvas.findByRole('tablist');
    await expect(list).toBeInTheDocument();
  },
};

export const ArrowRightMovesActive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = await canvas.findByRole('tab', { name: /layers/i });
    first.focus();
    await expect(first).toHaveAttribute('data-state', 'active');

    await userEvent.keyboard('{ArrowRight}');
    const second = await canvas.findByRole('tab', { name: /types/i });
    await expect(second).toHaveAttribute('data-state', 'active');
  },
};

export const HomeEndJump: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = await canvas.findByRole('tab', { name: /layers/i });
    first.focus();
    await userEvent.keyboard('{End}');
    const last = await canvas.findByRole('tab', { name: /transitions/i });
    await expect(last).toHaveAttribute('data-state', 'active');

    await userEvent.keyboard('{Home}');
    await expect(first).toHaveAttribute('data-state', 'active');
  },
};
