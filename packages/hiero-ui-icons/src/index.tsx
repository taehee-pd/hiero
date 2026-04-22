'use client';

/**
 * `@hiero/ui-icons` public API.
 *
 * <Icon name="plus" size={16} aria-label="Add" /> is the primary call
 * form used across the Hiero app. It dispatches to the generated
 * per-icon component, applies RTL mirroring for icons tagged in the
 * source manifest, and forwards accessible props to the underlying
 * SVG.
 *
 * For bundle-optimal direct imports, generated components are
 * re-exported below (e.g. `import { Plus } from '@hiero/ui-icons'`).
 * Either path works; `Icon` is the convenience for call-site
 * migration; direct imports are for hot-path consumers.
 *
 * Intentional non-support:
 * - `onClick`. Icons are decorative or labeled; if interactive,
 *   wrap in a `<button>` so keyboard + screen-reader semantics are
 *   correct by default. Keep the Icon wrapper a11y-safe-by-default.
 * - `strokeWidth` override. Stroke is bound at icon design time;
 *   overriding per call site defeats design consistency. Re-author
 *   the icon at a different weight if needed.
 */

import React, { forwardRef, useEffect, useState } from 'react';

import { iconRegistry, rtlMirrorIcons, type IconName } from './registry.generated';

export type { IconName };
export { iconNames } from './registry.generated';

export type IconProps = {
  name: IconName;
  /** Pixel size. Runtime scales from the nearest authored variant. */
  size?: number;
  /** Accessible label. Defaults the wrapper role to "img"; omit for decorative icons (aria-hidden). */
  'aria-label'?: string;
  /**
   * Override the wrapper's role. Useful for semantic variants like
   * `role="status"` on a spinner. When unset, the wrapper picks
   * "img" if `aria-label` is provided, otherwise leaves role blank.
   */
  role?: string;
  /** Class applied to the wrapper span. */
  className?: string;
  /** Inline style on the wrapper span. A caller-supplied `transform` is composed with the RTL mirror. */
  style?: React.CSSProperties;
  /** Override direction. If unset, the wrapper reads the document direction after mount (SSR defaults to ltr). */
  dir?: 'ltr' | 'rtl';
};

function composeTransform(
  userTransform: string | undefined,
  mirror: boolean,
): string | undefined {
  if (!mirror) return userTransform;
  return userTransform ? `${userTransform} scaleX(-1)` : 'scaleX(-1)';
}

/**
 * Resolve ambient direction on the client without causing a hydration
 * mismatch: server and first client render both assume 'ltr' unless
 * the caller passed `dir` explicitly. After mount we read
 * `document.documentElement.dir` and re-render if it's 'rtl'.
 */
function useResolvedDir(explicit: IconProps['dir']): 'ltr' | 'rtl' {
  const [resolved, setResolved] = useState<'ltr' | 'rtl'>(explicit ?? 'ltr');
  useEffect(() => {
    if (explicit) {
      setResolved(explicit);
      return;
    }
    if (typeof document === 'undefined') return;
    const ambient = document.documentElement.getAttribute('dir');
    setResolved(ambient === 'rtl' ? 'rtl' : 'ltr');
  }, [explicit]);
  return resolved;
}

export const Icon = forwardRef<HTMLSpanElement, IconProps>(function Icon(
  { name, size = 16, className, style, dir, role, ...aria },
  ref,
) {
  const Component = iconRegistry[name];
  const resolvedDir = useResolvedDir(dir);
  const shouldMirror = rtlMirrorIcons.has(name) && resolvedDir === 'rtl';
  const label = aria['aria-label'];
  const resolvedRole = role ?? (label ? 'img' : undefined);

  const wrapperStyle: React.CSSProperties = {
    display: 'inline-flex',
    verticalAlign: 'middle',
    lineHeight: 0,
    color: 'currentColor',
    ...style,
    transform: composeTransform(style?.transform as string | undefined, shouldMirror),
  };

  return (
    <span
      ref={ref}
      className={className}
      style={wrapperStyle}
      role={resolvedRole}
      aria-label={label}
      aria-hidden={label || role ? undefined : true}
    >
      {/* Inner SVG is decorative — the wrapper carries a11y. */}
      <Component size={size} />
    </span>
  );
});

// Tree-shakable direct exports of every generated component.
// Consumers who want bundle-optimal usage should import by name
// (e.g. `import { Plus } from '@hiero/ui-icons'`) rather than via
// <Icon name="plus" />, which pulls in the full registry.
export * from '../generated/src';
