#!/usr/bin/env bun

/**
 * Migrate `lucide-react` imports + JSX usages to `@hiero/ui-icons`.
 *
 * Scope: components/**, app/** .tsx/.ts.
 *
 * For every file that imports from `lucide-react`:
 *   1. Replace the import with `import { Icon } from '@hiero/ui-icons'`.
 *   2. Rewrite each JSX usage `<Plus className="size-4" />` into
 *      `<Icon name="plus" size={16} className="size-4" />`, converting
 *      the Tailwind `size-N` class to an explicit `size={N*4}` prop so
 *      the Hiero runtime picks the nearest authored variant.
 *
 * Unknown icon names are reported and left untouched. The script is
 * idempotent: running it again is a no-op.
 *
 * Usage:
 *   bun scripts/migrate-lucide-to-hiero.ts              # dry-run
 *   bun scripts/migrate-lucide-to-hiero.ts --write      # rewrite files
 */

import { readFile, writeFile } from 'fs/promises';
import { execSync } from 'child_process';

import { iconNames } from '../packages/hiero-ui-icons/src/registry.generated';

const WRITE = process.argv.includes('--write');

/**
 * Normalize either a Lucide PascalCase name or a registry kebab to a
 * lowercase alphanumeric-only key for fuzzy lookup. This bridges the
 * gap between Lucide's inconsistent case handling (Grid3X3 vs
 * grid-3x3) and the registry's kebab convention.
 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const REGISTRY_BY_NORMALIZED = new Map<string, string>();
for (const kebab of iconNames) {
  REGISTRY_BY_NORMALIZED.set(normalize(kebab), kebab);
}

function lucideNameToKebab(lucide: string): string | null {
  const stripped = lucide.replace(/Icon$/, '');
  return REGISTRY_BY_NORMALIZED.get(normalize(stripped)) ?? null;
}

const TAILWIND_SIZE = /(?:^|\s)size-(\d+(?:\.\d+)?)(?:\s|$)/;
function extractSizePx(classAttr: string | null): number | null {
  if (!classAttr) return null;
  const m = TAILWIND_SIZE.exec(classAttr);
  if (!m) return null;
  const n = parseFloat(m[1]!);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 4);
}

/**
 * Strip props that the Icon wrapper doesn't forward. `fill` and
 * `stroke` are bound at icon design time and overriding per call
 * site defeats the design system — re-author the icon if you want a
 * different paint.
 */
function cleanIconProps(props: string): string {
  return props
    .replace(/\s*fill=(["'][^"']*["']|\{[^}]*\})/g, '')
    .replace(/\s*stroke=(["'][^"']*["']|\{[^}]*\})/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type MigrationResult = {
  path: string;
  iconsBefore: string[];
  iconsRewritten: string[];
  unknownIcons: string[];
  newContents: string | null;
};

async function migrateFile(filePath: string): Promise<MigrationResult> {
  const src = await readFile(filePath, 'utf8');

  const importRe =
    /import\s*\{\s*([^}]+)\s*\}\s*from\s*(?:'lucide-react'|"lucide-react")\s*;?/g;

  const importedNames: string[] = [];
  const importAliases = new Map<string, string>(); // local -> Lucide original
  let workingSrc = src;

  const importMatches: RegExpMatchArray[] = [...src.matchAll(importRe)];
  if (importMatches.length === 0) {
    return {
      path: filePath,
      iconsBefore: [],
      iconsRewritten: [],
      unknownIcons: [],
      newContents: null,
    };
  }

  for (const m of importMatches) {
    const inside = m[1]!;
    for (const part of inside.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const aliasMatch = /^(\w+)\s+as\s+(\w+)$/.exec(trimmed);
      if (aliasMatch) {
        importAliases.set(aliasMatch[2]!, aliasMatch[1]!);
        importedNames.push(aliasMatch[1]!);
      } else {
        importAliases.set(trimmed, trimmed);
        importedNames.push(trimmed);
      }
    }
  }

  const unknownIcons: string[] = [];
  const rewrittenIcons: string[] = [];

  // Rewrite JSX usages for each local name. Process longest first so
  // `PlusCircle` doesn't get clobbered by a `Plus` regex.
  const locals = [...importAliases.keys()].sort((a, b) => b.length - a.length);
  for (const local of locals) {
    const lucide = importAliases.get(local)!;
    const kebab = lucideNameToKebab(lucide);
    if (!kebab) {
      unknownIcons.push(`${lucide} (${local})`);
      continue;
    }

    // Match <Local ...props />, <Local ...props>, and </Local>.
    const openSelfClose = new RegExp(
      `<${local}(\\s[^>]*?)?\\s*/>`,
      'g',
    );
    const openTag = new RegExp(`<${local}(\\s[^>]*?)?>`, 'g');
    const closeTag = new RegExp(`</${local}>`, 'g');

    let anyMatch = false;

    workingSrc = workingSrc.replace(openSelfClose, (_match, propsRaw) => {
      anyMatch = true;
      const props = cleanIconProps((propsRaw ?? '').trim());
      const classAttrMatch = /className=["']([^"']*)["']/.exec(props);
      const size = extractSizePx(classAttrMatch?.[1] ?? null);
      const sizeAttr = size !== null ? ` size={${size}}` : '';
      const cleanedProps = props.length ? ` ${props}` : '';
      return `<UiIcon name="${kebab}"${sizeAttr}${cleanedProps} />`;
    });

    workingSrc = workingSrc.replace(openTag, (_match, propsRaw) => {
      anyMatch = true;
      const props = cleanIconProps((propsRaw ?? '').trim());
      const classAttrMatch = /className=["']([^"']*)["']/.exec(props);
      const size = extractSizePx(classAttrMatch?.[1] ?? null);
      const sizeAttr = size !== null ? ` size={${size}}` : '';
      const cleanedProps = props.length ? ` ${props}` : '';
      return `<UiIcon name="${kebab}"${sizeAttr}${cleanedProps}>`;
    });

    workingSrc = workingSrc.replace(closeTag, () => {
      anyMatch = true;
      return '</UiIcon>';
    });

    if (anyMatch) rewrittenIcons.push(`${lucide} → ${kebab}`);
  }

  // Replace the import statement(s) with a single @hiero/ui-icons import.
  workingSrc = workingSrc.replace(importRe, '');
  workingSrc = workingSrc.replace(/^\s*\n/, '');

  // After JSX rewrite, any remaining identifier reference to a
  // removed Lucide name is an identifier-style usage (e.g.
  // `icon: MousePointer2` inside a config object). Detect those by
  // scanning for the name in code-like positions: next to `:`,
  // `,`, `(`, `=`, `>`, `}`, `]`, start/end of line, or a space.
  // This avoids matching the name inside a string literal (like
  // `aria-label="Save"`) while still catching identifier uses.
  const stillReferenced: string[] = [];
  for (const local of Object.keys(Object.fromEntries(importAliases))) {
    const identifierPattern = new RegExp(
      `(?:^|[\\s:,(=<{\\[])${local}(?=[\\s:,)=>}\\]|;/.]|$)`,
      'm',
    );
    if (identifierPattern.test(workingSrc)) {
      stillReferenced.push(local);
    }
  }

  // The wrapper is imported as `UiIcon` to avoid conflicts with
  // existing `Icon` identifiers in the file (domain types from
  // @/lib/schema, destructured locals, etc).
  const specifiers: string[] = [];
  if (rewrittenIcons.length > 0) specifiers.push('Icon as UiIcon');
  for (const local of stillReferenced) {
    // Re-import identifier-style usages under their original Lucide
    // PascalCase names — every generated component is re-exported
    // from @hiero/ui-icons via `export * from generated/src`.
    specifiers.push(local);
  }

  const hieroImport =
    specifiers.length > 0
      ? `import { ${specifiers.sort().join(', ')} } from '@hiero/ui-icons';\n`
      : '';

  const firstImportIdx = workingSrc.search(/^import\s/m);
  if (firstImportIdx === -1) {
    workingSrc = hieroImport + workingSrc;
  } else {
    workingSrc =
      workingSrc.slice(0, firstImportIdx) +
      hieroImport +
      workingSrc.slice(firstImportIdx);
  }

  // Clean up double blank lines that may have been introduced.
  workingSrc = workingSrc.replace(/\n{3,}/g, '\n\n');

  return {
    path: filePath,
    iconsBefore: importedNames,
    iconsRewritten: rewrittenIcons,
    unknownIcons,
    newContents: workingSrc,
  };
}

async function main(): Promise<void> {
  let grepOutput = '';
  try {
    grepOutput = execSync(
      `grep -rlE "from ['\\\"]lucide-react['\\\"]" components/ app/ --include=*.tsx --include=*.ts`,
      { encoding: 'utf8' },
    );
  } catch {
    // grep exits 1 when no matches; treat as empty.
    grepOutput = '';
  }
  const files = grepOutput.trim().split('\n').filter(Boolean);

  process.stdout.write(
    `Found ${files.length} files importing from lucide-react. ${WRITE ? 'Rewriting.' : 'Dry run.'}\n`,
  );

  let totalRewrites = 0;
  let totalUnknown = 0;
  const unknownAggregate = new Set<string>();
  const filesChanged: string[] = [];

  for (const file of files) {
    const result = await migrateFile(file);
    if (result.newContents && result.iconsRewritten.length > 0) {
      totalRewrites += result.iconsRewritten.length;
      filesChanged.push(result.path);
      if (WRITE) {
        await writeFile(result.path, result.newContents, 'utf8');
      }
    }
    if (result.unknownIcons.length > 0) {
      totalUnknown += result.unknownIcons.length;
      for (const u of result.unknownIcons) unknownAggregate.add(u);
      process.stderr.write(
        `  UNKNOWN in ${result.path}: ${result.unknownIcons.join(', ')}\n`,
      );
    }
  }

  process.stdout.write(
    `\nFiles ${WRITE ? 'rewritten' : 'would be rewritten'}: ${filesChanged.length}\n`,
  );
  process.stdout.write(`Total icon rewrites: ${totalRewrites}\n`);
  process.stdout.write(`Unknown icon names: ${totalUnknown}\n`);
  if (unknownAggregate.size > 0) {
    process.stdout.write(
      `\nUnknown names (add to source/manifest.json if needed):\n${[...unknownAggregate]
        .sort()
        .map((u) => `  - ${u}`)
        .join('\n')}\n`,
    );
  }
}

main().catch((err) => {
  process.stderr.write(
    `${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
  );
  process.exit(1);
});
