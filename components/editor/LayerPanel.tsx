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
    <div className="flex min-h-0 flex-1 flex-col bg-transparent">
      <div className="px-4 pt-4 pb-2">
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Layers</p>
          <span className="studio-chip">{layers.length}</span>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1.5 px-3 pb-3">
          {layers.length === 0 && (
            <p className="px-2 py-4 text-xs text-muted-foreground text-center">
              No layers
            </p>
          )}
          {layers.map((layer) => {
            const isSelected = selection.layerIds.includes(layer.id);
            const isVisible = layer.visible !== false;

            return (
              <div
                key={layer.id}
                className={cn(
                  'group flex cursor-pointer items-center gap-2 rounded-[1.15rem] border border-transparent px-3 py-3 text-sm transition-colors',
                  'bg-background/45 hover:border-border/65 hover:bg-secondary/55',
                  isSelected && 'border-primary/35 bg-primary/12 text-primary',
                )}
                onClick={() =>
                  setSelection({ layerIds: [layer.id], pointIds: [] })
                }
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
                {/* Role indicator */}
                <span
                  className={cn(
                    'size-2 rounded-full shrink-0',
                    layer.role === 'primary' && 'bg-accent',
                    layer.role === 'secondary' && 'bg-muted-foreground',
                    layer.role === 'tertiary' && 'bg-chart-3',
                    !layer.role && 'bg-muted-foreground/50',
                  )}
                />

                {/* Layer name */}
                <span
                  className={cn(
                    'flex-1 truncate',
                    !isVisible && 'opacity-40',
                  )}
                >
                  {layer.id}
                </span>

                {/* Visibility toggle */}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 rounded-full border border-transparent opacity-0 text-muted-foreground transition-opacity group-hover:opacity-100 hover:border-border/60 hover:bg-background/70 hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (currentIconId && currentStateId) {
                      setLayerVisibility(
                        currentIconId,
                        currentStateId,
                        layer.id,
                        !isVisible,
                      );
                    }
                  }}
                  aria-label={isVisible ? 'Hide layer' : 'Show layer'}
                >
                  {isVisible ? (
                    <Eye className="size-3.5" />
                  ) : (
                    <EyeOff className="size-3.5" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
