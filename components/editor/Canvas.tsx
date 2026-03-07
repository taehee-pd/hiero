'use client';

import { useRef, useEffect, useCallback } from 'react';
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

  const activeGuideSet =
    icon && variant?.guideSetId ? icon.guides?.[variant.guideSetId] : undefined;

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
  });

  // ── Zoom via wheel ──────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const state = editorStore.getState();
    const { viewport, setViewport } = state;

    if (e.ctrlKey || e.metaKey) {
      // Pinch-to-zoom
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(32, viewport.zoom * delta));
      setViewport({ zoom: newZoom });
    } else {
      // Pan
      setViewport({
        panX: viewport.panX - e.deltaX,
        panY: viewport.panY - e.deltaY,
      });
    }
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
      className="workspace-canvas-shell relative flex h-full w-full items-center justify-center rounded-[1.45rem]"
      onWheel={handleWheel}
      data-canvas-root
    >
      <div
        className="workspace-canvas-grid pointer-events-none absolute inset-0 opacity-[0.55]"
      />

      {icon && variant && currentState && (
        <div
          className="workspace-stage pointer-events-none absolute rounded-[1.2rem]"
          style={stageStyle}
        />
      )}

      <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap items-center gap-2">
        <div className="workspace-badge bg-background/84 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Canvas
        </div>
        {icon && variant && currentState ? (
          <div className="workspace-badge bg-background/84 text-[10px] tabular-nums text-muted-foreground">
            {vb[2]} x {vb[3]}
          </div>
        ) : null}
      </div>

      {icon && variant && currentState && (
        <div className="pointer-events-none absolute right-4 top-4 max-w-[15rem] rounded-[1.1rem] border border-border/60 bg-background/82 px-3 py-2 text-[11px] leading-5 text-muted-foreground shadow-[0_14px_34px_rgba(15,23,42,0.08)] backdrop-blur-md">
          Scroll to pan. Pinch or hold <span className="font-mono">ctrl</span> to zoom.
        </div>
      )}

      {icon && variant && currentState && (
        <div className="pointer-events-none absolute inset-x-4 bottom-4">
          <div className="workspace-status-strip rounded-[1.35rem] px-3 py-3">
            <div className="relative z-10 flex flex-wrap items-center gap-2">
              <span className="workspace-badge bg-background/82 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {tool.replace('-', ' ')}
              </span>
              <span className="workspace-badge bg-background/82 text-[10px] tabular-nums text-muted-foreground">
                {selection.layerIds.length} layer{selection.layerIds.length === 1 ? '' : 's'}
              </span>
              <span className="workspace-badge bg-background/82 text-[10px] tabular-nums text-muted-foreground">
                {selection.pointIds.length} point{selection.pointIds.length === 1 ? '' : 's'}
              </span>
              <p className="ml-auto text-[11px] leading-5 text-muted-foreground">
                Stage follows the icon viewBox and stays editable at any zoom level.
              </p>
            </div>
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        className="pointer-events-auto cursor-crosshair"
        style={{
          width: `${iconWidth * scale}px`,
          height: `${iconHeight * scale}px`,
          transform: `translate(${viewport.panX}px, ${viewport.panY}px)`,
          color: 'currentColor',
          filter: 'drop-shadow(0 18px 28px rgba(15, 23, 42, 0.12))',
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
        <div className="workspace-empty-state absolute flex flex-col items-center gap-2 rounded-[1.5rem] px-8 py-8 text-muted-foreground">
          <p className="font-display text-2xl tracking-[-0.05em] text-foreground">No icon</p>
          <p className="text-xs">Open or create a document to start editing.</p>
        </div>
      )}
    </div>
  );
}
