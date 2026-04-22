'use client';

import { Icon as UiIcon } from '@hiero/ui-icons';
import { useCallback, useRef } from 'react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useInlineRename } from '@/lib/editor-hooks';

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
  // Memoize onCommit so LayerPanel-style dep-chain churn doesn't apply
  // here either. Hook internally reads via ref, but stable identity
  // keeps the `commitRename`/`cancelRename` useCallback deps clean.
  const handleRenameCommit = useCallback(
    (next: string) => onRename?.(next),
    [onRename],
  );
  const {
    isRenaming: renaming,
    draft: renameDraft,
    setDraft: setRenameDraft,
    start: startRename,
    commit: commitRenameHook,
    cancel: cancelRenameHook,
  } = useInlineRename({ onCommit: handleRenameCommit });

  // Open the icon on pointerup (not click) because Radix's ContextMenuTrigger
  // asChild attaches pointerdown handlers on the <article> that can swallow
  // synthesized click events in some environments. pointerup is dispatched
  // independently and always fires on mouse release. We track the pointer
  // from down→up so drag/slide gestures don't accidentally open an icon.
  const pointerStartRef = useRef<{ x: number; y: number; id: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return; // only primary button
    pointerStartRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (renaming) return;
      const start = pointerStartRef.current;
      pointerStartRef.current = null;
      if (!start || start.id !== e.pointerId) return;
      // Ignore when the pointer moved meaningfully — treat as drag/scroll.
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (dx * dx + dy * dy > 16) return; // 4px slop
      const isShift = e.shiftKey || e.metaKey;
      if (isShift) {
        onShiftClick();
        return;
      }
      onSelect();
      onOpen();
    },
    [onOpen, onSelect, onShiftClick, renaming],
  );

  const commitRename = useCallback(() => {
    commitRenameHook(iconName);
  }, [commitRenameHook, iconName]);

  const cancelRename = useCallback(() => {
    cancelRenameHook();
  }, [cancelRenameHook]);

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
              startRename(iconName);
            }
          }}
          className={cn(
            'group relative flex select-none flex-col items-center rounded-lg border transition-all duration-[160ms] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            // Two visual states (selected wins when both are true):
            //   selected → solid primary fill, white label + glyph
            //              (marked for batch action; cannot be missed)
            //   active   → primary tint fill, primary label
            //              (the icon currently open in the editor)
            selected
              ? 'border-primary bg-primary text-primary-foreground shadow-[0_2px_8px_color-mix(in_srgb,var(--primary)_28%,transparent)]'
              : active
                ? 'border-primary/70 bg-primary/15 shadow-[inset_0_0_0_1px_var(--primary)]'
                : 'border-transparent hover:border-border/70 hover:bg-accent/60 hover:shadow-[var(--shadow-outline)]',
          )}
        >
          {/*
            Click target fills the entire card including the card's padding
            so there are no dead zones near the border. `onClick` lives here
            (not on the <article>) because Radix's ContextMenuTrigger asChild
            attaches pointer handlers to the article that can swallow clicks
            from certain pointer input sources; the inner div is unaffected.
          */}
          <div
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            className="flex w-full cursor-pointer select-none flex-col items-center gap-2 rounded-md p-2"
          >
            <div className="flex aspect-square w-full items-center justify-center rounded-md">
              {svg ? (
                <div
                  aria-hidden="true"
                  className={cn(
                    'flex size-10 items-center justify-center transition-transform duration-100 group-hover:scale-[1.04]',
                    selected ? 'text-primary-foreground' : 'text-foreground',
                  )}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              ) : (
                <UiIcon name="grid-3x3" size={16} className="size-4 text-muted-foreground/40" />
              )}
            </div>
            <div className="w-full text-center">
              {/*
                Label and input share the same box: identical height,
                padding, border width (transparent on the label), and
                font metrics. The only visual delta between the two
                states is the border color — which means zero text jump
                on double-click, on blur, or on cancel.
              */}
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
                  className="block w-full box-border rounded-sm border border-border/80 bg-background px-1 py-0.5 text-center text-[length:var(--text-caption)] font-medium text-foreground outline-none focus:border-ring"
                />
              ) : (
                <p
                  onDoubleClick={(e) => {
                    if (!onRename) return;
                    // Double-click on the label (not the whole card) enters
                    // rename mode. The card's single-click already fired and
                    // opened the icon, which is fine — rename takes over
                    // visually with the inline input.
                    e.stopPropagation();
                    startRename(iconName);
                  }}
                  className={cn(
                    'block w-full box-border truncate select-none rounded-sm border border-transparent px-1 py-0.5 text-center text-[length:var(--text-caption)]',
                    selected
                      ? 'font-semibold text-primary-foreground'
                      : active
                        ? 'font-semibold text-primary'
                        : 'font-medium text-foreground',
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
        {/*
          Non-modifier toggle path for multi-select. The floating checkbox
          was removed per design review, but `onShiftClick` still needs a
          reachable entry point for touch devices (which have no Shift/Cmd
          keyboard modifier) — native long-press opens this context menu,
          so a Select / Deselect item here is the accessible fallback.
        */}
        <ContextMenuItem onSelect={onShiftClick}>
          {selected ? <UiIcon name="check-square" size={16} className="size-4" /> : <UiIcon name="square" size={16} className="size-4" />}
          {selected ? 'Deselect' : 'Select'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={onToggleFavorite}>
          <UiIcon name="heart" size={16} className="size-4" />
          {favorite ? 'Unfavorite' : 'Favorite'}
        </ContextMenuItem>
        {onRename ? (
          <ContextMenuItem
            onSelect={() => startRename(iconName)}
          >
            <UiIcon name="pencil" size={16} className="size-4" />
            Rename
          </ContextMenuItem>
        ) : null}
        {onDuplicate ? (
          <ContextMenuItem onSelect={onDuplicate}>
            <UiIcon name="copy" size={16} className="size-4" />
            Duplicate
          </ContextMenuItem>
        ) : null}
        <ContextMenuSeparator />
        {onDelete ? (
          <ContextMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
            <UiIcon name="trash-2" size={16} className="size-4" />
            Delete
          </ContextMenuItem>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}
