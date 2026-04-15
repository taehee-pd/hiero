'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
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

/** CSS easing functions for the live preview animation */
const CSS_EASINGS: Record<EasingOption, string> = {
  linear: 'linear',
  'ease-in': 'cubic-bezier(0.42, 0, 1, 1)',
  'ease-out': 'cubic-bezier(0, 0, 0.58, 1)',
  'ease-in-out': 'cubic-bezier(0.42, 0, 0.58, 1)',
  'ease-in-cubic': 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
  'ease-out-cubic': 'cubic-bezier(0.215, 0.61, 0.355, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

function getEasingLabel(value: EasingValue): string {
  if (typeof value === 'object' && value.type === 'spring') return 'Spring';
  if (typeof value === 'string' && value.startsWith('cubic-bezier')) return 'Custom';
  if (typeof value === 'string' && value.startsWith('steps')) return 'Steps';
  return typeof value === 'string' ? value : 'linear';
}

/** UX-F2: Mini animation preview showing a dot moving along the easing curve */
function EasingMiniPreview({ easing }: { easing: EasingOption }) {
  const dotRef = useRef<HTMLDivElement>(null);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    // Restart animation on easing change
    setCycle((c) => c + 1);
  }, [easing]);

  useEffect(() => {
    const dot = dotRef.current;
    if (!dot) return;
    // Reset position then animate
    dot.style.transition = 'none';
    dot.style.left = '2px';
    // Force reflow
    void dot.offsetWidth;
    dot.style.transition = `left 800ms ${CSS_EASINGS[easing]}`;
    dot.style.left = 'calc(100% - 8px)';

    const timer = setTimeout(() => {
      // Return to start after animation completes
      if (dot) {
        dot.style.transition = 'left 300ms ease-out';
        dot.style.left = '2px';
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [easing, cycle]);

  return (
    <div className="relative mt-1 h-2 w-full rounded-full bg-muted/50">
      <div
        ref={dotRef}
        className="absolute top-0 h-2 w-[6px] rounded-full bg-primary"
        style={{ left: '2px' }}
      />
    </div>
  );
}

export function EasingPicker({
  value,
  onSelect,
  className,
  triggerClassName,
}: {
  value: EasingValue;
  onSelect: (value: EasingValue) => void;
  className?: string;
  triggerClassName?: string;
}) {
  const _isPreset = typeof value === 'string' && EASING_OPTIONS.includes(value as EasingOption);
  const [hoveredOption, setHoveredOption] = useState<EasingOption | null>(null);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className={cn('min-w-0 [&>span]:truncate', triggerClassName)}
          >
            <span>Easing: {getEasingLabel(value)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2">
          {/* UX-F2: Live preview area */}
          {hoveredOption && (
            <div className="mb-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5">
              <p className="text-[10px] font-medium text-muted-foreground">{hoveredOption} preview</p>
              <EasingMiniPreview easing={hoveredOption} />
            </div>
          )}
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
                onMouseEnter={() => setHoveredOption(option)}
                onMouseLeave={() => setHoveredOption(null)}
              >
                <span>{option}</span>
                <svg
                  width="38"
                  height="38"
                  viewBox="0 0 36 36"
                  className="rounded border border-border/70 bg-background"
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
