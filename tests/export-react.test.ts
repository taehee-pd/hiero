import { describe, expect, test } from 'bun:test';
import ts from 'typescript';
import { generateIconComponent } from '../lib/export/export-react/generate-component';
import { generateIconLibrary } from '../lib/export/export-react/generate-library';
import type { Icon, Project } from '../lib/schema/types';

function makeIcon(id: string, name: string): Icon {
  return {
    id,
    name,
    variants: {
      v24: {
        id: 'v24',
        size: 24,
        viewBox: [0, 0, 24, 24],
        layers: {
          body: {
            id: 'body',
            path: { d: 'M2 2 L22 2 L22 22 Z' },
            style: {
              fill: { mode: 'currentColor' },
              stroke: { mode: 'currentColor' },
              strokeWidth: 2,
            },
          },
        },
      },
    },
  };
}

function makeProject(): Project {
  return {
    version: '1.0',
    meta: {
      name: 'Test Icons',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    icons: {
      home: makeIcon('home', 'home'),
      bell: makeIcon('bell', 'bell icon'),
    },
    guideMasters: {},
    tokenSet: { colors: {} },
    exportProfiles: [],
  };
}

describe('export react codegen', () => {
  test('generateIconComponent produces valid TypeScript', () => {
    const code = generateIconComponent(makeIcon('star', 'star icon'));
    const source = ts.createSourceFile('StarIcon.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    expect((source as any).parseDiagnostics).toHaveLength(0);
    expect(code).toContain("import { CuneiformIcon } from '@/lib/runtime-react';");
  });

  test('generated component includes the expected props interface', () => {
    const code = generateIconComponent(makeIcon('menu', 'menu icon'));

    expect(code).toContain('size?: number;');
    expect(code).toContain('color?: string;');
    expect(code).toContain('className?: string;');
    expect(code).toContain('style?: CSSProperties;');
    expect(code).toContain("animate?: boolean;");
    expect(code).toMatch(/variant\?: \"(24|v24)\" \| \"(24|v24)\" \| number;/);
    expect(code).toContain("import { CuneiformIcon } from '@/lib/runtime-react';");
  });

  test('generateIconLibrary returns expected file map keys', () => {
    const fileMap = generateIconLibrary(makeProject());

    expect(Object.keys(fileMap).sort()).toEqual([
      'package.json',
      'src/BellIcon.tsx',
      'src/Home.tsx',
      'src/index.ts',
      'tsconfig.json',
    ]);
  });

  test('index.ts re-exports all generated icons', () => {
    const fileMap = generateIconLibrary(makeProject());
    const index = fileMap['src/index.ts'];

    expect(index).toContain("export { BellIcon } from './BellIcon';");
    expect(index).toContain("export { Home } from './Home';");
  });
});
