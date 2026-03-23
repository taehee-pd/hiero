'use client';

import { useCallback } from 'react';
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
  value: string;  // hex color like '#1e293b'
  onChange: (hex: string) => void;
  className?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  'aria-label'?: string;
};

export function ColorPickerPopover({ value, onChange, className, disabled, style, 'aria-label': ariaLabel }: ColorPickerPopoverProps) {
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

  return (
    <Popover>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'h-7 w-10 rounded-md border border-input shadow-sm transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            disabled && 'pointer-events-none opacity-50',
            className,
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
  );
}
