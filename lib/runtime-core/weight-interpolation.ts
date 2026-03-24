import type { SymbolWeight } from '../schema/types';

// ── Weight numeric mapping ────────────────────────────────────────────

export const WEIGHT_NUMERIC: Record<SymbolWeight, number> = {
  ultralight: 100,
  thin: 200,
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  heavy: 800,
  black: 900,
};

const WEIGHT_ENTRIES: Array<[SymbolWeight, number]> = [
  ['ultralight', 100],
  ['thin', 200],
  ['light', 300],
  ['regular', 400],
  ['medium', 500],
  ['semibold', 600],
  ['bold', 700],
  ['heavy', 800],
  ['black', 900],
];

const ALL_WEIGHT_SLOTS: SymbolWeight[] = [
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

export type WeightControlPoints = {
  ultralight?: string;
  thin?: string;
  light?: string;
  regular?: string;
  medium?: string;
  semibold?: string;
  bold?: string;
  heavy?: string;
  black?: string;
};

// ── SVG path tokeniser (lightweight, matches morph.ts approach) ───────

type PathCommand = {
  command: string;
  values: number[];
};

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
  return (
    typeof token === 'string' &&
    /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(token)
  );
}

function parsePathCommands(d: string): PathCommand[] {
  const tokens = tokenize(d);
  const commands: PathCommand[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i]!;
    if (/^[a-zA-Z]$/.test(token)) {
      const cmd: PathCommand = { command: token, values: [] };
      i++;
      while (i < tokens.length && isNumber(tokens[i])) {
        cmd.values.push(parseFloat(tokens[i]!));
        i++;
      }
      commands.push(cmd);
    } else {
      i++;
    }
  }

  return commands;
}

function formatNumber(value: number): string {
  const rounded = Number(value.toFixed(3));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function commandsToD(commands: PathCommand[]): string {
  return commands
    .map((cmd) => {
      if (cmd.values.length === 0) return cmd.command;
      return `${cmd.command}${cmd.values.map(formatNumber).join(' ')}`;
    })
    .join(' ');
}

// ── Fritsch-Carlson monotone cubic interpolation (O1) ─────────────────

/**
 * Fritsch-Carlson monotone cubic interpolation.
 * Given sorted control points (x_i, y_i), returns the interpolated y
 * at the given x using a monotone-preserving cubic Hermite spline.
 */
export function cubicMonotoneInterpolate(
  points: Array<{ x: number; y: number }>,
  x: number,
): number {
  const n = points.length;
  if (n === 0) return 0;
  if (n === 1) return points[0]!.y;

  // Clamp to range
  if (x <= points[0]!.x) return points[0]!.y;
  if (x >= points[n - 1]!.x) return points[n - 1]!.y;

  // 2 points: linear fallback
  if (n === 2) {
    const t = (x - points[0]!.x) / (points[1]!.x - points[0]!.x);
    return points[0]!.y + t * (points[1]!.y - points[0]!.y);
  }

  // Step 1: Compute secants
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    d.push(
      (points[i + 1]!.y - points[i]!.y) /
        (points[i + 1]!.x - points[i]!.x),
    );
  }

  // Step 2: Compute initial tangents
  const m: number[] = new Array(n);
  m[0] = d[0]!;
  m[n - 1] = d[n - 2]!;
  for (let i = 1; i < n - 1; i++) {
    m[i] = (d[i - 1]! + d[i]!) / 2;
  }

  // Step 3: Enforce monotone constraint (Fritsch-Carlson)
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i]! / d[i]!;
      const beta = m[i + 1]! / d[i]!;
      const s2 = alpha * alpha + beta * beta;
      if (s2 > 9) {
        const tau = 3 / Math.sqrt(s2);
        m[i] = tau * alpha * d[i]!;
        m[i + 1] = tau * beta * d[i]!;
      }
    }
  }

  // Find segment
  let seg = 0;
  for (let i = 0; i < n - 1; i++) {
    if (x >= points[i]!.x && x <= points[i + 1]!.x) {
      seg = i;
      break;
    }
  }

  // Step 4: Hermite interpolation
  const h = points[seg + 1]!.x - points[seg]!.x;
  const t = (x - points[seg]!.x) / h;
  const t2 = t * t;
  const t3 = t2 * t;

  return (
    (2 * t3 - 3 * t2 + 1) * points[seg]!.y +
    (t3 - 2 * t2 + t) * h * m[seg]! +
    (-2 * t3 + 3 * t2) * points[seg + 1]!.y +
    (t3 - t2) * h * m[seg + 1]!
  );
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Convert a SymbolWeight name to its numeric value (100–900).
 */
export function weightToNumeric(weight: SymbolWeight): number {
  return WEIGHT_NUMERIC[weight];
}

/**
 * Find the closest SymbolWeight for a numeric value.
 */
export function numericToWeight(value: number): SymbolWeight {
  let closest: SymbolWeight = 'regular';
  let minDist = Infinity;

  for (const [name, num] of WEIGHT_ENTRIES) {
    const dist = Math.abs(value - num);
    if (dist < minDist) {
      minDist = dist;
      closest = name;
    }
  }

  return closest;
}

/**
 * Get the list of populated weight entries from control points, sorted by weight.
 */
function getPopulatedEntries(
  controlPoints: WeightControlPoints,
): Array<{ weight: SymbolWeight; numeric: number; d: string }> {
  const entries: Array<{ weight: SymbolWeight; numeric: number; d: string }> =
    [];
  for (const slot of ALL_WEIGHT_SLOTS) {
    const d = controlPoints[slot];
    if (d) {
      entries.push({ weight: slot, numeric: WEIGHT_NUMERIC[slot], d });
    }
  }
  return entries;
}

/**
 * Validate that populated paths have compatible command signatures for interpolation.
 * Requires at least 2 populated control points.
 */
export function validateWeightControlPoints(controlPoints: WeightControlPoints): {
  valid: boolean;
  reason?: string;
  populatedWeights: SymbolWeight[];
} {
  const entries = getPopulatedEntries(controlPoints);
  const populatedWeights = entries.map((e) => e.weight);

  if (entries.length < 2) {
    return {
      valid: false,
      reason: `At least 2 control points required, found ${entries.length}`,
      populatedWeights,
    };
  }

  const refCmds = parsePathCommands(entries[0]!.d);

  for (let e = 1; e < entries.length; e++) {
    const cmds = parsePathCommands(entries[e]!.d);
    const label = entries[e]!.weight;

    if (cmds.length !== refCmds.length) {
      return {
        valid: false,
        reason: `Command count mismatch: ${entries[0]!.weight} has ${refCmds.length} commands, ${label} has ${cmds.length}`,
        populatedWeights,
      };
    }

    for (let i = 0; i < refCmds.length; i++) {
      if (cmds[i]!.command !== refCmds[i]!.command) {
        return {
          valid: false,
          reason: `Command type mismatch at index ${i}: ${entries[0]!.weight}='${refCmds[i]!.command}', ${label}='${cmds[i]!.command}'`,
          populatedWeights,
        };
      }
      if (cmds[i]!.values.length !== refCmds[i]!.values.length) {
        return {
          valid: false,
          reason: `Value count mismatch at command ${i} ('${refCmds[i]!.command}'): ${entries[0]!.weight}=${refCmds[i]!.values.length}, ${label}=${cmds[i]!.values.length}`,
          populatedWeights,
        };
      }
    }
  }

  return { valid: true, populatedWeights };
}

/**
 * Interpolate between weight control points using cubic monotone spline (O2).
 *
 * Supports 2–9 control points. With exactly 2 points, falls back to linear.
 * With 3+, uses Fritsch-Carlson monotone cubic interpolation per coordinate.
 *
 * @param controlPoints - SVG `d` strings for populated weight slots
 * @param targetWeight  - Target weight as SymbolWeight name or numeric 100–900
 * @returns Interpolated SVG `d` string, or null if command signatures don't match
 */
export function interpolateWeight(
  controlPoints: WeightControlPoints,
  targetWeight: SymbolWeight | number,
): string | null {
  const validation = validateWeightControlPoints(controlPoints);
  if (!validation.valid) return null;

  const entries = getPopulatedEntries(controlPoints);
  if (entries.length < 2) return null;

  const target =
    typeof targetWeight === 'number'
      ? targetWeight
      : weightToNumeric(targetWeight);

  // Clamp to populated range
  const minW = entries[0]!.numeric;
  const maxW = entries[entries.length - 1]!.numeric;
  const clamped = Math.max(minW, Math.min(maxW, target));

  // Check if target matches a control point exactly — return it directly
  for (const entry of entries) {
    if (entry.numeric === clamped) return entry.d;
  }

  // Parse all control point paths
  const allCmds = entries.map((e) => parsePathCommands(e.d));
  const refCmds = allCmds[0]!;

  // Build per-coordinate spline points and interpolate
  const result: PathCommand[] = refCmds.map((cmd, cmdIdx) => {
    return {
      command: cmd.command,
      values: cmd.values.map((_v, valIdx) => {
        const splinePoints = entries.map((entry, entryIdx) => ({
          x: entry.numeric,
          y: allCmds[entryIdx]![cmdIdx]!.values[valIdx]!,
        }));
        return cubicMonotoneInterpolate(splinePoints, clamped);
      }),
    };
  });

  return commandsToD(result);
}
