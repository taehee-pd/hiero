// Happy-dom registration for Bun React component tests — MUST be
// side-effect-imported BEFORE any @testing-library/* module so
// @testing-library/dom's `screen` helper sees a valid document.body
// when it captures references at its own init time.
//
// This file ONLY registers; it does not import bun:test or schedule
// lifecycle hooks. When I tried adding afterAll(unregister) here,
// Bun's module loader subtly broke visibility of `document` inside
// @testing-library/react's render() — the module-level log showed
// document present, but the identifier wasn't in scope inside RTL's
// pure.js. Pushing lifecycle into the test file itself works cleanly.
//
// Each React test that wants unregister-after-file must call
// `unregisterHappyDom()` from an afterAll hook. This prevents the
// happy-dom DOMParser from leaking into later test files in the same
// bun test process — a contamination risk that only bites if a future
// DOMParser-using test file sorts alphabetically after a React test.
// Today none does (svg-sanitizer < toast-smoke), but the unregister is
// cheap insurance. Documented by codex adversarial review (finding #2).

import { GlobalRegistrator } from '@happy-dom/global-registrator';

declare global {
  // eslint-disable-next-line no-var
  var __contour_happy_dom_registered__: boolean | undefined;
}

if (!globalThis.__contour_happy_dom_registered__) {
  GlobalRegistrator.register();
  globalThis.__contour_happy_dom_registered__ = true;
}

export async function unregisterHappyDom(): Promise<void> {
  if (globalThis.__contour_happy_dom_registered__) {
    await GlobalRegistrator.unregister();
    globalThis.__contour_happy_dom_registered__ = false;
  }
}
