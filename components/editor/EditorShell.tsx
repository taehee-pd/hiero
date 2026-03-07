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
    <div className="rounded-[1.2rem] border border-border/70 bg-background/78 p-4">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Design
        </p>
        <p className="mt-2 truncate font-display text-2xl leading-none tracking-[-0.05em] text-foreground">
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
      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 gap-3 px-4 pb-4 xl:grid-cols-[4.25rem_18rem_minmax(0,1fr)_21rem] xl:px-5 xl:pb-5">
        <aside className="studio-panel min-h-0 rounded-[1.75rem] p-2 xl:max-h-full">
          <ToolPanel />
        </aside>

        <aside className="studio-panel flex min-h-0 flex-col overflow-hidden rounded-[1.75rem] xl:max-h-full">
          <div className="border-b border-border/55 p-3">
            <ActiveIconHeader />
          </div>
          <div className="min-h-0 flex-1">
            <LayerPanel />
          </div>
        </aside>

        <main className="studio-panel min-h-[22rem] overflow-hidden rounded-[1.75rem] p-3 xl:min-h-0">
          <Canvas />
        </main>

        <aside className="studio-panel flex min-h-0 flex-col overflow-hidden rounded-[1.75rem] xl:max-h-full">
          <div className={cn('min-h-0 flex-1')}>
            <InspectorPanel />
          </div>
        </aside>
      </div>
    </div>
  );
}
