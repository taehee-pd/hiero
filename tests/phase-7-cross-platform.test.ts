/**
 * Phase 7 — Cross-Platform Adapters tests.
 *
 * Tests Swift adapter, Flutter adapter, and downgrade rules.
 */

import { describe, expect, it } from 'bun:test';
import type { Icon } from '@/lib/schema/types';
import type { RuntimeVariantPayload, RuntimeIconMeta } from '@/lib/export/export-runtime-json';
import {
  generateSwiftFromRuntime,
  type SwiftAdapterInput,
} from '@/lib/export/adapters/swift-adapter';
import {
  generateFlutterFromRuntime,
  type FlutterAdapterInput,
} from '@/lib/export/adapters/flutter-adapter';
import {
  applyDowngradeRules,
  getDowngradeConfig,
  needsDowngrade,
  getFallbackEasing,
  type PlatformDowngradeConfig,
} from '@/lib/export/adapters/downgrade-rules';
import type { PlatformDiagnostic } from '@/lib/platform/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeIcon(id: string, name: string): Icon {
  return {
    id,
    name,
    variants: {
      default: {
        id: 'default',
        size: 24,
        viewBox: [0, 0, 24, 24],
        layers: {
          line1: {
            id: 'line1',
            role: 'primary',
            path: { d: 'M4 6h16' },
            style: { fill: { mode: 'currentColor' } },
          },
          line2: {
            id: 'line2',
            role: 'secondary',
            path: { d: 'M4 12h16' },
            style: { fill: { mode: 'currentColor' } },
          },
        },
        defaultState: 'idle',
        states: {
          idle: {
            id: 'idle',
            layers: {
              line1: {
                id: 'line1',
                role: 'primary',
                path: { d: 'M4 6h16' },
                style: { fill: { mode: 'currentColor' } },
              },
              line2: {
                id: 'line2',
                role: 'secondary',
                path: { d: 'M4 12h16' },
                style: { fill: { mode: 'currentColor' } },
              },
            },
          },
          active: {
            id: 'active',
            layers: {
              cross1: {
                id: 'cross1',
                role: 'primary',
                path: { d: 'M6 6L18 18' },
                style: { fill: { mode: 'currentColor' } },
              },
              cross2: {
                id: 'cross2',
                role: 'secondary',
                path: { d: 'M18 6L6 18' },
                style: { fill: { mode: 'currentColor' } },
              },
            },
          },
        },
      },
    },
    transitions: {
      'idle→active': {
        id: 'idle→active',
        fromIconId: id,
        toIconId: id,
        fromVariantId: 'default',
        toVariantId: 'default',
        from: 'idle',
        to: 'active',
        strategy: 'replace',
        durationMs: 300,
        layerBindings: [],
      },
    },
    effects: {
      bounce: {
        id: 'bounce',
        kind: 'bounce',
        durationMs: 400,
      },
    },
  };
}

function makeVariantPayload(
  overrides?: Record<string, unknown>,
): RuntimeVariantPayload {
  return {
    variant: { id: 'default', size: 24, viewBox: [0, 0, 24, 24] },
    layers: [],
    states: {
      idle: { layers: [] },
      active: { layers: [] },
    },
    effects: {
      bounce: {
        kind: 'bounce',
        durationMs: 400,
        easing: 'linear',
      },
    },
    ...overrides,
  } as RuntimeVariantPayload;
}

function makeMeta(): RuntimeIconMeta {
  return {
    id: 'test',
    name: 'test-icon',
    variants: {
      default: { size: 24, viewBox: [0, 0, 24, 24] },
    },
  } as RuntimeIconMeta;
}

// ---------------------------------------------------------------------------
// 7.1 — Swift adapter tests
// ---------------------------------------------------------------------------

describe('Phase 7.1 — Swift adapter', () => {
  it('generates SwiftUI component files', () => {
    const icon = makeIcon('hamburger', 'Hamburger');
    const input: SwiftAdapterInput = {
      icon,
      meta: makeMeta(),
      variants: [makeVariantPayload()],
    };

    const result = generateSwiftFromRuntime([input]);
    expect(result.files.length).toBeGreaterThanOrEqual(2);

    const componentFile = result.files.find((f) => f.path.includes('Hamburger.swift'));
    expect(componentFile).toBeTruthy();
    expect(componentFile!.contents).toContain('import SwiftUI');
    expect(componentFile!.contents).toContain('struct _HamburgerView');
    expect(componentFile!.contents).toContain('HamburgerState');

    const barrelFile = result.files.find((f) => f.path.includes('ContourIcons.swift'));
    expect(barrelFile).toBeTruthy();
    expect(barrelFile!.contents).toContain('typealias Hamburger');
  });

  it('generates UIKit component files', () => {
    const icon = makeIcon('chevron', 'Chevron');
    const input: SwiftAdapterInput = {
      icon,
      meta: makeMeta(),
      variants: [makeVariantPayload()],
    };

    const result = generateSwiftFromRuntime([input], { framework: 'uikit' });
    const componentFile = result.files.find((f) => f.path.includes('Chevron.swift'));
    expect(componentFile).toBeTruthy();
    expect(componentFile!.contents).toContain('import UIKit');
    expect(componentFile!.contents).toContain('class ChevronView');
    expect(componentFile!.contents).toContain('CAShapeLayer');
  });

  it('includes state enum from icon states', () => {
    const icon = makeIcon('toggle', 'Toggle');
    const result = generateSwiftFromRuntime([{
      icon,
      meta: makeMeta(),
      variants: [makeVariantPayload()],
    }]);

    const file = result.files.find((f) => f.path.includes('Toggle.swift'));
    expect(file!.contents).toContain('case idle');
    expect(file!.contents).toContain('case active');
  });

  it('emits diagnostics for unsupported features', () => {
    const icon = makeIcon('morph-icon', 'MorphIcon');
    const payload = makeVariantPayload({
      transitions: {
        'idle→active': {
          from: 'idle',
          to: 'active',
          strategy: 'replace',
          durationMs: 300,
          easing: 'linear',
          layerBindings: [{ morph: { topology: 'strict' } }],
        },
      },
    });

    const result = generateSwiftFromRuntime([{
      icon,
      meta: makeMeta(),
      variants: [payload],
    }]);

    const morphDiag = result.diagnostics.find((d) => d.code === 'unsupported-morph');
    expect(morphDiag).toBeTruthy();
    expect(morphDiag!.platform).toBe('swift');
  });

  it('respects custom output directory and package name', () => {
    const icon = makeIcon('star', 'Star');
    const result = generateSwiftFromRuntime([{
      icon,
      meta: makeMeta(),
      variants: [makeVariantPayload()],
    }], {
      outputDir: 'MyIcons/Sources',
      packageName: 'MyIcons',
    });

    expect(result.files.some((f) => f.path.startsWith('MyIcons/Sources/'))).toBe(true);
    expect(result.files.some((f) => f.path.includes('MyIcons.swift'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7.2 — Flutter adapter tests
// ---------------------------------------------------------------------------

describe('Phase 7.2 — Flutter adapter', () => {
  it('generates Dart widget files', () => {
    const icon = makeIcon('hamburger', 'Hamburger');
    const input: FlutterAdapterInput = {
      icon,
      meta: makeMeta(),
      variants: [makeVariantPayload()],
    };

    const result = generateFlutterFromRuntime([input]);
    expect(result.files.length).toBeGreaterThanOrEqual(2);

    const widgetFile = result.files.find((f) => f.path.includes('hamburger.dart'));
    expect(widgetFile).toBeTruthy();
    expect(widgetFile!.contents).toContain("import 'package:flutter/material.dart'");
    expect(widgetFile!.contents).toContain('class Hamburger extends StatefulWidget');
    expect(widgetFile!.contents).toContain('HamburgerState');

    const barrelFile = result.files.find((f) => f.path.includes('contour_icons.dart'));
    expect(barrelFile).toBeTruthy();
    expect(barrelFile!.contents).toContain("export 'hamburger.dart'");
  });

  it('generates AnimatedSwitcher-based transitions', () => {
    const icon = makeIcon('check', 'Check');
    const result = generateFlutterFromRuntime([{
      icon,
      meta: makeMeta(),
      variants: [makeVariantPayload()],
    }]);

    const file = result.files.find((f) => f.path.includes('check.dart'));
    expect(file!.contents).toContain('AnimatedSwitcher');
    expect(file!.contents).toContain('CustomPaint');
  });

  it('generates CustomPainter for path rendering', () => {
    const icon = makeIcon('arrow', 'Arrow');
    const result = generateFlutterFromRuntime([{
      icon,
      meta: makeMeta(),
      variants: [makeVariantPayload()],
    }]);

    const file = result.files.find((f) => f.path.includes('arrow.dart'));
    expect(file!.contents).toContain('CustomPainter');
    expect(file!.contents).toContain('canvas.drawPath');
  });

  it('uses snake_case file names', () => {
    const icon = makeIcon('my-icon', 'MyIcon');
    const result = generateFlutterFromRuntime([{
      icon,
      meta: makeMeta(),
      variants: [makeVariantPayload()],
    }]);

    expect(result.files.some((f) => f.path.includes('my_icon.dart'))).toBe(true);
  });

  it('emits diagnostics for unsupported features', () => {
    const icon = makeIcon('clip-icon', 'ClipIcon');
    const payload = makeVariantPayload({
      states: {
        idle: {
          layers: [{
            id: 'clipped',
            d: 'M0 0 L10 0 L10 10 Z',
            fill: { kind: 'currentColor' as const },
            stroke: { kind: 'none' as const },
            clipPath: { d: 'M0 0 L10 10 Z' },
          }],
        },
      },
    });

    const result = generateFlutterFromRuntime([{
      icon,
      meta: makeMeta(),
      variants: [payload],
    }]);

    const clipDiag = result.diagnostics.find((d) => d.code === 'unsupported-clip-path');
    expect(clipDiag).toBeTruthy();
    expect(clipDiag!.platform).toBe('flutter');
  });
});

// ---------------------------------------------------------------------------
// 7.3 — Downgrade rules tests
// ---------------------------------------------------------------------------

describe('Phase 7.3 — Downgrade rules', () => {
  it('returns correct config for each platform', () => {
    const swift = getDowngradeConfig('swift');
    expect(swift.morph).toBe('crossfade');
    expect(swift.trackTransition).toBe('snap');
    expect(swift.draw).toBe('preserve');

    const flutter = getDowngradeConfig('flutter');
    expect(flutter.morph).toBe('crossfade');
    expect(flutter.clipPaths).toBe('omit');
    expect(flutter.effects).toBe('preserve');

    const react = getDowngradeConfig('react');
    expect(react.morph).toBe('preserve');
    expect(react.trackTransition).toBe('preserve');

    const wc = getDowngradeConfig('web-component');
    expect(wc.morph).toBe('preserve');
  });

  it('needsDowngrade returns true for unsupported features', () => {
    expect(needsDowngrade('swift', 'morph')).toBe(true);
    expect(needsDowngrade('swift', 'draw')).toBe(false);
    expect(needsDowngrade('flutter', 'clipPaths')).toBe(true);
    expect(needsDowngrade('react', 'morph')).toBe(false);
  });

  it('applies downgrade rules to payload with morph', () => {
    const payload = makeVariantPayload({
      transitions: {
        't1': {
          from: 'idle',
          to: 'active',
          strategy: 'replace',
          durationMs: 300,
          easing: 'linear',
          layerBindings: [{ morph: { topology: 'strict' } }],
        },
      },
    });

    const diags: PlatformDiagnostic[] = [];
    const result = applyDowngradeRules('swift', payload, diags, 'test-icon');

    expect(result.downgrades.length).toBeGreaterThan(0);
    expect(result.downgrades.some((d) => d.feature === 'morph')).toBe(true);
    expect(result.downgrades.find((d) => d.feature === 'morph')!.action).toBe('crossfade');
  });

  it('applies downgrade rules for spring easing', () => {
    const payload = makeVariantPayload({
      transitions: {
        't1': {
          from: 'idle',
          to: 'active',
          strategy: 'replace',
          durationMs: 300,
          easing: { type: 'spring', stiffness: 100, damping: 10 },
          layerBindings: [],
        },
      },
    });

    const diags: PlatformDiagnostic[] = [];
    const result = applyDowngradeRules('swift', payload, diags, 'test-icon');

    expect(result.downgrades.some((d) => d.feature === 'spring-easing')).toBe(true);
  });

  it('preserves features that are supported', () => {
    const payload = makeVariantPayload({
      draw: { layers: { layer1: { points: [], pathLength: 100 } } } as unknown as RuntimeVariantPayload['draw'],
    });

    const diags: PlatformDiagnostic[] = [];
    const result = applyDowngradeRules('swift', payload, diags, 'test-icon');

    // Draw is supported on Swift — no downgrade
    expect(result.downgrades.some((d) => d.feature === 'draw')).toBe(false);
  });

  it('no downgrades for React target', () => {
    const payload = makeVariantPayload({
      transitions: {
        't1': {
          from: 'idle',
          to: 'active',
          strategy: 'replace',
          durationMs: 300,
          easing: { type: 'spring', stiffness: 100, damping: 10 },
          layerBindings: [{ morph: { topology: 'strict' } }],
        },
      },
      variableDraw: { participatingLayerIds: ['l1'] },
    });

    const diags: PlatformDiagnostic[] = [];
    const result = applyDowngradeRules('react', payload, diags, 'test-icon');

    expect(result.downgrades.length).toBe(0);
  });

  it('getFallbackEasing converts spring to cubic-bezier', () => {
    const result = getFallbackEasing('swift', {
      type: 'spring',
      stiffness: 100,
      damping: 10,
    });
    expect(result).toContain('cubic-bezier');
  });

  it('getFallbackEasing passes through string easing', () => {
    const result = getFallbackEasing('swift', 'ease-in-out');
    expect(result).toBe('ease-in-out');
  });
});
