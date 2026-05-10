import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Tag — classification / metadata label for non-interactive data.
 *
 * Used for platform names, version numbers, delivery modes, change
 * kinds, directory paths, feature flags, format labels, and similar
 * metadata that classifies or describes an item.
 *
 * Different from StatusBadge: Tags are informational labels, not
 * semantic status indicators. They don't represent system state
 * (saved/unsaved, connected/disconnected) — they classify data.
 *
 * Style is driven entirely by `--tag-*` component tokens declared in
 * app/globals.css. To redesign, override the tokens — never edit this
 * file. To add a theme variant ("brutalist", "minimal", etc.), add a
 * `[data-theme="..."]` block in globals.css.
 *
 * Composition: pass `asChild` to render as the immediate child element
 * (e.g. an `<a>`) while keeping all Tag styling — Radix Slot pattern.
 */
const tagVariants = cva(
  // Base — every variant inherits these.
  [
    'inline-flex items-center justify-center shrink-0',
    'rounded-[var(--tag-radius)]',
    'px-[var(--tag-padding-x)] py-[var(--tag-padding-y)]',
    'text-[length:var(--tag-font-size)]',
    'font-[number:var(--tag-font-weight)]',
    'tracking-[var(--tag-letter-spacing)]',
    'leading-tight whitespace-nowrap',
    'border',
    'transition-colors duration-[var(--duration-fast)]',
  ],
  {
    variants: {
      variant: {
        default:
          'bg-[var(--primary)] text-[color:var(--primary-foreground)] border-transparent',
        muted:
          'bg-[var(--tag-bg-muted)] text-[var(--tag-fg-muted)] border-[var(--tag-border-muted)]',
        success:
          'bg-[var(--tag-bg-success)] text-[var(--tag-fg-success)] border-[var(--tag-border-success)]',
        warning:
          'bg-[var(--tag-bg-warning)] text-[var(--tag-fg-warning)] border-[var(--tag-border-warning)]',
        danger:
          'bg-[var(--tag-bg-danger)] text-[var(--tag-fg-danger)] border-[var(--tag-border-danger)]',
        outline:
          'bg-[var(--tag-bg-outline)] text-[var(--tag-fg-outline)] border-[var(--tag-border-outline)]',
      },
      uppercase: {
        true: 'uppercase',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'outline',
      uppercase: false,
    },
  },
);

type TagVariant = NonNullable<VariantProps<typeof tagVariants>['variant']>;

interface TagProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>,
    VariantProps<typeof tagVariants> {
  children: React.ReactNode;
  /** Render as the immediate child (Radix Slot composition). */
  asChild?: boolean;
}

function Tag({
  children,
  variant,
  uppercase,
  asChild = false,
  className,
  ...rest
}: TagProps) {
  const Comp = asChild ? Slot : 'span';
  return (
    <Comp className={cn(tagVariants({ variant, uppercase }), className)} {...rest}>
      {children}
    </Comp>
  );
}

export { Tag, tagVariants };
export type { TagProps, TagVariant };
