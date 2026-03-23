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
      'icons/icon-bell/meta.json',
      'icons/icon-bell/v24.json',
      'icons/icon-heart/meta.json',
      'icons/icon-heart/v24.json',
      'icons/icon-home/meta.json',
      'icons/icon-home/v24.json',
      'icons/icon-search/meta.json',
      'icons/icon-search/v24.json',
      'icons/icon-settings/meta.json',
      'icons/icon-settings/v24.json',
      'icons/icon-star/meta.json',
      'icons/icon-star/v24.json',
    ]);
    expect(first.files).toEqual(second.files);
    expect(serializeRuntimeJson(first.manifest)).toBe(
      serializeRuntimeJson(second.manifest),
    );
  });

  test('preserves gradients, token resolution, transforms, and clip paths in runtime layers', () => {
    const project = structuredClone(SAMPLE_PROJECT);
    const icon = project.icons['icon-home']!;
    const state = icon.variants.v24.states.default;

    state.layers.roof.style.fill = {
      mode: 'linearGradient',
      angle: 90,
      stops: [
        { offset: 0, color: '#111111' },
        { offset: 1, color: '#eeeeee', opacity: 0.4 },
      ],
    };
    state.layers.roof.style.stroke = { mode: 'token', token: 'accent' };
    state.layers.roof.transform = { x: 3, y: 4, rotate: 15, scaleX: 2, scaleY: 1.5 };
    state.layers.mask = {
      id: 'mask',
      isClipMask: true,
      path: { d: 'M2 2 H22 V22 H2 Z', fillRule: 'evenodd' },
      style: {},
      transform: { x: 1, y: 2 },
    };
    state.layers.roof.clipPathLayerId = 'mask';

    const exported = exportRuntimeIconVariant(project, icon.id, 'v24');
    const runtimeState = exported.variant.states.default!;
    const roofLayer = runtimeState.layers.find((layer) => layer.id === 'roof');

    expect(roofLayer).toMatchObject({
      id: 'roof',
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
    expect(roofLayer?.fill).toEqual({
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
    const icon = project.icons['icon-home']!;
    const variant = icon.variants.v24;
    const defaultState = variant.states.default;

    variant.states.active = {
      ...structuredClone(defaultState),
      id: 'active',
      layers: {
        ...structuredClone(defaultState.layers),
        roof: {
          ...structuredClone(defaultState.layers.roof),
          path: { d: 'M7 5l7 7-7 7' },
        },
      },
    };

    icon.customGuides = [
      { kind: 'drawPoint', layerId: 'roof', t: 0, direction: 'forward' },
      { kind: 'drawPoint', layerId: 'roof', t: 1, direction: 'forward' },
      { kind: 'drawPoint', layerId: 'house', t: 0, direction: 'forward' },
      { kind: 'drawPoint', layerId: 'house', t: 1, direction: 'forward' },
      { kind: 'drawPoint', layerId: 'nonexistent', t: 0.5, direction: 'forward' },
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
            fromLayerId: 'roof',
            toLayerId: 'roof',
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
            fromLayerId: 'roof',
            toLayerId: 'roof',
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
        'house': {
          guidePoints: [
            { t: 0, direction: 'forward' },
            { t: 1, direction: 'forward' },
          ],
        },
        roof: {
          guidePoints: [
            { t: 0, direction: 'forward' },
            { t: 1, direction: 'forward' },
          ],
        },
      },
    });
    expect(exported.variant.variableDraw).toEqual({
      participatingLayerIds: ['house', 'roof'],
    });
    expect(Object.keys(exported.variant.transitions)).toEqual(['validTrack']);
    expect(exported.variant.transitions.validTrack).toMatchObject({
      strategy: 'track',
      easing: 'ease-in-out',
      magicReplace: {
        preserveLayerIds: ['house'],
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
          diagnostic.message.includes('nonexistent'),
      ),
    ).toBeTrue();
  });

  test('omits line-draw effects when no draw metadata can be exported', () => {
    const project = structuredClone(SAMPLE_PROJECT);
    const icon = project.icons['icon-home']!;

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
    const icon = project.icons['icon-home']!;
    const variant = icon.variants.v24;
    const defaultState = variant.states.default;

    variant.states.active = {
      ...structuredClone(defaultState),
      id: 'active',
      layers: {
        ...structuredClone(defaultState.layers),
        roof: {
          ...structuredClone(defaultState.layers.roof),
          transform: { x: 2 },
        },
        house: {
          ...structuredClone(defaultState.layers.house),
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
            fromLayerId: 'house',
            toLayerId: 'house',
            tracks: [{ property: 'translateY', keyframes: [0, -2] }],
          },
          {
            fromLayerId: 'roof',
            toLayerId: 'roof',
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
    const icon = project.icons['icon-home']!;
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
            fromLayerId: 'roof',
            toLayerId: 'roof',
            tracks: [{ property: 'trimEnd', keyframes: [0, 1] }],
            compoundTrimMode: 'individually',
          },
        ],
      },
    };

    const exported = exportRuntimeIconVariant(project, icon.id, 'v24');
    const runtimeTransition = exported.variant.transitions.trimMode;

    expect(runtimeTransition?.layerBindings[0]).toMatchObject({
      fromLayerId: 'roof',
      toLayerId: 'roof',
      compoundTrimMode: 'individually',
    });
  });
});
