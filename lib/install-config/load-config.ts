import type { ContourConfig } from './types';
import { validateConfig } from './validate-config';

export type LoadConfigResult =
  | { ok: true; config: ContourConfig }
  | { ok: false; error: string };

/**
 * Load and validate a contour.config.ts module export.
 *
 * In practice, callers will dynamically import contour.config.ts and pass the
 * default export here. This function validates and normalises the result so
 * consumers always receive a typed, valid ContourConfig.
 *
 * @param raw - The default export from contour.config.ts (untyped).
 * @param configPath - Optional path hint used in error messages.
 */
export function loadConfig(raw: unknown, configPath?: string): LoadConfigResult {
  const label = configPath ?? 'contour.config.ts';

  if (raw === null || raw === undefined) {
    return { ok: false, error: `${label}: default export is missing or undefined.` };
  }

  const result = validateConfig(raw);
  if (!result.valid) {
    const messages = result.errors.map((e) => `  • ${e.field}: ${e.message}`).join('\n');
    return { ok: false, error: `${label} is invalid:\n${messages}` };
  }

  // Cast is safe because validateConfig passed.
  const config = raw as ContourConfig;

  return { ok: true, config: normalizeConfig(config) };
}

/**
 * Apply normalisation defaults so downstream code never has to deal with
 * undefined optional fields.
 */
function normalizeConfig(config: ContourConfig): ContourConfig {
  return {
    ...config,
    sourceDir: config.sourceDir.replace(/\/$/, ''), // strip trailing slash
    hostTargets: config.hostTargets.map((t) => {
      if (t.runtimeMode === 'cache-dir' && t.cacheDir) {
        return { ...t, cacheDir: t.cacheDir.replace(/\/$/, '') };
      }
      return t;
    }),
    releaseTargets: config.releaseTargets ?? [],
  };
}
