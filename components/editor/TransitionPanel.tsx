'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/kibo-ui/button';
import { Input } from '@/components/kibo-ui/input';
import { Label } from '@/components/kibo-ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/kibo-ui/select';
import { Separator } from '@/components/kibo-ui/separator';
import { Slider } from '@/components/kibo-ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toast } from '@/components/ui/use-toast';
import {
  autoMorph,
  interpolateTransitionValues,
  resolveTransition,
  TransitionScheduler,
} from '@/lib/runtime-core';
import type { TransitionConfig } from '@/lib/runtime-core/transition-resolver';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import type { RuntimeTransitionIntent, LayerBinding, LayerSnapshot, TransitionStagger } from '@/lib/schema/types';
import { variantToSnapshot } from '@/lib/schema/types';
import { EasingPicker, type EasingValue } from './EasingPicker';

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

/**
 * Playback mode — the three SF Symbols 7 patterns (see §2.5 of
 * docs_canonical/ANIMATE_PANEL_REVAMP_PLAN.md). These map onto
 * `TransitionStagger['mode']` via {@link PLAYBACK_MODE_TO_STAGGER}.
 */
type PlaybackMode = 'byLayer' | 'wholeSymbol' | 'individually';

const PLAYBACK_MODE_OPTIONS: Array<{ value: PlaybackMode; label: string; hint: string }> = [
  { value: 'byLayer', label: 'By Layer', hint: 'Staggered — 40 ms between layers (default).' },
  { value: 'wholeSymbol', label: 'Whole Symbol', hint: 'Every layer starts at the same instant.' },
  { value: 'individually', label: 'Individually', hint: 'Each layer finishes before the next begins.' },
];

const PLAYBACK_MODE_TO_STAGGER: Record<PlaybackMode, TransitionStagger['mode']> = {
  byLayer: 'linear',
  wholeSymbol: 'simultaneous',
  individually: 'individually',
};

const PLAYBACK_MODE_DEFAULT_STAGGER_MS: Record<PlaybackMode, number> = {
  byLayer: 40,
  wholeSymbol: 0,
  individually: 0,
};

/**
 * Advanced stagger modes — surfaced only inside the Advanced disclosure.
 * Existing projects that already use one of these load correctly and the
 * Advanced panel lets power users pick them back up.
 */
const ADVANCED_STAGGER_OPTIONS: Array<{ value: TransitionStagger['mode']; label: string }> = [
  { value: 'from-center', label: 'From center' },
  { value: 'from-edges', label: 'From edges' },
  { value: 'random', label: 'Random' },
];

/**
 * Strategy override values used only in the Advanced disclosure. The UI
 * otherwise always writes `strategy: 'auto'` to the schema. See §2.2.
 */
const STRATEGY_OVERRIDE_OPTIONS: Array<{ value: RuntimeTransitionIntent['strategy']; label: string }> = [
  { value: 'auto', label: 'Auto (recommended)' },
  { value: 'strictMorph', label: 'Force — Strict morph' },
  { value: 'bestGuessMorph', label: 'Force — Best guess' },
  { value: 'crossIconMorph', label: 'Force — Cross-icon morph' },
  { value: 'lineAnimation', label: 'Force — Line animation' },
  { value: 'replace', label: 'Force — Replace (crossfade)' },
];

/**
 * Human-readable tier names returned by {@link autoMorph}. Used for the
 * "Engine chose" read-only pill in the Advanced disclosure (§2.3).
 */
const AUTO_MORPH_TIER_LABELS: Record<string, string> = {
  identity: 'Identity (no morph needed)',
  intrinsicStrict: 'Intrinsic strict',
  bestGuess: 'Best guess',
  pointSampled: 'Point-sampled (cross-icon)',
  fallback: 'Fallback (crossfade)',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActivePreview = {
  intentId: string;
  sourceSnapshot: LayerSnapshot;
  targetSnapshot: LayerSnapshot;
  speed: number;
  progress: number;
  playing: boolean;
  resolved: ReturnType<typeof resolveTransition>;
};

const DEBUG_OVERLAY_ENABLED =
  typeof process !== 'undefined' &&
  process.env?.NEXT_PUBLIC_CONTOUR_DEBUG === '1';

// ---------------------------------------------------------------------------
// TransitionPanel — main exported component
// ---------------------------------------------------------------------------

/**
 * TransitionPanel — runtime-resolved icon-to-icon transition preview.
 *
 * Reorganized per docs_canonical/ANIMATE_PANEL_REVAMP_PLAN.md §2 to mirror
 * SF Symbols 7's three-tier hierarchy (Animation → Playback Mode → Timing
 * → Preview). The morph strategy is always `auto` — `autoMorph()` selects
 * the best tier internally — and any manual override lives behind a
 * collapsed "Advanced" disclosure.
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
  // The UI never writes anything but `auto` — see §2.2. A power-user override
  // lives in the Advanced disclosure (§2.3) and only takes effect there.
  const [formDuration, setFormDuration] = useState('240');
  const [formEasing, setFormEasing] = useState<EasingValue>('ease-in-out');
  const [formDirection, setFormDirection] = useState<RuntimeTransitionIntent['direction']>('automatic');
  const [formPlaybackMode, setFormPlaybackMode] = useState<PlaybackMode>('byLayer');

  // --- Advanced disclosure state (§2.3) ---
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [strategyOverride, setStrategyOverride] = useState<RuntimeTransitionIntent['strategy']>('auto');
  const [advancedStaggerOverride, setAdvancedStaggerOverride] =
    useState<TransitionStagger['mode'] | 'inherit'>('inherit');

  // --- Preview state ---
  const [activePreview, setActivePreview] = useState<ActivePreview | null>(null);
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

  // --- Engine readout ---
  // §2.3: the Advanced disclosure shows a read-only "Engine chose" pill so
  // power users can see which tier `autoMorph()` would pick for the first
  // shared layer of the current source/target pair.
  const engineChoseTier = useMemo<string | null>(() => {
    if (!sourceSnapshot || !targetSnapshot) return null;
    const sharedId = Object.keys(sourceSnapshot.layers).find(
      (id) => Boolean(targetSnapshot.layers[id]),
    );
    if (!sharedId) return 'fallback';
    const fromD = sourceSnapshot.layers[sharedId]?.path?.d;
    const toD = targetSnapshot.layers[sharedId]?.path?.d;
    if (!fromD || !toD) return 'fallback';
    const result = autoMorph(fromD, toD);
    return result?.selectedStrategy ?? 'fallback';
  }, [sourceSnapshot, targetSnapshot]);

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

    // §2.2: the UI always writes `auto`; an Advanced override is only honored
    // when the disclosure is open AND the user has actually picked something
    // other than `auto`.
    const effectiveStrategy: RuntimeTransitionIntent['strategy'] =
      advancedOpen && strategyOverride !== 'auto' ? strategyOverride : 'auto';

    // §2.5: map the playback-mode pill to a stagger mode. The Advanced
    // disclosure can still escape into `from-center` / `from-edges` / `random`
    // for power users.
    const baseStaggerMode = PLAYBACK_MODE_TO_STAGGER[formPlaybackMode];
    const effectiveStaggerMode: TransitionStagger['mode'] =
      advancedOpen && advancedStaggerOverride !== 'inherit'
        ? advancedStaggerOverride
        : baseStaggerMode;

    const config: TransitionConfig = {
      id: `preview-${srcIconId}:${srcVariantId}-to-${tgtIconId}:${tgtVariantId}`,
      strategy: effectiveStrategy,
      durationMs,
      easing: formEasing,
      direction: formDirection,
      stagger: {
        mode: effectiveStaggerMode,
        perLayerMs: PLAYBACK_MODE_DEFAULT_STAGGER_MS[formPlaybackMode],
      },
      layerBindings: buildDefaultLayerBindings(sourceSnapshot, targetSnapshot, effectiveStrategy),
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
    advancedOpen,
    advancedStaggerOverride,
    applyPreviewFrame,
    formDirection,
    formDuration,
    formEasing,
    formPlaybackMode,
    setSelectedTransitionId,
    sourceSnapshot,
    srcIconId,
    srcVariantId,
    startScheduler,
    strategyOverride,
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

  // --- Guard ---
  if (!currentIcon || !currentVariant) {
    return null;
  }

  const isPreviewable = sourceSnapshot !== null && targetSnapshot !== null;

  return (
    <section className="grid gap-3">
      {/* Header */}
      <div>
        <p className="text-[length:var(--text-heading)] font-semibold text-foreground">
          Transition
        </p>
        <p className="text-[length:var(--text-label)] text-muted-foreground">
          Pick a target icon — Contour automatically picks the best morph.
        </p>
      </div>

      {/* 1. Animation — source → target endpoints */}
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

      {/* 2. Playback Mode (§2.5) */}
      <div className="grid gap-1.5">
        <Label className="text-[length:var(--text-label)] font-medium tracking-tight text-muted-foreground">
          Playback mode
        </Label>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={formPlaybackMode}
          onValueChange={(value) => {
            if (value) setFormPlaybackMode(value as PlaybackMode);
          }}
          className="h-8 w-full justify-stretch rounded-md border border-border/70"
        >
          {PLAYBACK_MODE_OPTIONS.map((option) => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              aria-label={option.label}
              className="flex-1 text-[length:var(--text-label)]"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-[length:var(--text-caption)] leading-snug text-muted-foreground/70">
          {PLAYBACK_MODE_OPTIONS.find((o) => o.value === formPlaybackMode)?.hint}
        </p>
      </div>

      {/* 3. Timing — duration + easing + direction */}
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <Label className="text-[length:var(--text-label)] font-medium tracking-tight text-muted-foreground">
            Duration (ms)
          </Label>
          <Input
            type="number"
            min="0"
            step="10"
            value={formDuration}
            onChange={(event) => setFormDuration(event.target.value)}
            className="h-8 rounded-lg"
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-[length:var(--text-label)] font-medium tracking-tight text-muted-foreground">
            Easing
          </Label>
          <EasingPicker value={formEasing} onSelect={setFormEasing} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-[length:var(--text-label)] font-medium tracking-tight text-muted-foreground">
          Direction
        </Label>
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

      {/* 4. Preview */}
      <Button
        type="button"
        size="sm"
        onClick={beginPreview}
        disabled={!isPreviewable}
        className="rounded-lg"
      >
        Preview transition
      </Button>
      {/* R6 / UX-3.3: inline guidance when no target is picked yet. */}
      {!isPreviewable ? (
        <p
          className="text-[length:var(--text-caption)] leading-snug text-muted-foreground/70"
          role="status"
        >
          Pick a target icon + variant above to render a preview. You can also
          press <kbd className="rounded-sm border border-border bg-muted px-1 font-mono text-[10px]">⌘K</kbd> to search icons by name.
        </p>
      ) : null}

      {/* 5. Advanced disclosure (§2.3) */}
      <AdvancedDisclosure
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        engineChoseTier={engineChoseTier}
        strategyOverride={strategyOverride}
        onStrategyOverrideChange={setStrategyOverride}
        advancedStaggerOverride={advancedStaggerOverride}
        onAdvancedStaggerOverrideChange={setAdvancedStaggerOverride}
        playbackMode={formPlaybackMode}
      />

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

      {/* §2.4: dev-only debug overlay */}
      {DEBUG_OVERLAY_ENABLED && engineChoseTier ? (
        <div className="rounded-md border border-dashed border-amber-400/60 bg-amber-50/60 px-2 py-1 text-[10px] font-mono text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
          debug · engine: {AUTO_MORPH_TIER_LABELS[engineChoseTier] ?? engineChoseTier}
          {' · '}playback: {formPlaybackMode}
          {advancedOpen && strategyOverride !== 'auto'
            ? ` · override: ${strategyOverride}`
            : ''}
        </div>
      ) : null}
    </section>
  );
});

// ---------------------------------------------------------------------------
// AdvancedDisclosure (§2.3)
// ---------------------------------------------------------------------------

function AdvancedDisclosure({
  open,
  onOpenChange,
  engineChoseTier,
  strategyOverride,
  onStrategyOverrideChange,
  advancedStaggerOverride,
  onAdvancedStaggerOverrideChange,
  playbackMode,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  engineChoseTier: string | null;
  strategyOverride: RuntimeTransitionIntent['strategy'];
  onStrategyOverrideChange: (next: RuntimeTransitionIntent['strategy']) => void;
  advancedStaggerOverride: TransitionStagger['mode'] | 'inherit';
  onAdvancedStaggerOverrideChange: (next: TransitionStagger['mode'] | 'inherit') => void;
  playbackMode: PlaybackMode;
}) {
  return (
    <details
      className="rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 text-[length:var(--text-label)]"
      open={open}
      onToggle={(event) => {
        const next = (event.currentTarget as HTMLDetailsElement).open;
        if (next !== open) onOpenChange(next);
      }}
    >
      <summary className="flex cursor-pointer items-center gap-1 select-none text-muted-foreground hover:text-foreground">
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <span>Advanced</span>
      </summary>
      <div className="mt-2 grid gap-2 px-1">
        <div className="grid gap-1">
          <Label className="text-[10px] font-medium text-muted-foreground">Engine chose</Label>
          <span className="inline-flex w-fit items-center rounded-full bg-muted/50 px-2 py-0.5 font-mono text-[10px] text-foreground/80">
            {engineChoseTier
              ? AUTO_MORPH_TIER_LABELS[engineChoseTier] ?? engineChoseTier
              : 'Select source and target to compute'}
          </span>
        </div>
        <div className="grid gap-1">
          <Label className="text-[10px] font-medium text-muted-foreground">
            Strategy override
          </Label>
          <Select
            value={strategyOverride}
            onValueChange={(v) => onStrategyOverrideChange(v as RuntimeTransitionIntent['strategy'])}
          >
            <SelectTrigger className="h-7 rounded-md text-[length:var(--text-label)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STRATEGY_OVERRIDE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground/70">
            Forced strategies still fall back silently if the paths can&rsquo;t support them.
          </p>
        </div>
        <div className="grid gap-1">
          <Label className="text-[10px] font-medium text-muted-foreground">
            Stagger override
          </Label>
          <Select
            value={advancedStaggerOverride}
            onValueChange={(v) => onAdvancedStaggerOverrideChange(v as TransitionStagger['mode'] | 'inherit')}
          >
            <SelectTrigger className="h-7 rounded-md text-[length:var(--text-label)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">
                Inherit from playback mode ({playbackMode})
              </SelectItem>
              {ADVANCED_STAGGER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </details>
  );
}

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
// Layer binding helper
// ---------------------------------------------------------------------------

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
