'use client';

/**
 * ReleasePanel — Lane 2 (Release Distribution) editor surface.
 *
 * Polls the contour dev server's /api/status endpoint to discover release
 * targets configured in the consumer repo's contour.config.ts. Once connected,
 * renders a card for each target:
 *
 *   local-directory  →  "Push Source" (sends to dev server; user runs `contour build`)
 *   git-pr           →  delegates to SyncPrPanel
 *   npm-registry     →  "Push Source" (sends to dev server; user runs `contour publish`)
 *
 * When the dev server is unreachable a placeholder guides the user to run
 * `contour dev` in the consumer repo.
 *
 * Corresponds to screen 9C in specs/ui/screens.md.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FolderOpen,
  GitBranch,
  Package,
  Play,
  Settings,
  RefreshCw,
  CheckCircle2,
  Server,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tag } from '@/components/ds/tag';
import { useEditorStore } from '@/lib/editor-store/hooks';
import { exportSourcePayload } from '@/lib/sync-source';
import {
  publishSourceFiles,
  pingDevServer,
  type DevServerReleaseTarget,
} from '@/lib/live-sync/publish-transport';
import { toast } from '@/components/ui/use-toast';
import { SyncPrPanel } from './SyncPrPanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConnectionStatus = 'unknown' | 'connected' | 'disconnected';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReleasePanel() {
  const project = useEditorStore((s) => s.project);
  const activeIconSetId = useEditorStore((s) => s.activeIconSetId);

  const [devServerUrl, setDevServerUrl] = useState('http://localhost:4400');
  const [showSettings, setShowSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [releaseTargets, setReleaseTargets] = useState<DevServerReleaseTarget[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkConnection = useCallback(async () => {
    const result = await pingDevServer(devServerUrl || undefined);
    if (result.ok) {
      setConnectionStatus('connected');
      setReleaseTargets(result.releaseTargets);
    } else {
      setConnectionStatus('disconnected');
      setReleaseTargets([]);
    }
  }, [devServerUrl]);

  useEffect(() => {
    void checkConnection();
    pollRef.current = setInterval(() => void checkConnection(), 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [checkConnection]);

  return (
    <div className="grid gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Release</p>
          <p className="text-xs text-muted-foreground">
            Snapshot builds and package publishing.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={() => void checkConnection()}
            title="Refresh connection"
          >
            <RefreshCw className="size-3" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="size-6 text-muted-foreground hover:text-foreground"
            onClick={() => setShowSettings((v) => !v)}
            title="Configure dev server URL"
          >
            <Settings className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Settings */}
      {showSettings && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 grid gap-1.5">
          <Label className="text-[10px] text-muted-foreground tracking-tight">
            Dev server URL
          </Label>
          <Input
            value={devServerUrl}
            onChange={(e) => setDevServerUrl(e.target.value)}
            placeholder="http://localhost:4400"
            className="h-7 text-xs font-mono"
          />
        </div>
      )}

      {/* Connection indicator */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <Server className="size-3 shrink-0" />
        <span className="font-mono truncate">{devServerUrl}</span>
        <ConnectionDot status={connectionStatus} />
      </div>

      {/* Release target cards */}
      {connectionStatus === 'connected' && releaseTargets.length > 0 ? (
        <div className="grid gap-2">
          {releaseTargets.map((target, i) => {
            if (target.kind === 'local-directory') {
              return (
                <LocalDirectoryCard
                  key={i}
                  target={target}
                  project={project}
                  devServerUrl={devServerUrl}
                />
              );
            }
            if (target.kind === 'git-pr') {
              return (
                <GitPrCard
                  key={i}
                  target={target}
                  iconSetId={activeIconSetId}
                />
              );
            }
            if (target.kind === 'npm-registry') {
              return (
                <NpmRegistryCard
                  key={i}
                  target={target}
                  project={project}
                  devServerUrl={devServerUrl}
                />
              );
            }
            return null;
          })}
        </div>
      ) : connectionStatus === 'connected' && releaseTargets.length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-2">
          No release targets in <code className="font-mono">contour.config.ts</code>.
        </p>
      ) : (
        <ReleasePlaceholder devServerUrl={devServerUrl} />
      )}

      {/* PR panel — always available as a standalone action */}
      <div className="border-t border-border/40 pt-3">
        <p className="text-[10px] text-muted-foreground mb-2 tracking-tight">
          Pull request
        </p>
        <SyncPrPanel
          iconSetId={activeIconSetId}
          triggerLabel="Create PR"
          triggerVariant="outline"
          triggerSize="sm"
          className="w-full"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Target cards
// ---------------------------------------------------------------------------

function LocalDirectoryCard({
  target,
  project,
  devServerUrl,
}: {
  target: DevServerReleaseTarget;
  project: import('@/lib/schema/types').Project | null;
  devServerUrl: string;
}) {
  const [isPushing, setIsPushing] = useState(false);
  const [lastPushedAt, setLastPushedAt] = useState<string | null>(null);

  const handlePush = async () => {
    if (!project) return;
    setIsPushing(true);
    try {
      const payload = exportSourcePayload(project);
      const result = await publishSourceFiles({ files: payload.files, devServerUrl });
      if (result.kind === 'success') {
        setLastPushedAt(new Date().toISOString());
        toast({
          title: 'Source pushed',
          description: `Run \`contour build\` in the consumer repo to write snapshot to ${target.outputDir}`,
        });
      } else {
        toast({ title: 'Push failed', description: result.error, variant: 'destructive' });
      }
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
      <div className="flex items-start gap-2.5">
        <FolderOpen className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-foreground">Local directory</p>
            <Tag variant="muted" className="text-[9px]">snapshot</Tag>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
            {target.outputDir}
          </p>
          {lastPushedAt && (
            <p className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="size-2.5" />
              Source pushed — run <code className="font-mono">contour build</code> to write snapshot
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs shrink-0"
          disabled={isPushing || !project}
          onClick={() => void handlePush()}
        >
          <Play className="size-3" />
          {isPushing ? 'Pushing…' : 'Push Source'}
        </Button>
      </div>
    </div>
  );
}

function GitPrCard({
  target,
  iconSetId,
}: {
  target: DevServerReleaseTarget;
  iconSetId: string | null;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
      <div className="flex items-start gap-2.5">
        <GitBranch className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-foreground">Git PR</p>
            <Tag variant="muted" className="text-[9px]">snapshot</Tag>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
            {target.owner}/{target.repo} → {target.baseBranch}
          </p>
          {target.packagePath && (
            <p className="text-[10px] text-muted-foreground font-mono">{target.packagePath}</p>
          )}
        </div>
        <SyncPrPanel
          iconSetId={iconSetId}
          triggerLabel="Create PR"
          triggerVariant="outline"
          triggerSize="sm"
        />
      </div>
    </div>
  );
}

function NpmRegistryCard({
  target,
  project,
  devServerUrl,
}: {
  target: DevServerReleaseTarget;
  project: import('@/lib/schema/types').Project | null;
  devServerUrl: string;
}) {
  const [isPushing, setIsPushing] = useState(false);

  const handlePush = async () => {
    if (!project) return;
    setIsPushing(true);
    try {
      const payload = exportSourcePayload(project);
      const result = await publishSourceFiles({ files: payload.files, devServerUrl });
      if (result.kind === 'success') {
        toast({
          title: 'Source pushed',
          description: `Run \`contour publish\` in the consumer repo to release ${target.packageName}`,
        });
      } else {
        toast({ title: 'Push failed', description: result.error, variant: 'destructive' });
      }
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
      <div className="flex items-start gap-2.5">
        <Package className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-foreground">npm registry</p>
            <Tag variant="muted" className="text-[9px]">snapshot</Tag>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
            {target.packageName}
            {target.registry && target.registry !== 'https://registry.npmjs.org'
              ? ` @ ${target.registry}`
              : ''}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs shrink-0"
          disabled={isPushing || !project}
          onClick={() => void handlePush()}
        >
          <Play className="size-3" />
          {isPushing ? 'Pushing…' : 'Push Source'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty / disconnected state
// ---------------------------------------------------------------------------

function ReleasePlaceholder({ devServerUrl }: { devServerUrl: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 px-4 py-5 text-center">
      <p className="text-xs text-muted-foreground">
        Run <code className="font-mono">contour dev</code> in the consumer repo to connect.
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground font-mono">{devServerUrl}</p>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Release targets from <code className="font-mono">contour.config.ts</code> will appear here.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Micro-components
// ---------------------------------------------------------------------------

function ConnectionDot({ status }: { status: ConnectionStatus }) {
  if (status === 'connected') {
    return <span className="ml-auto text-emerald-500">●</span>;
  }
  if (status === 'disconnected') {
    return <span className="ml-auto text-amber-500">●</span>;
  }
  return <span className="ml-auto text-muted-foreground/40">●</span>;
}
