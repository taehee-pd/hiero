/**
 * HieroIconServer — React Server Component friendly static icon renderer.
 *
 * No 'use client' directive. No store subscription. No animation.
 * Emits the pre-computed SVG string produced by
 * `serializeIconToSvgString` via `dangerouslySetInnerHTML`.
 *
 * Use for static icons on server-rendered surfaces where zero client
 * JS is desired. For animated icons, hover/tap state, or any
 * interactive behavior, use `HieroIcon` instead.
 */
import React from 'react';

import type { Icon } from '../schema';
import { serializeIconToSvgString } from '../runtime-core/svg-serialize';

export type HieroIconServerProps = {
  icon: Icon;
  size?: number;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
};

export function HieroIconServer({
  icon,
  size,
  label,
  className,
  style,
}: HieroIconServerProps): React.ReactElement {
  const svg = serializeIconToSvgString(icon, { size, label });
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        verticalAlign: 'middle',
        lineHeight: 0,
        color: 'currentColor',
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
