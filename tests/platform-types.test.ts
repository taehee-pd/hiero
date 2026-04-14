import { describe, expect, test } from 'bun:test';
import {
  checkPlatformCapabilities,
  FLUTTER_CAPABILITIES,
  REACT_CAPABILITIES,
  SWIFT_CAPABILITIES,
  type PlatformCapability,
} from '../lib/platform/types';
import type { RuntimeVariantPayload } from '../lib/export/export-runtime-json';

// ---------------------------------------------------------------------------
// Minimal fixture payload
// ---------------------------------------------------------------------------
function makeMockPayload(
  overrides?: Partial<RuntimeVariantPayload>,
): RuntimeVariantPayload {
  return {
    variant: {
      id: 'v24',
      size: 24,
      viewBox: [0, 0, 24, 24] as [number, number, number, number],
    },
    layers: [
      {
        id: 'l1',
        d: 'M0 0',
        fill: { kind: 'solid', color: '#000' },
        stroke: { kind: 'none' },
        fillOpacity: 1,
        strokeOpacity: 0,
        strokeWidth: 0,
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Capability profile tests
// ---------------------------------------------------------------------------
describe('REACT_CAPABILITIES', () => {
  const ALL_CAPABILITIES: PlatformCapability[] = [
    'draw',
    'morph',
    'effects',
    'gradients',
    'clip-paths',
    'track-transitions',
    'spring-easing',
    'variable-draw',
  ];

  test('has all capabilities including morph', () => {
    for (const cap of ALL_CAPABILITIES) {
      expect(REACT_CAPABILITIES.capabilities.has(cap)).toBe(true);
    }
  });
});

describe('SWIFT_CAPABILITIES', () => {
  test('does NOT have morph', () => {
    expect(SWIFT_CAPABILITIES.capabilities.has('morph')).toBe(false);
  });

  test('does NOT have spring-easing', () => {
    expect(SWIFT_CAPABILITIES.capabilities.has('spring-easing')).toBe(false);
  });

  test('has draw and effects', () => {
    expect(SWIFT_CAPABILITIES.capabilities.has('draw')).toBe(true);
    expect(SWIFT_CAPABILITIES.capabilities.has('effects')).toBe(true);
  });
});

describe('FLUTTER_CAPABILITIES', () => {
  test('does NOT have clip-paths', () => {
    expect(FLUTTER_CAPABILITIES.capabilities.has('clip-paths')).toBe(false);
  });

  test('does NOT have morph', () => {
    expect(FLUTTER_CAPABILITIES.capabilities.has('morph')).toBe(false);
  });

  test('has draw and gradients', () => {
    expect(FLUTTER_CAPABILITIES.capabilities.has('draw')).toBe(true);
    expect(FLUTTER_CAPABILITIES.capabilities.has('gradients')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkPlatformCapabilities tests
// ---------------------------------------------------------------------------
describe('checkPlatformCapabilities', () => {
  test('React profile + payload with morph → no diagnostics', () => {
    const payload = makeMockPayload();
    const diagnostics = checkPlatformCapabilities(
      REACT_CAPABILITIES,
      'icon-1',
      'v24',
      payload,
    );
    expect(diagnostics).toHaveLength(0);
  });

  test('Swift profile + payload with morph transition → emits unsupported-morph', () => {
    const payload = makeMockPayload() as any;
    payload.transitions = {
      't1': {
        from: 'default',
        to: 'active',
        strategy: 'morph',
        durationMs: 300,
        easing: 'ease-in-out',
        layerBindings: [
          {
            fromLayerId: 'l1',
            toLayerId: 'l2',
            morph: { topology: 'bestGuess' },
          },
        ],
      },
    };
    const diagnostics = checkPlatformCapabilities(
      SWIFT_CAPABILITIES,
      'icon-1',
      'v24',
      payload,
    );
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics.some(d => d.code === 'unsupported-morph')).toBe(true);
    expect(diagnostics[0]!.platform).toBe('swift');
    expect(diagnostics[0]!.iconId).toBe('icon-1');
  });

  test('Flutter profile + payload with clip-path layer → emits unsupported-clip-path', () => {
    const payload = makeMockPayload({
      types: {
        default: {
          layers: [
            {
              id: 'l1',
              d: 'M0 0',
              fill: { kind: 'solid', color: '#000' },
              stroke: { kind: 'none' },
              clipPath: { d: 'M0 0H12V12H0Z' },
            },
          ],
        },
      },
    });
    const diagnostics = checkPlatformCapabilities(
      FLUTTER_CAPABILITIES,
      'icon-clip',
      'v24',
      payload,
    );
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics.some(d => d.code === 'unsupported-clip-path')).toBe(true);
  });

  test('platform with no effects + payload with effects → emits unsupported-effect', () => {
    // Create a profile that has draw but NOT effects
    const noEffectsProfile = {
      platform: 'swift' as const,
      capabilities: new Set<PlatformCapability>(['draw', 'gradients']),
    };
    const payload = makeMockPayload({
      effects: {
        bounce1: { kind: 'bounce', durationMs: 400 },
      },
    });
    const diagnostics = checkPlatformCapabilities(
      noEffectsProfile,
      'icon-fx',
      'v24',
      payload,
    );
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics.some(d => d.code === 'unsupported-effect')).toBe(true);
    expect(diagnostics.find(d => d.code === 'unsupported-effect')!.feature).toBe('effects');
  });

  test('plain payload with no advanced features produces no diagnostics', () => {
    const payload = makeMockPayload();
    const diagnostics = checkPlatformCapabilities(
      FLUTTER_CAPABILITIES,
      'icon-plain',
      'v24',
      payload,
    );
    expect(diagnostics).toHaveLength(0);
  });
});
