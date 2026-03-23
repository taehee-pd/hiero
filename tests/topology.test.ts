import { describe, expect, test } from 'bun:test';
import {
  areTopologiesCompatible,
  computeTopology,
  lockTopology,
} from '../lib/editor-core/topology';
import { editorStore } from '../lib/editor-store/store';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';
import type { State } from '../lib/schema/types';

const COMPLEX_STATE: State = {
  id: 'default',
  layers: {
    compound: {
      id: 'compound',
      path: {
        d: 'M0 0 10 0 10 10 0 10Z M20 20 C25 25 30 25 35 20 40 15 45 15 50 20Z',
      },
      style: {},
    },
    ignored: {
      id: 'ignored',
      style: {},
    },
  },
};

function bootstrap() {
  editorStore.getState().loadProject(structuredClone(SAMPLE_PROJECT));
}

describe('topology', () => {
  test('computeTopology expands command signatures and subpath closure', () => {
    const topology = computeTopology(COMPLEX_STATE);

    expect(topology).toEqual({
      locked: false,
      layerPairs: [
        {
          layerId: 'compound',
          subpathCount: 2,
          commandSignature: ['M', 'L', 'L', 'L', 'Z', 'M', 'C', 'C', 'Z'],
          closed: [true, true],
        },
      ],
    });
  });

  test('areTopologiesCompatible reports matching and mismatching contracts', () => {
    const matchingState: State = {
      id: 'match',
      layers: {
        compound: {
          id: 'compound',
          path: {
            d: 'M1 1 11 1 11 11 1 11Z M21 21 C26 26 31 26 36 21 41 16 46 16 51 21Z',
          },
          style: {},
        },
      },
    };
    const mismatchingState: State = {
      id: 'mismatch',
      layers: {
        compound: {
          id: 'compound',
          path: { d: 'M0 0 L10 0 L10 10 L0 10 Z' },
          style: {},
        },
      },
    };

    const compatible = areTopologiesCompatible(
      computeTopology(COMPLEX_STATE),
      computeTopology(matchingState),
    );
    const incompatible = areTopologiesCompatible(
      computeTopology(COMPLEX_STATE),
      computeTopology(mismatchingState),
    );

    expect(compatible).toEqual({ compatible: true, mismatches: [] });
    expect(incompatible.compatible).toBeFalse();
    expect(incompatible.mismatches.some((message) => message.includes('subpath count differs'))).toBeTrue();
    expect(
      incompatible.mismatches.some((message) => message.includes('command signature differs')),
    ).toBeTrue();
    expect(incompatible.mismatches.some((message) => message.includes('closed flags differ'))).toBeTrue();
  });

  test('locked topology blocks incompatible path edits', () => {
    bootstrap();
    const state = editorStore.getState();
    const iconId = state.currentIconId!;
    const variantId = state.currentVariantId!;
    const stateId = state.currentStateId!;
    const current = state.project!.icons[iconId].variants[variantId].states[stateId]!;
    const before = current.layers.roof.path!.d;

    state.setStateTopology(iconId, stateId, lockTopology(current));

    expect(() =>
      state.patchLayer(iconId, stateId, 'roof', {
        path: { d: 'M9.5 7 C12 9 13 15 9.5 17' },
      }),
    ).toThrow('Topology is locked');

    const after =
      editorStore.getState().project!.icons[iconId].variants[variantId].states[stateId]!.layers.roof
        .path!.d;
    expect(after).toBe(before);
  });
});
