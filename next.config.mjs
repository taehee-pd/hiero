import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const isExportMode = process.env.NEXT_OUTPUT_MODE === 'export';
const exportAssetPrefix = '';
const exportBasePath = '';

// Build channel: 'public' (default) or 'internal'. Inlined into the bundle
// via NEXT_PUBLIC_BUILD_CHANNEL so dead-code-elimination strips internal
// branches from the public artifact. See lib/build-flags.ts.
const buildChannel =
  process.env.NEXT_PUBLIC_BUILD_CHANNEL === 'internal' ? 'internal' : 'public';

// Version surface — populated by CI; sane fallbacks for local dev so the
// app boots without env-file ceremony. See lib/build-version.ts for how
// these are consumed.
function readJsonField(path, field, fallback) {
  try {
    const json = JSON.parse(readFileSync(path, 'utf-8'));
    return json[field] ?? fallback;
  } catch {
    return fallback;
  }
}

const appVersion =
  process.env.NEXT_PUBLIC_APP_VERSION ??
  readJsonField(resolve(__dirname, 'package.json'), 'version', '0.0.0-dev');

const hieroUiIconsVersion =
  process.env.NEXT_PUBLIC_HIERO_UI_ICONS_VERSION ??
  readJsonField(
    resolve(__dirname, 'packages/hiero-ui-icons/package.json'),
    'version',
    '0.0.0-dev',
  );

const buildCommit = process.env.NEXT_PUBLIC_BUILD_COMMIT ?? 'dev';
const buildTime =
  process.env.NEXT_PUBLIC_BUILD_TIME ?? new Date().toISOString();

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Workspace packages ship source TSX and rely on the app's TypeScript
  // pipeline for transpilation.
  transpilePackages: ['@hiero/ui-icons'],
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_OUTPUT_MODE: process.env.NEXT_OUTPUT_MODE ?? '',
    NEXT_PUBLIC_BUILD_CHANNEL: buildChannel,
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_BUILD_COMMIT: buildCommit,
    NEXT_PUBLIC_BUILD_TIME: buildTime,
    NEXT_PUBLIC_HIERO_UI_ICONS_VERSION: hieroUiIconsVersion,
  },
  // Ops introspection: hit any deployed URL and read these headers to
  // identify the channel + version without having to load the page.
  // Skipped in static-export mode (no server to set headers).
  ...(isExportMode
    ? {}
    : {
        async headers() {
          return [
            {
              source: '/:path*',
              headers: [
                { key: 'X-Hiero-Build-Channel', value: buildChannel },
                { key: 'X-Hiero-App-Version', value: appVersion },
                { key: 'X-Hiero-Build-Commit', value: buildCommit },
              ],
            },
          ];
        },
      }),
  output: isExportMode ? 'export' : undefined,
  basePath: isExportMode ? exportBasePath : undefined,
  assetPrefix: isExportMode ? exportAssetPrefix : undefined,
};

export default nextConfig;
