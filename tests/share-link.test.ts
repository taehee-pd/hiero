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

  // Size guard: raw fragment longer than 700_000 chars is rejected before decode.
  test('rejects oversized raw fragment (> 700_000 chars) → null', () => {
    const oversized = 'A'.repeat(700_001);
    expect(decodeSharePayload(oversized)).toBeNull();
  });

  // Size guard: decoded JSON larger than 512 KB is rejected before JSON.parse.
  test('rejects payload whose decoded JSON exceeds 512 KB → null', () => {
    // Build a JSON string whose length exceeds 512 * 1024 bytes.
    // We use a valid v1 shell but stuff a massive string into it.
    const bigString = 'x'.repeat(513 * 1024);
    const json = JSON.stringify({ v: 1, icon: bigString });
    // Use TextEncoder-safe base64url so the raw fragment passes the size check
    // (base64 expands by ~4/3; 513 KB JSON → ~700 KB base64 — would normally
    // fail the raw check too, so we encode only what we need).
    // Instead, build a JSON that is just barely over the limit (513 KB decoded).
    const justOver = 'y'.repeat(512 * 1024 + 1);
    const json2 = JSON.stringify({ v: 1, icon: justOver });
    const bytes2 = new TextEncoder().encode(json2);
    let binary = '';
    for (const b of bytes2) binary += String.fromCharCode(b);
    const encoded2 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeSharePayload(encoded2)).toBeNull();
  });

  // Depth guard: object nesting deeper than 64 levels is rejected after parse.
  test('rejects object nesting depth > 64 → null', () => {
    // Build an object nested 66 levels deep.
    let obj: unknown = 'leaf';
    for (let i = 0; i < 66; i++) obj = { child: obj };
    const json = JSON.stringify({ v: 1, icon: obj });
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeSharePayload(encoded)).toBeNull();
  });
});
