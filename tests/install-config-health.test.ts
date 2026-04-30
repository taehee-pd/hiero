/**
 * Tests for runConfigHealthChecks — the browser-safe health surface.
 *
 * Pinned: this module never touches process.env or the filesystem, so
 * the test reflects pure-shape behavior.
 */

import { describe, it, expect } from 'bun:test';
import { runConfigHealthChecks } from '@/lib/install-config/health-checks';

describe('runConfigHealthChecks', () => {
  it('reports a fail for a structurally invalid config', () => {
    const checks = runConfigHealthChecks({ sourceDir: 123 });
    expect(checks[0].name).toBe('Config schema');
    expect(checks[0].status).toBe('fail');
  });

  it('reports ok + warns when no release targets are configured', () => {
    const checks = runConfigHealthChecks({
      sourceDir: 'hiero',
      hostTargets: [
        { kind: 'react-app', mode: 'live', runtimeMode: 'in-memory' },
      ],
    });
    const schema = checks.find((c) => c.name === 'Config schema');
    const hosts = checks.find((c) => c.name === 'Host targets');
    const release = checks.find((c) => c.name === 'Release targets');
    expect(schema!.status).toBe('ok');
    expect(hosts!.status).toBe('ok');
    expect(release!.status).toBe('warn');
    expect(release!.detail).toContain('Publish has nothing to push to');
  });

  it('reports ok across all checks when fully configured', () => {
    const checks = runConfigHealthChecks({
      sourceDir: 'hiero',
      hostTargets: [
        { kind: 'react-app', mode: 'live', runtimeMode: 'in-memory' },
      ],
      releaseTargets: [
        {
          kind: 'local-directory',
          outputMode: 'snapshot',
          outputDir: 'src/icons/generated',
        },
      ],
    });
    expect(checks.every((c) => c.status === 'ok')).toBe(true);
  });

  it('warns when host targets list is empty', () => {
    const checks = runConfigHealthChecks({
      sourceDir: 'hiero',
      hostTargets: [],
      releaseTargets: [
        {
          kind: 'local-directory',
          outputMode: 'snapshot',
          outputDir: 'out',
        },
      ],
    });
    const hosts = checks.find((c) => c.name === 'Host targets');
    expect(hosts!.status).toBe('warn');
    expect(hosts!.detail).toContain('no host target');
  });
});
