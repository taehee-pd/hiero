/**
 * Cuneiform dev server — Lane 1 local HTTP API.
 *
 * Runs in the consumer repo (not in the editor). Consumers install
 * @cuneiform/cli and run `cuneiform dev` to start this server.
 *
 * Responsibilities:
 *   - Watch sourceDir for changes and trigger incremental rebuilds
 *   - Expose HTTP API for the editor to push source files
 *   - Write compiled output to all configured hostTarget locations
 *
 * Listens on localhost only (127.0.0.1) to prevent network exposure.
 * Optional shared secret guards the POST endpoints.
 *
 * Endpoints:
 *   POST /api/source/icons     Receive icon.json + preview.svg files
 *   POST /api/source/manifest  Receive manifest.json, trigger rebuild
 *   GET  /api/status           Current config + build stats
 *   GET  /api/icons            List of current icons with metadata
 *
 * Node.js only — not imported by browser code.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
  DevServerConfig,
  DevServerState,
  DevServerStatus,
  DevServerIconEntry,
  SourceIngestRequest,
} from './types';
import { incrementalRebuild, fullRebuild } from './incremental-rebuild';
import { watchSourceDir } from './file-watcher';

// ---------------------------------------------------------------------------
// Start the dev server
// ---------------------------------------------------------------------------

export async function startDevServer(serverConfig: DevServerConfig): Promise<{
  port: number;
  close(): Promise<void>;
}> {
  const { repoRoot, cuneiform: config, port } = serverConfig;

  const state: DevServerState = {
    iconCount: 0,
    lastBuildAt: null,
    lastBuildDurationMs: null,
    watching: false,
    previousSourceFiles: null,
  };

  // --- Initial full build ---
  console.log(`[cuneiform] Starting dev server on port ${port}...`);
  console.log(`[cuneiform] Source directory: ${path.resolve(repoRoot, config.sourceDir)}`);
  console.log(`[cuneiform] Host targets: ${config.hostTargets.map((t) => `${t.kind}(${t.runtimeMode})`).join(', ')}`);

  const initialBuild = await fullRebuild(repoRoot, config);
  applyBuildResult(state, initialBuild);

  if (initialBuild.kind === 'success') {
    console.log(
      `[cuneiform] Initial build: ${initialBuild.totalIcons} icon(s) in ${initialBuild.durationMs}ms`,
    );
  } else if (initialBuild.kind === 'error') {
    console.warn(`[cuneiform] Initial build failed: ${initialBuild.error}`);
    console.warn(`[cuneiform] Continuing — server will retry on file change.`);
  }

  // --- File watcher ---
  const sourceDir = path.resolve(repoRoot, config.sourceDir);
  const watcher = watchSourceDir(sourceDir, async () => {
    const result = await incrementalRebuild(repoRoot, config, state.previousSourceFiles);
    applyBuildResult(state, result);

    if (result.kind === 'success') {
      console.log(
        `[cuneiform] Rebuilt ${result.changedIcons} icon(s) in ${result.durationMs}ms`,
      );
    } else if (result.kind === 'error') {
      console.warn(`[cuneiform] Rebuild failed: ${result.error}`);
    }
    // no-op: silent
  });
  state.watching = watcher.active;

  // --- HTTP server ---
  const server = createServer((req, res) => {
    void handleRequest(req, res, serverConfig, state);
  });

  await new Promise<void>((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  console.log(`[cuneiform] Listening on http://localhost:${port}`);

  return {
    port,
    async close() {
      watcher.close();
      state.watching = false;
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

// ---------------------------------------------------------------------------
// Request dispatcher
// ---------------------------------------------------------------------------

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  serverConfig: DevServerConfig,
  state: DevServerState,
): Promise<void> {
  const { method, url } = req;
  const { repoRoot, cuneiform: config, apiSecret } = serverConfig;

  // CORS — reflect the request origin so the editor works from any origin
  // (localhost web editor, desktop webview, hosted app). The server already
  // binds to 127.0.0.1 only, so arbitrary-origin reflection is safe here.
  const requestOrigin = req.headers['origin'];
  if (requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Auth: POST endpoints require Bearer token when apiSecret is set
  if (method === 'POST' && apiSecret) {
    const auth = req.headers['authorization'] ?? '';
    if (auth !== `Bearer ${apiSecret}`) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }
  }

  try {
    if (method === 'GET' && url === '/api/status') {
      await handleGetStatus(res, serverConfig, state);
    } else if (method === 'GET' && url === '/api/icons') {
      await handleGetIcons(res, state);
    } else if (method === 'POST' && url === '/api/source/icons') {
      await handlePostIcons(req, res, repoRoot, config, state);
    } else if (method === 'POST' && url === '/api/source/manifest') {
      await handlePostManifest(req, res, repoRoot, config, state);
    } else {
      sendJson(res, 404, { error: 'Not found' });
    }
  } catch (err) {
    console.error(`[cuneiform] Unhandled request error:`, err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleGetStatus(
  res: ServerResponse,
  serverConfig: DevServerConfig,
  state: DevServerState,
): Promise<void> {
  const { repoRoot, cuneiform: config, port } = serverConfig;
  const status: DevServerStatus = {
    ok: true,
    repoRoot,
    sourceDir: config.sourceDir,
    iconCount: state.iconCount,
    lastBuildAt: state.lastBuildAt,
    lastBuildDurationMs: state.lastBuildDurationMs,
    watching: state.watching,
    port,
    hostTargets: config.hostTargets.map((t) => ({
      kind: t.kind,
      runtimeMode: t.runtimeMode,
      ...(t.cacheDir ? { cacheDir: t.cacheDir } : {}),
    })),
    releaseTargets: (config.releaseTargets ?? []).map((t) => {
      if (t.kind === 'local-directory') {
        return { kind: t.kind, outputMode: t.outputMode, outputDir: t.outputDir };
      }
      if (t.kind === 'git-pr') {
        return {
          kind: t.kind,
          outputMode: t.outputMode,
          owner: t.owner,
          repo: t.repo,
          baseBranch: t.baseBranch,
          ...(t.packagePath ? { packagePath: t.packagePath } : {}),
        };
      }
      // npm-registry
      return {
        kind: t.kind,
        outputMode: t.outputMode,
        packageName: t.packageName,
        ...(t.registry ? { registry: t.registry } : {}),
        ...(t.scope ? { scope: t.scope } : {}),
      };
    }),
  };
  sendJson(res, 200, status);
}

async function handleGetIcons(
  res: ServerResponse,
  state: DevServerState,
): Promise<void> {
  const icons = extractIconList(state.previousSourceFiles);
  sendJson(res, 200, { icons, count: icons.length });
}

async function handlePostIcons(
  req: IncomingMessage,
  res: ServerResponse,
  repoRoot: string,
  config: import('@/lib/install-config/types').CuneiformConfig,
  state: DevServerState,
): Promise<void> {
  const body = await readBody(req);
  let parsed: SourceIngestRequest;
  try {
    parsed = JSON.parse(body) as SourceIngestRequest;
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  if (!Array.isArray(parsed.files)) {
    sendJson(res, 400, { error: 'files must be an array' });
    return;
  }

  // Validate and write each file to sourceDir
  const sourceDir = path.resolve(repoRoot, config.sourceDir);
  for (const file of parsed.files) {
    if (!isValidSourcePath(file.path)) {
      sendJson(res, 400, { error: `Invalid or unsafe source path: ${file.path}` });
      return;
    }
    const targetPath = path.join(sourceDir, file.path);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, file.contents, 'utf8');
  }

  // Trigger incremental rebuild
  const result = await incrementalRebuild(repoRoot, config, state.previousSourceFiles);
  applyBuildResult(state, result);

  if (result.kind === 'success') {
    console.log(
      `[cuneiform] API ingest: ${parsed.files.length} file(s) received, rebuilt ${result.changedIcons} icon(s) in ${result.durationMs}ms`,
    );
  }

  sendJson(res, 200, {
    ok: true,
    filesReceived: parsed.files.length,
    buildResult: result.kind,
    ...(result.kind === 'success'
      ? { changedIcons: result.changedIcons, totalIcons: result.totalIcons, durationMs: result.durationMs }
      : result.kind === 'error'
        ? { error: result.error }
        : {}),
  });
}

async function handlePostManifest(
  req: IncomingMessage,
  res: ServerResponse,
  repoRoot: string,
  config: import('@/lib/install-config/types').CuneiformConfig,
  state: DevServerState,
): Promise<void> {
  const body = await readBody(req);
  let parsed: { contents: string };
  try {
    parsed = JSON.parse(body) as { contents: string };
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  if (typeof parsed.contents !== 'string') {
    sendJson(res, 400, { error: 'contents must be a string' });
    return;
  }

  // Validate the manifest JSON before writing
  try {
    JSON.parse(parsed.contents);
  } catch {
    sendJson(res, 400, { error: 'contents is not valid JSON' });
    return;
  }

  const sourceDir = path.resolve(repoRoot, config.sourceDir);
  await mkdir(sourceDir, { recursive: true });
  await writeFile(path.join(sourceDir, 'manifest.json'), parsed.contents, 'utf8');

  // Trigger rebuild
  const result = await incrementalRebuild(repoRoot, config, state.previousSourceFiles);
  applyBuildResult(state, result);

  sendJson(res, 200, {
    ok: true,
    buildResult: result.kind,
    ...(result.kind === 'success'
      ? { changedIcons: result.changedIcons, durationMs: result.durationMs }
      : result.kind === 'error'
        ? { error: result.error }
        : {}),
  });
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function applyBuildResult(
  state: DevServerState,
  result: import('./types').LiveBuildResult,
): void {
  if (result.kind === 'success') {
    state.iconCount = result.totalIcons;
    state.lastBuildAt = new Date().toISOString();
    state.lastBuildDurationMs = result.durationMs;
    state.previousSourceFiles = result.sourceFiles;
  } else if (result.kind === 'no-op') {
    // Keep previous state as-is
  }
  // error: keep previous state — next change may succeed
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Accept only safe paths within the sourceDir:
 *   manifest.json
 *   icons/<slug>/icon.json
 *   icons/<slug>/preview.svg
 *
 * Rejects absolute paths, path traversal, and unexpected patterns.
 */
function isValidSourcePath(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false;
  if (path.isAbsolute(filePath)) return false;
  if (filePath.includes('..')) return false;

  const normalized = filePath.replace(/\\/g, '/');
  return (
    normalized === 'manifest.json' ||
    /^icons\/[a-z0-9][a-z0-9-]*[a-z0-9]?\/icon\.json$/.test(normalized) ||
    /^icons\/[a-z0-9][a-z0-9-]*[a-z0-9]?\/preview\.svg$/.test(normalized)
  );
}

function extractIconList(
  sourceFiles: Array<{ path: string; contents: string }> | null,
): DevServerIconEntry[] {
  if (!sourceFiles) return [];

  const manifestFile = sourceFiles.find((f) => f.path === 'manifest.json');
  if (!manifestFile) return [];

  type ManifestShape = {
    icons?: Record<
      string,
      {
        id: string;
        name: string;
        variantCount: number;
        sizes: number[];
        hasTransitions: boolean;
        hasEffects: boolean;
      }
    >;
  };

  try {
    const manifest = JSON.parse(manifestFile.contents) as ManifestShape;
    return Object.entries(manifest.icons ?? {}).map(([dirName, entry]) => ({
      id: entry.id,
      name: entry.name,
      dirName,
      variantCount: entry.variantCount,
      sizes: entry.sizes,
      hasTransitions: entry.hasTransitions,
      hasEffects: entry.hasEffects,
    }));
  } catch {
    return [];
  }
}
