import { describe, expect, test } from 'bun:test';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';
import { isProject } from '../lib/schema/guards';
import { exportSvgString } from '../lib/export/export-svg';
import { parseSvgPath, serializePath } from '../lib/editor-core/parse';

describe('phase 1 deterministic checks', () => {
  test('static icon export is byte-stable for same input', () => {
    const icon = SAMPLE_PROJECT.icons['icon-chevron'];
    const first = exportSvgString(
      icon,
      'v24',
      'default',
      SAMPLE_PROJECT.tokenSet?.colors,
    );
    const second = exportSvgString(
      icon,
      'v24',
      'default',
      SAMPLE_PROJECT.tokenSet?.colors,
    );
    expect(first).toBe(second);
  });

  test('layer serialization is deterministic regardless of insertion order', () => {
    const icon = SAMPLE_PROJECT.icons['icon-chevron'];
    const state = icon.states.default;
    const reordered = {
      ...icon,
      states: {
        default: {
          ...state,
          layers: {
            chevron: state.layers.chevron,
            'accent-dot': state.layers['accent-dot'],
            'bg-circle': state.layers['bg-circle'],
          },
        },
      },
    };

    const svg = exportSvgString(reordered, 'v24', 'default');
    const idxAccent = svg.indexOf('id="accent-dot"');
    const idxBg = svg.indexOf('id="bg-circle"');
    const idxChevron = svg.indexOf('id="chevron"');

    // output should be lexicographically stable by layer id
    expect(idxAccent).toBeGreaterThan(-1);
    expect(idxBg).toBeGreaterThan(-1);
    expect(idxChevron).toBeGreaterThan(-1);
    expect(idxAccent).toBeLessThan(idxBg);
    expect(idxBg).toBeLessThan(idxChevron);
  });

  test('project save/load round-trip keeps schema-valid shape and stable export', () => {
    const raw = JSON.stringify(SAMPLE_PROJECT);
    const parsed = JSON.parse(raw);
    expect(isProject(parsed)).toBeTrue();

    const icon = parsed.icons['icon-chevron'];
    const first = exportSvgString(icon, 'v24', 'default', parsed.tokenSet?.colors);
    const second = exportSvgString(
      SAMPLE_PROJECT.icons['icon-chevron'],
      'v24',
      'default',
      SAMPLE_PROJECT.tokenSet?.colors,
    );
    expect(first).toBe(second);
  });

  test('path parse/serialize round-trip stays stable', () => {
    const d = 'M2 2 L10 2 L10 10 L2 10 Z';
    const first = serializePath(parseSvgPath(d));
    const second = serializePath(parseSvgPath(first));
    expect(second).toBe(first);
  });
});
