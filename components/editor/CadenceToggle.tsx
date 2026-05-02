'use client';

/**
 * Cadence toggle (W4-5 Layer 1).
 *
 * Two-state toggle: `Soft` / `Snappy`. Pure component — owns no
 * store wiring; the parent passes `value` and `onChange`.
 *
 * Keyboard: arrow-left / arrow-right cycle. Selected state is
 * communicated by a non-color affordance (font-weight + check
 * icon) so it remains accessible to colorblind users.
 *
 * UX ref: docs_canonical/ICON_TRANSITION_UX_PLAN.md §3 Layer 1.
 */
import { useCallback } from 'react';

import { cn } from '@/lib/utils';
import type { Cadence } from '@/lib/schema/types';

type Props = {
  value: Cadence;
  onChange: (next: Cadence) => void;
  disabled?: boolean;
};

const CADENCES: Cadence[] = ['soft', 'snappy'];
const LABELS: Record<Cadence, string> = {
  soft: 'Soft',
  snappy: 'Snappy',
};
const DESCRIPTIONS: Record<Cadence, string> = {
  soft: 'Easy in, easy out — the default cadence.',
  snappy: 'Quick exit, decisive arrival.',
};

export function CadenceToggle({ value, onChange, disabled }: Props) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      const idx = CADENCES.indexOf(value);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        onChange(CADENCES[(idx + 1) % CADENCES.length]!);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        onChange(CADENCES[(idx - 1 + CADENCES.length) % CADENCES.length]!);
      }
    },
    [disabled, onChange, value],
  );

  return (
    <div
      role="radiogroup"
      aria-label="Cadence"
      className="inline-flex items-stretch overflow-hidden rounded-md border border-border/60 bg-background"
    >
      {CADENCES.map((cadence) => {
        const selected = cadence === value;
        return (
          <button
            key={cadence}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${LABELS[cadence]} cadence — ${DESCRIPTIONS[cadence]}`}
            disabled={disabled}
            // Roving tabindex per ARIA radiogroup pattern (W4 audit
            // §5): only the selected radio is in the tab order so
            // Tab lands on the group once; arrow keys navigate
            // within. Unselected radios get tabIndex=-1.
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(cadence)}
            onKeyDown={handleKeyDown}
            className={cn(
              'min-w-[4.5rem] px-3 py-1.5 text-xs leading-none transition',
              selected
                ? 'bg-accent font-semibold text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {LABELS[cadence]}
          </button>
        );
      })}
    </div>
  );
}
