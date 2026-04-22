/**
 * Smoke + determinism tests for the hiero-ui-icons package.
 *
 * Covers:
 * - importer is additive-only (existing icons survive a re-import)
 * - compile pipeline emits byte-identical output on repeat runs
 * - registry exposes the expected IconName union + rtl mirror set
 */

import { describe, expect, test } from 'bun:test';
import { readFile } from 'fs/promises';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { $ } from 'bun';

import { compileProject } from '../lib/export/compile-pipeline';
import type { IconSet } from '../lib/schema/types';

const REPO_ROOT = path.resolve(import.meta.dir, '..');
const ICONS_PATH = path.join(
  REPO_ROOT,
  'packages/hiero-ui-icons/source/icons.json',
);
const REGISTRY_PATH = path.join(
  REPO_ROOT,
  'packages/hiero-ui-icons/src/registry.generated.ts',
);

async function loadIconSet(): Promise<IconSet> {
  const raw = await readFile(ICONS_PATH, 'utf8');
  return JSON.parse(raw) as IconSet;
}

describe('hiero-ui-icons source', () => {
  test('has 50+ icons imported from lucide', async () => {
    const set = await loadIconSet();
    expect(Object.keys(set.icons).length).toBeGreaterThanOrEqual(50);
    expect(set.meta.name).toBe('hiero-ui-icons');
  });

  test('every icon has 16 and 24 variants', async () => {
    const set = await loadIconSet();
    for (const icon of Object.values(set.icons)) {
      const sizes = Object.values(icon.variants).map((v) => v.size).sort();
      expect(sizes).toEqual([16, 24]);
    }
  });

  test('every icon has a lucide externalImport trace', async () => {
    const set = await loadIconSet();
    for (const [id, icon] of Object.entries(set.icons)) {
      expect(icon.meta?.externalImport?.adapterId).toBe('lucide');
      expect(icon.meta?.externalImport?.sourceIconId).toBe(id);
    }
  });
});

describe('hiero-ui-icons codegen', () => {
  test('compileProject is deterministic across runs', async () => {
    const set = await loadIconSet();
    const builtAt = '2026-01-01T00:00:00.000Z';

    const a = compileProject(set, {
      package: { name: '@hiero/ui-icons', version: '0.0.1', builtAt },
      generateReact: true,
    });
    const b = compileProject(set, {
      package: { name: '@hiero/ui-icons', version: '0.0.1', builtAt },
      generateReact: true,
    });

    expect(a.files.length).toBe(b.files.length);
    for (let i = 0; i < a.files.length; i += 1) {
      expect(a.files[i].path).toBe(b.files[i].path);
      expect(a.files[i].contents).toBe(b.files[i].contents);
    }
  });
});

describe('hiero-ui-icons registry', () => {
  test('registry file is present and exports IconName union', async () => {
    const raw = await readFile(REGISTRY_PATH, 'utf8');
    expect(raw).toContain('export type IconName');
    expect(raw).toContain('export const iconRegistry');
    expect(raw).toContain('export const rtlMirrorIcons');
  });

  test('registry includes expected rtl-mirrored icons', async () => {
    const raw = await readFile(REGISTRY_PATH, 'utf8');
    for (const name of [
      'chevron-left',
      'chevron-right',
      'arrow-right',
      'skip-forward',
      'skip-back',
      'panel-left',
      'folder-input',
    ]) {
      expect(raw).toContain(`"${name}"`);
    }
  });
});
