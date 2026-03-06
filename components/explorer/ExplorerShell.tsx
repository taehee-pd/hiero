'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Grid3X3, Search, Tag } from 'lucide-react';
import { Input } from '@/components/kibo-ui/input';
import { Button } from '@/components/kibo-ui/button';
import { ScrollArea } from '@/components/kibo-ui/scroll-area';
import { editorStore } from '@/lib/editor-store/store';
import { useEditorStore } from '@/lib/editor-store/hooks';
import { SAMPLE_PROJECT } from '@/lib/schema/sample-project';
import { exportSvgString } from '@/lib/export/export-svg';

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

  return (
    <div className="swift-surface flex h-dvh flex-col text-foreground">
      <header className="px-6 py-4">
        <div className="mx-auto flex w-full max-w-[120rem] items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Icon Explorer</h1>
            <p className="text-sm text-muted-foreground">A clean browser for your icon library with quick categorization and one-click edit.</p>
          </div>
          <div className="text-xs font-medium text-muted-foreground">{icons.length} total icons</div>
        </div>
      </header>

      <main className="mx-auto grid min-h-0 w-full max-w-[120rem] flex-1 grid-cols-1 gap-3 px-4 pb-4 md:px-6 lg:grid-cols-[17rem_1fr]">
        <aside className="space-y-3 rounded-3xl bg-card/45 p-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Library</p>
            <p className="mt-1 text-sm text-muted-foreground">{filtered.length} visible · {groups.length} categories</p>
          </div>

          <div className="space-y-2 rounded-2xl bg-background/60 p-2">
            <Button className="w-full" variant="outline" onClick={() => setSelection(filtered.map((i) => i.id))}>
              Select filtered
            </Button>
            <Button className="w-full" variant="ghost" onClick={() => setSelection([])}>
              Clear
            </Button>
            <Input
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value)}
              placeholder="Bulk category"
              className="w-full"
            />
            <Button className="w-full" onClick={assignCategory} disabled={selection.length === 0 || !categoryInput.trim()}>
              Apply category
            </Button>
          </div>

          <div className="rounded-2xl bg-background/50 p-3 text-xs text-muted-foreground">
            Tip: press <span className="rounded bg-muted px-1 py-0.5 font-mono">⌘/Ctrl + K</span> to jump quickly once command palette is added.
          </div>
        </aside>

        <section className="flex min-h-0 flex-col rounded-3xl bg-card/35 p-3">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name, id, category, or tags"
              className="pl-8"
            />
          </div>

          <ScrollArea className="min-h-0 flex-1 rounded-2xl bg-background/40">
          <div className="space-y-6 p-4">
            {groups.map(([category, categoryIcons]) => (
              <section key={category}>
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Tag className="size-4" />
                  <span className="font-medium capitalize">{category}</span>
                  <span>· {categoryIcons.length}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
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
                    const active = selection.includes(icon.id);

                    return (
                      <article key={icon.id} className="rounded-xl border border-border/60 bg-card/70 p-2.5 transition hover:border-primary/30">
                        <label className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={(e) =>
                              setSelection((prev) =>
                                e.target.checked ? [...prev, icon.id] : prev.filter((id) => id !== icon.id),
                              )
                            }
                          />
                          Select
                        </label>
                        <Link
                          href={`/editor/${icon.id}`}
                          onClick={() => editorStore.getState().setCurrentIcon(icon.id)}
                          className="block"
                        >
                          <div className="mb-2 flex aspect-square items-center justify-center rounded-xl border border-border/70 bg-linear-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
                            {svg ? (
                              <div
                                className="h-16 w-16 text-slate-900 dark:text-slate-100"
                                dangerouslySetInnerHTML={{ __html: svg }}
                              />
                            ) : (
                              <Grid3X3 className="size-6 text-muted-foreground" />
                            )}
                          </div>
                          <p className="truncate text-sm font-medium">{icon.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{icon.id}</p>
                        </Link>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          </ScrollArea>
        </section>
      </main>
    </div>
  );
}
