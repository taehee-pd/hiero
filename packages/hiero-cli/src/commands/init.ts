/**
 * `hiero init` — scaffold hiero.config.ts and source directory.
 *
 * Two modes:
 *   --yes (or non-TTY)  Non-interactive: writes the same template the
 *                       prior version of this command always wrote.
 *                       This path is the regression contract — existing
 *                       repos that re-run `hiero init` see the same files.
 *   default + TTY       Interactive prompts for sourceDir and one
 *                       release-target choice. Credentials are NEVER
 *                       written to hiero.config.ts; instead the wizard
 *                       prints which env vars are missing.
 *
 * Existing files are never overwritten in either mode.
 *
 * --check               Run config + credential health checks without
 *                       writing files. Exits 0 when healthy, 1 when not.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

type Defaults = {
  sourceDir: string;
  releaseTarget: 'local-directory' | 'git-pr' | 'npm-registry';
  outputDir: string;
};

const DEFAULTS: Defaults = {
  sourceDir: 'hiero',
  releaseTarget: 'local-directory',
  outputDir: 'src/icons/generated',
};

function configTemplate(d: Defaults): string {
  const releaseBlock =
    d.releaseTarget === 'local-directory'
      ? `  releaseTargets: [
    {
      kind: 'local-directory',
      outputMode: 'snapshot',
      outputDir: '${d.outputDir}',
    },
  ],`
      : d.releaseTarget === 'git-pr'
        ? `  releaseTargets: [
    {
      kind: 'git-pr',
      outputMode: 'snapshot',
      owner: 'YOUR_GITHUB_OWNER',
      repo: 'YOUR_GITHUB_REPO',
      baseBranch: 'main',
    },
  ],
  // Set HIERO_GITHUB_TOKEN in .env.local (and confirm .env.local is in
  // .gitignore) before running \`hiero build\` against this target.`
        : `  releaseTargets: [
    {
      kind: 'npm-registry',
      outputMode: 'snapshot',
      packageName: '@your-org/icons',
    },
  ],
  // Set NPM_TOKEN in .env.local (and confirm .env.local is in
  // .gitignore) before running \`hiero build\` against this target.`;

  return `import type { HieroConfig } from '@hiero/cli';

export default {
  sourceDir: '${d.sourceDir}',
  hostTargets: [
    {
      kind: 'react-app',
      mode: 'live',
      runtimeMode: 'cache-dir',
      cacheDir: '.hiero/cache/app',
    },
  ],
${releaseBlock}
} satisfies HieroConfig;
`;
}

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
// IO abstraction — lets tests drive the wizard deterministically.
// ---------------------------------------------------------------------------

export type InitIO = {
  log: (message: string) => void;
  prompt: (question: string, defaultValue?: string) => Promise<string>;
};

function defaultIO(): InitIO {
  let rl: ReturnType<typeof createInterface> | null = null;
  return {
    log: (message) => {
      console.log(message);
    },
    prompt: async (question, defaultValue) => {
      if (!rl) rl = createInterface({ input: process.stdin, output: process.stdout });
      const suffix = defaultValue ? ` (${defaultValue})` : '';
      const answer = await rl.question(`${question}${suffix} `);
      return answer.trim() || defaultValue || '';
    },
  };
}

// ---------------------------------------------------------------------------
// Health checks
// ---------------------------------------------------------------------------

export type HealthCheck = {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
};

export async function runHealthChecks(cwd: string): Promise<HealthCheck[]> {
  const out: HealthCheck[] = [];

  const configPath = path.join(cwd, 'hiero.config.ts');
  if (existsSync(configPath)) {
    out.push({
      name: 'hiero.config.ts',
      status: 'ok',
      detail: 'present',
    });
  } else {
    out.push({
      name: 'hiero.config.ts',
      status: 'fail',
      detail: 'missing — run `hiero init`',
    });
  }

  const envLocal = path.join(cwd, '.env.local');
  const gitignore = path.join(cwd, '.gitignore');
  if (existsSync(envLocal)) {
    let gitignored = false;
    if (existsSync(gitignore)) {
      const text = await readFile(gitignore, 'utf8');
      gitignored = /(^|\n)\.env\.local(\n|$)/.test(text);
    }
    out.push({
      name: '.env.local',
      status: gitignored ? 'ok' : 'fail',
      detail: gitignored
        ? 'gitignored'
        : 'present but NOT in .gitignore — risk of leaking credentials',
    });
  }

  const ghToken = process.env.HIERO_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
  out.push({
    name: 'GitHub token',
    status: ghToken ? 'ok' : 'warn',
    detail: ghToken
      ? 'env var set'
      : 'not set — required for git-pr release target',
  });

  const npmrc = path.join(cwd, '.npmrc');
  const npmrcHome = path.join(
    process.env.HOME ?? '',
    '.npmrc',
  );
  const npmAuthDetected =
    !!process.env.NPM_TOKEN ||
    (existsSync(npmrc) &&
      /(^|\n)(?:\/\/[^=]+:_authToken|_authToken)/.test(
        await readFile(npmrc, 'utf8').catch(() => ''),
      )) ||
    (existsSync(npmrcHome) &&
      /(^|\n)(?:\/\/[^=]+:_authToken|_authToken)/.test(
        await readFile(npmrcHome, 'utf8').catch(() => ''),
      ));
  out.push({
    name: 'npm credentials',
    status: npmAuthDetected ? 'ok' : 'warn',
    detail: npmAuthDetected
      ? 'token or .npmrc auth detected'
      : 'no NPM_TOKEN env var or .npmrc auth — required for npm-registry target',
  });

  return out;
}

// ---------------------------------------------------------------------------
// Command implementation
// ---------------------------------------------------------------------------

export async function runInit(
  cwd: string,
  flags: Record<string, string | boolean>,
  io: InitIO = defaultIO(),
): Promise<void> {
  if (flags['check']) {
    const checks = await runHealthChecks(cwd);
    let allOk = true;
    for (const c of checks) {
      const icon = c.status === 'ok' ? '✅' : c.status === 'warn' ? '⚠️ ' : '❌';
      io.log(`  ${icon}  ${c.name}: ${c.detail}`);
      if (c.status === 'fail') allOk = false;
    }
    if (!allOk) process.exitCode = 1;
    return;
  }

  const yes = !!flags['yes'] || flags['y'] === true;
  // Treat a non-TTY stdin (CI, pipes) as `--yes` automatically so this
  // command stays scriptable. Interactive mode is opt-in via TTY.
  const interactive = !yes && !!process.stdin.isTTY;

  let defaults = DEFAULTS;
  if (interactive) {
    io.log('[hiero] Interactive setup. Press Enter to accept defaults.');
    const sourceDir = await io.prompt('Source directory:', DEFAULTS.sourceDir);
    const releaseTargetRaw = await io.prompt(
      'Release target [local-directory|git-pr|npm-registry]:',
      DEFAULTS.releaseTarget,
    );
    const releaseTarget: Defaults['releaseTarget'] =
      releaseTargetRaw === 'git-pr' || releaseTargetRaw === 'npm-registry'
        ? releaseTargetRaw
        : 'local-directory';
    let outputDir = DEFAULTS.outputDir;
    if (releaseTarget === 'local-directory') {
      outputDir = await io.prompt('Output directory:', DEFAULTS.outputDir);
    }
    defaults = { sourceDir, releaseTarget, outputDir };
  }

  const configPath = path.join(cwd, 'hiero.config.ts');
  const sourceDirPath = path.join(cwd, defaults.sourceDir);
  const iconsDirPath = path.join(sourceDirPath, 'icons');
  const manifestPath = path.join(sourceDirPath, 'manifest.json');

  let anyCreated = false;

  if (!existsSync(configPath)) {
    await writeFile(configPath, configTemplate(defaults), 'utf8');
    log(io, 'created', 'hiero.config.ts');
    anyCreated = true;
  } else {
    log(io, 'exists ', 'hiero.config.ts');
  }

  if (!existsSync(sourceDirPath)) {
    await mkdir(sourceDirPath, { recursive: true });
    log(io, 'created', `${defaults.sourceDir}/`);
    anyCreated = true;
  }

  if (!existsSync(iconsDirPath)) {
    await mkdir(iconsDirPath, { recursive: true });
    log(io, 'created', `${defaults.sourceDir}/icons/`);
    anyCreated = true;
  }

  if (!existsSync(manifestPath)) {
    await writeFile(manifestPath, emptyManifest(), 'utf8');
    log(io, 'created', `${defaults.sourceDir}/manifest.json`);
    anyCreated = true;
  }

  // Always run health checks at the end so the user sees what's still
  // missing (most commonly: credentials for git-pr / npm-registry).
  const checks = await runHealthChecks(cwd);
  io.log('');
  io.log('[hiero] Setup health:');
  for (const c of checks) {
    const icon = c.status === 'ok' ? '✅' : c.status === 'warn' ? '⚠️ ' : '❌';
    io.log(`  ${icon}  ${c.name}: ${c.detail}`);
  }

  if (anyCreated) {
    io.log(`
[hiero] Initialized successfully.

Next steps:
  1.  Run \`hiero dev\` to start the live integration server
  2.  Open the Hiero editor and connect to this repository
       (set the dev server URL to http://localhost:4400)
  3.  Publish icons from the editor — they will appear in ${defaults.sourceDir}/icons/
  4.  Run \`hiero build\` to produce a snapshot build for CI
  5.  Commit ${defaults.sourceDir}/ to version-control as your canonical icon source

If you picked git-pr or npm-registry, set the matching token in .env.local
(and verify .env.local is gitignored). Run \`hiero init --check\` any time
to re-run the health checks.

See docs at https://hiero.dev/docs/getting-started`);
  } else {
    io.log('[hiero] Already initialized — nothing to create.');
  }
}

function log(io: InitIO, action: string, file: string): void {
  io.log(`  ${action}  ${file}`);
}
