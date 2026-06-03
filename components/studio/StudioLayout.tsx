'use client';

import { useEffect, useRef } from 'react';
import { editorStore } from '@/lib/editor-store/store';
import { useEditorStore } from '@/lib/editor-store/hooks';
import { clearCurrentProjectPath } from '@/lib/platform/bridge';
import { setPersistenceProjectId } from '@/lib/persistence/use-persistence';
import { SAMPLE_WORKSPACE } from '@/lib/schema/sample-project';
import { Navbar } from './Navbar';
import { NavPane } from './NavPane';
import { ListPane } from './ListPane';

// Lazy-load EditorShell (heavy component with canvas, path editor, etc.)
import dynamic from 'next/dynamic';
const EditorShell = dynamic(
  () => import('@/components/editor/EditorShell').then((mod) => ({ default: mod.EditorShell })),
  { ssr: false },
);

export function StudioLayout() {
  const workspace = useEditorStore((s) => s.workspace);
  const currentIconId = useEditorStore((s) => s.currentIconId);
  const activeIconSetId = useEditorStore((s) => s.activeIconSetId);
  const urlRestoredRef = useRef(false);

  // Restore pane state from URL query params — runs once after workspace first loads
  useEffect(() => {
    if (!workspace || urlRestoredRef.current) return;
    urlRestoredRef.current = true;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    // Support both new (?project=) and legacy (?set=) URL contracts
    const projectParam = params.get('project') ?? params.get('set');
    const iconParam = params.get('icon');
    if (!projectParam) return;

    const state = editorStore.getState();
    if (workspace.iconSets[projectParam] && state.activeIconSetId !== projectParam) {
      state.setActiveIconSet(projectParam);
    }
    if (iconParam) {
      const updatedState = editorStore.getState();
      if (updatedState.project?.icons[iconParam] && updatedState.currentIconId !== iconParam) {
        updatedState.setCurrentIcon(iconParam);
        if (updatedState.activeIconSetId) {
          updatedState.openIconTab(updatedState.activeIconSetId, iconParam);
        }
      }
    }
  }, [workspace]);

  // Load workspace from IndexedDB or sample on first mount
  useEffect(() => {
    let cancelled = false;
    const state = editorStore.getState();
    if (state.workspace) return;

    void (async () => {
      try {
        const { IndexedDBAdapter } = await import('@/lib/persistence/indexeddb-adapter');
        const adapter = new IndexedDBAdapter();
        const list = await adapter.list();
        if (list.length > 0) {
          const saved = await adapter.load(list[0].id);
          if (saved) {
            if (cancelled || editorStore.getState().workspace) return;
            setPersistenceProjectId(saved.id);
            editorStore.getState().loadWorkspace(saved.data);
            return;
          }
        }
      } catch {
        // IndexedDB unavailable — fall through to sample
      }
      if (cancelled || editorStore.getState().workspace) return;
      clearCurrentProjectPath();
      editorStore.getState().loadWorkspace(SAMPLE_WORKSPACE);
    })();
    return () => { cancelled = true; };
  }, []);

  // Sync URL with pane state (for bookmarkability)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (activeIconSetId) params.set('project', activeIconSetId);
    if (currentIconId) params.set('icon', currentIconId);
    const url = params.toString() ? `?${params.toString()}` : '/';
    window.history.replaceState(null, '', url);
  }, [activeIconSetId, currentIconId]);

  return (
    <>
      {/*
        Small-viewport gate. The studio is a multi-pane vector editor that needs
        a large, pointer-precise screen; the canvas, layer/inspector panels, and
        toolbars don't reflow into a usable phone layout. Rather than ship a
        broken overlap, phones get a clear, on-brand redirect. Pure CSS
        (md:hidden / hidden md:flex) so it's SSR-safe with no hydration flash.
      */}
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-background px-8 pb-[env(safe-area-inset-bottom)] text-center md:hidden">
        <span
          role="img"
          aria-label="Hiero logo"
          className="size-11 bg-foreground"
          style={{
            maskImage: 'url(/hiero.svg?v=5)',
            maskSize: 'contain',
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskImage: 'url(/hiero.svg?v=5)',
            WebkitMaskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
          }}
        />
        <div className="max-w-xs space-y-2">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Hiero is built for a bigger screen
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The icon editor needs the room of a desktop or large tablet for its canvas and
            panels. Open Hiero on a larger display to create and animate icons.
          </p>
        </div>
      </div>

      <div
        data-testid="studio-layout-root"
        className="fixed inset-0 hidden flex-col overflow-hidden bg-background text-foreground md:flex"
      >
        <Navbar />
        <div className="flex min-h-0 flex-1 bg-background">
          <NavPane />
          {activeIconSetId && (
            // Always present at md+ (mobile is gated above). When an icon is open
            // the list collapses to its rail (see openIconTab) rather than hiding,
            // so switching icons stays reachable without a tab strip.
            <div className="flex">
              <ListPane />
            </div>
          )}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
            {currentIconId ? (
              <EditorShell initialIconId={currentIconId} embedded />
            ) : (
              <div className="studio-dots flex flex-1 items-center justify-center">
                <div className="rounded-md border border-border/70 bg-background px-8 py-6 text-center">
                  <p className="text-sm font-medium tracking-tight text-muted-foreground">
                    {activeIconSetId ? 'Select an icon to start editing' : 'Select a project to get started'}
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
