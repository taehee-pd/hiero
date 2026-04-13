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
} from '@/components/kibo-ui/color-picker';
import { cn } from '@/lib/utils';

type ColorPickerPopoverProps = {
  value: string; // hex color like '#1e293b'
  onChange: (hex: string) => void;
  opacity?: number; // 0-1
  onOpacityChange?: (opacity: number) => void;
  className?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  'aria-label'?: string;
};

export function ColorPickerPopover({
  value,
  onChange,
  opacity,
  onOpacityChange,
  className,
  disabled,
  style,
  'aria-label': ariaLabel,
}: ColorPickerPopoverProps) {
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [opacityDraft, setOpacityDraft] = useState<string | null>(null);

  const handleChange = useCallback(
    (rgba: ColorLike) => {
      try {
        const hex = Color(rgba).hex();
        onChange(hex);
      } catch {
        // ignore invalid colors during drag
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
        // invalid
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
            className={cn(
              'h-7 w-7 shrink-0 rounded-sm border border-border/70 shadow-none transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              disabled && 'pointer-events-none opacity-50',
            )}
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

      {/* Hex input */}
      <div className="relative flex h-7 min-w-0 flex-1 items-center">
        <span className="pointer-events-none absolute left-1.5 text-[10px] text-muted-foreground/60">
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
          className="h-7 w-full min-w-0 rounded-sm border border-border/70 bg-transparent pl-4 pr-1.5 font-mono text-[11px] leading-7 text-foreground shadow-none outline-none transition-colors focus:border-ring disabled:opacity-50"
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {/* Opacity input */}
      {onOpacityChange != null && (
        <>
          <span
            aria-hidden="true"
            className="h-4 w-px shrink-0 bg-border/70"
          />
          <div className="relative flex h-7 w-12 shrink-0 items-center">
            <input
            type="text"
            value={
              opacityDraft ?? String(Math.round((opacity ?? 1) * 100))
            }
            onChange={(e) => setOpacityDraft(e.target.value)}
            onBlur={commitOpacity}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitOpacity();
              if (e.key === 'Escape') setOpacityDraft(null);
            }}
            disabled={disabled}
            className="h-7 w-full rounded-sm border border-border/70 bg-transparent pl-1.5 pr-5 text-center font-mono text-[11px] leading-7 text-foreground shadow-none outline-none transition-colors focus:border-ring disabled:opacity-50"
          />
            <span className="pointer-events-none absolute right-1.5 text-[10px] text-muted-foreground/60">
              %
            </span>
          </div>
        </>
      )}
    </div>
  );
}
