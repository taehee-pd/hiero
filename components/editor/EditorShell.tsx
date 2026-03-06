'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Toolbar } from './Toolbar';
import { ToolPanel } from './ToolPanel';
import { LayerPanel } from './LayerPanel';
import { Canvas } from './Canvas';
import { InspectorPanel } from './InspectorPanel';
import { editorStore } from '@/lib/editor-store/store';
import { SAMPLE_PROJECT } from '@/lib/schema/sample-project';
import { handleEditorKeyDown } from '@/lib/editor-core/keyboard';
import { useEditorStore } from '@/lib/editor-store/hooks';

function ActiveIconHeader() {
  const icon = useEditorStore((s) =>
    s.currentIconId ? s.project?.icons[s.currentIconId] : null,
  );
  const variantId = useEditorStore((s) => s.currentVariantId);
  const stateId = useEditorStore((s) => s.currentStateId);

  return (
    <div className="rounded-2xl bg-card/45 p-4">
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-foreground">
          {icon?.name ?? 'No icon selected'}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {icon?.id ?? 'Open icon from Explorer'}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {variantId && <span className="rounded-full bg-background/70 px-2 py-1 text-[10px]">{variantId}</span>}
        {stateId && <span className="rounded-full bg-background/70 px-2 py-1 text-[10px]">{stateId}</span>}
        <Link href="/" className="text-xs font-medium text-primary">
          Back to Explorer
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
    <div className="swift-surface flex h-dvh w-full flex-col text-foreground">
      <Toolbar />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 px-4 pb-4 lg:grid-cols-[17rem_1fr_22rem]">
        <aside className="min-h-0 space-y-3 overflow-auto rounded-3xl bg-card/40 p-3 lg:max-h-full">
          <ActiveIconHeader />
          <ToolPanel />
        </aside>

        <main className="min-h-[22rem] overflow-hidden rounded-3xl bg-card/35 p-2 lg:min-h-0">
          <Canvas />
        </main>

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-3xl bg-card/55 lg:max-h-full">
          <div className="max-h-64 border-b border-border/50 lg:max-h-72">
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
