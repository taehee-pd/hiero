#!/usr/bin/env bun
/**
 * Transition corpus harness — W1-A4.
 *
 * Loads each corpus set (`tests/transition-corpus/*.json`), runs the
 * configured resolvers against every pair, scores each trajectory
 * with the W1 metric harness, and emits a JSON report. The report
 * is the input the W3+ work will diff against to gate cascade
 * landings.
 *
 * Usage:
 *   bun scripts/run-transition-corpus.ts                  # report to stdout
 *   bun scripts/run-transition-corpus.ts --out FILE       # also write to FILE
 *   bun scripts/run-transition-corpus.ts --resolver auto-morph
 *
 * Plan: docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §9.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { CorpusPair, CorpusSet } from '../tests/transition-corpus/types';

import { autoMorph, type MorphInterpolator } from '../lib/runtime-core';
import {
  areaMonotonicityError,
  boundaryDistortion,
  sampleTrajectory,
  selfIntersectionCount,
  temporalJerkProxy,
  type Trajectory,
} from '../lib/runtime-core/transition-metrics';
import { classifyLayerPair } from '../lib/runtime-core/topology-classifier';
import type { Layer, PaintRef } from '../lib/schema/types';

const ROOT = resolve(import.meta.dir, '..');
const FILL: PaintRef = { mode: 'fixed', value: '#000' };
const STROKE: PaintRef = { mode: 'fixed', value: '#000' };

type ResolverName = 'auto-morph';

type ResolverImpl = {
  name: ResolverName;
  resolve(pair: CorpusPair): MorphInterpolator | null;
};

const RESOLVERS: Record<ResolverName, ResolverImpl> = {
  'auto-morph': {
    name: 'auto-morph',
    resolve(pair) {
      const result = autoMorph(pair.fromD, pair.toD);
      return result?.interpolator ?? null;
    },
  },
};

type FrameMetrics = {
  boundaryDistortion: number;
  areaMonotonicityError: number;
  selfIntersectionCount: number;
  temporalJerkProxy: number;
};

type PairReport = {
  pairId: string;
  expectedTaxonomy: CorpusPair['expectedTaxonomy'];
  observedTaxonomy: ReturnType<typeof classifyLayerPair> | 'no-classification';
  taxonomyMatch: boolean;
  resolverResults: Record<
    ResolverName,
    | { ok: true; metrics: FrameMetrics; sampleCount: number }
    | { ok: false; reason: string }
  >;
};

type CorpusReport = {
  generatedAt: string;
  resolvers: ResolverName[];
  sets: Array<{
    name: string;
    description: string;
    pairs: PairReport[];
  }>;
};

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

function scorePair(
  pair: CorpusPair,
  resolvers: ResolverImpl[],
  sampleCount: number,
): PairReport {
  const fromStyle = pair.fromStyle ?? 'fill';
  const toStyle = pair.toStyle ?? 'fill';
  const fromLayer = buildLayer(pair.fromD, fromStyle);
  const toLayer = buildLayer(pair.toD, toStyle);
  const observedTaxonomy = classifyLayerPair(fromLayer, toLayer);

  const resolverResults: PairReport['resolverResults'] = {} as PairReport['resolverResults'];
  for (const resolver of resolvers) {
    try {
      const interpolator = resolver.resolve(pair);
      if (!interpolator) {
        resolverResults[resolver.name] = { ok: false, reason: 'no-interpolator' };
        continue;
      }
      const trajectory: Trajectory = sampleTrajectory(interpolator, sampleCount);
      resolverResults[resolver.name] = {
        ok: true,
        sampleCount,
        metrics: {
          boundaryDistortion: round(boundaryDistortion(trajectory)),
          areaMonotonicityError: round(areaMonotonicityError(trajectory)),
          selfIntersectionCount: selfIntersectionCount(trajectory),
          temporalJerkProxy: round(temporalJerkProxy(trajectory)),
        },
      };
    } catch (err) {
      resolverResults[resolver.name] = {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    pairId: pair.id,
    expectedTaxonomy: pair.expectedTaxonomy,
    observedTaxonomy,
    taxonomyMatch: observedTaxonomy === pair.expectedTaxonomy,
    resolverResults,
  };
}

function round(value: number, digits = 6): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function loadSet(filename: string): CorpusSet {
  const path = resolve(ROOT, 'tests', 'transition-corpus', filename);
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as CorpusSet;
}

function parseArgs(argv: string[]): {
  outFile: string | null;
  resolver: ResolverName | 'all';
  sampleCount: number;
  frozenTimestamp: boolean;
} {
  let outFile: string | null = null;
  let resolver: ResolverName | 'all' = 'all';
  let sampleCount = 11;
  // When `--frozen-timestamp` is passed, the report uses a stable
  // sentinel for `generatedAt` so repeated runs produce byte-equal
  // output. Used when committing the baseline.json snapshot — the
  // W1-audit-cleanup test asserts round-trip stability.
  let frozenTimestamp = false;
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--out' && argv[i + 1]) {
      outFile = argv[++i]!;
    } else if (arg === '--resolver' && argv[i + 1]) {
      const v = argv[++i]!;
      if (v in RESOLVERS) resolver = v as ResolverName;
      else if (v === 'all') resolver = 'all';
      else throw new Error(`Unknown resolver: ${v}`);
    } else if (arg === '--samples' && argv[i + 1]) {
      sampleCount = Number.parseInt(argv[++i]!, 10);
      if (!Number.isFinite(sampleCount) || sampleCount < 2) {
        throw new Error(`--samples must be an integer >= 2`);
      }
    } else if (arg === '--frozen-timestamp') {
      frozenTimestamp = true;
    }
  }
  return { outFile, resolver, sampleCount, frozenTimestamp };
}

function main() {
  const args = parseArgs(process.argv);
  const resolvers: ResolverImpl[] =
    args.resolver === 'all'
      ? Object.values(RESOLVERS)
      : [RESOLVERS[args.resolver]];

  const sets = ['canonical.json', 'stress.json'].map(loadSet);
  const report: CorpusReport = {
    generatedAt: args.frozenTimestamp
      ? '1970-01-01T00:00:00.000Z'
      : new Date().toISOString(),
    resolvers: resolvers.map((r) => r.name),
    sets: sets.map((set) => ({
      name: set.name,
      description: set.description,
      pairs: set.pairs.map((pair) => scorePair(pair, resolvers, args.sampleCount)),
    })),
  };

  const json = JSON.stringify(report, null, 2);
  if (args.outFile) {
    writeFileSync(resolve(ROOT, args.outFile), json);
    console.log(`Wrote report to ${args.outFile}`);
  } else {
    console.log(json);
  }
}

main();
