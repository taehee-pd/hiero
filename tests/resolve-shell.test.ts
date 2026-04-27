import { describe, expect, test } from 'bun:test';

import type { PageDefinition } from '../lib/routes/page-registry';
import { resolveShell } from '../lib/routes/resolve-shell';

describe('resolveShell — production registry', () => {
  test('returns the shell directly for a shell route', () => {
    const result = resolveShell('/');
    expect(result.shell).toBe('StudioLayout');
    expect(result.finalRoute).toBe('/');
  });

  test('follows a redirect to its shell target', () => {
    const result = resolveShell('/editor');
    expect(result.shell).toBe('StudioLayout');
    expect(result.finalRoute).toBe('/');
  });

  test('follows a dynamic-route redirect to its shell target', () => {
    const result = resolveShell('/editor/[iconId]');
    expect(result.shell).toBe('StudioLayout');
    expect(result.finalRoute).toBe('/');
  });

  test('throws when the chain ends at a standalone route', () => {
    expect(() => resolveShell('/runtime-demo')).toThrow(/standalone/);
  });
});

// The cycle guard never fires against the real registry (which is
// authored by hand and currently cycle-free), but the registry type
// doesn't statically forbid cycles. Inject deliberately cyclic shapes
// here to prove the guard fires when it should.
describe('resolveShell — cycle detection (injected registry)', () => {
  test('detects an A→B→A cycle and throws', () => {
    const cyclic = {
      '/a': { kind: 'redirect', to: '/b' },
      '/b': { kind: 'redirect', to: '/a' },
    } as unknown as Record<string, PageDefinition>;
    expect(() => resolveShell('/a', cyclic)).toThrow(/cycle/i);
  });

  test('detects a self-redirect cycle and throws', () => {
    const selfCycle = {
      '/loop': { kind: 'redirect', to: '/loop' },
    } as unknown as Record<string, PageDefinition>;
    expect(() => resolveShell('/loop', selfCycle)).toThrow(/cycle/i);
  });

  test('detects a longer chain cycle (A→B→C→A)', () => {
    // Casts via `unknown` are needed because `PageDefinition.redirect.to`
    // is typed as RoutePath (the production union); injected test routes
    // like /c aren't in that union, so we widen for the fixture only.
    const longCycle = {
      '/a': { kind: 'redirect', to: '/b' },
      '/b': { kind: 'redirect', to: '/c' },
      '/c': { kind: 'redirect', to: '/a' },
    } as unknown as Record<string, PageDefinition>;
    expect(() => resolveShell('/a', longCycle)).toThrow(/cycle/i);
  });

  test('throws on a missing route in the chain (not a cycle but a corrupt registry)', () => {
    const missing = {
      '/a': { kind: 'redirect', to: '/missing' },
    } as unknown as Record<string, PageDefinition>;
    expect(() => resolveShell('/a', missing)).toThrow(/not in registry/);
  });
});
