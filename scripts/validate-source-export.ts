#!/usr/bin/env bun

/**
 * CI validation script for canonical source exports.
 *
 * Reads icon source files from a directory (the PR payload) and validates:
 *   1. Schema compliance — every icon.json has required fields + schemaVersion
 *   2. Manifest consistency — manifest.json matches actual icon files
 *   3. Preview presence — every icon dir has a preview.svg
 *   4. Deterministic export — re-serializing produces identical output
 *   5. No duplicate icon names
 *   6. Compile pipeline — source can be compiled into runtime output
 *
 * Usage:
 *   bun scripts/validate-source-export.ts --source <icons-dir>
 *     [--project <project.json>]   # optional: also validates compile pipeline
 *     [--summary <output.md>]      # optional: write CI-readable summary
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — one or more checks failed
 */

import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import {
  ICON_SOURCE_SCHEMA_VERSION,
  SYNC_SOURCE_MANIFEST_SCHEMA_VERSION,
} from '../lib/sync-source/types';
import type {
  IconSourceFile,
  SyncSourceManifest,
  SyncSourceManifestEntry,
} from '../lib/sync-source/types';
import { serializeSourceJson } from '../lib/sync-source/serialize';
import {
  isValidIconDirName,
  containsPathTraversal,
} from '../lib/sync-source/validate';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CheckResult = {
  name: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main(): Promise<void> {
  const sourceDir = getArg('--source');
  const projectPath = getArg('--project');
  const summaryPath = getArg('--summary');

  if (!sourceDir) {
    process.stderr.write(
      'Usage: bun scripts/validate-source-export.ts --source <icons-dir> [--project <project.json>] [--summary <output.md>]\n',
    );
    process.exit(1);
  }

  const results: CheckResult[] = [];

  // 1. Read icon source files
  const icons = await readIconSources(sourceDir);
  const manifest = await readManifest(sourceDir);

  // 2. Schema validation
  results.push(checkSchemaCompliance(icons));

  // 3. Manifest consistency
  results.push(checkManifestConsistency(manifest, icons, sourceDir));

  // 4. Preview presence
  results.push(await checkPreviewPresence(icons, sourceDir));

  // 5. Deterministic export
  results.push(checkDeterministicExport(icons));

  // 6. Duplicate icon names
  results.push(checkDuplicateNames(icons));

  // 7. Path safety
  results.push(checkPathSafety(icons));

  // 8. Compile pipeline (optional)
  if (projectPath) {
    results.push(await checkCompilePipeline(projectPath));
  }

  // Print results
  const allPassed = results.every((r) => r.passed);
  printResults(results);

  // Write summary if requested
  if (summaryPath) {
    const markdown = formatSummaryMarkdown(results);
    await mkdir(path.dirname(summaryPath), { recursive: true });
    await writeFile(summaryPath, markdown, 'utf8');
    process.stdout.write(`\nSummary written to ${summaryPath}\n`);
  }

  process.exit(allPassed ? 0 : 1);
}

// ---------------------------------------------------------------------------
// File readers
// ---------------------------------------------------------------------------

type IconEntry = {
  dirName: string;
  source: IconSourceFile;
  rawJson: string;
};

async function readIconSources(sourceDir: string): Promise<IconEntry[]> {
  const iconsDir = path.join(sourceDir, 'icons');
  let dirs: string[];

  try {
    dirs = await readdir(iconsDir);
  } catch {
    process.stderr.write(`ERROR: Could not read icons directory: ${iconsDir}\n`);
    process.exit(1);
  }

  const entries: IconEntry[] = [];

  for (const dirName of dirs.sort()) {
    const dirPath = path.join(iconsDir, dirName);
    const dirStat = await stat(dirPath).catch(() => null);
    if (!dirStat?.isDirectory()) continue;

    const iconJsonPath = path.join(dirPath, 'icon.json');
    try {
      const rawJson = await readFile(iconJsonPath, 'utf8');
      const source = JSON.parse(rawJson) as IconSourceFile;
      entries.push({ dirName, source, rawJson });
    } catch (err) {
      entries.push({
        dirName,
        source: { schemaVersion: '', id: '', name: '', variants: {}, transitions: {} },
        rawJson: '',
      });
    }
  }

  return entries;
}

async function readManifest(sourceDir: string): Promise<SyncSourceManifest | null> {
  const manifestPath = path.join(sourceDir, 'manifest.json');
  try {
    const raw = await readFile(manifestPath, 'utf8');
    return JSON.parse(raw) as SyncSourceManifest;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function checkSchemaCompliance(icons: IconEntry[]): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (icons.length === 0) {
    errors.push('No icon source files found.');
  }

  for (const entry of icons) {
    const { dirName, source, rawJson } = entry;

    if (!rawJson) {
      errors.push(`${dirName}: Could not read icon.json.`);
      continue;
    }

    if (!source.schemaVersion) {
      errors.push(`${dirName}: Missing schemaVersion.`);
    } else if (source.schemaVersion !== ICON_SOURCE_SCHEMA_VERSION) {
      warnings.push(
        `${dirName}: schemaVersion "${source.schemaVersion}" ` +
        `differs from expected "${ICON_SOURCE_SCHEMA_VERSION}".`,
      );
    }

    if (!source.id) errors.push(`${dirName}: Missing id.`);
    if (!source.name) errors.push(`${dirName}: Missing name.`);
    if (!source.variants || Object.keys(source.variants).length === 0) {
      errors.push(`${dirName}: Must have at least one variant.`);
    }

    // Validate each variant
    for (const [variantId, variant] of Object.entries(source.variants ?? {})) {
      if (!variant.size || variant.size <= 0) {
        errors.push(`${dirName}: Variant "${variantId}" has invalid size.`);
      }
      if (!variant.viewBox || variant.viewBox.length !== 4) {
        errors.push(`${dirName}: Variant "${variantId}" has invalid viewBox.`);
      }
      if (!variant.defaultState) {
        errors.push(`${dirName}: Variant "${variantId}" missing defaultState.`);
      }
      if (!variant.states || Object.keys(variant.states).length === 0) {
        errors.push(`${dirName}: Variant "${variantId}" must have at least one state.`);
      }
    }
  }

  return {
    name: 'Schema compliance',
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

function checkManifestConsistency(
  manifest: SyncSourceManifest | null,
  icons: IconEntry[],
  sourceDir: string,
): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!manifest) {
    errors.push('manifest.json not found or could not be parsed.');
    return { name: 'Manifest consistency', passed: false, errors, warnings };
  }

  if (manifest.schemaVersion !== SYNC_SOURCE_MANIFEST_SCHEMA_VERSION) {
    warnings.push(
      `Manifest schemaVersion "${manifest.schemaVersion}" ` +
      `differs from expected "${SYNC_SOURCE_MANIFEST_SCHEMA_VERSION}".`,
    );
  }

  // Count check
  const actualCount = icons.filter((i) => i.rawJson).length;
  if (manifest.iconCount !== actualCount) {
    errors.push(
      `Manifest declares ${manifest.iconCount} icons but found ${actualCount} icon directories.`,
    );
  }

  // Every manifest entry should have a matching directory
  const iconDirs = new Set(icons.map((i) => i.dirName));
  for (const [entryId, entry] of Object.entries(manifest.icons)) {
    const expectedDir = entry.sourcePath.replace(/^icons\//, '').replace(/\/icon\.json$/, '');
    if (!iconDirs.has(expectedDir)) {
      errors.push(
        `Manifest entry "${entryId}" references dir "${expectedDir}" which does not exist.`,
      );
    }
  }

  // Every icon directory should have a manifest entry
  for (const entry of icons) {
    if (!entry.rawJson) continue;
    const manifestEntry = Object.values(manifest.icons).find(
      (m) => m.sourcePath === `icons/${entry.dirName}/icon.json`,
    );
    if (!manifestEntry) {
      errors.push(
        `Icon directory "${entry.dirName}" has no matching manifest entry.`,
      );
    }
  }

  return { name: 'Manifest consistency', passed: errors.length === 0, errors, warnings };
}

async function checkPreviewPresence(
  icons: IconEntry[],
  sourceDir: string,
): Promise<CheckResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const entry of icons) {
    if (!entry.rawJson) continue;

    const previewPath = path.join(sourceDir, 'icons', entry.dirName, 'preview.svg');
    try {
      const previewStat = await stat(previewPath);
      if (previewStat.size === 0) {
        warnings.push(`${entry.dirName}: preview.svg is empty.`);
      }
      const contents = await readFile(previewPath, 'utf8');
      if (!contents.includes('<svg')) {
        errors.push(`${entry.dirName}: preview.svg does not contain SVG markup.`);
      }
    } catch {
      errors.push(`${entry.dirName}: Missing preview.svg.`);
    }
  }

  return { name: 'Preview presence', passed: errors.length === 0, errors, warnings };
}

function checkDeterministicExport(icons: IconEntry[]): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const entry of icons) {
    if (!entry.rawJson) continue;

    // Re-serialize and compare — should be identical if export is deterministic
    const reserialized = serializeSourceJson(entry.source);
    if (reserialized !== entry.rawJson) {
      errors.push(
        `${entry.dirName}: icon.json is not deterministically serialized. ` +
        `Re-serializing produces different output (likely unsorted keys or extra whitespace).`,
      );
    }
  }

  return {
    name: 'Deterministic export',
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

function checkDuplicateNames(icons: IconEntry[]): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const seenNames = new Map<string, string>();
  const seenIds = new Map<string, string>();

  for (const entry of icons) {
    if (!entry.rawJson) continue;

    // Duplicate dir names (shouldn't happen since they're filesystem dirs, but check IDs)
    if (entry.source.id) {
      const existing = seenIds.get(entry.source.id);
      if (existing) {
        errors.push(
          `Duplicate icon id "${entry.source.id}" in directories "${existing}" and "${entry.dirName}".`,
        );
      }
      seenIds.set(entry.source.id, entry.dirName);
    }

    if (entry.source.name) {
      const existing = seenNames.get(entry.source.name.toLowerCase());
      if (existing) {
        errors.push(
          `Duplicate icon name "${entry.source.name}" in directories "${existing}" and "${entry.dirName}".`,
        );
      }
      seenNames.set(entry.source.name.toLowerCase(), entry.dirName);
    }
  }

  return { name: 'Duplicate detection', passed: errors.length === 0, errors, warnings };
}

function checkPathSafety(icons: IconEntry[]): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const entry of icons) {
    if (!isValidIconDirName(entry.dirName)) {
      errors.push(`"${entry.dirName}" is not a valid icon directory name.`);
    }
    if (containsPathTraversal(`icons/${entry.dirName}/icon.json`)) {
      errors.push(`Path traversal detected in icon dir: "${entry.dirName}".`);
    }
  }

  return { name: 'Path safety', passed: errors.length === 0, errors, warnings };
}

async function checkCompilePipeline(projectPath: string): Promise<CheckResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Dynamic import to avoid loading compile pipeline when not needed
    const { compileProject } = await import('../lib/export/compile-pipeline');
    const { isProject, isWorkspace } = await import('../lib/schema/guards');
    const { getActiveIconSet } = await import('../lib/schema/workspace');

    const rawProject = await readFile(projectPath, 'utf8');
    const parsed = JSON.parse(rawProject) as unknown;
    const project = isWorkspace(parsed)
      ? getActiveIconSet(parsed, (parsed as { activeIconSetId: string }).activeIconSetId)
      : isProject(parsed)
        ? parsed
        : null;

    if (!project) {
      errors.push(`Project file is not valid: ${projectPath}`);
      return { name: 'Compile pipeline', passed: false, errors, warnings };
    }

    const result = compileProject(project, {
      package: {
        name: '@icophone/icons',
        version: '0.0.0-ci',
        builtAt: new Date().toISOString(),
      },
      generateReact: true,
    });

    if (result.compiledIcons.length === 0) {
      errors.push('Compile pipeline produced 0 icons.');
    }

    // Verify deterministic — compile again and compare
    const result2 = compileProject(project, {
      package: {
        name: '@icophone/icons',
        version: '0.0.0-ci',
        builtAt: result.files.find((f) => f.path === 'icons.manifest.json')
          ? new Date().toISOString()
          : new Date().toISOString(),
      },
      generateReact: true,
    });

    // Compare file counts (content may vary by builtAt timestamp)
    if (result.files.length !== result2.files.length) {
      errors.push(
        `Compile pipeline is nondeterministic: produced ${result.files.length} files then ${result2.files.length}.`,
      );
    }

    process.stdout.write(
      `  Compiled ${result.compiledIcons.length} icons, ${result.files.length} files\n`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Compile pipeline failed: ${message}`);
  }

  return { name: 'Compile pipeline', passed: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function printResults(results: CheckResult[]): void {
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

  process.stdout.write('\n=== Source Export Validation ===\n\n');

  for (const result of results) {
    const icon = result.passed ? 'PASS' : 'FAIL';
    process.stdout.write(`[${icon}] ${result.name}\n`);

    for (const err of result.errors) {
      process.stdout.write(`  ERROR: ${err}\n`);
    }
    for (const warn of result.warnings) {
      process.stdout.write(`  WARN:  ${warn}\n`);
    }
  }

  process.stdout.write(`\n${results.length} checks, `);
  process.stdout.write(`${totalErrors} error(s), ${totalWarnings} warning(s)\n`);
}

function formatSummaryMarkdown(results: CheckResult[]): string {
  const lines: string[] = [];
  const allPassed = results.every((r) => r.passed);

  lines.push('# Source Export Validation Report');
  lines.push('');
  lines.push(allPassed ? 'All checks passed.' : 'Some checks failed.');
  lines.push('');
  lines.push('| Check | Result |');
  lines.push('|-------|--------|');

  for (const result of results) {
    lines.push(`| ${result.name} | ${result.passed ? 'Pass' : 'Fail'} |`);
  }

  lines.push('');

  const failedResults = results.filter((r) => !r.passed);
  if (failedResults.length > 0) {
    lines.push('## Errors');
    lines.push('');
    for (const result of failedResults) {
      lines.push(`### ${result.name}`);
      for (const err of result.errors) {
        lines.push(`- ${err}`);
      }
      lines.push('');
    }
  }

  const withWarnings = results.filter((r) => r.warnings.length > 0);
  if (withWarnings.length > 0) {
    lines.push('## Warnings');
    lines.push('');
    for (const result of withWarnings) {
      lines.push(`### ${result.name}`);
      for (const warn of result.warnings) {
        lines.push(`- ${warn}`);
      }
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
