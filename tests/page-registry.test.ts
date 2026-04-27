import { describe, expect, test } from 'bun:test';

import {
  PAGE_REGISTRY,
  REGISTERED_ROUTES,
  type RoutePath,
} from '../lib/routes/page-registry';

describe('PAGE_REGISTRY', () => {
  test('contains entries for every key declared in RoutePath', () => {
    // Compile-time check: the `as const satisfies Record<RoutePath, ...>` on
    // PAGE_REGISTRY makes this guarantee hold at the type level. The runtime
    // assertion below is a belt-and-suspenders check that catches accidental
    // deletes that bypass the satisfies check (e.g. via // @ts-expect-error).
    const expected: RoutePath[] = [
      '/',
      '/editor',
      '/editor/[iconId]',
      '/runtime-demo',
      '/demo/runtime',
    ];
    const keys = Object.keys(PAGE_REGISTRY);
    for (const route of expected) {
      // toHaveProperty would parse '/editor/[iconId]' as a nested path; just
      // check membership directly.
      expect(keys).toContain(route);
    }
  });

  test('REGISTERED_ROUTES enumerates exactly the registry keys', () => {
    expect(REGISTERED_ROUTES.sort()).toEqual(
      (Object.keys(PAGE_REGISTRY) as RoutePath[]).sort(),
    );
  });

  test('every redirect points to an in-registry target', () => {
    for (const def of Object.values(PAGE_REGISTRY)) {
      if (def.kind === 'redirect') {
        expect(REGISTERED_ROUTES).toContain(def.to);
      }
    }
  });

  test('the canonical editor entry point is a shell, not a redirect', () => {
    // Regression guard: the bug we're preventing is "/" silently becomes a
    // redirect (or, worse, points at a different shell than other editor
    // routes). If you change "/" away from a shell, ensure the change is
    // intentional and update this assertion.
    expect(PAGE_REGISTRY['/']).toEqual({
      kind: 'shell',
      shell: 'StudioLayout',
    });
  });

  test('all editor routes converge on the same shell', () => {
    // Layer-1 invariant: all routes that should land in StudioLayout do, even
    // when they get there via a redirect.
    const editorRoutes: RoutePath[] = ['/', '/editor', '/editor/[iconId]'];
    for (const route of editorRoutes) {
      const def = PAGE_REGISTRY[route];
      const target = def.kind === 'redirect' ? PAGE_REGISTRY[def.to] : def;
      expect(target.kind).toBe('shell');
      if (target.kind === 'shell') {
        expect(target.shell).toBe('StudioLayout');
      }
    }
  });
});
