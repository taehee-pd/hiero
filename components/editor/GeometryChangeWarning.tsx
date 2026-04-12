/**
 * Geometry change warning component and validation hook (Phase 8.4a).
 *
 * Warns in the editor when a user modifies geometry that breaks an existing
 * strict-morph or best-guess-morph transition's topology contract.
 */

'use client';

import React, { useMemo, useState, useCallback } from 'react';
import type { LayerSnapshot, LayerBinding } from '@/lib/schema/types';
import type { TransitionConfig } from '@/lib/runtime-core/transition-resolver';
import { canonicalizePath } from '@/lib/runtime-core/path-normalization';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GeometryBreak = {
  kind:
    | 'subpath-count-changed'
    | 'closed-status-changed'
    | 'command-signature-changed'
    | 'point-count-changed';
  detail: string;
  previous: string | number | boolean[];
  current: string | number | boolean[];
};

export type GeometryWarning = {
  transitionId: string;
  layerId: string;
  variantId: string;
  issue: string;
  severity: 'error' | 'warning';
  suggestedAction: 'downgrade-to-crossfade' | 'review-bindings';
};

type GeometryChangeWarningProps = {
  /** Current snapshot (layers + topology) */
  snapshot: LayerSnapshot;
  /** All transitions defined for this icon */
  transitions: TransitionConfig[];
  /** The layer that was modified */
  modifiedLayerId: string;
  /** Previous path d-string before modification */
  previousD: string;
  /** New path d-string after modification */
  currentD: string;
  /** Callback when user dismisses warning */
  onDismiss?: () => void;
  /** Callback when user wants to auto-fix (downgrade strategy) */
  onDowngradeStrategy?: (transitionId: string, newStrategy: TransitionConfig['strategy']) => void;
};

// ---------------------------------------------------------------------------
// 8.4a — Pure detection logic (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Compare two path d-strings and return a list of geometry breaks.
 *
 * A geometry break describes a structural change that would prevent a
 * strict morph transition from working correctly.
 */
export function detectGeometryBreaks(
  previousD: string,
  currentD: string,
): GeometryBreak[] {
  const breaks: GeometryBreak[] = [];

  if (!previousD && !currentD) return breaks;
  if (!previousD || !currentD) {
    breaks.push({
      kind: 'subpath-count-changed',
      detail: !previousD
        ? 'Path was added (previously empty)'
        : 'Path was removed (now empty)',
      previous: previousD ? canonicalizePath(previousD).stats.subpathCount : 0,
      current: currentD ? canonicalizePath(currentD).stats.subpathCount : 0,
    });
    return breaks;
  }

  const prevStats = canonicalizePath(previousD).stats;
  const currStats = canonicalizePath(currentD).stats;

  // Sub-path count change
  if (prevStats.subpathCount !== currStats.subpathCount) {
    breaks.push({
      kind: 'subpath-count-changed',
      detail: `Sub-path count changed from ${prevStats.subpathCount} to ${currStats.subpathCount}`,
      previous: prevStats.subpathCount,
      current: currStats.subpathCount,
    });
  }

  // Closed status change
  if (prevStats.closed.length === currStats.closed.length) {
    const closedChanged = prevStats.closed.some(
      (val, i) => val !== currStats.closed[i],
    );
    if (closedChanged) {
      breaks.push({
        kind: 'closed-status-changed',
        detail: `Closed/open status of sub-paths changed`,
        previous: prevStats.closed,
        current: currStats.closed,
      });
    }
  } else if (prevStats.subpathCount === currStats.subpathCount) {
    // Same sub-path count but different closed array length is unexpected;
    // treat as a closed-status change.
    breaks.push({
      kind: 'closed-status-changed',
      detail: 'Closed/open status array length changed unexpectedly',
      previous: prevStats.closed,
      current: currStats.closed,
    });
  }

  // Command signature change — compare the joined signature strings
  const prevSig = prevStats.commandSignature.join('');
  const currSig = currStats.commandSignature.join('');
  if (prevSig !== currSig) {
    // Only flag as a break if the difference is significant.
    // A significant difference means the command types changed,
    // not just coordinate values.
    const sigSimilarity = computeSignatureSimilarity(
      prevStats.commandSignature,
      currStats.commandSignature,
    );
    if (sigSimilarity < 0.8) {
      breaks.push({
        kind: 'command-signature-changed',
        detail: `Command signature changed significantly (${(sigSimilarity * 100).toFixed(0)}% similar)`,
        previous: prevSig,
        current: currSig,
      });
    }
  }

  // Point count change (less severe, but worth noting)
  if (prevStats.pointCount !== currStats.pointCount) {
    breaks.push({
      kind: 'point-count-changed',
      detail: `Point count changed from ${prevStats.pointCount} to ${currStats.pointCount}`,
      previous: prevStats.pointCount,
      current: currStats.pointCount,
    });
  }

  return breaks;
}

/**
 * Compute a similarity ratio (0..1) between two command signature arrays.
 * Uses a longest-common-subsequence approach.
 */
function computeSignatureSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const maxLen = Math.max(a.length, b.length);
  const lcs = longestCommonSubsequenceLength(a, b);
  return lcs / maxLen;
}

function longestCommonSubsequenceLength(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  // Use two rows for space efficiency
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1]! + 1;
      } else {
        curr[j] = Math.max(prev[j]!, curr[j - 1]!);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }

  return prev[n]!;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Given transitions and a modified variant+layer, find which transitions are
 * affected and produce warnings.
 */
function buildWarnings(
  snapshot: LayerSnapshot,
  transitions: TransitionConfig[],
  modifiedLayerId: string,
  previousD: string,
  currentD: string,
): GeometryWarning[] {
  const warnings: GeometryWarning[] = [];

  // Check all morph transitions for the modified layer
  for (const transition of transitions) {
    // Only care about morph strategies
    if (
      transition.strategy !== 'strictMorph' &&
      transition.strategy !== 'bestGuessMorph'
    ) {
      continue;
    }

    const bindings = transition.layerBindings ?? [];

    // Check if the modified layer is part of a layer binding
    const hasBinding = bindings.some(
      (binding: LayerBinding) =>
        binding.fromLayerId === modifiedLayerId ||
        binding.toLayerId === modifiedLayerId,
    );

    if (!hasBinding && bindings.length > 0) {
      // The modified layer is not part of any binding in this transition
      continue;
    }

    // Detect geometry breaks
    const breaks = detectGeometryBreaks(previousD, currentD);
    if (breaks.length === 0) continue;

    const transitionId = transition.id ?? 'unknown';

    for (const brk of breaks) {
      const isError =
        brk.kind === 'subpath-count-changed' ||
        brk.kind === 'closed-status-changed';

      warnings.push({
        transitionId,
        layerId: modifiedLayerId,
        variantId: transitionId,
        issue: brk.detail,
        severity: isError ? 'error' : 'warning',
        suggestedAction:
          isError ? 'downgrade-to-crossfade' : 'review-bindings',
      });
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// 8.4a — useGeometryValidation hook
// ---------------------------------------------------------------------------

export function useGeometryValidation(
  snapshot: LayerSnapshot,
  transitions: TransitionConfig[],
): {
  warnings: GeometryWarning[];
  validateChange: (
    layerId: string,
    previousD: string,
    currentD: string,
  ) => GeometryWarning[];
  clearWarnings: () => void;
} {
  const [warnings, setWarnings] = useState<GeometryWarning[]>([]);

  const validateChange = useCallback(
    (
      layerId: string,
      previousD: string,
      currentD: string,
    ): GeometryWarning[] => {
      const newWarnings = buildWarnings(
        snapshot,
        transitions,
        layerId,
        previousD,
        currentD,
      );
      if (newWarnings.length > 0) {
        setWarnings((prev) => [...prev, ...newWarnings]);
      }
      return newWarnings;
    },
    [snapshot, transitions],
  );

  const clearWarnings = useCallback(() => {
    setWarnings([]);
  }, []);

  return { warnings, validateChange, clearWarnings };
}

// ---------------------------------------------------------------------------
// 8.4a — GeometryChangeWarning component
// ---------------------------------------------------------------------------

export function GeometryChangeWarning({
  snapshot,
  transitions,
  modifiedLayerId,
  previousD,
  currentD,
  onDismiss,
  onDowngradeStrategy,
}: GeometryChangeWarningProps) {
  const warnings = useMemo(
    () =>
      buildWarnings(
        snapshot,
        transitions,
        modifiedLayerId,
        previousD,
        currentD,
      ),
    [snapshot, transitions, modifiedLayerId, previousD, currentD],
  );

  if (warnings.length === 0) return null;

  // Group warnings by transition
  const byTransition = new Map<string, GeometryWarning[]>();
  for (const w of warnings) {
    const existing = byTransition.get(w.transitionId) ?? [];
    existing.push(w);
    byTransition.set(w.transitionId, existing);
  }

  return (
    <div className="flex flex-col gap-2" role="alert" aria-live="polite">
      {Array.from(byTransition.entries()).map(([transitionId, transitionWarnings]) => (
        <TransitionWarningCard
          key={transitionId}
          transitionId={transitionId}
          warnings={transitionWarnings}
          transition={transitions.find((t) => t.id === transitionId)}
          onDismiss={onDismiss}
          onDowngradeStrategy={onDowngradeStrategy}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type TransitionWarningCardProps = {
  transitionId: string;
  warnings: GeometryWarning[];
  transition?: TransitionConfig;
  onDismiss?: () => void;
  onDowngradeStrategy?: (transitionId: string, newStrategy: TransitionConfig['strategy']) => void;
};

function TransitionWarningCard({
  transitionId,
  warnings,
  transition,
  onDismiss,
  onDowngradeStrategy,
}: TransitionWarningCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  const hasError = warnings.some((w) => w.severity === 'error');

  const strategyLabel = transition?.strategy ?? 'unknown';
  const fromTo = transition?.id ?? transitionId;

  return (
    <div
      className={`rounded-lg border p-3 text-xs ${
        'status-warning-surface'
      }`}
      role="alert"
      aria-live="polite"
    >
      {/* Header */}
      <div className={`flex items-center gap-1.5 ${collapsed ? '' : 'mb-2'}`}>
        <span className="text-sm">&#x26A0;</span>
        <span className="flex-1 font-semibold">
          Geometry Change Breaks Transition
        </span>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="cursor-pointer rounded px-1 py-0.5 text-[11px] hover:bg-background-warning focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Transition info */}
          <div className="mb-2 flex items-center gap-1.5 text-[11px]">
            <span>Transition:</span>
            <span className="rounded bg-background-warning-alt/20 px-1.5 py-px font-mono text-[10px]">
              {fromTo}
            </span>
            <span className="rounded bg-background-warning-alt/30 px-1.5 py-px font-mono text-[10px]">
              {strategyLabel}
            </span>
          </div>

          {/* Issue list */}
          <div className="mb-2.5 flex flex-col gap-1">
            {warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-start gap-1.5 text-[11px]"
              >
                <span
                  className={`mt-1 inline-block size-1.5 shrink-0 rounded-full ${
                    w.severity === 'error' ? 'bg-destructive' : 'bg-border-warning'
                  }`}
                />
                <span>{w.issue}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-1.5">
            {hasError && onDowngradeStrategy && (
              <button
                type="button"
                onClick={() => onDowngradeStrategy(transitionId, 'replace')}
                className="cursor-pointer rounded bg-border-warning px-2.5 py-1 text-[11px] font-medium text-foreground-fixed-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                Downgrade to crossfade
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="cursor-pointer rounded border border-border-warning px-2.5 py-1 text-[11px] font-medium hover:bg-background-warning focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                Dismiss
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
