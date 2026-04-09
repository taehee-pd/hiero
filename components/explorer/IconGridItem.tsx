'use client';

import { useRef, useCallback } from 'react';

import { Check, Copy, Grid3X3, Heart, Trash2 } from 'lucide-react';
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
  selected,
  favorite,
  onOpen,
  onSelect,
  onShiftClick,
  onToggleFavorite,
  onDuplicate,
  onDelete,
}: {
  iconId: string;
  iconName: string;
  svg: string;
  /** Whether this icon is currently opened in the editor */
  active: boolean;
  /** Whether this icon is in the multi-select set */
  selected: boolean;
  favorite: boolean;
  onOpen: () => void;
  onSelect: () => void;
  onShiftClick: () => void;
  onToggleFavorite: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const clickState = useRef<{ timer: ReturnType<typeof setTimeout> | null; count: number }>({ timer: null, count: 0 });

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const state = clickState.current;
      state.count += 1;

      if (state.count === 2) {
        // Double click — open in editor
        if (state.timer) clearTimeout(state.timer);
        state.timer = null;
        state.count = 0;
        onOpen();
        return;
      }

      const isShift = e.shiftKey || e.metaKey;
      state.timer = setTimeout(() => {
        state.count = 0;
        state.timer = null;
        if (isShift) {
          onShiftClick();
        } else {
          onSelect();
        }
      }, 300);
    },
    [onOpen, onSelect, onShiftClick],
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <article
          role="listitem"
          tabIndex={0}
          data-icon-id={iconId}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            onOpen();
          }}
          className={cn(
            'group relative flex flex-col items-center rounded-lg border p-2 transition-all duration-[160ms] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            selected
              ? 'border-transparent bg-primary-soft shadow-[0_0_0_2px_var(--primary)]'
              : active
                ? 'border-transparent bg-muted/50'
                : 'border-transparent hover:border-border/70 hover:bg-accent/60 hover:shadow-[var(--shadow-outline)]',
          )}
        >
          {/* Selection checkbox */}
          <div
            className={cn(
              'absolute right-1.5 top-1.5 flex gap-0.5 transition-opacity',
              selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
            )}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShiftClick();
              }}
              aria-pressed={selected}
              aria-label={selected ? `Deselect ${iconName}` : `Select ${iconName}`}
              className={cn(
                'flex size-5 items-center justify-center rounded-md transition',
                selected
                  ? 'bg-primary/15 text-primary'
                  : 'bg-background/80 text-muted-foreground hover:text-foreground',
              )}
            >
              <Check className="size-3" />
            </button>
          </div>

          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div
            className="flex w-full flex-col items-center gap-2 rounded-md cursor-pointer"
            onClick={handleClick}
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
              <p className="truncate font-medium text-[length:var(--text-caption)] text-foreground">
                {iconName}
              </p>
            </div>
          </div>
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
