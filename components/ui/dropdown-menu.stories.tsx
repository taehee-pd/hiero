import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu';

// Phase 3 gated primitive story for DropdownMenu.
// Interaction tests (plan §6 Phase 3):
//   - Arrow navigation highlights items
//   - Enter activates (calls onSelect)
//   - ArrowRight opens a submenu
// Visual values come from DESIGN.md §4 (ghost button variants) + §6 shadow.

type Fixture = { onDuplicate: () => void; onDelete: () => void; onExport: () => void };

function DropdownFixture({ onDuplicate, onDelete, onExport }: Fixture) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="icon actions">actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onDuplicate}>duplicate</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>export</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onSelect={onExport}>svg</DropdownMenuItem>
            <DropdownMenuItem>json</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDelete}>delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const meta = {
  title: 'Primitives/DropdownMenu',
  component: DropdownFixture,
  tags: ['autodocs'],
  args: {
    onDuplicate: fn(),
    onDelete: fn(),
    onExport: fn(),
  },
} satisfies Meta<typeof DropdownFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// ── Interaction tests ────────────────────────────────────────────────

async function openMenu(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const trigger = await canvas.findByRole('button', { name: /icon actions/i });
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  const body = within(document.body);
  await waitFor(async () => {
    await expect(await body.findByRole('menu')).toBeInTheDocument();
  });
  return body;
}

export const ArrowDownEnterActivates: Story = {
  play: async ({ canvasElement, args }) => {
    const body = await openMenu(canvasElement);
    // First item is "duplicate" — Enter should fire it.
    await userEvent.keyboard('{Enter}');
    await waitFor(async () => {
      await expect(args.onDuplicate).toHaveBeenCalled();
    });
    // Menu auto-closes after select; confirm.
    await waitFor(() => {
      expect(body.queryByRole('menu')).toBeNull();
    });
  },
};

export const ArrowRightOpensSubmenu: Story = {
  play: async ({ canvasElement, args }) => {
    const body = await openMenu(canvasElement);
    // Move down past "duplicate" to the submenu trigger "export".
    await userEvent.keyboard('{ArrowDown}');
    const exportItem = await body.findByRole('menuitem', { name: /^export$/i });
    await expect(exportItem).toHaveAttribute('data-highlighted');

    // ArrowRight expands the submenu.
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(async () => {
      const svgItem = await body.findByRole('menuitem', { name: /svg/i });
      await expect(svgItem).toBeInTheDocument();
    });

    // Enter commits "svg" which is the first highlighted submenu item.
    await userEvent.keyboard('{Enter}');
    await waitFor(async () => {
      await expect(args.onExport).toHaveBeenCalled();
    });
  },
};
