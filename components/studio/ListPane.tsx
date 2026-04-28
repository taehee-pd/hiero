'use client';

import { Icon as UiIcon } from '@hiero/ui-icons';
import { useCallback, useMemo, useState, useRef } from 'react';

import { IconButton } from '@/components/ds/icon-button';
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
import { useMarqueeSelection } from '@/lib/editor-hooks';
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

  // Marquee drag lifecycle — shared hook from lib/editor-hooks.
  // `gridRef` below owns the query root for hit-testing; the hook
  // uses it via containerRef to find article[data-icon-id] targets.
  //
  // Memoized adapters keep the hook's returned handlers stable across
  // renders. `getCurrentSelection` reads the store imperatively via an
  // empty-dep callback (no closure over selectedIconIds state).
  // `setSelection` is already a stable action from useEditorActions.
  const getCurrentIconSelection = useCallback(
    () => [...editorStore.getState().selectedIconIds],
    [],
  );
  const marquee = useMarqueeSelection({
    itemSelector: 'article[data-icon-id]',
    itemIdAttribute: 'data-icon-id',
    getCurrentSelection: getCurrentIconSelection,
    setSelection: setSelectedIconIds,
    containerRef: gridRef,
  });
  const marqueeRect = marquee.rect;

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

  // Marquee handlers come straight from the hook — Phase 4 Commit 3.
  const handleGridPointerDown = marquee.onPointerDown;
  const handleGridPointerMove = marquee.onPointerMove;
  const handleGridPointerUp = marquee.onPointerUp;
  const handleGridPointerCancel = marquee.onPointerCancel;
  const handleGridLostPointerCapture = marquee.onLostPointerCapture;

  const iconCount = icons.length;
  const selectedCount = selectedIconIds.length;

  if (!activeIconSetId) {
    return (
      <aside
        className={cn(
          'studio-pane flex shrink-0 flex-col border-r border-border/70 transition-[width] duration-200',
          listExpanded ? 'w-[230px]' : 'w-10',
        )}
        style={{ boxShadow: 'var(--shadow-inset-edge)' }}
        role="region"
        aria-label="Icon list"
      >
        <div className={cn('flex h-10 items-center border-b border-border/40', listExpanded ? 'px-2' : 'justify-center')}>
          {listExpanded ? (
            <IconButton icon={<UiIcon name="chevron-left" />} aria-label="Collapse icon list" onClick={toggleListPane} tooltip="Collapse" />
          ) : (
            <IconButton icon={<UiIcon name="chevron-right" />} aria-label="Expand icon list" onClick={toggleListPane} tooltip="Expand" tooltipSide="right" />
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
          'studio-pane flex shrink-0 flex-col border-r border-border/70 transition-[width] duration-200 overflow-hidden',
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
            selectedCount > 0 ? (
              // Selection mode: replace the count text + new/import affordances
              // with a full-width "{n} selected" pill, keep only the bulk
              // download (Quick ZIP) and collapse buttons on the right.
              // Reduces visual noise and focuses the row on the bulk action.
              <>
                <span className="flex h-6 min-w-0 flex-1 items-center rounded-md border border-primary/30 bg-primary/10 px-2 text-[11px] font-medium tabular-nums text-primary">
                  {selectedCount} selected
                </span>
                <IconButton
                  icon={<UiIcon name="arrow-down-to-line" />}
                  aria-label="Download selected as ZIP"
                  onClick={handleOpenExportDialog}
                  tooltip="Download selected as ZIP"
                  className="text-primary hover:bg-primary/10 hover:text-primary"
                />
                <IconButton icon={<UiIcon name="chevron-left" />} aria-label="Collapse icon list" onClick={toggleListPane} tooltip="Collapse" />
              </>
            ) : (
              <>
                <span className="studio-kicker min-w-0 flex-1 truncate px-1">{iconCount} icon{iconCount === 1 ? '' : 's'}</span>
                <IconButton icon={<UiIcon name="plus" />} aria-label="New icon" onClick={handleCreateBlankIcon} tooltip="New icon" />
                <IconButton icon={<UiIcon name="folder-input" />} aria-label="Import icons" onClick={() => setImportDialogOpen(true)} tooltip="Import icons" />
                <IconButton
                  icon={<UiIcon name="arrow-down-to-line" />}
                  aria-label="Quick ZIP export"
                  onClick={handleOpenExportDialog}
                  tooltip="Quick ZIP (SVG package)"
                  className="text-primary hover:bg-primary/10 hover:text-primary"
                />
                <IconButton icon={<UiIcon name="chevron-left" />} aria-label="Collapse icon list" onClick={toggleListPane} tooltip="Collapse" />
              </>
            )
          ) : (
            <IconButton icon={<UiIcon name="chevron-right" />} aria-label="Expand icon list" onClick={toggleListPane} tooltip="Expand" tooltipSide="right" />
          )}
        </div>

        {listExpanded ? (
          <>
            {/* Search */}
            <div className="space-y-1 border-b border-border/40 px-2 py-1.5">
              <div className="relative">
                <UiIcon name="search" size={14} className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  variant="pane"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search icons…"
                  aria-label="Search icons"
                  className={cn('rounded-lg pl-7', query ? 'pr-7' : 'pr-2')}
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <UiIcon name="x" size={12} className="size-3" />
                  </button>
                ) : null}
              </div>
              <p className="px-1 text-[10px] text-muted-foreground">
                Tip: drag SVG files here to import in bulk.
              </p>
            </div>

            {/* Icon grid with marquee support */}
            <ScrollArea
              className="flex-1"
              onPointerDown={handleGridPointerDown}
              onPointerMove={handleGridPointerMove}
              onPointerUp={handleGridPointerUp}
              onPointerCancel={handleGridPointerCancel}
              onLostPointerCapture={handleGridLostPointerCapture}
            >
              <div
                ref={gridRef}
                className="grid select-none grid-cols-3 content-start gap-1 p-2"
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
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCreateBlankIcon}
                          className="rounded-md border border-border/70 bg-background px-2 py-1 text-[10px] font-medium text-foreground transition hover:border-border hover:shadow-[var(--shadow-outline)]"
                        >
                          New icon
                        </button>
                        <button
                          type="button"
                          onClick={() => setImportDialogOpen(true)}
                          className="rounded-md border border-border/70 bg-background px-2 py-1 text-[10px] font-medium text-foreground transition hover:border-border hover:shadow-[var(--shadow-outline)]"
                        >
                          Import SVG
                        </button>
                      </div>
                    )}
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

      {/* Marquee overlay — data-marquee-overlay is a semantic hook
          used by char-marquee-listPane.test.tsx to assert the overlay
          actually unmounts at pointerup. Do not remove. */}
      {marqueeRect && (
        <div
          data-marquee-overlay
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
              For React, Lottie, or full distribution options, open the Hiero menu
              &rarr; Export in the top bar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExportAll}>
              <UiIcon name="arrow-down-to-line" size={16} className="size-4" />
              Download ZIP
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
