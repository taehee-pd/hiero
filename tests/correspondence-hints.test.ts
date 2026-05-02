/**
 * W4-4 acceptance: correspondence hints resolve to numeric pins;
 * malformed addresses are rejected; one-to-one constraint is
 * preserved (conflicts dropped).
 */
import { describe, expect, test } from 'bun:test';

import {
  resolveSubpathPins,
  resolveVertexPins,
  subpathIdFromIndex,
} from '../lib/runtime-core/correspondence-hints';

describe('subpathIdFromIndex / parseSubpathId round-trip', () => {
  test('subpathIdFromIndex produces the canonical address shape', () => {
    expect(subpathIdFromIndex(0)).toBe('subpath:0');
    expect(subpathIdFromIndex(7)).toBe('subpath:7');
  });
});

describe('resolveSubpathPins', () => {
  test('resolves valid pins to numeric indices', () => {
    const pins = resolveSubpathPins(
      { subpath: [['subpath:0', 'subpath:1']], vertex: [] },
      3,
      3,
    );
    expect(pins).toEqual([{ fromIndex: 0, toIndex: 1 }]);
  });

  test('rejects out-of-range pins', () => {
    const pins = resolveSubpathPins(
      { subpath: [['subpath:5', 'subpath:0']], vertex: [] },
      3, // fromIndex 5 is out of range
      3,
    );
    expect(pins).toEqual([]);
  });

  test('rejects malformed addresses', () => {
    const pins = resolveSubpathPins(
      {
        subpath: [
          ['oops', 'subpath:0'],
          ['subpath:0', 'subpath:not-a-number'],
        ],
        vertex: [],
      },
      3,
      3,
    );
    expect(pins).toEqual([]);
  });

  test('drops conflicting pins (one-to-one constraint)', () => {
    const pins = resolveSubpathPins(
      {
        subpath: [
          ['subpath:0', 'subpath:0'], // OK   → push, seenFrom={0}, seenTo={0}
          ['subpath:0', 'subpath:1'], // DROP, fromIndex already pinned
          ['subpath:1', 'subpath:0'], // DROP, toIndex already pinned
          ['subpath:2', 'subpath:2'], // OK   → push, seenFrom={0,2}, seenTo={0,2}
        ],
        vertex: [],
      },
      3,
      3,
    );
    expect(pins).toEqual([
      { fromIndex: 0, toIndex: 0 },
      { fromIndex: 2, toIndex: 2 },
    ]);
  });
});

describe('resolveVertexPins', () => {
  test('resolves vertex pins with valid subpath addressing', () => {
    const pins = resolveVertexPins(
      {
        subpath: [],
        vertex: [
          [
            { subpathId: 'subpath:0', vertexIndex: 3 },
            { subpathId: 'subpath:1', vertexIndex: 5 },
          ],
        ],
      },
      2,
      3,
    );
    expect(pins.length).toBe(1);
    expect(pins[0]!.fromAddr.vertexIndex).toBe(3);
    expect(pins[0]!.toAddr.vertexIndex).toBe(5);
  });

  test('rejects vertex pins with non-finite vertexIndex', () => {
    const pins = resolveVertexPins(
      {
        subpath: [],
        vertex: [
          [
            { subpathId: 'subpath:0', vertexIndex: Number.NaN },
            { subpathId: 'subpath:0', vertexIndex: 0 },
          ],
        ],
      },
      1,
      1,
    );
    expect(pins).toEqual([]);
  });
});
