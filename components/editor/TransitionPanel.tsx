'use client';

import { Icon as UiIcon } from '@hiero/ui-icons';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toast } from '@/components/ui/use-toast';
import {
  autoMorph,
  interpolateTransitionValues,
  resolveTransition,
  TransitionScheduler,
} from '@/lib/runtime-core';
import { resolveMorph } from '@/lib/runtime-core/cascade';
import type { MorphResolution } from '@/lib/runtime-core/morph-resolution';
import { canonicalizePath } from '@/lib/runtime-core/path-normalization';
import { isResolverV2Enabled } from '@/lib/runtime-core/resolver-flag';
import type { TransitionConfig } from '@/lib/runtime-core/transition-resolver';
import {
  pinSubpath,
  unpinSubpath,
} from '@/lib/editor-store/correspondence-pinning';
import { subpathIdFromIndex } from '@/lib/runtime-core/correspondence-hints';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import type {
  Cadence,
  CorrespondenceHints,
  FallbackName,
  RuntimeTransitionIntent,
  LayerBinding,
  LayerSnapshot,
  TransitionStagger,
} from '@/lib/schema/types';
import { variantToSnapshot } from '@/lib/schema/types';
import { CadenceToggle } from './CadenceToggle';
import { EasingPicker, type EasingValue } from './EasingPicker';
import { FallbackPicker } from './FallbackPicker';
import { FallbackSentence } from './FallbackSentence';

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
export type PlaybackMode = 'byLayer' | 'wholeSymbol' | 'individually';

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
 * Default `perLayerMs` for every stagger mode surfaced by the Animate panel.
 * The three "primary" SF Symbols 7 modes (`linear` / `simultaneous` /
 * `individually`) inherit their defaults from {@link PLAYBACK_MODE_DEFAULT_STAGGER_MS}
 * so the Playback Mode pills stay authoritative. The Advanced disclosure
 * modes (`from-center` / `from-edges` / `random`) always use a non-zero
 * interval — otherwise, flipping an override to one of these while the
 * playback mode is `Whole Symbol` or `Individually` would set
 * `perLayerMs = 0` and produce no visible stagger at all.
 */
export const STAGGER_MODE_DEFAULT_MS: Record<TransitionStagger['mode'], number> = {
  linear: 40,
  simultaneous: 0,
  individually: 0,
  'from-center': 40,
  'from-edges': 40,
  random: 40,
};

/**
 * Pure resolver for the effective `TransitionStagger` — extracted so
 * `tests/transition-stagger-override.test.ts` can assert the PR #128 P2
 * fix (advanced stagger override must always produce a non-zero
 * `perLayerMs` even when the playback mode is `Whole Symbol` or
 * `Individually`).
 */
export function resolveEffectiveStagger(options: {
  playbackMode: PlaybackMode;
  advancedOpen: boolean;
  advancedStaggerOverride: TransitionStagger['mode'] | 'inherit';
}): { mode: TransitionStagger['mode']; perLayerMs: number } {
  const { playbackMode, advancedOpen, advancedStaggerOverride } = options;
  const baseStaggerMode = PLAYBACK_MODE_TO_STAGGER[playbackMode];
  const isOverridden = advancedOpen && advancedStaggerOverride !== 'inherit';
  const mode: TransitionStagger['mode'] = isOverridden
    ? advancedStaggerOverride
    : baseStaggerMode;
  const perLayerMs = isOverridden
    ? STAGGER_MODE_DEFAULT_MS[mode]
    : PLAYBACK_MODE_DEFAULT_STAGGER_MS[playbackMode];
  return { mode, perLayerMs };
}

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
  process.env?.NEXT_PUBLIC_HIERO_DEBUG === '1';

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
  // W4-5 Layer-1 authored axes — cadence + fallbackOverride. These
  // co-exist with the legacy easing/direction during W3-W4 and
  // become the canonical authored values once the V2 cascade flips
  // on (W4-10 / W5 ship-checklist gate). The schema's
  // `Transition.cadence` and `Transition.fallbackOverride` carry
  // them through to the runtime; the legacy fields are
  // `@deprecated W4` in lib/schema/types.ts.
  const [formCadence, setFormCadence] = useState<Cadence>('soft');
  const [formFallbackOverride, setFormFallbackOverride] = useState<
    FallbackName | undefined
  >(undefined);

  // --- Advanced disclosure state (§2.3) ---
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [strategyOverride, setStrategyOverride] = useState<RuntimeTransitionIntent['strategy']>('auto');
  const [advancedStaggerOverride, setAdvancedStaggerOverride] =
    useState<TransitionStagger['mode'] | 'inherit'>('inherit');

  // --- Correspondence pinning state (W4-7 Layer 2) ---
  // Session-local draft of `Transition.correspondenceHints`. The
  // schema field exists for icon-authored Transition persistence,
  // but the editor-store doesn't yet expose transition-authoring
  // actions — for now hints live on the panel and feed
  // `resolveMorph(opts.hints)` directly. Vertex pins (W4-7 canvas
  // drag) and subpath pins (Advanced disclosure UI) both write
  // here through the pure helpers in
  // `lib/editor-store/correspondence-pinning.ts`.
  const [correspondenceHints, setCorrespondenceHints] = useState<CorrespondenceHints>(
    () => ({ subpath: [], vertex: [] }),
  );

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

  // Per-side subpath count for the W4-7 pinning UI. Counted off the
  // primary layer's path (first layer with a `d`) — matches what
  // the cascade picks up at resolve time.
  const sourceSubpathCount = useMemo(
    () => subpathCountOfFirstLayer(sourceSnapshot),
    [sourceSnapshot],
  );
  const targetSubpathCount = useMemo(
    () => subpathCountOfFirstLayer(targetSnapshot),
    [targetSnapshot],
  );

  // --- Engine readout ---
  // §2.3: the Advanced disclosure shows a read-only "Engine chose" pill so
  // power users can see which tier `autoMorph()` picks for the primary
  // layer pair of the current source/target. For cross-icon pairs the
  // layer IDs won't match, so fall back to a positional pairing — picking
  // the first layer on each side — which matches what the resolver's
  // auto-matcher does for the first binding. Previously this readout
  // returned 'fallback' for every cross-icon transition even when the
  // actual preview morphed cleanly.
  const engineChoseTier = useMemo<string | null>(() => {
    if (!sourceSnapshot || !targetSnapshot) return null;
    const fromIds = Object.keys(sourceSnapshot.layers);
    const toIds = Object.keys(targetSnapshot.layers);
    if (fromIds.length === 0 || toIds.length === 0) return 'fallback';
    const sharedId = fromIds.find((id) => Boolean(targetSnapshot.layers[id]));
    const fromId = sharedId ?? fromIds[0]!;
    const toId = sharedId ?? toIds[0]!;
    const fromD = sourceSnapshot.layers[fromId]?.path?.d;
    const toD = targetSnapshot.layers[toId]?.path?.d;
    if (!fromD || !toD) return 'fallback';
    const result = autoMorph(fromD, toD);
    return result?.selectedStrategy ?? 'fallback';
  }, [sourceSnapshot, targetSnapshot]);

  // W4 audit fix: resolve the V2 cascade against the primary layer
  // pair so the FallbackPicker / FallbackSentence reflect the
  // resolver's actual landing tier instead of a hard-coded
  // `radial-pop` placeholder. Gated on the V2 flag — when the flag
  // is off, both stay null and the picker shows the legacy default.
  const morphResolution = useMemo<MorphResolution | null>(() => {
    if (!isResolverV2Enabled()) return null;
    if (!sourceSnapshot || !targetSnapshot) return null;
    const fromIds = Object.keys(sourceSnapshot.layers);
    const toIds = Object.keys(targetSnapshot.layers);
    if (fromIds.length === 0 || toIds.length === 0) return null;
    const sharedId = fromIds.find((id) => Boolean(targetSnapshot.layers[id]));
    const fromId = sharedId ?? fromIds[0]!;
    const toId = sharedId ?? toIds[0]!;
    const fromLayer = sourceSnapshot.layers[fromId];
    const toLayer = targetSnapshot.layers[toId];
    if (!fromLayer?.path?.d || !toLayer?.path?.d) return null;
    try {
      return resolveMorph(fromLayer, toLayer, {
        cadence: formCadence,
        hints: correspondenceHints,
      });
    } catch {
      return null;
    }
  }, [sourceSnapshot, targetSnapshot, formCadence, correspondenceHints]);

  // Derive the picker's "auto" suggestion from the cascade signal:
  // `designed-fallback` carries an explicit `fallbackName`; any other
  // tier means the cascade morphed without falling through, so the
  // pre-V2 default of `radial-pop` is the right placeholder for the
  // "if you opted out of auto-morph, here's the next-best motion"
  // affordance.
  const resolverPickedFallback: FallbackName =
    morphResolution?.signal &&
    'fallbackName' in morphResolution.signal &&
    morphResolution.signal.fallbackName
      ? morphResolution.signal.fallbackName
      : 'radial-pop';

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
    // disclosure can still escape into `from-center` / `from-edges` /
    // `random` for power users. When an Advanced stagger override is
    // active, `resolveEffectiveStagger` derives `perLayerMs` from the
    // *effective* stagger mode rather than from the playback-mode default,
    // otherwise picking `from-center` while playback is `Whole Symbol`
    // (default `perLayerMs = 0`) would collapse the override into a
    // simultaneous start — see PR #128 P2 feedback.
    const staggerConfig = resolveEffectiveStagger({
      playbackMode: formPlaybackMode,
      advancedOpen,
      advancedStaggerOverride,
    });

    const config: TransitionConfig = {
      id: `preview-${srcIconId}:${srcVariantId}-to-${tgtIconId}:${tgtVariantId}`,
      strategy: effectiveStrategy,
      durationMs,
      easing: formEasing,
      direction: formDirection,
      stagger: staggerConfig,
      layerBindings: buildDefaultLayerBindings(
        sourceSnapshot,
        targetSnapshot,
        effectiveStrategy,
        { isCrossIcon: Boolean(srcIconId && tgtIconId && srcIconId !== tgtIconId) },
      ),
    };

    let resolved: ReturnType<typeof resolveTransition>;
    try {
      resolved = resolveTransition(config, sourceSnapshot, targetSnapshot, {
        // Tell the resolver this is a cross-icon transition when source
        // and target come from different icons; this engages the 3-pass
        // role/name/geometry matcher in resolveBindings instead of the
        // same-icon readiness-only path.
        crossIconContext:
          srcIconId && tgtIconId && srcIconId !== tgtIconId
            ? {
                sourceIconId: srcIconId,
                targetIconId: tgtIconId,
                sourceVariantId: srcVariantId,
                targetVariantId: tgtVariantId,
              }
            : undefined,
      });
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
          Pick a target icon — Hiero automatically picks the best morph.
        </p>
      </div>

      {/* 1. Animation — source → target endpoints (stacked so each has full
          panel width and inputs are not cropped in narrow side panels). */}
      <div className="flex flex-col items-stretch gap-2">
        <LockedSourceEndpoint
          iconName={currentIcon.name}
          variants={srcVariants}
          selectedVariantId={srcVariantId}
          onVariantChange={setSrcVariantId}
        />
        <div
          aria-hidden="true"
          className="mx-auto flex size-6 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground"
        >
          <UiIcon name="arrow-right" size={14} className="size-3.5 rotate-90" />
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

      {/* 3. Timing — duration + easing + direction
          Stacked vertically so the easing trigger has the full panel width
          and never crops in the inspector column. */}
      <div className="grid gap-3">
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
          <EasingPicker
            value={formEasing}
            onSelect={setFormEasing}
            className="w-full"
            triggerClassName="h-8 w-full justify-start rounded-lg"
          />
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

      {/* 3.5 Cadence + Fallback (W4-5 Layer-1 authored axes).
          These persist to Transition.cadence and
          Transition.fallbackOverride. They co-exist with the
          legacy Easing/Direction during W3-W4 and become
          canonical once the V2 cascade flips on (W4-10). The
          plain-language fallback sentence renders only when
          the resolver lands on a fallback tier — until the V2
          cascade is wired into the preview path, the sentence
          stays null on the legacy resolver. */}
      <div className="grid gap-1.5">
        <Label className="text-[length:var(--text-label)] font-medium tracking-tight text-muted-foreground">
          Cadence
        </Label>
        <CadenceToggle value={formCadence} onChange={setFormCadence} />
        <p className="text-[length:var(--text-caption)] leading-snug text-muted-foreground/70">
          Soft eases in and out; Snappy lands faster.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-[length:var(--text-label)] font-medium tracking-tight text-muted-foreground">
          Fallback motion
        </Label>
        <FallbackPicker
          resolverPicked={resolverPickedFallback}
          override={formFallbackOverride}
          onChange={setFormFallbackOverride}
        />
        <FallbackSentence resolution={morphResolution} />
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
        correspondenceHints={correspondenceHints}
        onCorrespondenceHintsChange={setCorrespondenceHints}
        sourceSubpathCount={sourceSubpathCount}
        targetSubpathCount={targetSubpathCount}
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
  correspondenceHints,
  onCorrespondenceHintsChange,
  sourceSubpathCount,
  targetSubpathCount,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  engineChoseTier: string | null;
  strategyOverride: RuntimeTransitionIntent['strategy'];
  onStrategyOverrideChange: (next: RuntimeTransitionIntent['strategy']) => void;
  advancedStaggerOverride: TransitionStagger['mode'] | 'inherit';
  onAdvancedStaggerOverrideChange: (next: TransitionStagger['mode'] | 'inherit') => void;
  playbackMode: PlaybackMode;
  correspondenceHints: CorrespondenceHints;
  onCorrespondenceHintsChange: (next: CorrespondenceHints) => void;
  sourceSubpathCount: number;
  targetSubpathCount: number;
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
        {open ? <UiIcon name="chevron-down" size={12} className="size-3" /> : <UiIcon name="chevron-right" size={12} className="size-3" />}
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
        <SubpathPinsSection
          hints={correspondenceHints}
          onChange={onCorrespondenceHintsChange}
          sourceSubpathCount={sourceSubpathCount}
          targetSubpathCount={targetSubpathCount}
        />
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
          {preview.playing ? <UiIcon name="pause" size={16} className="size-4" /> : <UiIcon name="play" size={16} className="size-4" />}
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          className="rounded-lg"
          onClick={onRestart}
        >
          <UiIcon name="rotate-ccw" size={16} className="size-4" />
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
  options: { isCrossIcon: boolean } = { isCrossIcon: false },
): LayerBinding[] {
  const fromIds = Object.keys(fromSnapshot.layers);
  const toIds = Object.keys(toSnapshot.layers);

  // Auto strategy is context-sensitive:
  //
  //   • Cross-icon previews: IDs almost never match, so pre-pairing by
  //     ID dumps every layer into a one-sided 'removed' / 'added'
  //     binding. The resolver short-circuits one-sided bindings at the
  //     `if (!fromD || !toD)` guard to fade-in / fade-out, which is
  //     exactly the false-positive crossfade we had to eliminate.
  //     Returning `[]` here lets resolveBindings run its 3-pass
  //     cross-icon matcher (role → name → geometry/readiness).
  //
  //   • Same-icon previews (variant → variant): preserve stable-ID
  //     pairing. Two layers that intentionally keep their IDs across
  //     variants must animate identity-to-identity, not swap via a
  //     geometry-based readiness match. E.g. if layers `a` and `b`
  //     trade positions in the target variant, we want `a→a` / `b→b`,
  //     not `a→b` / `b→a`.
  if (strategy === 'auto') {
    if (options.isCrossIcon) {
      return [];
    }
    const toIdSet = new Set(toIds);
    const fromIdSet = new Set(fromIds);
    const bindings: LayerBinding[] = [];
    for (const id of fromIds) {
      if (toIdSet.has(id)) {
        bindings.push({ fromLayerId: id, toLayerId: id });
      }
    }
    for (const id of fromIds) {
      if (!toIdSet.has(id)) {
        bindings.push({ fromLayerId: id, toLayerId: undefined });
      }
    }
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

// ---------------------------------------------------------------------------
// W4-7 subpath-pinning helpers
// ---------------------------------------------------------------------------

function subpathCountOfFirstLayer(snapshot: LayerSnapshot | null): number {
  if (!snapshot) return 0;
  for (const layer of Object.values(snapshot.layers)) {
    if (!layer.path?.d) continue;
    return canonicalizePath(layer.path.d).stats.subpathCount;
  }
  return 0;
}

/**
 * Subpath-pinning section for the Advanced disclosure. Renders two
 * dropdowns (from-subpath, to-subpath) plus a list of pinned pairs
 * as removable chips. Hides itself when neither side has more than
 * one subpath — single-subpath pairs have nothing to pin and would
 * just add noise. Vertex-level pinning lands in Stage C via canvas
 * drag.
 */
function SubpathPinsSection({
  hints,
  onChange,
  sourceSubpathCount,
  targetSubpathCount,
}: {
  hints: CorrespondenceHints;
  onChange: (next: CorrespondenceHints) => void;
  sourceSubpathCount: number;
  targetSubpathCount: number;
}) {
  const [draftFromIdx, setDraftFromIdx] = useState<number>(0);
  const [draftToIdx, setDraftToIdx] = useState<number>(0);

  if (sourceSubpathCount < 2 && targetSubpathCount < 2) return null;

  const sourceOptions = Array.from({ length: sourceSubpathCount }, (_, i) => i);
  const targetOptions = Array.from({ length: targetSubpathCount }, (_, i) => i);

  const handleAdd = () => {
    if (
      draftFromIdx < 0 ||
      draftFromIdx >= sourceSubpathCount ||
      draftToIdx < 0 ||
      draftToIdx >= targetSubpathCount
    ) {
      return;
    }
    const next = pinSubpath(
      hints,
      subpathIdFromIndex(draftFromIdx),
      subpathIdFromIndex(draftToIdx),
    );
    onChange(next);
  };

  const handleRemove = (fromId: string) => {
    onChange(unpinSubpath(hints, fromId));
  };

  return (
    <div className="grid gap-1">
      <Label className="text-[10px] font-medium text-muted-foreground">
        Subpath pins
      </Label>
      <p className="text-[10px] text-muted-foreground/70">
        Force a source subpath to pair with a target subpath.
        Overrides automatic geometry-based matching.
      </p>
      <div className="flex items-center gap-1">
        <Select
          value={String(draftFromIdx)}
          onValueChange={(v) => setDraftFromIdx(Number.parseInt(v, 10))}
        >
          <SelectTrigger
            aria-label="Source subpath"
            className="h-7 flex-1 rounded-md text-[length:var(--text-label)]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sourceOptions.map((i) => (
              <SelectItem key={i} value={String(i)}>
                Source #{i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span aria-hidden className="text-[10px] text-muted-foreground">↔</span>
        <Select
          value={String(draftToIdx)}
          onValueChange={(v) => setDraftToIdx(Number.parseInt(v, 10))}
        >
          <SelectTrigger
            aria-label="Target subpath"
            className="h-7 flex-1 rounded-md text-[length:var(--text-label)]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {targetOptions.map((i) => (
              <SelectItem key={i} value={String(i)}>
                Target #{i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 rounded-md px-2 text-[10px]"
          onClick={handleAdd}
        >
          Pin
        </Button>
      </div>
      {hints.subpath.length > 0 ? (
        <ul className="flex flex-wrap gap-1 pt-1">
          {hints.subpath.map(([fromId, toId]) => (
            <li
              key={`${fromId}->${toId}`}
              className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-foreground/80"
            >
              <span>{shortSubpathId(fromId)} ↔ {shortSubpathId(toId)}</span>
              <button
                type="button"
                aria-label={`Remove pin ${fromId} ↔ ${toId}`}
                onClick={() => handleRemove(fromId)}
                className="ml-0.5 rounded-full px-1 leading-none text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function shortSubpathId(id: string): string {
  // `subpath:N` → `#N`. Anything else passes through verbatim so a
  // future hint vocabulary doesn't silently lose information here.
  const match = /^subpath:(\d+)$/.exec(id);
  return match ? `#${match[1]}` : id;
}
