'use client';

import { useCallback, useState } from 'react';
import Color, { type ColorLike } from 'color';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerEyeDropper,
  ColorPickerFormat,
  ColorPickerOutput,
} from '@/components/ds/color-picker';
import { cn } from '@/lib/utils';

interface ColorFieldProps {
  /** Hex color value like '#1e293b'. */
  value: string;
  /** Called with hex string when color changes. */
  onChange: (hex: string) => void;
  /** Opacity from 0–1. Shows opacity input when onOpacityChange is provided. */
  opacity?: number;
  /** Called with opacity 0–1 when opacity changes. */
  onOpacityChange?: (opacity: number) => void;
  className?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  'aria-label'?: string;
}

/**
 * ColorField — inline color swatch + hex input + optional opacity.
 *
 * Style is driven by `--field-*` component tokens. To redesign, override
 * `--field-radius`, `--field-border`, `--field-swatch-size`, etc.
 */

const swatchClass = cn(
  'shrink-0 transition-colors',
  'h-[var(--field-swatch-size)] w-[var(--field-swatch-size)]',
  'rounded-[var(--field-swatch-radius)]',
  'border border-[color:var(--field-swatch-border)]',
  'shadow-none hover:border-[color:var(--field-border-focus)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--field-border-focus)]',
);

const fieldInputClass = cn(
  'w-full min-w-0 bg-transparent shadow-none outline-none transition-colors',
  'h-[var(--field-height)]',
  'rounded-[var(--field-radius)]',
  'border border-[color:var(--field-border)]',
  'focus:border-[color:var(--field-border-focus)]',
  'font-mono text-[length:var(--text-label)] text-[color:var(--field-fg)]',
  'leading-[var(--field-height)] disabled:opacity-50',
);

function ColorField({
  value,
  onChange,
  opacity,
  onOpacityChange,
  className,
  disabled,
  style,
  'aria-label': ariaLabel,
}: ColorFieldProps) {
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [opacityDraft, setOpacityDraft] = useState<string | null>(null);

  const handleChange = useCallback(
    (rgba: ColorLike) => {
      try {
        const hex = Color(rgba).hex();
        onChange(hex);
      } catch {
        /* ignore invalid colors during drag */
      }
    },
    [onChange],
  );

  const displayHex = value.replace(/^#/, '').toUpperCase();

  const commitHex = () => {
    if (hexDraft === null) return;
    const cleaned = hexDraft.replace(/^#/, '').trim();
    if (/^[0-9a-fA-F]{3,8}$/.test(cleaned)) {
      try {
        const hex = Color(`#${cleaned}`).hex();
        onChange(hex);
      } catch {
        /* invalid */
      }
    }
    setHexDraft(null);
  };

  const commitOpacity = () => {
    if (opacityDraft === null || !onOpacityChange) return;
    const num = Number(opacityDraft);
    if (!Number.isNaN(num)) {
      onOpacityChange(Math.max(0, Math.min(100, num)) / 100);
    }
    setOpacityDraft(null);
  };

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Popover>
        <PopoverTrigger asChild disabled={disabled}>
          <button
            type="button"
            className={cn(swatchClass, disabled && 'pointer-events-none opacity-50')}
            style={{ backgroundColor: value, ...style }}
            aria-label={ariaLabel ?? `Color: ${value}`}
          />
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start" sideOffset={8}>
          <ColorPicker value={value} onChange={handleChange}>
            <ColorPickerSelection className="h-36 rounded-md" />
            <ColorPickerHue />
            <div className="flex items-center gap-2">
              <ColorPickerOutput />
              <ColorPickerEyeDropper />
            </div>
            <ColorPickerFormat />
          </ColorPicker>
        </PopoverContent>
      </Popover>

      <div className="relative flex h-[var(--field-height)] min-w-0 flex-1 items-center">
        <span className="pointer-events-none absolute left-1.5 text-[length:var(--text-caption)] text-[color:var(--field-fg)]/60">
          #
        </span>
        <input
          type="text"
          value={hexDraft ?? displayHex}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={commitHex}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitHex();
            if (e.key === 'Escape') setHexDraft(null);
          }}
          disabled={disabled}
          className={cn(fieldInputClass, 'pl-4 pr-1.5')}
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {onOpacityChange != null && (
        <>
          <span
            aria-hidden="true"
            className="h-4 w-px shrink-0 bg-[color:var(--field-border)]"
          />
          <div className="relative flex h-[var(--field-height)] w-12 shrink-0 items-center">
            <input
              type="text"
              value={opacityDraft ?? String(Math.round((opacity ?? 1) * 100))}
              onChange={(e) => setOpacityDraft(e.target.value)}
              onBlur={commitOpacity}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitOpacity();
                if (e.key === 'Escape') setOpacityDraft(null);
              }}
              disabled={disabled}
              className={cn(fieldInputClass, 'pl-1.5 pr-5 text-center')}
            />
            <span className="pointer-events-none absolute right-1.5 text-[length:var(--text-caption)] text-[color:var(--field-fg)]/60">
              %
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export { ColorField };
export type { ColorFieldProps };
