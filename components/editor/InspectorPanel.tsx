'use client';

import { useCallback } from 'react';
import {
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
} from 'lucide-react';
import { ScrollArea } from '@/components/kibo-ui/scroll-area';
import { Input } from '@/components/kibo-ui/input';
import { Label } from '@/components/kibo-ui/label';
import { Separator } from '@/components/kibo-ui/separator';
import { Button } from '@/components/kibo-ui/button';
import {
  alignLayers,
  alignSelectedPoints,
  distributeLayers,
  distributeSelectedPoints,
  setSelectedPointType,
} from '@/lib/editor-core';
import {
  useEditorActions,
  useEditorStore,
  useSelection,
} from '@/lib/editor-store/hooks';
import { selectCurrentState } from '@/lib/editor-store/selectors';
import { editorStore } from '@/lib/editor-store/store';
import type { Layer, PaintRef } from '@/lib/schema/types';
import type { NodeType, SubPath } from '@/lib/editor-core';
import { isPathDirectlyEditable, parseSvgPath, serializePath } from '@/lib/editor-core/parse';

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

const NODE_TYPE_OPTIONS = [
  { value: 'corner', label: 'Corner', glyph: '∟' },
  { value: 'smooth', label: 'Smooth', glyph: '∿' },
  { value: 'symmetric', label: 'Symmetric', glyph: '⇄' },
] as const;

export function InspectorPanel() {
  const tool = useEditorStore((s) => s.tool);
  const shapeSubTool = useEditorStore((s) => s.shapeSubTool);
  const shapePolygonSides = useEditorStore((s) => s.shapePolygonSides);
  const shapeStarPoints = useEditorStore((s) => s.shapeStarPoints);
  const selection = useSelection();
  const {
    setShapePolygonSides,
    setShapeStarPoints,
    setShapeSubTool,
  } = useEditorActions();
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
  const pointContext = layer
    ? getSelectedPointContext(layer, selection.pointIds)
    : getSelectedPointContext(null, []);
  const multipleLayersSelected = selection.layerIds.length > 1;
  const enoughLayersToDistribute = selection.layerIds.length > 2;
  const showShapeToolSettings = tool === 'shape';
  const canAlignPoints = pointContext.count >= 2;
  const canDistributePoints = pointContext.count >= 3;
  const hasSinglePointSelection = pointContext.count === 1;

  if (!layer && !showShapeToolSettings) {
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

  return (
    <div className="flex h-full flex-col bg-transparent">
      <div className="px-4 pt-3 pb-2">
        <span className="text-sm font-semibold">Inspect</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 px-4 pb-4">
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
                  <p className="text-[11px] text-muted-foreground">
                    Drag on the canvas to place a new {shapeSubTool}.
                  </p>
                )}
              </Section>
              {layer && <Separator />}
            </>
          )}

          {!layer ? null : (
            <>
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
                  <p className="text-[11px] text-muted-foreground">Distribute requires 3+ layers</p>
                )}
              </Section>
              <Separator />
            </>
          )}

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
                    active={pointContext.nodeType === option.value}
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
  nodeType: NodeType;
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
  const st = icon?.states[stateId];
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
      pt.nodeType = 'corner';
      return;
    }

    pt.nodeType = 'smooth';
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
    }
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
  if (!point.handleIn && !point.handleOut) return 'corner';
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
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
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
