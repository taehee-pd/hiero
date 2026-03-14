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
import { isProject } from '@/lib/schema/guards';
import { exportSvgString } from '@/lib/export/export-svg';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Toolbar() {
  const projectName = useEditorStore((s) => s.project?.meta.name ?? 'Icophone');
  const zoom = useEditorStore((s) => s.viewport.zoom);
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
      if (isProject(json)) {
        editorStore.getState().loadProject(json);
      } else {
        clearCurrentProjectPath();
        window.alert('Invalid Icophone project file.');
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

  const serializeProject = useCallback(() => {
    const { project } = editorStore.getState();
    if (!project) return null;

    const updatedAt = new Date().toISOString();
    const updated = {
      ...project,
      meta: { ...project.meta, updatedAt },
    };
    return {
      data: JSON.stringify(updated, null, 2),
      updatedAt,
    };
  }, []);

  const handleSave = useCallback(async () => {
    const payload = serializeProject();
    if (!payload) return;

    const result = await saveProject(payload.data);
    if (result) {
      editorStore.getState().markSaved(payload.updatedAt);
    }
  }, [serializeProject]);

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
    );

    await exportSvg(svg, `${icon.name.replace(/\s+/g, '-').toLowerCase()}.svg`);
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
        </ToolbarGroup>

        <ToolbarGroup>
          <ToolbarButton icon={Undo2} label="Undo" onClick={undo} compact />
          <ToolbarButton icon={Redo2} label="Redo" onClick={redo} compact />
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
