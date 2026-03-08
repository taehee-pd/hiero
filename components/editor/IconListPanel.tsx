'use client';

import { useMemo, useState } from 'react';
import { Search, Shapes } from 'lucide-react';
import { ScrollArea } from '@/components/kibo-ui/scroll-area';
import { Input } from '@/components/kibo-ui/input';
import {
  useIconList,
  useEditorStore,
  useEditorActions,
} from '@/lib/editor-store/hooks';
import { cn } from '@/lib/utils';

export function filterIconsByQuery(
  icons: Array<{ id: string; name: string; tags?: string[]; category?: string }>,
  query: string,
) {
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

export function IconListPanel() {
  const icons = useIconList();
  const currentIconId = useEditorStore((s) => s.currentIconId);
  const { setCurrentIcon } = useEditorActions();
  const [query, setQuery] = useState('');

  const filteredIcons = useMemo(
    () => filterIconsByQuery(icons, query),
    [icons, query],
  );

  return (
    <div className="flex h-full flex-col border-r border-border bg-card/40">
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium uppercase text-muted-foreground">
            Explorer
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {icons.length} icons
          </span>
        </div>

        <div className="mt-2 relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search icons, tags, category"
            className="h-8 pl-7 text-xs"
            aria-label="Search icons"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-1.5">
          {filteredIcons.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No matching icons
            </p>
          )}

          {filteredIcons.map((icon) => (
            <button
              key={icon.id}
              onClick={() => setCurrentIcon(icon.id)}
              className={cn(
                'flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                'hover:bg-secondary/70',
                icon.id === currentIconId
                  ? 'bg-accent/15 text-accent ring-1 ring-accent/30'
                  : 'text-foreground',
              )}
            >
              <Shapes className="mt-0.5 size-3.5 shrink-0 opacity-60" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{icon.name}</span>
                <span className="block truncate text-sm text-muted-foreground">{icon.id}</span>
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
