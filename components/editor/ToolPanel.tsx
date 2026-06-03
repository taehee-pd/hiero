'use client';

import { Circle, Icon as UiIcon, Minus, MousePointer2, Move, Pen, Pentagon, Ruler, Square, Star } from '@hiero/ui-icons';
import { memo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEditorActions, useEditorStore, useTool } from '@/lib/editor-store/hooks';
import type { ShapeType, Tool } from '@/lib/editor-store/types';
import { cn } from '@/lib/utils';

type ToolIconComponent = React.ComponentType<
  React.SVGProps<SVGSVGElement> & { className?: string }
>;

// lucide's Move uses only open stroked paths, so fill="currentColor" has no
// visual effect. This custom solid variant is rendered when direct-select is
// active so the toolbar has a filled counterpart for every tool.
const SolidMove: ToolIconComponent = ({ className, ...props }) => (
  <svg
    {...props}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2 15 5 13 5 13 11 19 11 19 9 22 12 19 15 19 13 13 13 13 19 15 19 12 22 9 19 11 19 11 13 5 13 5 15 2 12 5 9 5 11 11 11 11 5 9 5 Z" />
  </svg>
);

const SELECT_TOOLS: Array<{
  id: Tool;
  icon: ToolIconComponent;
  solidIcon: ToolIconComponent;
  label: string;
  shortcut: string;
}> = [
  {
    id: 'select',
    icon: MousePointer2,
    solidIcon: MousePointer2,
    label: 'Select',
    shortcut: 'V',
  },
  {
    id: 'direct-select',
    icon: Move,
    solidIcon: SolidMove,
    label: 'Direct Select',
    shortcut: 'A',
  },
];

const TOOLS: Array<{
  id: Tool;
  icon: ToolIconComponent;
  solidIcon: ToolIconComponent;
  label: string;
  shortcut: string;
  disabled?: boolean;
}> = [
  {
    id: 'select',
    icon: MousePointer2,
    solidIcon: MousePointer2,
    label: 'Select',
    shortcut: 'V',
  },
  { id: 'pen', icon: Pen, solidIcon: Pen, label: 'Pen', shortcut: 'P' },
  { id: 'shape', icon: Square, solidIcon: Square, label: 'Shape', shortcut: 'U' },
  {
    id: 'guide',
    icon: Ruler,
    solidIcon: Ruler,
    label: 'Guide',
    shortcut: 'G',
    disabled: true,
  },
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

export const ToolPanel = memo(function ToolPanel({
  guidePanelOpen = false,
  layout = 'panel',
}: {
  guidePanelOpen?: boolean;
  layout?: 'panel' | 'dock';
}) {
  const activeTool = useTool();
  const shapeSubTool = useEditorStore((s) => s.shapeSubTool);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const guidesVisible = useEditorStore((s) => s.guidesVisible);
  const { setShapeSubTool, setTool, toggleSnap, toggleGuidesVisible } = useEditorActions();
  const [shapePickerOpen, setShapePickerOpen] = useState(false);
  const [selectPickerOpen, setSelectPickerOpen] = useState(false);
  const isDock = layout === 'dock';

  // Determine active select sub-tool
  const isSelectGroup = activeTool === 'select' || activeTool === 'direct-select';
  const activeSelectTool = SELECT_TOOLS.find((t) => t.id === activeTool) ?? SELECT_TOOLS[0]!;

  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        isDock &&
          'flex-row items-center gap-2 rounded-[var(--radius-panel-nav)] border border-[var(--border-level-2)] bg-background p-1.5',
      )}
    >
      {!isDock ? (
        <div className="px-3 py-2">
          <p className="text-[length:var(--text-label)] font-medium text-muted-foreground">Tools</p>
        </div>
      ) : null}

      <div className={cn(isDock ? 'flex items-center gap-2' : 'grid gap-1')}>
        {TOOLS.map((tool) => {
          const isGuideEntry = tool.id === 'guide';
          const isSelectEntry = tool.id === 'select';
          const isActive = isGuideEntry ? guidesVisible : isSelectEntry ? isSelectGroup : activeTool === tool.id;
          const isShapeTool = tool.id === 'shape';
          const tooltipLabel =
            isSelectEntry && isActive
              ? activeSelectTool.label
              : isShapeTool && isActive
                ? `Shape: ${getShapeSubToolLabel(shapeSubTool)}`
                : isGuideEntry
                  ? `Guides ${guidesVisible ? 'on' : 'off'}`
                  : tool.label;

          return (
            <div
              key={tool.id}
              className={cn(
                'flex items-center',
                // Split tools share one outer border/radius; the chevron is an
                // internal segment, not a second rounded button.
                (isShapeTool || isSelectEntry) &&
                  (isDock
                    ? 'gap-1'
                    : 'gap-0 overflow-hidden rounded-[var(--radius-toolbar-action)] border border-border/70 bg-background'),
              )}
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
                      if (isSelectEntry) {
                        setTool(activeSelectTool.id);
                        return;
                      }
                      if (!tool.disabled) setTool(tool.id);
                    }}
                    disabled={tool.disabled && !isGuideEntry}
                    aria-label={tooltipLabel}
                    aria-pressed={isActive}
                    data-active={isActive ? 'true' : 'false'}
                    className={cn(
                      isDock
                        ? 'workspace-tool-button h-11 w-11 rounded-[var(--radius-toolbar-action)] border border-border/70 bg-background/90 px-0'
                        : cn(
                            'workspace-nav-button h-10 px-3 py-2',
                            (isShapeTool || isSelectEntry) && 'rounded-none border-0 shadow-none',
                          ),
                      tool.disabled && !isGuideEntry && 'opacity-50',
                    )}
                  >
                    <span className={cn('flex items-center gap-2', isDock && 'gap-0')}>
                      <span
                        className={cn(
                          'workspace-tool-button flex items-center justify-center rounded-md',
                          isDock ? 'size-8 border-0 bg-transparent' : 'size-7',
                        )}
                      >
                        {(() => {
                        const LineIcon = isSelectEntry
                          ? activeSelectTool.icon
                          : tool.icon;
                        const SolidIcon = isSelectEntry
                          ? activeSelectTool.solidIcon
                          : tool.solidIcon;
                        return isActive ? (
                          <SolidIcon
                            className="size-4"
                            fill="currentColor"
                          />
                        ) : (
                          <LineIcon className="size-4" />
                        );
                      })()}
                      </span>
                      {!isDock ? (
                        <span className="text-sm font-medium text-foreground">
                          {isSelectEntry ? activeSelectTool.label : tool.label}
                        </span>
                      ) : null}
                    </span>
                    {!isDock && tool.disabled && !isGuideEntry ? (
                      <span className="workspace-coming-soon">Soon</span>
                    ) : !isDock ? (
                      <span className="text-[length:var(--text-label)] font-mono text-muted-foreground">
                        {tool.shortcut}
                      </span>
                    ) : null}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {tooltipLabel}
                  {tool.disabled && !isGuideEntry ? (
                    <span className="ml-2 text-[length:var(--text-caption)] text-muted-foreground">Coming Soon</span>
                  ) : null}
                </TooltipContent>
              </Tooltip>

              {isSelectEntry ? (
                <Popover open={selectPickerOpen} onOpenChange={setSelectPickerOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Choose selection tool: ${activeSelectTool.label}`}
                          className={cn(
                            'border border-border bg-background px-0 hover:bg-accent/40',
                            isDock
                              ? 'h-11 w-8 rounded-[var(--radius-toolbar-action)] border-border/70 bg-background/92'
                              : 'h-10 w-8 rounded-none border-0 border-l border-border/70 bg-transparent',
                          )}
                        >
                          <UiIcon name="chevron-down" size={14} className="size-3.5" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="right">Choose selection tool</TooltipContent>
                  </Tooltip>
                  <PopoverContent side="right" align="start" className="w-44 p-2">
                    <div className="grid gap-1">
                      {SELECT_TOOLS.map((selTool) => {
                        const isSelected = selTool.id === activeTool;
                        return (
                          <Button
                            key={selTool.id}
                            type="button"
                            variant={isSelected ? 'secondary' : 'ghost'}
                            size="sm"
                            className="justify-start"
                            onClick={() => {
                              setTool(selTool.id);
                              setSelectPickerOpen(false);
                            }}
                          >
                            <selTool.icon className="size-4" />
                            <span>{selTool.label}</span>
                            <span className="ml-auto text-[length:var(--text-caption)] font-mono text-muted-foreground">
                              {selTool.shortcut}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              ) : null}

              {isShapeTool ? (
                <Popover open={shapePickerOpen} onOpenChange={setShapePickerOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Choose shape type: ${getShapeSubToolLabel(shapeSubTool)}`}
                          className={cn(
                            'border border-border bg-background px-0 hover:bg-accent/40',
                            isDock
                              ? 'h-11 w-8 rounded-[var(--radius-toolbar-action)] border-border/70 bg-background/92'
                              : 'h-10 w-8 rounded-none border-0 border-l border-border/70 bg-transparent',
                          )}
                        >
                          <UiIcon name="chevron-down" size={14} className="size-3.5" />
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

      {!isDock ? (
        <div className="mt-3 px-3 py-2">
          <p className="text-[length:var(--text-label)] font-medium text-muted-foreground">Snapping</p>
        </div>
      ) : (
        <div className="h-8 w-px bg-border/70" />
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            onClick={toggleSnap}
            data-active={snapEnabled ? 'true' : 'false'}
            className={cn(
              isDock
                ? 'workspace-tool-button h-11 w-11 rounded-[var(--radius-toolbar-action)] border border-border/70 bg-background/90 px-0'
                : 'workspace-nav-button h-10 px-3 py-2',
            )}
          >
            <span className={cn('flex items-center gap-2', isDock && 'gap-0')}>
              <span
                className={cn(
                  'workspace-tool-button flex items-center justify-center rounded-md',
                  isDock ? 'size-8 border-0 bg-transparent' : 'size-7',
                )}
              >
                {snapEnabled ? (
                  <UiIcon name="magnet" size={16} className="size-4" />
                ) : (
                  <UiIcon name="magnet" size={16} className="size-4" />
                )}
              </span>
              {!isDock ? (
                <span className="text-sm font-medium text-foreground">
                  {snapEnabled ? 'Snap On' : 'Snap Off'}
                </span>
              ) : null}
            </span>
            {!isDock ? (
              <span className="text-xs font-mono text-muted-foreground">Cmd/Ctrl+Shift+;</span>
            ) : null}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{snapEnabled ? 'Snap on' : 'Snap off'}</TooltipContent>
      </Tooltip>

      {!isDock && guidePanelOpen ? (
        <p className="px-2 text-[length:var(--text-label)] font-medium tracking-tight text-muted-foreground">
          Guides visible: {guidesVisible ? 'yes' : 'no'}
        </p>
      ) : null}
    </div>
  );
});
