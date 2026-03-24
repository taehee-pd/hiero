'use client';

import { useReducer, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { editorStore } from '@/lib/editor-store/store';
import { convertNormalizedIconToIcon } from '@/lib/import/convert-normalized-icon';
import { reduceImportUxState, INITIAL_IMPORT_UX_STATE } from '@/lib/import/import-ux-model';
import { normalizeSvg } from '@/lib/import/normalize';
import { sanitizeSvg } from '@/lib/import/sanitize';

const DEBUG_IMPORT = process.env.NEXT_PUBLIC_IMPORT_DEBUG === '1';

type Props = {
  open: boolean;
  onOpenChange(open: boolean): void;
};

type Prepared = {
  iconId: string;
  iconName: string;
};

type LibrarySourceId = 'raw-svg' | 'lucide' | 'heroicons' | 'phosphor' | 'material-symbols';

const LIBRARY_SOURCES: Array<{
  id: LibrarySourceId;
  label: string;
  badges?: string[];
}> = [
  { id: 'raw-svg', label: 'Raw SVG' },
  { id: 'lucide', label: 'Lucide', badges: ['Searchable', 'MIT'] },
  { id: 'heroicons', label: 'Heroicons', badges: ['Searchable', 'MIT'] },
  { id: 'phosphor', label: 'Phosphor', badges: ['Searchable', '4 weights', 'MIT'] },
  { id: 'material-symbols', label: 'Material', badges: ['Searchable', 'Apache-2.0'] },
];

export function ImportIconDialog({ open, onOpenChange }: Props) {
  const [sourceId, setSourceId] = useState<LibrarySourceId>('raw-svg');
  const [rawSvg, setRawSvg] = useState('');
  const [libraryIconName, setLibraryIconName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, dispatch] = useReducer(reduceImportUxState, INITIAL_IMPORT_UX_STATE);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [batchNames, setBatchNames] = useState('');
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  async function runSvgImport(input: { svg: string; name: string; tags?: string[]; provenance?: { adapterId: string; sourceLibrary?: string; sourceVersion?: string; sourceIconId?: string; sourceLicense?: string; importedAt: string } }) {
    dispatch({ type: 'start_validating' });
    try {
      const sanitized = sanitizeSvg(input.svg);
      dispatch({ type: 'start_importing' });
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
      setPrepared({ iconId: icon.id, iconName: icon.name });
      editorStore.getState().insertIcon(icon);
      dispatch({
        type: 'prepared',
        normalized,
        previewSvg: sanitized.svg,
        warnings: normalized.warnings,
        sourceLabel: input.provenance?.sourceLibrary ?? sourceId,
      });
    } catch (error) {
      dispatch({
        type: 'failed',
        message: error instanceof Error ? error.message : 'Import failed. Please try again.',
      });
    }
  }

  async function runLibraryImport(adapterId: string, iconName: string) {
    dispatch({ type: 'start_validating' });
    try {
      const response = await fetch(`/api/import/${adapterId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ iconName: iconName.trim() }),
      });
      if (!response.ok) {
        const source = LIBRARY_SOURCES.find((s) => s.id === adapterId);
        dispatch({ type: 'failed', message: `${source?.label ?? adapterId} icon "${iconName}" was not found.` });
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
    } catch {
      dispatch({ type: 'failed', message: `Unable to contact ${adapterId} source. Please try again.` });
    }
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
          <DialogDescription>Paste SVG, upload an SVG file, or fetch a Lucide icon by name.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Source</Label>
            <div className="flex flex-wrap gap-2">
              {LIBRARY_SOURCES.map((source) => (
                <Button
                  key={source.id}
                  size="sm"
                  variant={sourceId === source.id ? 'default' : 'outline'}
                  onClick={() => { setSourceId(source.id); setLibraryIconName(''); setBatchNames(''); }}
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

          {sourceId === 'raw-svg' ? (
            <Tabs defaultValue="paste">
              <TabsList>
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

          {busy ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{state.status}</div> : null}

          {state.status === 'failed' ? (
            <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <div className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4" />Import failed</div>
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
                <div>
                  <span className="text-muted-foreground">Unsupported:</span>
                  <ul className="list-disc pl-5">
                    {state.unsupportedSummary.map((u) => <li key={u.kind}>{u.kind} ({u.count})</li>)}
                  </ul>
                </div>
                {prepared ? <div className="text-emerald-600"><CheckCircle2 className="mr-1 inline size-4" />Imported as {prepared.iconName} ({prepared.iconId})</div> : null}
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
