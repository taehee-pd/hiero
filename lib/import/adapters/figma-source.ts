/**
 * Figma API client — server-side proxy for the Figma REST API.
 *
 * Architecture:
 * ```
 * Browser → POST /api/import/figma → figma-source.ts → api.figma.com
 *                                        │
 *                                        ├── GET /v1/files/:fileKey/components
 *                                        └── GET /v1/images/:fileKey?ids=:nodeId&format=svg
 * ```
 *
 * Figma PATs are per-user, not org-level. The token is passed
 * per-request from the client side.
 */

const FIGMA_API = 'https://api.figma.com';

export type FigmaComponent = {
  key: string;
  name: string;
  description: string;
  node_id: string;
  thumbnail_url: string;
  containing_frame: { name: string; nodeId: string } | null;
};

export type FigmaFileComponentsResponse = {
  meta: {
    components: FigmaComponent[];
  };
};

export type FigmaImagesResponse = {
  images: Record<string, string | null>;
};

export type FigmaUserResponse = {
  id: string;
  handle: string;
  email: string;
};

/**
 * Parse a Figma URL into fileKey.
 * Supports:
 *   figma.com/design/:fileKey/:fileName
 *   figma.com/file/:fileKey/:fileName
 *   figma.com/design/:fileKey/branch/:branchKey/:fileName
 */
export function parseFigmaUrl(url: string): { fileKey: string } | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('figma.com')) return null;

    const parts = parsed.pathname.split('/').filter(Boolean);
    // /design/:fileKey/... or /file/:fileKey/...
    if ((parts[0] === 'design' || parts[0] === 'file') && parts[1]) {
      // Branch URL: /design/:fileKey/branch/:branchKey/:fileName
      if (parts[2] === 'branch' && parts[3]) {
        return { fileKey: parts[3] };
      }
      return { fileKey: parts[1] };
    }
    return null;
  } catch {
    return null;
  }
}

async function figmaGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${FIGMA_API}${path}`, {
    headers: {
      'X-Figma-Token': token,
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Figma API ${response.status}: ${text.slice(0, 200)}`);
  }
  return (await response.json()) as T;
}

/** Validate token by calling GET /v1/me */
export async function validateToken(token: string): Promise<FigmaUserResponse> {
  return figmaGet<FigmaUserResponse>('/v1/me', token);
}

/** List all components in a file. */
export async function getFileComponents(
  fileKey: string,
  token: string,
): Promise<FigmaComponent[]> {
  const data = await figmaGet<FigmaFileComponentsResponse>(
    `/v1/files/${fileKey}/components`,
    token,
  );
  return data.meta.components;
}

/** Export a single node as SVG. Returns the SVG string. */
export async function exportNodeAsSvg(
  fileKey: string,
  nodeId: string,
  token: string,
): Promise<string> {
  // Step 1: Get the image URL
  const imagesData = await figmaGet<FigmaImagesResponse>(
    `/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=svg&svg_include_id=true`,
    token,
  );

  const imageUrl = imagesData.images[nodeId];
  if (!imageUrl) {
    throw new Error(`Figma did not return an image for node ${nodeId}`);
  }

  // Step 2: Fetch the actual SVG content
  const svgResponse = await fetch(imageUrl);
  if (!svgResponse.ok) {
    throw new Error(`Failed to download SVG from Figma CDN: ${svgResponse.status}`);
  }
  return svgResponse.text();
}

/** Search components by name (client-side filter). */
export function filterComponents(
  components: FigmaComponent[],
  query: string,
): FigmaComponent[] {
  const lower = query.toLowerCase().trim();
  if (!lower) return components;
  return components.filter(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      (c.containing_frame?.name.toLowerCase().includes(lower) ?? false),
  );
}
