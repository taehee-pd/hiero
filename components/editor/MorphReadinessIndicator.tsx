/**
 * Morph readiness indicator and topology validation for the editor (Phase 8.4).
 *
 * Shows morph readiness score with green/yellow/red indicator in TransitionPanel.
 * Warns when geometry changes break existing strict-morph topology contracts.
 * Previews morph interpolation at key progress points.
 */

'use client';

import React, { useMemo, useState, useCallback } from 'react';
import type { State, Transition } from '@/lib/schema/types';
import type { MorphReadiness } from '@/lib/runtime-core/transition-resolver';
import { analyzeTopologyCompatibility } from '@/lib/runtime-core/topology-detection';

// ---------------------------------------------------------------------------
// 8.4b — Morph readiness indicator
// ---------------------------------------------------------------------------

type MorphReadinessIndicatorProps = {
  fromState: State;
  toState: State;
  transition: Transition;
  readiness?: MorphReadiness;
  /** UX-F3: Callback to switch strategy to crossfade/bestGuessMorph */
  onChangeStrategy?: (strategy: Transition['strategy']) => void;
  /** UX-F3: Callback to auto-fix layer bindings */
  onAutoFixBindings?: () => void;
};

function getReadinessLevel(
  score: number,
): { colorClass: string; label: string; description: string } {
  if (score >= 0.8) {
    return {
      colorClass: 'bg-green-500',
      label: 'Excellent',
      description: 'High-quality morph transition possible',
    };
  }
  if (score >= 0.5) {
    return {
      colorClass: 'bg-yellow-500',
      label: 'Acceptable',
      description: 'Morph possible with some visual artifacts',
    };
  }
  return {
    colorClass: 'bg-red-500',
    label: 'Poor',
    description: 'Crossfade fallback recommended',
  };
}

export function MorphReadinessIndicator({
  fromState,
  toState,
  transition: _transition,
  readiness,
  onChangeStrategy,
  onAutoFixBindings,
}: MorphReadinessIndicatorProps) {
  const topology = useMemo(
    () => analyzeTopologyCompatibility(fromState, toState),
    [fromState, toState],
  );

  const score = readiness?.score ?? 0;
  const level = getReadinessLevel(score);
  const strategy = readiness?.recommendedStrategy ?? topology.recommendedStrategy;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/50 p-3">
      {/* Score indicator */}
      <div className="flex items-center gap-2">
        <div className={`size-3 shrink-0 rounded-full ${level.colorClass}`} />
        <span className="text-[13px] font-semibold">
          Morph Readiness: {level.label}
        </span>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {(score * 100).toFixed(0)}%
        </span>
      </div>

      {/* Score breakdown */}
      {readiness && (
        <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground/70">
          <ScoreRow label="Commands" value={readiness.commandCompatibility} />
          <ScoreRow label="Sub-paths" value={readiness.subpathCompatibility} />
          <ScoreRow label="Closed/Open" value={readiness.closedCompatibility} />
          <ScoreRow label="BBox" value={readiness.bboxSimilarity} />
          <ScoreRow label="Centroid" value={readiness.centroidSimilarity} />
          <ScoreRow label="Role" value={readiness.semanticRoleMatch} />
        </div>
      )}

      {/* Recommended strategy */}
      <div className="text-xs text-muted-foreground">
        <strong>Strategy:</strong>{' '}
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
            strategy === 'morph'
              ? 'bg-green-100 text-green-800'
              : strategy === 'crossfade'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-pink-100 text-pink-800'
          }`}
        >
          {strategy}
        </span>
      </div>

      {/* UX-F3: Actionable guidance based on readiness dimensions */}
      {score < 0.8 && (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted p-2">
          <div className="text-[11px] font-semibold text-muted-foreground">
            Suggestions
          </div>

          {/* Tip for low command/subpath compatibility */}
          {readiness && readiness.commandCompatibility < 0.5 && (
            <div className="text-[11px] text-muted-foreground/70">
              Path commands differ significantly. Consider simplifying shapes or matching point counts.
            </div>
          )}

          {/* Tip for low bbox similarity */}
          {readiness && readiness.bboxSimilarity < 0.5 && (
            <div className="text-[11px] text-muted-foreground/70">
              Bounding boxes differ. Aligning layer sizes across states improves morph quality.
            </div>
          )}

          {/* Auto-fix bindings button */}
          {onAutoFixBindings && (
            <button
              type="button"
              onClick={onAutoFixBindings}
              className="cursor-pointer rounded border border-blue-300 bg-blue-50 px-2 py-1 text-center text-[11px] font-medium text-blue-600 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Auto-fix bindings
            </button>
          )}

          {/* Switch to crossfade button when morph quality is poor */}
          {score < 0.5 && onChangeStrategy && strategy !== 'crossfade' && (
            <button
              type="button"
              onClick={() => onChangeStrategy('replace')}
              className="cursor-pointer rounded border px-2 py-1 text-center text-[11px] font-medium status-warning-surface hover:opacity-80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Switch to crossfade
            </button>
          )}

          {/* Switch to bestGuessMorph when strict morph is failing */}
          {_transition.strategy === 'strictMorph' && score < 0.8 && onChangeStrategy && (
            <button
              type="button"
              onClick={() => onChangeStrategy('bestGuessMorph')}
              className="cursor-pointer rounded border px-2 py-1 text-center text-[11px] font-medium status-success-surface hover:opacity-80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Try best-guess morph instead
            </button>
          )}
        </div>
      )}

      {/* Topology warnings */}
      {!topology.compatible && (
        <TopologyWarnings
          incompatibilities={topology.incompatibilities}
          details={topology.details}
        />
      )}

      {/* Morph reasons */}
      {readiness?.reasons && readiness.reasons.length > 0 && (
        <div className="text-[11px] text-muted-foreground/70">
          {readiness.reasons.map((reason) => (
            <div key={reason}>• {reason}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8.4a — Geometry change warnings
// ---------------------------------------------------------------------------

type TopologyWarningsProps = {
  incompatibilities: string[];
  details: string[];
};

function TopologyWarnings({ incompatibilities, details }: TopologyWarningsProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-md border p-2 text-xs status-error-surface"
      role="alert"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full cursor-pointer items-center gap-1 font-medium hover:opacity-80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>
          ▶
        </span>
        Topology Warning: {incompatibilities.length} issue{incompatibilities.length > 1 ? 's' : ''} detected
      </button>
      {expanded && (
        <div className="mt-1.5 pl-4 text-red-900">
          {details.map((detail, i) => (
            <div key={i} className="mb-0.5">
              • {detail}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8.4c — Morph quality preview
// ---------------------------------------------------------------------------

type MorphPreviewProps = {
  fromD: string;
  toD: string;
  viewBox: [number, number, number, number];
  /** Morph interpolator function. */
  interpolate?: (t: number) => string;
  size?: number;
};

const PREVIEW_STEPS = [0, 0.25, 0.5, 0.75, 1.0];

export function MorphPreview({
  fromD,
  toD,
  viewBox,
  interpolate,
  size = 48,
}: MorphPreviewProps) {
  const getPathAtProgress = useCallback(
    (t: number) => {
      if (!interpolate) {
        return t < 0.5 ? fromD : toD;
      }
      return interpolate(t);
    },
    [interpolate, fromD, toD],
  );

  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted p-2">
      {PREVIEW_STEPS.map((step) => (
        <div key={step} className="text-center">
          <svg
            width={size}
            height={size}
            viewBox={viewBox.join(' ')}
            className="rounded border border-border bg-background"
          >
            <path
              d={getPathAtProgress(step)}
              fill="currentColor"
            />
          </svg>
          <div className="mt-0.5 text-[9px] text-muted-foreground/70">
            {(step * 100).toFixed(0)}%
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score display helper
// ---------------------------------------------------------------------------

function ScoreRow({ label, value }: { label: string; value: number }) {
  const pct = (value * 100).toFixed(0);
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span
        className={`font-mono ${
          value >= 0.8 ? 'text-green-500' : value >= 0.5 ? 'text-yellow-500' : 'text-red-500'
        }`}
      >
        {pct}%
      </span>
    </div>
  );
}
