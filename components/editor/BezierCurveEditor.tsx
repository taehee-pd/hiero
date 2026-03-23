'use client';

import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/kibo-ui/button';
import { Input } from '@/components/kibo-ui/input';
import { Label } from '@/components/kibo-ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SPRING_PRESETS } from '@/lib/runtime-core/spring';
import type { SpringConfig } from '@/lib/schema/types';
import { cn } from '@/lib/utils';

type EasingValue = string | SpringConfig;

const CURVE_PRESETS: Array<{ name: string; value: string }> = [
  { name: 'Material Standard', value: 'cubic-bezier(0.4, 0.0, 0.2, 1)' },
  { name: 'Material Decelerate', value: 'cubic-bezier(0.0, 0.0, 0.2, 1)' },
  { name: 'Material Accelerate', value: 'cubic-bezier(0.4, 0.0, 1, 1)' },
  { name: 'Apple Ease', value: 'cubic-bezier(0.25, 0.1, 0.25, 1)' },
  { name: 'Ease In Out Back', value: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' },
  { name: 'Smooth', value: 'cubic-bezier(0.45, 0.05, 0.55, 0.95)' },
];

const SPRING_PRESET_ENTRIES = Object.entries(SPRING_PRESETS);

const SVG_SIZE = 200;
const PADDING = 20;
const GRAPH_SIZE = SVG_SIZE - PADDING * 2;

function parseCubicBezierValues(value: string): [number, number, number, number] | null {
  const match = value.match(
    /^cubic-bezier\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)$/,
  );
  if (!match) return null;
  return [
    Number.parseFloat(match[1]!),
    Number.parseFloat(match[2]!),
    Number.parseFloat(match[3]!),
    Number.parseFloat(match[4]!),
  ];
}

function toSvgX(value: number): number {
  return PADDING + value * GRAPH_SIZE;
}

function toSvgY(value: number): number {
  return PADDING + (1 - value) * GRAPH_SIZE;
}

function fromSvgX(px: number): number {
  return Math.max(0, Math.min(1, (px - PADDING) / GRAPH_SIZE));
}

function fromSvgY(px: number): number {
  return Math.max(-0.5, Math.min(1.5, 1 - (px - PADDING) / GRAPH_SIZE));
}

function buildCurvePath(x1: number, y1: number, x2: number, y2: number): string {
  return `M${toSvgX(0)} ${toSvgY(0)} C${toSvgX(x1)} ${toSvgY(y1)}, ${toSvgX(x2)} ${toSvgY(y2)}, ${toSvgX(1)} ${toSvgY(1)}`;
}

function springCurvePoints(config: SpringConfig, steps = 60): string {
  const { stiffness, damping, mass = 1, velocity = 0 } = config;
  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const initialDisplacement = -1;

  let durationMs = 0;
  let prev = 0;
  for (let ms = 0; ms <= 5000; ms += 16) {
    const t = ms / 1000;
    let val: number;
    if (zeta < 1) {
      const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
      const coeff = (velocity + zeta * omega0 * initialDisplacement) / omegaD;
      val =
        1 +
        Math.exp(-zeta * omega0 * t) *
          (initialDisplacement * Math.cos(omegaD * t) + coeff * Math.sin(omegaD * t));
    } else if (zeta === 1) {
      val = 1 + (initialDisplacement + (velocity + omega0 * initialDisplacement) * t) * Math.exp(-omega0 * t);
    } else {
      const r1 = -omega0 * (zeta - Math.sqrt(zeta * zeta - 1));
      const r2 = -omega0 * (zeta + Math.sqrt(zeta * zeta - 1));
      const c2 = (velocity - initialDisplacement * r1) / (r2 - r1);
      const c1 = initialDisplacement - c2;
      val = 1 + c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
    }
    if (ms > 100 && Math.abs(1 - val) < 1e-3 && Math.abs(val - prev) < 1e-3) {
      durationMs = ms;
      break;
    }
    prev = val;
    durationMs = ms;
  }
  if (durationMs === 0) durationMs = 1000;

  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const ms = progress * durationMs;
    const t = ms / 1000;
    let val: number;
    if (zeta < 1) {
      const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
      const coeff = (velocity + zeta * omega0 * initialDisplacement) / omegaD;
      val =
        1 +
        Math.exp(-zeta * omega0 * t) *
          (initialDisplacement * Math.cos(omegaD * t) + coeff * Math.sin(omegaD * t));
    } else if (zeta === 1) {
      val = 1 + (initialDisplacement + (velocity + omega0 * initialDisplacement) * t) * Math.exp(-omega0 * t);
    } else {
      const r1 = -omega0 * (zeta - Math.sqrt(zeta * zeta - 1));
      const r2 = -omega0 * (zeta + Math.sqrt(zeta * zeta - 1));
      const c2 = (velocity - initialDisplacement * r1) / (r2 - r1);
      const c1 = initialDisplacement - c2;
      val = 1 + c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
    }
    const x = toSvgX(progress);
    const y = toSvgY(Math.max(-0.5, Math.min(1.5, val)));
    points.push(`${i === 0 ? 'M' : 'L'}${x} ${y}`);
  }
  return points.join(' ');
}

type DragTarget = 'p1' | 'p2';

export function BezierCurveEditor({
  value,
  onChange,
}: {
  value: EasingValue;
  onChange: (value: EasingValue) => void;
}) {
  const isSpring = typeof value === 'object' && value.type === 'spring';
  const [mode, setMode] = useState<'bezier' | 'spring'>(isSpring ? 'spring' : 'bezier');

  const bezierValues = typeof value === 'string' ? parseCubicBezierValues(value) : null;
  const [x1, setX1] = useState(bezierValues?.[0] ?? 0.4);
  const [y1, setY1] = useState(bezierValues?.[1] ?? 0.0);
  const [x2, setX2] = useState(bezierValues?.[2] ?? 0.2);
  const [y2, setY2] = useState(bezierValues?.[3] ?? 1.0);

  const springConfig = isSpring ? value : SPRING_PRESETS.gentle;
  const [stiffness, setStiffness] = useState(springConfig.stiffness);
  const [dampingVal, setDampingVal] = useState(springConfig.damping);
  const [mass, setMass] = useState(springConfig.mass ?? 1);

  const svgRef = useRef<SVGSVGElement>(null);
  const [_dragging, setDragging] = useState<DragTarget | null>(null);

  const emitBezier = useCallback(
    (nx1: number, ny1: number, nx2: number, ny2: number) => {
      onChange(
        `cubic-bezier(${nx1.toFixed(3)}, ${ny1.toFixed(3)}, ${nx2.toFixed(3)}, ${ny2.toFixed(3)})`,
      );
    },
    [onChange],
  );

  const emitSpring = useCallback(
    (s: number, d: number, m: number) => {
      onChange({ type: 'spring', stiffness: s, damping: d, mass: m });
    },
    [onChange],
  );

  const getSvgCoords = useCallback(
    (event: React.MouseEvent | MouseEvent): { x: number; y: number } => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    },
    [],
  );

  const handlePointerDown = useCallback(
    (target: DragTarget) => (event: React.MouseEvent) => {
      event.preventDefault();
      setDragging(target);

      const onMove = (ev: MouseEvent) => {
        const coords = getSvgCoords(ev);
        const nx = fromSvgX(coords.x);
        const ny = fromSvgY(coords.y);
        if (target === 'p1') {
          setX1(nx);
          setY1(ny);
          emitBezier(nx, ny, x2, y2);
        } else {
          setX2(nx);
          setY2(ny);
          emitBezier(x1, y1, nx, ny);
        }
      };

      const onUp = () => {
        setDragging(null);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [emitBezier, getSvgCoords, x1, x2, y1, y2],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <svg width="20" height="20" viewBox="0 0 24 24" className="rounded">
            <path
              d="M3 21 C7 21, 17 3, 21 3"
              stroke="currentColor"
              fill="none"
              strokeWidth="1.5"
            />
          </svg>
          <span className="text-xs">
            {isSpring ? 'Spring' : typeof value === 'string' ? 'Custom' : 'Easing'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-3" align="start">
        <div className="mb-2 flex gap-1">
          <button
            type="button"
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium',
              mode === 'bezier'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setMode('bezier')}
          >
            Bezier
          </button>
          <button
            type="button"
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium',
              mode === 'spring'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setMode('spring')}
          >
            Spring
          </button>
        </div>

        {mode === 'bezier' ? (
          <>
            <svg
              ref={svgRef}
              width={SVG_SIZE}
              height={SVG_SIZE}
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              className="mx-auto block cursor-crosshair rounded-lg border border-border/70 bg-muted/30"
            >
              {/* Grid */}
              <line
                x1={toSvgX(0)} y1={toSvgY(0)} x2={toSvgX(1)} y2={toSvgY(1)}
                stroke="rgba(148,163,184,0.25)" strokeWidth="1" strokeDasharray="4,4"
              />
              <line
                x1={toSvgX(0)} y1={toSvgY(0.5)} x2={toSvgX(1)} y2={toSvgY(0.5)}
                stroke="rgba(148,163,184,0.15)" strokeWidth="1"
              />
              <line
                x1={toSvgX(0.5)} y1={toSvgY(0)} x2={toSvgX(0.5)} y2={toSvgY(1)}
                stroke="rgba(148,163,184,0.15)" strokeWidth="1"
              />

              {/* Control point lines */}
              <line
                x1={toSvgX(0)} y1={toSvgY(0)} x2={toSvgX(x1)} y2={toSvgY(y1)}
                stroke="rgba(59,130,246,0.5)" strokeWidth="1"
              />
              <line
                x1={toSvgX(1)} y1={toSvgY(1)} x2={toSvgX(x2)} y2={toSvgY(y2)}
                stroke="rgba(59,130,246,0.5)" strokeWidth="1"
              />

              {/* Curve */}
              <path
                d={buildCurvePath(x1, y1, x2, y2)}
                stroke="hsl(var(--primary))"
                fill="none"
                strokeWidth="2"
              />

              {/* Control point handles */}
              <circle
                cx={toSvgX(x1)} cy={toSvgY(y1)} r="6"
                fill="hsl(var(--primary))"
                stroke="white" strokeWidth="1.5"
                className="cursor-grab active:cursor-grabbing"
                onMouseDown={handlePointerDown('p1')}
              />
              <circle
                cx={toSvgX(x2)} cy={toSvgY(y2)} r="6"
                fill="hsl(var(--primary))"
                stroke="white" strokeWidth="1.5"
                className="cursor-grab active:cursor-grabbing"
                onMouseDown={handlePointerDown('p2')}
              />

              {/* Endpoints */}
              <circle cx={toSvgX(0)} cy={toSvgY(0)} r="3" fill="hsl(var(--muted-foreground))" />
              <circle cx={toSvgX(1)} cy={toSvgY(1)} r="3" fill="hsl(var(--muted-foreground))" />
            </svg>

            <div className="mt-2 grid grid-cols-4 gap-1.5">
              <div>
                <Label className="text-[length:var(--text-caption)] text-muted-foreground">x1</Label>
                <Input
                  type="number" step="0.01" min="0" max="1"
                  value={x1.toFixed(2)}
                  className="h-7 text-xs"
                  onChange={(e) => {
                    const v = Number.parseFloat(e.target.value);
                    if (Number.isFinite(v)) { setX1(v); emitBezier(v, y1, x2, y2); }
                  }}
                />
              </div>
              <div>
                <Label className="text-[length:var(--text-caption)] text-muted-foreground">y1</Label>
                <Input
                  type="number" step="0.01" min="-0.5" max="1.5"
                  value={y1.toFixed(2)}
                  className="h-7 text-xs"
                  onChange={(e) => {
                    const v = Number.parseFloat(e.target.value);
                    if (Number.isFinite(v)) { setY1(v); emitBezier(x1, v, x2, y2); }
                  }}
                />
              </div>
              <div>
                <Label className="text-[length:var(--text-caption)] text-muted-foreground">x2</Label>
                <Input
                  type="number" step="0.01" min="0" max="1"
                  value={x2.toFixed(2)}
                  className="h-7 text-xs"
                  onChange={(e) => {
                    const v = Number.parseFloat(e.target.value);
                    if (Number.isFinite(v)) { setX2(v); emitBezier(x1, y1, v, y2); }
                  }}
                />
              </div>
              <div>
                <Label className="text-[length:var(--text-caption)] text-muted-foreground">y2</Label>
                <Input
                  type="number" step="0.01" min="-0.5" max="1.5"
                  value={y2.toFixed(2)}
                  className="h-7 text-xs"
                  onChange={(e) => {
                    const v = Number.parseFloat(e.target.value);
                    if (Number.isFinite(v)) { setY2(v); emitBezier(x1, y1, x2, v); }
                  }}
                />
              </div>
            </div>

            <div className="mt-2">
              <Label className="text-[length:var(--text-caption)] uppercase text-muted-foreground">Presets</Label>
              <div className="mt-1 grid gap-0.5">
                {CURVE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className="rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => {
                      const vals = parseCubicBezierValues(preset.value);
                      if (vals) {
                        setX1(vals[0]); setY1(vals[1]);
                        setX2(vals[2]); setY2(vals[3]);
                        onChange(preset.value);
                      }
                    }}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <svg
              width={SVG_SIZE}
              height={SVG_SIZE}
              viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
              className="mx-auto block rounded-lg border border-border/70 bg-muted/30"
            >
              {/* Grid */}
              <line
                x1={toSvgX(0)} y1={toSvgY(0)} x2={toSvgX(1)} y2={toSvgY(1)}
                stroke="rgba(148,163,184,0.25)" strokeWidth="1" strokeDasharray="4,4"
              />
              <line
                x1={toSvgX(0)} y1={toSvgY(1)} x2={toSvgX(1)} y2={toSvgY(1)}
                stroke="rgba(148,163,184,0.2)" strokeWidth="1"
              />

              {/* Spring curve */}
              <path
                d={springCurvePoints({ type: 'spring', stiffness, damping: dampingVal, mass })}
                stroke="hsl(var(--primary))"
                fill="none"
                strokeWidth="2"
              />
            </svg>

            <div className="mt-2 grid gap-2">
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-[length:var(--text-caption)] text-muted-foreground">Stiffness</Label>
                  <span className="text-[length:var(--text-caption)] text-muted-foreground">{stiffness}</span>
                </div>
                <input
                  type="range" min="50" max="500" step="1" value={stiffness}
                  className="w-full accent-primary"
                  onChange={(e) => {
                    const v = Number.parseInt(e.target.value, 10);
                    setStiffness(v);
                    emitSpring(v, dampingVal, mass);
                  }}
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-[length:var(--text-caption)] text-muted-foreground">Damping</Label>
                  <span className="text-[length:var(--text-caption)] text-muted-foreground">{dampingVal}</span>
                </div>
                <input
                  type="range" min="1" max="40" step="0.5" value={dampingVal}
                  className="w-full accent-primary"
                  onChange={(e) => {
                    const v = Number.parseFloat(e.target.value);
                    setDampingVal(v);
                    emitSpring(stiffness, v, mass);
                  }}
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-[length:var(--text-caption)] text-muted-foreground">Mass</Label>
                  <span className="text-[length:var(--text-caption)] text-muted-foreground">{mass.toFixed(1)}</span>
                </div>
                <input
                  type="range" min="0.1" max="3" step="0.1" value={mass}
                  className="w-full accent-primary"
                  onChange={(e) => {
                    const v = Number.parseFloat(e.target.value);
                    setMass(v);
                    emitSpring(stiffness, dampingVal, v);
                  }}
                />
              </div>
            </div>

            <div className="mt-2">
              <Label className="text-[length:var(--text-caption)] uppercase text-muted-foreground">Presets</Label>
              <div className="mt-1 grid gap-0.5">
                {SPRING_PRESET_ENTRIES.map(([name, preset]) => (
                  <button
                    key={name}
                    type="button"
                    className="rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => {
                      setStiffness(preset.stiffness);
                      setDampingVal(preset.damping);
                      setMass(preset.mass ?? 1);
                      onChange(preset);
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
