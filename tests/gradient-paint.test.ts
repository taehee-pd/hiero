import { describe, expect, test } from 'bun:test';
import { exportSvgString } from '../lib/export/export-svg';
import { importSvg } from '../lib/import/import-svg';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';
import './helpers/dom-parser';

describe('gradient paint', () => {
  test('resolves gradient href chains during SVG import', () => {
    const result = importSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <defs>
          <linearGradient id="base">
            <stop offset="0%" stop-color="#111111" />
            <stop offset="100%" stop-color="#eeeeee" />
          </linearGradient>
          <linearGradient id="derived" href="#base" x1="0%" y1="100%" x2="100%" y2="100%" />
        </defs>
        <path id="shape" d="M0 0 L10 0 L10 10 Z" fill="url(#derived)" />
      </svg>
    `);

    expect(result.layers.shape!.style.fill).toEqual({
      mode: 'linearGradient',
      angle: 0,
      stops: [
        { offset: 0, color: '#111111', opacity: undefined },
        { offset: 1, color: '#eeeeee', opacity: undefined },
      ],
    });
    expect(result.layers.shape!.importMeta?.unsupported).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'gradientHref', refId: 'base' })]),
    );
  });

  test('serializes gradient paints into deterministic SVG defs', () => {
    const icon = structuredClone(SAMPLE_PROJECT.icons['icon-chevron']);
    icon.variants.v24.states.default.layers.chevron.style.fill = {
      mode: 'linearGradient',
      angle: 0,
      stops: [
        { offset: 0, color: '#111111' },
        { offset: 1, color: '#eeeeee' },
      ],
    };
    icon.variants.v24.states.default.layers.chevron.style.stroke = {
      mode: 'radialGradient',
      cx: 0.25,
      cy: 0.75,
      r: 0.4,
      stops: [
        { offset: 0, color: '#38bdf8' },
        { offset: 1, color: '#0f172a', opacity: 0.5 },
      ],
    };

    const svg = exportSvgString(icon, 'v24', 'default');

    expect(svg).toContain('linearGradient id="gradient-chevron-fill" x1="0" y1="0.5" x2="1" y2="0.5"');
    expect(svg).toContain('radialGradient id="gradient-chevron-stroke" cx="0.25" cy="0.75" r="0.4"');
    expect(svg).toContain('stop-opacity="0.5"');
  });
});
