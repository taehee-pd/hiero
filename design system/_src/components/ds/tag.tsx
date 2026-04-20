import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type TagVariant = 'default' | 'muted' | 'outline' | 'success' | 'warning' | 'danger';

interface TagProps {
  /** Tag content — classification label text. */
  children: React.ReactNode;
  /**
   * Visual variant:
   *   default  → solid primary (used for "added", primary classification)
   *   muted    → secondary background (platform, version, release kind)
   *   outline  → border-only (delivery mode, paths, neutral metadata)
   *   success  → green-tinted outline (auto-publish, connected)
   *   warning  → amber-tinted outline (dry-run, pending)
   *   danger   → destructive (removed, error states)
   */
  variant?: TagVariant;
  className?: string;
}

const variantConfig: Record<
  TagVariant,
  { badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline'; extra: string }
> = {
  default: { badgeVariant: 'default', extra: '' },
  muted: { badgeVariant: 'secondary', extra: '' },
  outline: { badgeVariant: 'outline', extra: '' },
  success: { badgeVariant: 'outline', extra: 'text-emerald-600 dark:text-emerald-400' },
  warning: { badgeVariant: 'outline', extra: 'text-amber-600 dark:text-amber-400' },
  danger: { badgeVariant: 'destructive', extra: '' },
};

/**
 * Tag — classification / metadata label for non-interactive data.
 *
 * Used for platform names, version numbers, delivery modes, change kinds,
 * directory paths, feature flags, format labels, and similar metadata
 * that classifies or describes an item.
 *
 * Different from StatusBadge: Tags are informational labels, not semantic
 * status indicators. They don't represent system state (saved/unsaved,
 * connected/disconnected) — they classify data.
 *
 * Cross-feature consumers: SyncTargetPanel, ReleasePanel, SyncDiffPreview,
 * SyncConflictPanel, LottieExportPanel.
 */
function Tag({ children, variant = 'outline', className }: TagProps) {
  const { badgeVariant, extra } = variantConfig[variant];
  return (
    <Badge
      variant={badgeVariant}
      className={cn('text-[10px]', extra, className)}
    >
      {children}
    </Badge>
  );
}

export { Tag };
export type { TagProps, TagVariant };
