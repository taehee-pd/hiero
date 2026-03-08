'use client';

import { Eye, EyeOff } from 'lucide-react';
import { ScrollArea } from '@/components/kibo-ui/scroll-area';
import { Button } from '@/components/kibo-ui/button';
import {
  useCurrentLayers,
  useSelection,
  useEditorStore,
  useEditorActions,
} from '@/lib/editor-store/hooks';
import { cn } from '@/lib/utils';

export function LayerPanel() {
  const layers = useCurrentLayers();
  const selection = useSelection();
  const currentIconId = useEditorStore((s) => s.currentIconId);
  const currentStateId = useEditorStore((s) => s.currentStateId);
  const { setSelection, setLayerVisibility } = useEditorActions();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="workspace-panel-header flex items-center justify-between px-4 py-3">
        <p className="text-sm font-medium text-foreground">Layers</p>
        <span className="text-xs text-muted-foreground">{layers.length}</span>
      </div>
      <ScrollArea className="workspace-scroll flex-1">
        <div className="flex flex-col gap-1.5 p-2">
          {layers.length === 0 ? (
            <div className="workspace-empty-state rounded-md px-3 py-6 text-center text-xs text-muted-foreground">
              No layers
            </div>
          ) : null}
          {layers.map((layer) => {
            const isSelected = selection.layerIds.includes(layer.id);
            const isVisible = layer.visible !== false;

            return (
              <div
                key={layer.id}
                className={cn(
                  'group flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition',
                  isSelected
                    ? 'border-foreground/20 bg-foreground/[0.04]'
                    : 'border-border bg-background hover:border-foreground/12',
                )}
                onClick={() => setSelection({ layerIds: [layer.id], pointIds: [] })}
                role="button"
                tabIndex={0}
                aria-selected={isSelected}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelection({ layerIds: [layer.id], pointIds: [] });
                  }
                }}
              >
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    layer.role === 'primary' && 'bg-accent',
                    layer.role === 'secondary' && 'bg-muted-foreground',
                    layer.role === 'tertiary' && 'bg-chart-3',
                    !layer.role && 'bg-muted-foreground/40',
                  )}
                />
                <div className={cn('min-w-0 flex-1', !isVisible && 'opacity-40')}>
                  <p className="truncate text-sm font-medium text-foreground">{layer.id}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{layer.role ?? 'layer'}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="workspace-tool-button h-7 w-7 rounded-md text-muted-foreground hover:text-foreground"
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
