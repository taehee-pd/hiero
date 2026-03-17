'use client';

import { useCallback } from 'react';
import {
  Undo2,
  Redo2,
  FolderOpen,
  Save,
  Download,
  FilePlus2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Import,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { importSvgContentIntoEditor } from '@/lib/import';
import {
  clearCurrentProjectPath,
  exportSvg,
  importSvgFiles,
  openProject,
  saveProject,
} from '@/lib/platform/bridge';
import {
  selectCurrentIcon,
  selectCurrentVariant,
  selectCurrentState,
} from '@/lib/editor-store/selectors';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Toolbar() {
  const projectName = useEditorStore((s) => s.project?.meta.name ?? 'Icophone');
  const zoom = useEditorStore((s) => s.viewport.zoom);
  const renderingMode = useEditorStore((s) => s.renderingMode);
  const currentIconId = useEditorStore((s) => s.currentIconId);
  const currentVariantId = useEditorStore((s) => s.currentVariantId);
  const selectionCount = useEditorStore((s) => s.selection.layerIds.length);
  const currentIconName = useEditorStore((s) =>
    s.currentIconId ? s.project?.icons[s.currentIconId]?.name ?? null : null,
  );

  const handleNew = useCallback(() => {
    clearCurrentProjectPath();
    editorStore.getState().newProject();
  }, []);

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
        window.alert('Invalid Icophone workspace file.');
      }
    } catch {
      clearCurrentProjectPath();
      window.alert('Failed to parse JSON file.');
    }
  }, []);

  const handleImportSvg = useCallback(async () => {
    const result = await importSvgFiles();
    if (!result) return;

    for (const file of result.files) {
      try {
        await importSvgContentIntoEditor(file.content, file.name);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Failed to import SVG file.');
        break;
      }
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

  const handleRenderingModeChange = useCallback((value: string) => {
    if (!currentIconId || !currentVariantId) return;
    editorStore.getState().patchVariant(currentIconId, currentVariantId, {
      renderingMode: value as RenderingMode,
    });
  }, [currentIconId, currentVariantId]);

  return (
    <header className="workspace-header mx-3 mb-3 mt-3 rounded-2xl px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <p className="truncate text-base font-semibold tracking-tight text-foreground">{projectName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{currentIconName ?? 'No icon selected'}</span>
            <span className="text-border">/</span>
            <span>{selectionCount} selected</span>
          </div>
        </div>

        <ToolbarGroup>
          <ToolbarButton icon={FilePlus2} label="New" onClick={handleNew} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Open"
                className="workspace-tool-button h-9 rounded-xl px-3 text-foreground"
              >
                <FolderOpen className="size-4" />
                <span>Open</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void handleOpenProject()}>
                <FolderOpen className="size-4" />
                Open Project
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleImportSvg()}>
                <Import className="size-4" />
                Import SVG
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ToolbarButton icon={Save} label="Save" onClick={handleSave} />
          <ToolbarButton icon={Download} label="Export SVG" onClick={handleExportSvg} />
          <ToolbarButton icon={Download} label="Export SVG Package" onClick={handleExportSvgPackage} />
          <ToolbarButton icon={Download} label="Export Runtime JSON" onClick={handleExportRuntimeJson} />
          <ToolbarButton icon={Download} label="Export React Library" onClick={handleExportReactLibrary} />
          <SyncPrPanel />
        </ToolbarGroup>

        <ToolbarGroup>
          <ToolbarButton icon={Undo2} label="Undo" onClick={undo} compact />
          <ToolbarButton icon={Redo2} label="Redo" onClick={redo} compact />
        </ToolbarGroup>

        <ToolbarGroup>
          <Select
            value={renderingMode}
            onValueChange={handleRenderingModeChange}
            disabled={!currentIconId || !currentVariantId}
          >
            <SelectTrigger
              size="sm"
              className="workspace-tool-button h-9 rounded-xl px-3 text-foreground"
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
          <Badge variant="outline" className="min-w-[4.25rem] rounded-xl px-2.5 py-1 text-[11px] font-medium">
            {Math.round(zoom * 100)}%
          </Badge>
          <ToolbarButton icon={ZoomOut} label="Zoom Out" onClick={handleZoomOut} compact />
          <ToolbarButton icon={ZoomIn} label="Zoom In" onClick={handleZoomIn} compact />
          <ToolbarButton icon={Maximize2} label="Fit View" onClick={handleZoomFit} compact />
        </ToolbarGroup>
      </div>
    </header>
  );
}

const RENDERING_MODE_OPTIONS: Array<{ value: RenderingMode; label: string }> = [
  { value: 'monochrome', label: 'Monochrome' },
  { value: 'hierarchical', label: 'Hierarchical' },
  { value: 'palette', label: 'Palette' },
  { value: 'multicolor', label: 'Multicolor' },
];

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="workspace-toolbar-group">{children}</div>;
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  compact,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void | Promise<void>;
  compact?: boolean;
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
          className={
            compact
              ? 'workspace-tool-button h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground'
              : 'workspace-tool-button h-9 rounded-xl px-3 text-foreground'
          }
        >
          <Icon className="size-4" />
          {!compact ? <span>{label}</span> : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
