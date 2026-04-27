/**
 * Build channel — single source of truth for which artifact this is.
 *
 * Two channels exist:
 *   - `public`   — what end users see. Strips internal admin features,
 *                  excludes the bundled @hiero/ui-icons source data,
 *                  shows only the app version in the navbar chip.
 *   - `internal` — what maintainers use to dogfood the editor against
 *                  the canonical icon set. Adds maintenance toolbar
 *                  actions and the full version triple in the chip.
 *
 * Default is `public`. A missing or unrecognized env var resolves to
 * `public` so a deployment misconfiguration can't silently leak
 * internal features. To opt in, set `NEXT_PUBLIC_BUILD_CHANNEL=internal`
 * at build time.
 *
 * Because the env var is `NEXT_PUBLIC_*`, Next.js inlines it at build
 * time and the bundler dead-code-eliminates the false branch of
 * `if (IS_INTERNAL_BUILD)` checks. Combined with dynamic imports for
 * the helper modules, this keeps the public bundle free of internal
 * code paths and data.
 */

export type BuildChannel = 'public' | 'internal';

function readChannel(): BuildChannel {
  return process.env.NEXT_PUBLIC_BUILD_CHANNEL === 'internal'
    ? 'internal'
    : 'public';
}

export const BUILD_CHANNEL: BuildChannel = readChannel();
export const IS_INTERNAL_BUILD: boolean = BUILD_CHANNEL === 'internal';
export const IS_PUBLIC_BUILD: boolean = BUILD_CHANNEL === 'public';
