const STATIC_EXPORT_MODE = process.env.NEXT_PUBLIC_OUTPUT_MODE === 'export';

export function buildEditorRoute(iconId?: string | null) {
  if (!iconId) {
    return '/editor';
  }

  if (STATIC_EXPORT_MODE) {
    return `/editor?icon=${encodeURIComponent(iconId)}`;
  }

  return `/editor/${iconId}`;
}

export function parseEditorSearchParam(value: string | string[] | undefined) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}
