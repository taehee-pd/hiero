import { describe, expect, it } from 'vitest';

import { getPaintFieldMode } from '@/lib/editor-core/paint-field-mode';

describe('getPaintFieldMode', () => {
  it('returns none when paint is fixed none for fill fields', () => {
    expect(getPaintFieldMode({ mode: 'fixed', value: 'none' }, true)).toBe('none');
  });

  it('returns none when paint is fixed none for stroke fields', () => {
    expect(getPaintFieldMode({ mode: 'fixed', value: 'none' }, false)).toBe('none');
  });

  it('maps currentColor to currentFill for fill fields', () => {
    expect(getPaintFieldMode({ mode: 'currentColor' }, true)).toBe('currentFill');
  });

  it('maps currentColor to currentColor for stroke fields', () => {
    expect(getPaintFieldMode({ mode: 'currentColor' }, false)).toBe('currentColor');
  });
});
