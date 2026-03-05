'use client';

import { useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  useEditorStore,
  useSelection,
} from '@/lib/editor-store/hooks';
import { selectCurrentState } from '@/lib/editor-store/selectors';
import { editorStore } from '@/lib/editor-store/store';
import type { Layer, PaintRef } from '@/lib/schema/types';

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
      <div className="flex h-full flex-col">
        <div className="px-3 pt-3 pb-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Inspector
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-muted-foreground">Select a layer</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-3 pb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Inspector
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-4 px-3 pb-4">
          {/* Layer info */}
          <Section title="Layer">
            <ReadOnlyField label="ID" value={layer.id} />
            <ReadOnlyField label="Role" value={layer.role ?? 'none'} />
          </Section>

          <Separator />

          {/* Path */}
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

          {/* Style */}
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
          </Section>

          <Separator />

          {/* Transform */}
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

// ── Helper patch functions ──────────────────────────────────

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

// ── Reusable field components ────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
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
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
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
        className="h-7 text-xs bg-input"
      />
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
            className="h-7 rounded-md border border-input bg-input px-2 text-xs"
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
            className="size-6 cursor-pointer rounded border border-border bg-transparent p-0.5"
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
          className="h-7 text-xs font-mono bg-input"
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
