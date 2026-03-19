import { describe, expect, test } from 'bun:test';

import type { CompiledIcon } from '../lib/compiler-contracts';
import {
  parseCompiledIconJson,
  resolvePaletteColors,
  resolveRequestedRenderingMode,
  resolveRequestedSize,
  resolveRequestedState,
} from '../lib/runtime-sdk';
import compiledIconFixture from './fixtures/compiler-contracts/compiled-icon.json';

function makeIcon(): CompiledIcon {
  return structuredClone(compiledIconFixture) as unknown as CompiledIcon;
}

describe('runtime sdk primitives', () => {
  test('nearest-size fallback resolves nearest variant', () => {
    const icon = makeIcon();
    icon.variants['16'] = {
      size: 16,
      viewBox: [0, 0, 16, 16],
      states: structuredClone(icon.variants['24'].states),
    };
    icon.variants['32'] = {
      size: 32,
      viewBox: [0, 0, 32, 32],
      states: structuredClone(icon.variants['24'].states),
    };

    const result = resolveRequestedSize(icon, 20, 'nearest');
    expect(result.resolvedVariantSize).toBe(16);
    expect(result.renderSize).toBe(16);
  });

  test('state fallback resolves to default', () => {
    const icon = makeIcon();
    const variant = icon.variants['24'];
    const resolved = resolveRequestedState(variant, 'hover', 'default');
    expect(resolved).toBe('default');
  });

  test('mode fallback resolves to monochrome', () => {
    const icon = makeIcon() as any;
    const state = icon.variants['24'].states.default;
    delete state.modes.palette;

    const resolved = resolveRequestedRenderingMode(state, 'palette', 'monochrome');
    expect(resolved).toBe('monochrome');
  });

  test('paletteColors is ignored outside palette mode', () => {
    const warns: string[] = [];
    const warn = console.warn;
    console.warn = (message?: any) => {
      warns.push(String(message));
    };

    try {
      const result = resolvePaletteColors('monochrome', { primary: '#ff0000' });
      expect(result).toBeUndefined();
      expect(warns.some((entry) => entry.includes('ignored outside palette'))).toBeTrue();
    } finally {
      console.warn = warn;
    }
  });

  test('parser validates payload and dispatches migration hook by schema', () => {
    const icon = makeIcon() as any;
    icon.$schema = 'https://coniva.dev/schemas/compiled-icon/0.9.0';

    let called = false;
    const parsed = parseCompiledIconJson(icon, {
      migrationHook: (payload, schema) => {
        called = true;
        expect(schema).toBe('https://coniva.dev/schemas/compiled-icon/0.9.0');
        const migrated = structuredClone(payload) as any;
        migrated.$schema = 'https://coniva.dev/schemas/compiled-icon/1.0.0';
        return migrated;
      },
    });

    expect(called).toBeTrue();
    expect(parsed.icon.$schema).toBe('https://coniva.dev/schemas/compiled-icon/1.0.0');
    expect(parsed.meta.availableModes).toEqual([
      'monochrome',
      'hierarchical',
      'palette',
      'multicolor',
    ]);

    expect(() => parseCompiledIconJson({})).toThrow('Invalid compiled icon payload: missing $schema.');
  });
});
