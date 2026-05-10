'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEditorStore } from '@/lib/editor-store/hooks';
// TODO(deprecation): Migrate to lib/sync-service/ — see lib/sync-service/index.ts
import { syncIconsToGitHub, type SyncOptions, type SyncResult } from '@/lib/integrations/github/sync-icons';

type SyncPanelProps = {
  iconSetId?: string | null;
  triggerLabel?: string;
  triggerVariant?: 'default' | 'outline' | 'ghost' | 'secondary';
  triggerSize?: 'default' | 'sm' | 'icon-sm';
  className?: string;
};

type SyncSettings = {
  owner: string;
  repo: string;
  baseBranch: string;
  packagePath: string;
  exportFormat: SyncOptions['exportFormat'];
};

const DEFAULT_SETTINGS: SyncSettings = {
  owner: '',
  repo: '',
  baseBranch: 'main',
  packagePath: 'packages/icons',
  exportFormat: 'both',
};

export function GitHubSyncPanel({
  iconSetId,
  triggerLabel = 'Sync to GitHub',
  triggerVariant = 'ghost',
  triggerSize = 'sm',
  className,
}: SyncPanelProps) {
  const resolvedIconSetId = useEditorStore((s) => iconSetId ?? s.activeIconSetId);
  const iconSet = useEditorStore((s) => (resolvedIconSetId ? s.workspace?.iconSets[resolvedIconSetId] ?? null : null));
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<SyncSettings>(DEFAULT_SETTINGS);
  const [token, setToken] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    // Sync settings are stored locally; reset to defaults when icon set changes.
    setSettings({ ...DEFAULT_SETTINGS });
  }, [iconSet]);

  const canSync = useMemo(() => {
    return Boolean(iconSet && resolvedIconSetId && settings.owner && settings.repo && settings.baseBranch && settings.packagePath && token);
  }, [iconSet, resolvedIconSetId, settings, token]);

  const patchSettings = (patch: Partial<SyncSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const handleSync = async () => {
    if (!iconSet || !resolvedIconSetId) {
      setStatus('No icon set selected.');
      return;
    }

    setSyncing(true);
    setStatus('Syncing files and opening pull request...');
    setResult(null);

    try {
      const response = await syncIconsToGitHub({
        project: iconSet,
        owner: settings.owner,
        repo: settings.repo,
        baseBranch: settings.baseBranch,
        token,
        packagePath: settings.packagePath,
        exportFormat: settings.exportFormat,
      });
      setResult(response);
      setStatus(`Sync complete. ${response.syncedFiles} files synced.`);
      setToken('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'GitHub sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className={className}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sync {iconSet?.meta.name ?? 'Icon Set'} to GitHub</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <Field label="Owner">
            <Input value={settings.owner} onChange={(event) => patchSettings({ owner: event.target.value })} placeholder="acme" />
          </Field>

          <Field label="Repository">
            <Input value={settings.repo} onChange={(event) => patchSettings({ repo: event.target.value })} placeholder="icon-pack" />
          </Field>

          <Field label="Base Branch">
            <Input value={settings.baseBranch} onChange={(event) => patchSettings({ baseBranch: event.target.value })} placeholder="main" />
          </Field>

          <Field label="Token">
            <Input value={token} onChange={(event) => setToken(event.target.value)} type="password" placeholder="ghp_..." />
          </Field>

          <Field label="Package Path">
            <Input value={settings.packagePath} onChange={(event) => patchSettings({ packagePath: event.target.value })} placeholder="packages/icons" />
          </Field>

          <Field label="Export Format">
            <Select value={settings.exportFormat} onValueChange={(value: SyncOptions['exportFormat']) => patchSettings({ exportFormat: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Choose export format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="react">React</SelectItem>
                <SelectItem value="svg">SVG</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Button disabled={!canSync || syncing} onClick={handleSync}>
            {syncing ? 'Syncing...' : 'Sync to GitHub'}
          </Button>

          {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
          {result ? (
            <p className="text-sm">
              PR URL:{' '}
              <a className="underline" href={result.pullRequestUrl} target="_blank" rel="noreferrer">
                {result.pullRequestUrl}
              </a>
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
