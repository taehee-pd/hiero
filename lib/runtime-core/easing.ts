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
  return EASING_FUNCTIONS[name] ?? EASING_FUNCTIONS.linear;
}
