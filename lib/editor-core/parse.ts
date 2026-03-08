import type { EditablePath, SubPath, PathPoint, PathSegment } from './path-model';

let _idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++_idCounter}`;
}


const EDITABLE_COMMANDS = new Set(['M', 'L', 'H', 'V', 'C', 'Q', 'A', 'Z']);

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
            prev.nodeType = 'smooth';
          }

          const pt = makePoint(x, y, { type: 'cubic' });
          pt.handleIn = { x: x2, y: y2 };
          pt.nodeType = 'smooth';
          currentSubPath?.points.push(pt);

          cx = x;
          cy = y;
        }
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
        break;
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
