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
  const hasActiveQuery = query.trim().length > 0;
  const resultsTitle =
    activeCategory === 'all'
      ? hasActiveQuery
        ? 'Search results'
        : 'All icons'
      : `${formatCategoryLabel(activeCategory)} icons`;
  const resultsSubtitle = hasActiveQuery
    ? `${visibleIcons.length} shown for "${query.trim()}"`
    : `${visibleIcons.length} shown`;

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
      <header className="workspace-header mx-3 mb-3 mt-3 rounded-2xl px-5 py-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="mr-auto min-w-0 space-y-1">
            <p className="workspace-kicker">Library</p>
            <p className="truncate font-display text-2xl text-foreground">{projectName}</p>
            <p className="text-sm text-muted-foreground">
              Browse, organize, and open icons without splitting counts across the page.
            </p>
          </div>
          <div className="relative min-w-[18rem] flex-1 md:max-w-md">
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

      <main className="workspace-shell grid min-h-0 flex-1 grid-cols-1 gap-3 px-3 pb-3 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="studio-panel min-h-0 overflow-hidden rounded-2xl">
          <div className="workspace-panel-header px-4 py-4">
            <p className="workspace-kicker">Collections</p>
            <p className="mt-2 text-base font-semibold text-foreground">Categories</p>
          </div>
          <div className="flex h-full min-h-0 flex-col gap-4 p-3">
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

            <div className="mt-auto rounded-2xl border border-border/70 bg-background/70 p-3">
              <p className="text-sm font-medium text-foreground">Create or assign category</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Type a category name, then apply it to the selected icons.
              </p>
              <Input
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    assignCategory();
                  }
                }}
                placeholder="e.g. media controls"
                className="mt-3 h-10 rounded-xl border-border bg-background"
              />
              <Button
                variant="default"
                className="mt-3 h-10 w-full rounded-xl"
                onClick={assignCategory}
                disabled={selection.length === 0 || !categoryInput.trim()}
              >
                {selection.length > 0
                  ? `Apply to ${selection.length} selected`
                  : 'Select icons to assign'}
              </Button>
            </div>
          </div>
        </aside>

        <section className="studio-panel min-h-0 overflow-hidden rounded-2xl">
          <div className="workspace-panel-header flex flex-wrap items-end justify-between gap-3 px-4 py-4">
            <div className="space-y-1">
              <p className="workspace-kicker">Showing</p>
              <p className="text-lg font-semibold text-foreground">{resultsTitle}</p>
              <p className="text-sm text-muted-foreground">{resultsSubtitle}</p>
            </div>
            {selection.length > 0 ? (
              <span className="workspace-badge">{selection.length} selected</span>
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
                  iconDef &&
                  firstVariantId &&
                  exportSvgString(
                    iconDef,
                    firstVariantId,
                    Object.keys(iconDef.variants[firstVariantId]?.states ?? {})[0],
                    project?.tokenSet?.colors,
                  );
                const active = selectionSet.has(icon.id);

                return (
                  <article
                    key={icon.id}
                    className={cn(
                      'studio-card group rounded-2xl p-3 transition-all',
                      active && 'border-primary/40 bg-primary/5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_28%,transparent)]',
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      {activeCategory === 'all' ? (
                        <span className="studio-chip truncate border-border/70 bg-background/80 text-muted-foreground">
                          {formatCategoryLabel(icon.category || 'uncategorized')}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">{icon.id}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleSelection(icon.id)}
                        aria-pressed={active}
                        aria-label={active ? `Deselect ${icon.name}` : `Select ${icon.name}`}
                        className={cn(
                          'inline-flex size-8 items-center justify-center rounded-xl border transition',
                          active
                            ? 'border-primary/40 bg-primary/10 text-primary'
                            : 'border-border bg-background text-muted-foreground hover:border-foreground/15 hover:text-foreground',
                        )}
                      >
                        <Check className="size-3.5" />
                      </button>
                    </div>

                    <Link
                      href={`/editor/${icon.id}`}
                      onClick={() => editorStore.getState().setCurrentIcon(icon.id)}
                      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      <div className="studio-preview mb-3 flex aspect-square items-center justify-center rounded-2xl border border-border/70 transition group-hover:border-foreground/12 group-hover:shadow-sm">
                        {svg ? (
                          <div
                            className="h-14 w-14 text-slate-900 transition-transform duration-150 group-hover:scale-[1.03] dark:text-slate-100"
                            dangerouslySetInnerHTML={{ __html: svg }}
                          />
                        ) : (
                          <Grid3X3 className="size-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{icon.name}</p>
                          <p className="truncate text-sm text-muted-foreground">{icon.id}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-sm font-medium uppercase text-muted-foreground transition group-hover:text-foreground">
                          Open
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
      className="workspace-nav-button h-10 rounded-xl px-3 py-2"
    >
      <span className="truncate text-sm text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
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
