// Render-time test for BuildBadge.
//
// The env-driven semantics of channel + version live in build-flags.test.ts
// and build-version.test.ts. This file exercises BOTH the wired-up
// component (BuildBadge — picks up whatever BUILD_VERSION resolves to in
// the test process) and the pure presenter (BuildBadgeView — accepts
// explicit values, lets us assert public vs internal divergence without
// require.cache gymnastics that don't compose with happy-dom).
//
// Uses container.querySelector (not screen.*) per the repo convention in
// tests/char-inline-rename-iconGridItem.test.tsx — screen binds to
// document.body at module load and doesn't survive happy-dom setup.

import './setup/happy-dom';
import './setup/react';

import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';

import { BuildBadge, BuildBadgeView } from '@/components/studio/BuildBadge';
import { BUILD_VERSION } from '@/lib/build-version';

afterEach(() => {
  cleanup();
});

describe('<BuildBadge> (wired to BUILD_VERSION)', () => {
  test('renders with a testid and declares its channel via data attribute', () => {
    const { container } = render(<BuildBadge />);
    const badge = container.querySelector('[data-testid="build-badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute('data-build-channel')).toBe(BUILD_VERSION.channel);
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

describe('<BuildBadgeView> (pure presenter, both channels)', () => {
  test('public branch shows only the app version, no commit, no channel name', () => {
    const { container } = render(
      <BuildBadgeView
        channel="public"
        app="1.2.3"
        commit="abc1234"
        tooltip="public · v1.2.3 · abc1234"
      />,
    );
    const badge = container.querySelector('[data-testid="build-badge"]');
    expect(badge?.getAttribute('data-build-channel')).toBe('public');
    expect(badge?.textContent).toBe('v1.2.3');
    // Defensive: the commit hash MUST NOT appear in the public chip's
    // visible text. If a refactor swaps the public/internal markup, this
    // test catches it before users see cryptic SHAs in production.
    expect(badge?.textContent).not.toContain('abc1234');
    expect(badge?.textContent).not.toContain('internal');
  });

  test('internal branch surfaces channel + version + commit inline', () => {
    const { container } = render(
      <BuildBadgeView
        channel="internal"
        app="1.2.3"
        commit="abc1234"
        tooltip="internal · v1.2.3 · abc1234"
      />,
    );
    const badge = container.querySelector('[data-testid="build-badge"]');
    expect(badge?.getAttribute('data-build-channel')).toBe('internal');
    expect(badge?.textContent).toContain('internal');
    expect(badge?.textContent).toContain('v1.2.3');
    expect(badge?.textContent).toContain('abc1234');
  });

  test('internal branch uses amber styling distinct from public', () => {
    const { container: pub } = render(
      <BuildBadgeView channel="public" app="1.0.0" commit="x" tooltip="x" />,
    );
    const { container: internal } = render(
      <BuildBadgeView channel="internal" app="1.0.0" commit="x" tooltip="x" />,
    );
    const pubClass = pub.querySelector('[data-testid="build-badge"]')?.getAttribute('class') ?? '';
    const internalClass = internal.querySelector('[data-testid="build-badge"]')?.getAttribute('class') ?? '';
    expect(internalClass).toContain('amber');
    expect(pubClass).not.toContain('amber');
  });

  test('hover tooltip is rendered verbatim on both branches', () => {
    for (const channel of ['public', 'internal'] as const) {
      const { container } = render(
        <BuildBadgeView
          channel={channel}
          app="1.0.0"
          commit="x"
          tooltip="full version triple here"
        />,
      );
      const badge = container.querySelector('[data-testid="build-badge"]');
      expect(badge?.getAttribute('title')).toBe('full version triple here');
      cleanup();
    }
  });
});
