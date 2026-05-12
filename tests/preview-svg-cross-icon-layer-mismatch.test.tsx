// Regression: when a cross-icon transition has fewer source layers than
// target layers (e.g. Star → Home: 1 → 2), the resolver assigns the
// unmatched target layer a `fallback: 'replace-with-delay'`. The preview
// renderer used to handle only `fallback === 'fade-through'`, so the
// unmatched target layer was silently dropped — the rendered home icon
// was missing its `house` outline.

import './setup/happy-dom';

import { describe, expect, test } from 'bun:test';

import {
  applyTransitionPreview,
  clearTransitionPreview,
} from '@/lib/editor-renderer-svg/preview-svg';
import {
  resolveTransition,
  type TransitionConfig,
} from '@/lib/runtime-core';
import { SAMPLE_PROJECT } from '@/lib/schema/sample-project';
import type { LayerSnapshot } from '@/lib/schema/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

function snapshotForVariant(iconId: string): LayerSnapshot {
  const icon = SAMPLE_PROJECT.icons[iconId]!;
  const variant = icon.variants.v24!;
  return { layers: variant.layers ?? {} };
}

function mountSvg(snapshot: LayerSnapshot): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  for (const layer of Object.values(snapshot.layers)) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('data-layer-id', layer.id);
    path.setAttribute('d', layer.path!.d);
    svg.appendChild(path);
  }
  return svg;
}

describe('applyTransitionPreview — cross-icon layer-count mismatch', () => {
  test('renders an overlay for a target-only fade-in binding', () => {
    const fromSnapshot = snapshotForVariant('icon-star'); // 1 layer
    const toSnapshot = snapshotForVariant('icon-home'); // 2 layers

    const transition: TransitionConfig = {
      strategy: 'auto',
      durationMs: 240,
      easing: 'ease-in-out',
    };

    const resolved = resolveTransition(transition, fromSnapshot, toSnapshot, {
      crossIconContext: {
        sourceIconId: 'icon-star',
        sourceVariantId: 'v24',
        targetIconId: 'icon-home',
        targetVariantId: 'v24',
      },
    });

    // Confirm the resolver produced a target-only fade-in binding.
    const targetOnly = resolved.layerBindings.filter(
      (b) => b.toLayer && !b.fromLayer,
    );
    expect(targetOnly.length).toBeGreaterThan(0);
    const orphan = targetOnly[0]!;
    expect(orphan.fallback).toBe('replace-with-delay');
    expect(orphan.animationType).toBe('fade-in');
    expect(orphan.toLayer!.path?.d).toBeTruthy();

    const svg = mountSvg(fromSnapshot);

    applyTransitionPreview(svg, {
      baseState: fromSnapshot,
      targetState: toSnapshot,
      progress: 1,
      resolvedTransition: resolved,
      interpolatedValues: {},
      renderingMode: 'monochrome',
    });

    // The orphan target layer must now be rendered as an overlay path
    // tagged with its layer id.
    const overlay = svg.querySelector(
      `path[data-preview-layer-id="${orphan.toLayer!.id}"]`,
    ) as SVGPathElement | null;
    expect(overlay).not.toBeNull();
    expect(overlay!.getAttribute('d')).toBe(orphan.toLayer!.path!.d);
    expect(overlay!.style.opacity).toBe('1');

    clearTransitionPreview(svg, fromSnapshot);
    expect(
      svg.querySelector(`path[data-preview-layer-id="${orphan.toLayer!.id}"]`),
    ).toBeNull();
  });
});
