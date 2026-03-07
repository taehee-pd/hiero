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
    <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Tools</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {TOOLS.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="default"
                  onClick={() => {
                    if (!tool.disabled) setTool(tool.id);
                  }}
                  aria-label={tool.label}
                  aria-pressed={isActive}
                  disabled={tool.disabled}
                  className={cn(
                    'h-14 justify-start rounded-[1.2rem] border border-border/60 px-4 text-left text-muted-foreground',
                    isActive &&
                      'border-primary/45 bg-primary/12 text-primary ring-1 ring-primary/20',
                    tool.disabled && 'opacity-50',
                  )}
                >
                  <tool.icon className="size-4" />
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{tool.label}</span>
                    <span className="rounded-full bg-background/70 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
                      {tool.shortcut}
                    </span>
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {tool.label}
                {tool.disabled && (
                  <span className="ml-2 text-[10px] text-muted-foreground">Preset only</span>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="mt-4 rounded-[1.25rem] border border-border/65 bg-card/75 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Keys</p>
        <ul className="mt-3 space-y-2">
          {VECTOR_SHORTCUTS.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <span>{item.label}</span>
              <span className="rounded-full border border-border/55 bg-background/75 px-2 py-1 font-mono text-[9px]">
                {item.key}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
