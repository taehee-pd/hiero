import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * StatusBadge — pill-shaped semantic status indicator.
 *
 * Different from Tag: StatusBadge represents *system state*
 * (saved/unsaved/connected/error) — Tag classifies data. Pick by
 * intent, not by visual.
 *
 * Style is driven entirely by `--badge-*` component tokens declared in
 * app/globals.css. To redesign, override the tokens.
 */
const statusBadgeVariants = cva(
  [
    'inline-flex items-center shrink-0 whitespace-nowrap',
    'rounded-[var(--badge-radius)]',
    'px-[var(--badge-padding-x)] py-[var(--badge-padding-y)]',
    'gap-[var(--badge-gap)]',
    'text-[length:var(--badge-font-size)]',
    'font-[number:var(--badge-font-weight)]',
    'tracking-tight leading-none',
    'border border-transparent',
    'transition-colors duration-[var(--duration-fast)]',
  ],
  {
    variants: {
      variant: {
        neutral:
          'bg-[var(--badge-bg-neutral)] text-[var(--badge-fg-neutral)]',
        saved:
          'bg-[var(--badge-bg-saved)] text-[var(--badge-fg-saved)]',
        unsaved:
          'bg-[var(--badge-bg-unsaved)] text-[var(--badge-fg-unsaved)]',
        connected:
          'bg-[var(--badge-bg-connected)] text-[var(--badge-fg-connected)]',
        error:
          'bg-[var(--badge-bg-error)] text-[var(--badge-fg-error)]',
        // Legacy aliases — kept for backwards compat with current call
        // sites. Map onto semantic tokens above. Drop in a future
        // sweep once all sites use intent-named variants.
        success:
          'bg-[var(--badge-bg-saved)] text-[var(--badge-fg-saved)]',
        warning:
          'bg-[var(--badge-bg-unsaved)] text-[var(--badge-fg-unsaved)]',
        danger:
          'bg-[var(--badge-bg-error)] text-[var(--badge-fg-error)]',
        info:
          'bg-[var(--badge-bg-connected)] text-[var(--badge-fg-connected)]',
        accent:
          'bg-[var(--primary)] text-[var(--primary-foreground)]',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

type StatusBadgeVariant = NonNullable<
  VariantProps<typeof statusBadgeVariants>['variant']
>;

interface StatusBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>,
    VariantProps<typeof statusBadgeVariants> {
  children: React.ReactNode;
  asChild?: boolean;
}

function StatusBadge({
  children,
  variant,
  asChild = false,
  className,
  ...rest
}: StatusBadgeProps) {
  const Comp = asChild ? Slot : 'span';
  return (
    <Comp className={cn(statusBadgeVariants({ variant }), className)} {...rest}>
      {children}
    </Comp>
  );
}

export { StatusBadge, statusBadgeVariants };
export type { StatusBadgeProps, StatusBadgeVariant };
