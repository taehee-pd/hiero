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

/** Upstream calls abort after this long so the UI never spins forever. */
export const FIGMA_FETCH_TIMEOUT_MS = 20_000;

/**
 * Machine-readable failure category. The API route forwards this to the
 * client so it can distinguish "fix your token" (auth_invalid) from
 * "wait and retry" (rate_limited / timeout) from "Figma is having a bad
 * day" (upstream_error).
 */
export type FigmaErrorCode =
  | 'auth_invalid'
  | 'rate_limited'
  | 'timeout'
  | 'upstream_error';

export class FigmaApiError extends Error {
  readonly code: FigmaErrorCode;
  readonly upstreamStatus: number | null;

  constructor(code: FigmaErrorCode, message: string, upstreamStatus: number | null = null) {
    super(message);
    this.name = 'FigmaApiError';
    this.code = code;
    this.upstreamStatus = upstreamStatus;
  }
}

export function figmaErrorFromStatus(status: number, detail: string): FigmaApiError {
  if (status === 401 || status === 403) {
    return new FigmaApiError(
      'auth_invalid',
      'Figma rejected the access token. Generate a new personal access token and try again.',
      status,
    );
  }
  if (status === 429) {
    return new FigmaApiError(
      'rate_limited',
      'Figma rate limit reached. Wait a minute and try again.',
      status,
    );
  }
  return new FigmaApiError('upstream_error', `Figma API ${status}: ${detail}`, status);
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(FIGMA_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new FigmaApiError(
        'timeout',
        `Figma did not respond within ${FIGMA_FETCH_TIMEOUT_MS / 1000}s. Try again.`,
      );
    }
    throw error;
  }
}

/**
 * Returns true if the given URL is an allowed Figma CDN origin.
 *
 * Accepted origins:
 *   - figma.com itself
 *   - Any *.figma.com subdomain (e.g. figma-alpha-api.figma.com)
 *   - AWS S3 hosts whose hostname starts with "figma-" (Figma image exports
 *     are served from figma-alpha-api.s3.us-west-2.amazonaws.com and similar).
 *
 * Rejected:
 *   - Non-https protocols
 *   - Any host that contains "figma" as a substring but is not one of the
 *     above (e.g. evilfigma.com, figma.com.attacker.com).
 */
export function isAllowedFigmaCdnUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const h = parsed.hostname;
  // Exact match or *.figma.com subdomain
  if (h === 'figma.com' || h.endsWith('.figma.com')) return true;
  // AWS S3 hosts for Figma image exports (hostname starts with "figma-" and ends with ".amazonaws.com")
  if (h.startsWith('figma-') && h.endsWith('.amazonaws.com')) return true;
  return false;
}

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
    if (parsed.hostname !== 'figma.com' && !parsed.hostname.endsWith('.figma.com')) return null;

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
  const response = await fetchWithTimeout(`${FIGMA_API}${path}`, {
    headers: {
      'X-Figma-Token': token,
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw figmaErrorFromStatus(response.status, text.slice(0, 200));
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

  // Step 2: Validate the CDN origin before fetching (SSRF guard)
  if (!isAllowedFigmaCdnUrl(imageUrl)) {
    let origin = imageUrl;
    try {
      origin = new URL(imageUrl).origin;
    } catch {
      // keep raw url
    }
    throw new FigmaApiError(
      'upstream_error',
      `Refusing to fetch icon SVG from unexpected origin: ${origin}`,
    );
  }

  // Step 3: Fetch the actual SVG content
  const svgResponse = await fetchWithTimeout(imageUrl);
  if (!svgResponse.ok) {
    throw new FigmaApiError(
      'upstream_error',
      `Failed to download SVG from Figma CDN: ${svgResponse.status}`,
      svgResponse.status,
    );
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
