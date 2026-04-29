'use client';

/**
 * PublishPanel — Lane 1 (Live Integration) editor surface.
 *
 * Displays the hiero dev server connection status and lets the editor
 * push canonical source files to the consumer repo via the HTTP API.
 *
 * Transport: always api-push (POST to localhost:4400 by default).
 * The consumer must run `hiero dev` in their repo for this to work.
 *
 * Corresponds to screens 9A/9B in specs/ui/screens.md.
 */

import { Icon as UiIcon } from '@hiero/ui-icons';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ds/status-badge';
import { useEditorStore } from '@/lib/editor-store/hooks';
import { exportSourcePayload } from '@/lib/sync-source';
import { publishSourceFiles, pingDevServer } from '@/lib/live-sync/publish-transport';
import { toast } from '@/components/ui/use-toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConnectionStatus = 'unknown' | 'connected' | 'disconnected';

type PublishConfig = {
  devServerUrl: string;
  apiSecret: string;
};

const DEFAULT_CONFIG: PublishConfig = {
  devServerUrl: 'http://localhost:4400',
  apiSecret: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PublishPanel() {
  const project = useEditorStore((s) => s.project);

  const [config, setConfig] = useState<PublishConfig>(DEFAULT_CONFIG);
  const [showSettings, setShowSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [serverInfo, setServerInfo] = useState<{
    iconCount: number;
    lastBuildAt: string | null;
  } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [lastPublishAt, setLastPublishAt] = useState<string | null>(null);

  // Poll connection status every 5 seconds
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkConnection = useCallback(async () => {
    const result = await pingDevServer(config.devServerUrl || undefined);
    if (result.ok) {
      setConnectionStatus('connected');
      setServerInfo({ iconCount: result.iconCount, lastBuildAt: result.lastBuildAt });
    } else {
      setConnectionStatus('disconnected');
      setServerInfo(null);
    }
  }, [config.devServerUrl]);

  useEffect(() => {
    void checkConnection();
    pollRef.current = setInterval(() => void checkConnection(), 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [checkConnection]);

  const iconCount = project ? Object.keys(project.icons).length : 0;

  const handlePublish = useCallback(async () => {
    if (!project || iconCount === 0) return;
    setIsPublishing(true);

    try {
      const payload = exportSourcePayload(project);
      const result = await publishSourceFiles({
        files: payload.files,
        devServerUrl: config.devServerUrl || undefined,
        apiSecret: config.apiSecret || undefined,
      });

      if (result.kind === 'success') {
        setLastPublishAt(new Date().toISOString());
        void checkConnection(); // refresh server stats
        toast({
          title: 'Published',
          description: `${payload.iconCount} icon${payload.iconCount !== 1 ? 's' : ''} pushed to consumer repo`,
        });
      } else {
        toast({
          title: 'Publish failed',
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Publish failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  }, [checkConnection, config.apiSecret, config.devServerUrl, iconCount, project]);

  return (
    <div className="grid gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Live Integration</p>
          <p className="text-xs text-muted-foreground">
            Push icons to the consumer repo dev server.
          </p>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setShowSettings((v) => !v)}
          title="Configure dev server"
        >
          <UiIcon name="settings" size={14} className="size-3.5" />
        </Button>
      </div>

      {/* Settings (collapsible) */}
      {showSettings && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 grid gap-2">
          <div className="grid gap-1.5">
            <Label className="text-[10px] text-muted-foreground tracking-tight">
              Dev server URL
            </Label>
            <Input
              value={config.devServerUrl}
              onChange={(e) =>
                setConfig((c) => ({ ...c, devServerUrl: e.target.value }))
              }
              placeholder="http://localhost:4400"
              variant="pane"
              className="font-mono"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-[10px] text-muted-foreground tracking-tight">
              API secret (optional)
            </Label>
            <Input
              type="password"
              value={config.apiSecret}
              onChange={(e) =>
                setConfig((c) => ({ ...c, apiSecret: e.target.value }))
              }
              placeholder="Only needed if --secret is set on the server"
              variant="pane"
            />
          </div>
        </div>
      )}

      {/* Connection status card */}
      <div className="rounded-lg border border-border/70 bg-background/70 p-3">
        <div className="flex items-center gap-2">
          <UiIcon name="server" size={14} className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground font-mono truncate">
            {config.devServerUrl || 'http://localhost:4400'}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <ConnectionBadge status={connectionStatus} />
            <Button
              size="icon-sm"
              variant="ghost"
              className="size-5 text-muted-foreground hover:text-foreground"
              onClick={() => void checkConnection()}
              title="Check connection"
            >
              <UiIcon name="refresh-cw" size={12} className="size-3" />
            </Button>
          </div>
        </div>

        {connectionStatus === 'connected' && serverInfo && (
          <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
            <span>{serverInfo.iconCount} icon{serverInfo.iconCount !== 1 ? 's' : ''} in consumer repo</span>
            {serverInfo.lastBuildAt && (
              <span>last built {formatRelativeTime(serverInfo.lastBuildAt)}</span>
            )}
          </div>
        )}

        {connectionStatus === 'disconnected' && (
          <p className="mt-2 text-[10px] text-amber-600">
            Dev server not reachable. Run{' '}
            <code className="font-mono">hiero dev</code> in the consumer repo.
          </p>
        )}
      </div>

      {/* Publish actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="flex-1 gap-1.5"
          disabled={isPublishing || iconCount === 0 || connectionStatus !== 'connected'}
          onClick={() => void handlePublish()}
        >
          <UiIcon name="upload" size={14} className="size-3.5" />
          {isPublishing ? 'Publishing...' : 'Publish All'}
        </Button>
      </div>

      {iconCount === 0 && (
        <p className="text-[10px] text-muted-foreground text-center">
          No icons in this project.
        </p>
      )}

      {lastPublishAt && (
        <p className="text-[10px] text-muted-foreground text-center">
          Last published {formatRelativeTime(lastPublishAt)}
        </p>
      )}

      {/* Transport hint */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <UiIcon name="circle" size={8} className="size-2 fill-current" />
        <span>Transport: API push via localhost</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const variant = status === 'connected' ? 'success' : status === 'disconnected' ? 'warning' : 'neutral';
  const label = status === 'connected' ? 'connected' : status === 'disconnected' ? 'disconnected' : '…';
  return (
    <StatusBadge variant={variant} className="py-0 text-[9px]">
      {label}
    </StatusBadge>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(isoString: string): string {
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  } catch {
    return '';
  }
}
