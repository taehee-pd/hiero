import { describe, expect, test } from 'bun:test';
import { exportRuntimeJson } from '../lib/export/export-runtime-json';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';
import type { Icon } from '../lib/schema/types';

type ExportableIcon = Icon & {
  tokenSet?: {
    colors?: Record<string, string>;
  };
};

function makeIcon(): ExportableIcon {
  return {
    id: 'icon-runtime-json',
    name: 'Runtime Json',
    tokenSet: {
      colors: {
        accent: '#38bdf8',
        primary: '#e2e8f0',
      },
    },
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
              fillLayer: {
                id: 'fillLayer',
                role: 'primary',
                path: { d: 'M0 0 L10 0 L10 10 Z' },
                style: {
                  fill: { mode: 'token', token: 'accent' },
                  fillOpacity: 0.75,
                },
              },
            },
          },
          hover: {
            id: 'hover',
            layers: {
              fillLayer: {
                id: 'fillLayer',
                role: 'primary',
                path: { d: 'M1 1 L11 1 L11 11 Z' },
                style: {
                  fill: { mode: 'fixed', value: '#111111' },
                },
              },
            },
          },
        },
      },
      v32: {
        id: 'v32',
        size: 32,
        viewBox: [0, 0, 32, 32],
        defaultState: 'default',
        states: {
          default: {
            id: 'default',
            layers: {
              strokeLayer: {
                id: 'strokeLayer',
                role: 'secondary',
                path: { d: 'M2 2 L18 18' },
                style: {
                  stroke: { mode: 'currentColor' },
                  strokeWidth: 2,
                },
                transform: { x: 1, y: 2 },
              },
            },
          },
        },
      },
    },
    transitions: {
      hoverIn: {
        id: 'hoverIn',
        from: 'default',
        to: 'hover',
        strategy: 'track',
        durationMs: 180,
        easing: 'ease-out',
        layerBindings: [
          {
            fromLayerId: 'fillLayer',
            toLayerId: 'fillLayer',
            tracks: [{ property: 'opacity', keyframes: [0.75, 1] }],
          },
        ],
      },
    },
  };
}

describe('export runtime json', () => {
  test('outputs valid JSON', () => {
    const json = exportRuntimeJson(makeIcon());

    expect(() => JSON.parse(json)).not.toThrow();
  });

  test('resolves token references to concrete values', () => {
    const parsed = JSON.parse(exportRuntimeJson(makeIcon()));

    expect(parsed.states.default.layers.fillLayer.fill).toBe('#38bdf8');
    expect(parsed.tokens.colors.accent).toBe('#38bdf8');
  });

  test('filters variants and states', () => {
    const parsed = JSON.parse(
      exportRuntimeJson(makeIcon(), {
        variants: ['v24'],
        states: ['hover'],
      }),
    );

    expect(Object.keys(parsed.variants)).toEqual(['v24']);
    expect(Object.keys(parsed.states)).toEqual(['hover']);
    expect(parsed.states.hover.layers.fillLayer.d).toBe('M1 1 L11 1 L11 11 Z');
    expect(parsed.transitions).toEqual({});
  });

  test('matches the sample project snapshot', () => {
    const json = exportRuntimeJson({
      ...structuredClone(SAMPLE_PROJECT.icons['icon-home']),
      tokenSet: structuredClone(SAMPLE_PROJECT.tokenSet),
    });

    expect(json).toMatchSnapshot();
  });
});
