'use client';

import { Download, HelpCircle, Icon as UiIcon, Maximize2, Minus, Package, Plus, Redo2, Save, Undo2 } from '@hiero/ui-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { editorStore } from '@/lib/editor-store/store';
import { undo, redo } from '@/lib/editor-store/history';
import { useEditorStore } from '@/lib/editor-store/hooks';
import { isProject, isWorkspace } from '@/lib/schema/guards';
import { exportSvgString } from '@/lib/export/export-svg';
import { exportSvgPackage } from '@/lib/export/export-svg-package';
import { exportRuntimeJson } from '@/lib/export/export-runtime-json';
import { generateIconLibrary } from '@/lib/export/export-react/generate-library';
import { createZipBlob } from '@/lib/export/export-react/zip';
import { SyncPrPanel } from '@/components/export/SyncPrPanel';
import { SyncTargetPanelContent } from '@/components/export/SyncTargetPanel';
import { LottieExportPanel } from '@/components/export/LottieExportPanel';
import { resetPersistenceForNewProject } from '@/lib/persistence/use-persistence';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ImportIconDialog } from '@/components/editor/ImportIconDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  clearCurrentProjectPath,
  exportSvg,
  openProject,
  saveProject,
} from '@/lib/platform/bridge';
import {
  selectCurrentIcon,
  selectCurrentVariant,
  selectCurrentType,
} from '@/lib/editor-store/selectors';
import { buildEditorRoute } from '@/lib/platform/routes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Toolbar() {
  const router = useRouter();
  const projectName = useEditorStore((s) => s.project?.meta.name ?? 'Hiero');
  const zoom = useEditorStore((s) => s.viewport.zoom);
  const activeIconSetId = useEditorStore((s) => s.activeIconSetId);
  const selectionCount = useEditorStore((s) => s.selection.layerIds.length);
  const isDirty = useEditorStore((s) => s.isDirty);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const currentIconName = useEditorStore((s) =>
    s.currentIconId ? (s.project?.icons[s.currentIconId]?.name ?? null) : null,
  );
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [lottieSheetOpen, setLottieSheetOpen] = useState(false);
  const [toolbarError, setToolbarError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const toolbarErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToolbarError = useCallback((message: string) => {
    setToolbarError(message);
    if (toolbarErrorTimerRef.current) clearTimeout(toolbarErrorTimerRef.current);
    toolbarErrorTimerRef.current = setTimeout(() => setToolbarError(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toolbarErrorTimerRef.current) clearTimeout(toolbarErrorTimerRef.current);
    };
  }, []);

  // UX-F8: Relative time ago string
  const [savedAgoLabel, setSavedAgoLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!lastSavedAt) {
      setSavedAgoLabel(null);
      return;
    }
    const update = () => {
      const diff = Math.floor((Date.now() - lastSavedAt) / 1000);
      if (diff < 10) setSavedAgoLabel('just now');
      else if (diff < 60) setSavedAgoLabel(`${diff}s ago`);
      else if (diff < 3600) setSavedAgoLabel(`${Math.floor(diff / 60)}m ago`);
      else setSavedAgoLabel(`${Math.floor(diff / 3600)}h ago`);
    };
    update();
    const interval = setInterval(update, 10_000);
    return () => clearInterval(interval);
  }, [lastSavedAt]);
  const [confirmNewProjectOpen, setConfirmNewProjectOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [distributionSheetOpen, setDistributionSheetOpen] = useState(false);

  // R6 / UX-2.5: open the shortcuts cheat sheet when the global `?`
  // keybinding fires (`handleEditorKeyDown` dispatches the custom event).
  useEffect(() => {
    const handler = () => setShortcutsOpen(true);
    window.addEventListener('hiero:open-shortcuts', handler as EventListener);
    return () => window.removeEventListener('hiero:open-shortcuts', handler as EventListener);
  }, []);

  const runNewProject = useCallback(() => {
    clearCurrentProjectPath();
    resetPersistenceForNewProject();
    editorStore.getState().newProject();
  }, []);

  const handleNewProject = useCallback(() => {
    if (isDirty) {
      setConfirmNewProjectOpen(true);
      return;
    }
    runNewProject();
  }, [isDirty, runNewProject]);

  const handleCreateBlankIcon = useCallback(() => {
    if (!activeIconSetId) return;
    const iconId = editorStore.getState().createBlankIcon();
    if (!iconId) return;
    editorStore.getState().openIconTab(activeIconSetId, iconId);
    router.push(buildEditorRoute(iconId, activeIconSetId));
  }, [activeIconSetId, router]);

  const handleOpenProject = useCallback(async () => {
    const result = await openProject();
    if (!result) return;

    try {
      const json = JSON.parse(result.data);
      if (isWorkspace(json)) {
        editorStore.getState().loadWorkspace(json);
      } else if (isProject(json)) {
        editorStore.getState().loadProject(json);
      } else {
        clearCurrentProjectPath();
        showToolbarError('Invalid Hiero workspace file.');
      }
    } catch {
      clearCurrentProjectPath();
      showToolbarError('Failed to parse JSON file.');
    }
  }, [showToolbarError]);

  const serializeWorkspace = useCallback(() => {
    const { workspace } = editorStore.getState();
    if (!workspace) return null;
    const updatedAt = new Date().toISOString();
    const updated = {
      ...workspace,
      meta: { ...workspace.meta, updatedAt },
    };
    return {
      data: JSON.stringify(updated, null, 2),
      updatedAt,
    };
  }, []);

  const handleSave = useCallback(async () => {
    const payload = serializeWorkspace();
    if (!payload) return;

    const result = await saveProject(payload.data);
    if (result) {
      editorStore.getState().markSaved(payload.updatedAt);
    }
  }, [serializeWorkspace]);

  // Internal-build only. The gate uses the raw env var literal (not the
  // imported IS_INTERNAL_BUILD constant) because Webpack constant-folds
  // `process.env.NEXT_PUBLIC_*` inline but does NOT fold across module
  // boundaries — gating on an imported constant keeps the dynamic import
  // reachable from the bundler's perspective and ships the chunk
  // (including the imported icons.json data) to public builds.
  //
  // With the env-var literal: in public builds the comparison folds to
  // `'public' !== 'internal'` (always true), the early return is the
  // only reachable branch, and the dynamic import is dead code and
  // tree-shaken. The bundle-isolation check (scripts/check-public-bundle.ts)
  // verifies this empirically on every CI run.
  const handleOpenHieroUiIconSet = useCallback(async () => {
    if (process.env.NEXT_PUBLIC_BUILD_CHANNEL !== 'internal') return;
    try {
      const mod = await import('@/lib/integrations/hiero-ui-icons-source');
      mod.openHieroUiIconSetInEditor();
    } catch (err) {
      showToolbarError(
        err instanceof Error
          ? `Failed to open Hiero UI icon set: ${err.message}`
          : 'Failed to open Hiero UI icon set.',
      );
    }
  }, [showToolbarError]);

  const handleSaveHieroUiIconSet = useCallback(async () => {
    if (process.env.NEXT_PUBLIC_BUILD_CHANNEL !== 'internal') return;
    try {
      const mod = await import('@/lib/integrations/hiero-ui-icons-source');
      const result = mod.serializeHieroUiIconSet();
      if (!result.ok) {
        showToolbarError(
          result.reason === 'no-workspace'
            ? 'No icon set is loaded — open it first.'
            : 'Open the canonical icon set via "Open Hiero UI Icon Set" before saving as one.',
        );
        return;
      }
      const saved = await saveProject(
        result.data,
        mod.HIERO_UI_ICONS_SOURCE_FILENAME,
      );
      if (saved) {
        editorStore.getState().markSaved(result.updatedAt);
      }
    } catch (err) {
      showToolbarError(
        err instanceof Error
          ? `Failed to save Hiero UI icon set: ${err.message}`
          : 'Failed to save Hiero UI icon set.',
      );
    }
  }, [showToolbarError]);

  const handleExportSvg = useCallback(async () => {
    const state = editorStore.getState();
    const icon = selectCurrentIcon(state);
    const variant = selectCurrentVariant(state);
    const currentState = selectCurrentType(state);
    if (!icon || !variant || !currentState) return;

    const svg = exportSvgString(
      icon,
      variant.id,
      state.currentTypeId ?? 'default',
      state.project?.tokenSet?.colors,
      state.renderingMode,
    );

    await exportSvg(svg, `${icon.name.replace(/\s+/g, '-').toLowerCase()}.svg`);
  }, []);

  const handleExportSvgPackage = useCallback(() => {
    const { project } = editorStore.getState();
    if (!project) return;

    setExporting(true);
    try {
      const fileMap = exportSvgPackage(project);
      const zipBlob = createZipBlob(fileMap);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.meta.name.replace(/\s+/g, '-').toLowerCase()}-svg-package.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2000);
    } finally {
      setExporting(false);
    }
  }, []);

  const handleExportRuntimeJson = useCallback(() => {
    const state = editorStore.getState();
    const icon = selectCurrentIcon(state);
    if (!icon) return;

    const runtimeJson = exportRuntimeJson({
      ...icon,
      tokenSet: state.project?.tokenSet,
    });
    const blob = new Blob([runtimeJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${icon.name.replace(/\s+/g, '-').toLowerCase()}.runtime.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportReactLibrary = useCallback(() => {
    const { project } = editorStore.getState();
    if (!project) return;

    setExporting(true);
    try {
      const fileMap = generateIconLibrary(project, {
        packageName: `${project.meta.name.replace(/\s+/g, '-').toLowerCase()}-react-icons`,
        typescript: true,
      });
      const zipBlob = createZipBlob(fileMap);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.meta.name.replace(/\s+/g, '-').toLowerCase()}-react-library.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2000);
    } finally {
      setExporting(false);
    }
  }, []);

  // UX-F9: Zoom feedback overlay state
  const [zoomOverlay, setZoomOverlay] = useState<string | null>(null);
  const zoomOverlayTimerRef = useCallback((label: string) => {
    setZoomOverlay(label);
    setTimeout(() => setZoomOverlay(null), 900);
  }, []);

  const handleZoomIn = useCallback(() => {
    const { viewport, setViewport } = editorStore.getState();
    const next = Math.min(viewport.zoom * 1.25, 32);
    setViewport({ zoom: next });
    zoomOverlayTimerRef(`${Math.round(next * 100)}%`);
  }, [zoomOverlayTimerRef]);

  const handleZoomOut = useCallback(() => {
    const { viewport, setViewport } = editorStore.getState();
    const next = Math.max(viewport.zoom / 1.25, 0.1);
    setViewport({ zoom: next });
    zoomOverlayTimerRef(`${Math.round(next * 100)}%`);
  }, [zoomOverlayTimerRef]);

  const handleZoomFit = useCallback(() => {
    window.dispatchEvent(new CustomEvent('editor:fit-canvas'));
    // Show overlay after a tick so the zoom value has updated
    setTimeout(() => {
      const { viewport } = editorStore.getState();
      zoomOverlayTimerRef(`${Math.round(viewport.zoom * 100)}%`);
    }, 50);
  }, [zoomOverlayTimerRef]);

  return (
    <>
      <header
        className="workspace-header mx-2 mb-2 mt-2 rounded-[1.35rem] px-3 py-1.5"
        style={{ fontFamily: 'var(--font-system)', minHeight: 'var(--toolbar-height)' }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="truncate text-[length:var(--text-heading)] font-semibold tracking-tight text-foreground">
                {projectName}
              </p>
              {/* UX-F8: Unsaved changes indicator with relative timestamp */}
              <Badge
                variant="outline"
                className={`h-5 shrink-0 rounded-full px-2 text-[10px] tracking-tight ${
                  isDirty
                    ? 'status-warning-surface shadow-[inset_0_0_0_0.5px_var(--border-warning)]'
                    : 'border-border/70 bg-background/80 text-muted-foreground shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.04)]'
                }`}
              >
                {isDirty
                  ? 'Unsaved changes'
                  : savedAgoLabel
                    ? `Saved ${savedAgoLabel}`
                    : 'Saved'}
              </Badge>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[length:var(--text-label)] text-muted-foreground">
              <span className="truncate">{currentIconName ?? 'No icon selected'}</span>
              <span className="text-border-subtle">/</span>
              <span>{selectionCount} selected</span>
            </div>
          </div>

          <ToolbarGroup>
            <Tooltip>
              <DropdownMenu>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="File menu"
                      className="workspace-tool-button h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    >
                      <UiIcon name="file-plus-2" size={14} className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={handleNewProject}>
                    <UiIcon name="file-plus-2" size={16} className="size-4" />
                    New Project
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleCreateBlankIcon} disabled={!activeIconSetId}>
                    <UiIcon name="plus" size={16} className="size-4" />
                    New Icon
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void handleOpenProject()}>
                    <UiIcon name="folder-open" size={16} className="size-4" />
                    Open Project
                  </DropdownMenuItem>
                  {/* Internal-build only. Gated on the env var literal so
                      Webpack constant-folds and dead-code-eliminates the
                      whole subtree in public builds (importing
                      IS_INTERNAL_BUILD from build-flags.ts wouldn't fold
                      across module boundaries). */}
                  {process.env.NEXT_PUBLIC_BUILD_CHANNEL === 'internal' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => void handleOpenHieroUiIconSet()}
                        data-testid="toolbar-open-hiero-ui-icons"
                      >
                        <UiIcon name="package" size={16} className="size-4" />
                        Open Hiero UI Icon Set
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => void handleSaveHieroUiIconSet()}
                        data-testid="toolbar-save-hiero-ui-icons"
                      >
                        <UiIcon name="save" size={16} className="size-4" />
                        Save Hiero UI Icon Set
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setImportDialogOpen(true)}>
                    <UiIcon name="import" size={16} className="size-4" />
                    Import Icon
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <TooltipContent side="bottom">File menu</TooltipContent>
            </Tooltip>
            <ToolbarButton
              icon={Plus}
              label="New Icon"
              onClick={handleCreateBlankIcon}
              compact
              disabled={!activeIconSetId}
            />
          </ToolbarGroup>

          <ToolbarGroup>
            <ToolbarButton
              icon={Save}
              label="Save"
              onClick={handleSave}
              compact
              shortcut="Cmd/Ctrl+S"
            />
            {/* UX-F6: Primary export actions surfaced directly in toolbar */}
            <ToolbarButton
              icon={Download}
              label={exporting ? 'Exporting...' : exportSuccess ? 'Exported!' : 'SVG Package'}
              onClick={handleExportSvgPackage}
              compact={false}
              disabled={exporting}
            />
            <ToolbarButton
              icon={Download}
              label={exporting ? 'Exporting...' : exportSuccess ? 'Exported!' : 'React Library'}
              onClick={handleExportReactLibrary}
              compact={false}
              disabled={exporting}
            />
            <Tooltip>
              <DropdownMenu>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="More exports"
                      className="workspace-tool-button h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/40"
                    >
                      <UiIcon name="download" size={14} className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void handleExportSvg()}>
                    <UiIcon name="download" size={16} className="size-4" />
                    Export SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleExportSvgPackage}>
                    <UiIcon name="download" size={16} className="size-4" />
                    Export SVG Package
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleExportRuntimeJson}>
                    <UiIcon name="download" size={16} className="size-4" />
                    Export Runtime JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleExportReactLibrary}>
                    <UiIcon name="download" size={16} className="size-4" />
                    Export React Library
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setLottieSheetOpen(true)}>
                    <UiIcon name="file-json" size={16} className="size-4" />
                    Export Lottie JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <TooltipContent side="bottom">More exports</TooltipContent>
            </Tooltip>
            <SyncPrPanel />
            <ToolbarButton
              icon={Package}
              label="Distribution"
              onClick={() => setDistributionSheetOpen(true)}
              compact={false}
            />
          </ToolbarGroup>

          <ToolbarGroup>
            <ToolbarButton icon={Undo2} label="Undo" onClick={undo} compact shortcut="Cmd/Ctrl+Z" />
            <ToolbarButton
              icon={Redo2}
              label="Redo"
              onClick={redo}
              compact
              shortcut="Shift+Cmd/Ctrl+Z"
            />
          </ToolbarGroup>

          <ToolbarGroup>
            <ToolbarButton
              icon={Minus}
              label="Zoom out"
              onClick={handleZoomOut}
              compact
              shortcut="-"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="min-w-[3.75rem] cursor-default rounded-full px-2 py-0.5 font-medium text-[length:var(--text-label)] tabular-nums"
                >
                  {zoom >= 5 ? 'Fill' : `${Math.round(zoom * 100)}%`}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {zoom >= 5 ? `Fill (${Math.round(zoom * 100)}%)` : `${Math.round(zoom * 100)}%`}
              </TooltipContent>
            </Tooltip>
            <ToolbarButton
              icon={Plus}
              label="Zoom in"
              onClick={handleZoomIn}
              compact
              shortcut="+"
            />
            <ToolbarButton
              icon={Maximize2}
              label="Fit view"
              onClick={handleZoomFit}
              compact
              shortcut="0"
            />
            <ToolbarButton
              icon={HelpCircle}
              label="Shortcuts"
              onClick={() => setShortcutsOpen(true)}
              compact
              shortcut="?"
            />
          </ToolbarGroup>
        </div>
      </header>

      {/* E-2: Inline error toast replacing window.alert() */}
      {toolbarError && (
        <div
          className="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full border px-5 py-2 text-sm font-medium status-error-surface"
          style={{ boxShadow: 'var(--shadow-error)' }}
          role="alert"
          aria-live="assertive"
        >
          {toolbarError}
        </div>
      )}

      <ImportIconDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />

      <Sheet open={lottieSheetOpen} onOpenChange={setLottieSheetOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Export Lottie JSON</SheetTitle>
          </SheetHeader>
          <div className="px-1 py-4">
            <LottieExportPanel />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={distributionSheetOpen} onOpenChange={setDistributionSheetOpen}>
        <SheetContent side="right" className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Repo-native Distribution</SheetTitle>
          </SheetHeader>
          <div className="px-1 py-4">
            <SyncTargetPanelContent
              title="Repo-native Distribution"
              description="Manage release targets from the editor and publish generated packages directly."
            />
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmNewProjectOpen} onOpenChange={setConfirmNewProjectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new project?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current workspace has unsaved changes. Starting a new project will replace the
              current editor context.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmNewProjectOpen(false);
                runNewProject();
              }}
            >
              Start new project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Core editor shortcuts and quick-access tools.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 text-sm">
            <ShortcutRow label="Select tool" shortcut="V" />
            <ShortcutRow label="Direct select tool" shortcut="A" />
            <ShortcutRow label="Pen tool" shortcut="P" />
            <ShortcutRow label="Shape tool" shortcut="U" />
            <ShortcutRow label="Undo" shortcut="Cmd/Ctrl+Z" />
            <ShortcutRow label="Redo" shortcut="Shift+Cmd/Ctrl+Z" />
            <ShortcutRow label="Toggle guides" shortcut="Cmd/Ctrl+;" />
            <ShortcutRow label="Toggle snap" shortcut="Shift+Cmd/Ctrl+;" />
            <ShortcutRow label="Delete selected layer or guides" shortcut="Delete" />
            <ShortcutRow label="Escape selection / direct-select mode" shortcut="Esc" />
          </div>
        </DialogContent>
      </Dialog>

      {/* UX-F9: Animated zoom level overlay */}
      {zoomOverlay ? (
        <div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          key={zoomOverlay}
        >
          <div
            className="rounded-lg border border-border/50 bg-background/90 px-6 py-3 text-2xl text-foreground backdrop-blur-sm"
            style={{ boxShadow: 'var(--shadow-lg)', animation: 'zoom-overlay-fade 900ms ease-out forwards' }}
          >
            {zoomOverlay}
          </div>
          <style>{`
            @keyframes zoom-overlay-fade {
              0% { opacity: 1; transform: scale(1.1); }
              60% { opacity: 1; transform: scale(1); }
              100% { opacity: 0; transform: scale(0.95); }
            }
          `}</style>
        </div>
      ) : null}
    </>
  );
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="workspace-toolbar-group gap-0.5 p-[3px]">{children}</div>;
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  compact,
  shortcut,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void | Promise<void>;
  compact?: boolean;
  shortcut?: string;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? 'icon-sm' : 'sm'}
          onClick={() => {
            void onClick();
          }}
          aria-label={label}
          disabled={disabled}
          className={
            compact
              ? 'workspace-tool-button h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/40'
              : 'workspace-tool-button h-7 rounded-lg px-2.5 text-[length:var(--text-body)] text-foreground hover:bg-accent/40'
          }
        >
          <Icon className="size-3.5" />
          {!compact ? <span>{label}</span> : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{shortcut ? `${label} (${shortcut})` : label}</TooltipContent>
    </Tooltip>
  );
}

function ShortcutRow({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-background/60 px-3 py-1.5" style={{ boxShadow: 'var(--shadow-outline)' }}>
      <span>{label}</span>
      <span className="rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 font-mono text-xs">
        {shortcut}
      </span>
    </div>
  );
}
