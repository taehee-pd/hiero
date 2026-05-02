'use client';

/**
 * Plain-language fallback explanation (W4-5).
 *
 * When the cascade lands on a tier the designer might not expect
 * (T8 fallback when icons looked morphable, etc.), the
 * AnimationStudioPanel shows a single sentence in plain English.
 * The sentence is derived from `MorphResolution.signal` via
 * {@link useResolutionSentence} — never algorithm vocabulary.
 *
 * Aria-live polite — screen readers announce the sentence when
 * the resolution changes (e.g., the user picks a new target
 * icon).
 *
 * UX ref: docs_canonical/ICON_TRANSITION_UX_PLAN.md §6.3.
 */
import type { MorphResolution } from '@/lib/runtime-core/morph-resolution';
import { useResolutionSentence } from '@/lib/runtime-react/use-resolution-sentence';

type Props = {
  resolution: MorphResolution | null | undefined;
};

export function FallbackSentence({ resolution }: Props) {
  const sentence = useResolutionSentence(resolution);
  if (!sentence) return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className="rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
    >
      {sentence}
    </p>
  );
}
