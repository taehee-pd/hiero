'use client';

import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Link2, Pencil, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/kibo-ui/scroll-area';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Button } from '@/components/kibo-ui/button';
import { Input } from '@/components/kibo-ui/input';
import {
  useSelection,
  useEditorStore,
  useEditorActions,
} from '@/lib/editor-store/hooks';
import { selectCurrentLayerPanelRows } from '@/lib/editor-store/selectors';
import { selectCurrentVariant } from '@/lib/editor-store/selectors';
import { computeVariableValue } from '@/lib/runtime-core/variable-value';
import { cn } from '@/lib/utils';

export const LayerPanel = memo(function LayerPanel() {
  const rows = useEditorStore(selectCurrentLayerPanelRows);
  const selection = useSelection();
  const _renderingMode = useEditorStore((s) => s.renderingMode);
  const currentIconId = useEditorStore((s) => s.currentIconId);
  const componentByLayerId = useEditorStore((s) => {
    if (!s.currentIconId) return new Map<string, 'badge' | 'slash' | 'enclosure'>();
    const icon = s.project?.icons[s.currentIconId];
    const map = new Map<string, 'badge' | 'slash' | 'enclosure'>();
    for (const component of Object.values(icon?.components ?? {})) {
      for (const layerId of component.layerIds) {
        map.set(layerId, component.kind);
      }
    }
    return map;
  });
  const _currentStateId = useEditorStore((s) => s.currentStateId);
  const currentVariant = useEditorStore(selectCurrentVariant);
  const { setSelection, setLayerVisibility, renameLayer, removeSelectedLayers } = useEditorActions();

  // J7: Compute per-layer visibility based on variableValue
  const variableValueResults = useMemo(() => {
    if (currentVariant?.variableValue == null || rows.length === 0) return null;
    const layerMap: Record<string, { role?: string; visible?: boolean }> = {};
    for (const { layer } of rows) {
      layerMap[layer.id] = { role: layer.role, visible: layer.visible };
    }
    return computeVariableValue(layerMap, currentVariant.variableValue);
  }, [currentVariant?.variableValue, rows]);

  // UX-F4: Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // UX-F4: Handle keyboard navigation on the layer list container
  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (renamingLayerId) return; // Don't navigate while renaming
      if (rows.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIdx = Math.min(focusedIndex + 1, rows.length - 1);
        setFocusedIndex(nextIdx);
        setSelection({ layerIds: [rows[nextIdx]!.layer.id], pointIds: [] });
        itemRefs.current.get(nextIdx)?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const nextIdx = Math.max(focusedIndex - 1, 0);
        setFocusedIndex(nextIdx);
        setSelection({ layerIds: [rows[nextIdx]!.layer.id], pointIds: [] });
        itemRefs.current.get(nextIdx)?.focus();
      } else if (e.key === 'F2' && focusedIndex >= 0 && focusedIndex < rows.length) {
        e.preventDefault();
        const layer = rows[focusedIndex]!.layer;
        setRenamingLayerId(layer.id);
        setRenameValue(layer.id);
      } else if (e.key === 'Delete' && focusedIndex >= 0) {
        e.preventDefault();
        removeSelectedLayers();
      }
    },
    [focusedIndex, renamingLayerId, removeSelectedLayers, rows, setSelection],
  );

  const commitRename = useCallback(
    (layerId: string) => {
      const trimmed = renameValue.trim();
      if (trimmed && trimmed !== layerId && currentIconId) {
        renameLayer(currentIconId, layerId, trimmed);
      }
      setRenamingLayerId(null);
    },
    [currentIconId, renameLayer, renameValue],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="workspace-panel-header sticky top-0 z-10 flex items-center justify-between bg-background px-3 py-2">
        <div>
          <p className="workspace-kicker text-[length:var(--text-label)]">Structure</p>
          <p className="mt-1 text-[length:var(--text-heading)] font-semibold text-foreground">Layers</p>
        </div>
        <span className="workspace-badge">{rows.length}</span>
      </div>
      <ScrollArea className="flex-1">
        {/* UX-F4: Keyboard navigable layer list */}
        <div
          ref={listRef}
          className="flex flex-col gap-2 p-3"
          role="listbox"
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          aria-label="Layer list"
        >
          {/* UX-F7: Visual onboarding empty state with illustrated shortcuts */}
          {rows.length === 0 ? (
            <div className="workspace-empty-state rounded-lg px-4 py-8 text-center text-xs text-muted-foreground">
              {/* Illustrated icon hint */}
              <div className="mx-auto mb-3 flex items-center justify-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-primary/40 bg-primary/5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                    <path d="M12 19l7-7 3 3-7 7-3-3z" />
                    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                    <path d="M2 2l7.586 7.586" />
                    <circle cx="11" cy="11" r="2" />
                  </svg>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  </svg>
                </div>
              </div>
              <p className="font-semibold text-foreground">No layers yet</p>
              <p className="mt-1.5 text-muted-foreground">
                Get started by drawing or importing:
              </p>
              <div className="mt-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-center gap-2 text-[11px]">
                  <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium">P</kbd>
                  <span>Pen tool</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-[11px]">
                  <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium">U</kbd>
                  <span>Shape tool</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground/70">
                  or drag an SVG file onto the canvas
                </div>
              </div>
            </div>
          ) : null}
          {rows.map(({ layer, depth, maskLayerId, clippedLayerIds }, rowIndex) => {
            const isSelected = selection.layerIds.includes(layer.id);
            const isVisible = layer.visible !== false;
            const isMask = layer.isClipMask === true;
            const componentKind = componentByLayerId.get(layer.id);
            const isFocused = focusedIndex === rowIndex;
            const isRenaming = renamingLayerId === layer.id;
            // J7: Per-layer variable-value visibility
            const varResult = variableValueResults?.[layer.id];
            const isVarActive = varResult ? varResult.visible : true;
            const hasVariableValue = variableValueResults != null;

            return (
              <ContextMenu key={layer.id}>
                <ContextMenuTrigger asChild>
              <div
                ref={(el) => {
                  if (el) itemRefs.current.set(rowIndex, el);
                  else itemRefs.current.delete(rowIndex);
                }}
                className={cn(
                  'group relative flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-[length:var(--text-body)] transition',
                  isSelected
                    ? 'border-primary/40 bg-primary-soft shadow-[inset_0_0_0_0.5px_var(--primary),_0_1px_3px_rgba(0,0,0,0.06)]'
                    : 'border-border/70 bg-background/80 hover:border-foreground/12 hover:bg-background hover:shadow-[var(--shadow-outline)]',
                  isFocused && !isSelected && 'ring-1 ring-primary/30',
                  // J7: Dim layers that are inactive at the current variableValue
                  hasVariableValue && !isVarActive && 'opacity-50',
                )}
                onClick={() => {
                  setFocusedIndex(rowIndex);
                  setSelection({ layerIds: [layer.id], pointIds: [] });
                }}
                onDoubleClick={() => {
                  // UX-F4: Double-click to rename
                  setRenamingLayerId(layer.id);
                  setRenameValue(layer.id);
                }}
                onContextMenu={() => {
                  setFocusedIndex(rowIndex);
                  setSelection({ layerIds: [layer.id], pointIds: [] });
                }}
                role="option"
                tabIndex={-1}
                aria-selected={isSelected}
                style={{ marginLeft: depth === 0 ? 0 : 16 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelection({ layerIds: [layer.id], pointIds: [] });
                  }
                }}
              >
                <span
                  className={cn(
                    'absolute inset-y-2 left-1 w-1 rounded-full transition',
                    isSelected ? 'bg-primary' : 'bg-transparent',
                  )}
                />
                <div
                  className={cn(
                    'ml-2 flex size-5 shrink-0 items-center justify-center rounded-sm border text-foreground transition',
                    isSelected
                      ? 'border-primary/40 bg-background/80'
                      : 'border-border/60 bg-background/60',
                    !isVisible && 'opacity-50',
                  )}
                  aria-hidden
                >
                  {layer.path?.d ? (
                    <svg
                      viewBox={currentVariant?.viewBox.join(' ') ?? '0 0 24 24'}
                      className="size-full"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d={layer.path.d}
                        fill={layer.style.fill ? 'currentColor' : 'none'}
                        stroke={
                          layer.style.stroke || !layer.style.fill ? 'currentColor' : 'none'
                        }
                        strokeWidth={layer.style.strokeWidth ?? 1.5}
                        strokeLinecap={layer.style.lineCap ?? 'round'}
                        strokeLinejoin={layer.style.lineJoin ?? 'round'}
                        fillRule={layer.path.fillRule}
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  ) : (
                    <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                  )}
                </div>
                <div className={cn('min-w-0 flex-1', !isVisible && 'opacity-50')}>
                  <div className="flex items-center gap-2">
                    {maskLayerId ? (
                      <Link2 className="size-3 shrink-0 text-muted-foreground" />
                    ) : null}
                    {/* UX-F4: Inline rename when F2 is pressed or double-clicked */}
                    {isRenaming ? (
                      <Input
                        type="text"
                        className="h-5 w-full text-[13px] font-medium"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitRename(layer.id);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setRenamingLayerId(null);
                          }
                          e.stopPropagation();
                        }}
                        onBlur={() => commitRename(layer.id)}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <p className="truncate text-[length:var(--text-body)] font-medium text-foreground">{layer.id}</p>
                    )}
                    {/* J7: Variable-value activity indicator */}
                    {hasVariableValue ? (
                      <span
                        className={cn(
                          'size-1.5 shrink-0 rounded-full',
                          isVarActive ? 'bg-primary' : 'bg-muted-foreground/30',
                        )}
                        title={isVarActive ? 'Active at current variable value' : 'Inactive at current variable value'}
                      />
                    ) : null}
                    {isMask ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        Mask
                      </span>
                    ) : null}
                    {componentKind ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {componentKind}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[length:var(--text-label)] text-muted-foreground">
                    {maskLayerId
                      ? `clipped by ${maskLayerId}`
                      : clippedLayerIds.length > 0
                        ? `${clippedLayerIds.length} clipped`
                        : 'layer'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="workspace-tool-button h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (currentIconId) {
                      setLayerVisibility(currentIconId, layer.id, !isVisible);
                    }
                  }}
                  aria-label={isVisible ? 'Hide layer' : 'Show layer'}
                >
                  {isVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </Button>
              </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onSelect={() => {
                    setRenamingLayerId(layer.id);
                    setRenameValue(layer.id);
                  }}>
                    <Pencil className="size-4" />
                    Rename
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => {
                    if (currentIconId) {
                      setLayerVisibility(currentIconId, layer.id, !isVisible);
                    }
                  }}>
                    {isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    {isVisible ? 'Hide' : 'Show'}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onSelect={() => removeSelectedLayers()}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
});
