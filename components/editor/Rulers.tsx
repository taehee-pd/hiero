'use client';

import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { useEditorActions } from '@/lib/editor-store/hooks';
import type { GuideItem } from '@/lib/schema/types';
import { cn } from '@/lib/utils';

const RULER_SIZE = 24;
const HIT_SIZE = 10;
const TICK_STEPS = [0.5, 1, 2, 4, 5, 10, 12, 16, 20, 24, 32, 48, 64, 96, 128];

type DragState = {
  kind: 'hline' | 'vline';
  mode: 'new' | 'existing';
  index?: number;
  value: number;
};

export function Rulers({
  containerRef,
  currentIconId,
  viewBox,
  viewport,
  guidesVisible,
  guideStyle,
  customGuides,
  selectedGuideIndex,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  currentIconId: string | null;
  viewBox: [number, number, number, number];
  viewport: { zoom: number; panX: number; panY: number };
  guidesVisible: boolean;
  guideStyle: 'subtle' | 'strong';
  customGuides: GuideItem[];
  selectedGuideIndex: number | null;
}) {
  const { addIconGuide, updateIconGuide, setSelectedIconGuideIndex } = useEditorActions();
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [containerRef]);

  const metrics = useMemo(() => {
    const [vx, vy, vw, vh] = viewBox;
    const scale = viewport.zoom;
    const renderWidth = vw * scale;
    const renderHeight = vh * scale;
    const left = containerSize.width / 2 + viewport.panX - renderWidth / 2;
    const top = containerSize.height / 2 + viewport.panY - renderHeight / 2;

    const toScreenX = (value: number) => left + (value - vx) * scale;
    const toScreenY = (value: number) => top + (value - vy) * scale;
    const toSvgX = (screenX: number) =>
      clampValue(vx + (screenX - left) / Math.max(scale, 0.0001), vx, vx + vw);
    const toSvgY = (screenY: number) =>
      clampValue(vy + (screenY - top) / Math.max(scale, 0.0001), vy, vy + vh);

    return {
      vx,
      vy,
      vw,
      vh,
      scale,
      left,
      top,
      toScreenX,
      toScreenY,
      toSvgX,
      toSvgY,
    };
  }, [containerSize.height, containerSize.width, viewBox, viewport.panX, viewport.panY, viewport.zoom]);

  useEffect(() => {
    if (!dragState || !currentIconId) return;

    const handlePointerMove = (event: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const nextValue =
        dragState.kind === 'vline'
          ? metrics.toSvgX(event.clientX - rect.left)
          : metrics.toSvgY(event.clientY - rect.top);
      setDragState((current) => (current ? { ...current, value: nextValue } : current));
    };

    const handlePointerUp = () => {
      if (dragState.mode === 'new') {
        addIconGuide(
          currentIconId,
          dragState.kind === 'vline'
            ? { kind: 'vline', x: dragState.value }
            : { kind: 'hline', y: dragState.value },
        );
      } else if (dragState.index !== undefined) {
        const existingGuide = customGuides[dragState.index];
        if (existingGuide?.kind === 'vline') {
          updateIconGuide(currentIconId, dragState.index, {
            kind: 'vline',
            x: dragState.value,
          });
        } else if (existingGuide?.kind === 'hline') {
          updateIconGuide(currentIconId, dragState.index, {
            kind: 'hline',
            y: dragState.value,
          });
        }
        setSelectedIconGuideIndex(dragState.index);
      }
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [
    addIconGuide,
    containerRef,
    currentIconId,
    customGuides,
    dragState,
    metrics,
    setSelectedIconGuideIndex,
    updateIconGuide,
  ]);

  const horizontalTicks = useMemo(
    () =>
      buildTicks(
        metrics.toSvgX(RULER_SIZE),
        metrics.toSvgX(containerSize.width),
        metrics.scale,
        metrics.toScreenX,
      ),
    [containerSize.width, metrics],
  );
  const verticalTicks = useMemo(
    () =>
      buildTicks(
        metrics.toSvgY(RULER_SIZE),
        metrics.toSvgY(containerSize.height),
        metrics.scale,
        metrics.toScreenY,
      ),
    [containerSize.height, metrics],
  );

  const draggableGuides = customGuides.flatMap((guide, index) =>
    guide.kind === 'hline' || guide.kind === 'vline' ? [{ guide, index }] : [],
  );

  if (!guidesVisible || !currentIconId || containerSize.width <= 0 || containerSize.height <= 0) {
    return null;
  }

  const previewStyle = getGuideLineStyle(guideStyle, true);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      <div className="absolute left-0 top-0 h-6 w-6 border-b border-r border-border/70 bg-background/90 backdrop-blur-sm" />

      <svg
        className="pointer-events-auto absolute left-6 right-0 top-0 h-6 overflow-visible border-b border-border/70 bg-background/90 backdrop-blur-sm"
        onPointerDown={(event) => {
          const container = containerRef.current?.getBoundingClientRect();
          if (!container) return;
          const value = metrics.toSvgX(event.clientX - container.left);
          setDragState({ kind: 'vline', mode: 'new', value });
          event.preventDefault();
        }}
      >
        {horizontalTicks.map((tick) => (
          <g key={`x-${tick.value}`}>
            <line
              x1={tick.screen}
              y1={24}
              x2={tick.screen}
              y2={tick.major ? 8 : 14}
              stroke="rgba(148,163,184,0.55)"
              strokeWidth="1"
            />
            {tick.major ? (
              <text
                x={tick.screen + 3}
                y={10}
                fill="rgba(148,163,184,0.92)"
                fontSize="9"
                fontFamily="ui-monospace, SFMono-Regular, monospace"
              >
                {formatTickValue(tick.value)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>

      <svg
        className="pointer-events-auto absolute bottom-0 left-0 top-6 w-6 overflow-visible border-r border-border/70 bg-background/90 backdrop-blur-sm"
        onPointerDown={(event) => {
          const container = containerRef.current?.getBoundingClientRect();
          if (!container) return;
          const value = metrics.toSvgY(event.clientY - container.top);
          setDragState({ kind: 'hline', mode: 'new', value });
          event.preventDefault();
        }}
      >
        {verticalTicks.map((tick) => (
          <g key={`y-${tick.value}`}>
            <line
              x1={24}
              y1={tick.screen}
              x2={tick.major ? 8 : 14}
              y2={tick.screen}
              stroke="rgba(148,163,184,0.55)"
              strokeWidth="1"
            />
            {tick.major ? (
              <text
                x={10}
                y={tick.screen - 3}
                fill="rgba(148,163,184,0.92)"
                fontSize="9"
                fontFamily="ui-monospace, SFMono-Regular, monospace"
                transform={`rotate(-90 10 ${tick.screen - 3})`}
              >
                {formatTickValue(tick.value)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>

      {draggableGuides.map(({ guide, index }) => {
        const isSelected = selectedGuideIndex === index;
        const style = getGuideLineStyle(guideStyle, isSelected);
        if (guide.kind === 'vline') {
          const x = metrics.toScreenX(guide.x);
          return (
            <button
              key={`guide-v-${index}`}
              type="button"
              className="pointer-events-auto absolute bottom-0 top-6"
              style={{ left: x - HIT_SIZE / 2, width: HIT_SIZE }}
              onPointerDown={(event) => {
                setSelectedIconGuideIndex(index);
                setDragState({ kind: 'vline', mode: 'existing', index, value: guide.x });
                event.preventDefault();
              }}
              aria-label={`Vertical guide ${index + 1}`}
            >
              <span
              className="absolute inset-y-0 left-1/2 -translate-x-1/2"
              style={{
                  width: style.solid ? (isSelected ? 2 : 1) : 0,
                  backgroundColor: style.solid ? style.color : undefined,
                  borderLeft: style.solid ? undefined : `1px dashed ${style.color}`,
              }}
            />
            </button>
          );
        }

        const y = metrics.toScreenY(guide.y);
        return (
          <button
            key={`guide-h-${index}`}
            type="button"
            className="pointer-events-auto absolute left-6 right-0"
            style={{ top: y - HIT_SIZE / 2, height: HIT_SIZE }}
            onPointerDown={(event) => {
              setSelectedIconGuideIndex(index);
              setDragState({ kind: 'hline', mode: 'existing', index, value: guide.y });
              event.preventDefault();
            }}
            aria-label={`Horizontal guide ${index + 1}`}
          >
            <span
              className="absolute left-0 right-0 top-1/2 -translate-y-1/2"
              style={{
                height: style.solid ? (isSelected ? 2 : 1) : 0,
                backgroundColor: style.solid ? style.color : undefined,
                borderTop: style.solid ? undefined : `1px dashed ${style.color}`,
              }}
            />
          </button>
        );
      })}

      {dragState ? (
        dragState.kind === 'vline' ? (
          <div
            className="pointer-events-none absolute bottom-0 top-6"
            style={{
              left: metrics.toScreenX(dragState.value),
              width: 0,
              borderLeft: previewStyle.solid
                ? `2px solid ${previewStyle.color}`
                : `2px dashed ${previewStyle.color}`,
            }}
          />
        ) : (
          <div
            className="pointer-events-none absolute left-6 right-0"
            style={{
              top: metrics.toScreenY(dragState.value),
              height: 0,
              borderTop: previewStyle.solid
                ? `2px solid ${previewStyle.color}`
                : `2px dashed ${previewStyle.color}`,
            }}
          />
        )
      ) : null}
    </div>
  );
}

function buildTicks(
  minValue: number,
  maxValue: number,
  scale: number,
  toScreen: (value: number) => number,
) {
  const step = pickTickStep(scale);
  const majorEvery = step * scale >= 56 ? 2 : 4;
  const start = Math.floor(minValue / step) * step;
  const ticks: Array<{ value: number; screen: number; major: boolean }> = [];

  for (let value = start, index = 0; value <= maxValue + step; value += step, index += 1) {
    ticks.push({
      value: roundValue(value),
      screen: toScreen(value),
      major: index % majorEvery === 0,
    });
  }

  return ticks;
}

function pickTickStep(scale: number) {
  return TICK_STEPS.find((step) => step * scale >= 28) ?? TICK_STEPS[TICK_STEPS.length - 1]!;
}

function roundValue(value: number) {
  return Math.round(value * 1000) / 1000;
}

function formatTickValue(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(value < 10 ? 1 : 0);
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getGuideLineStyle(style: 'subtle' | 'strong', selected: boolean) {
  if (selected) {
    return { color: 'rgba(14,165,233,0.95)', solid: true };
  }

  if (style === 'strong') {
    return { color: 'rgba(148,163,184,0.45)', solid: true };
  }

  return { color: 'rgba(148,163,184,0.18)', solid: false };
}
