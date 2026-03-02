'use client';

import { useEffect } from 'react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { Toolbar } from './Toolbar';
import { ToolPanel } from './ToolPanel';
import { LayerPanel } from './LayerPanel';
import { Canvas } from './Canvas';
import { InspectorPanel } from './InspectorPanel';
import { IconListPanel } from './IconListPanel';
import { editorStore } from '@/lib/editor-store/store';
import { SAMPLE_PROJECT } from '@/lib/schema/sample-project';
import { handleEditorKeyDown } from '@/lib/editor-core/keyboard';

export function EditorShell() {
  // Load sample project on mount so the editor is never empty
  useEffect(() => {
    const state = editorStore.getState();
    if (!state.project) {
      state.loadProject(SAMPLE_PROJECT);
    }
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    window.addEventListener('keydown', handleEditorKeyDown);
    return () => window.removeEventListener('keydown', handleEditorKeyDown);
  }, []);

  return (
    <div className="flex h-dvh w-full flex-col bg-background text-foreground">
      <Toolbar />
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal">
          {/* Left sidebar: tools + icon list + layers */}
          <ResizablePanel
            defaultSize={18}
            minSize={14}
            maxSize={28}
            className="bg-card"
          >
            <div className="flex h-full flex-col">
              <ToolPanel />
              <IconListPanel />
              <LayerPanel />
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Center: canvas */}
          <ResizablePanel defaultSize={60} minSize={35}>
            <Canvas />
          </ResizablePanel>

          <ResizableHandle />

          {/* Right sidebar: inspector */}
          <ResizablePanel
            defaultSize={22}
            minSize={16}
            maxSize={32}
            className="bg-card"
          >
            <InspectorPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
