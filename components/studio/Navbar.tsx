'use client';

import { Icon as UiIcon } from '@hiero/ui-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTheme } from 'next-themes';
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
import { StatusBadge } from '@/components/ds/status-badge';
import { BuildBadge } from '@/components/studio/BuildBadge';
import { IconButton } from '@/components/ds/icon-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { editorStore } from '@/lib/editor-store/store';
import { useEditorStore } from '@/lib/editor-store/hooks';
import { undo, redo } from '@/lib/editor-store/history';
import { isProject, isWorkspace } from '@/lib/schema/guards';
import { exportSvgPackage } from '@/lib/export/export-svg-package';
import { generateIconLibrary } from '@/lib/export/export-react/generate-library';
import { createZipBlob } from '@/lib/export/export-react/zip';
import { LottieExportPanel } from '@/components/export/LottieExportPanel';
import { SyncTargetPanelContent } from '@/components/export/SyncTargetPanel';
import { ImportIconDialog } from '@/components/editor/ImportIconDialog';
import { clearCurrentProjectPath, openProject, saveProject } from '@/lib/platform/bridge';
import { resetPersistenceForNewProject } from '@/lib/persistence/use-persistence';

export function Navbar() {
  const projectName = useEditorStore((s) => s.project?.meta.name ?? 'Hiero');
  const isDirty = useEditorStore((s) => s.isDirty);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const activeIconSetId = useEditorStore((s) => s.activeIconSetId);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingNameValue, setEditingNameValue] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const nameEditCancelledRef = useRef(false);

  const startEditingName = useCallback(() => {
    setEditingNameValue(projectName);
    nameEditCancelledRef.current = false;
    setIsEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }, [projectName]);

  const commitNameEdit = useCallback(() => {
    if (nameEditCancelledRef.current) {
      nameEditCancelledRef.current = false;
      setIsEditingName(false);
      return;
    }
    const trimmed = editingNameValue.trim();
    if (trimmed && trimmed !== projectName && activeIconSetId) {
      editorStore.getState().renameIconSet(activeIconSetId, trimmed);
    }
    setIsEditingName(false);
  }, [editingNameValue, projectName, activeIconSetId]);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [lottieSheetOpen, setLottieSheetOpen] = useState(false);
  const [distributionSheetOpen, setDistributionSheetOpen] = useState(false);
  const [confirmNewProjectOpen, setConfirmNewProjectOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [toolbarError, setToolbarError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const toolbarErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const project = useEditorStore((s) => s.project);
  const commandIcons = useMemo(
    () => Object.values(project?.icons ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [project?.icons],
  );

  // Global Cmd+K handler — only active when no icon is open
  // (when an icon is open, EditorShell provides its own richer command palette)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        // Skip if EditorShell is mounted (it handles Cmd+K itself)
        if (editorStore.getState().currentIconId) return;
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Relative time label
  const [savedAgoLabel, setSavedAgoLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!lastSavedAt) { setSavedAgoLabel(null); return; }
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

  useEffect(() => {
    return () => { if (toolbarErrorTimerRef.current) clearTimeout(toolbarErrorTimerRef.current); };
  }, []);

  // R6 / UX-2.5: `?` key globally opens the keyboard-shortcuts cheat sheet.
  // `handleEditorKeyDown` in lib/editor-core/keyboard.ts dispatches a custom
  // event so this handler stays UI-agnostic.
  useEffect(() => {
    const handler = () => setShortcutsOpen(true);
    window.addEventListener('hiero:open-shortcuts', handler as EventListener);
    return () => window.removeEventListener('hiero:open-shortcuts', handler as EventListener);
  }, []);

  const showToolbarError = useCallback((message: string) => {
    setToolbarError(message);
    if (toolbarErrorTimerRef.current) clearTimeout(toolbarErrorTimerRef.current);
    toolbarErrorTimerRef.current = setTimeout(() => setToolbarError(null), 3000);
  }, []);

  const runNewProject = useCallback(() => {
    clearCurrentProjectPath();
    resetPersistenceForNewProject();
    editorStore.getState().newProject();
  }, []);

  const handleNewProject = useCallback(() => {
    if (isDirty) { setConfirmNewProjectOpen(true); return; }
    runNewProject();
  }, [isDirty, runNewProject]);

  const handleOpenProject = useCallback(async () => {
    const result = await openProject();
    if (!result) return;
    try {
      const json = JSON.parse(result.data);
      if (isWorkspace(json)) editorStore.getState().loadWorkspace(json);
      else if (isProject(json)) editorStore.getState().loadProject(json);
      else { clearCurrentProjectPath(); showToolbarError('Invalid Hiero workspace file.'); }
    } catch { clearCurrentProjectPath(); showToolbarError('Failed to parse JSON file.'); }
  }, [showToolbarError]);

  const serializeWorkspace = useCallback(() => {
    const { workspace } = editorStore.getState();
    if (!workspace) return null;
    const updatedAt = new Date().toISOString();
    return { data: JSON.stringify({ ...workspace, meta: { ...workspace.meta, updatedAt } }, null, 2), updatedAt };
  }, []);

  const handleSave = useCallback(async () => {
    const payload = serializeWorkspace();
    if (!payload) return;
    const result = await saveProject(payload.data);
    if (result) editorStore.getState().markSaved(payload.updatedAt);
  }, [serializeWorkspace]);

  // Internal-build only. See components/editor/Toolbar.tsx for the
  // detailed comment on why the gate uses `process.env.NEXT_PUBLIC_*`
  // literally rather than the imported IS_INTERNAL_BUILD constant —
  // Webpack folds the env-var literal but not cross-module bindings,
  // and only literal-folded gates produce a clean public bundle.
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
      if (saved) editorStore.getState().markSaved(result.updatedAt);
    } catch (err) {
      showToolbarError(
        err instanceof Error
          ? `Failed to save Hiero UI icon set: ${err.message}`
          : 'Failed to save Hiero UI icon set.',
      );
    }
  }, [showToolbarError]);

  // Filtered "used in app" subset. See lib/integrations/hiero-ui-icons-source.ts
  // for the full motivation; the short version is that the canonical
  // icons.json ships a superset (alignment variants, draft glyphs, etc.)
  // and a maintainer auditing what actually appears in product surfaces
  // wants the 80-ish-icon view, not the full catalog. Saving merges
  // back into icons.json non-destructively.
  const handleImportUsedHieroUiIcons = useCallback(async () => {
    if (process.env.NEXT_PUBLIC_BUILD_CHANNEL !== 'internal') return;
    try {
      const mod = await import('@/lib/integrations/hiero-ui-icons-source');
      const result = mod.openUsedHieroUiIconsInEditor();
      if (result.missing.length > 0) {
        showToolbarError(
          `Imported ${Object.keys(result.project.icons).length} used icons; ${result.missing.length} were missing from icons.json (run pnpm icons:check-used).`,
        );
      }
    } catch (err) {
      showToolbarError(
        err instanceof Error
          ? `Failed to import used icons: ${err.message}`
          : 'Failed to import used icons.',
      );
    }
  }, [showToolbarError]);

  const handleSaveUsedHieroUiIcons = useCallback(async () => {
    if (process.env.NEXT_PUBLIC_BUILD_CHANNEL !== 'internal') return;
    try {
      const mod = await import('@/lib/integrations/hiero-ui-icons-source');
      const result = mod.serializeMergedHieroUiIconSet();
      if (!result.ok) {
        showToolbarError(
          result.reason === 'no-workspace'
            ? 'No icon set is loaded — import the used icons first.'
            : 'Import the used icons via "Import Used Icons" before saving the merged set.',
        );
        return;
      }
      const saved = await saveProject(
        result.data,
        mod.HIERO_UI_ICONS_SOURCE_FILENAME,
      );
      if (saved) editorStore.getState().markSaved(result.updatedAt);
    } catch (err) {
      showToolbarError(
        err instanceof Error
          ? `Failed to save used icons: ${err.message}`
          : 'Failed to save used icons.',
      );
    }
  }, [showToolbarError]);

  const handleExportSvgPackage = useCallback(() => {
    const { project } = editorStore.getState();
    if (!project) return;
    setExporting(true);
    try {
      const fileMap = exportSvgPackage(project);
      const zipBlob = createZipBlob(fileMap);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url; a.download = `${project.meta.name.replace(/\s+/g, '-').toLowerCase()}-svg-package.zip`;
      a.click(); URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  }, []);

  const handleExportReactLibrary = useCallback(() => {
    const { project } = editorStore.getState();
    if (!project) return;
    setExporting(true);
    try {
      const fileMap = generateIconLibrary(project, { packageName: `${project.meta.name.replace(/\s+/g, '-').toLowerCase()}-react-icons`, typescript: true });
      const zipBlob = createZipBlob(fileMap);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url; a.download = `${project.meta.name.replace(/\s+/g, '-').toLowerCase()}-react-library.zip`;
      a.click(); URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  }, []);

  return (
    <>
      <header className="studio-topbar flex h-10 shrink-0 items-center gap-1.5 px-2" style={{ fontFamily: 'var(--font-system)' }}>
        {/* Left: main menu + project name + save status */}
        <div className="flex min-w-0 items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-accent"
                aria-label="Main menu"
              >
                <span
                  className="inline-block size-5 shrink-0 bg-foreground"
                  role="img"
                  aria-label="Hiero logo"
                  style={{
                    maskImage: 'url(/hiero.svg?v=4)',
                    maskSize: 'contain',
                    maskRepeat: 'no-repeat',
                    maskPosition: 'center',
                    WebkitMaskImage: 'url(/hiero.svg?v=4)',
                    WebkitMaskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                  }}
                />
                <UiIcon name="chevron-down" size={12} className="size-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-56">
              {/* File */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><UiIcon name="file-plus-2" size={16} className="size-4" />File</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={handleNewProject}><UiIcon name="file-plus-2" size={16} className="size-4" />New Project</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void handleOpenProject()}><UiIcon name="folder-open" size={16} className="size-4" />Open Project</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void handleSave()}><UiIcon name="save" size={16} className="size-4" />Save<DropdownMenuShortcut>⌘S</DropdownMenuShortcut></DropdownMenuItem>
                  {/* Internal-build only — env-var literal so Webpack folds
                      and DCE strips this subtree from public bundles. See
                      Toolbar.tsx for the detailed comment. */}
                  {process.env.NEXT_PUBLIC_BUILD_CHANNEL === 'internal' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => void handleOpenHieroUiIconSet()}
                        data-testid="navbar-open-hiero-ui-icons"
                      >
                        <UiIcon name="package" size={16} className="size-4" />
                        Open Hiero UI Icon Set
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => void handleSaveHieroUiIconSet()}
                        data-testid="navbar-save-hiero-ui-icons"
                      >
                        <UiIcon name="save" size={16} className="size-4" />
                        Save Hiero UI Icon Set
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => void handleImportUsedHieroUiIcons()}
                        data-testid="navbar-import-used-hiero-ui-icons"
                      >
                        <UiIcon name="import" size={16} className="size-4" />
                        Import Used Icons
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => void handleSaveUsedHieroUiIcons()}
                        data-testid="navbar-save-used-hiero-ui-icons"
                      >
                        <UiIcon name="save" size={16} className="size-4" />
                        Save Used Icons (Merge)
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setImportDialogOpen(true)}><UiIcon name="import" size={16} className="size-4" />Import Icons</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Edit */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><UiIcon name="undo-2" size={16} className="size-4" />Edit</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={undo}><UiIcon name="undo-2" size={16} className="size-4" />Undo<DropdownMenuShortcut>⌘Z</DropdownMenuShortcut></DropdownMenuItem>
                  <DropdownMenuItem onSelect={redo}><UiIcon name="redo-2" size={16} className="size-4" />Redo<DropdownMenuShortcut>⇧⌘Z</DropdownMenuShortcut></DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Export */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><UiIcon name="download" size={16} className="size-4" />Export</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={handleExportSvgPackage} disabled={exporting}>
                    <UiIcon name="download" size={16} className="size-4" />Quick ZIP (SVG package)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleExportReactLibrary} disabled={exporting}>
                    <UiIcon name="download" size={16} className="size-4" />React library (.zip)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setLottieSheetOpen(true)}>
                    <UiIcon name="file-json" size={16} className="size-4" />Lottie JSON…
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDistributionSheetOpen(true)}>
                    <UiIcon name="package" size={16} className="size-4" />Full distribution options…
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              {/* View / Preferences */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><UiIcon name="monitor" size={16} className="size-4" />View</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {mounted && (
                    <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
                      {resolvedTheme === 'dark' ? <UiIcon name="sun" size={16} className="size-4" /> : <UiIcon name="moon" size={16} className="size-4" />}
                      {resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => setCommandOpen(true)}><UiIcon name="search" size={16} className="size-4" />Search Icons<DropdownMenuShortcut>⌘K</DropdownMenuShortcut></DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              {/* Help */}
              <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}><UiIcon name="keyboard" size={16} className="size-4" />Keyboard Shortcuts<DropdownMenuShortcut>?</DropdownMenuShortcut></DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCommandOpen(true)}><UiIcon name="search" size={16} className="size-4" />Search<DropdownMenuShortcut>⌘K</DropdownMenuShortcut></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isEditingName ? (
            <input
              ref={nameInputRef}
              className="h-6 min-w-0 max-w-[200px] truncate rounded-md border border-border bg-background px-1.5 text-sm font-semibold tracking-tight text-foreground outline-none focus:ring-1 focus:ring-ring"
              value={editingNameValue}
              onChange={(e) => setEditingNameValue(e.target.value)}
              onBlur={commitNameEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitNameEdit();
                if (e.key === 'Escape') {
                  nameEditCancelledRef.current = true;
                  setIsEditingName(false);
                }
              }}
            />
          ) : (
            <button
              className="group flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 hover:bg-accent"
              onClick={startEditingName}
            >
              <span className="truncate text-sm font-semibold tracking-tight text-foreground">{projectName}</span>
              <UiIcon name="pencil" size={12} className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}

          <StatusBadge variant={isDirty ? 'warning' : 'neutral'}>
            {isDirty ? 'Unsaved' : savedAgoLabel ? `Saved ${savedAgoLabel}` : 'Saved'}
          </StatusBadge>
        </div>

        <div className="flex-1" />

        {/* Right: quick actions */}
        <div className="flex items-center gap-0.5">
          {/* Save */}
          <IconButton icon={<UiIcon name="save" />} aria-label="Save" onClick={() => void handleSave()} kbd={['Cmd', 'S']} />

          {/* Undo/Redo */}
          <IconButton icon={<UiIcon name="undo-2" />} aria-label="Undo" onClick={undo} kbd={['Cmd', 'Z']} />
          <IconButton icon={<UiIcon name="redo-2" />} aria-label="Redo" onClick={redo} kbd={['Shift', 'Cmd', 'Z']} />

          {/* Search */}
          <IconButton icon={<UiIcon name="search" />} aria-label="Search icons" onClick={() => setCommandOpen(true)} kbd={['Cmd', 'K']} />

          <BuildBadge />
        </div>
      </header>

      {/* Error toast */}
      {toolbarError && (
        <div className="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full border px-5 py-2 text-sm font-medium status-error-surface" style={{ boxShadow: 'var(--shadow-error)' }} role="alert" aria-live="assertive">
          {toolbarError}
        </div>
      )}

      <ImportIconDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />

      <Sheet open={lottieSheetOpen} onOpenChange={setLottieSheetOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader><SheetTitle>Export Lottie JSON</SheetTitle></SheetHeader>
          <div className="px-1 py-4"><LottieExportPanel /></div>
        </SheetContent>
      </Sheet>

      <Sheet open={distributionSheetOpen} onOpenChange={setDistributionSheetOpen}>
        <SheetContent side="right" className="sm:max-w-xl">
          <SheetHeader><SheetTitle>Distribution</SheetTitle></SheetHeader>
          <div className="py-4"><SyncTargetPanelContent title="Distribution" description="Manage release targets and publish packages." /></div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmNewProjectOpen} onOpenChange={setConfirmNewProjectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new project?</AlertDialogTitle>
            <AlertDialogDescription>Your current workspace has unsaved changes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmNewProjectOpen(false); runNewProject(); }}>Start new project</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Core editor shortcuts.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 text-sm">
            {[
              ['Select tool', 'V'], ['Direct select', 'A'], ['Pen tool', 'P'], ['Shape tool', 'U'],
              ['Undo', 'Cmd/Ctrl+Z'], ['Redo', 'Shift+Cmd/Ctrl+Z'],
              ['Toggle guides', 'Cmd/Ctrl+;'], ['Toggle snap', 'Shift+Cmd/Ctrl+;'],
              ['Delete', 'Delete'], ['Escape', 'Esc'],
            ].map(([label, shortcut]) => (
              <div key={label} className="flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-3 py-1.5" style={{ boxShadow: 'var(--shadow-outline)' }}>
                <span>{label}</span>
                <span className="rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 font-mono text-xs">{shortcut}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Search icons…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Icons">
            {commandIcons.map((icon) => (
              <CommandItem
                key={icon.id}
                onSelect={() => {
                  setCommandOpen(false);
                  editorStore.getState().setCurrentIcon(icon.id);
                  const iconSetId = editorStore.getState().activeIconSetId;
                  if (iconSetId) editorStore.getState().openIconTab(iconSetId, icon.id);
                }}
              >
                <UiIcon name="square" size={16} className="size-4" />
                <span>{icon.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
