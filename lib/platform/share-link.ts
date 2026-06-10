/**
 * C1 — shareable read-only preview links
 * (docs_canonical/IMPROVEMENT_BACKLOG.md).
 *
 * A share link carries the entire authored icon in the URL fragment:
 *
 *   https://hiero.app/share#<base64url(JSON payload)>
 *
 * The fragment never reaches the server (no storage, no expiry, no
 * account), which is exactly the point: a designer can paste the link
 * in Slack and the recipient plays the icon's variants and effects in
 * the read-only `/share` viewer. Payloads are a few KB for typical
 * icons — well inside modern URL limits, though very complex icons may
 * exceed what some chat apps unfurl.
 */

import type { Icon } from '@/lib/schema/types';

export type SharePayload = {
  /** Format version — bump when the shape changes. */
  v: 1;
  icon: Icon;
  /** Project color tokens the icon's styles may reference. */
  colors?: Record<string, string>;
};

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string | null {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function encodeSharePayload(payload: SharePayload): string {
  return toBase64Url(JSON.stringify(payload));
}

/**
 * Decode and structurally validate a share fragment. Returns null for
 * anything that isn't a well-formed v1 payload — the viewer treats
 * null as "this link is broken", never throws.
 */
export function decodeSharePayload(fragment: string): SharePayload | null {
  const raw = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  if (!raw) return null;
  const json = fromBase64Url(raw);
  if (!json) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as Partial<SharePayload>;
  if (candidate.v !== 1) return null;
  const icon = candidate.icon as Icon | undefined;
  if (!icon || typeof icon !== 'object') return null;
  if (typeof icon.id !== 'string' || typeof icon.name !== 'string') return null;
  if (!icon.variants || typeof icon.variants !== 'object') return null;
  if (Object.keys(icon.variants).length === 0) return null;

  return {
    v: 1,
    icon,
    colors:
      candidate.colors && typeof candidate.colors === 'object'
        ? (candidate.colors as Record<string, string>)
        : undefined,
  };
}

export function buildShareUrl(origin: string, payload: SharePayload): string {
  return `${origin}/share#${encodeSharePayload(payload)}`;
}
