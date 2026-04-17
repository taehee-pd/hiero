'use client';

import { useEffect, useState } from 'react';
import { Kbd, KbdGroup } from '@/components/ui/kbd';

/**
 * Platform-aware modifier symbols.
 * Resolves "Cmd/Ctrl" style strings into the correct symbol for the
 * current platform (Mac vs. Windows/Linux).
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

/**
 * Resolve a platform-specific key label. The `isMac` flag must be
 * computed in a useEffect on the client to avoid SSR/CSR mismatch —
 * `navigator` is undefined on the server, so we default to non-Mac
 * rendering during SSR and the first client render, then switch after
 * mount. See useIsMac() below.
 */
function resolveKey(key: string, isMac = false): string {
  const entry = MOD_MAP[key.toLowerCase()];
  if (entry) return isMac ? entry.mac : entry.other;
  // Single character keys are uppercased for display
  if (key.length === 1) return key.toUpperCase();
  return key;
}

/**
 * Hydration-safe platform detection. Returns `false` on the server and
 * during the first client render (so server HTML and initial client
 * DOM match), then flips to the real value after mount. The net effect
 * is a single post-mount swap of Ctrl→⌘ on Mac clients — acceptable
 * since KbdHint is typically rendered inside tooltips (hidden until
 * hover/focus, so the swap is invisible in practice).
 */
function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);
  return isMac;
}

interface KbdHintProps {
  /**
   * Keyboard shortcut keys in order.
   *   - `['Cmd', 'S']` → ⌘ S (Mac) / Ctrl S (Win)
   *   - `['Shift', 'Cmd', 'Z']` → ⇧⌘Z (Mac) / Shift+Ctrl+Z (Win)
   *   - `['?']` → ?
   */
  keys: string[];
  className?: string;
}

/**
 * KbdHint — platform-aware keyboard shortcut display.
 *
 * Used in tooltips, toolbar hints, and dropdown menus to show
 * keyboard shortcuts in the correct platform format.
 *
 * Cross-feature consumers: Navbar tooltips, Toolbar hints, DropdownMenu
 * shortcuts, ContextMenu shortcuts, EditorShell dock tooltips.
 */
function KbdHint({ keys, className }: KbdHintProps) {
  const isMac = useIsMac();

  if (keys.length === 0) return null;

  if (keys.length === 1) {
    return (
      <Kbd className={className}>{resolveKey(keys[0], isMac)}</Kbd>
    );
  }

  return (
    <KbdGroup className={className}>
      {keys.map((key, i) => (
        <Kbd key={`${i}-${key}`}>{resolveKey(key, isMac)}</Kbd>
      ))}
    </KbdGroup>
  );
}

export { KbdHint, resolveKey };
export type { KbdHintProps };
