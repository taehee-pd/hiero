'use client';

import type { Project, SyncTarget } from '@/lib/schema/types';

export type PublishSemver = 'patch' | 'minor' | 'major';

export type NpmPublishPayload = {
  project: Project;
  target: SyncTarget;
  version: string;
  dryRun?: boolean;
};

export type ClientPublishResult =
  | {
      kind: 'success' | 'dry-run';
      version: string;
      packageName: string;
      files: string[];
    }
  | {
      kind: 'error';
      message: string;
      statusCode?: number;
    };

export function bumpVersion(version: string, bump: PublishSemver): string {
  const parts = version.split('.').map(Number);
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;

  switch (bump) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
  }
}

export function getNextPublishVersion(
  target: SyncTarget,
  bump: PublishSemver,
): string {
  const lastVersion = target.npmRegistry?.lastPublishedVersion ?? '0.0.0';
  return bumpVersion(lastVersion, bump);
}

export function buildNpmPublishPayload(args: {
  project: Project;
  target: SyncTarget;
  version: string;
  dryRun?: boolean;
}): NpmPublishPayload {
  return {
    ...args,
    dryRun: args.dryRun ?? false,
  };
}

export async function publishNpmTarget(args: {
  project: Project;
  target: SyncTarget;
  version: string;
  dryRun?: boolean;
}): Promise<ClientPublishResult> {
  const { target, version, dryRun = false } = args;
  const packageName = target.npmRegistry?.packageName;
  if (!packageName) {
    return { kind: 'error', message: 'npm target is missing a package name.' };
  }

  const payload = buildNpmPublishPayload(args);
  const proxySecret = process.env.NEXT_PUBLIC_NPM_PUBLISH_PROXY_SECRET;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (proxySecret) {
    headers['x-hiero-publish-secret'] = proxySecret;
  }

  const response = await fetch('/api/publish-npm', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return {
      kind: 'error',
      message:
        (error as { message?: string }).message ??
        `Publish failed with status ${response.status}.`,
      statusCode: response.status,
    };
  }

  return {
    kind: dryRun ? 'dry-run' : 'success',
    version,
    packageName,
    files: [],
  };
}
