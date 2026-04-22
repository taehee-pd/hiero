/**
 * Unit tests for the pure-function SVG serializer used by the
 * RSC path (`HieroIconServer`). These run in the core test suite
 * (no happy-dom); the whole point of the serializer is to be
 * DOM-free.
 */

import { describe, expect, test } from 'bun:test';

import { serializeIconToSvgString } from '../lib/runtime-core/svg-serialize';
import type { Icon } from '../lib/schema/types';

function makeTestIcon(): Icon {
  return {
    id: 'plus',
    name: 'plus',
    variants: {
      'v-16': {
        id: 'v-16',
        size: 16,
        viewBox: [0, 0, 24, 24] as [number, number, number, number],
        layers: {
          h: {
            id: 'h',
            path: { d: 'M5 12 L19 12' },
            style: {
              stroke: { mode: 'currentColor' },
              strokeWidth: 2,
              lineCap: 'round',
              lineJoin: 'round',
            },
          },
          v: {
            id: 'v',
            path: { d: 'M12 5 L12 19' },
            style: {
              stroke: { mode: 'currentColor' },
              strokeWidth: 2,
              lineCap: 'round',
              lineJoin: 'round',
            },
          },
        },
      },
    },
  };
}

describe('serializeIconToSvgString', () => {
  test('emits a self-contained SVG with both paths', () => {
    const svg = serializeIconToSvgString(makeTestIcon(), { label: 'Plus' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('M5 12 L19 12');
    expect(svg).toContain('M12 5 L12 19');
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('stroke-width="2"');
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Plus"');
  });

  test('applies aria-hidden when label is omitted', () => {
    const svg = serializeIconToSvgString(makeTestIcon());
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toContain('role="img"');
  });

  test('respects size prop for width/height, not viewBox', () => {
    const svg = serializeIconToSvgString(makeTestIcon(), { size: 24 });
    expect(svg).toContain('width="24"');
    expect(svg).toContain('height="24"');
    expect(svg).toContain('viewBox="0 0 24 24"');
  });

  test('emits var(--token, fallback) for token paints', () => {
    const icon = makeTestIcon();
    icon.variants['v-16']!.layers.h!.style.stroke = {
      mode: 'token',
      token: 'hiero-icon-accent',
      fallback: '#ff00aa',
    };
    const svg = serializeIconToSvgString(icon);
    expect(svg).toContain('stroke="var(--hiero-icon-accent, #ff00aa)"');
  });

  test('escapes XML in the label', () => {
    const svg = serializeIconToSvgString(makeTestIcon(), {
      label: 'a > b & c "d"',
    });
    expect(svg).toContain('aria-label="a &gt; b &amp; c &quot;d&quot;"');
  });

  test('deterministic output across repeated calls', () => {
    const a = serializeIconToSvgString(makeTestIcon(), { label: 'Plus' });
    const b = serializeIconToSvgString(makeTestIcon(), { label: 'Plus' });
    expect(a).toBe(b);
  });
});
