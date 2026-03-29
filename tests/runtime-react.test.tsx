import { describe, expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { Icon, State } from '../lib/schema';
import { ConivaIcon, useIconState } from '../lib/runtime-react';

function makeTestIcon(): Icon {
  const defaultState: State = {
    id: 'default',
    layers: {
      bg: { id: 'bg', path: { d: 'M0 0H24V24H0Z' }, style: { fill: { mode: 'fixed', value: '#fff' } } },
      arrow: { id: 'arrow', path: { d: 'M8 5l8 7-8 7' }, style: { stroke: { mode: 'currentColor' } } },
    },
  };

  const activeState: State = {
    id: 'active',
    layers: {
      bg: { id: 'bg', path: { d: 'M0 0H24V24H0Z' }, style: { fill: { mode: 'fixed', value: '#eee' } } },
      arrow: { id: 'arrow', path: { d: 'M16 5l-8 7 8 7' }, style: { stroke: { mode: 'currentColor' } } },
    },
  };

  return {
    id: 'icon-test',
    name: 'Test Icon',
    variants: {
      v24: {
        id: 'v24',
        size: 24,
        viewBox: [0, 0, 24, 24],
        layers: defaultState.layers,
        defaultState: 'default',
        states: { default: defaultState, active: activeState },
      },
      v16: {
        id: 'v16',
        size: 16,
        viewBox: [0, 0, 16, 16],
        layers: {
          arrow: { id: 'arrow', path: { d: 'M5 3l6 5-6 5' }, style: {} },
        },
        defaultState: 'default',
        states: {
          default: {
            id: 'default',
            layers: {
              arrow: { id: 'arrow', path: { d: 'M5 3l6 5-6 5' }, style: {} },
            },
          },
        },
      },
    },
    transitions: {
      'default-active': {
        id: 'default-active',
        fromIconId: 'icon-test',
        toIconId: 'icon-test',
        fromVariantId: 'v24',
        toVariantId: 'v24',
        from: 'default',
        to: 'active',
        strategy: 'lineAnimation',
        durationMs: 200,
        easing: 'ease-in-out',
        layerBindings: [],
      },
    },
  };
}

describe('ConivaIcon', () => {
  test('renders a container div with correct dimensions', () => {
    const html = renderToStaticMarkup(<ConivaIcon icon={makeTestIcon()} />);
    expect(html).toContain('width:24px');
    expect(html).toContain('height:24px');
  });

  test('renders with custom size override', () => {
    const html = renderToStaticMarkup(<ConivaIcon icon={makeTestIcon()} size={48} />);
    expect(html).toContain('width:48px');
    expect(html).toContain('height:48px');
  });

  test('renders with color prop', () => {
    const html = renderToStaticMarkup(<ConivaIcon icon={makeTestIcon()} color="#ff0000" />);
    expect(html).toContain('color:#ff0000');
  });

  test('renders with className', () => {
    const html = renderToStaticMarkup(<ConivaIcon icon={makeTestIcon()} className="icon-cls" />);
    expect(html).toContain('class="icon-cls"');
  });

  test('resolves variant by size number', () => {
    const html = renderToStaticMarkup(<ConivaIcon icon={makeTestIcon()} variant={16} />);
    expect(html).toContain('width:16px');
    expect(html).toContain('height:16px');
  });

  test('resolves variant by id string', () => {
    const html = renderToStaticMarkup(<ConivaIcon icon={makeTestIcon()} variant="v16" />);
    expect(html).toContain('width:16px');
  });

  test('falls back to first variant for unknown variant', () => {
    const html = renderToStaticMarkup(<ConivaIcon icon={makeTestIcon()} variant="v999" />);
    // Falls back to first variant by insertion order (v24)
    expect(html).toContain('width:24px');
  });

  test('renders with custom style', () => {
    const html = renderToStaticMarkup(
      <ConivaIcon icon={makeTestIcon()} style={{ opacity: 0.5, borderRadius: 4 }} />,
    );
    expect(html).toContain('opacity:0.5');
    expect(html).toContain('border-radius:4px');
  });

  // --- E1: SSR-safe rendering ---

  test('SSR renders SVG with path elements (not empty div)', () => {
    const html = renderToStaticMarkup(<ConivaIcon icon={makeTestIcon()} />);
    expect(html).toContain('<svg');
    expect(html).toContain('<path');
    expect(html).toContain('d="M0 0H24V24H0Z"');
    expect(html).toContain('d="M8 5l8 7-8 7"');
  });

  test('SSR renders layers with correct fill and stroke', () => {
    const html = renderToStaticMarkup(<ConivaIcon icon={makeTestIcon()} />);
    expect(html).toContain('fill="#fff"');
    expect(html).toContain('stroke="currentColor"');
  });

  test('SSR renders viewBox and dimensions on SVG', () => {
    const html = renderToStaticMarkup(<ConivaIcon icon={makeTestIcon()} />);
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('width="24"');
    expect(html).toContain('height="24"');
  });

  // --- E2: Accessibility ---

  test('decorative icon (no label) renders aria-hidden', () => {
    const html = renderToStaticMarkup(<ConivaIcon icon={makeTestIcon()} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="img"');
    expect(html).not.toContain('aria-label');
  });

  test('labeled icon renders role="img" and aria-label', () => {
    const html = renderToStaticMarkup(<ConivaIcon icon={makeTestIcon()} label="Right arrow" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Right arrow"');
    expect(html).not.toContain('aria-hidden');
  });

  test('SVG has focusable="false"', () => {
    const html = renderToStaticMarkup(<ConivaIcon icon={makeTestIcon()} />);
    expect(html).toContain('focusable="false"');
  });
});

describe('useIconState', () => {
  test('provides state and transitionTo function', () => {
    // Test the hook's return shape by rendering a component that uses it
    function TestComponent() {
      const { state, transitionTo } = useIconState('idle');
      return (
        <div data-state={state}>
          <button onClick={() => transitionTo('active')}>Go</button>
        </div>
      );
    }

    const html = renderToStaticMarkup(<TestComponent />);
    expect(html).toContain('data-state="idle"');
  });
});
