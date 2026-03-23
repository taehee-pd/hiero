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

export type WeightControlPoints = {
  ultralight: string; // SVG d string for ultralight weight
  regular: string; // SVG d string for regular weight
  black: string; // SVG d string for black weight
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
 * Validate that three paths have compatible command signatures for interpolation.
 */
export function validateWeightControlPoints(controlPoints: WeightControlPoints): {
  valid: boolean;
  reason?: string;
} {
  const ultralightCmds = parsePathCommands(controlPoints.ultralight);
  const regularCmds = parsePathCommands(controlPoints.regular);
  const blackCmds = parsePathCommands(controlPoints.black);

  // Check command counts
  if (ultralightCmds.length !== regularCmds.length) {
    return {
      valid: false,
      reason: `Command count mismatch: ultralight has ${ultralightCmds.length} commands, regular has ${regularCmds.length}`,
    };
  }
  if (regularCmds.length !== blackCmds.length) {
    return {
      valid: false,
      reason: `Command count mismatch: regular has ${regularCmds.length} commands, black has ${blackCmds.length}`,
    };
  }

  // Check command types match
  for (let i = 0; i < ultralightCmds.length; i++) {
    const ulCmd = ultralightCmds[i]!.command;
    const regCmd = regularCmds[i]!.command;
    const blkCmd = blackCmds[i]!.command;

    if (ulCmd !== regCmd || regCmd !== blkCmd) {
      return {
        valid: false,
        reason: `Command type mismatch at index ${i}: ultralight='${ulCmd}', regular='${regCmd}', black='${blkCmd}'`,
      };
    }
  }

  // Check value counts match
  for (let i = 0; i < ultralightCmds.length; i++) {
    const ulLen = ultralightCmds[i]!.values.length;
    const regLen = regularCmds[i]!.values.length;
    const blkLen = blackCmds[i]!.values.length;

    if (ulLen !== regLen || regLen !== blkLen) {
      return {
        valid: false,
        reason: `Value count mismatch at command ${i} ('${ultralightCmds[i]!.command}'): ultralight=${ulLen}, regular=${regLen}, black=${blkLen}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Interpolate between weight control points using linear interpolation.
 *
 * Uses three control points (ultralight=100, regular=400, black=900) and
 * linearly interpolates between the two nearest points for the target weight.
 *
 * Requires all three control-point paths to have identical command signatures.
 *
 * @param controlPoints - Three SVG `d` strings for ultralight, regular, black
 * @param targetWeight  - Target weight as SymbolWeight name or numeric 100–900
 * @returns Interpolated SVG `d` string, or null if command signatures don't match
 */
export function interpolateWeight(
  controlPoints: WeightControlPoints,
  targetWeight: SymbolWeight | number,
): string | null {
  const validation = validateWeightControlPoints(controlPoints);
  if (!validation.valid) return null;

  const target =
    typeof targetWeight === 'number'
      ? targetWeight
      : weightToNumeric(targetWeight);

  // Clamp to valid range
  const clamped = Math.max(100, Math.min(900, target));

  const ultralightCmds = parsePathCommands(controlPoints.ultralight);
  const regularCmds = parsePathCommands(controlPoints.regular);
  const blackCmds = parsePathCommands(controlPoints.black);

  // Determine which pair to interpolate between
  let fromCmds: PathCommand[];
  let toCmds: PathCommand[];
  let t: number;

  if (clamped <= 400) {
    // Interpolate between ultralight (100) and regular (400)
    fromCmds = ultralightCmds;
    toCmds = regularCmds;
    t = (clamped - 100) / 300;
  } else {
    // Interpolate between regular (400) and black (900)
    fromCmds = regularCmds;
    toCmds = blackCmds;
    t = (clamped - 400) / 500;
  }

  // Linearly interpolate each command's values
  const result: PathCommand[] = fromCmds.map((cmd, i) => {
    const targetCmd = toCmds[i]!;
    return {
      command: cmd.command,
      values: cmd.values.map((v, j) => {
        const toVal = targetCmd.values[j]!;
        return v + (toVal - v) * t;
      }),
    };
  });

  return commandsToD(result);
}
