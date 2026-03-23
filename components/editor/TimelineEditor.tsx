'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { interpolateTransitionValues, resolveTransition } from '@/lib/runtime-core';
import type { TimelineTrack, Transition, Variant } from '@/lib/schema/types';
import type { TransitionPreview } from '@/lib/editor-store/store';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { EasingPicker, type EasingValue } from './EasingPicker';
import { cn } from '@/lib/utils';

type NumericTrackProperty = Exclude<TimelineTrack['property'], 'fill' | 'stroke'>;

const TRACKS: NumericTrackProperty[] = [
  'opacity',
  'rotate',
  'translateX',
  'translateY',
  'scale',
  'pathLength',
];
const PX_PER_MS = 0.35;

/** Clamp a menu position so it stays within the viewport. */
function clampMenuPosition(x: number, y: number, menuWidth = 160, menuHeight = 80): { x: number; y: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
  return {
    x: Math.min(x, vw - menuWidth - 8),
    y: Math.min(y, vh - menuHeight - 8),
  };
}

type SelectedKeyframe = {
  bindingIndex: number;
  property: NumericTrackProperty;
  keyframeIndex: number;
};

/** UX-F1: Inline keyframe value editor (replaces window.prompt). */
type InlineEditState = {
  key: SelectedKeyframe;
  value: string;
};

export function buildTimelineTransitionPreview(
  transition: Transition,
  variant: Variant,
  progress: number,
): TransitionPreview | null {
  const fromState = variant.states[transition.from];
  const toState = variant.states[transition.to];
  if (!fromState || !toState) return null;

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const resolvedTransition = resolveTransition(transition, fromState, toState);

  return {
    transitionId: transition.id,
    baseStateId: transition.from,
    targetStateId: transition.to,
    progress: clampedProgress,
    resolvedTransition,
    interpolatedValues: interpolateTransitionValues(resolvedTransition, clampedProgress),
  };
}

export const TimelineEditor = memo(function TimelineEditor({ iconId, transition, variant }: { iconId: string; transition: Transition; variant: Variant }) {
  const { patchTransition, setTransitionPreview } = useEditorActions();
  const preview = useEditorStore((s) => s.transitionPreview);
  const [selected, setSelected] = useState<SelectedKeyframe | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; key: SelectedKeyframe } | null>(null);
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);
  const inlineInputRef = useRef<HTMLInputElement | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);

  const duration = Math.max(transition.durationMs, 1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = Math.max(containerWidth, duration * PX_PER_MS);

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
    const nextPreview = buildTimelineTransitionPreview(transition, variant, p);
    if (!nextPreview) return;
    setTransitionPreview(nextPreview);
  }, [setTransitionPreview, transition, variant]);

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

  const handleAddKeyframe = useCallback((bindingIndex: number, property: NumericTrackProperty, progress: number) => {
    updateTransition((draft) => {
      const nextBindings = draft.layerBindings.map((binding, idx) => {
        if (idx !== bindingIndex) return binding;
        const tracks = [...(binding.tracks ?? [])];
        const existingIdx = tracks.findIndex((track) => track.property === property);
        if (existingIdx >= 0) {
          const track = tracks[existingIdx]!;
          if (!isNumericTrack(track)) {
            return binding;
          }
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
          if (!isNumericTrack(track)) return track;
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
          if (!isNumericTrack(track)) return track;
          const nextKeyframes = track.keyframes.filter((_, i) => i !== key.keyframeIndex);
          return { ...track, keyframes: nextKeyframes };
        });
        return { ...binding, tracks };
      }),
    }));
  }, [updateTransition]);

  // UX-F1 — Commit inline keyframe value edit
  const commitInlineEdit = useCallback(() => {
    if (!inlineEdit) return;
    const value = Number.parseFloat(inlineEdit.value);
    if (!Number.isFinite(value)) {
      setInlineEdit(null);
      return;
    }
    updateTransition((draft) => ({
      ...draft,
      layerBindings: draft.layerBindings.map((binding, idx) => {
        if (idx !== inlineEdit.key.bindingIndex) return binding;
        const tracks = (binding.tracks ?? []).map((track) => {
          if (track.property !== inlineEdit.key.property) return track;
          if (!isNumericTrack(track)) return track;
          const nextKeyframes = [...track.keyframes];
          nextKeyframes[inlineEdit.key.keyframeIndex] = value;
          return { ...track, keyframes: nextKeyframes };
        });
        return { ...binding, tracks };
      }),
    }));
    setInlineEdit(null);
  }, [inlineEdit, updateTransition]);

  const cancelInlineEdit = useCallback(() => {
    setInlineEdit(null);
  }, []);

  // Focus the inline input when it appears
  useEffect(() => {
    if (inlineEdit && inlineInputRef.current) {
      inlineInputRef.current.focus();
      inlineInputRef.current.select();
    }
  }, [inlineEdit]);

  // C3 — Per-track easing update
  const handleTrackEasingChange = useCallback((bindingIndex: number, property: string, easing: EasingValue) => {
    updateTransition((draft) => ({
      ...draft,
      layerBindings: draft.layerBindings.map((binding, idx) => {
        if (idx !== bindingIndex) return binding;
        const tracks = (binding.tracks ?? []).map((track) => {
          if (track.property !== property) return track;
          return { ...track, easing: easing === 'linear' ? undefined : easing };
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

  // E-4 — Dismiss context menu on click outside or Escape
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenu(null);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menu]);

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
    <div className="rounded-xl border border-border/70 bg-background/60 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[length:var(--text-label)] text-muted-foreground" role="toolbar" aria-label="Timeline playback controls">
        <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 bg-background transition-colors hover:bg-accent" onClick={() => scrubTo(0)} aria-label="Skip to start">
          <SkipBack className="size-3.5" />
        </button>
        <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary transition-colors hover:bg-primary/20" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} aria-pressed={playing}>
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
        <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 bg-background transition-colors hover:bg-accent" onClick={() => scrubTo(1)} aria-label="Skip to end">
          <SkipForward className="size-3.5" />
        </button>
        <span className="ml-1.5 tabular-nums" aria-label={`Playhead at ${Math.round(playhead * 100)} percent`}>{Math.round(playhead * 100)}%</span>
      </div>
      <div ref={containerRef} className="overflow-auto">
        <div className="relative min-w-full" style={{ width }}>
          <div className="absolute bottom-0 top-0 z-20 w-[3px] rounded-full bg-primary shadow-[0_0_6px_var(--primary)]" style={{ left: `${playhead * 100}%`, marginLeft: '-1px' }} />
          {rows.map((row, rowIndex) => {
            const keyframes = row.track?.keyframes ?? [];
            const trackEasing = row.track?.easing;

            return (
              <div
                key={`${row.layerId}-${row.property}-${rowIndex}`}
                className={cn('relative grid grid-cols-[180px_auto_1fr] border-b border-border/70 text-[length:var(--text-label)]', rowIndex % 2 === 0 ? 'bg-muted/20' : 'bg-transparent')}
              >
                <div className="truncate px-3 py-2 font-medium text-foreground">
                  {row.layerId} · {row.property}
                </div>

                {/* C3 — Per-track easing indicator */}
                <div className="flex items-center px-1">
                  {row.track ? (
                    <EasingPicker
                      value={trackEasing ?? 'linear'}
                      onSelect={(val) => handleTrackEasingChange(row.bindingIndex, row.property, val)}
                    />
                  ) : (
                    <span className="text-[length:var(--text-caption)] text-muted-foreground/40">—</span>
                  )}
                </div>

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
                        aria-label={`Keyframe ${index + 1} for ${row.property} at ${Math.round(progress * 100)}%`}
                        className={cn('absolute top-1/2 z-30 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-primary bg-background cursor-grab', selected?.bindingIndex === row.bindingIndex && selected?.property === row.property && selected?.keyframeIndex === index ? 'ring-2 ring-primary' : '')}
                        style={{ left: `${progress * 100}%` }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setSelected({ bindingIndex: row.bindingIndex, property: row.property, keyframeIndex: index });
                          document.body.style.cursor = 'grabbing';
                          const startRect = (event.currentTarget.parentElement as HTMLDivElement).getBoundingClientRect();
                          const move = (ev: MouseEvent) => {
                            const p = (ev.clientX - startRect.left) / startRect.width;
                            handleDragKeyframe({ bindingIndex: row.bindingIndex, property: row.property, keyframeIndex: index }, p);
                          };
                          const up = () => {
                            document.body.style.cursor = '';
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

      {/* UX-F5: Collision-aware context menu positioning */}
      {menu ? (
        <div
          ref={menuRef}
          className="fixed z-50 rounded-md border border-border bg-popover p-1 shadow-lg"
          style={{ left: clampMenuPosition(menu.x, menu.y).x, top: clampMenuPosition(menu.x, menu.y).y }}
        >
          <button
            type="button"
            className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-accent"
            onClick={() => { deleteSelected(menu.key); setMenu(null); }}
          >
            Delete
          </button>
          <button
            type="button"
            className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-accent"
            onClick={() => {
              // UX-F1: Open inline editor instead of window.prompt()
              const binding = transition.layerBindings[menu.key.bindingIndex];
              const track = (binding?.tracks ?? []).find((t) => t.property === menu.key.property);
              const currentValue = track && isNumericTrack(track) ? track.keyframes[menu.key.keyframeIndex] ?? 0 : 0;
              setInlineEdit({ key: menu.key, value: String(currentValue) });
              setMenu(null);
            }}
          >
            Set Value
          </button>
        </div>
      ) : null}

      {/* UX-F1: Inline keyframe value editor */}
      {inlineEdit ? (
        <div className="fixed inset-0 z-50" onClick={cancelInlineEdit}>
          <div
            className="absolute rounded-lg border border-primary/40 bg-popover p-2 shadow-lg"
            style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Set keyframe value
            </label>
            <input
              ref={inlineInputRef}
              type="number"
              step="any"
              className="h-8 w-32 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              value={inlineEdit.value}
              onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitInlineEdit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelInlineEdit();
                }
              }}
              onBlur={commitInlineEdit}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
});

function isNumericTrack(
  track: TimelineTrack,
): track is Extract<TimelineTrack, { property: NumericTrackProperty }> {
  return track.property !== 'fill' && track.property !== 'stroke';
}
