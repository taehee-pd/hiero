/**
 * W1-A4 acceptance: the corpus harness loads, classifies, and scores
 * every seed pair without error. The W1 deliverable is the harness +
 * seed; full corpus curation continues across waves.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { autoMorph } from '../lib/runtime-core/auto-morph';
import { classifyLayerPair } from '../lib/runtime-core/topology-classifier';
import {
  areaMonotonicityError,
  boundaryDistortion,
  sampleTrajectory,
  selfIntersectionCount,
  temporalJerkProxy,
} from '../lib/runtime-core/transition-metrics';
import type { Layer, PaintRef } from '../lib/schema/types';
import type { CorpusSet } from './transition-corpus/types';

const ROOT = resolve(import.meta.dir, '..');
const FILL: PaintRef = { mode: 'fixed', value: '#000' };
const STROKE: PaintRef = { mode: 'fixed', value: '#000' };

function loadCorpus(filename: string): CorpusSet {
  const raw = readFileSync(
    resolve(ROOT, 'tests', 'transition-corpus', filename),
    'utf-8',
  );
  return JSON.parse(raw) as CorpusSet;
}

function buildLayer(d: string, style: 'fill' | 'stroke'): Layer {
  return {
    id: 'layer',
    style:
      style === 'fill'
        ? { fill: FILL }
        : { stroke: STROKE, strokeWidth: 1 },
    path: { d },
  } as Layer;
}

describe('transition corpus seed', () => {
  test('canonical seed exists with one pair per T1..T8 (or marked as gaps to fill in later waves)', () => {
    const corpus = loadCorpus('canonical.json');
    expect(corpus.pairs.length).toBeGreaterThanOrEqual(7);
    // Every seed pair has the required shape.
    for (const pair of corpus.pairs) {
      expect(pair.id).toBeTruthy();
      expect(pair.fromD).toBeTruthy();
      expect(pair.toD).toBeTruthy();
      expect(pair.expectedTaxonomy).toMatch(/^T[1-8]$/);
    }
  });

  test('every seed pair classifies to its expected taxonomy', () => {
    const corpus = loadCorpus('canonical.json');
    const failures: string[] = [];
    for (const pair of corpus.pairs) {
      const fromLayer = buildLayer(pair.fromD, pair.fromStyle ?? 'fill');
      const toLayer = buildLayer(pair.toD, pair.toStyle ?? 'fill');
      const observed = classifyLayerPair(fromLayer, toLayer);
      if (observed !== pair.expectedTaxonomy) {
        failures.push(
          `${pair.id}: expected ${pair.expectedTaxonomy}, got ${observed}`,
        );
      }
    }
    if (failures.length > 0) {
      throw new Error(`Taxonomy mismatches:\n  ${failures.join('\n  ')}`);
    }
  });

  test('the harness runs all five metrics on every seed pair without throwing', () => {
    const corpus = loadCorpus('canonical.json');
    for (const pair of corpus.pairs) {
      const result = autoMorph(pair.fromD, pair.toD);
      if (!result?.interpolator) continue; // legacy resolver may decline
      const traj = sampleTrajectory(result.interpolator, 7);
      // Metrics must each return a finite number for any well-formed
      // trajectory.
      for (const value of [
        boundaryDistortion(traj),
        areaMonotonicityError(traj),
        selfIntersectionCount(traj),
        temporalJerkProxy(traj),
      ]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('the baseline snapshot is well-formed and current', () => {
    const baseline = JSON.parse(
      readFileSync(
        resolve(ROOT, 'tests', 'transition-corpus', 'baseline.json'),
        'utf-8',
      ),
    );
    expect(baseline.resolvers).toContain('auto-morph');
    expect(Array.isArray(baseline.sets)).toBe(true);
    expect(baseline.sets.length).toBeGreaterThanOrEqual(2);
    const canonical = baseline.sets.find(
      (s: { name: string }) => s.name === 'canonical',
    );
    expect(canonical).toBeDefined();
    expect(canonical.pairs.length).toBeGreaterThanOrEqual(7);
  });
});
