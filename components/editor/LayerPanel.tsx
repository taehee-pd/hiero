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
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="workspace-kicker">Layers</p>
            <p className="mt-2 font-display text-[1.45rem] leading-none tracking-[-0.05em] text-foreground">
              Document stack
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Select the survivor path before applying booleans or point edits.
            </p>
          </div>
          <span className="workspace-badge text-[10px] tabular-nums text-muted-foreground">
            {layers.length}
          </span>
        </div>
        <div className="workspace-meta-card mt-4 rounded-[1.2rem] px-3 py-3">
          <div className="relative z-10 grid grid-cols-2 gap-2">
            <div>
              <p className="workspace-kicker text-[0.58rem]">Selected</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{selection.layerIds.length}</p>
            </div>
            <div>
              <p className="workspace-kicker text-[0.58rem]">Visible</p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {layers.filter((layer) => layer.visible !== false).length}
              </p>
            </div>
          </div>
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
                <div className={cn('min-w-0 flex-1', !isVisible && 'opacity-40')}>
                  <p className="truncate text-sm font-medium">{layer.id}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {layer.role ?? 'No role'} · {layer.path?.d ? 'Path layer' : 'Empty'}
                  </p>
                </div>

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
