import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

// Phase 3 gated primitive story for Select.
// Interaction tests (plan §6 Phase 3):
//   - keyboard open (Space/Enter)
//   - Escape closes without change
//   - selecting an option updates the trigger label
// Visual values come from DESIGN.md §4 (inputs & form controls).

function SelectFixture() {
  return (
    <Select>
      <SelectTrigger style={{ width: 200 }} aria-label="variant">
        <SelectValue placeholder="pick a variant" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="default">default</SelectItem>
        <SelectItem value="hover">hover</SelectItem>
        <SelectItem value="active">active</SelectItem>
        <SelectItem value="disabled">disabled</SelectItem>
      </SelectContent>
    </Select>
  );
}

const meta = {
  title: 'Primitives/Select',
  component: SelectFixture,
  tags: ['autodocs'],
} satisfies Meta<typeof SelectFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// ── Interaction tests ────────────────────────────────────────────────

export const KeyboardOpenViaSpace: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole('combobox', { name: /variant/i });
    trigger.focus();
    await userEvent.keyboard(' ');
    // Radix portals the listbox to document.body
    const body = within(document.body);
    await waitFor(async () => {
      await expect(await body.findByRole('listbox')).toBeInTheDocument();
    });
    // Close for next test
    await userEvent.keyboard('{Escape}');
  },
};

export const EscapeClosesWithoutChange: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole('combobox', { name: /variant/i });
    trigger.focus();
    await userEvent.keyboard('{Enter}');

    const body = within(document.body);
    await waitFor(async () => {
      await expect(await body.findByRole('listbox')).toBeInTheDocument();
    });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(body.queryByRole('listbox')).toBeNull();
    });
    // Trigger label should still show the placeholder since nothing was chosen.
    await expect(trigger.textContent).toMatch(/pick a variant/i);
  },
};

export const ArrowNavigateAndSelect: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole('combobox', { name: /variant/i });
    trigger.focus();
    await userEvent.keyboard('{Enter}');

    const body = within(document.body);
    await waitFor(async () => {
      await expect(await body.findByRole('listbox')).toBeInTheDocument();
    });
    // Radix highlights "default" (index 0) on open. Two ArrowDowns
    // should advance to index 2 ("active"), not "hover" at index 1 —
    // the first ArrowDown moves 0 → 1, the second moves 1 → 2.
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await waitFor(() => {
      expect(body.queryByRole('listbox')).toBeNull();
    });
    await expect(trigger.textContent).toMatch(/active/i);
  },
};
