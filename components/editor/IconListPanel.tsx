'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useIconList,
  useEditorStore,
  useEditorActions,
} from '@/lib/editor-store/hooks';
import { cn } from '@/lib/utils';

export function IconListPanel() {
  const icons = useIconList();
  const currentIconId = useEditorStore((s) => s.currentIconId);
  const { setCurrentIcon } = useEditorActions();

  if (icons.length === 0) return null;

  return (
    <div className="flex flex-col border-b border-border">
      <span className="px-3 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Icons
      </span>
      <ScrollArea className="max-h-32">
        <div className="flex flex-col gap-0.5 px-1 pb-1">
          {icons.map((icon) => (
            <button
              key={icon.id}
              onClick={() => setCurrentIcon(icon.id)}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                'hover:bg-secondary',
                icon.id === currentIconId
                  ? 'bg-accent/15 text-accent'
                  : 'text-foreground',
              )}
            >
              <span className="size-2 rounded-full bg-current opacity-50" />
              <span className="truncate">{icon.name}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
