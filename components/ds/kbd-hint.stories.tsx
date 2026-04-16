import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { KbdHint } from './kbd-hint';

const meta: Meta<typeof KbdHint> = {
  title: 'DS/KbdHint',
  component: KbdHint,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof KbdHint>;

export const SingleKey: Story = {
  args: { keys: ['V'] },
};

export const ModifierCombo: Story = {
  args: { keys: ['Cmd', 'S'] },
};

export const ThreeKeyCombo: Story = {
  args: { keys: ['Shift', 'Cmd', 'Z'] },
};

export const SpecialKeys: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Save:</span>
        <KbdHint keys={['Cmd', 'S']} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Undo:</span>
        <KbdHint keys={['Cmd', 'Z']} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Redo:</span>
        <KbdHint keys={['Shift', 'Cmd', 'Z']} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Search:</span>
        <KbdHint keys={['Cmd', 'K']} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Delete:</span>
        <KbdHint keys={['Backspace']} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Help:</span>
        <KbdHint keys={['?']} />
      </div>
    </div>
  ),
};

export const InTooltipContext: Story = {
  render: () => (
    <div data-slot="tooltip-content" className="bg-foreground text-background rounded-md px-3 py-1.5">
      <span className="inline-flex items-center gap-1.5">
        <span>Save</span>
        <KbdHint keys={['Cmd', 'S']} />
      </span>
    </div>
  ),
};
