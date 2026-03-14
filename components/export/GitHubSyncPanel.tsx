'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { editorStore } from '@/lib/editor-store/store';
import { syncIconsToGitHub, type SyncOptions, type SyncResult } from '@/lib/integrations/github/sync-icons';

type PersistedSettings = {
  owner: string;
  repo: string;
  baseBranch: string;
  packagePath: string;
  exportFormat: SyncOptions['exportFormat'];
};

const STORAGE_KEY = 'icophone.github.sync.settings';

const DEFAULT_SETTINGS: PersistedSettings = {
  owner: '',
  repo: '',
  baseBranch: 'main',
  packagePath: 'packages/icons',
  exportFormat: 'both',
};

export function GitHubSyncPanel() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<PersistedSettings>(DEFAULT_SETTINGS);
  const [token, setToken] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
      setSettings({
        owner: parsed.owner ?? DEFAULT_SETTINGS.owner,
        repo: parsed.repo ?? DEFAULT_SETTINGS.repo,
        baseBranch: parsed.baseBranch ?? DEFAULT_SETTINGS.baseBranch,
        packagePath: parsed.packagePath ?? DEFAULT_SETTINGS.packagePath,
        exportFormat: parsed.exportFormat ?? DEFAULT_SETTINGS.exportFormat,
      });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const canSync = useMemo(() => {
    return Boolean(settings.owner && settings.repo && settings.baseBranch && settings.packagePath && token);
  }, [settings, token]);

  const handleSync = async () => {
    const project = editorStore.getState().project;
    if (!project) {
      setStatus('No project loaded.');
      return;
    }

    setSyncing(true);
    setStatus('Preparing GitHub sync...');
    setResult(null);

    try {
      setStatus('Syncing files and opening pull request...');
      const response = await syncIconsToGitHub({
        project,
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
        <Button variant="ghost" size="sm" className="workspace-tool-button h-9 rounded-xl px-3 text-foreground">
          Sync to GitHub
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sync Icons to GitHub</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <Field label="Owner">
            <Input value={settings.owner} onChange={(event) => setSettings((prev) => ({ ...prev, owner: event.target.value }))} placeholder="acme" />
          </Field>

          <Field label="Repository">
            <Input value={settings.repo} onChange={(event) => setSettings((prev) => ({ ...prev, repo: event.target.value }))} placeholder="icon-pack" />
          </Field>

          <Field label="Base Branch">
            <Input value={settings.baseBranch} onChange={(event) => setSettings((prev) => ({ ...prev, baseBranch: event.target.value }))} placeholder="main" />
          </Field>

          <Field label="Token">
            <Input value={token} onChange={(event) => setToken(event.target.value)} type="password" placeholder="ghp_..." />
          </Field>

          <Field label="Package Path">
            <Input value={settings.packagePath} onChange={(event) => setSettings((prev) => ({ ...prev, packagePath: event.target.value }))} placeholder="packages/icons" />
          </Field>

          <Field label="Export Format">
            <Select
              value={settings.exportFormat}
              onValueChange={(value: SyncOptions['exportFormat']) =>
                setSettings((prev) => ({ ...prev, exportFormat: value }))
              }
            >
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
