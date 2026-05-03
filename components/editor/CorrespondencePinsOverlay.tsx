'use client';

/**
 * Vertex-level correspondence-pinning overlay (W4-7 Stage C).
 *
 * Renders the source and target paths side-by-side as small SVG
 * previews and lets the author "drag-vertex-onto-vertex" by
 * clicking a source vertex then a target vertex. The two-click
 * interaction is the discoverable variant of the W4-7 acceptance
 * criterion (the canvas-integrated drag refinement lives in the
 * path-editor work that wraps this component once Canvas.tsx is
 * factored).
 *
 * Pin lifecycle is handled by the pure helpers in
 * `lib/editor-store/correspondence-pinning.ts` (W4-7 Stage A) —
 * this component only orchestrates user input.
 *
 * UX: §3 Layer 2 in `docs_canonical/ICON_TRANSITION_UX_PLAN.md`.
 */
import { memo, useMemo, useState } from 'react';

import {
  pinVertex,
  unpinVertex,
} from '@/lib/editor-store/correspondence-pinning';
import { subpathIdFromIndex } from '@/lib/runtime-core/correspondence-hints';
import { buildContourTree } from '@/lib/runtime-core/contour-tree';
import { canonicalizeLayerPath } from '@/lib/runtime-core/path-normalization';
import type {
  CorrespondenceHints,
  Layer,
  LayerSnapshot,
  VertexAddr,
} from '@/lib/schema/types';

type VertexInfo = {
  addr: VertexAddr;
  x: number;
  y: number;
};

type SideInfo = {
  /** SVG viewBox `[minX, minY, width, height]` with padding. */
  viewBox: [number, number, number, number];
  /** Original path `d` for the stroke render. */
  d: string;
  /** All anchor vertices across all closed subpaths. */
  vertices: VertexInfo[];
};

const PREVIEW_SIZE = 96;
const VERTEX_RADIUS_RATIO = 0.025;
// Pin colors that survive in light + dark themes. Used in order;
// 11 entries is plenty for typical icon pin counts. The 12th pin
// wraps back to entry 0.
const PIN_COLORS = [
  '#e11d48',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#84cc16',
  '#14b8a6',
  '#f97316',
  '#6366f1',
];

type Props = {
  sourceSnapshot: LayerSnapshot | null;
  targetSnapshot: LayerSnapshot | null;
  hints: CorrespondenceHints;
  onChange: (next: CorrespondenceHints) => void;
};

export const CorrespondencePinsOverlay = memo(function CorrespondencePinsOverlay({
  sourceSnapshot,
  targetSnapshot,
  hints,
  onChange,
}: Props) {
  const sourceSide = useMemo(() => sideInfoOf(sourceSnapshot), [sourceSnapshot]);
  const targetSide = useMemo(() => sideInfoOf(targetSnapshot), [targetSnapshot]);
  const [pendingFrom, setPendingFrom] = useState<VertexAddr | null>(null);

  if (!sourceSide || !targetSide) return null;
  if (sourceSide.vertices.length === 0 || targetSide.vertices.length === 0) {
    return null;
  }

  // Build a colour assignment per existing pin (stable by from-addr
  // string so removing one doesn't shuffle the others' colours).
  const pinColorByKey = new Map<string, string>();
  hints.vertex.forEach(([from], i) => {
    pinColorByKey.set(addrKey(from), PIN_COLORS[i % PIN_COLORS.length]!);
  });
  const pinnedFromKeys = new Set(hints.vertex.map(([f]) => addrKey(f)));
  const pinnedToKeys = new Set(hints.vertex.map(([, t]) => addrKey(t)));

  function handleSourceClick(addr: VertexAddr) {
    if (pinnedFromKeys.has(addrKey(addr))) {
      // Click an already-pinned source vertex → unpin it.
      onChange(unpinVertex(hints, addr));
      setPendingFrom(null);
      return;
    }
    setPendingFrom(addr);
  }

  function handleTargetClick(addr: VertexAddr) {
    if (pinnedToKeys.has(addrKey(addr))) {
      // Click an already-pinned target vertex → unpin it.
      onChange(unpinVertex(hints, addr));
      setPendingFrom(null);
      return;
    }
    if (!pendingFrom) return;
    onChange(pinVertex(hints, pendingFrom, addr));
    setPendingFrom(null);
  }

  function handleEscape() {
    setPendingFrom(null);
  }

  return (
    <div
      className="grid gap-1"
      onKeyDown={(e) => {
        if (e.key === 'Escape') handleEscape();
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground">
          Vertex pins
        </span>
        <span className="text-[10px] text-muted-foreground/70">
          {pendingFrom
            ? 'Pick a target vertex…'
            : 'Click a source vertex, then a target vertex.'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PreviewSvg
          label="Source"
          side={sourceSide}
          pinColors={vertexColorMap(hints, 'from', PIN_COLORS)}
          highlightedAddr={pendingFrom}
          onVertexClick={handleSourceClick}
        />
        <PreviewSvg
          label="Target"
          side={targetSide}
          pinColors={vertexColorMap(hints, 'to', PIN_COLORS)}
          highlightedAddr={null}
          onVertexClick={handleTargetClick}
        />
      </div>
      {hints.vertex.length > 0 ? (
        <ul className="flex flex-wrap gap-1 pt-1">
          {hints.vertex.map(([f, t]) => (
            <li
              key={`${addrKey(f)}->${addrKey(t)}`}
              className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-foreground/80"
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ background: pinColorByKey.get(addrKey(f)) }}
              />
              <span>
                {shortAddr(f)} ↔ {shortAddr(t)}
              </span>
              <button
                type="button"
                aria-label={`Remove vertex pin ${addrKey(f)} ↔ ${addrKey(t)}`}
                onClick={() => onChange(unpinVertex(hints, f))}
                className="ml-0.5 rounded-full px-1 leading-none text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});

function PreviewSvg({
  label,
  side,
  pinColors,
  highlightedAddr,
  onVertexClick,
}: {
  label: string;
  side: SideInfo;
  pinColors: Map<string, string>;
  highlightedAddr: VertexAddr | null;
  onVertexClick: (addr: VertexAddr) => void;
}) {
  const [vbX, vbY, vbW, vbH] = side.viewBox;
  const radius = Math.max(vbW, vbH) * VERTEX_RADIUS_RATIO;
  const highlightKey = highlightedAddr ? addrKey(highlightedAddr) : '';
  return (
    <div className="grid gap-1">
      <span className="text-[10px] text-muted-foreground/70">{label}</span>
      <svg
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        width={PREVIEW_SIZE}
        height={PREVIEW_SIZE}
        className="rounded-md border border-border/60 bg-background/40"
        role="img"
        aria-label={`${label} path with ${side.vertices.length} vertices`}
      >
        <path
          d={side.d}
          stroke="currentColor"
          strokeWidth={Math.max(vbW, vbH) * 0.012}
          fill="none"
          className="text-muted-foreground/70"
        />
        {side.vertices.map((v) => {
          const k = addrKey(v.addr);
          const fill = pinColors.get(k);
          const isHighlighted = k === highlightKey;
          return (
            <circle
              key={k}
              cx={v.x}
              cy={v.y}
              r={isHighlighted ? radius * 1.6 : radius}
              fill={fill ?? 'var(--color-background)'}
              stroke={isHighlighted ? 'currentColor' : fill ?? 'currentColor'}
              strokeWidth={radius * 0.5}
              className={
                isHighlighted
                  ? 'cursor-pointer text-accent'
                  : fill
                    ? 'cursor-pointer'
                    : 'cursor-pointer text-muted-foreground hover:text-foreground'
              }
              onClick={(e) => {
                e.stopPropagation();
                onVertexClick(v.addr);
              }}
              data-testid={`vertex-${label.toLowerCase()}-${k}`}
            />
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Side-info extraction
// ---------------------------------------------------------------------------

function sideInfoOf(snapshot: LayerSnapshot | null): SideInfo | null {
  if (!snapshot) return null;
  const primary = primaryLayer(snapshot);
  if (!primary?.path?.d) return null;
  const canonical = canonicalizeLayerPath(primary);
  if (!canonical) return null;
  const tree = buildContourTree(canonical);
  const vertices: VertexInfo[] = [];
  for (const ring of tree.rings) {
    const subpathId = subpathIdFromIndex(ring.subpathIndex);
    ring.points.forEach((p, i) => {
      vertices.push({ addr: { subpathId, vertexIndex: i }, x: p.x, y: p.y });
    });
  }
  const { minX, minY, maxX, maxY } = canonical.stats.bbox;
  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);
  const pad = Math.max(w, h) * 0.1;
  return {
    viewBox: [minX - pad, minY - pad, w + pad * 2, h + pad * 2],
    d: canonical.d,
    vertices,
  };
}

function primaryLayer(snapshot: LayerSnapshot): Layer | undefined {
  for (const layer of Object.values(snapshot.layers)) {
    if (layer.path?.d) return layer;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Address helpers
// ---------------------------------------------------------------------------

function addrKey(addr: VertexAddr): string {
  return `${addr.subpathId}:${addr.vertexIndex}`;
}

function shortAddr(addr: VertexAddr): string {
  const m = /^subpath:(\d+)$/.exec(addr.subpathId);
  const sp = m ? `s${m[1]}` : addr.subpathId;
  return `${sp}.v${addr.vertexIndex}`;
}

function vertexColorMap(
  hints: CorrespondenceHints,
  side: 'from' | 'to',
  palette: readonly string[],
): Map<string, string> {
  const map = new Map<string, string>();
  hints.vertex.forEach((pair, i) => {
    const addr = side === 'from' ? pair[0] : pair[1];
    map.set(addrKey(addr), palette[i % palette.length]!);
  });
  return map;
}
