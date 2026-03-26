'use client';

import { useCallback, useMemo, useState } from 'react';
import { Plus, Trash2, FolderOpen, GitBranch, Package, Key, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useEditorStore, useEditorActions } from '@/lib/editor-store/hooks';
import type { SyncTarget } from '@/lib/schema/types';

const PLATFORMS = ['react', 'swift', 'flutter', 'web-component'] as const;
const DELIVERY_MODES = ['local-directory', 'git-pr', 'npm-registry'] as const;

function generateId(): string {
  return `sync-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function SyncTargetPanel() {
  const project = useEditorStore((s) => s.project);
  const { addSyncTarget, removeSyncTarget, updateSyncTarget, schedulePendingPublish } = useEditorActions();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const targets: SyncTarget[] = useMemo(
    () => project?.syncTargets ?? [],
    [project],
  );

  const handleRemove = useCallback(
    (id: string) => {
      removeSyncTarget(id);
    },
    [removeSyncTarget],
  );

  const handleAdd = useCallback(
    (target: SyncTarget) => {
      addSyncTarget(target);
      setIsAddOpen(false);
    },
    [addSyncTarget],
  );

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Sync Targets</p>
          <p className="text-xs text-muted-foreground">
            Configure where generated code is delivered.
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1">
              <Plus className="size-3.5" />
              Add Target
            </Button>
          </DialogTrigger>
          <DialogContent>
            <AddTargetForm onSave={handleAdd} onCancel={() => setIsAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {targets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 px-4 py-5 text-center">
          <p className="text-sm text-muted-foreground">No sync targets configured.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add a target to sync generated code to a repository or local directory.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {targets.map((target) => (
            <SyncTargetCard
              key={target.id}
              target={target}
              onRemove={handleRemove}
              onUpdate={updateSyncTarget}
              onPublish={schedulePendingPublish}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Target card
// ---------------------------------------------------------------------------

function SyncTargetCard({
  target,
  onRemove,
  onUpdate,
  onPublish,
}: {
  target: SyncTarget;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<SyncTarget>) => void;
  onPublish: (targetId: string, semver: 'patch' | 'minor' | 'major') => void;
}) {
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const isNpm = target.deliveryMode === 'npm-registry' && target.npmRegistry;

  return (
    <div className="rounded-xl border border-border/70 bg-background/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {target.deliveryMode === 'local-directory' ? (
              <FolderOpen className="size-4 text-muted-foreground" />
            ) : target.deliveryMode === 'npm-registry' ? (
              <Package className="size-4 text-muted-foreground" />
            ) : (
              <GitBranch className="size-4 text-muted-foreground" />
            )}
            <p className="text-sm font-medium text-foreground">{target.name}</p>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="secondary" className="text-[10px]">
              {target.platform}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {target.deliveryMode}
            </Badge>
            {target.deliveryMode === 'local-directory' && target.localDirectory ? (
              <span className="text-[10px] text-muted-foreground">
                {target.localDirectory.path}
              </span>
            ) : null}
            {target.deliveryMode === 'git-pr' && target.gitPr ? (
              <span className="text-[10px] text-muted-foreground">
                {target.gitPr.owner}/{target.gitPr.repo}
              </span>
            ) : null}
            {isNpm ? (
              <>
                <span className="text-[10px] text-muted-foreground">
                  {target.npmRegistry!.packageName}
                </span>
                {target.npmRegistry!.lastPublishedVersion ? (
                  <Badge variant="secondary" className="text-[10px]">
                    v{target.npmRegistry!.lastPublishedVersion}
                  </Badge>
                ) : null}
                {target.autoPublish?.on === 'save' ? (
                  <Badge variant="outline" className="text-[10px] text-green-600">
                    auto-publish
                  </Badge>
                ) : null}
                {target.dryRun ? (
                  <Badge variant="outline" className="text-[10px] text-amber-600">
                    dry-run
                  </Badge>
                ) : null}
                {target.npmRegistry!.tokenStored ? (
                  <Badge variant="outline" className="text-[10px] text-emerald-600">
                    <Key className="mr-0.5 size-2.5" /> token
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-amber-600">
                    no token
                  </Badge>
                )}
              </>
            ) : null}
          </div>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => onRemove(target.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* npm-registry: version management + token + publish */}
      {isNpm && (
        <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
          {/* Token setup */}
          {!target.npmRegistry!.tokenStored && (
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-[10px]">npm token</Label>
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder="npm_..."
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={!tokenInput.trim()}
                onClick={() => {
                  // Store the token indicator (actual token stored via keychain on desktop)
                  onUpdate(target.id, {
                    npmRegistry: { ...target.npmRegistry!, tokenStored: true },
                  });
                  setTokenInput('');
                }}
              >
                <Key className="mr-1 size-3" /> Save
              </Button>
            </div>
          )}

          {/* Version bump + publish */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border/70 p-0.5">
              {(['patch', 'minor', 'major'] as const).map((bump) => (
                <button
                  key={bump}
                  type="button"
                  className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition ${
                    (target.autoPublish?.semver ?? 'patch') === bump
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() =>
                    onUpdate(target.id, {
                      autoPublish: { ...target.autoPublish!, semver: bump },
                    })
                  }
                >
                  {bump}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={!target.npmRegistry!.tokenStored}
              onClick={() => onPublish(target.id, (target.autoPublish?.semver as 'patch' | 'minor' | 'major') ?? 'patch')}
            >
              <Upload className="size-3" />
              Publish
            </Button>
            {target.dryRun && (
              <span className="text-[10px] text-amber-600">(dry-run)</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add target form
// ---------------------------------------------------------------------------

function AddTargetForm({
  onSave,
  onCancel,
}: {
  onSave: (target: SyncTarget) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<SyncTarget['platform']>('react');
  const [deliveryMode, setDeliveryMode] = useState<SyncTarget['deliveryMode']>('local-directory');
  const [localPath, setLocalPath] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [baseBranch, setBaseBranch] = useState('main');
  const [packagePath, setPackagePath] = useState('');
  const [runtimePackage, setRuntimePackage] = useState('@coniva/runtime-react');
  const [outputDir, setOutputDir] = useState('src');
  // npm-registry fields
  const [registryUrl, setRegistryUrl] = useState('https://registry.npmjs.org');
  const [scope, setScope] = useState('');
  const [packageName, setPackageName] = useState('');
  const [autoPublishOn, setAutoPublishOn] = useState<'save' | 'manual'>('save');
  // Platform-specific fields
  const [typescript, setTypescript] = useState(true);
  const [minIosVersion, setMinIosVersion] = useState('16');
  const [swiftUIMode, setSwiftUIMode] = useState<'swiftui' | 'uikit'>('swiftui');
  const [flutterSdkMin, setFlutterSdkMin] = useState('3.0.0');
  const [dartPackageName, setDartPackageName] = useState('');
  const [customElementPrefix, setCustomElementPrefix] = useState('coniva');
  const [shadowDom, setShadowDom] = useState(true);

  const isValid =
    name.trim().length > 0 &&
    (deliveryMode === 'local-directory'
      ? localPath.trim().length > 0
      : deliveryMode === 'npm-registry'
        ? packageName.trim().length > 0
        : owner.trim().length > 0 && repo.trim().length > 0);

  const handleSave = () => {
    const target: SyncTarget = {
      id: generateId(),
      name: name.trim(),
      platform,
      deliveryMode,
      adapterConfig: {
        runtimePackage: runtimePackage || undefined,
        typescript: platform === 'react' ? typescript : undefined,
        outputDir: outputDir || undefined,
      },
    };

    // Platform-specific adapter config extensions
    if (platform === 'swift') {
      (target.adapterConfig as Record<string, unknown>).minIosVersion = minIosVersion;
      (target.adapterConfig as Record<string, unknown>).uiFramework = swiftUIMode;
    }
    if (platform === 'flutter') {
      (target.adapterConfig as Record<string, unknown>).flutterSdkMin = flutterSdkMin || undefined;
      (target.adapterConfig as Record<string, unknown>).dartPackageName = dartPackageName || undefined;
    }
    if (platform === 'web-component') {
      (target.adapterConfig as Record<string, unknown>).customElementPrefix = customElementPrefix || 'coniva';
      (target.adapterConfig as Record<string, unknown>).shadowDom = shadowDom;
    }

    if (deliveryMode === 'local-directory') {
      target.localDirectory = { path: localPath.trim() };
    } else if (deliveryMode === 'npm-registry') {
      target.npmRegistry = {
        registry: registryUrl.trim() || 'https://registry.npmjs.org',
        scope: scope.trim() || undefined,
        packageName: packageName.trim(),
      };
      target.autoPublish = { on: autoPublishOn, semver: 'patch' };
    } else {
      target.gitPr = {
        owner: owner.trim(),
        repo: repo.trim(),
        baseBranch: baseBranch.trim() || 'main',
        packagePath: packagePath.trim() || undefined,
      };
    }

    onSave(target);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Sync Target</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3 py-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">Name</Label>
          <Input
            placeholder="e.g. Production React Repo"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Platform</Label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as SyncTarget['platform'])}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Delivery Mode</Label>
            <select
              value={deliveryMode}
              onChange={(e) => setDeliveryMode(e.target.value as SyncTarget['deliveryMode'])}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
            >
              {DELIVERY_MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {deliveryMode === 'local-directory' ? (
          <div className="grid gap-1.5">
            <Label className="text-xs">Target Directory Path</Label>
            <Input
              placeholder="/path/to/target/repo/src/icons"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
            />
          </div>
        ) : deliveryMode === 'npm-registry' ? (
          <>
            <div className="grid gap-1.5">
              <Label className="text-xs">Package Name</Label>
              <Input
                placeholder="@myorg/icons"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">Registry URL</Label>
                <Input
                  value={registryUrl}
                  onChange={(e) => setRegistryUrl(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Scope (optional)</Label>
                <Input
                  placeholder="@myorg"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Auto-Publish</Label>
              <select
                value={autoPublishOn}
                onChange={(e) => setAutoPublishOn(e.target.value as 'save' | 'manual')}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="save">On save (5-min cooldown with cancel)</option>
                <option value="manual">Manual only</option>
              </select>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">Owner</Label>
                <Input
                  placeholder="my-org"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Repository</Label>
                <Input
                  placeholder="icon-library"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">Base Branch</Label>
                <Input
                  value={baseBranch}
                  onChange={(e) => setBaseBranch(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Package Path</Label>
                <Input
                  placeholder="packages/icons"
                  value={packagePath}
                  onChange={(e) => setPackagePath(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Runtime Package</Label>
            <Input
              value={runtimePackage}
              onChange={(e) => setRuntimePackage(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Output Dir</Label>
            <Input
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
            />
          </div>
        </div>

        {/* Platform-specific fields */}
        {platform === 'react' && (
          <div className="grid gap-1.5">
            <Label className="text-xs">TypeScript</Label>
            <select
              value={typescript ? 'yes' : 'no'}
              onChange={(e) => setTypescript(e.target.value === 'yes')}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="yes">TypeScript (.tsx)</option>
              <option value="no">JavaScript (.jsx)</option>
            </select>
          </div>
        )}

        {platform === 'swift' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Min iOS Version</Label>
              <select
                value={minIosVersion}
                onChange={(e) => setMinIosVersion(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="15">iOS 15</option>
                <option value="16">iOS 16</option>
                <option value="17">iOS 17</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">UI Framework</Label>
              <select
                value={swiftUIMode}
                onChange={(e) => setSwiftUIMode(e.target.value as 'swiftui' | 'uikit')}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="swiftui">SwiftUI</option>
                <option value="uikit">UIKit</option>
              </select>
            </div>
          </div>
        )}

        {platform === 'flutter' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Min Flutter SDK</Label>
              <Input
                placeholder="3.0.0"
                value={flutterSdkMin}
                onChange={(e) => setFlutterSdkMin(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Dart Package Name</Label>
              <Input
                placeholder="my_icons"
                value={dartPackageName}
                onChange={(e) => setDartPackageName(e.target.value)}
              />
            </div>
          </div>
        )}

        {platform === 'web-component' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Element Prefix</Label>
              <Input
                placeholder="coniva"
                value={customElementPrefix}
                onChange={(e) => setCustomElementPrefix(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Shadow DOM</Label>
              <select
                value={shadowDom ? 'yes' : 'no'}
                onChange={(e) => setShadowDom(e.target.value === 'yes')}
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="yes">Enabled</option>
                <option value="no">Disabled</option>
              </select>
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!isValid} onClick={handleSave}>
          Save Target
        </Button>
      </DialogFooter>
    </>
  );
}
