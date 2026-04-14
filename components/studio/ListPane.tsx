'use client';

import { useCallback, useMemo, useState, useRef } from 'react';
import { ArrowDownToLine, ChevronLeft, ChevronRight, FolderInput, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { toast } from '@/components/ui/use-toast';
import { editorStore } from '@/lib/editor-store/store';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import { exportSvgString } from '@/lib/export/export-svg';
import { exportSvgPackage } from '@/lib/export/export-svg-package';
import { createZipBlob } from '@/lib/export/export-react/zip';
import { createImportedIcon, isSvgFile } from '@/lib/import/import-svg-file';
import { IconGridItem } from '@/components/explorer/IconGridItem';
import { ImportIconDialog } from '@/components/editor/ImportIconDialog';
import { cn } from '@/lib/utils';

type ListIcon = { id: string; name: string; category?: string; tags?: string[] };

function filterIcons(icons: ListIcon[], query: string): ListIcon[] {
  const q = query.trim().toLowerCase();
  if (!q) return icons;
  return icons.filter(
    (icon) =>
      icon.name.toLowerCase().includes(q) ||
      icon.id.toLowerCase().includes(q) ||
      icon.category?.toLowerCase().includes(q) ||
      icon.tags?.some((tag) => tag.toLowerCase().includes(q)),
  );
}

/* ------------------------------------------------------------------ */
/*  Marquee hit-testing helper                                        */
/* ------------------------------------------------------------------ */
function rectsIntersect(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

type MarqueeDrag = {
  startX: number;
  startY: number;
  baseSelectedIds: string[];
  mode: 'replace' | 'toggle';
};

export function ListPane({ onIconOpen }: { onIconOpen?: () => void } = {}) {
  const project = useEditorStore((s) => s.project);
  const activeIconSetId = useEditorStore((s) => s.activeIconSetId);
  const currentIconId = useEditorStore((s) => s.currentIconId);
  const favorites = useEditorStore((s) => s.favorites);
  const selectedIconIds = useEditorStore((s) => s.selectedIconIds);
  const listExpanded = useEditorStore((s) => s.listPaneExpanded);
  const {
    createBlankIcon,
    openIconTab,
    toggleFavorite,
    toggleListPane,
    setSelectedIconIds,
    toggleIconSelection,
    clearIconSelection,
  } = useEditorActions();

  const [query, setQuery] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Marquee state (local — only selectedIconIds goes to the store)
  const [marqueeRect, setMarqueeRect] = useState<{ left: number; top: number; right: number; bottom: number } | null>(null);
  const marqueeDragRef = useRef<MarqueeDrag | null>(null);

  const icons = useMemo(
    () =>
      Object.values(project?.icons ?? {}).map((icon) => ({
        id: icon.id,
        name: icon.name,
        category: icon.category,
        tags: icon.tags,
      })),
    [project],
  );

  const filtered = useMemo(() => filterIcons(icons, query), [icons, query]);
  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);
  const selectedSet = useMemo(() => new Set(selectedIconIds), [selectedIconIds]);

  const handleOpenIcon = useCallback(
    (iconId: string) => {
      editorStore.getState().setCurrentIcon(iconId);
      if (activeIconSetId) {
        openIconTab(activeIconSetId, iconId);
      }
      onIconOpen?.();
    },
    [activeIconSetId, openIconTab, onIconOpen],
  );

  const handleCreateBlankIcon = useCallback(() => {
    const iconId = createBlankIcon();
    if (iconId && activeIconSetId) {
      openIconTab(activeIconSetId, iconId);
    }
  }, [activeIconSetId, createBlankIcon, openIconTab]);

  const handleExportAll = useCallback(() => {
    if (!project) return;
    const fileMap = exportSvgPackage(project);
    const zipBlob = createZipBlob(fileMap);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    const fileName = `${project.meta.name.replace(/\s+/g, '-').toLowerCase()}-svg-package.zip`;
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Quick ZIP export started',
      description: `Downloading ${fileName}`,
    });
  }, [project]);

  const handleOpenExportDialog = useCallback(() => {
    if (!project) return;
    setExportDialogOpen(true);
  }, [project]);

  const handleConfirmExportAll = useCallback(() => {
    setExportDialogOpen(false);
    handleExportAll();
  }, [handleExportAll]);

  const handleSvgFileDrop = useCallback(
    async (files: FileList) => {
      const MAX_FILES = 50;
      const MAX_FILE_SIZE = 512 * 1024;
      const svgFiles = Array.from(files).filter(isSvgFile).slice(0, MAX_FILES);
      for (const file of svgFiles) {
        if (file.size > MAX_FILE_SIZE) continue;
        const content = await file.text();
        const name = file.name.replace(/\.svg$/i, '');
        const importedIcon = createImportedIcon(content, { sourceName: name });
        if (importedIcon) {
          editorStore.getState().insertIcon(importedIcon);
        }
      }
    },
    [],
  );

  /* ---------------------------------------------------------------- */
  /*  Marquee drag handlers                                           */
  /* ---------------------------------------------------------------- */
  const handleGridPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Only left button, only on grid background (not on an item or scrollbar)
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('article[data-icon-id]')) return;
      if (target.closest('[data-slot="scroll-area-scrollbar"]')) return;

      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      const base = e.shiftKey || e.metaKey ? [...editorStore.getState().selectedIconIds] : [];
      if (!e.shiftKey && !e.metaKey) clearIconSelection();

      marqueeDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        baseSelectedIds: base,
        mode: e.shiftKey || e.metaKey ? 'toggle' : 'replace',
      };
    },
    [clearIconSelection],
  );

  const handleGridPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = marqueeDragRef.current;
      if (!drag) return;

      const left = Math.min(drag.startX, e.clientX);
      const top = Math.min(drag.startY, e.clientY);
      const right = Math.max(drag.startX, e.clientX);
      const bottom = Math.max(drag.startY, e.clientY);

      setMarqueeRect({ left, top, right, bottom });

      // Hit-test all icon items
      if (!gridRef.current) return;
      const items = gridRef.current.querySelectorAll<HTMLElement>('article[data-icon-id]');
      const hitIds: string[] = [];

      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        if (rectsIntersect({ left, top, right, bottom }, rect)) {
          const id = item.getAttribute('data-icon-id');
          if (id) hitIds.push(id);
        }
      });

      if (drag.mode === 'toggle') {
        const baseSet = new Set(drag.baseSelectedIds);
        for (const id of hitIds) {
          if (baseSet.has(id)) baseSet.delete(id);
          else baseSet.add(id);
        }
        setSelectedIconIds([...baseSet]);
      } else {
        setSelectedIconIds(hitIds);
      }
    },
    [setSelectedIconIds],
  );

  const handleGridPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!marqueeDragRef.current) return;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      marqueeDragRef.current = null;
      setMarqueeRect(null);
    },
    [],
  );

  const iconCount = icons.length;

  if (!activeIconSetId) {
    return (
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-border/70 bg-background transition-[width] duration-200',
          listExpanded ? 'w-[230px]' : 'w-10',
        )}
        style={{ boxShadow: 'var(--shadow-inset-edge)' }}
        role="region"
        aria-label="Icon list"
      >
        <div className={cn('flex h-10 items-center border-b border-border/40', listExpanded ? 'px-2' : 'justify-center')}>
          {listExpanded ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-lg" onClick={toggleListPane} aria-label="Collapse icon list">
                  <ChevronLeft className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Collapse</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-lg" onClick={toggleListPane} aria-label="Expand icon list">
                  <ChevronRight className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand</TooltipContent>
            </Tooltip>
          )}
        </div>
        {listExpanded ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center">
            <div className="studio-dots rounded-lg border border-dashed border-border/70 px-6 py-8">
              <p className="text-xs text-muted-foreground">Select a project from the sidebar to view its icons.</p>
            </div>
          </div>
        ) : (
          <button type="button" onClick={toggleListPane} className="flex flex-1 items-start justify-center pt-3" aria-label="Expand icons sidebar">
            <span className="text-[length:var(--text-caption)] font-medium tracking-tight text-muted-foreground [writing-mode:vertical-lr]">Icons</span>
          </button>
        )}
      </aside>
    );
  }

  return (
    <>
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-border/70 bg-background transition-[width] duration-200 overflow-hidden',
          listExpanded ? 'w-[230px]' : 'w-10',
        )}
        style={{ boxShadow: 'var(--shadow-inset-edge)' }}
        role="region"
        aria-label="Icon list"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length > 0) void handleSvgFileDrop(e.dataTransfer.files);
        }}
      >
        {/* Header */}
        <div className={cn('flex h-10 items-center gap-2 border-b border-border/40', listExpanded ? 'px-2' : 'justify-center')}>
          {listExpanded ? (
            <>
              <span className="studio-kicker min-w-0 flex-1 truncate px-1">{iconCount} icon{iconCount === 1 ? '' : 's'}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-lg" onClick={handleCreateBlankIcon} aria-label="New icon">
                    <Plus className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">New Icon</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-lg" onClick={() => setImportDialogOpen(true)} aria-label="Import icons">
                    <FolderInput className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Import Icons</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7 shrink-0 rounded-lg text-primary hover:bg-primary/10 hover:text-primary"
                    onClick={handleOpenExportDialog}
                    aria-label="Quick ZIP export"
                  >
                    <ArrowDownToLine className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Quick ZIP (SVG package)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-lg" onClick={toggleListPane} aria-label="Collapse icon list">
                    <ChevronLeft className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Collapse</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="h-7 w-7 shrink-0 rounded-lg" onClick={toggleListPane} aria-label="Expand icon list">
                  <ChevronRight className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand</TooltipContent>
            </Tooltip>
          )}
        </div>

        {listExpanded ? (
          <>
            {/* Search */}
            <div className="relative px-2 py-1.5">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search icons…"
                aria-label="Search icons"
                className={cn(
                  'h-7 rounded-lg border-border/70 bg-background/60 pl-7 text-xs',
                  query ? 'pr-7' : 'pr-2',
                )}
                style={{ boxShadow: 'var(--shadow-outline)' }}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-4 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>

            {/* Icon grid with marquee support */}
            <ScrollArea
              className="flex-1"
              onPointerDown={handleGridPointerDown}
              onPointerMove={handleGridPointerMove}
              onPointerUp={handleGridPointerUp}
            >
              <div
                ref={gridRef}
                className="grid grid-cols-3 content-start gap-1 p-2"
                role="list"
                aria-label="Icons"
              >
                {filtered.length === 0 ? (
                  <div className="col-span-3 flex flex-col items-center justify-center gap-2 py-8">
                    <p
                      className="max-w-full truncate rounded-full border border-border/70 bg-background/80 px-4 py-1.5 text-xs text-muted-foreground"
                      style={{ boxShadow: 'var(--shadow-outline)' }}
                    >
                      {query ? `No icons match "${query}"` : 'No icons yet. Create or import one.'}
                    </p>
                    {query ? (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="text-[length:var(--text-caption)] text-primary underline-offset-2 hover:underline"
                      >
                        Clear search
                      </button>
                    ) : null}
                  </div>
                ) : (
                  filtered.map((icon) => {
                    const iconDef = project?.icons[icon.id];
                    const firstVariantId = iconDef ? Object.keys(iconDef.variants)[0] : null;
                    const svg =
                      iconDef && firstVariantId
                        ? exportSvgString(iconDef, firstVariantId, firstVariantId, project?.tokenSet?.colors)
                        : '';

                    return (
                      <IconGridItem
                        key={icon.id}
                        iconId={icon.id}
                        iconName={icon.name}
                        svg={svg}
                        active={currentIconId === icon.id}
                        selected={selectedSet.has(icon.id)}
                        favorite={favoritesSet.has(icon.id)}
                        onOpen={() => handleOpenIcon(icon.id)}
                        onSelect={() => {
                          handleOpenIcon(icon.id);
                          clearIconSelection();
                          setSelectedIconIds([icon.id]);
                        }}
                        onShiftClick={() => toggleIconSelection(icon.id)}
                        onToggleFavorite={() => toggleFavorite(icon.id)}
                        onDuplicate={() => editorStore.getState().duplicateIcon(icon.id)}
                        onDelete={() => editorStore.getState().removeIcon(icon.id)}
                        onRename={(nextName) => editorStore.getState().renameIcon(icon.id, nextName)}
                      />
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <button type="button" onClick={toggleListPane} className="flex flex-1 items-start justify-center pt-3" aria-label="Expand icons sidebar">
            <span className="text-[length:var(--text-caption)] font-medium tracking-tight text-muted-foreground [writing-mode:vertical-lr]">Icons</span>
          </button>
        )}

        {/* Hidden file input for SVG import */}
        <input
          ref={importRef}
          type="file"
          accept=".svg,image/svg+xml"
          multiple
          className="sr-only"
          onChange={async (e) => {
            if (e.target.files) await handleSvgFileDrop(e.target.files);
            e.target.value = '';
          }}
        />
      </aside>

      {/* Marquee overlay */}
      {marqueeRect && (
        <div
          className="pointer-events-none fixed z-50 border border-primary/60 bg-primary/10"
          style={{
            left: marqueeRect.left,
            top: marqueeRect.top,
            width: marqueeRect.right - marqueeRect.left,
            height: marqueeRect.bottom - marqueeRect.top,
          }}
        />
      )}

      <ImportIconDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />

      <AlertDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quick ZIP export</AlertDialogTitle>
            <AlertDialogDescription>
              Export {iconCount} icon{iconCount === 1 ? '' : 's'} as an SVG package (.zip).
              For React, Lottie, or full distribution options, open the Contour menu
              &rarr; Export in the top bar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExportAll}>
              <ArrowDownToLine className="size-4" />
              Download ZIP
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
