import { parseSvgPath } from '../editor-core/parse';
import type { PathPoint } from '../editor-core/path-model';
import { arcToCubicSegments } from './arc-to-cubic';
import {
  crossIconMorph,
  findOptimalShapeIndex,
  rotateSubPathSegments,
} from './cross-icon-morph';
import {
  angleLerp,
  decomposePolar,
  reconstructFromPolar,
  decomposeHandle,
  reconstructHandle,
  lerpIntrinsicHandle,
  type IntrinsicHandle,
} from './intrinsic-interpolation';

export type MorphInterpolator = (t: number) => string;

// Re-export cross-icon morph for external consumers
export { crossIconMorph } from './cross-icon-morph';
export { arcToCubicSegments } from './arc-to-cubic';

type CanonicalCommand = {
  command: string;
  values: number[];
};

type Point = { x: number; y: number };

type CubicSegment = {
  c1: Point;
  c2: Point;
  end: Point;
};

type CubicSubPath = {
  start: Point;
  segments: CubicSegment[];
  closed: boolean;
};

type CubicPath = CubicSubPath[];

export function strictMorph(fromD: string, toD: string): MorphInterpolator {
  const from = canonicalizeCommands(fromD);
  const to = canonicalizeCommands(toD);

  const fromSignature = from.map((command) => command.command);
  const toSignature = to.map((command) => command.command);
  if (!arrayEquals(fromSignature, toSignature)) {
    throw new Error(
      `Path command signatures do not match: [${fromSignature.join(', ')}] vs [${toSignature.join(', ')}].`,
    );
  }

  for (let index = 0; index < from.length; index += 1) {
    if (from[index]!.values.length !== to[index]!.values.length) {
      throw new Error(`Path command value counts differ at index ${index}.`);
    }
  }

  return (t: number) => {
    if (t <= 0) return fromD;
    if (t >= 1) return toD;

    return from
      .map((command, index) => {
        const target = to[index]!;
        return formatCommand(
          command.command,
          command.values.map((value, valueIndex) =>
            lerp(value, target.values[valueIndex]!, t),
          ),
        );
      })
      .join(' ');
  };
}

/**
 * Intrinsic Strict Morph — Sederberg 1993 intrinsic interpolation.
 *
 * Same preconditions as strictMorph (identical command signatures),
 * but uses intrinsic interpolation instead of linear lerp.
 * This preserves edge lengths and angles during rotational transitions,
 * eliminating the "shrinkage" artifact where a rotating shape collapses
 * to ~70% of its size at t=0.5.
 *
 * Preserves the original command stream (M stays M, L stays L, etc.)
 * — only the numeric values change.
 */
export function intrinsicStrictMorph(fromD: string, toD: string): MorphInterpolator {
  const from = canonicalizeCommands(fromD);
  const to = canonicalizeCommands(toD);

  const fromSignature = from.map((c) => c.command);
  const toSignature = to.map((c) => c.command);
  if (!arrayEquals(fromSignature, toSignature)) {
    throw new Error(
      `Path command signatures do not match: [${fromSignature.join(', ')}] vs [${toSignature.join(', ')}].`,
    );
  }

  for (let i = 0; i < from.length; i++) {
    if (from[i]!.values.length !== to[i]!.values.length) {
      throw new Error(`Path command value counts differ at index ${i}.`);
    }
  }

  // Pre-compute intrinsic decompositions for each segment.
  // Track running cursor position to decompose edges correctly.
  const EPSILON = 1e-6;

  type IntrinsicEntry = {
    command: string;
    fromValues: number[];
    toValues: number[];
    // For drawing commands: intrinsic edge and handle data
    intrinsic?: {
      fromEdge: { length: number; angle: number };
      toEdge: { length: number; angle: number };
      fromC1?: IntrinsicHandle;
      toC1?: IntrinsicHandle;
      fromC2?: IntrinsicHandle;
      toC2?: IntrinsicHandle;
    };
  };

  const entries: IntrinsicEntry[] = [];
  let fromCx = 0, fromCy = 0, toCx = 0, toCy = 0;

  for (let i = 0; i < from.length; i++) {
    const fc = from[i]!;
    const tc = to[i]!;
    const entry: IntrinsicEntry = {
      command: fc.command,
      fromValues: fc.values,
      toValues: tc.values,
    };

    switch (fc.command) {
      case 'M': {
        fromCx = fc.values[0]!; fromCy = fc.values[1]!;
        toCx = tc.values[0]!; toCy = tc.values[1]!;
        break;
      }
      case 'L': {
        const fromStart = { x: fromCx, y: fromCy };
        const fromEnd = { x: fc.values[0]!, y: fc.values[1]! };
        const toStart = { x: toCx, y: toCy };
        const toEnd = { x: tc.values[0]!, y: tc.values[1]! };

        const fromEdge = decomposePolar(fromStart, fromEnd);
        const toEdge = decomposePolar(toStart, toEnd);

        if (fromEdge.length > EPSILON || toEdge.length > EPSILON) {
          entry.intrinsic = { fromEdge, toEdge };
        }

        fromCx = fromEnd.x; fromCy = fromEnd.y;
        toCx = toEnd.x; toCy = toEnd.y;
        break;
      }
      case 'H': {
        const fromStart = { x: fromCx, y: fromCy };
        const fromEnd = { x: fc.values[0]!, y: fromCy };
        const toStart = { x: toCx, y: toCy };
        const toEnd = { x: tc.values[0]!, y: toCy };

        entry.intrinsic = {
          fromEdge: decomposePolar(fromStart, fromEnd),
          toEdge: decomposePolar(toStart, toEnd),
        };

        fromCx = fromEnd.x; toCx = toEnd.x;
        break;
      }
      case 'V': {
        const fromStart = { x: fromCx, y: fromCy };
        const fromEnd = { x: fromCx, y: fc.values[0]! };
        const toStart = { x: toCx, y: toCy };
        const toEnd = { x: toCx, y: tc.values[0]! };

        entry.intrinsic = {
          fromEdge: decomposePolar(fromStart, fromEnd),
          toEdge: decomposePolar(toStart, toEnd),
        };

        fromCy = fromEnd.y; toCy = toEnd.y;
        break;
      }
      case 'C': {
        const fromStart = { x: fromCx, y: fromCy };
        const fromC1 = { x: fc.values[0]!, y: fc.values[1]! };
        const fromC2 = { x: fc.values[2]!, y: fc.values[3]! };
        const fromEnd = { x: fc.values[4]!, y: fc.values[5]! };

        const toStart = { x: toCx, y: toCy };
        const toC1 = { x: tc.values[0]!, y: tc.values[1]! };
        const toC2 = { x: tc.values[2]!, y: tc.values[3]! };
        const toEnd = { x: tc.values[4]!, y: tc.values[5]! };

        const fromEdge = decomposePolar(fromStart, fromEnd);
        const toEdge = decomposePolar(toStart, toEnd);

        if (fromEdge.length > EPSILON || toEdge.length > EPSILON) {
          entry.intrinsic = {
            fromEdge,
            toEdge,
            fromC1: decomposeHandle(fromC1, fromStart, fromEnd),
            toC1: decomposeHandle(toC1, toStart, toEnd),
            fromC2: decomposeHandle(fromC2, fromStart, fromEnd),
            toC2: decomposeHandle(toC2, toStart, toEnd),
          };
        }

        fromCx = fromEnd.x; fromCy = fromEnd.y;
        toCx = toEnd.x; toCy = toEnd.y;
        break;
      }
      case 'Q': {
        const fromStart = { x: fromCx, y: fromCy };
        const fromC1 = { x: fc.values[0]!, y: fc.values[1]! };
        const fromEnd = { x: fc.values[2]!, y: fc.values[3]! };

        const toStart = { x: toCx, y: toCy };
        const toC1 = { x: tc.values[0]!, y: tc.values[1]! };
        const toEnd = { x: tc.values[2]!, y: tc.values[3]! };

        const fromEdge = decomposePolar(fromStart, fromEnd);
        const toEdge = decomposePolar(toStart, toEnd);

        if (fromEdge.length > EPSILON || toEdge.length > EPSILON) {
          entry.intrinsic = {
            fromEdge,
            toEdge,
            fromC1: decomposeHandle(fromC1, fromStart, fromEnd),
            toC1: decomposeHandle(toC1, toStart, toEnd),
          };
        }

        fromCx = fromEnd.x; fromCy = fromEnd.y;
        toCx = toEnd.x; toCy = toEnd.y;
        break;
      }
      case 'Z': {
        // Z doesn't have values; no intrinsic decomposition needed
        break;
      }
      default: {
        // A and other commands: fall back to linear lerp (no intrinsic)
        // Update cursor from values if applicable
        if (fc.values.length >= 2) {
          fromCx = fc.values[fc.values.length - 2]!;
          fromCy = fc.values[fc.values.length - 1]!;
          toCx = tc.values[tc.values.length - 2]!;
          toCy = tc.values[tc.values.length - 1]!;
        }
        break;
      }
    }

    entries.push(entry);
  }

  // Track cursor state during interpolation for coordinate reconstruction
  return (t: number) => {
    if (t <= 0) return fromD;
    if (t >= 1) return toD;

    let cursorX = 0, cursorY = 0;

    return entries
      .map((entry) => {
        if (!entry.intrinsic) {
          // Fall back to linear lerp for M, Z, A, and degenerate edges
          const values = entry.fromValues.map((v, j) =>
            lerp(v, entry.toValues[j]!, t),
          );

          // Update cursor
          switch (entry.command) {
            case 'M':
              cursorX = values[0]!; cursorY = values[1]!;
              break;
            case 'L':
              cursorX = values[0]!; cursorY = values[1]!;
              break;
            case 'H':
              cursorX = values[0]!;
              break;
            case 'V':
              cursorY = values[0]!;
              break;
            case 'C':
              cursorX = values[4]!; cursorY = values[5]!;
              break;
            case 'Q':
              cursorX = values[2]!; cursorY = values[3]!;
              break;
          }

          return formatCommand(entry.command, values);
        }

        // Intrinsic interpolation
        const { fromEdge, toEdge } = entry.intrinsic;
        const interpLength = lerp(fromEdge.length, toEdge.length, t);
        const interpAngle = angleLerp(fromEdge.angle, toEdge.angle, t);

        const start = { x: cursorX, y: cursorY };
        const end = reconstructFromPolar(start, { length: interpLength, angle: interpAngle });

        switch (entry.command) {
          case 'L': {
            cursorX = end.x; cursorY = end.y;
            return formatCommand('L', [end.x, end.y]);
          }
          case 'H': {
            cursorX = end.x;
            return formatCommand('H', [end.x]);
          }
          case 'V': {
            cursorY = end.y;
            return formatCommand('V', [end.y]);
          }
          case 'C': {
            const c1 = entry.intrinsic.fromC1 && entry.intrinsic.toC1
              ? reconstructHandle(lerpIntrinsicHandle(entry.intrinsic.fromC1, entry.intrinsic.toC1, t), start, end)
              : { x: lerp(entry.fromValues[0]!, entry.toValues[0]!, t), y: lerp(entry.fromValues[1]!, entry.toValues[1]!, t) };
            const c2 = entry.intrinsic.fromC2 && entry.intrinsic.toC2
              ? reconstructHandle(lerpIntrinsicHandle(entry.intrinsic.fromC2, entry.intrinsic.toC2, t), start, end)
              : { x: lerp(entry.fromValues[2]!, entry.toValues[2]!, t), y: lerp(entry.fromValues[3]!, entry.toValues[3]!, t) };

            cursorX = end.x; cursorY = end.y;
            return formatCommand('C', [c1.x, c1.y, c2.x, c2.y, end.x, end.y]);
          }
          case 'Q': {
            const c1 = entry.intrinsic.fromC1 && entry.intrinsic.toC1
              ? reconstructHandle(lerpIntrinsicHandle(entry.intrinsic.fromC1, entry.intrinsic.toC1, t), start, end)
              : { x: lerp(entry.fromValues[0]!, entry.toValues[0]!, t), y: lerp(entry.fromValues[1]!, entry.toValues[1]!, t) };

            cursorX = end.x; cursorY = end.y;
            return formatCommand('Q', [c1.x, c1.y, end.x, end.y]);
          }
          default: {
            // Shouldn't happen, but fall back to linear lerp
            const values = entry.fromValues.map((v, j) =>
              lerp(v, entry.toValues[j]!, t),
            );
            if (values.length >= 2) {
              cursorX = values[values.length - 2]!;
              cursorY = values[values.length - 1]!;
            }
            return formatCommand(entry.command, values);
          }
        }
      })
      .join(' ');
  };
}

/**
 * Attempt a cross-icon morph between two path strings.
 *
 * Converts raw SVG path `d` strings to the CubicPath representation
 * required by crossIconMorph (Phase 8.2).  Returns the interpolator
 * on success, or null when either path cannot be normalised.
 */
export function attemptCrossIconMorph(fromD: string, toD: string): MorphInterpolator | null {
  const from = normalizeToCubicPath(fromD);
  const to = normalizeToCubicPath(toD);
  if (!from || !to) {
    return null;
  }
  return crossIconMorph(from, to);
}

export function bestGuessMorph(fromD: string, toD: string): MorphInterpolator | null {
  const from = normalizeToCubicPath(fromD);
  const to = normalizeToCubicPath(toD);
  if (!from || !to) {
    return null;
  }

  const aligned = alignCubicPaths(from, to);
  if (!aligned) {
    return null;
  }

  const [alignedFrom, alignedTo] = aligned;
  const normalizedFrom = serializeCubicPath(alignedFrom);
  const normalizedTo = serializeCubicPath(alignedTo);

  let interpolate: MorphInterpolator;
  try {
    interpolate = strictMorph(normalizedFrom, normalizedTo);
  } catch {
    return null;
  }

  return (t: number) => {
    if (t <= 0) return fromD;
    if (t >= 1) return toD;
    return interpolate(t);
  };
}

function canonicalizeCommands(d: string): CanonicalCommand[] {
  const tokens = tokenize(d);
  const commands: CanonicalCommand[] = [];
  let index = 0;
  let cx = 0;
  let cy = 0;
  let subPathStartX = 0;
  let subPathStartY = 0;

  function readNumber() {
    return parseFloat(tokens[index++] ?? '0');
  }

  while (index < tokens.length) {
    const token = tokens[index++];
    if (!token || !/^[a-zA-Z]$/.test(token)) {
      continue;
    }

    switch (token) {
      case 'M':
      case 'm': {
        const isRelative = token === 'm';
        if (!hasNumbers(tokens, index, 2)) break;
        cx = readNumber() + (isRelative ? cx : 0);
        cy = readNumber() + (isRelative ? cy : 0);
        subPathStartX = cx;
        subPathStartY = cy;
        commands.push({ command: 'M', values: [cx, cy] });

        while (hasNumbers(tokens, index, 2)) {
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: 'L', values: [cx, cy] });
        }
        break;
      }
      case 'L':
      case 'l': {
        const isRelative = token === 'l';
        while (hasNumbers(tokens, index, 2)) {
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: 'L', values: [cx, cy] });
        }
        break;
      }
      case 'H':
      case 'h': {
        const isRelative = token === 'h';
        while (hasNumbers(tokens, index, 1)) {
          cx = readNumber() + (isRelative ? cx : 0);
          commands.push({ command: 'H', values: [cx] });
        }
        break;
      }
      case 'V':
      case 'v': {
        const isRelative = token === 'v';
        while (hasNumbers(tokens, index, 1)) {
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: 'V', values: [cy] });
        }
        break;
      }
      case 'C':
      case 'c': {
        const isRelative = token === 'c';
        while (hasNumbers(tokens, index, 6)) {
          const x1 = readNumber() + (isRelative ? cx : 0);
          const y1 = readNumber() + (isRelative ? cy : 0);
          const x2 = readNumber() + (isRelative ? cx : 0);
          const y2 = readNumber() + (isRelative ? cy : 0);
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: 'C', values: [x1, y1, x2, y2, cx, cy] });
        }
        break;
      }
      case 'Q':
      case 'q': {
        const isRelative = token === 'q';
        while (hasNumbers(tokens, index, 4)) {
          const x1 = readNumber() + (isRelative ? cx : 0);
          const y1 = readNumber() + (isRelative ? cy : 0);
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: 'Q', values: [x1, y1, cx, cy] });
        }
        break;
      }
      case 'A':
      case 'a': {
        const isRelative = token === 'a';
        while (hasNumbers(tokens, index, 7)) {
          const rx = readNumber();
          const ry = readNumber();
          const xAxisRotation = readNumber();
          const largeArc = readNumber();
          const sweep = readNumber();
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({
            command: 'A',
            values: [rx, ry, xAxisRotation, largeArc, sweep, cx, cy],
          });
        }
        break;
      }
      case 'Z':
      case 'z':
        cx = subPathStartX;
        cy = subPathStartY;
        commands.push({ command: 'Z', values: [] });
        break;
      default:
        break;
    }
  }

  return commands;
}

function normalizeToCubicPath(d: string): CubicPath | null {
  const path = parseSvgPath(d);
  const normalized: CubicPath = [];

  for (const subPath of path.subPaths) {
    const firstPoint = subPath.points[0];
    if (!firstPoint) continue;

    const segments: CubicSegment[] = [];
    for (let index = 1; index < subPath.points.length; index += 1) {
      const prev = subPath.points[index - 1]!;
      const next = subPath.points[index]!;

      // 8.1a: Handle arc segments by converting to multiple cubic segments
      if (next.segment?.type === 'arc') {
        const arc = next.segment;
        const arcSegments = arcToCubicSegments(
          prev.position,
          arc.rx ?? 0,
          arc.ry ?? 0,
          arc.xAxisRotation ?? 0,
          arc.largeArc ? 1 : 0,
          arc.sweep ? 1 : 0,
          next.position,
        );
        if (arcSegments.length === 0) {
          // Degenerate arc — treat as line
          segments.push({
            c1: clonePoint(prev.position),
            c2: clonePoint(next.position),
            end: clonePoint(next.position),
          });
        } else {
          segments.push(...arcSegments);
        }
        continue;
      }

      const segment = toCubicSegment(prev, next);
      if (!segment) {
        return null;
      }
      segments.push(segment);
    }

    normalized.push({
      start: clonePoint(firstPoint.position),
      segments,
      closed: subPath.closed,
    });
  }

  return normalized;
}

function toCubicSegment(prev: PathPoint, next: PathPoint): CubicSegment | null {
  if (next.segment?.type === 'arc') {
    // 8.1a: Convert arc to cubic bezier segments
    const arc = next.segment;
    const segments = arcToCubicSegments(
      prev.position,
      arc.rx ?? 0,
      arc.ry ?? 0,
      arc.xAxisRotation ?? 0,
      arc.largeArc ? 1 : 0,
      arc.sweep ? 1 : 0,
      next.position,
    );
    // Return the last segment (for single-segment approximation in this context);
    // the full multi-segment conversion is handled in normalizeToCubicPath.
    if (segments.length === 0) {
      return {
        c1: clonePoint(prev.position),
        c2: clonePoint(next.position),
        end: clonePoint(next.position),
      };
    }
    return segments[segments.length - 1]!;
  }

  if (next.segment?.type === 'quadratic') {
    const control = next.segment.control;
    return {
      c1: {
        x: prev.position.x + ((control.x - prev.position.x) * 2) / 3,
        y: prev.position.y + ((control.y - prev.position.y) * 2) / 3,
      },
      c2: {
        x: next.position.x + ((control.x - next.position.x) * 2) / 3,
        y: next.position.y + ((control.y - next.position.y) * 2) / 3,
      },
      end: clonePoint(next.position),
    };
  }

  if (next.segment?.type === 'cubic' || prev.handleOut || next.handleIn) {
    return {
      c1: clonePoint(prev.handleOut ?? prev.position),
      c2: clonePoint(next.handleIn ?? next.position),
      end: clonePoint(next.position),
    };
  }

  return {
    c1: clonePoint(prev.position),
    c2: clonePoint(next.position),
    end: clonePoint(next.position),
  };
}

function alignCubicPaths(from: CubicPath, to: CubicPath): [CubicPath, CubicPath] | null {
  const left = cloneCubicPath(from);
  const right = cloneCubicPath(to);
  const subPathCount = Math.max(left.length, right.length);

  while (left.length < subPathCount) {
    const template = right[left.length];
    if (!template) return null;
    left.push(createDegenerateSubPath(getLastPoint(left), template));
  }
  while (right.length < subPathCount) {
    const template = left[right.length];
    if (!template) return null;
    right.push(createDegenerateSubPath(getLastPoint(right), template));
  }

  for (let index = 0; index < subPathCount; index += 1) {
    const leftSubPath = left[index]!;
    const rightSubPath = right[index]!;

    if (leftSubPath.closed !== rightSubPath.closed) {
      return null;
    }

    const segmentCount = Math.max(leftSubPath.segments.length, rightSubPath.segments.length);
    padSubPathSegments(leftSubPath, segmentCount);
    padSubPathSegments(rightSubPath, segmentCount);

    // 8.1c: Shape index optimization — find optimal rotation offset
    // that minimizes total point displacement for closed paths
    if (leftSubPath.closed && rightSubPath.closed && segmentCount > 1) {
      const offset = findOptimalShapeIndex(leftSubPath, rightSubPath);
      if (offset > 0) {
        const rotated = rotateSubPathSegments(rightSubPath, offset);
        right[index] = rotated;
      }
    }
  }

  return [left, right];
}

function createDegenerateSubPath(origin: Point, template: CubicSubPath): CubicSubPath {
  const start = clonePoint(origin);
  const segments = Array.from({ length: template.segments.length }, () => ({
    c1: clonePoint(start),
    c2: clonePoint(start),
    end: clonePoint(start),
  }));

  return {
    start,
    segments,
    closed: template.closed,
  };
}

function padSubPathSegments(subPath: CubicSubPath, segmentCount: number) {
  let end = getSubPathEnd(subPath);
  while (subPath.segments.length < segmentCount) {
    subPath.segments.push({
      c1: clonePoint(end),
      c2: clonePoint(end),
      end: clonePoint(end),
    });
    end = getSubPathEnd(subPath);
  }
}

function serializeCubicPath(path: CubicPath): string {
  const commands: string[] = [];

  for (const subPath of path) {
    commands.push(formatCommand('M', [subPath.start.x, subPath.start.y]));
    for (const segment of subPath.segments) {
      commands.push(
        formatCommand('C', [
          segment.c1.x,
          segment.c1.y,
          segment.c2.x,
          segment.c2.y,
          segment.end.x,
          segment.end.y,
        ]),
      );
    }
    if (subPath.closed) {
      commands.push('Z');
    }
  }

  return commands.join(' ');
}

function getLastPoint(path: CubicPath): Point {
  const lastSubPath = path[path.length - 1];
  if (!lastSubPath) {
    return { x: 0, y: 0 };
  }
  return clonePoint(getSubPathEnd(lastSubPath));
}

function getSubPathEnd(subPath: CubicSubPath): Point {
  const lastSegment = subPath.segments[subPath.segments.length - 1];
  return lastSegment ? clonePoint(lastSegment.end) : clonePoint(subPath.start);
}

function cloneCubicPath(path: CubicPath): CubicPath {
  return path.map((subPath) => ({
    start: clonePoint(subPath.start),
    closed: subPath.closed,
    segments: subPath.segments.map((segment) => ({
      c1: clonePoint(segment.c1),
      c2: clonePoint(segment.c2),
      end: clonePoint(segment.end),
    })),
  }));
}

function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y };
}

function tokenize(d: string): string[] {
  const tokens: string[] = [];
  const re = /([a-zA-Z])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(d)) !== null) {
    tokens.push(match[0]);
  }

  return tokens;
}

function hasNumbers(tokens: string[], index: number, count: number) {
  for (let offset = 0; offset < count; offset += 1) {
    if (!isNumber(tokens[index + offset])) {
      return false;
    }
  }
  return true;
}

function isNumber(token: string | undefined): token is string {
  return typeof token === 'string' && /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(token);
}

function formatCommand(command: string, values: number[]): string {
  if (values.length === 0) {
    return command;
  }
  return `${command}${values.map((value) => formatNumber(value)).join(' ')}`;
}

function formatNumber(value: number): string {
  const rounded = Number(value.toFixed(3));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

function arrayEquals<T>(a: T[], b: T[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
