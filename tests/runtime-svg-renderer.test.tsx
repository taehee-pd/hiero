import { describe, expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { CompiledIcon } from '../lib/compiler-contracts';
import {
  RuntimeIconRenderer,
  resolveTransitionPlan,
  triggerAnimateEffect,
} from '../lib/runtime-sdk';
import compiledIconFixture from './fixtures/compiler-contracts/compiled-icon.json';

function makeIcon(): CompiledIcon {
  return structuredClone(compiledIconFixture) as unknown as CompiledIcon;
}

describe('runtime svg renderer', () => {
  test('renders layers in array order', () => {
    const icon = makeIcon();
    const layers = icon.variants['24'].states.default.modes.monochrome.layers;
    layers.push({
      ...layers[0]!,
      id: 'after',
      path: { d: 'M1 1 L2 2' },
    });

    const svg = renderToStaticMarkup(<RuntimeIconRenderer icon={icon} size={24} />);
    const first = svg.indexOf('d="M8 5l8 7-8 7"');
    const second = svg.indexOf('d="M1 1 L2 2"');
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(-1);
    expect(first).toBeLessThan(second);
  });

  test('palette mode applies role overrides', () => {
    const icon = makeIcon();
    const svg = renderToStaticMarkup(
      <RuntimeIconRenderer
        icon={icon}
        renderingMode="palette"
        paletteColors={{ primary: '#ff00ff' }}
      />,
    );

    expect(svg).toContain('fill="#ff00ff"');
  });

  test('state switching resolves and affects output', () => {
    const icon = makeIcon();
    icon.variants['24'].states.active = structuredClone(icon.variants['24'].states.default);
    icon.variants['24'].states.active.modes.monochrome.layers[0]!.path.d = 'M0 0 L1 1';

    const svgDefault = renderToStaticMarkup(<RuntimeIconRenderer icon={icon} state="default" />);
    const svgActive = renderToStaticMarkup(<RuntimeIconRenderer icon={icon} state="active" />);

    expect(svgDefault).not.toContain('M0 0 L1 1');
    expect(svgActive).toContain('M0 0 L1 1');
  });

  test('transition plan snaps without transition and uses compiled transition when enabled', () => {
    const icon = makeIcon();

    const snap = resolveTransitionPlan(icon, 'default', 'active', false);
    expect(snap.mode).toBe('snap');

    const planned = resolveTransitionPlan(icon, 'default', 'active', true);
    expect(planned.mode).toBe('transition');
    if (planned.mode === 'transition') {
      expect(planned.transition.from).toBe('default');
      expect(planned.transition.to).toBe('active');
    }
  });

  test('effect trigger plumbing dispatches through driver', () => {
    const icon = makeIcon();
    const calls: string[] = [];

    const triggered = triggerAnimateEffect(icon, 'pulse', 'default', 'loop', {
      trigger(effect) {
        calls.push(effect.kind);
      },
    });

    expect(triggered).toBeTrue();
    expect(calls).toEqual(['pulse']);
  });

  test('svg snapshot across multiple modes', () => {
    const icon = makeIcon();

    const monochrome = renderToStaticMarkup(
      <RuntimeIconRenderer icon={icon} renderingMode="monochrome" />,
    );
    const palette = renderToStaticMarkup(
      <RuntimeIconRenderer
        icon={icon}
        renderingMode="palette"
        paletteColors={{ primary: '#00ffff' }}
      />,
    );
    const multicolor = renderToStaticMarkup(
      <RuntimeIconRenderer icon={icon} renderingMode="multicolor" />,
    );

    expect({ monochrome, palette, multicolor }).toMatchSnapshot();
  });
});
