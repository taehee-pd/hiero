const isExportMode = process.env.NEXT_OUTPUT_MODE === 'export';
const exportAssetPrefix = '';
const exportBasePath = '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_OUTPUT_MODE: process.env.NEXT_OUTPUT_MODE ?? '',
  },
  output: isExportMode ? 'export' : undefined,
  basePath: isExportMode ? exportBasePath : undefined,
  assetPrefix: isExportMode ? exportAssetPrefix : undefined,
};

export default nextConfig;
