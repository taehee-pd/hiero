import { editorStore } from '@/lib/editor-store/store';
import { buildLeftLeaningCompound } from '@/lib/schema/compound';
import type { Project } from '@/lib/schema/types';

function buildSmokeProject(): Project {
  return {
    version: '1.0',
    meta: {
      name: 'Story smoke fixture',
      createdAt: '2026-04-16T00:00:00Z',
      updatedAt: '2026-04-16T00:00:00Z',
    },
    icons: {
      sample: {
        id: 'sample',
        name: 'Sample',
        variants: {
          v24: {
            id: 'v24',
            size: 24,
            viewBox: [0, 0, 24, 24],
            layers: {
              shape: {
                id: 'shape',
                path: { d: 'M4 4 H20 V20 H4 Z' },
                style: {
                  fill: { mode: 'fixed', value: '#0ea5e9' },
                  stroke: { mode: 'fixed', value: '#0f172a' },
                  strokeWidth: 1,
                },
                transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: 0 },
              },
            },
            defaultType: 'default',
            types: {
              default: {
                id: 'default',
                layers: {
                  shape: {
                    id: 'shape',
                    path: { d: 'M4 4 H20 V20 H4 Z' },
                    style: {
                      fill: { mode: 'fixed', value: '#0ea5e9' },
                      stroke: { mode: 'fixed', value: '#0f172a' },
                      strokeWidth: 1,
                    },
                    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: 0 },
                  },
                },
              },
            },
          },
        },
        transitions: {},
      },
    },
  };
}

function seedEditorStoryState() {
  const state = editorStore.getState();
  state.loadProject(structuredClone(buildSmokeProject()));
  state.setCurrentIcon('sample');
  state.setCurrentVariant('v24');
  state.setCurrentType('default');
  state.setSelection({ layerIds: ['shape'], pointIds: [] });
}

/**
 * Compound-layer story fixture (W2 audit cleanup) — gives the
 * existing layer-panel + inspector-panel stories a layer with
 * `compound` metadata so the op-glyph + Inspector affordances
 * render in Storybook without bespoke setup. Stories that need
 * this state call `seedEditorStoryStateWithCompound` instead of
 * `seedEditorStoryState`.
 */
function seedEditorStoryStateWithCompound() {
  const project = buildSmokeProject();
  const variant = project.icons.sample!.variants.v24!;
  const compoundLayer = {
    id: 'donut',
    path: { d: 'M0 0 L100 0 L100 100 L0 100 Z M30 30 L70 30 L70 70 L30 70 Z' },
    style: { fill: { mode: 'fixed' as const, value: '#0ea5e9' } },
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: 0 },
    compound: buildLeftLeaningCompound(
      'subtract',
      [
        { d: 'M0 0 L100 0 L100 100 L0 100 Z' },
        { d: 'M30 30 L70 30 L70 70 L30 70 Z' },
      ],
      'donut',
    ),
  };
  variant.layers = { ...variant.layers, donut: compoundLayer };
  variant.types.default!.layers = { ...variant.types.default!.layers, donut: compoundLayer };

  const state = editorStore.getState();
  state.loadProject(structuredClone(project));
  state.setCurrentIcon('sample');
  state.setCurrentVariant('v24');
  state.setCurrentType('default');
  state.setSelection({ layerIds: ['donut'], pointIds: [] });
}

export { seedEditorStoryState, seedEditorStoryStateWithCompound };
