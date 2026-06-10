# Plan 002: Harden import/share input boundaries

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> "STOP condition" occurs, stop and report — do not improvise. Update this
> plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4ffd061..HEAD -- lib/import/adapters/figma-source.ts lib/import/sanitize/rules.ts lib/platform/share-link.ts next.config.mjs`
> On any change to these files since this plan was written, compare against the
> "Current state" excerpts before proceeding; mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `4ffd061`, 2026-06-10

## Why this matters

Hiero ingests untrusted input on three boundaries: SVGs (pasted/imported),
the Figma proxy (server fetches a URL the Figma API returns), and `/share`
links (an icon decoded from a URL fragment). Each has a small, cheap
defense-in-depth gap. None is a confirmed live exploit today, but they are
exactly the boundaries where a future bug becomes a breach. Fixing them
together is one focused, well-tested change.

## Current state

Four independent, small gaps (all confirmed by reading the code):

1. **SSRF-shaped fetch** — `lib/import/adapters/figma-source.ts:181-187`:
   ```ts
   const imageUrl = imagesData.images[nodeId];
   if (!imageUrl) throw new Error(...);
   const svgResponse = await fetchWithTimeout(imageUrl);   // no origin check
   ```
   `imageUrl` comes from Figma's API response; the server fetches it with no
   allowlist. Exploitation is gated by the user's own Figma token, but the
   server should not fetch arbitrary origins.

2. **SVG URI-scheme allowlist gap** — `lib/import/sanitize/rules.ts:149`:
   ```ts
   const DANGEROUS_URI_SCHEMES = /^\s*(javascript|data|vbscript)\s*:/i;
   ```
   `href` and `xlink:href` are allowed attributes (`rules.ts:125-126`), but
   `file:` and `blob:` schemes are not blocked. An imported
   `<use href="file:///etc/passwd">` survives sanitization (low impact on web,
   higher for any server-side/SSR render path).

3. **Loose Figma hostname check** — `lib/import/adapters/figma-source.ts:122`:
   ```ts
   if (!parsed.hostname.includes('figma.com')) return null;
   ```
   `includes` accepts `figma.com.attacker.com` and `evilfigma.com`. Low impact
   (downstream API auth fails) but trivially wrong.

4. **Share payload lacks depth/size limits** — `lib/platform/share-link.ts:55-83`
   (`decodeSharePayload`): validates top-level shape (`v`, `icon.id`,
   `icon.name`, non-empty `variants`) but does not bound nesting depth or
   payload size, so a crafted `/share#...` link could ship a pathological
   object to the renderer. Client-side-only DoS, affects only the link's
   recipient.

Conventions: throw typed errors where the codebase already does
(`FigmaApiError` in `figma-source.ts`); return `null` from `decodeSharePayload`
for any invalid input (its existing contract — never throw). Match existing
test style under `tests/` (bun `*.test.ts`).

## Commands you will need

| Purpose   | Command                          | Expected           |
|-----------|----------------------------------|--------------------|
| Install   | `bun install --frozen-lockfile`  | exit 0             |
| Typecheck | `npx tsc --noEmit`               | exit 0             |
| Tests     | `pnpm test`                      | all pass           |
| Lint      | `bun run lint`                   | exit 0             |
| Build     | `pnpm build`                     | exit 0             |

## Scope

**In scope:**
- `lib/import/adapters/figma-source.ts` (SSRF allowlist + hostname check)
- `lib/import/sanitize/rules.ts` (URI scheme regex)
- `lib/platform/share-link.ts` (depth + size guards)
- `next.config.mjs` (CSP header)
- `tests/figma-error-codes.test.ts` (extend) and/or new `tests/input-hardening.test.ts`
- `tests/share-link.test.ts` (extend)

**Out of scope:**
- The Figma proxy's per-request token model — keep it; only validate the URL it
  fetches.
- `app/api/publish-npm/route.ts` — the audit's port-confusion claim did not
  reproduce; leave it.
- Changing `decodeSharePayload`'s null-on-invalid contract (callers depend on it).

## Steps

### Step 1: Figma CDN origin allowlist (SSRF)

In `figma-source.ts`, before `fetchWithTimeout(imageUrl)`, parse `imageUrl` and
reject anything whose origin is not a Figma/known CDN host (e.g. hosts ending
in `.figma.com` plus the S3/CDN host Figma actually returns — log the rejected
origin via the existing error path). Throw `FigmaApiError('upstream_error', ...)`
on rejection.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Tighten the hostname check

Replace `parsed.hostname.includes('figma.com')` with
`parsed.hostname === 'figma.com' || parsed.hostname.endsWith('.figma.com')`.

**Verify**: add/extend a unit test asserting `parseFigmaUrl('https://evilfigma.com/design/x/y')`
returns `null` and `https://www.figma.com/design/x/y` parses. `pnpm test` passes.

### Step 3: Block `file:` and `blob:` URI schemes in the sanitizer

Update `DANGEROUS_URI_SCHEMES` to
`/^\s*(javascript|data|vbscript|file|blob)\s*:/i`. (Keep `data:` blocked — it is
already there and intentional.)

**Verify**: a sanitizer test asserting an `href="file:///etc/passwd"` attribute
is stripped/rejected. `pnpm test 2>&1 | grep -i saniti` → passes.

### Step 4: Bound the share payload

In `decodeSharePayload`, before returning, enforce (a) a max decoded-JSON byte
length (e.g. reject > 512 KB) and (b) a max object nesting depth (e.g. 64) via a
small recursive depth check. On violation return `null` (the existing
broken-link contract). Keep it allocation-cheap — check the raw string length
before `JSON.parse`, depth after.

**Verify**: extend `tests/share-link.test.ts` with an oversized string and a
deeply-nested object, both expecting `null`. `pnpm test 2>&1 | grep -i share`
→ passes.

### Step 5: Add a Content-Security-Policy header

In `next.config.mjs`, inside the existing non-export `headers()` block (which
currently sets only `X-Hiero-*`), add a `Content-Security-Policy`. Start in a
conservative-but-working policy: `default-src 'self'`, allow
`style-src 'self' 'unsafe-inline'` (Tailwind/Radix inject inline styles),
`img-src 'self' data: blob: https:` (icon previews use `data:` SVG URLs and
Figma thumbnails), `script-src 'self'` plus whatever the existing analytics
script needs (check `app/layout.tsx` for `@vercel/analytics` and the figma
capture script — include their origins or use a nonce). **If a strict policy
breaks the app in `pnpm build` + manual load, loosen incrementally and record
what each directive is for.**

**Verify**: `pnpm build` → exit 0. Manually confirm the editor loads without
CSP console errors (or document the report-only fallback if a strict policy
isn't achievable yet).

## Test plan

- Extend `tests/share-link.test.ts`: oversized payload → null; over-deep payload
  → null; a normal payload still round-trips.
- New or extended Figma test: lookalike hostname rejected; non-Figma `imageUrl`
  origin rejected (mock `figmaGet` to return a hostile `imageUrl`, assert the
  fetch is never made / throws `FigmaApiError`).
- Sanitizer test: `file:`/`blob:` href stripped; existing `javascript:`/`data:`
  cases still stripped.
- Verification: `pnpm test` → all pass.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0; `bun run lint` exits 0
- [ ] `pnpm test` passes with the new/extended cases
- [ ] `pnpm build` exits 0
- [ ] `grep -n "includes('figma.com')" lib/import/adapters/figma-source.ts` →
      no matches
- [ ] `grep -n "file" lib/import/sanitize/rules.ts` shows `file` in the
      dangerous-scheme regex
- [ ] `grep -n "Content-Security-Policy" next.config.mjs` → present
- [ ] `plans/README.md` status row updated

## STOP conditions

- A strict CSP cannot be made to load the app and even a report-only policy
  conflicts with required third-party scripts — ship Steps 1–4, mark Step 5
  BLOCKED with the specific blocking script, and report.
- The Figma CDN origin turns out to vary unpredictably (you cannot determine a
  stable allowlist from `figma-source.ts` or docs) — implement a scheme/HTTPS
  check at minimum and report the residual.
- Any "Current state" excerpt no longer matches live code (drift).

## Maintenance notes

- The CSP must be revisited whenever a new third-party script/origin is added
  (analytics, embeds). Prefer nonces over `unsafe-inline` for scripts.
- The Figma CDN allowlist may need updating if Figma changes its image host;
  keep the rejected-origin log so that failure is diagnosable.
- A reviewer should confirm `decodeSharePayload` still returns `null` (never
  throws) for every new rejection path.
