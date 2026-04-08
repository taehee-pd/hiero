'use client';

import { useCallback, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/kibo-ui/button';
import { Input } from '@/components/kibo-ui/input';
import { Label } from '@/components/kibo-ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/kibo-ui/select';
import type { Effect, TimelineTrack, SpringConfig } from '@/lib/schema/types';
import { EasingPicker } from './EasingPicker';

const EFFECT_KINDS: Effect['kind'][] = [
  'bounce',
  'pulse',
  'breathe',
  'wiggle',
  'rotate',
  'scale',
  'appear',
  'disappear',
  'variableColor',
  'lineDrawOn',
  'lineDrawOff',
  'custom',
];

const TRACK_PROPERTIES = [
  'opacity',
  'rotate',
  'translateX',
  'translateY',
  'scale',
] as const;

type CustomTrack = {
  property: string;
  keyframes: number[];
  easing?: string | SpringConfig;
};

export function CustomEffectBuilder({
  effect,
  onUpdate,
  onRemove,
}: {
  effect: Effect;
  onUpdate: (patch: Partial<Effect>) => void;
  onRemove: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button
            type="button"
            className="text-sm font-semibold text-foreground hover:underline"
            onClick={() => setIsExpanded((v) => !v)}
          >
            {effect.id}
          </button>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {effect.kind} • {effect.durationMs}ms
            {effect.repeat && effect.repeat !== 1 ? ` • repeat: ${effect.repeat}` : ''}
          </p>
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {isExpanded ? (
        <div className="mt-3 grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label className="text-[length:var(--text-caption)] text-muted-foreground">Kind</Label>
              <Select value={effect.kind} onValueChange={(v) => onUpdate({ kind: v as Effect['kind'] })}>
                <SelectTrigger className="h-7 rounded-lg text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EFFECT_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>{kind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-[length:var(--text-caption)] text-muted-foreground">Duration (ms)</Label>
              <Input
                type="number" min="0" step="50"
                value={effect.durationMs}
                className="h-7 text-xs"
                onChange={(e) =>
                  onUpdate({ durationMs: Math.max(Number.parseInt(e.target.value, 10) || 0, 0) })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label className="text-[length:var(--text-caption)] text-muted-foreground">Delay (ms)</Label>
              <Input
                type="number" min="0" step="50"
                value={effect.delay ?? 0}
                className="h-7 text-xs"
                onChange={(e) =>
                  onUpdate({ delay: Math.max(Number.parseInt(e.target.value, 10) || 0, 0) })
                }
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-[length:var(--text-caption)] text-muted-foreground">Repeat</Label>
              <Input
                type="text"
                value={effect.repeat === 'infinite' ? 'infinite' : String(effect.repeat ?? 1)}
                className="h-7 text-xs"
                onChange={(e) => {
                  const val = e.target.value.trim();
                  if (val === 'infinite') {
                    onUpdate({ repeat: 'infinite' });
                  } else {
                    const n = Number.parseInt(val, 10);
                    if (Number.isFinite(n) && n > 0) onUpdate({ repeat: n });
                  }
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label className="text-[length:var(--text-caption)] text-muted-foreground">Direction</Label>
              <Select value={effect.direction ?? 'normal'} onValueChange={(v) => onUpdate({ direction: v as Effect['direction'] })}>
                <SelectTrigger className="h-7 rounded-lg text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">normal</SelectItem>
                  <SelectItem value="reverse">reverse</SelectItem>
                  <SelectItem value="alternate">alternate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-[length:var(--text-caption)] text-muted-foreground">Easing</Label>
              <EasingPicker
                value={effect.easing ?? 'linear'}
                onSelect={(val) => onUpdate({ easing: val })}
              />
            </div>
          </div>

          {/* Custom tracks editor — only shown for 'custom' kind */}
          {effect.kind === 'custom' ? (
            <CustomTracksEditor
              tracks={effect.customTracks ?? []}
              onUpdate={(tracks) => onUpdate({ customTracks: tracks })}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CustomTracksEditor({
  tracks,
  onUpdate,
}: {
  tracks: TimelineTrack[];
  onUpdate: (tracks: TimelineTrack[]) => void;
}) {
  const addTrack = useCallback(() => {
    const usedProps = new Set(tracks.map((t) => t.property));
    const nextProp = TRACK_PROPERTIES.find((p) => !usedProps.has(p)) ?? 'opacity';
    onUpdate([
      ...tracks,
      { property: nextProp, keyframes: [0, 1, 0] } as TimelineTrack,
    ]);
  }, [onUpdate, tracks]);

  const removeTrack = useCallback(
    (index: number) => {
      onUpdate(tracks.filter((_, i) => i !== index));
    },
    [onUpdate, tracks],
  );

  const updateTrack = useCallback(
    (index: number, patch: Partial<CustomTrack>) => {
      onUpdate(
        tracks.map((track, i) => {
          if (i !== index) return track;
          return { ...track, ...patch } as TimelineTrack;
        }),
      );
    },
    [onUpdate, tracks],
  );

  return (
    <div className="mt-2 grid gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-[length:var(--text-caption)] uppercase text-muted-foreground">Custom Tracks</Label>
        <Button
          type="button" size="sm" variant="outline"
          className="h-6 gap-1 rounded-lg text-[length:var(--text-caption)]"
          onClick={addTrack}
        >
          <Plus className="size-3" /> Add Track
        </Button>
      </div>

      {tracks.map((track, index) => (
        <div
          key={`${track.property}-${index}`}
          className="grid gap-1.5 rounded-lg border border-border/50 bg-muted/10 p-2"
        >
          <div className="flex items-center justify-between gap-2">
            <Select value={track.property} onValueChange={(v) => updateTrack(index, { property: v })}>
              <SelectTrigger className="h-7 rounded-sm text-[length:var(--text-label)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRACK_PROPERTIES.map((prop) => (
                  <SelectItem key={prop} value={prop}>{prop}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <EasingPicker
                value={track.easing ?? 'linear'}
                onSelect={(val) =>
                  updateTrack(index, {
                    easing: val === 'linear' ? undefined : val,
                  } as Partial<CustomTrack>)
                }
              />
              <button
                type="button"
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => removeTrack(index)}
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          </div>

          <div className="grid gap-0.5">
            <Label className="text-[length:var(--text-caption)] text-muted-foreground">
              Keyframes (comma-separated)
            </Label>
            <Input
              type="text"
              value={(track.keyframes as number[]).join(', ')}
              className="h-6 text-[length:var(--text-label)]"
              onChange={(e) => {
                const values = e.target.value
                  .split(',')
                  .map((s) => Number.parseFloat(s.trim()))
                  .filter(Number.isFinite);
                if (values.length > 0) {
                  updateTrack(index, { keyframes: values });
                }
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
