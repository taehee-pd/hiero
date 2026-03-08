'use client';

import { useRef, useEffect } from 'react';
import { editorStore } from '@/lib/editor-store/store';
import {
  selectCurrentIcon,
  selectCurrentVariant,
  selectCurrentState,
} from '@/lib/editor-store/selectors';
import { renderSvg } from '@/lib/editor-renderer-svg/render-svg';
import { useEditorStore } from '@/lib/editor-store/hooks';
import { useCanvasOverlay } from '@/lib/editor-overlay-canvas/use-overlay';
import { PathEditor } from '@/lib/editor-core';
import { isPathDirectlyEditable, parseSvgPath } from '@/lib/editor-core/parse';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HANDLE_RADIUS_PX = 3;
const HANDLE_STROKE_PX = 1;
const HANDLE_HIT_RADIUS_PX = 9;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 32;

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Subscribe to relevant state for re-render
  const icon = useEditorStore(selectCurrentIcon);
  const variant = useEditorStore(selectCurrentVariant);
  const currentState = useEditorStore(selectCurrentState);
  const viewport = useEditorStore((s) => s.viewport);
  const selection = useEditorStore((s) => s.selection);
  const project = useEditorStore((s) => s.project);
  const tool = useEditorStore((s) => s.tool);
  const activeSnapGuides = useEditorStore((s) => s.activeSnapGuides);

  const activeGuideSet =
    icon && variant?.guideSetId ? icon.guides?.[variant.guideSetId] : undefined;
  const gestureScaleRef = useRef(1);

  // Render SVG geometry when state changes.
  // Always clear stale geometry if the active icon/variant/state becomes unavailable.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    if (!icon || !variant || !currentState) {
      svg.innerHTML = '';
      return;
    }

    renderSvg(
      {
        icon,
        variantId: variant.id,
        stateId: currentState.id,
        tokens: project?.tokenSet?.colors,
      },
      svg,
    );
  }, [icon, variant, currentState, project?.tokenSet?.colors]);

  // Draw direct-select handles on selected layer.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    svg.querySelectorAll('[data-editor-handle="true"]').forEach((el) => el.remove());

    if (tool !== 'direct-select') return;
    const activeLayerId = selection.layerIds[0];
    if (!activeLayerId || !currentState) return;

    const layer = currentState.layers[activeLayerId];
    const d = layer?.path?.d;
    if (!d) return;

    if (!isPathDirectlyEditable(d)) return;

    const zoom = Math.max(viewport.zoom, 0.01);
    const handleRadius = HANDLE_RADIUS_PX / zoom;
    const handleStroke = HANDLE_STROKE_PX / zoom;
    const hitRadius = HANDLE_HIT_RADIUS_PX / zoom;
    const selectedPointKey = selection.pointIds[0] ?? null;

    const editable = parseSvgPath(d);
    editable.subPaths.forEach((subPath, spIndex) => {
      subPath.points.forEach((point, pointIndex) => {
        const pointKey = `${spIndex}:${pointIndex}`;
        const isActive = selectedPointKey === pointKey;

        const hitTarget = document.createElementNS(SVG_NS, 'circle');
        hitTarget.setAttribute('cx', `${point.position.x}`);
        hitTarget.setAttribute('cy', `${point.position.y}`);
        hitTarget.setAttribute('r', `${hitRadius}`);
        hitTarget.setAttribute('fill', 'rgba(0, 0, 0, 0)');
        hitTarget.setAttribute('data-editor-handle', 'true');
        hitTarget.setAttribute('data-layer-id', activeLayerId);
        hitTarget.setAttribute('data-point-key', pointKey);
        hitTarget.setAttribute('data-handle-role', 'hit');
        hitTarget.style.pointerEvents = 'all';
        hitTarget.style.cursor = 'default';
        svg.appendChild(hitTarget);

        const handleOuter = document.createElementNS(SVG_NS, 'circle');
        handleOuter.setAttribute('cx', `${point.position.x}`);
        handleOuter.setAttribute('cy', `${point.position.y}`);
        handleOuter.setAttribute('r', `${handleRadius}`);
        handleOuter.setAttribute('fill', '#ffffff');
        handleOuter.setAttribute('stroke', isActive ? '#10b981' : '#9ca3af');
        handleOuter.setAttribute('stroke-width', `${handleStroke}`);
        handleOuter.setAttribute('data-editor-handle', 'true');
        handleOuter.setAttribute('data-layer-id', activeLayerId);
        handleOuter.setAttribute('data-point-key', pointKey);
        handleOuter.setAttribute('data-handle-role', 'visible');
        handleOuter.style.pointerEvents = 'none';
        svg.appendChild(handleOuter);

      });
    });
  }, [tool, selection.layerIds, selection.pointIds, currentState, viewport.zoom]);

  // Imperative pointer interaction engine.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const editor = new PathEditor(svg);
    return () => editor.destroy();
  }, []);

  // Canvas overlay for selection/guides
  useCanvasOverlay(canvasRef, containerRef, {
    viewport,
    selection,
    layers: currentState?.layers ?? {},
    viewBox: variant?.viewBox ?? [0, 0, 24, 24],
    guideSet: activeGuideSet,
    activeSnapGuides,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const zoomCanvas = (factor: number) => {
      if (!Number.isFinite(factor) || factor <= 0) return;
      const state = editorStore.getState();
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.viewport.zoom * factor));
      if (nextZoom === state.viewport.zoom) return;
      state.setViewport({ zoom: nextZoom });
    };

    const panCanvas = (deltaX: number, deltaY: number) => {
      const state = editorStore.getState();
      state.setViewport({
        panX: state.viewport.panX - deltaX,
        panY: state.viewport.panY - deltaY,
      });
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      if (event.ctrlKey || event.metaKey) {
        zoomCanvas(Math.exp(-event.deltaY * 0.01));
        return;
      }

      panCanvas(event.deltaX, event.deltaY);
    };

    const handleGestureStart = (event: Event) => {
      event.preventDefault();
      gestureScaleRef.current = (event as Event & { scale?: number }).scale ?? 1;
    };

    const handleGestureChange = (event: Event) => {
      event.preventDefault();
      const scale = (event as Event & { scale?: number }).scale ?? gestureScaleRef.current;
      const delta = scale / Math.max(gestureScaleRef.current, 0.0001);
      gestureScaleRef.current = scale;
      zoomCanvas(delta);
    };

    const handleGestureEnd = (event: Event) => {
      event.preventDefault();
      gestureScaleRef.current = 1;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('gesturestart', handleGestureStart as EventListener);
    container.addEventListener('gesturechange', handleGestureChange as EventListener);
    container.addEventListener('gestureend', handleGestureEnd as EventListener);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('gesturestart', handleGestureStart as EventListener);
      container.removeEventListener('gesturechange', handleGestureChange as EventListener);
      container.removeEventListener('gestureend', handleGestureEnd as EventListener);
    };
  }, []);

  // Compute icon positioning
  const vb = variant?.viewBox ?? [0, 0, 24, 24];
  const iconWidth = vb[2];
  const iconHeight = vb[3];
  const scale = viewport.zoom;
  const stageStyle = {
    width: `${iconWidth * scale}px`,
    height: `${iconHeight * scale}px`,
    transform: `translate(${viewport.panX}px, ${viewport.panY}px)`,
  };

  return (
    <div
      ref={containerRef}
      className="workspace-canvas-shell relative flex h-full w-full items-center justify-center rounded-lg"
      data-canvas-root
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
    >
      <div
        className="workspace-canvas-grid pointer-events-none absolute inset-0 opacity-[0.55]"
      />

      {icon && variant && currentState && (
        <div
          className="workspace-stage pointer-events-none absolute rounded-md"
          style={stageStyle}
        />
      )}

      {icon && variant && currentState ? (
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{tool}</span>
          <span>·</span>
          <span>{vb[2]} × {vb[3]}</span>
          <span>·</span>
          <span>{selection.layerIds.length} layers</span>
        </div>
      ) : null}

      <svg
        ref={svgRef}
        className="pointer-events-auto cursor-crosshair"
        style={{
          width: `${iconWidth * scale}px`,
          height: `${iconHeight * scale}px`,
          transform: `translate(${viewport.panX}px, ${viewport.panY}px)`,
          color: 'currentColor',
          filter: 'drop-shadow(0 4px 10px rgba(15, 23, 42, 0.08))',
        }}
        aria-label="Icon canvas"
      />

      {/* Canvas overlay for handles/guides */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      />

      {(!icon || !variant || !currentState) && (
        <div className="workspace-empty-state absolute rounded-md px-6 py-5 text-sm text-muted-foreground">
          No icon selected
        </div>
      )}
    </div>
  );
}
