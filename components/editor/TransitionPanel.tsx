'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Trash2, WandSparkles } from 'lucide-react';
import { Button } from '@/components/kibo-ui/button';
import { Input } from '@/components/kibo-ui/input';
import { Label } from '@/components/kibo-ui/label';
import { toast } from '@/components/ui/use-toast';
import { bestGuessMorph, interpolateTransitionValues, resolveTransition, strictMorph, TransitionScheduler } from '@/lib/runtime-core';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import type { Transition, LayerBinding, State } from '@/lib/schema/types';
import { cn } from '@/lib/utils';

const EASING_OPTIONS = [
  'linear',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'ease-in-cubic',
  'ease-out-cubic',
] as const;

const SPEED_OPTIONS = [0.25, 0.5, 1, 2] as const;

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

export function TransitionPanel() {
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
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formFrom, setFormFrom] = useState('');
  const [formTo, setFormTo] = useState('');
  const [formStrategy, setFormStrategy] = useState<Transition['strategy']>('bestGuessMorph');
  const [formDuration, setFormDuration] = useState('240');
  const [formEasing, setFormEasing] = useState<(typeof EASING_OPTIONS)[number]>('ease-in-out');
  const [activePreview, setActivePreview] = useState<ActivePreview | null>(null);
  const schedulerRef = useRef<TransitionScheduler | null>(null);

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
    if (!currentIcon || !currentVariant) return;
    const durationMs = Number.parseInt(formDuration, 10);
    if (!formFrom || !formTo || formFrom === formTo || !Number.isFinite(durationMs) || durationMs < 0) {
      return;
    }

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
    });
    setIsAddOpen(false);
    setFormDuration('240');
  }, [
    addTransition,
    currentIcon,
    currentVariant,
    formDuration,
    formEasing,
    formFrom,
    formStrategy,
    formTo,
  ]);

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
          <div className="grid grid-cols-2 gap-2">
            <FieldSelect
              label="Strategy"
              value={formStrategy}
              onChange={(value) => setFormStrategy(value as Transition['strategy'])}
              options={['track', 'strictMorph', 'bestGuessMorph', 'replace']}
            />
            <FieldSelect
              label="Easing"
              value={formEasing}
              onChange={(value) => setFormEasing(value as (typeof EASING_OPTIONS)[number])}
              options={[...EASING_OPTIONS]}
            />
          </div>
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
              disabled={!formFrom || !formTo || formFrom === formTo}
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
                    <p className="mt-1 text-xs text-muted-foreground">
                      {transition.strategy} • {transition.durationMs}ms
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
                      onClick={() => handleRemoveTransition(transition.id)}
                      aria-label={`Remove ${transition.id}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {compatibility ? <CompatibilityBadge status={compatibility} /> : null}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <InlineSelect
                    label="Strategy"
                    value={transition.strategy}
                    onChange={(value) =>
                      patchTransition(currentIcon.id, transition.id, {
                        strategy: value as Transition['strategy'],
                        layerBindings: buildDefaultLayerBindings(
                          currentVariant.states[transition.from]!,
                          currentVariant.states[transition.to]!,
                          value as Transition['strategy'],
                        ),
                      })
                    }
                    options={['track', 'strictMorph', 'bestGuessMorph', 'replace']}
                  />
                  <InlineSelect
                    label="Easing"
                    value={typeof transition.easing === 'string' ? transition.easing : 'linear'}
                    onChange={(value) =>
                      patchTransition(currentIcon.id, transition.id, { easing: value })
                    }
                    options={[...EASING_OPTIONS]}
                  />
                </div>

                <div className="mt-2 grid gap-1.5">
                  <Label className="text-[11px] uppercase text-muted-foreground">
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
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round((activePreview?.progress ?? 0) * 100)}
                          onChange={(event) => handleScrub(Number.parseFloat(event.target.value) / 100)}
                          className="w-full accent-primary"
                        />
                      </div>
                      <select
                        value={String(activePreview?.speed ?? 1)}
                        onChange={(event) => handleSpeedChange(Number.parseFloat(event.target.value))}
                        className="h-9 rounded-xl border border-border bg-background px-2 text-sm text-foreground"
                      >
                        {SPEED_OPTIONS.map((speed) => (
                          <option key={speed} value={speed}>
                            {speed}x
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {Math.round((activePreview?.progress ?? 0) * 100)}%
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
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
      return { fromLayerId, toLayerId, tracks: [] };
    }
    return { fromLayerId, toLayerId };
  });
}

function CompatibilityBadge({ status }: { status: CompatibilityStatus }) {
  return (
    <span
      className={cn(
        'mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
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
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
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
      <Label className="text-[11px] uppercase text-muted-foreground">{label}</Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
