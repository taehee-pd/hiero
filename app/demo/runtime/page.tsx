'use client';

import { VibeIcon, useIconState } from '@/lib/runtime-react';
import { HAMBURGER_CLOSE_ICON } from '@/lib/schema/sample-icons/hamburger-close';

export default function RuntimeDemoPage() {
  const { state, transitionTo } = useIconState('open');

  return (
    <main className="flex min-h-dvh items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <VibeIcon
          icon={HAMBURGER_CLOSE_ICON}
          variant="24"
          state={state}
          size={72}
        />
        <button
          type="button"
          className="rounded border px-4 py-2"
          onClick={() => transitionTo(state === 'open' ? 'closed' : 'open')}
        >
          Toggle
        </button>
        <p>Current state: {state}</p>
      </div>
    </main>
  );
}
