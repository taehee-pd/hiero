import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Vitest workspace for the Storybook addon. Kept separate from bun test —
// bun test still runs tests/** as today. Story discovery is driven by the
// Storybook config's `stories` field, not test.include.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
  test: {
    name: 'storybook',
    setupFiles: ['./.storybook/vitest.setup.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: 'playwright',
      instances: [{ browser: 'chromium' }],
    },
  },
  plugins: [
    storybookTest({
      configDir: resolve(__dirname, '.storybook'),
    }),
  ],
});
