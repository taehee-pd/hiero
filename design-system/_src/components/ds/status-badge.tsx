import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusBadgeVariant =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'accent';

interface StatusBadgeProps {
  /** Text shown inside the badge. Sentence case per STYLEGUIDE.md. */
  children: React.ReactNode;
  /** Semantic status variant. Maps to design-system status surface classes. */
  variant?: StatusBadgeVariant;
  className?: string;
}

const variantClasses: Record<StatusBadgeVariant, string> = {
  neutral: 'border-border/70 bg-background/80 text-muted-foreground',
  success: 'status-success-surface',
  warning: 'status-warning-surface',
  danger: 'status-error-surface',
  info: 'status-info-surface',
  accent:
    'border-transparent bg-primary text-primary-foreground',
};

/**
 * StatusBadge — pill-shaped status indicator used across features.
 *
 * Sourced from DESIGN.md §7 (save status badge) and §4 (pill radius 9999px).
 * Uses the status-surface CSS classes defined in app/globals.css.
 *
 * Cross-feature consumers: Navbar (save status), PublishPanel (connection),
 * SyncPrPanel (sync phase), ReleasePanel (snapshot), SyncTargetPanel.
 */
function StatusBadge({
  children,
  variant = 'neutral',
  className,
}: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-[var(--pill-height-sm)] shrink-0 rounded-[var(--radius-pill)] px-2 text-[10px] font-medium tracking-tight',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </Badge>
  );
}

export { StatusBadge };
export type { StatusBadgeProps, StatusBadgeVariant };
