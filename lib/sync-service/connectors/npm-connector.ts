/**
 * NPM Registry sync connector — compiles icons and publishes them
 * as an npm package to a registry.
 *
 * Implements SyncConnector for type-safe dispatch from SyncTargetPanel.
 * Uses NpmPublisher abstraction for testability (mock in tests,
 * fetch to web proxy in production).
 *
 * @module
 */

import type { SyncConnector } from '../contracts';
import type { SyncTarget, Project } from '@/lib/schema/types';
import { compileProject } from '@/lib/export/compile-pipeline';
import type { CompilePipelineResult } from '@/lib/export/compile-pipeline';
import { diffCompiledIcons } from '@/lib/export/diff-compiled-icons';
import {
  ICON_CHANGE_RECORD_SCHEMA_URI,
  type CompiledIcon,
  type IconChangeRecord,
} from '@/lib/compiler-contracts/types';

// ---------------------------------------------------------------------------
// Publisher abstraction (for testability)
// ---------------------------------------------------------------------------

export type NpmPublisher = {
  publish(args: {
    cwd: string;
    registry: string;
    tag?: string;
    dryRun?: boolean;
  }): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }>;
};

// ---------------------------------------------------------------------------
// File system abstraction (reuse pattern from local-directory-connector)
// ---------------------------------------------------------------------------

export type NpmFileSystem = {
  writeFile(path: string, contents: string): Promise<void>;
  mkdirp(path: string): Promise<void>;
};

// ---------------------------------------------------------------------------
// Request / Result types
// ---------------------------------------------------------------------------

export type NpmPublishRequest = {
  project: Project;
  target: SyncTarget;
  version: string;
  previousCompiledIcons?: Record<string, CompiledIcon>;
  dryRun?: boolean;
};

export type NpmPublishResult =
  | {
      kind: 'success';
      version: string;
      packageName: string;
      files: string[];
      changelog: IconChangeRecord[];
      diagnostics: Array<{ level: string; message: string }>;
    }
  | {
      kind: 'dry-run';
      version: string;
      packageName: string;
      files: string[];
      changelog: IconChangeRecord[];
    }
  | {
      kind: 'error';
      message: string;
      exitCode?: number;
      stderr?: string;
    };

// ---------------------------------------------------------------------------
// Connector
// ---------------------------------------------------------------------------

export class NpmPublishConnector
  implements SyncConnector<NpmPublishRequest, NpmPublishResult>
{
  constructor(
    private readonly publisher: NpmPublisher,
    private readonly fs: NpmFileSystem,
    private readonly tmpDir: () => string,
  ) {}

  validate(request: NpmPublishRequest): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!request.target.npmRegistry) errors.push('npmRegistry config is required.');
    if (!request.version) errors.push('version is required.');
    if (!request.target.npmRegistry?.packageName)
      errors.push('packageName is required.');
    return { ok: errors.length === 0, errors };
  }

  async push(request: NpmPublishRequest): Promise<NpmPublishResult> {
    const validation = this.validate(request);
    if (!validation.ok) {
      return { kind: 'error', message: validation.errors.join(' ') };
    }

    const npm = request.target.npmRegistry!;
    const cwd = this.tmpDir();

    // 1. Compile the project
    const compiled = compileProject(request.project, {
      package: {
        name: npm.packageName,
        version: request.version,
        builtAt: new Date().toISOString(),
      },
      previousCompiledIcons: request.previousCompiledIcons,
      generateReact: request.target.platform === 'react',
    });

    // 2. Build package.json
    const packageJson = buildPackageJson(
      npm.packageName,
      request.version,
      npm.scope,
      npm.registry,
    );

    // 3. Write files to temp directory
    await this.fs.mkdirp(cwd);
    await this.fs.writeFile(
      `${cwd}/package.json`,
      JSON.stringify(packageJson, null, 2),
    );
    for (const file of compiled.files) {
      const dir = parentDir(`${cwd}/${file.path}`);
      if (dir !== cwd) await this.fs.mkdirp(dir);
      await this.fs.writeFile(`${cwd}/${file.path}`, file.contents);
    }

    // 4. Generate changelog from diff
    const changelog = generateChangelog(compiled, request.previousCompiledIcons);

    // 5. Dry-run check
    if (request.dryRun || request.target.dryRun) {
      return {
        kind: 'dry-run',
        version: request.version,
        packageName: npm.packageName,
        files: compiled.files.map((f) => f.path),
        changelog,
      };
    }

    // 6. Publish
    const result = await this.publisher.publish({
      cwd,
      registry: npm.registry,
      dryRun: false,
    });

    if (result.exitCode !== 0) {
      return {
        kind: 'error',
        message: `npm publish failed with exit code ${result.exitCode}`,
        exitCode: result.exitCode,
        stderr: result.stderr,
      };
    }

    return {
      kind: 'success',
      version: request.version,
      packageName: npm.packageName,
      files: compiled.files.map((f) => f.path),
      changelog,
      diagnostics: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function buildPackageJson(
  name: string,
  version: string,
  scope?: string,
  registry?: string,
): Record<string, unknown> {
  const pkg: Record<string, unknown> = {
    name,
    version,
    description: `Contour icon package — ${name}`,
    main: 'icons.manifest.json',
    files: ['icons/', 'icons.manifest.json', 'react/'],
    license: 'UNLICENSED',
  };

  const publishConfig: Record<string, string> = {};

  if (scope) {
    publishConfig.access = 'restricted';
  }

  if (registry && registry !== 'https://registry.npmjs.org') {
    publishConfig.registry = registry;
  }

  if (Object.keys(publishConfig).length > 0) {
    pkg.publishConfig = publishConfig;
  }

  return pkg;
}

function generateChangelog(
  compiled: CompilePipelineResult,
  previousIcons?: Record<string, CompiledIcon>,
): IconChangeRecord[] {
  if (!previousIcons) return [];

  const records: IconChangeRecord[] = [];
  const currentIds = new Set(compiled.compiledIcons.map((i) => i.id));
  const previousIds = new Set(Object.keys(previousIcons));

  // Modified icons — exist in both previous and current
  for (const icon of compiled.compiledIcons) {
    if (previousIcons[icon.id]) {
      const record = diffCompiledIcons(previousIcons[icon.id]!, icon);
      if (record.changes.length > 0) {
        records.push(record);
      }
    }
  }

  // Added icons — exist in current but not in previous (minor bump)
  for (const icon of compiled.compiledIcons) {
    if (!previousIds.has(icon.id)) {
      records.push({
        $schema: ICON_CHANGE_RECORD_SCHEMA_URI,
        iconId: icon.id,
        iconName: icon.name,
        componentName: icon.componentName,
        fromVersion: '',
        toVersion: '',
        publishedAt: new Date().toISOString(),
        bump: 'minor',
        isBreaking: false,
        changes: [{ kind: 'variant-added', summary: `Icon "${icon.name}" added`, breaking: false }],
      });
    }
  }

  // Removed icons — exist in previous but not in current (breaking/major bump)
  for (const [id, prev] of Object.entries(previousIcons)) {
    if (!currentIds.has(id)) {
      records.push({
        $schema: ICON_CHANGE_RECORD_SCHEMA_URI,
        iconId: id,
        iconName: prev.name,
        componentName: prev.componentName,
        fromVersion: '',
        toVersion: '',
        publishedAt: new Date().toISOString(),
        bump: 'major',
        isBreaking: true,
        changes: [{ kind: 'variant-removed', summary: `Icon "${prev.name}" removed`, breaking: true }],
      });
    }
  }

  return records;
}

function parentDir(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash > 0 ? path.slice(0, lastSlash) : path;
}

/**
 * Recommend a semver bump based on the changelog.
 * - Icons removed → major
 * - Icons added → minor
 * - Icons modified only → patch
 */
export function recommendBump(
  changelog: IconChangeRecord[],
): 'major' | 'minor' | 'patch' {
  if (changelog.length === 0) return 'patch';
  if (changelog.some((r) => r.isBreaking)) return 'major';
  if (changelog.some((r) => r.bump === 'minor')) return 'minor';
  return 'patch';
}
