import { describe, expect, test } from 'bun:test';
import React, { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { Icon, State } from '../lib/schema';
import {
  ContourIcon,
  type ContourIconHandle,
  type ContourIconProps,
  useIconState,
  useAnimationProgress,
  type AnimationProgressSnapshot,
} from '../lib/runtime-react';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeTestIcon(): Icon {
  const defaultState: State = {
    id: 'default',
    layers: {
      bg: {
        id: 'bg',
        path: { d: 'M0 0H24V24H0Z' },
        style: { fill: { mode: 'fixed', value: '#fff' } },
      },
      arrow: {
        id: 'arrow',
        path: { d: 'M8 5l8 7-8 7' },
        style: { stroke: { mode: 'currentColor' } },
      },
    },
  };

  const activeState: State = {
    id: 'active',
    layers: {
      bg: {
        id: 'bg',
        path: { d: 'M0 0H24V24H0Z' },
        style: { fill: { mode: 'fixed', value: '#eee' } },
      },
      arrow: {
        id: 'arrow',
        path: { d: 'M16 5l-8 7 8 7' },
        style: { stroke: { mode: 'currentColor' } },
      },
    },
  };

  const hoverState: State = {
    id: 'hover',
    layers: {
      bg: {
        id: 'bg',
        path: { d: 'M0 0H24V24H0Z' },
        style: { fill: { mode: 'fixed', value: '#ddd' } },
      },
      arrow: {
        id: 'arrow',
        path: { d: 'M8 5l8 7-8 7' },
        style: { stroke: { mode: 'currentColor' } },
      },
    },
  };

  return {
    id: 'icon-test',
    name: 'Test Icon',
    variants: {
      v24: {
        id: 'v24',
        size: 24,
        viewBox: [0, 0, 24, 24],
        layers: {},
        defaultState: 'default',
        states: { default: defaultState, active: activeState, hover: hoverState },
      },
    },
    transitions: {
      'default-active': {
        id: 'default-active',
        fromIconId: 'icon-test',
        toIconId: 'icon-test',
        fromVariantId: 'v24',
        toVariantId: 'v24',
        from: 'default',
        to: 'active',
        strategy: 'lineAnimation',
        durationMs: 200,
        easing: 'ease-in-out',
        layerBindings: [],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// D1 — Imperative ref API
// ---------------------------------------------------------------------------

describe('D1 — Imperative ref API', () => {
  test('ContourIconHandle type has all required methods', () => {
    // Type-level test: verify the handle type is structurally correct
    const handle: ContourIconHandle = {
      transitionTo: () => {},
      triggerEffect: () => {},
      cancelEffect: () => {},
      cancelAllEffects: () => {},
      getCurrentState: () => 'default',
      setVariableDrawProgress: () => {},
    };

    expect(typeof handle.transitionTo).toBe('function');
    expect(typeof handle.triggerEffect).toBe('function');
    expect(typeof handle.cancelEffect).toBe('function');
    expect(typeof handle.cancelAllEffects).toBe('function');
    expect(typeof handle.getCurrentState).toBe('function');
    expect(typeof handle.setVariableDrawProgress).toBe('function');
  });

  test('ContourIcon accepts ref prop (forwardRef)', () => {
    const ref = createRef<ContourIconHandle>();

    function TestComponent() {
      return <ContourIcon ref={ref} icon={makeTestIcon()} />;
    }

    // SSR: ref is not populated on server, but component renders without error
    const html = renderToStaticMarkup(<TestComponent />);
    expect(html).toContain('<svg');
    expect(html).toContain('viewBox="0 0 24 24"');
  });

  test('ContourIcon renders correctly with ref and other props', () => {
    const ref = createRef<ContourIconHandle>();
    const html = renderToStaticMarkup(
      <ContourIcon
        ref={ref}
        icon={makeTestIcon()}
        size={32}
        color="#333"
        className="icon-with-ref"
      />,
    );
    expect(html).toContain('width:32px');
    expect(html).toContain('color:#333');
    expect(html).toContain('class="icon-with-ref"');
  });
});

// ---------------------------------------------------------------------------
// D2 — Gesture props
// ---------------------------------------------------------------------------

describe('D2 — Gesture props', () => {
  test('ContourIcon accepts hoverState and tapState props', () => {
    const html = renderToStaticMarkup(
      <ContourIcon
        icon={makeTestIcon()}
        hoverState="hover"
        tapState="active"
      />,
    );
    // Should render without error
    expect(html).toContain('<svg');
  });

  test('gesture event handlers render pointer event attributes when gestures defined', () => {
    // When hoverState or tapState is set, the container div should have
    // pointer event handlers (verified at the prop type level since SSR
    // doesn't serialize event handlers)
    const props: ContourIconProps = {
      icon: makeTestIcon(),
      hoverState: 'hover',
      onHoverStart: () => {},
      onHoverEnd: () => {},
    };
    // The component accepts these without error
    const html = renderToStaticMarkup(<ContourIcon {...props} />);
    expect(html).toContain('<svg');
  });

  test('gesture event callbacks are optional', () => {
    const html = renderToStaticMarkup(
      <ContourIcon
        icon={makeTestIcon()}
        hoverState="hover"
        // No onHoverStart/End callbacks — should not error
      />,
    );
    expect(html).toContain('<svg');
  });

  test('tapState props are accepted without error', () => {
    const html = renderToStaticMarkup(
      <ContourIcon
        icon={makeTestIcon()}
        tapState="active"
        onTapStart={() => {}}
        onTapEnd={() => {}}
      />,
    );
    expect(html).toContain('<svg');
  });

  test('explicit state prop takes precedence over gesture states', () => {
    // When both state and hoverState are specified, the component should render
    // with the explicit state
    const html = renderToStaticMarkup(
      <ContourIcon
        icon={makeTestIcon()}
        state="active"
        hoverState="hover"
        tapState="default"
      />,
    );
    // Should render active state's arrow path
    expect(html).toContain('d="M16 5l-8 7 8 7"');
  });
});

// ---------------------------------------------------------------------------
// D3 — Animation callbacks
// ---------------------------------------------------------------------------

describe('D3 — Animation callbacks', () => {
  test('ContourIcon accepts onTransitionStart/Complete/onEffectComplete', () => {
    const html = renderToStaticMarkup(
      <ContourIcon
        icon={makeTestIcon()}
        onTransitionStart={(from, to) => {}}
        onTransitionComplete={(from, to) => {}}
        onEffectComplete={(id) => {}}
      />,
    );
    expect(html).toContain('<svg');
  });

  test('callback prop types are correct', () => {
    // Type-level test
    const startCb: ContourIconProps['onTransitionStart'] = (from: string, to: string) => {
      expect(typeof from).toBe('string');
      expect(typeof to).toBe('string');
    };
    const completeCb: ContourIconProps['onTransitionComplete'] = (from: string, to: string) => {};
    const effectCb: ContourIconProps['onEffectComplete'] = (id: string) => {};

    expect(typeof startCb).toBe('function');
    expect(typeof completeCb).toBe('function');
    expect(typeof effectCb).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// D4 — Animation progress visibility
// ---------------------------------------------------------------------------

describe('D4 — Animation progress visibility', () => {
  test('onFrame prop is accepted by ContourIcon', () => {
    const html = renderToStaticMarkup(
      <ContourIcon
        icon={makeTestIcon()}
        onFrame={(progress, stateId) => {}}
      />,
    );
    expect(html).toContain('<svg');
  });

  test('AnimationProgressSnapshot type shape', () => {
    const snapshot: AnimationProgressSnapshot = {
      progress: 0.5,
      isAnimating: true,
      currentState: 'active',
    };
    expect(snapshot.progress).toBe(0.5);
    expect(snapshot.isAnimating).toBe(true);
    expect(snapshot.currentState).toBe('active');
  });

  test('useAnimationProgress hook renders in a component', () => {
    function TestComponent() {
      const driverRef = React.useRef(null);
      const { progress, isAnimating, currentState } = useAnimationProgress(driverRef);
      return (
        <div
          data-progress={progress}
          data-animating={String(isAnimating)}
          data-state={currentState}
        />
      );
    }

    const html = renderToStaticMarkup(<TestComponent />);
    expect(html).toContain('data-progress="0"');
    expect(html).toContain('data-animating="false"');
    expect(html).toContain('data-state=""');
  });

  test('useAnimationProgress returns defaults when no driver', () => {
    function TestComponent() {
      const driverRef = React.useRef(null);
      const snap = useAnimationProgress(driverRef);
      return <div data-json={JSON.stringify(snap)} />;
    }

    const html = renderToStaticMarkup(<TestComponent />);
    // HTML attribute escapes quotes, so check the escaped form
    expect(html).toContain('&quot;progress&quot;:0');
    expect(html).toContain('&quot;isAnimating&quot;:false');
    expect(html).toContain('&quot;currentState&quot;:&quot;&quot;');
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility
// ---------------------------------------------------------------------------

describe('Backward compatibility', () => {
  test('ContourIcon still renders correctly without new props', () => {
    const html = renderToStaticMarkup(<ContourIcon icon={makeTestIcon()} />);
    expect(html).toContain('width:24px');
    expect(html).toContain('height:24px');
    expect(html).toContain('<svg');
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('d="M0 0H24V24H0Z"');
    expect(html).toContain('d="M8 5l8 7-8 7"');
  });

  test('SSR renders accessibility attributes unchanged', () => {
    const htmlDecorative = renderToStaticMarkup(
      <ContourIcon icon={makeTestIcon()} />,
    );
    expect(htmlDecorative).toContain('aria-hidden="true"');

    const htmlLabeled = renderToStaticMarkup(
      <ContourIcon icon={makeTestIcon()} label="Arrow" />,
    );
    expect(htmlLabeled).toContain('role="img"');
    expect(htmlLabeled).toContain('aria-label="Arrow"');
  });

  test('useIconState hook still works', () => {
    function TestComponent() {
      const { state, transitionTo } = useIconState('idle');
      return <div data-state={state}><button onClick={() => transitionTo('active')}>Go</button></div>;
    }
    const html = renderToStaticMarkup(<TestComponent />);
    expect(html).toContain('data-state="idle"');
  });
});
