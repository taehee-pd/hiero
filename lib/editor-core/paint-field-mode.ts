import type { PaintRef } from '@/lib/schema/types';

export type PaintFieldMode =
  | 'currentFill'
  | 'currentColor'
  | 'none'
  | 'solid'
  | 'linearGradient'
  | 'radialGradient';

export function getPaintFieldMode(
  paint: PaintRef | undefined,
  isFillField: boolean,
): PaintFieldMode {
  if (paint?.mode === 'linearGradient' || paint?.mode === 'radialGradient') {
    return paint.mode;
  }

  if (paint?.mode === 'fixed' && paint.value === 'none') {
    return 'none';
  }

  if (paint?.mode === 'currentColor') {
    return isFillField ? 'currentFill' : 'currentColor';
  }

  return 'solid';
}
