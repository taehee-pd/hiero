'use client';

import { Label } from '@/components/ui/label';
import type { StateTrigger } from '@/lib/schema/types';
import { cn } from '@/lib/utils';

const TRIGGER_EVENTS: StateTrigger['event'][] = ['hover', 'tap', 'longPress', 'focus', 'auto'];

const TRIGGER_DESCRIPTIONS: Record<StateTrigger['event'], string> = {
  hover: 'Trigger on mouse hover / pointer enter',
  tap: 'Trigger on click / tap',
  longPress: 'Trigger after sustained press (500ms+)',
  focus: 'Trigger when element receives keyboard focus',
  auto: 'Trigger automatically on mount',
};

/**
 * TriggerEditor — attach interaction trigger events to transitions.
 *
 * Triggers are advisory metadata for code generation: they tell the
 * generated React/Swift/Flutter components which DOM/native events
 * should initiate this transition. The runtime itself doesn't execute
 * triggers; it's the generated component wrapper that wires them up.
 */
export function TriggerEditor({
  triggers,
  onChange,
}: {
  triggers?: StateTrigger[];
  onChange: (triggers: StateTrigger[]) => void;
}) {
  const active = new Set((triggers ?? []).map((t) => t.event));

  return (
    <div className="grid gap-1.5">
      <Label className="text-[length:var(--text-label)] text-muted-foreground">
        Interaction triggers
      </Label>
      <p className="text-[length:var(--text-caption)] text-muted-foreground/70">
        Advisory metadata for generated component code.
      </p>
      <div className="flex flex-wrap gap-1">
        {TRIGGER_EVENTS.map((event) => (
          <button
            key={event}
            type="button"
            title={TRIGGER_DESCRIPTIONS[event]}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[length:var(--text-label)] font-medium transition-colors',
              active.has(event)
                ? 'bg-primary/15 text-primary'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
            onClick={() => {
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
