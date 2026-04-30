/**
 * Browser-safe setup health checks.
 *
 * Shape-only checks: validate the config object that's passed in. This
 * file deliberately does NOT touch process.env or the filesystem so it
 * can be imported by the studio UI without leaking server-only code
 * into the public bundle (per the eng-review credential-handling rule:
 * tokens are read on the server and never reach the client).
 *
 * The CLI's `runHealthChecks` (packages/hiero-cli/src/commands/init.ts)
 * is the server-side counterpart — it adds env-var and gitignore checks
 * that only make sense at the dev-server / CI level.
 */

import { validateConfig } from './validate-config';
import type { HieroConfig } from './types';

export type ConfigHealthCheck = {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
};

export function runConfigHealthChecks(
  config: unknown,
): ConfigHealthCheck[] {
  const out: ConfigHealthCheck[] = [];
  const validation = validateConfig(config);

  if (!validation.valid) {
    out.push({
      name: 'Config schema',
      status: 'fail',
      detail: validation.errors
        .map((e) => `${e.field}: ${e.message}`)
        .join('; '),
    });
    return out;
  }

  out.push({
    name: 'Config schema',
    status: 'ok',
    detail: 'valid',
  });

  const cfg = config as HieroConfig;

  out.push({
    name: 'Source directory',
    status: cfg.sourceDir ? 'ok' : 'fail',
    detail: cfg.sourceDir ? cfg.sourceDir : 'not set',
  });

  out.push({
    name: 'Host targets',
    status: cfg.hostTargets.length > 0 ? 'ok' : 'warn',
    detail:
      cfg.hostTargets.length > 0
        ? `${cfg.hostTargets.length} configured`
        : 'no host target — `hiero dev` will not surface live updates',
  });

  const releaseCount = cfg.releaseTargets?.length ?? 0;
  out.push({
    name: 'Release targets',
    status: releaseCount > 0 ? 'ok' : 'warn',
    detail:
      releaseCount > 0
        ? `${releaseCount} configured`
        : 'no release targets — Publish has nothing to push to',
  });

  return out;
}
