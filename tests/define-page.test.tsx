// @happy-dom
import { describe, expect, mock, test } from 'bun:test';
import { isValidElement } from 'react';

import { definePage } from '../lib/routes/define-page';

// Stub the next/navigation hooks that EditorRedirect calls in useEffect; we
// only need the JSX it returns, not the side effect.
mock.module('next/navigation', () => ({
  useRouter: () => ({ replace: () => {} }),
}));

describe('definePage', () => {
  test('shell route returns the registered shell component', () => {
    const tree = definePage({ route: '/' });
    expect(isValidElement(tree)).toBe(true);
  });

  test('redirect route returns an element (the EditorRedirect component)', () => {
    const tree = definePage({ route: '/editor' });
    expect(isValidElement(tree)).toBe(true);
  });

  test('redirect route forwards iconId through to the redirect component', () => {
    const tree = definePage({ route: '/editor/[iconId]', iconId: 'icon-home' });
    expect(isValidElement(tree)).toBe(true);
    if (isValidElement(tree)) {
      // Component identity is structural — assert the iconId prop survives.
      expect((tree.props as { iconId?: string }).iconId).toBe('icon-home');
    }
  });

  test('standalone route returns the children verbatim', () => {
    const child = <span data-testid="child">demo</span>;
    const tree = definePage({ route: '/runtime-demo', children: child });
    expect(tree).toBe(child);
  });

  test('standalone route without children throws a clear error', () => {
    // The discriminant doesn't statically forbid this call (the union's first
    // arm allows route+no-children), so the runtime guard inside definePage
    // is what catches it. That guard exists specifically for this case.
    expect(() => definePage({ route: '/runtime-demo' })).toThrow(/standalone/);
  });
});
