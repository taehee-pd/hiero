import { describe, expect, test } from 'bun:test';
import type { Project, Icon } from '../lib/schema/types';
import {
  exportSourcePayload,
  exportIconSource,
  generatePreviewSvg,
  generateSyncSourceManifest,
  serializeSourceJson,
  toIconDirName,
  isValidIconDirName,
  containsPathTraversal,
  validateIconsForExport,
  validateSourcePayload,
  ICON_SOURCE_SCHEMA_VERSION,
  SYNC_SOURCE_MANIFEST_SCHEMA_VERSION,
} from '../lib/sync-source';
import e2eProjectFixture from './fixtures/e2e/compiler-project.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProject(): Project {
  return structuredClone(e2eProjectFixture) as Project;
}

function makeMultiIconProject(): Project {
  const project = makeProject();
  // Add a second icon
  project.icons['icon-play'] = {
    id: 'icon-play',
    name: 'Play',
    category: 'media',
    tags: ['play', 'media'],
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
              triangle: {
                id: 'triangle',
                role: 'primary' as const,
                visible: true,
                path: { d: 'M6 4l12 8-12 8V4z' },
                style: { fill: { mode: 'currentColor' as const } },
              },
            },
          },
        },
      },
    },
    transitions: {},
  };
  return project;
}

const FIXED_TIMESTAMP = '2026-03-15T00:00:00.000Z';

// ---------------------------------------------------------------------------
// Deterministic serializer
// ---------------------------------------------------------------------------

describe('serializeSourceJson', () => {
  test('sorts object keys at all nesting levels', () => {
    const input = { z: 1, a: { y: 2, b: 3 }, m: [{ q: 4, a: 5 }] };
    const output = serializeSourceJson(input);
    const parsed = JSON.parse(output);
    expect(Object.keys(parsed)).toEqual(['a', 'm', 'z']);
    expect(Object.keys(parsed.a)).toEqual(['b', 'y']);
    expect(Object.keys(parsed.m[0])).toEqual(['a', 'q']);
  });

  test('omits undefined values', () => {
    const input = { a: 1, b: undefined, c: 'hello' };
    const output = serializeSourceJson(input);
    expect(output).not.toContain('b');
    expect(JSON.parse(output)).toEqual({ a: 1, c: 'hello' });
  });

  test('is deterministic — same input produces same output', () => {
    const input = { foo: [1, 2], bar: { baz: true } };
    expect(serializeSourceJson(input)).toBe(serializeSourceJson(input));
  });

  test('ends with newline', () => {
    expect(serializeSourceJson({ a: 1 })).toMatch(/\n$/);
  });
});

// ---------------------------------------------------------------------------
// Icon name / directory name
// ---------------------------------------------------------------------------

describe('toIconDirName', () => {
  test('converts names to kebab-case', () => {
    expect(toIconDirName('Chevron Right')).toBe('chevron-right');
    expect(toIconDirName('Play')).toBe('play');
    expect(toIconDirName('arrow.left')).toBe('arrow-left');
  });

  test('strips leading/trailing hyphens', () => {
    expect(toIconDirName('--test--')).toBe('test');
    expect(toIconDirName('   spaces   ')).toBe('spaces');
  });

  test('collapses special characters', () => {
    expect(toIconDirName('icon@#$name')).toBe('icon-name');
  });
});

describe('isValidIconDirName', () => {
  test('accepts valid names', () => {
    expect(isValidIconDirName('chevron-right')).toBe(true);
    expect(isValidIconDirName('play')).toBe(true);
    expect(isValidIconDirName('a')).toBe(true);
    expect(isValidIconDirName('icon-123')).toBe(true);
  });

  test('rejects invalid names', () => {
    expect(isValidIconDirName('')).toBe(false);
    expect(isValidIconDirName('-leading')).toBe(false);
    expect(isValidIconDirName('trailing-')).toBe(false);
    expect(isValidIconDirName('has spaces')).toBe(false);
    expect(isValidIconDirName('UPPERCASE')).toBe(false);
  });

  test('rejects names exceeding max length', () => {
    expect(isValidIconDirName('a'.repeat(129))).toBe(false);
    expect(isValidIconDirName('a'.repeat(128))).toBe(true);
  });
});

describe('containsPathTraversal', () => {
  test('detects ..', () => {
    expect(containsPathTraversal('icons/../etc/passwd')).toBe(true);
    expect(containsPathTraversal('../foo')).toBe(true);
  });

  test('detects .', () => {
    expect(containsPathTraversal('./foo')).toBe(true);
  });

  test('allows clean paths', () => {
    expect(containsPathTraversal('icons/chevron/icon.json')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Pre-export validation
// ---------------------------------------------------------------------------

describe('validateIconsForExport', () => {
  test('passes for valid icons', () => {
    const project = makeProject();
    expect(validateIconsForExport(project.icons)).toEqual([]);
  });

  test('detects empty icon name', () => {
    const project = makeProject();
    project.icons['icon-chev']!.name = '';
    const errors = validateIconsForExport(project.icons);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.kind).toBe('empty-icon-name');
  });

  test('detects duplicate directory names', () => {
    const project = makeMultiIconProject();
    // Make both icons map to the same dir name
    project.icons['icon-play']!.name = 'Chevron';
    project.icons['icon-chev']!.name = 'Chevron';
    const errors = validateIconsForExport(project.icons);
    expect(errors.some((e) => e.kind === 'duplicate-icon-dir')).toBe(true);
  });

  test('detects invalid icon name that produces invalid dir', () => {
    const project = makeProject();
    project.icons['icon-chev']!.name = '---';
    const errors = validateIconsForExport(project.icons);
    expect(errors.some((e) => e.kind === 'invalid-icon-name')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Export icon source
// ---------------------------------------------------------------------------

describe('exportIconSource', () => {
  test('includes schemaVersion', () => {
    const project = makeProject();
    const icon = project.icons['icon-chev']!;
    const source = exportIconSource(icon);
    expect(source.schemaVersion).toBe(ICON_SOURCE_SCHEMA_VERSION);
  });

  test('preserves id, name, category, tags', () => {
    const project = makeProject();
    const icon = project.icons['icon-chev']!;
    const source = exportIconSource(icon);
    expect(source.id).toBe('icon-chev');
    expect(source.name).toBe('Chevron');
    expect(source.category).toBe('navigation');
    expect(source.tags).toEqual(['arrow', 'chevron']); // sorted
  });

  test('preserves variant and state structure', () => {
    const project = makeProject();
    const icon = project.icons['icon-chev']!;
    const source = exportIconSource(icon);
    expect(Object.keys(source.variants)).toContain('v24');
    expect(Object.keys(source.variants)).toContain('v32');
    expect(Object.keys(source.variants['v24']!.states)).toContain('default');
    expect(Object.keys(source.variants['v24']!.states)).toContain('active');
  });

  test('strips importMeta from layers', () => {
    const project = makeProject();
    const icon = project.icons['icon-chev']!;
    // Add editor-only importMeta
    icon.variants['v24']!.states['default']!.layers['chev']!.importMeta = {
      sourceTag: 'path',
      sourceNodeId: 'node-123',
    };
    const source = exportIconSource(icon);
    const layer = source.variants['v24']!.states['default']!.layers['chev']!;
    expect('importMeta' in layer).toBe(false);
  });

  test('strips isClipMask and groupId from layers', () => {
    const project = makeProject();
    const icon = project.icons['icon-chev']!;
    const editorLayer = icon.variants['v24']!.states['default']!.layers['chev']!;
    (editorLayer as any).isClipMask = true;
    (editorLayer as any).groupId = 'group-1';
    const source = exportIconSource(icon);
    const layer = source.variants['v24']!.states['default']!.layers['chev']!;
    expect('isClipMask' in layer).toBe(false);
    expect('groupId' in layer).toBe(false);
  });

  test('strips guideMasterId from variants', () => {
    const project = makeProject();
    const icon = project.icons['icon-chev']!;
    icon.variants['v24']!.guideMasterId = 'preset-24';
    const source = exportIconSource(icon);
    expect('guideMasterId' in source.variants['v24']!).toBe(false);
  });

  test('strips components and customGuides from icon', () => {
    const project = makeProject();
    const icon = project.icons['icon-chev']!;
    icon.components = { badge: { kind: 'badge', layerIds: ['l1'], position: 'topTrailing' } };
    icon.customGuides = [{ kind: 'hline', y: 12 }];
    const source = exportIconSource(icon);
    expect('components' in source).toBe(false);
    expect('customGuides' in source).toBe(false);
  });

  test('preserves transitions and effects', () => {
    const project = makeProject();
    const icon = project.icons['icon-chev']!;
    const source = exportIconSource(icon);
    expect(Object.keys(source.transitions)).toContain('default-active');
    expect(source.effects).toBeDefined();
    expect(Object.keys(source.effects!)).toContain('pulse');
  });

  test('omits effects when empty', () => {
    const project = makeProject();
    const icon = project.icons['icon-chev']!;
    icon.effects = {};
    const source = exportIconSource(icon);
    expect('effects' in source).toBe(false);
  });

  test('omits tags when empty', () => {
    const project = makeProject();
    const icon = project.icons['icon-chev']!;
    icon.tags = [];
    const source = exportIconSource(icon);
    expect('tags' in source).toBe(false);
  });

  test('omits category when undefined', () => {
    const project = makeProject();
    const icon = project.icons['icon-chev']!;
    delete icon.category;
    const source = exportIconSource(icon);
    expect('category' in source).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Preview SVG generation
// ---------------------------------------------------------------------------

describe('generatePreviewSvg', () => {
  test('generates an SVG string for valid icon', () => {
    const project = makeProject();
    const icon = project.icons['icon-chev']!;
    const svg = generatePreviewSvg(icon, project.tokenSet?.colors);
    expect(svg).not.toBeNull();
    expect(svg!).toContain('<svg');
    expect(svg!).toContain('</svg>');
  });

  test('returns null for icon with no variants', () => {
    const icon: Icon = {
      id: 'empty',
      name: 'Empty',
      variants: {},
      transitions: {},
    };
    expect(generatePreviewSvg(icon)).toBeNull();
  });

  test('uses first variant by sorted key', () => {
    const project = makeProject();
    const icon = project.icons['icon-chev']!;
    const svg = generatePreviewSvg(icon, project.tokenSet?.colors);
    // v24 comes before v32 alphabetically, so preview uses size 24
    expect(svg!).toContain('width="24"');
  });
});

// ---------------------------------------------------------------------------
// Manifest generation
// ---------------------------------------------------------------------------

describe('generateSyncSourceManifest', () => {
  test('creates manifest with correct schemaVersion', () => {
    const project = makeProject();
    const icon = project.icons['icon-chev']!;
    const source = exportIconSource(icon);
    const manifest = generateSyncSourceManifest(
      [{ source, sourcePath: 'icons/chevron/icon.json', previewPath: 'icons/chevron/preview.svg' }],
      FIXED_TIMESTAMP,
    );
    expect(manifest.schemaVersion).toBe(SYNC_SOURCE_MANIFEST_SCHEMA_VERSION);
  });

  test('counts icons correctly', () => {
    const project = makeMultiIconProject();
    const entries = Object.values(project.icons)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((icon) => {
        const source = exportIconSource(icon);
        const dirName = toIconDirName(icon.name);
        return {
          source,
          sourcePath: `icons/${dirName}/icon.json`,
          previewPath: `icons/${dirName}/preview.svg`,
        };
      });
    const manifest = generateSyncSourceManifest(entries, FIXED_TIMESTAMP);
    expect(manifest.iconCount).toBe(2);
    expect(Object.keys(manifest.icons)).toHaveLength(2);
  });

  test('includes sizes and transition/effect flags', () => {
    const project = makeProject();
    const icon = project.icons['icon-chev']!;
    const source = exportIconSource(icon);
    const manifest = generateSyncSourceManifest(
      [{ source, sourcePath: 'icons/chevron/icon.json', previewPath: 'icons/chevron/preview.svg' }],
      FIXED_TIMESTAMP,
    );
    const entry = manifest.icons['icon-chev']!;
    expect(entry.sizes).toEqual([24, 32]);
    expect(entry.hasTransitions).toBe(true);
    expect(entry.hasEffects).toBe(true);
  });

  test('orders icons deterministically by id', () => {
    const project = makeMultiIconProject();
    const entries = Object.values(project.icons).map((icon) => {
      const source = exportIconSource(icon);
      const dirName = toIconDirName(icon.name);
      return {
        source,
        sourcePath: `icons/${dirName}/icon.json`,
        previewPath: `icons/${dirName}/preview.svg`,
      };
    });
    const manifest = generateSyncSourceManifest(entries, FIXED_TIMESTAMP);
    expect(Object.keys(manifest.icons)).toEqual(['icon-chev', 'icon-play']);
  });
});

// ---------------------------------------------------------------------------
// Full payload export
// ---------------------------------------------------------------------------

describe('exportSourcePayload', () => {
  test('produces correct file structure', () => {
    const project = makeProject();
    const payload = exportSourcePayload(project, { generatedAt: FIXED_TIMESTAMP });
    const paths = payload.files.map((f) => f.path);
    expect(paths).toContain('icons/chevron/icon.json');
    expect(paths).toContain('icons/chevron/preview.svg');
    expect(paths).toContain('manifest.json');
  });

  test('file paths are sorted', () => {
    const project = makeMultiIconProject();
    const payload = exportSourcePayload(project, { generatedAt: FIXED_TIMESTAMP });
    const paths = payload.files.map((f) => f.path);
    const sorted = [...paths].sort((a, b) => a.localeCompare(b));
    expect(paths).toEqual(sorted);
  });

  test('output is deterministic — same input same output', () => {
    const project = makeProject();
    const a = exportSourcePayload(project, { generatedAt: FIXED_TIMESTAMP });
    const b = exportSourcePayload(project, { generatedAt: FIXED_TIMESTAMP });
    expect(a.files.map((f) => f.contents)).toEqual(b.files.map((f) => f.contents));
    expect(a.files.map((f) => f.path)).toEqual(b.files.map((f) => f.path));
  });

  test('icon rename produces different directory name', () => {
    const project = makeProject();
    const beforePayload = exportSourcePayload(project, { generatedAt: FIXED_TIMESTAMP });

    const renamedProject = makeProject();
    renamedProject.icons['icon-chev']!.name = 'Arrow Right';
    const afterPayload = exportSourcePayload(renamedProject, { generatedAt: FIXED_TIMESTAMP });

    const beforePaths = beforePayload.files.map((f) => f.path);
    const afterPaths = afterPayload.files.map((f) => f.path);
    expect(beforePaths).toContain('icons/chevron/icon.json');
    expect(afterPaths).toContain('icons/arrow-right/icon.json');
    expect(afterPaths).not.toContain('icons/chevron/icon.json');
  });

  test('manifest.json is valid and parseable', () => {
    const project = makeProject();
    const payload = exportSourcePayload(project, { generatedAt: FIXED_TIMESTAMP });
    const manifestFile = payload.files.find((f) => f.path === 'manifest.json')!;
    const parsed = JSON.parse(manifestFile.contents);
    expect(parsed.schemaVersion).toBe(SYNC_SOURCE_MANIFEST_SCHEMA_VERSION);
    expect(parsed.iconCount).toBe(1);
  });

  test('icon.json files have sorted keys', () => {
    const project = makeProject();
    const payload = exportSourcePayload(project, { generatedAt: FIXED_TIMESTAMP });
    const iconFile = payload.files.find((f) => f.path === 'icons/chevron/icon.json')!;
    const parsed = JSON.parse(iconFile.contents);
    // Top-level keys should be sorted
    const keys = Object.keys(parsed);
    const sortedKeys = [...keys].sort((a, b) => a.localeCompare(b));
    expect(keys).toEqual(sortedKeys);
  });

  test('icon.json contains schemaVersion', () => {
    const project = makeProject();
    const payload = exportSourcePayload(project, { generatedAt: FIXED_TIMESTAMP });
    const iconFile = payload.files.find((f) => f.path === 'icons/chevron/icon.json')!;
    const parsed = JSON.parse(iconFile.contents);
    expect(parsed.schemaVersion).toBe(ICON_SOURCE_SCHEMA_VERSION);
  });

  test('preview.svg files contain valid SVG', () => {
    const project = makeProject();
    const payload = exportSourcePayload(project, { generatedAt: FIXED_TIMESTAMP });
    const previewFile = payload.files.find((f) => f.path === 'icons/chevron/preview.svg')!;
    expect(previewFile.contents).toContain('<svg');
    expect(previewFile.contents).toContain('</svg>');
  });

  test('multi-icon project produces files for each icon', () => {
    const project = makeMultiIconProject();
    const payload = exportSourcePayload(project, { generatedAt: FIXED_TIMESTAMP });
    const paths = payload.files.map((f) => f.path);
    expect(paths).toContain('icons/chevron/icon.json');
    expect(paths).toContain('icons/chevron/preview.svg');
    expect(paths).toContain('icons/play/icon.json');
    expect(paths).toContain('icons/play/preview.svg');
    expect(payload.iconCount).toBe(2);
  });

  test('rejects invalid project input', () => {
    expect(() =>
      exportSourcePayload({} as unknown as Project, { generatedAt: FIXED_TIMESTAMP }),
    ).toThrow('Invalid project input for source export.');
  });

  test('rejects project with empty icon name', () => {
    const project = makeProject();
    project.icons['icon-chev']!.name = '';
    expect(() =>
      exportSourcePayload(project, { generatedAt: FIXED_TIMESTAMP }),
    ).toThrow('Source export validation failed');
  });

  test('rejects project with duplicate directory names', () => {
    const project = makeMultiIconProject();
    project.icons['icon-chev']!.name = 'Play';
    project.icons['icon-play']!.name = 'Play';
    expect(() =>
      exportSourcePayload(project, { generatedAt: FIXED_TIMESTAMP }),
    ).toThrow('duplicate-icon-dir');
  });
});

// ---------------------------------------------------------------------------
// Post-export validation
// ---------------------------------------------------------------------------

describe('validateSourcePayload', () => {
  test('passes for valid payload', () => {
    const project = makeProject();
    const payload = exportSourcePayload(project, { generatedAt: FIXED_TIMESTAMP });
    const errors = validateSourcePayload(payload);
    expect(errors).toEqual([]);
  });

  test('detects count mismatch', () => {
    const project = makeProject();
    const payload = exportSourcePayload(project, { generatedAt: FIXED_TIMESTAMP });
    // Tamper with icon count
    payload.iconCount = 999;
    const errors = validateSourcePayload(payload);
    expect(errors.some((e) => e.kind === 'manifest-count-mismatch')).toBe(true);
  });

  test('detects missing source file', () => {
    const project = makeProject();
    const payload = exportSourcePayload(project, { generatedAt: FIXED_TIMESTAMP });
    // Remove icon.json from files
    payload.files = payload.files.filter((f) => !f.path.endsWith('icon.json'));
    const errors = validateSourcePayload(payload);
    expect(errors.some((e) => e.kind === 'manifest-missing-icon')).toBe(true);
  });
});
