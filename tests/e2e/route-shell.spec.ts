import { expect, test } from '@playwright/test';

import {
  PAGE_REGISTRY,
  REGISTERED_ROUTES,
  type RoutePath,
} from '../../lib/routes/page-registry';

/**
 * Route-shell consistency smoke test (Layer 2 of the route-divergence
 * defense; Layer 1 is `scripts/check-page-registry.ts`).
 *
 * Layer 1 proves at build time that every page enrols in the registry.
 * This file proves at runtime that those pages actually arrive at the right
 * shell — including via redirects.
 *
 * Driven entirely by PAGE_REGISTRY: adding a new route there automatically
 * adds coverage here. Skipped: standalone routes (they don't share a shell,
 * so there's nothing to assert).
 */

// Concrete URL each test should navigate to. For dynamic routes like
// `/editor/[iconId]` we substitute a real id so Next.js can resolve it.
function navigationUrl(route: RoutePath): string {
  return route.replace('[iconId]', 'desktop-shell');
}

// Resolve a redirect chain to its final non-redirect shell entry. Pages can
// chain in principle (A → B → C); in practice they don't, but this handles
// it and detects accidental cycles.
function resolveShell(start: RoutePath): {
  shell: string;
  finalRoute: RoutePath;
} {
  const seen = new Set<RoutePath>();
  let current: RoutePath = start;
  while (true) {
    if (seen.has(current)) {
      throw new Error(`Redirect cycle detected starting at ${start}: ${[...seen, current].join(' → ')}`);
    }
    seen.add(current);
    const def = PAGE_REGISTRY[current];
    if (def.kind === 'redirect') {
      current = def.to;
      continue;
    }
    if (def.kind === 'shell') {
      return { shell: def.shell, finalRoute: current };
    }
    throw new Error(`Route ${start} resolves to standalone (${current}); not in scope for this spec`);
  }
}

const SHELL_TESTID = {
  StudioLayout: 'studio-layout-root',
} as const;

for (const route of REGISTERED_ROUTES) {
  const def = PAGE_REGISTRY[route];

  if (def.kind === 'standalone') {
    // Demo pages aren't governed by shell consistency; skip with a marker so
    // CI output makes the omission visible rather than mysterious.
    test.skip(`${route} (standalone — no shell to assert)`, () => {});
    continue;
  }

  test(`${route} renders the canonical shell`, async ({ page }) => {
    const startUrl = navigationUrl(route);
    await page.goto(startUrl);

    // For redirect routes, wait for the URL to transition to the resolved
    // target before asserting the testid. This catches "the redirect went
    // to /404" or "the redirect didn't fire at all" — the failure modes
    // that justify a runtime check on top of Layer 1.
    if (def.kind === 'redirect') {
      const { finalRoute } = resolveShell(route);
      const expectedPath = finalRoute === '/' ? '/' : finalRoute;
      await page.waitForURL((url) => {
        // Allow the search-string portion (?project=, ?icon=) to differ —
        // we only check that the path landed at the redirect target.
        return url.pathname === expectedPath;
      }, { timeout: 10_000 });
    }

    const { shell } = resolveShell(route);
    const testid = SHELL_TESTID[shell as keyof typeof SHELL_TESTID];
    await expect(
      page.getByTestId(testid),
      `Expected to find data-testid="${testid}" after navigating to ${startUrl}`,
    ).toBeVisible({ timeout: 10_000 });
  });
}
