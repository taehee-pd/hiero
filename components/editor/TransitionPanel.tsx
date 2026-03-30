'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/kibo-ui/button';
import { Input } from '@/components/kibo-ui/input';
import { Label } from '@/components/kibo-ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/kibo-ui/select';
import { Slider } from '@/components/kibo-ui/slider';
import { toast } from '@/components/ui/use-toast';
import { interpolateTransitionValues, resolveTransition, TransitionScheduler, computeReadiness, canonicalizeLayerPath, classifySubPathStrategies } from '@/lib/runtime-core';
import type { MorphReadiness } from '@/lib/runtime-core/transition-resolver';
import type { SubPathStrategyResult } from '@/lib/runtime-core/topology-detection';
import type { TransitionConfig } from '@/lib/runtime-core/transition-resolver';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import type { Icon, RuntimeTransitionIntent, LayerBinding, Layer, TransitionStagger, Variant, LayerSnapshot } from '@/lib/schema/types';
import { variantToSnapshot } from '@/lib/schema/types';
import { EasingPicker, type EasingValue } from './EasingPicker';
import { cn } from '@/lib/utils';

const SPEED_OPTIONS = [0.25, 0.5, 1, 2] as const;

const STAGGER_MODES: TransitionStagger['mode'][] = ['linear', 'from-center', 'from-edges', 'random', 'individually'];

const DIRECTION_OPTIONS: Array<{ value: RuntimeTransitionIntent['direction']; label: string }> = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'downUp', label: 'Down -> Up' },
  { value: 'upUp', label: 'Up -> Up' },
  { value: 'offUp', label: 'Off -> Up' },
];

type CompatibilityStatus =
  | { tone: 'green'; label: 'Compatible' }
  | { tone: 'yellow'; label: 'Best Guess' }
  | { tone: 'yellow'; label: 'Location-based morph' }
  | { tone: 'red'; label: 'Incompatible -- will crossfade' };

type ActivePreview = {
  intentId: string;
  sourceSnapshot: LayerSnapshot;
  targetSnapshot: LayerSnapshot;
  speed: number;
  progress: number;
  playing: boolean;
  resolved: ReturnType<typeof resolveTransition>;
};

/**
 * TransitionPanel -- read-only morph readiness and runtime-resolved preview.
 *
 * Transitions are no longer authored per-icon; they are runtime-resolved
 * icon-to-icon intents. This panel lets the user pick source/target
 * icon+variant and preview the resolved transition.
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

  // Cross-icon endpoint state for preview
  const [srcIconId, setSrcIconId] = useState('');
  const [srcVariantId, setSrcVariantId] = useState('');
  const [tgtIconId, setTgtIconId] = useState('');
  const [tgtVariantId, setTgtVariantId] = useState('');
  const [formStrategy, setFormStrategy] = useState<RuntimeTransitionIntent['strategy']>('bestGuessMorph');
  const [formDuration, setFormDuration] = useState('240');
  const [formEasing, setFormEasing] = useState<EasingValue>('ease-in-out');
  const [formDirection, setFormDirection] = useState<RuntimeTransitionIntent['direction']>('automatic');

  const [activePreview, setActivePreview] = useState<ActivePreview | null>(null);
  const [expandedBindings, setExpandedBindings] = useState<Set<string>>(new Set());
  const schedulerRef = useRef<TransitionScheduler | null>(null);

  const renderingMode = useEditorStore((s) => s.renderingMode);
  const tokens = useEditorStore((s) => s.project?.tokenSet?.colors);

  // Derived lists for endpoint pickers
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

  // Initialize source to current icon/variant
  useEffect(() => {
    if (currentIcon && !srcIconId) {
      setSrcIconId(currentIcon.id);
    }
    if (currentVariant && !srcVariantId && srcIconId === currentIcon?.id) {
      setSrcVariantId(currentVariant.id);
    }
  }, [currentIcon, currentVariant, srcIconId, srcVariantId]);

  // Resolve snapshots for preview
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

  // Compatibility check
  const compatibility = useMemo((): CompatibilityStatus | null => {
    if (!sourceSnapshot || !targetSnapshot) return null;
    return getCompatibilityStatus(sourceSnapshot, targetSnapshot, formStrategy);
  }, [sourceSnapshot, targetSnapshot, formStrategy]);

  const stopScheduler = useCallback(() => {
    schedulerRef.current?.cancel();
    schedulerRef.current = null;
  }, []);

  const clearPreview = useCallback(() => {
    stopScheduler();
    setTransitionPreview(null);
  }, [setTransitionPreview, stopScheduler]);

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
    setTransitionPreview(null);
    setActivePreview((current) =>
      current ? { ...current, playing: false, progress: 0 } : current,
    );
  }, [setTransitionPreview, stopScheduler]);

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
        handlePlaybackComplete();
      });

      schedulerRef.current = scheduler;
      scheduler.start();
    },
    [applyPreviewFrame, handlePlaybackComplete, stopScheduler],
  );

  const beginPreview = useCallback(() => {
    if (!sourceSnapshot || !targetSnapshot) {
      toast({
        title: 'Preview unavailable',
        description: 'Select both source and target icon/variant.',
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

  if (!currentIcon || !currentVariant) {
    return null;
  }

  const isPreviewable = sourceSnapshot !== null && targetSnapshot !== null;
  const isBindingsExpanded = expandedBindings.has('preview');

  return (
    <section className="grid gap-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Transitions</p>
        <p className="text-xs text-muted-foreground">
          Preview runtime-resolved transitions between icons. Transitions are no
          longer authored -- they are resolved at runtime from icon-to-icon intents.
        </p>
      </div>

      {/* Source / Target endpoint pickers */}
      <div className="grid gap-3 rounded-xl border border-dashed border-border/70 bg-muted/15 p-3">
        <CrossIconEndpointPicker
          label="Source"
          iconEntries={iconEntries}
          selectedIconId={srcIconId}
          onIconChange={(id) => { setSrcIconId(id); setSrcVariantId(''); }}
          variants={srcVariants}
          selectedVariantId={srcVariantId}
          onVariantChange={setSrcVariantId}
        />
        <CrossIconEndpointPicker
          label="Target"
          iconEntries={iconEntries}
          selectedIconId={tgtIconId}
          onIconChange={(id) => { setTgtIconId(id); setTgtVariantId(''); }}
          variants={tgtVariants}
          selectedVariantId={tgtVariantId}
          onVariantChange={setTgtVariantId}
        />

        <div className="grid grid-cols-2 gap-2">
          <FieldSelect
            label="Strategy"
            value={formStrategy}
            onChange={(value) => setFormStrategy(value as RuntimeTransitionIntent['strategy'])}
            options={['strictMorph', 'bestGuessMorph', 'crossIconMorph', 'lineAnimation', 'replace']}
          />
          <div className="grid gap-1.5">
            <Label className="text-xs uppercase text-muted-foreground">Easing</Label>
            <EasingPicker value={formEasing} onSelect={setFormEasing} />
          </div>
        </div>

        {/* Direction selector -- only for replace strategy */}
        {formStrategy === 'replace' && (
          <FieldSelect
            label="Direction"
            value={formDirection ?? 'automatic'}
            onChange={(value) => setFormDirection(value as RuntimeTransitionIntent['direction'])}
            options={DIRECTION_OPTIONS.map((d) => d.value!)}
          />
        )}

        <div className="grid gap-1.5">
          <Label className="text-xs uppercase text-muted-foreground">Duration (ms)</Label>
          <Input
            type="number"
            min="0"
            step="10"
            value={formDuration}
            onChange={(event) => setFormDuration(event.target.value)}
          />
        </div>

        {compatibility ? <CompatibilityBadge status={compatibility} /> : null}

        <Button
          type="button"
          size="sm"
          onClick={beginPreview}
          disabled={!isPreviewable || (formStrategy === 'strictMorph' && compatibility?.tone === 'red')}
          className="rounded-xl"
        >
          Preview Transition
        </Button>
      </div>

      {/* Layer bindings readiness info (read-only) */}
      {sourceSnapshot && targetSnapshot && (
        <CollapsibleSection
          title={`Layer Bindings (${Object.keys(sourceSnapshot.layers).length} source layers)`}
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

      {/* Active preview controls */}
      {activePreview ? (
        <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/15 p-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              className="rounded-xl"
              onClick={handleTogglePlayback}
            >
              {activePreview.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              className="rounded-xl"
              onClick={handleRestart}
            >
              <RotateCcw className="size-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <Slider
                min={0}
                max={100}
                step={1}
                value={[Math.round((activePreview.progress ?? 0) * 100)]}
                onValueChange={([v]) => handleScrub(v / 100)}
                className="w-full"
              />
            </div>
            <Select value={String(activePreview.speed ?? 1)} onValueChange={(v) => handleSpeedChange(Number.parseFloat(v))}>
              <SelectTrigger className="h-9 w-20 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPEED_OPTIONS.map((speed) => (
                  <SelectItem key={speed} value={String(speed)}>
                    {speed}x
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[length:var(--text-label)] text-muted-foreground">
            {Math.round((activePreview.progress ?? 0) * 100)}%
          </p>
        </div>
      ) : null}
    </section>
  );
});

// --- Collapsible section ---

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
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
      >
        {collapsed
          ? <ChevronRight className="size-3.5 shrink-0" />
          : <ChevronDown className="size-3.5 shrink-0" />
        }
        <span className="font-semibold text-foreground">{title}</span>
        {subtitle && collapsed && (
          <span className="ml-auto truncate text-[10px] text-muted-foreground/70">{subtitle}</span>
        )}
      </button>
      {!collapsed && (
        <div className="border-t border-border/30 px-2.5 pb-2.5 pt-2">
          {children}
        </div>
      )}
    </div>
  );
}

// --- Phase I: Per-binding strategy display (read-only) ---

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
          <button
            type="button"
            className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); setShowDetails((v) => !v); }}
          >
            <span className="font-medium">{Math.round(info.readiness.score * 100)}%</span>
            {showDetails ? (
              <ChevronDown className="size-2.5" />
            ) : (
              <ChevronRight className="size-2.5" />
            )}
          </button>
        )}

        {info.strategies.length > 1 && !isPreserved && (
          <button
            type="button"
            className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); setShowSubpaths((v) => !v); }}
          >
            <span>{info.strategies.length} subpaths</span>
            {showSubpaths ? (
              <ChevronDown className="size-2.5" />
            ) : (
              <ChevronRight className="size-2.5" />
            )}
          </button>
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

// --- Read-only Layer Binding List ---

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
        No shared layers between source and target.
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

        return (
          <div
            key={`${binding.fromLayerId}-${binding.toLayerId}-${index}`}
            className="grid gap-1.5 rounded-lg border border-border/70 bg-muted/10 p-2"
          >
            <div className="flex items-center gap-1.5 text-[length:var(--text-label)]">
              <span className="font-medium text-foreground">{binding.fromLayerId ?? '(none)'}</span>
              <span className="text-muted-foreground">-&gt;</span>
              <span className="font-medium text-foreground">{binding.toLayerId ?? '(none)'}</span>
            </div>
            <BindingStrategyDisplay
              binding={binding}
              fromSnapshot={sourceSnapshot}
              toSnapshot={targetSnapshot}
              isPreserved={isPreserved}
            />
          </div>
        );
      })}
    </div>
  );
}

// --- Helpers ---

function getCompatibilityStatus(
  fromSnapshot: LayerSnapshot,
  toSnapshot: LayerSnapshot,
  strategy: RuntimeTransitionIntent['strategy'],
): CompatibilityStatus {
  const bindings = buildDefaultLayerBindings(fromSnapshot, toSnapshot, strategy);
  if (bindings.length === 0) {
    return { tone: 'red', label: 'Incompatible -- will crossfade' };
  }

  if (strategy === 'strictMorph') {
    const allStrict = bindings.every((binding) => {
      const fromD = binding.fromLayerId ? fromSnapshot.layers[binding.fromLayerId]?.path?.d : undefined;
      const toD = binding.toLayerId ? toSnapshot.layers[binding.toLayerId]?.path?.d : undefined;
      if (!fromD || !toD) return false;
      try {
        // Rely on strict morph import from runtime-core
        const { strictMorph } = require('@/lib/runtime-core');
        strictMorph(fromD, toD);
        return true;
      } catch {
        return false;
      }
    });
    return allStrict
      ? { tone: 'green', label: 'Compatible' }
      : { tone: 'red', label: 'Incompatible -- will crossfade' };
  }

  if (strategy === 'bestGuessMorph') {
    let sawBestGuess = false;
    for (const binding of bindings) {
      const fromD = binding.fromLayerId ? fromSnapshot.layers[binding.fromLayerId]?.path?.d : undefined;
      const toD = binding.toLayerId ? toSnapshot.layers[binding.toLayerId]?.path?.d : undefined;
      if (!fromD || !toD) {
        return { tone: 'red', label: 'Incompatible -- will crossfade' };
      }
      try {
        const { strictMorph: sm, bestGuessMorph: bgm } = require('@/lib/runtime-core');
        try {
          sm(fromD, toD);
          continue;
        } catch {
          const morph = bgm(fromD, toD);
          if (!morph) {
            return { tone: 'red', label: 'Incompatible -- will crossfade' };
          }
          sawBestGuess = true;
        }
      } catch {
        return { tone: 'red', label: 'Incompatible -- will crossfade' };
      }
    }

    return sawBestGuess
      ? { tone: 'yellow', label: 'Best Guess' }
      : { tone: 'green', label: 'Compatible' };
  }

  if (strategy === 'crossIconMorph') {
    // Arc-length uniform sampling handles any sub-path topology —
    // always at least partially compatible. Show as blue/info tone.
    return { tone: 'yellow', label: 'Location-based morph' };
  }

  return { tone: 'green', label: 'Compatible' };
}

function buildDefaultLayerBindings(
  fromSnapshot: LayerSnapshot,
  toSnapshot: LayerSnapshot,
  strategy: RuntimeTransitionIntent['strategy'],
): LayerBinding[] {
  const sharedIds = Object.keys(fromSnapshot.layers).filter(
    (layerId) => Boolean(toSnapshot.layers[layerId]),
  );
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
    if (strategy === 'crossIconMorph') {
      return { fromLayerId, toLayerId, morph: { topology: 'bestGuess' as const } };
    }
    return { fromLayerId, toLayerId };
  });
}

function CompatibilityBadge({ status }: { status: CompatibilityStatus }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-[length:var(--text-label)] font-semibold uppercase tracking-[0.16em]',
        status.tone === 'green' && 'bg-emerald-500/10 text-emerald-600',
        status.tone === 'yellow' && 'bg-amber-500/10 text-amber-700',
        status.tone === 'red' && 'bg-red-500/10 text-red-600',
      )}
    >
      {status.label}
    </span>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 rounded-xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// --- Cross-Icon Endpoint Picker (no state selector) ---

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
  return (
    <fieldset className="grid gap-2 rounded-lg border border-border/40 p-2.5">
      <legend className="px-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <Label className="text-xs uppercase text-muted-foreground">Icon</Label>
          <Select value={selectedIconId || '__none__'} onValueChange={(v) => onIconChange(v === '__none__' ? '' : v)}>
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue placeholder="Select icon..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select icon...</SelectItem>
              {iconEntries.map((icon) => (
                <SelectItem key={icon.id} value={icon.id}>
                  {icon.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs uppercase text-muted-foreground">Variant</Label>
          <Select value={selectedVariantId || '__none__'} onValueChange={(v) => onVariantChange(v === '__none__' ? '' : v)} disabled={!selectedIconId}>
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue placeholder="Select variant..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select variant...</SelectItem>
              {variants.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name || v.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </fieldset>
  );
}
