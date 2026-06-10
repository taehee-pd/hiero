'use client';

/**
 * C1 — read-only shared-icon viewer (docs_canonical/IMPROVEMENT_BACKLOG.md).
 *
 * Renders the icon encoded in the URL fragment with playback controls:
 * variant transitions (the runtime animates between them) and effect
 * triggers. No editing, no account, no persistence — the link IS the
 * document.
 */

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Icon as UiIcon } from '@hiero/ui-icons';

import { Button } from '@/components/ui/button';
import { HieroIcon, type HieroIconHandle } from '@/lib/runtime-react/HieroIcon';
import { decodeSharePayload, type SharePayload } from '@/lib/platform/share-link';

type ViewState =
  | { status: 'loading' }
  | { status: 'invalid' }
  | { status: 'ready'; payload: SharePayload };

export function SharedIconView() {
  const [view, setView] = useState<ViewState>({ status: 'loading' });
  const [variantId, setVariantId] = useState<string | null>(null);
  const iconRef = useRef<HieroIconHandle>(null);

  useEffect(() => {
    const payload = decodeSharePayload(window.location.hash);
    if (!payload) {
      setView({ status: 'invalid' });
      return;
    }
    setView({ status: 'ready', payload });
    setVariantId(Object.keys(payload.icon.variants)[0] ?? null);
  }, []);

  if (view.status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        <UiIcon name="loader-2" size={16} className="mr-2 size-4 animate-spin" />
        Loading shared icon…
      </main>
    );
  }

  if (view.status === 'invalid') {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm space-y-3 text-center" role="alert">
          <p className="text-base font-semibold text-foreground">This share link is broken</p>
          <p className="text-sm text-muted-foreground">
            The icon data in the link is missing or damaged. Ask the sender to copy
            the preview link again from Hiero.
          </p>
          <Button asChild variant="outline">
            <Link href="/">Open Hiero</Link>
          </Button>
        </div>
      </main>
    );
  }

  const { icon } = view.payload;
  const variantIds = Object.keys(icon.variants);
  const effects = Object.values(icon.effects ?? {});
  const transitions = Object.values(icon.transitions ?? {});

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <header className="flex flex-col items-center gap-1 text-center">
        <p className="text-[length:var(--text-label)] font-medium text-muted-foreground">
          Shared from Hiero — read-only preview
        </p>
        <h1 className="text-lg font-semibold text-foreground">{icon.name}</h1>
      </header>

      <div className="flex min-h-56 min-w-56 items-center justify-center rounded-xl border border-border bg-background p-8">
        <HieroIcon
          ref={iconRef}
          icon={icon}
          variant={variantId ?? undefined}
          size={160}
          label={icon.name}
          reduceMotion="system"
        />
      </div>

      {variantIds.length > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label="Variants">
          {variantIds.map((id) => (
            <Button
              key={id}
              size="sm"
              variant={id === variantId ? 'default' : 'outline'}
              onClick={() => {
                setVariantId(id);
                iconRef.current?.transitionTo(id);
              }}
            >
              {icon.variants[id]?.name ?? id}
            </Button>
          ))}
        </div>
      )}

      {effects.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label="Effects">
          {effects.map((effect) => (
            <Button
              key={effect.id}
              size="sm"
              variant="outline"
              onClick={() => iconRef.current?.triggerEffect(effect.id)}
            >
              <UiIcon name="play" size={14} className="size-3.5" />
              {effect.id}
            </Button>
          ))}
        </div>
      )}

      {transitions.length > 0 && (
        <p className="max-w-md text-center text-xs text-muted-foreground">
          This icon also authors {transitions.length} cross-icon transition
          {transitions.length === 1 ? '' : 's'} (e.g. a morph to another icon) —
          open the project in Hiero to preview those.
        </p>
      )}

      <Button asChild variant="ghost" size="sm">
        <Link href="/">
          Made with Hiero — open the studio
        </Link>
      </Button>
    </main>
  );
}
