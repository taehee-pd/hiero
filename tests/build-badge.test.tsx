// Render-time test for BuildBadge.
//
// The env-driven semantics of channel + version live in build-flags.test.ts
// and build-version.test.ts. This file only proves the badge renders the
// values it was given — the wiring between BUILD_VERSION and the DOM.
// Uses `container.querySelector` (not `screen.*`) per the repo convention
// in tests/char-inline-rename-iconGridItem.test.tsx — `screen` binds to
// document.body at module load and doesn't compose cleanly with this
// repo's happy-dom setup.

import './setup/happy-dom';
import './setup/react';

import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';

import { BuildBadge } from '@/components/studio/BuildBadge';
import { BUILD_VERSION } from '@/lib/build-version';
import { BUILD_CHANNEL } from '@/lib/build-flags';

afterEach(() => {
  cleanup();
});

describe('<BuildBadge>', () => {
  test('renders with a testid and declares its channel via data attribute', () => {
    const { container } = render(<BuildBadge />);
    const badge = container.querySelector('[data-testid="build-badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('data-build-channel')).toBe(BUILD_CHANNEL);
  });

  test('always shows the app version in its visible text', () => {
    const { container } = render(<BuildBadge />);
    const badge = container.querySelector('[data-testid="build-badge"]');
    expect(badge?.textContent).toContain(BUILD_VERSION.app);
  });

  test('hover tooltip is non-empty so screenshots are self-describing', () => {
    const { container } = render(<BuildBadge />);
    const badge = container.querySelector('[data-testid="build-badge"]');
    const title = badge?.getAttribute('title') ?? '';
    expect(title.length).toBeGreaterThan(0);
    expect(title).toContain(BUILD_VERSION.app);
    expect(title).toContain(BUILD_VERSION.channel);
  });
});
