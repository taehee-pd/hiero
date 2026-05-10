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
    // `fast-bitset@1.3.2` (transitive dep of `hungarian-on3`) declares its
    // class as `BitSet = function(...)` without `var`/`let`/`const`,
    // relying on sloppy-mode implicit globals. Vite/Rollup wraps the CJS
    // file in an ESM module which is strict by default, so the assignment
    // throws "BitSet is not defined" at runtime — Chromatic's iframe hits
    // this even though `pnpm build-storybook` succeeds at parse time.
    // Prepend a `var BitSet;` declaration to the offending file so the
    // assignment lands on a real binding.
    viteConfig.plugins ??= [];
    viteConfig.plugins.push({
      name: 'patch-fast-bitset-strict-mode',
      enforce: 'pre',
      transform(code: string, id: string) {
        if (id.includes('fast-bitset') && id.endsWith('BitSet.js')) {
          return { code: `var BitSet;\n${code}`, map: null };
        }
        return null;
      },
    });
    // In dev, Vite prebundles `fast-bitset` (via `optimizeDeps` → esbuild)
    // before the regular transform pipeline runs, so the plugin above never
    // sees it and the prebundled chunk still throws `BitSet is not defined`
    // when the iframe loads. Apply the same one-line patch as an esbuild
    // plugin so it lands during the prebundle step too.
    viteConfig.optimizeDeps ??= {};
    viteConfig.optimizeDeps.esbuildOptions ??= {};
    viteConfig.optimizeDeps.esbuildOptions.plugins ??= [];
    viteConfig.optimizeDeps.esbuildOptions.plugins.push({
      name: 'patch-fast-bitset-strict-mode-prebundle',
      setup(build) {
        build.onLoad({ filter: /fast-bitset[\\/].*BitSet\.js$/ }, async (args) => {
          const { readFile } = await import('node:fs/promises');
          const code = await readFile(args.path, 'utf8');
          return { contents: `var BitSet;\n${code}`, loader: 'js' };
        });
      },
    });
    return viteConfig;
  },
};

export default config;
