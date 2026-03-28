import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ReleaseManifest } from './release-types';

export const STABLE_SIGNING_ENV = [
  'APPLE_TEAM_ID',
  'APPLE_DEVELOPER_IDENTITY',
  'APPLE_NOTARIZATION_APPLE_ID',
  'APPLE_NOTARIZATION_PASSWORD',
  'WINDOWS_CERT_SUBJECT',
] as const;

export function isStableRelease(argv: string[], env: NodeJS.ProcessEnv): boolean {
  return argv.includes('--stable') || env['ELECTROBUN_BUILD_ENV'] === 'stable';
}

export function getMissingSigningEnv(env: NodeJS.ProcessEnv): string[] {
  return STABLE_SIGNING_ENV.filter((name) => !env[name]);
}

export function assertStableReleasePrereqs(
  argv: string[],
  env: NodeJS.ProcessEnv,
): void {
  if (!isStableRelease(argv, env)) return;
  const missing = getMissingSigningEnv(env);
  if (missing.length > 0) {
    throw new Error(
      `Stable desktop release requires signing secrets. Missing: ${missing.join(', ')}`,
    );
  }
}

export function ensureArtifactDir(artifactDir: string): void {
  if (!existsSync(artifactDir)) {
    mkdirSync(artifactDir, { recursive: true });
  }
}

export function assertReleaseManifestHasArtifacts(manifest: ReleaseManifest): void {
  const platformEntries = Object.values(manifest.platforms);
  if (platformEntries.length === 0) {
    throw new Error('Release manifest must include at least one platform artifact.');
  }

  if (platformEntries.every((entry) => entry.files.length === 0)) {
    throw new Error('Release manifest must include at least one built artifact file.');
  }
}

export function resolveBuildCommand(stable: boolean, workspaceRoot: string): string[] {
  return stable
    ? ['corepack', 'pnpm', '--dir', join(workspaceRoot, 'desktop'), 'dist']
    : ['corepack', 'pnpm', '--dir', join(workspaceRoot, 'desktop'), 'build'];
}
