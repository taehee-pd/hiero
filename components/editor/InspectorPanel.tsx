'use client';

import {
  LoaderCircle,
  Minus,
  Shapes,
  SplitSquareHorizontal,
  Squircle,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  BetweenHorizontalStart,
  BetweenVerticalStart,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { ScrollArea } from '@/components/kibo-ui/scroll-area';
import { Input } from '@/components/kibo-ui/input';
import { Label } from '@/components/kibo-ui/label';
import { Button } from '@/components/kibo-ui/button';
import { toast } from '@/components/ui/use-toast';
import { alignLayers, distributeLayers } from '@/lib/editor-core';
import {
  useEditorStore,
  useSelection,
} from '@/lib/editor-store/hooks';
import { selectCurrentState } from '@/lib/editor-store/selectors';
import { editorStore } from '@/lib/editor-store/store';
import type { BooleanMode } from '@/lib/editor-core/boolean-ops';
import type { Layer, PaintRef } from '@/lib/schema/types';
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

export function InspectorPanel() {
  const selection = useSelection();
  const currentState = useEditorStore(selectCurrentState);
  const applyBoolean = useEditorStore((s) => s.applyBoolean);
  const currentIconId = useEditorStore((s) => s.currentIconId);
  const currentStateId = useEditorStore((s) => s.currentStateId);
  const colorTokens = useEditorStore(
    (s) => s.project?.tokenSet?.colors ?? {},
  );
  const [pendingBooleanMode, setPendingBooleanMode] = useState<BooleanMode | null>(null);

  const selectedLayerId = selection.layerIds[0] ?? null;
  const layer =
    currentState && selectedLayerId
      ? currentState.layers[selectedLayerId] ?? null
      : null;
  const multipleLayersSelected = selection.layerIds.length > 1;
  const hasBooleanableSelection = Boolean(
    currentState &&
      multipleLayersSelected &&
      selection.layerIds.every((layerId) => Boolean(currentState.layers[layerId]?.path?.d)),
  );
  const booleanDisabled = !hasBooleanableSelection || pendingBooleanMode !== null;
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

  if (!layer) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="workspace-panel-header px-4 py-3">
          <p className="text-sm font-medium text-foreground">Inspector</p>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-6">
          <div className="workspace-empty-state w-full rounded-md px-4 py-6 text-center text-sm text-muted-foreground">
            No selection
          </div>
        </div>
      </div>
    );
  }

  const pointContext = getSelectedPointContext(layer, selection.pointIds);
  const hasEditablePath = Boolean(layer.path?.d && isPathDirectlyEditable(layer.path.d));
  const pathPreview = layer.path?.d
    ? layer.path.d.length > 84
      ? `${layer.path.d.slice(0, 84)}...`
      : layer.path.d
    : 'No path';
  const enoughLayersToDistribute = selection.layerIds.length > 2;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="workspace-panel-header px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{layer.id}</p>
            <p className="mt-1 text-xs text-muted-foreground">{layer.role ?? 'layer'}</p>
          </div>
          <span className="text-xs text-muted-foreground">{selection.layerIds.length} selected</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <InspectorStat label="Path" value={layer.path ? 'Ready' : 'Missing'} />
          <InspectorStat label="Points" value={pointContext.count.toString().padStart(2, '0')} />
          <InspectorStat label="Mode" value={hasEditablePath ? 'Edit' : 'Mixed'} />
        </div>
      </div>
      <ScrollArea className="workspace-scroll min-h-0 flex-1">
        <div className="flex flex-col gap-3 px-4 py-4">
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
                      'h-10 rounded-md border-border bg-background px-3 text-left transition hover:bg-accent/40',
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
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">{label}</span>
                        <span className="mt-1 text-[10px] font-normal text-muted-foreground">{isPending ? 'Applying...' : ''}</span>
                      </span>
                    </span>
                  </Button>
                );
              })}
            </div>
            {!hasBooleanableSelection ? (
              <p className="text-[11px] text-muted-foreground">Select at least two path layers.</p>
            ) : null}
          </Section>

          {multipleLayersSelected ? (
            <Section title="Align">
              <div className="grid grid-cols-3 gap-2">
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
              <div className="grid grid-cols-2 gap-2">
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
              {!enoughLayersToDistribute ? (
                <p className="text-[11px] text-muted-foreground">Distribute requires 3+ layers.</p>
              ) : null}
            </Section>
          ) : null}
          
          <Section title="Layer">
            <div className="grid gap-2 sm:grid-cols-2">
              <ReadOnlyField label="ID" value={layer.id} />
              <ReadOnlyField label="Role" value={layer.role ?? 'none'} />
            </div>
          </Section>

          {layer.path && (
            <Section title="Path">
              <ReadOnlyField label="Path Data" value={pathPreview} mono />
              {layer.path.fillRule && (
                <ReadOnlyField label="Fill Rule" value={layer.path.fillRule} />
              )}
            </Section>
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
            <div className="grid gap-2 sm:grid-cols-2">
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
            </div>
          </Section>

          <Section title="Points">
            <div className="grid gap-2 sm:grid-cols-2">
              <ReadOnlyField label="Selected" value={String(pointContext.count)} />
              <SelectField
                label="Point Type"
                value={pointContext.nodeType}
                disabled={pointContext.count === 0}
                options={[
                  ['corner', 'Corner'],
                  ['smooth', 'Smooth'],
                  ['symmetric', 'Symmetric'],
                ]}
                onChange={(value) =>
                  patchSelectedPoints(currentIconId, currentStateId, layer.id, selection.pointIds, (pt) => {
                    pt.nodeType = value as typeof pt.nodeType;
                    if (value === 'corner') {
                      pt.handleIn = null;
                      pt.handleOut = null;
                    }
                  })
                }
              />
              <NumberField
                label="X"
                value={pointContext.x}
                disabled={pointContext.count === 0}
                onChange={(v) =>
                  patchSelectedPoints(currentIconId, currentStateId, layer.id, selection.pointIds, (pt) => {
                    pt.position.x = v;
                  })
                }
              />
              <NumberField
                label="Y"
                value={pointContext.y}
                disabled={pointContext.count === 0}
                onChange={(v) =>
                  patchSelectedPoints(currentIconId, currentStateId, layer.id, selection.pointIds, (pt) => {
                    pt.position.y = v;
                  })
                }
              />
              <NumberField
                label="Radius"
                value={pointContext.radius}
                min={0}
                step={0.25}
                disabled={pointContext.count === 0}
                onChange={(v) =>
                  applyPointRadius(currentIconId, currentStateId, layer.id, selection.pointIds, v)
                }
              />
              <ReadOnlyField
                label="Editing"
                value={pointContext.count === 1 ? 'Single point' : pointContext.count > 1 ? 'Multi-point' : 'Inactive'}
              />
              <NumberField
                label="In X"
                value={pointContext.handleInX}
                disabled={pointContext.count !== 1}
                onChange={(v) =>
                  patchSelectedPoints(currentIconId, currentStateId, layer.id, selection.pointIds, (pt) => {
                    pt.handleIn = { x: v, y: pt.handleIn?.y ?? pt.position.y };
                  })
                }
              />
              <NumberField
                label="In Y"
                value={pointContext.handleInY}
                disabled={pointContext.count !== 1}
                onChange={(v) =>
                  patchSelectedPoints(currentIconId, currentStateId, layer.id, selection.pointIds, (pt) => {
                    pt.handleIn = { x: pt.handleIn?.x ?? pt.position.x, y: v };
                  })
                }
              />
              <NumberField
                label="Out X"
                value={pointContext.handleOutX}
                disabled={pointContext.count !== 1}
                onChange={(v) =>
                  patchSelectedPoints(currentIconId, currentStateId, layer.id, selection.pointIds, (pt) => {
                    pt.handleOut = { x: v, y: pt.handleOut?.y ?? pt.position.y };
                  })
                }
              />
              <NumberField
                label="Out Y"
                value={pointContext.handleOutY}
                disabled={pointContext.count !== 1}
                onChange={(v) =>
                  patchSelectedPoints(currentIconId, currentStateId, layer.id, selection.pointIds, (pt) => {
                    pt.handleOut = { x: pt.handleOut?.x ?? pt.position.x, y: v };
                  })
                }
              />
            </div>
          </Section>

          <Section title="Transform">
            <div className="grid gap-2 sm:grid-cols-2">
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
            </div>
          </Section>
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
  const st = icon?.states[stateId];
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
  const st = icon?.states[stateId];
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
  nodeType: 'smooth' | 'corner' | 'symmetric';
};

function patchSelectedPoints(
  iconId: string | null,
  stateId: string | null,
  layerId: string,
  pointIds: string[],
  updater: (point: EditablePoint) => void,
) {
  if (!iconId || !stateId || pointIds.length === 0) return;
  const state = editorStore.getState();
  const icon = state.project?.icons[iconId];
  const st = icon?.states[stateId];
  const layer = st?.layers[layerId];
  const d = layer?.path?.d;
  if (!layer || !d || !isPathDirectlyEditable(d)) return;

  const path = parseSvgPath(d);
  for (const pointId of pointIds) {
    const point = findPointByKey(path, pointId);
    if (point) updater(point as EditablePoint);
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
  patchSelectedPoints(iconId, stateId, layerId, pointIds, (pt) => {
    if (radius <= 0) {
      pt.handleIn = null;
      pt.handleOut = null;
      pt.nodeType = 'corner';
      return;
    }

    pt.nodeType = 'smooth';
    pt.handleIn = { x: pt.position.x - radius, y: pt.position.y };
    pt.handleOut = { x: pt.position.x + radius, y: pt.position.y };
  });
}

function getSelectedPointContext(layer: Layer, pointIds: string[]) {
  const base = {
    count: 0,
    x: undefined as number | undefined,
    y: undefined as number | undefined,
    radius: undefined as number | undefined,
    nodeType: 'corner',
    handleInX: undefined as number | undefined,
    handleInY: undefined as number | undefined,
    handleOutX: undefined as number | undefined,
    handleOutY: undefined as number | undefined,
  };

  const d = layer.path?.d;
  if (!d || !isPathDirectlyEditable(d) || pointIds.length === 0) return base;

  const path = parseSvgPath(d);
  const points = pointIds
    .map((pointId) => findPointByKey(path, pointId))
    .filter((pt): pt is NonNullable<typeof pt> => Boolean(pt));

  if (points.length === 0) return base;

  const first = points[0];
  const radius =
    first.handleOut && first.handleIn
      ? (Math.abs(first.handleOut.x - first.position.x) +
          Math.abs(first.position.x - first.handleIn.x)) /
        2
      : undefined;

  return {
    count: points.length,
    x: first.position.x,
    y: first.position.y,
    radius,
    nodeType: first.nodeType,
    handleInX: first.handleIn?.x,
    handleInY: first.handleIn?.y,
    handleOutX: first.handleOut?.x,
    handleOutY: first.handleOut?.y,
  };
}

function findPointByKey(path: ReturnType<typeof parseSvgPath>, key: string) {
  const [subPathRaw, pointRaw] = key.split(':');
  const subPathIndex = Number(subPathRaw);
  const pointIndex = Number(pointRaw);
  if (!Number.isInteger(subPathIndex) || !Number.isInteger(pointIndex)) return null;

  const subPath = path.subPaths[subPathIndex];
  return subPath?.points[pointIndex] ?? null;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="workspace-meta-card rounded-md p-3">
      <div className="mb-3">
        <p className="text-xs font-medium text-foreground">{title}</p>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

function InspectorStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-foreground">{value}</p>
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
      size="sm"
      variant="outline"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="h-10 rounded-md border-border bg-background px-0 transition hover:bg-accent/40"
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
    <div className="grid gap-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </Label>
      <span
        className={cn(
          'min-h-9 truncate rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground',
          mono && 'font-mono text-[11px]',
        )}
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
    <div className="grid gap-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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
        className="h-9 rounded-md border-border bg-background text-sm"
      />
    </div>
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
    <div className="grid gap-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </Label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
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
  const uniqueValue =
    !fillModeOptions && paint?.mode === 'currentColor'
      ? 'currentColor'
      : paint?.mode === 'token'
      ? paint.token
      : paint?.mode === 'fixed'
        ? paint.value
        : 'none';

  const paintKind =
    paint?.mode === 'currentColor'
      ? 'currentFill'
      : paint?.mode === 'token' || paint?.mode === 'fixed'
        ? 'unique'
        : 'currentFill';

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

  const handleKindChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const nextKind = e.target.value;
      if (nextKind === 'currentFill') {
        onChange({ mode: 'currentColor' });
        return;
      }

      if (paint?.mode === 'token' || paint?.mode === 'fixed') {
        onChange(paint);
      } else {
        onChange({ mode: 'fixed', value: '#000000' });
      }
    },
    [onChange, paint],
  );

  const isColor =
    paint?.mode === 'fixed' &&
    paint.value !== 'none' &&
    paint.value.startsWith('#');

  return (
    <div className="grid gap-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </Label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-background p-2">
        {fillModeOptions && (
          <select
            value={paintKind}
            onChange={handleKindChange}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            aria-label={`${label} mode`}
          >
            <option value="currentFill">currentFill</option>
            <option value="unique">Unique color</option>
          </select>
        )}
        {isColor && (
          <input
            type="color"
            value={paint.mode === 'fixed' ? paint.value : '#000000'}
            onChange={(e) =>
              onChange({ mode: 'fixed', value: e.target.value })
            }
            className="size-9 cursor-pointer rounded-md border border-border bg-transparent p-1"
            aria-label={`${label} color picker`}
          />
        )}
        <Input
          type="text"
          value={uniqueValue}
          onChange={handleRawInputChange}
          disabled={fillModeOptions && paintKind === 'currentFill'}
          list={tokenNames.length > 0 ? `${label.toLowerCase()}-token-list` : undefined}
          placeholder={fillModeOptions ? '#RRGGBB or token name' : 'currentColor / #RRGGBB / token'}
          className="h-9 min-w-[12rem] flex-1 rounded-md border-border bg-background font-mono text-[11px]"
        />
        {tokenNames.length > 0 && (
          <datalist id={`${label.toLowerCase()}-token-list`}>
            {tokenNames.map((tokenName) => (
              <option key={tokenName} value={tokenName} />
            ))}
          </datalist>
        )}
      </div>
    </div>
  );
}
