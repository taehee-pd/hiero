'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Grid3X3, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
            <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px] font-medium">
              {visibleIcons.length} visible
            </Badge>
            {activeCategory !== 'all' ? (
              <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px] font-medium">
                {formatCategoryLabel(activeCategory)}
              </Badge>
            ) : null}
          </div>
        </div>
      </header>

      <main className="workspace-shell grid min-h-0 flex-1 grid-cols-1 gap-3 px-3 pb-3 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="studio-panel min-h-0 overflow-hidden rounded-2xl">
          <div className="workspace-panel-header px-4 py-3">
            <p className="text-sm font-medium text-foreground">Categories</p>
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

            <div className="mt-auto rounded-2xl border border-border/80 bg-background/80 p-3">
              <p className="text-sm font-medium text-foreground">Assign category</p>
              <Input
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    assignCategory();
                  }
                }}
                placeholder="media-controls"
                className="mt-3 h-9 rounded-xl border-border/80 bg-background shadow-none"
              />
              <Button
                variant="outline"
                className="mt-3 h-9 w-full rounded-xl"
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
          <div className="workspace-panel-header flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">{resultsTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{resultsSubtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              {selection.length > 0 ? (
                <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px] font-medium">
                  {selection.length} selected
                </Badge>
              ) : null}
            </div>
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
                      'studio-card group rounded-2xl bg-card p-3 transition-all duration-150',
                      active && 'border-primary/35 bg-primary/[0.05] shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_26%,transparent)]',
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      {activeCategory === 'all' ? (
                        <Badge
                          variant="outline"
                          className="max-w-[10rem] truncate rounded-full border-border/80 bg-background px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
                        >
                          {formatCategoryLabel(icon.category || 'uncategorized')}
                        </Badge>
                      ) : (
                        <span className="truncate text-xs text-muted-foreground">{icon.id}</span>
                      )}
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

                    <Link
                      href={`/editor/${icon.id}`}
                      onClick={() => editorStore.getState().setCurrentIcon(icon.id)}
                      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      <div className="studio-preview mb-3 flex aspect-square items-center justify-center rounded-[1.25rem] border border-border/80 bg-muted/30 transition group-hover:border-border group-hover:bg-muted/50">
                        {svg ? (
                          <div
                            className="h-14 w-14 text-slate-900 transition-transform duration-150 group-hover:scale-[1.02] dark:text-slate-100"
                            dangerouslySetInnerHTML={{ __html: svg }}
                          />
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
