'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Blend,
  Check,
  ChevronDown,
  Copy,
  Crosshair,
  Eye,
  EyeOff,
  FolderOpen,
  Loader2,
  Menu,
  MousePointer2,
  PenTool,
  Plus,
  Sparkles,
  Square,
  X,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { editorStore, type TransitionPreview } from '@/lib/editor-store/store';
import { buildLayerPanelRows, selectCurrentGuideMaster } from '@/lib/editor-store/selectors';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import { toast } from '@/components/ui/use-toast';
import { SAMPLE_WORKSPACE } from '@/lib/schema/sample-project';
import type {
  Icon,
  Layer,
  RenderingMode,
  State,
  Transition,
  Variant,
} from '@/lib/schema/types';
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
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/kibo-ui/select';
import { Input } from '@/components/kibo-ui/input';
import { Canvas } from './Canvas';
import { ImportIconDialog } from './ImportIconDialog';
import { ColorPickerPopover } from './ColorPickerPopover';
import { TransitionPanel } from './TransitionPanel';

type LeftTab = 'layers' | 'variants';
type RightTab = 'inspect' | 'animation';
type DeleteIntent =
  | { type: 'state'; id: string }
  | { type: 'variant'; id: string }
  | { type: 'transition'; id: string };
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
  { value: 'autoGradient', label: 'Auto Gradient' },
];

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled'
  );
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

function clampZoomValue(value: number) {
  return Math.max(0.1, Math.min(32, value));
}

function formatZoomPercent(zoom: number) {
  const rounded = Math.round(zoom * 1000) / 10;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}%` : `${rounded.toFixed(1)}%`;
}

function parseZoomPercentInput(value: string) {
  const normalized = value.replace(/%/g, '').trim();
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  return clampZoomValue(parsed / 100);
}

function TinyLabel({ children }: { children: React.ReactNode }) {
  return <p className="wire-label">{children}</p>;
}

function RowField({ label, children }: { label: string; children: React.ReactNode }) {
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

/* ToolRail removed — search/import actions moved to sidebar head */

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
  const [copied, setCopied] = useState(false);
  return (
    <aside className="wire-sidebar wire-sidebar-left">
      <div className="wire-sidebar-block wire-sidebar-head">
        <Link href="/" className="wire-project-pill">
          <span>{workspaceName}</span>
        </Link>
        <div className="wire-sidebar-title-stack">
          <div className="wire-sidebar-title-row">
            <h1 className="wire-title">{currentIcon?.name ?? 'No icon selected'}</h1>
            <ChevronDown className="size-3 text-black/45" />
          </div>
          <button
            type="button"
            className="wire-sidebar-subtitle-action"
            aria-label="Copy icon slug"
            onClick={() => {
              if (currentIcon) {
                navigator.clipboard.writeText(slugify(currentIcon.name)).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }).catch(() => {});
              }
            }}
          >
            <span>{currentIcon ? slugify(currentIcon.name) : 'select-an-icon'}</span>
            {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
          </button>
        </div>

        <div className="wire-tab-row">
          <div className="wire-tabs" role="tablist" aria-label="Left sidebar">
            <button
              type="button"
              role="tab"
              aria-selected={leftTab === 'layers'}
              data-active={leftTab === 'layers' ? 'true' : 'false'}
              className="wire-tab-button"
              onClick={() => onLeftTabChange('layers')}
            >
              Layers
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={leftTab === 'variants'}
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
          <div key="layers" role="tabpanel" aria-label="Layers" className="wire-section animate-in fade-in duration-150">
            <div className="wire-section-header">
              <span>{currentVariant ? formatVariantLabel(currentVariant) : 'Variant'}</span>
            </div>
            {layerRows.length === 0 ? (
              <div className="wire-empty-note">No layers</div>
            ) : (
              <div role="listbox" aria-label="Layers">
              {layerRows.map((row) => (
                <div
                  key={row.layer.id}
                  role="option"
                  aria-selected={row.layer.id === selectedLayerId}
                  data-active={row.layer.id === selectedLayerId ? 'true' : 'false'}
                  className="wire-layer-row"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onSelectLayer(row.layer.id)}
                  >
                    <div className="wire-layer-line" style={{ paddingLeft: `${row.depth * 12}px` }}>
                      <span className="wire-layer-name">{row.layer.id}</span>
                      {/* Role label removed — internal property, not user-facing */}
                      {row.layer.isClipMask ? <span className="wire-layer-kind">mask</span> : null}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="wire-row-control"
                    onClick={() =>
                      onToggleLayerVisibility(row.layer.id, row.layer.visible === false)
                    }
                    aria-label={row.layer.visible === false ? 'Show layer' : 'Hide layer'}
                  >
                    {row.layer.visible === false ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                </div>
              ))}
              </div>
            )}
          </div>
        ) : (
          <div key="variants" role="tabpanel" aria-label="Variants" className="wire-section animate-in fade-in duration-150">
            <div className="wire-section-header">
              <span>Sizes</span>
            </div>
            <div className="wire-inline-form">
              <Input
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
            {variants.map((variant) => {
              const isDerived = variant.id.includes('.');
              return (
                <button
                  key={variant.id}
                  type="button"
                  data-active={variant.id === currentVariantId ? 'true' : 'false'}
                  className="wire-list-row"
                  onClick={() => onSelectVariant(variant.id)}
                >
                  <span>{formatVariantLabel(variant)}</span>
                  {isDerived && (
                    <span className="ml-auto rounded-sm bg-muted px-1 py-0.5 text-[9px] font-medium leading-none text-muted-foreground">
                      derived
                    </span>
                  )}
                </button>
              );
            })}

            <div className="wire-section-header">
              <span>States</span>
            </div>
            <Input
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
  activeTool,
  zoom,
  guidesVisible,
  snapEnabled,
  onToolSelect,
  onZoomChange,
  onToggleGuides,
  onToggleSnap,
}: {
  activeTool: string;
  zoom: number;
  guidesVisible: boolean;
  snapEnabled: boolean;
  onToolSelect: (tool: (typeof TOOL_ITEMS)[number]['tool']) => void;
  onZoomChange: (zoom: number | 'fit') => void;
  onToggleGuides: () => void;
  onToggleSnap: () => void;
}) {
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [zoomInput, setZoomInput] = useState(formatZoomPercent(zoom));

  useEffect(() => {
    setZoomInput(formatZoomPercent(zoom));
  }, [zoom]);

  const commitZoomInput = ({ closeMenu = true }: { closeMenu?: boolean } = {}) => {
    const parsedZoom = parseZoomPercentInput(zoomInput);
    if (parsedZoom === null) {
      setZoomInput(formatZoomPercent(zoom));
      return;
    }
    onZoomChange(parsedZoom);
    setZoomInput(formatZoomPercent(parsedZoom));
    if (closeMenu) {
      setZoomMenuOpen(false);
    }
  };

  const handleZoomAction = (nextZoom: number | 'fit') => {
    if (nextZoom === 'fit') {
      onZoomChange('fit');
      setZoomMenuOpen(false);
      return;
    }
    const clampedZoom = clampZoomValue(nextZoom);
    onZoomChange(clampedZoom);
    setZoomInput(formatZoomPercent(clampedZoom));
    setZoomMenuOpen(false);
  };

  return (
    <div className="wire-dock">
      <div className="wire-dock-group">
        {TOOL_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.tool}
              type="button"
              data-active={activeTool === item.tool ? 'true' : 'false'}
              className="wire-dock-icon"
              onClick={() => onToolSelect(item.tool)}
              title={item.label}
              aria-label={item.label}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>

      <Popover open={zoomMenuOpen} onOpenChange={setZoomMenuOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="wire-zoom-trigger" aria-label="Canvas zoom controls">
            <span>{formatZoomPercent(zoom)}</span>
            <ChevronDown className="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="center"
          className="w-[200px] overflow-hidden rounded-lg border border-border/70 bg-background p-0 text-foreground shadow-[var(--shadow-panel)]"
        >
          <div className="flex flex-col">
            <form
              className="border-b border-border/70 px-2.5 py-2.5"
              onSubmit={(event) => {
                event.preventDefault();
                commitZoomInput();
              }}
            >
              <Input
                autoFocus
                value={zoomInput}
                onChange={(event) => setZoomInput(event.target.value)}
                onBlur={() => commitZoomInput({ closeMenu: false })}
                className="block h-7 w-full rounded-md border border-border bg-muted/50 px-2 font-[var(--font-geist-sans)] text-[12px] leading-5 font-medium text-foreground outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30"
                inputMode="decimal"
                aria-label="Zoom percentage"
              />
            </form>

            <div className="flex flex-col py-1.5">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left font-[var(--font-geist-sans)] text-[12px] leading-[18px] text-foreground hover:bg-accent/60"
                onClick={() => handleZoomAction(zoom * 1.25)}
              >
                <span className="min-w-0 flex-1">Zoom in</span>
                <span className="shrink-0 text-[length:var(--text-label)] leading-4 text-muted-foreground">Cmd +</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left font-[var(--font-geist-sans)] text-[12px] leading-[18px] text-foreground hover:bg-accent/60"
                onClick={() => handleZoomAction(zoom / 1.25)}
              >
                <span className="min-w-0 flex-1">Zoom out</span>
                <span className="shrink-0 text-[length:var(--text-label)] leading-4 text-muted-foreground">Cmd -</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left font-[var(--font-geist-sans)] text-[12px] leading-[18px] text-foreground hover:bg-accent/60"
                onClick={() => handleZoomAction('fit')}
              >
                <span className="min-w-0 flex-1">Zoom to fit</span>
                <span className="shrink-0 text-[length:var(--text-label)] leading-4 text-muted-foreground">
                  Shift 1
                </span>
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left font-[var(--font-geist-sans)] text-[12px] leading-[18px] text-foreground hover:bg-accent/60"
                onClick={() => handleZoomAction(0.5)}
              >
                <span className="min-w-0 flex-1">Zoom to 50%</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left font-[var(--font-geist-sans)] text-[12px] leading-[18px] text-foreground hover:bg-accent/60"
                onClick={() => handleZoomAction(1)}
              >
                <span className="min-w-0 flex-1">Zoom to 100%</span>
                <span className="shrink-0 text-[length:var(--text-label)] leading-4 text-muted-foreground">Cmd 0</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left font-[var(--font-geist-sans)] text-[12px] leading-[18px] text-foreground hover:bg-accent/60"
                onClick={() => handleZoomAction(2)}
              >
                <span className="min-w-0 flex-1">Zoom to 200%</span>
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <div className="wire-dock-group">
        <button
          type="button"
          data-active={snapEnabled ? 'true' : 'false'}
          aria-pressed={snapEnabled}
          aria-label="Toggle snap"
          className="wire-dock-icon"
          onClick={onToggleSnap}
          title="Toggle snap"
        >
          <Crosshair className="size-4" />
        </button>
        <button
          type="button"
          data-active={guidesVisible ? 'true' : 'false'}
          aria-pressed={guidesVisible}
          aria-label="Toggle guides"
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
  onRenameIcon,
  onRenameState,
  onPatchVariant,
  onPatchSelectedLayer,
  onPatchSelectedLayerStyle,
  onPatchSelectedLayerTransform,
  onDeleteState,
  onDeleteVariant,
  guideMasterName,
  guidesVisible,
}: {
  rightTab: RightTab;
  onRightTabChange: (tab: RightTab) => void;
  selectedLayer: Layer | null;
  currentIcon: Icon | null;
  currentVariant: Variant | null;
  currentState: State | null;
  onRenameIcon: (value: string) => void;
  onRenameState: (value: string) => void;
  onPatchVariant: (patch: VariantEditorPatch) => void;
  onPatchSelectedLayer: (patch: Partial<Layer>) => void;
  onPatchSelectedLayerStyle: (patch: Partial<Layer['style']>) => void;
  onPatchSelectedLayerTransform: (patch: Partial<NonNullable<Layer['transform']>>) => void;
  onDeleteState: () => void;
  onDeleteVariant: () => void;
  guideMasterName: string | null;
  guidesVisible: boolean;
}) {
  const fillMode = selectedLayer?.style.fill?.mode ?? 'none';
  const strokeMode = selectedLayer?.style.stroke?.mode ?? 'none';

  // D-4: Debounce color input changes (~100ms)
  const colorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    };
  }, []);
  const debouncedPatchStyle = useCallback(
    (patch: Partial<Layer['style']>) => {
      if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
      colorDebounceRef.current = setTimeout(() => {
        onPatchSelectedLayerStyle(patch);
      }, 100);
    },
    [onPatchSelectedLayerStyle],
  );

  return (
    <aside className="wire-sidebar wire-sidebar-right">
      <div className="wire-sidebar-block wire-sidebar-head">
        <div className="wire-tab-row">
          <div className="wire-tabs" role="tablist" aria-label="Right sidebar">
            <button
              type="button"
              role="tab"
              aria-selected={rightTab === 'inspect'}
              data-active={rightTab === 'inspect' ? 'true' : 'false'}
              className="wire-tab-button"
              onClick={() => onRightTabChange('inspect')}
            >
              Inspect
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={rightTab === 'animation'}
              data-active={rightTab === 'animation' ? 'true' : 'false'}
              className="wire-tab-button"
              onClick={() => onRightTabChange('animation')}
            >
              Animation
            </button>
          </div>
        </div>
        <div className="wire-panel-title">
          {selectedLayer?.id ?? currentIcon?.name ?? 'Inspect'}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div key={rightTab} role="tabpanel" aria-label={rightTab === 'inspect' ? 'Inspect' : 'Animation'} className="wire-section animate-in fade-in duration-150">
          {rightTab === 'inspect' ? (
            selectedLayer ? (
              <>
                <TinyLabel>Layer</TinyLabel>
                <RowField label="Role">
                  <Input
                    key={selectedLayer.id}
                    defaultValue={selectedLayer.role ?? ''}
                    onBlur={(event) =>
                      onPatchSelectedLayer({ role: event.target.value || undefined })
                    }
                    className="wire-input w-full"
                  />
                </RowField>
                <div className="grid grid-cols-2 gap-1.5">
                  <RowField label="Fill">
                    <Select
                      value={fillMode}
                      onValueChange={(nextMode) => {
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
                      <SelectTrigger className="h-6 min-h-0 rounded-[5px] border-border bg-background px-2 py-0 text-[11px] leading-4 text-foreground/90 shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="currentColor">Current</SelectItem>
                      </SelectContent>
                    </Select>
                  </RowField>
                  <RowField label="Stroke">
                    <Select
                      value={strokeMode}
                      onValueChange={(nextMode) => {
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
                      <SelectTrigger className="h-6 min-h-0 rounded-[5px] border-border bg-background px-2 py-0 text-[11px] leading-4 text-foreground/90 shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="currentColor">Current</SelectItem>
                      </SelectContent>
                    </Select>
                  </RowField>
                </div>
                {fillMode === 'fixed' && (
                  <RowField label="Fill color">
                    <ColorPickerPopover
                      value={
                        selectedLayer.style.fill?.mode === 'fixed'
                          ? selectedLayer.style.fill.value
                          : '#111111'
                      }
                      onChange={(hex) =>
                        debouncedPatchStyle({
                          fill: { mode: 'fixed', value: hex },
                        })
                      }
                      opacity={selectedLayer.style.fillOpacity ?? 1}
                      onOpacityChange={(o) =>
                        debouncedPatchStyle({ fillOpacity: o })
                      }
                    />
                  </RowField>
                )}
                {strokeMode === 'fixed' && (
                  <RowField label="Stroke color">
                    <ColorPickerPopover
                      value={
                        selectedLayer.style.stroke?.mode === 'fixed'
                          ? selectedLayer.style.stroke.value
                          : '#111111'
                      }
                      onChange={(hex) =>
                        debouncedPatchStyle({
                          stroke: { mode: 'fixed', value: hex },
                        })
                      }
                      opacity={selectedLayer.style.strokeOpacity ?? 1}
                      onOpacityChange={(o) =>
                        debouncedPatchStyle({ strokeOpacity: o })
                      }
                    />
                  </RowField>
                )}
                <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-1.5">
                  <RowField label="Stroke width">
                    <Input
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
                    <Input
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
                    <Input
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
                    <Input
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
                  <Input
                    key={currentIcon?.id}
                    defaultValue={currentIcon?.name ?? ''}
                    onBlur={(event) => onRenameIcon(event.target.value)}
                    className="wire-input w-full"
                  />
                </RowField>
                <div className="grid grid-cols-2 gap-1.5">
                  <RowField label="State">
                    <Input
                      key={currentState?.id}
                      defaultValue={currentState?.id ?? ''}
                      onBlur={(event) => onRenameState(event.target.value)}
                      className="wire-input w-full"
                    />
                  </RowField>
                  <RowField label="Size">
                    <Input
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
                  <Select
                    value={currentVariant?.renderingMode ?? 'monochrome'}
                    onValueChange={(value) =>
                      onPatchVariant({ renderingMode: value as RenderingMode })
                    }
                  >
                    <SelectTrigger className="h-6 min-h-0 rounded-[5px] border-border bg-background px-2 py-0 text-[11px] leading-4 text-foreground/90 shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RENDERING_MODE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
            <TransitionPanel />
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
  const applyDerivedVariantAction = useEditorStore((s) => s.applyDerivedVariant);
  const isDeriving = useEditorStore((s) => s.isDeriving);
  const currentGuideMaster = useEditorStore(selectCurrentGuideMaster);
  const currentIcon = useEditorStore((s) =>
    s.currentIconId ? (s.project?.icons[s.currentIconId] ?? null) : null,
  );
  const currentVariant = useEditorStore((s) =>
    s.currentIconId && s.currentVariantId
      ? (s.project?.icons[s.currentIconId]?.variants[s.currentVariantId] ?? null)
      : null,
  );
  const currentState = useEditorStore((s) =>
    s.currentIconId && s.currentVariantId && s.currentStateId
      ? (s.project?.icons[s.currentIconId]?.variants[s.currentVariantId]?.states[
          s.currentStateId
        ] ?? null)
      : null,
  );

  const {
    addState,
    addVariant,
    createBlankIcon,
    openIconTab,
    patchLayer,
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
    setTool,
    setTransitionPreview,
    setViewport,
    toggleGuidesVisible,
    toggleSnap,
  } = useEditorActions();

  const [leftTab, setLeftTab] = useState<LeftTab>('layers');
  const [rightTab, setRightTab] = useState<RightTab>('inspect');
  const [mounted, setMounted] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [newVariantSize, setNewVariantSize] = useState('32');
  const [newStateName, setNewStateName] = useState('');
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DeleteIntent | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [searchIconId, setSearchIconId] = useState<string | undefined>();
  const [searchIconSetId, setSearchIconSetId] = useState<string | undefined>();
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

  const stateIds = useMemo(
    () => Object.keys(currentVariant?.states ?? {}),
    [currentVariant?.states],
  );

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
    () => Object.values(currentIcon?.transitions ?? {}).sort((a, b) => a.id.localeCompare(b.id)),
    [currentIcon?.transitions],
  );

  const selectedTransition = useMemo(() => {
    if (!transitions.length) return null;
    if (selectedTransitionId) {
      return (
        transitions.find((transition) => transition.id === selectedTransitionId) ??
        transitions[0] ??
        null
      );
    }
    return transitions[0] ?? null;
  }, [selectedTransitionId, transitions]);

  const selectedLayerId = selection.layerIds[0] ?? null;
  const selectedLayer = selectedLayerId ? (currentState?.layers[selectedLayerId] ?? null) : null;
  const projectName = project?.meta.name ?? 'Untitled Set';

  useEffect(() => {
    setMounted(true);
  }, []);

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
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl+K opens the command palette
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      handleEditorKeyDown(event);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-select the first visible layer only when switching icons/states
  // (not when user explicitly clears selection via Escape or empty-canvas click)
  const autoSelectKeyRef = useRef('');
  useEffect(() => {
    const key = `${currentIconId}:${currentVariantId}:${currentStateId}`;
    if (key === autoSelectKeyRef.current) return;
    autoSelectKeyRef.current = key;
    if (!project || !currentIconId || !currentStateId) return;
    const layers = currentVariantId
      ? (project.icons[currentIconId]?.variants[currentVariantId]?.states[currentStateId]?.layers ??
        {})
      : {};
    const nextLayerId =
      Object.values(layers).find((layer) => layer.visible !== false)?.id ?? Object.keys(layers)[0];
    if (!nextLayerId) return;
    setSelection({ layerIds: [nextLayerId], pointIds: [] });
  }, [
    currentIconId,
    currentStateId,
    currentVariantId,
    project,
    setSelection,
  ]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- previewProgress is read only for initial startTime; including it would teardown/restart the rAF loop every frame
  }, [currentVariant, previewPlaying, selectedTransition, setTransitionPreview]);

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
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1500);
    }
  };

  const runExport = async (label: string, fn: () => void | Promise<void>) => {
    setExporting(true);
    setExportMessage(null);
    try {
      await fn();
      setExportMessage(`${label} exported`);
      setTimeout(() => setExportMessage(null), 2000);
    } catch {
      setExportMessage(`${label} export failed`);
      setTimeout(() => setExportMessage(null), 3000);
    } finally {
      setExporting(false);
    }
  };

  const handleExportCurrentSvg = () =>
    runExport('SVG', async () => {
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
    });

  const handleExportSvgPackage = () =>
    runExport('SVG package', () => {
      if (!project) return;
      const fileMap = exportSvgPackage(project);
      const zipBlob = createZipBlob(fileMap);
      downloadBlob(zipBlob, `${slugify(project.meta.name)}-svg-package.zip`);
    });

  const handleExportRuntimeJson = () =>
    runExport('Runtime JSON', () => {
      if (!currentIcon || !project) return;
      const runtimeJson = exportRuntimeJson({
        ...currentIcon,
        tokenSet: project.tokenSet,
      });
      downloadBlob(
        new Blob([runtimeJson], { type: 'application/json' }),
        `${slugify(currentIcon.name)}.runtime.json`,
      );
    });

  const handleExportReactLibrary = () =>
    runExport('React library', () => {
      if (!project) return;
      const fileMap = generateIconLibrary(project, {
        packageName: `${slugify(project.meta.name)}-react-icons`,
        typescript: true,
      });
      downloadBlob(createZipBlob(fileMap), `${slugify(project.meta.name)}-react-library.zip`);
    });

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

  const handlePatchSelectedLayerTransform = (patch: Partial<NonNullable<Layer['transform']>>) => {
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

  if (!mounted) {
    return <div className="wireframe-editor fixed inset-0 bg-background" aria-hidden="true" />;
  }

  return (
    <div className="wireframe-editor fixed inset-0 flex flex-col overflow-hidden bg-background">
      {desktop ? <TitleTabBar /> : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_304px] lg:grid-cols-[220px_minmax(0,1fr)_304px]">
        {/* Mobile/tablet sidebar toggle */}
        <button
          type="button"
          className="fixed left-3 top-3 z-40 flex size-9 items-center justify-center rounded-lg border border-border/70 bg-background shadow-sm lg:hidden"
          onClick={() => setLeftSidebarOpen((v) => !v)}
          aria-label={leftSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {leftSidebarOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>

        {/* Left sidebar overlay for md breakpoint */}
        {leftSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/20 lg:hidden"
            onClick={() => setLeftSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <div
          className={`fixed inset-y-0 left-0 z-30 flex w-[272px] transition-transform duration-200 lg:relative lg:inset-auto lg:z-auto lg:w-auto lg:translate-x-0 ${
            leftSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
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
        </div>

        <main className="wire-canvas-shell">
          <div className="wire-canvas-area">
            {currentIcon?.meta?.derivedSpecs && currentIcon.meta.derivedSpecs.length > 0 &&
              currentVariantId &&
              currentIcon.meta.derivedSpecs.some((s) => s.baseVariantId === currentVariantId) && (
              <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                <span>This variant has derived variants. Changes may require re-derivation.</span>
                <button
                  type="button"
                  disabled={isDeriving}
                  className="ml-auto rounded-md bg-amber-200/60 px-2 py-0.5 text-[10px] font-medium text-amber-900 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={async () => {
                    if (!currentIcon || !currentVariantId || isDeriving) return;
                    const specs = currentIcon.meta?.derivedSpecs?.filter(
                      (s) => s.baseVariantId === currentVariantId,
                    ) ?? [];
                    for (const spec of specs) {
                      await applyDerivedVariantAction(currentIcon.id, spec);
                    }
                    toast({ title: `Re-derived ${specs.length} variant(s)` });
                  }}
                >
                  {isDeriving ? 'Deriving…' : 'Re-derive'}
                </button>
              </div>
            )}
            {currentIcon && currentVariant && currentState ? (
              <Canvas showStatusHud={false} />
            ) : (
              <div className="wire-canvas-empty">
                <p className="wire-title">No active icon</p>
                <p className="wire-empty-note mt-1">Create a new icon or import an SVG to begin.</p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    className="wire-mini-button"
                    onClick={handleCreateBlankIcon}
                  >
                    <Plus className="size-3.5" />
                    New icon
                  </button>
                  <button
                    type="button"
                    className="wire-mini-button"
                    onClick={() => setImportDialogOpen(true)}
                  >
                    <FolderOpen className="size-3.5" />
                    Import
                  </button>
                </div>
              </div>
            )}

            <CanvasDock
              activeTool={tool}
              zoom={viewport.zoom}
              guidesVisible={guidesVisible}
              snapEnabled={snapEnabled}
              onToolSelect={(nextTool) => setTool(nextTool)}
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
          onRenameIcon={handleRenameIcon}
          onRenameState={handleRenameState}
          onPatchVariant={handlePatchVariant}
          onPatchSelectedLayer={handlePatchSelectedLayer}
          onPatchSelectedLayerStyle={handlePatchSelectedLayerStyle}
          onPatchSelectedLayerTransform={handlePatchSelectedLayerTransform}
          onDeleteState={() =>
            currentState ? setPendingDelete({ type: 'state', id: currentState.id }) : undefined
          }
          onDeleteVariant={() =>
            currentVariant
              ? setPendingDelete({ type: 'variant', id: currentVariant.id })
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

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
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

      {/* F-7: Save success flash */}
      {saveSuccess && (
        <div
          className="pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2 animate-pulse rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 shadow-lg"
          role="status"
          aria-live="polite"
        >
          Saved successfully
        </div>
      )}

      {/* REMAINING-4: Export loading indicator */}
      {exporting && (
        <div
          className="pointer-events-none fixed left-1/2 top-16 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 shadow-lg"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-4 animate-spin" />
          Exporting...
        </div>
      )}

      {/* REMAINING-4: Export success/failure message */}
      {!exporting && exportMessage && (
        <div
          className={`pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-lg border px-4 py-2 text-sm font-medium shadow-lg ${
            exportMessage.includes('failed')
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-green-200 bg-green-50 text-green-800'
          }`}
          role="status"
          aria-live="polite"
        >
          {exportMessage}
        </div>
      )}
    </div>
  );
}
