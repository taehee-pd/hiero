import React, { forwardRef } from 'react';

import { RuntimeSvgRenderer } from '@/lib/runtime-dom/snapshot-renderer';
import type { UseIconOptions } from './use-icon';
import { useIcon } from './use-icon';

export type IconProps = Omit<React.SVGProps<SVGSVGElement>, 'children'> &
  UseIconOptions & {
    size?: number;
    title?: string;
  };

export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  {
    payload,
    state,
    defaultType,
    transition,
    effect,
    effectRepeat,
    onTypeChange,
    size,
    title,
    ...svgProps
  },
  ref,
) {
  const runtime = useIcon({
    payload,
    state,
    defaultType,
    transition,
    effect,
    effectRepeat,
    onTypeChange,
  });

  return (
    <RuntimeSvgRenderer
      {...svgProps}
      ref={ref}
      size={size}
      title={title}
      snapshot={runtime.snapshot}
      data-runtime-state={runtime.currentTypeId}
      data-runtime-settled-state={runtime.settledTypeId}
      data-runtime-transition={runtime.activeTransitionId}
      data-runtime-effect={runtime.activeEffectId}
      data-runtime-animating={runtime.isAnimating ? 'true' : 'false'}
    />
  );
});
