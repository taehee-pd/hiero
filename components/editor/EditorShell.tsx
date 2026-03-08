'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Layers2 } from 'lucide-react';
import { Toolbar } from './Toolbar';
import { ToolPanel } from './ToolPanel';
import { LayerPanel } from './LayerPanel';
import { Canvas } from './Canvas';
import { InspectorPanel } from './InspectorPanel';
import { editorStore } from '@/lib/editor-store/store';
import { SAMPLE_PROJECT } from '@/lib/schema/sample-project';
import { handleEditorKeyDown } from '@/lib/editor-core/keyboard';
import { useEditorStore } from '@/lib/editor-store/hooks';

function CurrentDocumentPanel() {
  const icon = useEditorStore((s) =>
    s.currentIconId ? s.project?.icons[s.currentIconId] : null,
  );
  const variantId = useEditorStore((s) => s.currentVariantId);
  const stateId = useEditorStore((s) => s.currentStateId);
  const layerCount = useEditorStore((s) => {
    if (!s.currentIconId || !s.currentStateId) return 0;
    return Object.keys(
      s.project?.icons[s.currentIconId]?.states[s.currentStateId]?.layers ?? {},
    ).length;
  });

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-4">
      <div className="min-w-0 space-y-2">
        <div>
          <p className="workspace-kicker">Current icon</p>
          <p className="truncate text-base font-semibold text-foreground">
            {icon?.name ?? 'No icon selected'}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {[icon?.id, variantId, stateId].filter(Boolean).join(' / ') || 'Select an icon'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="workspace-badge">
            <Layers2 className="size-3.5" />
            {layerCount} layers
          </span>
        </div>
      </div>
      <Link
        href="/"
        className="inline-flex h-9 items-center gap-1 rounded-xl border border-border bg-background px-3 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        Back
      </Link>
    </div>
  );
}

export function EditorShell({ initialIconId }: { initialIconId?: string }) {
  const currentIconId = useEditorStore((s) => s.currentIconId);
  const currentStateId = useEditorStore((s) => s.currentStateId);
  const project = useEditorStore((s) => s.project);
  const selectedLayerIds = useEditorStore((s) => s.selection.layerIds);

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

  useEffect(() => {
    if (!project || !currentIconId || !currentStateId || selectedLayerIds.length > 0) return;
    const layers = project.icons[currentIconId]?.states[currentStateId]?.layers ?? {};
    const nextLayerId =
      Object.values(layers).find((layer) => layer.visible !== false)?.id ??
      Object.keys(layers)[0];
    if (!nextLayerId) return;

    editorStore.getState().setSelection({ layerIds: [nextLayerId], pointIds: [] });
  }, [currentIconId, currentStateId, project, selectedLayerIds.length]);

  return (
    <div className="swift-surface flex h-dvh w-full flex-col overflow-hidden text-foreground">
      <Toolbar />
      <div className="workspace-shell grid min-h-0 flex-1 grid-cols-1 gap-3 px-3 pb-3 lg:grid-cols-[16rem_minmax(0,1fr)_19rem]">
        <aside className="flex min-h-0 flex-col gap-3">
          <section className="studio-panel overflow-hidden rounded-xl">
            <CurrentDocumentPanel />
          </section>
          <section className="studio-panel min-h-0 overflow-hidden rounded-xl p-2">
            <ToolPanel />
          </section>
          <section className="studio-panel min-h-0 flex-1 overflow-hidden rounded-xl">
            <LayerPanel />
          </section>
        </aside>

        <main className="studio-panel min-h-0 overflow-hidden rounded-xl p-3">
          <Canvas />
        </main>

        <aside className="studio-panel min-h-0 overflow-hidden rounded-xl">
          <InspectorPanel />
        </aside>
      </div>
    </div>
  );
}
