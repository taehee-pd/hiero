'use client';

import type { MouseEventHandler } from 'react';

import { Check, Copy, Grid3X3, Heart, Pencil, Trash2 } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

import { cn } from '@/lib/utils';

export function IconGridItem({
  iconId,
  iconName,
  svg,
  active,
  favorite,
  onOpen,
  onToggleFavorite,
  onToggleSelection,
  onDuplicate,
  onDelete,
}: {
  iconId: string;
  iconName: string;
  svg: string;
  active: boolean;
  favorite: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onToggleSelection: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <article
          role="listitem"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            onOpen();
          }}
          className={cn(
            'group relative flex flex-col items-center rounded-xl border p-2 transition-all duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
            active
              ? 'border-primary/30 bg-primary-soft shadow-[inset_0_0_0_0.5px_var(--primary),_0_1px_3px_rgba(0,0,0,0.06)]'
              : 'border-transparent hover:border-border/70 hover:bg-accent/60 hover:shadow-[var(--shadow-outline)]',
          )}
        >
          <div className="absolute right-1.5 top-1.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              onClick={onToggleFavorite}
              aria-label={favorite ? `Unfavorite ${iconName}` : `Favorite ${iconName}`}
              className={cn(
                'flex size-5 items-center justify-center rounded-md transition',
                favorite
                  ? 'bg-rose-500/10 text-rose-500'
                  : 'bg-background/80 text-muted-foreground hover:text-foreground',
              )}
            >
              <Heart className={cn('size-3', favorite && 'fill-current')} />
            </button>
            <button
              type="button"
              onClick={onToggleSelection}
              aria-pressed={active}
              aria-label={active ? `Deselect ${iconName}` : `Select ${iconName}`}
              className={cn(
                'flex size-5 items-center justify-center rounded-md transition',
                active
                  ? 'bg-primary/15 text-primary'
                  : 'bg-background/80 text-muted-foreground hover:text-foreground',
              )}
            >
              <Check className="size-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={onOpen}
            className="flex w-full flex-col items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            aria-label={`Open ${iconName}`}
          >
            <div className="flex aspect-square w-full items-center justify-center rounded-md">
              {svg ? (
                <div
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center text-foreground transition-transform duration-100 group-hover:scale-[1.04]"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              ) : (
                <Grid3X3 className="size-4 text-muted-foreground/40" />
              )}
            </div>
            <div className="w-full text-center">
              <p className="truncate text-[length:var(--text-caption)] text-foreground" style={{ fontWeight: 'var(--type-weight-medium)', letterSpacing: '0.01em' }}>
                {iconName}
              </p>
            </div>
          </button>
        </article>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onToggleFavorite}>
          <Heart className="size-4" />
          {favorite ? 'Unfavorite' : 'Favorite'}
        </ContextMenuItem>
        {onDuplicate ? (
          <ContextMenuItem onSelect={onDuplicate}>
            <Copy className="size-4" />
            Duplicate
          </ContextMenuItem>
        ) : null}
        <ContextMenuSeparator />
        {onDelete ? (
          <ContextMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="size-4" />
            Delete
          </ContextMenuItem>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}
