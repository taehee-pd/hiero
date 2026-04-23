'use client';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';

import { AnimationStudioPanel } from './AnimationStudioPanel';
import { TransitionPanel } from './TransitionPanel';

export type AnimationKind = 'transition' | 'effects';

const ANIMATION_KIND_OPTIONS: Array<{ value: AnimationKind; label: string }> = [
  { value: 'transition', label: 'Transition' },
  { value: 'effects', label: 'Effects' },
];

/**
 * AnimatePanel — unified top-level container for the Animation tab.
 *
 * Implements the §2.1 IA from docs_canonical/ANIMATE_PANEL_REVAMP_PLAN.md:
 * a single "Animation" section at the top selects the kind of animation
 * (Transition vs Effects), then the selected sub-panel renders Playback
 * Mode / Timing / Preview / Advanced.
 *
 * Controlled on purpose — the parent owns `kind` so the selection survives
 * the Right Sidebar's `key={rightTab}` remount when users flip between
 * Inspect and Animation.
 */
export function AnimatePanel({
  kind,
  onKindChange,
  showTimelineEditor = false,
}: {
  kind: AnimationKind;
  onKindChange: (kind: AnimationKind) => void;
  showTimelineEditor?: boolean;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label className="text-[length:var(--text-label)] font-medium tracking-tight text-muted-foreground">
          Animation
        </Label>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={kind}
          onValueChange={(value) => {
            if (value) onKindChange(value as AnimationKind);
          }}
          className="h-8 w-full justify-stretch rounded-md border border-border/70"
        >
          {ANIMATION_KIND_OPTIONS.map((option) => (
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
      </div>

      {kind === 'transition' ? (
        <TransitionPanel />
      ) : (
        <AnimationStudioPanel showTimelineEditor={showTimelineEditor} />
      )}
    </div>
  );
}
