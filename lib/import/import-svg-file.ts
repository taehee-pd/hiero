import type { Icon } from '@/lib/schema/types';
import { editorStore } from '@/lib/editor-store/store';
import { importSvg } from './import-svg';

type ImportSvgIconOptions = {
  existingIconIds?: Iterable<string>;
  sourceName?: string;
};

export async function importSvgFile(file: File, options: ImportSvgIconOptions = {}): Promise<Icon> {
  const svgString = await file.text();
  return createImportedIcon(svgString, {
    ...options,
    sourceName: options.sourceName ?? file.name,
  });
}

export async function importSvgFileIntoEditor(file: File): Promise<string> {
  const existingIconIds = Object.keys(editorStore.getState().project?.icons ?? {});
  const icon = await importSvgFile(file, { existingIconIds });
  editorStore.getState().insertIcon(icon);
  return editorStore.getState().currentIconId ?? icon.id;
}

export async function importSvgContentIntoEditor(
  svgString: string,
  sourceName = 'Imported SVG',
): Promise<string> {
  const existingIconIds = Object.keys(editorStore.getState().project?.icons ?? {});
  const icon = createImportedIcon(svgString, { existingIconIds, sourceName });
  editorStore.getState().insertIcon(icon);
  return editorStore.getState().currentIconId ?? icon.id;
}

export function createImportedIcon(
  svgString: string,
  options: ImportSvgIconOptions = {},
): Icon {
  const { layers, viewBox } = importSvg(svgString);
  const baseName = stripSvgExtension(options.sourceName ?? 'Imported SVG');
  const displayName = formatIconName(baseName);
  const iconId = ensureUniqueId(
    buildIconId(baseName),
    options.existingIconIds ?? [],
  );
  const size = inferVariantSize(viewBox);
  const variantId = buildVariantId(size);

  return {
    id: iconId,
    name: displayName,
    variants: {
      [variantId]: {
        id: variantId,
        name: String(size),
        size,
        viewBox,
        layers,
      },
    },
    transitions: {},
  };
}

export function isSvgFile(file: File): boolean {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
}

function stripSvgExtension(value: string): string {
  return value.replace(/\.svg$/i, '').trim() || 'Imported SVG';
}

function buildIconId(value: string): string {
  const sanitized = sanitizeSlug(value);
  return sanitized.startsWith('icon-') ? sanitized : `icon-${sanitized}`;
}

function sanitizeSlug(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'imported-svg';
}

function formatIconName(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function inferVariantSize(viewBox: [number, number, number, number]): number {
  const size = Math.max(viewBox[2], viewBox[3]);
  if (!Number.isFinite(size) || size <= 0) return 24;
  return Math.round(size);
}

function buildVariantId(size: number): string {
  return `v${size}`;
}

function ensureUniqueId(candidate: string, existingIds: Iterable<string>): string {
  const existing = new Set(existingIds);
  if (!existing.has(candidate)) return candidate;

  let suffix = 2;
  let nextId = `${candidate}-${suffix}`;
  while (existing.has(nextId)) {
    suffix += 1;
    nextId = `${candidate}-${suffix}`;
  }
  return nextId;
}
