import { NextResponse } from 'next/server';
import { syncPr } from '@/lib/sync-service/sync-pr';
import { validateSyncPrRequest } from '@/lib/sync-service/contracts';
import { GitHubProvider } from '@/lib/sync-service/github-provider';
import { SyncError, AuthFailureError } from '@/lib/sync-service/errors';
import { readSyncFlags, checkSyncAllowed } from '@/lib/sync-service/feature-flags';
import { validateTokenFormat, preflightPermissionCheck } from '@/lib/sync-service/permissions';

/**
 * POST /api/github-sync/pr
 *
 * Accepts a canonical source payload and opens a GitHub Pull Request.
 * The GitHub token is read from the server-side environment variable
 * GITHUB_SYNC_TOKEN — it is never sent from the client.
 */
export async function POST(request: Request) {
  const flags = readSyncFlags();

  // --- Auth: server-side token ---
  const token = process.env.GITHUB_SYNC_TOKEN;
  if (!token) {
    return NextResponse.json(
      new AuthFailureError('GITHUB_SYNC_TOKEN is not configured on the server.').toJSON(),
      { status: 401 },
    );
  }

  // --- Token format validation ---
  const tokenCheck = validateTokenFormat(token);
  if (!tokenCheck.ok) {
    return NextResponse.json(
      { error: 'AUTH_FAILURE', message: `Invalid token: ${tokenCheck.warning}`, statusCode: 401 },
      { status: 401 },
    );
  }

  // --- Parse body ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'VALIDATION_FAILURE', message: 'Invalid JSON body.', statusCode: 400 },
      { status: 400 },
    );
  }

  // --- Validate ---
  const validation = validateSyncPrRequest(body);
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

  // --- Feature flag guard ---
  const flagCheck = checkSyncAllowed(flags, req.owner, req.repo, req.files.length);
  if (!flagCheck.ok) {
    return NextResponse.json(
      { error: 'PROVIDER_ERROR', message: flagCheck.reason, statusCode: flagCheck.statusCode },
      { status: flagCheck.statusCode ?? 503 },
    );
  }

  // --- Execute ---
  try {
    const provider = new GitHubProvider(token);

    // --- Preflight permission check ---
    if (flags.preflightCheckEnabled) {
      const preflight = await preflightPermissionCheck(
        provider,
        req.owner,
        req.repo,
        req.baseBranch || 'main',
      );
      if (!preflight.ok) {
        const failedChecks = preflight.checks.filter((c) => !c.passed);
        return NextResponse.json(
          {
            error: 'AUTH_FAILURE',
            message: failedChecks.map((c) => c.message).join(' '),
            statusCode: 401,
          },
          { status: 401 },
        );
      }
    }

    // --- Dry-run guard ---
    if (flags.dryRunOnly) {
      return NextResponse.json(
        {
          kind: 'dry-run',
          message: 'Sync is in dry-run mode. Validation passed but no PR was created.',
          fileCount: req.files.length,
        },
        { status: 200 },
      );
    }

    const result = await syncPr(req, { provider });

    if (result.kind === 'no-op') {
      return NextResponse.json(result, { status: 200 });
    }

    if (result.kind === 'conflict') {
      return NextResponse.json(result, { status: 409 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof SyncError) {
      return NextResponse.json(err.toJSON(), { status: err.statusCode });
    }

    const message = err instanceof Error ? err.message : 'Unknown error.';
    return NextResponse.json(
      { error: 'PROVIDER_ERROR', message, statusCode: 500 },
      { status: 500 },
    );
  }
}
