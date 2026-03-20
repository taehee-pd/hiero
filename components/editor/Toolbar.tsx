'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Undo2,
  Redo2,
  FolderOpen,
  Save,
  Download,
  FilePlus2,
  HelpCircle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Import,
  Plus,
  ChevronDown,
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
import { ImportIconDialog } from '@/components/editor/ImportIconDialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  clearCurrentProjectPath,
  exportSvg,
  openProject,
  saveProject,
} from '@/lib/platform/bridge';
import {
  selectCurrentIcon,
  selectCurrentVariant,
  selectCurrentState,
} from '@/lib/editor-store/selectors';
import { buildEditorRoute } from '@/lib/platform/routes';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RenderingMode } from '@/lib/schema/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Toolbar() {
  const router = useRouter();
  const projectName = useEditorStore((s) => s.project?.meta.name ?? 'Coniva');
  const zoom = useEditorStore((s) => s.viewport.zoom);
  const renderingMode = useEditorStore((s) => s.renderingMode);
  const currentIconId = useEditorStore((s) => s.currentIconId);
  const activeIconSetId = useEditorStore((s) => s.activeIconSetId);
  const currentVariantId = useEditorStore((s) => s.currentVariantId);
  const activeIconSetId = useEditorStore((s) => s.activeIconSetId);
  const selectionCount = useEditorStore((s) => s.selection.layerIds.length);
  const isDirty = useEditorStore((s) => s.isDirty);
  const currentIconName = useEditorStore((s) =>
    s.currentIconId ? (s.project?.icons[s.currentIconId]?.name ?? null) : null,
  );
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [confirmNewProjectOpen, setConfirmNewProjectOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const runNewProject = useCallback(() => {
    clearCurrentProjectPath();
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
        window.alert('Invalid Coniva workspace file.');
      }
    } catch {
      clearCurrentProjectPath();
      window.alert('Failed to parse JSON file.');
    }
  }, []);

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

  const handleExportSvg = useCallback(async () => {
    const state = editorStore.getState();
    const icon = selectCurrentIcon(state);
    const variant = selectCurrentVariant(state);
    const currentState = selectCurrentState(state);
    if (!icon || !variant || !currentState) return;

    const svg = exportSvgString(
      icon,
      variant.id,
      currentState.id,
      state.project?.tokenSet?.colors,
      state.renderingMode,
    );

    await exportSvg(svg, `${icon.name.replace(/\s+/g, '-').toLowerCase()}.svg`);
  }, []);

  const handleExportSvgPackage = useCallback(() => {
    const { project } = editorStore.getState();
    if (!project) return;

    const fileMap = exportSvgPackage(project);
    const zipBlob = createZipBlob(fileMap);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.meta.name.replace(/\s+/g, '-').toLowerCase()}-svg-package.zip`;
    a.click();
    URL.revokeObjectURL(url);
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
  }, []);

  const handleZoomIn = useCallback(() => {
    const { viewport, setViewport } = editorStore.getState();
    setViewport({ zoom: Math.min(viewport.zoom * 1.25, 32) });
  }, []);

  const handleZoomOut = useCallback(() => {
    const { viewport, setViewport } = editorStore.getState();
    setViewport({ zoom: Math.max(viewport.zoom / 1.25, 0.1) });
  }, []);

  const handleZoomFit = useCallback(() => {
    window.dispatchEvent(new CustomEvent('editor:fit-canvas'));
  }, []);

  const handleRenderingModeChange = useCallback(
    (value: string) => {
      if (!currentIconId || !currentVariantId) return;
      editorStore.getState().patchVariant(currentIconId, currentVariantId, {
        renderingMode: value as RenderingMode,
      });
    },
    [currentIconId, currentVariantId],
  );

  return (
    <>
      <header
        className="workspace-header mx-3 mb-3 mt-3 rounded-2xl px-3 py-1.5"
        style={{ fontFamily: 'var(--font-system)', minHeight: 'var(--toolbar-height)' }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto min-w-0">
            <p className="truncate text-[13px] font-medium tracking-tight text-foreground">
              {projectName}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="truncate">{currentIconName ?? 'No icon selected'}</span>
              <span className="text-border-subtle">/</span>
              <span>{selectionCount} selected</span>
            </div>
          </div>

          <ToolbarGroup>
            <ToolbarButton icon={Plus} label="New Icon" onClick={handleCreateBlankIcon} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="File"
                  className="workspace-tool-button h-7 rounded-lg px-2.5 text-[13px] text-foreground hover:bg-transparent hover:opacity-80"
                >
                  <FilePlus2 className="size-3.5" />
                  <span>File</span>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={handleNewProject}>
                  <FilePlus2 className="size-4" />
                  New Project
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleOpenProject()}>
                  <FolderOpen className="size-4" />
                  Open Project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setImportDialogOpen(true)}>
                  <Import className="size-4" />
                  Import Icon
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ToolbarGroup>

          <ToolbarGroup>
            <ToolbarButton icon={Save} label="Save" onClick={handleSave} shortcut="Cmd/Ctrl+S" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Export"
                  className="workspace-tool-button h-7 rounded-lg px-2.5 text-[13px] text-foreground hover:bg-transparent hover:opacity-80"
                >
                  <Download className="size-3.5" />
                  <span>Export</span>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void handleExportSvg()}>
                  <Download className="size-4" />
                  Export SVG
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExportSvgPackage}>
                  <Download className="size-4" />
                  Export SVG Package
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExportRuntimeJson}>
                  <Download className="size-4" />
                  Export Runtime JSON
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExportReactLibrary}>
                  <Download className="size-4" />
                  Export React Library
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <SyncPrPanel />
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
            <Select
              value={renderingMode}
              onValueChange={handleRenderingModeChange}
              disabled={!currentIconId || !currentVariantId}
            >
              <SelectTrigger
                size="sm"
                className="workspace-tool-button h-7 rounded-lg px-2.5 text-[13px] text-foreground"
                aria-label="Rendering mode"
              >
                <SelectValue placeholder="Rendering Mode" />
              </SelectTrigger>
              <SelectContent align="end">
                {RENDERING_MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ToolbarGroup>

          <ToolbarGroup>
            <Badge
              variant="outline"
              className="min-w-[3.75rem] rounded-lg px-2 py-0.5 text-[11px] font-medium"
            >
              {Math.round(zoom * 100)}%
            </Badge>
            <ToolbarButton icon={ZoomOut} label="Zoom Out" onClick={handleZoomOut} compact shortcut="-" />
            <ToolbarButton icon={ZoomIn} label="Zoom In" onClick={handleZoomIn} compact shortcut="+" />
            <ToolbarButton icon={Maximize2} label="Fit View" onClick={handleZoomFit} compact shortcut="0" />
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

      <ImportIconDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />

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
    </>
  );
}

const RENDERING_MODE_OPTIONS: Array<{ value: RenderingMode; label: string }> = [
  { value: 'monochrome', label: 'Monochrome' },
  { value: 'hierarchical', label: 'Hierarchical' },
  { value: 'palette', label: 'Palette' },
  { value: 'multicolor', label: 'Multicolor' },
];

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
              ? 'workspace-tool-button h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-transparent hover:opacity-80'
              : 'workspace-tool-button h-7 rounded-lg px-2.5 text-[13px] text-foreground hover:bg-transparent hover:opacity-80'
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
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-background/60 px-3 py-2">
      <span>{label}</span>
      <span className="rounded-md border border-border/70 bg-muted/40 px-2 py-1 font-mono text-xs">
        {shortcut}
      </span>
    </div>
  );
}
