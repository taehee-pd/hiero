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
} from 'lucide-react';
import { Button } from '@/components/kibo-ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/kibo-ui/tooltip';
import { Separator } from '@/components/kibo-ui/separator';
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
    <header className="mx-4 mb-2 mt-3 flex h-12 items-center gap-1 rounded-xl border border-border/60 bg-toolbar-bg/90 px-3 backdrop-blur-md">
      {/* Project name */}
      <span className="mr-2 max-w-40 truncate text-sm font-semibold text-foreground">
        {projectName}
      </span>

      <Separator orientation="vertical" className="h-5" />

      {/* File actions */}
      <ToolbarButton icon={FilePlus2} label="New" onClick={handleNew} />
      <ToolbarButton icon={FolderOpen} label="Open JSON" onClick={handleOpen} />
      <ToolbarButton icon={Save} label="Save JSON" onClick={handleSave} />
      <ToolbarButton
        icon={Download}
        label="Export SVG"
        onClick={handleExportSvg}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="sr-only"
        onChange={handleFileChange}
        aria-label="Open project file"
      />

      <Separator orientation="vertical" className="h-5" />

      {/* Undo / Redo */}
      <ToolbarButton icon={Undo2} label="Undo" onClick={undo} />
      <ToolbarButton icon={Redo2} label="Redo" onClick={redo} />

      <Separator orientation="vertical" className="h-5" />

      {/* Zoom controls */}
      <ToolbarButton icon={ZoomOut} label="Zoom Out" onClick={handleZoomOut} />
      <span className="min-w-12 text-center text-xs font-medium text-muted-foreground tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <ToolbarButton icon={ZoomIn} label="Zoom In" onClick={handleZoomIn} />
      <ToolbarButton
        icon={Maximize2}
        label="Fit to Content"
        onClick={handleZoomFit}
      />
    </header>
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
          className="rounded-xl text-muted-foreground hover:bg-background/70 hover:text-foreground"
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
