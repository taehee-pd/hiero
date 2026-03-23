'use client';

import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { editorStore } from '@/lib/editor-store/store';
import { useEditorStore } from '@/lib/editor-store/hooks';
import { buildEditorRoute } from '@/lib/platform/routes';
import { isDesktop } from '@/lib/platform/bridge';
import { cn } from '@/lib/utils';

/**
 * Title-bar tab strip for the Electrobun desktop shell.
 * Renders in the macOS hidden-inset title bar area with traffic-light spacing.
 * In the browser, renders as a slim tab bar without the extra drag region.
 */
export function TitleTabBar({
  onNavigateExplorer,
}: {
  onNavigateExplorer?: () => void;
}) {
  const router = useRouter();
  const openTabs = useEditorStore((s) => s.openTabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const workspace = useEditorStore((s) => s.workspace);
  const desktop = typeof window !== 'undefined' && isDesktop();

  const handleTabClick = (tab: (typeof openTabs)[number]) => {
    editorStore.getState().setCurrentIcon(tab.iconId);
    const route = buildEditorRoute(tab.iconId, tab.iconSetId);
    router.push(route);
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    editorStore.getState().closeIconTab(tabId);
    const state = editorStore.getState();
    if (state.openTabs.length === 0) {
      if (onNavigateExplorer) {
        onNavigateExplorer();
      } else {
        router.push('/');
      }
    }
  };

  const getIconName = (tab: (typeof openTabs)[number]) => {
    const iconSet = workspace?.iconSets[tab.iconSetId];
    const icon = iconSet?.icons[tab.iconId];
    return icon?.name ?? tab.iconId;
  };

  return (
    <div
      className={cn(
        'title-tab-bar electrobun-webkit-app-region-drag flex shrink-0 items-center overflow-x-auto border-b border-[var(--border-separator)] bg-[var(--bg-toolbar)] backdrop-blur-xl backdrop-saturate-150 [scrollbar-width:thin]',
        desktop ? 'h-12 pl-[92px]' : 'h-10 pl-3',
      )}
      style={{ WebkitAppRegion: 'drag', fontFamily: 'var(--font-system)' } as React.CSSProperties}
    >
      {/* Explorer tab (always present) */}
      <button
        type="button"
        onClick={() => {
          if (onNavigateExplorer) {
            onNavigateExplorer();
          } else {
            router.push('/');
          }
        }}
        className={cn(
          'title-tab electrobun-webkit-app-region-no-drag flex h-8 items-center gap-1.5 rounded-t-lg border border-b-0 px-3.5 text-[13px] font-normal transition-colors',
          !activeTabId || openTabs.length === 0
            ? 'border-[var(--border-subtle)] bg-card text-foreground'
            : 'border-transparent bg-transparent text-muted-foreground hover:text-foreground',
        )}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        Projects
      </button>

      {/* Icon tabs */}
      {openTabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={cn(
              'title-tab electrobun-webkit-app-region-no-drag group flex h-8 max-w-[10rem] items-center gap-1.5 rounded-t-lg border border-b-0 px-3.5 text-[13px] font-normal transition-colors',
              isActive
                ? 'border-[var(--border-subtle)] bg-card text-foreground'
                : 'border-transparent bg-transparent text-muted-foreground hover:text-foreground',
            )}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left"
              onClick={() => handleTabClick(tab)}
            >
              {getIconName(tab)}
            </button>
            <button
              type="button"
              tabIndex={0}
              aria-label="Close tab"
              onClick={(e) => handleCloseTab(e, tab.id)}
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                desktop && 'size-5',
                isActive
                  ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  : 'opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground',
              )}
            >
              <X className={cn('size-3', desktop && 'size-3.5')} />
            </button>
          </div>
        );
      })}

      {/* Drag fill */}
      <div className="electrobun-webkit-app-region-drag flex-1" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
    </div>
  );
}
