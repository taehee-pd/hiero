import type { EditablePath, SubPath, PathPoint, PathSegment } from './path-model';

let _idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++_idCounter}`;
}


const EDITABLE_COMMANDS = new Set(['M', 'L', 'H', 'V', 'C', 'S', 'Q', 'T', 'A', 'Z']);

export function isPathDirectlyEditable(d: string): boolean {
  const tokens = tokenize(d);
  for (const token of tokens) {
    if (/^[a-zA-Z]$/.test(token) && !EDITABLE_COMMANDS.has(token.toUpperCase())) {
      return false;
    }
  }
  return true;
}

/**
 * Parse an SVG path `d` attribute into an editable path model.
 * Handles M, L, C, Q, Z commands (absolute only for now).
 */
export function parseSvgPath(d: string): EditablePath {
  const path: EditablePath = { id: nextId('path'), subPaths: [] };
  const tokens = tokenize(d);

  let currentSubPath: SubPath | null = null;
  let cx = 0;
  let cy = 0;
  let i = 0;
  /**
   * Tracks the curve family of the most recently parsed segment. Used by
   * the S/s and T/t branches to decide whether the implicit first/only
   * control point should be the reflection of the previous control, or
   * just the current anchor.
   *
   * Per SVG spec §9.3.6 and §9.3.7:
   *   - S/s: reflect only if the previous command was C, c, S, or s.
   *     Otherwise the implicit first control is the current point.
   *   - T/t: reflect only if the previous command was Q, q, T, or t.
   *     Otherwise the implicit control is the current point.
   *
   * Our model stores cubic and quadratic controls in the same
   * `handleIn` slot on the current point, so checking `prev.handleIn`
   * existence alone is NOT enough — a Q followed by S (or a C followed
   * by T) would incorrectly reflect the wrong family's control. This
   * tracker is the mandatory gate. Reset to `null` on every non-curve
   * command, including M/L/H/V/A/Z and the implicit line-tos that M
   * emits for trailing coordinate pairs.
   */
  let lastCurveFamily: 'cubic' | 'quadratic' | null = null;

  function num(): number {
    return parseFloat(tokens[i++] ?? '0');
  }

  while (i < tokens.length) {
    const cmd = tokens[i++];

    switch (cmd) {
      case 'M':
      case 'm': {
        const isRel = cmd === 'm';
        const x = num() + (isRel ? cx : 0);
        const y = num() + (isRel ? cy : 0);
        cx = x;
        cy = y;
        currentSubPath = {
          id: nextId('sp'),
          points: [makePoint(x, y)],
          closed: false,
        };
        path.subPaths.push(currentSubPath);
        // Implicit line-to for additional coordinate pairs
        while (i < tokens.length && isNumber(tokens[i])) {
          const lx = num() + (isRel ? cx : 0);
          const ly = num() + (isRel ? cy : 0);
          cx = lx;
          cy = ly;
          currentSubPath.points.push(makePoint(lx, ly, { type: 'line' }));
        }
        lastCurveFamily = null;
        break;
      }

      case 'L':
      case 'l': {
        const isRel = cmd === 'l';
        while (i < tokens.length && isNumber(tokens[i])) {
          const x = num() + (isRel ? cx : 0);
          const y = num() + (isRel ? cy : 0);
          cx = x;
          cy = y;
          currentSubPath?.points.push(makePoint(x, y, { type: 'line' }));
        }
        lastCurveFamily = null;
        break;
      }

      case 'H':
      case 'h': {
        const isRel = cmd === 'h';
        while (i < tokens.length && isNumber(tokens[i])) {
          const x = num() + (isRel ? cx : 0);
          cx = x;
          currentSubPath?.points.push(makePoint(x, cy, { type: 'line' }));
        }
        lastCurveFamily = null;
        break;
      }

      case 'V':
      case 'v': {
        const isRel = cmd === 'v';
        while (i < tokens.length && isNumber(tokens[i])) {
          const y = num() + (isRel ? cy : 0);
          cy = y;
          currentSubPath?.points.push(makePoint(cx, y, { type: 'line' }));
        }
        lastCurveFamily = null;
        break;
      }

      case 'C':
      case 'c': {
        const isRel = cmd === 'c';
        while (i < tokens.length && isNumber(tokens[i])) {
          const x1 = num() + (isRel ? cx : 0);
          const y1 = num() + (isRel ? cy : 0);
          const x2 = num() + (isRel ? cx : 0);
          const y2 = num() + (isRel ? cy : 0);
          const x = num() + (isRel ? cx : 0);
          const y = num() + (isRel ? cy : 0);

          // Update handle-out of previous point
          const prev =
            currentSubPath?.points[currentSubPath.points.length - 1];
          if (prev) {
            prev.handleOut = { x: x1, y: y1 };
            // Infer node type based on existing handleIn/handleOut alignment
            prev.nodeType = inferNodeType(prev.position, prev.handleIn, { x: x1, y: y1 });
          }

          const pt = makePoint(x, y, { type: 'cubic' });
          pt.handleIn = { x: x2, y: y2 };
          // Node type will be set when we encounter the next curve segment
          pt.nodeType = 'smooth';
          currentSubPath?.points.push(pt);

          cx = x;
          cy = y;
        }
        lastCurveFamily = 'cubic';
        break;
      }

      case 'Q':
      case 'q': {
        const isRel = cmd === 'q';
        while (i < tokens.length && isNumber(tokens[i])) {
          const cpx = num() + (isRel ? cx : 0);
          const cpy = num() + (isRel ? cy : 0);
          const x = num() + (isRel ? cx : 0);
          const y = num() + (isRel ? cy : 0);

          const prev =
            currentSubPath?.points[currentSubPath.points.length - 1];
          if (prev) {
            prev.handleOut = { x: cpx, y: cpy };
          }

          const pt = makePoint(x, y, {
            type: 'quadratic',
            control: { x: cpx, y: cpy },
          });
          pt.handleIn = { x: cpx, y: cpy };
          currentSubPath?.points.push(pt);

          cx = x;
          cy = y;
        }
        lastCurveFamily = 'quadratic';
        break;
      }

      case 'S':
      case 's': {
        // Smooth cubic. Per SVG spec §9.3.6:
        //
        //   "The first control point is assumed to be the reflection of
        //    the second control point on the previous command relative
        //    to the current point. (If there is no previous command or
        //    if the previous command was not an C, c, S or s, assume
        //    the first control point is coincident with the current
        //    point.)"
        //
        // The family gate is MANDATORY: without it, `... Q ... S ...`
        // would reflect the Q's control (since we store Q's control on
        // the endpoint's `handleIn`, same slot C uses), silently
        // mangling the curve. We track the last curve family per
        // command and only reflect when it's cubic.
        const isRel = cmd === 's';
        while (i < tokens.length && isNumber(tokens[i])) {
          const x2 = num() + (isRel ? cx : 0);
          const y2 = num() + (isRel ? cy : 0);
          const x = num() + (isRel ? cx : 0);
          const y = num() + (isRel ? cy : 0);

          const prev =
            currentSubPath?.points[currentSubPath.points.length - 1];
          if (prev) {
            const reflected =
              lastCurveFamily === 'cubic' && prev.handleIn
                ? {
                    x: 2 * prev.position.x - prev.handleIn.x,
                    y: 2 * prev.position.y - prev.handleIn.y,
                  }
                : { x: prev.position.x, y: prev.position.y };
            prev.handleOut = reflected;
            prev.nodeType = inferNodeType(prev.position, prev.handleIn, prev.handleOut);
          }

          const pt = makePoint(x, y, { type: 'cubic' });
          pt.handleIn = { x: x2, y: y2 };
          pt.nodeType = 'smooth';
          currentSubPath?.points.push(pt);

          cx = x;
          cy = y;
          // Each segment in a multi-coordinate S run resets the family
          // to cubic so subsequent segments in the same run reflect
          // correctly relative to the most recent cubic control.
          lastCurveFamily = 'cubic';
        }
        break;
      }

      case 'T':
      case 't': {
        // Smooth quadratic. Per SVG spec §9.3.7:
        //
        //   "The control point is assumed to be the reflection of the
        //    control point on the previous command relative to the
        //    current point. (If there is no previous command or if the
        //    previous command was not a Q, q, T or t, assume the
        //    control point is coincident with the current point.)"
        //
        // Same family-gate reasoning as S above — without it,
        // `... C ... T ...` would reflect the C's second control (we
        // store it in the same `handleIn` slot), silently distorting
        // the curve on import.
        const isRel = cmd === 't';
        while (i < tokens.length && isNumber(tokens[i])) {
          const x = num() + (isRel ? cx : 0);
          const y = num() + (isRel ? cy : 0);

          const prev =
            currentSubPath?.points[currentSubPath.points.length - 1];
          let control = { x: 0, y: 0 };
          if (prev) {
            control =
              lastCurveFamily === 'quadratic' && prev.handleIn
                ? {
                    x: 2 * prev.position.x - prev.handleIn.x,
                    y: 2 * prev.position.y - prev.handleIn.y,
                  }
                : { x: prev.position.x, y: prev.position.y };
            prev.handleOut = control;
          }

          const pt = makePoint(x, y, { type: 'quadratic', control });
          pt.handleIn = control;
          currentSubPath?.points.push(pt);

          cx = x;
          cy = y;
          lastCurveFamily = 'quadratic';
        }
        break;
      }

      case 'A':
      case 'a': {
        const isRel = cmd === 'a';
        while (i < tokens.length && isNumber(tokens[i])) {
          const rx = num();
          const ry = num();
          const xAxisRotation = num();
          const largeArc = toFlag(num());
          const sweep = toFlag(num());
          const x = num() + (isRel ? cx : 0);
          const y = num() + (isRel ? cy : 0);
          cx = x;
          cy = y;
          currentSubPath?.points.push(
            makePoint(x, y, {
              type: 'arc',
              rx,
              ry,
              xAxisRotation,
              largeArc,
              sweep,
            }),
          );
        }
        lastCurveFamily = null;
        break;
      }

      case 'Z':
      case 'z': {
        if (currentSubPath) {
          currentSubPath.closed = true;
          // Reset to start of subpath
          if (currentSubPath.points.length > 0) {
            const first = currentSubPath.points[0];
            cx = first.position.x;
            cy = first.position.y;
          }
        }
        lastCurveFamily = null;
        break;
      }
    }
  }

  // Post-parse: infer accurate node types for points with both handles
  for (const sp of path.subPaths) {
    for (const pt of sp.points) {
      if (pt.handleIn && pt.handleOut) {
        pt.nodeType = inferNodeType(pt.position, pt.handleIn, pt.handleOut);
      }
    }
  }

  return path;
}

/**
 * Serialize an editable path model back to an SVG `d` attribute string.
 */
export function serializePath(path: EditablePath): string {
  const parts: string[] = [];

  for (const sp of path.subPaths) {
    for (let i = 0; i < sp.points.length; i++) {
      const pt = sp.points[i];

      if (i === 0) {
        parts.push(`M${r(pt.position.x)} ${r(pt.position.y)}`);
        continue;
      }

      const prev = sp.points[i - 1];
      const segment = inferSegment(prev, pt);
      switch (segment.type) {
        case 'cubic': {
          const ho = prev.handleOut ?? prev.position;
          const hi = pt.handleIn ?? pt.position;
          parts.push(
            `C${r(ho.x)} ${r(ho.y)} ${r(hi.x)} ${r(hi.y)} ${r(pt.position.x)} ${r(pt.position.y)}`,
          );
          break;
        }
        case 'quadratic': {
          const control = pt.handleIn ?? prev.handleOut ?? segment.control;
          parts.push(`Q${r(control.x)} ${r(control.y)} ${r(pt.position.x)} ${r(pt.position.y)}`);
          break;
        }
        case 'arc':
          parts.push(
            `A${r(segment.rx)} ${r(segment.ry)} ${r(segment.xAxisRotation)} ${segment.largeArc} ${segment.sweep} ${r(pt.position.x)} ${r(pt.position.y)}`,
          );
          break;
        case 'line':
        default:
          parts.push(`L${r(pt.position.x)} ${r(pt.position.y)}`);
          break;
      }
    }

    if (sp.closed) {
      parts.push('Z');
    }
  }

  return parts.join(' ');
}

// ── Helpers ──────────────────────────────────────────────────

function makePoint(x: number, y: number, segment: PathSegment | null = null): PathPoint {
  return {
    id: nextId('pt'),
    position: { x, y },
    handleIn: null,
    handleOut: null,
    nodeType: 'static',
    segment,
  };
}

/**
 * Infer the node type from handle positions.
 * - If handles are collinear and equidistant → symmetric
 * - If handles are collinear but different lengths → smooth
 * - Otherwise → corner
 */
function inferNodeType(
  position: { x: number; y: number },
  handleIn: { x: number; y: number } | null,
  handleOut: { x: number; y: number } | null,
): PathPoint['nodeType'] {
  if (!handleIn || !handleOut) return 'smooth';

  const inDx = handleIn.x - position.x;
  const inDy = handleIn.y - position.y;
  const outDx = handleOut.x - position.x;
  const outDy = handleOut.y - position.y;
  const inLen = Math.hypot(inDx, inDy);
  const outLen = Math.hypot(outDx, outDy);

  if (inLen < 0.001 || outLen < 0.001) return 'smooth';

  // Check collinearity: handles should point in opposite directions
  const dot = (inDx / inLen) * (outDx / outLen) + (inDy / inLen) * (outDy / outLen);

  if (dot > -0.99) {
    // Not collinear → corner
    return 'corner';
  }

  // Collinear. Check if lengths match → symmetric
  if (Math.abs(inLen - outLen) < 0.01) {
    return 'symmetric';
  }

  return 'smooth';
}

function inferSegment(prev: PathPoint, pt: PathPoint): PathSegment {
  if (pt.segment?.type === 'arc') return pt.segment;
  if (pt.segment?.type === 'quadratic') return pt.segment;
  if (pt.segment?.type === 'cubic') return pt.segment;
  if (prev.handleOut || pt.handleIn) return { type: 'cubic' };
  return { type: 'line' };
}

function toFlag(value: number): 0 | 1 {
  return value >= 1 ? 1 : 0;
}

function isNumber(token: string): boolean {
  return /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(token);
}

function tokenize(d: string): string[] {
  const tokens: string[] = [];
  const re = /([a-zA-Z])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    tokens.push(m[0]);
  }
  return tokens;
}

function r(n: number): string {
  return Math.round(n * 1000) / 1000 + '';
}
