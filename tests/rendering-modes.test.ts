import { describe, expect, test } from 'bun:test';
import './helpers/dom-parser';
import { exportSvgString } from '../lib/export/export-svg';
import type { Icon } from '../lib/schema/types';

function makeIcon(): Icon {
  return {
    id: 'icon-rendering-modes',
    name: 'Rendering Modes',
    variants: {
      v24: {
        id: 'v24',
        size: 24,
        viewBox: [0, 0, 24, 24],
        defaultState: 'default',
        states: {
          default: {
            id: 'default',
            layers: {
              primary: {
                id: 'primary',
                role: 'primary',
                path: { d: 'M0 0 L10 0 L10 10 Z' },
                style: { fill: { mode: 'fixed', value: '#ff0000' } },
              },
              secondary: {
                id: 'secondary',
                role: 'secondary',
                path: { d: 'M2 2 L12 2 L12 12 Z' },
                style: { fill: { mode: 'fixed', value: '#00ff00' } },
              },
              tertiary: {
                id: 'tertiary',
                role: 'tertiary',
                path: { d: 'M4 4 L14 4 L14 14 Z' },
                style: { fill: { mode: 'fixed', value: '#0000ff' } },
              },
            },
          },
        },
      },
    },
    transitions: {},
  };
}

function getPath(svg: string, id: string) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return doc.querySelector(`path[id="${id}"]`);
}

describe('rendering modes', () => {
  test('multicolor preserves defined fills', () => {
    const svg = exportSvgString(makeIcon(), 'v24', 'default', undefined, 'multicolor');

    expect(getPath(svg, 'primary')?.getAttribute('fill')).toBe('#ff0000');
    expect(getPath(svg, 'secondary')?.getAttribute('fill')).toBe('#00ff00');
    expect(getPath(svg, 'tertiary')?.getAttribute('fill')).toBe('#0000ff');
  });

  test('monochrome overrides all fills to currentColor', () => {
    const svg = exportSvgString(makeIcon(), 'v24', 'default', undefined, 'monochrome');

    expect(getPath(svg, 'primary')?.getAttribute('fill')).toBe('currentColor');
    expect(getPath(svg, 'secondary')?.getAttribute('fill')).toBe('currentColor');
    expect(getPath(svg, 'tertiary')?.getAttribute('fill')).toBe('currentColor');
  });

  test('hierarchical applies role-based opacities', () => {
    const svg = exportSvgString(makeIcon(), 'v24', 'default', undefined, 'hierarchical');

    expect(getPath(svg, 'primary')?.getAttribute('fill-opacity')).toBe('1');
    expect(getPath(svg, 'secondary')?.getAttribute('fill-opacity')).toBe('0.6');
    expect(getPath(svg, 'tertiary')?.getAttribute('fill-opacity')).toBe('0.3');
  });

  test('palette resolves role fills from token slots', () => {
    const svg = exportSvgString(
      makeIcon(),
      'v24',
      'default',
      {
        primary: '#111111',
        secondary: '#777777',
        tertiary: '#cccccc',
      },
      'palette',
    );

    expect(getPath(svg, 'primary')?.getAttribute('fill')).toBe('#111111');
    expect(getPath(svg, 'secondary')?.getAttribute('fill')).toBe('#777777');
    expect(getPath(svg, 'tertiary')?.getAttribute('fill')).toBe('#cccccc');
  });
});
