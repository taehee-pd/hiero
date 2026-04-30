import { expect, test } from '@playwright/test';

import {
  PAGE_REGISTRY,
  REGISTERED_ROUTES,
  type RoutePath,
} from '../../lib/routes/page-registry';
import { resolveShell } from '../../lib/routes/resolve-shell';

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

// resolveShell() lives in lib/routes/resolve-shell.ts so its cycle guard
// is unit-testable from tests/resolve-shell.test.ts. This file just
// dispatches on the result.

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

// Build identification surface — the channel + version triple is set in
// next.config.mjs's headers() block AND inlined into the HTML <head> via
// app/layout.tsx. Either path is enough for ops introspection; this spec
// asserts the HTTP-header path works for the canonical shell route.
test('X-Hiero-Build-Channel response header is present on /', async ({ request }) => {
  const response = await request.get('/');
  const channel = response.headers()['x-hiero-build-channel'];
  expect(channel, 'X-Hiero-Build-Channel header should be set by next.config.mjs').toBeTruthy();
  expect(['public', 'internal']).toContain(channel);
});

test('window.__HIERO_BUILD__ global is set before any client interaction', async ({ page }) => {
  await page.goto('/');
  const build = await page.evaluate(() => {
    return (window as Window & { __HIERO_BUILD__?: { channel?: string; app?: string } }).__HIERO_BUILD__;
  });
  expect(build, 'window.__HIERO_BUILD__ should be inlined by app/layout.tsx').toBeTruthy();
  expect(build?.channel).toBeTruthy();
  expect(build?.app).toBeTruthy();
});

// Phase 2.5 wiring fix coverage. These assertions guard against
// regressions where the Publish + History entry points get accidentally
// removed or relabeled. Each one targets a stable data-testid set in
// components/studio/Navbar.tsx so the test is robust against icon /
// label changes.
test('/ exposes Publish + History buttons in the Navbar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('navbar-publish')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('navbar-history')).toBeVisible();
});

test('Clicking Navbar Publish opens the unified Publish dialog', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('navbar-publish').click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('dialog')).toContainText('Publish');
});

test('/history mounts the same Navbar chrome', async ({ page }) => {
  await page.goto('/history');
  // Navbar contributes the Publish + History buttons on this route too.
  await expect(page.getByTestId('navbar-publish')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('navbar-history')).toBeVisible();
  // The history-view body is also present.
  await expect(page.getByTestId('history-view')).toBeVisible();
});
