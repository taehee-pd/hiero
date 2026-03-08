import { describe, expect, test } from 'bun:test';
import {
  createGuideMaster24,
  getDefaultGuideMaster,
} from '../lib/editor-core/guide-presets';

describe('guide presets', () => {
  test('createGuideMaster24 returns the canonical 24px guide master', () => {
    expect(createGuideMaster24()).toEqual({
      id: 'preset-24',
      name: '24px Standard',
      targetSize: 24,
      viewBox: [0, 0, 24, 24],
      items: [
        { kind: 'rect', x: 1, y: 1, width: 22, height: 22 },
        { kind: 'rect', x: 3, y: 3, width: 18, height: 18 },
        { kind: 'ellipse', cx: 12, cy: 12, rx: 10, ry: 10 },
        { kind: 'rect', x: 2, y: 4, width: 20, height: 16 },
        { kind: 'rect', x: 4, y: 2, width: 16, height: 20 },
        { kind: 'hline', y: 12 },
        { kind: 'vline', x: 12 },
      ],
    });
  });

  test('getDefaultGuideMaster returns presets for supported sizes', () => {
    expect(getDefaultGuideMaster(12)).toMatchObject({
      id: 'preset-12',
      targetSize: 12,
      viewBox: [0, 0, 12, 12],
    });
    expect(getDefaultGuideMaster(16)).toMatchObject({
      id: 'preset-16',
      targetSize: 16,
      viewBox: [0, 0, 16, 16],
    });
    expect(getDefaultGuideMaster(20)).toMatchObject({
      id: 'preset-20',
      targetSize: 20,
      viewBox: [0, 0, 20, 20],
    });
    expect(getDefaultGuideMaster(24)).toEqual(createGuideMaster24());
    expect(getDefaultGuideMaster(32)).toMatchObject({
      id: 'preset-32',
      targetSize: 32,
      viewBox: [0, 0, 32, 32],
    });
    expect(getDefaultGuideMaster(48)).toMatchObject({
      id: 'preset-48',
      targetSize: 48,
      viewBox: [0, 0, 48, 48],
    });
  });

  test('getDefaultGuideMaster rejects unsupported sizes', () => {
    expect(() => getDefaultGuideMaster(0)).toThrow('Unsupported default guide size: 0');
  });
});
