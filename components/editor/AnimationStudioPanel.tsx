'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/kibo-ui/button';
import { ScrollArea } from '@/components/kibo-ui/scroll-area';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/kibo-ui/select';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import { editorStore } from '@/lib/editor-store/store';
import { PRESET_CARDS, animationPresets } from '@/lib/animation/presets';
import { EffectPlayer } from '@/lib/animation/effect-player';
import type { Effect, Transition } from '@/lib/schema/types';
import { TimelineEditor } from './TimelineEditor';
import { EasingPicker, type EasingValue } from './EasingPicker';
import { ColorPickerPopover } from './ColorPickerPopover';

type Speed = 0.25 | 0.5 | 1 | 2;
const SPEEDS: Speed[] = [0.25, 0.5, 1, 2];

const EFFECT_KIND_LABELS: Record<string, string> = {
  lineDrawOn: 'Line Draw On',
  lineDrawOff: 'Line Draw Off',
  variableColor: 'Variable Color',
};

function formatEffectKind(kind: string): string {
  if (EFFECT_KIND_LABELS[kind]) return EFFECT_KIND_LABELS[kind];
  // Capitalize first letter for generic kinds
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export const AnimationStudioPanel = memo(function AnimationStudioPanel({
  onOpenTransitionEditor,
  showTimelineEditor = true,
}: {
  onOpenTransitionEditor?: () => void;
  showTimelineEditor?: boolean;
}) {
  const iconId = useEditorStore((s) => s.currentIconId);
  const icon = useEditorStore((s) => (s.currentIconId ? s.project?.icons[s.currentIconId] ?? null : null));
  const variant = useEditorStore((s) => (s.currentIconId && s.currentVariantId ? s.project?.icons[s.currentIconId]?.variants[s.currentVariantId] ?? null : null));
  const selectedTransitionId = useEditorStore((s) => s.selectedTransitionId);
  const { patchTransition, setSelectedTransitionId } = useEditorActions();
  const currentEffect = useRef<Effect | null>(null);
  const playerRef = useRef<EffectPlayer | null>(null);
  const canvasRafCleanupRef = useRef<(() => void) | null>(null);

  const [speed, setSpeed] = useState<Speed>(1);
  const [loop, setLoop] = useState(false);
  const [previewLabel, setPreviewLabel] = useState<string | null>(null);

  const transitions = useMemo(() => Object.values(icon?.transitions ?? {}).sort((a, b) => a.id.localeCompare(b.id)), [icon?.transitions]);
  const selectedTransition = useMemo<Transition | null>(() => {
    if (selectedTransitionId && icon?.transitions[selectedTransitionId]) return icon.transitions[selectedTransitionId];
    return transitions[0] ?? null;
  }, [icon?.transitions, selectedTransitionId, transitions]);

  const savedEffects = useMemo(() => {
    if (!icon?.effects) return [];
    return Object.values(icon.effects).sort((a, b) => a.id.localeCompare(b.id));
  }, [icon?.effects]);

  const playPreset = (key: keyof typeof animationPresets) => {
    const effect = animationPresets[key]({ repeat: loop ? 'infinite' : 0 });
    currentEffect.current = effect;
    setPreviewLabel(effect.kind);

    const maybeRenderer = (window as unknown as { __conivaDomRenderer?: unknown }).__conivaDomRenderer;
    if (maybeRenderer) {
      const player = new EffectPlayer(effect, maybeRenderer as never);
      player.setSpeed(speed);
      player.play();
      playerRef.current?.stop();
      playerRef.current = player;
      return;
    }

    canvasRafCleanupRef.current?.();
    canvasRafCleanupRef.current = previewCanvasEffect(effect, speed);
  };

  const handleSave = () => {
    if (!iconId || !currentEffect.current) return;
    editorStore.getState().addEffect(iconId, currentEffect.current);
  };

  const togglePlay = () => {
    if (!currentEffect.current) return;
    if (!playerRef.current) {
      playPreset(currentEffect.current.kind === 'lineDrawOn' ? 'drawOn' : 'bounce');
      return;
    }
    playerRef.current.play();
  };

  const handlePause = () => {
    playerRef.current?.pause();
  };

  const handleDelete = (effectId: string) => {
    if (!iconId) return;
    editorStore.getState().removeEffect(iconId, effectId);
  };

  // UX-F1: Replace prompt() with inline easing editing state
  const [editingEffectId, setEditingEffectId] = useState<string | null>(null);

  const handleEditEasing = (effect: Effect) => {
    setEditingEffectId(effect.id);
  };

  // C-4: Clean up EffectPlayer and rAF loops on unmount
  useEffect(() => {
    return () => {
      playerRef.current?.stop();
      playerRef.current = null;
      canvasRafCleanupRef.current?.();
      canvasRafCleanupRef.current = null;
    };
  }, []);

  const handleEasingChange = useCallback(
    (effectId: string, nextEasing: EasingValue) => {
      if (!iconId) return;
      editorStore.getState().patchEffect(iconId, effectId, { easing: nextEasing });
      setEditingEffectId(null);
    },
    [iconId],
  );

  const handlePaletteChange = useCallback(
    (effectId: string, palette: string[]) => {
      if (!iconId) return;
      editorStore.getState().patchEffect(iconId, effectId, { palette });
    },
    [iconId],
  );

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-[var(--panel-padding)]">
        <div>
          <p className="text-[length:var(--text-heading)] font-semibold">Animate</p>
          <p className="text-[length:var(--text-label)] text-muted-foreground">
            Preview effects, tune transitions, and manage motion behavior.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {PRESET_CARDS.map((preset) => (
            <button key={preset.key} type="button" className="rounded-xl border border-border/70 bg-background p-3 text-left transition-all duration-150 hover:bg-accent hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30" onClick={() => playPreset(preset.key)}>
              <p className="text-[length:var(--text-body)] font-medium">{preset.label}</p>
              <p className="text-[length:var(--text-label)] text-muted-foreground">{preset.description}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Animation playback controls">
          <Button size="sm" variant="secondary" onClick={togglePlay} aria-label="Play animation">Play</Button>
          <Button size="sm" variant="outline" onClick={handlePause} aria-label="Pause animation">Pause</Button>
          <Button size="sm" variant={loop ? 'default' : 'outline'} onClick={() => setLoop((v) => !v)} aria-pressed={loop} aria-label="Toggle loop">Loop</Button>
          <Button size="sm" variant="outline" onClick={handleSave} disabled={!currentEffect.current} aria-label="Save current effect">Save Effect</Button>
        </div>

        <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Playback speed">
          {SPEEDS.map((value) => (
            <Button key={value} size="sm" variant={speed === value ? 'default' : 'outline'} onClick={() => { setSpeed(value); playerRef.current?.setSpeed(value); }} aria-pressed={speed === value} aria-label={`Set speed to ${value}x`}>
              {value}x
            </Button>
          ))}
        </div>

        {previewLabel ? <p className="text-[length:var(--text-label)] text-muted-foreground">Preview: {formatEffectKind(previewLabel)}</p> : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[length:var(--text-label)] font-medium uppercase tracking-wide text-muted-foreground">
              Transitions
            </p>
            <div className="flex items-center gap-2">
              {selectedTransition ? (
                <EasingPicker value={typeof selectedTransition.easing === 'string' ? selectedTransition.easing : 'linear'} onSelect={(value) => {
                  if (!iconId || !selectedTransition) return;
                  patchTransition(iconId, selectedTransition.id, { easing: value });
                }} />
              ) : null}
              <Button size="sm" variant="outline" onClick={onOpenTransitionEditor}>
                Create Transition
              </Button>
            </div>
          </div>

          {transitions.length > 0 ? (
            <Select value={selectedTransition?.id ?? '__none__'} onValueChange={(v) => setSelectedTransitionId(v === '__none__' ? null : v)}>
              <SelectTrigger className="h-9 w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {transitions.map((transition) => (
                  <SelectItem key={transition.id} value={transition.id}>{transition.id}: {transition.from} → {transition.to}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 p-3">
              <p className="text-xs font-medium text-foreground">No transitions available for timeline editing.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create states for this icon first, then add a transition between them in the inspector.
              </p>
              <Button size="sm" variant="outline" className="mt-3" onClick={onOpenTransitionEditor}>
                Open transition editor
              </Button>
            </div>
          )}

          {showTimelineEditor && iconId && variant && selectedTransition ? (
            <TimelineEditor iconId={iconId} transition={selectedTransition} variant={variant} />
          ) : null}
          {!showTimelineEditor && selectedTransition ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/15 p-3">
              <p className="text-xs font-medium text-foreground">Timeline is docked below.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Keep working here for transition setup and use the bottom timeline panel for
                scrubbing and keyframes.
              </p>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-[length:var(--text-label)] font-medium uppercase tracking-wide text-muted-foreground">Saved Effects</p>
          {savedEffects.length === 0 ? (
            <p className="text-xs text-muted-foreground">No saved effects yet.</p>
          ) : (
            savedEffects.map((effect) => (
              <div key={effect.id} className="rounded-lg border border-border/70 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{formatEffectKind(effect.kind)}</p>
                    <p className="text-xs text-muted-foreground">
                      {effect.durationMs}ms • {typeof effect.easing === 'string' ? effect.easing : 'spring'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => handleEditEasing(effect)}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(effect.id)}>Delete</Button>
                  </div>
                </div>
                {/* UX-F1: Inline easing editor replaces window.prompt() */}
                {editingEffectId === effect.id && (
                  <div className="mt-2 flex items-center gap-2 border-t border-border/50 pt-2">
                    <EasingPicker
                      value={typeof effect.easing === 'string' ? effect.easing : (effect.easing ?? 'linear')}
                      onSelect={(val) => handleEasingChange(effect.id, val)}
                    />
                    <Button size="sm" variant="ghost" onClick={() => setEditingEffectId(null)}>Cancel</Button>
                  </div>
                )}
                {/* H7: Palette editor for variableColor effects */}
                {effect.kind === 'variableColor' && (
                  <div className="mt-2 space-y-1.5 border-t border-border/50 pt-2">
                    <p className="text-xs font-medium text-muted-foreground">Color Palette</p>
                    <div className="space-y-1">
                      {(effect.palette ?? []).map((color, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <ColorPickerPopover
                            value={color}
                            onChange={(hex) => {
                              const next = [...(effect.palette ?? [])];
                              next[index] = hex;
                              handlePaletteChange(effect.id, next);
                            }}
                            className="h-7 w-7 rounded border-border/70"
                          />
                          <span className="text-xs text-muted-foreground font-mono">{color}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto h-6 px-1.5 text-xs"
                            onClick={() => {
                              const next = (effect.palette ?? []).filter((_, i) => i !== index);
                              handlePaletteChange(effect.id, next);
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        const next = [...(effect.palette ?? []), '#3b82f6'];
                        handlePaletteChange(effect.id, next);
                      }}
                    >
                      + Add Color
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </ScrollArea>
  );
});

function previewCanvasEffect(effect: Effect, speed: number): () => void {
  const svg = document.querySelector<SVGSVGElement>('svg');
  if (!svg) return () => {};
  const paths = Array.from(svg.querySelectorAll<SVGPathElement>('path[data-layer-id]'));
  const duration = Math.max(1, effect.durationMs / speed);
  const start = performance.now();
  let rafId: number | null = null;
  let cancelled = false;

  const apply = (t: number) => {
    if (cancelled) return;
    const p = Math.min((t - start) / duration, 1);
    for (const path of paths) {
      const wave = Math.sin(p * Math.PI * 2);
      if (effect.kind === 'wiggle') path.style.transform = `rotate(${wave * 8}deg)`;
      else if (effect.kind === 'bounce' || effect.kind === 'pulse' || effect.kind === 'breathe') path.style.transform = `scale(${1 + wave * 0.08})`;
      else if (effect.kind === 'rotate') path.style.transform = `rotate(${p * 360}deg)`;
      else if (effect.kind === 'lineDrawOn') {
        const length = Math.max(path.getTotalLength?.() ?? 1, 1);
        path.style.strokeDasharray = String(length);
        path.style.strokeDashoffset = String(length * (1 - p));
      } else if (effect.kind === 'lineDrawOff') {
        const length = Math.max(path.getTotalLength?.() ?? 1, 1);
        path.style.strokeDasharray = String(length);
        path.style.strokeDashoffset = String(length * p);
      } else if (effect.kind === 'appear') path.style.opacity = String(p);
      else if (effect.kind === 'disappear') path.style.opacity = String(1 - p);
      else if (effect.kind === 'variableColor') path.style.opacity = String(0.65 + 0.35 * (0.5 + 0.5 * wave));
      path.style.transformBox = 'fill-box';
      path.style.transformOrigin = 'center';
    }

    if (p < 1) {
      rafId = requestAnimationFrame(apply);
    }
  };

  rafId = requestAnimationFrame(apply);

  return () => {
    cancelled = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
  };
}
