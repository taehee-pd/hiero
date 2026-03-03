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
import { parseSvgPath } from '@/lib/editor-core/parse';

const SVG_NS = 'http://www.w3.org/2000/svg';

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

  // Render SVG geometry when state changes
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !icon || !variant || !currentState) return;

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

    const editable = parseSvgPath(d);
    editable.subPaths.forEach((subPath, spIndex) => {
      subPath.points.forEach((point, pointIndex) => {
        const handle = document.createElementNS(SVG_NS, 'circle');
        handle.setAttribute('cx', `${point.position.x}`);
        handle.setAttribute('cy', `${point.position.y}`);
        handle.setAttribute('r', '0.45');
        handle.setAttribute('fill', '#22d3ee');
        handle.setAttribute('stroke', '#0f172a');
        handle.setAttribute('stroke-width', '0.1');
        handle.setAttribute('data-editor-handle', 'true');
        handle.setAttribute('data-layer-id', activeLayerId);
        handle.setAttribute('data-point-key', `${spIndex}:${pointIndex}`);
        handle.style.pointerEvents = 'all';
        svg.appendChild(handle);
      });
    });
  }, [tool, selection.layerIds, currentState]);

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
  const iconSize = vb[2]; // viewBox width
  const scale = viewport.zoom;

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-canvas-bg"
      onWheel={handleWheel}
      data-canvas-root
    >
      {/* Checkerboard pattern (CSS) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(45deg, #888 25%, transparent 25%),
            linear-gradient(-45deg, #888 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #888 75%),
            linear-gradient(-45deg, transparent 75%, #888 75%)
          `,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
        }}
      />

      {/* SVG layer (icon geometry) */}
      <svg
        ref={svgRef}
        className="pointer-events-auto cursor-crosshair"
        style={{
          width: `${iconSize * scale}px`,
          height: `${iconSize * scale}px`,
          transform: `translate(${viewport.panX}px, ${viewport.panY}px)`,
          color: '#e2e8f0',
        }}
        aria-label="Icon canvas"
      />

      {/* Canvas overlay for handles/guides */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Empty state */}
      {!icon && (
        <div className="absolute flex flex-col items-center gap-2 text-muted-foreground">
          <p className="text-sm">No icon selected</p>
          <p className="text-xs">Open a project or create a new one</p>
        </div>
      )}
    </div>
  );
}
