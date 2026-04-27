import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the route-shell smoke suite (tests/e2e/).
 *
 * Why a separate runner from bun:test: bun:test boots happy-dom and runs JS
 * unit tests in <5s; Playwright drives a real browser against a built
 * Next.js server and exists to catch the bugs unit tests can't see (broken
 * client redirects, hydration failures, missing testids on the *rendered*
 * shell). Keeping the two stacks separate avoids ~30s of dead time on every
 * `pnpm test` run.
 *
 * Run: `pnpm test:e2e` (see package.json). The CI job
 * `.github/workflows/route-shell.yml` runs the same command.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    // Reduce-motion to suppress entry animations that race with assertions.
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm start -- -p 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
