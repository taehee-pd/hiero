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
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background text-foreground">
      <Navbar />
      <div className="flex min-h-0 flex-1 bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--primary)_7%,transparent)_0%,transparent_55%)]">
        <NavPane />
        {activeIconSetId && (
          <div className={currentIconId ? 'hidden lg:flex' : 'flex'}>
            <ListPane />
          </div>
        )}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background/80">
          {currentIconId ? (
            <EditorShell initialIconId={currentIconId} embedded />
          ) : (
            <div className="studio-dots flex flex-1 items-center justify-center">
              <div className="rounded-lg border border-border/70 bg-background/80 px-8 py-6 text-center backdrop-blur-sm" style={{ boxShadow: 'var(--shadow-outline)' }}>
                <p className="text-sm font-medium tracking-tight text-muted-foreground">
                  {activeIconSetId ? 'Select an icon to start editing' : 'Select a project to get started'}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
