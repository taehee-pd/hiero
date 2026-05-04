import { describe, expect, test } from 'bun:test';

import type { ResolutionSignal } from '../lib/runtime-core/morph-resolution';
import {
  FALLBACK_DISPLAY_NAME,
  signalToDebugString,
  signalToSentence,
} from '../lib/runtime-core/transition-signal-messages';
import type { FallbackName } from '../lib/schema/types';

const ALL_FALLBACKS: FallbackName[] = [
  'radial-pop',
  'directional-replace-up',
  'directional-replace-down',
  'directional-replace-left',
  'directional-replace-right',
  'directional-replace-toward',
  'directional-replace-away',
  'draw-replace',
  'scale-pop',
];

const ALL_SIGNAL_KINDS: ResolutionSignal['kind'][] = [
  'tree-shape-mismatch',
  'distortion-floor-exceeded',
  'fillrule-conflict',
  'open-closed-mismatch',
  'subpath-cardinality-mismatch',
];

// Banned algorithm vocabulary. The translator must never produce any
// of these in user-facing copy. Mirrors the lint script's word list.
const BANNED_TERMS = [
  'Hungarian',
  'intrinsic',
  'ARAP',
  'contour tree',
  'turning function',
  'medial axis',
  'tier',
  'cascade',
  'distortion',
  'Sederberg',
  'Baxter',
  'Igarashi',
  'Floater',
  'Wasserstein',
];

function makeSignal(kind: ResolutionSignal['kind']): ResolutionSignal {
  switch (kind) {
    case 'tree-shape-mismatch':
      return { kind, level: 1, fromCount: 3, toCount: 1, fallbackName: 'radial-pop' };
    case 'distortion-floor-exceeded':
      return {
        kind,
        tier: 'arap-quality-wrap',
        estimate: 0.42,
        ceiling: 0.3,
        fallbackName: 'draw-replace',
      };
    case 'fillrule-conflict':
      return { kind, fromRule: 'nonzero', toRule: 'evenodd', fallbackName: 'radial-pop' };
    case 'open-closed-mismatch':
      return { kind, fallbackName: 'draw-replace' };
    case 'subpath-cardinality-mismatch':
      return { kind, from: 5, to: 1, fallbackName: 'scale-pop' };
  }
}

describe('signalToSentence', () => {
  test('returns null when the signal is null', () => {
    expect(signalToSentence(null)).toBeNull();
  });

  test('every signal kind has a translated sentence', () => {
    for (const kind of ALL_SIGNAL_KINDS) {
      const sentence = signalToSentence(makeSignal(kind));
      expect(sentence).not.toBeNull();
      expect(sentence!.length).toBeGreaterThan(0);
    }
  });

  test('every fallback has a designer-facing display name', () => {
    for (const name of ALL_FALLBACKS) {
      expect(FALLBACK_DISPLAY_NAME[name]).toBeTruthy();
      expect(FALLBACK_DISPLAY_NAME[name].length).toBeGreaterThan(0);
    }
  });

  test('translated sentences include the named fallback', () => {
    const signal = makeSignal('tree-shape-mismatch');
    const sentence = signalToSentence(signal)!;
    expect(sentence).toContain(FALLBACK_DISPLAY_NAME[signal.fallbackName]);
  });

  test('translated sentences contain no algorithm vocabulary', () => {
    for (const kind of ALL_SIGNAL_KINDS) {
      const sentence = signalToSentence(makeSignal(kind))!;
      for (const term of BANNED_TERMS) {
        if (sentence.toLowerCase().includes(term.toLowerCase())) {
          throw new Error(
            `signalToSentence(${kind}) leaks banned term "${term}":\n  ${sentence}`,
          );
        }
      }
    }
  });

  test('subpath-cardinality-mismatch references the actual counts', () => {
    const signal = makeSignal('subpath-cardinality-mismatch') as Extract<
      ResolutionSignal,
      { kind: 'subpath-cardinality-mismatch' }
    >;
    const sentence = signalToSentence(signal)!;
    expect(sentence).toContain(String(signal.from));
    expect(sentence).toContain(String(signal.to));
  });
});

describe('signalToDebugString', () => {
  test('returns null when the signal is null', () => {
    expect(signalToDebugString(null)).toBeNull();
  });

  test('debug strings carry the kind and the fallback name verbatim', () => {
    for (const kind of ALL_SIGNAL_KINDS) {
      const signal = makeSignal(kind);
      const debug = signalToDebugString(signal)!;
      expect(debug).toContain(kind);
      expect(debug).toContain(signal.fallbackName);
    }
  });
});
