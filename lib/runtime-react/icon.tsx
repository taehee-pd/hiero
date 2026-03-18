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
    defaultState,
    transition,
    effect,
    effectRepeat,
    onStateChange,
    size,
    title,
    ...svgProps
  },
  ref,
) {
  const runtime = useIcon({
    payload,
    state,
    defaultState,
    transition,
    effect,
    effectRepeat,
    onStateChange,
  });

  return (
    <RuntimeSvgRenderer
      {...svgProps}
      ref={ref}
      size={size}
      title={title}
      snapshot={runtime.snapshot}
      data-runtime-state={runtime.currentStateId}
      data-runtime-settled-state={runtime.settledStateId}
      data-runtime-transition={runtime.activeTransitionId}
      data-runtime-effect={runtime.activeEffectId}
      data-runtime-animating={runtime.isAnimating ? 'true' : 'false'}
    />
  );
});
