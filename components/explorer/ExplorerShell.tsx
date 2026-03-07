'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Grid3X3, Search } from 'lucide-react';
import { Input } from '@/components/kibo-ui/input';
import { Button } from '@/components/kibo-ui/button';
import { ScrollArea } from '@/components/kibo-ui/scroll-area';
import { editorStore } from '@/lib/editor-store/store';
import { useEditorStore } from '@/lib/editor-store/hooks';
import { SAMPLE_PROJECT } from '@/lib/schema/sample-project';
import { exportSvgString } from '@/lib/export/export-svg';
import { cn } from '@/lib/utils';

export type ExplorerIcon = {
  id: string;
  name: string;
  category?: string;
  tags?: string[];
};

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
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    const state = editorStore.getState();
    if (!state.project) state.loadProject(SAMPLE_PROJECT);
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
  const projectName = project?.meta.name ?? 'Icophone';
  const visibleIcons = useMemo(
    () =>
      activeCategory === 'all'
        ? filtered
        : filtered.filter((icon) => (icon.category || 'uncategorized') === activeCategory),
    [activeCategory, filtered],
  );

  useEffect(() => {
    if (activeCategory === 'all') return;
    if (!groups.some(([category]) => category === activeCategory)) {
      setActiveCategory('all');
    }
  }, [activeCategory, groups]);

  const assignCategory = () => {
    const nextCategory = categoryInput.trim();
    if (!project || !nextCategory || selection.length === 0) return;

    const nextProject = structuredClone(project);
    for (const iconId of selection) {
      const icon = nextProject.icons[iconId];
      if (icon) icon.category = nextCategory;
    }

    editorStore.getState().loadProject(nextProject);
    setSelection([]);
    setCategoryInput('');
  };

  const toggleSelection = (iconId: string) => {
    setSelection((prev) => (prev.includes(iconId) ? prev.filter((id) => id !== iconId) : [...prev, iconId]));
  };

  return (
    <div className="swift-surface flex h-dvh flex-col overflow-hidden text-foreground">
      <header className="workspace-header mx-3 mb-3 mt-3 rounded-xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{projectName}</p>
            <p className="mt-1 text-xs text-muted-foreground">{filtered.length} icons</p>
          </div>
          <div className="relative min-w-[16rem] flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-9 rounded-md border-border bg-background pl-10"
            />
          </div>
        </div>
      </header>

      <main className="workspace-shell grid min-h-0 flex-1 grid-cols-1 gap-3 px-3 pb-3 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="studio-panel min-h-0 overflow-hidden rounded-xl">
          <div className="workspace-panel-header px-4 py-3">
            <p className="text-sm font-medium text-foreground">Categories</p>
          </div>
          <div className="flex h-full min-h-0 flex-col gap-3 p-3">
            <div className="grid gap-1">
              <CategoryButton
                label="All"
                count={filtered.length}
                active={activeCategory === 'all'}
                onClick={() => setActiveCategory('all')}
              />
              {groups.map(([category, categoryIcons]) => (
                <CategoryButton
                  key={category}
                  label={category}
                  count={categoryIcons.length}
                  active={activeCategory === category}
                  onClick={() => setActiveCategory(category)}
                />
              ))}
            </div>

            <div className="mt-auto space-y-2 border-t border-border pt-3">
              <Input
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                placeholder="New category"
                className="h-9 rounded-md border-border bg-background"
              />
              <Button
                variant="outline"
                className="h-9 w-full rounded-md"
                onClick={assignCategory}
                disabled={selection.length === 0 || !categoryInput.trim()}
              >
                Apply to selection
              </Button>
            </div>
          </div>
        </aside>

        <section className="studio-panel min-h-0 overflow-hidden rounded-xl">
          <div className="workspace-panel-header flex items-center justify-between px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              {activeCategory === 'all' ? 'All icons' : activeCategory}
            </p>
            <span className="text-xs text-muted-foreground">
              {visibleIcons.length}
            </span>
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
                const svg =
                  iconDef &&
                  exportSvgString(
                    iconDef,
                    Object.keys(iconDef.variants)[0],
                    Object.keys(iconDef.states)[0],
                    project?.tokenSet?.colors,
                  );
                const active = selectionSet.has(icon.id);

                return (
                  <article
                    key={icon.id}
                    className={cn(
                      'studio-card rounded-lg p-3',
                      active && 'border-foreground/20 bg-foreground/[0.04]',
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="truncate text-[11px] text-muted-foreground">{icon.category || 'uncategorized'}</span>
                      <button
                        type="button"
                        onClick={() => toggleSelection(icon.id)}
                        aria-pressed={active}
                        aria-label={active ? `Deselect ${icon.name}` : `Select ${icon.name}`}
                        className={cn(
                          'inline-flex size-7 items-center justify-center rounded-md border',
                          active
                            ? 'border-foreground/20 bg-foreground/10 text-foreground'
                            : 'border-border bg-background text-muted-foreground',
                        )}
                      >
                        <Check className="size-3.5" />
                      </button>
                    </div>

                    <Link
                      href={`/editor/${icon.id}`}
                      onClick={() => editorStore.getState().setCurrentIcon(icon.id)}
                      className="group block"
                    >
                      <div className="studio-preview mb-3 flex aspect-square items-center justify-center rounded-md border border-border">
                        {svg ? (
                          <div
                            className="h-14 w-14 text-slate-900 dark:text-slate-100"
                            dangerouslySetInnerHTML={{ __html: svg }}
                          />
                        ) : (
                          <Grid3X3 className="size-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{icon.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{icon.id}</p>
                        </div>
                        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>
          </ScrollArea>
        </section>
      </main>
    </div>
  );
}

function CategoryButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-active={active ? 'true' : 'false'}
      onClick={onClick}
      className="workspace-nav-button h-9 rounded-md px-3 py-2"
    >
      <span className="truncate text-sm text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </button>
  );
}
