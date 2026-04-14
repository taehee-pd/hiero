import { describe, expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { RuntimeSvgRenderer } from '../lib/runtime-dom/snapshot-renderer';
import type { RuntimeSnapshot } from '../lib/runtime-core/store';
import { SAMPLE_RUNTIME_EXPORT } from '../lib/runtime-react/demo-fixture';
import { Icon } from '../lib/runtime-react/icon';
import { useIcon } from '../lib/runtime-react/use-icon';

const payload = SAMPLE_RUNTIME_EXPORT.variant;

describe('runtime react phase 4 integration', () => {
  test('controlled Icon renders prop-driven state and effect markers', () => {
    const svg = renderToStaticMarkup(
      <Icon
        payload={payload}
        state="active"
        transition={false}
        effect="drawOn"
        size={96}
        title="Controlled icon"
      />,
    );

    expect(svg).toContain('data-runtime-state="active"');
    expect(svg).toContain('M7 5l7 7-7 7');
  });

  test('useIcon supports uncontrolled initialization through the hook surface', () => {
    function Harness() {
      const runtime = useIcon({
        payload,
        defaultType: 'active',
        transition: false,
      });

      return (
        <RuntimeSvgRenderer
          snapshot={runtime.snapshot}
          size={96}
          data-runtime-state={runtime.currentTypeId}
          data-available-states={runtime.availableTypes.join(',')}
        />
      );
    }

    const svg = renderToStaticMarkup(<Harness />);

    expect(svg).toContain('data-runtime-state="active"');
    expect(svg).toContain('data-available-states="active,default"');
    expect(svg).toContain('M7 5l7 7-7 7');
  });

  test('duplicate snapshot layers get unique defs ids through their snapshot keys', () => {
    const snapshot: RuntimeSnapshot = {
      stateId: 'active',
      viewBox: [0, 0, 24, 24],
      layers: [
        {
          key: 'from:chevron',
          id: 'chevron',
          d: 'M9.5 7l5 5-5 5',
          fill: {
            kind: 'linearGradient',
            angle: 0,
            stops: [
              { offset: 0, color: '#111111' },
              { offset: 1, color: '#eeeeee' },
            ],
          },
          stroke: { kind: 'none' },
          opacity: 1,
          clipPath: {
            d: 'M2 2 H12 V12 H2 Z',
            fillRule: 'evenodd',
          },
        },
        {
          key: 'to:chevron',
          id: 'chevron',
          d: 'M7 5l7 7-7 7',
          fill: {
            kind: 'linearGradient',
            angle: 90,
            stops: [
              { offset: 0, color: '#38bdf8' },
              { offset: 1, color: '#0ea5e9' },
            ],
          },
          stroke: { kind: 'none' },
          opacity: 1,
          clipPath: {
            d: 'M3 3 H13 V13 H3 Z',
            fillRule: 'evenodd',
          },
        },
      ],
    };

    const svg = renderToStaticMarkup(
      <RuntimeSvgRenderer snapshot={snapshot} size={24} title="Keyed defs test" />,
    );

    expect(svg).toContain('from:chevron-fill');
    expect(svg).toContain('to:chevron-fill');
    expect(svg).toContain('from:chevron-clip');
    expect(svg).toContain('to:chevron-clip');
    expect(svg).toContain('url(#');
  });
});
