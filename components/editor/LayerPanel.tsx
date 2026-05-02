'use client';

import { Icon as UiIcon } from '@hiero/ui-icons';
import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import {
  useSelection,
  useEditorStore,
  useEditorActions,
} from '@/lib/editor-store/hooks';
import { selectCurrentLayerPanelRows } from '@/lib/editor-store/selectors';
import { selectCurrentVariant } from '@/lib/editor-store/selectors';
import { useInlineRename, useMarqueeSelection } from '@/lib/editor-hooks';
import { computeVariableValue } from '@/lib/runtime-core/variable-value';
import { rootOpGlyph } from '@/lib/schema/compound';
import type { PaintRef } from '@/lib/schema/types';
import { cn } from '@/lib/utils';

// Marquee hit-testing helpers moved to lib/editor-hooks/use-marquee-selection.ts
// during Phase 4 Commit 3. Local Rect / MarqueeDrag / rectsIntersect
// types deleted — the hook owns the geometry and the drag state.

// A paint is "visible" only if it is defined and not explicitly `none`.
// The schema represents transparent fills as { mode: 'fixed', value: 'none' },
// and the runtime treats undefined paints as `none` too. Both cases should
// render as empty in the layer thumbnail so it matches what the canvas shows.
function isPaintVisible(paint: PaintRef | undefined): boolean {
  if (!paint) return false;
  if (paint.mode === 'fixed' && paint.value === 'none') return false;
  return true;
}

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
  const _currentStateId = useEditorStore((s) => s.currentTypeId);
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
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Rename state machine — draft + commit lifecycle managed by the
  // shared hook. The multi-row routing (which layer is being edited)
  // stays in `renamingLayerId` above because LayerPanel renders many
  // rows at once, and the hook is single-instance. Phase 4 Commit 3.
  //
  // `onCommit` is memoized so its identity is stable across renders.
  // Without this wrapper, every keystroke in the rename input would
  // create a new function, which would churn the hook's returned
  // callbacks and invalidate every useCallback below that depends on
  // them (see codex review finding + gstack maintainability / perf
  // specialists agreeing). The hook itself reads onCommit via a ref
  // so unmemoized callers are safe but memoizing here keeps the
  // dep-chain clean for LayerPanel's own callbacks.
  const handleRenameCommit = useCallback(
    (next: string) => {
      if (renamingLayerId && currentIconId) {
        renameLayer(currentIconId, renamingLayerId, next);
      }
    },
    [renamingLayerId, currentIconId, renameLayer],
  );
  const {
    isRenaming: _renameIsActive,
    draft: renameDraft,
    setDraft: setRenameDraft,
    start: startRenameHook,
    commit: commitRenameHook,
    cancel: cancelRenameHook,
  } = useInlineRename({ onCommit: handleRenameCommit });
  // Keep the original variable name used in JSX props without
  // recreating an object literal — the destructured callbacks above
  // are each individually stable (useCallback([]) inside the hook),
  // so the dep chains below are now stable even across renders.
  const startRenameLayer = useCallback(
    (layerId: string) => {
      setRenamingLayerId(layerId);
      startRenameHook(layerId);
    },
    [startRenameHook],
  );

  // Marquee drag-to-multi-select — Phase 4 Commit 3 hook extraction.
  // getCurrentSelection reads via a ref mirror so the callback itself
  // is stable across renders. setSelection is wrapped in useCallback
  // so the adapter identity stays fixed even as selection updates.
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const getCurrentLayerSelection = useCallback(
    () => [...selectionRef.current.layerIds],
    [],
  );
  const setMarqueeLayerSelection = useCallback(
    (ids: string[]) => {
      setSelection({ layerIds: ids, pointIds: [] });
    },
    [setSelection],
  );
  const marquee = useMarqueeSelection({
    itemSelector: '[data-layer-id]',
    itemIdAttribute: 'data-layer-id',
    getCurrentSelection: getCurrentLayerSelection,
    setSelection: setMarqueeLayerSelection,
    containerRef: listRef,
  });
  const marqueeRect = marquee.rect;

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
        startRenameLayer(layer.id);
      } else if (e.key === 'Delete' && focusedIndex >= 0) {
        e.preventDefault();
        removeSelectedLayers();
      }
    },
    [focusedIndex, renamingLayerId, removeSelectedLayers, rows, setSelection, startRenameLayer],
  );

  const commitRename = useCallback(
    (layerId: string) => {
      commitRenameHook(layerId);
      setRenamingLayerId(null);
    },
    [commitRenameHook],
  );

  // Marquee handlers come straight from the hook — Phase 4 Commit 3.
  const handleListPointerDown = marquee.onPointerDown;
  const handleListPointerMove = marquee.onPointerMove;
  const handleListPointerUp = marquee.onPointerUp;
  const handleListPointerCancel = marquee.onPointerCancel;
  const handleListLostPointerCapture = marquee.onLostPointerCapture;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="workspace-panel-header sticky top-0 z-10 flex items-center justify-between bg-background px-3 py-2">
        <div>
          <p className="workspace-kicker text-[length:var(--text-label)]">Structure</p>
          <p className="mt-1 text-[length:var(--text-heading)] font-semibold text-foreground">Layers</p>
        </div>
        <span className="workspace-badge">{rows.length}</span>
      </div>
      <ScrollArea
        className="flex-1"
        onPointerDown={handleListPointerDown}
        onPointerMove={handleListPointerMove}
        onPointerUp={handleListPointerUp}
        onPointerCancel={handleListPointerCancel}
        onLostPointerCapture={handleListLostPointerCapture}
      >
        {/* UX-F4: Keyboard navigable layer list */}
        <div
          ref={listRef}
          className="flex select-none flex-col gap-2 p-3"
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
                data-layer-id={layer.id}
                className={cn(
                  'group relative flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-[length:var(--text-body)] transition',
                  isSelected
                    ? 'border-primary/40 bg-primary-soft shadow-[inset_0_0_0_0.5px_var(--primary),_0_1px_3px_rgba(0,0,0,0.06)]'
                    : 'border-border/70 bg-background/80 hover:border-foreground/12 hover:bg-background hover:shadow-[var(--shadow-outline)]',
                  isFocused && !isSelected && 'ring-1 ring-primary/30',
                  // J7: Dim layers that are inactive at the current variableValue
                  hasVariableValue && !isVarActive && 'opacity-50',
                )}
                onClick={(e) => {
                  setFocusedIndex(rowIndex);
                  if (e.shiftKey || e.metaKey) {
                    // Toggle this layer in the current selection
                    const next = selection.layerIds.includes(layer.id)
                      ? selection.layerIds.filter((id) => id !== layer.id)
                      : [...selection.layerIds, layer.id];
                    setSelection({ layerIds: next, pointIds: [] });
                  } else {
                    setSelection({ layerIds: [layer.id], pointIds: [] });
                  }
                }}
                onDoubleClick={() => {
                  // UX-F4: Double-click to rename
                  startRenameLayer(layer.id);
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
                    'ml-2 flex size-7 shrink-0 items-center justify-center rounded-md border text-foreground transition',
                    isSelected
                      ? 'border-primary/40 bg-background'
                      : 'border-border/60 bg-background/80',
                    !isVisible && 'opacity-50',
                  )}
                  aria-hidden
                >
                  {(() => {
                    const hasFill = isPaintVisible(layer.style.fill);
                    const hasStroke = isPaintVisible(layer.style.stroke);
                    if (!layer.path?.d || (!hasFill && !hasStroke)) {
                      return (
                        <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                      );
                    }
                    const viewBoxStr = currentVariant?.viewBox.join(' ') ?? '0 0 24 24';
                    const rawStrokeWidth = layer.style.strokeWidth ?? 1.5;
                    // Ensure the stroke is visible in the tiny thumbnail.
                    // The thumbnail always shows strokes at a readable size,
                    // independent of whatever stroke-width the author picked.
                    const previewStrokeWidth = Math.max(rawStrokeWidth, 1.5);
                    return (
                      <svg
                        viewBox={viewBoxStr}
                        width="100%"
                        height="100%"
                        preserveAspectRatio="xMidYMid meet"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ display: 'block', overflow: 'visible' }}
                      >
                        <path
                          d={layer.path.d}
                          fill={hasFill ? 'currentColor' : 'none'}
                          stroke={hasStroke ? 'currentColor' : 'none'}
                          strokeWidth={previewStrokeWidth}
                          strokeLinecap={layer.style.lineCap ?? 'round'}
                          strokeLinejoin={layer.style.lineJoin ?? 'round'}
                          fillRule={layer.path.fillRule}
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    );
                  })()}
                </div>
                <div className={cn('min-w-0 flex-1', !isVisible && 'opacity-50')}>
                  <div className="flex items-center gap-2">
                    {maskLayerId ? (
                      <UiIcon name="link-2" size={12} className="size-3 shrink-0 text-muted-foreground" />
                    ) : null}
                    {layer.compound ? (
                      <span
                        aria-label="Compound layer"
                        title="Compound shape — open the Inspector to edit operands"
                        className="font-mono text-xs leading-none text-muted-foreground shrink-0"
                      >
                        {rootOpGlyph(layer.compound) ?? '∪'}
                      </span>
                    ) : null}
                    {/*
                      UX-F4: Inline rename. Label and input share the
                      same box — identical height, padding, border
                      width (transparent on the label), and font
                      metrics. Border color is the only visual delta
                      between the two states, so the swap doesn't jump.
                    */}
                    {isRenaming ? (
                      <input
                        type="text"
                        className={cn(
                          'box-border min-w-0 flex-1 rounded-sm border border-primary/40 bg-background',
                          'px-1 py-0 text-[length:var(--text-body)] font-medium text-foreground',
                          'leading-[1.25rem] outline-none ring-0',
                          'focus:border-primary focus:ring-1 focus:ring-primary/30',
                        )}
                        style={{ height: '1.25rem' }}
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitRename(layer.id);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelRenameHook();
                            setRenamingLayerId(null);
                          }
                          e.stopPropagation();
                        }}
                        onBlur={() => commitRename(layer.id)}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <p
                        className="box-border min-w-0 flex-1 truncate rounded-sm border border-transparent px-1 py-0 text-[length:var(--text-body)] font-medium leading-[1.25rem] text-foreground"
                        style={{ height: '1.25rem' }}
                      >
                        {layer.id}
                      </p>
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
                  {isVisible ? <UiIcon name="eye" size={14} className="size-3.5" /> : <UiIcon name="eye-off" size={14} className="size-3.5" />}
                </Button>
              </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onSelect={() => startRenameLayer(layer.id)}>
                    <UiIcon name="pencil" size={16} className="size-4" />
                    Rename
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => {
                    if (currentIconId) {
                      setLayerVisibility(currentIconId, layer.id, !isVisible);
                    }
                  }}>
                    {isVisible ? <UiIcon name="eye-off" size={16} className="size-4" /> : <UiIcon name="eye" size={16} className="size-4" />}
                    {isVisible ? 'Hide' : 'Show'}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onSelect={() => removeSelectedLayers()}
                    className="text-destructive focus:text-destructive"
                  >
                    <UiIcon name="trash-2" size={16} className="size-4" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      </ScrollArea>

      {/* Marquee overlay — data-marquee-overlay is a semantic hook
          used by char-marquee-layerPanel.test.tsx to assert the
          overlay actually unmounts at pointerup. Do not remove. */}
      {marqueeRect && (
        <div
          data-marquee-overlay
          className="pointer-events-none fixed z-50 border border-primary/60 bg-primary/10"
          style={{
            left: marqueeRect.left,
            top: marqueeRect.top,
            width: marqueeRect.right - marqueeRect.left,
            height: marqueeRect.bottom - marqueeRect.top,
          }}
        />
      )}
    </div>
  );
});
