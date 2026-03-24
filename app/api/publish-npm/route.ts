/**
 * Web publish proxy for npm registry.
 *
 * Security posture matches app/api/github-sync/pr/route.ts:
 * - Token is server-side only (NPM_PUBLISH_TOKEN env var)
 * - Client sends only compiled files + metadata, never credentials
 * - Validates request structure before executing
 *
 * Desktop users go through the Electrobun RPC bridge instead.
 */

import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NpmPublishBody = {
  /** Compiled files to include in the package. */
  files: Array<{ path: string; contents: string }>;
  /** Generated package.json contents. */
  packageJson: Record<string, unknown>;
  /** Target registry URL. */
  registry: string;
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
      packageJson: req.packageJson,
      files: req.files,
      registry: req.registry,
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

  if (!Array.isArray(obj.files)) {
    errors.push('files is required and must be an array.');
  }

  if (!obj.packageJson || typeof obj.packageJson !== 'object') {
    errors.push('packageJson is required and must be an object.');
  }

  if (typeof obj.registry !== 'string' || !obj.registry) {
    errors.push('registry is required and must be a non-empty string.');
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
  packageJson: Record<string, unknown>;
  files: Array<{ path: string; contents: string }>;
  registry: string;
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
  const cwd = await mkdtemp(join(tmpdir(), 'coniva-npm-'));

  try {
    // Write package.json
    await writeFile(
      join(cwd, 'package.json'),
      JSON.stringify(opts.packageJson, null, 2),
    );

    // Write .npmrc with token (scoped to the registry host)
    const registryHost = new URL(opts.registry).host;
    const npmrc = `//${registryHost}/:_authToken=${opts.token}\nregistry=${opts.registry}\n`;
    await writeFile(join(cwd, '.npmrc'), npmrc);

    // Write compiled files
    for (const file of opts.files) {
      const filePath = join(cwd, file.path);
      const dir = join(filePath, '..');
      await mkdir(dir, { recursive: true });
      await writeFile(filePath, file.contents);
    }

    // Run npm publish
    const args = ['publish', '--no-git-checks'];
    if (opts.dryRun) args.push('--dry-run');

    const { stdout, stderr } = await execFileAsync('npm', args, {
      cwd,
      timeout: 60_000,
      env: { ...process.env, npm_config_registry: opts.registry },
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
