/**
 * `cuneiform init` — scaffold cuneiform.config.ts and source directory.
 *
 * Creates:
 *   cuneiform.config.ts           Config file at repo root
 *   cuneiform/                    Source directory (default: sourceDir = 'cuneiform')
 *   cuneiform/icons/              Icon source directory
 *   cuneiform/manifest.json       Empty manifest
 *
 * Existing files are never overwritten.
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const CONFIG_TEMPLATE = `import type { CuneiformConfig } from '@cuneiform/cli';

export default {
  sourceDir: 'cuneiform',
  hostTargets: [
    {
      kind: 'react-app',
      mode: 'live',
      runtimeMode: 'cache-dir',
      cacheDir: '.cuneiform/cache/app',
    },
  ],
  releaseTargets: [
    {
      kind: 'local-directory',
      outputMode: 'snapshot',
      outputDir: 'src/icons/generated',
    },
  ],
} satisfies CuneiformConfig;
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
  const configPath = path.join(cwd, 'cuneiform.config.ts');
  const sourceDirPath = path.join(cwd, 'cuneiform');
  const iconsDirPath = path.join(sourceDirPath, 'icons');
  const manifestPath = path.join(sourceDirPath, 'manifest.json');

  let anyCreated = false;

  if (!existsSync(configPath)) {
    await writeFile(configPath, CONFIG_TEMPLATE, 'utf8');
    log('created', 'cuneiform.config.ts');
    anyCreated = true;
  } else {
    log('exists ', 'cuneiform.config.ts');
  }

  if (!existsSync(sourceDirPath)) {
    await mkdir(sourceDirPath, { recursive: true });
    log('created', 'cuneiform/');
    anyCreated = true;
  }

  if (!existsSync(iconsDirPath)) {
    await mkdir(iconsDirPath, { recursive: true });
    log('created', 'cuneiform/icons/');
    anyCreated = true;
  }

  if (!existsSync(manifestPath)) {
    await writeFile(manifestPath, emptyManifest(), 'utf8');
    log('created', 'cuneiform/manifest.json');
    anyCreated = true;
  }

  if (anyCreated) {
    console.log(`
[cuneiform] Initialized successfully.

Next steps:
  1.  Run \`cuneiform dev\` to start the live integration server
  2.  Open the Cuneiform editor and connect to this repository
       (set the dev server URL to http://localhost:4400)
  3.  Publish icons from the editor — they will appear in cuneiform/icons/
  4.  Run \`cuneiform build\` to produce a snapshot build for CI
  5.  Commit cuneiform/ to version-control as your canonical icon source

See docs at https://cuneiform.dev/docs/getting-started
`);
  } else {
    console.log('[cuneiform] Already initialized — nothing to create.');
  }
}

function log(action: string, file: string): void {
  console.log(`  ${action}  ${file}`);
}
