import { describe, expect, mock, test } from 'bun:test';
import { parseSvgPath, serializePath } from '../lib/editor-core/parse';

const RECT_A = 'M0 0 L10 0 L10 10 L0 10 Z';
const RECT_B = 'M5 0 L15 0 L15 10 L5 10 Z';
const UNION_RESULT = 'M0 0 L15 0 L15 10 L0 10 Z';
const SUBTRACT_RESULT = 'M0 0 L5 0 L5 10 L0 10 Z';

function countPoints(pathData: string): number {
  return parseSvgPath(pathData).subPaths.reduce((total, subPath) => total + subPath.points.length, 0);
}

class FakeCompoundPath {
  pathData: string;
  bounds: { intersects: (other: { pathData: string }) => boolean };

  constructor(input: string | { pathData: string }) {
    this.pathData = typeof input === 'string' ? input : input.pathData;
    this.bounds = {
      intersects: (other) => this.pathData !== '' && other.pathData !== '',
    };
  }

  unite(_other: FakeCompoundPath) {
    return new FakeCompoundPath({ pathData: UNION_RESULT });
  }

  subtract(_other: FakeCompoundPath) {
    return new FakeCompoundPath({ pathData: SUBTRACT_RESULT });
  }

  intersect(_other: FakeCompoundPath) {
    return new FakeCompoundPath({ pathData: 'M5 0 L10 0 L10 10 L5 10 Z' });
  }

  exclude(_other: FakeCompoundPath) {
    return new FakeCompoundPath({ pathData: `${RECT_A} ${RECT_B}` });
  }

  getPathData() {
    return this.pathData;
  }

  remove() {}
}

class FakeSize {
  constructor(_width: number, _height: number) {}
}

class FakePaperScope {
  Size = FakeSize;

  CompoundPath = FakeCompoundPath;

  project = {
    clear() {},
    remove() {},
  };

  view = {
    remove() {},
  };

  setup(_size: unknown) {}
  activate() {}
  remove() {}
}

mock.module('../lib/editor-core/paper-runtime', () => ({
  loadPaperGlobal: async () => ({
    PaperScope: FakePaperScope,
    Size: FakeSize,
  }),
}));

describe('boolean ops', () => {
  test('unite simplifies overlapping rectangles and round-trips stably', async () => {
    const { booleanOp } = await import('../lib/editor-core/boolean-ops');
    const result = await booleanOp('unite', RECT_A, RECT_B);
    const combinedPointCount = countPoints(RECT_A) + countPoints(RECT_B);

    expect(result).toBe(UNION_RESULT);
    expect(countPoints(result)).toBeLessThan(combinedPointCount);

    const roundTrip = serializePath(parseSvgPath(result));
    expect(serializePath(parseSvgPath(roundTrip))).toBe(roundTrip);
  });

  test('subtract removes the overlap region and round-trips stably', async () => {
    const { booleanOp } = await import('../lib/editor-core/boolean-ops');
    const result = await booleanOp('subtract', RECT_A, RECT_B);

    expect(result).toBe(SUBTRACT_RESULT);

    const roundTrip = serializePath(parseSvgPath(result));
    expect(serializePath(parseSvgPath(roundTrip))).toBe(roundTrip);
  });
});
