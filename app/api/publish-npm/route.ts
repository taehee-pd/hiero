/**
 * Web publish proxy for npm registry.
 *
 * Security posture matches app/api/github-sync/pr/route.ts:
 * - Token is server-side only (NPM_PUBLISH_TOKEN env var)
 * - Client sends only compiled files + metadata, never credentials
 * - Validates request structure before executing
 *
 * npm tokens are stored as server-side env vars only.
 */

import { NextResponse } from 'next/server';
import type { Project, SyncTarget } from '@/lib/schema/types';
import { compileProject } from '@/lib/export/compile-pipeline';
import { buildPackageJson } from '@/lib/sync-service/connectors/npm-connector';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NpmPublishBody = {
  /** Current Hiero project to compile. */
  project: Project;
  /** Sync target describing platform + registry config. */
  target: SyncTarget;
  /** Version to publish. */
  version: string;
  /** When true, run npm publish --dry-run. */
  dryRun?: boolean;
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // 1. Server-side token — never from client
  const token = process.env.NPM_PUBLISH_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        error: 'NPM_AUTH_FAILURE',
        message: 'NPM_PUBLISH_TOKEN is not configured on the server.',
        statusCode: 401,
      },
      { status: 401 },
    );
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: 'VALIDATION_FAILURE',
        message: 'Invalid JSON body.',
        statusCode: 400,
      },
      { status: 400 },
    );
  }

  // 3. Validate
  const validation = validateNpmPublishRequest(body);
  if (!validation.ok) {
    return NextResponse.json(
      {
        error: 'VALIDATION_FAILURE',
        message: validation.errors.join(' '),
        statusCode: 400,
      },
      { status: 400 },
    );
  }

  const req = validation.request!;

  // 4. Execute publish
  try {
    const result = await executeNpmPublish({
      project: req.project,
      target: req.target,
      version: req.version,
      token,
      dryRun: req.dryRun ?? false,
    });

    if (result.exitCode !== 0) {
      return NextResponse.json(
        {
          error: 'NPM_PUBLISH_FAILURE',
          message: result.stderr || 'npm publish failed.',
          statusCode: 502,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { kind: 'success', stdout: result.stdout },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error.';
    return NextResponse.json(
      { error: 'NPM_REGISTRY_ERROR', message, statusCode: 500 },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateNpmPublishRequest(body: unknown): {
  ok: boolean;
  errors: string[];
  request?: NpmPublishBody;
} {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { ok: false, errors: ['Request body must be a JSON object.'] };
  }

  const obj = body as Record<string, unknown>;

  if (!obj.project || typeof obj.project !== 'object') {
    errors.push('project is required and must be an object.');
  }

  if (!obj.target || typeof obj.target !== 'object') {
    errors.push('target is required and must be an object.');
  }

  if (typeof obj.version !== 'string' || !obj.version) {
    errors.push('version is required and must be a non-empty string.');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors: [], request: obj as unknown as NpmPublishBody };
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

async function executeNpmPublish(opts: {
  project: Project;
  target: SyncTarget;
  version: string;
  token: string;
  dryRun: boolean;
}): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const { writeFile, mkdir, mkdtemp, rm } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);

  // Create temp directory
  const cwd = await mkdtemp(join(tmpdir(), 'hiero-npm-'));

  try {
    if (!opts.target.npmRegistry?.registry || !opts.target.npmRegistry.packageName) {
      throw new Error('npm target is missing registry configuration.');
    }

    const compiled = compileProject(opts.project, {
      package: {
        name: opts.target.npmRegistry.packageName,
        version: opts.version,
        builtAt: new Date().toISOString(),
      },
      generateReact: opts.target.platform === 'react',
    });
    const packageJson = buildPackageJson(
      opts.target.npmRegistry.packageName,
      opts.version,
      opts.target.npmRegistry.scope,
      opts.target.npmRegistry.registry,
    );

    // Build package.json server-side from strict allowlist.
    // Never write client-supplied packageJson directly — it could contain
    // lifecycle scripts (prepublishOnly, prepare, etc.) that execute arbitrary
    // commands during `npm publish`.
    const safePackageJson = sanitizePackageJson(packageJson);
    await writeFile(
      join(cwd, 'package.json'),
      JSON.stringify(safePackageJson, null, 2),
    );

    // Write .npmrc with token (scoped to the registry host)
    const registryHost = new URL(opts.target.npmRegistry.registry).host;
    const npmrc = `//${registryHost}/:_authToken=${opts.token}\nregistry=${opts.target.npmRegistry.registry}\n`;
    await writeFile(join(cwd, '.npmrc'), npmrc);

    // Write compiled files with path traversal protection.
    // Reject any path that resolves outside the temp directory.
    const { resolve, relative } = await import('node:path');
    for (const file of compiled.files) {
      const resolvedPath = resolve(cwd, file.path);
      const rel = relative(cwd, resolvedPath);
      if (rel.startsWith('..') || resolve(resolvedPath) !== resolvedPath.replace(/\/+$/, '')) {
        throw new Error(`Path traversal rejected: ${file.path}`);
      }
      // Extra guard: ensure normalized path stays under cwd
      if (!resolvedPath.startsWith(cwd + '/') && resolvedPath !== cwd) {
        throw new Error(`Path escape rejected: ${file.path}`);
      }
      const dir = join(resolvedPath, '..');
      await mkdir(dir, { recursive: true });
      await writeFile(resolvedPath, file.contents);
    }

    // Run npm publish with --ignore-scripts to prevent RCE from any
    // residual lifecycle hooks (defense in depth alongside sanitizePackageJson).
    const args = ['publish', '--no-git-checks', '--ignore-scripts'];
    if (opts.dryRun) args.push('--dry-run');

    const { stdout, stderr } = await execFileAsync('npm', args, {
      cwd,
      timeout: 60_000,
      env: { ...process.env, npm_config_registry: opts.target.npmRegistry.registry },
    });

    return { exitCode: 0, stdout, stderr };
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err) {
      const execErr = err as { stdout?: string; stderr?: string; code?: number };
      return {
        exitCode: execErr.code ?? 1,
        stdout: execErr.stdout ?? '',
        stderr: execErr.stderr ?? String(err),
      };
    }
    return {
      exitCode: 1,
      stdout: '',
      stderr: err instanceof Error ? err.message : String(err),
    };
  } finally {
    // Cleanup temp directory
    await rm(cwd, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Package.json sanitization — strict allowlist
// ---------------------------------------------------------------------------

const ALLOWED_PKG_KEYS = new Set([
  'name',
  'version',
  'description',
  'main',
  'module',
  'types',
  'exports',
  'files',
  'license',
  'publishConfig',
  'repository',
  'keywords',
  'author',
  'peerDependencies',
  'dependencies',
]);

/**
 * Build a safe package.json from client-supplied data.
 * Only copies allowlisted keys — strips `scripts`, `bin`, `install`,
 * `preinstall`, `postinstall`, `prepublishOnly`, `prepare`, etc.
 * This prevents RCE via npm lifecycle hooks during `npm publish`.
 */
function sanitizePackageJson(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};

  for (const key of ALLOWED_PKG_KEYS) {
    if (key in input && input[key] !== undefined) {
      safe[key] = input[key];
    }
  }

  // Ensure name and version exist (required for npm publish)
  if (typeof safe.name !== 'string' || !safe.name) {
    throw new Error('package.json must have a non-empty "name" field.');
  }
  if (typeof safe.version !== 'string' || !safe.version) {
    throw new Error('package.json must have a non-empty "version" field.');
  }

  return safe;
}
