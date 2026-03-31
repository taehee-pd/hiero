/**
 * `coniva init` — scaffold coniva.config.ts and source directory.
 *
 * Creates:
 *   coniva.config.ts           Config file at repo root
 *   coniva/                    Source directory (default: sourceDir = 'coniva')
 *   coniva/icons/              Icon source directory
 *   coniva/manifest.json       Empty manifest
 *
 * Existing files are never overwritten.
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const CONFIG_TEMPLATE = `import type { ConivaConfig } from '@coniva/cli';

export default {
  sourceDir: 'coniva',
  hostTargets: [
    {
      kind: 'react-app',
      mode: 'live',
      runtimeMode: 'cache-dir',
      cacheDir: '.coniva/cache/app',
    },
  ],
  releaseTargets: [
    {
      kind: 'local-directory',
      outputMode: 'snapshot',
      outputDir: 'src/icons/generated',
    },
  ],
} satisfies ConivaConfig;
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
  const configPath = path.join(cwd, 'coniva.config.ts');
  const sourceDirPath = path.join(cwd, 'coniva');
  const iconsDirPath = path.join(sourceDirPath, 'icons');
  const manifestPath = path.join(sourceDirPath, 'manifest.json');

  let anyCreated = false;

  if (!existsSync(configPath)) {
    await writeFile(configPath, CONFIG_TEMPLATE, 'utf8');
    log('created', 'coniva.config.ts');
    anyCreated = true;
  } else {
    log('exists ', 'coniva.config.ts');
  }

  if (!existsSync(sourceDirPath)) {
    await mkdir(sourceDirPath, { recursive: true });
    log('created', 'coniva/');
    anyCreated = true;
  }

  if (!existsSync(iconsDirPath)) {
    await mkdir(iconsDirPath, { recursive: true });
    log('created', 'coniva/icons/');
    anyCreated = true;
  }

  if (!existsSync(manifestPath)) {
    await writeFile(manifestPath, emptyManifest(), 'utf8');
    log('created', 'coniva/manifest.json');
    anyCreated = true;
  }

  if (anyCreated) {
    console.log(`
[coniva] Initialized successfully.

Next steps:
  1.  Run \`coniva dev\` to start the live integration server
  2.  Open the Coniva editor and connect to this repository
       (set the dev server URL to http://localhost:4400)
  3.  Publish icons from the editor — they will appear in coniva/icons/
  4.  Run \`coniva build\` to produce a snapshot build for CI
  5.  Commit coniva/ to version-control as your canonical icon source

See docs at https://coniva.dev/docs/getting-started
`);
  } else {
    console.log('[coniva] Already initialized — nothing to create.');
  }
}

function log(action: string, file: string): void {
  console.log(`  ${action}  ${file}`);
}
