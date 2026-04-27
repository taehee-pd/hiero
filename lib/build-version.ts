/**
 * Build version surface — read by:
 *
 *   - The navbar's `<BuildBadge>` chip, so any user (or a screenshot of
 *     a bug report) can identify exactly which build they're on.
 *   - `window.__HIERO_BUILD__`, set in `app/layout.tsx`, so Playwright
 *     smoke tests + ops can read the version without scraping the DOM.
 *   - The `X-Hiero-Build-Channel` HTTP header from `next.config.mjs`,
 *     for ops introspection without booting the page.
 *
 * Sources:
 *   - `channel`              — from lib/build-flags (NEXT_PUBLIC_BUILD_CHANNEL).
 *   - `app`                  — NEXT_PUBLIC_APP_VERSION (CI: package.json#version).
 *   - `commit`               — NEXT_PUBLIC_BUILD_COMMIT (CI: short git sha).
 *   - `builtAt`              — NEXT_PUBLIC_BUILD_TIME  (CI: ISO timestamp).
 *   - `hieroUiIconsVersion`  — NEXT_PUBLIC_HIERO_UI_ICONS_VERSION
 *                              (CI: packages/hiero-ui-icons/package.json#version).
 *
 * All env vars are optional; sensible dev fallbacks keep `pnpm dev`
 * working without env-file ceremony. CI always populates them so
 * deployed builds carry truthful identifiers.
 */

import { BUILD_CHANNEL, type BuildChannel } from './build-flags';

export type BuildVersion = {
  channel: BuildChannel;
  app: string;
  commit: string;
  builtAt: string;
  hieroUiIconsVersion: string;
};

declare global {
  interface Window {
    /**
     * Set by `app/layout.tsx` before any client code runs. Read by
     * Playwright smoke tests + bug-report tooling. Frozen so consumers
     * can't accidentally mutate it.
     */
    __HIERO_BUILD__?: Readonly<BuildVersion>;
  }
}

const DEV_FALLBACK_TIME = '1970-01-01T00:00:00.000Z';

export const BUILD_VERSION: BuildVersion = {
  channel: BUILD_CHANNEL,
  app: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0-dev',
  commit: process.env.NEXT_PUBLIC_BUILD_COMMIT ?? 'dev',
  builtAt: process.env.NEXT_PUBLIC_BUILD_TIME ?? DEV_FALLBACK_TIME,
  hieroUiIconsVersion:
    process.env.NEXT_PUBLIC_HIERO_UI_ICONS_VERSION ?? '0.0.0-dev',
};

/**
 * Compact one-line representation for log lines, error reports, and the
 * navbar chip's `title` (hover tooltip). Always emits all five fields
 * so a screenshot is self-describing regardless of channel.
 */
export function formatBuildVersion(v: BuildVersion = BUILD_VERSION): string {
  return `${v.channel} · v${v.app} · ${v.commit} · ui-icons ${v.hieroUiIconsVersion} · ${v.builtAt}`;
}
