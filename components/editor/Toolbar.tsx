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
  Sparkles,
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
import {
  selectCurrentIcon,
  selectCurrentVariant,
  selectCurrentState,
} from '@/lib/editor-store/selectors';

export function Toolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectName = useEditorStore(
    (s) => s.project?.meta.name ?? 'Icophone',
  );
  const zoom = useEditorStore((s) => s.viewport.zoom);
  const tool = useEditorStore((s) => s.tool);
  const selectionCount = useEditorStore((s) => s.selection.layerIds.length);

  // ── File actions ──────────────────────────────────────────

  const handleNew = useCallback(() => {
    editorStore.getState().newProject();
  }, []);

  const handleOpen = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
      // Reset so the same file can be re-opened
      e.target.value = '';
    },
    [],
  );

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

  // ── Zoom ──────────────────────────────────────────────────

  const handleZoomIn = useCallback(() => {
    const { viewport, setViewport } = editorStore.getState();
    setViewport({ zoom: Math.min(viewport.zoom * 1.25, 32) });
  }, []);

  const handleZoomOut = useCallback(() => {
    const { viewport, setViewport } = editorStore.getState();
    setViewport({ zoom: Math.max(viewport.zoom / 1.25, 0.1) });
  }, []);

  const handleZoomFit = useCallback(() => {
    editorStore.getState().setViewport({ zoom: 1, panX: 0, panY: 0 });
  }, []);

  return (
    <header className="workspace-header mx-4 mb-2 mt-3 rounded-[1.6rem] px-3 py-3 lg:mx-5">
      <div className="relative z-10 flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <p className="workspace-kicker">Workspace</p>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate font-display text-[1.45rem] leading-none tracking-[-0.05em] text-foreground">
              {projectName}
            </span>
            <span className="workspace-badge tabular-nums">{Math.round(zoom * 100)}%</span>
            <span className="workspace-badge text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {tool.replace('-', ' ')}
            </span>
            <span className="workspace-badge text-[10px] tabular-nums text-muted-foreground">
              {selectionCount} selected
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Author paths, align geometry, and export icon states from one control surface.
          </p>
        </div>

        <ToolbarGroup label="File">
          <ToolbarButton icon={FilePlus2} label="New" onClick={handleNew} />
          <ToolbarButton icon={FolderOpen} label="Open JSON" onClick={handleOpen} />
          <ToolbarButton icon={Save} label="Save JSON" onClick={handleSave} />
          <ToolbarButton
            icon={Download}
            label="Export SVG"
            onClick={handleExportSvg}
          />
        </ToolbarGroup>

        <ToolbarGroup label="History">
          <ToolbarButton icon={Undo2} label="Undo" onClick={undo} />
          <ToolbarButton icon={Redo2} label="Redo" onClick={redo} />
        </ToolbarGroup>

        <ToolbarGroup label="View">
          <ToolbarButton icon={ZoomOut} label="Zoom Out" onClick={handleZoomOut} />
          <ToolbarButton icon={ZoomIn} label="Zoom In" onClick={handleZoomIn} />
          <ToolbarButton
            icon={Maximize2}
            label="Fit to Content"
            onClick={handleZoomFit}
          />
        </ToolbarGroup>

        <div className="workspace-section-card hidden rounded-[1.2rem] px-3 py-2.5 xl:block">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="size-3.5" />
            <span className="workspace-kicker text-[0.58rem]">Flow</span>
          </div>
          <p className="mt-2 max-w-[13rem] text-xs leading-5 text-muted-foreground">
            Use the left rail to frame the edit, the center stage to draw, and the inspector to refine booleans and fills.
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="sr-only"
        onChange={handleFileChange}
        aria-label="Open project file"
      />
    </header>
  );
}

function ToolbarGroup({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="workspace-toolbar-group">
      <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

// ── Toolbar icon button ──────────────────────────────────────

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? 'secondary' : 'ghost'}
          size="icon-sm"
          onClick={onClick}
          aria-label={label}
          data-active={active ? 'true' : 'false'}
          className="workspace-tool-button rounded-[0.9rem] text-muted-foreground hover:bg-background/70 hover:text-foreground"
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
