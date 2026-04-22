'use client';

/**
 * `@hiero/ui-icons` public API.
 *
 * <Icon name="plus" size={16} /> is the primary call form used across
 * the Hiero app. It dispatches to the generated per-icon component,
 * applies RTL mirroring for icons tagged in the source manifest, and
 * forwards accessible props to the underlying SVG.
 *
 * For call sites that want bundle-optimal direct imports, generated
 * components are re-exported below (e.g. `import { IcPlus } from
 * '@hiero/ui-icons'`). Either path works; `Icon` is the convenience.
 */

import React, { forwardRef } from 'react';

import { iconRegistry, rtlMirrorIcons, type IconName } from './registry.generated';

export type { IconName };
export { iconNames } from './registry.generated';

export type IconProps = {
  name: IconName;
  /** Pixel size. Runtime scales from the nearest authored variant. */
  size?: number;
  /** Accessible label. Omit for decorative icons (aria-hidden is set). */
  'aria-label'?: string;
  /** Class applied to the wrapper span. */
  className?: string;
  /** Inline style on the wrapper span. */
  style?: React.CSSProperties;
  /** Click handler; attached to the wrapper span. */
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
  /** Override direction. If unset the wrapper reads from the ambient dir attribute at mount. */
  dir?: 'ltr' | 'rtl';
};

function resolveDir(explicit: IconProps['dir']): 'ltr' | 'rtl' {
  if (explicit) return explicit;
  if (typeof document === 'undefined') return 'ltr';
  const ambient = document.documentElement.getAttribute('dir');
  return ambient === 'rtl' ? 'rtl' : 'ltr';
}

export const Icon = forwardRef<HTMLSpanElement, IconProps>(function Icon(
  { name, size = 16, className, style, onClick, dir, ...aria },
  ref,
) {
  const Component = iconRegistry[name];
  const shouldMirror = rtlMirrorIcons.has(name) && resolveDir(dir) === 'rtl';
  const label = aria['aria-label'];

  const wrapperStyle: React.CSSProperties = {
    display: 'inline-flex',
    verticalAlign: 'middle',
    lineHeight: 0,
    color: 'currentColor',
    ...(shouldMirror ? { transform: 'scaleX(-1)' } : {}),
    ...style,
  };

  return (
    <span
      ref={ref}
      onClick={onClick}
      className={className}
      style={wrapperStyle}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Component size={size} label={label} />
    </span>
  );
});

// Tree-shakable direct exports — re-exported from the generated barrel
// for callers who prefer `import { Plus } from '@hiero/ui-icons'` over
// the name-lookup convenience.
export * from '../generated/src';
