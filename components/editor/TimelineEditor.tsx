'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveTransition } from '@/lib/runtime-core';
import type { TimelineTrack, Transition, Variant } from '@/lib/schema/types';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import { cn } from '@/lib/utils';

const TRACKS: TimelineTrack['property'][] = ['opacity', 'rotate', 'translateX', 'translateY', 'scale', 'pathLength'];
const PX_PER_MS = 0.35;

type SelectedKeyframe = {
  bindingIndex: number;
  property: TimelineTrack['property'];
  keyframeIndex: number;
};

export function TimelineEditor({ iconId, transition, variant }: { iconId: string; transition: Transition; variant: Variant }) {
  const { patchTransition, setTransitionPreview } = useEditorActions();
  const preview = useEditorStore((s) => s.transitionPreview);
  const [selected, setSelected] = useState<SelectedKeyframe | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; key: SelectedKeyframe } | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);

  const duration = Math.max(transition.durationMs, 1);
  const width = Math.max(duration * PX_PER_MS, 500);

  useEffect(() => {
    if (preview?.transitionId === transition.id) {
      setPlayhead(preview.progress);
    }
  }, [preview?.progress, preview?.transitionId, transition.id]);

  const updateTransition = useCallback((updater: (draft: Transition) => Transition) => {
    const next = updater(transition);
    patchTransition(iconId, transition.id, next);
  }, [iconId, patchTransition, transition]);

  const scrubTo = useCallback((progress: number) => {
    const p = Math.max(0, Math.min(1, progress));
    setPlayhead(p);
    const fromState = variant.states[transition.from];
    const toState = variant.states[transition.to];
    if (!fromState || !toState) return;
    const resolved = resolveTransition(transition, fromState, toState);
    setTransitionPreview({
      transitionId: transition.id,
      baseStateId: transition.from,
      targetStateId: transition.to,
      progress: p,
      resolvedTransition: resolved,
      interpolatedValues: {},
    });
  }, [setTransitionPreview, transition, variant.states]);

  const togglePlay = useCallback(() => {
    setPlaying((v) => !v);
  }, []);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      return;
    }
    const start = performance.now() - playhead * duration;
    const tick = (now: number) => {
      const p = ((now - start) % duration) / duration;
      scrubTo(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [duration, playhead, playing, scrubTo]);

  const handleAddKeyframe = useCallback((bindingIndex: number, property: TimelineTrack['property'], progress: number) => {
    updateTransition((draft) => {
      const nextBindings = draft.layerBindings.map((binding, idx) => {
        if (idx !== bindingIndex) return binding;
        const tracks = [...(binding.tracks ?? [])];
        const existingIdx = tracks.findIndex((track) => track.property === property);
        if (existingIdx >= 0) {
          const track = tracks[existingIdx]!;
          const nextKeyframes = [...track.keyframes, 0];
          tracks[existingIdx] = { ...track, keyframes: nextKeyframes };
        } else {
          tracks.push({ property, keyframes: [0, 0] });
        }
        return { ...binding, tracks };
      });
      return { ...draft, layerBindings: nextBindings };
    });
    scrubTo(progress);
  }, [scrubTo, updateTransition]);

  const handleDragKeyframe = (key: SelectedKeyframe, nextProgress: number) => {
    const targetIndex = Math.max(0, Math.min(Math.round(nextProgress * (duration / 100)), 999));
    updateTransition((draft) => {
      const nextBindings = draft.layerBindings.map((binding, idx) => {
        if (idx !== key.bindingIndex) return binding;
        const tracks = (binding.tracks ?? []).map((track) => {
          if (track.property !== key.property) return track;
          const nextKeyframes = [...track.keyframes];
          nextKeyframes[key.keyframeIndex] = targetIndex;
          return { ...track, keyframes: nextKeyframes };
        });
        return { ...binding, tracks };
      });
      return { ...draft, layerBindings: nextBindings };
    });
  };

  const deleteSelected = useCallback((key: SelectedKeyframe) => {
    updateTransition((draft) => ({
      ...draft,
      layerBindings: draft.layerBindings.map((binding, idx) => {
        if (idx !== key.bindingIndex) return binding;
        const tracks = (binding.tracks ?? []).map((track) => {
          if (track.property !== key.property) return track;
          const nextKeyframes = track.keyframes.filter((_, i) => i !== key.keyframeIndex);
          return { ...track, keyframes: nextKeyframes };
        });
        return { ...binding, tracks };
      }),
    }));
  }, [updateTransition]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      } else if (event.code === 'Home') {
        event.preventDefault();
        scrubTo(0);
      } else if (event.code === 'End') {
        event.preventDefault();
        scrubTo(1);
      } else if (event.key === 'Delete' && selected) {
        event.preventDefault();
        deleteSelected(selected);
      } else if (event.key.toLowerCase() === 'k' && selected) {
        event.preventDefault();
        handleAddKeyframe(selected.bindingIndex, selected.property, playhead);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteSelected, handleAddKeyframe, playhead, scrubTo, selected, togglePlay]);

  const rows = useMemo(() => {
    return transition.layerBindings.flatMap((binding, bindingIndex) => {
      const layerId = binding.toLayerId ?? binding.fromLayerId ?? `binding-${bindingIndex}`;
      return TRACKS.map((property) => {
        const track = (binding.tracks ?? []).find((entry) => entry.property === property);
        return { bindingIndex, layerId, property, track };
      });
    });
  }, [transition.layerBindings]);

  return (
    <div className="rounded-xl border border-border/80 bg-background/60 p-2">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <button type="button" className="rounded border px-2 py-1" onClick={togglePlay}>{playing ? 'Pause' : 'Play'}</button>
        <button type="button" className="rounded border px-2 py-1" onClick={() => scrubTo(0)}>Start</button>
        <button type="button" className="rounded border px-2 py-1" onClick={() => scrubTo(1)}>End</button>
        <span>{Math.round(playhead * 100)}%</span>
      </div>
      <div className="overflow-auto">
        <div className="relative min-w-[640px]" style={{ width }}>
          <div className="absolute bottom-0 top-0 z-20 w-px bg-primary" style={{ left: `${playhead * 100}%` }} />
          {rows.map((row, rowIndex) => {
            const keyframes = row.track?.keyframes ?? [];
            return (
              <div
                key={`${row.layerId}-${row.property}-${rowIndex}`}
                className={cn('relative grid grid-cols-[180px_1fr] border-b border-border/60 text-xs', rowIndex % 2 === 0 ? 'bg-muted/20' : 'bg-transparent')}
              >
                <div className="truncate px-2 py-2 font-medium text-foreground">{row.layerId} · {row.property}</div>
                <div
                  className="relative h-8 cursor-crosshair"
                  onClick={(event) => {
                    const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const progress = (event.clientX - rect.left) / rect.width;
                    handleAddKeyframe(row.bindingIndex, row.property, progress);
                  }}
                >
                  {keyframes.map((value, index) => {
                    const progress = keyframes.length <= 1 ? index : index / (keyframes.length - 1);
                    return (
                      <button
                        key={index}
                        type="button"
                        className={cn('absolute top-1/2 z-30 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-primary bg-background', selected?.bindingIndex === row.bindingIndex && selected?.property === row.property && selected?.keyframeIndex === index ? 'ring-2 ring-primary' : '')}
                        style={{ left: `${progress * 100}%` }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setSelected({ bindingIndex: row.bindingIndex, property: row.property, keyframeIndex: index });
                          const startRect = (event.currentTarget.parentElement as HTMLDivElement).getBoundingClientRect();
                          const move = (ev: MouseEvent) => {
                            const p = (ev.clientX - startRect.left) / startRect.width;
                            handleDragKeyframe({ bindingIndex: row.bindingIndex, property: row.property, keyframeIndex: index }, p);
                          };
                          const up = () => {
                            window.removeEventListener('mousemove', move);
                            window.removeEventListener('mouseup', up);
                          };
                          window.addEventListener('mousemove', move);
                          window.addEventListener('mouseup', up);
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          const key = { bindingIndex: row.bindingIndex, property: row.property, keyframeIndex: index };
                          setSelected(key);
                          setMenu({ x: event.clientX, y: event.clientY, key });
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {menu ? (
        <div className="fixed z-50 rounded-md border border-border bg-popover p-1 shadow" style={{ left: menu.x, top: menu.y }}>
          <button type="button" className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-accent" onClick={() => { deleteSelected(menu.key); setMenu(null); }}>Delete</button>
          <button type="button" className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-accent" onClick={() => {
            const raw = prompt('Set keyframe value', '0');
            if (raw === null) return;
            const value = Number.parseFloat(raw);
            if (!Number.isFinite(value)) return;
            updateTransition((draft) => ({
              ...draft,
              layerBindings: draft.layerBindings.map((binding, idx) => {
                if (idx !== menu.key.bindingIndex) return binding;
                const tracks = (binding.tracks ?? []).map((track) => {
                  if (track.property !== menu.key.property) return track;
                  const nextKeyframes = [...track.keyframes];
                  nextKeyframes[menu.key.keyframeIndex] = value;
                  return { ...track, keyframes: nextKeyframes };
                });
                return { ...binding, tracks };
              }),
            }));
            setMenu(null);
          }}>Set Value</button>
        </div>
      ) : null}
    </div>
  );
}
