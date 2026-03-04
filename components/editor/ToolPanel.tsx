'use client';

import { MousePointer2, Move, Pen, Square, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
}> = [
  { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { id: 'direct-select', icon: Move, label: 'Direct Select', shortcut: 'A' },
  { id: 'pen', icon: Pen, label: 'Pen', shortcut: 'P' },
  { id: 'shape', icon: Square, label: 'Shape', shortcut: 'U' },
  { id: 'guide', icon: Ruler, label: 'Guide', shortcut: 'G' },
];

export function ToolPanel() {
  const activeTool = useTool();
  const { setTool } = useEditorActions();

  return (
    <div className="flex flex-col gap-1 border-b border-border p-2">
      <span className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Tools
      </span>
      <div className="flex flex-wrap gap-1">
        {TOOLS.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setTool(tool.id)}
                  aria-label={tool.label}
                  aria-pressed={isActive}
                  className={cn(
                    'text-muted-foreground',
                    isActive &&
                      'bg-accent/20 text-accent ring-1 ring-accent/40',
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
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="mt-2 rounded border border-border/60 bg-muted/20 p-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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
    </div>
  );
}
