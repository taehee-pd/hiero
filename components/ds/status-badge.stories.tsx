import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StatusBadge } from './status-badge';

const meta: Meta<typeof StatusBadge> = {
  title: 'DS/StatusBadge',
  component: StatusBadge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        // Intent-based (preferred)
        'neutral',
        'saved',
        'unsaved',
        'connected',
        'error',
        // Legacy aliases (kept for backwards compat with current call sites)
        'success',
        'warning',
        'danger',
        'info',
        'accent',
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

// ─── Intent-based variants (use these in new code) ───

export const Neutral: Story = {
  args: { children: 'Idle', variant: 'neutral' },
};

export const Saved: Story = {
  args: { children: 'Saved', variant: 'saved' },
};

export const Unsaved: Story = {
  args: { children: 'Unsaved changes', variant: 'unsaved' },
};

export const Connected: Story = {
  args: { children: 'Connected', variant: 'connected' },
};

export const Error: Story = {
  args: { children: 'Conflict', variant: 'error' },
};

// ─── Composition ───

export const AsChildButton: Story = {
  render: () => (
    <StatusBadge asChild variant="connected">
      <button type="button" onClick={() => alert('clicked')} className="cursor-pointer">
        PR #42 created
      </button>
    </StatusBadge>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Use `asChild` to render the badge as the immediate child element while keeping all StatusBadge styling — Radix Slot composition.',
      },
    },
  },
};

// ─── All variants matrix ───

export const AllVariants: Story = {
  render: () => (
    <div className="grid gap-4">
      <div>
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
          Intent-based (preferred)
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge variant="neutral">Idle</StatusBadge>
          <StatusBadge variant="saved">Saved</StatusBadge>
          <StatusBadge variant="unsaved">Unsaved changes</StatusBadge>
          <StatusBadge variant="connected">Connected</StatusBadge>
          <StatusBadge variant="error">Conflict</StatusBadge>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
          Legacy aliases (existing call sites; intent-named alternatives in
          parens)
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge variant="success">success → saved</StatusBadge>
          <StatusBadge variant="warning">warning → unsaved</StatusBadge>
          <StatusBadge variant="danger">danger → error</StatusBadge>
          <StatusBadge variant="info">info → connected</StatusBadge>
          <StatusBadge variant="accent">accent (purple)</StatusBadge>
        </div>
      </div>
    </div>
  ),
};

export const ThemeMatrix: Story = {
  render: () => (
    <div className="grid gap-6">
      {(['classic', 'minimal', 'brutalist'] as const).map((theme) => (
        <div key={theme} data-theme={theme === 'classic' ? undefined : theme} className="grid gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {theme}
          </span>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/50 p-3">
            <StatusBadge variant="neutral">Idle</StatusBadge>
            <StatusBadge variant="saved">Saved</StatusBadge>
            <StatusBadge variant="unsaved">Unsaved</StatusBadge>
            <StatusBadge variant="connected">Connected</StatusBadge>
            <StatusBadge variant="error">Error</StatusBadge>
          </div>
        </div>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The same five intent variants under each design theme. Switching is a `data-theme` attribute on a parent.',
      },
    },
  },
};
