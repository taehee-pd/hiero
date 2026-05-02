'use client';

/**
 * Fallback motion picker (W4-5 Layer 1).
 *
 * Surfaces only when the resolver lands on `designed-fallback`
 * (T8) — the parent gates on `tier === 'designed-fallback'` before
 * mounting. The picker shows the named fallback library; the
 * resolver's auto-pick is highlighted as "Auto"; the user's
 * selection persists on `Transition.fallbackOverride`.
 *
 * UX ref: docs_canonical/ICON_TRANSITION_UX_PLAN.md §3 Layer 1.
 */
import { useId } from 'react';

import { cn } from '@/lib/utils';
import { FALLBACK_DISPLAY_NAME } from '@/lib/runtime-core/transition-signal-messages';
import type { FallbackName } from '@/lib/schema/types';

type Props = {
  /** The fallback the resolver picked automatically. */
  resolverPicked: FallbackName;
  /** Author override (or `undefined` to use the resolver's pick). */
  override: FallbackName | undefined;
  onChange: (next: FallbackName | undefined) => void;
};

// Closed list — kept in sync with the FallbackName union.
const ALL_FALLBACKS: FallbackName[] = [
  'radial-pop',
  'directional-replace-up',
  'directional-replace-down',
  'directional-replace-left',
  'directional-replace-right',
  'directional-replace-toward',
  'directional-replace-away',
  'draw-replace',
  'scale-pop',
];

export function FallbackPicker({
  resolverPicked,
  override,
  onChange,
}: Props) {
  const groupId = useId();
  const effective = override ?? resolverPicked;
  return (
    <fieldset className="space-y-2">
      <legend
        id={`${groupId}-legend`}
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Fallback motion
      </legend>
      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-legend`}
        className="flex flex-wrap gap-1.5"
      >
        {ALL_FALLBACKS.map((name) => {
          const selected = name === effective;
          const isAuto = name === resolverPicked && override === undefined;
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={selected}
              // W4 audit §5: clicking a chip ALWAYS pins it as the
              // explicit override. The previous toggle-on-equality
              // behaviour silently un-pinned an explicit override
              // when the resolver's auto-pick happened to match,
              // surprising authors who'd set the override on
              // purpose. To clear the override, the user picks the
              // dedicated "Use auto" affordance below.
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(name)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] leading-none transition',
                selected
                  ? 'border-accent bg-accent/40 font-semibold text-accent-foreground'
                  : 'border-border/60 bg-background text-muted-foreground hover:bg-accent/20 hover:text-foreground',
              )}
            >
              <span>{FALLBACK_DISPLAY_NAME[name]}</span>
              {isAuto ? (
                <span
                  aria-label="Auto-picked by the resolver"
                  className="rounded-sm bg-foreground/10 px-1 text-[9px] uppercase tracking-wide"
                >
                  Auto
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {override !== undefined ? (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="self-start text-[10px] uppercase tracking-wide text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Use auto ({FALLBACK_DISPLAY_NAME[resolverPicked]})
        </button>
      ) : null}
    </fieldset>
  );
}
