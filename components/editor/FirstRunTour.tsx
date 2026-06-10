'use client';

/**
 * B2 — first-run walkthrough (docs_canonical/IMPROVEMENT_BACKLOG.md).
 *
 * A small, dismissible card that walks a new user through the core
 * loop: create/import → animate → preview → publish. Deliberately
 * not a modal and not animated: it never blocks the canvas, renders
 * statically (so `prefers-reduced-motion` is trivially honored), and
 * never auto-replays — dismissal persists in localStorage.
 */

import { useCallback, useEffect, useState } from 'react';
import { Icon as UiIcon } from '@hiero/ui-icons';
import { Button } from '@/components/ui/button';

export const TOUR_DISMISSED_KEY = 'hiero:first-run-tour-dismissed';

type TourStep = {
  title: string;
  body: string;
};

const STEPS: TourStep[] = [
  {
    title: 'Create or import icons',
    body: 'Start with "New icon", drag an SVG onto the canvas, or press ⌘K and pick "Add example icons" to explore finished, animated icons.',
  },
  {
    title: 'Animate',
    body: 'Open "Play (morph demo)" from the icon list, then use the Animate panel on the right — the engine picks the morph strategy for you.',
  },
  {
    title: 'Preview',
    body: 'Press Preview in the Animate panel to scrub the transition. The draw-on Check example shows trim-path line animation.',
  },
  {
    title: 'Publish',
    body: 'When an icon is ready, Publish (top right) exports it as runtime JSON, Lottie, or a React library — or syncs it to a repo.',
  },
];

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(TOUR_DISMISSED_KEY) === '1';
  } catch {
    // Storage blocked — show the tour but accept that it will reappear.
    return false;
  }
}

function persistDismissed(): void {
  try {
    window.localStorage.setItem(TOUR_DISMISSED_KEY, '1');
  } catch {
    // Best-effort only.
  }
}

export function FirstRunTour() {
  // Start hidden and reveal after mount so SSR markup never disagrees
  // with the client (localStorage is client-only).
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!readDismissed()) setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    persistDismissed();
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, dismiss]);

  if (!visible) return null;

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  return (
    <aside
      role="complementary"
      aria-label="Getting started walkthrough"
      data-testid="first-run-tour"
      className="fixed bottom-4 right-4 z-40 w-72 rounded-xl border border-border bg-background p-4 shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[length:var(--text-label)] font-medium text-muted-foreground">
          Getting started · {step + 1}/{STEPS.length}
        </p>
        <button
          type="button"
          aria-label="Dismiss walkthrough"
          className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          onClick={dismiss}
        >
          <UiIcon name="x" size={14} className="size-3.5" />
        </button>
      </div>
      <h2 className="mt-1 text-sm font-semibold text-foreground">{current.title}</h2>
      <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{current.body}</p>
      <div className="mt-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Skip
        </Button>
        <div className="flex gap-1.5">
          {step > 0 && (
            <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              if (isLast) dismiss();
              else setStep((s) => s + 1);
            }}
          >
            {isLast ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </aside>
  );
}
