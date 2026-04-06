/**
 * `contour init` — scaffold contour.config.ts and source directory.
 *
 * Creates:
 *   contour.config.ts           Config file at repo root
 *   contour/                    Source directory (default: sourceDir = 'contour')
 *   contour/icons/              Icon source directory
 *   contour/manifest.json       Empty manifest
 *
 * Existing files are never overwritten.
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const CONFIG_TEMPLATE = `import type { ContourConfig } from '@contour/cli';

export default {
  sourceDir: 'contour',
  hostTargets: [
    {
      kind: 'react-app',
      mode: 'live',
      runtimeMode: 'cache-dir',
      cacheDir: '.contour/cache/app',
    },
  ],
  releaseTargets: [
    {
      kind: 'local-directory',
      outputMode: 'snapshot',
      outputDir: 'src/icons/generated',
    },
  ],
} satisfies ContourConfig;
`;

function emptyManifest(): string {
  return (
    JSON.stringify(
      {
        schemaVersion: '1.0.0',
        generatedAt: new Date().toISOString(),
        iconCount: 0,
        icons: {},
      },
      null,
      2,
    ) + '\n'
  );
}

// ---------------------------------------------------------------------------
// Command implementation
// ---------------------------------------------------------------------------

export async function runInit(
  cwd: string,
  _flags: Record<string, string | boolean>,
): Promise<void> {
  const configPath = path.join(cwd, 'contour.config.ts');
  const sourceDirPath = path.join(cwd, 'contour');
  const iconsDirPath = path.join(sourceDirPath, 'icons');
  const manifestPath = path.join(sourceDirPath, 'manifest.json');

  let anyCreated = false;

  if (!existsSync(configPath)) {
    await writeFile(configPath, CONFIG_TEMPLATE, 'utf8');
    log('created', 'contour.config.ts');
    anyCreated = true;
  } else {
    log('exists ', 'contour.config.ts');
  }

  if (!existsSync(sourceDirPath)) {
    await mkdir(sourceDirPath, { recursive: true });
    log('created', 'contour/');
    anyCreated = true;
  }

  if (!existsSync(iconsDirPath)) {
    await mkdir(iconsDirPath, { recursive: true });
    log('created', 'contour/icons/');
    anyCreated = true;
  }

  if (!existsSync(manifestPath)) {
    await writeFile(manifestPath, emptyManifest(), 'utf8');
    log('created', 'contour/manifest.json');
    anyCreated = true;
  }

  if (anyCreated) {
    console.log(`
[contour] Initialized successfully.

Next steps:
  1.  Run \`contour dev\` to start the live integration server
  2.  Open the Contour editor and connect to this repository
       (set the dev server URL to http://localhost:4400)
  3.  Publish icons from the editor — they will appear in contour/icons/
  4.  Run \`contour build\` to produce a snapshot build for CI
  5.  Commit contour/ to version-control as your canonical icon source

See docs at https://contour.dev/docs/getting-started
`);
  } else {
    console.log('[contour] Already initialized — nothing to create.');
  }
}

function log(action: string, file: string): void {
  console.log(`  ${action}  ${file}`);
}
