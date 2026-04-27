import type { Decorator, Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ReactElement } from 'react';

import { editorStore } from '@/lib/editor-store/store';
import { definePage } from '@/lib/routes/define-page';
import { type RoutePath } from '@/lib/routes/page-registry';
import { resolveShell } from '@/lib/routes/resolve-shell';
import { SAMPLE_WORKSPACE } from '@/lib/schema/sample-project';

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
 *
 * ## Determinism
 *
 * StudioLayout boots the workspace via a useEffect that asynchronously
 * checks IndexedDB then falls back to SAMPLE_WORKSPACE. In Chromatic's
 * iframe the IndexedDB call resolves to "empty" but the chain is still
 * async, which the audit flagged as a flake source — different runs would
 * capture different loading states, producing perpetual diffs that no
 * amount of "Accept" clicking could resolve.
 *
 * The `loadWorkspaceDecorator` below sidesteps the async race by writing
 * SAMPLE_WORKSPACE into the editor store SYNCHRONOUSLY, before the story's
 * component mounts. StudioLayout's bootstrap effect then sees a populated
 * workspace and early-returns — no async work, no race, snapshots are
 * byte-identical across runs.
 */

const loadWorkspaceDecorator: Decorator = (Story) => {
  // Idempotent: subsequent stories reuse the workspace the first one set.
  // Resetting between stories isn't needed — the snapshot only cares about
  // the initial render, and StudioLayout's effect early-returns if state
  // is already populated.
  if (!editorStore.getState().workspace) {
    editorStore.getState().loadWorkspace(SAMPLE_WORKSPACE);
  }
  return <Story />;
};

function resolveToShellTree(route: RoutePath): ReactElement {
  // resolveShell() throws on cycles AND on standalone landings — both are
  // exactly what we want for this story file. The fragment wrap satisfies
  // Storybook's render signature, which is stricter than ReactNode.
  // The cast is sound: when called against the default PAGE_REGISTRY (i.e.
  // not in tests), `finalRoute` is always one of its keys, which IS RoutePath.
  const { finalRoute } = resolveShell(route);
  return <>{definePage({ route: finalRoute as RoutePath })}</>;
}

const meta: Meta = {
  title: 'Pages/Routes',
  decorators: [loadWorkspaceDecorator],
  parameters: {
    // Full-bleed: StudioLayout uses `fixed inset-0`, so the .sb-root
    // wrapper from preview.tsx would otherwise clip the layout.
    layout: 'fullscreen',
    chromatic: {
      // The decorator above pre-loads SAMPLE_WORKSPACE synchronously, so
      // there's no async bootstrap to wait on. A short delay still helps
      // catch the case where an `EditorShell` dynamic-import resolves on
      // a future render — but with no icon selected (the workspace boots
      // to the empty-state placeholder), EditorShell isn't even rendered.
      // 200ms is enough for paint + layout to settle.
      delay: 200,
      // Only one viewport per route — these stories aren't responsive
      // tests, they're identity checks. Cap the snapshot budget.
      viewports: [1280],
      // Suppress motion-related diffs from the empty-state's transitions.
      pauseAnimationAtEnd: true,
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
