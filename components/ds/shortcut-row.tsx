'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { KbdHint } from './kbd-hint';

/**
 * ShortcutRow — labeled keyboard shortcut row for help dialogs.
 *
 * Composes KbdHint so every shortcut display in the app is platform-
 * aware (Mac ⌘ vs. Win Ctrl) without each call site re-implementing
 * the mapping.
 *
 * Style is driven entirely by `--shortcut-row-*` component tokens
 * declared in app/globals.css. To redesign, override the tokens.
 */
const shortcutRowVariants = cva(
  [
    'flex items-center justify-between',
    'gap-[var(--shortcut-row-gap)]',
    'rounded-[var(--shortcut-row-radius)]',
    'px-[var(--shortcut-row-padding-x)] py-[var(--shortcut-row-padding-y)]',
    'text-[length:var(--shortcut-row-font-size)]',
    'text-[color:var(--shortcut-row-fg)]',
    'border border-[var(--shortcut-row-border)]',
    'bg-[var(--shortcut-row-bg)]',
    'shadow-[var(--shortcut-row-shadow)]',
    'transition-colors duration-[var(--duration-fast)]',
  ],
  { variants: {}, defaultVariants: {} },
);

interface ShortcutRowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>,
    VariantProps<typeof shortcutRowVariants> {
  label: string;
  /** Shortcut keys (same shape as `KbdHint.keys`). */
  keys: string[];
}

function ShortcutRow({ label, keys, className, ...rest }: ShortcutRowProps) {
  return (
    <div className={cn(shortcutRowVariants(), className)} {...rest}>
      <span>{label}</span>
      <KbdHint keys={keys} />
    </div>
  );
}

export { ShortcutRow, shortcutRowVariants };
export type { ShortcutRowProps };
