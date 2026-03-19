/**
 * React adapter — generates React components from the Coniva Icon schema,
 * embedding the full Icon payload and wrapping it with ConivaIcon.
 *
 * This is a pure transform (no I/O). The caller is responsible for writing
 * the generated files to disk.
 *
 * @module
 */

import type { Icon } from '@/lib/schema/types';
import type {
  RuntimeIconMeta,
  RuntimeVariantPayload,
} from '@/lib/export/export-runtime-json';
import type { PlatformDiagnostic } from '@/lib/platform/types';
import {
  checkPlatformCapabilities,
  REACT_CAPABILITIES,
} from '@/lib/platform/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ReactAdapterInput = {
  icon: Icon;
  meta: RuntimeIconMeta;
  variants: RuntimeVariantPayload[];
};

export type ReactAdapterOptions = {
  /** Package import path for runtime. Default: '@coniva/runtime-react' */
  runtimePackage?: string;
  /** Emit TypeScript (.tsx). Default: true */
  typescript?: boolean;
  /** Output directory prefix. Default: 'src' */
  outputDir?: string;
};

export type ReactAdapterResult = {
  files: Array<{ path: string; contents: string }>;
  diagnostics: PlatformDiagnostic[];
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generate React components for a list of icons.
 *
 * For each icon a `{outputDir}/{ComponentName}/{ComponentName}.tsx` file is
 * emitted, plus a barrel `{outputDir}/index.ts`.
 */
export function generateReactFromRuntime(
  icons: ReactAdapterInput[],
  options?: ReactAdapterOptions,
): ReactAdapterResult {
  const runtimePackage = options?.runtimePackage ?? '@coniva/runtime-react';
  const typescript = options?.typescript !== false;
  const outputDir = options?.outputDir ?? 'src';
  const ext = typescript ? '.tsx' : '.jsx';

  const files: Array<{ path: string; contents: string }> = [];
  const diagnostics: PlatformDiagnostic[] = [];
  const componentNames: string[] = [];

  for (const { icon, meta, variants } of icons) {
    // Collect diagnostics from capability check
    for (const variant of variants) {
      const diags = checkPlatformCapabilities(
        REACT_CAPABILITIES,
        icon.id,
        variant.variant.id,
        variant,
      );
      diagnostics.push(...diags);
    }

    const componentName = toPascal(icon.name || icon.id);
    componentNames.push(componentName);

    const stateIds = collectStateIds(icon);
    const variantIds = Object.keys(icon.variants).sort((a, b) =>
      a.localeCompare(b),
    );
    const effectIds = Object.keys(icon.effects ?? {}).sort((a, b) =>
      a.localeCompare(b),
    );
    const firstVariant = getFirstVariant(icon);
    const defaultSize = firstVariant.size;
    const defaultVariantId = firstVariant.id;
    const defaultStateId = firstVariant.defaultState;

    const code = generateComponent({
      componentName,
      icon,
      runtimePackage,
      typescript,
      stateIds,
      variantIds,
      effectIds,
      defaultSize,
      defaultVariantId,
      defaultStateId,
      sizeLiterals: iconSizeLiteralValues(icon),
    });

    files.push({
      path: `${outputDir}/${componentName}/${componentName}${ext}`,
      contents: code,
    });
  }

  // Barrel index
  const indexLines: string[] = [];
  for (const name of componentNames.sort((a, b) => a.localeCompare(b))) {
    indexLines.push(
      `export { ${name} } from './${name}/${name}';`,
    );
    if (typescript) {
      indexLines.push(
        `export type { ${name}Props } from './${name}/${name}';`,
      );
    }
  }
  indexLines.push('');

  files.push({
    path: `${outputDir}/index.ts`,
    contents: indexLines.join('\n'),
  });

  return { files, diagnostics };
}

// ---------------------------------------------------------------------------
// Component code generation
// ---------------------------------------------------------------------------

type ComponentGenParams = {
  componentName: string;
  icon: Icon;
  runtimePackage: string;
  typescript: boolean;
  stateIds: string[];
  variantIds: string[];
  effectIds: string[];
  defaultSize: number;
  defaultVariantId: string;
  defaultStateId: string;
  sizeLiterals: string[];
};

function generateComponent(params: ComponentGenParams): string {
  const {
    componentName,
    icon,
    runtimePackage,
    typescript,
    stateIds,
    variantIds,
    effectIds,
    defaultSize,
    defaultVariantId,
    defaultStateId,
    sizeLiterals,
  } = params;

  const lines: string[] = [];

  // Imports
  lines.push(`import { ConivaIcon } from '${runtimePackage}';`);
  if (typescript) {
    lines.push(`import type { Icon } from '${runtimePackage}';`);
    lines.push("import type { CSSProperties } from 'react';");
  }
  lines.push('');

  // Type definition
  if (typescript) {
    lines.push(`export type ${componentName}Props = {`);
    lines.push('  size?: number;');
    lines.push('  color?: string;');
    lines.push('  className?: string;');
    lines.push('  style?: CSSProperties;');
    lines.push('  label?: string;');
    lines.push("  reduceMotion?: boolean | 'system';");
    lines.push(
      `  variant?: ${stringUnion([...variantIds, ...sizeLiterals])} | number;`,
    );
    lines.push(`  state?: ${stringUnion(stateIds)};`);
    if (effectIds.length > 0) {
      lines.push(`  effect?: ${stringUnion(effectIds)} | null;`);
    } else {
      lines.push('  effect?: never;');
    }
    lines.push('  animate?: boolean;');
    lines.push('};');
    lines.push('');
  }

  // Embedded icon data
  lines.push(
    `const iconData = ${JSON.stringify(icon, null, 2)} as const;`,
  );
  if (typescript) {
    lines.push('const typedIconData: Icon = iconData as unknown as Icon;');
  }
  lines.push('');

  // Component function
  lines.push(`export function ${componentName}({`);
  lines.push(`  size = ${defaultSize},`);
  lines.push("  color = 'currentColor',");
  lines.push('  className,');
  lines.push('  style,');
  lines.push('  label,');
  lines.push("  reduceMotion = 'system',");
  lines.push(`  variant = ${JSON.stringify(defaultVariantId)},`);
  lines.push(`  state = ${JSON.stringify(defaultStateId)},`);
  if (effectIds.length > 0) {
    lines.push('  effect = null,');
  }
  lines.push('  animate = true,');
  lines.push(
    typescript ? `}: ${componentName}Props) {` : '}) {',
  );

  lines.push('  return (');
  lines.push('    <ConivaIcon');
  lines.push(
    typescript
      ? '      icon={typedIconData}'
      : '      icon={iconData as any}',
  );
  lines.push('      size={size}');
  lines.push('      color={color}');
  lines.push('      className={className}');
  lines.push('      style={style}');
  lines.push('      label={label}');
  lines.push('      reduceMotion={reduceMotion}');
  lines.push('      variant={variant}');
  lines.push('      state={state}');
  lines.push('      animate={animate}');
  if (effectIds.length > 0) {
    lines.push('      effect={effect}');
  }
  lines.push('    />');
  lines.push('  );');
  lines.push('}');

  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFirstVariant(icon: Icon) {
  const key = Object.keys(icon.variants).sort((a, b) =>
    a.localeCompare(b),
  )[0];
  if (!key) throw new Error(`Icon "${icon.id}" has no variants.`);
  return icon.variants[key]!;
}

function collectStateIds(icon: Icon): string[] {
  const ids = new Set<string>();
  for (const variant of Object.values(icon.variants)) {
    for (const stateId of Object.keys(variant.states)) {
      ids.add(stateId);
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function iconSizeLiteralValues(icon: Icon): string[] {
  const sizes = new Set<string>();
  for (const variant of Object.values(icon.variants)) {
    sizes.add(String(variant.size));
  }
  return [...sizes].sort((a, b) => Number(a) - Number(b));
}

function stringUnion(values: string[]): string {
  if (values.length === 0) return 'never';
  return values.map((v) => JSON.stringify(v)).join(' | ');
}

function toPascal(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}
