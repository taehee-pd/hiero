import { describe, expect, test } from 'bun:test';

import type { CompiledIcon } from '../lib/compiler-contracts';
import { isIconChangeRecord } from '../lib/compiler-contracts';
import { diffCompiledIcons } from '../lib/export/diff-compiled-icons';
import compiledIconFixture from './fixtures/compiler-contracts/compiled-icon.json';

function makeBase(): CompiledIcon {
  return structuredClone(compiledIconFixture) as unknown as CompiledIcon;
}

describe('diffCompiledIcons', () => {
  test('detects pure geometry update', () => {
    const previous = makeBase();
    const next = makeBase();
    next.variants['24'].states.default.modes.monochrome.layers[0].path.d = 'M9 5l7 7-7 7';

    const record = diffCompiledIcons(previous, next, {
      publishedAt: '2026-03-10T00:00:00.000Z',
    });

    expect(record.changes.some((change) => change.kind === 'geometry')).toBeTrue();
    expect(record.changes.every((change) => change.kind !== 'style')).toBeTrue();
    expect(record.bump).toBe('patch');
    expect(isIconChangeRecord(record)).toBeTrue();
  });

  test('detects pure style update', () => {
    const previous = makeBase();
    const next = makeBase();
    next.variants['24'].states.default.modes.monochrome.layers[0].style.strokeWidth = 2;

    const record = diffCompiledIcons(previous, next, {
      publishedAt: '2026-03-10T00:00:00.000Z',
    });

    expect(record.changes.some((change) => change.kind === 'style')).toBeTrue();
    expect(record.changes.every((change) => change.kind !== 'geometry')).toBeTrue();
    expect(record.bump).toBe('patch');
  });

  test('detects additive state/variant/mode/effect changes', () => {
    const previous = makeBase();
    previous.transitions = [];
    previous.effects = [];
    delete (previous.variants['24'].states.default.modes as any).palette;

    const next = makeBase();
    next.variants['24'].states.active = structuredClone(next.variants['24'].states.default);
    next.variants['32'] = {
      size: 32,
      viewBox: [0, 0, 32, 32],
      states: {
        default: structuredClone(next.variants['24'].states.default),
      },
    };
    next.effects = [
      {
        kind: 'pulse',
        durationMs: 300,
        easing: 'linear',
      },
    ];

    const record = diffCompiledIcons(previous, next, {
      publishedAt: '2026-03-10T00:00:00.000Z',
    });

    expect(record.changes.some((change) => change.kind === 'state-added')).toBeTrue();
    expect(record.changes.some((change) => change.kind === 'variant-added')).toBeTrue();
    expect(record.changes.some((change) => change.kind === 'mode-added')).toBeTrue();
    expect(record.changes.some((change) => change.kind === 'effect-added')).toBeTrue();
    expect(record.changes.some((change) => change.kind === 'animation-added')).toBeTrue();
    expect(record.bump).toBe('minor');
  });

  test('detects removed state/variant/mode as breaking', () => {
    const previous = makeBase();
    previous.variants['24'].states.active = structuredClone(previous.variants['24'].states.default);
    previous.variants['32'] = {
      size: 32,
      viewBox: [0, 0, 32, 32],
      states: {
        default: structuredClone(previous.variants['24'].states.default),
      },
    };

    const next = makeBase();
    delete (next.variants['24'].states.default.modes as any).palette;

    const record = diffCompiledIcons(previous, next, {
      publishedAt: '2026-03-10T00:00:00.000Z',
    });

    expect(record.changes.some((change) => change.kind === 'state-removed')).toBeTrue();
    expect(record.changes.some((change) => change.kind === 'variant-removed')).toBeTrue();
    expect(record.changes.some((change) => change.kind === 'mode-removed')).toBeTrue();
    expect(record.isBreaking).toBeTrue();
    expect(record.bump).toBe('major');
  });

  test('detects animation changed', () => {
    const previous = makeBase();
    const next = makeBase();
    next.transitions[0].durationMs = previous.transitions[0].durationMs + 10;

    const record = diffCompiledIcons(previous, next, {
      publishedAt: '2026-03-10T00:00:00.000Z',
    });

    expect(record.changes.some((change) => change.kind === 'animation-changed')).toBeTrue();
  });

  test('detects metadata-only updates', () => {
    const previous = makeBase();
    const next = makeBase();
    next.name = 'Chevron Forward';
    next.componentName = 'IcChevronForward';
    next.meta.category = 'arrows';
    next.meta.tags = ['arrow', 'forward'];

    const record = diffCompiledIcons(previous, next, {
      publishedAt: '2026-03-10T00:00:00.000Z',
    });

    expect(record.changes).toHaveLength(1);
    expect(record.changes[0]?.kind).toBe('metadata');
    expect(record.bump).toBe('patch');
  });

  test('applies manual breaking override and designerNote', () => {
    const previous = makeBase();
    const next = makeBase();
    next.name = 'Chevron Forward';

    const record = diffCompiledIcons(previous, next, {
      publishedAt: '2026-03-10T00:00:00.000Z',
      breakingOverride: true,
      designerNote: 'Renamed for platform convention.',
    });

    expect(record.isBreaking).toBeTrue();
    expect(record.designerNote).toBe('Renamed for platform convention.');
    expect(record.changes.some((change) => change.kind === 'breaking')).toBeTrue();
    expect(record.bump).toBe('major');
  });

  test('derives bump as major/minor/patch', () => {
    const base = makeBase();

    const patchRecord = diffCompiledIcons(base, {
      ...structuredClone(base),
      name: 'Chevron Forward',
    }, { publishedAt: '2026-03-10T00:00:00.000Z' });

    const minorPrev = structuredClone(base);
    minorPrev.transitions = [];
    minorPrev.effects = [];
    const minorNext = structuredClone(base);
    minorNext.effects = [{ kind: 'pulse', durationMs: 200, easing: 'linear' }];
    const minorRecord = diffCompiledIcons(minorPrev, minorNext, {
      publishedAt: '2026-03-10T00:00:00.000Z',
    });

    const majorPrev = structuredClone(base);
    majorPrev.variants['24'].states.active = structuredClone(
      majorPrev.variants['24'].states.default,
    );
    const majorRecord = diffCompiledIcons(majorPrev, structuredClone(base), {
      publishedAt: '2026-03-10T00:00:00.000Z',
    });

    expect(patchRecord.bump).toBe('patch');
    expect(minorRecord.bump).toBe('minor');
    expect(majorRecord.bump).toBe('major');
  });
});
