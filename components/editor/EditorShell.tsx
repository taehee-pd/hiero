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
    <div className="rounded-[1.5rem] border border-border/70 bg-background/72 p-4">
      <div className="min-w-0">
        <p className="truncate font-display text-3xl leading-none tracking-[-0.05em] text-foreground">
          {icon?.name ?? 'No icon'}
        </p>
        {icon?.id ? <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">{icon.id}</p> : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {variantId && <span className="studio-chip">{variantId}</span>}
        {stateId && <span className="studio-chip">{stateId}</span>}
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-1 rounded-full border border-border/70 bg-card/85 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-foreground transition hover:border-primary/40 hover:text-primary"
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
      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-4 px-4 pb-4 lg:grid-cols-[19rem_1fr_23rem] lg:px-5 lg:pb-5">
        <aside className="studio-panel min-h-0 space-y-3 overflow-auto rounded-[2rem] p-4 lg:max-h-full">
          <ActiveIconHeader />
          <ToolPanel />
        </aside>

        <main className="studio-panel min-h-[22rem] overflow-hidden rounded-[2rem] p-3 lg:min-h-0">
          <Canvas />
        </main>

        <aside className="studio-panel flex min-h-0 flex-col overflow-hidden rounded-[2rem] lg:max-h-full">
          <div className={cn('max-h-64 border-b border-border/55 lg:max-h-72')}>
            <LayerPanel />
          </div>
          <div className="min-h-0 flex-1">
            <InspectorPanel />
          </div>
        </aside>
      </div>
    </div>
  );
}
