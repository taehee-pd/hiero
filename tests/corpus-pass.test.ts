/**
 * W5-1 acceptance: every canonical + stress pair resolves to its
 * expected taxonomy and lands on a tier within ceiling.
 *
 * This is the corpus-pass gate from the W5 ship checklist
 * (`docs_canonical/ICON_TRANSITION_W5_VALIDATION.md` §1, §5).
 * Pre-flag-flip the gate runs the V2 cascade against every pair;
 * a regression that breaks tier routing or pushes distortion above
 * the calibrated ceiling fails the test.
 *
 * Stress pairs that legitimately exceed the cascade ceilings
 * (deliberately adversarial inputs the resolver should fall
 * THROUGH) are flagged in the corpus via an `acceptable: 'fallback'`
 * marker — they're expected to land at designed-fallback. The
 * absence of that marker means the pair must land at its declared
 * `expectedTaxonomy`.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { resolveMorph, tierCeiling } from '../lib/runtime-core/cascade';
import { classifyLayerPair } from '../lib/runtime-core/topology-classifier';
import type { Layer, PaintRef } from '../lib/schema/types';
import type { CorpusPair, CorpusSet } from './transition-corpus/types';

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

function summariseFailure(pair: CorpusPair, msg: string): string {
  return `[${pair.id}] ${msg}\n  description: ${pair.description}`;
}

describe('W5-1 corpus pass — taxonomy match', () => {
  for (const setName of ['canonical.json', 'stress.json'] as const) {
    const corpus = loadCorpus(setName);
    test(`${corpus.name}: every pair classifies to its expectedTaxonomy`, () => {
      const failures: string[] = [];
      for (const pair of corpus.pairs) {
        const fromLayer = buildLayer(pair.fromD, pair.fromStyle ?? 'fill');
        const toLayer = buildLayer(pair.toD, pair.toStyle ?? 'fill');
        const observed = classifyLayerPair(fromLayer, toLayer);
        if (observed !== pair.expectedTaxonomy) {
          failures.push(
            summariseFailure(
              pair,
              `expected taxonomy ${pair.expectedTaxonomy}, got ${observed}`,
            ),
          );
        }
      }
      if (failures.length > 0) {
        throw new Error(`Taxonomy mismatches:\n${failures.join('\n')}`);
      }
    });
  }
});

describe('W5-1 corpus pass — cascade tier within ceiling', () => {
  for (const setName of ['canonical.json', 'stress.json'] as const) {
    const corpus = loadCorpus(setName);
    test(`${corpus.name}: every pair resolves to a tier ≤ its ceiling`, () => {
      const failures: string[] = [];
      for (const pair of corpus.pairs) {
        const fromLayer = buildLayer(pair.fromD, pair.fromStyle ?? 'fill');
        const toLayer = buildLayer(pair.toD, pair.toStyle ?? 'fill');
        const r = resolveMorph(fromLayer, toLayer);
        const ceiling = tierCeiling(r.tier);
        if (!Number.isFinite(r.distortion)) {
          failures.push(
            summariseFailure(pair, `distortion non-finite: ${r.distortion}`),
          );
          continue;
        }
        if (r.distortion > ceiling) {
          failures.push(
            summariseFailure(
              pair,
              `tier ${r.tier} distortion ${r.distortion.toFixed(4)} > ceiling ${ceiling}`,
            ),
          );
        }
      }
      if (failures.length > 0) {
        throw new Error(`Cascade ceiling violations:\n${failures.join('\n')}`);
      }
    });
  }
});

describe('W5-1 corpus pass — every pair returns a usable interpolator', () => {
  for (const setName of ['canonical.json', 'stress.json'] as const) {
    const corpus = loadCorpus(setName);
    test(`${corpus.name}: every interpolator yields strings across t ∈ {0, 0.5, 1}`, () => {
      const failures: string[] = [];
      for (const pair of corpus.pairs) {
        const fromLayer = buildLayer(pair.fromD, pair.fromStyle ?? 'fill');
        const toLayer = buildLayer(pair.toD, pair.toStyle ?? 'fill');
        const r = resolveMorph(fromLayer, toLayer);
        for (const t of [0, 0.5, 1]) {
          let d: string;
          try {
            d = r.interpolator(t);
          } catch (err) {
            failures.push(
              summariseFailure(
                pair,
                `interpolator threw at t=${t}: ${err instanceof Error ? err.message : String(err)}`,
              ),
            );
            continue;
          }
          if (typeof d !== 'string' || d.length === 0) {
            failures.push(
              summariseFailure(pair, `interpolator(${t}) returned empty/invalid d`),
            );
          }
        }
      }
      if (failures.length > 0) {
        throw new Error(`Interpolator failures:\n${failures.join('\n')}`);
      }
    });
  }
});
