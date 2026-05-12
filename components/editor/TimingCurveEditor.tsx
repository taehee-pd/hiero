'use client';

/**
 * Two-curve timing override editor (W4-8 Layer 2).
 *
 * Surfaces only inside the Animate panel's Advanced disclosure.
 * Lets the author override the per-cadence motion curves with
 * explicit `g(t)` / `α(t)` easings plus an `alphaOffsetRatio`. The
 * shape is the runtime's `TimingOverride` from
 * `lib/runtime-core/timing-override.ts`; the validator
 * `isValidTimingOverride` enforces the easing-name allowlist + the
 * 0..0.5 offset range so a malformed override never silently
 * resolves to linear.
 *
 * Built on shadcn/Radix primitives — `Select` for the easing
 * pickers + `Input` for the numeric offset. No raw form elements.
 *
 * UX ref: docs_canonical/ICON_TRANSITION_UX_PLAN.md §3 Layer 2.
 */
import { useId } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  isValidTimingOverride,
  type TimingOverride,
} from '@/lib/runtime-core/timing-override';
import { cn } from '@/lib/utils';

const NAMED_EASINGS = [
  'linear',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'ease-in-cubic',
  'ease-out-cubic',
] as const;

type Easing = (typeof NAMED_EASINGS)[number];

type Props = {
  value: TimingOverride;
  onChange: (next: TimingOverride) => void;
  className?: string;
};

export function TimingCurveEditor({ value, onChange, className }: Props) {
  const groupId = useId();
  const offsetText = String(value.alphaOffsetRatio ?? 0.08);

  const update = (patch: Partial<TimingOverride>) => {
    const next: TimingOverride = { ...value, ...patch };
    if (isValidTimingOverride(next)) {
      onChange(next);
    }
  };

  return (
    <fieldset className={cn('space-y-3', className)}>
      <legend
        id={`${groupId}-legend`}
        className="text-xs font-semibold tracking-wide text-muted-foreground"
      >
        Custom timing
      </legend>

      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <Label
            htmlFor={`${groupId}-g`}
            className="text-[length:var(--text-label)] font-medium tracking-tight text-muted-foreground"
          >
            Geometry curve
          </Label>
          <Select
            value={isNamedEasing(value.g) ? value.g : 'ease-in-out'}
            onValueChange={(next) => update({ g: next })}
          >
            <SelectTrigger id={`${groupId}-g`} className="h-8 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NAMED_EASINGS.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label
            htmlFor={`${groupId}-alpha`}
            className="text-[length:var(--text-label)] font-medium tracking-tight text-muted-foreground"
          >
            Opacity curve
          </Label>
          <Select
            value={isNamedEasing(value.alpha) ? value.alpha : 'ease-out-cubic'}
            onValueChange={(next) => update({ alpha: next })}
          >
            <SelectTrigger id={`${groupId}-alpha`} className="h-8 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NAMED_EASINGS.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label
          htmlFor={`${groupId}-offset`}
          className="text-[length:var(--text-label)] font-medium tracking-tight text-muted-foreground"
        >
          Opacity offset (geometry leads opacity by, 0–0.5)
        </Label>
        <Input
          id={`${groupId}-offset`}
          type="number"
          min="0"
          max="0.5"
          step="0.01"
          value={offsetText}
          onChange={(event) => {
            const parsed = Number.parseFloat(event.target.value);
            if (Number.isFinite(parsed)) {
              update({ alphaOffsetRatio: parsed });
            }
          }}
          className="h-8 rounded-lg"
        />
        <p className="text-[length:var(--text-caption)] leading-snug text-muted-foreground/70">
          Geometry runs over the full duration; opacity starts after
          this fraction. Soft default 0.08; Snappy default 0.04.
        </p>
      </div>
    </fieldset>
  );
}

function isNamedEasing(name: string): name is Easing {
  return (NAMED_EASINGS as readonly string[]).includes(name);
}
