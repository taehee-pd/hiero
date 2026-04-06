/**
 * `contour validate` — validate config and source files.
 *
 * Checks:
 *   1. contour.config.ts is present, parseable, and passes schema validation
 *   2. sourceDir exists
 *   3. Source files pass schema validation
 *   4. Source payload can be exported deterministically
 */

import path from 'node:path';
import { existsSync } from 'node:fs';
import { loadConfig } from '@/lib/install-config';
import { projectFromSourceDir, exportSourcePayload } from '@/lib/sync-source';

export async function runValidate(
  cwd: string,
  flags: Record<string, string | boolean>,
): Promise<void> {
  const configPath =
    typeof flags['config'] === 'string'
      ? path.resolve(cwd, flags['config'])
      : path.join(cwd, 'contour.config.ts');

  let exitCode = 0;

  // 1. Config presence
  if (!existsSync(configPath)) {
    console.error(`[contour] Config not found: ${path.relative(cwd, configPath)}`);
    console.error(`         Run \`contour init\` to scaffold contour.config.ts`);
    process.exit(1);
  }

  // 2. Config load + validation
  let rawModule: { default?: unknown };
  try {
    rawModule = (await import(configPath)) as { default?: unknown };
  } catch (err) {
    console.error(
      `[contour] Failed to load config: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  const loadResult = loadConfig(rawModule.default, configPath);
  if (!loadResult.ok) {
    console.error(`[contour] Config invalid:\n${loadResult.error}`);
    process.exit(1);
  }

  const config = loadResult.config;
  console.log(`[contour] Config`);
  console.log(`   sourceDir:       ${config.sourceDir}`);
  console.log(`   hostTargets:     ${config.hostTargets.length}`);
  console.log(`   releaseTargets:  ${(config.releaseTargets ?? []).length}`);
  console.log(`   status:          OK`);

  // 3. Source directory
  const sourceDir = path.resolve(cwd, config.sourceDir);
  if (!existsSync(sourceDir)) {
    console.error(`\n[contour] Source directory not found: ${config.sourceDir}`);
    console.error(`         Run \`contour init\` to create it`);
    process.exit(1);
  }

  // 4. Source files
  let project;
  try {
    project = await projectFromSourceDir(sourceDir);
  } catch (err) {
    console.error(
      `\n[contour] Source read failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  const iconCount = Object.keys(project.icons).length;

  // 5. Source payload export (validates icon correctness + determinism)
  if (iconCount > 0) {
    try {
      const payload = exportSourcePayload(project);
      console.log(`\n[contour] Source`);
      console.log(`   icons:   ${iconCount}`);
      console.log(`   files:   ${payload.files.length}`);
      console.log(`   status:  OK`);
    } catch (err) {
      console.error(
        `\n[contour] Source export failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      exitCode = 1;
    }
  } else {
    console.log(`\n[contour] Source`);
    console.log(`   icons:   0  (no icons — run \`contour init\` to populate from the editor)`);
    console.log(`   status:  OK`);
  }

  if (exitCode === 0) {
    console.log(`\n[contour] Validation passed`);
  } else {
    console.error(`\n[contour] Validation failed`);
    process.exit(exitCode);
  }
}
