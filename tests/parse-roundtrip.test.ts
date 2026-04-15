import { describe, expect, test } from 'bun:test';
import {
  isPathDirectlyEditable,
  parseSvgPath,
  serializePath,
} from '../lib/editor-core/parse';

/**
 * Regression suite pinning parse → serialize → parse round-trip fidelity
 * across every SVG path command we claim to support. Written before the
 * S/s / T/t fix in lib/editor-core/parse.ts so the existing baseline is
 * locked in.
 *
 * A "round-trip" here means: after serializePath(parseSvgPath(d)), every
 * PathPoint position, handleIn, handleOut, and subpath closure matches the
 * original. We don't require the exact string to match — serialization is
 * allowed to normalize (e.g., M → L shorthand) as long as geometry is
 * preserved.
 */

function roundTrip(d: string) {
  const parsed1 = parseSvgPath(d);
  const reserialized = serializePath(parsed1);
  const parsed2 = parseSvgPath(reserialized);
  return { parsed1, parsed2, reserialized };
}

function flatten(path: ReturnType<typeof parseSvgPath>) {
  return path.subPaths.map((sp) => ({
    closed: sp.closed,
    points: sp.points.map((p) => ({
      position: { x: round(p.position.x), y: round(p.position.y) },
      handleIn: p.handleIn
        ? { x: round(p.handleIn.x), y: round(p.handleIn.y) }
        : null,
      handleOut: p.handleOut
        ? { x: round(p.handleOut.x), y: round(p.handleOut.y) }
        : null,
    })),
  }));
}

function round(n: number) {
  // Parser + serializer both round to 3 decimals — match that here so
  // round-trip comparisons are stable without spurious fp mismatches.
  return Math.round(n * 1000) / 1000;
}

describe('parse/serialize round-trip', () => {
  test('M + L absolute', () => {
    const { parsed1, parsed2 } = roundTrip('M10 20 L30 40 L50 60');
    expect(flatten(parsed1)).toEqual(flatten(parsed2));
    expect(parsed1.subPaths).toHaveLength(1);
    expect(parsed1.subPaths[0]!.points).toHaveLength(3);
    expect(parsed1.subPaths[0]!.points[0]!.position).toEqual({ x: 10, y: 20 });
    expect(parsed1.subPaths[0]!.points[2]!.position).toEqual({ x: 50, y: 60 });
  });

  test('relative m + l', () => {
    const { parsed1, parsed2 } = roundTrip('m10 20 l5 5 l5 -5');
    expect(flatten(parsed1)).toEqual(flatten(parsed2));
    // After parse, positions should be absolute.
    expect(parsed1.subPaths[0]!.points[0]!.position).toEqual({ x: 10, y: 20 });
    expect(parsed1.subPaths[0]!.points[1]!.position).toEqual({ x: 15, y: 25 });
    expect(parsed1.subPaths[0]!.points[2]!.position).toEqual({ x: 20, y: 20 });
  });

  test('H and V absolute', () => {
    const { parsed1, parsed2 } = roundTrip('M10 10 H20 V30');
    expect(flatten(parsed1)).toEqual(flatten(parsed2));
    expect(parsed1.subPaths[0]!.points[1]!.position).toEqual({ x: 20, y: 10 });
    expect(parsed1.subPaths[0]!.points[2]!.position).toEqual({ x: 20, y: 30 });
  });

  test('H and V relative', () => {
    const { parsed1, parsed2 } = roundTrip('M10 10 h15 v20');
    expect(flatten(parsed1)).toEqual(flatten(parsed2));
    expect(parsed1.subPaths[0]!.points[1]!.position).toEqual({ x: 25, y: 10 });
    expect(parsed1.subPaths[0]!.points[2]!.position).toEqual({ x: 25, y: 30 });
  });

  test('cubic C preserves handles through round-trip', () => {
    const d = 'M10 10 C20 0 30 0 40 10';
    const { parsed1, parsed2 } = roundTrip(d);
    expect(flatten(parsed1)).toEqual(flatten(parsed2));
    const [p0, p1] = parsed1.subPaths[0]!.points;
    expect(p0!.handleOut).toEqual({ x: 20, y: 0 });
    expect(p1!.handleIn).toEqual({ x: 30, y: 0 });
    expect(p1!.position).toEqual({ x: 40, y: 10 });
  });

  test('relative cubic c absolutizes correctly', () => {
    const d = 'M10 10 c10 -10 20 -10 30 0';
    const { parsed1, parsed2 } = roundTrip(d);
    expect(flatten(parsed1)).toEqual(flatten(parsed2));
    const [p0, p1] = parsed1.subPaths[0]!.points;
    expect(p0!.handleOut).toEqual({ x: 20, y: 0 });
    expect(p1!.handleIn).toEqual({ x: 30, y: 0 });
    expect(p1!.position).toEqual({ x: 40, y: 10 });
  });

  test('quadratic Q preserves control point', () => {
    const d = 'M0 0 Q10 20 20 0';
    const { parsed1, parsed2 } = roundTrip(d);
    expect(flatten(parsed1)).toEqual(flatten(parsed2));
    const [p0, p1] = parsed1.subPaths[0]!.points;
    expect(p0!.handleOut).toEqual({ x: 10, y: 20 });
    expect(p1!.handleIn).toEqual({ x: 10, y: 20 });
  });

  test('closed subpath with Z', () => {
    const d = 'M0 0 L10 0 L10 10 L0 10 Z';
    const { parsed1, parsed2 } = roundTrip(d);
    expect(flatten(parsed1)).toEqual(flatten(parsed2));
    expect(parsed1.subPaths[0]!.closed).toBe(true);
  });

  test('multiple subpaths', () => {
    const d = 'M0 0 L10 10 M20 20 L30 30';
    const { parsed1, parsed2 } = roundTrip(d);
    expect(flatten(parsed1)).toEqual(flatten(parsed2));
    expect(parsed1.subPaths).toHaveLength(2);
  });

  test('implicit line-to after M', () => {
    const d = 'M0 0 10 10 20 0';
    const { parsed1 } = roundTrip(d);
    expect(parsed1.subPaths[0]!.points).toHaveLength(3);
    expect(parsed1.subPaths[0]!.points[1]!.position).toEqual({ x: 10, y: 10 });
    expect(parsed1.subPaths[0]!.points[2]!.position).toEqual({ x: 20, y: 0 });
  });

  test('arc A preserves command type (arc segment kept, not downgraded to line)', () => {
    const d = 'M0 0 A5 5 0 0 1 10 0';
    const parsed = parseSvgPath(d);
    const p1 = parsed.subPaths[0]!.points[1]!;
    expect(p1.segment?.type).toBe('arc');
    if (p1.segment?.type === 'arc') {
      expect(p1.segment.rx).toBe(5);
      expect(p1.segment.ry).toBe(5);
      expect(p1.segment.sweep).toBe(1);
    }
    const { parsed2 } = roundTrip(d);
    expect(parsed2.subPaths[0]!.points[1]!.segment?.type).toBe('arc');
  });

  test('numeric edge cases: scientific notation and leading dot', () => {
    const d = 'M1e1 .5 L2 .25';
    const { parsed1 } = roundTrip(d);
    expect(parsed1.subPaths[0]!.points[0]!.position).toEqual({ x: 10, y: 0.5 });
    expect(parsed1.subPaths[0]!.points[1]!.position).toEqual({ x: 2, y: 0.25 });
  });

  test('round-trip stability: double round-trip is idempotent', () => {
    const d = 'M10 20 C15 10 25 10 30 20 L40 20 Z';
    const first = serializePath(parseSvgPath(d));
    const second = serializePath(parseSvgPath(first));
    expect(second).toBe(first);
  });
});

describe('isPathDirectlyEditable gating', () => {
  test('simple M/L path is editable', () => {
    expect(isPathDirectlyEditable('M0 0 L10 10')).toBe(true);
  });

  test('path with C is editable', () => {
    expect(isPathDirectlyEditable('M0 0 C10 0 20 0 30 0')).toBe(true);
  });

  test('path with H/V is editable', () => {
    expect(isPathDirectlyEditable('M0 0 H10 V10')).toBe(true);
  });

  test('path with arc A is editable', () => {
    expect(isPathDirectlyEditable('M0 0 A5 5 0 0 1 10 0')).toBe(true);
  });

  test('closed path with Z is editable', () => {
    expect(isPathDirectlyEditable('M0 0 L10 0 L10 10 Z')).toBe(true);
  });

  test('smooth cubic S is editable after S/T support is added', () => {
    // Phase 1 fix: S/s must parse without falling through to the
    // "unknown command" branch of isPathDirectlyEditable. Before the
    // fix, this returned false; after, it must return true.
    expect(isPathDirectlyEditable('M0 0 C10 0 20 0 30 0 S40 0 50 0')).toBe(true);
  });

  test('smooth quadratic T is editable after S/T support is added', () => {
    expect(isPathDirectlyEditable('M0 0 Q10 10 20 0 T40 0')).toBe(true);
  });
});

describe('smooth cubic (S/s) round-trip (Phase 1 target)', () => {
  test('S reflects the previous cubic control point', () => {
    // C10 0 20 0 30 0 leaves prev.handleOut at (20,0) for the next point
    // (30,0). S with control (40,0) and endpoint (50,0) should produce a
    // reflected handleIn at (40,0) for the next point. The parser must
    // materialize the implicit first control by reflecting (20,0) about
    // (30,0) = (40,0).
    const d = 'M0 0 C10 0 20 0 30 0 S40 0 50 0';
    const parsed = parseSvgPath(d);
    expect(parsed.subPaths[0]!.points).toHaveLength(3);
    const [p0, p1, p2] = parsed.subPaths[0]!.points;
    expect(p0!.position).toEqual({ x: 0, y: 0 });
    expect(p1!.position).toEqual({ x: 30, y: 0 });
    expect(p2!.position).toEqual({ x: 50, y: 0 });
    // Implicit first control for the S is the reflection of (20,0) about (30,0).
    expect(p1!.handleOut).toEqual({ x: 40, y: 0 });
    // The S's explicit second control is (40,0).
    expect(p2!.handleIn).toEqual({ x: 40, y: 0 });
  });

  test('relative s is absolutized correctly', () => {
    const d = 'M0 0 C10 0 20 0 30 0 s10 0 20 0';
    const parsed = parseSvgPath(d);
    const [, p1, p2] = parsed.subPaths[0]!.points;
    expect(p2!.position).toEqual({ x: 50, y: 0 });
    // s control (10,0) relative to (30,0) becomes (40,0).
    expect(p2!.handleIn).toEqual({ x: 40, y: 0 });
    // Reflection of prev handleOut (20,0) about (30,0) is (40,0).
    expect(p1!.handleOut).toEqual({ x: 40, y: 0 });
  });

  test('S after a non-curve command uses the anchor as the reflected control', () => {
    // When there's no previous cubic, the implicit control equals the current point.
    // "M0 0 L10 10 S20 10 30 0" — prev anchor is (10,10), no handleOut yet.
    const d = 'M0 0 L10 10 S20 10 30 0';
    const parsed = parseSvgPath(d);
    const [, p1, p2] = parsed.subPaths[0]!.points;
    // Implicit first control for S equals p1 since prev had no cubic handle.
    expect(p1!.handleOut).toEqual({ x: 10, y: 10 });
    expect(p2!.handleIn).toEqual({ x: 20, y: 10 });
    expect(p2!.position).toEqual({ x: 30, y: 0 });
  });

  test('S round-trips through serializePath (expanded to C)', () => {
    // Serializer emits C (not S) — acceptable as long as geometry matches.
    const d = 'M0 0 C10 0 20 0 30 0 S40 0 50 0';
    const first = parseSvgPath(d);
    const reserialized = serializePath(first);
    const second = parseSvgPath(reserialized);
    expect(flatten(first)).toEqual(flatten(second));
  });
});

describe('smooth quadratic (T/t) round-trip (Phase 1 target)', () => {
  test('T reflects the previous quadratic control point', () => {
    // Q10 20 20 0 leaves a reflected implicit control at (30, -20) for the
    // next point. After T40 0 the control should be (30, -20) and endpoint (40, 0).
    const d = 'M0 0 Q10 20 20 0 T40 0';
    const parsed = parseSvgPath(d);
    expect(parsed.subPaths[0]!.points).toHaveLength(3);
    const [, p1, p2] = parsed.subPaths[0]!.points;
    expect(p1!.position).toEqual({ x: 20, y: 0 });
    expect(p2!.position).toEqual({ x: 40, y: 0 });
    // Reflection of (10,20) about (20,0) is (30,-20).
    expect(p1!.handleOut).toEqual({ x: 30, y: -20 });
    expect(p2!.handleIn).toEqual({ x: 30, y: -20 });
  });

  test('T after a non-quadratic command uses the anchor', () => {
    // "M0 0 L10 10 T20 10" — previous command is L, not Q.
    const d = 'M0 0 L10 10 T20 10';
    const parsed = parseSvgPath(d);
    const [, p1, p2] = parsed.subPaths[0]!.points;
    expect(p1!.handleOut).toEqual({ x: 10, y: 10 });
    expect(p2!.handleIn).toEqual({ x: 10, y: 10 });
    expect(p2!.position).toEqual({ x: 20, y: 10 });
  });

  test('relative t is absolutized correctly', () => {
    const d = 'M0 0 Q10 20 20 0 t20 0';
    const parsed = parseSvgPath(d);
    const [, , p2] = parsed.subPaths[0]!.points;
    // 20,0 relative to 20,0 → 40,0
    expect(p2!.position).toEqual({ x: 40, y: 0 });
  });

  test('T round-trips through serializePath', () => {
    const d = 'M0 0 Q10 20 20 0 T40 0';
    const first = parseSvgPath(d);
    const reserialized = serializePath(first);
    const second = parseSvgPath(reserialized);
    expect(flatten(first)).toEqual(flatten(second));
  });
});

describe('mixed-family smooth commands (SVG spec §9.3.6 / §9.3.7)', () => {
  // Regression for Codex PR review P1: S only reflects when the previous
  // command was a cubic (C/c/S/s), and T only reflects when the previous
  // command was a quadratic (Q/q/T/t). Mixed cases like Q→S or C→T must
  // use the current anchor as the implicit control, not the prior
  // command's control from the opposite curve family.

  test('S after Q uses the anchor as its implicit first control (not the Q control reflection)', () => {
    // `M0 0 Q10 20 20 0 S40 0 50 0`
    //
    // After Q the "current point" is (20, 0) and the Q's control is (10, 20).
    // If we WRONGLY reflected, cp1 of the S-derived cubic would be (30, -20).
    // Per SVG spec, since the previous command is Q (not cubic), cp1 must be
    // the anchor (20, 0).
    const d = 'M0 0 Q10 20 20 0 S40 0 50 0';
    const parsed = parseSvgPath(d);
    expect(parsed.subPaths[0]!.points).toHaveLength(3);
    const [, p1, p2] = parsed.subPaths[0]!.points;

    // Q endpoint stays at (20, 0).
    expect(p1!.position).toEqual({ x: 20, y: 0 });
    // Q's control must still live on p1.handleIn.
    expect(p1!.handleIn).toEqual({ x: 10, y: 20 });
    // p1.handleOut is the cubic's cp1 — must be the anchor (20, 0),
    // NOT the reflection of the Q control (which would be (30, -20)).
    expect(p1!.handleOut).toEqual({ x: 20, y: 0 });

    // S endpoint + its explicit second control.
    expect(p2!.position).toEqual({ x: 50, y: 0 });
    expect(p2!.handleIn).toEqual({ x: 40, y: 0 });
  });

  test('T after C uses the anchor as its implicit control (not the C second-control reflection)', () => {
    // `M0 0 C10 0 20 0 30 0 T40 0`
    //
    // After C the "current point" is (30, 0) and the C's second control is
    // (20, 0). If we WRONGLY reflected, the T-derived quadratic's control
    // would be (40, 0). Per SVG spec, since the previous command is C (not
    // quadratic), the implicit control must be the anchor (30, 0).
    const d = 'M0 0 C10 0 20 0 30 0 T40 0';
    const parsed = parseSvgPath(d);
    expect(parsed.subPaths[0]!.points).toHaveLength(3);
    const [, p1, p2] = parsed.subPaths[0]!.points;

    expect(p1!.position).toEqual({ x: 30, y: 0 });
    // C's second control lives on p1.handleIn.
    expect(p1!.handleIn).toEqual({ x: 20, y: 0 });
    // p1.handleOut is the quadratic control — must be the anchor (30, 0),
    // NOT the reflection of the C second control (which would be (40, 0)).
    expect(p1!.handleOut).toEqual({ x: 30, y: 0 });

    // T endpoint and its (anchor-based) incoming control.
    expect(p2!.position).toEqual({ x: 40, y: 0 });
    expect(p2!.handleIn).toEqual({ x: 30, y: 0 });
  });

  test('S→S chain still reflects (each subsequent S sees the previous as cubic)', () => {
    // Sanity check that the family tracker correctly transitions S → cubic
    // so subsequent S commands still reflect. If we had reset the family
    // to null after S, this would break.
    const d = 'M0 0 C10 0 20 0 30 0 S40 0 50 0 S60 0 70 0';
    const parsed = parseSvgPath(d);
    const points = parsed.subPaths[0]!.points;
    expect(points).toHaveLength(4);

    // Second S's cp1 must reflect the first S's cp2 (40, 0) about (50, 0)
    // → (60, 0).
    expect(points[2]!.handleOut).toEqual({ x: 60, y: 0 });
    expect(points[3]!.handleIn).toEqual({ x: 60, y: 0 });
    expect(points[3]!.position).toEqual({ x: 70, y: 0 });
  });

  test('T→T chain still reflects (each subsequent T sees the previous as quadratic)', () => {
    const d = 'M0 0 Q10 20 20 0 T40 0 T60 0';
    const parsed = parseSvgPath(d);
    const points = parsed.subPaths[0]!.points;
    expect(points).toHaveLength(4);

    // First T's control reflects Q's (10, 20) about (20, 0) → (30, -20).
    expect(points[1]!.handleOut).toEqual({ x: 30, y: -20 });
    expect(points[2]!.handleIn).toEqual({ x: 30, y: -20 });
    expect(points[2]!.position).toEqual({ x: 40, y: 0 });

    // Second T's control reflects the previous T's control (30, -20)
    // about (40, 0) → (50, 20).
    expect(points[2]!.handleOut).toEqual({ x: 50, y: 20 });
    expect(points[3]!.handleIn).toEqual({ x: 50, y: 20 });
    expect(points[3]!.position).toEqual({ x: 60, y: 0 });
  });

  test('L between curves resets the family (S after L uses the anchor)', () => {
    // `M0 0 C10 0 20 0 30 0 L40 0 S50 0 60 0`
    //
    // Even though there's a cubic earlier, the intervening L resets the
    // family, so S's implicit cp1 must be the anchor (40, 0).
    const d = 'M0 0 C10 0 20 0 30 0 L40 0 S50 0 60 0';
    const parsed = parseSvgPath(d);
    const points = parsed.subPaths[0]!.points;
    expect(points).toHaveLength(4);
    // p2 is the L endpoint at (40, 0). Its handleOut (the S-derived cp1)
    // must be the anchor, NOT the reflection of p1.handleIn (which would
    // be nonsense since p2.handleIn is null after L).
    expect(points[2]!.position).toEqual({ x: 40, y: 0 });
    expect(points[2]!.handleIn).toBeNull();
    expect(points[2]!.handleOut).toEqual({ x: 40, y: 0 });
    expect(points[3]!.handleIn).toEqual({ x: 50, y: 0 });
    expect(points[3]!.position).toEqual({ x: 60, y: 0 });
  });
});
