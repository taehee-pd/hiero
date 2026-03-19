'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Layers2, Plus, Trash2 } from 'lucide-react';
import { Toolbar } from './Toolbar';
import { ToolPanel } from './ToolPanel';
import { LayerPanel } from './LayerPanel';
import { GuideMasterPanel } from './GuideMasterPanel';
import { Canvas } from './Canvas';
import { InspectorPanel } from './InspectorPanel';
import { AnimationStudioPanel } from './AnimationStudioPanel';
import { ImportIconDialog } from './ImportIconDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { editorStore } from '@/lib/editor-store/store';
import { useEditorActions } from '@/lib/editor-store/hooks';
import { SAMPLE_WORKSPACE } from '@/lib/schema/sample-project';
import { clearCurrentProjectPath } from '@/lib/platform/bridge';
import { buildEditorRoute, parseEditorSearchParam } from '@/lib/platform/routes';
import { handleEditorKeyDown } from '@/lib/editor-core/keyboard';
import { useEditorStore } from '@/lib/editor-store/hooks';
import { TitleTabBar } from '@/components/platform/TitleTabBar';
import { isDesktop } from '@/lib/platform/bridge';

function CurrentDocumentPanel({
  onOpenImport,
  onCreateBlankIcon,
}: {
  onOpenImport: () => void;
  onCreateBlankIcon: () => void;
}) {
  const icon = useEditorStore((s) =>
    s.currentIconId ? s.project?.icons[s.currentIconId] : null,
  );
  const workspaceName = useEditorStore((s) => s.workspace?.meta.name ?? 'Coniva Workspace');
  const projectName = useEditorStore((s) => s.project?.meta.name ?? 'Untitled Project');
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
        <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <Link href="/" className="truncate rounded-md px-1 py-0.5 hover:bg-accent hover:text-foreground">
            {workspaceName}
          </Link>
          <span>/</span>
          <Link href="/" className="truncate rounded-md px-1 py-0.5 hover:bg-accent hover:text-foreground">
            {projectName}
          </Link>
          {icon ? (
            <>
              <span>/</span>
              <span className="truncate text-foreground">{icon.name}</span>
            </>
          ) : null}
        </div>
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
        {!icon ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="rounded-xl" onClick={onOpenImport}>
              Import SVG
            </Button>
            <Button size="sm" className="rounded-xl" onClick={onCreateBlankIcon}>
              <Plus className="size-3.5" />
              New Icon
            </Button>
          </div>
        ) : null}
      </div>
      <Button asChild variant="outline" size="sm" className="rounded-xl">
        <Link href="/">
          <ChevronLeft className="size-3.5" />
          Library
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
  const [deleteOpen, setDeleteOpen] = useState(false);
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
    addVariant(icon.id, {
      size,
      viewBox: scaleViewBox(currentVariant.viewBox, size),
      sourceVariantId: currentVariant.id,
    });
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
            onClick={() => setDeleteOpen(true)}
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
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete variant</AlertDialogTitle>
            <AlertDialogDescription>
              {currentVariant
                ? `Delete the ${formatVariantLabel(currentVariant)}px variant? Undo is available, but this removes the current variant immediately.`
                : 'Delete the current variant?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (icon && currentVariantId) {
                  removeVariant(icon.id, currentVariantId);
                }
              }}
            >
              Delete variant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StateManagerBar() {
  const icon = useEditorStore((s) =>
    s.currentIconId ? s.project?.icons[s.currentIconId] ?? null : null,
  );
  const currentStateId = useEditorStore((s) => s.currentStateId);
  const currentVariantId = useEditorStore((s) => s.currentVariantId);
  const { addState, duplicateState, removeState, renameState, setCurrentState } = useEditorActions();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [createMode, setCreateMode] = useState<'duplicate' | 'blank'>('duplicate');

  const states = useMemo(
    () =>
      currentVariantId && icon
        ? Object.keys(icon.variants[currentVariantId]?.states ?? {})
        : [],
    [currentVariantId, icon],
  );
  const transitionCount = useMemo(
    () =>
      currentStateId && icon
        ? Object.values(icon.transitions ?? {}).filter(
            (transition) => transition.from === currentStateId || transition.to === currentStateId,
          ).length
        : 0,
    [currentStateId, icon],
  );

  const handleCreateState = () => {
    if (!icon) return;
    const created = addState(icon.id, {
      name: nameInput || undefined,
      sourceStateId: createMode === 'duplicate' ? currentStateId : null,
      blank: createMode === 'blank',
    });
    if (created) {
      setCreateOpen(false);
      setNameInput('');
      setCreateMode('duplicate');
    }
  };

  const handleRenameCurrentState = () => {
    if (!icon || !currentStateId || !nameInput.trim()) return;
    const renamed = renameState(icon.id, currentStateId, nameInput.trim());
    if (renamed) {
      setNameInput('');
      setCreateOpen(false);
    }
  };

  if (!icon || !currentVariantId) return null;

  return (
    <div className="flex flex-col gap-3 px-3 pb-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">
            {currentStateId ?? 'No state selected'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {states.length} state{states.length === 1 ? '' : 's'} across this icon
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover
            open={createOpen}
            onOpenChange={(open) => {
              setCreateOpen(open);
              if (!open) {
                setNameInput('');
                setCreateMode('duplicate');
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl">
                <Plus className="size-4" />
                <span>State</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 rounded-2xl p-3">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Manage states</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create a duplicate, start blank, or rename the current state.
                  </p>
                </div>
                <Input
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  placeholder={currentStateId ? `${currentStateId}-copy` : 'hover'}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={createMode === 'duplicate' ? 'default' : 'outline'}
                    onClick={() => setCreateMode('duplicate')}
                  >
                    Duplicate current
                  </Button>
                  <Button
                    size="sm"
                    variant={createMode === 'blank' ? 'default' : 'outline'}
                    onClick={() => setCreateMode('blank')}
                  >
                    Blank state
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!currentStateId || !nameInput.trim()}
                    onClick={handleRenameCurrentState}
                  >
                    Rename current
                  </Button>
                </div>
                <Button onClick={handleCreateState} disabled={!currentStateId && createMode === 'duplicate'}>
                  Create state
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-xl text-muted-foreground hover:text-foreground"
            disabled={!icon || !currentStateId}
            onClick={() => {
              if (icon && currentStateId) {
                duplicateState(icon.id, currentStateId);
              }
            }}
            aria-label="Duplicate current state"
          >
            <Layers2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-xl text-muted-foreground hover:text-foreground"
            disabled={!currentStateId || states.length <= 1}
            onClick={() => setDeleteOpen(true)}
            aria-label="Delete current state"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <Separator className="bg-border/70" />

      <div className="flex flex-wrap gap-2">
        {states.map((stateId) => {
          const isActive = stateId === currentStateId;
          return (
            <button
              key={stateId}
              type="button"
              onClick={() => setCurrentState(stateId)}
              className={
                isActive
                  ? 'rounded-xl border border-primary/35 bg-primary/[0.08] px-3 py-2 text-sm font-medium text-foreground shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_22%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60'
                  : 'rounded-xl border border-border/80 bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-border hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60'
              }
            >
              {stateId}
            </button>
          );
        })}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete state</AlertDialogTitle>
            <AlertDialogDescription>
              {currentStateId
                ? `Delete the ${currentStateId} state? ${transitionCount > 0 ? `${transitionCount} transition${transitionCount === 1 ? '' : 's'} linked to it will also be removed.` : 'This affects every variant of the icon.'}`
                : 'Delete the current state?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (icon && currentStateId) {
                  removeState(icon.id, currentStateId);
                }
              }}
            >
              Delete state
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function EditorShell({ initialIconId }: { initialIconId?: string }) {
  const router = useRouter();
  const currentIconId = useEditorStore((s) => s.currentIconId);
  const currentVariantId = useEditorStore((s) => s.currentVariantId);
  const currentStateId = useEditorStore((s) => s.currentStateId);
  const project = useEditorStore((s) => s.project);
  const activeIconSetId = useEditorStore((s) => s.activeIconSetId);
  const selectedLayerIds = useEditorStore((s) => s.selection.layerIds);
  const selectedGuideIndexes = useEditorStore((s) => s.selection.guideIndexes ?? []);
  const guidesVisible = useEditorStore((s) => s.guidesVisible);
  const [leftPanelMode, setLeftPanelMode] = useState<'layers' | 'guides'>('layers');
  const [searchIconId, setSearchIconId] = useState<string | undefined>();
  const [searchIconSetId, setSearchIconSetId] = useState<string | undefined>();
  const [rightPanelTab, setRightPanelTab] = useState<'inspector' | 'animation'>('inspector');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const previousGuidesVisibleRef = useRef(guidesVisible);
  const requestedIconId = initialIconId ?? searchIconId;
  const { createBlankIcon, openIconTab } = useEditorActions();

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
        (searchIconSetId && state.workspace?.iconSets[searchIconSetId] ? searchIconSetId : state.activeIconSetId) ??
        null;
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

  const handleCreateBlankIcon = () => {
    if (!activeIconSetId) return;
    const iconId = createBlankIcon();
    if (!iconId) return;
    openIconTab(activeIconSetId, iconId);
    router.push(buildEditorRoute(iconId, activeIconSetId));
  };

  return (
    <div className="swift-surface flex h-full w-full flex-col overflow-hidden text-foreground" style={{ position: 'fixed', inset: 0 }}>
      {desktop && <TitleTabBar />}
      <Toolbar />
      {!currentIconId ? (
        <>
          <div className="workspace-shell flex min-h-0 flex-1 items-center justify-center px-3 pb-3">
            <section className="studio-panel flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl px-8 py-12 text-center">
              <div className="rounded-full border border-border/80 bg-background/80 p-4">
                <Layers2 className="size-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <p className="text-xl font-semibold text-foreground">No icon selected</p>
                <p className="max-w-xl text-sm text-muted-foreground">
                  Open an icon from the library, import an SVG into this project, or create a blank icon to start drawing.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href="/">
                    <ChevronLeft className="size-4" />
                    Back to Library
                  </Link>
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => setImportDialogOpen(true)}>
                  Import SVG
                </Button>
                <Button className="rounded-xl" onClick={handleCreateBlankIcon}>
                  <Plus className="size-4" />
                  Create New Icon
                </Button>
              </div>
            </section>
          </div>
          <ImportIconDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
        </>
      ) : (
      <div className="workspace-shell grid min-h-0 flex-1 grid-cols-1 gap-3 px-3 pb-3 lg:grid-cols-[15rem_minmax(0,1fr)_18rem]">
        <aside className="flex min-h-0 flex-col gap-3">
          <section className="studio-panel overflow-hidden rounded-xl">
            <CurrentDocumentPanel onOpenImport={() => setImportDialogOpen(true)} onCreateBlankIcon={handleCreateBlankIcon} />
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
            <StateManagerBar />
            <div className="min-h-0 flex-1">
              <Canvas />
            </div>
          </div>
        </main>

        <aside className="studio-panel min-h-0 overflow-hidden rounded-xl">
          <Tabs value={rightPanelTab} onValueChange={(value) => setRightPanelTab(value as 'inspector' | 'animation')} className="flex h-full min-h-0 flex-col">
            <TabsList className="mx-3 mt-3 grid grid-cols-2">
              <TabsTrigger value="inspector">Inspector</TabsTrigger>
              <TabsTrigger value="animation">Animation</TabsTrigger>
            </TabsList>
            <TabsContent value="inspector" className="min-h-0 flex-1 data-[state=active]:flex">
              <div className="min-h-0 w-full">
                <InspectorPanel />
              </div>
            </TabsContent>
            <TabsContent value="animation" className="min-h-0 flex-1 data-[state=active]:flex">
              <div className="min-h-0 w-full">
                <AnimationStudioPanel onOpenTransitionEditor={() => setRightPanelTab('inspector')} />
              </div>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
      )}
      <ImportIconDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
    </div>
  );
}
