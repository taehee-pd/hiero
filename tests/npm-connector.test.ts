import { describe, expect, test, beforeEach } from 'bun:test';
import {
  NpmPublishConnector,
  buildPackageJson,
  recommendBump,
  type NpmPublisher,
  type NpmFileSystem,
  type NpmPublishRequest,
} from '../lib/sync-service/connectors/npm-connector';
import { createAutoPublishManager } from '../lib/sync-service/auto-publish';
import type { SyncTarget, Project } from '../lib/schema/types';
import type { CompiledIcon, IconChangeRecord } from '../lib/compiler-contracts/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

class MockNpmPublisher implements NpmPublisher {
  calls: Array<{ cwd: string; registry: string; tag?: string; dryRun?: boolean }> = [];
  exitCode = 0;
  stdout = 'Published @test/icons@1.0.0';
  stderr = '';

  async publish(args: {
    cwd: string;
    registry: string;
    tag?: string;
    dryRun?: boolean;
  }) {
    this.calls.push(args);
    return { exitCode: this.exitCode, stdout: this.stdout, stderr: this.stderr };
  }
}

class MemoryFileSystem implements NpmFileSystem {
  files = new Map<string, string>();
  dirs = new Set<string>();

  async writeFile(path: string, contents: string) {
    this.files.set(path, contents);
  }

  async mkdirp(path: string) {
    this.dirs.add(path);
  }
}

function createTestTarget(overrides: Partial<SyncTarget> = {}): SyncTarget {
  return {
    id: 'test-npm-target',
    name: 'Test NPM Target',
    platform: 'react',
    deliveryMode: 'npm-registry',
    npmRegistry: {
      registry: 'https://registry.npmjs.org',
      packageName: '@test/icons',
    },
    ...overrides,
  };
}

// Minimal project fixture
function createTestProject(): Project {
  return {
    version: '1.0',
    meta: { name: 'Test', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    icons: {},
    collections: [],
  } as unknown as Project;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NpmPublishConnector', () => {
  let publisher: MockNpmPublisher;
  let fs: MemoryFileSystem;
  let connector: NpmPublishConnector;

  beforeEach(() => {
    publisher = new MockNpmPublisher();
    fs = new MemoryFileSystem();
    connector = new NpmPublishConnector(publisher, fs, () => '/tmp/test-npm');
  });

  test('validate() returns errors for missing fields', () => {
    const result = connector.validate({
      project: createTestProject(),
      target: { ...createTestTarget(), npmRegistry: undefined },
      version: '',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('validate() returns ok for valid request', () => {
    const result = connector.validate({
      project: createTestProject(),
      target: createTestTarget(),
      version: '1.0.0',
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('push() calls publisher with correct registry', async () => {
    const result = await connector.push({
      project: createTestProject(),
      target: createTestTarget(),
      version: '1.0.0',
    });

    expect(result.kind).toBe('success');
    expect(publisher.calls).toHaveLength(1);
    expect(publisher.calls[0]!.registry).toBe('https://registry.npmjs.org');
  });

  test('push() writes package.json to filesystem', async () => {
    await connector.push({
      project: createTestProject(),
      target: createTestTarget(),
      version: '1.2.3',
    });

    const pkgJson = fs.files.get('/tmp/test-npm/package.json');
    expect(pkgJson).toBeDefined();
    const pkg = JSON.parse(pkgJson!);
    expect(pkg.name).toBe('@test/icons');
    expect(pkg.version).toBe('1.2.3');
  });

  test('push() returns error on non-zero exit code', async () => {
    publisher.exitCode = 1;
    publisher.stderr = 'E403 Forbidden';

    const result = await connector.push({
      project: createTestProject(),
      target: createTestTarget(),
      version: '1.0.0',
    });

    expect(result.kind).toBe('error');
    if (result.kind === 'error') {
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('E403 Forbidden');
    }
  });

  test('dry-run skips actual publish', async () => {
    const result = await connector.push({
      project: createTestProject(),
      target: createTestTarget(),
      version: '1.0.0',
      dryRun: true,
    });

    expect(result.kind).toBe('dry-run');
    expect(publisher.calls).toHaveLength(0);
  });

  test('dry-run via target.dryRun also skips publish', async () => {
    const target = createTestTarget({ dryRun: true });
    const result = await connector.push({
      project: createTestProject(),
      target,
      version: '1.0.0',
    });

    expect(result.kind).toBe('dry-run');
    expect(publisher.calls).toHaveLength(0);
  });

  test('push() returns error for invalid request', async () => {
    const result = await connector.push({
      project: createTestProject(),
      target: { ...createTestTarget(), npmRegistry: undefined },
      version: '',
    });
    expect(result.kind).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// buildPackageJson
// ---------------------------------------------------------------------------

describe('buildPackageJson', () => {
  test('generates basic package.json fields', () => {
    const pkg = buildPackageJson('@test/icons', '1.0.0');
    expect(pkg.name).toBe('@test/icons');
    expect(pkg.version).toBe('1.0.0');
    expect(pkg.main).toBe('icons.manifest.json');
    expect(Array.isArray(pkg.files)).toBe(true);
  });

  test('adds publishConfig.access for scoped packages', () => {
    const pkg = buildPackageJson('@test/icons', '1.0.0', '@test');
    expect((pkg.publishConfig as Record<string, string>)?.access).toBe('restricted');
  });

  test('adds publishConfig.registry for non-npmjs registries', () => {
    const pkg = buildPackageJson(
      '@test/icons',
      '1.0.0',
      undefined,
      'https://npm.pkg.github.com',
    );
    expect((pkg.publishConfig as Record<string, string>)?.registry).toBe(
      'https://npm.pkg.github.com',
    );
  });

  test('omits publishConfig for default registry without scope', () => {
    const pkg = buildPackageJson('my-icons', '1.0.0');
    expect(pkg.publishConfig).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// recommendBump
// ---------------------------------------------------------------------------

describe('recommendBump', () => {
  test('returns patch for empty changelog', () => {
    expect(recommendBump([])).toBe('patch');
  });

  test('returns major for breaking changes', () => {
    const changelog: IconChangeRecord[] = [
      { isBreaking: true, bump: 'major', changes: [{ kind: 'variant-removed' }] } as unknown as IconChangeRecord,
    ];
    expect(recommendBump(changelog)).toBe('major');
  });

  test('returns minor for additive changes', () => {
    const changelog: IconChangeRecord[] = [
      { isBreaking: false, bump: 'minor', changes: [{ kind: 'variant-added' }] } as unknown as IconChangeRecord,
    ];
    expect(recommendBump(changelog)).toBe('minor');
  });

  test('returns patch for non-breaking modifications', () => {
    const changelog: IconChangeRecord[] = [
      { isBreaking: false, bump: 'patch', changes: [{ kind: 'geometry' }] } as unknown as IconChangeRecord,
    ];
    expect(recommendBump(changelog)).toBe('patch');
  });
});

// ---------------------------------------------------------------------------
// AutoPublishManager
// ---------------------------------------------------------------------------

describe('AutoPublishManager', () => {
  test('schedule() and cancel()', () => {
    const manager = createAutoPublishManager(1000);
    const callback = async () => {};
    manager.schedule('target-1', callback);

    expect(manager.isPending('target-1')).toBe(true);
    expect(manager.getScheduled()).toHaveLength(1);

    manager.cancel('target-1');
    expect(manager.isPending('target-1')).toBe(false);
    expect(manager.getScheduled()).toHaveLength(0);
  });

  test('cancelAll() clears all pending', () => {
    const manager = createAutoPublishManager(1000);
    manager.schedule('target-1', async () => {});
    manager.schedule('target-2', async () => {});

    expect(manager.getScheduled()).toHaveLength(2);
    manager.cancelAll();
    expect(manager.getScheduled()).toHaveLength(0);
  });

  test('schedule() replaces existing timer for same target', () => {
    const manager = createAutoPublishManager(1000);
    manager.schedule('target-1', async () => {});
    manager.schedule('target-1', async () => {});

    expect(manager.getScheduled()).toHaveLength(1);
  });

  test('getScheduled() reports remaining time', () => {
    const manager = createAutoPublishManager(10000);
    manager.schedule('target-1', async () => {});

    const scheduled = manager.getScheduled();
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]!.remainingMs).toBeGreaterThan(0);
    expect(scheduled[0]!.remainingMs).toBeLessThanOrEqual(10000);
  });
});

// ---------------------------------------------------------------------------
// SyncConnector interface compliance
// ---------------------------------------------------------------------------

describe('SyncConnector interface', () => {
  test('NpmPublishConnector has push and validate methods', () => {
    const connector = new NpmPublishConnector(
      new MockNpmPublisher(),
      new MemoryFileSystem(),
      () => '/tmp/test',
    );
    expect(typeof connector.push).toBe('function');
    expect(typeof connector.validate).toBe('function');
  });
});
