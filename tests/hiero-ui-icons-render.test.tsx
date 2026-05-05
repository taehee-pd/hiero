import './setup/happy-dom';

import { describe, expect, test, afterEach } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render } from '@testing-library/react';

import { Icon } from '@/packages/hiero-ui-icons/src';
import { HieroIconServer } from '@/lib/runtime-react/HieroIconServer';
import type { Icon as IconSchema } from '@/lib/schema/types';

afterEach(() => {
  cleanup();
});

function makeTestIcon(): IconSchema {
  return {
    id: 'plus',
    name: 'plus',
    variants: {
      'v-16': {
        id: 'v-16',
        size: 16,
        viewBox: [0, 0, 24, 24] as [number, number, number, number],
        layers: {
          h: {
            id: 'h',
            path: { d: 'M5 12 L19 12' },
            style: { stroke: { mode: 'currentColor' }, strokeWidth: 2 },
          },
        },
      },
    },
  };
}

describe('Icon wrapper', () => {
  test('renders an svg for a registered name', () => {
    const { container } = render(<Icon name="plus" aria-label="Add" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  test('marks wrapper/runtime nodes for button-safe icon sizing', () => {
    const { container } = render(<Icon name="eye" />);
    expect(container.querySelector('[data-hiero-ui-icon="eye"]')).not.toBeNull();
    expect(container.querySelector('[data-hiero-runtime-icon]')).not.toBeNull();
  });

  test('wrapper span carries the a11y label; inner svg stays decorative', () => {
    const { container } = render(<Icon name="plus" aria-label="Add" />);
    const span = container.querySelector('span');
    expect(span?.getAttribute('role')).toBe('img');
    expect(span?.getAttribute('aria-label')).toBe('Add');
    // Inner SVG should not re-announce the same label. We assert the
    // rendered tree has exactly one element with aria-label="Add".
    const labelled = container.querySelectorAll('[aria-label="Add"]');
    expect(labelled.length).toBe(1);
  });

  test('omitting aria-label marks the wrapper aria-hidden', () => {
    const { container } = render(<Icon name="plus" />);
    const span = container.querySelector('span');
    expect(span?.getAttribute('aria-hidden')).toBe('true');
    expect(span?.getAttribute('role')).toBeNull();
  });

  test('applies scaleX(-1) when dir=rtl and the icon is in rtlMirrorIcons', () => {
    const { container } = render(<Icon name="chevron-left" dir="rtl" />);
    const span = container.querySelector('span');
    expect(span?.getAttribute('style')).toContain('scaleX(-1)');
  });

  test('does NOT mirror when dir=rtl but icon is not in rtlMirrorIcons', () => {
    const { container } = render(<Icon name="plus" dir="rtl" />);
    const span = container.querySelector('span');
    expect(span?.getAttribute('style') ?? '').not.toContain('scaleX(-1)');
  });

  test('does NOT mirror in ltr mode even for directional icons', () => {
    const { container } = render(<Icon name="chevron-left" dir="ltr" />);
    const span = container.querySelector('span');
    expect(span?.getAttribute('style') ?? '').not.toContain('scaleX(-1)');
  });

  test('composes caller transform with the RTL mirror', () => {
    const { container } = render(
      <Icon name="chevron-left" dir="rtl" style={{ transform: 'rotate(45deg)' }} />,
    );
    const span = container.querySelector('span');
    const style = span?.getAttribute('style') ?? '';
    expect(style).toContain('rotate(45deg)');
    expect(style).toContain('scaleX(-1)');
  });

  test('SSR renders without throwing and without mirror (first paint)', () => {
    // Before hydration, the wrapper cannot know the ambient dir, so
    // mirror is intentionally off. Hydration runs useEffect and
    // flips it on the client when dir="rtl" is on documentElement.
    const html = renderToStaticMarkup(<Icon name="chevron-left" aria-label="Back" />);
    expect(html).toContain('<span');
    expect(html).not.toContain('scaleX(-1)');
  });
});

describe('HieroIconServer', () => {
  test('SSR emits static SVG without dangerous hydration artifacts', () => {
    const html = renderToStaticMarkup(
      <HieroIconServer icon={makeTestIcon()} size={16} label="Add" />,
    );
    expect(html).toContain('<svg');
    expect(html).toContain('M5 12 L19 12');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Add"');
  });

  test('passes className through to the wrapper span', () => {
    const html = renderToStaticMarkup(
      <HieroIconServer icon={makeTestIcon()} className="text-blue-500" />,
    );
    expect(html).toContain('class="text-blue-500"');
  });

  test('marks decorative icons as aria-hidden', () => {
    const html = renderToStaticMarkup(<HieroIconServer icon={makeTestIcon()} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="img"');
  });
});
