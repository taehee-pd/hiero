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
      <span className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Layers
      </span>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 px-2 pb-2">
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
                  'group flex cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm transition-colors',
                  'hover:bg-secondary/80',
                  isSelected && 'bg-primary/12 text-primary',
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
                  className="size-6 rounded-lg opacity-0 text-muted-foreground transition-opacity group-hover:opacity-100 hover:bg-background/70 hover:text-foreground"
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
