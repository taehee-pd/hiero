// W4-7 Stage C tests for CorrespondencePinsOverlay.
//
// The overlay renders source + target as side-by-side mini-SVGs with
// vertex dots and lets the user pin a vertex pair via two clicks
// (source vertex → target vertex). These tests assert the click
// state machine and the integration with the pure pinVertex /
// unpinVertex helpers.

import './setup/happy-dom';
import './setup/react';

import { afterEach, describe, expect, test } from 'bun:test';
import React, { useState } from 'react';
import { cleanup, render, fireEvent } from '@testing-library/react';

import { CorrespondencePinsOverlay } from '@/components/editor/CorrespondencePinsOverlay';
import type {
  CorrespondenceHints,
  LayerSnapshot,
  PaintRef,
} from '@/lib/schema/types';

afterEach(() => {
  cleanup();
});

const FILL: PaintRef = { mode: 'fixed', value: '#000' };

function snapshotOf(d: string): LayerSnapshot {
  return {
    layers: {
      shape: {
        id: 'shape',
        path: { d },
        style: { fill: FILL },
        transform: { x: 0, y: 0 },
      },
    },
  };
}

const SQUARE_A = 'M0 0 L10 0 L10 10 L0 10 Z';
const SQUARE_B = 'M0 0 L20 0 L20 20 L0 20 Z';

function Harness({
  initialHints = { subpath: [], vertex: [] } as CorrespondenceHints,
  fromD = SQUARE_A,
  toD = SQUARE_B,
}: {
  initialHints?: CorrespondenceHints;
  fromD?: string;
  toD?: string;
}) {
  const [hints, setHints] = useState<CorrespondenceHints>(initialHints);
  return (
    <CorrespondencePinsOverlay
      sourceSnapshot={snapshotOf(fromD)}
      targetSnapshot={snapshotOf(toD)}
      hints={hints}
      onChange={setHints}
    />
  );
}

describe('CorrespondencePinsOverlay', () => {
  test('renders side-by-side previews when both snapshots have vertices', () => {
    const { container } = render(<Harness />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(2);
  });

  test('returns null when source has no vertices', () => {
    const { container } = render(<Harness fromD="" />);
    expect(container.querySelectorAll('svg').length).toBe(0);
  });

  test('renders one vertex circle per anchor on each side', () => {
    const { container } = render(<Harness />);
    // Source square has 4 vertices; same for target. Each circle
    // tagged via data-testid.
    const sourceVertices = container.querySelectorAll(
      '[data-testid^="vertex-source-"]',
    );
    const targetVertices = container.querySelectorAll(
      '[data-testid^="vertex-target-"]',
    );
    expect(sourceVertices.length).toBe(4);
    expect(targetVertices.length).toBe(4);
  });

  test('clicking source-vertex then target-vertex creates a pin', () => {
    const { container } = render(<Harness />);
    const srcV0 = container.querySelector(
      '[data-testid="vertex-source-subpath:0:0"]',
    )!;
    const tgtV1 = container.querySelector(
      '[data-testid="vertex-target-subpath:0:1"]',
    )!;
    fireEvent.click(srcV0);
    fireEvent.click(tgtV1);
    // After pinning, the pin chip is rendered.
    const chip = container.querySelector(
      '[aria-label^="Remove vertex pin"]',
    );
    expect(chip).not.toBeNull();
    expect(chip!.getAttribute('aria-label')).toContain('subpath:0:0');
    expect(chip!.getAttribute('aria-label')).toContain('subpath:0:1');
  });

  test('clicking only the source then unrelated target produces one pin', () => {
    const { container } = render(<Harness />);
    fireEvent.click(
      container.querySelector('[data-testid="vertex-source-subpath:0:2"]')!,
    );
    fireEvent.click(
      container.querySelector('[data-testid="vertex-target-subpath:0:3"]')!,
    );
    expect(
      container.querySelectorAll('[aria-label^="Remove vertex pin"]').length,
    ).toBe(1);
  });

  test('clicking a pinned source vertex unpins it', () => {
    const seeded: CorrespondenceHints = {
      subpath: [],
      vertex: [
        [
          { subpathId: 'subpath:0', vertexIndex: 0 },
          { subpathId: 'subpath:0', vertexIndex: 1 },
        ],
      ],
    };
    const { container } = render(<Harness initialHints={seeded} />);
    fireEvent.click(
      container.querySelector('[data-testid="vertex-source-subpath:0:0"]')!,
    );
    expect(
      container.querySelectorAll('[aria-label^="Remove vertex pin"]').length,
    ).toBe(0);
  });

  test('clicking the chip × button removes the pin', () => {
    const seeded: CorrespondenceHints = {
      subpath: [],
      vertex: [
        [
          { subpathId: 'subpath:0', vertexIndex: 0 },
          { subpathId: 'subpath:0', vertexIndex: 1 },
        ],
      ],
    };
    const { container } = render(<Harness initialHints={seeded} />);
    const removeBtn = container.querySelector(
      '[aria-label^="Remove vertex pin"]',
    )!;
    fireEvent.click(removeBtn);
    expect(
      container.querySelectorAll('[aria-label^="Remove vertex pin"]').length,
    ).toBe(0);
  });

  test('two pins receive distinct colors', () => {
    const { container } = render(<Harness />);
    fireEvent.click(
      container.querySelector('[data-testid="vertex-source-subpath:0:0"]')!,
    );
    fireEvent.click(
      container.querySelector('[data-testid="vertex-target-subpath:0:0"]')!,
    );
    fireEvent.click(
      container.querySelector('[data-testid="vertex-source-subpath:0:1"]')!,
    );
    fireEvent.click(
      container.querySelector('[data-testid="vertex-target-subpath:0:1"]')!,
    );
    const chips = container.querySelectorAll('[aria-label^="Remove vertex pin"]');
    expect(chips.length).toBe(2);
    // Each chip's preceding span carries an inline-style background;
    // the two should differ.
    const swatches = container.querySelectorAll(
      'li > span[aria-hidden="true"]',
    );
    expect(swatches.length).toBe(2);
    const colorA = (swatches[0] as HTMLElement).style.background;
    const colorB = (swatches[1] as HTMLElement).style.background;
    expect(colorA).not.toBe(colorB);
  });
});
