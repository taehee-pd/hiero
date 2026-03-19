import { describe, expect, test } from 'bun:test';

import type { Icon, Project } from '../lib/schema/types';
import { exportSvgString } from '../lib/export/export-svg';
import { compileProject } from '../lib/export/compile-pipeline';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeIcon(): Icon {
  return {
    id: 'test-icon',
    name: 'Test Icon',
    variants: {
      v24: {
        id: 'v24',
        size: 24,
        viewBox: [0, 0, 24, 24] as [number, number, number, number],
        defaultState: 'default',
        states: {
          default: {
            id: 'default',
            layers: {
              'layer-1': {
                id: 'layer-1',
                path: { d: 'M12 2L22 12L12 22L2 12Z' },
                style: { fill: { mode: 'currentColor' } },
              },
            },
          },
        },
      },
    },
    transitions: {},
  };
}

function makeProject(): Project {
  return {
    version: '1.0',
    meta: { name: 'test', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    icons: {
      'test-icon': makeIcon(),
    },
  };
}

const COMPILE_OPTIONS = {
  package: {
    name: '@coniva/icons',
    version: '1.0.0',
    builtAt: '2026-01-01T00:00:00.000Z',
  },
} as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('export determinism', () => {
  test('SVG export produces byte-identical output on repeated calls', () => {
    const icon = makeIcon();

    const first = exportSvgString(icon, 'v24', 'default');
    const second = exportSvgString(icon, 'v24', 'default');

    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(0);
  });

  test('compile pipeline produces identical output on repeated calls', () => {
    const projectA = makeProject();
    const projectB = makeProject();

    const resultA = compileProject(projectA, COMPILE_OPTIONS);
    const resultB = compileProject(projectB, COMPILE_OPTIONS);

    // Same number of files
    expect(resultA.files).toHaveLength(resultB.files.length);

    // Every file path and content matches
    for (let i = 0; i < resultA.files.length; i++) {
      expect(resultA.files[i]!.path).toBe(resultB.files[i]!.path);
      expect(resultA.files[i]!.contents).toBe(resultB.files[i]!.contents);
    }

    // Compiled icon count matches
    expect(resultA.compiledIcons).toHaveLength(resultB.compiledIcons.length);
  });

  test('idempotent re-export: exporting unchanged state yields identical SVG', () => {
    const icon = makeIcon();

    const firstExport = exportSvgString(icon, 'v24', 'default');

    // Do nothing to the icon — re-export
    const secondExport = exportSvgString(icon, 'v24', 'default');

    // A third export to triple-check
    const thirdExport = exportSvgString(icon, 'v24', 'default');

    expect(firstExport).toBe(secondExport);
    expect(secondExport).toBe(thirdExport);
  });
});
