import type { ReactNode } from 'react';

import { EditorRedirect } from '@/components/editor/EditorRedirect';
import { StudioLayout } from '@/components/studio/StudioLayout';

import { PAGE_REGISTRY, type RoutePath, type ShellId } from './page-registry';

type ShellOrRedirectArgs = {
  route: RoutePath;
  iconId?: string;
  children?: never;
};

type StandaloneArgs = {
  route: RoutePath;
  children: ReactNode;
  iconId?: never;
};

export type DefinePageArgs = ShellOrRedirectArgs | StandaloneArgs;

/**
 * Resolve a page entry from the registry into its rendered tree.
 *
 *   - shell      — render the registered shell (one switch case per ShellId).
 *   - redirect   — render <EditorRedirect>; it client-replaces into the target.
 *   - standalone — render whatever the page passed as children.
 *
 * The check script (`scripts/check-page-registry.ts`) verifies that every
 * `app/**\/page.tsx` calls this exactly once with a registered `route` key.
 * The discriminant + `as const satisfies` on the registry guarantees that
 * adding a route without choosing a `kind` won't compile.
 */
export function definePage(args: DefinePageArgs): ReactNode {
  const definition = PAGE_REGISTRY[args.route];

  switch (definition.kind) {
    case 'shell':
      return renderShell(definition.shell);
    case 'redirect':
      return <EditorRedirect iconId={args.iconId} />;
    case 'standalone':
      if (!('children' in args) || args.children === undefined) {
        throw new Error(
          `Page ${args.route} is registered as 'standalone' but definePage() was called without children.`,
        );
      }
      return args.children;
    default:
      // Exhaustiveness guard: when a new `kind` is added to PageDefinition,
      // TypeScript narrows `definition` to the new arm here and refuses to
      // assign it to `never`. Without this, the switch silently returns
      // undefined for unhandled kinds.
      return assertNever(definition);
  }
}

function renderShell(shell: ShellId): ReactNode {
  switch (shell) {
    case 'StudioLayout':
      return <StudioLayout />;
    default:
      return assertNever(shell);
  }
}

function assertNever(value: never): never {
  throw new Error(
    `Unhandled discriminant in definePage: ${JSON.stringify(value)}. Add a case in lib/routes/define-page.tsx.`,
  );
}
