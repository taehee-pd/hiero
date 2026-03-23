import { describe, expect, test } from 'bun:test';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';
import { isProject } from '../lib/schema/guards';
import { exportSvgString } from '../lib/export/export-svg';
import {
  isPathDirectlyEditable,
  parseSvgPath,
  serializePath,
} from '../lib/editor-core/parse';

describe('phase 1 deterministic checks', () => {
  test('static icon export is byte-stable for same input', () => {
    const icon = SAMPLE_PROJECT.icons['icon-home'];
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
    const icon = SAMPLE_PROJECT.icons['icon-home'];
    const state = icon.variants.v24.states.default;
    const reordered = {
      ...icon,
      variants: {
        ...icon.variants,
        v24: {
          ...icon.variants.v24,
          states: {
            default: {
              ...state,
              layers: {
                roof: state.layers.roof,
                house: state.layers.house,
              },
            },
          },
        },
      },
    };

    const svg = exportSvgString(reordered, 'v24', 'default');
    const idxHouse = svg.indexOf('id="house"');
    const idxRoof = svg.indexOf('id="roof"');

    // output should be lexicographically stable by layer id
    expect(idxHouse).toBeGreaterThan(-1);
    expect(idxRoof).toBeGreaterThan(-1);
    expect(idxHouse).toBeLessThan(idxRoof);
  });

  test('project save/load round-trip keeps schema-valid shape and stable export', () => {
    const raw = JSON.stringify(SAMPLE_PROJECT);
    const parsed = JSON.parse(raw);
    expect(isProject(parsed)).toBeTrue();

    const icon = parsed.icons['icon-home'];
    const first = exportSvgString(icon, 'v24', 'default', parsed.tokenSet?.colors);
    const second = exportSvgString(
      SAMPLE_PROJECT.icons['icon-home'],
      'v24',
      'default',
      SAMPLE_PROJECT.tokenSet?.colors,
    );
    expect(first).toBe(second);
  });


  test('direct path editing guard accepts arc paths used by the editor', () => {
    expect(isPathDirectlyEditable('M4 4 A2 2 0 0 1 8 8')).toBeTrue();
    expect(isPathDirectlyEditable('M2 2 L10 2 L10 10 L2 10 Z')).toBeTrue();
    expect(
      isPathDirectlyEditable(
        SAMPLE_PROJECT.icons['icon-search']!.variants.v24.states.default.layers.circle.path!.d,
      ),
    ).toBeTrue();
  });

  test('path parse/serialize round-trip stays stable', () => {
    const d = 'M2 2 L10 2 L10 10 L2 10 Z';
    const first = serializePath(parseSvgPath(d));
    const second = serializePath(parseSvgPath(first));
    expect(second).toBe(first);
  });

  test('arc path parse/serialize round-trip stays stable', () => {
    const d = 'M4 4 A2 2 0 0 1 8 8';
    const first = serializePath(parseSvgPath(d));
    const second = serializePath(parseSvgPath(first));
    expect(first).toBe(d);
    expect(second).toBe(first);
  });
});
