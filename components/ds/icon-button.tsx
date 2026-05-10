import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { KbdHint } from '@/components/ds/kbd-hint';

/**
 * IconButton — icon-only action button with Tooltip wrapping.
 *
 * Style is driven by `--btn-icon-*` component tokens declared in
 * app/globals.css. To redesign (e.g., a brutalist theme with sharp
 * corners and inverted hover), override the tokens — never edit this
 * file.
 *
 * The component intentionally has only one visual axis (`size`). The
 * earlier `variant` and `radius` axes were removed because no caller
 * exercised them — every IconButton in the app used the defaults.
 * If a new visual variant is genuinely needed in the future, add it
 * here as a CVA variant rather than reviving dead axes.
 *
 * Usage as a Radix Trigger: React 19 forwards refs to function
 * components automatically, so wrapping IconButton in
 *   <DropdownMenu.Trigger asChild><IconButton ... /></DropdownMenu.Trigger>
 * works without IconButton needing its own `asChild` prop.
 */
const iconButtonVariants = cva(
  [
    'inline-flex items-center justify-center shrink-0 outline-none',
    'transition-[var(--btn-icon-transition)]',
    'rounded-[var(--btn-icon-radius-toolbar)]',
    'bg-[var(--btn-icon-bg-ghost)] text-[color:var(--btn-icon-fg-default)]',
    'hover:bg-[var(--btn-icon-bg-ghost-hover)] hover:text-[color:var(--btn-icon-fg-ghost-hover)]',
    'disabled:pointer-events-none disabled:opacity-50',
    'focus-visible:border-[color:var(--btn-icon-focus-ring)] focus-visible:ring-[color:var(--btn-icon-focus-ring)]/50 focus-visible:ring-[3px]',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
    '[&_[data-hiero-ui-icon]]:pointer-events-none [&_[data-hiero-ui-icon]]:shrink-0',
    '[&_[data-hiero-runtime-icon]]:pointer-events-none [&_[data-hiero-runtime-icon]]:shrink-0',
  ],
  {
    variants: {
      size: {
        sm: 'h-[var(--button-icon-size-sm)] w-[var(--button-icon-size-sm)] [--hiero-control-icon-size:var(--icon-inner-size-sm)] [&_svg:not([class*="size-"])]:size-[var(--icon-inner-size-sm)]',
        md: 'h-[var(--button-icon-size-md)] w-[var(--button-icon-size-md)] [--hiero-control-icon-size:var(--icon-inner-size-md)] [&_svg:not([class*="size-"])]:size-[var(--icon-inner-size-md)]',
        lg: 'h-[var(--button-icon-size-lg)] w-[var(--button-icon-size-lg)] [--hiero-control-icon-size:var(--icon-inner-size-lg)] [&_svg:not([class*="size-"])]:size-[var(--icon-inner-size-lg)]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

type IconButtonVariantsProps = VariantProps<typeof iconButtonVariants>;
type IconButtonSize = NonNullable<IconButtonVariantsProps['size']>;

interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    IconButtonVariantsProps {
  /** Icon element; size is controlled by this component, not the caller. */
  icon: React.ReactElement;
  /** Required for a11y — never inferred from an icon name. */
  'aria-label': string;
  /** Shown in Tooltip. Set to `false` to suppress. Defaults to aria-label. */
  tooltip?: React.ReactNode | false;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  /** Optional keyboard shortcut hint rendered in Tooltip (platform-aware). */
  kbd?: string[];
  /** Replaces icon with Spinner; sets aria-busy; keeps tooltip text. */
  loading?: boolean;
}

function IconButton({
  icon,
  'aria-label': ariaLabel,
  tooltip,
  tooltipSide = 'bottom',
  kbd,
  size,
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
      className={cn(iconButtonVariants({ size }), className)}
      {...rest}
    >
      {loading ? (
        <Spinner
          className={size === 'sm' ? 'size-3' : size === 'lg' ? 'size-4' : 'size-3.5'}
        />
      ) : (
        icon
      )}
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

export { IconButton, iconButtonVariants };
export type { IconButtonProps, IconButtonSize };
