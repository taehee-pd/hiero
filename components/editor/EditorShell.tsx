'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Blend,
  ChevronDown,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  FolderOpen,
  MousePointer2,
  PenTool,
  Plus,
  Search,
  Sparkles,
  Square,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { editorStore, type TransitionPreview } from '@/lib/editor-store/store';
import { buildLayerPanelRows, selectCurrentGuideMaster } from '@/lib/editor-store/selectors';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import { SAMPLE_WORKSPACE } from '@/lib/schema/sample-project';
import type { Icon, Layer, LayerBinding, PaintRef, RenderingMode, State, Transition, Variant } from '@/lib/schema/types';
import { clearCurrentProjectPath, exportSvg, isDesktop, saveProject } from '@/lib/platform/bridge';
import { buildEditorRoute, parseEditorSearchParam } from '@/lib/platform/routes';
import { exportSvgString } from '@/lib/export/export-svg';
import { exportSvgPackage } from '@/lib/export/export-svg-package';
import { exportRuntimeJson } from '@/lib/export/export-runtime-json';
import { generateIconLibrary } from '@/lib/export/export-react/generate-library';
import { createZipBlob } from '@/lib/export/export-react/zip';
import { handleEditorKeyDown } from '@/lib/editor-core/keyboard';
import { interpolateTransitionValues, resolveTransition } from '@/lib/runtime-core';
import { TitleTabBar } from '@/components/platform/TitleTabBar';
import { Canvas } from './Canvas';
import { ImportIconDialog } from './ImportIconDialog';

type LeftTab = 'layers' | 'variants';
type RightTab = 'inspect' | 'animation';
type DeleteIntent =
  | { type: 'state'; id: string }
  | { type: 'variant'; id: string }
  | { type: 'transition'; id: string };
type TransitionDraft = {
  from: string;
  to: string;
  durationMs: string;
  strategy: Transition['strategy'];
  easing: string;
};
type VariantEditorPatch = Partial<Pick<Variant, 'size' | 'renderingMode'>>;

const TOOL_ITEMS = [
  { tool: 'select', label: 'Select', icon: MousePointer2 },
  { tool: 'shape', label: 'Shape', icon: Square },
  { tool: 'pen', label: 'Pen', icon: PenTool },
] as const;

const RENDERING_MODE_OPTIONS: Array<{ value: RenderingMode; label: string }> = [
  { value: 'monochrome', label: 'Monochrome' },
  { value: 'hierarchical', label: 'Hierarchical' },
  { value: 'palette', label: 'Palette' },
  { value: 'multicolor', label: 'Multicolor' },
];

const TRANSITION_STRATEGIES: Transition['strategy'][] = [
  'bestGuessMorph',
  'strictMorph',
  'track',
  'replace',
];

const EASING_OPTIONS = ['ease-in-out', 'ease-out', 'ease-in', 'linear'] as const;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}

function formatVariantLabel(variant: { name?: string; size: number }) {
  const name = variant.name?.trim();
  if (!name || name === String(variant.size)) return `${variant.size}px`;
  return `${name} ${variant.size}px`;
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

function buildDefaultLayerBindings(
  fromState: State,
  toState: State,
  strategy: Transition['strategy'],
): LayerBinding[] {
  const sharedIds = Object.keys(fromState.layers).filter((layerId) => Boolean(toState.layers[layerId]));

  return sharedIds.map((layerId) => {
    if (strategy === 'strictMorph') {
      return { fromLayerId: layerId, toLayerId: layerId, morph: { topology: 'strict' } };
    }
    if (strategy === 'bestGuessMorph') {
      return { fromLayerId: layerId, toLayerId: layerId, morph: { topology: 'bestGuess' } };
    }
    if (strategy === 'track') {
      return { fromLayerId: layerId, toLayerId: layerId, tracks: [] };
    }
    return { fromLayerId: layerId, toLayerId: layerId };
  });
}

function buildTransitionPreview(
  transition: Transition,
  variant: Variant,
  progress: number,
): TransitionPreview | null {
  const fromState = variant.states[transition.from];
  const toState = variant.states[transition.to];
  if (!fromState || !toState) return null;

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const resolvedTransition = resolveTransition(transition, fromState, toState);

  return {
    transitionId: transition.id,
    baseStateId: transition.from,
    targetStateId: transition.to,
    progress: clampedProgress,
    resolvedTransition,
    interpolatedValues: interpolateTransitionValues(resolvedTransition, clampedProgress),
  };
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function describePaint(paint?: PaintRef) {
  if (!paint) return 'None';
  if (paint.mode === 'fixed') return paint.value;
  if (paint.mode === 'currentColor') return 'Current color';
  if (paint.mode === 'token') return `Token ${paint.token}`;
  if (paint.mode === 'linearGradient') return `Linear gradient`;
  return `Radial gradient`;
}

function TinyLabel({ children }: { children: React.ReactNode }) {
  return <p className="wire-label">{children}</p>;
}

function RowField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="wire-field">
      <span className="wire-field-name">{label}</span>
      {children}
    </label>
  );
}

function PropertyValue({ children }: { children: React.ReactNode }) {
  return <span className="wire-property-value">{children}</span>;
}

function ToolRail({
  activeTool,
  onToolSelect,
  onOpenCommand,
  onOpenImport,
}: {
  activeTool: string;
  onToolSelect: (tool: (typeof TOOL_ITEMS)[number]['tool']) => void;
  onOpenCommand: () => void;
  onOpenImport: () => void;
}) {
  return (
    <aside className="wire-rail">
      <div className="wire-rail-section">
        <Link href="/" className="wire-rail-home" aria-label="Back to home">
          <span className="wire-rail-home-mark" />
        </Link>
      </div>

      <div className="wire-rail-section">
        {TOOL_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.tool}
              type="button"
              data-active={activeTool === item.tool ? 'true' : 'false'}
              className="wire-rail-button"
              onClick={() => onToolSelect(item.tool)}
              title={item.label}
              aria-label={item.label}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>

      <div className="wire-rail-section mt-auto">
        <button
          type="button"
          className="wire-rail-button"
          onClick={onOpenCommand}
          aria-label="Open command menu"
          title="Search"
        >
          <Search className="size-4" />
        </button>
        <button
          type="button"
          className="wire-rail-button"
          onClick={onOpenImport}
          aria-label="Import SVG"
          title="Import"
        >
          <FolderOpen className="size-4" />
        </button>
      </div>
    </aside>
  );
}

function LeftSidebar({
  leftTab,
  onLeftTabChange,
  workspaceName,
  currentIcon,
  currentVariant,
  currentStateId,
  layerRows,
  selectedLayerId,
  onSelectLayer,
  onToggleLayerVisibility,
  variants,
  currentVariantId,
  stateIds,
  transitionCounts,
  onSelectVariant,
  onSelectState,
  newVariantSize,
  onNewVariantSizeChange,
  onCreateVariant,
  newStateName,
  onNewStateNameChange,
  onCreateDuplicateState,
  onCreateBlankState,
}: {
  leftTab: LeftTab;
  onLeftTabChange: (tab: LeftTab) => void;
  workspaceName: string;
  currentIcon: Icon | null;
  currentVariant: Variant | null;
  currentStateId: string | null;
  layerRows: ReturnType<typeof buildLayerPanelRows>;
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string) => void;
  onToggleLayerVisibility: (layerId: string, visible: boolean) => void;
  variants: Variant[];
  currentVariantId: string | null;
  stateIds: string[];
  transitionCounts: Record<string, number>;
  onSelectVariant: (variantId: string) => void;
  onSelectState: (stateId: string) => void;
  newVariantSize: string;
  onNewVariantSizeChange: (value: string) => void;
  onCreateVariant: () => void;
  newStateName: string;
  onNewStateNameChange: (value: string) => void;
  onCreateDuplicateState: () => void;
  onCreateBlankState: () => void;
}) {
  return (
    <aside className="wire-sidebar wire-sidebar-left">
      <div className="wire-sidebar-block px-2 pt-2">
        <Link href="/" className="wire-project-pill">
          <span>{workspaceName}</span>
        </Link>
        <div className="px-2 pt-2">
          <div className="flex items-center gap-1">
            <h1 className="wire-title">{currentIcon?.name ?? 'No icon selected'}</h1>
            <ChevronDown className="size-3 text-black/45" />
          </div>
          <button
            type="button"
            className="mt-0.5 flex items-center gap-1 text-[10px] text-black/45"
            onClick={() => {
              if (currentIcon) {
                navigator.clipboard.writeText(slugify(currentIcon.name)).catch(() => {});
              }
            }}
          >
            <span>{currentIcon ? slugify(currentIcon.name) : 'select-an-icon'}</span>
            <Copy className="size-3" />
          </button>
        </div>

        <div className="wire-tab-row">
          <div className="wire-tabs">
            <button
              type="button"
              data-active={leftTab === 'layers' ? 'true' : 'false'}
              className="wire-tab-button"
              onClick={() => onLeftTabChange('layers')}
            >
              Layers
            </button>
            <button
              type="button"
              data-active={leftTab === 'variants' ? 'true' : 'false'}
              className="wire-tab-button"
              onClick={() => onLeftTabChange('variants')}
            >
              Variants
            </button>
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {leftTab === 'layers' ? (
          <div className="wire-section">
            <div className="wire-section-header">
              <span>{currentVariant ? formatVariantLabel(currentVariant) : 'Variant'}</span>
            </div>
            {layerRows.length === 0 ? (
              <div className="wire-empty-note">No layers</div>
            ) : (
              layerRows.map((row) => (
                <div
                  key={row.layer.id}
                  data-active={row.layer.id === selectedLayerId ? 'true' : 'false'}
                  className="wire-layer-row"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onSelectLayer(row.layer.id)}
                  >
                    <div
                      className="wire-layer-line"
                      style={{ paddingLeft: `${row.depth * 12}px` }}
                    >
                      <span className="wire-layer-name">{row.layer.id}</span>
                      {row.layer.role ? <span className="wire-layer-kind">{row.layer.role}</span> : null}
                      {row.layer.isClipMask ? <span className="wire-layer-kind">mask</span> : null}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="wire-row-control"
                    onClick={() => onToggleLayerVisibility(row.layer.id, row.layer.visible === false)}
                    aria-label={row.layer.visible === false ? 'Show layer' : 'Hide layer'}
                  >
                    {row.layer.visible === false ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="wire-section">
            <div className="wire-section-header">
              <span>Sizes</span>
            </div>
            <div className="wire-inline-form">
              <input
                value={newVariantSize}
                onChange={(event) => onNewVariantSizeChange(event.target.value)}
                type="number"
                min="1"
                step="1"
                className="wire-input"
              />
              <button type="button" className="wire-mini-button" onClick={onCreateVariant}>
                Add
              </button>
            </div>
            {variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                data-active={variant.id === currentVariantId ? 'true' : 'false'}
                className="wire-list-row"
                onClick={() => onSelectVariant(variant.id)}
              >
                <span>{formatVariantLabel(variant)}</span>
              </button>
            ))}

            <div className="wire-section-header mt-3">
              <span>States</span>
            </div>
            <input
              value={newStateName}
              onChange={(event) => onNewStateNameChange(event.target.value)}
              placeholder="hover"
              className="wire-input w-full"
            />
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <button type="button" className="wire-mini-button" onClick={onCreateDuplicateState}>
                Duplicate
              </button>
              <button type="button" className="wire-mini-button" onClick={onCreateBlankState}>
                Blank
              </button>
            </div>
            {stateIds.length === 0 ? (
              <div className="wire-empty-note mt-2">No states</div>
            ) : (
              stateIds.map((stateId) => (
                <button
                  key={stateId}
                  type="button"
                  data-active={stateId === currentStateId ? 'true' : 'false'}
                  className="wire-list-row"
                  onClick={() => onSelectState(stateId)}
                >
                  <span>{stateId}</span>
                  <span className="wire-row-caption">{transitionCounts[stateId] ?? 0}</span>
                </button>
              ))
            )}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}

function CanvasDock({
  zoom,
  guidesVisible,
  snapEnabled,
  onZoomChange,
  onToggleGuides,
  onToggleSnap,
}: {
  zoom: number;
  guidesVisible: boolean;
  snapEnabled: boolean;
  onZoomChange: (zoom: number | 'fit') => void;
  onToggleGuides: () => void;
  onToggleSnap: () => void;
}) {
  return (
    <div className="wire-dock">
      <div className="wire-dock-zoom">
        <select
          value={String(Math.round(zoom * 100))}
          onChange={(event) => {
            if (event.target.value === 'fit') {
              onZoomChange('fit');
              return;
            }
            onZoomChange(Number.parseInt(event.target.value, 10) / 100);
          }}
          className="wire-zoom-select"
          aria-label="Canvas zoom"
        >
          <option value="50">50%</option>
          <option value="75">75%</option>
          <option value="100">100%</option>
          <option value="150">150%</option>
          <option value="200">200%</option>
          <option value="fit">Fit</option>
        </select>
      </div>

      <div className="wire-dock-group">
        <button
          type="button"
          data-active={snapEnabled ? 'true' : 'false'}
          className="wire-dock-icon"
          onClick={onToggleSnap}
          title="Toggle snap"
        >
          <Crosshair className="size-4" />
        </button>
        <button
          type="button"
          data-active={guidesVisible ? 'true' : 'false'}
          className="wire-dock-icon"
          onClick={onToggleGuides}
          title="Toggle guides"
        >
          <Sparkles className="size-4" />
        </button>
      </div>
    </div>
  );
}

function RightSidebar({
  rightTab,
  onRightTabChange,
  selectedLayer,
  currentIcon,
  currentVariant,
  currentState,
  selectedTransition,
  transitions,
  previewProgress,
  previewPlaying,
  onPreviewProgressChange,
  onTogglePreviewPlaying,
  transitionDraft,
  onTransitionDraftChange,
  stateIds,
  onCreateTransition,
  onSelectTransition,
  onRenameIcon,
  onRenameState,
  onPatchVariant,
  onPatchSelectedLayer,
  onPatchSelectedLayerStyle,
  onPatchSelectedLayerTransform,
  onPatchTransition,
  onDeleteState,
  onDeleteVariant,
  onDeleteTransition,
  guideMasterName,
  guidesVisible,
}: {
  rightTab: RightTab;
  onRightTabChange: (tab: RightTab) => void;
  selectedLayer: Layer | null;
  currentIcon: Icon | null;
  currentVariant: Variant | null;
  currentState: State | null;
  selectedTransition: Transition | null;
  transitions: Transition[];
  previewProgress: number;
  previewPlaying: boolean;
  onPreviewProgressChange: (value: number) => void;
  onTogglePreviewPlaying: () => void;
  transitionDraft: TransitionDraft;
  onTransitionDraftChange: (patch: Partial<TransitionDraft>) => void;
  stateIds: string[];
  onCreateTransition: () => void;
  onSelectTransition: (transitionId: string) => void;
  onRenameIcon: (value: string) => void;
  onRenameState: (value: string) => void;
  onPatchVariant: (patch: VariantEditorPatch) => void;
  onPatchSelectedLayer: (patch: Partial<Layer>) => void;
  onPatchSelectedLayerStyle: (patch: Partial<Layer['style']>) => void;
  onPatchSelectedLayerTransform: (patch: Partial<NonNullable<Layer['transform']>>) => void;
  onPatchTransition: (patch: Partial<Transition>) => void;
  onDeleteState: () => void;
  onDeleteVariant: () => void;
  onDeleteTransition: () => void;
  guideMasterName: string | null;
  guidesVisible: boolean;
}) {
  const fillMode = selectedLayer?.style.fill?.mode ?? 'none';
  const strokeMode = selectedLayer?.style.stroke?.mode ?? 'none';

  return (
    <aside className="wire-sidebar wire-sidebar-right">
      <div className="wire-sidebar-block px-2 pt-2">
        <div className="wire-tab-row">
          <div className="wire-tabs">
            <button
              type="button"
              data-active={rightTab === 'inspect' ? 'true' : 'false'}
              className="wire-tab-button"
              onClick={() => onRightTabChange('inspect')}
            >
              Inspect
            </button>
            <button
              type="button"
              data-active={rightTab === 'animation' ? 'true' : 'false'}
              className="wire-tab-button"
              onClick={() => onRightTabChange('animation')}
            >
              Animation
            </button>
          </div>
        </div>
        <div className="wire-panel-title px-2 pt-1.5">
          {selectedLayer?.id ?? currentIcon?.name ?? 'Inspect'}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="wire-section">
          {rightTab === 'inspect' ? (
            selectedLayer ? (
              <>
                <TinyLabel>Layer</TinyLabel>
                <RowField label="Role">
                  <input
                    defaultValue={selectedLayer.role ?? ''}
                    onBlur={(event) => onPatchSelectedLayer({ role: event.target.value || undefined })}
                    className="wire-input w-full"
                  />
                </RowField>
                <div className="grid grid-cols-2 gap-1.5">
                  <RowField label="Fill">
                    <select
                      value={fillMode}
                      className="wire-select"
                      onChange={(event) => {
                        const nextMode = event.target.value;
                        if (nextMode === 'none') {
                          onPatchSelectedLayerStyle({ fill: undefined });
                          return;
                        }
                        if (nextMode === 'currentColor') {
                          onPatchSelectedLayerStyle({ fill: { mode: 'currentColor' } });
                          return;
                        }
                        onPatchSelectedLayerStyle({
                          fill: {
                            mode: 'fixed',
                            value:
                              selectedLayer.style.fill?.mode === 'fixed'
                                ? selectedLayer.style.fill.value
                                : '#111111',
                          },
                        });
                      }}
                    >
                      <option value="none">None</option>
                      <option value="fixed">Fixed</option>
                      <option value="currentColor">Current</option>
                    </select>
                  </RowField>
                  <RowField label="Stroke">
                    <select
                      value={strokeMode}
                      className="wire-select"
                      onChange={(event) => {
                        const nextMode = event.target.value;
                        if (nextMode === 'none') {
                          onPatchSelectedLayerStyle({ stroke: undefined });
                          return;
                        }
                        if (nextMode === 'currentColor') {
                          onPatchSelectedLayerStyle({ stroke: { mode: 'currentColor' } });
                          return;
                        }
                        onPatchSelectedLayerStyle({
                          stroke: {
                            mode: 'fixed',
                            value:
                              selectedLayer.style.stroke?.mode === 'fixed'
                                ? selectedLayer.style.stroke.value
                                : '#111111',
                          },
                        });
                      }}
                    >
                      <option value="none">None</option>
                      <option value="fixed">Fixed</option>
                      <option value="currentColor">Current</option>
                    </select>
                  </RowField>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <RowField label="Fill color">
                    {fillMode === 'fixed' ? (
                      <input
                        type="color"
                        value={
                          selectedLayer.style.fill?.mode === 'fixed'
                            ? selectedLayer.style.fill.value
                            : '#111111'
                        }
                        onChange={(event) =>
                          onPatchSelectedLayerStyle({
                            fill: { mode: 'fixed', value: event.target.value },
                          })
                        }
                        className="wire-color"
                      />
                    ) : (
                      <PropertyValue>{describePaint(selectedLayer.style.fill)}</PropertyValue>
                    )}
                  </RowField>
                  <RowField label="Stroke color">
                    {strokeMode === 'fixed' ? (
                      <input
                        type="color"
                        value={
                          selectedLayer.style.stroke?.mode === 'fixed'
                            ? selectedLayer.style.stroke.value
                            : '#111111'
                        }
                        onChange={(event) =>
                          onPatchSelectedLayerStyle({
                            stroke: { mode: 'fixed', value: event.target.value },
                          })
                        }
                        className="wire-color"
                      />
                    ) : (
                      <PropertyValue>{describePaint(selectedLayer.style.stroke)}</PropertyValue>
                    )}
                  </RowField>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-1.5">
                  <RowField label="Stroke width">
                    <input
                      type="number"
                      step="0.1"
                      value={selectedLayer.style.strokeWidth ?? 0}
                      onChange={(event) =>
                        onPatchSelectedLayerStyle({
                          strokeWidth: Number.parseFloat(event.target.value) || 0,
                        })
                      }
                      className="wire-input w-full"
                    />
                  </RowField>
                  <RowField label="Guides">
                    <PropertyValue>{guidesVisible ? 'On' : 'Off'}</PropertyValue>
                  </RowField>
                </div>
                <TinyLabel>Position</TinyLabel>
                <div className="grid grid-cols-3 gap-1.5">
                  <RowField label="X">
                    <input
                      type="number"
                      step="0.5"
                      value={selectedLayer.transform?.x ?? 0}
                      onChange={(event) =>
                        onPatchSelectedLayerTransform({
                          x: Number.parseFloat(event.target.value) || 0,
                        })
                      }
                      className="wire-input w-full"
                    />
                  </RowField>
                  <RowField label="Y">
                    <input
                      type="number"
                      step="0.5"
                      value={selectedLayer.transform?.y ?? 0}
                      onChange={(event) =>
                        onPatchSelectedLayerTransform({
                          y: Number.parseFloat(event.target.value) || 0,
                        })
                      }
                      className="wire-input w-full"
                    />
                  </RowField>
                  <RowField label="Rot">
                    <input
                      type="number"
                      step="1"
                      value={selectedLayer.transform?.rotate ?? 0}
                      onChange={(event) =>
                        onPatchSelectedLayerTransform({
                          rotate: Number.parseFloat(event.target.value) || 0,
                        })
                      }
                      className="wire-input w-full"
                    />
                  </RowField>
                </div>
              </>
            ) : (
              <>
                <TinyLabel>Document</TinyLabel>
                <RowField label="Name">
                  <input
                    defaultValue={currentIcon?.name ?? ''}
                    onBlur={(event) => onRenameIcon(event.target.value)}
                    className="wire-input w-full"
                  />
                </RowField>
                <div className="grid grid-cols-2 gap-1.5">
                  <RowField label="State">
                    <input
                      defaultValue={currentState?.id ?? ''}
                      onBlur={(event) => onRenameState(event.target.value)}
                      className="wire-input w-full"
                    />
                  </RowField>
                  <RowField label="Size">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={currentVariant?.size ?? 0}
                      onChange={(event) =>
                        onPatchVariant({ size: Number.parseFloat(event.target.value) || 24 })
                      }
                      className="wire-input w-full"
                    />
                  </RowField>
                </div>
                <RowField label="Rendering">
                  <select
                    value={currentVariant?.renderingMode ?? 'monochrome'}
                    onChange={(event) =>
                      onPatchVariant({ renderingMode: event.target.value as RenderingMode })
                    }
                    className="wire-select"
                  >
                    {RENDERING_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </RowField>
                <TinyLabel>Guides</TinyLabel>
                <div className="wire-meta-row">
                  <span className="wire-field-name">Master</span>
                  <PropertyValue>{guideMasterName ?? 'None'}</PropertyValue>
                </div>
                <div className="wire-meta-row">
                  <span className="wire-field-name">Visible</span>
                  <PropertyValue>{guidesVisible ? 'On' : 'Off'}</PropertyValue>
                </div>
                <div className="grid grid-cols-2 gap-1.5 pt-2">
                  <button type="button" className="wire-mini-button" onClick={onDeleteState}>
                    Delete state
                  </button>
                  <button type="button" className="wire-mini-button" onClick={onDeleteVariant}>
                    Delete size
                  </button>
                </div>
              </>
            )
          ) : (
            <>
              <TinyLabel>Transitions</TinyLabel>
              {transitions.length === 0 ? (
                <div className="wire-empty-note">No transitions yet</div>
              ) : (
                transitions.map((transition) => (
                  <button
                    key={transition.id}
                    type="button"
                    data-active={selectedTransition?.id === transition.id ? 'true' : 'false'}
                    className="wire-list-row"
                    onClick={() => onSelectTransition(transition.id)}
                  >
                    <span>{transition.from} → {transition.to}</span>
                    <span className="wire-row-caption">{transition.durationMs}ms</span>
                  </button>
                ))
              )}
              {selectedTransition ? (
                <>
                  <RowField label="Duration">
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={selectedTransition.durationMs}
                      onChange={(event) =>
                        onPatchTransition({
                          durationMs: Number.parseInt(event.target.value, 10) || 0,
                        })
                      }
                      className="wire-input w-full"
                    />
                  </RowField>
                  <RowField label="Strategy">
                    <select
                      value={selectedTransition.strategy}
                      className="wire-select"
                      onChange={(event) =>
                        onPatchTransition({
                          strategy: event.target.value as Transition['strategy'],
                        })
                      }
                    >
                      {TRANSITION_STRATEGIES.map((strategy) => (
                        <option key={strategy} value={strategy}>
                          {strategy}
                        </option>
                      ))}
                    </select>
                  </RowField>
                  <RowField label="Easing">
                    <select
                      value={
                        typeof selectedTransition.easing === 'string'
                          ? selectedTransition.easing
                          : 'ease-in-out'
                      }
                      className="wire-select"
                      onChange={(event) => onPatchTransition({ easing: event.target.value })}
                    >
                      {EASING_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </RowField>
                  <RowField label="Preview">
                    <div className="grid gap-1.5">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(previewProgress * 100)}
                        onChange={(event) =>
                          onPreviewProgressChange(Number.parseInt(event.target.value, 10) / 100)
                        }
                        className="wire-range"
                      />
                      <button type="button" className="wire-mini-button" onClick={onTogglePreviewPlaying}>
                        {previewPlaying ? 'Pause preview' : 'Play preview'}
                      </button>
                    </div>
                  </RowField>
                  <button type="button" className="wire-mini-button mt-1" onClick={onDeleteTransition}>
                    Delete transition
                  </button>
                </>
              ) : null}
              <TinyLabel>New transition</TinyLabel>
              <RowField label="From">
                <select
                  value={transitionDraft.from}
                  className="wire-select"
                  onChange={(event) => onTransitionDraftChange({ from: event.target.value })}
                >
                  {stateIds.map((stateId) => (
                    <option key={stateId} value={stateId}>
                      {stateId}
                    </option>
                  ))}
                </select>
              </RowField>
              <RowField label="To">
                <select
                  value={transitionDraft.to}
                  className="wire-select"
                  onChange={(event) => onTransitionDraftChange({ to: event.target.value })}
                >
                  {stateIds.map((stateId) => (
                    <option key={stateId} value={stateId}>
                      {stateId}
                    </option>
                  ))}
                </select>
              </RowField>
              <RowField label="Duration">
                <input
                  value={transitionDraft.durationMs}
                  onChange={(event) => onTransitionDraftChange({ durationMs: event.target.value })}
                  type="number"
                  min="0"
                  step="10"
                  className="wire-input w-full"
                />
              </RowField>
              <button type="button" className="wire-mini-button mt-1" onClick={onCreateTransition}>
                Create transition
              </button>
            </>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

export function EditorShell({ initialIconId }: { initialIconId?: string }) {
  const router = useRouter();
  const currentIconId = useEditorStore((s) => s.currentIconId);
  const currentVariantId = useEditorStore((s) => s.currentVariantId);
  const currentStateId = useEditorStore((s) => s.currentStateId);
  const project = useEditorStore((s) => s.project);
  const activeIconSetId = useEditorStore((s) => s.activeIconSetId);
  const selection = useEditorStore((s) => s.selection);
  const tool = useEditorStore((s) => s.tool);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const guidesVisible = useEditorStore((s) => s.guidesVisible);
  const viewport = useEditorStore((s) => s.viewport);
  const selectedTransitionId = useEditorStore((s) => s.selectedTransitionId);
  const currentGuideMaster = useEditorStore(selectCurrentGuideMaster);
  const currentIcon = useEditorStore((s) =>
    s.currentIconId ? s.project?.icons[s.currentIconId] ?? null : null,
  );
  const currentVariant = useEditorStore((s) =>
    s.currentIconId && s.currentVariantId
      ? s.project?.icons[s.currentIconId]?.variants[s.currentVariantId] ?? null
      : null,
  );
  const currentState = useEditorStore((s) =>
    s.currentIconId && s.currentVariantId && s.currentStateId
      ? s.project?.icons[s.currentIconId]?.variants[s.currentVariantId]?.states[s.currentStateId] ?? null
      : null,
  );

  const {
    addState,
    addTransition,
    addVariant,
    createBlankIcon,
    openIconTab,
    patchLayer,
    patchTransition,
    patchVariant,
    removeState,
    removeTransition,
    removeVariant,
    renameIcon,
    renameState,
    setCurrentIcon,
    setCurrentState,
    setCurrentVariant,
    setSelection,
    setSelectedTransitionId,
    setTool,
    setTransitionPreview,
    setViewport,
    toggleGuidesVisible,
    toggleSnap,
  } = useEditorActions();

  const [leftTab, setLeftTab] = useState<LeftTab>('layers');
  const [rightTab, setRightTab] = useState<RightTab>('inspect');
  const [desktop, setDesktop] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [newVariantSize, setNewVariantSize] = useState('32');
  const [newStateName, setNewStateName] = useState('');
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DeleteIntent | null>(null);
  const [searchIconId, setSearchIconId] = useState<string | undefined>();
  const [searchIconSetId, setSearchIconSetId] = useState<string | undefined>();
  const [transitionDraft, setTransitionDraft] = useState<TransitionDraft>({
    from: '',
    to: '',
    durationMs: '240',
    strategy: 'bestGuessMorph',
    easing: 'ease-in-out',
  });
  const previewFrameRef = useRef<number | null>(null);
  const requestedIconId = initialIconId ?? searchIconId;

  const layerRows = useMemo(
    () => buildLayerPanelRows(Object.values(currentState?.layers ?? {})),
    [currentState?.layers],
  );

  const variants = useMemo(
    () =>
      Object.values(currentIcon?.variants ?? {}).sort((a, b) => {
        if (a.size !== b.size) return a.size - b.size;
        return formatVariantLabel(a).localeCompare(formatVariantLabel(b));
      }),
    [currentIcon?.variants],
  );

  const stateIds = useMemo(() => Object.keys(currentVariant?.states ?? {}), [currentVariant?.states]);

  const transitionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stateId of stateIds) {
      counts[stateId] = Object.values(currentIcon?.transitions ?? {}).filter(
        (transition) => transition.from === stateId || transition.to === stateId,
      ).length;
    }
    return counts;
  }, [currentIcon?.transitions, stateIds]);

  const transitions = useMemo(
    () =>
      Object.values(currentIcon?.transitions ?? {}).sort((a, b) => a.id.localeCompare(b.id)),
    [currentIcon?.transitions],
  );

  const selectedTransition = useMemo(() => {
    if (!transitions.length) return null;
    if (selectedTransitionId) {
      return transitions.find((transition) => transition.id === selectedTransitionId) ?? transitions[0] ?? null;
    }
    return transitions[0] ?? null;
  }, [selectedTransitionId, transitions]);

  const selectedLayerId = selection.layerIds[0] ?? null;
  const selectedLayer = selectedLayerId ? currentState?.layers[selectedLayerId] ?? null : null;
  const projectName = project?.meta.name ?? 'Untitled Set';

  useEffect(() => {
    setDesktop(isDesktop());
    const search = new URLSearchParams(window.location.search);
    setSearchIconId(parseEditorSearchParam(search.get('icon') ?? undefined));
    setSearchIconSetId(parseEditorSearchParam(search.get('set') ?? undefined));
  }, []);

  useEffect(() => {
    let state = editorStore.getState();
    if (!state.workspace) {
      clearCurrentProjectPath();
      state.loadWorkspace(SAMPLE_WORKSPACE);
      state = editorStore.getState();
    }

    if (searchIconSetId && state.workspace?.iconSets[searchIconSetId]) {
      state.setActiveIconSet(searchIconSetId);
      state = editorStore.getState();
    }

    if (requestedIconId && state.project?.icons[requestedIconId]) {
      state.setCurrentIcon(requestedIconId);
      const nextIconSetId =
        (searchIconSetId && state.workspace?.iconSets[searchIconSetId]
          ? searchIconSetId
          : state.activeIconSetId) ?? null;
      if (nextIconSetId) {
        state.openIconTab(nextIconSetId, requestedIconId);
      }
    }
  }, [requestedIconId, searchIconSetId]);

  useEffect(() => {
    window.addEventListener('keydown', handleEditorKeyDown);
    return () => window.removeEventListener('keydown', handleEditorKeyDown);
  }, []);

  useEffect(() => {
    const handleCommandShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', handleCommandShortcut);
    return () => window.removeEventListener('keydown', handleCommandShortcut);
  }, []);

  useEffect(() => {
    if (!project || !currentIconId || !currentStateId || selection.layerIds.length > 0) return;
    const layers = currentVariantId
      ? project.icons[currentIconId]?.variants[currentVariantId]?.states[currentStateId]?.layers ?? {}
      : {};
    const nextLayerId =
      Object.values(layers).find((layer) => layer.visible !== false)?.id ?? Object.keys(layers)[0];
    if (!nextLayerId) return;
    setSelection({ layerIds: [nextLayerId], pointIds: [] });
  }, [currentIconId, currentStateId, currentVariantId, project, selection.layerIds.length, setSelection]);

  useEffect(() => {
    const nextStates = Object.keys(currentVariant?.states ?? {});
    if (!nextStates.length) return;
    setTransitionDraft((current) => {
      const fallbackFrom =
        currentStateId && nextStates.includes(currentStateId) ? currentStateId : nextStates[0]!;
      const fallbackTo = nextStates.find((stateId) => stateId !== fallbackFrom) ?? fallbackFrom;
      return {
        ...current,
        from: nextStates.includes(current.from) ? current.from : fallbackFrom,
        to: nextStates.includes(current.to) && current.to !== current.from ? current.to : fallbackTo,
      };
    });
  }, [currentStateId, currentVariant?.states]);

  useEffect(() => {
    if (!selectedTransition || !currentVariant || !previewPlaying) return;

    const duration = Math.max(selectedTransition.durationMs, 1);
    const startTime = performance.now() - previewProgress * duration;

    const tick = (now: number) => {
      const progress = ((now - startTime) % duration) / duration;
      setPreviewProgress(progress);
      const preview = buildTransitionPreview(selectedTransition, currentVariant, progress);
      if (preview) {
        setTransitionPreview(preview);
      }
      previewFrameRef.current = requestAnimationFrame(tick);
    };

    previewFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (previewFrameRef.current !== null) {
        cancelAnimationFrame(previewFrameRef.current);
      }
    };
  }, [currentVariant, previewPlaying, previewProgress, selectedTransition, setTransitionPreview]);

  const serializeWorkspace = () => {
    const { workspace: currentWorkspace } = editorStore.getState();
    if (!currentWorkspace) return null;

    const updatedAt = new Date().toISOString();
    const updated = {
      ...currentWorkspace,
      meta: { ...currentWorkspace.meta, updatedAt },
    };

    return {
      data: JSON.stringify(updated, null, 2),
      updatedAt,
    };
  };

  const handleSave = async () => {
    const payload = serializeWorkspace();
    if (!payload) return;
    const result = await saveProject(payload.data);
    if (result) {
      editorStore.getState().markSaved(payload.updatedAt);
    }
  };

  const handleExportCurrentSvg = async () => {
    const state = editorStore.getState();
    if (!currentIcon || !currentVariant || !currentState) return;

    const svg = exportSvgString(
      currentIcon,
      currentVariant.id,
      currentState.id,
      state.project?.tokenSet?.colors,
      state.renderingMode,
    );

    await exportSvg(svg, `${slugify(currentIcon.name)}.svg`);
  };

  const handleExportSvgPackage = () => {
    if (!project) return;
    const fileMap = exportSvgPackage(project);
    const zipBlob = createZipBlob(fileMap);
    downloadBlob(zipBlob, `${slugify(project.meta.name)}-svg-package.zip`);
  };

  const handleExportRuntimeJson = () => {
    if (!currentIcon || !project) return;
    const runtimeJson = exportRuntimeJson({
      ...currentIcon,
      tokenSet: project.tokenSet,
    });
    downloadBlob(new Blob([runtimeJson], { type: 'application/json' }), `${slugify(currentIcon.name)}.runtime.json`);
  };

  const handleExportReactLibrary = () => {
    if (!project) return;
    const fileMap = generateIconLibrary(project, {
      packageName: `${slugify(project.meta.name)}-react-icons`,
      typescript: true,
    });
    downloadBlob(createZipBlob(fileMap), `${slugify(project.meta.name)}-react-library.zip`);
  };

  const handleSelectIcon = (iconId: string) => {
    if (!iconId) return;
    if (activeIconSetId) {
      openIconTab(activeIconSetId, iconId);
      router.push(buildEditorRoute(iconId, activeIconSetId));
      return;
    }
    setCurrentIcon(iconId);
  };

  const handleCreateBlankIcon = () => {
    if (!activeIconSetId) return;
    const iconId = createBlankIcon();
    if (!iconId) return;
    openIconTab(activeIconSetId, iconId);
    router.push(buildEditorRoute(iconId, activeIconSetId));
  };

  const handlePatchSelectedLayer = (patch: Partial<Layer>) => {
    if (!currentIcon || !currentState || !selectedLayer) return;
    patchLayer(currentIcon.id, currentState.id, selectedLayer.id, patch);
  };

  const handlePatchSelectedLayerStyle = (patch: Partial<Layer['style']>) => {
    if (!selectedLayer) return;
    handlePatchSelectedLayer({
      style: {
        ...selectedLayer.style,
        ...patch,
      },
    });
  };

  const handlePatchSelectedLayerTransform = (
    patch: Partial<NonNullable<Layer['transform']>>,
  ) => {
    if (!selectedLayer) return;
    handlePatchSelectedLayer({
      transform: {
        ...(selectedLayer.transform ?? {}),
        ...patch,
      },
    });
  };

  const handlePatchVariant = (patch: VariantEditorPatch) => {
    if (!currentIcon || !currentVariant) return;
    patchVariant(currentIcon.id, currentVariant.id, patch);
  };

  const handleRenameIcon = (value: string) => {
    const next = value.trim();
    if (!currentIcon || !next || next === currentIcon.name) return;
    renameIcon(currentIcon.id, next);
  };

  const handleRenameState = (value: string) => {
    const next = value.trim();
    if (!currentIcon || !currentState || !next || next === currentState.id) return;
    renameState(currentIcon.id, currentState.id, next);
  };

  const handleCreateVariant = () => {
    if (!currentIcon) return;
    const size = Number.parseFloat(newVariantSize);
    if (!Number.isFinite(size) || size <= 0) return;
    const nextViewBox = currentVariant
      ? scaleViewBox(currentVariant.viewBox, size)
      : ([0, 0, size, size] as [number, number, number, number]);
    addVariant(currentIcon.id, {
      size,
      viewBox: nextViewBox,
      sourceVariantId: currentVariant?.id,
    });
  };

  const handleCreateDuplicateState = () => {
    if (!currentIcon) return;
    addState(currentIcon.id, {
      name: newStateName.trim() || undefined,
      sourceStateId: currentStateId,
      blank: false,
    });
    setNewStateName('');
  };

  const handleCreateBlankState = () => {
    if (!currentIcon) return;
    addState(currentIcon.id, {
      name: newStateName.trim() || undefined,
      sourceStateId: null,
      blank: true,
    });
    setNewStateName('');
  };

  const handleCreateTransition = () => {
    if (!currentIcon || !currentVariant) return;
    const durationMs = Number.parseInt(transitionDraft.durationMs, 10);
    if (
      !transitionDraft.from ||
      !transitionDraft.to ||
      transitionDraft.from === transitionDraft.to ||
      !Number.isFinite(durationMs) ||
      durationMs < 0
    ) {
      return;
    }

    const fromState = currentVariant.states[transitionDraft.from];
    const toState = currentVariant.states[transitionDraft.to];
    if (!fromState || !toState) return;

    const id = `${transitionDraft.from}-to-${transitionDraft.to}`;
    addTransition(currentIcon.id, {
      id,
      from: transitionDraft.from,
      to: transitionDraft.to,
      strategy: transitionDraft.strategy,
      durationMs,
      easing: transitionDraft.easing,
      layerBindings: buildDefaultLayerBindings(fromState, toState, transitionDraft.strategy),
    });
    setSelectedTransitionId(id);
    setRightTab('animation');
  };

  const handlePatchTransition = (patch: Partial<Transition>) => {
    if (!currentIcon || !selectedTransition) return;
    patchTransition(currentIcon.id, selectedTransition.id, patch);
  };

  const handlePreviewProgressChange = (value: number) => {
    setPreviewPlaying(false);
    setPreviewProgress(value);
    if (!selectedTransition || !currentVariant) {
      setTransitionPreview(null);
      return;
    }
    setTransitionPreview(buildTransitionPreview(selectedTransition, currentVariant, value));
  };

  const handleDeleteConfirm = () => {
    if (!pendingDelete || !currentIcon) return;
    if (pendingDelete.type === 'state') removeState(currentIcon.id, pendingDelete.id);
    if (pendingDelete.type === 'variant') removeVariant(currentIcon.id, pendingDelete.id);
    if (pendingDelete.type === 'transition') removeTransition(currentIcon.id, pendingDelete.id);
    setPendingDelete(null);
    setPreviewPlaying(false);
    setPreviewProgress(0);
    setTransitionPreview(null);
  };

  const commandIcons = useMemo(
    () => Object.values(project?.icons ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [project?.icons],
  );

  return (
    <div className="wireframe-editor fixed inset-0 flex flex-col overflow-hidden bg-white p-2">
      {desktop ? <TitleTabBar /> : null}

      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[52px_196px_minmax(0,1fr)_288px]">
        <ToolRail
          activeTool={tool}
          onToolSelect={(nextTool) => setTool(nextTool)}
          onOpenCommand={() => setCommandOpen(true)}
          onOpenImport={() => setImportDialogOpen(true)}
        />

        <LeftSidebar
          leftTab={leftTab}
          onLeftTabChange={setLeftTab}
          workspaceName={projectName}
          currentIcon={currentIcon}
          currentVariant={currentVariant}
          currentStateId={currentStateId}
          layerRows={layerRows}
          selectedLayerId={selectedLayerId}
          onSelectLayer={(layerId) => setSelection({ layerIds: [layerId], pointIds: [] })}
          onToggleLayerVisibility={(layerId, visible) => {
            if (!currentIcon || !currentState) return;
            patchLayer(currentIcon.id, currentState.id, layerId, { visible });
          }}
          variants={variants}
          currentVariantId={currentVariantId}
          stateIds={stateIds}
          transitionCounts={transitionCounts}
          onSelectVariant={setCurrentVariant}
          onSelectState={setCurrentState}
          newVariantSize={newVariantSize}
          onNewVariantSizeChange={setNewVariantSize}
          onCreateVariant={handleCreateVariant}
          newStateName={newStateName}
          onNewStateNameChange={setNewStateName}
          onCreateDuplicateState={handleCreateDuplicateState}
          onCreateBlankState={handleCreateBlankState}
        />

        <main className="wire-canvas-shell">
          <div className="wire-canvas-area">
            {currentIcon && currentVariant && currentState ? (
              <Canvas showStatusHud={false} />
            ) : (
              <div className="wire-canvas-empty">
                <p className="wire-title">No active icon</p>
                <p className="wire-empty-note mt-1">Create a new icon or import an SVG to begin.</p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <button type="button" className="wire-mini-button" onClick={handleCreateBlankIcon}>
                    <Plus className="size-3.5" />
                    New icon
                  </button>
                  <button type="button" className="wire-mini-button" onClick={() => setImportDialogOpen(true)}>
                    <FolderOpen className="size-3.5" />
                    Import
                  </button>
                </div>
              </div>
            )}

            <CanvasDock
              zoom={viewport.zoom}
              guidesVisible={guidesVisible}
              snapEnabled={snapEnabled}
              onZoomChange={(nextZoom) => {
                if (nextZoom === 'fit') {
                  window.dispatchEvent(new CustomEvent('editor:fit-canvas'));
                  return;
                }
                setViewport({ zoom: nextZoom });
              }}
              onToggleGuides={toggleGuidesVisible}
              onToggleSnap={toggleSnap}
            />
          </div>
        </main>

        <RightSidebar
          rightTab={rightTab}
          onRightTabChange={setRightTab}
          selectedLayer={selectedLayer}
          currentIcon={currentIcon}
          currentVariant={currentVariant}
          currentState={currentState}
          selectedTransition={selectedTransition}
          transitions={transitions}
          previewProgress={previewProgress}
          previewPlaying={previewPlaying}
          onPreviewProgressChange={handlePreviewProgressChange}
          onTogglePreviewPlaying={() => setPreviewPlaying((value) => !value)}
          transitionDraft={transitionDraft}
          onTransitionDraftChange={(patch) =>
            setTransitionDraft((current) => ({ ...current, ...patch }))
          }
          stateIds={stateIds}
          onCreateTransition={handleCreateTransition}
          onSelectTransition={setSelectedTransitionId}
          onRenameIcon={handleRenameIcon}
          onRenameState={handleRenameState}
          onPatchVariant={handlePatchVariant}
          onPatchSelectedLayer={handlePatchSelectedLayer}
          onPatchSelectedLayerStyle={handlePatchSelectedLayerStyle}
          onPatchSelectedLayerTransform={handlePatchSelectedLayerTransform}
          onPatchTransition={handlePatchTransition}
          onDeleteState={() =>
            currentState ? setPendingDelete({ type: 'state', id: currentState.id }) : undefined
          }
          onDeleteVariant={() =>
            currentVariant ? setPendingDelete({ type: 'variant', id: currentVariant.id }) : undefined
          }
          onDeleteTransition={() =>
            selectedTransition
              ? setPendingDelete({ type: 'transition', id: selectedTransition.id })
              : undefined
          }
          guideMasterName={currentGuideMaster?.name ?? null}
          guidesVisible={guidesVisible}
        />
      </div>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen} className="wire-command">
        <CommandInput placeholder="Search icons or run editor actions..." />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>

          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                handleCreateBlankIcon();
              }}
            >
              <Plus className="size-4" />
              <span>New icon</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                setImportDialogOpen(true);
              }}
            >
              <FolderOpen className="size-4" />
              <span>Import SVG</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                handleSave();
              }}
            >
              <Copy className="size-4" />
              <span>Save workspace</span>
              <CommandShortcut>Cmd S</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                handleExportCurrentSvg();
              }}
            >
              <Square className="size-4" />
              <span>Export current SVG</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                handleExportSvgPackage();
              }}
            >
              <Square className="size-4" />
              <span>Export SVG package</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                handleExportRuntimeJson();
              }}
            >
              <Blend className="size-4" />
              <span>Export runtime JSON</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                handleExportReactLibrary();
              }}
            >
              <Blend className="size-4" />
              <span>Export React library</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Icons">
            {commandIcons.map((icon) => (
              <CommandItem
                key={icon.id}
                onSelect={() => {
                  setCommandOpen(false);
                  handleSelectIcon(icon.id);
                }}
              >
                <Square className="size-4" />
                <span>{icon.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.type === 'state'
                ? 'Delete state'
                : pendingDelete?.type === 'variant'
                  ? 'Delete size'
                  : 'Delete transition'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.type === 'state'
                ? `Delete the ${pendingDelete.id} state?`
                : pendingDelete?.type === 'variant'
                  ? `Delete the ${pendingDelete.id} variant?`
                  : pendingDelete
                    ? `Delete the ${pendingDelete.id} transition?`
                    : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportIconDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
    </div>
  );
}
