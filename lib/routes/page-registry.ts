/**
 * Page registry — single source of truth for every Next.js App Router page in
 * the project. Each `app/**\/page.tsx` enrols itself by calling `definePage`
 * (see `./define-page`) with a `route` key declared here. The check script at
 * `scripts/check-page-registry.ts` fails CI if any page file forgets to enrol
 * or if the route key isn't in this map.
 *
 * Why a discriminant: not every page renders the same shell. The bug we're
 * preventing is "two routes that should land in the same UI accidentally drift
 * into different ones." Modelling that requires distinguishing:
 *
 *   - shell      — the route renders one of the registered top-level shells
 *   - redirect   — the route immediately client-redirects to another route
 *                  (the *eventual* shell lives at the redirect target)
 *   - standalone — the route is its own thing (demo pages, sandboxes); not
 *                  governed by shell-consistency, but still tracked so a new
 *                  page can't be added without an explicit decision
 */

export type ShellId = 'StudioLayout';

export type RoutePath =
  | '/'
  | '/editor'
  | '/editor/[iconId]'
  | '/runtime-demo'
  | '/demo/runtime';

export type PageDefinition =
  | { readonly kind: 'shell'; readonly shell: ShellId }
  | { readonly kind: 'redirect'; readonly to: RoutePath }
  | { readonly kind: 'standalone' };

export const PAGE_REGISTRY = {
  '/': { kind: 'shell', shell: 'StudioLayout' },
  '/editor': { kind: 'redirect', to: '/' },
  '/editor/[iconId]': { kind: 'redirect', to: '/' },
  '/runtime-demo': { kind: 'standalone' },
  '/demo/runtime': { kind: 'standalone' },
} as const satisfies Record<RoutePath, PageDefinition>;

/** Route keys, derived from the registry so the two can never disagree. */
export const REGISTERED_ROUTES = Object.keys(PAGE_REGISTRY) as RoutePath[];
