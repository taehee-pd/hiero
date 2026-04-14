'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

import { Copy, Grid3X3, Heart, Pencil, Trash2 } from 'lucide-react';
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
  onRename,
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
  onRename?: (nextName: string) => void;
}) {
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(iconName);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (renaming) return;
      const isShift = e.shiftKey || e.metaKey;
      if (isShift) {
        if (clickTimerRef.current) {
          clearTimeout(clickTimerRef.current);
          clickTimerRef.current = null;
        }
        onShiftClick();
        return;
      }
      // Delay single-click to give onDoubleClick a chance to cancel it.
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        onSelect();
        onOpen();
      }, 200);
    },
    [onOpen, onSelect, onShiftClick, renaming],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (renaming) return;
      if (e.shiftKey || e.metaKey) return;
      if (!onRename) return;
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      setRenameDraft(iconName);
      setRenaming(true);
    },
    [iconName, onRename, renaming],
  );

  const commitRename = useCallback(() => {
    if (!renaming) return;
    const trimmed = renameDraft.trim();
    setRenaming(false);
    if (trimmed && trimmed !== iconName) {
      onRename?.(trimmed);
    }
  }, [renaming, renameDraft, iconName, onRename]);

  const cancelRename = useCallback(() => {
    setRenaming(false);
    setRenameDraft(iconName);
  }, [iconName]);

  useEffect(() => {
    const timerRef = clickTimerRef;
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <article
          role="listitem"
          tabIndex={0}
          data-icon-id={iconId}
          onKeyDown={(event) => {
            if (renaming) return;
            if (event.key === 'Enter') {
              event.preventDefault();
              onOpen();
              return;
            }
            if (event.key === 'F2' && onRename) {
              event.preventDefault();
              setRenameDraft(iconName);
              setRenaming(true);
            }
          }}
          className={cn(
            'group relative flex select-none flex-col items-center rounded-lg border p-2 transition-all duration-[160ms] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            // Two independent visual layers:
            //   active  → solid primary fill (the icon currently open in the editor)
            //   selected → outer charcoal ring (marked for batch action)
            // They can co-exist (filled card with a ring around it).
            active
              ? 'border-primary/70 bg-primary/15 shadow-[inset_0_0_0_1px_var(--primary)]'
              : 'border-transparent hover:border-border/70 hover:bg-accent/60 hover:shadow-[var(--shadow-outline)]',
            selected && 'ring-2 ring-foreground/70 ring-offset-1 ring-offset-background',
          )}
        >
          <div
            className="flex w-full cursor-pointer select-none flex-col items-center gap-2 rounded-md"
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
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
              {renaming ? (
                <input
                  autoFocus
                  type="text"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitRename();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  aria-label={`Rename ${iconName}`}
                  className="w-full rounded-sm border border-border/80 bg-background px-1 py-0.5 text-center text-[length:var(--text-caption)] font-medium text-foreground outline-none focus:border-ring"
                />
              ) : (
                <p
                  className={cn(
                    'truncate select-none text-[length:var(--text-caption)]',
                    active ? 'font-semibold text-primary' : 'font-medium text-foreground',
                  )}
                >
                  {iconName}
                </p>
              )}
            </div>
          </div>
        </article>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onToggleFavorite}>
          <Heart className="size-4" />
          {favorite ? 'Unfavorite' : 'Favorite'}
        </ContextMenuItem>
        {onRename ? (
          <ContextMenuItem
            onSelect={() => {
              setRenameDraft(iconName);
              setRenaming(true);
            }}
          >
            <Pencil className="size-4" />
            Rename
          </ContextMenuItem>
        ) : null}
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
