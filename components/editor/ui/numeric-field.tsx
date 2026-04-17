'use client';

import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface NumericFieldProps {
  /** Field label shown to the left. */
  label: string;
  /** Current numeric value. Renders empty when undefined. */
  value: number | undefined;
  /** Called with the parsed numeric value on change. */
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Optional unit suffix displayed after the input. */
  unit?: string;
  /** Placeholder text for the input. */
  placeholder?: string;
  /** Optional icon prefix shown before the label text. */
  icon?: string;
  /** When true, renders a slider alongside the input. */
  withSlider?: boolean;
  /** Custom label width class (defaults to w-[72px]). */
  labelWidth?: string;
  className?: string;
}

/**
 * NumericField — editor-local label + numeric input bundle.
 *
 * Extracts the repeated NumberField / AxisField / IconNumberField
 * pattern from InspectorPanel into a single reusable component.
 *
 * Editor-local: lives in components/editor/ui/, not in DS.
 * Does not meet the §3 cross-feature admission criteria.
 */
function NumericField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  unit,
  placeholder,
  icon,
  withSlider,
  labelWidth = 'w-[72px]',
  className,
}: NumericFieldProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const num = parseFloat(e.target.value);
      if (!Number.isNaN(num)) onChange(num);
    },
    [onChange],
  );

  const handleSliderChange = useCallback(
    ([v]: number[]) => {
      onChange(v);
    },
    [onChange],
  );

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Label
        className={cn(
          'shrink-0 text-[length:var(--text-label)] text-muted-foreground',
          icon && 'flex items-center gap-1',
          labelWidth,
        )}
      >
        {icon && <span className="font-mono text-sm leading-none">{icon}</span>}
        <span>{label}</span>
      </Label>

      {withSlider && min != null && max != null ? (
        <div className="flex flex-1 items-center gap-2">
          <Slider
            min={min}
            max={max}
            step={step}
            value={[value ?? min]}
            onValueChange={handleSliderChange}
            disabled={disabled}
            className="h-1.5 flex-1"
          />
          <span className="min-w-[2.5rem] text-right text-[length:var(--text-label)] tabular-nums text-muted-foreground">
            {(value ?? min).toFixed(step < 1 ? 2 : 0)}
            {unit ? ` ${unit}` : ''}
          </span>
        </div>
      ) : (
        <div className="relative flex flex-1 items-center">
          <Input
            type={placeholder ? 'text' : 'number'}
            inputMode="decimal"
            value={value ?? ''}
            onChange={handleChange}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            placeholder={placeholder}
            className={cn(
              'h-8 w-full rounded-lg bg-input text-xs',
              unit && 'pr-7',
            )}
          />
          {unit && (
            <span className="pointer-events-none absolute right-2 text-[10px] text-muted-foreground/60">
              {unit}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export { NumericField };
export type { NumericFieldProps };
