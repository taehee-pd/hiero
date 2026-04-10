'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FilePlus2,
  FolderOpen,
  HelpCircle,
  Import,
  Moon,
  Plus,
  Save,
  Search,
  Sun,
  FileJson,
  Package,
  Square,
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
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border/70 bg-background px-3" style={{ fontFamily: 'var(--font-system)', boxShadow: 'var(--shadow-outline)' }}>
        {/* Left: project name + save status */}
        <div className="flex min-w-0 items-center gap-2.5">
          <svg
            width={16}
            height={16}
            viewBox="0 0 512 512"
            fill="currentColor"
            aria-hidden="true"
            className="shrink-0 text-foreground"
          >
            <path d="M307.2 0C378.886 0 414.73 0.000192642 442.11 13.9512C459.908 23.0197 475.247 36.0805 486.994 52H443.5C442.321 52 441.08 51.9921 439.94 52.0762C426.101 53.097 415.097 64.1009 414.076 77.9404C413.992 79.0799 414 80.3212 414 81.5C414 82.6788 413.992 83.9201 414.076 85.0596C415.097 98.8991 426.101 109.903 439.94 110.924C441.08 111.008 442.321 111 443.5 111H509.29C512 133.791 512 163.285 512 204.8V307.2C512 348.715 512 378.209 509.29 401H443.5C442.321 401 441.08 400.992 439.94 401.076C426.101 402.097 415.097 413.101 414.076 426.94C413.992 428.08 414 429.321 414 430.5C414 431.679 413.992 432.92 414.076 434.06C415.097 447.899 426.101 458.903 439.94 459.924C441.08 460.008 442.321 460 443.5 460H486.994C475.247 475.919 459.908 488.98 442.11 498.049C414.73 512 378.886 512 307.2 512H204.8C133.114 512 97.2703 512 69.8896 498.049C45.8049 485.777 26.223 466.195 13.9512 442.11C0.000193596 414.73 0 378.886 0 307.2V204.8C0 133.114 0.000192642 97.2703 13.9512 69.8896C26.223 45.8049 45.8049 26.223 69.8896 13.9512C97.2703 0.000193596 133.114 0 204.8 0H307.2ZM134.5 401C133.321 401 132.08 400.992 130.94 401.076C117.101 402.097 106.097 413.101 105.076 426.94C104.992 428.08 105 429.321 105 430.5C105 431.679 104.992 432.92 105.076 434.06C106.097 447.899 117.101 458.903 130.94 459.924C132.08 460.008 133.321 460 134.5 460H246.5C247.679 460 248.92 460.008 250.06 459.924C263.899 458.903 274.903 447.899 275.924 434.06C276.008 432.92 276 431.679 276 430.5C276 429.321 276.008 428.08 275.924 426.94C274.903 413.101 263.899 402.097 250.06 401.076C248.92 400.992 247.679 401 246.5 401H134.5ZM80.8086 313C79.6089 313.003 78.3933 313.023 77.2559 313.135C63.9621 314.444 53.4441 324.962 52.1348 338.256C52.0228 339.393 52.0029 340.609 52 341.809V344.191C52.0029 345.391 52.0228 346.607 52.1348 347.744C53.4441 361.038 63.9621 371.556 77.2559 372.865C78.3933 372.977 79.6089 372.997 80.8086 373H100.191C101.391 372.997 102.607 372.977 103.744 372.865C117.038 371.556 127.556 361.038 128.865 347.744C128.977 346.607 128.997 345.391 129 344.191V341.809C128.997 340.609 128.977 339.393 128.865 338.256C127.556 324.962 117.038 314.444 103.744 313.135C102.607 313.023 101.391 313.003 100.191 313H80.8086ZM280.809 313C279.609 313.003 278.393 313.023 277.256 313.135C263.962 314.444 253.444 324.962 252.135 338.256C252.023 339.393 252.003 340.609 252 341.809V344.191C252.003 345.391 252.023 346.607 252.135 347.744C253.444 361.038 263.962 371.556 277.256 372.865C278.393 372.977 279.609 372.997 280.809 373H301.191C302.391 372.997 303.607 372.977 304.744 372.865C318.038 371.556 328.556 361.038 329.865 347.744C329.977 346.607 329.997 345.391 330 344.191V341.809C329.997 340.609 329.977 339.393 329.865 338.256C328.556 324.962 318.038 314.444 304.744 313.135C303.607 313.023 302.391 313.003 301.191 313H280.809ZM388.809 313C387.609 313.003 386.393 313.023 385.256 313.135C371.962 314.444 361.444 324.962 360.135 338.256C360.023 339.393 360.003 340.609 360 341.809V344.191C360.003 345.391 360.023 346.607 360.135 347.744C361.444 361.038 371.962 371.556 385.256 372.865C386.393 372.977 387.609 372.997 388.809 373H409.191C410.391 372.997 411.607 372.977 412.744 372.865C426.038 371.556 436.556 361.038 437.865 347.744C437.977 346.607 437.997 345.391 438 344.191V341.809C437.997 340.609 437.977 339.393 437.865 338.256C436.556 324.962 426.038 314.444 412.744 313.135C411.607 313.023 410.391 313.003 409.191 313H388.809ZM80.8086 226C79.6089 226.003 78.3933 226.023 77.2559 226.135C63.9621 227.444 53.4441 237.962 52.1348 251.256C52.0228 252.393 52.0029 253.609 52 254.809V257.191C52.0029 258.391 52.0228 259.607 52.1348 260.744C53.4441 274.038 63.9621 284.556 77.2559 285.865C78.3933 285.977 79.6089 285.997 80.8086 286H100.191C101.391 285.997 102.607 285.977 103.744 285.865C117.038 284.556 127.556 274.038 128.865 260.744C128.977 259.607 128.997 258.391 129 257.191V254.809C128.997 253.609 128.977 252.393 128.865 251.256C127.556 237.962 117.038 227.444 103.744 226.135C102.607 226.023 101.391 226.003 100.191 226H80.8086ZM388.809 226C387.609 226.003 386.393 226.023 385.256 226.135C371.962 227.444 361.444 237.962 360.135 251.256C360.023 252.393 360.003 253.609 360 254.809V257.191C360.003 258.391 360.023 259.607 360.135 260.744C361.444 274.038 371.962 284.556 385.256 285.865C386.393 285.977 387.609 285.997 388.809 286H409.191C410.391 285.997 411.607 285.977 412.744 285.865C426.038 284.556 436.556 274.038 437.865 260.744C437.977 259.607 437.997 258.391 438 257.191V254.809C437.997 253.609 437.977 252.393 437.865 251.256C436.556 237.962 426.038 227.444 412.744 226.135C411.607 226.023 410.391 226.003 409.191 226H388.809ZM80.8086 139C79.6089 139.003 78.3933 139.023 77.2559 139.135C63.9621 140.444 53.4441 150.962 52.1348 164.256C52.0228 165.393 52.0029 166.609 52 167.809V170.191C52.0029 171.391 52.0228 172.607 52.1348 173.744C53.4441 187.038 63.9621 197.556 77.2559 198.865C78.3933 198.977 79.6089 198.997 80.8086 199H100.191C101.391 198.997 102.607 198.977 103.744 198.865C117.038 197.556 127.556 187.038 128.865 173.744C128.977 172.607 128.997 171.391 129 170.191V167.809C128.997 166.609 128.977 165.393 128.865 164.256C127.556 150.962 117.038 140.444 103.744 139.135C102.607 139.023 101.391 139.003 100.191 139H80.8086ZM280.809 139C279.609 139.003 278.393 139.023 277.256 139.135C263.962 140.444 253.444 150.962 252.135 164.256C252.023 165.393 252.003 166.609 252 167.809V170.191C252.003 171.391 252.023 172.607 252.135 173.744C253.444 187.038 263.962 197.556 277.256 198.865C278.393 198.977 279.609 198.997 280.809 199H301.191C302.391 198.997 303.607 198.977 304.744 198.865C318.038 197.556 328.556 187.038 329.865 173.744C329.977 172.607 329.997 171.391 330 170.191V167.809C329.997 166.609 329.977 165.393 329.865 164.256C328.556 150.962 318.038 140.444 304.744 139.135C303.607 139.023 302.391 139.003 301.191 139H280.809ZM388.809 139C387.609 139.003 386.393 139.023 385.256 139.135C371.962 140.444 361.444 150.962 360.135 164.256C360.023 165.393 360.003 166.609 360 167.809V170.191C360.003 171.391 360.023 172.607 360.135 173.744C361.444 187.038 371.962 197.556 385.256 198.865C386.393 198.977 387.609 198.997 388.809 199H409.191C410.391 198.997 411.607 198.977 412.744 198.865C426.038 197.556 436.556 187.038 437.865 173.744C437.977 172.607 437.997 171.391 438 170.191V167.809C437.997 166.609 437.977 165.393 437.865 164.256C436.556 150.962 426.038 140.444 412.744 139.135C411.607 139.023 410.391 139.003 409.191 139H388.809ZM134.5 52C133.321 52 132.08 51.9921 130.94 52.0762C117.101 53.097 106.097 64.1009 105.076 77.9404C104.992 79.0799 105 80.3212 105 81.5C105 82.6788 104.992 83.9201 105.076 85.0596C106.097 98.8991 117.101 109.903 130.94 110.924C132.08 111.008 133.321 111 134.5 111H246.5C247.679 111 248.92 111.008 250.06 110.924C263.899 109.903 274.903 98.8992 275.924 85.0596C276.008 83.9201 276 82.6788 276 81.5C276 80.3212 276.008 79.0799 275.924 77.9404C274.903 64.1009 263.899 53.097 250.06 52.0762C248.92 51.9921 247.679 52 246.5 52H134.5Z" />
          </svg>
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">{projectName}</p>
          <Badge
            variant="outline"
            className={`h-5 shrink-0 rounded-full px-2 text-[10px] tracking-tight ${
              isDirty
                ? 'status-warning-surface shadow-[inset_0_0_0_0.5px_var(--border-warning)]'
                : 'border-border/70 bg-background/80 text-muted-foreground shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.04)]'
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

          {/* Theme toggle — defer until mounted to avoid hydration mismatch */}
          {mounted && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7 rounded-lg"
                  aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                >
                  {resolvedTheme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}</TooltipContent>
            </Tooltip>
          )}

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
