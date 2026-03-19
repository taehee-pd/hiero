/**
 * Geometry change warning component and validation hook (Phase 8.4a).
 *
 * Warns in the editor when a user modifies geometry that breaks an existing
 * strict-morph or best-guess-morph transition's topology contract.
 */

'use client';

import React, { useMemo, useState, useCallback } from 'react';
import type { State, Transition } from '@/lib/schema/types';
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
  stateId: string;
  issue: string;
  severity: 'error' | 'warning';
  suggestedAction: 'downgrade-to-crossfade' | 'review-bindings';
};

type GeometryChangeWarningProps = {
  /** Current icon states */
  states: Record<string, State>;
  /** All transitions defined for this icon */
  transitions: Transition[];
  /** The state that was just modified */
  modifiedStateId: string;
  /** The layer that was modified */
  modifiedLayerId: string;
  /** Previous path d-string before modification */
  previousD: string;
  /** New path d-string after modification */
  currentD: string;
  /** Callback when user dismisses warning */
  onDismiss?: () => void;
  /** Callback when user wants to auto-fix (downgrade strategy) */
  onDowngradeStrategy?: (transitionId: string, newStrategy: Transition['strategy']) => void;
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
 * Given transitions and a modified state+layer, find which transitions are
 * affected and produce warnings.
 */
function buildWarnings(
  states: Record<string, State>,
  transitions: Transition[],
  modifiedStateId: string,
  modifiedLayerId: string,
  previousD: string,
  currentD: string,
): GeometryWarning[] {
  const warnings: GeometryWarning[] = [];

  // Find transitions referencing the modified state
  const affectedTransitions = transitions.filter(
    (t) => t.from === modifiedStateId || t.to === modifiedStateId,
  );

  for (const transition of affectedTransitions) {
    // Only care about morph strategies
    if (
      transition.strategy !== 'strictMorph' &&
      transition.strategy !== 'bestGuessMorph'
    ) {
      continue;
    }

    // Check if the modified layer is part of a layer binding
    const hasBinding = transition.layerBindings.some(
      (binding) =>
        binding.fromLayerId === modifiedLayerId ||
        binding.toLayerId === modifiedLayerId,
    );

    if (!hasBinding && transition.layerBindings.length > 0) {
      // The modified layer is not part of any binding in this transition
      continue;
    }

    // Detect geometry breaks
    const breaks = detectGeometryBreaks(previousD, currentD);
    if (breaks.length === 0) continue;

    for (const brk of breaks) {
      const isError =
        brk.kind === 'subpath-count-changed' ||
        brk.kind === 'closed-status-changed';

      warnings.push({
        transitionId: transition.id,
        layerId: modifiedLayerId,
        stateId: modifiedStateId,
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
  states: Record<string, State>,
  transitions: Transition[],
): {
  warnings: GeometryWarning[];
  validateChange: (
    stateId: string,
    layerId: string,
    previousD: string,
    currentD: string,
  ) => GeometryWarning[];
  clearWarnings: () => void;
} {
  const [warnings, setWarnings] = useState<GeometryWarning[]>([]);

  const validateChange = useCallback(
    (
      stateId: string,
      layerId: string,
      previousD: string,
      currentD: string,
    ): GeometryWarning[] => {
      const newWarnings = buildWarnings(
        states,
        transitions,
        stateId,
        layerId,
        previousD,
        currentD,
      );
      if (newWarnings.length > 0) {
        setWarnings((prev) => [...prev, ...newWarnings]);
      }
      return newWarnings;
    },
    [states, transitions],
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
  states,
  transitions,
  modifiedStateId,
  modifiedLayerId,
  previousD,
  currentD,
  onDismiss,
  onDowngradeStrategy,
}: GeometryChangeWarningProps) {
  const warnings = useMemo(
    () =>
      buildWarnings(
        states,
        transitions,
        modifiedStateId,
        modifiedLayerId,
        previousD,
        currentD,
      ),
    [states, transitions, modifiedStateId, modifiedLayerId, previousD, currentD],
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 0,
      }}
    >
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
  transition?: Transition;
  onDismiss?: () => void;
  onDowngradeStrategy?: (transitionId: string, newStrategy: Transition['strategy']) => void;
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
  const borderColor = hasError ? '#f59e0b' : '#fbbf24';
  const bgColor = hasError ? '#fffbeb' : '#fefce8';

  const strategyLabel = transition?.strategy ?? 'unknown';
  const fromTo = transition
    ? `${transition.from} → ${transition.to}`
    : transitionId;

  return (
    <div
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        padding: 12,
        fontSize: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: collapsed ? 0 : 8,
        }}
      >
        <span style={{ fontSize: 14 }}>&#x26A0;</span>
        <span style={{ fontWeight: 600, color: '#92400e', flex: 1 }}>
          Geometry Change Breaks Transition
        </span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            all: 'unset',
            cursor: 'pointer',
            fontSize: 11,
            color: '#92400e',
            padding: '2px 4px',
          }}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Transition info */}
          <div
            style={{
              fontSize: 11,
              color: '#78350f',
              marginBottom: 8,
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            <span>Transition:</span>
            <span
              style={{
                padding: '1px 5px',
                borderRadius: 3,
                background: '#fde68a',
                fontFamily: 'monospace',
                fontSize: 10,
              }}
            >
              {fromTo}
            </span>
            <span
              style={{
                padding: '1px 5px',
                borderRadius: 3,
                background: '#fcd34d',
                fontFamily: 'monospace',
                fontSize: 10,
              }}
            >
              {strategyLabel}
            </span>
          </div>

          {/* Issue list */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              marginBottom: 10,
            }}
          >
            {warnings.map((w, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 6,
                  fontSize: 11,
                  color: '#78350f',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: w.severity === 'error' ? '#ef4444' : '#f59e0b',
                    marginTop: 4,
                    flexShrink: 0,
                  }}
                />
                <span>{w.issue}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6 }}>
            {hasError && onDowngradeStrategy && (
              <button
                onClick={() => onDowngradeStrategy(transitionId, 'replace')}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  padding: '4px 10px',
                  borderRadius: 4,
                  background: '#f59e0b',
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                Downgrade to crossfade
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  padding: '4px 10px',
                  borderRadius: 4,
                  border: '1px solid #d97706',
                  color: '#92400e',
                  fontSize: 11,
                  fontWeight: 500,
                }}
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
