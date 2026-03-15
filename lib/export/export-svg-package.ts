import { exportSvgString } from '@/lib/export/export-svg';
import type { Project, RenderingMode } from '@/lib/schema/types';

export type FileMap = Record<string, string>;

export function exportSvgPackage(
  project: Project,
  options?: {
    variants?: string[];
    icons?: string[];
    renderingMode?: RenderingMode | RenderingMode[];
  },
): FileMap {
  const files: FileMap = {};
  const iconIds = resolveIconIds(project, options?.icons);
  const modes = normalizeRenderingModes(options?.renderingMode);

  for (const iconId of iconIds) {
    const icon = project.icons[iconId];
    if (!icon) continue;

    const variantIds = resolveVariantIds(icon.variants, options?.variants);
    const iconDir = `icons/${toKebab(icon.name || icon.id)}`;

    for (const variantId of variantIds) {
      const variant = icon.variants[variantId];
      if (!variant) continue;

      const stateId = variant.defaultState;
      if (!variant.states[stateId]) continue;

      if (modes.length === 0) {
        files[`${iconDir}/${variant.size}.svg`] = exportSvgString(
          icon,
          variant.id,
          stateId,
          project.tokenSet?.colors,
          undefined,
        );
        continue;
      }

      if (modes.length === 1) {
        files[`${iconDir}/${variant.size}.svg`] = exportSvgString(
          icon,
          variant.id,
          stateId,
          project.tokenSet?.colors,
          modes[0],
        );
        continue;
      }

      for (const mode of modes) {
        files[`${iconDir}/${variant.size}-${mode}.svg`] = exportSvgString(
          icon,
          variant.id,
          stateId,
          project.tokenSet?.colors,
          mode,
        );
      }
    }
  }

  return files;
}

function resolveIconIds(project: Project, iconFilter?: string[]): string[] {
  const allIds = Object.keys(project.icons).sort((a, b) => a.localeCompare(b));
  if (!iconFilter || iconFilter.length === 0) return allIds;
  const include = new Set(iconFilter);
  return allIds.filter((id) => include.has(id));
}

function resolveVariantIds(
  variants: Record<string, { id: string }>,
  variantFilter?: string[],
): string[] {
  const allIds = Object.keys(variants).sort((a, b) => a.localeCompare(b));
  if (!variantFilter || variantFilter.length === 0) return allIds;
  const include = new Set(variantFilter);
  return allIds.filter((id) => include.has(id));
}

function normalizeRenderingModes(
  renderingMode?: RenderingMode | RenderingMode[],
): RenderingMode[] {
  if (!renderingMode) return [];
  const values = Array.isArray(renderingMode) ? renderingMode : [renderingMode];
  return [...new Set(values)];
}

function toKebab(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
