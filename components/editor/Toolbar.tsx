'use client';

import { useCallback, useRef } from 'react';
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
import { Button } from '@/components/kibo-ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/kibo-ui/tooltip';
import { editorStore } from '@/lib/editor-store/store';
import { undo, redo } from '@/lib/editor-store/history';
import { useEditorStore } from '@/lib/editor-store/hooks';
import { isProject } from '@/lib/schema/guards';
import { exportSvgString } from '@/lib/export/export-svg';
import { importSvgFileIntoEditor } from '@/lib/import';
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
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const svgFileInputRef = useRef<HTMLInputElement>(null);
  const projectName = useEditorStore((s) => s.project?.meta.name ?? 'Icophone');
  const zoom = useEditorStore((s) => s.viewport.zoom);
  const selectionCount = useEditorStore((s) => s.selection.layerIds.length);
  const currentIconName = useEditorStore((s) =>
    s.currentIconId ? s.project?.icons[s.currentIconId]?.name ?? null : null,
  );

  const handleNew = useCallback(() => {
    editorStore.getState().newProject();
  }, []);

  const handleOpenProject = useCallback(() => {
    projectFileInputRef.current?.click();
  }, []);

  const handleImportSvg = useCallback(() => {
    svgFileInputRef.current?.click();
  }, []);

  const handleProjectFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        if (isProject(json)) {
          editorStore.getState().loadProject(json);
        } else {
          alert('Invalid Icophone project file.');
        }
      } catch {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleSvgFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importSvgFileIntoEditor(file);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to import SVG file.');
    } finally {
      e.target.value = '';
    }
  }, []);

  const handleSave = useCallback(() => {
    const { project } = editorStore.getState();
    if (!project) return;
    const updated = {
      ...project,
      meta: { ...project.meta, updatedAt: new Date().toISOString() },
    };
    const blob = new Blob([JSON.stringify(updated, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.meta.name.replace(/\s+/g, '-').toLowerCase()}.icophone.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportSvg = useCallback(() => {
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
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${icon.name.replace(/\s+/g, '-').toLowerCase()}.svg`;
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

  return (
    <header className="workspace-header mx-3 mb-3 mt-3 rounded-2xl px-4 py-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="mr-auto min-w-0 space-y-1">
          <p className="workspace-kicker">Editor</p>
          <p className="truncate text-lg font-semibold text-foreground">{projectName}</p>
          <p className="truncate text-sm text-muted-foreground">
            {currentIconName ?? 'No icon selected'} · {selectionCount} selected
          </p>
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
              <DropdownMenuItem onSelect={handleOpenProject}>
                <FolderOpen className="size-4" />
                Open Project
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleImportSvg}>
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
          <span className="workspace-badge min-w-[4.25rem] justify-center">
            {Math.round(zoom * 100)}%
          </span>
          <ToolbarButton icon={ZoomOut} label="Zoom Out" onClick={handleZoomOut} compact />
          <ToolbarButton icon={ZoomIn} label="Zoom In" onClick={handleZoomIn} compact />
          <ToolbarButton icon={Maximize2} label="Fit View" onClick={handleZoomFit} compact />
        </ToolbarGroup>
      </div>

      <input
        ref={projectFileInputRef}
        type="file"
        accept=".json"
        className="sr-only"
        onChange={handleProjectFileChange}
        aria-label="Open project file"
      />
      <input
        ref={svgFileInputRef}
        type="file"
        accept=".svg,image/svg+xml"
        className="sr-only"
        onChange={handleSvgFileChange}
        aria-label="Import SVG file"
      />
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
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? 'icon-sm' : 'sm'}
          onClick={onClick}
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
