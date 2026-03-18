export type EasingFunction = (t: number) => number;

const EASING_FUNCTIONS: Record<string, EasingFunction> = {
  linear: (t) => t,
  'ease-in': (t) => t * t,
  'ease-out': (t) => 1 - (1 - t) * (1 - t),
  'ease-in-out': (t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  'ease-in-cubic': (t) => t * t * t,
  'ease-out-cubic': (t) => 1 - Math.pow(1 - t, 3),
};

export function getEasingFunction(name: string): EasingFunction {
  const normalized = name.trim().toLowerCase();
  if (EASING_FUNCTIONS[normalized]) {
    return EASING_FUNCTIONS[normalized];
  }

  const cubicBezier = parseCubicBezier(normalized);
  if (cubicBezier) {
    return cubicBezier;
  }

  const steps = parseSteps(normalized);
  if (steps) {
    return steps;
  }

  return EASING_FUNCTIONS.linear;
}

function parseCubicBezier(value: string): EasingFunction | null {
  const match = value.match(
    /^cubic-bezier\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)$/,
  );
  if (!match) {
    return null;
  }

  const x1 = Number.parseFloat(match[1]!);
  const y1 = Number.parseFloat(match[2]!);
  const x2 = Number.parseFloat(match[3]!);
  const y2 = Number.parseFloat(match[4]!);
  if (![x1, y1, x2, y2].every(Number.isFinite)) {
    return null;
  }

  return createCubicBezierEasing(x1, y1, x2, y2);
}

function parseSteps(value: string): EasingFunction | null {
  const match = value.match(
    /^steps\(\s*(\d+)\s*(?:,\s*(start|end)\s*)?\)$/,
  );
  if (!match) {
    return null;
  }

  const stepCount = Number.parseInt(match[1]!, 10);
  const position = match[2] === 'start' ? 'start' : 'end';
  if (!Number.isFinite(stepCount) || stepCount <= 0) {
    return null;
  }

  return (t) => {
    const clamped = clamp01(t);
    if (position === 'start') {
      return Math.min(1, Math.ceil(clamped * stepCount) / stepCount);
    }
    return Math.floor(clamped * stepCount) / stepCount;
  };
}

function createCubicBezierEasing(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): EasingFunction {
  return (t) => {
    const x = clamp01(t);
    if (x === 0 || x === 1) {
      return x;
    }

    let guess = x;
    for (let index = 0; index < 8; index += 1) {
      const xEstimate = cubicBezierAt(guess, x1, x2) - x;
      const slope = cubicBezierDerivativeAt(guess, x1, x2);
      if (Math.abs(xEstimate) < 1e-7) {
        break;
      }
      if (Math.abs(slope) < 1e-7) {
        guess = binarySearchBezier(x, x1, x2);
        break;
      }
      guess -= xEstimate / slope;
    }

    return cubicBezierAt(clamp01(guess), y1, y2);
  };
}

function cubicBezierAt(t: number, a1: number, a2: number): number {
  const invT = 1 - t;
  return (
    3 * invT * invT * t * a1 +
    3 * invT * t * t * a2 +
    t * t * t
  );
}

function cubicBezierDerivativeAt(t: number, a1: number, a2: number): number {
  const invT = 1 - t;
  return (
    3 * invT * invT * a1 +
    6 * invT * t * (a2 - a1) +
    3 * t * t * (1 - a2)
  );
}

function binarySearchBezier(x: number, x1: number, x2: number): number {
  let start = 0;
  let end = 1;
  let guess = x;

  for (let index = 0; index < 12; index += 1) {
    guess = (start + end) / 2;
    const estimate = cubicBezierAt(guess, x1, x2);
    if (Math.abs(estimate - x) < 1e-7) {
      break;
    }
    if (estimate < x) {
      start = guess;
    } else {
      end = guess;
    }
  }

  return guess;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
