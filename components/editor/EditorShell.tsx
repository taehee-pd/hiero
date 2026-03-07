'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Toolbar } from './Toolbar';
import { ToolPanel } from './ToolPanel';
import { LayerPanel } from './LayerPanel';
import { Canvas } from './Canvas';
import { InspectorPanel } from './InspectorPanel';
import { editorStore } from '@/lib/editor-store/store';
import { SAMPLE_PROJECT } from '@/lib/schema/sample-project';
import { handleEditorKeyDown } from '@/lib/editor-core/keyboard';
import { useEditorStore } from '@/lib/editor-store/hooks';
import { cn } from '@/lib/utils';

function ActiveIconHeader() {
  const icon = useEditorStore((s) =>
    s.currentIconId ? s.project?.icons[s.currentIconId] : null,
  );
  const variantId = useEditorStore((s) => s.currentVariantId);
  const stateId = useEditorStore((s) => s.currentStateId);

  return (
    <div className="workspace-meta-card rounded-[1.5rem] p-4">
      <div className="relative z-10 min-w-0">
        <p className="workspace-kicker">
          Editing Session
        </p>
        <p className="mt-2 truncate font-display text-[2rem] leading-none tracking-[-0.06em] text-foreground">
          {icon?.name ?? 'No icon'}
        </p>
        {icon?.id ? (
          <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">{icon.id}</p>
        ) : null}
      </div>
      <div className="relative z-10 mt-4 flex flex-wrap items-center gap-2">
        {variantId && <span className="studio-chip">{variantId}</span>}
        {stateId && <span className="studio-chip">{stateId}</span>}
        <Link
          href="/"
          className="workspace-badge hover:border-primary/40 hover:text-primary"
        >
          <ChevronLeft className="size-3.5" />
          Back
        </Link>
      </div>
    </div>
  );
}

export function EditorShell({ initialIconId }: { initialIconId?: string }) {
  useEffect(() => {
    const state = editorStore.getState();
    if (!state.project) {
      state.loadProject(SAMPLE_PROJECT);
    }

    if (initialIconId && state.project?.icons[initialIconId]) {
      state.setCurrentIcon(initialIconId);
    }
  }, [initialIconId]);

  useEffect(() => {
    window.addEventListener('keydown', handleEditorKeyDown);
    return () => window.removeEventListener('keydown', handleEditorKeyDown);
  }, []);

  return (
    <div className="swift-surface relative flex h-dvh w-full flex-col overflow-hidden text-foreground">
      <Toolbar />
      <div className="workspace-shell grid min-h-0 flex-1 grid-cols-1 gap-3 px-4 pb-4 xl:grid-cols-[5rem_19rem_minmax(0,1fr)_22rem] xl:px-5 xl:pb-5">
        <aside className="studio-panel min-h-0 rounded-[2rem] p-2.5 xl:max-h-full">
          <ToolPanel />
        </aside>

        <aside className="studio-panel flex min-h-0 flex-col overflow-hidden rounded-[2rem] xl:max-h-full">
          <div className="workspace-panel-header p-3.5">
            <ActiveIconHeader />
          </div>
          <div className="min-h-0 flex-1">
            <LayerPanel />
          </div>
        </aside>

        <main className="studio-panel min-h-[22rem] overflow-hidden rounded-[2rem] p-3.5 xl:min-h-0">
          <Canvas />
        </main>

        <aside className="studio-panel flex min-h-0 flex-col overflow-hidden rounded-[2rem] xl:max-h-full">
          <div className={cn('min-h-0 flex-1')}>
            <InspectorPanel />
          </div>
        </aside>
      </div>
    </div>
  );
}
