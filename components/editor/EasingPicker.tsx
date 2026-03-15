'use client';

import { Button } from '@/components/kibo-ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

const CURVES: Record<EasingOption, string> = {
  linear: 'M2 34 C12 24, 22 14, 34 2',
  'ease-in': 'M2 34 C8 34, 20 30, 34 2',
  'ease-out': 'M2 34 C8 10, 20 2, 34 2',
  'ease-in-out': 'M2 34 C10 34, 10 2, 34 2',
  'ease-in-cubic': 'M2 34 C4 34, 18 34, 34 2',
  'ease-out-cubic': 'M2 34 C2 14, 30 2, 34 2',
  spring: 'M2 34 C10 22, 16 40, 22 8 C26 -2, 30 6, 34 2',
};

export function EasingPicker({ value, onSelect }: { value: string; onSelect: (value: EasingOption) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">Easing: {value}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="grid gap-1">
          {EASING_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => onSelect(option)}
            >
              <span>{option}</span>
              <svg width="38" height="38" viewBox="0 0 36 36" className="rounded border border-border/80 bg-background">
                <path d="M2 34 L34 2" stroke="rgba(148,163,184,.35)" fill="none" strokeWidth="1" />
                <path d={CURVES[option]} stroke="currentColor" fill="none" strokeWidth="1.75" />
              </svg>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
