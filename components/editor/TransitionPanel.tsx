'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Pause, Play, RotateCcw, Trash2, WandSparkles } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/kibo-ui/button';
import { Input } from '@/components/kibo-ui/input';
import { Label } from '@/components/kibo-ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/kibo-ui/select';
import { Slider } from '@/components/kibo-ui/slider';
import { Switch } from '@/components/kibo-ui/switch';
import { toast } from '@/components/ui/use-toast';
import { bestGuessMorph, interpolateTransitionValues, resolveTransition, strictMorph, TransitionScheduler, computeReadiness, canonicalizeLayerPath, classifySubPathStrategies } from '@/lib/runtime-core';
import type { MorphReadiness } from '@/lib/runtime-core/transition-resolver';
import type { SubPathStrategyResult } from '@/lib/runtime-core/topology-detection';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import type { Icon, Transition, TransitionEndpoint, LayerBinding, Layer, State, TransitionStagger, StateTrigger, Variant } from '@/lib/schema/types';
import { EasingPicker, type EasingValue } from './EasingPicker';
import { cn } from '@/lib/utils';

const SPEED_OPTIONS = [0.25, 0.5, 1, 2] as const;

const TRIGGER_EVENTS: StateTrigger['event'][] = ['hover', 'tap', 'longPress', 'focus', 'auto'];

const STAGGER_MODES: TransitionStagger['mode'][] = ['linear', 'from-center', 'from-edges', 'random', 'individually'];

const DIRECTION_OPTIONS: Array<{ value: Transition['direction']; label: string }> = [
  { value: 'automatic', label: 'Automatic' },
  { value: 'downUp', label: 'Down → Up' },
  { value: 'upUp', label: 'Up → Up' },
  { value: 'offUp', label: 'Off → Up' },
];

type TransitionMode = 'intra-variant' | 'cross-icon';

type CompatibilityStatus =
  | { tone: 'green'; label: 'Compatible' }
  | { tone: 'yellow'; label: 'Best Guess' }
  | { tone: 'red'; label: 'Incompatible — will crossfade' };

type ActivePreview = {
  transitionId: string;
  baseStateId: string;
  targetStateId: string;
  originalStateId: string;
  speed: number;
  progress: number;
  playing: boolean;
  resolved: ReturnType<typeof resolveTransition>;
};

export const TransitionPanel = memo(function TransitionPanel() {
  const currentIcon = useEditorStore((s) =>
    s.currentIconId ? s.project?.icons[s.currentIconId] ?? null : null,
  );
  const currentVariant = useEditorStore((s) =>
    s.currentIconId && s.currentVariantId
      ? s.project?.icons[s.currentIconId]?.variants[s.currentVariantId] ?? null
      : null,
  );
  const currentStateId = useEditorStore((s) => s.currentStateId);
  const {
    addTransition,
    patchTransition,
    removeTransition,
    setTransitionPreview,
    setSelectedTransitionId,
  } = useEditorActions();
  const projectIcons = useEditorStore((s) => s.project?.icons ?? null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formMode, setFormMode] = useState<TransitionMode>('intra-variant');
  const [formFrom, setFormFrom] = useState('');
  const [formTo, setFormTo] = useState('');
  const [formStrategy, setFormStrategy] = useState<Transition['strategy']>('bestGuessMorph');
  const [formDuration, setFormDuration] = useState('240');
  const [formEasing, setFormEasing] = useState<EasingValue>('ease-in-out');
  const [formDirection, setFormDirection] = useState<Transition['direction']>('automatic');

  // Cross-icon endpoint state
  const [srcIconId, setSrcIconId] = useState('');
  const [srcVariantId, setSrcVariantId] = useState('');
  const [srcStateId, setSrcStateId] = useState('');
  const [tgtIconId, setTgtIconId] = useState('');
  const [tgtVariantId, setTgtVariantId] = useState('');
  const [tgtStateId, setTgtStateId] = useState('');

  const [activePreview, setActivePreview] = useState<ActivePreview | null>(null);
  const [expandedBindings, setExpandedBindings] = useState<Set<string>>(new Set());
  const [deleteTransitionId, setDeleteTransitionId] = useState<string | null>(null);

  // UX-F10: Collapsible section state per transition
  const [collapsedSections, setCollapsedSections] = useState<Record<string, Set<string>>>({});
  const schedulerRef = useRef<TransitionScheduler | null>(null);

  // Cross-icon: derived lists for source and target endpoint pickers
  const iconEntries = useMemo(
    () => Object.values(projectIcons ?? {}).map((icon) => ({ id: icon.id, name: icon.name })),
    [projectIcons],
  );
  const srcVariants = useMemo(
    () => (srcIconId && projectIcons?.[srcIconId] ? Object.values(projectIcons[srcIconId].variants) : []),
    [projectIcons, srcIconId],
  );
  const srcStates = useMemo(
    () => (srcIconId && srcVariantId && projectIcons?.[srcIconId]?.variants[srcVariantId]
      ? Object.keys(projectIcons[srcIconId].variants[srcVariantId].states)
      : []),
    [projectIcons, srcIconId, srcVariantId],
  );
  const tgtVariants = useMemo(
    () => (tgtIconId && projectIcons?.[tgtIconId] ? Object.values(projectIcons[tgtIconId].variants) : []),
    [projectIcons, tgtIconId],
  );
  const tgtStates = useMemo(
    () => (tgtIconId && tgtVariantId && projectIcons?.[tgtIconId]?.variants[tgtVariantId]
      ? Object.keys(projectIcons[tgtIconId].variants[tgtVariantId].states)
      : []),
    [projectIcons, tgtIconId, tgtVariantId],
  );

  const stateIds = useMemo(
    () => Object.keys(currentVariant?.states ?? {}),
    [currentVariant],
  );
  const transitions = useMemo(
    () =>
      Object.values(currentIcon?.transitions ?? {}).sort((a, b) => a.id.localeCompare(b.id)),
    [currentIcon],
  );
  const compatibilityById = useMemo(() => {
    const map = new Map<string, CompatibilityStatus>();
    if (!currentVariant) return map;

    for (const transition of transitions) {
      if (transition.strategy !== 'strictMorph' && transition.strategy !== 'bestGuessMorph') {
        continue;
      }
      const fromState = currentVariant.states[transition.from];
      const toState = currentVariant.states[transition.to];
      if (!fromState || !toState) {
        map.set(transition.id, { tone: 'red', label: 'Incompatible — will crossfade' });
        continue;
      }
      map.set(transition.id, getCompatibilityStatus(transition, fromState, toState));
    }

    return map;
  }, [currentVariant, transitions]);

  useEffect(() => {
    if (!isAddOpen || stateIds.length === 0) return;
    const fallbackFrom = currentStateId && stateIds.includes(currentStateId) ? currentStateId : stateIds[0]!;
    const fallbackTo = stateIds.find((stateId) => stateId !== fallbackFrom) ?? fallbackFrom;
    setFormFrom((current) => current || fallbackFrom);
    setFormTo((current) => current || fallbackTo);
  }, [currentStateId, isAddOpen, stateIds]);

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
        transitionId: preview.transitionId,
        baseStateId: preview.baseStateId,
        targetStateId: preview.targetStateId,
        progress,
        resolvedTransition: preview.resolved,
        interpolatedValues: interpolateTransitionValues(preview.resolved, progress),
      });
      setActivePreview((current) =>
        current?.transitionId === preview.transitionId
          ? { ...current, progress }
          : current,
      );
    },
    [setTransitionPreview],
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
          onFrame: (progress) => {
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

  const beginPreview = useCallback(
    (transition: Transition) => {
      if (!currentIcon || !currentVariant || !currentStateId) return;
      if (currentStateId !== transition.from && currentStateId !== transition.to) return;

      const fromState = currentVariant.states[transition.from];
      const toState = currentVariant.states[transition.to];
      if (!fromState || !toState) {
        toast({
          title: 'Preview unavailable',
          description: 'This transition references a missing state.',
        });
        return;
      }

      let resolved: ReturnType<typeof resolveTransition>;
      try {
        resolved = resolveTransition(transition, fromState, toState);
      } catch (error) {
        toast({
          title: 'Preview failed',
          description:
            error instanceof Error ? error.message : 'Transition could not be resolved.',
        });
        return;
      }

      const nextPreview: ActivePreview = {
        transitionId: transition.id,
        baseStateId: transition.from,
        targetStateId: transition.to,
        originalStateId: currentStateId,
        speed: activePreview?.transitionId === transition.id ? activePreview.speed : 1,
        progress: 0,
        playing: true,
        resolved,
      };

      setSelectedTransitionId(transition.id);
      setActivePreview(nextPreview);
      applyPreviewFrame(nextPreview, 0);
      startScheduler(nextPreview, 0, nextPreview.speed);
    },
    [
      activePreview?.speed,
      activePreview?.transitionId,
      applyPreviewFrame,
      currentIcon,
      currentStateId,
      currentVariant,
      setSelectedTransitionId,
      startScheduler,
    ],
  );

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

  useEffect(() => {
    if (!activePreview || !currentVariant || !currentStateId) return;
    if (
      !currentVariant.states[activePreview.baseStateId] ||
      !currentVariant.states[activePreview.targetStateId] ||
      (currentStateId !== activePreview.originalStateId &&
        currentStateId !== activePreview.baseStateId &&
        currentStateId !== activePreview.targetStateId)
    ) {
      clearPreview();
      setActivePreview(null);
    }
  }, [activePreview, clearPreview, currentStateId, currentVariant]);

  const handleRemoveTransition = useCallback(
    (transitionId: string) => {
      if (!currentIcon) return;
      if (activePreview?.transitionId === transitionId) {
        clearPreview();
        setActivePreview(null);
      }
      removeTransition(currentIcon.id, transitionId);
      setSelectedTransitionId(null);
    },
    [activePreview?.transitionId, clearPreview, currentIcon, removeTransition, setSelectedTransitionId],
  );

  const handleAddTransition = useCallback(() => {
    if (!currentIcon) return;
    const durationMs = Number.parseInt(formDuration, 10);
    if (!Number.isFinite(durationMs) || durationMs < 0) return;

    if (formMode === 'cross-icon') {
      // Cross-icon transition
      if (!srcIconId || !srcVariantId || !srcStateId || !tgtIconId || !tgtVariantId || !tgtStateId) return;
      if (srcIconId === tgtIconId && srcVariantId === tgtVariantId && srcStateId === tgtStateId) return;

      const fromEndpoint: TransitionEndpoint = { iconId: srcIconId, variantId: srcVariantId, stateId: srcStateId };
      const toEndpoint: TransitionEndpoint = { iconId: tgtIconId, variantId: tgtVariantId, stateId: tgtStateId };

      // Resolve states for layer bindings
      const fromState = projectIcons?.[srcIconId]?.variants[srcVariantId]?.states[srcStateId];
      const toState = projectIcons?.[tgtIconId]?.variants[tgtVariantId]?.states[tgtStateId];

      const newTransition: Transition = {
        id: `${srcIconId}:${srcStateId}-to-${tgtIconId}:${tgtStateId}`,
        from: srcStateId,
        to: tgtStateId,
        fromEndpoint,
        toEndpoint,
        strategy: formStrategy,
        durationMs,
        easing: formEasing,
        layerBindings: fromState && toState ? buildDefaultLayerBindings(fromState, toState, formStrategy) : [],
        ...(formStrategy === 'replace' && formDirection ? { direction: formDirection } : {}),
      };

      addTransition(currentIcon.id, newTransition);
    } else {
      // Intra-variant transition (original behavior)
      if (!currentVariant) return;
      if (!formFrom || !formTo || formFrom === formTo) return;

      const fromState = currentVariant.states[formFrom];
      const toState = currentVariant.states[formTo];
      if (!fromState || !toState) return;

      addTransition(currentIcon.id, {
        id: `${formFrom}-to-${formTo}`,
        from: formFrom,
        to: formTo,
        strategy: formStrategy,
        durationMs,
        easing: formEasing,
        layerBindings: buildDefaultLayerBindings(fromState, toState, formStrategy),
        ...(formStrategy === 'replace' && formDirection ? { direction: formDirection } : {}),
      });
    }

    setIsAddOpen(false);
    setFormDuration('240');
    setFormDirection('automatic');
  }, [
    addTransition,
    currentIcon,
    currentVariant,
    formDirection,
    formDuration,
    formEasing,
    formFrom,
    formMode,
    formStrategy,
    formTo,
    projectIcons,
    srcIconId,
    srcStateId,
    srcVariantId,
    tgtIconId,
    tgtStateId,
    tgtVariantId,
  ]);

  const toggleBindingExpand = useCallback((transitionId: string) => {
    setExpandedBindings((prev) => {
      const next = new Set(prev);
      if (next.has(transitionId)) {
        next.delete(transitionId);
      } else {
        next.add(transitionId);
      }
      return next;
    });
  }, []);

  // UX-F10: Toggle collapsible section within a transition card
  const isSectionCollapsed = useCallback(
    (transitionId: string, section: string) => {
      return collapsedSections[transitionId]?.has(section) ?? false;
    },
    [collapsedSections],
  );

  const toggleSection = useCallback(
    (transitionId: string, section: string) => {
      setCollapsedSections((prev) => {
        const current = new Set(prev[transitionId] ?? []);
        if (current.has(section)) {
          current.delete(section);
        } else {
          current.add(section);
        }
        return { ...prev, [transitionId]: current };
      });
    },
    [],
  );

  if (!currentIcon || !currentVariant) {
    return null;
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Transitions</p>
          <p className="text-xs text-muted-foreground">
            Preview and manage state changes for this icon.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-xl"
          onClick={() => setIsAddOpen((value) => !value)}
        >
          <WandSparkles className="size-4" />
          Add Transition
        </Button>
      </div>

      {isAddOpen ? (
        <div className="grid gap-3 rounded-xl border border-dashed border-border/70 bg-muted/15 p-3">
          {/* Mode toggle: Intra-Variant / Cross-Icon */}
          <div className="flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5">
            {(['intra-variant', 'cross-icon'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={cn(
                  'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  formMode === mode
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setFormMode(mode)}
              >
                {mode === 'intra-variant' ? 'Intra-Variant' : 'Cross-Icon'}
              </button>
            ))}
          </div>

          {formMode === 'intra-variant' ? (
            /* Intra-variant: original From/To state pickers */
            <div className="grid grid-cols-2 gap-2">
              <FieldSelect
                label="From"
                value={formFrom}
                onChange={setFormFrom}
                options={stateIds}
              />
              <FieldSelect
                label="To"
                value={formTo}
                onChange={setFormTo}
                options={stateIds}
              />
            </div>
          ) : (
            /* Cross-icon: Source and Target endpoint pickers */
            <div className="grid gap-3">
              <CrossIconEndpointPicker
                label="Source"
                iconEntries={iconEntries}
                selectedIconId={srcIconId}
                onIconChange={(id) => { setSrcIconId(id); setSrcVariantId(''); setSrcStateId(''); }}
                variants={srcVariants}
                selectedVariantId={srcVariantId}
                onVariantChange={(id) => { setSrcVariantId(id); setSrcStateId(''); }}
                stateIds={srcStates}
                selectedStateId={srcStateId}
                onStateChange={setSrcStateId}
              />
              <CrossIconEndpointPicker
                label="Target"
                iconEntries={iconEntries}
                selectedIconId={tgtIconId}
                onIconChange={(id) => { setTgtIconId(id); setTgtVariantId(''); setTgtStateId(''); }}
                variants={tgtVariants}
                selectedVariantId={tgtVariantId}
                onVariantChange={(id) => { setTgtVariantId(id); setTgtStateId(''); }}
                stateIds={tgtStates}
                selectedStateId={tgtStateId}
                onStateChange={setTgtStateId}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <FieldSelect
              label="Strategy"
              value={formStrategy}
              onChange={(value) => setFormStrategy(value as Transition['strategy'])}
              options={['track', 'strictMorph', 'bestGuessMorph', 'replace']}
            />
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Easing</Label>
              <EasingPicker value={formEasing} onSelect={setFormEasing} />
            </div>
          </div>

          {/* Direction selector — only for replace strategy */}
          {formStrategy === 'replace' && (
            <FieldSelect
              label="Direction"
              value={formDirection ?? 'automatic'}
              onChange={(value) => setFormDirection(value as Transition['direction'])}
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
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleAddTransition}
              disabled={
                formMode === 'intra-variant'
                  ? !formFrom || !formTo || formFrom === formTo
                  : !srcIconId || !srcVariantId || !srcStateId || !tgtIconId || !tgtVariantId || !tgtStateId
              }
              className="rounded-xl"
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={() => setIsAddOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {transitions.length === 0 ? (
        <div className="workspace-empty-state rounded-2xl px-4 py-5 text-left">
          <p className="text-sm font-medium text-foreground">No transitions yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add one to preview motion between states.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {transitions.map((transition) => {
            const isPreviewable =
              currentStateId === transition.from || currentStateId === transition.to;
            const compatibility = compatibilityById.get(transition.id);
            const isActive = activePreview?.transitionId === transition.id;
            const isBindingsExpanded = expandedBindings.has(transition.id);
            const [transitionFromState, transitionToState] = resolveTransitionStates(
              transition,
              currentVariant,
              projectIcons,
            );

            return (
              <div
                key={transition.id}
                onClick={() => setSelectedTransitionId(transition.id)}
                className={cn(
                  'rounded-xl border border-border/70 bg-background/70 p-3',
                  isActive && 'border-primary/30 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_18%,transparent)]',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {transition.from} -&gt; {transition.to}
                    </p>
                    {transition.fromEndpoint || transition.toEndpoint ? (
                      <p className="mt-0.5 text-[10px] font-medium text-primary/70">Cross-Icon</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {transition.strategy} • {transition.durationMs}ms
                      {transition.direction && transition.strategy === 'replace'
                        ? ` • ${transition.direction}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        !isPreviewable ||
                        (transition.strategy === 'strictMorph' && compatibility?.tone === 'red')
                      }
                      onClick={() => beginPreview(transition)}
                      className="rounded-xl"
                    >
                      Preview
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="rounded-xl text-muted-foreground hover:text-foreground"
                      onClick={() => setDeleteTransitionId(transition.id)}
                      aria-label={`Remove ${transition.id}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {compatibility ? <CompatibilityBadge status={compatibility} /> : null}

                {/* UX-F10: Collapsible "Configuration" section */}
                <CollapsibleSection
                  title="Configuration"
                  subtitle={`${transition.strategy} / ${transition.durationMs}ms`}
                  collapsed={isSectionCollapsed(transition.id, 'config')}
                  onToggle={() => toggleSection(transition.id, 'config')}
                >
                  <div className="grid grid-cols-2 gap-2">
                    <InlineSelect
                      label="Strategy"
                      value={transition.strategy}
                      onChange={(value) => {
                        const nextStrategy = value as Transition['strategy'];
                        patchTransition(currentIcon.id, transition.id, {
                          strategy: nextStrategy,
                          ...(transitionFromState && transitionToState
                            ? {
                                layerBindings: buildDefaultLayerBindings(
                                  transitionFromState,
                                  transitionToState,
                                  nextStrategy,
                                ),
                              }
                            : {}),
                        });
                      }}
                      options={['track', 'strictMorph', 'bestGuessMorph', 'replace']}
                    />
                    <div className="grid gap-1.5">
                      <Label className="text-[length:var(--text-label)] uppercase text-muted-foreground">Easing</Label>
                      <EasingPicker
                        value={transition.easing ?? 'linear'}
                        onSelect={(value) =>
                          patchTransition(currentIcon.id, transition.id, { easing: value })
                        }
                      />
                    </div>
                  </div>

                  {/* Direction selector — only for replace strategy */}
                  {transition.strategy === 'replace' && (
                    <div className="mt-2">
                      <InlineSelect
                        label="Direction"
                        value={transition.direction ?? 'automatic'}
                        onChange={(value) =>
                          patchTransition(currentIcon.id, transition.id, {
                            direction: value as Transition['direction'],
                          })
                        }
                        options={DIRECTION_OPTIONS.map((d) => d.value!)}
                      />
                    </div>
                  )}

                  <div className="mt-2 grid gap-1.5">
                    <Label className="text-[length:var(--text-label)] uppercase text-muted-foreground">
                      Duration
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="10"
                      value={transition.durationMs}
                      onChange={(event) =>
                        patchTransition(currentIcon.id, transition.id, {
                          durationMs: Math.max(Number.parseInt(event.target.value, 10) || 0, 0),
                        })
                      }
                    />
                  </div>
                </CollapsibleSection>

                {/* UX-F10: Collapsible "Stagger" section */}
                <CollapsibleSection
                  title="Stagger"
                  subtitle={transition.stagger ? `${transition.stagger.mode}` : 'Off'}
                  collapsed={isSectionCollapsed(transition.id, 'stagger')}
                  onToggle={() => toggleSection(transition.id, 'stagger')}
                >
                  <StaggerControls
                    transition={transition}
                    onPatch={(patch) => patchTransition(currentIcon.id, transition.id, patch)}
                  />
                </CollapsibleSection>

                {/* UX-F10: Collapsible "Triggers" section */}
                <CollapsibleSection
                  title="Triggers"
                  subtitle={transition.triggers?.length ? `${transition.triggers.length} trigger(s)` : 'None'}
                  collapsed={isSectionCollapsed(transition.id, 'triggers')}
                  onToggle={() => toggleSection(transition.id, 'triggers')}
                >
                  <TriggerEditor
                    triggers={transition.triggers}
                    onChange={(triggers) =>
                      patchTransition(currentIcon.id, transition.id, { triggers })
                    }
                  />
                </CollapsibleSection>

                {/* UX-F10: Collapsible "Layer Bindings" section */}
                <CollapsibleSection
                  title={`Layer Bindings (${transition.layerBindings.length})`}
                  collapsed={!isBindingsExpanded}
                  onToggle={() => { toggleBindingExpand(transition.id); }}
                >
                  <LayerBindingList
                    transition={transition}
                    fromState={transitionFromState}
                    toState={transitionToState}
                    onPatchTransition={(patch) =>
                      patchTransition(currentIcon.id, transition.id, patch)
                    }
                  />
                </CollapsibleSection>

                {!isPreviewable ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Preview is available only when the current state is {transition.from} or {transition.to}.
                  </p>
                ) : null}

                {isActive ? (
                  <div className="mt-3 grid gap-2 rounded-xl border border-border/70 bg-muted/15 p-3">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={handleTogglePlayback}
                      >
                        {activePreview?.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
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
                          value={[Math.round((activePreview?.progress ?? 0) * 100)]}
                          onValueChange={([v]) => handleScrub(v / 100)}
                          className="w-full"
                        />
                      </div>
                      <Select value={String(activePreview?.speed ?? 1)} onValueChange={(v) => handleSpeedChange(Number.parseFloat(v))}>
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
                      {Math.round((activePreview?.progress ?? 0) * 100)}%
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      <AlertDialog open={deleteTransitionId !== null} onOpenChange={(open) => !open && setDeleteTransitionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transition</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTransitionId
                ? `Delete the ${deleteTransitionId} transition? Any timing, easing, and layer bindings configured for it will be removed.`
                : 'Delete this transition?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTransitionId) {
                  handleRemoveTransition(deleteTransitionId);
                  setDeleteTransitionId(null);
                }
              }}
            >
              Delete transition
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
});

// --- C4: Stagger Controls ---

// UX-F10: Reusable collapsible section with smooth toggle
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

function StaggerControls({
  transition,
  onPatch,
}: {
  transition: Transition;
  onPatch: (patch: Partial<Transition>) => void;
}) {
  const stagger = transition.stagger;
  const [enabled, setEnabled] = useState(!!stagger);

  return (
    <div className="mt-2 grid gap-1.5">
      <div className="flex items-center gap-2">
        <Label className="text-[length:var(--text-label)] uppercase text-muted-foreground">Stagger</Label>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => {
            setEnabled(checked);
            if (!checked) {
              onPatch({ stagger: undefined });
            } else {
              onPatch({
                stagger: { mode: 'linear', perLayerMs: 40 },
              });
            }
          }}
        />
      </div>
      {enabled && stagger ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label className="text-[length:var(--text-caption)] text-muted-foreground">Mode</Label>
            <Select value={stagger.mode} onValueChange={(v) => onPatch({ stagger: { ...stagger, mode: v as TransitionStagger['mode'] } })}>
              <SelectTrigger className="h-7 rounded-lg text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGGER_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-[length:var(--text-caption)] text-muted-foreground">Per Layer (ms)</Label>
            <Input
              type="number"
              min="0"
              step="5"
              value={stagger.perLayerMs}
              className="h-7 text-xs"
              onChange={(e) =>
                onPatch({
                  stagger: {
                    ...stagger,
                    perLayerMs: Math.max(Number.parseInt(e.target.value, 10) || 0, 0),
                  },
                })
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// --- C6: Trigger Editor ---

function TriggerEditor({
  triggers,
  onChange,
}: {
  triggers?: StateTrigger[];
  onChange: (triggers: StateTrigger[]) => void;
}) {
  const active = new Set((triggers ?? []).map((t) => t.event));

  return (
    <div className="mt-2 grid gap-1.5">
      <Label className="text-[length:var(--text-label)] uppercase text-muted-foreground">
        Interaction Triggers
      </Label>
      <div className="flex flex-wrap gap-1">
        {TRIGGER_EVENTS.map((event) => (
          <button
            key={event}
            type="button"
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[length:var(--text-label)] font-medium transition-colors',
              active.has(event)
                ? 'bg-primary/15 text-primary'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (active.has(event)) {
                onChange((triggers ?? []).filter((t) => t.event !== event));
              } else {
                onChange([...(triggers ?? []), { event }]);
              }
            }}
          >
            {event}
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Phase I: Per-binding strategy hook & display ---

type BindingStrategyOverall = 'morph' | 'trim' | 'crossfade' | 'preserved';

type BindingStrategyInfo = {
  strategies: SubPathStrategyResult[];
  readiness: MorphReadiness | null;
  overallStrategy: BindingStrategyOverall;
};

function useBindingStrategies(
  binding: LayerBinding,
  fromState: State | undefined,
  toState: State | undefined,
): BindingStrategyInfo {
  return useMemo(() => {
    const defaultResult: BindingStrategyInfo = {
      strategies: [],
      readiness: null,
      overallStrategy: 'crossfade',
    };

    if (!fromState || !toState) return defaultResult;

    // Check for strategy override
    if (binding.strategyOverride && binding.strategyOverride !== 'auto') {
      return {
        strategies: [],
        readiness: null,
        overallStrategy: binding.strategyOverride as BindingStrategyOverall,
      };
    }

    const fromLayer = binding.fromLayerId ? fromState.layers[binding.fromLayerId] : undefined;
    const toLayer = binding.toLayerId ? toState.layers[binding.toLayerId] : undefined;

    if (!fromLayer || !toLayer) return defaultResult;

    // Get geometry stats via canonicalizeLayerPath
    const fromCanon = canonicalizeLayerPath(fromLayer);
    const toCanon = canonicalizeLayerPath(toLayer);

    if (!fromCanon || !toCanon) return defaultResult;

    // Classify per-subpath strategies
    const strategies = classifySubPathStrategies(fromCanon.stats, toCanon.stats);

    // Compute readiness for morph bindings
    const readiness = computeReadiness(fromLayer, toLayer);

    // Determine overall strategy from subpath results
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
  }, [binding.fromLayerId, binding.toLayerId, binding.strategyOverride, fromState, toState]);
}

const STRATEGY_BADGE_STYLES: Record<BindingStrategyOverall, { bg: string; text: string; label: string }> = {
  morph: { bg: 'bg-emerald-500/15', text: 'text-emerald-600', label: 'morph' },
  trim: { bg: 'bg-amber-500/15', text: 'text-amber-700', label: 'trim' },
  crossfade: { bg: 'bg-red-500/15', text: 'text-red-600', label: 'crossfade' },
  preserved: { bg: 'bg-blue-500/15', text: 'text-blue-600', label: 'preserved' },
};

const STRATEGY_OVERRIDE_OPTIONS: Array<{ value: LayerBinding['strategyOverride']; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'morph', label: 'Morph' },
  { value: 'trim', label: 'Trim' },
  { value: 'crossfade', label: 'Crossfade' },
];

/** I4–I6: Strategy badge, readiness score, and per-subpath breakdown */
function BindingStrategyDisplay({
  binding,
  fromState,
  toState,
  isPreserved,
}: {
  binding: LayerBinding;
  fromState: State | undefined;
  toState: State | undefined;
  isPreserved: boolean;
}) {
  const { strategies, readiness, overallStrategy } = useBindingStrategies(binding, fromState, toState);
  const [showDetails, setShowDetails] = useState(false);
  const [showSubpaths, setShowSubpaths] = useState(false);

  const displayStrategy: BindingStrategyOverall = isPreserved ? 'preserved' : overallStrategy;
  const badge = STRATEGY_BADGE_STYLES[displayStrategy];

  return (
    <div className="grid gap-1">
      {/* I4: Strategy badge */}
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

        {/* I5: Readiness score (only for morph strategy) */}
        {displayStrategy === 'morph' && readiness && (
          <button
            type="button"
            className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); setShowDetails((v) => !v); }}
          >
            <span className="font-medium">{Math.round(readiness.score * 100)}%</span>
            {showDetails ? (
              <ChevronDown className="size-2.5" />
            ) : (
              <ChevronRight className="size-2.5" />
            )}
          </button>
        )}

        {/* I6: Subpath count indicator (when > 1 subpath) */}
        {strategies.length > 1 && !isPreserved && (
          <button
            type="button"
            className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); setShowSubpaths((v) => !v); }}
          >
            <span>{strategies.length} subpaths</span>
            {showSubpaths ? (
              <ChevronDown className="size-2.5" />
            ) : (
              <ChevronRight className="size-2.5" />
            )}
          </button>
        )}
      </div>

      {/* I5: Expanded readiness detail */}
      {showDetails && readiness && (
        <div className="ml-1 grid gap-0.5 border-l-2 border-emerald-500/30 pl-2 text-[10px] text-muted-foreground">
          <span>Command compatibility: {Math.round(readiness.commandCompatibility * 100)}%</span>
          <span>Subpath compatibility: {Math.round(readiness.subpathCompatibility * 100)}%</span>
          <span>BBox similarity: {Math.round(readiness.bboxSimilarity * 100)}%</span>
          <span>Centroid similarity: {Math.round(readiness.centroidSimilarity * 100)}%</span>
        </div>
      )}

      {/* I6: Per-subpath strategy breakdown */}
      {showSubpaths && strategies.length > 1 && (
        <div className="ml-1 grid gap-0.5 border-l-2 border-border/50 pl-2 text-[10px] text-muted-foreground">
          {strategies.map((sp, i) => {
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
                <span className="truncate">{sp.reason.split(' — ')[0]}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- C2: Layer Binding List ---

function LayerBindingList({
  transition,
  fromState,
  toState,
  onPatchTransition,
}: {
  transition: Transition;
  fromState?: State;
  toState?: State;
  onPatchTransition: (patch: Partial<Transition>) => void;
}) {
  if (!fromState || !toState) return null;

  const fromLayerIds = Object.keys(fromState.layers);
  const toLayerIds = Object.keys(toState.layers);

  const updateBinding = (index: number, patch: Partial<LayerBinding>) => {
    const nextBindings = transition.layerBindings.map((binding, i) =>
      i === index ? { ...binding, ...patch } : binding,
    );
    onPatchTransition({ layerBindings: nextBindings });
  };

  const removeBinding = (index: number) => {
    onPatchTransition({
      layerBindings: transition.layerBindings.filter((_, i) => i !== index),
    });
  };

  const addBinding = () => {
    const usedFrom = new Set(transition.layerBindings.map((b) => b.fromLayerId));
    const usedTo = new Set(transition.layerBindings.map((b) => b.toLayerId));
    const nextFrom = fromLayerIds.find((id) => !usedFrom.has(id));
    const nextTo = toLayerIds.find((id) => !usedTo.has(id));
    onPatchTransition({
      layerBindings: [
        ...transition.layerBindings,
        { fromLayerId: nextFrom, toLayerId: nextTo },
      ],
    });
  };

  const resetToAuto = () => {
    onPatchTransition({
      layerBindings: buildDefaultLayerBindings(fromState, toState, transition.strategy),
    });
  };

  return (
    <div className="mt-2 grid gap-1.5">
      {transition.layerBindings.map((binding, index) => (
        <BindingRow
          key={`${binding.fromLayerId}-${binding.toLayerId}-${index}`}
          binding={binding}
          index={index}
          transition={transition}
          fromState={fromState}
          toState={toState}
          fromLayerIds={fromLayerIds}
          toLayerIds={toLayerIds}
          updateBinding={updateBinding}
          removeBinding={removeBinding}
        />
      ))}

      <div className="flex gap-1.5">
        <Button
          type="button" size="sm" variant="outline"
          className="h-6 rounded-lg text-[length:var(--text-label)]"
          onClick={(e) => { e.stopPropagation(); addBinding(); }}
        >
          Add Binding
        </Button>
        <Button
          type="button" size="sm" variant="ghost"
          className="h-6 rounded-lg text-[length:var(--text-label)]"
          onClick={(e) => { e.stopPropagation(); resetToAuto(); }}
        >
          Reset to Auto
        </Button>
      </div>
    </div>
  );
}

/** Individual binding row — extracted so the useBindingStrategies hook can be
 *  called at the component level (Rules of Hooks). */
function BindingRow({
  binding,
  index,
  transition,
  fromState,
  toState,
  fromLayerIds,
  toLayerIds,
  updateBinding,
  removeBinding,
}: {
  binding: LayerBinding;
  index: number;
  transition: Transition;
  fromState: State;
  toState: State;
  fromLayerIds: string[];
  toLayerIds: string[];
  updateBinding: (index: number, patch: Partial<LayerBinding>) => void;
  removeBinding: (index: number) => void;
}) {
  // Check if this layer is preserved (Magic Replace)
  const isPreserved = Boolean(
    binding.fromLayerId &&
    binding.toLayerId &&
    binding.fromLayerId === binding.toLayerId,
  ) && transition.strategy === 'replace';

  return (
    <div className="grid gap-1.5 rounded-lg border border-border/70 bg-muted/10 p-2">
      <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1.5">
        <Select value={binding.fromLayerId ?? '__none__'} onValueChange={(v) => updateBinding(index, { fromLayerId: v === '__none__' ? undefined : v })}>
          <SelectTrigger className="h-7 rounded-lg text-[length:var(--text-label)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">(none)</SelectItem>
            {fromLayerIds.map((id) => (
              <SelectItem key={id} value={id}>{id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[length:var(--text-caption)] text-muted-foreground">-&gt;</span>
        <Select value={binding.toLayerId ?? '__none__'} onValueChange={(v) => updateBinding(index, { toLayerId: v === '__none__' ? undefined : v })}>
          <SelectTrigger className="h-7 rounded-lg text-[length:var(--text-label)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">(none)</SelectItem>
            {toLayerIds.map((id) => (
              <SelectItem key={id} value={id}>{id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); removeBinding(index); }}
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      {/* I4–I6: Strategy badge, readiness, subpath breakdown */}
      <BindingStrategyDisplay
        binding={binding}
        fromState={fromState}
        toState={toState}
        isPreserved={isPreserved}
      />

      {/* I7: Strategy override dropdown */}
      <div className="flex items-center gap-1.5">
        <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Strategy</Label>
        <Select
          value={binding.strategyOverride ?? 'auto'}
          onValueChange={(v) =>
            updateBinding(index, {
              strategyOverride: v as LayerBinding['strategyOverride'],
            })
          }
        >
          <SelectTrigger className="h-6 w-24 rounded-lg text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STRATEGY_OVERRIDE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value!}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* C4 — Per-binding delay/duration */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="grid gap-0.5">
          <Label className="text-[length:var(--text-caption)] text-muted-foreground">Delay (ms)</Label>
          <Input
            type="number" min="0" step="10"
            value={binding.delayMs ?? 0}
            className="h-6 text-[length:var(--text-label)]"
            onChange={(e) =>
              updateBinding(index, {
                delayMs: Math.max(Number.parseInt(e.target.value, 10) || 0, 0),
              })
            }
          />
        </div>
        <div className="grid gap-0.5">
          <Label className="text-[length:var(--text-caption)] text-muted-foreground">Duration (ms)</Label>
          <Input
            type="number" min="0" step="10"
            value={binding.durationMs ?? transition.durationMs}
            className="h-6 text-[length:var(--text-label)]"
            onChange={(e) =>
              updateBinding(index, {
                durationMs: Math.max(Number.parseInt(e.target.value, 10) || 0, 0),
              })
            }
          />
        </div>
      </div>

      {/* I8: Compound trim mode selector — shown when binding has trim tracks */}
      <CompoundTrimModeSelector binding={binding} index={index} updateBinding={updateBinding} />

      {/* I10: Auto-populated keyframes badge */}
      <AutoPopulatedBadge binding={binding} />
    </div>
  );
}

// --- I8: Compound Trim Mode Selector ---

const TRIM_TRACK_PROPS = new Set(['trimStart', 'trimEnd', 'trimOffset']);

function CompoundTrimModeSelector({
  binding,
  index,
  updateBinding,
}: {
  binding: LayerBinding;
  index: number;
  updateBinding: (index: number, patch: Partial<LayerBinding>) => void;
}) {
  const hasTrimTracks = (binding.tracks ?? []).some((t) => TRIM_TRACK_PROPS.has(t.property));
  if (!hasTrimTracks) return null;

  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Trim Mode</Label>
      <Select
        value={binding.compoundTrimMode ?? 'simultaneously'}
        onValueChange={(v) =>
          updateBinding(index, {
            compoundTrimMode: v as LayerBinding['compoundTrimMode'],
          })
        }
      >
        <SelectTrigger className="h-6 w-32 rounded-lg text-[10px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="simultaneously">Simultaneously</SelectItem>
          <SelectItem value="individually">Individually</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// --- I10: Auto-populated keyframes badge ---

function AutoPopulatedBadge({ binding }: { binding: LayerBinding }) {
  const hasAutoTrimEnd = (binding.tracks ?? []).some(
    (t) => t.property === 'trimEnd' && t.keyframes.length === 2 &&
      (t as { keyframes: number[] }).keyframes[0] === 0 &&
      (t as { keyframes: number[] }).keyframes[1] === 1,
  );
  const hasAutoPopulated = binding.autoPopulated;

  if (!hasAutoPopulated && !hasAutoTrimEnd) return null;
  if (!hasAutoPopulated) return null;

  return (
    <span className="inline-flex items-center rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-sky-600">
      Auto
    </span>
  );
}

// --- Helpers ---

function resolveTransitionStates(
  transition: Transition,
  currentVariant: Variant | null,
  projectIcons: Record<string, Icon> | null,
): [State | undefined, State | undefined] {
  const fromState = transition.fromEndpoint
    ? projectIcons?.[transition.fromEndpoint.iconId]?.variants[transition.fromEndpoint.variantId]?.states[
        transition.fromEndpoint.stateId
      ]
    : currentVariant?.states[transition.from];
  const toState = transition.toEndpoint
    ? projectIcons?.[transition.toEndpoint.iconId]?.variants[transition.toEndpoint.variantId]?.states[
        transition.toEndpoint.stateId
      ]
    : currentVariant?.states[transition.to];

  return [fromState, toState];
}

function getCompatibilityStatus(
  transition: Transition,
  fromState: State,
  toState: State,
): CompatibilityStatus {
  if (transition.layerBindings.length === 0) {
    return { tone: 'red', label: 'Incompatible — will crossfade' };
  }

  if (transition.strategy === 'strictMorph') {
    const allStrict = transition.layerBindings.every((binding) => isStrictlyCompatible(binding, fromState, toState));
    return allStrict
      ? { tone: 'green', label: 'Compatible' }
      : { tone: 'red', label: 'Incompatible — will crossfade' };
  }

  if (transition.strategy === 'bestGuessMorph') {
    let sawBestGuess = false;
    for (const binding of transition.layerBindings) {
      const fromD = binding.fromLayerId ? fromState.layers[binding.fromLayerId]?.path?.d : undefined;
      const toD = binding.toLayerId ? toState.layers[binding.toLayerId]?.path?.d : undefined;
      if (!fromD || !toD) {
        return { tone: 'red', label: 'Incompatible — will crossfade' };
      }
      try {
        strictMorph(fromD, toD);
        continue;
      } catch {
        const morph = bestGuessMorph(fromD, toD);
        if (!morph) {
          return { tone: 'red', label: 'Incompatible — will crossfade' };
        }
        sawBestGuess = true;
      }
    }

    return sawBestGuess
      ? { tone: 'yellow', label: 'Best Guess' }
      : { tone: 'green', label: 'Compatible' };
  }

  return { tone: 'green', label: 'Compatible' };
}

function isStrictlyCompatible(binding: LayerBinding, fromState: State, toState: State) {
  const fromD = binding.fromLayerId ? fromState.layers[binding.fromLayerId]?.path?.d : undefined;
  const toD = binding.toLayerId ? toState.layers[binding.toLayerId]?.path?.d : undefined;
  if (!fromD || !toD) return false;
  try {
    strictMorph(fromD, toD);
    return true;
  } catch {
    return false;
  }
}

function buildDefaultLayerBindings(
  fromState: State,
  toState: State,
  strategy: Transition['strategy'],
): LayerBinding[] {
  const sharedIds = Object.keys(fromState.layers).filter((layerId) => Boolean(toState.layers[layerId]));
  const pairs = sharedIds.length > 0
    ? sharedIds.map((layerId) => ({ fromLayerId: layerId, toLayerId: layerId }))
    : [];

  return pairs.map(({ fromLayerId, toLayerId }) => {
    if (strategy === 'strictMorph') {
      return { fromLayerId, toLayerId, morph: { topology: 'strict' } };
    }
    if (strategy === 'bestGuessMorph') {
      return { fromLayerId, toLayerId, morph: { topology: 'bestGuess' } };
    }
    if (strategy === 'track') {
      // I10: Auto-populate trim keyframes when the layer is classified as 'trim'
      const fromLayer = fromState.layers[fromLayerId];
      const toLayer = toState.layers[toLayerId];
      const isTrimCandidate = detectTrimCandidate(fromLayer, toLayer);
      if (isTrimCandidate) {
        return {
          fromLayerId,
          toLayerId,
          tracks: [{ property: 'trimEnd' as const, keyframes: [0, 1] }],
          autoPopulated: true,
        };
      }
      return { fromLayerId, toLayerId, tracks: [] };
    }
    return { fromLayerId, toLayerId };
  });
}

/**
 * I10: Detect whether a layer pair should use trim animation.
 * Uses a simple heuristic: if both layers have path data and either has
 * open subpaths (not ending in Z), classify as trim candidate.
 */
function detectTrimCandidate(
  fromLayer: Layer | undefined,
  toLayer: Layer | undefined,
): boolean {
  const fromD = fromLayer?.path?.d;
  const toD = toLayer?.path?.d;
  if (!fromD && !toD) return false;

  // Check if any layer has open subpaths
  const hasOpenSubpath = (d: string): boolean => {
    const subPaths = d.split(/(?=[Mm])/).filter((s) => s.trim().length > 0);
    return subPaths.some((sp) => !/[Zz]\s*$/.test(sp.trim()));
  };

  if (fromD && hasOpenSubpath(fromD)) return true;
  if (toD && hasOpenSubpath(toD)) return true;

  // Also classify as trim if the strategy system would yield trim
  if (fromD && toD) {
    const fromCanon = canonicalizeLayerPath(fromLayer!);
    const toCanon = canonicalizeLayerPath(toLayer!);
    if (fromCanon && toCanon) {
      const strategies = classifySubPathStrategies(fromCanon.stats, toCanon.stats);
      return strategies.some((s) => s.strategy === 'trim');
    }
  }

  return false;
}

function CompatibilityBadge({ status }: { status: CompatibilityStatus }) {
  return (
    <span
      className={cn(
        'mt-2 inline-flex rounded-full px-2.5 py-1 text-[length:var(--text-label)] font-semibold uppercase tracking-[0.16em]',
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

function InlineSelect({
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
      <Label className="text-[length:var(--text-label)] uppercase text-muted-foreground">{label}</Label>
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

// --- Cross-Icon Endpoint Picker ---

function CrossIconEndpointPicker({
  label,
  iconEntries,
  selectedIconId,
  onIconChange,
  variants,
  selectedVariantId,
  onVariantChange,
  stateIds,
  selectedStateId,
  onStateChange,
}: {
  label: string;
  iconEntries: Array<{ id: string; name: string }>;
  selectedIconId: string;
  onIconChange: (id: string) => void;
  variants: Array<{ id: string; name?: string }>;
  selectedVariantId: string;
  onVariantChange: (id: string) => void;
  stateIds: string[];
  selectedStateId: string;
  onStateChange: (id: string) => void;
}) {
  return (
    <fieldset className="grid gap-2 rounded-lg border border-border/40 p-2.5">
      <legend className="px-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </legend>
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
      <div className="grid grid-cols-2 gap-2">
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
        <div className="grid gap-1.5">
          <Label className="text-xs uppercase text-muted-foreground">State</Label>
          <Select value={selectedStateId || '__none__'} onValueChange={(v) => onStateChange(v === '__none__' ? '' : v)} disabled={!selectedVariantId}>
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue placeholder="Select state..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select state...</SelectItem>
              {stateIds.map((stateId) => (
                <SelectItem key={stateId} value={stateId}>
                  {stateId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </fieldset>
  );
}
