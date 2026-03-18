import type { SpringConfig } from '../schema';

const DEFAULT_MASS = 1;
const DEFAULT_VELOCITY = 0;
const SETTLE_EPSILON = 1e-3;

export const SPRING_PRESETS: Record<string, SpringConfig> = {
  gentle: { type: 'spring', stiffness: 120, damping: 18, mass: 1, velocity: 0 },
  bouncy: { type: 'spring', stiffness: 220, damping: 12, mass: 1, velocity: 0 },
  stiff: { type: 'spring', stiffness: 320, damping: 28, mass: 1, velocity: 0 },
  slow: { type: 'spring', stiffness: 90, damping: 20, mass: 1.2, velocity: 0 },
};

export class SpringSolver {
  private readonly config: Required<SpringConfig>;

  constructor(config: SpringConfig) {
    this.config = normalizeSpringConfig(config);
  }

  solve(elapsedMs: number): number {
    const t = Math.max(elapsedMs, 0) / 1000;
    const { stiffness, damping, mass, velocity } = this.config;
    const omega0 = Math.sqrt(stiffness / mass);
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));
    const initialDisplacement = -1;

    if (zeta < 1) {
      const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
      const coefficient =
        (velocity + zeta * omega0 * initialDisplacement) / omegaD;
      const displacement =
        Math.exp(-zeta * omega0 * t) *
        (initialDisplacement * Math.cos(omegaD * t) + coefficient * Math.sin(omegaD * t));
      return 1 + displacement;
    }

    if (zeta === 1) {
      const displacement =
        (initialDisplacement + (velocity + omega0 * initialDisplacement) * t) *
        Math.exp(-omega0 * t);
      return 1 + displacement;
    }

    const r1 = -omega0 * (zeta - Math.sqrt(zeta * zeta - 1));
    const r2 = -omega0 * (zeta + Math.sqrt(zeta * zeta - 1));
    const c2 = (velocity - initialDisplacement * r1) / (r2 - r1);
    const c1 = initialDisplacement - c2;
    const displacement = c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
    return 1 + displacement;
  }

  estimateDurationMs(): number {
    let elapsedMs = 0;
    let previous = this.solve(0);

    while (elapsedMs < 5000) {
      elapsedMs += 16;
      const current = this.solve(elapsedMs);
      const velocity = Math.abs(current - previous);
      if (Math.abs(1 - current) < SETTLE_EPSILON && velocity < SETTLE_EPSILON) {
        return elapsedMs;
      }
      previous = current;
    }

    return 5000;
  }
}

export function springProgress(config: SpringConfig, elapsedMs: number): number {
  return new SpringSolver(config).solve(elapsedMs);
}

export function estimateSpringDuration(config: SpringConfig): number {
  return new SpringSolver(config).estimateDurationMs();
}

function normalizeSpringConfig(config: SpringConfig): Required<SpringConfig> {
  return {
    ...config,
    mass: config.mass ?? DEFAULT_MASS,
    velocity: config.velocity ?? DEFAULT_VELOCITY,
  };
}
