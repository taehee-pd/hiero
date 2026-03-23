import { describe, expect, test } from 'bun:test';
import {
  exportRuntimeIconVariant,
  exportRuntimePackage,
  serializeRuntimeJson,
} from '../lib/export/export-runtime-json';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

describe('runtime-json export', () => {
  test('exports a deterministic package layout for the sample project', () => {
    const first = exportRuntimePackage(structuredClone(SAMPLE_PROJECT));
    const second = exportRuntimePackage(structuredClone(SAMPLE_PROJECT));

    expect(first.files.map((file) => file.path)).toEqual([
      'icons/index.json',
      'icons/icon-chevron/meta.json',
      'icons/icon-chevron/v24.json',
      'icons/icon-play/meta.json',
      'icons/icon-play/v24.json',
    ]);
    expect(first.files).toEqual(second.files);
    expect(serializeRuntimeJson(first.manifest)).toBe(
      serializeRuntimeJson(second.manifest),
    );
  });

  test('preserves gradients, token resolution, transforms, and clip paths in runtime layers', () => {
    const project = structuredClone(SAMPLE_PROJECT);
    const icon = project.icons['icon-chevron']!;
    const state = icon.variants.v24.states.default;

    state.layers.chevron.style.fill = {
      mode: 'linearGradient',
      angle: 90,
      stops: [
        { offset: 0, color: '#111111' },
        { offset: 1, color: '#eeeeee', opacity: 0.4 },
      ],
    };
    state.layers.chevron.style.stroke = { mode: 'token', token: 'accent' };
    state.layers.chevron.transform = { x: 3, y: 4, rotate: 15, scaleX: 2, scaleY: 1.5 };
    state.layers.mask = {
      id: 'mask',
      isClipMask: true,
      path: { d: 'M2 2 H22 V22 H2 Z', fillRule: 'evenodd' },
      style: {},
      transform: { x: 1, y: 2 },
    };
    state.layers.chevron.clipPathLayerId = 'mask';

    const exported = exportRuntimeIconVariant(project, icon.id, 'v24');
    const runtimeState = exported.variant.states.default!;
    const chevron = runtimeState.layers.find((layer) => layer.id === 'chevron');

    expect(chevron).toMatchObject({
      id: 'chevron',
      transform: 'translate(3, 4) rotate(15) scale(2, 1.5)',
      clipPath: {
        d: 'M2 2 H22 V22 H2 Z',
        fillRule: 'evenodd',
        transform: 'translate(1, 2)',
      },
      stroke: {
        kind: 'solid',
        color: '#38bdf8',
      },
    });
    expect(chevron?.fill).toEqual({
      kind: 'linearGradient',
      angle: 90,
      stops: [
        { offset: 0, color: '#111111', opacity: undefined },
        { offset: 1, color: '#eeeeee', opacity: 0.4 },
      ],
    });
    expect(runtimeState.layers.some((layer) => layer.id === 'mask')).toBeFalse();
  });

  test('exports draw metadata, continuity metadata, and filters invalid transitions', () => {
    const project = structuredClone(SAMPLE_PROJECT);
    const icon = project.icons['icon-chevron']!;
    const variant = icon.variants.v24;
    const defaultState = variant.states.default;

    variant.states.active = {
      ...structuredClone(defaultState),
      id: 'active',
      layers: {
        ...structuredClone(defaultState.layers),
        chevron: {
          ...structuredClone(defaultState.layers.chevron),
          path: { d: 'M7 5l7 7-7 7' },
        },
      },
    };

    icon.customGuides = [
      { kind: 'drawPoint', layerId: 'chevron', t: 0, direction: 'forward' },
      { kind: 'drawPoint', layerId: 'chevron', t: 1, direction: 'forward' },
      { kind: 'drawPoint', layerId: 'bg-circle', t: 0, direction: 'forward' },
      { kind: 'drawPoint', layerId: 'bg-circle', t: 1, direction: 'forward' },
      { kind: 'drawPoint', layerId: 'accent-dot', t: 0.5, direction: 'forward' },
    ];

    icon.transitions = {
      validTrack: {
        id: 'validTrack',
        from: 'default',
        to: 'active',
        strategy: 'track',
        durationMs: 220,
        easing: 'ease-in-out',
        layerBindings: [
          {
            fromLayerId: 'chevron',
            toLayerId: 'chevron',
            tracks: [
              { property: 'opacity', keyframes: [0, 1] },
              { property: 'translateX', keyframes: [0, 2] },
            ],
          },
        ],
      },
      missingState: {
        id: 'missingState',
        from: 'default',
        to: 'missing',
        strategy: 'replace',
        durationMs: 120,
        easing: 'linear',
        layerBindings: [],
      },
      strictMorphMissingTopology: {
        id: 'strictMorphMissingTopology',
        from: 'default',
        to: 'active',
        strategy: 'strictMorph',
        durationMs: 180,
        easing: 'linear',
        layerBindings: [
          {
            fromLayerId: 'chevron',
            toLayerId: 'chevron',
            morph: { topology: 'strict' },
          },
        ],
      },
    };

    icon.effects = {
      drawOn: {
        id: 'drawOn',
        kind: 'lineDrawOn',
        durationMs: 300,
        easing: 'ease-out',
      },
    };

    const exported = exportRuntimeIconVariant(project, icon.id, 'v24');

    expect(exported.variant.draw).toEqual({
      mode: 'byLayer',
      layers: {
        'bg-circle': {
          guidePoints: [
            { t: 0, direction: 'forward' },
            { t: 1, direction: 'forward' },
          ],
        },
        chevron: {
          guidePoints: [
            { t: 0, direction: 'forward' },
            { t: 1, direction: 'forward' },
          ],
        },
      },
    });
    expect(exported.variant.variableDraw).toEqual({
      participatingLayerIds: ['bg-circle', 'chevron'],
    });
    expect(Object.keys(exported.variant.transitions)).toEqual(['validTrack']);
    expect(exported.variant.transitions.validTrack).toMatchObject({
      strategy: 'track',
      easing: 'ease-in-out',
      magicReplace: {
        preserveLayerIds: ['accent-dot', 'bg-circle'],
        drawIntegrated: true,
      },
    });
    expect(exported.variant.effects).toEqual({
      drawOn: {
        kind: 'lineDrawOn',
        durationMs: 300,
        easing: 'ease-out',
      },
    });
    expect(
      exported.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === 'invalid-transition' &&
          diagnostic.transitionId === 'missingState',
      ),
    ).toBeTrue();
    expect(
      exported.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === 'invalid-transition' &&
          diagnostic.transitionId === 'strictMorphMissingTopology',
      ),
    ).toBeTrue();
    expect(
      exported.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === 'invalid-draw-layer' &&
          diagnostic.message.includes('accent-dot'),
      ),
    ).toBeTrue();
  });

  test('omits line-draw effects when no draw metadata can be exported', () => {
    const project = structuredClone(SAMPLE_PROJECT);
    const icon = project.icons['icon-chevron']!;

    icon.effects = {
      drawOff: {
        id: 'drawOff',
        kind: 'lineDrawOff',
        durationMs: 240,
        easing: 'linear',
      },
    };

    const exported = exportRuntimeIconVariant(project, icon.id, 'v24');

    expect(exported.variant.draw).toBeUndefined();
    expect(exported.variant.effects).toBeUndefined();
    expect(
      exported.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === 'invalid-effect' &&
          diagnostic.effectId === 'drawOff',
      ),
    ).toBeTrue();
  });

  test('bakes resolved stagger timing into exported runtime transitions', () => {
    const project = structuredClone(SAMPLE_PROJECT);
    const icon = project.icons['icon-chevron']!;
    const variant = icon.variants.v24;
    const defaultState = variant.states.default;

    variant.states.active = {
      ...structuredClone(defaultState),
      id: 'active',
      layers: {
        ...structuredClone(defaultState.layers),
        chevron: {
          ...structuredClone(defaultState.layers.chevron),
          transform: { x: 2 },
        },
        'bg-circle': {
          ...structuredClone(defaultState.layers['bg-circle']),
          transform: { y: -2 },
        },
      },
    };

    icon.transitions = {
      staggered: {
        id: 'staggered',
        from: 'default',
        to: 'active',
        strategy: 'track',
        durationMs: 240,
        easing: 'linear',
        stagger: { mode: 'linear', perLayerMs: 40 },
        layerBindings: [
          {
            fromLayerId: 'bg-circle',
            toLayerId: 'bg-circle',
            tracks: [{ property: 'translateY', keyframes: [0, -2] }],
          },
          {
            fromLayerId: 'chevron',
            toLayerId: 'chevron',
            tracks: [{ property: 'translateX', keyframes: [0, 2] }],
          },
        ],
      },
    };

    const exported = exportRuntimeIconVariant(project, icon.id, 'v24');
    const runtimeTransition = exported.variant.transitions.staggered;

    expect(runtimeTransition).toBeDefined();
    expect(runtimeTransition?.layerBindings[0]).toMatchObject({
      delayMs: 0,
      durationMs: 240,
    });
    expect(runtimeTransition?.layerBindings[1]).toMatchObject({
      delayMs: 40,
      durationMs: 200,
    });
  });

  test('preserves compoundTrimMode in exported runtime layer bindings', () => {
    const project = structuredClone(SAMPLE_PROJECT);
    const icon = project.icons['icon-chevron']!;
    const variant = icon.variants.v24;
    const defaultState = variant.states.default;

    variant.states.active = {
      ...structuredClone(defaultState),
      id: 'active',
      layers: structuredClone(defaultState.layers),
    };

    icon.transitions = {
      trimMode: {
        id: 'trimMode',
        from: 'default',
        to: 'active',
        strategy: 'track',
        durationMs: 200,
        easing: 'linear',
        layerBindings: [
          {
            fromLayerId: 'chevron',
            toLayerId: 'chevron',
            tracks: [{ property: 'trimEnd', keyframes: [0, 1] }],
            compoundTrimMode: 'individually',
          },
        ],
      },
    };

    const exported = exportRuntimeIconVariant(project, icon.id, 'v24');
    const runtimeTransition = exported.variant.transitions.trimMode;

    expect(runtimeTransition?.layerBindings[0]).toMatchObject({
      fromLayerId: 'chevron',
      toLayerId: 'chevron',
      compoundTrimMode: 'individually',
    });
  });
});
