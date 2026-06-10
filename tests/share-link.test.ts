/**
 * C1 — share-link codec (docs_canonical/IMPROVEMENT_BACKLOG.md).
 *
 * The link IS the document: the codec must round-trip any authored
 * icon (including unicode names) and treat every malformed fragment as
 * "broken link", never as an exception.
 */
import { describe, expect, test } from 'bun:test';

import {
  buildShareUrl,
  decodeSharePayload,
  encodeSharePayload,
} from '../lib/platform/share-link';
import { EXAMPLE_PLAY_ICON, EXAMPLE_CHECK_ICON } from '../lib/schema/example-icons';

describe('share-link codec (C1)', () => {
  test('round-trips an icon with transitions', () => {
    const encoded = encodeSharePayload({ v: 1, icon: EXAMPLE_PLAY_ICON });
    const decoded = decodeSharePayload(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.icon).toEqual(EXAMPLE_PLAY_ICON);
  });

  test('round-trips colors and unicode names', () => {
    const icon = { ...EXAMPLE_CHECK_ICON, name: 'Häkchen ✓ 체크' };
    const decoded = decodeSharePayload(
      encodeSharePayload({ v: 1, icon, colors: { accent: '#a885f2' } }),
    );
    expect(decoded!.icon.name).toBe('Häkchen ✓ 체크');
    expect(decoded!.colors).toEqual({ accent: '#a885f2' });
  });

  test('accepts a leading # (location.hash form)', () => {
    const encoded = encodeSharePayload({ v: 1, icon: EXAMPLE_CHECK_ICON });
    expect(decodeSharePayload(`#${encoded}`)).not.toBeNull();
  });

  test('rejects garbage, wrong versions, and structurally invalid payloads', () => {
    expect(decodeSharePayload('')).toBeNull();
    expect(decodeSharePayload('#')).toBeNull();
    expect(decodeSharePayload('not-base64!!!')).toBeNull();
    expect(decodeSharePayload(btoa('"just a string"'))).toBeNull();
    expect(decodeSharePayload(btoa(JSON.stringify({ v: 2, icon: EXAMPLE_CHECK_ICON })))).toBeNull();
    expect(decodeSharePayload(btoa(JSON.stringify({ v: 1, icon: { id: 'x' } })))).toBeNull();
    expect(
      decodeSharePayload(
        btoa(JSON.stringify({ v: 1, icon: { id: 'x', name: 'X', variants: {} } })),
      ),
    ).toBeNull();
  });

  test('buildShareUrl produces /share fragment URLs', () => {
    const url = buildShareUrl('https://hiero.app', { v: 1, icon: EXAMPLE_CHECK_ICON });
    expect(url.startsWith('https://hiero.app/share#')).toBe(true);
    expect(decodeSharePayload(new URL(url).hash)).not.toBeNull();
  });
});
