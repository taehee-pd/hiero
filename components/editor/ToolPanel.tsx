'use client';

import { MousePointer2, Move, Pen, Square, Ruler } from 'lucide-react';
import { Button } from '@/components/kibo-ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/kibo-ui/tooltip';
import { useTool, useEditorActions } from '@/lib/editor-store/hooks';
import type { Tool } from '@/lib/editor-store/types';
import { cn } from '@/lib/utils';


const VECTOR_SHORTCUTS = [
  { key: 'Delete', label: 'Delete selected point' },
  { key: 'Shift+C', label: 'Toggle corner/smooth point' },
  { key: 'Shift+I', label: 'Insert midpoint after selection' },
  { key: 'Shift+O', label: 'Open/close selected path' },
  { key: 'Arrow', label: 'Nudge selected point (0.5)' },
];

const TOOLS: Array<{
  id: Tool;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut: string;
  disabled?: boolean;
}> = [
  { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { id: 'direct-select', icon: Move, label: 'Direct Select', shortcut: 'A' },
  { id: 'pen', icon: Pen, label: 'Pen', shortcut: 'P' },
  { id: 'shape', icon: Square, label: 'Shape', shortcut: 'U' },
  { id: 'guide', icon: Ruler, label: 'Guide Preset', shortcut: 'G', disabled: true },
];

export function ToolPanel() {
  const activeTool = useTool();
  const { setTool } = useEditorActions();

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="workspace-panel-header rounded-[1.55rem] px-4 py-4">
        <p className="workspace-kicker">Toolkit</p>
        <p className="mt-2 font-display text-[1.6rem] leading-none tracking-[-0.06em] text-foreground">
          Authoring modes
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Choose the interaction model first, then work from the canvas and inspector.
        </p>
      </div>

      <div className="grid gap-2">
        {TOOLS.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (!tool.disabled) setTool(tool.id);
                  }}
                  aria-label={tool.label}
                  aria-pressed={isActive}
                  disabled={tool.disabled}
                  data-active={isActive ? 'true' : 'false'}
                  className={cn(
                    'workspace-nav-button h-auto min-h-[4.25rem] text-muted-foreground',
                    tool.disabled && 'opacity-50',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="workspace-tool-button flex size-11 shrink-0 items-center justify-center rounded-[1rem]">
                      <tool.icon className="size-4" />
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="block text-sm font-semibold text-foreground">{tool.label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {tool.disabled ? 'Guide preset is read-only in this build.' : 'Switch interaction mode'}
                      </span>
                    </span>
                  </div>
                  <span className="rounded-full border border-border/60 bg-background/80 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.12em]">
                    {tool.shortcut}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {tool.label}
                <span className="ml-2 rounded-full border border-border/50 bg-background/85 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.12em]">
                  {tool.shortcut}
                </span>
                {tool.disabled && (
                  <span className="ml-2 text-[10px] text-muted-foreground">Preset only</span>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="workspace-section-card mt-auto rounded-[1.55rem] p-4">
        <p className="workspace-kicker">Vector shortcuts</p>
        <div className="mt-3 grid gap-2">
          {VECTOR_SHORTCUTS.map((item) => (
            <div
              key={item.key}
              className="workspace-insight-card flex items-center justify-between gap-3 rounded-[1rem] px-3 py-2.5"
              aria-label={`${item.label}: ${item.key}`}
              title={`${item.label}: ${item.key}`}
            >
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="rounded-full border border-border/60 bg-background/80 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.12em] text-foreground">
                {item.key}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
