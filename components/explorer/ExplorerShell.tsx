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
      <header className="px-4 pt-4 md:px-6 md:pt-6">
        <div className="workspace-header mx-auto flex w-full max-w-[120rem] flex-wrap items-center gap-3 rounded-[1.9rem] px-4 py-4 md:px-5">
          <div className="mr-auto min-w-0">
            <p className="workspace-kicker">Library</p>
            <h1 className="mt-2 truncate font-display text-[2rem] leading-none tracking-[-0.06em]">
              {projectName}
            </h1>
            <p className="mt-2 text-xs text-muted-foreground">
              Curate the icon set here, then jump into the editor for geometry-level work.
            </p>
          </div>

          <div className="relative min-w-[16rem] flex-1 md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-11 rounded-full border-border/70 bg-background/88 pl-10"
            />
          </div>

          <CountChip value={icons.length} label="Total" />
          <CountChip value={filtered.length} label="Shown" />
          <CountChip value={selection.length} label="Picked" active={selection.length > 0} />
        </div>
      </header>

      <main className="workspace-shell mx-auto grid min-h-0 w-full max-w-[120rem] flex-1 grid-cols-1 gap-4 px-4 pb-4 md:px-6 md:pb-6 xl:grid-cols-[17rem_15rem_1fr]">
        <aside className="studio-panel min-h-0 rounded-[2rem] p-3.5 md:p-4">
          <div className="flex h-full flex-col gap-3">
            <div className="workspace-panel-header rounded-[1.45rem] px-3.5 py-3.5">
              <p className="workspace-kicker">Overview</p>
              <p className="mt-2 font-display text-[1.55rem] leading-none tracking-[-0.05em] text-foreground">
                Library control
              </p>
              <div className="workspace-insight-grid mt-4">
                <OverviewMetric label="Icons" value={icons.length} />
                <OverviewMetric label="Categories" value={groups.length} />
                <OverviewMetric label="Visible" value={visibleIcons.length} />
                <OverviewMetric label="Selected" value={selection.length} />
              </div>
            </div>

            <div className="grid gap-2">
              <Button
                className="h-11 rounded-full border border-border/70 bg-foreground text-background hover:bg-foreground/90"
                onClick={() => setSelection(visibleIcons.map((icon) => icon.id))}
              >
                Select visible
              </Button>
              <Button
                className="h-11 rounded-full"
                variant="outline"
                onClick={() => setSelection([])}
              >
                Clear selection
              </Button>
            </div>

            <div className="workspace-meta-card rounded-[1.45rem] p-3.5">
              <p className="workspace-kicker">Recategorize</p>
              <Input
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                placeholder="Category"
                className="mt-3 h-11 rounded-full border-border/70 bg-background/88"
              />
              <Button
                className="mt-2 h-11 w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={assignCategory}
                disabled={selection.length === 0 || !categoryInput.trim()}
              >
                Apply category
              </Button>
            </div>

            <div className="workspace-status-strip mt-auto rounded-[1.45rem] px-3.5 py-4">
              <div className="relative z-10">
                <p className="workspace-kicker">Flow</p>
                <p className="mt-2 text-sm font-medium text-foreground">Curate, batch, then author.</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  This rail handles catalog hygiene. Open an icon card when you need vector editing.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <aside className="studio-panel flex min-h-0 flex-col rounded-[2rem] p-3.5">
          <div className="workspace-panel-header rounded-[1.45rem] px-3.5 py-3.5">
            <p className="workspace-kicker">Categories</p>
            <p className="mt-2 text-sm font-semibold text-foreground">Navigate the catalog</p>
          </div>
          <div className="mt-3 flex-1 overflow-hidden">
            <ScrollArea className="workspace-scroll h-full">
              <div className="grid gap-2 pr-1">
                <CategoryButton
                  label="All icons"
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
            </ScrollArea>
          </div>
        </aside>

        <section className="studio-panel flex min-h-0 flex-col rounded-[2rem] p-3.5">
          <div className="workspace-panel-header rounded-[1.45rem] px-4 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="workspace-kicker">Catalog</p>
                <p className="mt-2 font-display text-[1.45rem] leading-none tracking-[-0.05em] text-foreground">
                  {activeCategory === 'all' ? 'All visible icons' : activeCategory}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Browse the active slice, select icons for batch operations, or jump straight into the editor.
                </p>
              </div>
              <span className="workspace-badge text-[10px] tabular-nums text-muted-foreground">
                {visibleIcons.length}
              </span>
            </div>
          </div>

          {selection.length > 0 ? (
            <div className="workspace-status-strip mt-3 rounded-[1.35rem] px-4 py-3">
              <div className="relative z-10 flex flex-wrap items-center gap-2">
                <span className="workspace-badge bg-background/80 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Selection tray
                </span>
                <p className="text-sm font-medium text-foreground">
                  {selection.length} icon{selection.length === 1 ? '' : 's'} queued for category updates.
                </p>
                <p className="ml-auto text-xs text-muted-foreground">
                  Current target: {categoryInput.trim() || 'unset'}
                </p>
              </div>
            </div>
          ) : null}

          <ScrollArea className="workspace-scroll min-h-0 flex-1 pt-3">
            <div className="space-y-4 px-1 pb-2">
              {visibleIcons.length === 0 ? (
                <div className="workspace-empty-state flex min-h-[20rem] items-center justify-center rounded-[1.6rem]">
                  <p className="text-sm text-muted-foreground">No results</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
                          'studio-card rounded-[1.35rem] p-3',
                          active && 'border-primary/65 bg-primary/10 ring-1 ring-primary/20',
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="workspace-badge min-h-8 px-2.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                            {icon.category || 'uncategorized'}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleSelection(icon.id)}
                            aria-pressed={active}
                            aria-label={active ? `Deselect ${icon.name}` : `Select ${icon.name}`}
                            className={cn(
                              'inline-flex size-8 items-center justify-center rounded-full border transition',
                              active
                                ? 'border-primary/50 bg-primary text-primary-foreground'
                                : 'border-border/65 bg-background/80 text-muted-foreground hover:border-primary/35 hover:text-foreground',
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
                          <div className="studio-preview mb-3 flex aspect-square items-center justify-center rounded-[1.1rem] border border-border/70">
                            {svg ? (
                              <div
                                className="h-14 w-14 text-slate-900 transition-transform duration-200 group-hover:scale-105 dark:text-slate-100"
                                dangerouslySetInnerHTML={{ __html: svg }}
                              />
                            ) : (
                              <Grid3X3 className="size-5 text-muted-foreground" />
                            )}
                          </div>

                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{icon.name}</p>
                              <p className="truncate font-mono text-[11px] text-muted-foreground">{icon.id}</p>
                            </div>
                            <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                          </div>
                        </Link>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </section>
      </main>
    </div>
  );
}

function OverviewMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="workspace-insight-card">
      <p className="workspace-kicker text-[0.58rem]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
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
      className="workspace-nav-button"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium capitalize text-foreground">{label}</span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {count} icon{count === 1 ? '' : 's'}
        </span>
      </span>
      <span className="workspace-badge min-h-8 px-2.5 text-[10px] tabular-nums text-muted-foreground">
        {count}
      </span>
    </button>
  );
}

function CountChip({
  value,
  label,
  active = false,
}: {
  value: number;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      aria-label={`${label} ${value}`}
      className={cn(
        'workspace-badge tabular-nums text-muted-foreground',
        active && 'border-primary/40 bg-primary/10 text-primary',
      )}
    >
      {value}
    </div>
  );
}
