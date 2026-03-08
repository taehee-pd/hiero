import { describe, expect, test } from 'bun:test';
import { importSvg } from '../lib/import/import-svg';
import './helpers/dom-parser';

describe('importSvg', () => {
  test('imports supported shapes with inherited styles and flattened transforms', () => {
    const result = importSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <g fill="#112233" stroke="#445566" stroke-width="2" opacity="0.5" transform="translate(2 3)">
          <rect id="box" x="1" y="2" width="3" height="4" fill-opacity="0.4" transform="scale(2)" />
        </g>
      </svg>
    `);

    expect(result.viewBox).toEqual([0, 0, 24, 24]);
    expect(Object.keys(result.layers)).toEqual(['box']);

    const layer = result.layers.box;
    expect(layer.path?.d).toBe('M1 2 L4 2 L4 6 L1 6 Z');
    expect(layer.style.fill).toEqual({ mode: 'fixed', value: '#112233' });
    expect(layer.style.stroke).toEqual({ mode: 'fixed', value: '#445566' });
    expect(layer.style.strokeWidth).toBe(2);
    expect(layer.style.fillOpacity).toBe(0.2);
    expect(layer.style.strokeOpacity).toBe(0.5);
    expect(layer.transform).toEqual({ x: 2, y: 3, scaleX: 2, scaleY: 2 });
  });

  test('imports gradient paint refs and preserves unsupported gradient metadata', () => {
    const result = importSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <defs>
          <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%" gradientTransform="rotate(20)" spreadMethod="reflect">
            <stop offset="0%" stop-color="#111111" />
            <stop offset="100%" stop-color="#eeeeee" stop-opacity="0.4" />
          </linearGradient>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%" fx="25%" fy="25%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="100%" stop-color="#0f172a" />
          </radialGradient>
        </defs>
        <path id="shape" d="M0 0 L10 0 L10 10 Z" fill="url(#sky)" stroke="url(#glow)" />
      </svg>
    `);

    const layer = result.layers.shape;
    expect(layer.style.fill).toEqual({
      mode: 'linearGradient',
      angle: 90,
      stops: [
        { offset: 0, color: '#111111', opacity: undefined },
        { offset: 1, color: '#eeeeee', opacity: 0.4 },
      ],
    });
    expect(layer.style.stroke).toEqual({
      mode: 'radialGradient',
      cx: 0.5,
      cy: 0.5,
      r: 0.5,
      stops: [
        { offset: 0, color: '#38bdf8', opacity: undefined },
        { offset: 1, color: '#0f172a', opacity: undefined },
      ],
    });
    expect(layer.importMeta?.unsupported).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'gradientTransform', value: 'rotate(20)' }),
        expect.objectContaining({ kind: 'gradientSpreadMethod', value: 'reflect' }),
        expect.objectContaining({
          kind: 'radialGradientFocus',
          attributes: { fx: '25%', fy: '25%' },
        }),
      ]),
    );
  });

  test('preserves unsupported references like clipPath, mask, pattern, and css classes', () => {
    const result = importSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <defs>
          <clipPath id="clip"><rect x="0" y="0" width="10" height="10" /></clipPath>
          <mask id="mask"><rect x="0" y="0" width="10" height="10" fill="white" /></mask>
          <pattern id="pat" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="#f00" />
          </pattern>
          <style>.accent { fill: red; }</style>
        </defs>
        <path
          id="decor"
          class="accent"
          d="M0 0 L4 0 L4 4 Z"
          clip-path="url(#clip)"
          mask="url(#mask)"
          fill="url(#pat)"
        />
      </svg>
    `);

    const layer = result.layers.decor;
    expect(layer.style.fill).toBeUndefined();
    expect(layer.importMeta?.sourceClassName).toBe('accent');
    expect(layer.importMeta?.unsupported).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'clipPath', refId: 'clip' }),
        expect.objectContaining({ kind: 'mask', refId: 'mask' }),
        expect.objectContaining({ kind: 'pattern', refId: 'pat' }),
        expect.objectContaining({ kind: 'cssClass', value: 'accent' }),
      ]),
    );
  });

  test('bakes unsupported affine transforms into normalized path data', () => {
    const result = importSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path id="skewed" d="M0 0 L10 0" transform="matrix(1 1 0 1 0 0)" />
      </svg>
    `);

    const layer = result.layers.skewed;
    expect(layer.transform).toBeUndefined();
    expect(layer.path?.d).toBe('M0 0 L10 10');
    expect(layer.importMeta?.originalTransform).toBe('matrix(1 1 0 1 0 0)');
  });
});
