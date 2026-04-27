import type { StorybookConfig } from '@storybook/nextjs-vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const config: StorybookConfig = {
  stories: [
    '../components/**/*.stories.@(tsx|mdx)',
    '../components/**/*.mdx',
    // Page-level stories (one per registered route in lib/routes/page-registry).
    // Captured by Chromatic so visual drift at the route level is gated by
    // the same PR check that already gates leaf component drift.
    '../app/_storybook/**/*.stories.@(tsx|mdx)',
  ],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
    '@storybook/addon-vitest',
  ],
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
  features: {
    experimentalRSC: true,
  },
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
  },
  async viteFinal(viteConfig) {
    viteConfig.resolve ??= {};
    viteConfig.resolve.alias = {
      ...(viteConfig.resolve.alias ?? {}),
      '@': projectRoot,
    };
    return viteConfig;
  },
};

export default config;
