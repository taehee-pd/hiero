'use client';

import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/kibo-ui/button';
import { ScrollArea } from '@/components/kibo-ui/scroll-area';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import { editorStore } from '@/lib/editor-store/store';
import { PRESET_CARDS, animationPresets } from '@/lib/animation/presets';
import { EffectPlayer } from '@/lib/animation/effect-player';
import type { Effect, Transition } from '@/lib/schema/types';
import { TimelineEditor } from './TimelineEditor';
import { EasingPicker } from './EasingPicker';

type Speed = 0.25 | 0.5 | 1 | 2;
const SPEEDS: Speed[] = [0.25, 0.5, 1, 2];

export function AnimationStudioPanel() {
  const iconId = useEditorStore((s) => s.currentIconId);
  const icon = useEditorStore((s) => (s.currentIconId ? s.project?.icons[s.currentIconId] ?? null : null));
  const variant = useEditorStore((s) => (s.currentIconId && s.currentVariantId ? s.project?.icons[s.currentIconId]?.variants[s.currentVariantId] ?? null : null));
  const selectedTransitionId = useEditorStore((s) => s.selectedTransitionId);
  const { patchTransition, setSelectedTransitionId } = useEditorActions();
  const currentEffect = useRef<Effect | null>(null);
  const playerRef = useRef<EffectPlayer | null>(null);

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

    const maybeRenderer = (window as unknown as { __icophoneDomRenderer?: unknown }).__icophoneDomRenderer;
    if (maybeRenderer) {
      const player = new EffectPlayer(effect, maybeRenderer as never);
      player.setSpeed(speed);
      player.play();
      playerRef.current?.stop();
      playerRef.current = player;
      return;
    }

    previewCanvasEffect(effect, speed);
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

  const handleRename = (effect: Effect) => {
    if (!iconId) return;
    const nextEasing = prompt(
      'Easing',
      typeof effect.easing === 'string' ? effect.easing : 'linear',
    );
    if (!nextEasing) return;
    editorStore.getState().patchEffect(iconId, effect.id, { easing: nextEasing });
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-3">
        <div>
          <p className="text-sm font-semibold">Animation Studio</p>
          <p className="text-xs text-muted-foreground">Choose a preset and preview it on the canvas.</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {PRESET_CARDS.map((preset) => (
            <button key={preset.key} type="button" className="rounded-xl border border-border/80 bg-background p-2 text-left hover:bg-accent" onClick={() => playPreset(preset.key)}>
              <p className="text-xs font-medium">{preset.label}</p>
              <p className="text-[11px] text-muted-foreground">{preset.description}</p>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={togglePlay}>Play</Button>
          <Button size="sm" variant="outline" onClick={handlePause}>Pause</Button>
          <Button size="sm" variant={loop ? 'default' : 'outline'} onClick={() => setLoop((v) => !v)}>Loop</Button>
          <Button size="sm" variant="outline" onClick={handleSave} disabled={!currentEffect.current}>Save Effect</Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {SPEEDS.map((value) => (
            <Button key={value} size="sm" variant={speed === value ? 'default' : 'outline'} onClick={() => { setSpeed(value); playerRef.current?.setSpeed(value); }}>
              {value}x
            </Button>
          ))}
        </div>

        {previewLabel ? <p className="text-xs text-muted-foreground">Preview: {previewLabel}</p> : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Transition Timeline</p>
            {selectedTransition ? (
              <EasingPicker value={typeof selectedTransition.easing === 'string' ? selectedTransition.easing : 'linear'} onSelect={(value) => {
                if (!iconId || !selectedTransition) return;
                patchTransition(iconId, selectedTransition.id, { easing: value });
              }} />
            ) : null}
          </div>

          {transitions.length > 0 ? (
            <select
              value={selectedTransition?.id ?? ''}
              onChange={(event) => setSelectedTransitionId(event.target.value || null)}
              className="h-9 w-full rounded-xl border border-border bg-background px-2 text-sm"
            >
              {transitions.map((transition) => (
                <option key={transition.id} value={transition.id}>{transition.id}: {transition.from} → {transition.to}</option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-muted-foreground">No transitions available for timeline editing.</p>
          )}

          {iconId && variant && selectedTransition ? (
            <TimelineEditor iconId={iconId} transition={selectedTransition} variant={variant} />
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saved Effects</p>
          {savedEffects.length === 0 ? (
            <p className="text-xs text-muted-foreground">No saved effects yet.</p>
          ) : (
            savedEffects.map((effect) => (
              <div key={effect.id} className="flex items-center justify-between rounded-lg border border-border/80 p-2">
                <div>
                  <p className="text-sm font-medium">{effect.kind}</p>
                  <p className="text-xs text-muted-foreground">
                    {effect.durationMs}ms • {typeof effect.easing === 'string' ? effect.easing : 'spring'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => handleRename(effect)}>Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => handleDelete(effect.id)}>Delete</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

function previewCanvasEffect(effect: Effect, speed: number) {
  const svg = document.querySelector<SVGSVGElement>('svg');
  if (!svg) return;
  const paths = Array.from(svg.querySelectorAll<SVGPathElement>('path[data-layer-id]'));
  const duration = Math.max(1, effect.durationMs / speed);
  const start = performance.now();

  const apply = (t: number) => {
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

    if (p < 1) requestAnimationFrame(apply);
  };

  requestAnimationFrame(apply);
}
