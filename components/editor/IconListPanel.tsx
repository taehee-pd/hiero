'use client';

import { memo, useMemo, useState } from 'react';
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

type IconListPanelProps = {
  onSelectIcon?: (iconId: string) => void;
};

export const IconListPanel = memo(function IconListPanel({ onSelectIcon }: IconListPanelProps) {
  const icons = useIconList();
  const currentIconId = useEditorStore((s) => s.currentIconId);
  const { setCurrentIcon } = useEditorActions();
  const [query, setQuery] = useState('');

  const filteredIcons = useMemo(() => filterIconsByQuery(icons, query), [icons, query]);

  const handleSelectIcon = (iconId: string) => {
    if (onSelectIcon) {
      onSelectIcon(iconId);
      return;
    }
    setCurrentIcon(iconId);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="workspace-panel-header sticky top-0 z-10 bg-background px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="workspace-kicker text-[length:var(--text-label)]">Icon List</p>
            <p className="mt-1 text-[length:var(--text-heading)] font-semibold text-foreground">Switch Icons</p>
          </div>
          <span className="workspace-badge">{icons.length}</span>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search icons, tags, category"
            className="h-8 rounded-xl border-border/70 bg-background/70 pl-7 text-xs"
            aria-label="Search icons"
          />
        </div>
      </div>

      <ScrollArea className="workspace-scroll flex-1">
        <div className="flex flex-col gap-0.5 p-3">
          {filteredIcons.length === 0 && (
            <div className="workspace-empty-state mx-1 rounded-xl px-3 py-5 text-center text-xs text-muted-foreground">
              <p className="font-medium text-foreground">No matching icons</p>
              <p className="mt-1 text-muted-foreground">Try a name, id, tag, or category.</p>
            </div>
          )}

          {filteredIcons.map((icon) => (
            <button
              key={icon.id}
              onClick={() => handleSelectIcon(icon.id)}
              className={cn(
                'flex items-start gap-2 rounded-xl border border-transparent px-3 py-2 text-left text-sm transition-colors',
                'hover:border-border/70 hover:bg-secondary/50',
                icon.id === currentIconId
                  ? 'border-primary/25 bg-primary/8 text-foreground shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_18%,transparent)]'
                  : 'text-foreground',
              )}
            >
              <Shapes className="mt-0.5 size-3.5 shrink-0 opacity-60" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[length:var(--text-body)] font-medium">{icon.name}</span>
                <span className="block truncate text-[length:var(--text-label)] text-muted-foreground">{icon.id}</span>
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
});
