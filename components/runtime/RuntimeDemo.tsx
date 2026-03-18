'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { RuntimeSvgRenderer } from '@/lib/runtime-dom';
import { Icon } from '@/lib/runtime-react/icon';
import { SAMPLE_RUNTIME_PAYLOAD } from '@/lib/runtime-react/demo-fixture';
import { useIcon } from '@/lib/runtime-react/use-icon';

const payload = SAMPLE_RUNTIME_PAYLOAD;

export function RuntimeDemo() {
  const [controlledState, setControlledState] = useState<'default' | 'active'>('default');
  const [controlledEffect, setControlledEffect] = useState<string | null>(null);
  const controlledEffectTimerRef = useRef<number | undefined>(undefined);
  const uncontrolled = useIcon({
    payload,
    defaultState: 'default',
  });

  useEffect(
    () => () => {
      if (controlledEffectTimerRef.current !== undefined) {
        window.clearTimeout(controlledEffectTimerRef.current);
      }
    },
    [],
  );

  function triggerControlledEffect(effectId: string, timeoutMs: number) {
    setControlledEffect(effectId);
    if (controlledEffectTimerRef.current !== undefined) {
      window.clearTimeout(controlledEffectTimerRef.current);
    }
    controlledEffectTimerRef.current = window.setTimeout(() => {
      setControlledEffect(null);
      controlledEffectTimerRef.current = undefined;
    }, timeoutMs);
  }

  return (
    <main className="min-h-screen overflow-y-auto px-5 py-8 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="studio-panel overflow-hidden rounded-[28px] border border-border/70">
          <div className="studio-dots flex flex-col gap-6 bg-gradient-to-br from-background via-background to-primary/6 px-6 py-8 sm:px-8">
            <div className="flex flex-col gap-3">
              <span className="studio-chip w-fit">Runtime React Demo</span>
              <h1 className="max-w-3xl font-display text-2xl font-semibold tracking-[-0.08em] text-foreground sm:text-[3.25rem] sm:leading-[3.6rem]">
                Store-backed icons with controlled props, local state, and runtime-json playback.
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground">
                This route is the Phase 4 validation path: the top preview is prop-driven
                through the new <code>{'<Icon />'}</code> component, and the lower preview uses
                the <code>useIcon()</code> hook directly for local state and effect playback.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <article className="studio-card flex flex-col gap-5 rounded-[24px] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="studio-kicker">Controlled</p>
                    <h2 className="mt-2 text-lg font-semibold">
                      <code>{'<Icon />'}</code> prop flow
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Parent state owns the icon state, and effects can be triggered through props.
                    </p>
                  </div>
                  <div className="rounded-full border border-border/80 bg-background/90 px-3 py-1 text-xs font-medium text-muted-foreground">
                    state={controlledState}
                  </div>
                </div>

                <div className="studio-preview flex min-h-72 items-center justify-center rounded-[20px] border border-border/60">
                  <Icon
                    payload={payload}
                    state={controlledState}
                    effect={controlledEffect}
                    effectRepeat="once"
                    size={148}
                    className="text-foreground drop-shadow-[0_12px_24px_color-mix(in_oklab,var(--primary)_18%,transparent)]"
                    transition
                    title="Controlled runtime icon preview"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={controlledState === 'default' ? 'default' : 'outline'}
                    onClick={() => setControlledState('default')}
                  >
                    Default
                  </Button>
                  <Button
                    variant={controlledState === 'active' ? 'default' : 'outline'}
                    onClick={() => setControlledState('active')}
                  >
                    Active
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => triggerControlledEffect('drawOn', 360)}
                  >
                    Draw Effect
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => triggerControlledEffect('pulse', 420)}
                  >
                    Pulse Effect
                  </Button>
                </div>
              </article>

              <article className="studio-card flex flex-col gap-5 rounded-[24px] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="studio-kicker">Uncontrolled</p>
                    <h2 className="mt-2 text-lg font-semibold">
                      <code>useIcon()</code> local flow
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      The hook owns runtime state, exposes imperative controls, and streams a
                      snapshot into the SVG renderer.
                    </p>
                  </div>
                  <div className="rounded-full border border-border/80 bg-background/90 px-3 py-1 text-xs font-medium text-muted-foreground">
                    active={uncontrolled.activeTransitionId ?? uncontrolled.activeEffectId ?? 'idle'}
                  </div>
                </div>

                <div className="studio-preview flex min-h-72 items-center justify-center rounded-[20px] border border-border/60">
                  <RuntimeSvgRenderer
                    snapshot={uncontrolled.snapshot}
                    size={148}
                    className="text-foreground drop-shadow-[0_12px_24px_color-mix(in_oklab,var(--primary)_18%,transparent)]"
                    title="Uncontrolled runtime icon preview"
                    data-runtime-state={uncontrolled.currentStateId}
                    data-runtime-settled-state={uncontrolled.settledStateId}
                    data-runtime-transition={uncontrolled.activeTransitionId}
                    data-runtime-effect={uncontrolled.activeEffectId}
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant={uncontrolled.currentStateId === 'default' ? 'default' : 'outline'}
                    onClick={() => uncontrolled.setState('default')}
                  >
                    Default
                  </Button>
                  <Button
                    variant={uncontrolled.currentStateId === 'active' ? 'default' : 'outline'}
                    onClick={() => uncontrolled.setState('active')}
                  >
                    Active
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => uncontrolled.playEffect('drawOn')}
                  >
                    Play Draw
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => uncontrolled.playEffect('pulse')}
                  >
                    Play Pulse
                  </Button>
                </div>

                <div className="grid gap-2 rounded-[18px] border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between gap-4">
                    <span>Current state</span>
                    <code className="text-foreground">{uncontrolled.currentStateId}</code>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Settled state</span>
                    <code className="text-foreground">{uncontrolled.settledStateId}</code>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Animating</span>
                    <code className="text-foreground">{String(uncontrolled.isAnimating)}</code>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
