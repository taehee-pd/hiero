import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

// Universal input behavior — focus ring, file: input, disabled, transitions —
// shared by every variant. Visual chrome (border, height, padding, bg) lives
// inside the variant so we can swap chrome without `!important` fights.
const inputVariants = cva(
  [
    'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
    'w-full min-w-0 outline-none transition-[color,box-shadow]',
    'focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
    'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        // Original shadcn input chrome: bordered, h-9, px-3 py-1, default text size.
        default:
          'border-input dark:bg-input/30 h-9 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs focus-visible:border-ring md:text-sm',
        // Pane variant — composes the wire-input class so all visual chrome
        // (height, padding, bg, border, focus state) is owned by globals.css.
        // Use this for any input embedded in an editor pane so it lands on
        // the shared pane column (DESIGN.md §6 "Pane gutter & edge alignment").
        pane: 'wire-input',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type InputProps = React.ComponentProps<'input'> &
  VariantProps<typeof inputVariants>

function Input({ className, type, variant, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Input, inputVariants }
export type { InputProps }
