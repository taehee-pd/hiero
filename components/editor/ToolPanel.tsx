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
    <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card/45 p-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Tools
      </span>
      <div className="flex flex-wrap gap-1.5">
        {TOOLS.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    if (!tool.disabled) setTool(tool.id);
                  }}
                  aria-label={tool.label}
                  aria-pressed={isActive}
                  disabled={tool.disabled}
                  className={cn(
                    'rounded-xl text-muted-foreground',
                    isActive &&
                      'bg-primary/15 text-primary ring-1 ring-primary/30',
                    tool.disabled && 'opacity-50',
                  )}
                >
                  <tool.icon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {tool.label}
                <span className="ml-2 rounded bg-muted px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
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

      <div className="rounded-lg bg-background/50 p-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Vector Editing
        </p>
        <ul className="mt-1 space-y-1">
          {VECTOR_SHORTCUTS.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span>{item.label}</span>
              <span className="rounded bg-muted px-1 py-0.5 font-mono text-[9px]">
                {item.key}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Guides are reference-only in canvas and should be authored as reusable presets.
      </p>
    </div>
  );
}
