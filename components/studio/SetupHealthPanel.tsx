/**
 * SetupHealthPanel — quick at-a-glance view of config health.
 *
 * Reads the validated `HieroConfig` shape (passed in by the caller —
 * usually the studio shell or a settings drawer) and runs config-side
 * health checks. Credential-side checks (GitHub token, npm token) are
 * intentionally NOT done here; per the eng-review rule, those values
 * never enter the client bundle. The CLI's `hiero init --check`
 * surfaces them at the dev-server level instead.
 */

'use client';

import {
  runConfigHealthChecks,
  type ConfigHealthCheck,
} from '@/lib/install-config/health-checks';
import { StatusBadge } from '@/components/ds/status-badge';

export function SetupHealthPanel({ config }: { config: unknown }) {
  const checks = runConfigHealthChecks(config);
  return (
    <section
      className="flex flex-col gap-2 rounded-md border bg-background/40 p-3 text-sm"
      data-testid="setup-health-panel"
    >
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Setup health</h3>
        <span className="text-[10px] text-muted-foreground">
          run `hiero init --check` for credential checks
        </span>
      </header>
      <ul className="flex flex-col gap-1">
        {checks.map((c) => (
          <li key={c.name} className="flex items-center justify-between gap-2">
            <span>{c.name}</span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <StatusBadge variant={statusVariant(c.status)}>
                {c.status}
              </StatusBadge>
              {c.detail}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function statusVariant(s: ConfigHealthCheck['status']) {
  if (s === 'ok') return 'success' as const;
  if (s === 'warn') return 'warning' as const;
  return 'danger' as const;
}
