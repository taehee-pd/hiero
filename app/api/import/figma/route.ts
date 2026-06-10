/**
 * Figma import proxy route.
 *
 * Three endpoints via POST body action:
 *   - { action: 'validate', token }       → validate PAT, return user info
 *   - { action: 'components', fileKey, token, query? } → list/search components
 *   - { action: 'import', fileKey, nodeId, token, name? }  → export node as SVG
 *
 * The token is per-user (Figma PAT) and passed per-request from the client.
 * It is never stored server-side.
 */

import { NextResponse } from 'next/server';
import {
  validateToken,
  getFileComponents,
  exportNodeAsSvg,
  filterComponents,
  FigmaApiError,
  type FigmaErrorCode,
} from '@/lib/import/adapters/figma-source';
import { formatFigmaName } from '@/lib/import/adapters/figma-adapter';

type RequestBody =
  | { action: 'validate'; token: string }
  | { action: 'components'; fileKey: string; token: string; query?: string }
  | { action: 'import'; fileKey: string; nodeId: string; token: string; name?: string };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.token || typeof body.token !== 'string') {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }

    switch (body.action) {
      case 'validate': {
        const user = await validateToken(body.token);
        return NextResponse.json({ user });
      }

      case 'components': {
        if (!body.fileKey) {
          return NextResponse.json({ error: 'fileKey is required' }, { status: 400 });
        }
        const all = await getFileComponents(body.fileKey, body.token);
        const filtered = body.query ? filterComponents(all, body.query) : all;
        return NextResponse.json({
          components: filtered.map((c) => ({
            key: c.key,
            name: c.name,
            nodeId: c.node_id,
            thumbnailUrl: c.thumbnail_url,
            frame: c.containing_frame?.name ?? null,
          })),
          total: all.length,
        });
      }

      case 'import': {
        if (!body.fileKey || !body.nodeId) {
          return NextResponse.json(
            { error: 'fileKey and nodeId are required' },
            { status: 400 },
          );
        }
        const svgContent = await exportNodeAsSvg(body.fileKey, body.nodeId, body.token);
        const suggestedName = body.name
          ? formatFigmaName(body.name)
          : 'Figma Icon';

        return NextResponse.json({
          svgContent,
          suggestedName,
          suggestedTags: ['figma'],
          provenance: {
            adapterId: 'figma',
            sourceLibrary: 'Figma',
            sourceIconId: `${body.fileKey}:${body.nodeId}`,
            importedAt: new Date().toISOString(),
          },
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: validate, components, or import' },
          { status: 400 },
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Figma API error';
    const code: FigmaErrorCode =
      error instanceof FigmaApiError ? error.code : 'upstream_error';
    return NextResponse.json(
      { error: message, code },
      { status: HTTP_STATUS_BY_CODE[code] },
    );
  }
}

/**
 * HTTP status per error category so generic clients behave sensibly,
 * while the `code` field stays the contract the import dialog reads.
 */
const HTTP_STATUS_BY_CODE: Record<FigmaErrorCode, number> = {
  auth_invalid: 401,
  rate_limited: 429,
  timeout: 504,
  upstream_error: 502,
};
