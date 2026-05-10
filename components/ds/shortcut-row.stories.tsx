import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ShortcutRow } from './shortcut-row';

const meta: Meta<typeof ShortcutRow> = {
  title: 'DS/ShortcutRow',
  component: ShortcutRow,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ShortcutRow>;

export const SingleKey: Story = {
  args: { label: 'Pen tool', keys: ['P'] },
};

export const ModifierCombo: Story = {
  args: { label: 'Save draft', keys: ['Cmd', 'S'] },
};

export const ThreeKeyCombo: Story = {
  args: { label: 'Redo', keys: ['Shift', 'Cmd', 'Z'] },
};

export const Cheatsheet: Story = {
  render: () => (
    <div className="grid w-[28rem] gap-3">
      <ShortcutRow label="Select tool" keys={['V']} />
      <ShortcutRow label="Direct select tool" keys={['A']} />
      <ShortcutRow label="Pen tool" keys={['P']} />
      <ShortcutRow label="Shape tool" keys={['U']} />
      <ShortcutRow label="Undo" keys={['Cmd', 'Z']} />
      <ShortcutRow label="Redo" keys={['Shift', 'Cmd', 'Z']} />
      <ShortcutRow label="Toggle guides" keys={['Cmd', ';']} />
      <ShortcutRow label="Toggle snap" keys={['Shift', 'Cmd', ';']} />
      <ShortcutRow label="Delete selected layer" keys={['Delete']} />
      <ShortcutRow label="Escape selection" keys={['Escape']} />
    </div>
  ),
};

export const ThemeMatrix: Story = {
  render: () => (
    <div className="grid gap-6">
      {(['classic', 'minimal', 'brutalist'] as const).map((theme) => (
        <div
          key={theme}
          data-theme={theme === 'classic' ? undefined : theme}
          className="grid gap-2"
        >
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {theme}
          </span>
          <div className="grid w-[24rem] gap-2 rounded-md border border-border/50 p-3">
            <ShortcutRow label="Save draft" keys={['Cmd', 'S']} />
            <ShortcutRow label="Redo" keys={['Shift', 'Cmd', 'Z']} />
            <ShortcutRow label="Search" keys={['Cmd', 'K']} />
          </div>
        </div>
      ))}
    </div>
  ),
};
