import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ReactElement } from 'react';

import { definePage } from '@/lib/routes/define-page';
import { PAGE_REGISTRY, type RoutePath } from '@/lib/routes/page-registry';

/**
 * Page-level stories — one per registered editor route.
 *
 * Phase 3b of the route-divergence defense (per /plan-eng-review). Phase 1
 * proves at build time that every page enrols in PAGE_REGISTRY; Phase 2
 * proves at runtime that the redirect chain ends at the right shell. This
 * file gives Chromatic a snapshot per route, so visual drift at the route
 * level is gated by the same PR check that already gates component drift.
 *
 * The stories render the *resolved* shell (post redirect-chain), not the
 * raw page component. Two reasons:
 *
 *   1. `app/editor/[iconId]/page.tsx` is an async Server Component;
 *      Storybook can't synchronously call it without the App Router
 *      runtime. `definePage()` is a synchronous client function and
 *      produces the same render tree.
 *   2. For redirect routes, the user-visible state is the *target* shell,
 *      not the empty <EditorRedirect> wrapper. Snapshotting the wrapper
 *      would just be a blank page.
 *
 * Standalone routes (/runtime-demo, /demo/runtime) are skipped — they're
 * one-off demo pages, isolated from the editor surface bug class. A future
 * phase can add them once we have a use case.
 */

function resolveToShellTree(route: RoutePath): ReactElement {
  const seen = new Set<RoutePath>();
  let current: RoutePath = route;
  while (true) {
    if (seen.has(current)) {
      throw new Error(`Redirect cycle starting at ${route}`);
    }
    seen.add(current);
    const def = PAGE_REGISTRY[current];
    if (def.kind === 'shell') {
      // definePage's shell arm always returns a ReactElement (the registered
      // shell component). Wrap in a fragment to satisfy Storybook's render
      // signature, which is stricter than ReactNode.
      return <>{definePage({ route: current })}</>;
    }
    if (def.kind === 'redirect') {
      current = def.to;
      continue;
    }
    throw new Error(
      `Story for ${route} resolved to standalone (${current}); standalone routes don't have stories in this file.`,
    );
  }
}

const meta: Meta = {
  title: 'Pages/Routes',
  parameters: {
    // Full-bleed: StudioLayout uses `fixed inset-0`, so the .sb-root
    // wrapper from preview.tsx would otherwise clip the layout.
    layout: 'fullscreen',
    chromatic: {
      // The shell's bootstrap effect waits on an IndexedDB read (empty in
      // Storybook iframes) before falling back to SAMPLE_WORKSPACE. Give
      // that microtask + the dynamic-import of EditorShell time to settle
      // before Chromatic captures.
      delay: 600,
      // Only one viewport per route — these stories aren't responsive
      // tests, they're identity checks. Cap the snapshot budget.
      viewports: [1280],
    },
  },
};

export default meta;

type Story = StoryObj;

// New editor routes added to PAGE_REGISTRY don't automatically get a story
// here — they have to be wired in by hand below. tests/page-registry.test.ts
// proves the registry is complete; this file proves Chromatic has a snapshot
// per editor route. If you add a new editor route, also add a Story export.

export const Home: Story = {
  name: '/',
  render: () => resolveToShellTree('/'),
};

export const EditorIndex: Story = {
  name: '/editor → /',
  render: () => resolveToShellTree('/editor'),
};

export const EditorByIconId: Story = {
  name: '/editor/[iconId] → /',
  render: () => resolveToShellTree('/editor/[iconId]'),
};
