import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  buildNpmPublishPayload,
  bumpVersion,
  getNextPublishVersion,
  publishNpmTarget,
} from '@/lib/sync-service/npm-publish-client';
import type { Project, SyncTarget } from '@/lib/schema/types';

function createTestTarget(overrides: Partial<SyncTarget> = {}): SyncTarget {
  return {
    id: 'test-target',
    name: 'Test Registry',
    platform: 'react',
    deliveryMode: 'npm-registry',
    npmRegistry: {
      registry: 'https://registry.npmjs.org',
      packageName: '@acme/icons',
      lastPublishedVersion: '1.2.3',
    },
    autoPublish: {
      on: 'save',
      semver: 'patch',
    },
    ...overrides,
  };
}

function createTestProject(): Project {
  return {
    version: '1.0',
    meta: {
      name: 'Icons',
      createdAt: '2026-03-28T00:00:00.000Z',
      updatedAt: '2026-03-28T00:00:00.000Z',
    },
    icons: {},
    collections: [],
    syncTargets: [],
  } as unknown as Project;
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('npm publish client helpers', () => {
  test('bumpVersion increments the requested semver part', () => {
    expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4');
    expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0');
    expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0');
  });

  test('getNextPublishVersion falls back to 0.0.0 when no version exists', () => {
    const target = createTestTarget({
      npmRegistry: {
        registry: 'https://registry.npmjs.org',
        packageName: '@acme/icons',
      },
    });
    expect(getNextPublishVersion(target, 'minor')).toBe('0.1.0');
  });

  test('buildNpmPublishPayload returns the server-side publish request body', () => {
    const payload = buildNpmPublishPayload({
      project: createTestProject(),
      target: createTestTarget(),
      version: '1.2.4',
    });

    expect(payload.project.meta.name).toBe('Icons');
    expect(payload.target.npmRegistry?.packageName).toBe('@acme/icons');
    expect(payload.version).toBe('1.2.4');
    expect(payload.dryRun).toBe(false);
  });

  test('publishNpmTarget posts compiled payload and returns success', async () => {
    const fetchMock = mock(async () =>
      new Response(JSON.stringify({ kind: 'success' }), { status: 200 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await publishNpmTarget({
      project: createTestProject(),
      target: createTestTarget(),
      version: '1.2.4',
    });

    expect(result.kind).toBe('success');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls[0]?.[1]?.method).toBe('POST');
  });

  test('publishNpmTarget returns dry-run result when requested', async () => {
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ kind: 'success' }), { status: 200 }),
    ) as unknown as typeof fetch;

    const result = await publishNpmTarget({
      project: createTestProject(),
      target: createTestTarget(),
      version: '1.2.4',
      dryRun: true,
    });

    expect(result.kind).toBe('dry-run');
  });

  test('publishNpmTarget surfaces API errors', async () => {
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }),
    ) as unknown as typeof fetch;

    const result = await publishNpmTarget({
      project: createTestProject(),
      target: createTestTarget(),
      version: '1.2.4',
    });

    expect(result).toEqual({
      kind: 'error',
      message: 'Forbidden',
      statusCode: 403,
    });
  });
});
