import { describe, expect, test } from 'bun:test';

import { getPaintFieldMode } from '@/lib/editor-core/paint-field-mode';

describe('getPaintFieldMode', () => {
  test('returns none when paint is fixed none for fill fields', () => {
    expect(getPaintFieldMode({ mode: 'fixed', value: 'none' }, true)).toBe('none');
  });

  test('returns none when paint is fixed none for stroke fields', () => {
    expect(getPaintFieldMode({ mode: 'fixed', value: 'none' }, false)).toBe('none');
  });

  test('maps currentColor to currentFill for fill fields', () => {
    expect(getPaintFieldMode({ mode: 'currentColor' }, true)).toBe('currentFill');
  });

  test('maps currentColor to currentColor for stroke fields', () => {
    expect(getPaintFieldMode({ mode: 'currentColor' }, false)).toBe('currentColor');
  });
});
