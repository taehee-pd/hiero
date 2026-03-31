#!/usr/bin/env node
/**
 * Coniva CLI entry point.
 *
 * Usage:
 *   coniva init              Scaffold coniva.config.ts and source directory
 *   coniva dev [--port N]    Start live integration dev server (Lane 1)
 *   coniva build             Deterministic snapshot build (Lane 2)
 *   coniva validate          Validate config and source files
 *
 * Run via bun:
 *   bun packages/coniva-cli/src/bin.ts <command>
 *
 * Or after linking:
 *   coniva <command>
 */

import { runInit } from './commands/init';
import { runDev } from './commands/dev';
import { runBuild } from './commands/build';
import { runValidate } from './commands/validate';

// ---------------------------------------------------------------------------
// Arg parsing (no external dependencies)
// ---------------------------------------------------------------------------

function parseFlags(argv: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Parse all args: flags can appear anywhere (e.g. `coniva --version`, `coniva dev --port 4401`)
const allArgs = process.argv.slice(2);
const flags = parseFlags(allArgs);
// Find the first positional arg that is not a flag key or flag value.
// This handles `coniva --config coniva.config.ts build` → command = "build".
const command = (() => {
  for (let i = 0; i < allArgs.length; i++) {
    const a = allArgs[i]!;
    if (a.startsWith('--')) {
      const next = allArgs[i + 1];
      if (next !== undefined && !next.startsWith('--')) i++; // skip value
    } else {
      return a;
    }
  }
  return undefined;
})();

async function main(): Promise<void> {
  if (flags['help'] || flags['h']) {
    printUsage();
    return;
  }

  if (flags['version'] || flags['v']) {
    const pkg = await import('../package.json').catch(() => ({ version: 'unknown' }));
    console.log((pkg as { version: string }).version);
    return;
  }

  switch (command) {
    case 'init':
      await runInit(process.cwd(), flags);
      break;
    case 'dev':
      await runDev(process.cwd(), flags);
      break;
    case 'build':
      await runBuild(process.cwd(), flags);
      break;
    case 'validate':
      await runValidate(process.cwd(), flags);
      break;
    default:
      if (command) {
        console.error(`[coniva] Unknown command: "${command}"\n`);
        printUsage();
        process.exit(1);
      } else {
        printUsage();
      }
  }
}

function printUsage(): void {
  console.log(`
coniva — repo-native icon authoring by Coniva

Usage:
  coniva <command> [options]

Commands:
  init              Scaffold coniva.config.ts and source directory
  dev               Start live integration dev server (Lane 1)
  build             Deterministic snapshot build (Lane 2)
  validate          Validate config and source files

Options:
  --port <n>        Dev server port (default: 4400)
  --config <path>   Path to coniva.config.ts (default: ./coniva.config.ts)
  --out <path>      Output directory override for build
  --secret <token>  Shared secret for dev server API auth
  --version         Print version
  --help            Show this help
`);
}

main().catch((err: unknown) => {
  console.error(`[coniva] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
