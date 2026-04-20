// Happy-dom registration for Bun React component tests.
//
// IMPORTANT: the register call runs at module eval so it fires BEFORE
// any @testing-library/* or userEvent module imports happen. ESM
// hoists imports above inline statements, so putting the call in the
// test file itself doesn't work — userEvent captures document
// references at its own init time and crashes on undefined.
//
// The bun test runner is split into two processes to avoid the
// happy-dom DOMParser contaminating the svg-sanitizer / raw-svg-
// adapter tests:
//
//   pnpm test:core  → tests/*.test.ts   (no happy-dom, native DOM)
//   pnpm test:dom   → tests/*.test.tsx  (happy-dom for React tests)
//
// `pnpm test` runs them sequentially. See package.json.
//
// Once a React test file imports this module, happy-dom stays
// registered for the rest of the test:dom process. No unregister —
// the module cache makes unregister unrecoverable across files.

import { GlobalRegistrator } from '@happy-dom/global-registrator';

declare global {
  // eslint-disable-next-line no-var
  var __hiero_happy_dom_registered__: boolean | undefined;
}

if (!globalThis.__hiero_happy_dom_registered__) {
  GlobalRegistrator.register();
  globalThis.__hiero_happy_dom_registered__ = true;
}
