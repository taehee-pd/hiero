'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Compass, Layers3, MousePointer2, WandSparkles } from 'lucide-react';
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

function SessionDigest() {
  const tool = useEditorStore((s) => s.tool);
  const selection = useEditorStore((s) => s.selection);
  const zoom = useEditorStore((s) => s.viewport.zoom);
  const currentState = useEditorStore((s) =>
    s.currentIconId && s.currentStateId
      ? s.project?.icons[s.currentIconId]?.states[s.currentStateId] ?? null
      : null,
  );

  return (
    <div className="workspace-section-card rounded-[1.6rem] p-4">
      <p className="workspace-kicker">Session pulse</p>
      <div className="mt-3 workspace-insight-grid">
        <DigestItem icon={Compass} label="Zoom" value={`${Math.round(zoom * 100)}%`} />
        <DigestItem icon={MousePointer2} label="Tool" value={tool.replace('-', ' ')} />
        <DigestItem icon={Layers3} label="Layers" value={`${Object.keys(currentState?.layers ?? {}).length}`} />
        <DigestItem icon={WandSparkles} label="Selection" value={`${selection.layerIds.length}`} />
      </div>
    </div>
  );
}

function WorkflowStrip() {
  const steps = [
    { title: 'Frame', copy: 'Choose the icon state and isolate the working layer stack.' },
    { title: 'Shape', copy: 'Edit points or draw fresh geometry with direct select and pen tools.' },
    { title: 'Combine', copy: 'Use boolean ops in the inspector to fuse, subtract, or exclude layers.' },
    { title: 'Ship', copy: 'Export SVG or save the full Icophone document.' },
  ];

  return (
    <div className="workspace-status-strip rounded-[1.75rem] px-4 py-4">
      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-sm">
          <p className="workspace-kicker">Workflow</p>
          <p className="mt-2 font-display text-[1.65rem] leading-none tracking-[-0.06em] text-foreground">
            Path authoring pipeline
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            The canvas stays central while each side rail supports a discrete stage of the edit flow.
          </p>
        </div>
        <div className="grid flex-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="workspace-insight-card relative rounded-[1.15rem]"
            >
              <span className="workspace-kicker text-[0.58rem]">{`0${index + 1}`}</span>
              <p className="mt-2 text-sm font-semibold text-foreground">{step.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DigestItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="workspace-insight-card">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="workspace-kicker text-[0.58rem]">{label}</span>
      </div>
      <p className="mt-3 truncate text-sm font-semibold capitalize text-foreground">{value}</p>
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
      <div className="workspace-shell grid min-h-0 flex-1 grid-cols-1 gap-3 px-4 pb-4 xl:grid-cols-[16rem_20rem_minmax(0,1fr)_22rem] xl:px-5 xl:pb-5">
        <aside className="workspace-column">
          <section className="studio-panel rounded-[2rem] p-3.5">
            <ActiveIconHeader />
          </section>
          <section className="studio-panel flex min-h-0 flex-1 overflow-hidden rounded-[2rem] p-3.5">
            <ToolPanel />
          </section>
          <section className="studio-panel rounded-[2rem] p-3.5">
            <SessionDigest />
          </section>
        </aside>

        <aside className="studio-panel flex min-h-0 flex-col overflow-hidden rounded-[2rem] xl:max-h-full">
          <LayerPanel />
        </aside>

        <main className="workspace-column">
          <section className="studio-panel min-h-[24rem] flex-1 overflow-hidden rounded-[2rem] p-3.5">
            <Canvas />
          </section>
          <WorkflowStrip />
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
