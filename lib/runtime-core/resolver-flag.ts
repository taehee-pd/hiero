/**
 * Feature-flag gate for the V2 resolver cascade (W4-10).
 *
 * `NEXT_PUBLIC_HIERO_RESOLVER_V2 === '1'` opts into the new
 * cascade; anything else (default) keeps the legacy `autoMorph`
 * path. Consumers route through {@link isResolverV2Enabled} so
 * the gate is constant-folded by Webpack and the flag-off code
 * path strips out at production-build time.
 *
 * Flag-flip is W5 territory after the calibration corpus passes;
 * W4-10 ships the gate ready for activation. The legacy resolver
 * stays in the bundle until W5 deletes it.
 *
 * Plan: docs_canonical/ICON_TRANSITION_ROADMAP.md W4-10.
 *
 * @module
 */

/**
 * Pure gate read. The function body is two lines so Webpack can
 * fold it across boundaries; do NOT introduce side effects here.
 */
export function isResolverV2Enabled(): boolean {
  return process.env.NEXT_PUBLIC_HIERO_RESOLVER_V2 === '1';
}
