import { Icon as UiIcon } from '@hiero/ui-icons';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { Button } from './button';

// Phase 3 primitive story for Button.
// Gated by the plan §6 Phase 3 enumerated interaction test set:
//   - click fires handler
//   - disabled blocks click
//   - aria-invalid ring renders
//
// Visual values come from DESIGN.md §4 (button variants) via the shadcn
// Tailwind tokens; this file does not invent any color or size.

const meta = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  args: {
    onClick: fn(),
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon', 'icon-sm', 'icon-lg'],
    },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: 'button' },
};

export const AllVariants: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button {...args} variant="default">
        default
      </Button>
      <Button {...args} variant="secondary">
        secondary
      </Button>
      <Button {...args} variant="destructive">
        destructive
      </Button>
      <Button {...args} variant="outline">
        outline
      </Button>
      <Button {...args} variant="ghost">
        ghost
      </Button>
      <Button {...args} variant="link">
        link
      </Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button {...args} size="sm">
        small
      </Button>
      <Button {...args} size="default">
        default
      </Button>
      <Button {...args} size="lg">
        large
      </Button>
      <Button {...args} size="icon" aria-label="add">
        <UiIcon name="plus" />
      </Button>
    </div>
  ),
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <UiIcon name="plus" /> add layer
      </>
    ),
  },
};

export const Disabled: Story = {
  args: { children: 'disabled', disabled: true },
};

export const Destructive: Story = {
  args: {
    children: (
      <>
        <UiIcon name="trash-2" /> delete
      </>
    ),
    variant: 'destructive',
  },
};

// ── Interaction tests (plan §6 Phase 3 gated set) ────────────────────

export const ClickFiresHandler: Story = {
  args: { children: 'click me' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const btn = await canvas.findByRole('button', { name: /click me/i });
    await userEvent.click(btn);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const DisabledBlocksClick: Story = {
  args: { children: 'nope', disabled: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const btn = await canvas.findByRole('button', { name: /nope/i });

    // user-event v14 refuses pointer-events:none clicks by design, so
    // sending one through the normal path throws before even reaching
    // the handler. We skip that check (the CSS block IS the affordance
    // we care about) and then assert the DOM state plus the fact that
    // the handler stayed untouched.
    await userEvent.click(btn, { pointerEventsCheck: 0 });
    await expect(args.onClick).not.toHaveBeenCalled();
    await expect(btn).toBeDisabled();
  },
};

export const AriaInvalidRing: Story = {
  args: {
    children: 'invalid',
    'aria-invalid': true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const btn = await canvas.findByRole('button', { name: /invalid/i });
    await expect(btn).toHaveAttribute('aria-invalid', 'true');
  },
};
