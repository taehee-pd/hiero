'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Layers2, Plus, Trash2 } from 'lucide-react';
import { Toolbar } from './Toolbar';
import { ToolPanel } from './ToolPanel';
import { LayerPanel } from './LayerPanel';
import { GuideMasterPanel } from './GuideMasterPanel';
import { Canvas } from './Canvas';
import { InspectorPanel } from './InspectorPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { editorStore } from '@/lib/editor-store/store';
import { useEditorActions } from '@/lib/editor-store/hooks';
import { SAMPLE_PROJECT } from '@/lib/schema/sample-project';
import { handleEditorKeyDown } from '@/lib/editor-core/keyboard';
import { useEditorStore } from '@/lib/editor-store/hooks';

function CurrentDocumentPanel() {
  const icon = useEditorStore((s) =>
    s.currentIconId ? s.project?.icons[s.currentIconId] : null,
  );
  const variantId = useEditorStore((s) => s.currentVariantId);
  const stateId = useEditorStore((s) => s.currentStateId);
  const currentVariant = useEditorStore((s) =>
    s.currentIconId && s.currentVariantId
      ? s.project?.icons[s.currentIconId]?.variants[s.currentVariantId] ?? null
      : null,
  );
  const layerCount = useEditorStore((s) => {
    if (!s.currentIconId || !s.currentVariantId || !s.currentStateId) return 0;
    return Object.keys(
      s.project?.icons[s.currentIconId]?.variants[s.currentVariantId]?.states[s.currentStateId]
        ?.layers ?? {},
    ).length;
  });

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-4">
      <div className="min-w-0">
        <p className="truncate text-base font-semibold tracking-tight text-foreground">
          {icon?.name ?? 'No icon selected'}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {[icon?.id, variantId, stateId].filter(Boolean).join(' / ') || 'select an icon'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px] font-medium">
            <Layers2 className="size-3.5" />
            {layerCount} layers
          </Badge>
          {currentVariant ? (
            <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px] font-medium">
              {currentVariant.size}px
            </Badge>
          ) : null}
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="rounded-xl">
        <Link href="/">
          <ChevronLeft className="size-3.5" />
          library
        </Link>
      </Button>
    </div>
  );
}

function formatVariantLabel(variant: { name?: string; size: number }) {
  const name = variant.name?.trim();
  if (!name || name === String(variant.size)) {
    return String(variant.size);
  }
  return `${name} ${variant.size}`;
}

function scaleViewBox(
  viewBox: [number, number, number, number],
  size: number,
): [number, number, number, number] {
  const sourceSize = Math.max(viewBox[2], viewBox[3], 1);
  const scale = size / sourceSize;
  return [
    Number((viewBox[0] * scale).toFixed(3)),
    Number((viewBox[1] * scale).toFixed(3)),
    Number((viewBox[2] * scale).toFixed(3)),
    Number((viewBox[3] * scale).toFixed(3)),
  ];
}

function VariantPickerBar() {
  const icon = useEditorStore((s) =>
    s.currentIconId ? s.project?.icons[s.currentIconId] ?? null : null,
  );
  const currentVariantId = useEditorStore((s) => s.currentVariantId);
  const currentVariant = useEditorStore((s) =>
    s.currentIconId && s.currentVariantId
      ? s.project?.icons[s.currentIconId]?.variants[s.currentVariantId] ?? null
      : null,
  );
  const { addVariant, removeVariant, setCurrentVariant } = useEditorActions();
  const [createOpen, setCreateOpen] = useState(false);
  const [customSize, setCustomSize] = useState('24');

  const variants = useMemo(
    () =>
      Object.values(icon?.variants ?? {}).sort((a, b) => {
        if (a.size !== b.size) return a.size - b.size;
        return formatVariantLabel(a).localeCompare(formatVariantLabel(b));
      }),
    [icon],
  );

  useEffect(() => {
    if (currentVariant) {
      setCustomSize(String(currentVariant.size));
    }
  }, [currentVariant]);

  const handleCreateVariant = (size: number) => {
    if (!icon || !currentVariant || !Number.isFinite(size) || size <= 0) return;
    addVariant(icon.id, size, scaleViewBox(currentVariant.viewBox, size));
    setCreateOpen(false);
    setCustomSize(String(size));
  };

  return (
    <div className="flex flex-col gap-3 px-3 pb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">
            {currentVariant ? `${formatVariantLabel(currentVariant)}px` : 'No variant selected'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {currentVariant ? 'variant' : 'select a variant'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover open={createOpen} onOpenChange={setCreateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={!icon || !currentVariant}
              >
                <Plus className="size-4" />
                <span>Variant</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 rounded-2xl p-3">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">New variant</p>
                  <p className="mt-1 text-xs text-muted-foreground">Presets or any size.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[12, 16, 20, 24, 32, 48].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => handleCreateVariant(size)}
                      className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition hover:border-foreground/20 hover:bg-accent/40"
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <label htmlFor="variant-custom-size" className="text-xs font-medium text-muted-foreground">
                    Custom size
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="variant-custom-size"
                      type="number"
                      min="1"
                      step="1"
                      value={customSize}
                      onChange={(event) => setCustomSize(event.target.value)}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => handleCreateVariant(Number.parseFloat(customSize))}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-xl text-muted-foreground hover:text-foreground"
            disabled={!icon || !currentVariantId || variants.length <= 1}
            onClick={() => {
              if (icon && currentVariantId) {
                removeVariant(icon.id, currentVariantId);
              }
            }}
            aria-label="Remove current variant"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <Separator className="bg-border/70" />

      <div className="flex flex-wrap gap-2">
        {variants.map((variant) => {
          const isActive = variant.id === currentVariantId;
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => setCurrentVariant(variant.id)}
              className={
                isActive
                  ? 'rounded-xl border border-primary/35 bg-primary/[0.08] px-3 py-2 text-sm font-medium text-foreground shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_22%,transparent)]'
                  : 'rounded-xl border border-border/80 bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-border hover:bg-accent hover:text-foreground'
              }
            >
              {formatVariantLabel(variant)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function EditorShell({ initialIconId }: { initialIconId?: string }) {
  const currentIconId = useEditorStore((s) => s.currentIconId);
  const currentVariantId = useEditorStore((s) => s.currentVariantId);
  const currentStateId = useEditorStore((s) => s.currentStateId);
  const project = useEditorStore((s) => s.project);
  const selectedLayerIds = useEditorStore((s) => s.selection.layerIds);
  const selectedGuideIndexes = useEditorStore((s) => s.selection.guideIndexes ?? []);
  const guidesVisible = useEditorStore((s) => s.guidesVisible);
  const [leftPanelMode, setLeftPanelMode] = useState<'layers' | 'guides'>('layers');
  const previousGuidesVisibleRef = useRef(guidesVisible);

  useEffect(() => {
    const state = editorStore.getState();
    if (!state.project) {
      state.loadProject(SAMPLE_PROJECT);
    }

    if (initialIconId && state.project?.icons[initialIconId]) {
      state.setCurrentIcon(initialIconId);
    }
  }, [initialIconId]);

  useEffect(() => {
    window.addEventListener('keydown', handleEditorKeyDown);
    return () => window.removeEventListener('keydown', handleEditorKeyDown);
  }, []);

  useEffect(() => {
    if (
      !project ||
      !currentIconId ||
      !currentStateId ||
      selectedLayerIds.length > 0 ||
      selectedGuideIndexes.length > 0
    ) {
      return;
    }
    const layers =
      currentVariantId
        ? project.icons[currentIconId]?.variants[currentVariantId]?.states[currentStateId]?.layers ??
          {}
        : {};
    const nextLayerId =
      Object.values(layers).find((layer) => layer.visible !== false)?.id ??
      Object.keys(layers)[0];
    if (!nextLayerId) return;

    editorStore.getState().setSelection({ layerIds: [nextLayerId], pointIds: [] });
  }, [
    currentIconId,
    currentStateId,
    currentVariantId,
    project,
    selectedGuideIndexes.length,
    selectedLayerIds.length,
  ]);

  useEffect(() => {
    const previousGuidesVisible = previousGuidesVisibleRef.current;
    if (!previousGuidesVisible && guidesVisible) {
      setLeftPanelMode('guides');
    } else if (previousGuidesVisible && !guidesVisible && leftPanelMode === 'guides') {
      setLeftPanelMode('layers');
    }
    previousGuidesVisibleRef.current = guidesVisible;
  }, [guidesVisible, leftPanelMode]);

  return (
    <div className="swift-surface flex h-dvh w-full flex-col overflow-hidden text-foreground">
      <Toolbar />
      <div className="workspace-shell grid min-h-0 flex-1 grid-cols-1 gap-3 px-3 pb-3 lg:grid-cols-[15rem_minmax(0,1fr)_18rem]">
        <aside className="flex min-h-0 flex-col gap-3">
          <section className="studio-panel overflow-hidden rounded-xl">
            <CurrentDocumentPanel />
          </section>
          <section className="studio-panel min-h-0 overflow-hidden rounded-xl p-2">
            <ToolPanel guidePanelOpen={leftPanelMode === 'guides'} />
          </section>
          <section className="studio-panel min-h-0 flex-1 overflow-hidden rounded-xl">
            {leftPanelMode === 'guides' ? (
              <GuideMasterPanel onClose={() => setLeftPanelMode('layers')} />
            ) : (
              <LayerPanel />
            )}
          </section>
        </aside>

        <main className="studio-panel min-h-0 overflow-hidden rounded-xl p-3">
          <div className="flex h-full min-h-0 flex-col gap-3">
            <VariantPickerBar />
            <div className="min-h-0 flex-1">
              <Canvas />
            </div>
          </div>
        </main>

        <aside className="studio-panel min-h-0 overflow-hidden rounded-xl">
          <InspectorPanel />
        </aside>
      </div>
    </div>
  );
}
