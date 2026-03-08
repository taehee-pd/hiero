import { describe, expect, test } from 'bun:test';
import { importSvg } from '../lib/import/import-svg';
import './helpers/dom-parser';

describe('SVG import element coverage', () => {
  test('imports all supported SVG shape elements into path layers', () => {
    const result = importSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path id="path-node" d="M0 0 L4 0 L4 4 Z" />
        <rect id="rect-node" x="1" y="2" width="3" height="4" rx="1" />
        <circle id="circle-node" cx="8" cy="8" r="3" />
        <ellipse id="ellipse-node" cx="12" cy="6" rx="4" ry="2" />
        <line id="line-node" x1="2" y1="10" x2="18" y2="14" />
        <polygon id="polygon-node" points="0,20 4,16 8,20" />
        <polyline id="polyline-node" points="12,16 16,20 20,18" />
      </svg>
    `);

    expect(Object.keys(result.layers)).toEqual([
      'path-node',
      'rect-node',
      'circle-node',
      'ellipse-node',
      'line-node',
      'polygon-node',
      'polyline-node',
    ]);
    expect(result.layers['path-node']!.path!.d).toBe('M0 0 L4 0 L4 4 Z');
    expect(result.layers['rect-node']!.importMeta?.sourceTag).toBe('rect');
    expect(result.layers['circle-node']!.path!.d.includes('C')).toBeTrue();
    expect(result.layers['ellipse-node']!.path!.d.includes('C')).toBeTrue();
    expect(result.layers['line-node']!.path!.d).toBe('M2 10 L18 14');
    expect(result.layers['polygon-node']!.path!.d.endsWith(' Z')).toBeTrue();
    expect(result.layers['polyline-node']!.path!.d.endsWith(' Z')).toBeFalse();
  });

  test('imports fill rule and visibility presentation attributes', () => {
    const result = importSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path id="hidden" d="M0 0 L4 0 L4 4 Z" fill-rule="evenodd" visibility="hidden" />
      </svg>
    `);

    expect(result.layers.hidden!.path).toEqual({
      d: 'M0 0 L4 0 L4 4 Z',
      fillRule: 'evenodd',
    });
    expect(result.layers.hidden!.visible).toBeFalse();
  });
});
