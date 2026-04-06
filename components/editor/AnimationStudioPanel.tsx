'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/kibo-ui/button';
import { useEditorActions, useEditorStore } from '@/lib/editor-store/hooks';
import { editorStore } from '@/lib/editor-store/store';
import { PRESET_CARDS, animationPresets } from '@/lib/animation/presets';
import { EffectPlayer } from '@/lib/animation/effect-player';
import type { Effect, Layer } from '@/lib/schema/types';
import { filterDrawEligibleLayers } from '@/lib/runtime-core/open-path-guard';
import { EasingPicker, type EasingValue } from './EasingPicker';
import { ColorPickerPopover } from './ColorPickerPopover';

type Speed = 0.25 | 0.5 | 1 | 2;
const SPEEDS: Speed[] = [0.25, 0.5, 1, 2];

const EFFECT_KIND_LABELS: Record<string, string> = {
  lineDrawOn: 'Line Draw On',
  lineDrawOff: 'Line Draw Off',
  variableColor: 'Variable Color',
  draw: 'Draw',
};

/** Preset keys that require open stroked paths. */
const DRAW_PRESET_KEYS = new Set(['drawReveal', 'drawErase', 'drawSlide']);

function formatEffectKind(kind: string): string {
  if (EFFECT_KIND_LABELS[kind]) return EFFECT_KIND_LABELS[kind];
  // Capitalize first letter for generic kinds
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export const AnimationStudioPanel = memo(function AnimationStudioPanel({
  showTimelineEditor: _showTimelineEditor = true,
}: {
  showTimelineEditor?: boolean;
}) {
  const iconId = useEditorStore((s) => s.currentIconId);
  const icon = useEditorStore((s) => (s.currentIconId ? s.project?.icons[s.currentIconId] ?? null : null));
  const variant = useEditorStore((s) => (s.currentIconId && s.currentVariantId ? s.project?.icons[s.currentIconId]?.variants[s.currentVariantId] ?? null : null));
  const currentEffect = useRef<Effect | null>(null);
  const playerRef = useRef<EffectPlayer | null>(null);
  const canvasRafCleanupRef = useRef<(() => void) | null>(null);

  const [speed, setSpeed] = useState<Speed>(1);
  const [loop, setLoop] = useState(false);
  const [previewLabel, setPreviewLabel] = useState<string | null>(null);

  const hasDrawEligibleLayers = useMemo(() => {
    if (!variant?.layers) return false;
    return filterDrawEligibleLayers(variant.layers).length > 0;
  }, [variant?.layers]);

  // Transitions are handled by TransitionPanel mounted separately below.

  const savedEffects = useMemo(() => {
    if (!icon?.effects) return [];
    return Object.values(icon.effects).sort((a, b) => a.id.localeCompare(b.id));
  }, [icon?.effects]);

  const playPreset = (key: keyof typeof animationPresets) => {
    const effect = animationPresets[key]({ repeat: loop ? 'infinite' : 0 });
    currentEffect.current = effect;
    setPreviewLabel(effect.kind);

    const maybeRenderer = (window as unknown as { __contourDomRenderer?: unknown }).__contourDomRenderer;
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
    <div className="space-y-3">
      <div>
        <p className="text-[length:var(--text-heading)] font-semibold">Effects</p>
        <p className="text-[length:var(--text-label)] text-muted-foreground">
          Click a preset to preview.{previewLabel ? <> <span className="font-medium text-foreground">{formatEffectKind(previewLabel)}</span></> : null}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {PRESET_CARDS.map((preset) => {
          const isDrawPreset = DRAW_PRESET_KEYS.has(preset.key);
          const disabled = isDrawPreset && !hasDrawEligibleLayers;
          return (
            <button key={preset.key} type="button" className={`rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-left transition-colors duration-100 ${disabled ? 'opacity-35 cursor-not-allowed' : 'hover:bg-accent hover:border-primary/30'}`} onClick={() => !disabled && playPreset(preset.key)} disabled={disabled} title={disabled ? 'Requires open stroked paths' : preset.description}>
              <p className="text-[10px] font-medium leading-tight">{preset.label}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Animation controls">
        <Button size="sm" variant="secondary" className="h-7 px-2.5 text-xs" onClick={togglePlay} aria-label="Play animation">Play</Button>
        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={handlePause} aria-label="Pause animation">Pause</Button>
        <Button size="sm" variant={loop ? 'default' : 'outline'} className="h-7 px-2.5 text-xs" onClick={() => setLoop((v) => !v)} aria-pressed={loop} aria-label="Toggle loop">Loop</Button>
        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={handleSave} disabled={!currentEffect.current} aria-label="Save current effect">Save</Button>
        <div className="flex items-center gap-1" role="toolbar" aria-label="Playback speed">
          {SPEEDS.map((value) => (
            <button key={value} type="button" className={`h-6 rounded px-1.5 text-[10px] font-medium transition-colors ${speed === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => { setSpeed(value); playerRef.current?.setSpeed(value); }} aria-pressed={speed === value} aria-label={`Set speed to ${value}x`}>
              {value}x
            </button>
          ))}
        </div>
      </div>

        {/* Draw Order — visible when a draw effect is the active preview */}
        {previewLabel === 'draw' && variant?.layers ? (
          <DrawOrderEditor iconId={iconId} layers={variant.layers} />
        ) : null}

        <div className="space-y-2 border-t border-border/30 pt-3">
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
  );
});

function previewCanvasEffect(effect: Effect, speed: number): () => void {
  // Find the editor canvas SVG specifically, not any other SVG on the page.
  // Try the editor canvas SVG first, then fall back to any SVG.
  const svg = document.querySelector<SVGSVGElement>('svg[data-editor-canvas]')
    ?? document.querySelector<SVGSVGElement>('svg');
  if (!svg) return () => {};
  const paths = Array.from(svg.querySelectorAll<SVGPathElement>('path[data-layer-id]'));
  if (paths.length === 0) return () => {};

  const duration = Math.max(1, effect.durationMs / speed);
  const start = performance.now();
  let rafId: number | null = null;
  let cancelled = false;

  // The SVG element renders at a scaled CSS pixel size (e.g. 326px for a 24px viewBox).
  // Use 'center center' for transform-origin so scaling/rotation pivots around
  // the element center regardless of zoom level.

  // Effects that transform the whole icon as a group (scale/rotate around icon center)
  const isGroupTransform = ['bounce', 'pulse', 'breathe', 'wiggle', 'rotate', 'scale'].includes(effect.kind);

  // Save the original SVG transform (canvas pan/zoom) so we can compose with it
  const originalSvgTransform = svg.style.transform || '';
  const originalSvgTransformOrigin = svg.style.transformOrigin || '';

  // Cache path lengths for draw/trim animations
  const pathLengths = new Map<SVGPathElement, number>();
  if (!isGroupTransform) {
    for (const path of paths) {
      try {
        pathLengths.set(path, Math.max(path.getTotalLength?.() ?? 1, 1));
      } catch {
        pathLengths.set(path, 1);
      }
    }
  }

  // Group paths by draw order for sequential draw effects
  const drawOrderGroups = new Map<number, SVGPathElement[]>();
  for (const path of paths) {
    const order = Number(path.getAttribute('data-draw-order') ?? '1');
    const group = drawOrderGroups.get(order) ?? [];
    group.push(path);
    drawOrderGroups.set(order, group);
  }
  const sortedOrders = [...drawOrderGroups.keys()].sort((a, b) => a - b);
  const orderCount = sortedOrders.length;

  const applyFrame = (p: number) => {
    const wave = Math.sin(p * Math.PI * 2);
    const easedSin = Math.sin(p * Math.PI);

    // Group transforms: compose with the existing canvas pan/zoom transform
    if (isGroupTransform) {
      let effectTransform = '';
      switch (effect.kind) {
        case 'wiggle':
          effectTransform = `rotate(${wave * 8}deg)`;
          break;
        case 'bounce':
          effectTransform = `scale(${1 + easedSin * 0.18})`;
          break;
        case 'pulse':
        case 'breathe':
          effectTransform = `scale(${1 + wave * 0.08})`;
          break;
        case 'scale':
          effectTransform = `scale(${1 + wave * 0.1})`;
          break;
        case 'rotate':
          effectTransform = `rotate(${p * 360}deg)`;
          break;
      }
      // Compose: apply original pan/zoom THEN the effect transform
      svg.style.transform = `${originalSvgTransform} ${effectTransform}`.trim();
      svg.style.transformOrigin = 'center center';
      return;
    }

    // Per-path effects: stroke, opacity, draw
    for (const path of paths) {
      const length = pathLengths.get(path) ?? 1;

      switch (effect.kind) {
        case 'lineDrawOn':
          path.style.strokeDasharray = String(length);
          path.style.strokeDashoffset = String(length * (1 - p));
          break;
        case 'lineDrawOff':
          path.style.strokeDasharray = String(length);
          path.style.strokeDashoffset = String(length * p);
          break;
        case 'draw': {
          // Trim-based draw animation with per-layer ordering
          const drawOrder = Number(path.getAttribute('data-draw-order') ?? '1');
          const orderIndex = sortedOrders.indexOf(drawOrder);
          const groupStart = orderCount > 1 ? orderIndex / orderCount : 0;
          const groupEnd = orderCount > 1 ? (orderIndex + 1) / orderCount : 1;
          const localP = orderCount > 1
            ? Math.max(0, Math.min(1, (p - groupStart) / (groupEnd - groupStart)))
            : p;

          const mode = effect.drawConfig?.mode ?? 'reveal';
          const offset = effect.drawConfig?.initialOffset ?? 0;
          let trimStart = 0;
          let trimEnd = 0;
          switch (mode) {
            case 'reveal':
              trimStart = 0;
              trimEnd = localP;
              break;
            case 'erase':
              trimStart = localP;
              trimEnd = 1;
              break;
            case 'slide': {
              const ws = effect.drawConfig?.windowSize ?? 0.2;
              trimStart = localP * (1 - ws);
              trimEnd = trimStart + ws;
              break;
            }
          }
          const visibleLength = (trimEnd >= trimStart ? trimEnd - trimStart : 1 - trimStart + trimEnd) * length;
          const dashOffset = -(trimStart + offset) * length;
          path.style.strokeDasharray = `${visibleLength} ${length}`;
          path.style.strokeDashoffset = String(dashOffset);
          break;
        }
        case 'appear':
          path.style.opacity = String(p);
          path.style.transform = `scale(${0.92 + 0.08 * p})`;
          path.style.transformBox = 'fill-box';
          path.style.transformOrigin = 'center';
          break;
        case 'disappear':
          path.style.opacity = String(1 - p);
          path.style.transform = `scale(${1 - 0.08 * p})`;
          path.style.transformBox = 'fill-box';
          path.style.transformOrigin = 'center';
          break;
        case 'variableColor':
          path.style.opacity = String(0.65 + 0.35 * (0.5 + 0.5 * wave));
          break;
        default:
          break;
      }
    }
  };

  const tick = (t: number) => {
    if (cancelled) return;
    const p = Math.min((t - start) / duration, 1);
    applyFrame(p);

    if (p < 1) {
      rafId = requestAnimationFrame(tick);
    }
    // When p >= 1, the final frame stays rendered (hold at end)
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    // Restore original SVG transform (canvas pan/zoom)
    svg.style.transform = originalSvgTransform;
    svg.style.transformOrigin = originalSvgTransformOrigin;
    // Reset per-path styles
    for (const path of paths) {
      path.style.removeProperty('transform');
      path.style.removeProperty('transform-box');
      path.style.removeProperty('transform-origin');
      path.style.removeProperty('opacity');
      path.style.removeProperty('stroke-dasharray');
      path.style.removeProperty('stroke-dashoffset');
    }
  };
}

// ---------------------------------------------------------------------------
// DrawOrderEditor — per-layer draw order controls
// ---------------------------------------------------------------------------

function DrawOrderEditor({
  iconId,
  layers,
}: {
  iconId: string | null;
  layers: Record<string, Layer>;
}) {
  const { patchLayer } = useEditorActions();
  const layerEntries = useMemo(
    () =>
      Object.values(layers)
        .filter((l) => l.visible !== false && l.path?.d)
        .sort((a, b) => (a.drawOrder ?? 1) - (b.drawOrder ?? 1)),
    [layers],
  );

  const setOrder = useCallback(
    (layerId: string, order: number) => {
      if (!iconId) return;
      patchLayer(iconId, layerId, { drawOrder: Math.max(1, order) });
    },
    [iconId, patchLayer],
  );

  if (layerEntries.length < 2) return null;

  return (
    <div className="space-y-1.5 border-t border-border/30 pt-3">
      <p className="text-[length:var(--text-label)] font-medium uppercase tracking-wide text-muted-foreground">
        Draw Order
      </p>
      <div className="space-y-1">
        {layerEntries.map((layer) => {
          const order = layer.drawOrder ?? 1;
          return (
            <div key={layer.id} className="flex items-center gap-2">
              <span className="flex-1 truncate text-xs text-foreground">{layer.id}</span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => setOrder(layer.id, order - 1)}
                  disabled={order <= 1}
                  aria-label={`Decrease draw order for ${layer.id}`}
                >
                  ▲
                </button>
                <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-semibold tabular-nums">
                  {order}
                </span>
                <button
                  type="button"
                  className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => setOrder(layer.id, order + 1)}
                  aria-label={`Increase draw order for ${layer.id}`}
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-muted-foreground/70">Same number = simultaneous. Different = sequential.</p>
    </div>
  );
}
