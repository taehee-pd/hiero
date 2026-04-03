'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { editorStore } from '@/lib/editor-store/store';
import {
  selectCurrentIcon,
  selectCurrentGuideMaster,
  selectCurrentVariant,
  selectCurrentState,
} from '@/lib/editor-store/selectors';
import { renderSvg } from '@/lib/editor-renderer-svg/render-svg';
import {
  applyTransitionPreview,
  clearTransitionPreview,
} from '@/lib/editor-renderer-svg/preview-svg';
import { useEditorStore } from '@/lib/editor-store/hooks';
import { useCanvasOverlay } from '@/lib/editor-overlay-canvas/use-overlay';
import { Rulers } from './Rulers';
import { getSelectedPointsBoundingBox, PathEditor } from '@/lib/editor-core';
import { isEditableEventTarget } from '@/lib/editor-core/keyboard';
import { isPathDirectlyEditable, parseSvgPath } from '@/lib/editor-core/parse';
import { importSvgFileIntoEditor, isSvgFile } from '@/lib/import';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HANDLE_RADIUS_PX = 3;
const HANDLE_STROKE_PX = 1;
const HANDLE_HIT_RADIUS_PX = 20;
const CONTROL_HANDLE_SIZE_PX = 6;
const CONTROL_HIT_RADIUS_PX = 14;
const SELECTION_HANDLE_RADIUS_PX = 5;
const SELECTION_HANDLE_HIT_RADIUS_PX = 14;
const ANCHOR_STROKE = '#0ea5e9';
const ANCHOR_FILL = '#ffffff';
const ACTIVE_ANCHOR_STROKE = '#ffffff';
const ACTIVE_ANCHOR_FILL = '#0ea5e9';
const CONTROL_STROKE = '#ffffff';
const CONTROL_FILL = '#0ea5e9';
const CONTROL_LINE = 'rgba(226,232,240,0.9)';
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 32;

function hasSvgDragData(dataTransfer: DataTransfer): boolean {
  if (Array.from(dataTransfer.files).some(isSvgFile)) return true;
  return Array.from(dataTransfer.items).some(
    (item) => item.kind === 'file' && (item.type === 'image/svg+xml' || /\.svg$/i.test(item.getAsFile()?.name ?? '')),
  );
}

export const Canvas = memo(function Canvas({ showStatusHud = true }: { showStatusHud?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionRootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragDepthRef = useRef(0);
  const spacePanEnabledRef = useRef(false);
  const panSessionRef = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null);
  const panDeltaRef = useRef({ x: 0, y: 0 });
  const panFrameRef = useRef<number | null>(null);
  const pinchFrameRef = useRef<number | null>(null);
  const pinchFactorRef = useRef(1);
  const pinchCursorRef = useRef<{ x: number; y: number } | null>(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const [isSpacePanEnabled, setIsSpacePanEnabled] = useState(false);
  const [isDragPanning, setIsDragPanning] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const lastAutoFitTargetRef = useRef<string | null>(null);

  // Subscribe to relevant state for re-render
  const icon = useEditorStore(selectCurrentIcon);
  const variant = useEditorStore(selectCurrentVariant);
  const currentState = useEditorStore(selectCurrentState);
  const activeGuideMaster = useEditorStore(selectCurrentGuideMaster);
  const viewport = useEditorStore((s) => s.viewport);
  const selection = useEditorStore((s) => s.selection);
  const project = useEditorStore((s) => s.project);
  const tool = useEditorStore((s) => s.tool);
  const pointMarquee = useEditorStore((s) => s.pointMarquee);
  const pointTransformLabel = useEditorStore((s) => s.pointTransformLabel);
  const pendingPenHandle = useEditorStore((s) => s.pendingPenHandle);
  const activeSnapGuides = useEditorStore((s) => s.activeSnapGuides);
  const guidesVisible = useEditorStore((s) => s.guidesVisible);
  const guideStyle = useEditorStore((s) => s.guideStyle);
  const selectedIconGuideIndex = useEditorStore((s) => s.selectedIconGuideIndex);
  const renderingMode = useEditorStore((s) => s.renderingMode);
  const transitionPreview = useEditorStore((s) => s.transitionPreview);
  const activeGuideSet = activeGuideMaster
    ? {
        id: activeGuideMaster.id,
        items: activeGuideMaster.items,
        viewBox: activeGuideMaster.viewBox,
      }
    : undefined;
  const pointBBox = useEditorStore(() => {
    if (tool !== 'direct-select' || pointMarquee) return null;
    const bbox = getSelectedPointsBoundingBox();
    if (!bbox) return null;
    return {
      minX: bbox.minX,
      minY: bbox.minY,
      maxX: bbox.maxX,
      maxY: bbox.maxY,
    };
  });
  const gestureScaleRef = useRef(1);

  const flushPanDelta = useCallback(() => {
    panFrameRef.current = null;
    const { x, y } = panDeltaRef.current;
    panDeltaRef.current = { x: 0, y: 0 };
    if (x === 0 && y === 0) return;
    const state = editorStore.getState();
    state.setViewport({
      panX: state.viewport.panX + x,
      panY: state.viewport.panY + y,
    });
  }, []);

  const queuePanDelta = useCallback((deltaX: number, deltaY: number) => {
    panDeltaRef.current = {
      x: panDeltaRef.current.x + deltaX,
      y: panDeltaRef.current.y + deltaY,
    };
    if (panFrameRef.current !== null) return;
    panFrameRef.current = requestAnimationFrame(() => {
      flushPanDelta();
    });
  }, [flushPanDelta]);

  const flushPinchZoom = useCallback(() => {
    pinchFrameRef.current = null;
    const factor = pinchFactorRef.current;
    const cursor = pinchCursorRef.current;
    pinchFactorRef.current = 1;
    pinchCursorRef.current = null;
    if (!Number.isFinite(factor) || factor <= 0 || !cursor) return;

    const container = containerRef.current;
    if (!container) return;

    const state = editorStore.getState();
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.viewport.zoom * factor));
    if (nextZoom === state.viewport.zoom) return;

    const rect = container.getBoundingClientRect();
    const cursorX = cursor.x - rect.left - rect.width / 2;
    const cursorY = cursor.y - rect.top - rect.height / 2;
    const scaleFactor = nextZoom / state.viewport.zoom;
    state.setViewport({
      zoom: nextZoom,
      panX: cursorX - scaleFactor * (cursorX - state.viewport.panX),
      panY: cursorY - scaleFactor * (cursorY - state.viewport.panY),
    });
  }, []);

  const queuePinchZoom = useCallback((factor: number, clientX: number, clientY: number) => {
    if (!Number.isFinite(factor) || factor <= 0) return;
    pinchFactorRef.current *= factor;
    pinchCursorRef.current = { x: clientX, y: clientY };
    if (pinchFrameRef.current !== null) return;
    pinchFrameRef.current = requestAnimationFrame(() => {
      flushPinchZoom();
    });
  }, [flushPinchZoom]);

  const fitCanvasToView = useCallback(() => {
    const container = containerRef.current;
    if (!container || !variant) return;

    const [_, __, width, height] = variant.viewBox;
    if (width <= 0 || height <= 0) return;

    const horizontalPadding = 112;
    const verticalPadding = 120;
    const nextZoom = Math.max(
      MIN_ZOOM,
      Math.min(
        MAX_ZOOM,
        Math.min(
          (container.clientWidth - horizontalPadding) / width,
          (container.clientHeight - verticalPadding) / height,
        ),
      ),
    );
    if (!Number.isFinite(nextZoom)) return;

    const state = editorStore.getState();
    const roundedZoom = Math.round(nextZoom * 100) / 100;
    state.setViewport({ zoom: roundedZoom, panX: 0, panY: 0 });
  }, [variant]);

  const autoFitTargetKey = icon && variant ? `${icon.id}:${variant.id}:${variant.viewBox.join(',')}` : null;

  const handleSvgDrop = useCallback(async (file: File) => {
    try {
      await importSvgFileIntoEditor(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import SVG file.';
      setImportError(message);
      setTimeout(() => setImportError(null), 3000);
    }
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!hasSvgDragData(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDropActive(true);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!hasSvgDragData(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (!isDropActive) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDropActive(false);
    }
  }, [isDropActive]);

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDropActive(false);
      const file = Array.from(event.dataTransfer.files).find(isSvgFile);
      if (!file) return;
      await handleSvgDrop(file);
    },
    [handleSvgDrop],
  );

  // Render SVG geometry when variant layers change.
  // Always clear stale geometry if the active icon/variant becomes unavailable.
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
        renderingMode,
        tokens: project?.tokenSet?.colors,
      },
      svg,
    );
  }, [
    icon,
    variant,
    currentState,
    renderingMode,
    project?.tokenSet?.colors,
  ]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !variant || !currentState) return;

    clearTransitionPreview(svg, currentState);
    if (!transitionPreview) return;

    applyTransitionPreview(svg, {
      baseState: currentState,
      targetState: null,
      progress: transitionPreview.progress,
      resolvedTransition: transitionPreview.resolvedTransition,
      interpolatedValues: transitionPreview.interpolatedValues,
      renderingMode,
      tokens: project?.tokenSet?.colors,
    });
  }, [currentState, project?.tokenSet?.colors, renderingMode, transitionPreview, variant]);

  useEffect(() => {
    if (!autoFitTargetKey) {
      lastAutoFitTargetRef.current = null;
      return;
    }
    if (lastAutoFitTargetRef.current === autoFitTargetKey) {
      return;
    }
    lastAutoFitTargetRef.current = autoFitTargetKey;
    fitCanvasToView();
  }, [autoFitTargetKey, fitCanvasToView]);

  useEffect(() => {
    const handleFitRequest = () => fitCanvasToView();
    window.addEventListener('editor:fit-canvas', handleFitRequest);
    return () => window.removeEventListener('editor:fit-canvas', handleFitRequest);
  }, [fitCanvasToView]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    svg.querySelectorAll('[data-editor-handle="true"]').forEach((el) => el.remove());

    if (tool !== 'direct-select' && tool !== 'pen' && tool !== 'select') return;
    const activeLayerId = selection.layerIds[0];
    if (!activeLayerId || !currentState) return;

    const layer = currentState.layers[activeLayerId];
    const d = layer?.path?.d;
    if (!d) return;

    if (tool === 'select') {
      const selectedPath = svg.querySelector<SVGPathElement>(
        `path[data-layer-id="${CSS.escape(activeLayerId)}"]`,
      );
      if (!selectedPath) return;
      try {
        const bounds = selectedPath.getBBox();
        if (!Number.isFinite(bounds.x + bounds.y + bounds.width + bounds.height)) return;

        // Account for the layer's transform (translate + scale) when
        // positioning the selection bounding box and corner handles.
        const lt = layer.transform;
        const ltx = lt?.x ?? 0;
        const lty = lt?.y ?? 0;
        const lsx = lt?.scaleX ?? 1;
        const lsy = lt?.scaleY ?? 1;
        const tbx = bounds.x * lsx + ltx;
        const tby = bounds.y * lsy + lty;
        const tbw = bounds.width * lsx;
        const tbh = bounds.height * lsy;

        const outline = document.createElementNS(SVG_NS, 'rect');
        outline.setAttribute('x', `${tbx}`);
        outline.setAttribute('y', `${tby}`);
        outline.setAttribute('width', `${Math.max(tbw, 0.001)}`);
        outline.setAttribute('height', `${Math.max(tbh, 0.001)}`);
        outline.setAttribute('fill', 'rgba(14,165,233,0.08)');
        outline.setAttribute('stroke', 'rgba(14,165,233,0.95)');
        outline.setAttribute('stroke-width', `${1 / Math.max(viewport.zoom, 0.01)}`);
        outline.setAttribute('stroke-dasharray', `${4 / Math.max(viewport.zoom, 0.01)} ${3 / Math.max(viewport.zoom, 0.01)}`);
        outline.setAttribute('data-editor-handle', 'true');
        outline.setAttribute('data-handle-type', 'selection-bbox');
        outline.setAttribute('data-layer-id', activeLayerId);
        outline.style.pointerEvents = 'all';
        outline.style.cursor = 'move';
        svg.appendChild(outline);

        const midX = tbx + tbw / 2;
        const midY = tby + tbh / 2;
        const handles: Array<[string, number, number]> = [
          ['nw', tbx, tby],
          ['n', midX, tby],
          ['ne', tbx + tbw, tby],
          ['e', tbx + tbw, midY],
          ['se', tbx + tbw, tby + tbh],
          ['s', midX, tby + tbh],
          ['sw', tbx, tby + tbh],
          ['w', tbx, midY],
        ];

        const handleRadius = SELECTION_HANDLE_RADIUS_PX / Math.max(viewport.zoom, 0.01);
        const handleHitRadius = SELECTION_HANDLE_HIT_RADIUS_PX / Math.max(viewport.zoom, 0.01);

        handles.forEach(([handle, x, y]) => {
          const hit = document.createElementNS(SVG_NS, 'circle');
          hit.setAttribute('cx', `${x}`);
          hit.setAttribute('cy', `${y}`);
          hit.setAttribute('r', `${handleHitRadius}`);
          hit.setAttribute('fill', 'rgba(0,0,0,0)');
          hit.setAttribute('data-editor-handle', 'true');
          hit.setAttribute('data-handle-type', 'selection-resize-hit');
          hit.setAttribute('data-layer-id', activeLayerId);
          hit.setAttribute('data-selection-handle', handle);
          hit.style.pointerEvents = 'all';
          hit.style.cursor = handle === 'n' || handle === 's' ? 'ns-resize' :
            handle === 'e' || handle === 'w' ? 'ew-resize' :
            handle === 'ne' || handle === 'sw' ? 'nesw-resize' : 'nwse-resize';
          svg.appendChild(hit);

          const visible = document.createElementNS(SVG_NS, 'circle');
          visible.setAttribute('cx', `${x}`);
          visible.setAttribute('cy', `${y}`);
          visible.setAttribute('r', `${handleRadius}`);
          visible.setAttribute('fill', '#ffffff');
          visible.setAttribute('stroke', '#0ea5e9');
          visible.setAttribute('stroke-width', `${1 / Math.max(viewport.zoom, 0.01)}`);
          visible.setAttribute('data-editor-handle', 'true');
          visible.setAttribute('data-handle-type', 'selection-resize-visible');
          visible.style.pointerEvents = 'none';
          svg.appendChild(visible);
        });
      } catch {
        // Ignore non-renderable path geometry.
      }
      return;
    }

    if (!isPathDirectlyEditable(d)) return;

    const zoom = Math.max(viewport.zoom, 0.01);
    const handleRadius = HANDLE_RADIUS_PX / zoom;
    const handleStroke = HANDLE_STROKE_PX / zoom;
    const hitRadius = HANDLE_HIT_RADIUS_PX / zoom;
    const controlSize = CONTROL_HANDLE_SIZE_PX / zoom;
    const controlHitRadius = CONTROL_HIT_RADIUS_PX / zoom;
    // Build a set of all selected point keys (strip @in/@out suffixes)
    const selectedPointKeys = new Set(
      selection.pointIds.map((id) => id.split('@')[0]).filter(Boolean),
    );

    const editable = parseSvgPath(d);
    editable.subPaths.forEach((subPath, spIndex) => {
      subPath.points.forEach((point, pointIndex) => {
        const pointKey = `${spIndex}:${pointIndex}`;
        const isActive = selectedPointKeys.has(pointKey);
        const showControls = isActive || selectedPointKeys.size === 0;
        const pendingHandleForPoint =
          tool === 'pen' &&
          pendingPenHandle?.layerId === activeLayerId &&
          pendingPenHandle?.pointKey === pointKey
            ? pendingPenHandle
            : null;
        // Show bezier handles from real parsed data.  For smooth/symmetric
        // points that only have a handle on one side (e.g. cubic→arc or
        // cubic→line transitions), derive the missing handle by mirroring
        // through the anchor — this is standard vector-editor behavior
        // where collinear handles always appear on both sides.
        // Corner points show only the handles that actually exist (no
        // mirroring — the two sides are independent).
        // Pen-tool pending handles always render regardless of nodeType
        // because the point stays 'static' until pointer-up commits it.
        const isMirrored =
          point.nodeType === 'smooth' || point.nodeType === 'symmetric';
        const hasPrev = pointIndex > 0 || subPath.closed;
        const hasNext =
          pointIndex < subPath.points.length - 1 || subPath.closed;
        const rawIn =
          pendingHandleForPoint?.handleIn ?? point.handleIn;
        const rawOut =
          pendingHandleForPoint?.handleOut ?? point.handleOut;
        const handleIn = showControls
          ? rawIn ??
            (isMirrored && rawOut && hasPrev
              ? {
                  x: 2 * point.position.x - rawOut.x,
                  y: 2 * point.position.y - rawOut.y,
                }
              : null)
          : pendingHandleForPoint?.handleIn ?? null;
        const handleOut = showControls
          ? rawOut ??
            (isMirrored && rawIn && hasNext
              ? {
                  x: 2 * point.position.x - rawIn.x,
                  y: 2 * point.position.y - rawIn.y,
                }
              : null)
          : pendingHandleForPoint?.handleOut ?? null;

        const transformX = layer.transform?.x ?? 0;
        const transformY = layer.transform?.y ?? 0;
        const anchorX = point.position.x + transformX;
        const anchorY = point.position.y + transformY;

        const hitTarget = document.createElementNS(SVG_NS, 'circle');
        hitTarget.setAttribute('cx', `${anchorX}`);
        hitTarget.setAttribute('cy', `${anchorY}`);
        hitTarget.setAttribute('r', `${hitRadius}`);
        hitTarget.setAttribute('fill', 'rgba(0, 0, 0, 0)');
        hitTarget.setAttribute('data-editor-handle', 'true');
        hitTarget.setAttribute('data-handle-type', 'anchor');
        hitTarget.setAttribute('data-layer-id', activeLayerId);
        hitTarget.setAttribute('data-point-key', pointKey);
        hitTarget.setAttribute('data-handle-role', 'hit');
        hitTarget.style.pointerEvents = 'all';
        hitTarget.style.cursor = 'default';
        svg.appendChild(hitTarget);

        // Visual node type differentiation:
        // - smooth/symmetric: circle (default)
        // - corner: square (rotated 0°)
        // - static: diamond (rotated 45°)
        const nodeType = point.nodeType;
        if (nodeType === 'corner') {
          // Corner points: square
          const rectSize = handleRadius * 2;
          const handleRect = document.createElementNS(SVG_NS, 'rect');
          handleRect.setAttribute('x', `${-rectSize / 2}`);
          handleRect.setAttribute('y', `${-rectSize / 2}`);
          handleRect.setAttribute('width', `${rectSize}`);
          handleRect.setAttribute('height', `${rectSize}`);
          handleRect.setAttribute('fill', isActive ? ACTIVE_ANCHOR_FILL : ANCHOR_FILL);
          handleRect.setAttribute('stroke', isActive ? ACTIVE_ANCHOR_STROKE : ANCHOR_STROKE);
          handleRect.setAttribute('stroke-width', `${handleStroke}`);
          handleRect.setAttribute('transform', `translate(${anchorX} ${anchorY})`);
          handleRect.setAttribute('data-editor-handle', 'true');
          handleRect.setAttribute('data-handle-type', 'anchor');
          handleRect.setAttribute('data-layer-id', activeLayerId);
          handleRect.setAttribute('data-point-key', pointKey);
          handleRect.setAttribute('data-handle-role', 'visible');
          handleRect.style.pointerEvents = 'none';
          svg.appendChild(handleRect);
        } else if (nodeType === 'static') {
          // Static/line points: diamond (rotated square)
          const rectSize = handleRadius * 1.8;
          const handleDiamond = document.createElementNS(SVG_NS, 'rect');
          handleDiamond.setAttribute('x', `${-rectSize / 2}`);
          handleDiamond.setAttribute('y', `${-rectSize / 2}`);
          handleDiamond.setAttribute('width', `${rectSize}`);
          handleDiamond.setAttribute('height', `${rectSize}`);
          handleDiamond.setAttribute('fill', isActive ? ACTIVE_ANCHOR_FILL : ANCHOR_FILL);
          handleDiamond.setAttribute('stroke', isActive ? ACTIVE_ANCHOR_STROKE : ANCHOR_STROKE);
          handleDiamond.setAttribute('stroke-width', `${handleStroke}`);
          handleDiamond.setAttribute('transform', `translate(${anchorX} ${anchorY}) rotate(45)`);
          handleDiamond.setAttribute('data-editor-handle', 'true');
          handleDiamond.setAttribute('data-handle-type', 'anchor');
          handleDiamond.setAttribute('data-layer-id', activeLayerId);
          handleDiamond.setAttribute('data-point-key', pointKey);
          handleDiamond.setAttribute('data-handle-role', 'visible');
          handleDiamond.style.pointerEvents = 'none';
          svg.appendChild(handleDiamond);
        } else {
          // Smooth/symmetric: circle
          const handleOuter = document.createElementNS(SVG_NS, 'circle');
          handleOuter.setAttribute('cx', `${anchorX}`);
          handleOuter.setAttribute('cy', `${anchorY}`);
          handleOuter.setAttribute('r', `${handleRadius}`);
          handleOuter.setAttribute('fill', isActive ? ACTIVE_ANCHOR_FILL : ANCHOR_FILL);
          handleOuter.setAttribute('stroke', isActive ? ACTIVE_ANCHOR_STROKE : ANCHOR_STROKE);
          handleOuter.setAttribute('stroke-width', `${handleStroke}`);
          handleOuter.setAttribute('data-editor-handle', 'true');
          handleOuter.setAttribute('data-handle-type', 'anchor');
          handleOuter.setAttribute('data-layer-id', activeLayerId);
          handleOuter.setAttribute('data-point-key', pointKey);
          handleOuter.setAttribute('data-handle-role', 'visible');
          handleOuter.style.pointerEvents = 'none';
          svg.appendChild(handleOuter);
        }

        renderControlHandle(
          svg,
          activeLayerId,
          pointKey,
          { x: anchorX, y: anchorY },
          handleIn ? { x: handleIn.x + transformX, y: handleIn.y + transformY } : null,
          'in',
          controlSize,
          controlHitRadius,
          handleStroke,
        );
        renderControlHandle(
          svg,
          activeLayerId,
          pointKey,
          { x: anchorX, y: anchorY },
          handleOut ? { x: handleOut.x + transformX, y: handleOut.y + transformY } : null,
          'out',
          controlSize,
          controlHitRadius,
          handleStroke,
        );
      });
    });
  }, [tool, selection.layerIds, selection.pointIds, currentState, viewport.zoom, pendingPenHandle]);

  // Imperative pointer interaction engine.
  useEffect(() => {
    const svg = svgRef.current;
    const interactionRoot = interactionRootRef.current;
    if (!svg) return;

    const container = containerRef.current;
    if (!container || !interactionRoot) return;

    const editor = new PathEditor(svg, container, interactionRoot);
    return () => editor.destroy();
  }, []);

  // Canvas overlay for selection/guides
  useCanvasOverlay(canvasRef, containerRef, {
    viewport,
    selection,
    layers: currentState?.layers ?? {},
    viewBox: variant?.viewBox ?? [0, 0, 24, 24],
    guideSet: activeGuideSet,
    guidesVisible,
    guideStyle,
    pointBBox,
    pointMarquee,
    pointBBoxLabel: pointTransformLabel,
    activeSnapGuides,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const panCanvas = (deltaX: number, deltaY: number) => {
      const state = editorStore.getState();
      state.setViewport({
        panX: state.viewport.panX - deltaX,
        panY: state.viewport.panY - deltaY,
      });
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      eventClientRef.current = { x: event.clientX, y: event.clientY };

      if (event.ctrlKey || event.metaKey) {
        queuePinchZoom(Math.exp(-event.deltaY * 0.01), event.clientX, event.clientY);
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
      const gestureEvent = event as Event & { clientX?: number; clientY?: number };
      queuePinchZoom(
        delta,
        gestureEvent.clientX ?? eventClientRef.current.x,
        gestureEvent.clientY ?? eventClientRef.current.y,
      );
    };

    const handleGestureEnd = (event: Event) => {
      event.preventDefault();
      gestureScaleRef.current = 1;
      if (pinchFrameRef.current !== null) {
        cancelAnimationFrame(pinchFrameRef.current);
        flushPinchZoom();
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('gesturestart', handleGestureStart as EventListener);
    container.addEventListener('gesturechange', handleGestureChange as EventListener);
    container.addEventListener('gestureend', handleGestureEnd as EventListener);

    return () => {
      if (pinchFrameRef.current !== null) {
        cancelAnimationFrame(pinchFrameRef.current);
        pinchFrameRef.current = null;
      }
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('gesturestart', handleGestureStart as EventListener);
      container.removeEventListener('gesturechange', handleGestureChange as EventListener);
      container.removeEventListener('gestureend', handleGestureEnd as EventListener);
    };
  }, [flushPinchZoom, queuePinchZoom]);

  const eventClientRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ' ' || isEditableEventTarget(event.target)) return;
      if (!spacePanEnabledRef.current) {
        spacePanEnabledRef.current = true;
        setIsSpacePanEnabled(true);
      }
      event.preventDefault();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== ' ') return;
      spacePanEnabledRef.current = false;
      setIsSpacePanEnabled(false);
    };

    const handleBlur = () => {
      spacePanEnabledRef.current = false;
      setIsSpacePanEnabled(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const session = panSessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      const deltaX = event.clientX - session.lastX;
      const deltaY = event.clientY - session.lastY;
      session.lastX = event.clientX;
      session.lastY = event.clientY;
      queuePanDelta(deltaX, deltaY);
    };

    const endPan = (pointerId?: number) => {
      if (pointerId !== undefined && panSessionRef.current?.pointerId !== pointerId) return;
      panSessionRef.current = null;
      if (panFrameRef.current !== null) {
        cancelAnimationFrame(panFrameRef.current);
        panFrameRef.current = null;
      }
      flushPanDelta();
      setIsDragPanning(false);
    };

    const handlePointerUp = (event: PointerEvent) => endPan(event.pointerId);
    const handlePointerCancel = (event: PointerEvent) => endPan(event.pointerId);
    const handleMouseUp = () => endPan();
    const handleBlur = () => endPan();

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [flushPanDelta, queuePanDelta]);

  const handlePanPointerDownCapture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const wantsPan = spacePanEnabledRef.current || event.button === 1;
    if (!wantsPan) return;
    event.preventDefault();
    event.stopPropagation();
    panSessionRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    setIsDragPanning(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
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

  const handleZoomIn = useCallback(() => {
    const state = editorStore.getState();
    state.setViewport({ zoom: Math.min(state.viewport.zoom * 1.25, MAX_ZOOM) });
  }, []);

  const handleZoomOut = useCallback(() => {
    const state = editorStore.getState();
    state.setViewport({ zoom: Math.max(state.viewport.zoom / 1.25, MIN_ZOOM) });
  }, []);

  const handleFitCanvas = useCallback(() => {
    window.dispatchEvent(new CustomEvent('editor:fit-canvas'));
  }, []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
    <div
      ref={containerRef}
      className={cn(
        'workspace-canvas-shell relative flex h-full w-full items-center justify-center',
        isDragPanning ? 'cursor-grabbing' : isSpacePanEnabled ? 'cursor-grab' : undefined,
        isDropActive && 'ring-2 ring-sky-400/70 ring-offset-2 ring-offset-background',
      )}
      data-canvas-root
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
      onPointerDown={(e) => {
        // Click on empty canvas area → deselect (only for select/direct-select tools, no Shift)
        const target = e.target as HTMLElement;
        const isLayerHit = target.closest('[data-layer-hit-id], [data-layer-id], [data-editor-handle]');
        if (!isLayerHit && !e.shiftKey) {
          const { tool, clearSelection } = editorStore.getState();
          if (tool === 'select' || tool === 'direct-select') {
            clearSelection();
          }
        }
      }}
      onPointerDownCapture={handlePanPointerDownCapture}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {icon && variant ? (
        <Rulers
          containerRef={containerRef}
          currentIconId={icon.id}
          viewBox={variant.viewBox}
          viewport={viewport}
          guidesVisible={guidesVisible}
          guideStyle={guideStyle}
          customGuides={icon.customGuides ?? []}
          selectedGuideIndexes={selection.guideIndexes ?? (selectedIconGuideIndex !== null ? [selectedIconGuideIndex] : [])}
        />
      ) : null}

      <div
        ref={interactionRootRef}
        className="absolute inset-0 flex items-center justify-center"
        data-canvas-interaction-root
      >
        <div className="absolute inset-0" data-canvas-draft-surface />

        {icon && variant && currentState && (
          <div className="workspace-stage pointer-events-none absolute" style={stageStyle} />
        )}

        <svg
          ref={svgRef}
          data-editor-canvas="true"
          className="pointer-events-auto relative z-10 cursor-crosshair"
          viewBox={vb.join(' ')}
          style={{
            width: `${iconWidth * scale}px`,
            height: `${iconHeight * scale}px`,
            transform: `translate(${viewport.panX}px, ${viewport.panY}px)`,
            color: 'currentColor',
            filter: 'drop-shadow(0 4px 10px rgba(15, 23, 42, 0.08))',
            overflow: 'visible',
          }}
          aria-label="Icon canvas"
        />

        {/* Canvas overlay for handles/guides */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {showStatusHud && icon && variant && currentState ? (
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{tool}</span>
          <span>·</span>
          <span>{vb[2]} × {vb[3]}</span>
          <span>·</span>
          <span>{selection.layerIds.length} layers</span>
        </div>
      ) : null}

      {(!icon || !variant || !currentState) && (
        <div className="workspace-empty-state absolute px-6 py-5 text-sm text-muted-foreground">
          No icon selected
        </div>
      )}

      {isDropActive ? (
        <div className="pointer-events-none absolute inset-4 flex items-center justify-center rounded-xl border border-dashed border-sky-400/60 bg-sky-500/10 text-sm font-medium text-sky-100 backdrop-blur-sm">
          Drop SVG to import
        </div>
      ) : null}

      {importError && (
        <div
          role="alert"
          className="absolute bottom-4 left-1/2 z-50 max-w-sm -translate-x-1/2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive backdrop-blur-sm"
        >
          {importError}
        </div>
      )}
    </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={handleZoomIn}>
          <ZoomIn className="size-4" />
          Zoom In
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleZoomOut}>
          <ZoomOut className="size-4" />
          Zoom Out
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleFitCanvas}>
          <Maximize2 className="size-4" />
          Fit to View
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

function renderControlHandle(
  svg: SVGSVGElement,
  layerId: string,
  pointKey: string,
  anchor: { x: number; y: number },
  control: { x: number; y: number } | null,
  direction: 'in' | 'out',
  controlSize: number,
  controlHitRadius: number,
  strokeWidth: number,
) {
  if (!control) return;

  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', `${anchor.x}`);
  line.setAttribute('y1', `${anchor.y}`);
  line.setAttribute('x2', `${control.x}`);
  line.setAttribute('y2', `${control.y}`);
  line.setAttribute('stroke', CONTROL_LINE);
  line.setAttribute('stroke-width', `${strokeWidth}`);
  line.setAttribute('data-editor-handle', 'true');
  line.setAttribute('data-handle-type', 'control-line');
  line.setAttribute('data-layer-id', layerId);
  line.setAttribute('data-point-key', pointKey);
  line.setAttribute('data-control-direction', direction);
  line.style.pointerEvents = 'none';
  svg.appendChild(line);

  const hitTarget = document.createElementNS(SVG_NS, 'circle');
  hitTarget.setAttribute('cx', `${control.x}`);
  hitTarget.setAttribute('cy', `${control.y}`);
  hitTarget.setAttribute('r', `${controlHitRadius}`);
  hitTarget.setAttribute('fill', 'rgba(0, 0, 0, 0)');
  hitTarget.setAttribute('data-editor-handle', 'true');
  hitTarget.setAttribute('data-handle-type', 'control');
  hitTarget.setAttribute('data-layer-id', layerId);
  hitTarget.setAttribute('data-point-key', pointKey);
  hitTarget.setAttribute('data-control-direction', direction);
  hitTarget.setAttribute('data-handle-role', 'control-hit');
  hitTarget.style.pointerEvents = 'all';
  svg.appendChild(hitTarget);

  const visible = document.createElementNS(SVG_NS, 'rect');
  visible.setAttribute('x', `${-controlSize / 2}`);
  visible.setAttribute('y', `${-controlSize / 2}`);
  visible.setAttribute('width', `${controlSize}`);
  visible.setAttribute('height', `${controlSize}`);
  visible.setAttribute('fill', CONTROL_FILL);
  visible.setAttribute('stroke', CONTROL_STROKE);
  visible.setAttribute('stroke-width', `${strokeWidth}`);
  visible.setAttribute('transform', `translate(${control.x} ${control.y}) rotate(45)`);
  visible.setAttribute('data-editor-handle', 'true');
  visible.setAttribute('data-handle-type', 'control');
  visible.setAttribute('data-layer-id', layerId);
  visible.setAttribute('data-point-key', pointKey);
  visible.setAttribute('data-control-direction', direction);
  visible.setAttribute('data-handle-role', 'control-visible');
  visible.style.pointerEvents = 'none';
  svg.appendChild(visible);
}
