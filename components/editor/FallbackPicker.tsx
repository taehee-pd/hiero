'use client';

/**
 * Fallback motion picker (W4-5 Layer 1).
 *
 * Surfaces only when the resolver lands on `designed-fallback`
 * (T8) — the parent gates on `tier === 'designed-fallback'` before
 * mounting. The picker shows the named fallback library; the
 * resolver's auto-pick is highlighted via a sibling "Auto" badge;
 * the user's selection persists on `Transition.fallbackOverride`.
 *
 * Built on the shadcn/Radix `ToggleGroup` primitive (single-
 * select). The chip aesthetic uses small Toggle items wrapping
 * full-width-of-content; the primitive provides the keyboard
 * model (roving tabindex, ←/→/Home/End) and ARIA semantics.
 *
 * UX ref: docs_canonical/ICON_TRANSITION_UX_PLAN.md §3 Layer 1.
 */
import { useId } from 'react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { FALLBACK_DISPLAY_NAME } from '@/lib/runtime-core/transition-signal-messages';
import { FALLBACK_NAMES, type FallbackName } from '@/lib/schema/types';

type Props = {
  /** The fallback the resolver picked automatically. */
  resolverPicked: FallbackName;
  /** Author override (or `undefined` to use the resolver's pick). */
  override: FallbackName | undefined;
  onChange: (next: FallbackName | undefined) => void;
};

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
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={effective}
        onValueChange={(next) => {
          // Radix returns '' when the user clicks the active
          // item. The W4-audit-fix behaviour is "clicking ALWAYS
          // pins the chosen fallback explicitly" — re-clicking the
          // resolver's auto-pick should pin it as the override
          // rather than silently deselecting. So when next is '',
          // treat it as a re-pin of the currently effective
          // fallback. The "Use auto" affordance is the only path
          // that clears the override.
          onChange((next as FallbackName) || effective);
        }}
        aria-labelledby={`${groupId}-legend`}
        // The shadcn `ToggleGroupItem` primitive ships segmented-
        // control classes (`min-w-0 flex-1 shrink-0` + base
        // `whitespace-nowrap`). Without overriding `flex-basis`
        // and `min-width`, items collapse to ~0 width and their
        // nowrap labels overflow on top of each other. `flex-none`
        // gives content-sized basis with no grow/shrink, and
        // `min-w-fit` neutralises `min-w-0` so each pill is at
        // least as wide as its label.
        className="flex flex-wrap gap-1.5 [&>*]:flex-none [&>*]:min-w-fit [&>*]:rounded-full [&>*]:border [&>*]:border-border/60 [&>*]:px-2.5 [&>*]:text-[11px]"
      >
        {FALLBACK_NAMES.map((name) => {
          const isAuto = name === resolverPicked && override === undefined;
          return (
            <ToggleGroupItem
              key={name}
              value={name}
              aria-label={
                isAuto
                  ? `${FALLBACK_DISPLAY_NAME[name]} (resolver's pick)`
                  : FALLBACK_DISPLAY_NAME[name]
              }
              className={cn(
                'inline-flex items-center gap-1 leading-none',
                isAuto &&
                  'data-[state=on]:font-semibold data-[state=on]:text-accent-foreground',
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
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
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
