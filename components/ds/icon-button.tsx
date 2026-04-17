import * as React from 'react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { KbdHint } from '@/components/ds/kbd-hint';

type IconButtonSize = 'sm' | 'md' | 'lg';
type IconButtonRadius = 'toolbar' | 'panel' | 'pill';
type IconButtonVariant = 'ghost' | 'secondary' | 'primary-soft';

interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Icon element; size is controlled by this component, not the caller. */
  icon: React.ReactElement;
  /** Required for a11y — never inferred from an icon name. */
  'aria-label': string;
  /** Shown in Tooltip. Set to false to suppress tooltip. Defaults to aria-label. */
  tooltip?: React.ReactNode | false;
  /** Tooltip placement side. */
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  /** Optional keyboard shortcut hint rendered in Tooltip content (platform-aware). */
  kbd?: string[];
  /**
   * Button frame size. Maps to DESIGN.md §5 + §9:
   *   sm → 24px frame, 12px icon
   *   md → 28px frame, 14px icon (default — "ghost icon buttons at 28px with 14px icons")
   *   lg → 32px frame, 16px icon
   */
  size?: IconButtonSize;
  /**
   * Corner radius. Maps to DESIGN.md §4 "Ghost button":
   *   "toolbar" → 0.5rem (8px) — toolbar actions (default)
   *   "panel"   → 0.875rem (14px) — panel navigation
   *   "pill"    → 9999px — badge / CTA anchors
   */
  radius?: IconButtonRadius;
  /** Visual variant — sourced from DESIGN.md §4 button variants. */
  variant?: IconButtonVariant;
  /** Replaces icon with Spinner; sets aria-busy; keeps tooltip text. */
  loading?: boolean;
}

const sizeClasses: Record<IconButtonSize, string> = {
  sm: 'h-[var(--button-icon-size-sm)] w-[var(--button-icon-size-sm)] [&_svg:not([class*="size-"])]:size-[var(--icon-inner-size-sm)]',
  md: 'h-[var(--button-icon-size-md)] w-[var(--button-icon-size-md)] [&_svg:not([class*="size-"])]:size-[var(--icon-inner-size-md)]',
  lg: 'h-[var(--button-icon-size-lg)] w-[var(--button-icon-size-lg)] [&_svg:not([class*="size-"])]:size-[var(--icon-inner-size-lg)]',
};

const radiusClasses: Record<IconButtonRadius, string> = {
  toolbar: 'rounded-[var(--radius-toolbar-action)]',
  panel: 'rounded-[var(--radius-panel-nav)]',
  pill: 'rounded-[var(--radius-pill)]',
};

const variantClasses: Record<IconButtonVariant, string> = {
  ghost:
    'bg-transparent hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  'primary-soft':
    'bg-primary-soft text-primary hover:bg-primary/15',
};

/**
 * IconButton — icon-only action button with Tooltip wrapping.
 *
 * Sourced from DESIGN.md §4 (ghost button), §5 (icon button dimensions),
 * §7 (120ms hover, focus ring), §9 (28px with 14px icons).
 *
 * Cross-feature consumers: Navbar (save/undo/redo/search), ListPane
 * (new/import/export/collapse), EditorShell (dock tools), ToolPanel.
 *
 * Behavioral contract:
 * - Always wraps Radix Tooltip (skips if tooltip === false).
 * - Focus ring: DESIGN.md §7 — inherited from shadcn Button pattern.
 * - Hover transition: 120ms ease (DESIGN.md §7).
 * - Loading swaps icon for Spinner, sets aria-busy, keeps tooltip.
 * - Icon sized by CSS class only; callers cannot set size inline.
 * - Named export only per STYLEGUIDE.md.
 *
 * Usage as a Radix Trigger: React 19 automatically forwards refs to
 * function components, so wrapping IconButton in
 *   <DropdownMenu.Trigger asChild><IconButton ... /></DropdownMenu.Trigger>
 * works without IconButton needing its own `asChild` prop. (A prior
 * `asChild` prop on IconButton was removed because Slot would forward
 * button props to the SVG icon rather than a real button element.)
 */
function IconButton({
  icon,
  'aria-label': ariaLabel,
  tooltip,
  tooltipSide = 'bottom',
  kbd,
  size = 'md',
  radius = 'toolbar',
  variant = 'ghost',
  loading = false,
  className,
  disabled,
  ...rest
}: IconButtonProps) {
  const button = (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center shrink-0 transition-all duration-[120ms] ease outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0',
        sizeClasses[size],
        radiusClasses[radius],
        variantClasses[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className={size === 'sm' ? 'size-3' : size === 'lg' ? 'size-4' : 'size-3.5'} /> : icon}
    </button>
  );

  if (tooltip === false) return button;

  const tooltipContent = tooltip ?? ariaLabel;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side={tooltipSide}>
        {kbd ? (
          <span className="inline-flex items-center gap-1.5">
            <span>{tooltipContent}</span>
            <KbdHint keys={kbd} />
          </span>
        ) : (
          tooltipContent
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export { IconButton };
export type { IconButtonProps, IconButtonSize, IconButtonRadius, IconButtonVariant };
