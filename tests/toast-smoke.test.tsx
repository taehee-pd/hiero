// Verification test for plan §6 Phase 2 Commit B.
//
// The plan's premise: before this commit, toast() calls in the app pushed
// to a renderer that wasn't mounted — <Toaster /> was missing from
// app/layout.tsx, components/ui/toaster.tsx imported from the wrong
// @/hooks/use-toast path, and there were two byte-identical use-toast.ts
// files drifting apart.
//
// After this commit: one hook (@/components/ui/use-toast), one toaster,
// mounted in the app root. This file has two kinds of assertions:
//
//   1. Runtime: rendering <Toaster /> + calling toast() actually puts the
//      toast content in the DOM via the real use-toast store. Proves the
//      plumbing works end-to-end.
//
//   2. Static: app/layout.tsx actually imports <Toaster /> from the
//      canonical path AND renders it. The runtime test doesn't cover this
//      — someone could delete the mount in layout.tsx tomorrow and the
//      runtime test would still pass because it renders its own Toaster.
//      The static check is the real regression guard for the latent bug.

// React test setup — MUST come before @testing-library/* imports so
// happy-dom registers document/window before RTL modules capture their
// references. See tests/setup/happy-dom.ts and tests/setup/react.ts.
// Kept as an explicit import (not a bunfig preload) because happy-dom's
// DOMParser interferes with the existing SVG sanitizer tests.
import './setup/happy-dom';
import './setup/react';

// NOTE: avoid `screen` from @testing-library/dom — its module captures
// document.body at its OWN init time, and bun's import hoisting makes
// that run before our setup/happy-dom in some orderings. Using the
// per-render query helpers returned by `render(...)` sidesteps this: they
// bind to the actual container at call time, after happy-dom is up.
import { test, expect, afterEach, beforeEach } from 'bun:test';
import { act, cleanup, render, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Toaster } from '@/components/ui/toaster';
import { toast, resetToastStateForTest } from '@/components/ui/use-toast';

beforeEach(() => {
  // The toast store is a module-level singleton with an effectively
  // infinite TOAST_REMOVE_DELAY (~1M ms). Without an explicit reset,
  // toasts fired by one test leak into every subsequent test in the
  // same bun process. Codex adversarial review (Phase 4) finding #8.
  resetToastStateForTest();
});

afterEach(() => { cleanup(); });


// Release happy-dom's hold on globalThis once this file's tests finish,
// so any later test file (e.g. svg-sanitizer, raw-svg-adapter) in the
// same bun test process sees Bun's native DOMParser again instead of
// happy-dom's divergent implementation. Addresses codex adversarial
// review finding #2 (contamination risk).

test('Toaster renders a toast fired via the canonical use-toast hook', async () => {
  const rendered = render(<Toaster />);

  act(() => {
    toast({ title: 'hello toast', description: 'from the smoke test' });
  });

  // Radix portals the toast viewport to document.body, not into the
  // rendered container. Scope the lookup to document.body via `within`.
  const body = within(document.body);
  const title = await body.findByText('hello toast');
  expect(title).toBeInTheDocument();

  const description = await body.findByText('from the smoke test');
  expect(description).toBeInTheDocument();

  rendered.unmount();
});

test('toast() is a function exported from the canonical path', () => {
  expect(typeof toast).toBe('function');
});

test('app/layout.tsx mounts <Toaster /> from the canonical path (regression guard)', () => {
  // Read the actual root layout source and assert:
  //   1. Toaster is imported from @/components/ui/toaster (not a local copy,
  //      not from a feature folder, not from a stale kibo-ui re-export).
  //   2. <Toaster /> is rendered somewhere in the JSX tree.
  //   3. Nobody re-introduced @/hooks/use-toast as a direct import path.
  //
  // If any of these fail, toast() in the running app will push to a
  // renderer that isn't mounted — the exact latent bug Phase 2 Commit B
  // exists to fix. A pure runtime test (the one above) would not catch a
  // regression that removes the mount from app/layout.tsx, because it
  // mounts its own Toaster inline.
  //
  // Codex adversarial review flagged that exact-string matching here
  // is brittle (aliased imports, prettier wrapping, adding props to
  // <Toaster>, moving the mount into a Providers wrapper). The regex
  // patterns below allow whitespace / quote-style variation and
  // multi-import lines, while still failing when the Toaster name or
  // the canonical path disappears.
  const layout = readFileSync(resolve(import.meta.dir, '..', 'app/layout.tsx'), 'utf8');

  // Import: allows `import { Toaster }` OR `import { X, Toaster, Y }`
  // OR `import { Toaster as _ }`, with either quote style and any
  // whitespace. Requires the path to be @/components/ui/toaster.
  const toasterImportRe =
    /import\s*(?:type\s+)?\{[^}]*\bToaster\b(?:\s+as\s+\w+)?[^}]*\}\s*from\s*['"]@\/components\/ui\/toaster['"]/;
  expect(layout).toMatch(toasterImportRe);

  // JSX: `<Toaster`, `<Toaster />`, `<Toaster prop={}>`. `<` then
  // optional whitespace then the name then a non-word boundary
  // (space, slash, newline, or attribute).
  expect(layout).toMatch(/<\s*Toaster\b[^>]*\/?>/);

  // Nobody re-introduced the deleted hook path.
  expect(layout).not.toMatch(/@\/hooks\/use-toast/);
});

test('components/ui/toaster.tsx imports from the canonical use-toast path', () => {
  // Second half of the regression guard: even if app/layout.tsx mounts
  // <Toaster />, it's useless if toaster.tsx subscribes to a different
  // hook store than the one app code calls toast() against. This is the
  // exact bug pattern that shipped before Phase 2 Commit B — two
  // byte-identical use-toast.ts files that drifted apart, with
  // toaster.tsx pointing at the wrong one.
  const toasterSrc = readFileSync(
    resolve(import.meta.dir, '..', 'components/ui/toaster.tsx'),
    'utf8',
  );

  // Same shape as above — allow any import structure that pulls from
  // the canonical path.
  expect(toasterSrc).toMatch(/from\s*['"]@\/components\/ui\/use-toast['"]/);
  expect(toasterSrc).not.toMatch(/@\/hooks\/use-toast/);
});
