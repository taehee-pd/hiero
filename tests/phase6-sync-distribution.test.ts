import { describe, expect, test } from 'bun:test';

import type { Icon, IconType, SyncTarget, IconSet } from '../lib/schema/types';
import type {
  RuntimeIconMeta,
  RuntimeVariantPayload,
} from '../lib/export/export-runtime-json';
import {
  buildManifest,
  computeStaleFiles,
  parseManifest,
  serializeManifest,
  MANIFEST_FILENAME,
} from '../lib/export/adapters/manifest-cleanup';
import {
  syncLocalDirectory,
  type FileSystem,
  type LocalDirectorySyncRequest,
} from '../lib/sync-service/connectors/local-directory-connector';
import type { AdapterPrSyncRequest } from '../lib/sync-service/connectors/adapter-pr-connector';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeTestIcon(): Icon {
  const defaultType: IconType = {
    id: 'default',
    layers: {
      bg: {
        id: 'bg',
        path: { d: 'M0 0H24V24H0Z' },
        style: { fill: { mode: 'fixed', value: '#fff' } },
      },
    },
  };

  return {
    id: 'icon-test',
    name: 'Test Icon',
    variants: {
      v24: {
        id: 'v24',
        size: 24,
        viewBox: [0, 0, 24, 24],
        layers: defaultType.layers,
        defaultType: 'default',
        types: { default: defaultType },
      },
    },
    transitions: {},
  };
}

function makeMeta(icon: Icon): RuntimeIconMeta {
  return {
    id: icon.id,
    name: icon.name,
    variants: Object.fromEntries(
      Object.entries(icon.variants).map(([k, v]) => [
        k,
        { size: v.size, viewBox: v.viewBox },
      ]),
    ),
  };
}

function makeMockVariant(): RuntimeVariantPayload {
  return {
    variant: { id: 'v24', size: 24, viewBox: [0, 0, 24, 24] },
    layers: [{
      id: 'bg',
      d: 'M0 0H24V24H0Z',
      fill: { kind: 'solid', color: '#fff' },
      stroke: { kind: 'none' },
    }],
  };
}

function createMemoryFs(): FileSystem & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    readFile: async (path) => files.get(path) ?? null,
    writeFile: async (path, contents) => { files.set(path, contents); },
    removeFile: async (path) => { files.delete(path); },
    mkdirp: async () => {},
  };
}

// ---------------------------------------------------------------------------
// 6.1 — SyncTarget schema
// ---------------------------------------------------------------------------

describe('6.1 — SyncTarget schema', () => {
  test('SyncTarget type for local-directory', () => {
    const target: SyncTarget = {
      id: 'local-1',
      name: 'Local Dev',
      platform: 'react',
      deliveryMode: 'local-directory',
      localDirectory: { path: '/Users/dev/project/src/icons' },
      adapterConfig: { runtimePackage: '@contour/runtime-react', outputDir: 'src' },
    };
    expect(target.deliveryMode).toBe('local-directory');
    expect(target.localDirectory?.path).toBe('/Users/dev/project/src/icons');
  });

  test('SyncTarget type for git-pr', () => {
    const target: SyncTarget = {
      id: 'gh-1',
      name: 'Production',
      platform: 'react',
      deliveryMode: 'git-pr',
      gitPr: {
        owner: 'my-org',
        repo: 'icon-lib',
        baseBranch: 'main',
        packagePath: 'packages/icons',
      },
    };
    expect(target.deliveryMode).toBe('git-pr');
    expect(target.gitPr?.owner).toBe('my-org');
  });

  test('IconSet accepts syncTargets array', () => {
    const iconSet = {
      version: '1.0' as const,
      meta: { name: 'Test', createdAt: '', updatedAt: '' },
      icons: {},
      syncTargets: [
        {
          id: 'target-1',
          name: 'Local',
          platform: 'react' as const,
          deliveryMode: 'local-directory' as const,
          localDirectory: { path: '/tmp/icons' },
        },
      ],
    };
    expect(iconSet.syncTargets).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 6.3 — Local directory sync
// ---------------------------------------------------------------------------

describe('6.3 — Local directory sync connector', () => {
  test('writes generated files and manifest', async () => {
    const fs = createMemoryFs();
    const icon = makeTestIcon();

    const request: LocalDirectorySyncRequest = {
      targetDir: '/output',
      platform: 'react',
      icons: [{ icon, meta: makeMeta(icon), variants: [makeMockVariant()] }],
    };

    const result = await syncLocalDirectory(request, fs);

    expect(result.kind).toBe('success');
    expect(result.written.length).toBeGreaterThan(0);
    expect(result.removed).toEqual([]);

    // Manifest was written
    const manifestJson = fs.files.get(`/output/${MANIFEST_FILENAME}`);
    expect(manifestJson).toBeDefined();
    const manifest = parseManifest(manifestJson!);
    expect(manifest).not.toBeNull();
    expect(manifest!.platform).toBe('react');
    expect(manifest!.files.length).toBeGreaterThan(0);
  });

  test('removes stale files from previous generation', async () => {
    const fs = createMemoryFs();
    const icon = makeTestIcon();

    // Simulate previous generation with an extra file
    const prevManifest = buildManifest('react', [
      'src/TestIcon/TestIcon.tsx',
      'src/OldIcon/OldIcon.tsx',  // This will be stale
      'src/index.ts',
    ], '2024-01-01T00:00:00.000Z');

    // Write the "old" file so it can be removed
    fs.files.set('/output/src/OldIcon/OldIcon.tsx', 'old content');

    // Set up manifest from previous run
    fs.files.set(`/output/${MANIFEST_FILENAME}`, serializeManifest(prevManifest));

    const request: LocalDirectorySyncRequest = {
      targetDir: '/output',
      platform: 'react',
      icons: [{ icon, meta: makeMeta(icon), variants: [makeMockVariant()] }],
    };

    const result = await syncLocalDirectory(request, fs);

    expect(result.kind).toBe('success');
    // The OldIcon file should have been removed (it's not in the new generation)
    expect(result.removed).toContain('src/OldIcon/OldIcon.tsx');
    expect(fs.files.has('/output/src/OldIcon/OldIcon.tsx')).toBe(false);
  });

  test('handles first sync (no previous manifest)', async () => {
    const fs = createMemoryFs();
    const icon = makeTestIcon();

    const result = await syncLocalDirectory({
      targetDir: '/fresh',
      platform: 'react',
      icons: [{ icon, meta: makeMeta(icon), variants: [makeMockVariant()] }],
    }, fs);

    expect(result.kind).toBe('success');
    expect(result.removed).toEqual([]);
    expect(result.written.length).toBeGreaterThan(0);
  });

  test('passes adapter diagnostics through', async () => {
    const fs = createMemoryFs();
    const icon = makeTestIcon();

    const result = await syncLocalDirectory({
      targetDir: '/output',
      platform: 'react',
      icons: [{ icon, meta: makeMeta(icon), variants: [makeMockVariant()] }],
    }, fs);

    // Diagnostics is always an array (may be empty if no issues)
    expect(Array.isArray(result.diagnostics)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6.4 — Adapter PR sync (contract/type tests — no real GitHub)
// ---------------------------------------------------------------------------

describe('6.4 — Adapter PR sync types', () => {
  test('AdapterPrSyncRequest type is valid', () => {
    const request: AdapterPrSyncRequest = {
      owner: 'my-org',
      repo: 'icon-lib',
      baseBranch: 'main',
      packagePath: 'packages/icons',
      platform: 'react',
      icons: [],
      actor: { name: 'Test User', email: 'test@example.com' },
      previousManifest: null,
    };
    expect(request.platform).toBe('react');
    expect(request.actor.name).toBe('Test User');
  });

  test('AdapterPrSyncRequest without optional fields', () => {
    const request: AdapterPrSyncRequest = {
      owner: 'org',
      repo: 'repo',
      platform: 'react',
      icons: [],
      actor: { name: 'User' },
    };
    expect(request.baseBranch).toBeUndefined();
    expect(request.packagePath).toBeUndefined();
    expect(request.previousManifest).toBeUndefined();
  });

  test('AdapterPrSyncRequest with adapter config', () => {
    const icon = makeTestIcon();
    const request: AdapterPrSyncRequest = {
      owner: 'org',
      repo: 'repo',
      platform: 'react',
      icons: [{ icon, meta: makeMeta(icon), variants: [makeMockVariant()] }],
      actor: { name: 'User' },
      adapterConfig: {
        runtimePackage: '@my-scope/contour-runtime',
        outputDir: 'lib/icons',
      },
    };
    expect(request.adapterConfig?.runtimePackage).toBe('@my-scope/contour-runtime');
  });
});

// ---------------------------------------------------------------------------
// Manifest cleanup integration
// ---------------------------------------------------------------------------

describe('Manifest cleanup for sync', () => {
  test('computeStaleFiles identifies removed files', () => {
    const prev = buildManifest('react', ['a.tsx', 'b.tsx', 'c.tsx'], '2024-01-01');
    const current = ['a.tsx', 'c.tsx'];
    const stale = computeStaleFiles(prev, current);
    expect(stale).toEqual(['b.tsx']);
  });

  test('computeStaleFiles returns empty on first sync', () => {
    expect(computeStaleFiles(null, ['a.tsx'])).toEqual([]);
  });

  test('manifest roundtrip', () => {
    const manifest = buildManifest('react', ['src/A.tsx', 'src/index.ts'], '2024-06-15');
    const json = serializeManifest(manifest);
    const parsed = parseManifest(json);
    expect(parsed).not.toBeNull();
    expect(parsed!.files).toEqual(['src/A.tsx', 'src/index.ts']);
    expect(parsed!.platform).toBe('react');
  });
});
