import { describe, expect, test } from 'bun:test';
import {
  NodeIndexCounter,
  buildPathNode,
  buildRectNode,
  buildCircleNode,
  buildEllipseNode,
  buildLineNode,
  buildPolylineNode,
  buildPolygonNode,
  buildGroupNode,
  serializeNormalizedIcon,
  deserializeNormalizedIcon,
  validateNormalizedIcon,
  validateNormalizedNode,
  type NormalizedIcon,
  type NormalizedNode,
} from '../lib/import/normalized-ir';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIcon(nodes: NormalizedNode[], overrides?: Partial<NormalizedIcon>): NormalizedIcon {
  return {
    name: 'Test Icon',
    tags: ['test'],
    viewBox: [0, 0, 24, 24] as [number, number, number, number],
    nodes,
    warnings: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// NodeIndexCounter
// ---------------------------------------------------------------------------

describe('NodeIndexCounter', () => {
  test('produces sequential indices starting from 0', () => {
    const counter = new NodeIndexCounter();
    expect(counter.next()).toBe(0);
    expect(counter.next()).toBe(1);
    expect(counter.next()).toBe(2);
    expect(counter.count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Builders — structural validity
// ---------------------------------------------------------------------------

describe('Node builders', () => {
  test('buildPathNode produces a valid path node', () => {
    const node = buildPathNode({ d: 'M0 0 L10 10' }, 0);
    expect(node.kind).toBe('path');
    expect(node.geometry).toEqual({ kind: 'path', d: 'M0 0 L10 10' });
    expect(node.index).toBe(0);
    expect(node.sourceMeta.sourceTag).toBe('path');
    expect(node.sourceMeta.unsupported).toEqual([]);
    expect(validateNormalizedNode(node)).toEqual([]);
  });

  test('buildPathNode preserves fillRule', () => {
    const node = buildPathNode({ d: 'M0 0 L10 10 Z', fillRule: 'evenodd' }, 0);
    expect(node.geometry).toEqual({
      kind: 'path',
      d: 'M0 0 L10 10 Z',
      fillRule: 'evenodd',
    });
  });

  test('buildRectNode produces a valid rect node', () => {
    const node = buildRectNode({ x: 1, y: 2, width: 10, height: 8, rx: 2 }, 1);
    expect(node.kind).toBe('rect');
    expect(node.geometry).toEqual({
      kind: 'rect',
      x: 1,
      y: 2,
      width: 10,
      height: 8,
      rx: 2,
    });
    expect(node.sourceMeta.sourceTag).toBe('rect');
    expect(validateNormalizedNode(node)).toEqual([]);
  });

  test('buildCircleNode produces a valid circle node', () => {
    const node = buildCircleNode({ cx: 12, cy: 12, r: 10 }, 2);
    expect(node.kind).toBe('circle');
    expect(node.geometry).toEqual({ kind: 'circle', cx: 12, cy: 12, r: 10 });
    expect(validateNormalizedNode(node)).toEqual([]);
  });

  test('buildEllipseNode produces a valid ellipse node', () => {
    const node = buildEllipseNode({ cx: 12, cy: 6, rx: 8, ry: 4 }, 3);
    expect(node.kind).toBe('ellipse');
    expect(node.geometry).toEqual({ kind: 'ellipse', cx: 12, cy: 6, rx: 8, ry: 4 });
    expect(validateNormalizedNode(node)).toEqual([]);
  });

  test('buildLineNode produces a valid line node', () => {
    const node = buildLineNode({ x1: 0, y1: 0, x2: 24, y2: 24 }, 4);
    expect(node.kind).toBe('line');
    expect(node.geometry).toEqual({ kind: 'line', x1: 0, y1: 0, x2: 24, y2: 24 });
    expect(validateNormalizedNode(node)).toEqual([]);
  });

  test('buildPolylineNode produces a valid polyline node', () => {
    const node = buildPolylineNode({ points: [0, 0, 10, 5, 20, 0] }, 5);
    expect(node.kind).toBe('polyline');
    expect(node.geometry).toEqual({
      kind: 'polyline',
      points: [0, 0, 10, 5, 20, 0],
    });
    expect(validateNormalizedNode(node)).toEqual([]);
  });

  test('buildPolygonNode produces a valid polygon node', () => {
    const node = buildPolygonNode({ points: [0, 0, 10, 5, 20, 0] }, 6);
    expect(node.kind).toBe('polygon');
    expect(node.geometry).toEqual({
      kind: 'polygon',
      points: [0, 0, 10, 5, 20, 0],
    });
    expect(validateNormalizedNode(node)).toEqual([]);
  });

  test('buildGroupNode produces a valid group with children', () => {
    const child = buildPathNode({ d: 'M0 0 L5 5' }, 1);
    const group = buildGroupNode([child], 0);
    expect(group.kind).toBe('group');
    expect(group.geometry).toEqual({ kind: 'group' });
    expect(group.children).toHaveLength(1);
    expect(group.children![0]).toBe(child);
    expect(validateNormalizedNode(group)).toEqual([]);
  });

  test('builders propagate style, transform, and source metadata', () => {
    const node = buildPathNode({ d: 'M0 0 L10 10' }, 0, {
      style: {
        fill: { mode: 'currentColor' },
        stroke: { mode: 'fixed', value: '#ff0000' },
        strokeWidth: 2,
        lineCap: 'round',
        lineJoin: 'round',
      },
      transform: { x: 5, y: 10, rotate: 45 },
      sourceNodeId: 'arrow-path',
      sourceClassName: 'icon-stroke',
      originalTransform: 'translate(5, 10) rotate(45)',
      unsupported: [{ kind: 'filter', value: 'url(#blur)' }],
    });

    expect(node.style.fill).toEqual({ mode: 'currentColor' });
    expect(node.style.strokeWidth).toBe(2);
    expect(node.transform).toEqual({ x: 5, y: 10, rotate: 45 });
    expect(node.sourceMeta.sourceNodeId).toBe('arrow-path');
    expect(node.sourceMeta.sourceClassName).toBe('icon-stroke');
    expect(node.sourceMeta.originalTransform).toBe('translate(5, 10) rotate(45)');
    expect(node.sourceMeta.unsupported).toEqual([{ kind: 'filter', value: 'url(#blur)' }]);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('validateNormalizedIcon', () => {
  test('valid icon passes validation', () => {
    const icon = makeIcon([
      buildPathNode({ d: 'M0 0 L10 10' }, 0),
      buildRectNode({ x: 0, y: 0, width: 24, height: 24 }, 1),
    ]);
    expect(validateNormalizedIcon(icon)).toEqual([]);
  });

  test('detects missing name', () => {
    const icon = makeIcon([], { name: '' });
    const errors = validateNormalizedIcon(icon);
    expect(errors.some((e) => e.includes('name'))).toBe(true);
  });

  test('detects invalid viewBox', () => {
    const icon = makeIcon([], { viewBox: [0, 0, 24] as unknown as [number, number, number, number] });
    const errors = validateNormalizedIcon(icon);
    expect(errors.some((e) => e.includes('viewBox'))).toBe(true);
  });

  test('detects index mismatch', () => {
    const node = buildPathNode({ d: 'M0 0 L10 10' }, 5); // index 5 at position 0
    const icon = makeIcon([node]);
    const errors = validateNormalizedIcon(icon);
    expect(errors.some((e) => e.includes('index') && e.includes('expected 0'))).toBe(true);
  });

  test('detects geometry.kind mismatch with node kind', () => {
    const node = buildPathNode({ d: 'M0 0 L10 10' }, 0);
    // Mutate to create inconsistency
    (node.geometry as { kind: string }).kind = 'rect';
    const errors = validateNormalizedNode(node);
    expect(errors.some((e) => e.includes('geometry.kind') && e.includes('must match'))).toBe(true);
  });

  test('detects children on non-group node', () => {
    const node = buildPathNode({ d: 'M0 0' }, 0);
    (node as { children?: unknown[] }).children = [];
    const errors = validateNormalizedNode(node);
    expect(errors.some((e) => e.includes('only group'))).toBe(true);
  });

  test('validates geometry fields per kind', () => {
    // Path with empty d
    const pathNode = buildPathNode({ d: '' }, 0);
    expect(validateNormalizedNode(pathNode).some((e) => e.includes('.d:'))).toBe(true);

    // Rect missing width
    const badRect: NormalizedNode = {
      index: 0,
      kind: 'rect',
      geometry: { kind: 'rect', x: 0, y: 0 } as never,
      style: {},
      sourceMeta: { sourceTag: 'rect', unsupported: [] },
    };
    const rectErrors = validateNormalizedNode(badRect);
    expect(rectErrors.some((e) => e.includes('width'))).toBe(true);
    expect(rectErrors.some((e) => e.includes('height'))).toBe(true);

    // Polyline with odd number of points
    const badPolyline: NormalizedNode = {
      index: 0,
      kind: 'polyline',
      geometry: { kind: 'polyline', points: [1, 2, 3] },
      style: {},
      sourceMeta: { sourceTag: 'polyline', unsupported: [] },
    };
    const polyErrors = validateNormalizedNode(badPolyline);
    expect(polyErrors.some((e) => e.includes('even number'))).toBe(true);
  });

  test('validates nested group children', () => {
    const badChild: NormalizedNode = {
      index: 0,
      kind: 'path',
      geometry: { kind: 'path', d: '' },
      style: {},
      sourceMeta: { sourceTag: 'path', unsupported: [] },
    };
    const group = buildGroupNode([badChild], 0);
    const errors = validateNormalizedNode(group);
    expect(errors.some((e) => e.includes('children[0]') && e.includes('.d:'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Serialization — determinism
// ---------------------------------------------------------------------------

describe('serializeNormalizedIcon', () => {
  test('produces deterministic output for the same input', () => {
    const icon = makeIcon([
      buildPathNode({ d: 'M0 0 L10 10' }, 0, {
        style: {
          stroke: { mode: 'fixed', value: '#000' },
          fill: { mode: 'currentColor' },
          strokeWidth: 2,
        },
        sourceNodeId: 'p1',
      }),
      buildCircleNode({ cx: 12, cy: 12, r: 5 }, 1, {
        style: { fill: { mode: 'fixed', value: '#f00' } },
      }),
    ]);

    const json1 = serializeNormalizedIcon(icon);
    const json2 = serializeNormalizedIcon(icon);
    expect(json1).toBe(json2);
  });

  test('key order is stable regardless of object construction order', () => {
    // Build two identical icons with properties added in different order
    const nodeA: NormalizedNode = {
      index: 0,
      kind: 'path',
      geometry: { kind: 'path', d: 'M0 0' },
      style: { fill: { mode: 'currentColor' } },
      sourceMeta: { sourceTag: 'path', unsupported: [] },
    };

    const nodeB: NormalizedNode = {
      sourceMeta: { unsupported: [], sourceTag: 'path' },
      style: { fill: { mode: 'currentColor' } },
      geometry: { kind: 'path', d: 'M0 0' },
      kind: 'path',
      index: 0,
    };

    const iconA = makeIcon([nodeA]);
    const iconB: NormalizedIcon = {
      warnings: [],
      nodes: [nodeB],
      viewBox: [0, 0, 24, 24],
      tags: ['test'],
      name: 'Test Icon',
    };

    const jsonA = serializeNormalizedIcon(iconA);
    const jsonB = serializeNormalizedIcon(iconB);
    expect(jsonA).toBe(jsonB);
  });

  test('roundtrips through serialize → deserialize', () => {
    const icon = makeIcon([
      buildPathNode({ d: 'M0 0 L24 24', fillRule: 'evenodd' }, 0, {
        style: {
          fill: { mode: 'fixed', value: '#333' },
          strokeWidth: 1.5,
          visible: false,
        },
        transform: { x: 2, y: 3, rotate: 90 },
        unsupported: [{ kind: 'filter', value: 'blur(2px)' }],
      }),
      buildRectNode({ x: 0, y: 0, width: 10, height: 10, rx: 2, ry: 2 }, 1),
    ], {
      provenance: {
        adapterId: 'lucide',
        sourceLibrary: 'Lucide',
        sourceVersion: '0.460.0',
        sourceIconId: 'arrow-right',
        sourceLicense: 'ISC',
        importedAt: '2026-03-17T00:00:00.000Z',
      },
      warnings: [
        { code: 'unsupported_feature_dropped', message: 'Filter effects are not supported', severity: 'warning' },
      ],
    });

    const json = serializeNormalizedIcon(icon);
    const restored = deserializeNormalizedIcon(json);

    // Structural equality
    expect(restored.name).toBe(icon.name);
    expect(restored.tags).toEqual(icon.tags);
    expect(restored.viewBox).toEqual(icon.viewBox);
    expect(restored.nodes).toHaveLength(2);
    expect(restored.nodes[0]!.kind).toBe('path');
    expect(restored.nodes[1]!.kind).toBe('rect');
    expect(restored.provenance?.adapterId).toBe('lucide');
    expect(restored.warnings).toHaveLength(1);

    // Validate the restored icon
    expect(validateNormalizedIcon(restored)).toEqual([]);
  });

  test('icon-level keys appear in canonical order', () => {
    const icon = makeIcon([buildPathNode({ d: 'M0 0' }, 0)]);
    const json = serializeNormalizedIcon(icon);
    const parsed = JSON.parse(json);
    const keys = Object.keys(parsed);

    // name should come before tags, tags before viewBox, etc.
    expect(keys.indexOf('name')).toBeLessThan(keys.indexOf('tags'));
    expect(keys.indexOf('tags')).toBeLessThan(keys.indexOf('viewBox'));
    expect(keys.indexOf('viewBox')).toBeLessThan(keys.indexOf('nodes'));
    expect(keys.indexOf('nodes')).toBeLessThan(keys.indexOf('warnings'));
  });

  test('node-level keys appear in canonical order', () => {
    const icon = makeIcon([
      buildPathNode({ d: 'M0 0' }, 0, {
        transform: { x: 1 },
        style: { fill: { mode: 'currentColor' } },
      }),
    ]);
    const json = serializeNormalizedIcon(icon);
    const parsed = JSON.parse(json);
    const nodeKeys = Object.keys(parsed.nodes[0]);

    expect(nodeKeys.indexOf('index')).toBeLessThan(nodeKeys.indexOf('kind'));
    expect(nodeKeys.indexOf('kind')).toBeLessThan(nodeKeys.indexOf('geometry'));
    expect(nodeKeys.indexOf('geometry')).toBeLessThan(nodeKeys.indexOf('style'));
    expect(nodeKeys.indexOf('style')).toBeLessThan(nodeKeys.indexOf('transform'));
    expect(nodeKeys.indexOf('transform')).toBeLessThan(nodeKeys.indexOf('sourceMeta'));
  });
});

// ---------------------------------------------------------------------------
// Deterministic ordering
// ---------------------------------------------------------------------------

describe('Deterministic ordering', () => {
  test('nodes array preserves insertion order via index', () => {
    const counter = new NodeIndexCounter();
    const nodes = [
      buildPathNode({ d: 'M0 0 L5 5' }, counter.next()),
      buildCircleNode({ cx: 12, cy: 12, r: 3 }, counter.next()),
      buildRectNode({ x: 0, y: 0, width: 24, height: 24 }, counter.next()),
    ];

    expect(nodes[0]!.index).toBe(0);
    expect(nodes[1]!.index).toBe(1);
    expect(nodes[2]!.index).toBe(2);

    const icon = makeIcon(nodes);
    expect(validateNormalizedIcon(icon)).toEqual([]);
  });

  test('all seven shape kinds plus group are representable', () => {
    const counter = new NodeIndexCounter();
    const child = buildPathNode({ d: 'M0 0' }, counter.next());
    const nodes: NormalizedNode[] = [
      child,
      buildRectNode({ x: 0, y: 0, width: 10, height: 10 }, counter.next()),
      buildCircleNode({ cx: 5, cy: 5, r: 3 }, counter.next()),
      buildEllipseNode({ cx: 5, cy: 5, rx: 4, ry: 2 }, counter.next()),
      buildLineNode({ x1: 0, y1: 0, x2: 10, y2: 10 }, counter.next()),
      buildPolylineNode({ points: [0, 0, 5, 5, 10, 0] }, counter.next()),
      buildPolygonNode({ points: [0, 0, 10, 0, 5, 10] }, counter.next()),
      buildGroupNode([buildPathNode({ d: 'M1 1' }, counter.next())], counter.next()),
    ];

    const icon = makeIcon(nodes);
    // Only top-level indices need to be sequential — group child indices
    // are separate, so we validate top-level only
    const topLevelErrors = validateNormalizedIcon({
      ...icon,
      nodes: nodes.map((n, i) => ({ ...n, index: i })),
    });
    expect(topLevelErrors).toEqual([]);
    expect(counter.count).toBe(9); // 7 shapes + 1 group child + 1 group
  });
});
