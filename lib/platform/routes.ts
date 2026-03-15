const STATIC_EXPORT_MODE = process.env.NEXT_PUBLIC_OUTPUT_MODE === 'export';

export function buildEditorRoute(iconId?: string | null, iconSetId?: string | null) {
  const search = new URLSearchParams();
  if (iconId) search.set('icon', iconId);
  if (iconSetId) search.set('set', iconSetId);
  const query = search.toString();

  if (!iconId && !iconSetId) return '/editor';

  if (STATIC_EXPORT_MODE) {
    return `/editor${query ? `?${query}` : ''}`;
  }

  if (iconId) {
    return `/editor/${iconId}${iconSetId ? `?set=${encodeURIComponent(iconSetId)}` : ''}`;
  }

  return `/editor${query ? `?${query}` : ''}`;
}

export function parseEditorSearchParam(value: string | string[] | undefined) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}
