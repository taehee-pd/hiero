/**
 * GET /api/install-config
 *
 * Returns the parsed `hiero.config.ts` from the host repo root, or
 * `{ ok: false }` if no config is present. Server-only so the file
 * system + env-var checks never reach the client bundle.
 *
 * This is a read-only public endpoint — the config itself never carries
 * credentials (the spec sheet's trust-boundary rule). Tokens stay in
 * `process.env` and are read by the publish API routes server-side.
 *
 * Phase 2.5 wiring fix (issue P4): SetupHealthPanel and PublishDialog
 * both consume this so they can render real release-target options
 * instead of the empty-state fallback.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/install-config/load-config';
import type { HieroConfig } from '@/lib/install-config/types';

export const dynamic = 'force-dynamic';

export type InstallConfigResponse =
  | { ok: true; config: HieroConfig; sourcePath: string }
  | { ok: false; reason: 'missing' | 'invalid'; message: string };

export async function GET(): Promise<NextResponse<InstallConfigResponse>> {
  const cwd = process.cwd();
  const candidates = ['hiero.config.ts', 'hiero.config.mts', 'hiero.config.js'];
  const found = candidates
    .map((name) => path.join(cwd, name))
    .find((p) => existsSync(p));

  if (!found) {
    return NextResponse.json({
      ok: false,
      reason: 'missing',
      message:
        'No hiero.config.ts in repo root. Run `npx hiero init` to scaffold one.',
    });
  }

  // Dynamic import — Next.js's dev server resolves .ts via its loader,
  // production builds resolve via the bundler. If the host repo lacks
  // a transpiler entry the import will throw and we surface that.
  let raw: unknown;
  try {
    const mod = (await import(/* @vite-ignore */ found)) as { default?: unknown };
    raw = mod.default ?? mod;
  } catch (err) {
    return NextResponse.json({
      ok: false,
      reason: 'invalid',
      message:
        err instanceof Error
          ? `Failed to import ${found}: ${err.message}`
          : `Failed to import ${found}.`,
    });
  }

  const result = loadConfig(raw, found);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: 'invalid', message: result.error });
  }

  return NextResponse.json({ ok: true, config: result.config, sourcePath: found });
}
