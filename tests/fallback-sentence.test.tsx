import './setup/happy-dom';
import './setup/react';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';

import { FallbackSentence } from '@/components/editor/FallbackSentence';
import { defaultMotionCurves } from '@/lib/runtime-core/motion-curves';
import type { MorphResolution } from '@/lib/runtime-core/morph-resolution';

afterEach(() => {
  cleanup();
});

const continuousResolution: MorphResolution = {
  interpolator: () => 'M0 0 L10 0 L10 10 L0 10 Z',
  motion: defaultMotionCurves('soft'),
  taxonomy: 'T1',
  tier: 'intrinsic-strict',
  distortion: 0.087,
  signal: null,
};

const fallbackResolution: MorphResolution = {
  interpolator: () => 'M0 0 L10 0 L10 10 L0 10 Z',
  motion: defaultMotionCurves('soft'),
  taxonomy: 'T8',
  tier: 'designed-fallback',
  distortion: 0,
  signal: {
    kind: 'distortion-floor-exceeded',
    tier: 'hierarchical-match',
    estimate: 0.74,
    ceiling: 0.5,
    fallbackName: 'draw-replace',
  },
};

test('renders nothing when the resolution has a null signal', () => {
  const { container } = render(<FallbackSentence resolution={continuousResolution} />);
  expect(container.innerHTML).toBe('');
});

test('renders nothing when the resolution itself is null', () => {
  const { container } = render(<FallbackSentence resolution={null} />);
  expect(container.innerHTML).toBe('');
});

test('renders the sentence with role=status and aria-live=polite', () => {
  const { getByRole } = render(<FallbackSentence resolution={fallbackResolution} />);
  const status = getByRole('status');
  expect(status.getAttribute('aria-live')).toBe('polite');
  expect(status.textContent).toContain('Draw Replace');
});

test('the sentence carries no algorithm vocabulary in plain rendered text', () => {
  const { getByRole } = render(<FallbackSentence resolution={fallbackResolution} />);
  const text = getByRole('status').textContent ?? '';
  // Mirrors the W1-U2 banned-vocabulary list. The whole point of
  // signalToSentence is that this sentence never leaks algorithm
  // vocabulary.
  for (const banned of [
    'Hungarian',
    'ARAP',
    'intrinsic',
    'contour tree',
    'turning function',
    'distortion floor',
    'cascade tier',
  ]) {
    expect(text.toLowerCase().includes(banned.toLowerCase())).toBe(false);
  }
});
