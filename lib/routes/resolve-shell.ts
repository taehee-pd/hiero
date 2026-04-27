import {
  PAGE_REGISTRY,
  type PageDefinition,
  type RoutePath,
  type ShellId,
} from './page-registry';

/**
 * Resolve a route to the shell it eventually displays, by walking redirect
 * chains. Returns the resolved ShellId and the final route in the chain.
 *
 * Throws if:
 *   - the chain hits a `standalone` route (no shared shell)
 *   - the chain contains a cycle (registry data corruption — shouldn't be
 *     possible if PAGE_REGISTRY is authored by hand, but our type system
 *     doesn't statically forbid it, so we check at runtime)
 *
 * The `registry` parameter defaults to PAGE_REGISTRY but accepts an
 * arbitrary record so tests can inject deliberately-cyclic shapes.
 *
 * Used by:
 *   - tests/e2e/route-shell.spec.ts (Phase 2 Playwright dispatch)
 *   - app/_storybook/pages.stories.tsx (Phase 3b post-redirect snapshot)
 */
export function resolveShell(
  start: string,
  registry: Readonly<Record<string, PageDefinition>> = PAGE_REGISTRY,
): { shell: ShellId; finalRoute: string } {
  const seen = new Set<string>();
  let current: string = start;
  while (true) {
    if (seen.has(current)) {
      throw new Error(
        `Redirect cycle in registry starting at ${start}: ${[...seen, current].join(' → ')}`,
      );
    }
    seen.add(current);
    const def = registry[current];
    if (!def) {
      throw new Error(`Route ${current} not in registry (reached from ${start}).`);
    }
    if (def.kind === 'shell') {
      return { shell: def.shell, finalRoute: current as RoutePath };
    }
    if (def.kind === 'redirect') {
      current = def.to;
      continue;
    }
    if (def.kind === 'standalone') {
      throw new Error(
        `Cannot resolveShell(${start}): chain ended at standalone route ${current}, which has no shared shell.`,
      );
    }
    // unreachable; kept for exhaustiveness
    throw new Error(`Unknown PageDefinition kind for ${current}`);
  }
}
