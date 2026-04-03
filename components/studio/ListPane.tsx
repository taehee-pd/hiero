'use client';

import { useCallback, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Grid3X3, Import, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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

export function ListPane() {
  const project = useEditorStore((s) => s.project);
  const activeIconSetId = useEditorStore((s) => s.activeIconSetId);
  const currentIconId = useEditorStore((s) => s.currentIconId);
  const favorites = useEditorStore((s) => s.favorites);
  const { createBlankIcon, openIconTab, toggleFavorite } = useEditorActions();

  const [query, setQuery] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

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

  const handleSelectIcon = useCallback(
    (iconId: string) => {
      editorStore.getState().setCurrentIcon(iconId);
      if (activeIconSetId) {
        openIconTab(activeIconSetId, iconId);
      }
    },
    [activeIconSetId, openIconTab],
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
    a.href = url;
    a.download = `${project.meta.name.replace(/\s+/g, '-').toLowerCase()}-svg-package.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [project]);

  const handleSvgFileDrop = useCallback(
    async (files: FileList) => {
      const svgFiles = Array.from(files).filter(isSvgFile);
      for (const file of svgFiles) {
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

  const projectName = project?.meta.name ?? 'Untitled';
  const iconCount = icons.length;

  if (!activeIconSetId) {
    return (
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-border/70 bg-background" role="region" aria-label="Icon list">
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-xs text-muted-foreground">Select a project from the sidebar to view its icons.</p>
        </div>
      </aside>
    );
  }

  return (
    <>
      <aside
        className="flex w-[260px] shrink-0 flex-col border-r border-border/70 bg-background"
        role="region"
        aria-label="Icon list"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length > 0) void handleSvgFileDrop(e.dataTransfer.files);
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">{projectName}</p>
            <p className="text-[10px] text-muted-foreground">{iconCount} icon{iconCount === 1 ? '' : 's'}</p>
          </div>
          <Button variant="ghost" size="icon-sm" className="h-6 w-6 shrink-0 rounded-md" onClick={handleCreateBlankIcon} aria-label="New icon">
            <Plus className="size-3" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="h-6 w-6 shrink-0 rounded-md" onClick={() => setImportDialogOpen(true)} aria-label="Import icons">
            <Import className="size-3" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="h-6 w-6 shrink-0 rounded-md" onClick={handleExportAll} aria-label="Export all as ZIP">
            <Download className="size-3" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative px-2 py-1.5">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search icons…"
            className="h-7 rounded-lg border-border/70 bg-background/60 pl-7 text-xs shadow-none"
          />
        </div>

        {/* Icon list */}
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-3 gap-1 p-2" role="list" aria-label="Icons">
            {filtered.length === 0 ? (
              <p className="col-span-3 py-8 text-center text-xs text-muted-foreground">
                {query ? 'No icons match your search.' : 'No icons yet. Create or import one.'}
              </p>
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
                    activeIconSetId={activeIconSetId}
                    svg={svg}
                    active={currentIconId === icon.id}
                    favorite={favoritesSet.has(icon.id)}
                    onOpen={() => handleSelectIcon(icon.id)}
                    onToggleFavorite={() => toggleFavorite(icon.id)}
                    onToggleSelection={() => handleSelectIcon(icon.id)}
                    onDuplicate={() => editorStore.getState().duplicateIcon(icon.id)}
                    onDelete={() => editorStore.getState().removeIcon(icon.id)}
                  />
                );
              })
            )}
          </div>
        </ScrollArea>

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

      <ImportIconDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
    </>
  );
}
