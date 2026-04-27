'use client';

import { BUILD_VERSION, formatBuildVersion } from '@/lib/build-version';
import { IS_INTERNAL_BUILD } from '@/lib/build-flags';

/**
 * Compact build identifier shown in the navbar.
 *
 * Public builds show just the app version (e.g. `v0.1.0`) so end users
 * have a stable thing to quote in bug reports without seeing the
 * commit-level detail.
 *
 * Internal builds show the full triple inline (`internal · v0.1.0 ·
 * abc123`) so maintainers can tell at a glance which deploy a tab is
 * pinned to. The full five-field version (including ui-icons version
 * and built-at timestamp) is on the hover `title` for both channels.
 *
 * Why this lives in the navbar at all: the original "two routes drifted
 * into different shells" bug went undetected for so long partly because
 * a teammate looking at a deployed URL had no way to tell which build
 * they were on. A visible chip closes that loop.
 */
export function BuildBadge() {
  const tooltip = formatBuildVersion();

  if (!IS_INTERNAL_BUILD) {
    return (
      <span
        data-testid="build-badge"
        data-build-channel="public"
        title={tooltip}
        className="ml-1 select-none rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground"
      >
        v{BUILD_VERSION.app}
      </span>
    );
  }

  // Internal: surface the commit short-sha inline so a maintainer
  // staring at the navbar can match it to their PR without hovering.
  return (
    <span
      data-testid="build-badge"
      data-build-channel="internal"
      title={tooltip}
      className="ml-1 select-none rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium tabular-nums text-amber-700 dark:text-amber-300"
    >
      internal · v{BUILD_VERSION.app} · {BUILD_VERSION.commit}
    </span>
  );
}
