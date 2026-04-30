/**
 * Publish target executor — translates a `PublishTargetSpec` from the
 * orchestrator (`lib/sync-service/publish-transaction.ts`) into a real
 * transport call against the dev-server's API routes.
 *
 *   ┌────────────────┐    ┌──────────────────────────┐
 *   │  PublishDialog │───▶│ executePublishTransaction│
 *   └────────────────┘    └────────────┬─────────────┘
 *                                       │ TargetExecutor (this file)
 *                                       ▼
 *                          ┌────────────┴───────────────┐
 *                          │                            │
 *                git-pr ───┤      npm-registry ─────────┤      local-directory
 *                 │                    │                                │
 *                 ▼                    ▼                                ▼
 *           POST /api/             POST /api/                  client-side download
 *         github-sync/pr           publish-npm                 (no dev-server FS access)
 *
 * Phase 2.5 wiring fix (issue P1 in the wiring plan): before this file,
 * PublishDialog had no executor and was therefore unmountable. The
 * adapter is constructed by the dialog mount-site with closures over
 * the active workspace + project, so credentials never reach the client
 * (the API routes proxy auth server-side).
 *
 * Local-directory behavior: the browser cannot write to host-repo
 * filesystem paths. This executor returns a stub success that triggers
 * a JSON file download. A future commit can route this through the
 * lib/live-sync transport once the dev-server endpoint is in place.
 */

'use client';

import type { Workspace, Project } from '@/lib/schema/types';
import type {
  PublishTargetSpec,
  TargetExecutor,
} from '@/lib/sync-service/publish-transaction';
import type { ReleaseTarget } from '@/lib/install-config/types';
import type { SyncPrRequest, SyncPrResponse } from '@/lib/sync-service/contracts';
import { exportSourcePayload } from '@/lib/sync-source/export-source-payload';
import { downloadTextFile } from '@/lib/platform/bridge';

export type ExecutorContext = {
  workspace: Workspace;
  /** The active project — typically `workspace.iconSets[activeIconSetId]`. */
  project: Project;
  actor: { name: string; email?: string };
  releaseMetadata: { version: string; releaseNotes: string };
};

/**
 * Build a `TargetExecutor` closure that the publish-transaction
 * orchestrator can call once per target. Each branch maps a release
 * target spec onto its concrete transport. Failures are caught and
 * surfaced as `{ status: 'failed', error }` so the orchestrator can
 * keep going through the remaining targets.
 */
export function createTargetExecutor(ctx: ExecutorContext): TargetExecutor {
  return async (spec: PublishTargetSpec) => {
    try {
      const target = spec.payload as ReleaseTarget | undefined;
      if (!target) {
        return { status: 'failed', error: 'target spec missing payload' };
      }

      switch (spec.kind) {
        case 'git-pr':
          return await runGitPrTarget(target as Extract<ReleaseTarget, { kind: 'git-pr' }>, ctx);
        case 'npm-registry':
          return await runNpmTarget(target as Extract<ReleaseTarget, { kind: 'npm-registry' }>, ctx);
        case 'local-directory':
          return await runLocalDirectoryTarget(
            target as Extract<ReleaseTarget, { kind: 'local-directory' }>,
            ctx,
          );
      }
    } catch (err) {
      return {
        status: 'failed',
        error: err instanceof Error ? err.message : 'unknown error',
      };
    }
  };
}

async function runGitPrTarget(
  target: Extract<ReleaseTarget, { kind: 'git-pr' }>,
  ctx: ExecutorContext,
): Promise<{ status: 'success'; url: string } | { status: 'failed'; error: string; url?: string }> {
  const payload = exportSourcePayload(ctx.project);
  const request: SyncPrRequest = {
    owner: target.owner,
    repo: target.repo,
    baseBranch: target.baseBranch,
    packagePath: target.packagePath,
    actor: ctx.actor,
    files: payload.files,
    releaseMetadata: ctx.releaseMetadata,
  };

  const response = await fetch('/api/github-sync/pr', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    return {
      status: 'failed',
      error:
        body.message ?? `git-pr target failed with status ${response.status}.`,
    };
  }

  const result = (await response.json()) as SyncPrResponse;
  return { status: 'success', url: result.pr.url };
}

async function runNpmTarget(
  target: Extract<ReleaseTarget, { kind: 'npm-registry' }>,
  ctx: ExecutorContext,
): Promise<{ status: 'success'; url?: string } | { status: 'failed'; error: string }> {
  // The legacy `/api/publish-npm` route expects the older SyncTarget
  // shape. Build a minimal adapter inline rather than refactoring the
  // route in this commit — the route's contract stays unchanged so
  // callers outside the publish flow keep working.
  const legacyTarget = {
    id: 'publish-target',
    name: target.packageName,
    npmRegistry: {
      packageName: target.packageName,
      registry: target.registry,
      scope: target.scope,
      lastPublishedVersion: undefined,
    },
  };

  const response = await fetch('/api/publish-npm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      project: ctx.project,
      target: legacyTarget,
      version: ctx.releaseMetadata.version,
      dryRun: false,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    return {
      status: 'failed',
      error: body.message ?? `npm-registry target failed with status ${response.status}.`,
    };
  }

  const result = (await response.json()) as { kind: string; packageName?: string };
  if (result.kind !== 'success') {
    return {
      status: 'failed',
      error: `npm publish returned kind=${result.kind}`,
    };
  }
  const registry = target.registry ?? 'https://www.npmjs.com';
  return {
    status: 'success',
    url: `${registry.replace(/\/$/, '')}/package/${target.packageName}`,
  };
}

async function runLocalDirectoryTarget(
  target: Extract<ReleaseTarget, { kind: 'local-directory' }>,
  ctx: ExecutorContext,
): Promise<{ status: 'success'; url: string } | { status: 'failed'; error: string }> {
  // Browser can't write to host-repo filesystem paths. Trigger a JSON
  // download as a stand-in so the user can save the snapshot manually.
  // Future: route through lib/live-sync once the dev-server endpoint
  // is wired into PublishTransaction.
  try {
    const payload = exportSourcePayload(ctx.project);
    const json = JSON.stringify(
      {
        version: ctx.releaseMetadata.version,
        releaseNotes: ctx.releaseMetadata.releaseNotes,
        outputDir: target.outputDir,
        files: payload.files,
      },
      null,
      2,
    );
    const filename = `${ctx.project.meta.name || 'hiero'}-${ctx.releaseMetadata.version}.json`;
    const result = downloadTextFile(json, filename, 'application/json');
    return {
      status: 'success',
      url: result.path,
    };
  } catch (err) {
    return {
      status: 'failed',
      error: err instanceof Error ? err.message : 'local-directory download failed',
    };
  }
}
