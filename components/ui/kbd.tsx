import { cn } from '@/lib/utils'

function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'pointer-events-none inline-flex w-fit items-center justify-center gap-1 select-none',
        'min-w-[var(--kbd-min-width)] min-h-[var(--kbd-min-height)] rounded-[var(--kbd-radius)]',
        'px-[var(--kbd-padding-x)] py-[var(--kbd-padding-y)]',
        'text-[length:var(--kbd-font-size)] leading-[var(--kbd-line-height)] tracking-[var(--kbd-letter-spacing)]',
        'font-[family-name:var(--kbd-font-family)] font-[number:var(--kbd-font-weight)]',
        'border-[length:var(--kbd-border-width)] border-solid border-[var(--kbd-border)]',
        'bg-[var(--kbd-bg)] text-[var(--kbd-fg)]',
        "[&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn('inline-flex items-center gap-[var(--kbd-hint-gap)]', className)}
      {...props}
    />
  )
}

export { Kbd, KbdGroup }
