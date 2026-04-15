// Unit tests for useMarqueeSelection — Phase 4 Commit 3 follow-up.
//
// Characterization tests (char-marquee-*.test.tsx) prove the migrated
// call sites preserve drag-lifecycle behavior. These unit tests focus
// on two things the characterization tests can't cheaply exercise:
//
//   1. Hit-test math — with getBoundingClientRect stubbed on each
//      target, the hook's pointermove handler correctly computes the
//      intersecting subset.
//   2. Toggle vs replace mode — the base selection is preserved under
//      shift/meta, and hits toggle in/out of it.
//
// The hook is DOM-agnostic below its itemSelector / setSelection
// parameters, so we render a tiny harness that exposes the hook's
// event handlers on a real element and feeds it synthetic pointer
// events.

import './setup/happy-dom';
import './setup/react';

import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useRef, useState } from 'react';
import { useMarqueeSelection } from '@/lib/editor-hooks';

afterEach(() => { cleanup(); });


// The harness renders three targets at known rects and wires the hook
// to a local useState. It exposes the current selection as a data
// attribute so each test can read it back via DOM.
function Harness({ initialSelection = [] as string[] }: { initialSelection?: string[] }) {
  const [selection, setSelection] = useState<string[]>(initialSelection);
  const ref = useRef<HTMLDivElement>(null);

  const marquee = useMarqueeSelection({
    itemSelector: '[data-target-id]',
    itemIdAttribute: 'data-target-id',
    getCurrentSelection: () => selection,
    setSelection,
    containerRef: ref,
  });

  return (
    <div
      ref={ref}
      data-testid="root"
      data-selection={selection.join(',')}
      onPointerDown={marquee.onPointerDown}
      onPointerMove={marquee.onPointerMove}
      onPointerUp={marquee.onPointerUp}
    >
      {['a', 'b', 'c'].map((id, i) => {
        const x = i * 50;
        return (
          <div
            key={id}
            data-target-id={id}
            ref={(el) => {
              if (!el) return;
              el.getBoundingClientRect = () =>
                ({
                  left: x,
                  top: 0,
                  right: x + 30,
                  bottom: 30,
                  width: 30,
                  height: 30,
                  x,
                  y: 0,
                  toJSON() {
                    return {};
                  },
                }) as DOMRect;
            }}
          />
        );
      })}
      <div
        data-testid="marquee-rect"
        data-active={marquee.rect !== null ? 'true' : 'false'}
      />
    </div>
  );
}

function getSelection(root: HTMLElement): string[] {
  const raw = root.getAttribute('data-selection') ?? '';
  return raw ? raw.split(',') : [];
}

describe('useMarqueeSelection', () => {
  test('pointerdown on hit-test target is a no-op (drag does NOT start)', () => {
    const { getByTestId, container } = render(<Harness initialSelection={['a']} />);
    const root = getByTestId('root');
    const targetA = container.querySelector<HTMLElement>('[data-target-id="a"]')!;

    fireEvent.pointerDown(targetA, { button: 0, clientX: 5, clientY: 5 });

    // Marquee did NOT start → rect still null
    expect(getByTestId('marquee-rect').getAttribute('data-active')).toBe('false');
    // Initial selection untouched
    expect(getSelection(root)).toEqual(['a']);
  });

  test('pointerdown on container background (no modifier) clears selection and begins drag', () => {
    const { getByTestId } = render(<Harness initialSelection={['a', 'b']} />);
    const root = getByTestId('root');

    fireEvent.pointerDown(root, { button: 0, clientX: 500, clientY: 500 });

    expect(getSelection(root)).toEqual([]);
  });

  test('pointerdown + pointermove in replace mode updates selection to intersected hits', () => {
    const { getByTestId } = render(<Harness />);
    const root = getByTestId('root');

    fireEvent.pointerDown(root, { button: 0, clientX: 0, clientY: 0 });
    // Drag to x=150 — should hit targets at x=0..30 (a), 50..80 (b),
    // 100..130 (c). All three are inside 0..150.
    fireEvent.pointerMove(root, { clientX: 150, clientY: 30 });

    expect(getSelection(root).sort()).toEqual(['a', 'b', 'c']);
  });

  test('pointerdown with shift preserves base selection, pointermove toggles hits', () => {
    const { getByTestId } = render(<Harness initialSelection={['a']} />);
    const root = getByTestId('root');

    // The virtual grid has three 30×30 targets at x=0, 50, 100. To
    // hit ONLY 'b' (50..80) without sweeping 'a' or 'c', the drag
    // rect must live entirely inside x=50..80. Start pointer at
    // (50, 5), move to (60, 15) → rect = {50..60, 5..15} → only b.
    fireEvent.pointerDown(root, { button: 0, clientX: 50, clientY: 5, shiftKey: true });
    // Shift preserves the base. Selection is NOT cleared at start.
    expect(getSelection(root)).toEqual(['a']);

    fireEvent.pointerMove(root, { clientX: 60, clientY: 15, shiftKey: true });
    // Toggle mode: base {a}; hits = [b]; b not in base → add → {a, b}.
    expect(getSelection(root).sort()).toEqual(['a', 'b']);
  });

  test('pointerdown with shift toggles an already-selected hit OUT of the set', () => {
    const { getByTestId } = render(<Harness initialSelection={['a', 'b']} />);
    const root = getByTestId('root');

    // Same narrow-drag trick: hit ONLY 'b'. Base is {a, b}; b in
    // base → delete → {a}. Net result: only 'a' remains.
    fireEvent.pointerDown(root, { button: 0, clientX: 50, clientY: 5, shiftKey: true });
    fireEvent.pointerMove(root, { clientX: 60, clientY: 15, shiftKey: true });

    expect(getSelection(root).sort()).toEqual(['a']);
  });

  test('pointerup clears the live marquee rect', () => {
    const { getByTestId } = render(<Harness />);
    const root = getByTestId('root');

    fireEvent.pointerDown(root, { button: 0, clientX: 500, clientY: 500 });
    fireEvent.pointerMove(root, { clientX: 600, clientY: 600 });
    expect(getByTestId('marquee-rect').getAttribute('data-active')).toBe('true');

    fireEvent.pointerUp(root, { clientX: 600, clientY: 600 });
    expect(getByTestId('marquee-rect').getAttribute('data-active')).toBe('false');
  });

  test('non-primary button does not start a drag', () => {
    const { getByTestId } = render(<Harness initialSelection={['a']} />);
    const root = getByTestId('root');

    fireEvent.pointerDown(root, { button: 2, clientX: 500, clientY: 500 });

    expect(getSelection(root)).toEqual(['a']);
    expect(getByTestId('marquee-rect').getAttribute('data-active')).toBe('false');
  });
});
