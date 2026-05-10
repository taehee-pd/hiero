'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Platform-aware modifier symbols. Resolves "Cmd/Ctrl"-style strings
 * into the correct symbol for the current platform.
 */
const MOD_MAP: Record<string, { mac: string; other: string }> = {
  cmd: { mac: '⌘', other: 'Ctrl' },
  ctrl: { mac: '⌃', other: 'Ctrl' },
  alt: { mac: '⌥', other: 'Alt' },
  shift: { mac: '⇧', other: 'Shift' },
  meta: { mac: '⌘', other: 'Win' },
  enter: { mac: '↵', other: '↵' },
  backspace: { mac: '⌫', other: '⌫' },
  delete: { mac: '⌦', other: 'Del' },
  escape: { mac: 'Esc', other: 'Esc' },
  tab: { mac: '⇥', other: 'Tab' },
  up: { mac: '↑', other: '↑' },
  down: { mac: '↓', other: '↓' },
  left: { mac: '←', other: '←' },
  right: { mac: '→', other: '→' },
};

function resolveKey(key: string, isMac = false): string {
  const entry = MOD_MAP[key.toLowerCase()];
  if (entry) return isMac ? entry.mac : entry.other;
  if (key.length === 1) return key.toUpperCase();
  return key;
}

/**
 * Hydration-safe platform detection. Returns false on SSR + first
 * client render, then flips after mount. KbdHint is normally rendered
 * inside tooltips, so the swap is invisible in practice.
 */
function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);
  return isMac;
}

/**
 * Kbd glyph styling, driven entirely by `--kbd-*` component tokens.
 * The `[[data-slot=tooltip-content]_&]` selectors invert the kbd inside
 * a Radix tooltip so it stays legible against the dark tooltip surface.
 */
const kbdVariants = cva(
  [
    'inline-flex items-center justify-center pointer-events-none select-none',
    'min-w-[var(--kbd-min-width)]',
    'rounded-[var(--kbd-radius)]',
    'px-[var(--kbd-padding-x)] py-[var(--kbd-padding-y)]',
    'text-[length:var(--kbd-font-size)]',
    'font-[var(--kbd-font-family)]',
    'font-[number:var(--kbd-font-weight)]',
    'border border-[var(--kbd-border)]',
    'bg-[var(--kbd-bg)] text-[var(--kbd-fg)]',
    '[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10 [[data-slot=tooltip-content]_&]:border-transparent',
  ],
  {
    variants: {},
    defaultVariants: {},
  },
);

type KbdVariantProps = VariantProps<typeof kbdVariants>;

interface KbdHintProps extends KbdVariantProps {
  /** Keyboard shortcut keys, in order. e.g. ['Cmd','S'] → ⌘S / Ctrl+S. */
  keys: string[];
  className?: string;
}

function KbdHint({ keys, className, ...variantProps }: KbdHintProps) {
  const isMac = useIsMac();

  if (keys.length === 0) return null;

  if (keys.length === 1) {
    return (
      <kbd data-slot="kbd" className={cn(kbdVariants(variantProps), className)}>
        {resolveKey(keys[0], isMac)}
      </kbd>
    );
  }

  return (
    <kbd data-slot="kbd-group" className={cn('inline-flex items-center gap-1', className)}>
      {keys.map((key, i) => (
        <kbd key={`${i}-${key}`} data-slot="kbd" className={kbdVariants(variantProps)}>
          {resolveKey(key, isMac)}
        </kbd>
      ))}
    </kbd>
  );
}

export { KbdHint, kbdVariants, resolveKey };
export type { KbdHintProps };
