import { describe, expect, test } from 'bun:test';
import { exportSvgPackage } from '../lib/export/export-svg-package';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

describe('export svg package', () => {
  test('exports sample project to expected file map structure', () => {
    const fileMap = exportSvgPackage(SAMPLE_PROJECT);
    const keys = Object.keys(fileMap).sort();

    expect(keys).toEqual([
      'icons/chevron-right/24.svg',
      'icons/play/24.svg',
    ]);
    expect(fileMap['icons/chevron-right/24.svg']).toContain('<svg');
    expect(fileMap['icons/play/24.svg']).toContain('<svg');
  });

  test('adds mode suffix when multiple rendering modes are requested', () => {
    const fileMap = exportSvgPackage(SAMPLE_PROJECT, {
      renderingMode: ['monochrome', 'multicolor'],
      icons: ['icon-play'],
      variants: ['v24'],
    });

    const keys = Object.keys(fileMap).sort();
    expect(keys).toEqual([
      'icons/play/24-monochrome.svg',
      'icons/play/24-multicolor.svg',
    ]);
  });
});
