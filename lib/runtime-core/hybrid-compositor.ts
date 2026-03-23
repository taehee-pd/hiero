/**
 * Hybrid morph+trim animation compositor (Phase G, Task 5).
 *
 * Consumes per-subpath strategy classifications from G1 and composes
 * a single animation frame that combines:
 * - Morph interpolation for compatible subpath pairs
 * - Trim/draw animation for open paths with mismatched topology
 * - Crossfade (opacity transition) for closed/open mismatches
 *
 * Downstream renderers consume the returned {@link HybridFrame} to
 * apply the appropriate rendering technique per subpath.
 *
 * @module
 */

import type { SubPathStrategyResult } from './topology-detection';
import { computeTrimValues, type TrimValues } from './draw-executor';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type HybridFrame = {
  /** Subpaths rendered via geometric morph (interpolated path d). */
  morphedPaths: Array<{
    d: string;
    fromIndex: number;
    toIndex: number;
  }>;
  /** Subpaths rendered via trim (stroke-dasharray animation). */
  trimmedPaths: Array<{
    d: string;
    dashArray: string;
    dashOffset: string;
    fromIndex: number;
    isOutgoing: boolean; // true = fading out, false = fading in
  }>;
  /** Subpaths that crossfade (opacity transition). */
  crossfadePaths: Array<{
    d: string;
    opacity: number;
    fromIndex: number;
    isOutgoing: boolean;
  }>;
};

// ---------------------------------------------------------------------------
// Internal parsed subpath representation
// ---------------------------------------------------------------------------

type ParsedCommand = {
  command: string; // 'M' | 'L' | 'C' | 'Q' | 'A' | 'H' | 'V' | 'Z'
  values: number[];
};

type ParsedSubPath = {
  commands: ParsedCommand[];
};

// ---------------------------------------------------------------------------
// SVG path parsing (split at M commands into subpaths)
// ---------------------------------------------------------------------------

/**
 * Tokenise an SVG path `d` string into command letters and numbers.
 */
function tokenize(d: string): string[] {
  const tokens: string[] = [];
  const re = /([a-zA-Z])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}

function isNumber(token: string | undefined): token is string {
  return typeof token === 'string' && /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(token);
}

function hasNumbers(tokens: string[], index: number, count: number): boolean {
  for (let offset = 0; offset < count; offset++) {
    if (!isNumber(tokens[index + offset])) return false;
  }
  return true;
}

/**
 * Parse an SVG path `d` string into absolute-coordinate commands,
 * then split into per-subpath groups at each M command.
 */
function parseSubPaths(d: string): ParsedSubPath[] {
  const tokens = tokenize(d);
  const allCommands: ParsedCommand[] = [];
  let idx = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;

  function readNumber(): number {
    return parseFloat(tokens[idx++] ?? '0');
  }

  while (idx < tokens.length) {
    const token = tokens[idx++];
    if (!token || !/^[a-zA-Z]$/.test(token)) continue;

    const isRelative = token === token.toLowerCase();
    switch (token.toUpperCase()) {
      case 'M': {
        if (!hasNumbers(tokens, idx, 2)) break;
        cx = readNumber() + (isRelative ? cx : 0);
        cy = readNumber() + (isRelative ? cy : 0);
        sx = cx;
        sy = cy;
        allCommands.push({ command: 'M', values: [cx, cy] });
        // Implicit line-to for additional coordinate pairs
        while (hasNumbers(tokens, idx, 2)) {
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          allCommands.push({ command: 'L', values: [cx, cy] });
        }
        break;
      }
      case 'L':
        while (hasNumbers(tokens, idx, 2)) {
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          allCommands.push({ command: 'L', values: [cx, cy] });
        }
        break;
      case 'H':
        while (hasNumbers(tokens, idx, 1)) {
          cx = readNumber() + (isRelative ? cx : 0);
          allCommands.push({ command: 'L', values: [cx, cy] });
        }
        break;
      case 'V':
        while (hasNumbers(tokens, idx, 1)) {
          cy = readNumber() + (isRelative ? cy : 0);
          allCommands.push({ command: 'L', values: [cx, cy] });
        }
        break;
      case 'C':
        while (hasNumbers(tokens, idx, 6)) {
          const x1 = readNumber() + (isRelative ? cx : 0);
          const y1 = readNumber() + (isRelative ? cy : 0);
          const x2 = readNumber() + (isRelative ? cx : 0);
          const y2 = readNumber() + (isRelative ? cy : 0);
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          allCommands.push({ command: 'C', values: [x1, y1, x2, y2, cx, cy] });
        }
        break;
      case 'Q':
        while (hasNumbers(tokens, idx, 4)) {
          const x1 = readNumber() + (isRelative ? cx : 0);
          const y1 = readNumber() + (isRelative ? cy : 0);
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          allCommands.push({ command: 'Q', values: [x1, y1, cx, cy] });
        }
        break;
      case 'A':
        while (hasNumbers(tokens, idx, 7)) {
          const rx = readNumber();
          const ry = readNumber();
          const rotation = readNumber();
          const largeArc = readNumber();
          const sweep = readNumber();
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          allCommands.push({ command: 'A', values: [rx, ry, rotation, largeArc, sweep, cx, cy] });
        }
        break;
      case 'Z':
        cx = sx;
        cy = sy;
        allCommands.push({ command: 'Z', values: [] });
        break;
      default:
        break;
    }
  }

  // Split into subpaths at M commands
  const subpaths: ParsedSubPath[] = [];
  let current: ParsedCommand[] = [];
  for (const cmd of allCommands) {
    if (cmd.command === 'M' && current.length > 0) {
      subpaths.push({ commands: current });
      current = [];
    }
    current.push(cmd);
  }
  if (current.length > 0) {
    subpaths.push({ commands: current });
  }

  return subpaths;
}

// ---------------------------------------------------------------------------
// Subpath serialisation
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  const r = Number(n.toFixed(3));
  return Object.is(r, -0) ? '0' : String(r);
}

function serializeSubPath(sub: ParsedSubPath): string {
  return sub.commands
    .map((cmd) => {
      if (cmd.values.length === 0) return cmd.command;
      return `${cmd.command}${cmd.values.map(fmt).join(' ')}`;
    })
    .join(' ');
}

// ---------------------------------------------------------------------------
// Morph: linear interpolation of matching subpath commands
// ---------------------------------------------------------------------------

/**
 * Linearly interpolate every coordinate between two parsed subpaths.
 *
 * When commands or value counts differ, falls back to the `from` subpath
 * geometry (graceful degradation rather than a crash).
 */
function lerpSubPath(from: ParsedSubPath, to: ParsedSubPath, t: number): string {
  // Fast paths
  if (t <= 0) return serializeSubPath(from);
  if (t >= 1) return serializeSubPath(to);

  const count = Math.min(from.commands.length, to.commands.length);
  const parts: string[] = [];

  for (let i = 0; i < count; i++) {
    const fc = from.commands[i]!;
    const tc = to.commands[i]!;

    // If commands differ in type or value count, emit `from` as-is
    if (fc.command !== tc.command || fc.values.length !== tc.values.length) {
      parts.push(fc.values.length === 0 ? fc.command : `${fc.command}${fc.values.map(fmt).join(' ')}`);
      continue;
    }

    if (fc.values.length === 0) {
      parts.push(fc.command); // Z
      continue;
    }

    const interpolated = fc.values.map((v, vi) => lerp(v, tc.values[vi]!, t));
    parts.push(`${fc.command}${interpolated.map(fmt).join(' ')}`);
  }

  // Emit any trailing commands from the longer subpath
  const longer = from.commands.length > to.commands.length ? from : to;
  for (let i = count; i < longer.commands.length; i++) {
    const cmd = longer.commands[i]!;
    parts.push(cmd.values.length === 0 ? cmd.command : `${cmd.command}${cmd.values.map(fmt).join(' ')}`);
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Approximate path length (chord-length sum for trim calculation)
// ---------------------------------------------------------------------------

function approximatePathLength(sub: ParsedSubPath): number {
  let length = 0;
  let cx = 0;
  let cy = 0;

  for (const cmd of sub.commands) {
    const v = cmd.values;
    switch (cmd.command) {
      case 'M':
        cx = v[0] ?? 0;
        cy = v[1] ?? 0;
        break;
      case 'L': {
        const lx = v[0] ?? 0;
        const ly = v[1] ?? 0;
        length += Math.hypot(lx - cx, ly - cy);
        cx = lx;
        cy = ly;
        break;
      }
      case 'C': {
        // Approximate cubic bezier by control-polygon length
        const c1x = v[0] ?? 0, c1y = v[1] ?? 0;
        const c2x = v[2] ?? 0, c2y = v[3] ?? 0;
        const ex = v[4] ?? 0, ey = v[5] ?? 0;
        const chord = Math.hypot(ex - cx, ey - cy);
        const poly =
          Math.hypot(c1x - cx, c1y - cy) +
          Math.hypot(c2x - c1x, c2y - c1y) +
          Math.hypot(ex - c2x, ey - c2y);
        length += (chord + poly) / 2;
        cx = ex;
        cy = ey;
        break;
      }
      case 'Q': {
        const qx = v[0] ?? 0, qy = v[1] ?? 0;
        const qex = v[2] ?? 0, qey = v[3] ?? 0;
        const qchord = Math.hypot(qex - cx, qey - cy);
        const qpoly = Math.hypot(qx - cx, qy - cy) + Math.hypot(qex - qx, qey - qy);
        length += (qchord + qpoly) / 2;
        cx = qex;
        cy = qey;
        break;
      }
      case 'A': {
        // Rough arc approximation: use the chord length
        const ax = v[5] ?? 0, ay = v[6] ?? 0;
        length += Math.hypot(ax - cx, ay - cy);
        cx = ax;
        cy = ay;
        break;
      }
      case 'Z':
        // Close path — length back to subpath start is already accounted for
        // in most practical cases; skip for simplicity
        break;
      default:
        break;
    }
  }

  return Math.max(length, 1); // Avoid zero-division
}

// ---------------------------------------------------------------------------
// Trim helpers
// ---------------------------------------------------------------------------

/**
 * Compute trim values for a subpath that is being revealed or hidden.
 *
 * - Outgoing (isOutgoing = true): full visible -> hidden as progress goes 0->1
 * - Incoming (isOutgoing = false): hidden -> full visible as progress goes 0->1
 */
function computeSubPathTrim(
  sub: ParsedSubPath,
  progress: number,
  isOutgoing: boolean,
): TrimValues {
  const pathLength = approximatePathLength(sub);

  if (isOutgoing) {
    // Erase: trimEnd goes from 1 -> 0
    const trimEnd = 1 - progress;
    return computeTrimValues(0, trimEnd, 0, pathLength);
  }

  // Reveal: trimEnd goes from 0 -> 1
  return computeTrimValues(0, progress, 0, pathLength);
}

// ---------------------------------------------------------------------------
// Main compositor
// ---------------------------------------------------------------------------

/**
 * Compose a single hybrid animation frame from per-subpath strategies.
 *
 * Given two SVG path `d` strings, their per-subpath strategy classifications,
 * and a progress value (0-1), produces a {@link HybridFrame} that downstream
 * renderers use to apply the appropriate technique per subpath.
 */
export function composeHybridFrame(
  fromPath: string,
  toPath: string,
  strategies: SubPathStrategyResult[],
  progress: number,
): HybridFrame {
  const t = clamp01(progress);

  const fromSubs = parseSubPaths(fromPath);
  const toSubs = parseSubPaths(toPath);

  const frame: HybridFrame = {
    morphedPaths: [],
    trimmedPaths: [],
    crossfadePaths: [],
  };

  for (const strategy of strategies) {
    const fi = strategy.fromIndex;
    const ti = strategy.toIndex;

    switch (strategy.strategy) {
      // ----- Morph: lerp matching subpaths -----
      case 'morph': {
        const fromSub = fi >= 0 ? fromSubs[fi] : undefined;
        const toSub = ti != null && ti >= 0 ? toSubs[ti] : undefined;

        if (fromSub && toSub) {
          const d = lerpSubPath(fromSub, toSub, t);
          frame.morphedPaths.push({
            d,
            fromIndex: fi,
            toIndex: ti ?? -1,
          });
        } else if (fromSub) {
          // Unmatched from — degenerate morph (just emit at full)
          frame.morphedPaths.push({
            d: serializeSubPath(fromSub),
            fromIndex: fi,
            toIndex: ti ?? -1,
          });
        } else if (toSub) {
          frame.morphedPaths.push({
            d: serializeSubPath(toSub),
            fromIndex: fi,
            toIndex: ti ?? -1,
          });
        }
        break;
      }

      // ----- Trim: stroke-dasharray reveal/erase -----
      case 'trim': {
        const fromSub = fi >= 0 ? fromSubs[fi] : undefined;
        const toSub = ti != null && ti >= 0 ? toSubs[ti] : undefined;

        // Outgoing subpath: erase from full to hidden
        if (fromSub) {
          const trim = computeSubPathTrim(fromSub, t, true);
          frame.trimmedPaths.push({
            d: serializeSubPath(fromSub),
            dashArray: trim.dashArray,
            dashOffset: trim.dashOffset,
            fromIndex: fi,
            isOutgoing: true,
          });
        }

        // Incoming subpath: reveal from hidden to full
        if (toSub) {
          const trim = computeSubPathTrim(toSub, t, false);
          frame.trimmedPaths.push({
            d: serializeSubPath(toSub),
            dashArray: trim.dashArray,
            dashOffset: trim.dashOffset,
            fromIndex: ti ?? -1,
            isOutgoing: false,
          });
        }
        break;
      }

      // ----- Crossfade: opacity transition -----
      case 'crossfade': {
        const fromSub = fi >= 0 ? fromSubs[fi] : undefined;
        const toSub = ti != null && ti >= 0 ? toSubs[ti] : undefined;

        if (fromSub) {
          frame.crossfadePaths.push({
            d: serializeSubPath(fromSub),
            opacity: 1 - t,
            fromIndex: fi,
            isOutgoing: true,
          });
        }

        if (toSub) {
          frame.crossfadePaths.push({
            d: serializeSubPath(toSub),
            opacity: t,
            fromIndex: ti ?? -1,
            isOutgoing: false,
          });
        }
        break;
      }

      default:
        break;
    }
  }

  return frame;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
