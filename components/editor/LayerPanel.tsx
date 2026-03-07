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
      <div className="workspace-panel-header px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="workspace-kicker">Layers</p>
            <p className="mt-2 text-sm font-semibold text-foreground">Document stack</p>
          </div>
          <span className="workspace-badge text-[10px] tabular-nums text-muted-foreground">
            {layers.length}
          </span>
        </div>
      </div>
      <ScrollArea className="workspace-scroll flex-1">
        <div className="flex flex-col gap-2 px-3 py-3">
          {layers.length === 0 && (
            <div className="workspace-empty-state rounded-[1.3rem] px-3 py-6 text-center text-xs text-muted-foreground">
              No layers
            </div>
          )}
          {layers.map((layer) => {
            const isSelected = selection.layerIds.includes(layer.id);
            const isVisible = layer.visible !== false;

            return (
              <div
                key={layer.id}
                className={cn(
                  'group workspace-meta-card flex cursor-pointer items-center gap-3 rounded-[1.2rem] px-3 py-3 text-sm transition',
                  'hover:-translate-y-px hover:border-primary/22',
                  isSelected && 'border-primary/35 bg-primary/10 text-primary shadow-[0_18px_38px_color-mix(in_oklab,var(--primary)_12%,transparent)]',
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
                  className="workspace-tool-button size-8 rounded-[0.95rem] opacity-0 text-muted-foreground transition-opacity group-hover:opacity-100 hover:text-foreground"
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
