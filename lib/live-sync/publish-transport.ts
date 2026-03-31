/**
 * Publish transport — pushes canonical source files from the editor to the
 * consumer repo's coniva dev server.
 *
 * Browser-safe: no Node.js imports. Works in both Next.js and desktop contexts.
 *
 * Transport model:
 *   Editor  ──POST──▶  coniva dev server (localhost:4400)  ──writes──▶  sourceDir
 *
 * The dev server receives the files, writes them to sourceDir, and immediately
 * triggers an incremental rebuild. This gives the editor a single consistent
 * publish path regardless of whether it's running as a desktop or web app.
 *
 * For direct-file-write from the desktop editor (no dev server required),
 * that path is routed through the platform bridge (lib/platform/bridge.ts)
 * and is separate from this module.
 */

import type { PublishRequest, PublishResult } from './types';

const DEFAULT_DEV_SERVER_URL = 'http://localhost:4400';

/**
 * Publish canonical source files to the consumer repo via the coniva dev
 * server HTTP API.
 *
 * The files array should be the full output of `exportSourcePayload()`:
 *   - icons/{name}/icon.json files
 *   - icons/{name}/preview.svg files
 *   - manifest.json
 *
 * Icon files and the manifest are sent via separate endpoints so the server
 * can write and validate them independently.
 */
export async function publishSourceFiles(request: PublishRequest): Promise<PublishResult> {
  const baseUrl = (request.devServerUrl ?? DEFAULT_DEV_SERVER_URL).replace(/\/$/, '');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (request.apiSecret) {
    headers['Authorization'] = `Bearer ${request.apiSecret}`;
  }

  const iconFiles = request.files.filter((f) => f.path !== 'manifest.json');
  const manifestFile = request.files.find((f) => f.path === 'manifest.json');

  try {
    // 1. Push icon source files (icon.json + preview.svg)
    if (iconFiles.length > 0) {
      const res = await fetch(`${baseUrl}/api/source/icons`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ files: iconFiles }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return {
          kind: 'error',
          transport: 'api-push',
          error: `POST /api/source/icons failed (${res.status}): ${body}`,
        };
      }
    }

    // 2. Push manifest (triggers rebuild after icon files are written)
    if (manifestFile) {
      const res = await fetch(`${baseUrl}/api/source/manifest`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ contents: manifestFile.contents }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return {
          kind: 'error',
          transport: 'api-push',
          error: `POST /api/source/manifest failed (${res.status}): ${body}`,
        };
      }
    }

    return {
      kind: 'success',
      transport: 'api-push',
      changedFiles: request.files.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Provide a more helpful error when the dev server isn't running
    if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
      return {
        kind: 'error',
        transport: 'api-push',
        error: `Could not connect to coniva dev server at ${baseUrl}. Run \`coniva dev\` in the consumer repo first.`,
      };
    }

    return { kind: 'error', transport: 'api-push', error: message };
  }
}

/** Release target shape returned by /api/status. */
export type DevServerReleaseTarget = {
  kind: 'local-directory' | 'git-pr' | 'npm-registry';
  outputMode: 'snapshot';
  outputDir?: string;
  owner?: string;
  repo?: string;
  baseBranch?: string;
  packagePath?: string;
  packageName?: string;
  registry?: string;
  scope?: string;
};

/**
 * Fetch the full status from the coniva dev server, including release targets.
 * Returns the status payload on success, or an error on failure.
 */
export async function pingDevServer(
  devServerUrl?: string,
): Promise<
  | {
      ok: true;
      iconCount: number;
      lastBuildAt: string | null;
      releaseTargets: DevServerReleaseTarget[];
    }
  | { ok: false; error: string }
> {
  const baseUrl = (devServerUrl ?? DEFAULT_DEV_SERVER_URL).replace(/\/$/, '');

  try {
    const res = await fetch(`${baseUrl}/api/status`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return { ok: false, error: `Dev server returned ${res.status}` };
    }

    const status = (await res.json()) as {
      ok?: boolean;
      iconCount?: number;
      lastBuildAt?: string | null;
      releaseTargets?: DevServerReleaseTarget[];
    };

    return {
      ok: true,
      iconCount: status.iconCount ?? 0,
      lastBuildAt: status.lastBuildAt ?? null,
      releaseTargets: status.releaseTargets ?? [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes('ECONNREFUSED') ||
      message.includes('fetch failed') ||
      message.includes('timeout')
    ) {
      return { ok: false, error: `Dev server not reachable at ${baseUrl}` };
    }
    return { ok: false, error: message };
  }
}
