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
    <div className="flex h-full flex-col items-center gap-2 py-1">
      <div className="flex flex-col gap-2">
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
                  className={cn(
                    'size-11 rounded-[1rem] border border-transparent bg-background/58 text-muted-foreground shadow-[0_1px_0_rgba(255,255,255,0.4)]',
                    isActive &&
                      'border-primary/45 bg-primary/12 text-primary ring-1 ring-primary/20',
                    tool.disabled && 'opacity-50',
                  )}
                >
                  <tool.icon className="size-4" />
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

      <div className="mt-auto flex flex-col gap-2">
        {VECTOR_SHORTCUTS.slice(0, 3).map((item) => (
          <div
            key={item.key}
            className="flex min-h-8 items-center justify-center rounded-[0.9rem] border border-border/60 bg-background/60 px-2 text-[10px] font-mono text-muted-foreground"
            aria-label={`${item.label}: ${item.key}`}
            title={`${item.label}: ${item.key}`}
          >
            {item.key}
          </div>
        ))}
      </div>
    </div>
  );
}
