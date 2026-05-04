/**
 * Corpus schema for the W1-A4 validation harness.
 *
 * A corpus pair declares one source/target morph and the resolver's
 * expected behaviour. The harness runs every shipped resolver
 * against every pair and produces metric-scored output for diff
 * against the baseline snapshot.
 */
import type { TaxonomyId } from '../../lib/runtime-core/topology-classifier';
import type { FallbackName } from '../../lib/schema/types';

export type CorpusPair = {
  /** Stable id (referenced by baseline snapshot for diffing). */
  id: string;
  /** Human-readable description for the report. */
  description: string;
  /** Source path `d` string. */
  fromD: string;
  /** Target path `d` string. */
  toD: string;
  /** Expected taxonomy class from `classifyLayerPair`. */
  expectedTaxonomy: TaxonomyId;
  /**
   * Expected fallback when the resolver cannot morph continuously.
   * Optional — set on T8 pairs and pairs known to need a designed
   * fallback under the W3 cascade.
   */
  expectedFallback?: FallbackName;
  /** Source layer style, controls how `expectedTaxonomy` is reached. */
  fromStyle?: 'fill' | 'stroke';
  /** Target layer style. */
  toStyle?: 'fill' | 'stroke';
};

export type CorpusSet = {
  name: string;
  description: string;
  pairs: CorpusPair[];
};
