import { describe, expect, test, beforeEach } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { editorStore } from '../lib/editor-store/store';
import { TransitionPanel } from '../components/editor/TransitionPanel';
import type { Project } from '../lib/schema/types';

/**
 * §2.6 regression: TransitionPanel must never expose strategy selection,
 * compatibility badges, or topology warnings. The morph algorithm is
 * `autoMorph()` only; the only escape hatch is the collapsed Advanced
 * disclosure.
 */

function buildTwoIconProject(): Project {
  return {
    version: '1.0',
    meta: {
      name: 'Animate Panel Test',
      createdAt: '2026-04-13T00:00:00Z',
      updatedAt: '2026-04-13T00:00:00Z',
    },
    icons: {
      iconA: {
        id: 'iconA',
        name: 'Icon A',
        variants: {
          v24: {
            id: 'v24',
            size: 24,
            viewBox: [0, 0, 24, 24],
            layers: {
              shape: {
                id: 'shape',
                path: { d: 'M4 4h16v16H4z' },
                style: { fill: { mode: 'fixed', value: '#000' } },
                transform: { x: 0, y: 0 },
              },
            },
            defaultType: 'default',
            types: {
              default: {
                id: 'default',
                layers: {
                  shape: {
                    id: 'shape',
                    path: { d: 'M4 4h16v16H4z' },
                    style: { fill: { mode: 'fixed', value: '#000' } },
                    transform: { x: 0, y: 0 },
                  },
                },
              },
            },
          },
        },
        transitions: {},
      },
      iconB: {
        id: 'iconB',
        name: 'Icon B',
        variants: {
          v24: {
            id: 'v24',
            size: 24,
            viewBox: [0, 0, 24, 24],
            layers: {
              shape: {
                id: 'shape',
                path: { d: 'M4 12 L12 4 L20 12 L12 20 Z' },
                style: { fill: { mode: 'fixed', value: '#000' } },
                transform: { x: 0, y: 0 },
              },
            },
            defaultType: 'default',
            types: {
              default: {
                id: 'default',
                layers: {
                  shape: {
                    id: 'shape',
                    path: { d: 'M4 12 L12 4 L20 12 L12 20 Z' },
                    style: { fill: { mode: 'fixed', value: '#000' } },
                    transform: { x: 0, y: 0 },
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

function bootstrap() {
  const state = editorStore.getState();
  state.loadProject(structuredClone(buildTwoIconProject()));
  state.setCurrentIcon('iconA');
  state.setCurrentVariant('v24');
}

describe('TransitionPanel — §2.2 / §2.7 acceptance', () => {
  beforeEach(() => {
    bootstrap();
  });

  test('panel renders without a "Strategy" label in the primary surface', () => {
    const html = renderToStaticMarkup(<TransitionPanel />);
    // The strategy override DOES live inside the Advanced disclosure but the
    // disclosure is collapsed by default, so the rendered <details> element
    // should not contain a Label that says "Strategy".
    // We assert the *primary* surface never uses the word.
    const beforeAdvanced = html.split('<details')[0] ?? html;
    expect(beforeAdvanced).not.toContain('>Strategy<');
  });

  test('panel never renders compatibility tones (green/yellow/red)', () => {
    const html = renderToStaticMarkup(<TransitionPanel />);
    expect(html).not.toContain('Auto (morph detected)');
    expect(html).not.toContain('Auto (will crossfade)');
    expect(html).not.toContain('Replace / Fallback');
    expect(html).not.toContain('Best Guess');
  });

  test('panel never renders any role="alert"', () => {
    const html = renderToStaticMarkup(<TransitionPanel />);
    expect(html).not.toContain('role="alert"');
  });

  test('panel renders the SF Symbols 7 hierarchy labels', () => {
    const html = renderToStaticMarkup(<TransitionPanel />);
    expect(html).toContain('Playback mode');
    expect(html).toContain('By Layer');
    expect(html).toContain('Whole Symbol');
    expect(html).toContain('Individually');
    expect(html).toContain('Duration (ms)');
    expect(html).toContain('Easing');
    expect(html).toContain('Preview transition');
  });

  test('Advanced disclosure exists and is collapsed by default', () => {
    const html = renderToStaticMarkup(<TransitionPanel />);
    expect(html).toContain('<details');
    // open attribute should NOT be present on a fresh render.
    const detailsOpen = /<details[^>]*\bopen\b/.test(html);
    expect(detailsOpen).toBeFalse();
    expect(html).toContain('Advanced');
  });
});
