import { describe, expect, test } from 'bun:test';

import type { Icon, State, Transition } from '../lib/schema';
import { strictMorph } from '../lib/runtime-core';
import { DomRenderer } from '../lib/runtime-dom';

class MockStyle {
  [key: string]: unknown;

  removeProperty(name: string): void {
    delete this[toCamelCase(name)];
  }
}

class MockElement {
  readonly tagName: string;
  readonly ownerDocument: MockDocument;
  readonly style = new MockStyle();
  readonly childNodes: MockElement[] = [];
  private readonly attributes = new Map<string, string>();
  parentNode: MockElement | null = null;

  constructor(tagName: string, ownerDocument: MockDocument) {
    this.tagName = tagName.toLowerCase();
    this.ownerDocument = ownerDocument;
  }

  get firstChild(): MockElement | null {
    return this.childNodes[0] ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  appendChild<T extends MockElement>(child: T): T {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  insertBefore<T extends MockElement>(child: T, before: MockElement | null): T {
    child.parentNode = this;
    if (!before) {
      this.childNodes.push(child);
      return child;
    }

    const index = this.childNodes.indexOf(before);
    if (index === -1) {
      this.childNodes.push(child);
      return child;
    }

    this.childNodes.splice(index, 0, child);
    return child;
  }

  replaceChildren(...children: MockElement[]): void {
    for (const child of this.childNodes) {
      child.parentNode = null;
    }
    this.childNodes.length = 0;
    for (const child of children) {
      this.appendChild(child);
    }
  }

  remove(): void {
    if (!this.parentNode) {
      return;
    }

    const index = this.parentNode.childNodes.indexOf(this);
    if (index >= 0) {
      this.parentNode.childNodes.splice(index, 1);
    }
    this.parentNode = null;
  }

  querySelector<T extends MockElement = MockElement>(selector: string): T | null {
    return (this.querySelectorAll(selector)[0] as T | undefined) ?? null;
  }

  querySelectorAll<T extends MockElement = MockElement>(selector: string): T[] {
    const parts = selector.trim().split(/\s+/);
    let current: MockElement[] = [this];

    for (const part of parts) {
      const next: MockElement[] = [];
      for (const root of current) {
        next.push(...findMatches(root, part));
      }
      current = next;
    }

    return current as T[];
  }
}

class MockDocument {
  createElement(tagName: string): MockElement {
    return new MockElement(tagName, this);
  }

  createElementNS(_namespace: string, tagName: string): MockElement {
    return new MockElement(tagName, this);
  }
}

function createMockContainer(): HTMLElement {
  const doc = new MockDocument();
  return doc.createElement('div') as unknown as HTMLElement;
}

function findMatches(root: MockElement, selector: string): MockElement[] {
  const matches: MockElement[] = [];
  for (const child of root.childNodes) {
    if (matchesSelector(child, selector)) {
      matches.push(child);
    }
    matches.push(...findMatches(child, selector));
  }
  return matches;
}

function matchesSelector(element: MockElement, selector: string): boolean {
  const match = selector.match(
    /^([a-zA-Z]+)?(?:#([\w-]+))?(?:\[([\w-]+)(?:="([^"]*)")?\])?$/,
  );
  if (!match) {
    return false;
  }

  const [, tag, id, attr, value] = match;
  if (tag && element.tagName !== tag.toLowerCase()) {
    return false;
  }
  if (id && element.getAttribute('id') !== id) {
    return false;
  }
  if (attr) {
    const attrValue = element.getAttribute(attr);
    if (attrValue === null) {
      return false;
    }
    if (value !== undefined && attrValue !== value) {
      return false;
    }
  }
  return true;
}

function toCamelCase(name: string): string {
  return name.replace(/-([a-z])/g, (_match, char: string) => char.toUpperCase());
}

function makeIcon(): Icon {
  const idleState: State = {
    id: 'idle',
    layers: {
      accent: {
        id: 'accent',
        path: { d: 'M4 4 L20 20' },
        style: {
          stroke: { mode: 'fixed', value: '#123456' },
          strokeWidth: 2,
          strokeOpacity: 0.7,
          lineCap: 'round',
          lineJoin: 'bevel',
        },
      },
      base: {
        id: 'base',
        path: { d: 'M2 2 H22 V22 H2 Z', fillRule: 'evenodd' },
        style: {
          fill: { mode: 'fixed', value: '#ff0000' },
          fillOpacity: 0.8,
          stroke: { mode: 'currentColor' },
          strokeWidth: 1,
          lineCap: 'round',
          lineJoin: 'round',
        },
        transform: { x: 2, y: 3, rotate: 15, scaleX: 1.5, scaleY: 1.25 },
      },
    },
  };

  const activeState: State = {
    id: 'active',
    layers: {
      badge: {
        id: 'badge',
        path: { d: 'M12 4 L20 20 H4 Z' },
        style: {
          fill: { mode: 'linearGradient', angle: 90, stops: [{ offset: 0, color: '#000' }] },
          fillOpacity: 1,
        },
      },
    },
  };

  const trackTransition: Transition = {
    id: 'idle-active',
    from: 'idle',
    to: 'active',
    strategy: 'track',
    durationMs: 120,
    easing: 'linear',
    layerBindings: [
      {
        fromLayerId: 'base',
        toLayerId: 'base',
        tracks: [
          { property: 'opacity', keyframes: [0, 1] },
          { property: 'rotate', keyframes: [0, 30] },
          { property: 'translateX', keyframes: [0, 10] },
          { property: 'translateY', keyframes: [0, 5] },
          { property: 'scale', keyframes: [1, 1.2] },
          { property: 'pathLength', keyframes: [0, 1] },
        ],
      },
    ],
  };

  return {
    id: 'icon-dom',
    name: 'DOM Runtime Icon',
    variants: {
      v24: {
        id: 'v24',
        size: 24,
        viewBox: [0, 0, 24, 24],
        defaultState: 'idle',
        states: {
          idle: idleState,
          active: activeState,
        },
      },
    },
    transitions: {
      [trackTransition.id]: trackTransition,
    },
  };
}

describe('runtime dom renderer', () => {
  test('mount renders the expected svg structure', () => {
    const container = createMockContainer();
    const renderer = new DomRenderer(container, makeIcon());

    renderer.mount('v24');

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg?.getAttribute('width')).toBe('24');
    expect(svg?.getAttribute('height')).toBe('24');

    const paths = container.querySelectorAll('path[data-layer-id]');
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute('data-layer-id')).toBe('accent');
    expect(paths[1]?.getAttribute('data-layer-id')).toBe('base');
    expect(paths[1]?.getAttribute('fill')).toBe('#ff0000');
    expect(paths[1]?.getAttribute('stroke')).toBe('currentColor');
    expect(paths[1]?.getAttribute('fill-opacity')).toBe('0.8');
    expect(paths[1]?.getAttribute('stroke-width')).toBe('1');
    expect(paths[1]?.getAttribute('transform')).toBe(
      'translate(2, 3) rotate(15) scale(1.5, 1.25)',
    );

    renderer.unmount();
  });

  test('applyFrame writes animated transform, opacity, and path length styles', () => {
    const container = createMockContainer();
    const renderer = new DomRenderer(container, makeIcon());

    renderer.mount('v24');
    renderer.applyFrame('idle', 0.5, {
      base: {
        opacity: 0.4,
        rotate: 12,
        translateX: 8,
        translateY: 4,
        scale: 1.1,
        pathLength: 0.25,
      },
    });

    const path = container.querySelector<SVGPathElement>('path[data-layer-id="base"]');
    expect(path?.style.opacity).toBe('0.4');
    expect(path?.style.transform).toBe(
      'translate(2, 3) rotate(15) scale(1.5, 1.25) translate(8px, 4px) rotate(12deg) scale(1.1)',
    );
    expect(path?.style.strokeDasharray).toBe(String(path?.getAttribute('d')?.length ?? 1));
    expect(path?.style.strokeDashoffset).toBe(String((path?.getAttribute('d')?.length ?? 1) * 0.75));

    renderer.unmount();
  });

  test('applyFrame updates path geometry when a morph binding is active', () => {
    const container = createMockContainer();
    const icon = makeIcon();
    const renderer = new DomRenderer(container, icon);
    const fromLayer = icon.variants.v24.states.idle!.layers.base!;
    const toLayer = {
      ...fromLayer,
      path: { d: 'M4 4 H20 V20 H4 Z', fillRule: 'evenodd' as const },
    };

    renderer.mount('v24');
    renderer.applyFrame(
      'active',
      0.5,
      {},
      {
        strategy: 'strictMorph',
        durationMs: 120,
        easing: 'linear',
        layerBindings: [
          {
            fromLayer,
            toLayer,
            tracks: [],
            morph: strictMorph(fromLayer.path!.d, toLayer.path.d),
          },
        ],
      },
    );

    const path = container.querySelector<SVGPathElement>('path[data-layer-id="base"]');
    expect(path?.getAttribute('d')).toBe('M3 3 H21 V21 H3 Z');

    renderer.unmount();
  });

  test('applyFrame crossfades source and target paths when morph fallback is requested', () => {
    const container = createMockContainer();
    const icon = makeIcon();
    const renderer = new DomRenderer(container, icon);
    const fromLayer = icon.variants.v24.states.idle!.layers.base!;
    const toLayer = icon.variants.v24.states.active!.layers.badge!;

    renderer.mount('v24');
    renderer.applyFrame(
      'active',
      0.25,
      {},
      {
        strategy: 'bestGuessMorph',
        durationMs: 120,
        easing: 'linear',
        layerBindings: [
          {
            fromLayer,
            toLayer,
            tracks: [],
            fallback: 'fade-through',
          },
        ],
      },
    );

    const source = container.querySelector<SVGPathElement>('path[data-layer-id="base"]');
    const target = Array.from(
      container.querySelectorAll<SVGPathElement>('path[data-layer-id="badge"]'),
    ).find((element) => element.getAttribute('data-transition-role') === 'to');
    expect(source?.style.opacity).toBe('0.75');
    expect(target?.style.opacity).toBe('0.25');

    renderer.unmount();
  });

  test('setState swaps rendered layers to the requested state', () => {
    const container = createMockContainer();
    const renderer = new DomRenderer(container, makeIcon());

    renderer.mount('v24');
    renderer.setState('active');

    const idleLayer = container.querySelector('path[data-layer-id="base"]');
    const activeLayer = container.querySelector('path[data-layer-id="badge"]');
    const gradient = container.querySelector('defs linearGradient#gradient-badge-fill');

    expect(idleLayer).toBeNull();
    expect(activeLayer).not.toBeNull();
    expect(activeLayer?.getAttribute('d')).toBe('M12 4 L20 20 H4 Z');
    expect(activeLayer?.getAttribute('fill')).toBe('url(#gradient-badge-fill)');
    expect(gradient).not.toBeNull();

    renderer.unmount();
  });
});
