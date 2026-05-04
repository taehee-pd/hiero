/**
 * W4-7 acceptance: pin lifecycle helpers — create, replace,
 * delete, prune. Pure functions; the canvas drag interaction in a
 * follow-up commit calls these.
 */
import { describe, expect, test } from 'bun:test';

import {
  pinSubpath,
  pinVertex,
  pruneForDeletedSubpath,
  unpinSubpath,
  unpinVertex,
} from '../lib/editor-store/correspondence-pinning';
import type { CorrespondenceHints } from '../lib/schema/types';

const EMPTY: CorrespondenceHints = { subpath: [], vertex: [] };

describe('pinSubpath', () => {
  test('adds a pin to empty hints', () => {
    const r = pinSubpath(EMPTY, 'subpath:0', 'subpath:1');
    expect(r.subpath).toEqual([['subpath:0', 'subpath:1']]);
  });

  test('replaces an existing pin on the same fromId', () => {
    const seeded = pinSubpath(EMPTY, 'subpath:0', 'subpath:0');
    const r = pinSubpath(seeded, 'subpath:0', 'subpath:1');
    expect(r.subpath).toEqual([['subpath:0', 'subpath:1']]);
  });

  test('replaces an existing pin on the same toId', () => {
    const seeded = pinSubpath(EMPTY, 'subpath:0', 'subpath:0');
    const r = pinSubpath(seeded, 'subpath:1', 'subpath:0');
    expect(r.subpath).toEqual([['subpath:1', 'subpath:0']]);
  });

  test('vertex pins are untouched by subpath operations', () => {
    const v = pinVertex(EMPTY, { subpathId: 'subpath:0', vertexIndex: 1 }, {
      subpathId: 'subpath:0',
      vertexIndex: 2,
    });
    const s = pinSubpath(v, 'subpath:0', 'subpath:1');
    expect(s.vertex.length).toBe(1);
  });
});

describe('unpinSubpath', () => {
  test('removes pins referencing the endpoint id', () => {
    let h = pinSubpath(EMPTY, 'subpath:0', 'subpath:1');
    h = pinSubpath(h, 'subpath:2', 'subpath:3');
    h = unpinSubpath(h, 'subpath:0');
    expect(h.subpath).toEqual([['subpath:2', 'subpath:3']]);
  });

  test('no-ops when the endpoint id is not pinned', () => {
    const h = pinSubpath(EMPTY, 'subpath:0', 'subpath:1');
    const r = unpinSubpath(h, 'subpath:99');
    expect(r.subpath).toEqual(h.subpath);
  });
});

describe('pinVertex / unpinVertex', () => {
  const A = { subpathId: 'subpath:0', vertexIndex: 1 };
  const B = { subpathId: 'subpath:0', vertexIndex: 5 };
  const C = { subpathId: 'subpath:1', vertexIndex: 2 };

  test('pinVertex replaces overlapping pins', () => {
    const seeded = pinVertex(EMPTY, A, B);
    const r = pinVertex(seeded, A, C);
    expect(r.vertex).toEqual([[A, C]]);
  });

  test('unpinVertex matches by endpoint address', () => {
    let h = pinVertex(EMPTY, A, B);
    h = pinVertex(h, B, C);
    h = unpinVertex(h, B);
    expect(h.vertex).toEqual([]);
  });
});

describe('pruneForDeletedSubpath', () => {
  test('removes both subpath and vertex pins referencing the deleted subpath', () => {
    let h = pinSubpath(EMPTY, 'subpath:0', 'subpath:1');
    h = pinSubpath(h, 'subpath:2', 'subpath:3');
    h = pinVertex(h, { subpathId: 'subpath:0', vertexIndex: 1 }, {
      subpathId: 'subpath:1',
      vertexIndex: 2,
    });
    h = pinVertex(h, { subpathId: 'subpath:2', vertexIndex: 4 }, {
      subpathId: 'subpath:3',
      vertexIndex: 8,
    });
    const r = pruneForDeletedSubpath(h, 'subpath:0');
    // subpath pin (subpath:0, subpath:1) gone, (subpath:2, subpath:3) kept
    expect(r.subpath).toEqual([['subpath:2', 'subpath:3']]);
    // vertex pin with subpath:0 endpoint gone; the other survives
    expect(r.vertex.length).toBe(1);
  });
});
