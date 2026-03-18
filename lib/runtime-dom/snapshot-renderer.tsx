import React, { forwardRef, useId } from 'react';

import type {
  RuntimeClipPath,
  RuntimePaint,
} from '@/lib/export/export-runtime-json';
import type {
  RuntimeSnapshot,
  RuntimeSnapshotLayer,
} from '@/lib/runtime-core/store';

export type RuntimeSvgRendererProps = React.SVGProps<SVGSVGElement> & {
  snapshot: RuntimeSnapshot;
  size?: number;
  title?: string;
};

export const RuntimeSvgRenderer = forwardRef<SVGSVGElement, RuntimeSvgRendererProps>(
  function RuntimeSvgRenderer(
    { snapshot, size, title, children, ...svgProps },
    ref,
  ) {
    const rawId = useId();
    const prefix = rawId.replace(/:/g, '');
    const defs = collectDefs(snapshot.layers, prefix);

    return (
      <svg
        {...svgProps}
        ref={ref}
        width={size ?? snapshot.viewBox[2]}
        height={size ?? snapshot.viewBox[3]}
        viewBox={snapshot.viewBox.join(' ')}
      >
        {title ? <title>{title}</title> : null}
        {defs.length > 0 ? <defs>{defs}</defs> : null}
        <g transform={snapshot.groupTransform} opacity={snapshot.groupOpacity}>
          {snapshot.layers.map((layer) => (
            <path
              key={layer.key}
              d={layer.d}
              fill={resolvePaintValue(layer.fill, prefix, layer.key, 'fill')}
              fillOpacity={layer.fillOpacity}
              stroke={resolvePaintValue(layer.stroke, prefix, layer.key, 'stroke')}
              strokeOpacity={layer.strokeOpacity}
              strokeWidth={layer.strokeWidth}
              strokeLinecap={
                layer.lineCap as React.SVGProps<SVGPathElement>['strokeLinecap']
              }
              strokeLinejoin={
                layer.lineJoin as React.SVGProps<SVGPathElement>['strokeLinejoin']
              }
              fillRule={layer.fillRule}
              transform={layer.transform}
              opacity={layer.opacity}
              clipPath={
                layer.clipPath ? `url(#${buildClipPathId(prefix, layer.key)})` : undefined
              }
              pathLength={layer.pathLengthProgress !== undefined ? 1 : undefined}
              strokeDasharray={layer.pathLengthProgress !== undefined ? 1 : undefined}
              strokeDashoffset={
                layer.pathLengthProgress !== undefined
                  ? 1 - layer.pathLengthProgress
                  : undefined
              }
            />
          ))}
        </g>
        {children}
      </svg>
    );
  },
);

function collectDefs(
  layers: RuntimeSnapshot['layers'],
  prefix: string,
): React.ReactNode[] {
  const defs: React.ReactNode[] = [];

  for (const layer of layers) {
    if (layer.fill.kind === 'linearGradient') {
      defs.push(
        <linearGradient
          key={buildPaintId(prefix, layer.key, 'fill')}
          id={buildPaintId(prefix, layer.key, 'fill')}
          gradientTransform={`rotate(${layer.fill.angle})`}
        >
          {layer.fill.stops.map((stop, index) => (
            <stop
              key={`${buildPaintId(prefix, layer.key, 'fill')}-${index}`}
              offset={`${stop.offset * 100}%`}
              stopColor={stop.color}
              stopOpacity={stop.opacity}
            />
          ))}
        </linearGradient>,
      );
    }

    if (layer.fill.kind === 'radialGradient') {
      defs.push(
        <radialGradient
          key={buildPaintId(prefix, layer.key, 'fill')}
          id={buildPaintId(prefix, layer.key, 'fill')}
          cx={layer.fill.cx}
          cy={layer.fill.cy}
          r={layer.fill.r}
        >
          {layer.fill.stops.map((stop, index) => (
            <stop
              key={`${buildPaintId(prefix, layer.key, 'fill')}-${index}`}
              offset={`${stop.offset * 100}%`}
              stopColor={stop.color}
              stopOpacity={stop.opacity}
            />
          ))}
        </radialGradient>,
      );
    }

    if (layer.stroke.kind === 'linearGradient') {
      defs.push(
        <linearGradient
          key={buildPaintId(prefix, layer.key, 'stroke')}
          id={buildPaintId(prefix, layer.key, 'stroke')}
          gradientTransform={`rotate(${layer.stroke.angle})`}
        >
          {layer.stroke.stops.map((stop, index) => (
            <stop
              key={`${buildPaintId(prefix, layer.key, 'stroke')}-${index}`}
              offset={`${stop.offset * 100}%`}
              stopColor={stop.color}
              stopOpacity={stop.opacity}
            />
          ))}
        </linearGradient>,
      );
    }

    if (layer.stroke.kind === 'radialGradient') {
      defs.push(
        <radialGradient
          key={buildPaintId(prefix, layer.key, 'stroke')}
          id={buildPaintId(prefix, layer.key, 'stroke')}
          cx={layer.stroke.cx}
          cy={layer.stroke.cy}
          r={layer.stroke.r}
        >
          {layer.stroke.stops.map((stop, index) => (
            <stop
              key={`${buildPaintId(prefix, layer.key, 'stroke')}-${index}`}
              offset={`${stop.offset * 100}%`}
              stopColor={stop.color}
              stopOpacity={stop.opacity}
            />
          ))}
        </radialGradient>,
      );
    }

    if (layer.clipPath) {
      defs.push(renderClipPath(prefix, layer, layer.clipPath));
    }
  }

  return defs;
}

function renderClipPath(
  prefix: string,
  layer: RuntimeSnapshotLayer,
  clipPath: RuntimeClipPath,
): React.ReactNode {
  return (
    <clipPath key={buildClipPathId(prefix, layer.key)} id={buildClipPathId(prefix, layer.key)}>
      <path d={clipPath.d} fillRule={clipPath.fillRule} transform={clipPath.transform} />
    </clipPath>
  );
}

function resolvePaintValue(
  paint: RuntimePaint,
  prefix: string,
  layerKey: string,
  role: 'fill' | 'stroke',
): string {
  switch (paint.kind) {
    case 'none':
      return 'none';
    case 'currentColor':
      return 'currentColor';
    case 'solid':
      return paint.color;
    case 'linearGradient':
    case 'radialGradient':
      return `url(#${buildPaintId(prefix, layerKey, role)})`;
  }
}

function buildPaintId(
  prefix: string,
  layerKey: string,
  role: 'fill' | 'stroke',
): string {
  return `${prefix}-${layerKey}-${role}`;
}

function buildClipPathId(prefix: string, layerKey: string): string {
  return `${prefix}-${layerKey}-clip`;
}
