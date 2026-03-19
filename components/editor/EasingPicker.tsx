'use client';

import { Button } from '@/components/kibo-ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BezierCurveEditor } from './BezierCurveEditor';
import type { SpringConfig } from '@/lib/schema/types';

export const EASING_OPTIONS = [
  'linear',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'ease-in-cubic',
  'ease-out-cubic',
  'spring',
] as const;

export type EasingOption = (typeof EASING_OPTIONS)[number];
export type EasingValue = string | SpringConfig;

const CURVES: Record<EasingOption, string> = {
  linear: 'M2 34 C12 24, 22 14, 34 2',
  'ease-in': 'M2 34 C8 34, 20 30, 34 2',
  'ease-out': 'M2 34 C8 10, 20 2, 34 2',
  'ease-in-out': 'M2 34 C10 34, 10 2, 34 2',
  'ease-in-cubic': 'M2 34 C4 34, 18 34, 34 2',
  'ease-out-cubic': 'M2 34 C2 14, 30 2, 34 2',
  spring: 'M2 34 C10 22, 16 40, 22 8 C26 -2, 30 6, 34 2',
};

function getEasingLabel(value: EasingValue): string {
  if (typeof value === 'object' && value.type === 'spring') return 'Spring';
  if (typeof value === 'string' && value.startsWith('cubic-bezier')) return 'Custom';
  if (typeof value === 'string' && value.startsWith('steps')) return 'Steps';
  return typeof value === 'string' ? value : 'linear';
}

export function EasingPicker({
  value,
  onSelect,
}: {
  value: EasingValue;
  onSelect: (value: EasingValue) => void;
}) {
  const _isPreset = typeof value === 'string' && EASING_OPTIONS.includes(value as EasingOption);

  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline">
            Easing: {getEasingLabel(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2">
          <div className="grid gap-1">
            {EASING_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() =>
                  onSelect(
                    option === 'spring'
                      ? { type: 'spring', stiffness: 120, damping: 18, mass: 1 }
                      : option,
                  )
                }
              >
                <span>{option}</span>
                <svg
                  width="38"
                  height="38"
                  viewBox="0 0 36 36"
                  className="rounded border border-border/80 bg-background"
                >
                  <path
                    d="M2 34 L34 2"
                    stroke="rgba(148,163,184,.35)"
                    fill="none"
                    strokeWidth="1"
                  />
                  <path
                    d={CURVES[option]}
                    stroke="currentColor"
                    fill="none"
                    strokeWidth="1.75"
                  />
                </svg>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <BezierCurveEditor value={value} onChange={onSelect} />
    </div>
  );
}
