import type { Icon, Variant } from '@/lib/schema/types';

export function generateIconComponent(
  icon: Icon,
  options?: { typescript?: boolean },
): string {
  const typescript = options?.typescript !== false;
  const variant = getFirstVariant(icon);
  const componentName = toPascal(icon.name || icon.id);
  const defaultSize = variant.size;
  const defaultVariantId = variant.id;

  const variantIds = Object.keys(icon.variants).sort((a, b) => a.localeCompare(b));
  const effectIds = Object.keys(icon.effects ?? {}).sort((a, b) => a.localeCompare(b));

  const lines: string[] = [];
  lines.push("import React from 'react';");
  if (typescript) {
    lines.push("import type { CSSProperties } from 'react';");
  }
  lines.push("import { HieroIcon } from '@/lib/runtime-react';");
  if (typescript) {
    lines.push("import type { Icon } from '@/lib/schema/types';");
  }
  lines.push('');

  if (typescript) {
    lines.push(`export type ${componentName}Props = {`);
    lines.push('  size?: number;');
    lines.push('  color?: string;');
    lines.push('  className?: string;');
    lines.push('  style?: CSSProperties;');
    lines.push('  label?: string;');
    lines.push("  reduceMotion?: boolean | 'system';");
    lines.push(`  variant?: ${stringUnion([...variantIds, ...iconSizeLiteralValues(icon)])} | number;`);
    if (effectIds.length > 0) {
      lines.push(`  effect?: ${stringUnion(effectIds)} | null;`);
    } else {
      lines.push('  effect?: never;');
    }
    lines.push('  animate?: boolean;');
    lines.push('};');
    lines.push('');
  }

  lines.push(`const iconData = ${JSON.stringify(icon, null, 2)} as const;`);
  if (typescript) {
    lines.push('const typedIconData: Icon = iconData as unknown as Icon;');
  }
  lines.push('');

  if (typescript) {
    lines.push(`export function ${componentName}({`);
  } else {
    lines.push(`export function ${componentName}({`);
  }

  lines.push(`  size = ${defaultSize},`);
  lines.push("  color = 'currentColor',");
  lines.push('  className,');
  lines.push('  style,');
  lines.push('  label,');
  lines.push("  reduceMotion = 'system',");
  lines.push(`  variant = ${JSON.stringify(defaultVariantId)},`);
  if (effectIds.length > 0) {
    lines.push('  effect = null,');
  }
  lines.push('  animate = true,');
  lines.push(typescript ? `}: ${componentName}Props) {` : '}) {');

  lines.push('  return (');
  lines.push('    <HieroIcon');
  lines.push(typescript ? '      icon={typedIconData}' : '      icon={iconData as any}');
  lines.push('      size={size}');
  lines.push('      color={color}');
  lines.push('      className={className}');
  lines.push('      style={style}');
  lines.push('      label={label}');
  lines.push('      reduceMotion={reduceMotion}');
  lines.push('      variant={variant}');
  lines.push('      animate={animate}');
  if (effectIds.length > 0) {
    lines.push('      effect={effect}');
  }
  lines.push('    />');
  lines.push('  );');
  lines.push('}');

  return `${lines.join('\n')}\n`;
}

function getFirstVariant(icon: Icon): Variant {
  const key = Object.keys(icon.variants).sort((a, b) => a.localeCompare(b))[0];
  if (!key) {
    throw new Error(`Icon "${icon.id}" has no variants.`);
  }
  return icon.variants[key]!;
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
  return values.map((value) => JSON.stringify(value)).join(' | ');
}

function toPascal(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}
