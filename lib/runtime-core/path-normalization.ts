import type { Layer } from '../schema';

export type GeometryStats = {
  subpathCount: number;
  commandSignature: string[];
  closed: boolean[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  centroid: { x: number; y: number };
  pointCount: number;
};

export type CanonicalPath = {
  d: string;
  stats: GeometryStats;
};

type Point = { x: number; y: number };
type Command = { command: string; values: number[] };

export function canonicalizeLayerPath(layer: Layer | undefined): CanonicalPath | null {
  const d = layer?.path?.d;
  if (!d) return null;
  const transformed = applyTransformToPath(d, layer.transform);
  return canonicalizePath(transformed);
}

export function canonicalizePath(d: string): CanonicalPath {
  const commands = toAbsoluteCommands(d);
  const normalized = normalizeSubpathOrdering(commands);
  const canonicalD = normalized
    .map((command) => `${command.command}${command.values.map(formatNumber).join(' ')}`.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const stats = computeGeometryStats(normalized);
  return { d: canonicalD, stats };
}

function applyTransformToPath(d: string, transform: Layer['transform']): string {
  if (!transform) return d;
  const tx = transform.x ?? 0;
  const ty = transform.y ?? 0;
  const rotate = ((transform.rotate ?? 0) * Math.PI) / 180;
  const sx = transform.scaleX ?? 1;
  const sy = transform.scaleY ?? 1;
  const cos = Math.cos(rotate);
  const sin = Math.sin(rotate);

  const mapPoint = (x: number, y: number): Point => {
    const scaledX = x * sx;
    const scaledY = y * sy;
    return {
      x: scaledX * cos - scaledY * sin + tx,
      y: scaledX * sin + scaledY * cos + ty,
    };
  };

  const commands = toAbsoluteCommands(d).map((command) => {
    const out = [...command.values];
    switch (command.command) {
      case 'M':
      case 'L':
        assignPoint(out, 0, mapPoint(out[0]!, out[1]!));
        break;
      case 'Q':
        assignPoint(out, 0, mapPoint(out[0]!, out[1]!));
        assignPoint(out, 2, mapPoint(out[2]!, out[3]!));
        break;
      case 'C':
        assignPoint(out, 0, mapPoint(out[0]!, out[1]!));
        assignPoint(out, 2, mapPoint(out[2]!, out[3]!));
        assignPoint(out, 4, mapPoint(out[4]!, out[5]!));
        break;
      case 'A': {
        const end = mapPoint(out[5]!, out[6]!);
        out[0] = Math.abs(out[0]! * sx);
        out[1] = Math.abs(out[1]! * sy);
        out[2] = out[2]! + (transform.rotate ?? 0);
        assignPoint(out, 5, end);
        break;
      }
      default:
        break;
    }
    return { command: command.command, values: out };
  });

  return commands
    .map((command) => `${command.command}${command.values.map(formatNumber).join(' ')}`.trim())
    .join(' ');
}

function assignPoint(values: number[], index: number, point: Point) {
  values[index] = point.x;
  values[index + 1] = point.y;
}

function normalizeSubpathOrdering(commands: Command[]): Command[] {
  const subpaths: Command[][] = [];
  let current: Command[] = [];
  for (const command of commands) {
    if (command.command === 'M' && current.length > 0) {
      subpaths.push(current);
      current = [];
    }
    current.push(command);
  }
  if (current.length > 0) {
    subpaths.push(current);
  }

  subpaths.sort((a, b) => {
    const am = a[0]?.values ?? [0, 0];
    const bm = b[0]?.values ?? [0, 0];
    if (am[0] !== bm[0]) return am[0]! - bm[0]!;
    if (am[1] !== bm[1]) return am[1]! - bm[1]!;
    return signatureOf(a).localeCompare(signatureOf(b));
  });

  return subpaths.flat();
}

function signatureOf(subpath: Command[]): string {
  return subpath.map((command) => command.command).join('');
}

function computeGeometryStats(commands: Command[]): GeometryStats {
  const commandSignature = commands.map((command) => command.command);
  const closed: boolean[] = [];
  let subpathCount = 0;
  let currentClosed = false;

  const points: Point[] = [];
  for (const command of commands) {
    if (command.command === 'M') {
      if (subpathCount > 0) {
        closed.push(currentClosed);
      }
      subpathCount += 1;
      currentClosed = false;
    }
    if (command.command === 'Z') {
      currentClosed = true;
      continue;
    }
    collectCommandPoints(command).forEach((point) => points.push(point));
  }
  if (subpathCount > 0) {
    closed.push(currentClosed);
  }

  const bbox = computeBBox(points);
  const centroid = {
    x: (bbox.minX + bbox.maxX) / 2,
    y: (bbox.minY + bbox.maxY) / 2,
  };

  return {
    subpathCount,
    commandSignature,
    closed,
    bbox,
    centroid,
    pointCount: points.length,
  };
}

function collectCommandPoints(command: Command): Point[] {
  const v = command.values;
  switch (command.command) {
    case 'M':
    case 'L':
      return [{ x: v[0] ?? 0, y: v[1] ?? 0 }];
    case 'Q':
      return [{ x: v[0] ?? 0, y: v[1] ?? 0 }, { x: v[2] ?? 0, y: v[3] ?? 0 }];
    case 'C':
      return [
        { x: v[0] ?? 0, y: v[1] ?? 0 },
        { x: v[2] ?? 0, y: v[3] ?? 0 },
        { x: v[4] ?? 0, y: v[5] ?? 0 },
      ];
    case 'A':
      return [{ x: v[5] ?? 0, y: v[6] ?? 0 }];
    default:
      return [];
  }
}

function computeBBox(points: Point[]) {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = points[0]!.x;
  let minY = points[0]!.y;
  let maxX = points[0]!.x;
  let maxY = points[0]!.y;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

function toAbsoluteCommands(d: string): Command[] {
  const tokens = tokenize(d);
  const commands: Command[] = [];
  let index = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;

  function readNumber(): number {
    return parseFloat(tokens[index++] ?? '0');
  }

  while (index < tokens.length) {
    const token = tokens[index++];
    if (!token || !/^[a-zA-Z]$/.test(token)) {
      continue;
    }
    const isRelative = token === token.toLowerCase();
    switch (token.toUpperCase()) {
      case 'M': {
        if (!hasNumbers(tokens, index, 2)) break;
        cx = readNumber() + (isRelative ? cx : 0);
        cy = readNumber() + (isRelative ? cy : 0);
        sx = cx;
        sy = cy;
        commands.push({ command: 'M', values: [cx, cy] });
        while (hasNumbers(tokens, index, 2)) {
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: 'L', values: [cx, cy] });
        }
        break;
      }
      case 'L':
        while (hasNumbers(tokens, index, 2)) {
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: 'L', values: [cx, cy] });
        }
        break;
      case 'H':
        while (hasNumbers(tokens, index, 1)) {
          cx = readNumber() + (isRelative ? cx : 0);
          commands.push({ command: 'L', values: [cx, cy] });
        }
        break;
      case 'V':
        while (hasNumbers(tokens, index, 1)) {
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: 'L', values: [cx, cy] });
        }
        break;
      case 'Q':
        while (hasNumbers(tokens, index, 4)) {
          const x1 = readNumber() + (isRelative ? cx : 0);
          const y1 = readNumber() + (isRelative ? cy : 0);
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: 'Q', values: [x1, y1, cx, cy] });
        }
        break;
      case 'C':
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
      case 'A':
        while (hasNumbers(tokens, index, 7)) {
          const rx = readNumber();
          const ry = readNumber();
          const rotation = readNumber();
          const largeArc = readNumber();
          const sweep = readNumber();
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: 'A', values: [rx, ry, rotation, largeArc, sweep, cx, cy] });
        }
        break;
      case 'Z':
        cx = sx;
        cy = sy;
        commands.push({ command: 'Z', values: [] });
        break;
      default:
        break;
    }
  }

  return commands;
}

function hasNumbers(tokens: string[], index: number, count: number): boolean {
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

function tokenize(d: string): string[] {
  const tokens: string[] = [];
  const re = /([a-zA-Z])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}

function formatNumber(value: number): string {
  const rounded = Number(value.toFixed(4));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}
