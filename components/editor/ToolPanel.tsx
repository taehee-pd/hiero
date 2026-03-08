'use client';

import { useState } from 'react';
import {
  ChevronDown,
  Circle,
  Magnet,
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
import { useEditorStore, useTool, useEditorActions } from '@/lib/editor-store/hooks';
import type { ShapeType, Tool } from '@/lib/editor-store/types';
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

export function ToolPanel({
  guidePanelOpen = false,
}: {
  guidePanelOpen?: boolean;
}) {
  const activeTool = useTool();
  const shapeSubTool = useEditorStore((s) => s.shapeSubTool);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const guidesVisible = useEditorStore((s) => s.guidesVisible);
  const { setShapeSubTool, setTool, toggleSnap, toggleGuidesVisible } = useEditorActions();
  const [shapePickerOpen, setShapePickerOpen] = useState(false);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="px-2 py-1">
        <p className="text-xs font-medium text-muted-foreground">Tools</p>
      </div>
      <div className="grid gap-1">
        {TOOLS.map((tool) => {
          const isGuideEntry = tool.id === 'guide';
          const isActive = isGuideEntry ? guidesVisible : activeTool === tool.id;
          const isShapeTool = tool.id === 'shape';
          const tooltipLabel =
            isShapeTool && isActive
              ? `Shape: ${getShapeSubToolLabel(shapeSubTool)}`
              : isGuideEntry
                ? `Guides ${guidesVisible ? 'on' : 'off'}`
                : tool.label;

          return (
            <div
              key={tool.id}
              className={cn('flex items-center', isShapeTool && isActive && 'gap-1')}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (isGuideEntry) {
                        toggleGuidesVisible();
                        return;
                      }
                      if (!tool.disabled) setTool(tool.id);
                    }}
                    disabled={tool.disabled && !isGuideEntry}
                    aria-label={tooltipLabel}
                    aria-pressed={isActive}
                    data-active={isActive ? 'true' : 'false'}
                    className={cn(
                      'workspace-nav-button h-10 rounded-md px-3 py-2',
                      isShapeTool && isActive && 'rounded-r-sm',
                      tool.disabled && !isGuideEntry && 'opacity-50',
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
                <TooltipContent side="right">
                  {tooltipLabel}
                  {tool.disabled && !isGuideEntry ? (
                    <span className="ml-2 text-[10px] text-muted-foreground">Preset only</span>
                  ) : null}
                </TooltipContent>
              </Tooltip>

              {isShapeTool && isActive ? (
                <Popover open={shapePickerOpen} onOpenChange={setShapePickerOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Choose shape type: ${getShapeSubToolLabel(shapeSubTool)}`}
                          className="h-10 w-8 rounded-l-sm rounded-r-md border border-border bg-background px-0 hover:bg-accent/40"
                        >
                          <ChevronDown className="size-3.5" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="right">Choose shape</TooltipContent>
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
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-3 px-2 py-1">
        <p className="text-xs font-medium text-muted-foreground">Snapping</p>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            onClick={toggleSnap}
            data-active={snapEnabled ? 'true' : 'false'}
            className="workspace-nav-button h-10 rounded-md px-3 py-2"
          >
            <span className="flex items-center gap-2">
              <span className="workspace-tool-button flex size-7 items-center justify-center rounded-md">
                <Magnet className="size-4" />
              </span>
              <span className="text-sm font-medium text-foreground">
                {snapEnabled ? 'Snap On' : 'Snap Off'}
              </span>
            </span>
            <span className="text-[10px] font-mono tracking-[0.08em] text-muted-foreground">
              Cmd/Ctrl+Shift+;
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Toggle snapping</TooltipContent>
      </Tooltip>
      {guidePanelOpen ? (
        <p className="px-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Guides visible: {guidesVisible ? 'yes' : 'no'}
        </p>
      ) : null}
    </div>
  );
}
