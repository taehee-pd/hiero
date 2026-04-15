import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

// Phase 3 gated primitive story for Dialog.
// Interaction tests (plan §6 Phase 3):
//   - Escape closes
//   - overlay click dismisses
//   - aria-labelledby wired
// Visual values come from DESIGN.md §4 (cards/panels) + §6 shadow Level 3.

function DialogFixture() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>delete icon</DialogTitle>
          <DialogDescription>
            This permanently removes the icon from the set. The action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost">cancel</Button>
          <Button variant="destructive">delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const meta = {
  title: 'Primitives/Dialog',
  component: DialogFixture,
  tags: ['autodocs'],
} satisfies Meta<typeof DialogFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// ── Interaction tests ────────────────────────────────────────────────

async function openDialog(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const trigger = await canvas.findByRole('button', { name: /open dialog/i });
  await userEvent.click(trigger);
  // Radix portals the content to document.body, not into the canvas root.
  const body = within(document.body);
  return body;
}

export const EscapeCloses: Story = {
  play: async ({ canvasElement }) => {
    const body = await openDialog(canvasElement);
    await waitFor(async () => {
      await expect(await body.findByRole('dialog')).toBeInTheDocument();
    });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('dialog')).toBeNull();
    });
  },
};

export const AriaLabelledbyWired: Story = {
  play: async ({ canvasElement }) => {
    const body = await openDialog(canvasElement);
    const dialog = await body.findByRole('dialog');
    const labelledby = dialog.getAttribute('aria-labelledby');
    const describedby = dialog.getAttribute('aria-describedby');
    await expect(labelledby).not.toBeNull();
    await expect(describedby).not.toBeNull();

    // The ID references must actually resolve to elements containing the
    // title / description strings. If Radix ever stopped wiring them, the
    // lookup would return null and fail the test.
    const titleEl = document.getElementById(labelledby ?? '');
    const descEl = document.getElementById(describedby ?? '');
    await expect(titleEl?.textContent).toMatch(/delete icon/i);
    await expect(descEl?.textContent).toMatch(/permanently removes/i);

    // Close with Escape so next tests start clean.
    await userEvent.keyboard('{Escape}');
  },
};

export const OverlayClickDismisses: Story = {
  play: async ({ canvasElement }) => {
    const body = await openDialog(canvasElement);
    await waitFor(async () => {
      await expect(await body.findByRole('dialog')).toBeInTheDocument();
    });

    // Radix renders the overlay as a sibling of DialogContent with a
    // data-state attribute. Click it to dismiss.
    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    await expect(overlay).not.toBeNull();
    await userEvent.click(overlay as Element);

    await waitFor(() => {
      expect(body.queryByRole('dialog')).toBeNull();
    });
  },
};
