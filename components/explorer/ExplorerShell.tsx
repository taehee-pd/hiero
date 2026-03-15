'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Grid3X3, Heart, Import, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/use-toast';
import { editorStore } from '@/lib/editor-store/store';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import { SAMPLE_PROJECT } from '@/lib/schema/sample-project';
import { exportSvgString } from '@/lib/export/export-svg';
import { clearCurrentProjectPath, showNativeContextMenu } from '@/lib/platform/bridge';
import { buildEditorRoute } from '@/lib/platform/routes';
import { createZipBlob } from '@/lib/export/export-react/zip';
import { createImportedIcon, isSvgFile } from '@/lib/import/import-svg-file';
import { cn } from '@/lib/utils';

export type ExplorerIcon = {
  id: string;
  name: string;
  category?: string;
  tags?: string[];
};

type ActiveFilter =
  | { kind: 'all' }
  | { kind: 'favorites' }
  | { kind: 'category'; id: string }
  | { kind: 'collection'; id: string };

export function filterIconsByQuery(icons: ExplorerIcon[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return icons;

  return icons.filter((icon) => {
    if (icon.name.toLowerCase().includes(normalized)) return true;
    if (icon.id.toLowerCase().includes(normalized)) return true;
    if (icon.category?.toLowerCase().includes(normalized)) return true;
    if (icon.tags?.some((tag) => tag.toLowerCase().includes(normalized))) return true;
    return false;
  });
}

function categorizeIcons(icons: ExplorerIcon[]) {
  const map = new Map<string, ExplorerIcon[]>();
  for (const icon of icons) {
    const key = icon.category || 'uncategorized';
    map.set(key, [...(map.get(key) ?? []), icon]);
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

export function ExplorerShell() {
  const project = useEditorStore((s) => s.project);
  const favorites = useEditorStore((s) => s.favorites);
  const { addCollection, removeCollection, renameCollection, toggleFavorite } = useEditorActions();
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>({ kind: 'all' });
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const state = editorStore.getState();
    if (!state.project) {
      clearCurrentProjectPath();
      state.loadProject(SAMPLE_PROJECT);
    }
  }, []);

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

  const filtered = useMemo(() => filterIconsByQuery(icons, query), [icons, query]);
  const groups = useMemo(() => categorizeIcons(filtered), [filtered]);
  const selectionSet = useMemo(() => new Set(selection), [selection]);
  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);
  const projectName = project?.meta.name ?? 'Icophone';
  const collections = useMemo(
    () => Object.values(project?.collections ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [project?.collections],
  );

  const visibleIcons = useMemo(() => {
    if (activeFilter.kind === 'all') return filtered;
    if (activeFilter.kind === 'favorites') return filtered.filter((icon) => favoritesSet.has(icon.id));
    if (activeFilter.kind === 'category') {
      return filtered.filter((icon) => (icon.category || 'uncategorized') === activeFilter.id);
    }
    const collection = project?.collections?.[activeFilter.id];
    if (!collection) return filtered;
    const include = new Set(collection.iconIds);
    return filtered.filter((icon) => include.has(icon.id));
  }, [activeFilter, favoritesSet, filtered, project?.collections]);

  useEffect(() => {
    if (activeFilter.kind === 'collection') {
      if (!project?.collections?.[activeFilter.id]) setActiveFilter({ kind: 'all' });
    }
  }, [activeFilter, project?.collections]);

  const assignCategory = () => {
    const nextCategory = categoryInput.trim();
    if (!project || !nextCategory || selection.length === 0) return;

    const nextProject = structuredClone(project);
    for (const iconId of selection) {
      const icon = nextProject.icons[iconId];
      if (icon) icon.category = nextCategory;
    }

    editorStore.getState().loadProject(nextProject, { resetHistory: false, markDirty: true });
    setSelection([]);
    setCategoryInput('');
  };

  const toggleSelection = (iconId: string) => {
    setSelection((prev) => (prev.includes(iconId) ? prev.filter((id) => id !== iconId) : [...prev, iconId]));
  };

  const handleImportSvgFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const existingIds = new Set(Object.keys(editorStore.getState().project?.icons ?? {}));
    for (const file of files) {
      if (!isSvgFile(file)) continue;
      try {
        const icon = createImportedIcon(await file.text(), {
          existingIconIds: existingIds,
          sourceName: file.name,
        });
        existingIds.add(icon.id);
        editorStore.getState().insertIcon(icon);
        toast({ title: `Imported ${icon.name}`, description: icon.id });
      } catch (error) {
        toast({
          title: `Failed to import ${file.name}`,
          description: error instanceof Error ? error.message : 'Unknown error.',
          variant: 'destructive',
        });
      }
    }

    event.target.value = '';
  };

  const handleExportSelected = () => {
    if (!project || selection.length === 0) return;
    const files: Record<string, string> = {};
    for (const iconId of selection) {
      const icon = project.icons[iconId];
      if (!icon) continue;
      const variantId = Object.keys(icon.variants)[0];
      const variant = variantId ? icon.variants[variantId] : undefined;
      const stateId = variant?.defaultState;
      if (!variant || !stateId) continue;
      files[`icons/${toKebab(icon.name || icon.id)}.svg`] = exportSvgString(
        icon,
        variant.id,
        stateId,
        project.tokenSet?.colors,
        variant.renderingMode,
      );
    }
    const blob = createZipBlob(files);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.meta.name.replace(/\s+/g, '-').toLowerCase()}-selected-icons.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createCollection = () => {
    const name = prompt('Collection name');
    if (!name?.trim()) return;
    const id = toKebab(name);
    addCollection({ id, name: name.trim(), iconIds: [] });
  };

  const handleCollectionContext = (event: React.MouseEvent, collectionId: string) => {
    event.preventDefault();
    const action = prompt('Type "rename" or "delete"');
    if (action === 'rename') {
      const name = prompt('New collection name');
      if (name?.trim()) renameCollection(collectionId, name.trim());
    } else if (action === 'delete') {
      removeCollection(collectionId);
    }
  };

  return (
    <div className="swift-surface flex h-dvh flex-col overflow-hidden text-foreground">
      <header className="workspace-header mx-3 mb-3 mt-3 rounded-2xl px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="mr-auto min-w-0">
            <p className="truncate text-lg font-semibold tracking-tight text-foreground">{projectName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>library</span>
              <span className="text-border">/</span>
              <span>{icons.length} icons</span>
              {selection.length > 0 ? (
                <>
                  <span className="text-border">/</span>
                  <span>{selection.length} selected</span>
                </>
              ) : null}
            </div>
          </div>
          <div className="relative min-w-[16rem] flex-1 lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search icons"
              className="h-9 rounded-xl border-border/80 bg-background/80 pl-10 shadow-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => importRef.current?.click()}>
              <Import className="size-4" />
              Import SVG
            </Button>
            {selection.length > 0 ? (
              <Button variant="outline" size="sm" className="rounded-xl" onClick={handleExportSelected}>
                Export Selected
              </Button>
            ) : null}
            <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px] font-medium">
              {visibleIcons.length} visible
            </Badge>
          </div>
        </div>
      </header>

      <main className="workspace-shell grid min-h-0 flex-1 grid-cols-1 gap-3 px-3 pb-3 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="studio-panel min-h-0 overflow-hidden rounded-xl p-3">
          <div className="space-y-5">
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filters</h3>
              <div className="grid gap-1.5">
                <CategoryButton label="All" count={filtered.length} active={activeFilter.kind === 'all'} onClick={() => setActiveFilter({ kind: 'all' })} />
                <CategoryButton label="Favorites" count={filtered.filter((icon) => favoritesSet.has(icon.id)).length} active={activeFilter.kind === 'favorites'} onClick={() => setActiveFilter({ kind: 'favorites' })} />
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categories</h3>
              <div className="grid gap-1.5">
                {groups.map(([category, groupIcons]) => (
                  <CategoryButton
                    key={category}
                    label={formatCategoryLabel(category)}
                    count={groupIcons.length}
                    active={activeFilter.kind === 'category' && activeFilter.id === category}
                    onClick={() => setActiveFilter({ kind: 'category', id: category })}
                  />
                ))}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Collections</h3>
                <Button size="sm" variant="outline" className="h-7 rounded-lg px-2 text-xs" onClick={createCollection}>
                  + New Collection
                </Button>
              </div>
              <div className="grid gap-1.5">
                {collections.length === 0 ? <p className="text-xs text-muted-foreground">No collections yet.</p> : null}
                {collections.map((collection) => (
                  <CategoryButton
                    key={collection.id}
                    label={collection.name}
                    count={collection.iconIds.length}
                    active={activeFilter.kind === 'collection' && activeFilter.id === collection.id}
                    onClick={() => setActiveFilter({ kind: 'collection', id: collection.id })}
                    onContextMenu={(event) => handleCollectionContext(event, collection.id)}
                  />
                ))}
              </div>
            </section>

            <section className="space-y-2 rounded-xl border border-border/80 bg-background/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Batch assign category</p>
              <Input value={categoryInput} onChange={(e) => setCategoryInput(e.target.value)} placeholder="e.g. social" />
              <Button size="sm" variant="outline" className="w-full rounded-xl" onClick={assignCategory} disabled={!categoryInput.trim() || selection.length === 0}>
                Assign to selected
              </Button>
            </section>
          </div>
        </aside>

        <section className="studio-panel min-h-0 overflow-hidden rounded-xl">
          <div className="workspace-panel-header flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Icon grid</p>
              <p className="text-xs text-muted-foreground">{visibleIcons.length} shown</p>
            </div>
            {selection.length > 0 ? (
              <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px] font-medium">
                {selection.length} selected
              </Badge>
            ) : null}
          </div>

          <ScrollArea className="workspace-scroll h-full">
            <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visibleIcons.length === 0 ? (
                <div className="workspace-empty-state col-span-full rounded-md px-4 py-10 text-center text-sm text-muted-foreground">
                  No results
                </div>
              ) : null}
              {visibleIcons.map((icon) => {
                const iconDef = project?.icons[icon.id];
                const firstVariantId = iconDef ? Object.keys(iconDef.variants)[0] : null;
                const svg =
                  iconDef && firstVariantId
                    ? exportSvgString(
                        iconDef,
                        firstVariantId,
                        iconDef.variants[firstVariantId]?.defaultState,
                        project?.tokenSet?.colors,
                      )
                    : '';
                const active = selectionSet.has(icon.id);
                const favorite = favoritesSet.has(icon.id);

                return (
                  <article
                    key={icon.id}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      void showNativeContextMenu('explorerIcon', {
                        iconId: icon.id,
                        favorite,
                      });
                    }}
                    className={cn(
                      'studio-card group rounded-2xl bg-card p-3 transition-all duration-150',
                      active && 'border-primary/35 bg-primary/[0.05] shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_26%,transparent)]',
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className="max-w-[10rem] truncate rounded-full border-border/80 bg-background px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
                      >
                        {formatCategoryLabel(icon.category || 'uncategorized')}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => toggleFavorite(icon.id)}
                          aria-label={favorite ? `Unfavorite ${icon.name}` : `Favorite ${icon.name}`}
                          className={cn('rounded-xl border', favorite ? 'border-rose-300 bg-rose-100/70 text-rose-600 dark:border-rose-500/60 dark:bg-rose-500/10 dark:text-rose-300' : 'border-border/80 bg-background text-muted-foreground')}
                        >
                          <Heart className={cn('size-3.5', favorite && 'fill-current')} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => toggleSelection(icon.id)}
                          aria-pressed={active}
                          aria-label={active ? `Deselect ${icon.name}` : `Select ${icon.name}`}
                          className={cn(
                            'rounded-xl border transition',
                            active
                              ? 'border-primary/35 bg-primary/10 text-primary hover:bg-primary/10'
                              : 'border-border/80 bg-background text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground',
                          )}
                        >
                          <Check className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <Link
                      href={buildEditorRoute(icon.id)}
                      onClick={() => editorStore.getState().setCurrentIcon(icon.id)}
                      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      <div className="studio-preview mb-3 flex aspect-square items-center justify-center rounded-[1.25rem] border border-border/80 bg-muted/30 transition group-hover:border-border group-hover:bg-muted/50">
                        {svg ? (
                          <div className="h-14 w-14 text-slate-900 transition-transform duration-150 group-hover:scale-[1.02] dark:text-slate-100" dangerouslySetInnerHTML={{ __html: svg }} />
                        ) : (
                          <Grid3X3 className="size-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{icon.name}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{icon.id}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition group-hover:text-foreground">
                          edit
                          <ArrowUpRight className="size-4 shrink-0" />
                        </span>
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>
          </ScrollArea>
        </section>
      </main>

      <input
        ref={importRef}
        type="file"
        accept=".svg,image/svg+xml"
        multiple
        className="sr-only"
        onChange={handleImportSvgFiles}
        aria-label="Import SVG files"
      />
    </div>
  );
}

function CategoryButton({
  label,
  count,
  active,
  onClick,
  onContextMenu,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      data-active={active ? 'true' : 'false'}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="workspace-nav-button h-10 rounded-xl px-3 py-2"
    >
      <span className="truncate text-sm font-medium text-foreground">{label}</span>
      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{count}</span>
    </button>
  );
}

function formatCategoryLabel(value: string) {
  if (value === 'all') return 'All';
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function toKebab(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
