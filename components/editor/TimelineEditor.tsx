'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { interpolateTransitionValues, resolveTransition } from '@/lib/runtime-core';
import { computeTrimValues } from '@/lib/runtime-core/draw-executor';
import type { TimelineTrack, Variant, Layer, LayerSnapshot, LayerBinding } from '@/lib/schema/types';
import { variantToSnapshot } from '@/lib/schema/types';
import type { TransitionConfig } from '@/lib/runtime-core/transition-resolver';
import type { TransitionPreview } from '@/lib/editor-store/store';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import { ChevronDown, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/kibo-ui/button';
import { Input } from '@/components/kibo-ui/input';
import { EasingPicker, type EasingValue } from './EasingPicker';
import { cn } from '@/lib/utils';

type NumericTrackProperty = TimelineTrack['property'];

const TRACKS: NumericTrackProperty[] = [
  'opacity',
  'rotate',
  'translateX',
  'translateY',
  'scale',
  'pathLength',
  'trimStart',
  'trimEnd',
  'trimOffset',
];
const PX_PER_MS = 0.35;

// ---------------------------------------------------------------------------
// I3: Smart track suggestion categories
// ---------------------------------------------------------------------------

type TrackCategory = 'Transform' | 'Morph' | 'Trim';

type TrackSuggestion = {
  property: NumericTrackProperty;
  category: TrackCategory;
  dimmed: boolean;
};

/** Check if a single SVG subpath (segment between M commands) is closed. */
function isSubPathClosed(segment: string): boolean {
  return /[Zz]\s*$/.test(segment.trim());
}

/** Analyse a layer's path data to determine closed/open subpath status. */
function analysePathTopology(layer: Layer | undefined): { hasClosed: boolean; hasOpen: boolean } {
  const d = layer?.path?.d;
  if (!d) return { hasClosed: false, hasOpen: false };

  // Split at M/m commands (each starts a new subpath)
  const subPaths = d.split(/(?=[Mm])/).filter((s) => s.trim().length > 0);
  let hasClosed = false;
  let hasOpen = false;
  for (const sp of subPaths) {
    if (isSubPathClosed(sp)) {
      hasClosed = true;
    } else {
      hasOpen = true;
    }
  }
  return { hasClosed, hasOpen };
}

/** Build categorised track suggestions for a layer binding. */
function buildTrackSuggestions(layer: Layer | undefined): TrackSuggestion[] {
  const { hasClosed, hasOpen } = analysePathTopology(layer);
  const onlyClosed = hasClosed && !hasOpen;
  const onlyOpen = hasOpen && !hasClosed;

  const suggestions: TrackSuggestion[] = [
    // Transform (always)
    { property: 'opacity', category: 'Transform', dimmed: false },
    { property: 'rotate', category: 'Transform', dimmed: false },
    { property: 'translateX', category: 'Transform', dimmed: false },
    { property: 'translateY', category: 'Transform', dimmed: false },
    { property: 'scale', category: 'Transform', dimmed: false },
    // Morph (closed subpaths -- dim if only open)
    { property: 'pathLength', category: 'Morph', dimmed: onlyOpen },
    // Trim (open subpaths -- dim if only closed)
    { property: 'trimStart', category: 'Trim', dimmed: onlyClosed },
    { property: 'trimEnd', category: 'Trim', dimmed: onlyClosed },
    { property: 'trimOffset', category: 'Trim', dimmed: onlyClosed },
  ];
  return suggestions;
}

/** Group suggestions by category, preserving order. */
function groupSuggestionsByCategory(
  suggestions: TrackSuggestion[],
): Array<{ category: TrackCategory; items: TrackSuggestion[] }> {
  const groups: Array<{ category: TrackCategory; items: TrackSuggestion[] }> = [];
  for (const suggestion of suggestions) {
    const existing = groups.find((g) => g.category === suggestion.category);
    if (existing) {
      existing.items.push(suggestion);
    } else {
      groups.push({ category: suggestion.category, items: [suggestion] });
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// I9: Trim path visual preview
// ---------------------------------------------------------------------------

function TrimPreview({
  trimStart,
  trimEnd,
  trimOffset,
  pathD,
}: {
  trimStart: number;
  trimEnd: number;
  trimOffset: number;
  pathD: string;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(100);

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength() || 100);
    }
  }, [pathD]);

  const { dashArray, dashOffset } = computeTrimValues(trimStart, trimEnd, trimOffset, pathLength);

  return (
    <svg
      width={40}
      height={20}
      viewBox="0 0 40 20"
      className="shrink-0 rounded border border-border/40 bg-muted/30"
      aria-label="Trim preview"
    >
      {/* Ghost path (full stroke, faded) */}
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        opacity={0.15}
        style={{
          transform: 'scale(0.7)',
          transformOrigin: 'center',
        }}
      />
      {/* Visible trim portion */}
      <path
        ref={pathRef}
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeDasharray={dashArray}
        strokeDashoffset={dashOffset}
        style={{
          transform: 'scale(0.7)',
          transformOrigin: 'center',
        }}
      />
    </svg>
  );
}

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
  transition: TransitionConfig,
  variant: Variant,
  progress: number,
): TransitionPreview | null {
  const snapshot = variantToSnapshot(variant);
  const normalizedTransition: TransitionConfig = {
    ...transition,
    strategy:
      (transition.strategy as string) === 'track'
        ? 'lineAnimation'
        : transition.strategy,
  };

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const resolvedTransition = resolveTransition(normalizedTransition, snapshot, snapshot);

  return {
    transitionId: transition.id ?? 'timeline',
    progress: clampedProgress,
    resolvedTransition,
    interpolatedValues: interpolateTransitionValues(resolvedTransition, clampedProgress),
  };
}

export const TimelineEditor = memo(function TimelineEditor({ iconId, transition, variant }: { iconId: string; transition: TransitionConfig; variant: Variant }) {
  const { setTransitionPreview } = useEditorActions();
  const preview = useEditorStore((s) => s.transitionPreview);
  const [selected, setSelected] = useState<SelectedKeyframe | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; key: SelectedKeyframe } | null>(null);
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);
  const inlineInputRef = useRef<HTMLInputElement | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);

  // Local transition state for timeline editing (no server-side persistence)
  const [localTransition, setLocalTransition] = useState(transition);
  useEffect(() => { setLocalTransition(transition); }, [transition]);

  const duration = Math.max(localTransition.durationMs, 1);
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
    if (preview?.transitionId === (localTransition.id ?? 'timeline')) {
      setPlayhead(preview.progress);
    }
  }, [preview?.progress, preview?.transitionId, localTransition.id]);

  const updateTransition = useCallback((updater: (draft: TransitionConfig) => TransitionConfig) => {
    setLocalTransition((prev) => updater(prev));
  }, []);

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
      const nextBindings = (draft.layerBindings ?? []).map((binding, idx) => {
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
      const nextBindings = (draft.layerBindings ?? []).map((binding, idx) => {
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
      layerBindings: (draft.layerBindings ?? []).map((binding, idx) => {
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
      layerBindings: (draft.layerBindings ?? []).map((binding, idx) => {
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
      layerBindings: (draft.layerBindings ?? []).map((binding, idx) => {
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

  // I3: Resolve layer objects for topology analysis using variant.layers directly
  const variantSnapshot = useMemo(() => variantToSnapshot(variant), [variant]);
  const fromState = variantSnapshot;
  const toState = variantSnapshot;

  const bindings = useMemo(
    () => localTransition.layerBindings ?? [],
    [localTransition.layerBindings],
  );

  const rows = useMemo(() => {
    return bindings.flatMap((binding: LayerBinding, bindingIndex: number) => {
      const layerId = binding.toLayerId ?? binding.fromLayerId ?? `binding-${bindingIndex}`;
      return TRACKS.map((property) => {
        const track = (binding.tracks ?? []).find((entry: TimelineTrack) => entry.property === property);
        return { bindingIndex, layerId, property, track };
      });
    });
  }, [bindings]);

  // I3: Build per-binding track suggestions keyed by binding index
  const trackSuggestionsByBinding = useMemo(() => {
    return bindings.map((binding: LayerBinding) => {
      const layerId = binding.toLayerId ?? binding.fromLayerId;
      const layer = layerId
        ? toState?.layers[layerId] ?? fromState?.layers[layerId]
        : undefined;
      return buildTrackSuggestions(layer);
    });
  }, [bindings, fromState, toState]);

  // I3: State for the add-track dropdown per binding
  const [addTrackOpen, setAddTrackOpen] = useState<number | null>(null);
  const addTrackMenuRef = useRef<HTMLDivElement>(null);

  // I3: Dismiss add-track dropdown on click outside
  useEffect(() => {
    if (addTrackOpen === null) return;
    const handleClick = (e: MouseEvent) => {
      // Don't dismiss if the click is inside the menu itself
      if (addTrackMenuRef.current && addTrackMenuRef.current.contains(e.target as Node)) return;
      setAddTrackOpen(null);
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAddTrackOpen(null); };
    // Delay listener attachment so the opening click doesn't immediately close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleEsc);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [addTrackOpen]);

  // I3: Add a track to a binding from the suggestion dropdown
  const handleAddSuggestedTrack = useCallback(
    (bindingIndex: number, property: NumericTrackProperty) => {
      updateTransition((draft) => {
        const nextBindings = (draft.layerBindings ?? []).map((binding, idx) => {
          if (idx !== bindingIndex) return binding;
          const tracks = [...(binding.tracks ?? [])];
          // Don't add duplicate tracks
          if (tracks.some((t) => t.property === property)) return binding;
          tracks.push({ property, keyframes: [0, 0] });
          return { ...binding, tracks };
        });
        return { ...draft, layerBindings: nextBindings };
      });
      setAddTrackOpen(null);
    },
    [updateTransition],
  );

  // I9: Compute current trim values per binding for preview
  const trimPreviewData = useMemo(() => {
    return bindings.map((binding: LayerBinding) => {
      const trimStartTrack = (binding.tracks ?? []).find((t) => t.property === 'trimStart');
      const trimEndTrack = (binding.tracks ?? []).find((t) => t.property === 'trimEnd');
      const trimOffsetTrack = (binding.tracks ?? []).find((t) => t.property === 'trimOffset');
      const hasTrim = trimStartTrack || trimEndTrack || trimOffsetTrack;
      if (!hasTrim) return null;

      const layerId = binding.toLayerId ?? binding.fromLayerId;
      const layer = layerId
        ? toState?.layers[layerId] ?? fromState?.layers[layerId]
        : undefined;
      const pathD = layer?.path?.d;
      if (!pathD) return null;

      // Interpolate trim values based on playhead progress
      const getTrackValue = (track: TimelineTrack | undefined, fallback: number): number => {
        if (!track || !isNumericTrack(track) || track.keyframes.length === 0) return fallback;
        if (track.keyframes.length === 1) return track.keyframes[0] ?? fallback;
        const idx = playhead * (track.keyframes.length - 1);
        const lo = Math.floor(idx);
        const hi = Math.min(lo + 1, track.keyframes.length - 1);
        const t = idx - lo;
        return (track.keyframes[lo] ?? fallback) * (1 - t) + (track.keyframes[hi] ?? fallback) * t;
      };

      return {
        trimStart: getTrackValue(trimStartTrack, 0),
        trimEnd: getTrackValue(trimEndTrack, 1),
        trimOffset: getTrackValue(trimOffsetTrack, 0),
        pathD,
      };
    });
  }, [bindings, fromState, toState, playhead]);

  return (
    <div className="rounded-lg border border-border/70 bg-background/60 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[length:var(--text-label)] text-muted-foreground" role="toolbar" aria-label="Timeline playback controls">
        <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => scrubTo(0)} aria-label="Skip to start">
          <SkipBack className="size-3.5" />
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 w-7 border border-primary/40 bg-primary/10 p-0 text-primary hover:bg-primary/20" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} aria-pressed={playing}>
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => scrubTo(1)} aria-label="Skip to end">
          <SkipForward className="size-3.5" />
        </Button>
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

          {/* I9: Per-binding trim preview */}
          {bindings.map((binding: LayerBinding, bindingIndex: number) => {
            const preview = trimPreviewData[bindingIndex];
            if (!preview) return null;
            const layerId = binding.toLayerId ?? binding.fromLayerId ?? `binding-${bindingIndex}`;
            return (
              <div
                key={`trim-preview-${bindingIndex}`}
                className="flex items-center gap-2 border-b border-border/40 px-3 py-1 text-[length:var(--text-label)] text-muted-foreground"
              >
                <span className="truncate text-[10px]">{layerId} trim</span>
                <TrimPreview
                  trimStart={preview.trimStart}
                  trimEnd={preview.trimEnd}
                  trimOffset={preview.trimOffset}
                  pathD={preview.pathD}
                />
              </div>
            );
          })}

          {/* Color tracks removed -- fill/stroke/strokeWidth/fillOpacity/strokeOpacity no longer in TimelineTrack */}
        </div>
      </div>

      {/* I3: Per-binding "Add Track" dropdown with smart suggestions */}
      <div className="mt-2 flex flex-wrap gap-2">
        {bindings.map((binding: LayerBinding, bindingIndex: number) => {
          const layerId = binding.toLayerId ?? binding.fromLayerId ?? `binding-${bindingIndex}`;
          const suggestions = trackSuggestionsByBinding[bindingIndex] ?? [];
          const grouped = groupSuggestionsByCategory(suggestions);
          const existingProps = new Set((binding.tracks ?? []).map((t: TimelineTrack) => t.property));
          const isOpen = addTrackOpen === bindingIndex;

          return (
            <div key={`add-track-${bindingIndex}`} className="relative">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 rounded-lg text-[length:var(--text-label)]"
                onClick={() => setAddTrackOpen(isOpen ? null : bindingIndex)}
              >
                <ChevronDown className="mr-1 size-3" />
                Add Track ({layerId})
              </Button>
              {isOpen && (
                <div ref={addTrackMenuRef} className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-md border border-border bg-popover p-1 shadow-lg">
                  {grouped.map((group) => (
                    <div key={group.category}>
                      <p className="px-2 pb-0.5 pt-1.5 text-[length:var(--text-caption)] font-medium uppercase tracking-tight text-muted-foreground/70">
                        {group.category}
                      </p>
                      {group.items.map((item) => {
                        const alreadyAdded = existingProps.has(item.property);
                        return (
                          <button
                            key={item.property}
                            type="button"
                            disabled={alreadyAdded}
                            className={cn(
                              'flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs',
                              alreadyAdded
                                ? 'cursor-default text-muted-foreground/40'
                                : item.dimmed
                                  ? 'text-muted-foreground/50 hover:bg-muted/60 hover:text-foreground'
                                  : 'text-foreground hover:bg-muted/80',
                            )}
                            onClick={() => handleAddSuggestedTrack(bindingIndex, item.property)}
                          >
                            <span>{item.property}</span>
                            {alreadyAdded && (
                              <span className="text-[9px] text-muted-foreground/40">added</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* UX-F5: Collision-aware context menu positioning */}
      {menu ? (
        <div
          ref={menuRef}
          className="fixed z-50 rounded-md border border-border bg-popover p-1 shadow-lg"
          style={{ left: clampMenuPosition(menu.x, menu.y).x, top: clampMenuPosition(menu.x, menu.y).y }}
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-full justify-start text-sm"
            onClick={() => { deleteSelected(menu.key); setMenu(null); }}
          >
            Delete
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-full justify-start text-sm"
            onClick={() => {
              // UX-F1: Open inline editor instead of window.prompt()
              const binding = bindings[menu.key.bindingIndex];
              const track = (binding?.tracks ?? []).find((t: TimelineTrack) => t.property === menu.key.property);
              const currentValue = track && isNumericTrack(track) ? track.keyframes[menu.key.keyframeIndex] ?? 0 : 0;
              setInlineEdit({ key: menu.key, value: String(currentValue) });
              setMenu(null);
            }}
          >
            Set Value
          </Button>
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
            <Input
              ref={inlineInputRef}
              type="number"
              step="any"
              className="h-8 w-32 text-sm"
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
): track is TimelineTrack {
  // All tracks are now numeric (fill/stroke tracks removed from TimelineTrack)
  return true;
}
