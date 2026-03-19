import type { Icon, Layer, PaintRef, State, Variant } from '@/lib/schema/types';

export function generateIconComponent(
  icon: Icon,
  options?: { typescript?: boolean },
): string {
  const typescript = options?.typescript !== false;
  const variant = getFirstVariant(icon);
  const componentName = toPascal(icon.name || icon.id);
  const defaultState = getDefaultState(variant);
  const defaultSize = variant.size;
  const viewBox = variant.viewBox.join(' ');
  const useRuntime = hasInteractiveRuntime(icon);

  const lines: string[] = [];
  lines.push("import React, { forwardRef } from 'react';");
  if (typescript) {
    lines.push("import type { CSSProperties } from 'react';");
  }
  if (useRuntime) {
    lines.push("import { RuntimeIcon } from '@coniva/runtime-react';");
  }
  lines.push('');

  if (typescript) {
    lines.push(`export type ${componentName}Props = {`);
    lines.push('  size?: number;');
    lines.push('  color?: string;');
    lines.push('  strokeWidth?: number;');
    lines.push('  className?: string;');
    lines.push('  style?: CSSProperties;');
    lines.push('  state?: string;');
    lines.push('  animate?: boolean;');
    lines.push('};');
    lines.push('');
  }

  if (useRuntime) {
    lines.push(`const runtimeIcon = ${JSON.stringify(buildRuntimePayload(icon), null, 2)};`);
    lines.push('');
  }

  if (typescript) {
    lines.push(
      `export const ${componentName} = forwardRef<SVGSVGElement, ${componentName}Props>(function ${componentName}({`,
    );
  } else {
    lines.push(`export const ${componentName} = forwardRef(function ${componentName}({`);
  }

  lines.push(`  size = ${defaultSize},`);
  lines.push("  color = 'currentColor',");
  lines.push('  strokeWidth,');
  lines.push('  className,');
  lines.push('  style,');
  lines.push('  state,');
  lines.push('  animate = false,');
  lines.push(typescript ? `}: ${componentName}Props, ref) {` : '}, ref) {');

  if (useRuntime) {
    lines.push('  if (state || animate) {');
    lines.push(
      '    return <RuntimeIcon ref={ref} icon={runtimeIcon} size={size} color={color} strokeWidth={strokeWidth} className={className} style={style} state={state} animate={animate} />;',
    );
    lines.push('  }');
    lines.push('');
  }

  lines.push('  return (');
  lines.push('    <svg');
  lines.push('      ref={ref}');
  lines.push('      xmlns="http://www.w3.org/2000/svg"');
  lines.push(`      viewBox="${viewBox}"`);
  lines.push('      width={size}');
  lines.push('      height={size}');
  lines.push('      className={className}');
  lines.push('      style={style}');
  lines.push('      fill="none"');
  lines.push('      color={color}');
  lines.push('    >');
  lines.push(...buildStaticSvgLines(defaultState.layers).map((line) => `      ${line}`));
  lines.push('    </svg>');
  lines.push('  );');
  lines.push('});');

  return `${lines.join('\n')}\n`;
}

function getFirstVariant(icon: Icon): Variant {
  const key = Object.keys(icon.variants).sort((a, b) => a.localeCompare(b))[0];
  if (!key) {
    throw new Error(`Icon "${icon.id}" has no variants.`);
  }
  return icon.variants[key]!;
}

function getDefaultState(variant: Variant): State {
  return variant.states[variant.defaultState] ?? Object.values(variant.states)[0] ?? failNoState(variant.id);
}

function failNoState(variantId: string): never {
  throw new Error(`Variant "${variantId}" has no states.`);
}

function hasInteractiveRuntime(icon: Icon): boolean {
  if (Object.keys(icon.transitions).length > 0 || (icon.effects && Object.keys(icon.effects).length > 0)) {
    return true;
  }
  return Object.values(icon.variants).some((variant) => Object.keys(variant.states).length > 1);
}

function buildStaticSvgLines(layers: Record<string, Layer>): string[] {
  const lines: string[] = [];
  const orderedLayers = Object.keys(layers)
    .sort((a, b) => a.localeCompare(b))
    .map((id) => layers[id]);

  for (const layer of orderedLayers) {
    if (!layer || layer.visible === false || !layer.path?.d || layer.isClipMask) continue;
    const attrs: string[] = [];
    attrs.push(`d="${escapeAttr(layer.path.d)}"`);
    if (layer.path.fillRule) {
      attrs.push(`fillRule="${layer.path.fillRule}"`);
    }

    const fill = resolvePaint(layer.style.fill);
    const stroke = resolvePaint(layer.style.stroke);
    if (fill !== 'none') attrs.push(`fill="${fill}"`);
    if (stroke !== 'none') attrs.push(`stroke="${stroke}"`);
    if (layer.style.fillOpacity !== undefined) attrs.push(`fillOpacity={${layer.style.fillOpacity}}`);
    if (layer.style.strokeOpacity !== undefined) attrs.push(`strokeOpacity={${layer.style.strokeOpacity}}`);
    if (layer.style.lineCap) attrs.push(`strokeLinecap="${layer.style.lineCap}"`);
    if (layer.style.lineJoin) attrs.push(`strokeLinejoin="${layer.style.lineJoin}"`);
    attrs.push(`strokeWidth={strokeWidth ?? ${layer.style.strokeWidth ?? 1}}`);

    lines.push(`<path ${attrs.join(' ')} />`);
  }

  return lines;
}

function buildRuntimePayload(icon: Icon): unknown {
  return {
    id: icon.id,
    name: icon.name,
    variants: icon.variants,
    transitions: icon.transitions,
    effects: icon.effects ?? {},
  };
}

function resolvePaint(paint: PaintRef | undefined): string {
  if (!paint) return 'none';
  switch (paint.mode) {
    case 'currentColor':
      return 'currentColor';
    case 'fixed':
      return paint.value;
    case 'token':
      return 'currentColor';
    default:
      return 'none';
  }
}

function toPascal(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
