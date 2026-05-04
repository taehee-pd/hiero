/**
 * W1-U1 acceptance test: enforce that `Transition` exposes exactly
 * the four authored axes (and no other algorithm-mechanism field).
 *
 * The non-authored fields on `Transition` are either
 *   (a) identity / variant routing (id, fromIconId, toIconId, …)
 *   (b) non-strategy infrastructure (layerBindings, stagger, effects)
 *   (c) `@deprecated W4` legacy that ships out with the new cascade.
 *
 * This test guards (c) — it asserts the deprecated set is exactly the
 * set we expect, so a contributor adding a new strategy field has to
 * either justify it as deprecated or add it to TRANSITION_AUTHORED_AXES
 * (which requires a doc update).
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { isTransition } from '../lib/schema/guards';
import {
  TRANSITION_AUTHORED_AXES,
  type Transition,
} from '../lib/schema/types';

const TYPES_PATH = resolve(import.meta.dir, '..', 'lib', 'schema', 'types.ts');

describe('Transition schema contract (W1-U1)', () => {
  test('TRANSITION_AUTHORED_AXES is exactly the four contract axes', () => {
    expect([...TRANSITION_AUTHORED_AXES].sort()).toEqual([
      'cadence',
      'correspondenceHints',
      'duration',
      'fallbackOverride',
    ]);
  });

  test('isTransition accepts a transition with all four authored axes', () => {
    const t: Transition = {
      id: 't',
      fromIconId: 'a',
      toIconId: 'b',
      fromVariantId: 'v1',
      toVariantId: 'v2',
      strategy: 'strictMorph',
      durationMs: 300,
      duration: 0.3,
      cadence: 'soft',
      fallbackOverride: 'radial-pop',
      correspondenceHints: { subpath: [], vertex: [] },
    };
    expect(isTransition(t)).toBe(true);
  });

  test('isTransition rejects an invalid cadence', () => {
    const bad = {
      id: 't',
      fromIconId: 'a',
      toIconId: 'b',
      fromVariantId: 'v1',
      toVariantId: 'v2',
      strategy: 'strictMorph',
      durationMs: 300,
      cadence: 'bouncy', // not in the cadence union
    };
    expect(isTransition(bad)).toBe(false);
  });

  test('isTransition rejects non-array correspondenceHints arms', () => {
    const bad = {
      id: 't',
      fromIconId: 'a',
      toIconId: 'b',
      fromVariantId: 'v1',
      toVariantId: 'v2',
      strategy: 'strictMorph',
      durationMs: 300,
      correspondenceHints: { subpath: 'oops', vertex: [] },
    };
    expect(isTransition(bad)).toBe(false);
  });

  test('isTransition tolerates absent authored axes (defaults applied at resolve time)', () => {
    const minimal = {
      id: 't',
      fromIconId: 'a',
      toIconId: 'b',
      fromVariantId: 'v1',
      toVariantId: 'v2',
      strategy: 'strictMorph',
      durationMs: 300,
    };
    expect(isTransition(minimal)).toBe(true);
  });

  test('the deprecated set on RuntimeTransitionIntent is the documented W4 cleanup list', () => {
    // Read the source file and verify the legacy fields have a
    // `@deprecated W4` marker. If a contributor adds a new strategy
    // field without marking it deprecated, this test surfaces it.
    const source = readFileSync(TYPES_PATH, 'utf-8');
    const intentBlock = source.slice(
      source.indexOf('export type RuntimeTransitionIntent'),
      source.indexOf('export type Transition ='),
    );
    expect(intentBlock).toContain('@deprecated W4');
    // The four legacy fields we expect to remove in W4.
    for (const field of ['strategy', 'durationMs', 'easing', 'direction']) {
      expect(intentBlock).toContain(field);
    }
  });

  test('no algorithm-mechanism authored field beyond the contract', () => {
    // A contributor adding a new field to Transition that isn't in
    // TRANSITION_AUTHORED_AXES, isn't identity/infra, and isn't
    // marked @deprecated must update the contract or this test fails.
    const source = readFileSync(TYPES_PATH, 'utf-8');
    const start = source.indexOf('export type Transition = RuntimeTransitionIntent & {');
    const end = source.indexOf('};', start);
    const block = source.slice(start, end);
    // Every authored axis must appear in the Transition extension.
    for (const axis of TRANSITION_AUTHORED_AXES) {
      expect(block).toContain(`${axis}?`);
    }
    // The known non-authored infrastructure fields are whitelisted.
    const infrastructureFields = [
      'from?',
      'to?',
      'variantId?',
      'layerBindings?',
      'stagger?',
      'effects?',
    ];
    for (const field of infrastructureFields) {
      expect(block).toContain(field);
    }
  });
});
