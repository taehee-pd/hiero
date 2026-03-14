'use client';

import { Eye, EyeOff, Link2 } from 'lucide-react';
import { ScrollArea } from '@/components/kibo-ui/scroll-area';
import { Button } from '@/components/kibo-ui/button';
import {
  useSelection,
  useEditorStore,
  useEditorActions,
} from '@/lib/editor-store/hooks';
import { selectCurrentLayerPanelRows } from '@/lib/editor-store/selectors';
import { cn } from '@/lib/utils';

export function LayerPanel() {
  const rows = useEditorStore(selectCurrentLayerPanelRows);
  const selection = useSelection();
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
  const currentStateId = useEditorStore((s) => s.currentStateId);
  const { setSelection, setLayerVisibility } = useEditorActions();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="workspace-panel-header flex items-center justify-between px-4 py-4">
        <div>
          <p className="workspace-kicker">Structure</p>
          <p className="mt-2 text-sm font-semibold text-foreground">Layers</p>
        </div>
        <span className="workspace-badge">{rows.length}</span>
      </div>
      <ScrollArea className="workspace-scroll flex-1">
        <div className="flex flex-col gap-2 p-2.5">
          {rows.length === 0 ? (
            <div className="workspace-empty-state rounded-xl px-3 py-6 text-center text-xs text-muted-foreground">
              No layers
            </div>
          ) : null}
          {rows.map(({ layer, depth, maskLayerId, clippedLayerIds }) => {
            const isSelected = selection.layerIds.includes(layer.id);
            const isVisible = layer.visible !== false;
            const isMask = layer.isClipMask === true;
            const componentKind = componentByLayerId.get(layer.id);

            return (
              <div
                key={layer.id}
                className={cn(
                  'group relative flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition',
                  isSelected
                    ? 'border-primary/40 bg-primary/6 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_24%,transparent)]'
                    : 'border-border/80 bg-background/80 hover:border-foreground/12 hover:bg-background',
                )}
                onClick={() => setSelection({ layerIds: [layer.id], pointIds: [] })}
                role="button"
                tabIndex={0}
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
                <span
                  className={cn(
                    'ml-2 size-2.5 shrink-0 rounded-full',
                    layer.role === 'primary' && 'bg-accent',
                    layer.role === 'secondary' && 'bg-muted-foreground',
                    layer.role === 'tertiary' && 'bg-chart-3',
                    !layer.role && 'bg-muted-foreground/40',
                  )}
                />
                <div className={cn('min-w-0 flex-1', !isVisible && 'opacity-40')}>
                  <div className="flex items-center gap-2">
                    {maskLayerId ? (
                      <Link2 className="size-3 shrink-0 text-muted-foreground" />
                    ) : null}
                    <p className="truncate text-sm font-medium text-foreground">{layer.id}</p>
                    {isMask ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold uppercase text-muted-foreground">
                        Mask
                      </span>
                    ) : null}
                    {componentKind ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase text-primary">
                        {componentKind}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm uppercase text-muted-foreground">
                    {maskLayerId
                      ? `clipped by ${maskLayerId}`
                      : clippedLayerIds.length > 0
                        ? `${clippedLayerIds.length} clipped`
                        : (layer.role ?? 'layer')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="workspace-tool-button h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (currentIconId && currentStateId) {
                      setLayerVisibility(currentIconId, currentStateId, layer.id, !isVisible);
                    }
                  }}
                  aria-label={isVisible ? 'Hide layer' : 'Show layer'}
                >
                  {isVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </Button>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
