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

export const OpenKeyboardEnterActivates: Story = {
  play: async ({ canvasElement, args }) => {
    const body = await openMenu(canvasElement);
    // openMenu() used Enter to open, which Radix DropdownMenu auto-
    // highlights the first item on. A second Enter activates that
    // already-highlighted item. This test covers the keyboard-open
    // path; ArrowDownNavigateAndActivate below covers down-arrow
    // navigation before committing.
    await userEvent.keyboard('{Enter}');
    await waitFor(async () => {
      await expect(args.onDuplicate).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(body.queryByRole('menu')).toBeNull();
    });
  },
};

export const ArrowDownNavigateAndActivate: Story = {
  play: async ({ canvasElement, args }) => {
    const body = await openMenu(canvasElement);
    // Menu opens with "duplicate" highlighted. ArrowDown moves to the
    // next item (the "export" submenu trigger). ArrowDown again moves
    // to "delete" (past the separator). Enter activates "delete".
    //
    // This is the gstack testing specialist finding: the previous
    // story was named ArrowDownEnterActivates but never pressed
    // ArrowDown. Splitting the two paths here gives real coverage
    // for keyboard navigation vs immediate activation.
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');
    await waitFor(async () => {
      await expect(args.onDelete).toHaveBeenCalled();
    });
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
