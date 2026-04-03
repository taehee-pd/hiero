'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FilePlus2,
  FolderOpen,
  HelpCircle,
  Import,
  Plus,
  Save,
  Search,
  FileJson,
  Package,
  Square,
} from 'lucide-react';
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
  const projectName = useEditorStore((s) => s.project?.meta.name ?? 'Coniva');
  const isDirty = useEditorStore((s) => s.isDirty);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const currentIconName = useEditorStore((s) =>
    s.currentIconId ? (s.project?.icons[s.currentIconId]?.name ?? null) : null,
  );

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [lottieSheetOpen, setLottieSheetOpen] = useState(false);
  const [distributionSheetOpen, setDistributionSheetOpen] = useState(false);
  const [confirmNewProjectOpen, setConfirmNewProjectOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [toolbarError, setToolbarError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const toolbarErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      else { clearCurrentProjectPath(); showToolbarError('Invalid Coniva workspace file.'); }
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
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border/70 bg-background px-3" style={{ fontFamily: 'var(--font-system)' }}>
        {/* Left: project name + save status */}
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">{projectName}</p>
          <Badge
            variant="outline"
            className={`h-5 shrink-0 rounded-full px-1.5 text-[10px] font-medium ${
              isDirty
                ? 'border-amber-300/70 bg-amber-50/80 text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-400'
                : 'border-border/70 bg-background/80 text-muted-foreground'
            }`}
          >
            {isDirty ? 'Unsaved' : savedAgoLabel ? `Saved ${savedAgoLabel}` : 'Saved'}
          </Badge>
          {currentIconName && (
            <span className="truncate text-xs text-muted-foreground">/ {currentIconName}</span>
          )}
        </div>

        <div className="flex-1" />

        {/* Right: actions */}
        <div className="flex items-center gap-1">
          {/* File menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-7 w-7 rounded-lg" aria-label="File menu">
                <FilePlus2 className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={handleNewProject}><FilePlus2 className="size-4" />New Project</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleOpenProject()}><FolderOpen className="size-4" />Open Project</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setImportDialogOpen(true)}><Import className="size-4" />Import Icons</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Save */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-7 w-7 rounded-lg" aria-label="Save" onClick={() => void handleSave()}>
                <Save className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Save (Cmd/Ctrl+S)</TooltipContent>
          </Tooltip>

          {/* Export menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-7 w-7 rounded-lg" aria-label="Export" disabled={exporting}>
                <Download className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={handleExportSvgPackage}><Download className="size-4" />SVG Package</DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExportReactLibrary}><Download className="size-4" />React Library</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setLottieSheetOpen(true)}><FileJson className="size-4" />Lottie JSON</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDistributionSheetOpen(true)}><Package className="size-4" />Distribution</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Undo/Redo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-7 w-7 rounded-lg" aria-label="Undo" onClick={undo}>
                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Undo (Cmd/Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-7 w-7 rounded-lg" aria-label="Redo" onClick={redo}>
                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></svg>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Redo (Shift+Cmd/Ctrl+Z)</TooltipContent>
          </Tooltip>

          {/* Search */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-7 w-7 rounded-lg" aria-label="Search icons" onClick={() => setCommandOpen(true)}>
                <Search className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Search (Cmd/Ctrl+K)</TooltipContent>
          </Tooltip>

          {/* Help */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-7 w-7 rounded-lg" aria-label="Keyboard shortcuts" onClick={() => setShortcutsOpen(true)}>
                <HelpCircle className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Shortcuts (?)</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Error toast */}
      {toolbarError && (
        <div className="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 shadow-lg" role="alert" aria-live="assertive">
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
          <div className="grid gap-2 text-sm">
            {[
              ['Select tool', 'V'], ['Direct select', 'A'], ['Pen tool', 'P'], ['Shape tool', 'U'],
              ['Undo', 'Cmd/Ctrl+Z'], ['Redo', 'Shift+Cmd/Ctrl+Z'],
              ['Toggle guides', 'Cmd/Ctrl+;'], ['Toggle snap', 'Shift+Cmd/Ctrl+;'],
              ['Delete', 'Delete'], ['Escape', 'Esc'],
            ].map(([label, shortcut]) => (
              <div key={label} className="flex items-center justify-between rounded-lg border border-border/70 bg-background/60 px-3 py-1.5">
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
