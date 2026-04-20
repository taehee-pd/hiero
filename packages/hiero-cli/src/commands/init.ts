/**
 * `hiero init` — scaffold hiero.config.ts and source directory.
 *
 * Creates:
 *   hiero.config.ts           Config file at repo root
 *   hiero/                    Source directory (default: sourceDir = 'hiero')
 *   hiero/icons/              Icon source directory
 *   hiero/manifest.json       Empty manifest
 *
 * Existing files are never overwritten.
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const CONFIG_TEMPLATE = `import type { HieroConfig } from '@hiero/cli';

export default {
  sourceDir: 'hiero',
  hostTargets: [
    {
      kind: 'react-app',
      mode: 'live',
      runtimeMode: 'cache-dir',
      cacheDir: '.hiero/cache/app',
    },
  ],
  releaseTargets: [
    {
      kind: 'local-directory',
      outputMode: 'snapshot',
      outputDir: 'src/icons/generated',
    },
  ],
} satisfies HieroConfig;
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
  const configPath = path.join(cwd, 'hiero.config.ts');
  const sourceDirPath = path.join(cwd, 'hiero');
  const iconsDirPath = path.join(sourceDirPath, 'icons');
  const manifestPath = path.join(sourceDirPath, 'manifest.json');

  let anyCreated = false;

  if (!existsSync(configPath)) {
    await writeFile(configPath, CONFIG_TEMPLATE, 'utf8');
    log('created', 'hiero.config.ts');
    anyCreated = true;
  } else {
    log('exists ', 'hiero.config.ts');
  }

  if (!existsSync(sourceDirPath)) {
    await mkdir(sourceDirPath, { recursive: true });
    log('created', 'hiero/');
    anyCreated = true;
  }

  if (!existsSync(iconsDirPath)) {
    await mkdir(iconsDirPath, { recursive: true });
    log('created', 'hiero/icons/');
    anyCreated = true;
  }

  if (!existsSync(manifestPath)) {
    await writeFile(manifestPath, emptyManifest(), 'utf8');
    log('created', 'hiero/manifest.json');
    anyCreated = true;
  }

  if (anyCreated) {
    console.log(`
[hiero] Initialized successfully.

Next steps:
  1.  Run \`hiero dev\` to start the live integration server
  2.  Open the Hiero editor and connect to this repository
       (set the dev server URL to http://localhost:4400)
  3.  Publish icons from the editor — they will appear in hiero/icons/
  4.  Run \`hiero build\` to produce a snapshot build for CI
  5.  Commit hiero/ to version-control as your canonical icon source

See docs at https://hiero.dev/docs/getting-started
`);
  } else {
    console.log('[hiero] Already initialized — nothing to create.');
  }
}

function log(action: string, file: string): void {
  console.log(`  ${action}  ${file}`);
}
