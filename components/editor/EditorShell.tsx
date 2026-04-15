'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Blend,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  FolderOpen,
  HelpCircle,
  Loader2,
  Lock,
  Magnet,
  Menu,
  MousePointer2,
  Pencil,
  PenTool,
  Plus,
  Ruler,
  Square,
  Trash2,
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { editorStore, type TransitionPreview } from '@/lib/editor-store/store';
import { buildLayerPanelRows, selectCurrentGuideMaster } from '@/lib/editor-store/selectors';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import { toast } from '@/components/ui/use-toast';
import { Toolbar } from '@/components/editor/Toolbar';
import { SAMPLE_WORKSPACE } from '@/lib/schema/sample-project';
import type {
  Icon,
  Layer,
  RenderingMode,
  Variant,
} from '@/lib/schema/types';
import { variantToSnapshot } from '@/lib/schema/types';
import type { TransitionConfig } from '@/lib/runtime-core/transition-resolver';
import { clearCurrentProjectPath, exportSvg, saveProject } from '@/lib/platform/bridge';
import { buildEditorRoute, parseEditorSearchParam } from '@/lib/platform/routes';
import { exportSvgString } from '@/lib/export/export-svg';
import { exportSvgPackage } from '@/lib/export/export-svg-package';
import { exportRuntimeJson } from '@/lib/export/export-runtime-json';
import { generateIconLibrary } from '@/lib/export/export-react/generate-library';
import { createZipBlob } from '@/lib/export/export-react/zip';
import { handleEditorKeyDown } from '@/lib/editor-core/keyboard';
import { interpolateTransitionValues, resolveTransition } from '@/lib/runtime-core';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Canvas } from './Canvas';
import { ImportIconDialog } from './ImportIconDialog';
import { ColorPickerPopover } from './ColorPickerPopover';
import { TransitionPanel } from './TransitionPanel';
import { AnimationStudioPanel } from './AnimationStudioPanel';
import { EditorSidebarTabs } from './EditorSidebarTabs';
import { editorSelectTriggerClassName } from './editorSelectTriggerClassName';
import { ListPane } from '@/components/studio/ListPane';
import { cn } from '@/lib/utils';

type RightTab = 'inspect' | 'animation';
type DeleteIntent =
  | { type: 'variant'; id: string };
type VariantEditorPatch = Partial<Pick<Variant, 'size' | 'renderingMode'>>;

const TOOL_ITEMS = [
  { tool: 'select', label: 'Select', icon: MousePointer2, shortcut: 'V' },
  { tool: 'shape', label: 'Shape', icon: Square, shortcut: 'U' },
  { tool: 'pen', label: 'Pen', icon: PenTool, shortcut: 'P' },
] as const;

const RENDERING_MODE_OPTIONS: Array<{ value: RenderingMode; label: string }> = [
  { value: 'monochrome', label: 'Monochrome' },
  { value: 'hierarchical', label: 'Hierarchical' },
  { value: 'palette', label: 'Palette' },
  { value: 'multicolor', label: 'Multicolor' },
];

const RENDERING_MODE_TOOLTIP =
  'Rendering mode controls color interpretation at export. Monochrome: single-color icon. Hierarchical: primary/secondary weighting. Palette: tokenized palette colors. Multicolor: preserves all fill colors.';

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '__none__', label: 'None' },
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'tertiary', label: 'Tertiary' },
  { value: 'decorative', label: 'Decorative' },
];

const ROLE_TOOLTIP =
  'Role drives theming layering: primary → main stroke/fill, secondary → supporting detail, tertiary → background, decorative → ignored at export.';

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

// A paint is "visible" only if it is defined and not explicitly `none`.
// The schema represents transparent fills as { mode: 'fixed', value: 'none' },
// and the runtime treats undefined paints as `none` too. Both cases should
// render as empty in the layer thumbnail so it matches what the canvas shows.
function isPaintVisibleForPreview(
  paint: Layer['style']['fill'] | Layer['style']['stroke'],
): boolean {
  if (!paint) return false;
  if (paint.mode === 'fixed' && paint.value === 'none') return false;
  return true;
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
  transition: TransitionConfig,
  variant: Variant,
  progress: number,
): TransitionPreview | null {
  const snapshot = variantToSnapshot(variant);

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const resolvedTransition = resolveTransition(transition, snapshot, snapshot);

  return {
    transitionId: transition.id ?? 'preview',
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

function RowField({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="wire-field">
      <span className="wire-field-name">{label}</span>
      {children}
    </label>
  );
}


/* ToolRail removed — search/import actions moved to sidebar head */

// Type management section — lets users define named visual types per variant
// (e.g. "line", "filled", "colored"). Free-form identifiers.
//
// Exported for per-site characterization testing. Plan §6 Phase 4 Commit 2
// requires locking in the inline-rename state machine in isolation from
// the full EditorShell, which is too heavy to mount in bun + happy-dom.
// The export is intentionally named `TypesSection` (not a generic
// `_TypesSection`) — if this ever needs to move to its own file during
// Phase 5, the import path changes and the test updates in lockstep.
export function TypesSection({
  typeCatalog,
  defaultTypeId,
  currentTypeId,
  onSelectType,
  onAddType,
  onRemoveType,
  onRenameType,
  onSetTypeName,
  onDuplicateType,
}: {
  typeCatalog: Record<string, { id: string; name?: string }> | null | undefined;
  defaultTypeId: string | null;
  currentTypeId: string | null;
  onSelectType: (typeId: string) => void;
  onAddType: (typeId: string) => void;
  onRemoveType: (typeId: string) => void;
  onRenameType: (oldId: string, newId: string) => void;
  /**
   * Update the display label of the default type without changing its
   * structural id. Used specifically for the default row's rename
   * interaction — the id `'default'` stays stable so runtime/export/
   * transition pipelines keep working, and only the user-facing name
   * string is rewritten. Non-default rows go through `onRenameType`
   * instead, which performs a full catalog + per-variant id rewrite.
   */
  onSetTypeName: (typeId: string, name: string) => void;
  onDuplicateType: (sourceId: string, newId: string) => void;
}) {
  const [newTypeName, setNewTypeName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const typeIds = useMemo(
    () => Object.keys(typeCatalog ?? {}),
    [typeCatalog],
  );

  const handleAdd = () => {
    const name = newTypeName.trim() || `type-${typeIds.length + 1}`;
    onAddType(name);
    setNewTypeName('');
  };

  /**
   * Commit a rename. Two paths:
   *
   *   1. Default type  → `onSetTypeName` — updates the display label only.
   *      The structural id `'default'` stays stable, so all transition
   *      endpoints, export code, and runtime fallbacks that reference
   *      that literal keep working unchanged.
   *
   *   2. Non-default  → `onRenameType` — rewrites the catalog id and
   *      propagates the new id to every variant's `types` map.
   *
   * Collision/empty/no-op cases leave the row in rename mode so the
   * user gets unambiguous feedback that nothing committed. Only a
   * successful commit closes the input.
   */
  const commitRename = (typeId: string) => {
    const trimmed = renameValue.trim();
    const isDefault = typeId === defaultTypeId;
    if (isDefault) {
      const currentName = typeCatalog?.[typeId]?.name ?? '';
      if (trimmed === currentName) {
        setRenamingId(null);
        return;
      }
      onSetTypeName(typeId, trimmed);
      setRenamingId(null);
      return;
    }
    if (!trimmed || trimmed === typeId) {
      setRenamingId(null);
      return;
    }
    if (typeCatalog && typeCatalog[trimmed]) {
      // Collision — leave rename mode open so the user can fix it.
      return;
    }
    onRenameType(typeId, trimmed);
    setRenamingId(null);
  };

  return (
    <>
      <div className="wire-section-header mt-4">
        <span>Types</span>
      </div>

      <div className="wire-inline-form !p-0">
        <Input
          value={newTypeName}
          onChange={(e) => setNewTypeName(e.target.value)}
          placeholder="e.g. line, filled, colored"
          className="wire-input"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button variant="outline" size="sm" className="wire-mini-button" onClick={handleAdd}>
          Add
        </Button>
      </div>

      {typeIds.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          No types. Add types to define visual styles (e.g. line, filled, colored).
        </p>
      ) : (
        typeIds.map((typeId) => {
          const isDefault = typeId === defaultTypeId;
          // Display label falls back to the structural id. This lets the
          // user customize the default type's label via `setTypeName`
          // without ever changing the serialized key.
          const displayLabel = typeCatalog?.[typeId]?.name ?? typeId;
          const startRename = () => {
            setRenameValue(displayLabel);
            setRenamingId(typeId);
          };
          if (renamingId === typeId) {
            return (
              <div key={typeId} className="group flex items-center">
                {/*
                  The rename input drops into the same `wire-list-row` box
                  the label was rendered in: identical min-height, padding,
                  font size, and flex behavior. The `inline-rename-input`
                  class adds the visible border + focus ring. Together they
                  produce a pixel-perfect swap (no text jump vertically or
                  horizontally when entering/leaving edit mode).
                */}
                <input
                  type="text"
                  autoFocus
                  className="wire-list-row inline-rename-input flex-1 justify-start gap-1.5 px-[10px] text-[11px]"
                  style={{ ['--inline-rename-height' as string]: '36px' }}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitRename(typeId);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setRenamingId(null);
                    }
                  }}
                  onBlur={() => commitRename(typeId)}
                />
              </div>
            );
          }
          return (
            <ContextMenu key={typeId}>
              <ContextMenuTrigger asChild>
                <div className="group flex items-center">
                  {/*
                    `wire-list-row` defines the visual baseline (36px min
                    height, 10px symmetric horizontal padding, hover/active
                    states). The Tailwind utilities below override the
                    `Button` base variant's `justify-center h-9 px-4` so
                    icon + label align flush-left and the row height + gap
                    match the layer list exactly.
                  */}
                  <Button
                    variant="ghost"
                    data-active={typeId === currentTypeId ? 'true' : 'false'}
                    className="wire-list-row inline-rename-label flex-1 justify-start gap-1.5 px-[10px] text-[11px]"
                    style={{ ['--inline-rename-height' as string]: '36px' }}
                    onClick={() => onSelectType(typeId)}
                    onDoubleClick={startRename}
                    onKeyDown={(e) => {
                      // Wire F2 at the row level so the shortcut the
                      // context menu advertises actually works when the
                      // row is keyboard-focused.
                      if (e.key === 'F2') {
                        e.preventDefault();
                        startRename();
                      }
                    }}
                  >
                    {isDefault ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center text-muted-foreground/80">
                            <Lock className="size-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right">Default type — cannot be deleted, but the label can be renamed.</TooltipContent>
                      </Tooltip>
                    ) : null}
                    <span>{displayLabel}</span>
                  </Button>
                  {isDefault ? null : (
                    <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pr-2">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-5 text-muted-foreground hover:text-foreground"
                        aria-label={`Duplicate ${typeId}`}
                        onClick={() => onDuplicateType(typeId, `${typeId}-copy`)}
                      >
                        <Copy className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-5 text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${typeId}`}
                        onClick={() => setDeleteTarget(typeId)}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-48">
                <ContextMenuItem
                  onSelect={() => {
                    // Defer to next tick so the ContextMenu has time to
                    // unmount before we flip the row into rename mode.
                    // Without this, the context menu's focus trap steals
                    // the auto-focus from the rename <input>.
                    setTimeout(() => {
                      startRename();
                    }, 0);
                  }}
                >
                  <Pencil className="size-4" />
                  Rename
                  <ContextMenuShortcut>F2</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => onDuplicateType(typeId, `${typeId}-copy`)}
                >
                  <Copy className="size-4" />
                  Duplicate
                </ContextMenuItem>
                {isDefault ? null : (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onSelect={() => setDeleteTarget(typeId)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </ContextMenuItem>
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
          );
        })
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete type</AlertDialogTitle>
            <AlertDialogDescription>
              Delete the &ldquo;{deleteTarget}&rdquo; type? This removes all layer data for this type. You can undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) onRemoveType(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function InlineEditableTitle({
  value,
  onCommit,
  className,
}: {
  value: string;
  onCommit: (newValue: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  const startEditing = useCallback(() => {
    setDraft(value);
    cancelledRef.current = false;
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [value]);

  const commit = useCallback(() => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setEditing(false);
      return;
    }
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onCommit(trimmed);
    setEditing(false);
  }, [draft, value, onCommit]);

  // Both states share the same box so the title doesn't jump when
  // entering/leaving edit mode. The underlying pattern: identical
  // height, padding, font, margin. The button's hover background + the
  // input's visible border live inside the same border-box.
  const SHARED_BOX =
    'h-6 min-w-0 w-full rounded-md px-1.5 text-sm font-semibold tracking-tight text-foreground';

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`${SHARED_BOX} border border-border bg-background outline-none focus:ring-1 focus:ring-ring ${className ?? ''}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            cancelledRef.current = true;
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      className={`group/edit flex items-center gap-1 ${SHARED_BOX} border border-transparent hover:bg-accent ${className ?? ''}`}
      onClick={startEditing}
    >
      <span className="truncate">{value}</span>
      <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/edit:opacity-100" />
    </button>
  );
}

function LeftSidebar({
  currentIcon,
  currentVariant,
  typeCatalog,
  defaultTypeId,
  layerRows,
  selectedLayerId,
  onSelectLayer,
  onToggleLayerVisibility,
  onRenameIcon,
  variants,
  currentVariantId,
  onSelectVariant,
  newVariantSize,
  onNewVariantSizeChange,
  onCreateVariant,
  currentTypeId,
  onSelectType,
  onAddType,
  onRemoveType,
  onRenameType,
  onSetTypeName,
  onDuplicateType,
}: {
  currentIcon: Icon | null;
  currentVariant: Variant | null;
  typeCatalog: Record<string, { id: string; name?: string }> | null | undefined;
  defaultTypeId: string | null;
  layerRows: ReturnType<typeof buildLayerPanelRows>;
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string) => void;
  onToggleLayerVisibility: (layerId: string, visible: boolean) => void;
  onRenameIcon: (value: string) => void;
  variants: Variant[];
  currentVariantId: string | null;
  onSelectVariant: (variantId: string) => void;
  newVariantSize: string;
  onNewVariantSizeChange: (value: string) => void;
  onCreateVariant: () => void;
  currentTypeId: string | null;
  onSelectType: (typeId: string) => void;
  onAddType: (typeId: string) => void;
  onRemoveType: (typeId: string) => void;
  onRenameType: (oldId: string, newId: string) => void;
  onSetTypeName: (typeId: string, name: string) => void;
  onDuplicateType: (sourceId: string, newId: string) => void;
}) {

  return (
    <aside className="wire-sidebar wire-sidebar-left">
      <div className="wire-sidebar-block wire-sidebar-head">
        <div className="wire-sidebar-title-stack">
          <div className="wire-sidebar-title-row">
            <InlineEditableTitle
              value={currentIcon?.name ?? 'No icon selected'}
              onCommit={onRenameIcon}
            />
          </div>
        </div>
      </div>

      <ResizablePanelGroup direction="vertical" className="min-h-0 flex-1">
        <ResizablePanel defaultSize={38} minSize={18} maxSize={70}>
          <ScrollArea className="h-full">
            <div role="region" aria-label="Variants" className="wire-section animate-in fade-in duration-150">
              <div className="wire-section-header">
                <span>Sizes</span>
              </div>
              <div className="wire-inline-form !p-0">
                <Input
                  value={newVariantSize}
                  onChange={(event) => onNewVariantSizeChange(event.target.value)}
                  type="number"
                  min="1"
                  step="1"
                  placeholder="New size (px)"
                  aria-label="New variant size in pixels"
                  className="wire-input"
                />
                <Button variant="outline" size="sm" className="wire-mini-button" onClick={onCreateVariant}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 px-0.5 pt-1">
                {variants.map((variant) => {
                  const isDerived = variant.id.includes('.');
                  const isCurrent = variant.id === currentVariantId;
                  return (
                    <ContextMenu key={variant.id}>
                      <ContextMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onSelectVariant(variant.id)}
                          data-active={isCurrent ? 'true' : 'false'}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                            isCurrent
                              ? 'border-primary bg-primary/10 text-foreground shadow-[0_0_0_1px_var(--primary)]'
                              : 'border-border/70 bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                          )}
                        >
                          <span>{formatVariantLabel(variant)}</span>
                          {isDerived ? (
                            <span className="rounded-sm bg-muted px-1 py-0.5 text-[10px] font-medium leading-none tracking-wide text-muted-foreground">
                              derived
                            </span>
                          ) : null}
                        </button>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onSelect={() => onSelectVariant(variant.id)}>
                          <Pencil className="size-4" />
                          Resize
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={() => {
                            if (!currentIcon) return;
                            // Create a new variant with the same size but a
                            // fresh id; addVariant clones layers + topology
                            // via sourceVariantId. Using the same size is
                            // intentional — users "duplicate" to branch
                            // iterations at the same resolution.
                            editorStore.getState().addVariant?.(currentIcon.id, {
                              size: variant.size,
                              sourceVariantId: variant.id,
                            });
                          }}
                        >
                          <Copy className="size-4" />
                          Duplicate
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => {
                            if (!currentIcon) return;
                            editorStore.getState().removeVariant?.(currentIcon.id, variant.id);
                          }}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>

              {/* Type management section — e.g. line, filled, colored */}
              <TypesSection
                typeCatalog={typeCatalog}
                defaultTypeId={defaultTypeId}
                currentTypeId={currentTypeId}
                onSelectType={onSelectType}
                onAddType={onAddType}
                onRemoveType={onRemoveType}
                onRenameType={onRenameType}
                onSetTypeName={onSetTypeName}
                onDuplicateType={onDuplicateType}
              />
            </div>
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={62} minSize={30}>
          <ScrollArea className="h-full">
            <div role="region" aria-label="Layers" className="wire-section animate-in fade-in duration-150">
              <div className="wire-section-header">
                <span>Layers · {currentVariant ? formatVariantLabel(currentVariant) : '—'}</span>
              </div>
              {layerRows.length === 0 ? (
                // R6 / UX-3.4: actionable empty state for the layer list.
                <div className="wire-empty-note grid gap-2 px-1 py-2" role="status">
                  <p className="font-medium text-foreground">No layers yet</p>
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    Draw a path or drop an SVG to get started.
                  </p>
                  <ul className="grid gap-1 text-[10px] text-muted-foreground">
                    <li className="flex items-center gap-1.5">
                      <kbd className="rounded-sm border border-border bg-muted px-1 font-mono text-[9px]">P</kbd>
                      <span>Pen tool</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <kbd className="rounded-sm border border-border bg-muted px-1 font-mono text-[9px]">U</kbd>
                      <span>Shape tool</span>
                    </li>
                    <li className="text-muted-foreground/70">or drag an SVG file onto the canvas</li>
                  </ul>
                </div>
              ) : (
                <LayerRowsList
                  layerRows={layerRows}
                  selectedLayerId={selectedLayerId}
                  onSelectLayer={onSelectLayer}
                  onToggleLayerVisibility={onToggleLayerVisibility}
                  currentIconId={currentIcon?.id ?? null}
                  currentVariant={currentVariant}
                />
              )}
            </div>
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
    </aside>
  );
}

function LayerRowsList({
  layerRows,
  selectedLayerId,
  onSelectLayer,
  onToggleLayerVisibility,
  currentIconId,
  currentVariant,
}: {
  layerRows: ReturnType<typeof buildLayerPanelRows>;
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string) => void;
  onToggleLayerVisibility: (layerId: string, visible: boolean) => void;
  currentIconId: string | null;
  currentVariant: Variant | null;
}) {
  const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null);
  const dragSourceIdRef = useRef<string | null>(null);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const beginRename = useCallback((layerId: string) => {
    setRenamingLayerId(layerId);
    setRenameValue(layerId);
  }, []);

  const commitRename = useCallback(
    (layerId: string) => {
      const trimmed = renameValue.trim();
      if (trimmed && trimmed !== layerId && currentIconId) {
        editorStore.getState().renameLayer?.(currentIconId, layerId, trimmed);
      }
      setRenamingLayerId(null);
    },
    [currentIconId, renameValue],
  );

  const viewBoxStr = currentVariant?.viewBox.join(' ') ?? '0 0 24 24';

  return (
    <div role="listbox" aria-label="Layers" className="relative">
      {layerRows.map((row, index) => {
        const isSelected = row.layer.id === selectedLayerId;
        const isDropTarget = dragTargetIndex === index;
        const isRenaming = renamingLayerId === row.layer.id;
        const hasFill = isPaintVisibleForPreview(row.layer.style.fill);
        const hasStroke = isPaintVisibleForPreview(row.layer.style.stroke);
        const hasPathPreview = Boolean(row.layer.path?.d) && (hasFill || hasStroke);
        return (
          <ContextMenu key={row.layer.id}>
            <ContextMenuTrigger asChild>
              <div
                role="option"
                aria-selected={isSelected}
                data-active={isSelected ? 'true' : 'false'}
                className="wire-layer-row relative"
                draggable={!isRenaming}
                onClick={() => {
                  if (isRenaming) return;
                  onSelectLayer(row.layer.id);
                }}
                onKeyDown={(e) => {
                  if (isRenaming) return;
                  if (e.key === 'Enter') onSelectLayer(row.layer.id);
                  if (e.key === 'F2') {
                    e.preventDefault();
                    beginRename(row.layer.id);
                  }
                }}
                tabIndex={0}
                onDragStart={(e) => {
                  dragSourceIdRef.current = row.layer.id;
                  try {
                    e.dataTransfer.setData('text/contour-layer-id', row.layer.id);
                  } catch {
                    // ignore
                  }
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  if (!dragSourceIdRef.current) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragTargetIndex(index);
                }}
                onDragLeave={() => {
                  if (dragTargetIndex === index) setDragTargetIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const sourceId = dragSourceIdRef.current;
                  dragSourceIdRef.current = null;
                  setDragTargetIndex(null);
                  if (!sourceId || sourceId === row.layer.id) return;
                  editorStore.getState().moveLayerToIndex?.(sourceId, index);
                }}
                onDragEnd={() => {
                  dragSourceIdRef.current = null;
                  setDragTargetIndex(null);
                }}
              >
                {isDropTarget ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-1 top-0 h-[2px] rounded-full bg-primary"
                  />
                ) : null}
                <div
                  className="wire-layer-line"
                  style={{ paddingLeft: `${row.depth * 12}px` }}
                >
                  {/* Per-layer SVG thumbnail: renders the actual path
                      geometry for the current variant, honoring whether
                      fill / stroke are visible. Falls back to a neutral
                      dot when the layer has no drawable content. */}
                  <span
                    aria-hidden
                    className="wire-layer-swatch"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {hasPathPreview && row.layer.path?.d ? (
                      <svg
                        viewBox={viewBoxStr}
                        width="100%"
                        height="100%"
                        preserveAspectRatio="xMidYMid meet"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ display: 'block', overflow: 'visible' }}
                      >
                        <path
                          d={row.layer.path.d}
                          fill={hasFill ? 'currentColor' : 'none'}
                          stroke={hasStroke ? 'currentColor' : 'none'}
                          // Use the actual stroke width in user units so the
                          // thumbnail's stroke scales through the viewBox
                          // transform exactly the way the icon does at the
                          // thumbnail's render size — no `non-scaling-stroke`
                          // hack that would force a constant screen-pixel width.
                          strokeWidth={row.layer.style.strokeWidth ?? 1.5}
                          strokeLinecap={row.layer.style.lineCap ?? 'round'}
                          strokeLinejoin={row.layer.style.lineJoin ?? 'round'}
                          fillRule={row.layer.path.fillRule}
                        />
                      </svg>
                    ) : (
                      <span className="wire-layer-swatch-dot" />
                    )}
                  </span>
                  {isRenaming ? (
                    <input
                      type="text"
                      className="wire-layer-rename-input inline-rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitRename(row.layer.id);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setRenamingLayerId(null);
                        }
                        e.stopPropagation();
                      }}
                      onBlur={() => commitRename(row.layer.id)}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="wire-layer-name inline-rename-label"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        beginRename(row.layer.id);
                      }}
                    >
                      {row.layer.id}
                    </span>
                  )}
                  {row.layer.isClipMask ? (
                    <span className="wire-layer-kind">mask</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="wire-row-control"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLayerVisibility(row.layer.id, row.layer.visible === false);
                  }}
                  aria-label={row.layer.visible === false ? 'Show layer' : 'Hide layer'}
                >
                  {row.layer.visible === false ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-52">
              <ContextMenuItem
                onSelect={() => {
                  beginRename(row.layer.id);
                }}
              >
                <Pencil className="size-4" />
                Rename
                <ContextMenuShortcut>F2</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => {
                  editorStore.getState().setSelection?.({ layerIds: [row.layer.id], pointIds: [] });
                  editorStore.getState().duplicateSelectedLayers?.();
                }}
              >
                <Copy className="size-4" />
                Duplicate
                <ContextMenuShortcut>⌘D</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onSelect={() => {
                  editorStore.getState().setSelection?.({ layerIds: [row.layer.id], pointIds: [] });
                  editorStore.getState().reorderSelectedLayers?.('front');
                }}
              >
                Move to Top
                <ContextMenuShortcut>⌘⌥↑</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => {
                  editorStore.getState().setSelection?.({ layerIds: [row.layer.id], pointIds: [] });
                  editorStore.getState().reorderSelectedLayers?.('back');
                }}
              >
                Move to Bottom
                <ContextMenuShortcut>⌘⌥↓</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  editorStore.getState().setSelection?.({ layerIds: [row.layer.id], pointIds: [] });
                  editorStore.getState().removeSelectedLayers?.();
                }}
              >
                <Trash2 className="size-4" />
                Delete
                <ContextMenuShortcut>⌫</ContextMenuShortcut>
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
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
            <Tooltip key={item.tool}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  data-active={activeTool === item.tool ? 'true' : 'false'}
                  className="wire-dock-icon"
                  onClick={() => onToolSelect(item.tool)}
                  aria-label={item.label}
                >
                  <Icon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{item.label} ({item.shortcut})</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <Popover open={zoomMenuOpen} onOpenChange={setZoomMenuOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="wire-zoom-trigger" aria-label="Canvas zoom controls">
            <span>{formatZoomPercent(zoom)}</span>
            <ChevronDown className="size-3.5" />
          </Button>
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
                className="block h-7 w-full rounded-md border border-border bg-muted/50 px-2 font-[var(--font-geist-sans)] text-[12px] leading-5 font-medium text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                inputMode="decimal"
                aria-label="Zoom percentage"
              />
            </form>

            <div className="flex flex-col py-1.5">
              <Button
                variant="ghost"
                className="h-auto w-full justify-between gap-3 rounded-none px-4 py-2 text-left font-[var(--font-geist-sans)] text-[12px] leading-[18px] text-foreground hover:bg-accent/60"
                onClick={() => handleZoomAction(zoom * 1.25)}
              >
                <span className="min-w-0 flex-1">Zoom in</span>
                <span className="shrink-0 text-[length:var(--text-label)] leading-4 text-muted-foreground">Cmd +</span>
              </Button>
              <Button
                variant="ghost"
                className="h-auto w-full justify-between gap-3 rounded-none px-4 py-2 text-left font-[var(--font-geist-sans)] text-[12px] leading-[18px] text-foreground hover:bg-accent/60"
                onClick={() => handleZoomAction(zoom / 1.25)}
              >
                <span className="min-w-0 flex-1">Zoom out</span>
                <span className="shrink-0 text-[length:var(--text-label)] leading-4 text-muted-foreground">Cmd -</span>
              </Button>
              <Button
                variant="ghost"
                className="h-auto w-full justify-between gap-3 rounded-none px-4 py-2 text-left font-[var(--font-geist-sans)] text-[12px] leading-[18px] text-foreground hover:bg-accent/60"
                onClick={() => handleZoomAction('fit')}
              >
                <span className="min-w-0 flex-1">Zoom to fit</span>
                <span className="shrink-0 text-[length:var(--text-label)] leading-4 text-muted-foreground">
                  Shift 1
                </span>
              </Button>
              <Button
                variant="ghost"
                className="h-auto w-full justify-between gap-3 rounded-none px-4 py-2 text-left font-[var(--font-geist-sans)] text-[12px] leading-[18px] text-foreground hover:bg-accent/60"
                onClick={() => handleZoomAction(0.5)}
              >
                <span className="min-w-0 flex-1">Zoom to 50%</span>
              </Button>
              <Button
                variant="ghost"
                className="h-auto w-full justify-between gap-3 rounded-none px-4 py-2 text-left font-[var(--font-geist-sans)] text-[12px] leading-[18px] text-foreground hover:bg-accent/60"
                onClick={() => handleZoomAction(1)}
              >
                <span className="min-w-0 flex-1">Zoom to 100%</span>
                <span className="shrink-0 text-[length:var(--text-label)] leading-4 text-muted-foreground">Cmd 0</span>
              </Button>
              <Button
                variant="ghost"
                className="h-auto w-full justify-between gap-3 rounded-none px-4 py-2 text-left font-[var(--font-geist-sans)] text-[12px] leading-[18px] text-foreground hover:bg-accent/60"
                onClick={() => handleZoomAction(2)}
              >
                <span className="min-w-0 flex-1">Zoom to 200%</span>
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <div className="wire-dock-group">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              data-active={snapEnabled ? 'true' : 'false'}
              aria-pressed={snapEnabled}
              aria-label="Toggle snap"
              className="wire-dock-icon"
              onClick={onToggleSnap}
            >
              <Magnet className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Snap {snapEnabled ? 'On' : 'Off'}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              data-active={guidesVisible ? 'true' : 'false'}
              aria-pressed={guidesVisible}
              aria-label="Toggle guides"
              className="wire-dock-icon"
              onClick={onToggleGuides}
            >
              <Ruler className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Guides {guidesVisible ? 'On' : 'Off'}</TooltipContent>
        </Tooltip>
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
  onRenameIcon,
  onRenameLayer,
  onPatchVariant,
  onPatchSelectedLayer,
  onPatchSelectedLayerStyle,
  onPatchSelectedLayerTransform,
  onDeleteVariant,
  guideMasterName,
  guidesVisible,
}: {
  rightTab: RightTab;
  onRightTabChange: (tab: RightTab) => void;
  selectedLayer: Layer | null;
  currentIcon: Icon | null;
  currentVariant: Variant | null;
  onRenameIcon: (value: string) => void;
  onRenameLayer: (oldId: string, newId: string) => void;
  onPatchVariant: (patch: VariantEditorPatch) => void;
  onPatchSelectedLayer: (patch: Partial<Layer>) => void;
  onPatchSelectedLayerStyle: (patch: Partial<Layer['style']>) => void;
  onPatchSelectedLayerTransform: (patch: Partial<NonNullable<Layer['transform']>>) => void;
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
        <InlineEditableTitle
          value={selectedLayer?.id ?? currentIcon?.name ?? 'Inspect'}
          onCommit={(newValue) => {
            if (selectedLayer) {
              onRenameLayer(selectedLayer.id, newValue);
            } else {
              onRenameIcon(newValue);
            }
          }}
        />
        <EditorSidebarTabs
          ariaLabel="Right sidebar"
          value={rightTab}
          onChange={onRightTabChange}
          options={[
            { value: 'inspect', label: 'Inspect' },
            { value: 'animation', label: 'Animation' },
          ]}
        />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div key={rightTab} role="tabpanel" aria-label={rightTab === 'inspect' ? 'Inspect' : 'Animation'} className="wire-section animate-in fade-in duration-150">
          {rightTab === 'inspect' ? (
            selectedLayer ? (
              <>
                <TinyLabel>Layer</TinyLabel>
                <RowField
                  label={
                    <span className="flex items-center gap-1">
                      <span>Role</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            tabIndex={0}
                            className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            aria-label="What is Role?"
                          >
                            <HelpCircle className="size-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[220px]">{ROLE_TOOLTIP}</TooltipContent>
                      </Tooltip>
                    </span>
                  }
                >
                  <Select
                    value={selectedLayer.role && ROLE_OPTIONS.some((o) => o.value === selectedLayer.role) ? selectedLayer.role : '__none__'}
                    onValueChange={(next) =>
                      onPatchSelectedLayer({ role: next === '__none__' ? undefined : next })
                    }
                  >
                    <SelectTrigger className={editorSelectTriggerClassName}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </RowField>
                <div className="grid gap-1.5">
                  <RowField label="Fill">
                    <ToggleGroup
                      type="single"
                      size="sm"
                      variant="outline"
                      value={fillMode === 'currentColor' ? 'inherited' : fillMode === 'fixed' ? 'static' : 'none'}
                      onValueChange={(nextMode) => {
                        if (!nextMode) return;
                        if (nextMode === 'none') {
                          onPatchSelectedLayerStyle({ fill: undefined });
                          return;
                        }
                        if (nextMode === 'inherited') {
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
                      className="h-7 w-full justify-stretch rounded-md border border-border/70"
                    >
                      <ToggleGroupItem value="none" aria-label="No fill" className="flex-1 text-[length:var(--text-label)]">
                        None
                      </ToggleGroupItem>
                      <ToggleGroupItem value="static" aria-label="Static fill" className="flex-1 text-[length:var(--text-label)]">
                        Static
                      </ToggleGroupItem>
                      <ToggleGroupItem value="inherited" aria-label="Inherited fill" className="flex-1 text-[length:var(--text-label)]">
                        Inherited
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </RowField>
                  <RowField label="Stroke">
                    <ToggleGroup
                      type="single"
                      size="sm"
                      variant="outline"
                      value={strokeMode === 'currentColor' ? 'inherited' : strokeMode === 'fixed' ? 'static' : 'none'}
                      onValueChange={(nextMode) => {
                        if (!nextMode) return;
                        if (nextMode === 'none') {
                          onPatchSelectedLayerStyle({ stroke: undefined });
                          return;
                        }
                        if (nextMode === 'inherited') {
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
                      className="h-7 w-full justify-stretch rounded-md border border-border/70"
                    >
                      <ToggleGroupItem value="none" aria-label="No stroke" className="flex-1 text-[length:var(--text-label)]">
                        None
                      </ToggleGroupItem>
                      <ToggleGroupItem value="static" aria-label="Static stroke" className="flex-1 text-[length:var(--text-label)]">
                        Static
                      </ToggleGroupItem>
                      <ToggleGroupItem value="inherited" aria-label="Inherited stroke" className="flex-1 text-[length:var(--text-label)]">
                        Inherited
                      </ToggleGroupItem>
                    </ToggleGroup>
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
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        value={selectedLayer.style.strokeWidth ?? 0}
                        onChange={(event) =>
                          onPatchSelectedLayerStyle({
                            strokeWidth: Number.parseFloat(event.target.value) || 0,
                          })
                        }
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={selectedLayer.style.strokeWidth ?? 0}
                        className="wire-input w-full pr-6"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        px
                      </span>
                    </div>
                  </RowField>
                  <RowField label="Guides">
                    <div className="flex h-7 items-center gap-2 px-0.5">
                      <Switch
                        checked={guidesVisible}
                        onCheckedChange={() => {
                          editorStore.getState().toggleGuidesVisible?.();
                        }}
                        aria-label="Toggle guides visibility"
                      />
                      <span className="text-[10px] text-muted-foreground">{guidesVisible ? 'On' : 'Off'}</span>
                    </div>
                  </RowField>
                </div>
                <Separator className="my-1" />
                <TinyLabel>Position</TinyLabel>
                <div className="grid grid-cols-3 gap-1.5">
                  <RowField label="X">
                    <Input
                      type="number"
                      min={-9999}
                      max={9999}
                      step="0.5"
                      value={selectedLayer.transform?.x ?? 0}
                      onChange={(event) =>
                        onPatchSelectedLayerTransform({
                          x: Number.parseFloat(event.target.value) || 0,
                        })
                      }
                      aria-valuemin={-9999}
                      aria-valuemax={9999}
                      aria-valuenow={selectedLayer.transform?.x ?? 0}
                      className="wire-input w-full"
                    />
                  </RowField>
                  <RowField label="Y">
                    <Input
                      type="number"
                      min={-9999}
                      max={9999}
                      step="0.5"
                      value={selectedLayer.transform?.y ?? 0}
                      onChange={(event) =>
                        onPatchSelectedLayerTransform({
                          y: Number.parseFloat(event.target.value) || 0,
                        })
                      }
                      aria-valuemin={-9999}
                      aria-valuemax={9999}
                      aria-valuenow={selectedLayer.transform?.y ?? 0}
                      className="wire-input w-full"
                    />
                  </RowField>
                  <RowField label="Rotation">
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        max={360}
                        step="1"
                        value={selectedLayer.transform?.rotate ?? 0}
                        onChange={(event) =>
                          onPatchSelectedLayerTransform({
                            rotate: Number.parseFloat(event.target.value) || 0,
                          })
                        }
                        aria-valuemin={0}
                        aria-valuemax={360}
                        aria-valuenow={selectedLayer.transform?.rotate ?? 0}
                        className="wire-input w-full pr-5"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        °
                      </span>
                    </div>
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
                <RowField label="Size">
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      max={512}
                      step="1"
                      value={currentVariant?.size ?? 0}
                      onChange={(event) =>
                        onPatchVariant({ size: Number.parseFloat(event.target.value) || 24 })
                      }
                      aria-valuemin={1}
                      aria-valuemax={512}
                      aria-valuenow={currentVariant?.size ?? 0}
                      className="wire-input w-full pr-6"
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                      px
                    </span>
                  </div>
                </RowField>
                <RowField
                  label={
                    <span className="flex items-center gap-1">
                      <span>Rendering</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            tabIndex={0}
                            className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            aria-label="What is Rendering mode?"
                          >
                            <HelpCircle className="size-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[240px]">{RENDERING_MODE_TOOLTIP}</TooltipContent>
                      </Tooltip>
                    </span>
                  }
                >
                  <ToggleGroup
                    type="single"
                    size="sm"
                    variant="outline"
                    value={currentVariant?.renderingMode ?? 'monochrome'}
                    onValueChange={(value) => {
                      if (value) onPatchVariant({ renderingMode: value as RenderingMode });
                    }}
                    className="h-7 w-full justify-stretch rounded-md border border-border/70"
                  >
                    {RENDERING_MODE_OPTIONS.map((option) => (
                      <ToggleGroupItem
                        key={option.value}
                        value={option.value}
                        aria-label={option.label}
                        className="flex-1 px-1 text-[length:var(--text-label)]"
                      >
                        {option.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </RowField>
                <Separator className="my-1" />
                <TinyLabel>Guides</TinyLabel>
                <div className="wire-meta-row">
                  <span className="wire-field-name">Master</span>
                  {guideMasterName ? (
                    <span className="text-[length:var(--text-label)] text-foreground">
                      {guideMasterName}
                    </span>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          tabIndex={0}
                          className="cursor-default text-[length:var(--text-label)] italic text-muted-foreground/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          None
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[220px]">
                        No guide master assigned. Open the Guides panel in the toolbar to attach one.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className="wire-meta-row">
                  <span className="wire-field-name">Visible</span>
                  <Switch
                    checked={guidesVisible}
                    onCheckedChange={() => {
                      editorStore.getState().toggleGuidesVisible?.();
                    }}
                    aria-label="Toggle guides visibility"
                  />
                </div>
                <Separator className="my-2" />
                <div className="flex justify-end pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 rounded-md px-2 text-[10px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={onDeleteVariant}
                  >
                    <Trash2 className="size-3" />
                    Delete this size
                  </Button>
                </div>
              </>
            )
          ) : (
            <>
              <AnimationStudioPanel showTimelineEditor={false} />
              <TransitionPanel />
            </>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

export function EditorShell({ initialIconId, embedded = false }: { initialIconId?: string; embedded?: boolean }) {
  const router = useRouter();
  const currentIconId = useEditorStore((s) => s.currentIconId);
  const currentVariantId = useEditorStore((s) => s.currentVariantId);
  const currentTypeId = useEditorStore((s) => s.currentTypeId);
  const project = useEditorStore((s) => s.project);
  const activeIconSetId = useEditorStore((s) => s.activeIconSetId);
  const selection = useEditorStore((s) => s.selection);
  const tool = useEditorStore((s) => s.tool);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const guidesVisible = useEditorStore((s) => s.guidesVisible);
  const viewport = useEditorStore((s) => s.viewport);
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

  const {
    addVariant,
    createBlankIcon,
    openIconTab,
    patchLayer,
    patchVariant,
    removeVariant,
    renameIcon,
    renameLayer,
    setCurrentIcon,
    setCurrentVariant,
    setCurrentType,
    addType,
    removeType,
    renameType,
    setTypeName,
    duplicateType,
    setSelection,
    setTool,
    setTransitionPreview,
    setViewport,
    toggleGuidesVisible,
    toggleSnap,
  } = useEditorActions();

  const [rightTab, setRightTab] = useState<RightTab>('inspect');
  const [commandOpen, setCommandOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [newVariantSize, setNewVariantSize] = useState('32');
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
    () => buildLayerPanelRows(Object.values(currentVariant?.layers ?? {})),
    [currentVariant?.layers],
  );

  const variants = useMemo(
    () =>
      Object.values(currentIcon?.variants ?? {}).sort((a, b) => {
        if (a.size !== b.size) return a.size - b.size;
        return formatVariantLabel(a).localeCompare(formatVariantLabel(b));
      }),
    [currentIcon?.variants],
  );

  // Transitions are now runtime-resolved; no authored transitions on Icon.
  const selectedTransition = null as TransitionConfig | null;

  const selectedLayerId = selection.layerIds[0] ?? null;
  const selectedLayer = selectedLayerId ? (currentVariant?.layers[selectedLayerId] ?? null) : null;

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setSearchIconId(parseEditorSearchParam(search.get('icon') ?? undefined));
    setSearchIconSetId(parseEditorSearchParam(search.get('set') ?? undefined));
  }, []);

  useEffect(() => {
    // In embedded mode, StudioLayout handles workspace loading
    if (embedded) return;
    let cancelled = false;
    const state = editorStore.getState();
    if (!state.workspace) {
      // Try restoring from IndexedDB before falling back to sample
      void (async () => {
        try {
          const { IndexedDBAdapter } = await import('@/lib/persistence/indexeddb-adapter');
          const adapter = new IndexedDBAdapter();
          const list = await adapter.list();
          if (list.length > 0) {
            const saved = await adapter.load(list[0].id);
            if (saved) {
              // Guard: abort if component unmounted or store was populated while we waited
              if (cancelled || editorStore.getState().workspace) return;
              const { setPersistenceProjectId } = await import('@/lib/persistence/use-persistence');
              setPersistenceProjectId(saved.id);
              editorStore.getState().loadWorkspace(saved.data);
              applySearchParams();
              return;
            }
          }
        } catch {
          // IndexedDB unavailable — fall through to sample
        }
        if (cancelled || editorStore.getState().workspace) return;
        clearCurrentProjectPath();
        editorStore.getState().loadWorkspace(SAMPLE_WORKSPACE);
        applySearchParams();
      })();
      return () => { cancelled = true; };
    }

    applySearchParams();

    function applySearchParams() {
      let current = editorStore.getState();
      if (searchIconSetId && current.workspace?.iconSets[searchIconSetId]) {
        current.setActiveIconSet(searchIconSetId);
        current = editorStore.getState();
      }
      if (requestedIconId && current.project?.icons[requestedIconId]) {
        current.setCurrentIcon(requestedIconId);
        const nextIconSetId =
          (searchIconSetId && current.workspace?.iconSets[searchIconSetId]
            ? searchIconSetId
            : current.activeIconSetId) ?? null;
        if (nextIconSetId) {
          current.openIconTab(nextIconSetId, requestedIconId);
        }
      }
    }
  }, [embedded, requestedIconId, searchIconSetId]);

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

  // R6 / UX-3.2: Canvas empty state dispatches these custom events because
  // Canvas.tsx doesn't own the dialog state. Bridge them here.
  useEffect(() => {
    const openCommand = () => setCommandOpen(true);
    const openImport = () => setImportDialogOpen(true);
    const newIcon = () => {
      const id = createBlankIcon();
      if (id && activeIconSetId) openIconTab(activeIconSetId, id);
    };
    window.addEventListener('contour:open-command', openCommand as EventListener);
    window.addEventListener('contour:import-svg', openImport as EventListener);
    window.addEventListener('contour:new-icon', newIcon as EventListener);
    return () => {
      window.removeEventListener('contour:open-command', openCommand as EventListener);
      window.removeEventListener('contour:import-svg', openImport as EventListener);
      window.removeEventListener('contour:new-icon', newIcon as EventListener);
    };
  }, [activeIconSetId, createBlankIcon, openIconTab]);

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
      if (!currentIcon || !currentVariant) return;

      const svg = exportSvgString(
        currentIcon,
        currentVariant.id,
        'default',
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
    }
    setCurrentIcon(iconId);
    // In standalone mode, navigate to editor route
    if (!embedded) {
      router.push(buildEditorRoute(iconId, activeIconSetId));
    }
  };

  const handleCreateBlankIcon = () => {
    if (!activeIconSetId) return;
    const iconId = createBlankIcon();
    if (!iconId) return;
    openIconTab(activeIconSetId, iconId);
    setCurrentIcon(iconId);
    // In standalone mode, navigate to editor route
    if (!embedded) {
      router.push(buildEditorRoute(iconId, activeIconSetId));
    }
  };

  const handlePatchSelectedLayer = (patch: Partial<Layer>) => {
    if (!currentIcon || !selectedLayer) return;
    patchLayer(currentIcon.id, selectedLayer.id, patch);
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

  const handleDeleteConfirm = () => {
    if (!pendingDelete || !currentIcon) return;
    if (pendingDelete.type === 'variant') removeVariant(currentIcon.id, pendingDelete.id);
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
    <div className={cn(
      'wireframe-editor flex flex-col overflow-hidden bg-background text-foreground',
      embedded ? 'h-full w-full' : 'fixed inset-0',
    )}>
      {!embedded && <Toolbar />}

      <div className="grid min-h-0 flex-1 grid-cols-[180px_minmax(0,1fr)] md:grid-cols-[200px_minmax(0,1fr)_304px] lg:grid-cols-[220px_minmax(0,1fr)_304px]">
        {/* Mobile/tablet sidebar toggle */}
        <Button
          variant="outline"
          size="icon-sm"
          className="fixed left-3 top-3 z-40 size-9 rounded-lg lg:hidden"
          onClick={() => setLeftSidebarOpen((v) => !v)}
          aria-label={leftSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {leftSidebarOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </Button>

        {/* Left sidebar overlay for md breakpoint */}
        {leftSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/20 lg:hidden"
            onClick={() => setLeftSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Hamburger drawer: project/icon selector (ListPane) — mobile/tablet only */}
        <div
          className={`fixed inset-y-0 left-0 z-30 flex w-[272px] transition-transform duration-200 lg:hidden ${
            leftSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="h-full w-full overflow-y-auto bg-background">
            <ListPane onIconOpen={() => setLeftSidebarOpen(false)} />
          </div>
        </div>

        {/* Layer panel — always visible at all breakpoints */}
        <div className="flex min-h-0">
          <LeftSidebar
            currentIcon={currentIcon}
            currentVariant={currentVariant}
            typeCatalog={project?.types ?? null}
            defaultTypeId={currentVariant ? (currentVariant.defaultType ?? null) : null}
            layerRows={layerRows}
            selectedLayerId={selectedLayerId}
            onSelectLayer={(layerId) => setSelection({ layerIds: [layerId], pointIds: [] })}
            onRenameIcon={handleRenameIcon}
            onToggleLayerVisibility={(layerId, visible) => {
              if (!currentIcon) return;
              patchLayer(currentIcon.id, layerId, { visible });
            }}
            variants={variants}
            currentVariantId={currentVariantId}
            onSelectVariant={setCurrentVariant}
            newVariantSize={newVariantSize}
            onNewVariantSizeChange={setNewVariantSize}
            onCreateVariant={handleCreateVariant}
            currentTypeId={currentTypeId}
            onSelectType={setCurrentType}
            onAddType={(typeId) => addType(typeId)}
            onRemoveType={(typeId) => removeType(typeId)}
            onRenameType={(oldId, newId) => renameType(oldId, newId)}
            onSetTypeName={(typeId, name) => setTypeName(typeId, name)}
            onDuplicateType={(sourceId, newId) => duplicateType(sourceId, newId)}
          />
        </div>

        <main className="wire-canvas-shell">
          <div className="wire-canvas-area">
            {currentIcon?.meta?.derivedSpecs && currentIcon.meta.derivedSpecs.length > 0 &&
              currentVariantId &&
              currentIcon.meta.derivedSpecs.some((s) => s.baseVariantId === currentVariantId) && (
              <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs status-warning-surface">
                <span>This variant has derived variants. Changes may require re-derivation.</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isDeriving}
                  className="ml-auto h-auto rounded-md bg-amber-200/60 px-2 py-0.5 text-[10px] font-medium text-amber-900 hover:bg-amber-200"
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
                </Button>
              </div>
            )}
            {currentIcon && currentVariant ? (
              <Canvas showStatusHud={false} />
            ) : (
              <div className="wire-canvas-empty">
                <p className="wire-title">No active icon</p>
                <p className="wire-empty-note mt-1">Create a new icon or import an SVG to begin.</p>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="wire-mini-button"
                    onClick={handleCreateBlankIcon}
                  >
                    <Plus className="size-3.5" />
                    New icon
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="wire-mini-button"
                    onClick={() => setImportDialogOpen(true)}
                  >
                    <FolderOpen className="size-3.5" />
                    Import
                  </Button>
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
          onRenameIcon={handleRenameIcon}
          onRenameLayer={(oldId, newId) => currentIcon && renameLayer(currentIcon.id, oldId, newId)}
          onPatchVariant={handlePatchVariant}
          onPatchSelectedLayer={handlePatchSelectedLayer}
          onPatchSelectedLayerStyle={handlePatchSelectedLayerStyle}
          onPatchSelectedLayerTransform={handlePatchSelectedLayerTransform}
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
              {pendingDelete?.type === 'variant'
                ? 'Delete size'
                : 'Delete transition'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.type === 'variant'
                ? `Delete the ${pendingDelete.id} variant?`
                : pendingDelete
                  ? `Delete the ${pendingDelete.id} transition?`
                  : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportIconDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />

      {/* F-7: Save success flash */}
      {saveSuccess && (
        <div
          className="pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2 animate-pulse rounded-lg border px-4 py-2 text-sm font-medium shadow-lg status-success-surface"
          role="status"
          aria-live="polite"
        >
          Saved successfully
        </div>
      )}

      {/* REMAINING-4: Export loading indicator */}
      {exporting && (
        <div
          className="pointer-events-none fixed left-1/2 top-16 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-lg status-info-surface"
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
              ? 'status-error-surface'
              : 'status-success-surface'
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
