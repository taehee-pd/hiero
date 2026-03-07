'use client';

import { useCallback } from 'react';
import { ScrollArea } from '@/components/kibo-ui/scroll-area';
import { Input } from '@/components/kibo-ui/input';
import { Label } from '@/components/kibo-ui/label';
import { Separator } from '@/components/kibo-ui/separator';
import { Button } from '@/components/kibo-ui/button';
import {
  useEditorStore,
  useSelection,
} from '@/lib/editor-store/hooks';
import { selectCurrentState } from '@/lib/editor-store/selectors';
import { editorStore } from '@/lib/editor-store/store';
import type { Layer, PaintRef } from '@/lib/schema/types';
import { isPathDirectlyEditable, parseSvgPath, serializePath } from '@/lib/editor-core/parse';

export function InspectorPanel() {
  const selection = useSelection();
  const currentState = useEditorStore(selectCurrentState);
  const currentIconId = useEditorStore((s) => s.currentIconId);
  const currentStateId = useEditorStore((s) => s.currentStateId);
  const colorTokens = useEditorStore(
    (s) => s.project?.tokenSet?.colors ?? {},
  );

  const selectedLayerId = selection.layerIds[0] ?? null;
  const layer =
    currentState && selectedLayerId
      ? currentState.layers[selectedLayerId] ?? null
      : null;

  if (!layer) {
    return (
      <div className="flex h-full flex-col bg-transparent">
        <div className="px-4 pt-3 pb-2">
          <span className="text-sm font-semibold">Inspect</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-muted-foreground">No layer</p>
        </div>
      </div>
    );
  }

  const pointContext = getSelectedPointContext(layer, selection.pointIds);
  const multipleLayersSelected = selection.layerIds.length > 1;

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="px-4 pt-3 pb-2">
        <span className="text-sm font-semibold">Inspect</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 px-4 pb-4">
          <Section title="Layer">
            <ReadOnlyField label="ID" value={layer.id} />
            <ReadOnlyField label="Role" value={layer.role ?? 'none'} />
          </Section>

          <Separator />

          <Section title="Boolean">
            <div className="grid grid-cols-2 gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={!multipleLayersSelected}
                onClick={() =>
                  applyPathfinderCompound(currentIconId, currentStateId, selection.layerIds, 'unite')
                }
              >
                Unite
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!multipleLayersSelected}
                onClick={() =>
                  applyPathfinderCompound(currentIconId, currentStateId, selection.layerIds, 'subtract')
                }
              >
                Subtract
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!multipleLayersSelected}
                onClick={() =>
                  applyPathfinderCompound(currentIconId, currentStateId, selection.layerIds, 'intersect')
                }
              >
                Intersect
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!multipleLayersSelected}
                onClick={() =>
                  applyPathfinderCompound(currentIconId, currentStateId, selection.layerIds, 'exclude')
                }
              >
                Exclude
              </Button>
            </div>
            {!multipleLayersSelected && (
              <p className="text-[11px] text-muted-foreground">2+ layers</p>
            )}
          </Section>

          <Separator />

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

          <Section title="Points">
            <ReadOnlyField label="Selected" value={String(pointContext.count)} />
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

function applyPathfinderCompound(
  iconId: string | null,
  stateId: string | null,
  layerIds: string[],
  mode: 'unite' | 'subtract' | 'intersect' | 'exclude',
) {
  if (!iconId || !stateId || layerIds.length < 2) return;
  const state = editorStore.getState();
  const icon = state.project?.icons[iconId];
  const st = icon?.states[stateId];
  if (!st) return;

  const pathLayers = layerIds
    .map((id) => st.layers[id])
    .filter((l): l is Layer => Boolean(l?.path?.d));

  if (pathLayers.length < 2) return;

  const base = pathLayers[0];
  const combined = pathLayers.map((layer) => layer.path!.d).join(' ');
  const fillRule = mode === 'unite' ? 'nonzero' : 'evenodd';

  state.patchLayer(iconId, stateId, base.id, {
    path: { d: combined, fillRule },
  });

  for (let i = 1; i < pathLayers.length; i++) {
    state.setLayerVisibility(iconId, stateId, pathLayers[i].id, false);
  }
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
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </span>
      {children}
    </div>
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
    <div className="flex items-center gap-2">
      <Label className="w-20 shrink-0 text-xs text-muted-foreground">
        {label}
      </Label>
      <span
        className={`flex-1 truncate text-xs ${mono ? 'font-mono' : ''} text-foreground`}
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
    <div className="flex items-center gap-2">
      <Label className="w-20 shrink-0 text-xs text-muted-foreground">
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
        className="h-7 bg-input text-xs"
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
    <div className="flex items-center gap-2">
      <Label className="w-20 shrink-0 text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="flex flex-1 items-center gap-1.5">
        {fillModeOptions && (
          <select
            value={paintKind}
            onChange={handleKindChange}
            className="h-8 rounded-xl border border-input bg-input/80 px-2 text-xs"
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
            className="size-7 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
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
          className="h-7 bg-input font-mono text-xs"
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
