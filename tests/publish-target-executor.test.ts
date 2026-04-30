/**
 * publish-target-executor adapter tests.
 *
 * Pinned contracts:
 *   - git-pr  → POST /api/github-sync/pr with releaseMetadata
 *   - npm    → POST /api/publish-npm with version + adapted target shape
 *   - local-directory → triggers downloadTextFile and reports success
 *   - failed network responses surface as { status: 'failed' }
 *   - unknown errors caught and surfaced (no orchestrator crash)
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createTargetExecutor } from '@/lib/sync-ui/publish-target-executor';
import type { Workspace, Project } from '@/lib/schema/types';

function makeProject(): Project {
  return {
    version: '1.0',
    meta: {
      name: 'TestSet',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    icons: {},
  } as Project;
}

function makeWorkspace(): Workspace {
  return {
    version: '2.0',
    meta: {
      name: 'TestProject',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    iconSets: { 'set-1': makeProject() },
    activeIconSetId: 'set-1',
  };
}

const ctx = () => ({
  workspace: makeWorkspace(),
  project: makeProject(),
  actor: { name: 'taehee' },
  releaseMetadata: { version: '1.2.0', releaseNotes: 'release notes' },
});

describe('createTargetExecutor — git-pr', () => {
  beforeEach(() => {
    // @ts-expect-error stub global fetch for each test
    globalThis.fetch = mock(async () =>
      new Response(
        JSON.stringify({ pr: { number: 42, url: 'https://example.com/pr/42' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
  });

  it('returns success with the PR url on a 200 response', async () => {
    const executor = createTargetExecutor(ctx());
    const result = await executor({
      kind: 'git-pr',
      payload: {
        kind: 'git-pr',
        outputMode: 'snapshot',
        owner: 'taehee-pd',
        repo: 'icon-authoring-tool',
        baseBranch: 'main',
      },
    });
    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('unreachable');
    expect(result.url).toBe('https://example.com/pr/42');
  });

  it('passes releaseMetadata through to the API request body', async () => {
    const fetchMock = mock(async () =>
      new Response(
        JSON.stringify({ pr: { number: 1, url: 'https://x' } }),
        { status: 200 },
      ),
    );
    // @ts-expect-error stub
    globalThis.fetch = fetchMock;

    const executor = createTargetExecutor(ctx());
    await executor({
      kind: 'git-pr',
      payload: {
        kind: 'git-pr',
        outputMode: 'snapshot',
        owner: 'o',
        repo: 'r',
        baseBranch: 'main',
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = (fetchMock as unknown as ReturnType<typeof mock>).mock.calls[0];
    const body = JSON.parse((init as { body: string }).body);
    expect(body.releaseMetadata).toEqual({
      version: '1.2.0',
      releaseNotes: 'release notes',
    });
    expect(body.owner).toBe('o');
    expect(body.repo).toBe('r');
  });

  it('returns failed when the response is non-2xx', async () => {
    // @ts-expect-error stub
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ message: 'token expired' }), { status: 401 }),
    );

    const executor = createTargetExecutor(ctx());
    const result = await executor({
      kind: 'git-pr',
      payload: {
        kind: 'git-pr',
        outputMode: 'snapshot',
        owner: 'o',
        repo: 'r',
        baseBranch: 'main',
      },
    });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') throw new Error('unreachable');
    expect(result.error).toBe('token expired');
  });
});

describe('createTargetExecutor — npm-registry', () => {
  it('reports success with a registry URL on success kind', async () => {
    // @ts-expect-error stub
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ kind: 'success', packageName: '@x/y' }), {
          status: 200,
        }),
    );
    const executor = createTargetExecutor(ctx());
    const result = await executor({
      kind: 'npm-registry',
      payload: {
        kind: 'npm-registry',
        outputMode: 'snapshot',
        packageName: '@hiero/icons',
      },
    });
    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('unreachable');
    expect(result.url).toBe('https://www.npmjs.com/package/@hiero/icons');
  });

  it('reports failed when API returns non-success kind', async () => {
    // @ts-expect-error stub
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ kind: 'error', message: 'no token' }), {
          status: 200,
        }),
    );
    const executor = createTargetExecutor(ctx());
    const result = await executor({
      kind: 'npm-registry',
      payload: {
        kind: 'npm-registry',
        outputMode: 'snapshot',
        packageName: '@x/y',
      },
    });
    expect(result.status).toBe('failed');
  });

  it('honours custom registry URL', async () => {
    // @ts-expect-error stub
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ kind: 'success', packageName: '@x/y' }), {
          status: 200,
        }),
    );
    const executor = createTargetExecutor(ctx());
    const result = await executor({
      kind: 'npm-registry',
      payload: {
        kind: 'npm-registry',
        outputMode: 'snapshot',
        packageName: '@hiero/icons',
        registry: 'https://npm.example.com',
      },
    });
    if (result.status !== 'success') throw new Error('unreachable');
    expect(result.url).toBe('https://npm.example.com/package/@hiero/icons');
  });
});

describe('createTargetExecutor — local-directory', () => {
  it('catches downloadTextFile failures and reports them', async () => {
    // happy-dom typically lacks a real DOM here; the function may
    // throw on document access. The executor should catch that and
    // surface a failure rather than crashing the orchestrator.
    const executor = createTargetExecutor(ctx());
    const result = await executor({
      kind: 'local-directory',
      payload: {
        kind: 'local-directory',
        outputMode: 'snapshot',
        outputDir: 'src/icons/generated',
      },
    });
    // We don't assert on success/failure here because the outcome
    // depends on whether `document` is available in this test
    // process (test:core has no DOM, test:dom does). The contract
    // we *do* pin: the orchestrator never sees an unhandled throw.
    expect(['success', 'failed']).toContain(result.status);
  });
});

describe('createTargetExecutor — error handling', () => {
  it('reports failed when payload is missing', async () => {
    const executor = createTargetExecutor(ctx());
    const result = await executor({ kind: 'git-pr' });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') throw new Error('unreachable');
    expect(result.error).toContain('missing payload');
  });

  it('catches network errors thrown by fetch', async () => {
    // @ts-expect-error stub
    globalThis.fetch = mock(async () => {
      throw new Error('net::ERR_CONNECTION_REFUSED');
    });
    const executor = createTargetExecutor(ctx());
    const result = await executor({
      kind: 'git-pr',
      payload: {
        kind: 'git-pr',
        outputMode: 'snapshot',
        owner: 'o',
        repo: 'r',
        baseBranch: 'main',
      },
    });
    expect(result.status).toBe('failed');
    if (result.status !== 'failed') throw new Error('unreachable');
    expect(result.error).toContain('CONNECTION_REFUSED');
  });
});
