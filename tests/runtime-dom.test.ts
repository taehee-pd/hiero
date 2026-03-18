import { describe, expect, test } from 'bun:test';

import type { Icon, State, Transition } from '../lib/schema';
import { strictMorph, type InterpolatedValues } from '../lib/runtime-core';
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
    // Match real DOM: if already attached, detach from current parent first (move semantics)
    if (child.parentNode) {
      child.remove();
    }
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

function makeSharedLayerIcon(): Icon {
  const stateA: State = {
    id: 'state-a',
    layers: {
      bg: { id: 'bg', path: { d: 'M0 0H24V24H0Z' }, style: { fill: { mode: 'fixed', value: '#fff' } } },
      icon: { id: 'icon', path: { d: 'M6 6L18 18' }, style: { stroke: { mode: 'fixed', value: '#000' } } },
    },
  };
  const stateB: State = {
    id: 'state-b',
    layers: {
      bg: { id: 'bg', path: { d: 'M1 1H23V23H1Z' }, style: { fill: { mode: 'fixed', value: '#eee' } } },
      badge: { id: 'badge', path: { d: 'M12 2L22 20H2Z' }, style: { fill: { mode: 'fixed', value: '#f00' } } },
    },
  };
  return {
    id: 'icon-shared',
    name: 'Shared Layer Icon',
    variants: {
      v24: {
        id: 'v24',
        size: 24,
        viewBox: [0, 0, 24, 24],
        defaultState: 'state-a',
        states: { 'state-a': stateA, 'state-b': stateB },
      },
    },
    transitions: {},
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
    // Transforms are now applied as CSS style (not SVG attribute)
    expect(paths[1]?.getAttribute('transform')).toBeNull();
    expect((paths[1] as unknown as MockElement)?.style.transform).toBe(
      'translate(2px, 3px) rotate(15deg) scale(1.5, 1.25)',
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
    // Animated transform values replace the base transform (not compose)
    // to prevent double-transforms when animating from a transformed state
    expect(path?.style.transform).toBe(
      'translate(8px, 4px) rotate(12deg) scale(1.1)',
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
        diagnostics: [],
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
        diagnostics: [],
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

  test('setState diff-updates shared layers in place rather than rebuilding', () => {
    const icon = makeSharedLayerIcon();
    const container = createMockContainer();
    const renderer = new DomRenderer(container, icon);

    renderer.mount('v24');

    // Capture references to elements in initial state
    const bgBefore = container.querySelector('path[data-layer-id="bg"]') as MockElement | null;
    expect(bgBefore).not.toBeNull();
    expect(bgBefore?.getAttribute('d')).toBe('M0 0H24V24H0Z');

    // Switch state — bg exists in both states, icon only in state-a, badge only in state-b
    renderer.setState('state-b');

    const bgAfter = container.querySelector('path[data-layer-id="bg"]') as MockElement | null;
    expect(bgAfter).not.toBeNull();
    // Shared layer should be the SAME element (updated in place)
    expect(bgAfter).toBe(bgBefore);
    // But its d attribute should be updated
    expect(bgAfter?.getAttribute('d')).toBe('M1 1H23V23H1Z');

    // Layer unique to state-a should be removed
    const iconLayer = container.querySelector('path[data-layer-id="icon"]');
    expect(iconLayer).toBeNull();

    // Layer unique to state-b should be created
    const badgeLayer = container.querySelector('path[data-layer-id="badge"]');
    expect(badgeLayer).not.toBeNull();
    expect(badgeLayer?.getAttribute('d')).toBe('M12 2L22 20H2Z');

    // Verify z-order: layers should be sorted by ID (badge < bg)
    const allPaths = container.querySelectorAll('path[data-layer-id]');
    expect(allPaths).toHaveLength(2);
    expect(allPaths[0]?.getAttribute('data-layer-id')).toBe('badge');
    expect(allPaths[1]?.getAttribute('data-layer-id')).toBe('bg');

    renderer.unmount();
  });

  test('setState diff-update maintains correct z-order when inserting layers between existing ones', () => {
    // State A has layers [a, c]; State B has [a, b, c]
    // Layer 'b' must be inserted BETWEEN 'a' and 'c', not appended at end
    const icon: Icon = {
      id: 'icon-zorder',
      name: 'Z-order Icon',
      variants: {
        v24: {
          id: 'v24',
          size: 24,
          viewBox: [0, 0, 24, 24],
          defaultState: 'two-layers',
          states: {
            'two-layers': {
              id: 'two-layers',
              layers: {
                'layer-a': { id: 'layer-a', path: { d: 'M0 0H24V24H0Z' }, style: {} },
                'layer-c': { id: 'layer-c', path: { d: 'M4 4H20V20H4Z' }, style: {} },
              },
            },
            'three-layers': {
              id: 'three-layers',
              layers: {
                'layer-a': { id: 'layer-a', path: { d: 'M0 0H24V24H0Z' }, style: {} },
                'layer-b': { id: 'layer-b', path: { d: 'M2 2H22V22H2Z' }, style: {} },
                'layer-c': { id: 'layer-c', path: { d: 'M4 4H20V20H4Z' }, style: {} },
              },
            },
          },
        },
      },
      transitions: {},
    };

    const container = createMockContainer();
    const renderer = new DomRenderer(container, icon);

    renderer.mount('v24');

    // Initial: [layer-a, layer-c]
    let paths = container.querySelectorAll('path[data-layer-id]');
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute('data-layer-id')).toBe('layer-a');
    expect(paths[1]?.getAttribute('data-layer-id')).toBe('layer-c');

    // Switch to three-layers: [layer-a, layer-b, layer-c]
    renderer.setState('three-layers');

    paths = container.querySelectorAll('path[data-layer-id]');
    expect(paths).toHaveLength(3);
    // layer-b must be between layer-a and layer-c, NOT at the end
    expect(paths[0]?.getAttribute('data-layer-id')).toBe('layer-a');
    expect(paths[1]?.getAttribute('data-layer-id')).toBe('layer-b');
    expect(paths[2]?.getAttribute('data-layer-id')).toBe('layer-c');

    renderer.unmount();
  });

  test('applyFrame applies pathLength-based draw animation', () => {
    const container = createMockContainer();
    const renderer = new DomRenderer(container, makeIcon());

    renderer.mount('v24');

    // Simulate draw animation by passing pathLength values
    const drawValues: InterpolatedValues = {
      accent: { pathLength: 0.5 },
    };

    renderer.applyFrame('idle', 0, drawValues);

    const accent = container.querySelector('path[data-layer-id="accent"]') as MockElement | null;
    expect(accent).not.toBeNull();
    // pathLength 0.5 should set strokeDasharray and strokeDashoffset
    expect(accent?.style.strokeDasharray).toBeDefined();
    expect(accent?.style.strokeDashoffset).toBeDefined();
    // strokeDashoffset should be half the total length (path hidden halfway)
    const dasharray = Number(accent?.style.strokeDasharray);
    const dashoffset = Number(accent?.style.strokeDashoffset);
    expect(dasharray).toBeGreaterThan(0);
    // offset = pathLength * (1 - 0.5) = pathLength * 0.5
    expect(dashoffset).toBeCloseTo(dasharray * 0.5, 1);

    renderer.unmount();
  });

  test('applyFrame applies animated fill and stroke colors', () => {
    const container = createMockContainer();
    const renderer = new DomRenderer(container, makeIcon());

    renderer.mount('v24');
    renderer.applyFrame('idle', 0.5, {
      base: { fill: '#00ff00', stroke: '#0000ff' },
    });

    const base = container.querySelector('path[data-layer-id="base"]') as MockElement | null;
    expect(base?.getAttribute('fill')).toBe('#00ff00');
    expect(base?.getAttribute('stroke')).toBe('#0000ff');

    renderer.unmount();
  });
});
