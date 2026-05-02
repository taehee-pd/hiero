/**
 * Transition resolver telemetry (W5-6).
 *
 * Lightweight hook for production runtime to record what the
 * cascade picked. Pluggable: pass an emitter when constructing
 * the runtime; defaults to no-op so SSR and test environments
 * stay quiet.
 *
 * Schema is stable across deploys — the dashboard consumes
 * `(tier, signalKind, distortion, durationMs, taxonomy)` as the
 * minimum useful 5-tuple. `iconSetVersion` lets ops slice by
 * release for the post-update fallback-rate alarm called out in
 * the roadmap.
 *
 * Plan: docs_canonical/ICON_TRANSITION_ROADMAP.md W5-6.
 *
 * @module
 */
import type { MorphResolution } from './morph-resolution';

/**
 * One record the dashboard ingests. Field-name stability matters —
 * downstream queries pin on these names.
 */
export type TelemetryEvent = {
  /** ISO-8601 wall-clock at the time of resolution. */
  recordedAt: string;
  /** Cascade tier the resolver landed on. */
  tier: MorphResolution['tier'];
  /** Topology classifier output, for slicing by category. */
  taxonomy: MorphResolution['taxonomy'];
  /** Self-reported distortion estimate from the chosen tier. */
  distortion: number;
  /** When the cascade fell to a fallback, the structured signal kind. */
  signalKind: string | null;
  /**
   * The transition's authored duration in ms — useful for the
   * "did the user override the project default" slice.
   */
  durationMs: number;
  /**
   * Caller-supplied icon-set version (e.g. `@hiero/ui-icons` semver).
   * The roadmap's ops alarm slices by this to spot fallback-rate
   * regressions after an icon-set update.
   */
  iconSetVersion: string | null;
};

/**
 * Pluggable emitter. Real implementations push to the runtime's
 * analytics channel; the test stub captures into an array; SSR
 * uses the no-op default.
 */
export type TelemetryEmitter = (event: TelemetryEvent) => void;

const NOOP_EMITTER: TelemetryEmitter = () => {};

let active: TelemetryEmitter = NOOP_EMITTER;

/**
 * Replace the active emitter. Returns the previous one so
 * tests can restore.
 */
export function setTelemetryEmitter(emitter: TelemetryEmitter): TelemetryEmitter {
  const prev = active;
  active = emitter;
  return prev;
}

/**
 * Emit one cascade-resolution event. Pure aside from the
 * emitter side-effect; safe to call inside hot paths.
 */
export function emitResolutionEvent(
  resolution: MorphResolution,
  meta: { durationMs: number; iconSetVersion?: string | null },
): void {
  active({
    recordedAt: new Date().toISOString(),
    tier: resolution.tier,
    taxonomy: resolution.taxonomy,
    distortion: resolution.distortion,
    signalKind: resolution.signal?.kind ?? null,
    durationMs: meta.durationMs,
    iconSetVersion: meta.iconSetVersion ?? null,
  });
}

/**
 * Build a test/dev emitter that captures events into the
 * provided array. Use in unit tests to verify wiring; in dev
 * surfaces to inspect tier-pick distribution.
 */
export function captureToBuffer(
  buffer: TelemetryEvent[],
): TelemetryEmitter {
  return (event) => {
    buffer.push(event);
  };
}
