'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/kibo-ui/button';
import { Input } from '@/components/kibo-ui/input';
import { Label } from '@/components/kibo-ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/kibo-ui/select';
import { Separator } from '@/components/kibo-ui/separator';
import { Slider } from '@/components/kibo-ui/slider';
import { toast } from '@/components/ui/use-toast';
import {
  interpolateTransitionValues,
  resolveTransition,
  TransitionScheduler,
  computeReadiness,
  canonicalizeLayerPath,
  classifySubPathStrategies,
  strictMorph,
  bestGuessMorph,
} from '@/lib/runtime-core';
import type { MorphReadiness } from '@/lib/runtime-core/transition-resolver';
import type { SubPathStrategyResult } from '@/lib/runtime-core/topology-detection';
import type { TransitionConfig } from '@/lib/runtime-core/transition-resolver';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import type { RuntimeTransitionIntent, LayerBinding, LayerSnapshot } from '@/lib/schema/types';
import { variantToSnapshot } from '@/lib/schema/types';
import { EasingPicker, type EasingValue } from './EasingPicker';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPEED_OPTIONS = [0.25, 0.5, 1, 2] as const;

const DIRECTION_OPTIONS: Array<{ value: NonNullable<RuntimeTransitionIntent['direction']>; label: string }> = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'downUp', label: 'Down → Up' },
  { value: 'upUp', label: 'Up → Up' },
  { value: 'offUp', label: 'Off → Up' },
];

/** Human-readable display labels for each strategy. */
const STRATEGY_LABELS: Record<RuntimeTransitionIntent['strategy'], string> = {
  auto: 'Auto',
  strictMorph: 'Strict Morph',
  bestGuessMorph: 'Best Guess',
  crossIconMorph: 'Cross-Icon Morph',
  lineAnimation: 'Line Animation',
  replace: 'Replace',
};

/** Short descriptions shown below the strategy selector. */
const STRATEGY_HINTS: Record<RuntimeTransitionIntent['strategy'], string> = {
  auto: 'Automatically selects the best morph strategy for the given shapes.',
  strictMorph: 'Requires identical path topology.',
  bestGuessMorph: 'Fuzzy topology matching with readiness scoring.',
  crossIconMorph: 'Arc-length uniform sampling — works across any shapes.',
  lineAnimation: 'Trim / path-length keyframe tracks.',
  replace: 'Instant swap with directional crossfade.',
};

const STRATEGY_OPTIONS: RuntimeTransitionIntent['strategy'][] = [
  'auto',
  'strictMorph',
  'bestGuessMorph',
  'crossIconMorph',
  'lineAnimation',
  'replace',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CompatibilityTone = 'green' | 'yellow' | 'orange' | 'red';

type CompatibilityStatus = {
  tone: CompatibilityTone;
  label: string;
};

type ActivePreview = {
  intentId: string;
  sourceSnapshot: LayerSnapshot;
  targetSnapshot: LayerSnapshot;
  speed: number;
  progress: number;
  playing: boolean;
  resolved: ReturnType<typeof resolveTransition>;
};

// ---------------------------------------------------------------------------
// TransitionPanel — main exported component
// ---------------------------------------------------------------------------

/**
 * TransitionPanel — runtime-resolved icon-to-icon transition preview.
 *
 * The user selects source and target icon+variant, chooses a strategy,
 * and previews the resolved transition. Layer binding readiness and
 * per-subpath strategy breakdowns are shown read-only.
 */
export const TransitionPanel = memo(function TransitionPanel() {
  const currentIcon = useEditorStore((s) =>
    s.currentIconId ? s.project?.icons[s.currentIconId] ?? null : null,
  );
  const currentVariant = useEditorStore((s) =>
    s.currentIconId && s.currentVariantId
      ? s.project?.icons[s.currentIconId]?.variants[s.currentVariantId] ?? null
      : null,
  );
  const { setTransitionPreview, setSelectedTransitionId } = useEditorActions();
  const projectIcons = useEditorStore((s) => s.project?.icons ?? null);

  // --- Endpoint state ---
  // Source icon is always the currently-open icon (not changeable).
  const currentIconId = useEditorStore((s) => s.currentIconId ?? '');
  const currentVariantId = useEditorStore((s) => s.currentVariantId ?? '');
  const srcIconId = currentIconId;
  const [srcVariantId, setSrcVariantId] = useState('');
  const [tgtIconId, setTgtIconId] = useState('');
  const [tgtVariantId, setTgtVariantId] = useState('');

  // --- Form state ---
  const [formStrategy, setFormStrategy] = useState<RuntimeTransitionIntent['strategy']>('auto');
  const [formDuration, setFormDuration] = useState('240');
  const [formEasing, setFormEasing] = useState<EasingValue>('ease-in-out');
  const [formDirection, setFormDirection] = useState<RuntimeTransitionIntent['direction']>('automatic');

  // --- Preview state ---
  const [activePreview, setActivePreview] = useState<ActivePreview | null>(null);
  const [expandedBindings, setExpandedBindings] = useState<Set<string>>(new Set());
  const schedulerRef = useRef<TransitionScheduler | null>(null);

  // --- Derived lists ---
  const iconEntries = useMemo(
    () => Object.values(projectIcons ?? {}).map((icon) => ({ id: icon.id, name: icon.name })),
    [projectIcons],
  );
  const srcVariants = useMemo(
    () => (srcIconId && projectIcons?.[srcIconId] ? Object.values(projectIcons[srcIconId].variants) : []),
    [projectIcons, srcIconId],
  );
  const tgtVariants = useMemo(
    () => (tgtIconId && projectIcons?.[tgtIconId] ? Object.values(projectIcons[tgtIconId].variants) : []),
    [projectIcons, tgtIconId],
  );

  // Auto-sync source variant to the editor's current variant
  useEffect(() => {
    if (currentVariantId && !srcVariantId) {
      setSrcVariantId(currentVariantId);
    }
  }, [currentVariantId, srcVariantId]);

  // When the current icon changes, reset the source variant
  useEffect(() => {
    setSrcVariantId(currentVariantId);
  }, [currentIconId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Snapshots ---
  const sourceSnapshot = useMemo((): LayerSnapshot | null => {
    if (!srcIconId || !srcVariantId) return null;
    const variant = projectIcons?.[srcIconId]?.variants[srcVariantId];
    return variant ? variantToSnapshot(variant) : null;
  }, [projectIcons, srcIconId, srcVariantId]);

  const targetSnapshot = useMemo((): LayerSnapshot | null => {
    if (!tgtIconId || !tgtVariantId) return null;
    const variant = projectIcons?.[tgtIconId]?.variants[tgtVariantId];
    return variant ? variantToSnapshot(variant) : null;
  }, [projectIcons, tgtIconId, tgtVariantId]);

  // --- Compatibility ---
  const compatibility = useMemo((): CompatibilityStatus | null => {
    if (!sourceSnapshot || !targetSnapshot) return null;
    return getCompatibilityStatus(sourceSnapshot, targetSnapshot, formStrategy);
  }, [sourceSnapshot, targetSnapshot, formStrategy]);

  // --- Scheduler lifecycle ---
  const stopScheduler = useCallback(() => {
    schedulerRef.current?.cancel();
    schedulerRef.current = null;
  }, []);

  const applyPreviewFrame = useCallback(
    (preview: ActivePreview, progress: number) => {
      setTransitionPreview({
        transitionId: preview.intentId,
        baseIconId: srcIconId || undefined,
        baseVariantId: srcVariantId || undefined,
        targetIconId: tgtIconId || undefined,
        targetVariantId: tgtVariantId || undefined,
        progress,
        resolvedTransition: preview.resolved,
        interpolatedValues: interpolateTransitionValues(preview.resolved, progress),
      });
      setActivePreview((current) =>
        current?.intentId === preview.intentId
          ? { ...current, progress }
          : current,
      );
    },
    [setTransitionPreview, srcIconId, srcVariantId, tgtIconId, tgtVariantId],
  );

  const handlePlaybackComplete = useCallback(() => {
    stopScheduler();
    // Keep transitionPreview set so the canvas holds the final frame visible.
    // Users can reset manually via Replay or by starting a new preview.
    setActivePreview((current) =>
      current ? { ...current, playing: false, progress: 1 } : current,
    );
  }, [stopScheduler]);

  const startScheduler = useCallback(
    (preview: ActivePreview, startProgress: number, speed: number) => {
      stopScheduler();
      const remaining = Math.max(1 - startProgress, 0);
      if (remaining <= 0) {
        handlePlaybackComplete();
        return;
      }

      const scheduler = new TransitionScheduler(
        {
          ...preview.resolved,
          durationMs: Math.max(preview.resolved.durationMs * remaining / speed, 1),
        },
        {
          onFrame: (progress: number) => {
            const absolute = startProgress + progress * remaining;
            applyPreviewFrame(preview, absolute);
          },
        },
      );

      scheduler.onComplete(() => {
        // Ensure the final frame is rendered before stopping
        applyPreviewFrame(preview, 1);
        handlePlaybackComplete();
      });

      schedulerRef.current = scheduler;
      scheduler.start();
    },
    [applyPreviewFrame, handlePlaybackComplete, stopScheduler],
  );

  // --- Actions ---
  const beginPreview = useCallback(() => {
    if (!sourceSnapshot || !targetSnapshot) {
      toast({
        title: 'Preview unavailable',
        description: 'Select both source and target icon + variant.',
      });
      return;
    }

    const durationMs = Number.parseInt(formDuration, 10);
    if (!Number.isFinite(durationMs) || durationMs <= 0) return;

    const config: TransitionConfig = {
      id: `preview-${srcIconId}:${srcVariantId}-to-${tgtIconId}:${tgtVariantId}`,
      strategy: formStrategy,
      durationMs,
      easing: formEasing,
      direction: formDirection,
      layerBindings: buildDefaultLayerBindings(sourceSnapshot, targetSnapshot, formStrategy),
    };

    let resolved: ReturnType<typeof resolveTransition>;
    try {
      resolved = resolveTransition(config, sourceSnapshot, targetSnapshot);
    } catch (error) {
      toast({
        title: 'Preview failed',
        description:
          error instanceof Error ? error.message : 'Transition could not be resolved.',
      });
      return;
    }

    const nextPreview: ActivePreview = {
      intentId: config.id ?? 'preview',
      sourceSnapshot,
      targetSnapshot,
      speed: activePreview?.speed ?? 1,
      progress: 0,
      playing: true,
      resolved,
    };

    setSelectedTransitionId(config.id ?? null);
    setActivePreview(nextPreview);
    applyPreviewFrame(nextPreview, 0);
    startScheduler(nextPreview, 0, nextPreview.speed);
  }, [
    activePreview?.speed,
    applyPreviewFrame,
    formDirection,
    formDuration,
    formEasing,
    formStrategy,
    setSelectedTransitionId,
    sourceSnapshot,
    srcIconId,
    srcVariantId,
    startScheduler,
    targetSnapshot,
    tgtIconId,
    tgtVariantId,
  ]);

  const handleTogglePlayback = useCallback(() => {
    if (!activePreview) return;
    if (activePreview.playing) {
      stopScheduler();
      setActivePreview({ ...activePreview, playing: false });
      return;
    }

    const next = { ...activePreview, playing: true };
    setActivePreview(next);
    startScheduler(next, next.progress, next.speed);
  }, [activePreview, startScheduler, stopScheduler]);

  const handleRestart = useCallback(() => {
    if (!activePreview) return;
    const next = { ...activePreview, playing: true, progress: 0 };
    setActivePreview(next);
    applyPreviewFrame(next, 0);
    startScheduler(next, 0, next.speed);
  }, [activePreview, applyPreviewFrame, startScheduler]);

  const handleScrub = useCallback(
    (progress: number) => {
      if (!activePreview) return;
      const next = { ...activePreview, progress };
      setActivePreview(next);
      applyPreviewFrame(next, progress);
      if (activePreview.playing) {
        startScheduler({ ...next, playing: true }, progress, next.speed);
      } else {
        stopScheduler();
      }
    },
    [activePreview, applyPreviewFrame, startScheduler, stopScheduler],
  );

  const handleSpeedChange = useCallback(
    (speed: number) => {
      if (!activePreview) return;
      const next = { ...activePreview, speed };
      setActivePreview(next);
      if (next.playing) {
        startScheduler(next, next.progress, speed);
      }
    },
    [activePreview, startScheduler],
  );

  // Clear held preview when the selected icon changes to prevent stale state
  useEffect(() => {
    stopScheduler();
    setTransitionPreview(null);
    setActivePreview(null);
  }, [currentIconId, setTransitionPreview, stopScheduler]);

  useEffect(() => {
    return () => {
      stopScheduler();
      setTransitionPreview(null);
    };
  }, [setTransitionPreview, stopScheduler]);

  const toggleBindingExpand = useCallback((key: string) => {
    setExpandedBindings((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // --- Guard ---
  if (!currentIcon || !currentVariant) {
    return null;
  }

  const isPreviewable = sourceSnapshot !== null && targetSnapshot !== null;
  const isBindingsExpanded = expandedBindings.has('preview');
  const showDirection = formStrategy === 'replace' || formStrategy === 'lineAnimation';

  return (
    <section className="grid gap-3">
      {/* Header */}
      <div>
        <p className="text-[length:var(--text-heading)] font-semibold text-foreground">Transition Preview</p>
        <p className="text-[length:var(--text-label)] text-muted-foreground">
          Preview how icons transition at runtime. Select source and target,
          choose a strategy, and inspect layer bindings.
        </p>
      </div>

      {/* Endpoint pickers — source → target */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <LockedSourceEndpoint
          iconName={currentIcon.name}
          variants={srcVariants}
          selectedVariantId={srcVariantId}
          onVariantChange={setSrcVariantId}
        />
        <div
          aria-hidden="true"
          className="flex size-6 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground"
        >
          <ArrowRight className="size-3.5" />
        </div>
        <CrossIconEndpointPicker
          label="Target"
          iconEntries={iconEntries}
          selectedIconId={tgtIconId}
          onIconChange={(id) => { setTgtIconId(id); setTgtVariantId(''); }}
          variants={tgtVariants}
          selectedVariantId={tgtVariantId}
          onVariantChange={setTgtVariantId}
        />
      </div>

      <Separator />

      {/* Strategy + Easing */}
      <div className="grid grid-cols-2 gap-2">
        <StrategySelect
          value={formStrategy}
          onChange={setFormStrategy}
        />
        <div className="grid gap-1.5">
          <Label className="text-[length:var(--text-label)] font-medium tracking-tight text-muted-foreground">Easing</Label>
          <EasingPicker value={formEasing} onSelect={setFormEasing} />
        </div>
      </div>

      {/* Strategy hint */}
      <p className="text-[length:var(--text-caption)] leading-snug text-muted-foreground/70">
        {STRATEGY_HINTS[formStrategy]}
      </p>

      {/* Direction — applicable to replace and lineAnimation */}
      {showDirection && (
        <div className="grid gap-1.5">
          <Label className="text-[length:var(--text-label)] font-medium tracking-tight text-muted-foreground">Direction</Label>
          <Select
            value={formDirection ?? 'automatic'}
            onValueChange={(v) => setFormDirection(v as RuntimeTransitionIntent['direction'])}
          >
            <SelectTrigger className="h-8 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIRECTION_OPTIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Duration */}
      <div className="grid gap-1.5">
        <Label className="text-[length:var(--text-label)] font-medium tracking-tight text-muted-foreground">Duration (ms)</Label>
        <Input
          type="number"
          min="0"
          step="10"
          value={formDuration}
          onChange={(event) => setFormDuration(event.target.value)}
          className="h-8 rounded-lg"
        />
      </div>

      {/* Compatibility badge */}
      {compatibility ? <CompatibilityBadge status={compatibility} /> : null}

      {/* Preview button */}
      <Button
        type="button"
        size="sm"
        onClick={beginPreview}
        disabled={!isPreviewable || (formStrategy === 'strictMorph' && compatibility?.tone === 'red')}
        className="rounded-lg"
      >
        Preview Transition
      </Button>

      {/* Layer bindings (read-only) */}
      {sourceSnapshot && targetSnapshot && (
        <CollapsibleSection
          title={`Layer Bindings (${Object.keys(sourceSnapshot.layers).length} source → ${Object.keys(targetSnapshot.layers).length} target)`}
          collapsed={!isBindingsExpanded}
          onToggle={() => toggleBindingExpand('preview')}
        >
          <ReadOnlyLayerBindingList
            sourceSnapshot={sourceSnapshot}
            targetSnapshot={targetSnapshot}
            strategy={formStrategy}
          />
        </CollapsibleSection>
      )}

      {/* Playback controls */}
      {activePreview ? (
        <PreviewPlaybackControls
          preview={activePreview}
          onTogglePlayback={handleTogglePlayback}
          onRestart={handleRestart}
          onScrub={handleScrub}
          onSpeedChange={handleSpeedChange}
        />
      ) : null}
    </section>
  );
});

// ---------------------------------------------------------------------------
// PreviewPlaybackControls
// ---------------------------------------------------------------------------

function PreviewPlaybackControls({
  preview,
  onTogglePlayback,
  onRestart,
  onScrub,
  onSpeedChange,
}: {
  preview: ActivePreview;
  onTogglePlayback: () => void;
  onRestart: () => void;
  onScrub: (progress: number) => void;
  onSpeedChange: (speed: number) => void;
}) {
  const pct = Math.round((preview.progress ?? 0) * 100);

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          className="rounded-lg"
          onClick={onTogglePlayback}
        >
          {preview.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          className="rounded-lg"
          onClick={onRestart}
        >
          <RotateCcw className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <Slider
            min={0}
            max={100}
            step={1}
            value={[pct]}
            onValueChange={([v]) => onScrub(v / 100)}
            className="w-full"
          />
        </div>
        <Select
          value={String(preview.speed ?? 1)}
          onValueChange={(v) => onSpeedChange(Number.parseFloat(v))}
        >
          <SelectTrigger className="h-8 w-20 rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPEED_OPTIONS.map((speed) => (
              <SelectItem key={speed} value={String(speed)}>
                {speed}×
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-[length:var(--text-label)] tabular-nums text-muted-foreground">
        {pct}%
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CollapsibleSection
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  subtitle,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 rounded-lg border border-border/40">
      <Button
        variant="ghost"
        className="h-auto w-full justify-start gap-1.5 rounded-none px-2.5 py-2 text-left text-xs font-medium text-foreground/70 hover:text-foreground"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
      >
        {collapsed
          ? <ChevronRight className="size-3.5 shrink-0" />
          : <ChevronDown className="size-3.5 shrink-0" />
        }
        <span className="font-semibold text-foreground">{title}</span>
        {subtitle && collapsed && (
          <span className="ml-auto truncate text-[length:var(--text-caption)] text-muted-foreground/70">{subtitle}</span>
        )}
      </Button>
      {!collapsed && (
        <div className="border-t border-border/30 px-2.5 pb-2.5 pt-2">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-binding strategy analysis (read-only)
// ---------------------------------------------------------------------------

type BindingStrategyOverall = 'morph' | 'trim' | 'crossfade' | 'preserved';

type BindingStrategyInfo = {
  strategies: SubPathStrategyResult[];
  readiness: MorphReadiness | null;
  overallStrategy: BindingStrategyOverall;
};

function computeBindingStrategy(
  binding: LayerBinding,
  fromSnapshot: LayerSnapshot | undefined,
  toSnapshot: LayerSnapshot | undefined,
): BindingStrategyInfo {
  const defaultResult: BindingStrategyInfo = {
    strategies: [],
    readiness: null,
    overallStrategy: 'crossfade',
  };

  if (!fromSnapshot || !toSnapshot) return defaultResult;

  const fromLayer = binding.fromLayerId ? fromSnapshot.layers[binding.fromLayerId] : undefined;
  const toLayer = binding.toLayerId ? toSnapshot.layers[binding.toLayerId] : undefined;

  if (!fromLayer || !toLayer) return defaultResult;

  const fromCanon = canonicalizeLayerPath(fromLayer);
  const toCanon = canonicalizeLayerPath(toLayer);

  if (!fromCanon || !toCanon) return defaultResult;

  const strategies = classifySubPathStrategies(fromCanon.stats, toCanon.stats);
  const readiness = computeReadiness(fromLayer, toLayer);

  let overallStrategy: BindingStrategyOverall;
  if (strategies.length === 0) {
    overallStrategy = 'crossfade';
  } else {
    const hasCrossfade = strategies.some((s) => s.strategy === 'crossfade');
    const hasTrim = strategies.some((s) => s.strategy === 'trim');
    if (hasCrossfade) {
      overallStrategy = 'crossfade';
    } else if (hasTrim) {
      overallStrategy = 'trim';
    } else {
      overallStrategy = 'morph';
    }
  }

  return { strategies, readiness, overallStrategy };
}

const STRATEGY_BADGE_STYLES: Record<BindingStrategyOverall, { bg: string; text: string; label: string }> = {
  morph: { bg: 'bg-emerald-500/15', text: 'text-emerald-600', label: 'morph' },
  trim: { bg: 'bg-amber-500/15', text: 'text-amber-700', label: 'trim' },
  crossfade: { bg: 'bg-red-500/15', text: 'text-red-600', label: 'crossfade' },
  preserved: { bg: 'bg-blue-500/15', text: 'text-blue-600', label: 'preserved' },
};

function BindingStrategyDisplay({
  binding,
  fromSnapshot,
  toSnapshot,
  isPreserved,
}: {
  binding: LayerBinding;
  fromSnapshot: LayerSnapshot | undefined;
  toSnapshot: LayerSnapshot | undefined;
  isPreserved: boolean;
}) {
  const info = useMemo(
    () => computeBindingStrategy(binding, fromSnapshot, toSnapshot),
    [binding, fromSnapshot, toSnapshot],
  );
  const [showDetails, setShowDetails] = useState(false);
  const [showSubpaths, setShowSubpaths] = useState(false);

  const displayStrategy: BindingStrategyOverall = isPreserved ? 'preserved' : info.overallStrategy;
  const badge = STRATEGY_BADGE_STYLES[displayStrategy];

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
            badge.bg,
            badge.text,
          )}
        >
          {badge.label}
        </span>

        {displayStrategy === 'morph' && info.readiness && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto gap-0.5 px-1 py-0 text-[10px] text-foreground/70 hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); setShowDetails((v) => !v); }}
          >
            <span className="font-medium">{Math.round(info.readiness.score * 100)}%</span>
            {showDetails ? (
              <ChevronDown className="size-2.5" />
            ) : (
              <ChevronRight className="size-2.5" />
            )}
          </Button>
        )}

        {info.strategies.length > 1 && !isPreserved && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto gap-0.5 px-1 py-0 text-[10px] text-foreground/70 hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); setShowSubpaths((v) => !v); }}
          >
            <span>{info.strategies.length} subpaths</span>
            {showSubpaths ? (
              <ChevronDown className="size-2.5" />
            ) : (
              <ChevronRight className="size-2.5" />
            )}
          </Button>
        )}
      </div>

      {showDetails && info.readiness && (
        <div className="ml-1 grid gap-0.5 border-l-2 border-emerald-500/30 pl-2 text-[10px] text-muted-foreground">
          <span>Command compatibility: {Math.round(info.readiness.commandCompatibility * 100)}%</span>
          <span>Subpath compatibility: {Math.round(info.readiness.subpathCompatibility * 100)}%</span>
          <span>BBox similarity: {Math.round(info.readiness.bboxSimilarity * 100)}%</span>
          <span>Centroid similarity: {Math.round(info.readiness.centroidSimilarity * 100)}%</span>
        </div>
      )}

      {showSubpaths && info.strategies.length > 1 && (
        <div className="ml-1 grid gap-0.5 border-l-2 border-border/50 pl-2 text-[10px] text-muted-foreground">
          {info.strategies.map((sp, i) => {
            const spBadge = STRATEGY_BADGE_STYLES[sp.strategy as BindingStrategyOverall] ?? STRATEGY_BADGE_STYLES.crossfade;
            return (
              <div key={i} className="flex items-center gap-1">
                <span className="font-mono text-foreground/70">#{sp.fromIndex}</span>
                <span
                  className={cn(
                    'inline-flex rounded-full px-1 py-px text-[9px] font-semibold leading-none',
                    spBadge.bg,
                    spBadge.text,
                  )}
                >
                  {sp.strategy}
                </span>
                <span className="truncate">{sp.reason.split(' -- ')[0]}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReadOnlyLayerBindingList
// ---------------------------------------------------------------------------

function ReadOnlyLayerBindingList({
  sourceSnapshot,
  targetSnapshot,
  strategy,
}: {
  sourceSnapshot: LayerSnapshot;
  targetSnapshot: LayerSnapshot;
  strategy: RuntimeTransitionIntent['strategy'];
}) {
  const bindings = useMemo(
    () => buildDefaultLayerBindings(sourceSnapshot, targetSnapshot, strategy),
    [sourceSnapshot, targetSnapshot, strategy],
  );

  if (bindings.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No layer bindings could be generated.
      </p>
    );
  }

  return (
    <div className="mt-2 grid gap-1.5">
      {bindings.map((binding, index) => {
        const isPreserved = Boolean(
          binding.fromLayerId &&
          binding.toLayerId &&
          binding.fromLayerId === binding.toLayerId,
        ) && strategy === 'replace';

        const isAdded = !binding.fromLayerId && binding.toLayerId;
        const isRemoved = binding.fromLayerId && !binding.toLayerId;

        return (
          <div
            key={`${binding.fromLayerId}-${binding.toLayerId}-${index}`}
            className="grid gap-1.5 rounded-lg border border-border/70 bg-muted/10 p-2"
          >
            <div className="flex items-center gap-1.5 text-[length:var(--text-label)]">
              {isAdded ? (
                <>
                  <span className="font-medium text-foreground">{binding.toLayerId}</span>
                  <span className="inline-flex rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-emerald-600">
                    new
                  </span>
                </>
              ) : isRemoved ? (
                <>
                  <span className="font-medium text-foreground">{binding.fromLayerId}</span>
                  <span className="inline-flex rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-red-600">
                    removed
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium text-foreground">{binding.fromLayerId ?? '(none)'}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium text-foreground">{binding.toLayerId ?? '(none)'}</span>
                </>
              )}
            </div>
            {!isAdded && !isRemoved && (
              <BindingStrategyDisplay
                binding={binding}
                fromSnapshot={sourceSnapshot}
                toSnapshot={targetSnapshot}
                isPreserved={isPreserved}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers — compatibility & bindings
// ---------------------------------------------------------------------------

function getCompatibilityStatus(
  fromSnapshot: LayerSnapshot,
  toSnapshot: LayerSnapshot,
  strategy: RuntimeTransitionIntent['strategy'],
): CompatibilityStatus {
  const bindings = buildDefaultLayerBindings(fromSnapshot, toSnapshot, strategy);
  if (bindings.length === 0) {
    return { tone: 'red', label: 'Replace / Fallback' };
  }

  if (strategy === 'auto') {
    // For auto strategy, check if any morphing is possible
    let canMorph = false;
    for (const binding of bindings) {
      const fromD = binding.fromLayerId ? fromSnapshot.layers[binding.fromLayerId]?.path?.d : undefined;
      const toD = binding.toLayerId ? toSnapshot.layers[binding.toLayerId]?.path?.d : undefined;
      if (fromD && toD) {
        try {
          strictMorph(fromD, toD);
          canMorph = true;
          break;
        } catch {
          const morph = bestGuessMorph(fromD, toD);
          if (morph) { canMorph = true; break; }
        }
      }
    }
    return canMorph
      ? { tone: 'green' as const, label: 'Auto (morph detected)' }
      : { tone: 'yellow' as const, label: 'Auto (will crossfade)' };
  }

  if (strategy === 'strictMorph') {
    const allStrict = bindings.every((binding) => {
      const fromD = binding.fromLayerId ? fromSnapshot.layers[binding.fromLayerId]?.path?.d : undefined;
      const toD = binding.toLayerId ? toSnapshot.layers[binding.toLayerId]?.path?.d : undefined;
      if (!fromD || !toD) return false;
      try {
        strictMorph(fromD, toD);
        return true;
      } catch {
        return false;
      }
    });
    return allStrict
      ? { tone: 'green', label: 'Strict Morph' }
      : { tone: 'red', label: 'Replace / Fallback' };
  }

  if (strategy === 'bestGuessMorph') {
    let sawBestGuess = false;
    for (const binding of bindings) {
      const fromD = binding.fromLayerId ? fromSnapshot.layers[binding.fromLayerId]?.path?.d : undefined;
      const toD = binding.toLayerId ? toSnapshot.layers[binding.toLayerId]?.path?.d : undefined;
      if (!fromD || !toD) {
        return { tone: 'red', label: 'Replace / Fallback' };
      }
      try {
        strictMorph(fromD, toD);
        continue;
      } catch {
        const morph = bestGuessMorph(fromD, toD);
        if (!morph) {
          return { tone: 'red', label: 'Replace / Fallback' };
        }
        sawBestGuess = true;
      }
    }

    return sawBestGuess
      ? { tone: 'yellow', label: 'Best Guess' }
      : { tone: 'green', label: 'Strict Morph' };
  }

  if (strategy === 'crossIconMorph') {
    return { tone: 'yellow', label: 'Cross-Icon Morph' };
  }

  if (strategy === 'lineAnimation') {
    return { tone: 'orange', label: 'Line Animation' };
  }

  // replace — always works
  return { tone: 'green', label: 'Replace' };
}

function buildDefaultLayerBindings(
  fromSnapshot: LayerSnapshot,
  toSnapshot: LayerSnapshot,
  strategy: RuntimeTransitionIntent['strategy'],
): LayerBinding[] {
  const fromIds = Object.keys(fromSnapshot.layers);
  const toIds = Object.keys(toSnapshot.layers);

  // Auto strategy: match by layer identity first (shared IDs), then treat
  // unmatched layers as added/removed. This avoids false pairings when
  // object key order differs between source and target.
  if (strategy === 'auto') {
    const toIdSet = new Set(toIds);
    const fromIdSet = new Set(fromIds);
    const bindings: LayerBinding[] = [];

    // Shared layers — matched by ID
    for (const id of fromIds) {
      if (toIdSet.has(id)) {
        bindings.push({ fromLayerId: id, toLayerId: id });
      }
    }
    // Unmatched source → removed
    for (const id of fromIds) {
      if (!toIdSet.has(id)) {
        bindings.push({ fromLayerId: id, toLayerId: undefined });
      }
    }
    // Unmatched target → added
    for (const id of toIds) {
      if (!fromIdSet.has(id)) {
        bindings.push({ fromLayerId: undefined, toLayerId: id });
      }
    }

    return bindings;
  }

  // Cross-icon: layers from different icons — pair positionally, then
  // add unmatched as added / removed.
  if (strategy === 'crossIconMorph') {
    const count = Math.min(fromIds.length, toIds.length);
    const bindings: LayerBinding[] = [];

    for (let i = 0; i < count; i++) {
      bindings.push({
        fromLayerId: fromIds[i]!,
        toLayerId: toIds[i]!,
        morph: { topology: 'bestGuess' as const },
      });
    }
    // Unmatched source → removed
    for (let i = count; i < fromIds.length; i++) {
      bindings.push({ fromLayerId: fromIds[i]!, toLayerId: undefined });
    }
    // Unmatched target → added
    for (let i = count; i < toIds.length; i++) {
      bindings.push({ fromLayerId: undefined, toLayerId: toIds[i]! });
    }

    return bindings;
  }

  // Same-icon or shared-layer strategies: match by layer ID
  const sharedIds = fromIds.filter((layerId) => Boolean(toSnapshot.layers[layerId]));
  const pairs = sharedIds.length > 0
    ? sharedIds.map((layerId) => ({ fromLayerId: layerId, toLayerId: layerId }))
    : [];

  return pairs.map(({ fromLayerId, toLayerId }) => {
    if (strategy === 'strictMorph') {
      return { fromLayerId, toLayerId, morph: { topology: 'strict' as const } };
    }
    if (strategy === 'bestGuessMorph') {
      return { fromLayerId, toLayerId, morph: { topology: 'bestGuess' as const } };
    }
    return { fromLayerId, toLayerId };
  });
}

// ---------------------------------------------------------------------------
// CompatibilityBadge
// ---------------------------------------------------------------------------

function CompatibilityBadge({ status }: { status: CompatibilityStatus }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-[length:var(--text-label)] font-semibold tracking-tight',
        status.tone === 'green' && 'bg-emerald-500/10 text-emerald-600',
        status.tone === 'yellow' && 'bg-amber-500/10 text-amber-700',
        status.tone === 'orange' && 'bg-orange-500/10 text-orange-600',
        status.tone === 'red' && 'bg-red-500/10 text-red-600',
      )}
    >
      {status.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// StrategySelect — human-readable labels with descriptions
// ---------------------------------------------------------------------------

function StrategySelect({
  value,
  onChange,
}: {
  value: RuntimeTransitionIntent['strategy'];
  onChange: (value: RuntimeTransitionIntent['strategy']) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-[length:var(--text-label)] font-medium tracking-tight text-muted-foreground">Strategy</Label>
      <Select value={value} onValueChange={(v) => onChange(v as RuntimeTransitionIntent['strategy'])}>
        <SelectTrigger className="h-8 rounded-lg">
          <SelectValue>
            {STRATEGY_LABELS[value]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {STRATEGY_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {STRATEGY_LABELS[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CrossIconEndpointPicker
// ---------------------------------------------------------------------------

function LockedSourceEndpoint({
  iconName,
  variants,
  selectedVariantId,
  onVariantChange,
}: {
  iconName: string;
  variants: Array<{ id: string; name?: string }>;
  selectedVariantId: string;
  onVariantChange: (id: string) => void;
}) {
  return (
    <fieldset className="grid gap-1.5 rounded-lg border border-border/60 bg-background/60 p-2">
      <legend className="px-1.5 text-[10px] font-medium text-muted-foreground">Source</legend>
      <div className="grid gap-1.5">
        <Label className="text-[10px] font-medium text-muted-foreground">Source icon</Label>
        <div className="flex h-8 items-center rounded-lg border border-input bg-muted/30 px-3 text-xs text-foreground">
          {iconName}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-[10px] font-medium text-muted-foreground">Source variant</Label>
        <Select value={selectedVariantId || '__none__'} onValueChange={(v) => onVariantChange(v === '__none__' ? '' : v)}>
          <SelectTrigger className="h-8 rounded-lg">
            <SelectValue placeholder="Select variant…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Select variant…</SelectItem>
            {variants.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name || v.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </fieldset>
  );
}

function CrossIconEndpointPicker({
  label,
  iconEntries,
  selectedIconId,
  onIconChange,
  variants,
  selectedVariantId,
  onVariantChange,
}: {
  label: string;
  iconEntries: Array<{ id: string; name: string }>;
  selectedIconId: string;
  onIconChange: (id: string) => void;
  variants: Array<{ id: string; name?: string }>;
  selectedVariantId: string;
  onVariantChange: (id: string) => void;
}) {
  const qualifier = label.toLowerCase();
  return (
    <fieldset className="grid gap-1.5 rounded-lg border border-border/60 bg-background/60 p-2">
      <legend className="px-1.5 text-[10px] font-medium text-muted-foreground">{label}</legend>
      <div className="grid gap-1.5">
        <Label className="text-[10px] font-medium text-muted-foreground">{qualifier} icon</Label>
        <Select value={selectedIconId || '__none__'} onValueChange={(v) => onIconChange(v === '__none__' ? '' : v)}>
          <SelectTrigger className="h-8 rounded-lg">
            <SelectValue placeholder="Select icon…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Select icon…</SelectItem>
            {iconEntries.map((icon) => (
              <SelectItem key={icon.id} value={icon.id}>
                {icon.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-[10px] font-medium text-muted-foreground">{qualifier} variant</Label>
        <Select value={selectedVariantId || '__none__'} onValueChange={(v) => onVariantChange(v === '__none__' ? '' : v)} disabled={!selectedIconId}>
          <SelectTrigger className="h-8 rounded-lg">
            <SelectValue placeholder="Select variant…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Select variant…</SelectItem>
            {variants.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name || v.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </fieldset>
  );
}
