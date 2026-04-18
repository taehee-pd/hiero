// StatusBadge — semantic wrapper over the shadcn Badge primitive that
// maps a status variant to the `status-*-surface` CSS classes defined
// in app/globals.css. Phase 5 DS extraction per
// specs/design-system-storybook.phase-5.md §5.1.
//
// Why this lives in components/ds (not components/ui):
//   - Admission criterion #1 — same semantics across call sites: every
//     site represents a point-in-time state with the same variant
//     taxonomy (neutral / success / warning / danger / info).
//   - Admission criterion #2 — same a11y contract: wraps a <span>
//     with implicit aria semantics via the Badge primitive.
//   - Admission criterion #3 — same behavior: no hover, no focus, no
//     keyboard handling. Pure display.
//   - Admission criterion #5 — DESIGN.md fidelity: every color comes
//     from --background-{success,warning,danger,highlight} and
//     --foreground-{success,warning,danger,highlight}. The pill-shape
//     and size follow DESIGN.md §4 ("pill shapes — 9999px — for
//     badges, status indicators, and primary CTA buttons").
//
// Cross-feature use proven by Phase 5.1 migration:
//   - components/studio/Navbar.tsx (save status)
//   - components/export/PublishPanel.tsx (connection status)
//   - components/export/SyncTargetPanel.tsx (target / delivery / publish status)
//
// Does NOT wrap the shadcn Badge directly. Badge's variants are
// default/secondary/destructive/outline — they map to the library's
// primary-color palette, not the semantic status palette. StatusBadge
// uses the outline variant + the status-*-surface utility class so
// consumers get pill shape + shadcn focus ring + status colors.

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type StatusBadgeVariant =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export type StatusBadgeSize = 'sm' | 'md';

export interface StatusBadgeProps
  extends Omit<React.ComponentProps<'span'>, 'children'> {
  variant?: StatusBadgeVariant;
  size?: StatusBadgeSize;
  children: React.ReactNode;
}

// Variant → surface class + foreground-tone class. `neutral` is
// intentionally NOT a status-surface class — it uses the default
// muted-on-background look that matches the current "Saved" state
// and the "…" connection-pending state.
const VARIANT_CLASSES: Record<StatusBadgeVariant, string> = {
  neutral: 'border-border/70 bg-background/80 text-muted-foreground',
  success: 'status-success-surface',
  warning: 'status-warning-surface',
  danger: 'status-error-surface',
  info: 'status-info-surface',
};

// Size tokens come from DESIGN.md §5 "Concrete dimensions" — sm is the
// 5-unit (20px) pill used in the navbar save badge; md is the 6-unit
// (24px) pill used in the sync and publish panels.
const SIZE_CLASSES: Record<StatusBadgeSize, string> = {
  sm: 'h-5 rounded-full px-2 text-[10px] font-medium tracking-tight',
  md: 'h-6 rounded-full px-2.5 text-[11px] font-medium tracking-tight',
};

export function StatusBadge({
  variant = 'neutral',
  size = 'sm',
  className,
  children,
  ...rest
}: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'shrink-0 border',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className,
      )}
      data-status={variant}
      {...rest}
    >
      {children}
    </Badge>
  );
}
