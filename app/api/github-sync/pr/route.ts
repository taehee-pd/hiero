import { NextResponse } from 'next/server';
import { syncPr } from '@/lib/sync-service/sync-pr';
import { validateSyncPrRequest } from '@/lib/sync-service/contracts';
import { GitHubProvider } from '@/lib/sync-service/github-provider';
import { SyncError, AuthFailureError } from '@/lib/sync-service/errors';

/**
 * POST /api/github-sync/pr
 *
 * Accepts a canonical source payload and opens a GitHub Pull Request.
 * The GitHub token is read from the server-side environment variable
 * GITHUB_SYNC_TOKEN — it is never sent from the client.
 */
export async function POST(request: Request) {
  // --- Auth: server-side token ---
  const token = process.env.GITHUB_SYNC_TOKEN;
  if (!token) {
    return NextResponse.json(
      new AuthFailureError('GITHUB_SYNC_TOKEN is not configured on the server.').toJSON(),
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

  // --- Execute ---
  try {
    const provider = new GitHubProvider(token);
    const result = await syncPr(validation.request!, { provider });

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
