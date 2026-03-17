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

export function ImportIconDialog({ open, onOpenChange }: Props) {
  const [sourceId, setSourceId] = useState<'raw-svg' | 'lucide'>('raw-svg');
  const [rawSvg, setRawSvg] = useState('');
  const [lucideName, setLucideName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, dispatch] = useReducer(reduceImportUxState, INITIAL_IMPORT_UX_STATE);
  const [prepared, setPrepared] = useState<Prepared | null>(null);

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

  async function runLucideImport() {
    dispatch({ type: 'start_validating' });
    try {
      const response = await fetch('/api/import/lucide', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ iconName: lucideName.trim() }),
      });
      if (!response.ok) {
        dispatch({ type: 'failed', message: 'Lucide icon was not found. Check the icon name and try again.' });
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
      dispatch({ type: 'failed', message: 'Unable to contact Lucide source. Please try again.' });
    }
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
            <div className="flex gap-2">
              <Button size="sm" variant={sourceId === 'raw-svg' ? 'default' : 'outline'} onClick={() => setSourceId('raw-svg')}>Raw SVG</Button>
              <Button size="sm" variant={sourceId === 'lucide' ? 'default' : 'outline'} onClick={() => setSourceId('lucide')}>Lucide</Button>
            </div>
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
              <Label htmlFor="lucide-name">Lucide icon name</Label>
              <Input id="lucide-name" value={lucideName} onChange={(e) => setLucideName(e.target.value)} placeholder="e.g. arrow-right" />
              <Button disabled={busy || !lucideName.trim()} onClick={() => void runLucideImport()}>Validate & Import</Button>
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
