import { describe, expect, test } from 'bun:test';

import { buildEditorRoute } from '../lib/platform/routes';

// The shell-consistency block that used to live here was superseded by
// scripts/check-page-registry.ts, which proves the same invariant
// structurally (every app/**/page.tsx must enrol in PAGE_REGISTRY) and
// is wired into `pnpm test:registry`. Keeping both was strictly worse —
// two scanners covering identical ground, drifting independently. This
// file now only owns the URL-builder unit tests.

describe('buildEditorRoute', () => {
  test('with no args returns the canonical root', () => {
    expect(buildEditorRoute()).toBe('/');
  });

  test('with iconId only returns ?icon=', () => {
    expect(buildEditorRoute('icon-home')).toBe('/?icon=icon-home');
  });

  test('with iconSetId only returns ?project=', () => {
    expect(buildEditorRoute(null, 'set-1')).toBe('/?project=set-1');
  });

  test('with both keeps project before icon for stable URLs', () => {
    expect(buildEditorRoute('icon-home', 'set-1')).toBe(
      '/?project=set-1&icon=icon-home',
    );
  });

  test('encodes ids that contain reserved characters', () => {
    expect(buildEditorRoute('a/b', 's d')).toBe('/?project=s+d&icon=a%2Fb');
  });
});
