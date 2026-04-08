'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/kibo-ui/input';
import { Label } from '@/components/kibo-ui/label';
import { X } from 'lucide-react';
import type { Variant, SymbolWeight } from '@/lib/schema/types';
import {
  cubicMonotoneInterpolate,
  validateWeightControlPoints,
  WEIGHT_NUMERIC,
} from '@/lib/runtime-core/weight-interpolation';

// ── Constants ────────────────────────────────────────────────────────

const SVG_W = 280;
const SVG_H = 160;
const PAD = { top: 16, right: 16, bottom: 28, left: 36 };
const GRAPH_W = SVG_W - PAD.left - PAD.right;
const GRAPH_H = SVG_H - PAD.top - PAD.bottom;

const WEIGHT_SLOTS: SymbolWeight[] = [
  'ultralight',
  'thin',
  'light',
  'regular',
  'medium',
  'semibold',
  'bold',
  'heavy',
  'black',
];

const WEIGHT_LABELS: Record<SymbolWeight, string> = {
  ultralight: 'UL',
  thin: 'Th',
  light: 'Lt',
  regular: 'Rg',
  medium: 'Md',
  semibold: 'Sb',
  bold: 'Bd',
  heavy: 'Hv',
  black: 'Bk',
};

// ── Path parsing (lightweight — extract first coordinate value) ──────

function extractFirstCoordinate(d: string): number | null {
  const re = /[a-zA-Z]\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/;
  const m = d.match(re);
  return m ? parseFloat(m[1]!) : null;
}

// ── Coordinate transforms ────────────────────────────────────────────

function toSvgX(weight: number): number {
  return PAD.left + ((weight - 100) / 800) * GRAPH_W;
}

function toSvgY(value: number, minY: number, maxY: number): number {
  const range = maxY - minY || 1;
  return PAD.top + (1 - (value - minY) / range) * GRAPH_H;
}

// ── Linear interpolation (for comparison polyline) ──────────────────

function linearInterpolate(
  points: Array<{ x: number; y: number }>,
  x: number,
): number {
  if (points.length === 0) return 0;
  if (points.length === 1) return points[0]!.y;
  if (x <= points[0]!.x) return points[0]!.y;
  if (x >= points[points.length - 1]!.x) return points[points.length - 1]!.y;

  for (let i = 0; i < points.length - 1; i++) {
    if (x >= points[i]!.x && x <= points[i + 1]!.x) {
      const t =
        (x - points[i]!.x) / (points[i + 1]!.x - points[i]!.x);
      return points[i]!.y + t * (points[i + 1]!.y - points[i]!.y);
    }
  }
  return points[points.length - 1]!.y;
}

// ── Build polyline strings ───────────────────────────────────────────

function buildPolyline(
  points: Array<{ x: number; y: number }>,
  minY: number,
  maxY: number,
  interpolator: (pts: Array<{ x: number; y: number }>, x: number) => number,
  samples: number,
): string {
  if (points.length < 2) return '';
  const minX = points[0]!.x;
  const maxX = points[points.length - 1]!.x;
  const parts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = minX + (i / samples) * (maxX - minX);
    const y = interpolator(points, x);
    const sx = toSvgX(x);
    const sy = toSvgY(y, minY, maxY);
    parts.push(`${i === 0 ? 'M' : 'L'}${sx.toFixed(1)} ${sy.toFixed(1)}`);
  }
  return parts.join(' ');
}

// ── Component ────────────────────────────────────────────────────────

export function WeightCurveEditor({
  weightControlPoints,
  onPatchVariant,
}: {
  weightControlPoints: Variant['weightControlPoints'];
  onPatchVariant: (
    patch: Partial<Pick<Variant, 'weightControlPoints'>>,
  ) => void;
}) {
  const [selectedSlot, setSelectedSlot] = useState<SymbolWeight | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Extract data points: (weight numeric, first coordinate value)
  const dataPoints = useMemo(() => {
    if (!weightControlPoints) return [];
    const pts: Array<{
      slot: SymbolWeight;
      x: number;
      y: number;
    }> = [];
    for (const slot of WEIGHT_SLOTS) {
      const d = weightControlPoints[slot];
      if (!d) continue;
      const coord = extractFirstCoordinate(d);
      if (coord === null) continue;
      pts.push({ slot, x: WEIGHT_NUMERIC[slot], y: coord });
    }
    return pts;
  }, [weightControlPoints]);

  const validation = useMemo(() => {
    if (!weightControlPoints) return null;
    if (dataPoints.length < 2) return null;
    return validateWeightControlPoints(weightControlPoints);
  }, [weightControlPoints, dataPoints.length]);

  const isValid = validation?.valid ?? false;

  // Compute Y range with some padding
  const { minY, maxY } = useMemo(() => {
    if (dataPoints.length === 0) return { minY: 0, maxY: 1 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of dataPoints) {
      if (p.y < lo) lo = p.y;
      if (p.y > hi) hi = p.y;
    }
    const pad = (hi - lo) * 0.15 || 1;
    return { minY: lo - pad, maxY: hi + pad };
  }, [dataPoints]);

  // Spline points for interpolation (just {x, y})
  const splinePoints = useMemo(
    () => dataPoints.map((p) => ({ x: p.x, y: p.y })),
    [dataPoints],
  );

  // Build curve paths
  const linearPath = useMemo(
    () =>
      isValid
        ? buildPolyline(splinePoints, minY, maxY, linearInterpolate, 80)
        : '',
    [isValid, splinePoints, minY, maxY],
  );

  const cubicPath = useMemo(
    () =>
      isValid
        ? buildPolyline(
            splinePoints,
            minY,
            maxY,
            cubicMonotoneInterpolate,
            80,
          )
        : '',
    [isValid, splinePoints, minY, maxY],
  );

  const handlePointClick = useCallback(
    (slot: SymbolWeight) => {
      if (selectedSlot === slot) {
        setSelectedSlot(null);
        return;
      }
      setSelectedSlot(slot);
      setEditValue(weightControlPoints?.[slot] ?? '');
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [selectedSlot, weightControlPoints],
  );

  // Axis tick marks
  const yTicks = useMemo(() => {
    const count = 4;
    const ticks: Array<{ value: number; label: string }> = [];
    for (let i = 0; i <= count; i++) {
      const v = minY + (i / count) * (maxY - minY);
      ticks.push({ value: v, label: v.toFixed(0) });
    }
    return ticks;
  }, [minY, maxY]);

  const handleCommitEdit = useCallback(() => {
    if (!selectedSlot || !editValue.trim()) {
      setSelectedSlot(null);
      return;
    }
    const trimmed = editValue.trim();
    if (!/^[Mm]/.test(trimmed)) {
      setSelectedSlot(null);
      return;
    }
    onPatchVariant({
      weightControlPoints: { ...weightControlPoints, [selectedSlot]: trimmed },
    });
    setSelectedSlot(null);
  }, [selectedSlot, editValue, onPatchVariant, weightControlPoints]);

  if (dataPoints.length < 2) return null;

  return (
    <div className="grid gap-2">
      <Label className="text-[length:var(--text-label)] font-medium uppercase tracking-tight text-muted-foreground">
        Weight Curve
      </Label>

      <svg
        width={SVG_W}
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="block w-full rounded-lg border border-border/70 bg-muted/30"
      >
        {/* Grid lines */}
        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={PAD.left}
              y1={toSvgY(tick.value, minY, maxY)}
              x2={SVG_W - PAD.right}
              y2={toSvgY(tick.value, minY, maxY)}
              stroke="rgba(148,163,184,0.12)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 4}
              y={toSvgY(tick.value, minY, maxY) + 3}
              textAnchor="end"
              className="fill-muted-foreground/50"
              fontSize="8"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* X-axis weight labels */}
        {dataPoints.map((p) => (
          <text
            key={p.slot}
            x={toSvgX(p.x)}
            y={SVG_H - PAD.bottom + 14}
            textAnchor="middle"
            className="fill-muted-foreground/60"
            fontSize="8"
          >
            {WEIGHT_LABELS[p.slot]}
          </text>
        ))}

        {/* Vertical guides at data points */}
        {dataPoints.map((p) => (
          <line
            key={`vg-${p.slot}`}
            x1={toSvgX(p.x)}
            y1={PAD.top}
            x2={toSvgX(p.x)}
            y2={SVG_H - PAD.bottom}
            stroke="rgba(148,163,184,0.08)"
            strokeWidth="1"
          />
        ))}

        {isValid && (
          <>
            {/* Linear (old) — dashed, muted */}
            <path
              d={linearPath}
              stroke="rgba(148,163,184,0.4)"
              fill="none"
              strokeWidth="1.5"
              strokeDasharray="4,3"
            />
            {/* Cubic (new) — solid, primary */}
            <path
              d={cubicPath}
              stroke="hsl(var(--primary))"
              fill="none"
              strokeWidth="2"
            />
          </>
        )}

        {/* Data points */}
        {dataPoints.map((p) => {
          const isSelected = selectedSlot === p.slot;
          return (
            <circle
              key={`pt-${p.slot}`}
              cx={toSvgX(p.x)}
              cy={toSvgY(p.y, minY, maxY)}
              r={isSelected ? 5 : 4}
              fill={isSelected ? 'hsl(var(--primary))' : 'hsl(var(--background))'}
              stroke={
                isSelected
                  ? 'hsl(var(--primary))'
                  : 'hsl(var(--primary))'
              }
              strokeWidth={isSelected ? 2 : 1.5}
              className="cursor-pointer"
              onClick={() => handlePointClick(p.slot)}
            />
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-[2px] w-4 rounded bg-primary" />
          <span className="text-[10px] text-muted-foreground">Cubic</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-[2px] w-4 rounded"
            style={{
              background: 'rgba(148,163,184,0.4)',
              backgroundImage:
                'repeating-linear-gradient(90deg, rgba(148,163,184,0.5) 0px, rgba(148,163,184,0.5) 4px, transparent 4px, transparent 7px)',
            }}
          />
          <span className="text-[10px] text-muted-foreground">Linear</span>
        </div>
      </div>

      {/* Inline path editor */}
      {selectedSlot && (
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs font-medium text-foreground">
            {WEIGHT_LABELS[selectedSlot]}
          </span>
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommitEdit();
              if (e.key === 'Escape') setSelectedSlot(null);
            }}
            onBlur={handleCommitEdit}
            className="h-7 flex-1 rounded-lg bg-input font-mono text-xs"
            placeholder="SVG path d string..."
          />
          <button
            type="button"
            onClick={() => setSelectedSlot(null)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Close editor"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
