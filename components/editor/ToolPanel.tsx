'use client';

import { useState } from 'react';
import {
  ChevronDown,
  Circle,
  Minus,
  MousePointer2,
  Move,
  Pen,
  Pentagon,
  Ruler,
  Square,
  Star,
} from 'lucide-react';
import { Button } from '@/components/kibo-ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/kibo-ui/tooltip';
import { useTool, useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import type { ShapeType, Tool } from '@/lib/editor-store/types';
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

export const SHAPE_SUB_TOOLS: Array<{
  id: ShapeType;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}> = [
  { id: 'rectangle', icon: Square, label: 'Rectangle' },
  { id: 'ellipse', icon: Circle, label: 'Ellipse' },
  { id: 'polygon', icon: Pentagon, label: 'Polygon' },
  { id: 'star', icon: Star, label: 'Star' },
  { id: 'line', icon: Minus, label: 'Line' },
];

export function getShapeSubToolLabel(shapeSubTool: ShapeType): string {
  return SHAPE_SUB_TOOLS.find((shape) => shape.id === shapeSubTool)?.label ?? 'Shape';
}

export function ToolPanel() {
  const activeTool = useTool();
  const shapeSubTool = useEditorStore((s) => s.shapeSubTool);
  const { setShapeSubTool, setTool } = useEditorActions();
  const [shapePickerOpen, setShapePickerOpen] = useState(false);

  return (
    <div className="flex h-full flex-col items-center gap-2 py-1">
      <div className="flex flex-col gap-2">
        {TOOLS.map((tool) => {
          const isActive = activeTool === tool.id;
          const isShapeTool = tool.id === 'shape';
          const tooltipLabel =
            isShapeTool && isActive
              ? `Shape: ${getShapeSubToolLabel(shapeSubTool)}`
              : tool.label;

          const mainButton = (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (!tool.disabled) setTool(tool.id);
              }}
              aria-label={tooltipLabel}
              aria-pressed={isActive}
              disabled={tool.disabled}
              className={cn(
                'size-11 rounded-[1rem] border border-transparent bg-background/58 text-muted-foreground shadow-[0_1px_0_rgba(255,255,255,0.4)]',
                isActive &&
                  'border-primary/45 bg-primary/12 text-primary ring-1 ring-primary/20',
                isShapeTool && isActive && 'rounded-r-[0.5rem]',
                tool.disabled && 'opacity-50',
              )}
            >
              <tool.icon className="size-4" />
            </Button>
          );

          return (
            <div
              key={tool.id}
              className={cn('flex items-center', isShapeTool && isActive && 'gap-1')}
            >
              <Tooltip>
                <TooltipTrigger asChild>{mainButton}</TooltipTrigger>
                <TooltipContent side="right">
                  {tooltipLabel}
                  <span className="ml-2 rounded-full border border-border/50 bg-background/85 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.12em]">
                    {tool.shortcut}
                  </span>
                  {tool.disabled && (
                    <span className="ml-2 text-[10px] text-muted-foreground">Preset only</span>
                  )}
                </TooltipContent>
              </Tooltip>

              {isShapeTool && isActive && (
                <Popover open={shapePickerOpen} onOpenChange={setShapePickerOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Choose shape type: ${getShapeSubToolLabel(shapeSubTool)}`}
                          className="h-11 w-6 rounded-l-[0.5rem] rounded-r-[1rem] border border-primary/35 bg-primary/10 px-1 text-primary ring-1 ring-primary/15"
                        >
                          <ChevronDown className="size-3.5" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Choose shape
                    </TooltipContent>
                  </Tooltip>
                  <PopoverContent side="right" align="start" className="w-44 p-2">
                    <div className="grid gap-1">
                      {SHAPE_SUB_TOOLS.map((shape) => {
                        const isSelected = shape.id === shapeSubTool;
                        return (
                          <Button
                            key={shape.id}
                            type="button"
                            variant={isSelected ? 'secondary' : 'ghost'}
                            size="sm"
                            className="justify-start"
                            onClick={() => {
                              setShapeSubTool(shape.id);
                              setTool('shape');
                              setShapePickerOpen(false);
                            }}
                          >
                            <shape.icon className="size-4" />
                            <span>{shape.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
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
