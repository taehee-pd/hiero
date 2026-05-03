'use client';

/**
 * Cadence toggle (W4-5 Layer 1).
 *
 * Two-state segmented control: `Soft` / `Snappy`. Built on the
 * shadcn/Radix `ToggleGroup` primitive (single-select) — same
 * primitive the panel already uses for Playback Mode at
 * `TransitionPanel.tsx`'s ToggleGroup section. Inherits the
 * primitive's keyboard model (Tab to enter, ←/→/Home/End to
 * navigate, roving tabindex), a11y semantics, and disabled state.
 *
 * Pure component — owns no store wiring; the parent passes
 * `value` and `onChange`.
 *
 * UX ref: docs_canonical/ICON_TRANSITION_UX_PLAN.md §3 Layer 1.
 */
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import type { Cadence } from '@/lib/schema/types';

type Props = {
  value: Cadence;
  onChange: (next: Cadence) => void;
  disabled?: boolean;
  className?: string;
};

const LABELS: Record<Cadence, string> = {
  soft: 'Soft',
  snappy: 'Snappy',
};
const DESCRIPTIONS: Record<Cadence, string> = {
  soft: 'Easy in, easy out — the default cadence.',
  snappy: 'Quick exit, decisive arrival.',
};

export function CadenceToggle({ value, onChange, disabled, className }: Props) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      onValueChange={(next) => {
        // Radix returns '' when the user clicks the active item; we
        // ignore that case (cadence is always set — there's no
        // "no cadence" state).
        if (next) onChange(next as Cadence);
      }}
      disabled={disabled}
      aria-label="Cadence"
      className={cn('w-fit', className)}
    >
      {(['soft', 'snappy'] as const).map((cadence) => (
        <ToggleGroupItem
          key={cadence}
          value={cadence}
          aria-label={`${LABELS[cadence]} cadence — ${DESCRIPTIONS[cadence]}`}
          className="min-w-[4.5rem] text-xs"
        >
          {LABELS[cadence]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
