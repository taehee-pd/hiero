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
        <div className="studio-panel mx-auto flex w-full max-w-[120rem] flex-wrap items-center gap-3 rounded-[1.75rem] px-4 py-3 md:px-5">
          <div className="mr-auto min-w-0">
            <h1 className="truncate font-display text-2xl leading-none tracking-[-0.05em]">{projectName}</h1>
          </div>

          <div className="relative min-w-[16rem] flex-1 md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-10 rounded-full border-border/70 bg-background/85 pl-10"
            />
          </div>

          <CountChip value={icons.length} label="Total" />
          <CountChip value={filtered.length} label="Shown" />
          <CountChip value={selection.length} label="Picked" active={selection.length > 0} />
        </div>
      </header>

      <main className="mx-auto grid min-h-0 w-full max-w-[120rem] flex-1 grid-cols-1 gap-4 px-4 pb-4 md:px-6 md:pb-6 xl:grid-cols-[15rem_1fr]">
        <aside className="studio-panel min-h-0 rounded-[1.75rem] p-3 md:p-4">
          <div className="flex h-full flex-col gap-3">
            <div className="flex items-center justify-between rounded-[1.2rem] border border-border/70 bg-background/72 px-3 py-3">
              <span className="text-sm font-medium">Selection</span>
              <span className="rounded-full border border-border/60 bg-card/90 px-2 py-1 text-xs tabular-nums">
                {selection.length}
              </span>
            </div>

            <div className="grid gap-2">
              <Button
                className="h-10 rounded-full border border-border/70 bg-foreground text-background hover:bg-foreground/90"
                onClick={() => setSelection(filtered.map((icon) => icon.id))}
              >
                Select all
              </Button>
              <Button
                className="h-10 rounded-full"
                variant="outline"
                onClick={() => setSelection([])}
              >
                Clear
              </Button>
            </div>

            <div className="mt-1 rounded-[1.2rem] border border-border/70 bg-background/72 p-3">
              <Input
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                placeholder="Category"
                className="h-10 rounded-full border-border/70 bg-background/85"
              />
              <Button
                className="mt-2 h-10 w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={assignCategory}
                disabled={selection.length === 0 || !categoryInput.trim()}
              >
                Apply
              </Button>
            </div>
          </div>
        </aside>

        <section className="studio-panel flex min-h-0 flex-col rounded-[1.75rem] p-3">
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-6 px-1 pb-2">
              {groups.length === 0 ? (
                <div className="flex min-h-[20rem] items-center justify-center rounded-[1.5rem] border border-dashed border-border/70 bg-background/50">
                  <p className="text-sm text-muted-foreground">No results</p>
                </div>
              ) : (
                groups.map(([category, categoryIcons]) => (
                  <section key={category} className="space-y-3">
                    <div className="flex items-center justify-between gap-3 border-b border-border/55 px-1 pb-2">
                      <h2 className="truncate text-sm font-semibold capitalize">{category}</h2>
                      <span className="text-xs tabular-nums text-muted-foreground">{categoryIcons.length}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                      {categoryIcons.map((icon) => {
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
                              'studio-card rounded-[1.2rem] p-2.5',
                              active && 'border-primary/65 bg-primary/10 ring-1 ring-primary/20',
                            )}
                          >
                            <div className="mb-2 flex items-center justify-end">
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
                              <div className="studio-preview mb-2 flex aspect-square items-center justify-center rounded-[1rem] border border-border/70">
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
                  </section>
                ))
              )}
            </div>
          </ScrollArea>
        </section>
      </main>
    </div>
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
        'rounded-full border border-border/70 bg-background/75 px-3 py-2 text-xs font-medium tabular-nums text-muted-foreground',
        active && 'border-primary/40 bg-primary/10 text-primary',
      )}
    >
      {value}
    </div>
  );
}
