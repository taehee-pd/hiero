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
  { id: 'guide', icon: Ruler, label: 'Guide', shortcut: 'G', disabled: true },
];

export function ToolPanel() {
  const activeTool = useTool();
  const { setTool } = useEditorActions();

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="px-2 py-1">
        <p className="text-xs font-medium text-muted-foreground">Tools</p>
      </div>
      <div className="grid gap-1">
        {TOOLS.map((tool) => {
          const isActive = activeTool === tool.id;

          return (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (!tool.disabled) setTool(tool.id);
                  }}
                  disabled={tool.disabled}
                  data-active={isActive ? 'true' : 'false'}
                  className={cn(
                    'workspace-nav-button h-10 rounded-md px-3 py-2',
                    tool.disabled && 'opacity-50',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="workspace-tool-button flex size-7 items-center justify-center rounded-md">
                      <tool.icon className="size-4" />
                    </span>
                    <span className="text-sm font-medium text-foreground">{tool.label}</span>
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
                    {tool.shortcut}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{tool.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
