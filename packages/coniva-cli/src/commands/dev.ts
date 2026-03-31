/**
 * `coniva dev` — start the Lane 1 live integration dev server.
 *
 * Loads coniva.config.ts, runs a full initial build, starts the file watcher,
 * and opens the HTTP API on the configured port (default: 4400).
 *
 * Options:
 *   --port <n>        Port to listen on (default: 4400)
 *   --config <path>   Path to coniva.config.ts
 *   --secret <token>  Shared secret for API auth
 */

import path from 'node:path';
import { existsSync } from 'node:fs';
import { loadConfig } from '@/lib/install-config';
import { startDevServer } from '@/lib/live-sync/dev-server';

export async function runDev(
  cwd: string,
  flags: Record<string, string | boolean>,
): Promise<void> {
  const configPath =
    typeof flags['config'] === 'string'
      ? path.resolve(cwd, flags['config'])
      : path.join(cwd, 'coniva.config.ts');

  const rawPort = flags['port'];
  const port =
    typeof rawPort === 'string' && /^\d+$/.test(rawPort) ? parseInt(rawPort, 10) : 4400;

  const apiSecret = typeof flags['secret'] === 'string' ? flags['secret'] : undefined;

  // Config check
  if (!existsSync(configPath)) {
    console.error(`[coniva] Config not found: ${path.relative(cwd, configPath)}`);
    console.error(`         Run \`coniva init\` to scaffold coniva.config.ts`);
    process.exit(1);
  }

  // Load config
  let config: import('@/lib/install-config/types').ConivaConfig;
  try {
    const rawModule = (await import(configPath)) as { default?: unknown };
    const result = loadConfig(rawModule.default, configPath);
    if (!result.ok) {
      console.error(`[coniva] Config invalid:\n${result.error}`);
      process.exit(1);
    }
    config = result.config;
  } catch (err) {
    console.error(
      `[coniva] Failed to load config: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  // Start server
  const server = await startDevServer({
    repoRoot: cwd,
    coniva: config,
    port,
    apiSecret,
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[coniva] Shutting down...');
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  // Keep alive until signal
  await new Promise<never>(() => {
    /* intentionally never resolves */
  });
}
