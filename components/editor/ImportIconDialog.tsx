'use client';

import { Icon as UiIcon } from '@hiero/ui-icons';
import { useCallback, useReducer, useRef, useState } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import {
  buildPluginImportEntries,
  parseHieroPluginPayload,
} from '@/lib/import/hiero-plugin-payload';
import { parseFigmaUrl } from '@/lib/import/adapters/figma-source';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { editorStore } from '@/lib/editor-store/store';
import { decodeSharePayload } from '@/lib/platform/share-link';
import { convertNormalizedIconToIcon } from '@/lib/import/convert-normalized-icon';
import { reduceImportUxState, INITIAL_IMPORT_UX_STATE } from '@/lib/import/import-ux-model';
import { normalizeSvg } from '@/lib/import/normalize';
import { sanitizeSvg } from '@/lib/import/sanitize';

const DEBUG_IMPORT = process.env.NEXT_PUBLIC_IMPORT_DEBUG === '1';

/** Client-side ceiling on import API calls so a dead network can't spin forever. */
const IMPORT_FETCH_TIMEOUT_MS = 30_000;

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}

function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(IMPORT_FETCH_TIMEOUT_MS),
  });
}

/**
 * Read the structured `{ error, code }` body the Figma proxy route
 * returns and turn it into actionable copy. Falls back to `fallback`
 * when the body is missing or unparseable.
 */
async function figmaFailureMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as
    | { error?: string; code?: string }
    | null;
  switch (body?.code) {
    case 'auth_invalid':
      return 'Figma rejected the token. Generate a new one at figma.com/developers/api#access-tokens.';
    case 'rate_limited':
      return 'Figma rate limit reached — wait a minute, then try again.';
    case 'timeout':
      return 'Figma took too long to respond. Try again.';
    default:
      return body?.error ?? fallback;
  }
}

function networkFailureMessage(error: unknown, context: string): string {
  return isAbortError(error)
    ? `${context} timed out after ${IMPORT_FETCH_TIMEOUT_MS / 1000}s. Check your connection and try again.`
    : `Network error: ${context.toLowerCase()} could not reach the server. Try again.`;
}

type Props = {
  open: boolean;
  onOpenChange(open: boolean): void;
};

type Prepared = {
  iconId: string;
  iconName: string;
};

type LibrarySourceId =
  | 'raw-svg'
  | 'hiero-plugin'
  | 'share-link'
  | 'lucide'
  | 'heroicons'
  | 'phosphor'
  | 'material-symbols'
  | 'figma';

const LIBRARY_SOURCES: Array<{
  id: LibrarySourceId;
  label: string;
  badges?: string[];
}> = [
  { id: 'raw-svg', label: 'Raw SVG' },
  { id: 'hiero-plugin', label: 'Hiero Plugin', badges: ['Batch', 'Figma export'] },
  { id: 'share-link', label: 'Share link', badges: ['Round-trip', 'Keeps animation'] },
  { id: 'figma', label: 'Figma', badges: ['Searchable', 'File URL'] },
  { id: 'lucide', label: 'Lucide', badges: ['Searchable', 'MIT'] },
  { id: 'heroicons', label: 'Heroicons', badges: ['Searchable', 'MIT'] },
  { id: 'phosphor', label: 'Phosphor', badges: ['Searchable', '4 weights', 'MIT'] },
  { id: 'material-symbols', label: 'Material', badges: ['Searchable', 'Apache-2.0'] },
];

export function ImportIconDialog({ open, onOpenChange }: Props) {
  const [sourceId, setSourceId] = useState<LibrarySourceId>('raw-svg');
  const [rawSvg, setRawSvg] = useState('');
  const [pluginPayloadText, setPluginPayloadText] = useState('');
  const [libraryIconName, setLibraryIconName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const pluginFileRef = useRef<HTMLInputElement>(null);
  const [state, dispatch] = useReducer(reduceImportUxState, INITIAL_IMPORT_UX_STATE);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [batchNames, setBatchNames] = useState('');
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [pluginImportSummary, setPluginImportSummary] = useState<{
    imported: number;
    total: number;
    skipped: number;
    fileName: string;
  } | null>(null);

  // Figma-specific state
  const [figmaUrl, setFigmaUrl] = useState('');
  const [figmaToken, setFigmaToken] = useState('');
  const [figmaConnected, setFigmaConnected] = useState(false);
  const [figmaConnecting, setFigmaConnecting] = useState(false);
  const [figmaFileKey, setFigmaFileKey] = useState('');
  const [figmaUserName, setFigmaUserName] = useState('');
  const [figmaComponents, setFigmaComponents] = useState<Array<{ key: string; name: string; nodeId: string; thumbnailUrl: string; frame: string | null }>>([]);
  const [figmaComponentTotal, setFigmaComponentTotal] = useState(0);
  const [figmaSearch, setFigmaSearch] = useState('');
  const [figmaSearching, setFigmaSearching] = useState(false);
  const [figmaImporting, setFigmaImporting] = useState<string | null>(null);
  const [figmaError, setFigmaError] = useState<string | null>(null);

  const connectFigma = useCallback(async () => {
    setFigmaError(null);
    const parsed = parseFigmaUrl(figmaUrl);
    if (!parsed) {
      setFigmaError('Invalid Figma URL. Use: figma.com/design/:fileKey/...');
      return;
    }
    if (!figmaToken.trim()) {
      setFigmaError('Personal access token is required.');
      return;
    }
    setFigmaConnecting(true);
    try {
      // Validate token
      const valRes = await postJson('/api/import/figma', {
        action: 'validate',
        token: figmaToken.trim(),
      });
      if (!valRes.ok) {
        setFigmaError(
          await figmaFailureMessage(
            valRes,
            'Invalid token. Generate one at figma.com/developers/api#access-tokens',
          ),
        );
        return;
      }
      const valData = await valRes.json() as { user: { handle: string } };
      setFigmaUserName(valData.user.handle);

      // Fetch components
      const compRes = await postJson('/api/import/figma', {
        action: 'components',
        fileKey: parsed.fileKey,
        token: figmaToken.trim(),
      });
      if (!compRes.ok) {
        setFigmaError(
          await figmaFailureMessage(
            compRes,
            'Could not access file. Check the URL and permissions.',
          ),
        );
        return;
      }
      const compData = await compRes.json() as { components: typeof figmaComponents; total: number };
      setFigmaComponents(compData.components);
      setFigmaComponentTotal(compData.total);
      setFigmaFileKey(parsed.fileKey);
      setFigmaConnected(true);
    } catch (error) {
      setFigmaError(networkFailureMessage(error, 'Connecting to Figma'));
    } finally {
      setFigmaConnecting(false);
    }
  }, [figmaUrl, figmaToken]);

  const searchFigmaComponents = useCallback(async (query: string) => {
    if (!figmaFileKey || !figmaToken) return;
    setFigmaSearching(true);
    setFigmaError(null);
    try {
      const res = await postJson('/api/import/figma', {
        action: 'components',
        fileKey: figmaFileKey,
        token: figmaToken.trim(),
        query,
      });
      if (res.ok) {
        const data = await res.json() as { components: typeof figmaComponents; total: number };
        setFigmaComponents(data.components);
      } else {
        setFigmaError(await figmaFailureMessage(res, 'Component search failed. Try again.'));
      }
    } catch (error) {
      setFigmaError(networkFailureMessage(error, 'Component search'));
    } finally {
      setFigmaSearching(false);
    }
  }, [figmaFileKey, figmaToken]);

  const importFigmaComponent = useCallback(async (nodeId: string, name: string) => {
    if (!figmaFileKey || !figmaToken) return;
    setFigmaImporting(nodeId);
    try {
      const res = await postJson('/api/import/figma', {
        action: 'import',
        fileKey: figmaFileKey,
        nodeId,
        token: figmaToken.trim(),
        name,
      });
      if (!res.ok) {
        dispatch({
          type: 'failed',
          message: await figmaFailureMessage(res, `Failed to import "${name}" from Figma.`),
        });
        return;
      }
      const payload = await res.json() as {
        svgContent: string;
        suggestedName: string;
        suggestedTags?: string[];
        provenance: { adapterId: string; sourceLibrary?: string; sourceIconId?: string; importedAt: string };
      };
      await runSvgImport({
        svg: payload.svgContent,
        name: payload.suggestedName,
        tags: payload.suggestedTags,
        provenance: payload.provenance,
      });
    } catch (error) {
      dispatch({
        type: 'failed',
        message: networkFailureMessage(error, `Importing "${name}" from Figma`),
      });
    } finally {
      setFigmaImporting(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [figmaFileKey, figmaToken]);

  const importSingleSvg = useCallback(
    async (input: {
      svg: string;
      name: string;
      tags?: string[];
      provenance?: {
        adapterId: string;
        sourceLibrary?: string;
        sourceVersion?: string;
        sourceIconId?: string;
        sourceLicense?: string;
        importedAt: string;
      };
    }) => {
      const sanitized = sanitizeSvg(input.svg);
      const normalized = normalizeSvg(sanitized.svg, {
        name: input.name,
        tags: input.tags,
        provenance: input.provenance,
        upstreamWarnings: sanitized.warnings,
      });
      const icon = convertNormalizedIconToIcon(normalized, {
        sourceName: input.name,
        existingIconIds: Object.keys(editorStore.getState().project?.icons ?? {}),
      });
      editorStore.getState().insertIcon(icon);
      return { icon, normalized, sanitized };
    },
    [],
  );

  async function runSvgImport(input: {
    svg: string;
    name: string;
    tags?: string[];
    provenance?: {
      adapterId: string;
      sourceLibrary?: string;
      sourceVersion?: string;
      sourceIconId?: string;
      sourceLicense?: string;
      importedAt: string;
    };
  }) {
    dispatch({ type: 'start_validating' });
    setPluginImportSummary(null);
    try {
      const result = await importSingleSvg(input);
      setPrepared({ iconId: result.icon.id, iconName: result.icon.name });
      dispatch({ type: 'start_importing' });
      dispatch({
        type: 'prepared',
        normalized: result.normalized,
        previewSvg: result.sanitized.svg,
        warnings: result.normalized.warnings,
        sourceLabel: input.provenance?.sourceLibrary ?? sourceId,
      });
    } catch (error) {
      dispatch({
        type: 'failed',
        message: error instanceof Error ? error.message : 'Import failed. Please try again.',
      });
    }
  }

  const runPluginPayloadImport = useCallback(
    async (payloadText: string) => {
      dispatch({ type: 'start_validating' });
      setPrepared(null);
      setPluginImportSummary(null);
      try {
        const payload = parseHieroPluginPayload(payloadText);
        const entries = buildPluginImportEntries(payload);
        dispatch({ type: 'start_importing' });

        let imported = 0;
        let lastSuccessful:
          | {
              iconId: string;
              iconName: string;
              previewSvg: string;
              normalized: ReturnType<typeof normalizeSvg>;
            }
          | null = null;

        for (const entry of entries) {
          try {
            const result = await importSingleSvg(entry);
            imported += 1;
            lastSuccessful = {
              iconId: result.icon.id,
              iconName: result.icon.name,
              previewSvg: result.sanitized.svg,
              normalized: result.normalized,
            };
          } catch {
            // Skip invalid entries and continue importing the rest.
          }
        }

        if (!lastSuccessful) {
          throw new Error('No icons from the plugin payload could be imported.');
        }

        setPrepared({
          iconId: lastSuccessful.iconId,
          iconName: lastSuccessful.iconName,
        });
        setPluginImportSummary({
          imported,
          total: payload.icons.length,
          skipped: payload.icons.length - imported + (payload.skipped?.length ?? 0),
          fileName: payload.fileName,
        });
        dispatch({
          type: 'prepared',
          normalized: lastSuccessful.normalized,
          previewSvg: lastSuccessful.previewSvg,
          warnings: lastSuccessful.normalized.warnings,
          sourceLabel: 'Figma Plugin',
        });
      } catch (error) {
        dispatch({
          type: 'failed',
          message:
            error instanceof Error
              ? error.message
              : 'Plugin payload import failed. Please try again.',
        });
      }
    },
    [importSingleSvg],
  );

  async function runLibraryImport(adapterId: string, iconName: string) {
    dispatch({ type: 'start_validating' });
    try {
      const response = await postJson(`/api/import/${adapterId}`, {
        iconName: iconName.trim(),
      });
      if (!response.ok) {
        const source = LIBRARY_SOURCES.find((s) => s.id === adapterId);
        const label = source?.label ?? adapterId;
        // 404 means "no such icon"; anything else is the source/network failing.
        dispatch({
          type: 'failed',
          message:
            response.status === 404
              ? `${label} icon "${iconName}" was not found.`
              : `${label} import failed (HTTP ${response.status}). Try again.`,
        });
        return;
      }
      const payload = await response.json() as {
        svgContent: string;
        suggestedName: string;
        suggestedTags?: string[];
        provenance: { adapterId: string; sourceLibrary?: string; sourceVersion?: string; sourceIconId?: string; sourceLicense?: string; importedAt: string };
      };
      await runSvgImport({
        svg: payload.svgContent,
        name: payload.suggestedName,
        tags: payload.suggestedTags,
        provenance: payload.provenance,
      });
    } catch (error) {
      dispatch({
        type: 'failed',
        message: networkFailureMessage(error, `Contacting the ${adapterId} source`),
      });
    }
  }

  // DIRECTION-03: round-trip a /share#… link back into the project. The
  // fragment already encodes a full schema Icon (transitions + effects
  // included), so this bypasses the SVG sanitize/normalize pipeline — no
  // fidelity loss, unlike re-importing an exported SVG.
  const [shareLinkText, setShareLinkText] = useState('');
  const [shareImported, setShareImported] = useState<{ id: string; name: string } | null>(null);

  function runShareLinkImport(text: string) {
    setShareImported(null);
    const trimmed = text.trim();
    if (!trimmed) return;
    // Accept a full URL, a bare fragment, or a fragment with leading '#'.
    let fragment = trimmed;
    try {
      const url = new URL(trimmed);
      fragment = url.hash;
    } catch {
      // Not a URL — treat the text as the fragment itself.
    }
    const payload = decodeSharePayload(fragment);
    if (!payload) {
      dispatch({
        type: 'failed',
        message:
          'Not a valid Hiero share link. Paste the full /share#… URL copied from "Copy preview link".',
      });
      return;
    }
    const icon = structuredClone(payload.icon);
    editorStore.getState().insertIcon(icon);
    // insertIcon dedupes ids; read back the inserted icon for display.
    const inserted =
      editorStore.getState().project?.icons[icon.id] ??
      Object.values(editorStore.getState().project?.icons ?? {}).find(
        (candidate) => candidate.name === icon.name,
      );
    setShareImported({ id: inserted?.id ?? icon.id, name: inserted?.name ?? icon.name });
  }

  async function runBatchImport(adapterId: string, names: string[]) {
    const limited = names.slice(0, 50);
    setBatchProgress({ done: 0, total: limited.length });
    for (let i = 0; i < limited.length; i++) {
      try {
        await runLibraryImport(adapterId, limited[i]!);
      } catch {
        // Continue on failure for batch
      }
      setBatchProgress({ done: i + 1, total: limited.length });
    }
    setBatchProgress(null);
  }

  const busy = state.status === 'validating' || state.status === 'importing';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import icon</DialogTitle>
          <DialogDescription>
            Paste SVG, import a Hiero Figma plugin payload, or fetch icons from built-in libraries.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1" role="group" aria-label="Import source">
            <Label>Source</Label>
            <div className="flex flex-wrap gap-2">
              {LIBRARY_SOURCES.map((source) => (
                <Button
                  key={source.id}
                  size="sm"
                  variant={sourceId === source.id ? 'default' : 'outline'}
                  onClick={() => {
                    setSourceId(source.id);
                    setLibraryIconName('');
                    setBatchNames('');
                    setShareImported(null);
                  }}
                  aria-pressed={sourceId === source.id}
                  className="gap-1.5"
                >
                  {source.label}
                </Button>
              ))}
            </div>
            {/* P5: Capability badges for the selected source */}
            {LIBRARY_SOURCES.find((s) => s.id === sourceId)?.badges && (
              <div className="flex flex-wrap gap-1 pt-1">
                {LIBRARY_SOURCES.find((s) => s.id === sourceId)!.badges!.map((badge) => (
                  <span key={badge} className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>

          {sourceId === 'figma' ? (
            <div className="space-y-3">
              {!figmaConnected ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="figma-url">Figma file URL</Label>
                    <Input
                      id="figma-url"
                      value={figmaUrl}
                      onChange={(e) => setFigmaUrl(e.target.value)}
                      placeholder="https://figma.com/design/ABC123/My-Icons"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="figma-token">Personal access token</Label>
                    <Input
                      id="figma-token"
                      type="password"
                      value={figmaToken}
                      onChange={(e) => setFigmaToken(e.target.value)}
                      placeholder="figd_..."
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Generate at figma.com → Settings → Personal access tokens. Token is sent per-request and never stored.
                    </p>
                  </div>
                  {figmaError && (
                    <p className="text-sm text-destructive" role="alert" aria-live="assertive">
                      {figmaError}
                    </p>
                  )}
                  <Button
                    disabled={figmaConnecting || !figmaUrl.trim() || !figmaToken.trim()}
                    onClick={() => void connectFigma()}
                    className="gap-1.5"
                  >
                    {figmaConnecting ? <UiIcon name="loader-2" size={16} className="size-4 animate-spin" /> : <UiIcon name="link-2" size={16} className="size-4" />}
                    {figmaConnecting ? 'Connecting...' : 'Connect'}
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium text-foreground">Connected</span>
                      <span className="ml-2 text-muted-foreground">as {figmaUserName}</span>
                      <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {figmaComponentTotal} components
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFigmaConnected(false);
                        setFigmaComponents([]);
                        setFigmaFileKey('');
                        setFigmaSearch('');
                      }}
                    >
                      Disconnect
                    </Button>
                  </div>

                  <div className="relative">
                    <UiIcon name="search" size={16} className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={figmaSearch}
                      onChange={(e) => {
                        setFigmaSearch(e.target.value);
                        void searchFigmaComponents(e.target.value);
                      }}
                      placeholder="Search components..."
                      className="pl-8"
                    />
                  </div>

                  {figmaError && (
                    <p className="text-sm text-destructive" role="alert" aria-live="assertive">
                      {figmaError}
                    </p>
                  )}

                  <ScrollArea className="h-64 rounded-lg border border-border/70">
                    {figmaSearching ? (
                      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                        <UiIcon name="loader-2" size={16} className="mr-2 size-4 animate-spin" /> Searching...
                      </div>
                    ) : figmaComponents.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        {figmaSearch ? 'No components match your search.' : 'No components found in this file.'}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-1 p-2 sm:grid-cols-3">
                        {figmaComponents.map((c) => (
                          <Button
                            key={c.nodeId}
                            variant="outline"
                            disabled={figmaImporting === c.nodeId || busy}
                            className="h-auto flex-col items-center gap-1.5 rounded-lg border-border/50 p-2 text-center transition hover:bg-accent"
                            onClick={() => void importFigmaComponent(c.nodeId, c.name)}
                          >
                            {c.thumbnailUrl ? (
                              <img
                                src={c.thumbnailUrl}
                                alt={c.name}
                                className="size-10 object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex size-10 items-center justify-center rounded bg-muted text-xs text-muted-foreground">?</div>
                            )}
                            <span className="max-w-full truncate text-[11px] font-medium text-foreground">
                              {c.name}
                            </span>
                            {c.frame && (
                              <span className="max-w-full truncate text-[9px] text-muted-foreground">
                                {c.frame}
                              </span>
                            )}
                            {figmaImporting === c.nodeId && (
                              <UiIcon name="loader-2" size={12} className="size-3 animate-spin text-muted-foreground" />
                            )}
                          </Button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </>
              )}
            </div>
          ) : sourceId === 'hiero-plugin' ? (
            <Tabs defaultValue="paste">
              <TabsList aria-label="Hiero plugin import mode">
                <TabsTrigger value="paste">Paste JSON</TabsTrigger>
                <TabsTrigger value="upload">Upload JSON</TabsTrigger>
              </TabsList>
              <TabsContent value="paste" className="space-y-2">
                <Label htmlFor="plugin-payload">Plugin payload JSON</Label>
                <Textarea
                  id="plugin-payload"
                  value={pluginPayloadText}
                  onChange={(e) => setPluginPayloadText(e.target.value)}
                  className="min-h-40"
                  placeholder='{"version":"1","source":"hiero-figma-plugin","icons":[...]}'
                />
                <p className="text-[11px] text-muted-foreground">
                  Export from the Figma plugin, then paste the JSON payload here to import one or more icons.
                </p>
                <Button
                  disabled={busy || !pluginPayloadText.trim()}
                  onClick={() => void runPluginPayloadImport(pluginPayloadText)}
                >
                  Import Plugin Payload
                </Button>
              </TabsContent>
              <TabsContent value="upload" className="space-y-2">
                <Label htmlFor="plugin-payload-file">Plugin payload file</Label>
                <input
                  id="plugin-payload-file"
                  ref={pluginFileRef}
                  type="file"
                  accept=".json,application/json"
                />
                <Button
                  disabled={busy}
                  onClick={async () => {
                    const file = pluginFileRef.current?.files?.[0];
                    if (!file) return;
                    const payloadText = await file.text();
                    setPluginPayloadText(payloadText);
                    await runPluginPayloadImport(payloadText);
                  }}
                >
                  Upload & Import
                </Button>
              </TabsContent>
            </Tabs>
          ) : sourceId === 'raw-svg' ? (
            <Tabs defaultValue="paste">
              <TabsList aria-label="Raw SVG import mode">
                <TabsTrigger value="paste">Paste SVG</TabsTrigger>
                <TabsTrigger value="upload">Upload SVG</TabsTrigger>
              </TabsList>
              <TabsContent value="paste" className="space-y-2">
                <Textarea value={rawSvg} onChange={(e) => setRawSvg(e.target.value)} className="min-h-40" placeholder="<svg ...>...</svg>" />
                <Button disabled={busy || !rawSvg.trim()} onClick={() => void runSvgImport({ svg: rawSvg, name: 'Pasted SVG' })}>Validate & Import</Button>
              </TabsContent>
              <TabsContent value="upload" className="space-y-2">
                <input ref={fileRef} type="file" accept=".svg,image/svg+xml" />
                <Button
                  disabled={busy}
                  onClick={async () => {
                    const file = fileRef.current?.files?.[0];
                    if (!file) return;
                    const svg = await file.text();
                    await runSvgImport({ svg, name: file.name });
                  }}
                >
                  Validate & Import
                </Button>
              </TabsContent>
            </Tabs>
          ) : sourceId === 'share-link' ? (
            <div className="space-y-2">
              <Label htmlFor="share-link-input">Hiero share link</Label>
              <Input
                id="share-link-input"
                value={shareLinkText}
                onChange={(e) => setShareLinkText(e.target.value)}
                placeholder="https://…/share#…"
              />
              <p className="text-[11px] text-muted-foreground">
                Paste a link created with “Copy preview link”. The icon imports with its
                variants, transitions, and effects intact.
              </p>
              <Button
                disabled={!shareLinkText.trim()}
                onClick={() => runShareLinkImport(shareLinkText)}
              >
                Import shared icon
              </Button>
              {shareImported ? (
                <p className="text-sm text-emerald-600" role="status" aria-live="polite">
                  <UiIcon name="check-circle-2" size={16} className="mr-1 inline size-4" />
                  Imported as {shareImported.name} ({shareImported.id})
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="lib-name">{LIBRARY_SOURCES.find((s) => s.id === sourceId)?.label ?? sourceId} icon name</Label>
              <Input
                id="lib-name"
                value={libraryIconName}
                onChange={(e) => setLibraryIconName(e.target.value)}
                placeholder="e.g. arrow-right"
              />
              <div className="flex gap-2">
                <Button
                  disabled={busy || !libraryIconName.trim()}
                  onClick={() => void runLibraryImport(sourceId, libraryIconName)}
                >
                  Validate & Import
                </Button>
              </div>

              {/* P6: Batch import */}
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Batch import (comma-separated names, max 50)
                </summary>
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={batchNames}
                    onChange={(e) => setBatchNames(e.target.value)}
                    className="min-h-20"
                    placeholder="arrow-right, arrow-left, check, x"
                  />
                  <Button
                    size="sm"
                    disabled={busy || !batchNames.trim() || batchProgress !== null}
                    onClick={() => {
                      const names = batchNames.split(',').map((n) => n.trim()).filter(Boolean);
                      if (names.length > 0) void runBatchImport(sourceId, names);
                    }}
                  >
                    {batchProgress
                      ? `Importing ${batchProgress.done}/${batchProgress.total}…`
                      : `Import All`}
                  </Button>
                </div>
              </details>
            </div>
          )}

          {busy ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
              <UiIcon name="loader-2" size={16} className="size-4 animate-spin" />
              {state.status}
            </div>
          ) : null}

          {state.status === 'failed' ? (
            <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert" aria-live="assertive">
              <div className="flex items-center gap-2 font-medium"><UiIcon name="alert-triangle" size={16} className="size-4" />Import failed</div>
              <p>{state.errorMessage}</p>
              {DEBUG_IMPORT ? <pre className="mt-2 whitespace-pre-wrap text-xs">{JSON.stringify(state, null, 2)}</pre> : null}
            </div>
          ) : null}

          {(state.status === 'success' || state.status === 'success_with_warnings') ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border p-3">
                <p className="mb-2 text-xs text-muted-foreground">Icon preview</p>
                <img alt="import preview" className="h-32 w-32" src={`data:image/svg+xml;utf8,${encodeURIComponent(state.previewSvg ?? '')}`} />
              </div>
              <div className="space-y-2 rounded border p-3 text-sm">
                <div><span className="text-muted-foreground">Source:</span> {state.sourceLabel}</div>
                <div><span className="text-muted-foreground">Warnings:</span> {state.warnings.length}</div>
                {pluginImportSummary ? (
                  <div role="status" aria-live="polite">
                    <span className="text-muted-foreground">Batch:</span>{' '}
                    Imported {pluginImportSummary.imported} of {pluginImportSummary.total} from {pluginImportSummary.fileName}
                    {pluginImportSummary.skipped > 0 ? `, skipped ${pluginImportSummary.skipped}` : ''}
                  </div>
                ) : null}
                <div>
                  <span className="text-muted-foreground">Unsupported:</span>
                  <ul className="list-disc pl-5">
                    {state.unsupportedSummary.map((u) => <li key={u.kind}>{u.kind} ({u.count})</li>)}
                  </ul>
                </div>
                {prepared ? <div className="text-emerald-600"><UiIcon name="check-circle-2" size={16} className="mr-1 inline size-4" />Imported as {prepared.iconName} ({prepared.iconId})</div> : null}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
