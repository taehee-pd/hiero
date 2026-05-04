/**
 * Cascade-aware export sampling (W4-1 + W4-2).
 *
 * Bridges {@link MorphResolution} into the export pipeline.
 * Lottie / compiled-icon exports sample the resolution at the
 * target frame rate and emit `(d, alpha)` keyframes that the
 * runtime SDK / Lottie player evaluates back at playback time.
 *
 * The same sampler the runtime uses ({@link sampleMorph}) feeds
 * the export — preview ≡ runtime ≡ export by construction. ARAP-
 * augmented tiers (W4-1) sample through the same path; when the
 * ARAP solver lands (deferred until `poly2tri` installs), this
 * sampler delegates to it without changing the export shape.
 *
 * Plan: docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §10,
 * docs_canonical/ICON_TRANSITION_ROADMAP.md W4-1, W4-2.
 *
 * @module
 */
import type { MorphResolution } from './morph-resolution';
import { sampleMorph, type MorphFrame } from './cascade-scheduler';

/**
 * One keyframe in an exported transition. The keyframe carries
 * normalized progress (`t`), the rendered path string at that `t`,
 * and the opacity the player should apply. Lottie's `tm` shape +
 * `o` opacity property map directly to these fields.
 */
export type ExportKeyframe = {
  t: number;
  d: string;
  alpha: number;
};

export type ExportSamplingOptions = {
  /**
   * Target playback frame rate. Used (with `durationMs`) to compute
   * how many keyframes to emit. Default 30 fps — Lottie's standard.
   */
  fps?: number;
  /** Total duration the export will play across, in milliseconds. */
  durationMs: number;
  /**
   * Override: emit exactly this many keyframes regardless of fps.
   * When set, `fps` is ignored. Useful for low-fidelity exports
   * (e.g., compiled-icon JSON wants 9 keyframes max for size).
   */
  frameCount?: number;
};

/**
 * Sample a {@link MorphResolution} at the export's target frame
 * rate and emit a flat keyframe array. The first keyframe is at
 * `t=0`, the last at `t=1`; intermediate keyframes are evenly
 * spaced.
 *
 * Continuous-morph tiers (intrinsic-strict, hierarchical-match,
 * compound-isomorphic, identity) emit per-frame `d` strings with
 * `alpha=1` throughout. Designed-fallback / draw-coordinated
 * emit a V-shaped opacity envelope matching the runtime's
 * playback shape.
 */
export function sampleForExport(
  resolution: MorphResolution,
  options: ExportSamplingOptions,
): ExportKeyframe[] {
  const frameCount = computeFrameCount(options);
  if (frameCount < 2) {
    throw new Error(
      `sampleForExport requires frameCount >= 2 (got ${frameCount}; ` +
        `fps=${options.fps ?? 30}, durationMs=${options.durationMs})`,
    );
  }
  const out: ExportKeyframe[] = [];
  for (let i = 0; i < frameCount; i++) {
    const t = i / (frameCount - 1);
    const frame: MorphFrame = sampleMorph(resolution, t);
    out.push({ t, d: frame.d, alpha: frame.alpha });
  }
  return out;
}

/**
 * Convenience: sample for the default Lottie export (30 fps).
 */
export function sampleForLottie(
  resolution: MorphResolution,
  durationMs: number,
): ExportKeyframe[] {
  return sampleForExport(resolution, { fps: 30, durationMs });
}

/**
 * Convenience: sample for a compact compiled-icon export. Caps
 * the keyframe count to avoid bloating bundle size — the SDK
 * interpolates between samples at runtime.
 */
export function sampleForCompiledIcon(
  resolution: MorphResolution,
  durationMs: number,
): ExportKeyframe[] {
  // 16 keyframes is the W3 calibration default; W5-3 may tune.
  return sampleForExport(resolution, { frameCount: 16, durationMs });
}

function computeFrameCount(options: ExportSamplingOptions): number {
  if (options.frameCount !== undefined) {
    return Math.max(2, Math.floor(options.frameCount));
  }
  const fps = options.fps ?? 30;
  if (!Number.isFinite(fps) || fps <= 0) return 2;
  if (!Number.isFinite(options.durationMs) || options.durationMs <= 0) return 2;
  // +1 — N seconds at fps frames per second produce `N*fps + 1`
  // keyframes (the trailing endpoint).
  return Math.max(2, Math.ceil((options.durationMs / 1000) * fps) + 1);
}
