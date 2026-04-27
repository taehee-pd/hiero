import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildEditorRoute } from '../lib/platform/routes';

const repoRoot = join(import.meta.dir, '..');

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
    expect(buildEditorRoute('a/b', 's d')).toBe(
      '/?project=s+d&icon=a%2Fb',
    );
  });
});

/**
 * Shell-consistency guard: every route that lands the user in the icon
 * editor must funnel into a single shell. The root renders StudioLayout
 * directly; the legacy /editor and /editor/[iconId] routes redirect into
 * it via EditorRedirect. If a future refactor introduces a third surface
 * (or forgets the redirect), this test fails with a clear pointer to the
 * canonical entry point.
 */
describe('editor route shell consistency', () => {
  const read = (rel: string) =>
    readFileSync(join(repoRoot, rel), 'utf8');

  test('root page mounts StudioLayout', () => {
    const src = read('app/page.tsx');
    expect(src).toContain("from '@/components/studio/StudioLayout'");
    expect(src).toMatch(/<\s*StudioLayout\s*\/?\s*>/);
  });

  test('/editor route forwards into StudioLayout via EditorRedirect', () => {
    const src = read('app/editor/page.tsx');
    expect(src).toContain("from '@/components/editor/EditorRedirect'");
    expect(src).toMatch(/<\s*EditorRedirect\s*\/?\s*>/);
    expect(src).not.toContain('EditorShell');
  });

  test('/editor/[iconId] route forwards into StudioLayout via EditorRedirect', () => {
    const src = read('app/editor/[iconId]/page.tsx');
    expect(src).toContain("from '@/components/editor/EditorRedirect'");
    expect(src).toMatch(/EditorRedirect\s+iconId=\{iconId\}/);
    expect(src).not.toContain('EditorShellClient');
  });
});
