// Regression test for components/editor/EditorRedirect.tsx.
//
// EditorRedirect is the only file in the project that translates a legacy
// /editor or /editor/[iconId] URL into the canonical /?project=&icon= URL
// served by StudioLayout. The shell-consistency check at
// scripts/check-page-registry.ts proves that the page files MOUNT
// EditorRedirect; this file proves the redirect actually goes to the right
// place. If router.replace silently lands at '/' or '/404' regardless of
// input, no other test in the suite catches it.
//
// IRON RULE per /plan-eng-review: this test is mandatory because
// EditorRedirect was added in this branch with zero render-time coverage.

import './setup/happy-dom';
import './setup/react';

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';

// Capture every router.replace() call. The mock is installed BEFORE the
// EditorRedirect static import below so the import resolves to the stub.
// (Same pattern as tests/transition-stagger-override.test.ts.)
const replaceCalls: string[] = [];
mock.module('next/navigation', () => ({
  useRouter: () => ({
    replace: (url: string) => {
      replaceCalls.push(url);
    },
  }),
}));

import { EditorRedirect } from '@/components/editor/EditorRedirect';

// happy-dom's history.replaceState() doesn't update window.location when the
// initial URL was about:blank (the default in tests/setup/happy-dom.ts).
// Use window.happyDOM.setURL() instead — it works regardless of initial state.
function setUrl(href: string): void {
  const happyDOM = (window as unknown as { happyDOM?: { setURL: (url: string) => void } }).happyDOM;
  if (!happyDOM) throw new Error('happy-dom not registered — check tests/setup/happy-dom.ts');
  happyDOM.setURL(href);
}

beforeEach(() => {
  replaceCalls.length = 0;
  setUrl('http://localhost/');
});

afterEach(() => {
  cleanup();
});

describe('EditorRedirect', () => {
  test('with no iconId and no search params replaces to /', () => {
    render(<EditorRedirect />);
    expect(replaceCalls).toEqual(['/']);
  });

  test('with an iconId path-segment forwards it as ?icon=', () => {
    render(<EditorRedirect iconId="icon-home" />);
    expect(replaceCalls).toEqual(['/?icon=icon-home']);
  });

  test('with ?project= in the URL forwards it as ?project=', () => {
    setUrl('http://localhost/editor?project=set-1');
    render(<EditorRedirect />);
    expect(replaceCalls).toEqual(['/?project=set-1']);
  });

  test('with the legacy ?set= param translates it to ?project=', () => {
    setUrl('http://localhost/editor?set=set-1');
    render(<EditorRedirect />);
    expect(replaceCalls).toEqual(['/?project=set-1']);
  });

  test('with both iconId path and ?project= search produces canonical URL', () => {
    setUrl('http://localhost/editor/icon-home?project=set-1');
    render(<EditorRedirect iconId="icon-home" />);
    expect(replaceCalls).toEqual(['/?project=set-1&icon=icon-home']);
  });

  test('iconId prop wins over the ?icon= search param', () => {
    // Pathological case: caller passed icon-home explicitly but the URL also
    // has ?icon=icon-other. The path segment is the more authoritative source
    // (it's where Next.js routed us); the search param is a leftover.
    setUrl('http://localhost/editor/icon-home?icon=icon-other');
    render(<EditorRedirect iconId="icon-home" />);
    expect(replaceCalls).toEqual(['/?icon=icon-home']);
  });
});
