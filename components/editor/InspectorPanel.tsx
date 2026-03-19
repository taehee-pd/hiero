'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LoaderCircle,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Minus,
  Shapes,
  SplitSquareHorizontal,
  Squircle,
  VenetianMask,
  ScissorsLineDashed,
  Plus,
} from 'lucide-react';
import { ScrollArea } from '@/components/kibo-ui/scroll-area';
import { Input } from '@/components/kibo-ui/input';
import { Label } from '@/components/kibo-ui/label';
import { Separator } from '@/components/kibo-ui/separator';
import { Button } from '@/components/kibo-ui/button';
import { toast } from '@/components/ui/use-toast';
import { TransitionPanel } from './TransitionPanel';
import {
  alignLayers,
  computeTopology,
  alignSelectedPoints,
  distributeLayers,
  distributeSelectedPoints,
  lockTopology,
  setSelectedPointType,
} from '@/lib/editor-core';
import {
  useEditorActions,
  useEditorStore,
  useSelection,
} from '@/lib/editor-store/hooks';
import { selectCurrentState } from '@/lib/editor-store/selectors';
import { editorStore, VARIANT_SIZE_PRESETS } from '@/lib/editor-store/store';
import type { BooleanMode } from '@/lib/editor-core/boolean-ops';
import type { GradientStop, Layer, PaintRef, SymbolScale, SymbolWeight, Variant } from '@/lib/schema/types';
import type { NodeType, PathSegment, SubPath } from '@/lib/editor-core';
import { isPathDirectlyEditable, parseSvgPath, serializePath } from '@/lib/editor-core/parse';
import { cn } from '@/lib/utils';

const BOOLEAN_ACTIONS: Array<{
  mode: BooleanMode;
  label: string;
  icon: typeof Shapes;
}> = [
  { mode: 'unite', label: 'Unite', icon: Shapes },
  { mode: 'subtract', label: 'Subtract', icon: Minus },
  { mode: 'intersect', label: 'Intersect', icon: SplitSquareHorizontal },
  { mode: 'exclude', label: 'Exclude', icon: Squircle },
];

const ALIGN_ACTIONS = [
  { label: 'Align left', mode: 'left', icon: AlignHorizontalJustifyStart },
  { label: 'Align center horizontally', mode: 'center-h', icon: AlignHorizontalJustifyCenter },
  { label: 'Align right', mode: 'right', icon: AlignHorizontalJustifyEnd },
  { label: 'Align top', mode: 'top', icon: AlignVerticalJustifyStart },
  { label: 'Align center vertically', mode: 'center-v', icon: AlignVerticalJustifyCenter },
  { label: 'Align bottom', mode: 'bottom', icon: AlignVerticalJustifyEnd },
] as const;

const DISTRIBUTE_ACTIONS = [
  { label: 'Distribute horizontally', mode: 'horizontal', icon: BetweenHorizontalStart },
  { label: 'Distribute vertically', mode: 'vertical', icon: BetweenVerticalStart },
] as const;

const POINT_ALIGN_ACTIONS = [
  { label: 'Align points left', axis: 'x', anchor: 'min', icon: AlignStartVertical },
  { label: 'Align points center horizontally', axis: 'x', anchor: 'center', icon: AlignCenterVertical },
  { label: 'Align points right', axis: 'x', anchor: 'max', icon: AlignEndVertical },
  { label: 'Align points top', axis: 'y', anchor: 'min', icon: AlignStartHorizontal },
  { label: 'Align points center vertically', axis: 'y', anchor: 'center', icon: AlignCenterHorizontal },
  { label: 'Align points bottom', axis: 'y', anchor: 'max', icon: AlignEndHorizontal },
] as const;

const POINT_DISTRIBUTE_ACTIONS = [
  { label: 'Distribute points horizontally', axis: 'x', rotate: '' },
  { label: 'Distribute points vertically', axis: 'y', rotate: 'rotate-90' },
] as const;

const SYMBOL_WEIGHT_OPTIONS: SymbolWeight[] = ['ultralight', 'thin', 'light', 'regular', 'medium', 'semibold', 'bold', 'heavy', 'black'];
const SYMBOL_SCALE_OPTIONS: SymbolScale[] = ['small', 'medium', 'large'];

const NODE_TYPE_OPTIONS = [
  { value: 'static', label: 'Corner', glyph: '∟' },
  { value: 'smooth', label: 'Smooth', glyph: '∿' },
  { value: 'symmetric', label: 'Symmetric', glyph: '⇄' },
] as const;

export function InspectorPanel() {
  const tool = useEditorStore((s) => s.tool);
  const shapeSubTool = useEditorStore((s) => s.shapeSubTool);
  const shapePolygonSides = useEditorStore((s) => s.shapePolygonSides);
  const shapeStarPoints = useEditorStore((s) => s.shapeStarPoints);
  const currentIcon = useEditorStore((s) =>
    s.currentIconId ? s.project?.icons[s.currentIconId] ?? null : null,
  );
  const currentVariantId = useEditorStore((s) => s.currentVariantId);
  const currentVariant = useEditorStore((s) =>
    s.currentIconId && s.currentVariantId
      ? s.project?.icons[s.currentIconId]?.variants[s.currentVariantId] ?? null
      : null,
  );
  const selection = useSelection();
  const {
    addVariant,
    removeVariant,
    setCurrentVariant,
    setStateTopology,
    setShapePolygonSides,
    setShapeStarPoints,
    setShapeSubTool,
    setClipMask,
    releaseClipMask,
    generateVariantMatrix,
    upsertSymbolComponent,
    removeSymbolComponent,
  } = useEditorActions();
  const currentState = useEditorStore(selectCurrentState);
  const applyBoolean = useEditorStore((s) => s.applyBoolean);
  const currentIconId = useEditorStore((s) => s.currentIconId);
  const currentStateId = useEditorStore((s) => s.currentStateId);
  const colorTokens = useEditorStore(
    (s) => s.project?.tokenSet?.colors ?? {},
  );
  const [pendingBooleanMode, setPendingBooleanMode] = useState<BooleanMode | null>(null);
  const [newVariantSize, setNewVariantSize] = useState<string>(String(VARIANT_SIZE_PRESETS[3]));
  const [matrixSizes, setMatrixSizes] = useState<number[]>([16, 24]);
  const [matrixWeights, setMatrixWeights] = useState<SymbolWeight[]>(['regular', 'bold']);
  const [matrixScales, setMatrixScales] = useState<SymbolScale[]>(['small', 'medium', 'large']);

  const variants = Object.values(currentIcon?.variants ?? {}).sort((a, b) => {
    if (a.size !== b.size) return a.size - b.size;
    return a.id.localeCompare(b.id);
  });
  const selectedVariantSize = Number.parseInt(newVariantSize, 10);
  const variantSizeTaken = variants.some((variant) => variant.size === selectedVariantSize);

  const selectedLayerId = selection.layerIds[0] ?? null;
  const layer =
    currentState && selectedLayerId
      ? currentState.layers[selectedLayerId] ?? null
      : null;
  const pointContext = layer
    ? getSelectedPointContext(layer, selection.pointIds)
    : getSelectedPointContext(null, []);
  const currentTopology = useMemo(
    () => (currentState ? computeTopology(currentState) : null),
    [currentState],
  );
  const isTopologyLocked = currentState?.topology?.locked === true;
  const multipleLayersSelected = selection.layerIds.length > 1;
  const enoughLayersToDistribute = selection.layerIds.length > 2;
  const showShapeToolSettings = tool === 'shape';
  const canAlignPoints = pointContext.count >= 2;
  const canDistributePoints = pointContext.count >= 3;
  const hasSinglePointSelection = pointContext.count === 1;
  const hasBooleanableSelection = Boolean(
    currentState &&
      multipleLayersSelected &&
      selection.layerIds.every((layerId) => Boolean(currentState.layers[layerId]?.path?.d)),
  );
  const booleanDisabled = !hasBooleanableSelection || pendingBooleanMode !== null;
  const clippingSelection = selection.layerIds
    .map((layerId) => currentState?.layers[layerId] ?? null)
    .filter((candidate): candidate is Layer => Boolean(candidate));
  const canMakeClipMask =
    clippingSelection.length >= 2 &&
    clippingSelection.every((candidate) => Boolean(candidate.path?.d));
  const activeMaskLayer = clippingSelection[0] ?? null;
  const clipTargetIds = useMemo(
    () =>
      canMakeClipMask
        ? clippingSelection.slice(1).map((candidate) => candidate.id)
        : [],
    [canMakeClipMask, clippingSelection],
  );
  const canReleaseClipMask =
    selection.layerIds.length === 1 &&
    Boolean(layer?.isClipMask || layer?.clipPathLayerId);
  const handleBooleanAction = useCallback(
    async (mode: BooleanMode) => {
      if (booleanDisabled) return;

      setPendingBooleanMode(mode);
      try {
        await applyBoolean(mode);
      } catch (error) {
        console.error('[InspectorPanel] boolean operation failed', error);
        toast({
          title: 'Boolean operation failed',
          description:
            error instanceof Error
              ? error.message
              : 'Selected layers could not be combined. Check that each layer has a valid path.',
        });
      } finally {
        setPendingBooleanMode(null);
      }
    },
    [applyBoolean, booleanDisabled],
  );
  const handleMakeClipMask = useCallback(() => {
    if (!activeMaskLayer || clipTargetIds.length === 0) return;
    setClipMask(activeMaskLayer.id, clipTargetIds);
  }, [activeMaskLayer, clipTargetIds, setClipMask]);
  const handleReleaseClipMask = useCallback(() => {
    if (!layer) return;
    releaseClipMask(layer.id);
  }, [layer, releaseClipMask]);
  const handleAddVariant = useCallback(() => {
    if (!currentIcon || !Number.isFinite(selectedVariantSize) || selectedVariantSize <= 0) return;
    addVariant(currentIcon.id, {
      size: selectedVariantSize,
      viewBox: scaleVariantViewBox(currentVariant?.viewBox, selectedVariantSize),
      sourceVariantId: currentVariantId ?? undefined,
    });
  }, [addVariant, currentIcon, currentVariant?.viewBox, currentVariantId, selectedVariantSize]);
  const handleLockTopology = useCallback(() => {
    if (!currentIconId || !currentStateId || !currentState) return;
    setStateTopology(currentIconId, currentStateId, lockTopology(currentState));
  }, [currentIconId, currentState, currentStateId, setStateTopology]);
  const handleUnlockTopology = useCallback(() => {
    if (!currentIconId || !currentStateId) return;
    setStateTopology(currentIconId, currentStateId, undefined);
  }, [currentIconId, currentStateId, setStateTopology]);



  const toggleMatrixSize = useCallback((size: number) => {
    setMatrixSizes((prev) => (prev.includes(size) ? prev.filter((value) => value !== size) : [...prev, size].sort((a, b) => a - b)));
  }, []);

  const toggleMatrixWeight = useCallback((weight: SymbolWeight) => {
    setMatrixWeights((prev) => (prev.includes(weight) ? prev.filter((value) => value !== weight) : [...prev, weight]));
  }, []);

  const toggleMatrixScale = useCallback((scale: SymbolScale) => {
    setMatrixScales((prev) => (prev.includes(scale) ? prev.filter((value) => value !== scale) : [...prev, scale]));
  }, []);

  const handleGenerateVariantMatrix = useCallback(() => {
    if (!currentIcon) return;
    generateVariantMatrix(currentIcon.id, {
      sizes: matrixSizes,
      weights: matrixWeights,
      scales: matrixScales,
      sourceVariantId: currentVariantId ?? undefined,
    });
  }, [currentIcon, currentVariantId, generateVariantMatrix, matrixScales, matrixSizes, matrixWeights]);

  const applyComponentTag = useCallback(
    (kind: 'badge' | 'slash' | 'enclosure') => {
      if (!currentIcon || selection.layerIds.length === 0) return;
      upsertSymbolComponent(currentIcon.id, {
        kind,
        layerIds: selection.layerIds,
        position: 'center',
      });
    },
    [currentIcon, selection.layerIds, upsertSymbolComponent],
  );
  useEffect(() => {
    if (currentVariant) {
      setNewVariantSize(String(currentVariant.size));
    }
  }, [currentVariant]);

  if (!currentIcon && !layer && !showShapeToolSettings) {
    return (
      <div className="flex h-full flex-col bg-transparent">
        <div className="px-4 pt-4 pb-3">
          <span className="workspace-kicker">Inspect</span>
          <p className="mt-2 text-base font-semibold text-foreground">Nothing selected</p>
        </div>
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="workspace-empty-state w-full rounded-2xl px-5 py-6 text-left">
            <p className="text-sm font-medium text-foreground">Choose a layer to inspect it</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Layer, style, vector, and transform controls appear only when they are relevant.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="px-4 pt-4 pb-3">
        <span className="workspace-kicker">Inspect</span>
        <p className="mt-2 text-base font-semibold text-foreground">
          {layer ? layer.id : showShapeToolSettings ? 'Shape tool' : currentVariant?.id ?? 'Inspector'}
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-5 px-4 pb-4">
          {currentIcon ? (
            <>
              <Section title="Variants">
                <div className="grid gap-2">
                  {variants.map((variant) => {
                    const isActive = variant.id === currentVariantId;
                    const isOnlyVariant = variants.length <= 1;

                    return (
                      <div key={variant.id} className="flex items-stretch gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentVariant(variant.id)}
                          className={cn(
                            'flex min-w-0 flex-1 flex-col rounded-xl border px-3 py-2 text-left transition',
                            isActive
                              ? 'border-primary/40 bg-primary/[0.08] text-foreground shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_22%,transparent)]'
                              : 'border-border/70 bg-background/70 text-foreground hover:bg-accent/40',
                          )}
                        >
                          <span className="truncate text-sm font-semibold">{variant.id}</span>
                          <span className="mt-1 text-xs text-muted-foreground">
                            {variant.size}px
                          </span>
                          <span className="truncate font-mono text-[11px] text-muted-foreground">
                            {formatVariantViewBox(variant)}
                          </span>
                        </button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isOnlyVariant}
                          onClick={() => removeVariant(currentIcon.id, variant.id)}
                          className="h-auto rounded-xl px-3 text-xs"
                        >
                          Remove
                        </Button>
                      </div>
                    );
                  })}
                </div>


                {currentVariant ? (
                  <div className="grid gap-2 rounded-xl border border-border/70 bg-background/40 p-3">
                    <Label className="text-xs uppercase text-muted-foreground">Weight</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {SYMBOL_WEIGHT_OPTIONS.map((weight) => (
                        <button
                          key={weight}
                          type="button"
                          onClick={() => currentIcon && currentVariantId && editorStore.getState().patchVariant(currentIcon.id, currentVariantId, { weight })}
                          className={cn(
                            'rounded-lg border px-2 py-1 text-[11px] font-medium',
                            currentVariant.weight === weight
                              ? 'border-primary/40 bg-primary/[0.08] text-foreground'
                              : 'border-border/70 bg-background text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {weight}
                        </button>
                      ))}
                    </div>
                    <Label className="text-xs uppercase text-muted-foreground">Scale</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {SYMBOL_SCALE_OPTIONS.map((scale) => (
                        <button
                          key={scale}
                          type="button"
                          onClick={() => currentIcon && currentVariantId && editorStore.getState().patchVariant(currentIcon.id, currentVariantId, { scale })}
                          className={cn(
                            'rounded-lg border px-2 py-1 text-xs font-medium',
                            currentVariant.scale === scale
                              ? 'border-primary/40 bg-primary/[0.08] text-foreground'
                              : 'border-border/70 bg-background text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {scale}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2 rounded-xl border border-dashed border-border/70 bg-muted/15 p-3">
                  <Label htmlFor="variant-size-preset" className="text-xs uppercase text-muted-foreground">
                    Preset Size
                  </Label>
                  <div className="flex items-center gap-2">
                    <select
                      id="variant-size-preset"
                      value={newVariantSize}
                      onChange={(event) => setNewVariantSize(event.target.value)}
                      className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary/40"
                    >
                      {VARIANT_SIZE_PRESETS.map((size) => (
                        <option key={size} value={size}>
                          {size}px
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddVariant}
                      disabled={!currentIcon || !Number.isFinite(selectedVariantSize) || variantSizeTaken}
                      className="rounded-xl"
                    >
                      <Plus className="size-4" />
                      Add Variant
                    </Button>
                  </div>
                  {variantSizeTaken ? (
                    <InlineMessage>A variant for {selectedVariantSize}px already exists.</InlineMessage>
                  ) : null}
                </div>

                <div className="grid gap-2 rounded-xl border border-dashed border-border/70 bg-muted/15 p-3">
                  <Label className="text-xs uppercase text-muted-foreground">Generate Variant Matrix</Label>
                  <div className="grid gap-1">
                    <p className="text-[11px] text-muted-foreground">Sizes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {VARIANT_SIZE_PRESETS.map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => toggleMatrixSize(size)}
                          className={cn('rounded-lg border px-2 py-1 text-xs', matrixSizes.includes(size) ? 'border-primary/40 bg-primary/[0.08]' : 'border-border/70')}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <p className="text-[11px] text-muted-foreground">Weights</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SYMBOL_WEIGHT_OPTIONS.map((weight) => (
                        <button
                          key={weight}
                          type="button"
                          onClick={() => toggleMatrixWeight(weight)}
                          className={cn('rounded-lg border px-2 py-1 text-xs', matrixWeights.includes(weight) ? 'border-primary/40 bg-primary/[0.08]' : 'border-border/70')}
                        >
                          {weight}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <p className="text-[11px] text-muted-foreground">Scales</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SYMBOL_SCALE_OPTIONS.map((scale) => (
                        <button
                          key={scale}
                          type="button"
                          onClick={() => toggleMatrixScale(scale)}
                          className={cn('rounded-lg border px-2 py-1 text-xs', matrixScales.includes(scale) ? 'border-primary/40 bg-primary/[0.08]' : 'border-border/70')}
                        >
                          {scale}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateVariantMatrix}
                    disabled={!currentIcon || matrixSizes.length === 0 || matrixWeights.length === 0 || matrixScales.length === 0}
                  >
                    Generate Variant Matrix
                  </Button>
                </div>
              </Section>
              <Separator />
              <Section title="Components">
                <div className="grid gap-2 rounded-xl border border-border/70 bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Tag selected layers as symbol components.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => applyComponentTag('badge')} disabled={!currentIcon || selection.layerIds.length === 0}>Tag Badge</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => applyComponentTag('slash')} disabled={!currentIcon || selection.layerIds.length === 0}>Tag Slash</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => applyComponentTag('enclosure')} disabled={!currentIcon || selection.layerIds.length === 0}>Tag Enclosure</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['badge','slash','enclosure'] as const).map((kind) => {
                      const count = currentIcon?.components?.[kind]?.layerIds.length ?? 0;
                      return (
                        <Button key={kind} type="button" size="sm" variant="ghost" onClick={() => currentIcon && removeSymbolComponent(currentIcon.id, kind)} disabled={!currentIcon?.components?.[kind]}>
                          {kind} ({count}) remove
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </Section>
              <Separator />
              <TransitionPanel />
              <Separator />
            </>
          ) : null}

          {showShapeToolSettings && (
            <>
              <Section title="Shape Tool">
                <SelectField
                  label="Type"
                  value={shapeSubTool}
                  options={[
                    ['rectangle', 'Rectangle'],
                    ['ellipse', 'Ellipse'],
                    ['polygon', 'Polygon'],
                    ['star', 'Star'],
                    ['line', 'Line'],
                  ]}
                  onChange={(value) => setShapeSubTool(value as typeof shapeSubTool)}
                />
                {shapeSubTool === 'polygon' && (
                  <NumberField
                    label="Sides"
                    value={shapePolygonSides}
                    min={3}
                    step={1}
                    onChange={setShapePolygonSides}
                  />
                )}
                {shapeSubTool === 'star' && (
                  <NumberField
                    label="Points"
                    value={shapeStarPoints}
                    min={2}
                    step={1}
                    onChange={setShapeStarPoints}
                  />
                )}
                {!layer && (
                  <p className="text-sm text-muted-foreground">
                    Drag on the canvas to place a new {shapeSubTool}.
                  </p>
                )}
              </Section>
              {layer && <Separator />}
            </>
          )}

          {currentState && currentTopology ? (
            <>
              <Section title="Topology">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {currentTopology.layerPairs.length} tracked layer
                      {currentTopology.layerPairs.length === 1 ? '' : 's'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Subpath counts are captured per path layer.
                    </p>
                  </div>
                  {isTopologyLocked ? (
                    <span className="rounded-full border border-primary/30 bg-primary/[0.08] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                      Locked
                    </span>
                  ) : null}
                </div>

                {currentTopology.layerPairs.length > 0 ? (
                  <div className="grid gap-2">
                    {currentTopology.layerPairs.map((pair) => (
                      <div
                        key={pair.layerId}
                        className="rounded-xl border border-border/70 bg-background/70 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">{pair.layerId}</span>
                          <span className="text-xs text-muted-foreground">
                            {pair.subpathCount} subpath{pair.subpathCount === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <InlineMessage>No path layers are available in this state.</InlineMessage>
                )}

                <div className="flex gap-2">
                  {isTopologyLocked ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleUnlockTopology}
                      className="rounded-xl"
                    >
                      Unlock
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleLockTopology}
                      className="rounded-xl"
                    >
                      Lock Topology
                    </Button>
                  )}
                </div>
              </Section>
              <Separator />
            </>
          ) : null}

          {!layer ? (
            !showShapeToolSettings ? (
              <div className="workspace-empty-state w-full rounded-2xl px-5 py-6 text-left">
                <p className="text-sm font-medium text-foreground">Choose a layer to inspect it</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Variant switching stays available here so you can move between size masters before editing.
                </p>
              </div>
            ) : null
          ) : (
            <>
          <Section title="Layer">
            <ReadOnlyField label="ID" value={layer.id} />
            <ReadOnlyField label="Role" value={layer.role ?? 'none'} />
          </Section>

          <Separator />

          {multipleLayersSelected ? (
            <>
              <Section title="Clipping">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canMakeClipMask}
                  onClick={handleMakeClipMask}
                  className="h-10 rounded-xl border-border bg-background px-3 text-left transition hover:bg-accent/40"
                >
                  <span className="flex w-full items-center gap-2.5">
                    <VenetianMask className="size-4" />
                    <span className="flex flex-col items-start leading-none">
                      <span className="text-sm font-semibold uppercase">
                        Make Clipping Mask
                      </span>
                      <span className="mt-1 text-xs font-normal text-muted-foreground">
                        {activeMaskLayer
                          ? `${activeMaskLayer.id} clips ${clipTargetIds.length} layer${clipTargetIds.length === 1 ? '' : 's'}`
                          : 'Choose a mask and one or more targets'}
                      </span>
                    </span>
                  </span>
                </Button>
                {!canMakeClipMask ? (
                  <InlineMessage>
                    Choose at least two path layers. The first selected layer becomes the mask.
                  </InlineMessage>
                ) : null}
              </Section>

              <Separator />

              <Section title="Boolean">
                <div className="grid grid-cols-2 gap-2">
                  {BOOLEAN_ACTIONS.map(({ mode, label, icon: Icon }) => {
                    const isPending = pendingBooleanMode === mode;
                    return (
                      <Button
                        key={mode}
                        size="sm"
                        variant="outline"
                        disabled={booleanDisabled}
                        onClick={() => void handleBooleanAction(mode)}
                        className={cn(
                          'h-10 rounded-xl border-border bg-background px-3 text-left transition hover:bg-accent/40',
                          isPending && 'border-primary/40 text-primary',
                        )}
                      >
                        <span className="flex w-full items-center gap-2.5">
                          {isPending ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : (
                            <Icon className="size-4" />
                          )}
                          <span className="flex flex-col items-start leading-none">
                            <span className="text-sm font-semibold uppercase">
                              {label}
                            </span>
                            <span className="mt-1 text-xs font-normal text-muted-foreground">
                              {isPending ? 'Applying...' : 'Combine selected paths'}
                            </span>
                          </span>
                        </span>
                      </Button>
                    );
                  })}
                </div>
                {!hasBooleanableSelection ? (
                  <InlineMessage>
                    Choose at least two path layers to unlock Boolean actions.
                  </InlineMessage>
                ) : null}
              </Section>
            </>
          ) : null}

          {multipleLayersSelected && (
            <>
              <Section title="Align">
                <div className="grid grid-cols-3 gap-1">
                  {ALIGN_ACTIONS.map((action) => (
                    <IconActionButton
                      key={action.mode}
                      label={action.label}
                      onClick={() =>
                        alignLayers(action.mode, selection.layerIds, currentIconId!, currentStateId!)
                      }
                    >
                      <action.icon className="size-4" />
                    </IconActionButton>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {DISTRIBUTE_ACTIONS.map((action) => (
                    <IconActionButton
                      key={action.mode}
                      label={action.label}
                      disabled={!enoughLayersToDistribute}
                      onClick={() =>
                        distributeLayers(action.mode, selection.layerIds, currentIconId!, currentStateId!)
                      }
                    >
                      <action.icon className="size-4" />
                    </IconActionButton>
                  ))}
                </div>
                {!enoughLayersToDistribute && (
                  <InlineMessage>Distribute requires at least three layers.</InlineMessage>
                )}
              </Section>
              <Separator />
            </>
          )}

          {canReleaseClipMask ? (
            <>
              <Section title="Clipping">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReleaseClipMask}
                  className="h-10 rounded-xl border-border bg-background px-3 text-left transition hover:bg-accent/40"
                >
                  <span className="flex w-full items-center gap-2.5">
                    <ScissorsLineDashed className="size-4" />
                    <span className="flex flex-col items-start leading-none">
                      <span className="text-sm font-semibold uppercase">
                        Release Clipping Mask
                      </span>
                      <span className="mt-1 text-xs font-normal text-muted-foreground">
                        {layer?.isClipMask
                          ? 'Remove this mask from all clipped layers'
                          : `Detach from ${layer?.clipPathLayerId}`}
                      </span>
                    </span>
                  </span>
                </Button>
              </Section>
              <Separator />
            </>
          ) : null}

          {layer.path && (
            <>
              <Section title="Path">
                <ReadOnlyField
                  label="d"
                  value={
                    layer.path.d.length > 60
                      ? layer.path.d.slice(0, 60) + '...'
                      : layer.path.d
                  }
                  mono
                />
                {layer.path.fillRule && (
                  <ReadOnlyField label="Fill Rule" value={layer.path.fillRule} />
                )}
              </Section>
              <Separator />
            </>
          )}

          <Section title="Style">
            <PaintField
              label="Fill"
              paint={layer.style.fill}
              colorTokens={colorTokens}
              fillModeOptions
              onChange={(paint) =>
                patchStyle(currentIconId, currentStateId, layer.id, {
                  fill: paint,
                })
              }
            />
            <PaintField
              label="Stroke"
              paint={layer.style.stroke}
              colorTokens={colorTokens}
              onChange={(paint) =>
                patchStyle(currentIconId, currentStateId, layer.id, {
                  stroke: paint,
                })
              }
            />
            <NumberField
              label="Stroke Width"
              value={layer.style.strokeWidth}
              onChange={(v) =>
                patchStyle(currentIconId, currentStateId, layer.id, {
                  strokeWidth: v,
                })
              }
            />
            <SelectField
              label="Line Cap"
              value={layer.style.lineCap ?? 'butt'}
              options={[
                ['butt', 'Butt'],
                ['round', 'Round'],
                ['square', 'Square'],
              ]}
              onChange={(value) =>
                patchStyle(currentIconId, currentStateId, layer.id, {
                  lineCap: value as Layer['style']['lineCap'],
                })
              }
            />
            <SelectField
              label="Line Join"
              value={layer.style.lineJoin ?? 'miter'}
              options={[
                ['miter', 'Miter'],
                ['round', 'Round'],
                ['bevel', 'Bevel'],
              ]}
              onChange={(value) =>
                patchStyle(currentIconId, currentStateId, layer.id, {
                  lineJoin: value as Layer['style']['lineJoin'],
                })
              }
            />
            <NumberField
              label="Fill Opacity"
              value={layer.style.fillOpacity}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) =>
                patchStyle(currentIconId, currentStateId, layer.id, {
                  fillOpacity: v,
                })
              }
            />
            <NumberField
              label="Stroke Opacity"
              value={layer.style.strokeOpacity}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) =>
                patchStyle(currentIconId, currentStateId, layer.id, {
                  strokeOpacity: v,
                })
              }
            />
          </Section>

          <Separator />

          <Section title="Vector">
            {pointContext.count === 0 ? (
              <InlineMessage>
                Select one or more anchor points on the canvas to edit vector positions and handles.
              </InlineMessage>
            ) : (
              <>
                <div className="flex items-center gap-1">
                  {POINT_ALIGN_ACTIONS.slice(0, 3).map((action) => (
                    <IconActionButton
                      key={`${action.axis}-${action.anchor}`}
                      label={action.label}
                      disabled={!canAlignPoints}
                      onClick={() => alignSelectedPoints(action.axis, action.anchor)}
                    >
                      <action.icon className="size-4" />
                    </IconActionButton>
                  ))}
                  <div className="mx-1 h-6 w-px bg-border/70" />
                  {POINT_ALIGN_ACTIONS.slice(3).map((action) => (
                    <IconActionButton
                      key={`${action.axis}-${action.anchor}`}
                      label={action.label}
                      disabled={!canAlignPoints}
                      onClick={() => alignSelectedPoints(action.axis, action.anchor)}
                    >
                      <action.icon className="size-4" />
                    </IconActionButton>
                  ))}
                  <div className="mx-1 h-6 w-px bg-border/70" />
                  {POINT_DISTRIBUTE_ACTIONS.map((action) => (
                    <IconActionButton
                      key={action.axis}
                      label={action.label}
                      disabled={!canDistributePoints}
                      onClick={() => distributeSelectedPoints(action.axis)}
                    >
                      <Minus className={`size-4 ${action.rotate}`} />
                    </IconActionButton>
                  ))}
                </div>

                <InlineStat>
                  {pointContext.count} point{pointContext.count > 1 ? 's' : ''} selected
                </InlineStat>

                <div className="grid grid-cols-2 gap-2">
                  <AxisField
                    label="X"
                    value={pointContext.xMixed ? undefined : pointContext.x}
                    placeholder={pointContext.xMixed ? 'Mixed' : undefined}
                    disabled={pointContext.count === 0}
                    onChange={(v) =>
                      patchSelectedPoints(currentIconId, currentStateId, layer.id, selection.pointIds, (pt) => {
                        translatePointPosition(pt, v - pt.position.x, 0);
                      })
                    }
                  />
                  <AxisField
                    label="Y"
                    value={pointContext.yMixed ? undefined : pointContext.y}
                    placeholder={pointContext.yMixed ? 'Mixed' : undefined}
                    disabled={pointContext.count === 0}
                    onChange={(v) =>
                      patchSelectedPoints(currentIconId, currentStateId, layer.id, selection.pointIds, (pt) => {
                        translatePointPosition(pt, 0, v - pt.position.y);
                      })
                    }
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="w-20 shrink-0 text-xs text-muted-foreground">
                    Type
                  </Label>
                  <div className="flex flex-1 items-center gap-1">
                    {NODE_TYPE_OPTIONS.map((option) => (
                      <NodeTypeButton
                        key={option.value}
                        label={option.label}
                        active={isVisualNodeTypeActive(pointContext.nodeType, option.value)}
                        disabled={pointContext.count === 0}
                        onClick={() => setSelectedPointType(option.value)}
                      >
                        {option.glyph}
                      </NodeTypeButton>
                    ))}
                  </div>
                </div>

                <IconNumberField
                  label="Radius"
                  icon="⌒"
                  value={pointContext.radius}
                  min={0}
                  step={0.25}
                  disabled={pointContext.count === 0}
                  onChange={(v) =>
                    applyPointRadius(currentIconId, currentStateId, layer.id, selection.pointIds, v)
                  }
                />

                {hasSinglePointSelection && (
                  <div className="grid grid-cols-2 gap-2">
                    <AxisField
                      label="In X"
                      value={pointContext.handleInX}
                      disabled={!hasSinglePointSelection || !pointContext.hasHandleIn}
                      onChange={(v) =>
                        updateSelectedHandle(
                          currentIconId,
                          currentStateId,
                          layer.id,
                          selection.pointIds,
                          pointContext.nodeType,
                          'in',
                          'x',
                          v,
                        )
                      }
                    />
                    <AxisField
                      label="In Y"
                      value={pointContext.handleInY}
                      disabled={!hasSinglePointSelection || !pointContext.hasHandleIn}
                      onChange={(v) =>
                        updateSelectedHandle(
                          currentIconId,
                          currentStateId,
                          layer.id,
                          selection.pointIds,
                          pointContext.nodeType,
                          'in',
                          'y',
                          v,
                        )
                      }
                    />
                    <AxisField
                      label="Out X"
                      value={pointContext.handleOutX}
                      disabled={!hasSinglePointSelection || !pointContext.hasHandleOut}
                      onChange={(v) =>
                        updateSelectedHandle(
                          currentIconId,
                          currentStateId,
                          layer.id,
                          selection.pointIds,
                          pointContext.nodeType,
                          'out',
                          'x',
                          v,
                        )
                      }
                    />
                    <AxisField
                      label="Out Y"
                      value={pointContext.handleOutY}
                      disabled={!hasSinglePointSelection || !pointContext.hasHandleOut}
                      onChange={(v) =>
                        updateSelectedHandle(
                          currentIconId,
                          currentStateId,
                          layer.id,
                          selection.pointIds,
                          pointContext.nodeType,
                          'out',
                          'y',
                          v,
                        )
                      }
                    />
                  </div>
                )}
              </>
            )}
          </Section>

          <Separator />

          <Section title="Transform">
            <NumberField
              label="X"
              value={layer.transform?.x}
              onChange={(v) =>
                patchTransform(currentIconId, currentStateId, layer.id, {
                  x: v,
                })
              }
            />
            <NumberField
              label="Y"
              value={layer.transform?.y}
              onChange={(v) =>
                patchTransform(currentIconId, currentStateId, layer.id, {
                  y: v,
                })
              }
            />
            <NumberField
              label="Rotate"
              value={layer.transform?.rotate}
              onChange={(v) =>
                patchTransform(currentIconId, currentStateId, layer.id, {
                  rotate: v,
                })
              }
            />
            <NumberField
              label="Scale X"
              value={layer.transform?.scaleX}
              step={0.1}
              onChange={(v) =>
                patchTransform(currentIconId, currentStateId, layer.id, {
                  scaleX: v,
                })
              }
            />
            <NumberField
              label="Scale Y"
              value={layer.transform?.scaleY}
              step={0.1}
              onChange={(v) =>
                patchTransform(currentIconId, currentStateId, layer.id, {
                  scaleY: v,
                })
              }
            />
          </Section>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function patchStyle(
  iconId: string | null,
  stateId: string | null,
  layerId: string,
  stylePatch: Partial<Layer['style']>,
) {
  if (!iconId || !stateId) return;
  const state = editorStore.getState();
  const icon = state.project?.icons[iconId];
  const st = state.currentVariantId ? icon?.variants[state.currentVariantId]?.states[stateId] : null;
  const layer = st?.layers[layerId];
  if (!layer) return;

  state.patchLayer(iconId, stateId, layerId, {
    style: { ...layer.style, ...stylePatch },
  });
}

function patchTransform(
  iconId: string | null,
  stateId: string | null,
  layerId: string,
  transformPatch: Partial<NonNullable<Layer['transform']>>,
) {
  if (!iconId || !stateId) return;
  const state = editorStore.getState();
  const icon = state.project?.icons[iconId];
  const st = state.currentVariantId ? icon?.variants[state.currentVariantId]?.states[stateId] : null;
  const layer = st?.layers[layerId];
  if (!layer) return;

  state.patchLayer(iconId, stateId, layerId, {
    transform: { ...(layer.transform ?? {}), ...transformPatch },
  });
}

type EditablePoint = {
  position: { x: number; y: number };
  handleIn: { x: number; y: number } | null;
  handleOut: { x: number; y: number } | null;
  nodeType: NodeType;
  segment: PathSegment | null;
};

type ResolvedEditablePoint = {
  point: EditablePoint;
  subPath: SubPath;
  pointIndex: number;
};

function patchSelectedPoints(
  iconId: string | null,
  stateId: string | null,
  layerId: string,
  pointIds: string[],
  updater: (point: EditablePoint, resolved: ResolvedEditablePoint) => void,
) {
  if (!iconId || !stateId || pointIds.length === 0) return;
  const state = editorStore.getState();
  const icon = state.project?.icons[iconId];
  const st = state.currentVariantId ? icon?.variants[state.currentVariantId]?.states[stateId] : null;
  const layer = st?.layers[layerId];
  const d = layer?.path?.d;
  if (!layer || !d || !isPathDirectlyEditable(d)) return;

  const path = parseSvgPath(d);
  for (const pointId of pointIds) {
    const resolved = findPointByKey(path, pointId);
    if (resolved) updater(resolved.point as EditablePoint, resolved);
  }

  state.patchLayer(iconId, stateId, layerId, {
    path: { ...layer.path, d: serializePath(path) },
  });
}

function applyPointRadius(
  iconId: string | null,
  stateId: string | null,
  layerId: string,
  pointIds: string[],
  radius: number,
) {
  patchSelectedPoints(iconId, stateId, layerId, pointIds, (pt, resolved) => {
    if (radius <= 0) {
      pt.handleIn = null;
      pt.handleOut = null;
      pt.nodeType = 'static';
      pt.segment = { type: 'line' };
      return;
    }

    pt.nodeType = 'smooth';
    pt.segment = { type: 'cubic' };
    const direction = getPointBisectorDirection(resolved.subPath, resolved.pointIndex);
    pt.handleIn = {
      x: pt.position.x - direction.x * radius,
      y: pt.position.y - direction.y * radius,
    };
    pt.handleOut = {
      x: pt.position.x + direction.x * radius,
      y: pt.position.y + direction.y * radius,
    };
  });
}

function getSelectedPointContext(layer: Layer | null, pointIds: string[]) {
  const base = {
    count: 0,
    x: undefined as number | undefined,
    y: undefined as number | undefined,
    xMixed: false,
    yMixed: false,
    radius: undefined as number | undefined,
    nodeType: null as NodeType | null,
    handleInX: undefined as number | undefined,
    handleInY: undefined as number | undefined,
    handleOutX: undefined as number | undefined,
    handleOutY: undefined as number | undefined,
    hasHandleIn: false,
    hasHandleOut: false,
  };

  if (!layer) return base;

  const d = layer.path?.d;
  if (!d || !isPathDirectlyEditable(d) || pointIds.length === 0) return base;

  const path = parseSvgPath(d);
  const points = pointIds
    .map((pointId) => findPointByKey(path, pointId))
    .filter((pt): pt is NonNullable<typeof pt> => Boolean(pt))
    .map((resolved) => resolved.point);

  if (points.length === 0) return base;

  const first = points[0];
  const xMixed = points.some((point) => point.position.x !== first.position.x);
  const yMixed = points.some((point) => point.position.y !== first.position.y);
  const inferredTypes = points.map((point) => inferPointNodeType(point as EditablePoint));
  const nodeType = inferredTypes.every((type) => type === inferredTypes[0])
    ? inferredTypes[0]
    : null;
  const firstRadius =
    first.handleOut && first.handleIn
      ? (distance(first.handleOut, first.position) + distance(first.handleIn, first.position)) / 2
      : first.handleOut
        ? distance(first.handleOut, first.position)
        : first.handleIn
          ? distance(first.handleIn, first.position)
          : undefined;
  const radius = points.every((point) => getPointRadius(point) === firstRadius)
    ? firstRadius
    : undefined;

  return {
    count: points.length,
    x: xMixed ? undefined : first.position.x,
    y: yMixed ? undefined : first.position.y,
    xMixed,
    yMixed,
    radius,
    nodeType,
    handleInX: first.handleIn?.x,
    handleInY: first.handleIn?.y,
    handleOutX: first.handleOut?.x,
    handleOutY: first.handleOut?.y,
    hasHandleIn: Boolean(first.handleIn),
    hasHandleOut: Boolean(first.handleOut),
  };
}

function findPointByKey(path: ReturnType<typeof parseSvgPath>, key: string) {
  const [subPathRaw, pointRaw] = key.split(':');
  const subPathIndex = Number(subPathRaw);
  const pointIndex = Number(pointRaw);
  if (!Number.isInteger(subPathIndex) || !Number.isInteger(pointIndex)) return null;

  const subPath = path.subPaths[subPathIndex];
  const point = subPath?.points[pointIndex];
  if (!subPath || !point) return null;
  return { point, subPath, pointIndex };
}

function updateSelectedHandle(
  iconId: string | null,
  stateId: string | null,
  layerId: string,
  pointIds: string[],
  nodeType: NodeType | null,
  handle: 'in' | 'out',
  axis: 'x' | 'y',
  value: number,
) {
  patchSelectedPoints(iconId, stateId, layerId, pointIds, (pt) => {
    const targetKey = handle === 'in' ? 'handleIn' : 'handleOut';
    const oppositeKey = handle === 'in' ? 'handleOut' : 'handleIn';
    const targetHandle = pt[targetKey] ?? { x: pt.position.x, y: pt.position.y };
    pt[targetKey] = { ...targetHandle, [axis]: value };

    if (nodeType === 'symmetric' && pt[targetKey]) {
      const dx = pt[targetKey]!.x - pt.position.x;
      const dy = pt[targetKey]!.y - pt.position.y;
      pt[oppositeKey] = {
        x: pt.position.x - dx,
        y: pt.position.y - dy,
      };
      pt.nodeType = 'symmetric';
      pt.segment = { type: 'cubic' };
      return;
    }

    if (!pt.handleIn && !pt.handleOut) {
      pt.nodeType = 'static';
      pt.segment = { type: 'line' };
      return;
    }

    pt.nodeType = pt.handleIn && pt.handleOut ? 'smooth' : 'corner';
    pt.segment = { type: 'cubic' };
  });
}

function translatePointPosition(point: EditablePoint, dx: number, dy: number) {
  point.position.x += dx;
  point.position.y += dy;
  if (point.handleIn) {
    point.handleIn.x += dx;
    point.handleIn.y += dy;
  }
  if (point.handleOut) {
    point.handleOut.x += dx;
    point.handleOut.y += dy;
  }
}

function getPointBisectorDirection(subPath: SubPath, pointIndex: number) {
  const point = subPath.points[pointIndex];
  const prev = getNeighborPoint(subPath, pointIndex, -1);
  const next = getNeighborPoint(subPath, pointIndex, 1);

  const incoming = prev
    ? normalize({
        x: point.position.x - prev.position.x,
        y: point.position.y - prev.position.y,
      })
    : null;
  const outgoing = next
    ? normalize({
        x: next.position.x - point.position.x,
        y: next.position.y - point.position.y,
      })
    : null;

  if (incoming && outgoing) {
    const bisector = normalize({
      x: incoming.x + outgoing.x,
      y: incoming.y + outgoing.y,
    });
    if (bisector) return bisector;
  }

  return outgoing ?? incoming ?? { x: 1, y: 0 };
}

function getNeighborPoint(subPath: SubPath, pointIndex: number, direction: -1 | 1) {
  const nextIndex = pointIndex + direction;
  if (nextIndex >= 0 && nextIndex < subPath.points.length) {
    return subPath.points[nextIndex];
  }

  if (!subPath.closed || subPath.points.length === 0) return null;
  return direction === -1
    ? subPath.points[subPath.points.length - 1]
    : subPath.points[0];
}

function normalize(vector: { x: number; y: number }) {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= Number.EPSILON) return null;
  return { x: vector.x / length, y: vector.y / length };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getPointRadius(point: EditablePoint) {
  if (point.handleIn && point.handleOut) {
    return (distance(point.handleIn, point.position) + distance(point.handleOut, point.position)) / 2;
  }
  if (point.handleIn) return distance(point.handleIn, point.position);
  if (point.handleOut) return distance(point.handleOut, point.position);
  return undefined;
}

function inferPointNodeType(point: EditablePoint): NodeType {
  if (!point.handleIn && !point.handleOut) return 'static';
  if (point.handleIn && point.handleOut) {
    const inDx = point.handleIn.x - point.position.x;
    const inDy = point.handleIn.y - point.position.y;
    const outDx = point.handleOut.x - point.position.x;
    const outDy = point.handleOut.y - point.position.y;
    const mirrored =
      Math.abs(inDx + outDx) <= 0.001 &&
      Math.abs(inDy + outDy) <= 0.001;
    const equalLength =
      Math.abs(Math.hypot(inDx, inDy) - Math.hypot(outDx, outDy)) <= 0.001;
    if (mirrored && equalLength) return 'symmetric';
  }
  return 'smooth';
}

function isVisualNodeTypeActive(
  current: NodeType | null,
  option: (typeof NODE_TYPE_OPTIONS)[number]['value'],
) {
  if (option === 'static') {
    return current === 'static' || current === 'corner';
  }
  return current === option;
}

function formatVariantViewBox(variant: Variant) {
  return variant.viewBox.join(' ');
}

function scaleVariantViewBox(
  sourceViewBox: [number, number, number, number] | undefined,
  size: number,
): [number, number, number, number] {
  if (!sourceViewBox) {
    return [0, 0, size, size];
  }

  const sourceSize = Math.max(sourceViewBox[2], sourceViewBox[3], 1);
  const scale = size / sourceSize;
  return [
    Number((sourceViewBox[0] * scale).toFixed(3)),
    Number((sourceViewBox[1] * scale).toFixed(3)),
    Number((sourceViewBox[2] * scale).toFixed(3)),
    Number((sourceViewBox[3] * scale).toFixed(3)),
  ];
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-semibold uppercase text-muted-foreground">
        {title}
      </span>
      {children}
    </div>
  );
}

function IconActionButton({
  label,
  children,
  disabled,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  );
}

function ReadOnlyField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <Label className="text-sm uppercase text-muted-foreground">
        {label}
      </Label>
      <span
        className={`truncate rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-xs ${mono ? 'font-mono' : ''} text-foreground`}
      >
        {value}
      </span>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const num = parseFloat(e.target.value);
      if (!isNaN(num)) onChange(num);
    },
    [onChange],
  );

  return (
    <div className="grid gap-1">
      <Label className="text-sm uppercase text-muted-foreground">
        {label}
      </Label>
      <Input
        type="number"
        value={value ?? ''}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="h-9 rounded-xl bg-input text-xs"
      />
    </div>
  );
}

function InlineMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function InlineStat({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/50 px-3 py-2 text-sm font-medium text-foreground/80">
      {children}
    </div>
  );
}

function AxisField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const num = parseFloat(e.target.value);
      if (!Number.isNaN(num)) onChange(num);
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-1">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <Input
        type="text"
        inputMode="decimal"
        value={value ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handleChange}
        className="h-8 bg-input text-xs"
      />
    </div>
  );
}

function IconNumberField({
  label,
  icon,
  value,
  onChange,
  min,
  step,
  disabled,
}: {
  label: string;
  icon: string;
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="flex w-20 shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <span className="font-mono text-sm leading-none">{icon}</span>
        <span>{label}</span>
      </Label>
      <Input
        type="number"
        value={value ?? ''}
        min={min}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          const num = parseFloat(e.target.value);
          if (!Number.isNaN(num)) onChange(num);
        }}
        className="h-7 bg-input text-xs"
      />
    </div>
  );
}

function NodeTypeButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant={active ? 'secondary' : 'outline'}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="font-mono text-base"
    >
      {children}
    </Button>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="w-20 shrink-0 text-xs text-muted-foreground">
        {label}
      </Label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full rounded-xl border border-input bg-input/80 px-2 text-xs"
      >
        {options.map(([v, labelText]) => (
          <option key={v} value={v}>
            {labelText}
          </option>
        ))}
      </select>
    </div>
  );
}

type LinearGradientPaint = Extract<PaintRef, { mode: 'linearGradient' }>;
type RadialGradientPaint = Extract<PaintRef, { mode: 'radialGradient' }>;
type GradientPaint = LinearGradientPaint | RadialGradientPaint;

const DEFAULT_GRADIENT_STOPS: GradientStop[] = [
  { offset: 0, color: '#111111' },
  { offset: 1, color: '#ffffff' },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHexColor(value: string | undefined, fallback = '#000000') {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  return fallback;
}

function getSeedColor(paint: PaintRef | undefined, colorTokens: Record<string, string>) {
  if (paint?.mode === 'fixed') return normalizeHexColor(paint.value, '#111111');
  if (paint?.mode === 'token') {
    return normalizeHexColor(colorTokens[paint.token], '#111111');
  }
  if (paint?.mode === 'linearGradient' || paint?.mode === 'radialGradient') {
    return normalizeHexColor(paint.stops[0]?.color, '#111111');
  }
  return '#111111';
}

function createDefaultGradientPaint(
  mode: GradientPaint['mode'],
  seedColor = '#111111',
): GradientPaint {
  const normalizedSeed = normalizeHexColor(seedColor, '#111111');
  const secondaryColor = normalizedSeed.toLowerCase() === '#ffffff' ? '#111111' : '#ffffff';
  const stops = [
    { ...DEFAULT_GRADIENT_STOPS[0], color: normalizedSeed },
    { ...DEFAULT_GRADIENT_STOPS[1], color: secondaryColor },
  ];

  if (mode === 'linearGradient') {
    return { mode, angle: 90, stops };
  }

  return { mode, cx: 0.5, cy: 0.5, r: 0.5, stops };
}

function normalizeGradientStops(stops: GradientStop[]): GradientStop[] {
  return stops
    .map((stop, index) => ({
      stop: {
        offset: clamp(stop.offset, 0, 1),
        color: normalizeHexColor(stop.color, '#000000'),
        opacity:
          stop.opacity === undefined ? undefined : clamp(stop.opacity, 0, 1),
      },
      index,
    }))
    .sort((a, b) => a.stop.offset - b.stop.offset || a.index - b.index)
    .map(({ stop }) => stop);
}

function buildGradientPreview(stops: GradientStop[]) {
  if (stops.length === 0) {
    return 'linear-gradient(90deg, #111111 0%, #ffffff 100%)';
  }

  const segments = normalizeGradientStops(stops).map(
    (stop) => `${normalizeHexColor(stop.color, '#000000')} ${Math.round(stop.offset * 100)}%`,
  );

  return `linear-gradient(90deg, ${segments.join(', ')})`;
}

function PaintField({
  label,
  paint,
  colorTokens,
  fillModeOptions,
  onChange,
}: {
  label: string;
  paint: PaintRef | undefined;
  colorTokens: Record<string, string>;
  fillModeOptions?: boolean;
  onChange: (paint: PaintRef) => void;
}) {
  const tokenNames = Object.keys(colorTokens);
  const [selectedStopIndex, setSelectedStopIndex] = useState(0);
  const [draggingStopIndex, setDraggingStopIndex] = useState<number | null>(null);
  const gradientBarRef = useRef<HTMLDivElement | null>(null);

  const paintMode =
    paint?.mode === 'linearGradient' || paint?.mode === 'radialGradient'
      ? paint.mode
      : paint?.mode === 'fixed' && paint.value === 'none'
        ? 'none'
      : paint?.mode === 'currentColor'
        ? fillModeOptions
          ? 'currentFill'
          : 'currentColor'
        : 'solid';
  const solidValue =
    !fillModeOptions && paint?.mode === 'currentColor'
      ? 'currentColor'
      : paint?.mode === 'token'
        ? paint.token
        : paint?.mode === 'fixed'
          ? paint.value
          : normalizeHexColor(undefined);
  const gradientPaint =
    paint?.mode === 'linearGradient' || paint?.mode === 'radialGradient'
      ? paint
      : null;
  const boundedSelectedStopIndex = gradientPaint
    ? clamp(selectedStopIndex, 0, Math.max(gradientPaint.stops.length - 1, 0))
    : 0;
  const selectedStop = gradientPaint?.stops[boundedSelectedStopIndex] ?? null;

  const commitGradient = useCallback(
    (nextPaint: GradientPaint, nextSelectedIndex = boundedSelectedStopIndex) => {
      onChange({
        ...nextPaint,
        stops: normalizeGradientStops(nextPaint.stops),
      });
      setSelectedStopIndex(nextSelectedIndex);
    },
    [boundedSelectedStopIndex, onChange],
  );

  const updateGradientStop = useCallback(
    (index: number, updater: (stop: GradientStop) => GradientStop) => {
      if (!gradientPaint) return;
      const updatedStops = gradientPaint.stops.map((stop, stopIndex) =>
        stopIndex === index ? updater(stop) : stop,
      );
      const movedStop = updatedStops[index];
      const normalizedStops = normalizeGradientStops(updatedStops);
      const nextSelectedIndex = Math.max(
        movedStop ? normalizedStops.indexOf(movedStop) : -1,
        0,
      );
      commitGradient(
        {
          ...gradientPaint,
          stops: normalizedStops,
        },
        nextSelectedIndex,
      );
      if (draggingStopIndex !== null) {
        setDraggingStopIndex(nextSelectedIndex);
      }
    },
    [commitGradient, draggingStopIndex, gradientPaint],
  );

  useEffect(() => {
    if (draggingStopIndex === null || !gradientPaint) return;
    const activeDragIndex = draggingStopIndex;

    function handlePointerMove(event: PointerEvent) {
      const bar = gradientBarRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      if (rect.width <= 0) return;
      const nextOffset = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      updateGradientStop(activeDragIndex, (stop) => ({
        ...stop,
        offset: nextOffset,
      }));
    }

    function handlePointerUp() {
      setDraggingStopIndex(null);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingStopIndex, gradientPaint, updateGradientStop]);

  const handleRawInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.trim();
      if (val === 'currentColor') {
        onChange({ mode: 'currentColor' });
      } else if (tokenNames.includes(val)) {
        onChange({ mode: 'token', token: val });
      } else {
        onChange({ mode: 'fixed', value: val || 'none' });
      }
    },
    [onChange, tokenNames],
  );

  const handleModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const nextMode = e.target.value as
        | 'currentFill'
        | 'currentColor'
        | 'none'
        | 'solid'
        | GradientPaint['mode'];

      if (nextMode === 'currentFill' || nextMode === 'currentColor') {
        onChange({ mode: 'currentColor' });
        return;
      }

      if (nextMode === 'none') {
        onChange({ mode: 'fixed', value: 'none' });
        return;
      }

      if (nextMode === 'solid') {
        if (paint?.mode === 'token' || paint?.mode === 'fixed') {
          onChange(
            paint.mode === 'fixed' && paint.value === 'none'
              ? { mode: 'fixed', value: getSeedColor(paint, colorTokens) }
              : paint,
          );
          return;
        }
        onChange({ mode: 'fixed', value: getSeedColor(paint, colorTokens) });
        return;
      }

      const defaultGradient = createDefaultGradientPaint(
        nextMode,
        getSeedColor(paint, colorTokens),
      );
      onChange(defaultGradient);
      setSelectedStopIndex(0);
    },
    [colorTokens, onChange, paint],
  );

  const isColor =
    paint?.mode === 'fixed' &&
    /^#[0-9a-fA-F]{3,6}$/.test(paint.value);

  const handleAddStop = useCallback(() => {
    if (!gradientPaint) return;
    const activeIndex = boundedSelectedStopIndex;
    const activeStop = gradientPaint.stops[activeIndex];
    const nextStop = gradientPaint.stops[activeIndex + 1];
    const prevStop = gradientPaint.stops[activeIndex - 1];
    const nextOffset = nextStop
      ? (activeStop.offset + nextStop.offset) / 2
      : prevStop
        ? clamp((prevStop.offset + activeStop.offset) / 2, 0, 1)
        : clamp(activeStop.offset + 0.1, 0, 1);

    const newStop: GradientStop = {
      offset: nextOffset,
      color: selectedStop?.color ?? activeStop.color,
      opacity: selectedStop?.opacity ?? activeStop.opacity,
    };
    const updatedStops = [...gradientPaint.stops, newStop];
    const normalizedStops = normalizeGradientStops(updatedStops);
    const nextSelectedIndex = Math.max(
      normalizedStops.indexOf(newStop),
      0,
    );

    commitGradient(
      {
        ...gradientPaint,
        stops: normalizedStops,
      },
      nextSelectedIndex,
    );
  }, [
    boundedSelectedStopIndex,
    commitGradient,
    gradientPaint,
    selectedStop?.color,
    selectedStop?.opacity,
  ]);

  const handleRemoveStop = useCallback(() => {
    if (!gradientPaint || gradientPaint.stops.length <= 2) return;
    const updatedStops = gradientPaint.stops.filter(
      (_, index) => index !== boundedSelectedStopIndex,
    );
    commitGradient(
      {
        ...gradientPaint,
        stops: updatedStops,
      },
      clamp(boundedSelectedStopIndex - 1, 0, Math.max(updatedStops.length - 1, 0)),
    );
  }, [boundedSelectedStopIndex, commitGradient, gradientPaint]);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/35 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm uppercase text-muted-foreground">
          {label}
        </Label>
        <div className="flex items-center gap-1.5">
          <select
            value={paintMode}
            onChange={handleModeChange}
            className="h-8 min-w-[9rem] rounded-xl border border-input bg-input/80 px-2 text-xs"
            aria-label={`${label} mode`}
          >
            {fillModeOptions ? (
              <option value="currentFill">currentFill</option>
            ) : (
              <option value="currentColor">currentColor</option>
            )}
            <option value="none">None</option>
            <option value="solid">Solid / token</option>
            <option value="linearGradient">Linear gradient</option>
            <option value="radialGradient">Radial gradient</option>
          </select>
        </div>
      </div>

      {paintMode === 'none' ? (
        <InlineMessage>{label} is disabled for this layer.</InlineMessage>
      ) : !gradientPaint ? (
        <>
          <div className="flex items-center gap-1.5">
            {isColor && (
              <input
                type="color"
                value={normalizeHexColor(
                  paint?.mode === 'fixed' ? paint.value : undefined,
                )}
                onChange={(e) =>
                  onChange({ mode: 'fixed', value: e.target.value })
                }
                className="size-7 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                aria-label={`${label} color picker`}
              />
            )}
            <Input
              type="text"
              value={solidValue}
              onChange={handleRawInputChange}
              disabled={
                (fillModeOptions && paintMode === 'currentFill') ||
                (!fillModeOptions && paintMode === 'currentColor')
              }
              list={tokenNames.length > 0 ? `${label.toLowerCase()}-token-list` : undefined}
              placeholder={
                fillModeOptions
                  ? '#RRGGBB or token name'
                  : 'currentColor / #RRGGBB / token'
              }
              className="h-9 rounded-xl bg-input font-mono text-xs"
            />
            {tokenNames.length > 0 && (
              <datalist id={`${label.toLowerCase()}-token-list`}>
                {tokenNames.map((tokenName) => (
                  <option key={tokenName} value={tokenName} />
                ))}
              </datalist>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Use a hex value, <span className="font-mono">currentColor</span>, or a token name.
          </p>
        </>
      ) : (
          <>
            <div className="relative pt-8">
              <div
                ref={gradientBarRef}
                className="relative h-10 rounded-xl border border-border/80 bg-muted/40 shadow-inner"
                style={{ backgroundImage: buildGradientPreview(gradientPaint.stops) }}
              />
              {gradientPaint.stops.map((stop, index) => {
                const isSelected = index === boundedSelectedStopIndex;
                return (
                  <button
                    key={`${stop.offset}-${stop.color}-${index}`}
                    type="button"
                    className={cn(
                      'absolute top-8 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm transition',
                      isSelected
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-background/90',
                    )}
                    style={{
                      left: `${stop.offset * 100}%`,
                      backgroundColor: normalizeHexColor(stop.color, '#000000'),
                    }}
                    onClick={() => setSelectedStopIndex(index)}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      setSelectedStopIndex(index);
                      setDraggingStopIndex(index);
                    }}
                    aria-label={`${label} stop ${index + 1}`}
                    title={`Stop ${index + 1}`}
                  />
                );
              })}
              {selectedStop && (
                <input
                  type="color"
                  value={normalizeHexColor(selectedStop.color, '#000000')}
                  onChange={(e) =>
                    updateGradientStop(boundedSelectedStopIndex, (stop) => ({
                      ...stop,
                      color: e.target.value,
                    }))
                  }
                  className="absolute top-0 h-7 w-7 -translate-x-1/2 cursor-pointer rounded-md border border-border bg-background p-0.5 shadow-sm"
                  style={{ left: `${selectedStop.offset * 100}%` }}
                  aria-label={`${label} selected stop color`}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={handleAddStop}>
                Add stop
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRemoveStop}
                disabled={gradientPaint.stops.length <= 2}
              >
                Remove stop
              </Button>
              <span className="text-sm text-muted-foreground">
                Drag stops to change offset.
              </span>
            </div>

            {selectedStop && (
              <div className="grid grid-cols-3 gap-2">
                <GradientInput
                  label="Stop"
                  value={selectedStop.offset}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(value) =>
                    updateGradientStop(boundedSelectedStopIndex, (stop) => ({
                      ...stop,
                      offset: value,
                    }))
                  }
                />
                <GradientInput
                  label="Opacity"
                  value={selectedStop.opacity ?? 1}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(value) =>
                    updateGradientStop(boundedSelectedStopIndex, (stop) => ({
                      ...stop,
                      opacity: value,
                    }))
                  }
                />
                <GradientInput
                  label="Stops"
                  value={gradientPaint.stops.length}
                  disabled
                  onChange={() => {}}
                />
              </div>
            )}

            {gradientPaint.mode === 'linearGradient' ? (
              <div className="grid grid-cols-3 gap-2">
                <GradientInput
                  label="Angle"
                  value={gradientPaint.angle}
                  step={1}
                  onChange={(value) =>
                    commitGradient({
                      ...gradientPaint,
                      angle: value,
                    })
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <GradientInput
                  label="Center X"
                  value={gradientPaint.cx}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(value) =>
                    commitGradient({
                      ...gradientPaint,
                      cx: value,
                    })
                  }
                />
                <GradientInput
                  label="Center Y"
                  value={gradientPaint.cy}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(value) =>
                    commitGradient({
                      ...gradientPaint,
                      cy: value,
                    })
                  }
                />
                <GradientInput
                  label="Radius"
                  value={gradientPaint.r}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(value) =>
                    commitGradient({
                      ...gradientPaint,
                      r: value,
                    })
                  }
                />
              </div>
            )}
          </>
      )}
    </div>
  );
}

function GradientInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          const nextValue = parseFloat(event.target.value);
          if (!Number.isNaN(nextValue)) {
            onChange(nextValue);
          }
        }}
        className="h-8 bg-input text-xs"
      />
    </div>
  );
}
