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

function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

function resolveKey(key: string): string {
  const entry = MOD_MAP[key.toLowerCase()];
  if (entry) return isMac() ? entry.mac : entry.other;
  // Single character keys are uppercased for display
  if (key.length === 1) return key.toUpperCase();
  return key;
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
  if (keys.length === 0) return null;

  if (keys.length === 1) {
    return (
      <Kbd className={className}>{resolveKey(keys[0])}</Kbd>
    );
  }

  return (
    <KbdGroup className={className}>
      {keys.map((key, i) => (
        <Kbd key={`${key}-${i}`}>{resolveKey(key)}</Kbd>
      ))}
    </KbdGroup>
  );
}

export { KbdHint, resolveKey };
export type { KbdHintProps };
