'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Download,
  FilePlus2,
  FolderOpen,
  Import,
  Keyboard,
  Monitor,
  Moon,
  Pencil,
  Redo2,
  Save,
  Search,
  Sun,
  FileJson,
  Package,
  Square,
  Undo2,
} from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  const projectName = useEditorStore((s) => s.project?.meta.name ?? 'Contour');
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
    window.addEventListener('contour:open-shortcuts', handler as EventListener);
    return () => window.removeEventListener('contour:open-shortcuts', handler as EventListener);
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
      else { clearCurrentProjectPath(); showToolbarError('Invalid Contour workspace file.'); }
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
      <header className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border/70 bg-background px-2" style={{ fontFamily: 'var(--font-system)', boxShadow: 'var(--shadow-outline)' }}>
        {/* Left: main menu + project name + save status */}
        <div className="flex min-w-0 items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-accent"
                aria-label="Main menu"
              >
                <span
                  className="inline-block h-3 shrink-0 bg-foreground"
                  role="img"
                  aria-label="Contour logo"
                  style={{
                    aspectRatio: '2144 / 408',
                    maskImage: 'url(/contour_wordmark.svg)',
                    maskSize: 'contain',
                    maskRepeat: 'no-repeat',
                    WebkitMaskImage: 'url(/contour_wordmark.svg)',
                    WebkitMaskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                  }}
                />
                <ChevronDown className="size-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-56">
              {/* File */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><FilePlus2 className="size-4" />File</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={handleNewProject}><FilePlus2 className="size-4" />New Project</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void handleOpenProject()}><FolderOpen className="size-4" />Open Project</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void handleSave()}><Save className="size-4" />Save<DropdownMenuShortcut>⌘S</DropdownMenuShortcut></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setImportDialogOpen(true)}><Import className="size-4" />Import Icons</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Edit */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><Undo2 className="size-4" />Edit</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={undo}><Undo2 className="size-4" />Undo<DropdownMenuShortcut>⌘Z</DropdownMenuShortcut></DropdownMenuItem>
                  <DropdownMenuItem onSelect={redo}><Redo2 className="size-4" />Redo<DropdownMenuShortcut>⇧⌘Z</DropdownMenuShortcut></DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {/* Export */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><Download className="size-4" />Export</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={handleExportSvgPackage} disabled={exporting}>
                    <Download className="size-4" />Quick ZIP (SVG package)
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleExportReactLibrary} disabled={exporting}>
                    <Download className="size-4" />React library (.zip)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setLottieSheetOpen(true)}>
                    <FileJson className="size-4" />Lottie JSON…
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDistributionSheetOpen(true)}>
                    <Package className="size-4" />Full distribution options…
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              {/* View / Preferences */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><Monitor className="size-4" />View</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {mounted && (
                    <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
                      {resolvedTheme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
                      {resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => setCommandOpen(true)}><Search className="size-4" />Search Icons<DropdownMenuShortcut>⌘K</DropdownMenuShortcut></DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              {/* Help */}
              <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}><Keyboard className="size-4" />Keyboard Shortcuts<DropdownMenuShortcut>?</DropdownMenuShortcut></DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCommandOpen(true)}><Search className="size-4" />Search<DropdownMenuShortcut>⌘K</DropdownMenuShortcut></DropdownMenuItem>
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
              <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}

          <Badge
            variant="outline"
            className={`h-5 shrink-0 rounded-full px-2 text-[10px] font-medium tracking-tight ${
              isDirty
                ? 'status-warning-surface border-[color:var(--border-warning)]'
                : 'border-border/70 bg-background/80 text-muted-foreground'
            }`}
          >
            {isDirty ? 'Unsaved' : savedAgoLabel ? `Saved ${savedAgoLabel}` : 'Saved'}
          </Badge>
        </div>

        <div className="flex-1" />

        {/* Right: quick actions */}
        <div className="flex items-center gap-0.5">
          {/* Save */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-[var(--button-icon-size-md)] w-[var(--button-icon-size-md)] rounded-[var(--radius-toolbar-action)]" aria-label="Save" onClick={() => void handleSave()}>
                <Save className="size-[var(--icon-inner-size-md)]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Save (Cmd/Ctrl+S)</TooltipContent>
          </Tooltip>

          {/* Undo/Redo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-[var(--button-icon-size-md)] w-[var(--button-icon-size-md)] rounded-[var(--radius-toolbar-action)]" aria-label="Undo" onClick={undo}>
                <Undo2 className="size-[var(--icon-inner-size-md)]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Undo (Cmd/Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-[var(--button-icon-size-md)] w-[var(--button-icon-size-md)] rounded-[var(--radius-toolbar-action)]" aria-label="Redo" onClick={redo}>
                <Redo2 className="size-[var(--icon-inner-size-md)]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Redo (Shift+Cmd/Ctrl+Z)</TooltipContent>
          </Tooltip>

          {/* Search */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-[var(--button-icon-size-md)] w-[var(--button-icon-size-md)] rounded-[var(--radius-toolbar-action)]" aria-label="Search icons" onClick={() => setCommandOpen(true)}>
                <Search className="size-[var(--icon-inner-size-md)]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Search (Cmd/Ctrl+K)</TooltipContent>
          </Tooltip>
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
          <div className="px-1 py-4"><SyncTargetPanelContent title="Distribution" description="Manage release targets and publish packages." /></div>
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
                <Square className="size-4" />
                <span>{icon.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
