import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import paper from 'paper';
import { booleanOp } from '../lib/editor-core/boolean-ops';
import { parseSvgPath, serializePath } from '../lib/editor-core/parse';

const RECT_A = 'M0 0 L10 0 L10 10 L0 10 Z';
const RECT_B = 'M5 0 L15 0 L15 10 L5 10 Z';

const previousWindow = globalThis.window;

function countPoints(pathData: string): number {
  return parseSvgPath(pathData).subPaths.reduce((total, subPath) => total + subPath.points.length, 0);
}

function createScope() {
  const scope = new paper.PaperScope();
  scope.setup(new paper.Size(1, 1));
  return scope;
}

beforeEach(() => {
  globalThis.window = { paper } as typeof globalThis.window;
});

afterEach(() => {
  globalThis.window = previousWindow;
});

describe('boolean ops', () => {
  test('unite simplifies overlapping rectangles and round-trips stably', async () => {
    const result = await booleanOp('unite', RECT_A, RECT_B);
    const combinedPointCount = countPoints(RECT_A) + countPoints(RECT_B);

    expect(countPoints(result)).toBeLessThan(combinedPointCount);

    const roundTrip = serializePath(parseSvgPath(result));
    expect(serializePath(parseSvgPath(roundTrip))).toBe(roundTrip);
  });

  test('subtract removes the overlap region and round-trips stably', async () => {
    const result = await booleanOp('subtract', RECT_A, RECT_B);
    const scope = createScope();
    const shape = new scope.CompoundPath({ pathData: result, insert: false });

    expect(shape.contains(new scope.Point(2, 5))).toBeTrue();
    expect(shape.contains(new scope.Point(7, 5))).toBeFalse();

    const roundTrip = serializePath(parseSvgPath(result));
    expect(serializePath(parseSvgPath(roundTrip))).toBe(roundTrip);

    shape.remove();
    scope.project.clear();
    scope.project.remove();
    scope.remove();
  });
});
