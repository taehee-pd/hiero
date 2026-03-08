'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useEditorActions } from '@/lib/editor-store/hooks';
import type { GuideItem } from '@/lib/schema/types';

const RULER_SIZE = 24;
const HIT_SIZE = 10;
const DRAG_THRESHOLD_PX = 4;
const TICK_STEPS = [0.5, 1, 2, 4, 5, 10, 12, 16, 20, 24, 32, 48, 64, 96, 128];

type DragState = {
  kind: 'hline' | 'vline';
  source: 'ruler' | 'guide';
  pointerId: number;
  guideIndex: number | null;
  startClientX: number;
  startClientY: number;
  dragging: boolean;
  duplicate: boolean;
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
  const { addIconGuide, updateIconGuide, removeIconGuide, setSelectedIconGuideIndex } =
    useEditorActions();
  const dragSessionRef = useRef<DragState | null>(null);
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

  const getPointerGuideValue = useCallback(
    (kind: DragState['kind'], clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      return kind === 'vline'
        ? metrics.toSvgX(clientX - rect.left)
        : metrics.toSvgY(clientY - rect.top);
    },
    [containerRef, metrics],
  );

  const clearDragSession = useCallback(() => {
    dragSessionRef.current = null;
    setDragState(null);
  }, []);

  const updateDragSession = useCallback(
    (clientX: number, clientY: number, altKey: boolean) => {
      const current = dragSessionRef.current;
      if (!current) return;

      const nextValue = getPointerGuideValue(current.kind, clientX, clientY);
      if (nextValue === null) return;

      const movedEnough =
        Math.abs(clientX - current.startClientX) >= DRAG_THRESHOLD_PX ||
        Math.abs(clientY - current.startClientY) >= DRAG_THRESHOLD_PX;

      const nextState: DragState = {
        ...current,
        value: nextValue,
        dragging: current.dragging || movedEnough,
        duplicate:
          current.source === 'guide' && (current.dragging || movedEnough) ? altKey : false,
      };

      dragSessionRef.current = nextState;
      setDragState(nextState);
    },
    [getPointerGuideValue],
  );

  const commitDragSession = useCallback(
    (session: DragState, event: PointerEvent) => {
      if (!currentIconId) {
        clearDragSession();
        return;
      }

      const releasedOverRuler = isReleasedOverMatchingRuler(
        containerRef.current?.getBoundingClientRect() ?? null,
        session.kind,
        event,
      );

      if (!session.dragging) {
        if (session.source === 'guide' && session.guideIndex !== null) {
          setSelectedIconGuideIndex(session.guideIndex);
        }
        clearDragSession();
        return;
      }

      if (session.source === 'ruler') {
        if (!releasedOverRuler) {
          addIconGuide(
            currentIconId,
            session.kind === 'vline'
              ? { kind: 'vline', x: session.value }
              : { kind: 'hline', y: session.value },
          );
        }
        clearDragSession();
        return;
      }

      if (session.guideIndex === null) {
        clearDragSession();
        return;
      }

      if (session.duplicate) {
        if (!releasedOverRuler) {
          addIconGuide(
            currentIconId,
            session.kind === 'vline'
              ? { kind: 'vline', x: session.value }
              : { kind: 'hline', y: session.value },
          );
        } else {
          setSelectedIconGuideIndex(session.guideIndex);
        }
        clearDragSession();
        return;
      }

      if (releasedOverRuler) {
        removeIconGuide(currentIconId, session.guideIndex);
        clearDragSession();
        return;
      }

      const existingGuide = customGuides[session.guideIndex];
      if (existingGuide?.kind === 'vline') {
        updateIconGuide(currentIconId, session.guideIndex, {
          kind: 'vline',
          x: session.value,
        });
      } else if (existingGuide?.kind === 'hline') {
        updateIconGuide(currentIconId, session.guideIndex, {
          kind: 'hline',
          y: session.value,
        });
      }
      setSelectedIconGuideIndex(session.guideIndex);
      clearDragSession();
    },
    [
      addIconGuide,
      clearDragSession,
      containerRef,
      currentIconId,
      customGuides,
      removeIconGuide,
      setSelectedIconGuideIndex,
      updateIconGuide,
    ],
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const current = dragSessionRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      updateDragSession(event.clientX, event.clientY, event.altKey);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const current = dragSessionRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      commitDragSession(current, event);
    };

    const handlePointerCancel = (event: PointerEvent) => {
      const current = dragSessionRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      clearDragSession();
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!dragSessionRef.current) return;
      updateDragSession(event.clientX, event.clientY, event.altKey);
    };

    const handleMouseUp = (event: MouseEvent) => {
      const current = dragSessionRef.current;
      if (!current) return;
      commitDragSession(current, event as unknown as PointerEvent);
    };

    const handleWindowBlur = () => {
      if (!dragSessionRef.current) return;
      clearDragSession();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [clearDragSession, commitDragSession, updateDragSession]);

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

  const startRulerDrag = useCallback(
    (kind: 'hline' | 'vline', event: React.PointerEvent<SVGSVGElement>) => {
      const value = getPointerGuideValue(kind, event.clientX, event.clientY);
      if (value === null) return;

      const nextState: DragState = {
        kind,
        source: 'ruler',
        pointerId: event.pointerId,
        guideIndex: null,
        startClientX: event.clientX,
        startClientY: event.clientY,
        dragging: false,
        duplicate: false,
        value,
      };

      dragSessionRef.current = nextState;
      setDragState(nextState);
      event.currentTarget.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    },
    [getPointerGuideValue],
  );

  const startGuideDrag = useCallback(
    (
      kind: 'hline' | 'vline',
      index: number,
      value: number,
      event: React.PointerEvent<HTMLButtonElement>,
    ) => {
      setSelectedIconGuideIndex(index);

      const nextState: DragState = {
        kind,
        source: 'guide',
        pointerId: event.pointerId,
        guideIndex: index,
        startClientX: event.clientX,
        startClientY: event.clientY,
        dragging: false,
        duplicate: false,
        value,
      };

      dragSessionRef.current = nextState;
      setDragState(nextState);
      event.currentTarget.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    },
    [setSelectedIconGuideIndex],
  );

  if (!guidesVisible || !currentIconId || containerSize.width <= 0 || containerSize.height <= 0) {
    return null;
  }

  const previewStyle = getGuideLineStyle(guideStyle, true);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      <div className="absolute left-0 top-0 h-6 w-6 border-b border-r border-border/70 bg-background/90 backdrop-blur-sm" />

      <svg
        className="pointer-events-auto absolute left-6 right-0 top-0 h-6 cursor-row-resize overflow-visible border-b border-border/70 bg-background/90 backdrop-blur-sm"
        onPointerDown={(event) => startRulerDrag('hline', event)}
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
        className="pointer-events-auto absolute bottom-0 left-0 top-6 w-6 cursor-col-resize overflow-visible border-r border-border/70 bg-background/90 backdrop-blur-sm"
        onPointerDown={(event) => startRulerDrag('vline', event)}
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
              className="pointer-events-auto absolute bottom-0 top-6 cursor-col-resize"
              style={{ left: x - HIT_SIZE / 2, width: HIT_SIZE }}
              onPointerDown={(event) => startGuideDrag('vline', index, guide.x, event)}
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
            className="pointer-events-auto absolute left-6 right-0 cursor-row-resize"
            style={{ top: y - HIT_SIZE / 2, height: HIT_SIZE }}
            onPointerDown={(event) => startGuideDrag('hline', index, guide.y, event)}
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

      {dragState?.dragging ? (
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

function isReleasedOverMatchingRuler(
  containerRect: DOMRect | null,
  kind: DragState['kind'],
  event: PointerEvent,
) {
  if (!containerRect) return false;
  if (kind === 'hline') {
    return event.clientY <= containerRect.top + RULER_SIZE;
  }
  return event.clientX <= containerRect.left + RULER_SIZE;
}
