/**
 * The icon editor lives at the root path, served by `StudioLayout`. State
 * is communicated via query params (`?project=` and `?icon=`) so URLs
 * remain bookmarkable. Earlier `/editor` and `/editor/[iconId]` routes
 * are kept around as client-side redirects to this canonical entry.
 */
export function buildEditorRoute(
  iconId?: string | null,
  iconSetId?: string | null,
) {
  const search = new URLSearchParams();
  if (iconSetId) search.set('project', iconSetId);
  if (iconId) search.set('icon', iconId);
  const query = search.toString();
  return query ? `/?${query}` : '/';
}

export function parseEditorSearchParam(value: string | string[] | undefined) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}
