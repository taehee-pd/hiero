/**
 * B1 — bundled example icons (docs_canonical/IMPROVEMENT_BACKLOG.md).
 *
 * The examples are the first-run teaching content: the morph pair must
 * reference each other correctly and the draw effects must sit on
 * stroked open paths, or the demos silently degrade.
 */
import { describe, expect, test } from 'bun:test';

import { EXAMPLE_ICONS } from '../lib/schema/example-icons';
import { SAMPLE_PROJECT } from '../lib/schema/sample-project';

describe('example icons (B1)', () => {
  test('ship inside the starter project', () => {
    for (const icon of EXAMPLE_ICONS) {
      expect(SAMPLE_PROJECT.icons[icon.id]).toBeDefined();
    }
  });

  test('cross-icon transitions reference icons and variants that exist', () => {
    const byId = new Map(EXAMPLE_ICONS.map((icon) => [icon.id, icon]));
    for (const icon of EXAMPLE_ICONS) {
      for (const transition of Object.values(icon.transitions ?? {})) {
        expect(transition.fromIconId).toBe(icon.id);
        const target = byId.get(transition.toIconId);
        expect(target).toBeDefined();
        expect(icon.variants[transition.fromVariantId]).toBeDefined();
        expect(target!.variants[transition.toVariantId]).toBeDefined();
        // Preview loop divides by durationMs; keep both duration fields sane.
        expect(transition.durationMs).toBeGreaterThan(0);
        expect(transition.duration).toBeGreaterThan(0);
      }
    }
  });

  test('the play⇄pause morph pair is symmetric', () => {
    const play = EXAMPLE_ICONS.find((i) => i.id === 'example-play')!;
    const pause = EXAMPLE_ICONS.find((i) => i.id === 'example-pause')!;
    expect(play.transitions?.['to-pause']?.toIconId).toBe(pause.id);
    expect(pause.transitions?.['to-play']?.toIconId).toBe(play.id);
  });

  test('draw effects sit on stroked open paths', () => {
    for (const icon of EXAMPLE_ICONS) {
      for (const effect of Object.values(icon.effects ?? {})) {
        if (effect.kind !== 'draw') continue;
        const variant = Object.values(icon.variants)[0]!;
        for (const layer of Object.values(variant.layers)) {
          // Draw animates stroke trim: the path must not be closed and
          // must carry a stroke.
          expect(layer.path?.d.trim().toLowerCase().endsWith('z')).toBe(false);
          expect(layer.style.stroke).toBeDefined();
        }
        expect(effect.drawConfig?.mode).toBeDefined();
      }
    }
  });
});
