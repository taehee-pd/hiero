/**
 * Morph readiness indicator and topology validation for the editor (Phase 8.4).
 *
 * Shows morph readiness score with green/yellow/red indicator in TransitionPanel.
 * Warns when geometry changes break existing strict-morph topology contracts.
 * Previews morph interpolation at key progress points.
 */

'use client';

import React, { useMemo, useState, useCallback } from 'react';
import type { Layer, State, Transition } from '@/lib/schema/types';
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
};

function getReadinessLevel(
  score: number,
): { color: string; label: string; description: string } {
  if (score >= 0.8) {
    return {
      color: '#22c55e',
      label: 'Excellent',
      description: 'High-quality morph transition possible',
    };
  }
  if (score >= 0.5) {
    return {
      color: '#eab308',
      label: 'Acceptable',
      description: 'Morph possible with some visual artifacts',
    };
  }
  return {
    color: '#ef4444',
    label: 'Poor',
    description: 'Crossfade fallback recommended',
  };
}

export function MorphReadinessIndicator({
  fromState,
  toState,
  transition,
  readiness,
}: MorphReadinessIndicatorProps) {
  const topology = useMemo(
    () => analyzeTopologyCompatibility(fromState, toState),
    [fromState, toState],
  );

  const score = readiness?.score ?? 0;
  const level = getReadinessLevel(score);
  const strategy = readiness?.recommendedStrategy ?? topology.recommendedStrategy;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        border: '1px solid var(--border, #e5e7eb)',
        background: 'var(--bg-secondary, #f9fafb)',
      }}
    >
      {/* Score indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: level.color,
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          Morph Readiness: {level.label}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: 'monospace',
            fontSize: 12,
            color: 'var(--text-secondary, #6b7280)',
          }}
        >
          {(score * 100).toFixed(0)}%
        </span>
      </div>

      {/* Score breakdown */}
      {readiness && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 4,
            fontSize: 11,
            color: 'var(--text-tertiary, #9ca3af)',
          }}
        >
          <ScoreRow label="Commands" value={readiness.commandCompatibility} />
          <ScoreRow label="Sub-paths" value={readiness.subpathCompatibility} />
          <ScoreRow label="Closed/Open" value={readiness.closedCompatibility} />
          <ScoreRow label="BBox" value={readiness.bboxSimilarity} />
          <ScoreRow label="Centroid" value={readiness.centroidSimilarity} />
          <ScoreRow label="Role" value={readiness.semanticRoleMatch} />
        </div>
      )}

      {/* Recommended strategy */}
      <div style={{ fontSize: 12, color: 'var(--text-secondary, #6b7280)' }}>
        <strong>Strategy:</strong>{' '}
        <span
          style={{
            padding: '2px 6px',
            borderRadius: 4,
            background: strategy === 'morph' ? '#dcfce7' : strategy === 'crossfade' ? '#fef9c3' : '#fce7f3',
            color: strategy === 'morph' ? '#166534' : strategy === 'crossfade' ? '#854d0e' : '#9d174d',
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          {strategy}
        </span>
      </div>

      {/* Topology warnings */}
      {!topology.compatible && (
        <TopologyWarnings
          incompatibilities={topology.incompatibilities}
          details={topology.details}
        />
      )}

      {/* Morph reasons */}
      {readiness?.reasons && readiness.reasons.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary, #9ca3af)' }}>
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
      style={{
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 6,
        padding: 8,
        fontSize: 12,
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          color: '#991b1b',
          fontWeight: 500,
        }}
      >
        <span style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
          ▶
        </span>
        Topology Warning: {incompatibilities.length} issue{incompatibilities.length > 1 ? 's' : ''} detected
      </button>
      {expanded && (
        <div style={{ marginTop: 6, paddingLeft: 16, color: '#7f1d1d' }}>
          {details.map((detail, i) => (
            <div key={i} style={{ marginBottom: 2 }}>
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
    <div
      style={{
        display: 'flex',
        gap: 4,
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
        background: 'var(--bg-tertiary, #f3f4f6)',
      }}
    >
      {PREVIEW_STEPS.map((step) => (
        <div key={step} style={{ textAlign: 'center' }}>
          <svg
            width={size}
            height={size}
            viewBox={viewBox.join(' ')}
            style={{
              border: '1px solid var(--border-light, #e5e7eb)',
              borderRadius: 4,
              background: 'white',
            }}
          >
            <path
              d={getPathAtProgress(step)}
              fill="currentColor"
            />
          </svg>
          <div
            style={{
              fontSize: 9,
              color: 'var(--text-tertiary, #9ca3af)',
              marginTop: 2,
            }}
          >
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
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>{label}</span>
      <span
        style={{
          fontFamily: 'monospace',
          color: value >= 0.8 ? '#22c55e' : value >= 0.5 ? '#eab308' : '#ef4444',
        }}
      >
        {pct}%
      </span>
    </div>
  );
}
