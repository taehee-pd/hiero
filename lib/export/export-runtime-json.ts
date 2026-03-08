import type {
  Effect,
  GradientStop,
  GuideItem,
  Icon,
  Layer,
  LayerBinding,
  PaintRef,
  Project,
  State,
  Transition,
  Variant,
} from '@/lib/schema/types';

export type RuntimeExportDiagnostic = {
  level: 'warning' | 'error';
  code:
    | 'missing-token'
    | 'invalid-transition'
    | 'invalid-effect'
    | 'invalid-draw-layer'
    | 'invalid-guide-master';
  iconId: string;
  variantId?: string;
  transitionId?: string;
  effectId?: string;
  message: string;
};

export type RuntimeGradientStop = GradientStop;

export type RuntimePaint =
  | { kind: 'none' }
  | { kind: 'currentColor' }
  | { kind: 'solid'; color: string }
  | {
      kind: 'linearGradient';
      angle: number;
      stops: RuntimeGradientStop[];
    }
  | {
      kind: 'radialGradient';
      cx: number;
      cy: number;
      r: number;
      stops: RuntimeGradientStop[];
    };

export type RuntimeClipPath = {
  d: string;
  fillRule?: 'nonzero' | 'evenodd';
  transform?: string;
};

export type RuntimeLayer = {
  id: string;
  d: string;
  fillRule?: 'nonzero' | 'evenodd';
  fill: RuntimePaint;
  stroke: RuntimePaint;
  strokeWidth?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
  lineCap?: string;
  lineJoin?: string;
  transform?: string;
  clipPath?: RuntimeClipPath;
};

export type RuntimeState = {
  layers: RuntimeLayer[];
};

export type RuntimeTrackProperty =
  | 'opacity'
  | 'rotate'
  | 'translateX'
  | 'translateY'
  | 'scale'
  | 'pathLength';

export type RuntimeTrack = {
  property: RuntimeTrackProperty;
  keyframes: number[];
};

export type RuntimeLayerBinding = {
  fromLayerId?: string;
  toLayerId?: string;
  tracks?: RuntimeTrack[];
  morph?: { topology: 'strict' | 'bestGuess' };
};

export type RuntimeMagicReplace = {
  preserveLayerIds?: string[];
  drawIntegrated?: boolean;
};

export type RuntimeTransition = {
  from: string;
  to: string;
  strategy: 'track' | 'morph' | 'replace';
  durationMs: number;
  easing: string;
  layerBindings: RuntimeLayerBinding[];
  magicReplace?: RuntimeMagicReplace;
};

export type RuntimeEffect = {
  kind: string;
  durationMs: number;
  easing?: string;
};

export type RuntimeDrawGuidePoint = {
  t: number;
  direction?: 'forward' | 'reverse';
};

export type RuntimeDrawAnnotation = {
  mode: 'byLayer';
  layers: Record<
    string,
    {
      guidePoints: RuntimeDrawGuidePoint[];
    }
  >;
};

export type RuntimeVariableDraw = {
  participatingLayerIds: string[];
};

export type RuntimeIconMeta = {
  id: string;
  name: string;
  category?: string;
  tags?: string[];
  variants: Record<
    string,
    {
      size: number;
      viewBox: [number, number, number, number];
      defaultState: string;
    }
  >;
};

export type RuntimeVariantPayload = {
  variant: {
    id: string;
    size: number;
    viewBox: [number, number, number, number];
    defaultState: string;
  };
  states: Record<string, RuntimeState>;
  transitions: Record<string, RuntimeTransition>;
  effects?: Record<string, RuntimeEffect>;
  draw?: RuntimeDrawAnnotation;
  variableDraw?: RuntimeVariableDraw;
};

export type RuntimeIconManifest = {
  icons: Array<{
    id: string;
    name: string;
    category?: string;
    tags?: string[];
    variants: string[];
  }>;
};

export function exportRuntimeIconVariant(
  project: Project,
  iconId: string,
  variantId: string,
): {
  meta: RuntimeIconMeta;
  variant: RuntimeVariantPayload;
  diagnostics: RuntimeExportDiagnostic[];
} {
  const icon = project.icons[iconId];
  if (!icon) {
    throw new Error(`Icon "${iconId}" not found.`);
  }

  const variant = icon.variants[variantId];
  if (!variant) {
    throw new Error(`Variant "${variantId}" not found for icon "${iconId}".`);
  }

  const diagnostics: RuntimeExportDiagnostic[] = [];
  const meta = buildIconMeta(icon);
  const runtimeStates = buildRuntimeStates(
    project,
    icon,
    variant,
    diagnostics,
  );
  const draw = buildDrawAnnotation(project, icon, variant, runtimeStates, diagnostics);
  const drawLayerIds = new Set(
    draw ? Object.keys(draw.layers) : [],
  );
  const transitions = buildRuntimeTransitions(
    icon,
    variant,
    runtimeStates,
    drawLayerIds,
    diagnostics,
  );
  const effects = buildRuntimeEffects(
    icon,
    variantId,
    drawLayerIds,
    diagnostics,
  );

  const payload: RuntimeVariantPayload = {
    variant: {
      id: variant.id,
      size: variant.size,
      viewBox: variant.viewBox,
      defaultState: variant.defaultState,
    },
    states: runtimeStates,
    transitions,
  };

  if (effects && Object.keys(effects).length > 0) {
    payload.effects = effects;
  }
  if (draw && Object.keys(draw.layers).length > 0) {
    payload.draw = draw;
    payload.variableDraw = {
      participatingLayerIds: Object.keys(draw.layers).sort((a, b) =>
        a.localeCompare(b),
      ),
    };
  }

  return {
    meta,
    variant: payload,
    diagnostics,
  };
}

export function exportRuntimePackage(project: Project): {
  manifest: RuntimeIconManifest;
  files: Array<{ path: string; contents: string }>;
  diagnostics: RuntimeExportDiagnostic[];
} {
  const iconIds = Object.keys(project.icons).sort((a, b) => a.localeCompare(b));
  const files: Array<{ path: string; contents: string }> = [];
  const manifestIcons: RuntimeIconManifest['icons'] = [];
  const diagnostics: RuntimeExportDiagnostic[] = [];

  for (const iconId of iconIds) {
    const icon = project.icons[iconId]!;
    const variantIds = Object.keys(icon.variants).sort((a, b) => a.localeCompare(b));
    const dir = `icons/${icon.id}`;

    manifestIcons.push({
      id: icon.id,
      name: icon.name,
      category: icon.category,
      tags: icon.tags ? [...icon.tags].sort((a, b) => a.localeCompare(b)) : undefined,
      variants: [...variantIds],
    });

    let wroteMeta = false;
    for (const variantId of variantIds) {
      const exported = exportRuntimeIconVariant(project, iconId, variantId);
      diagnostics.push(...exported.diagnostics);

      if (!wroteMeta) {
        files.push({
          path: `${dir}/meta.json`,
          contents: serializeRuntimeJson(exported.meta),
        });
        wroteMeta = true;
      }

      files.push({
        path: `${dir}/${variantId}.json`,
        contents: serializeRuntimeJson(exported.variant),
      });
    }
  }

  const manifest: RuntimeIconManifest = {
    icons: manifestIcons,
  };

  files.unshift({
    path: 'icons/index.json',
    contents: serializeRuntimeJson(manifest),
  });

  return {
    manifest,
    files,
    diagnostics,
  };
}

export function serializeRuntimeJson(value: unknown): string {
  return `${JSON.stringify(sortJsonValue(value), null, 2)}\n`;
}

function buildIconMeta(icon: Icon): RuntimeIconMeta {
  const variants = Object.keys(icon.variants)
    .sort((a, b) => a.localeCompare(b))
    .reduce<RuntimeIconMeta['variants']>((acc, variantId) => {
      const variant = icon.variants[variantId]!;
      acc[variantId] = {
        size: variant.size,
        viewBox: variant.viewBox,
        defaultState: variant.defaultState,
      };
      return acc;
    }, {});

  return {
    id: icon.id,
    name: icon.name,
    category: icon.category,
    tags: icon.tags ? [...icon.tags].sort((a, b) => a.localeCompare(b)) : undefined,
    variants,
  };
}

function buildRuntimeStates(
  project: Project,
  icon: Icon,
  variant: Variant,
  diagnostics: RuntimeExportDiagnostic[],
): Record<string, RuntimeState> {
  return Object.keys(variant.states)
    .sort((a, b) => a.localeCompare(b))
    .reduce<Record<string, RuntimeState>>((acc, stateId) => {
      const state = variant.states[stateId]!;
      const layerIds = Object.keys(state.layers).sort((a, b) => a.localeCompare(b));
      const layerById = new Map(layerIds.map((layerId) => [layerId, state.layers[layerId]!]));
      const layers: RuntimeLayer[] = [];

      for (const layerId of layerIds) {
        const layer = state.layers[layerId]!;
        const runtimeLayer = buildRuntimeLayer(
          project,
          icon.id,
          variant.id,
          layer,
          layerById,
          diagnostics,
        );

        if (runtimeLayer) {
          layers.push(runtimeLayer);
        }
      }

      acc[stateId] = { layers };
      return acc;
    }, {});
}

function buildRuntimeLayer(
  project: Project,
  iconId: string,
  variantId: string,
  layer: Layer,
  layerById: Map<string, Layer>,
  diagnostics: RuntimeExportDiagnostic[],
): RuntimeLayer | null {
  if (layer.visible === false || !layer.path?.d || layer.isClipMask) {
    return null;
  }

  const runtimeLayer: RuntimeLayer = {
    id: layer.id,
    d: layer.path.d,
    fill: resolveRuntimePaint(
      project,
      iconId,
      variantId,
      layer.style.fill,
      diagnostics,
    ),
    stroke: resolveRuntimePaint(
      project,
      iconId,
      variantId,
      layer.style.stroke,
      diagnostics,
    ),
  };

  if (layer.path.fillRule) {
    runtimeLayer.fillRule = layer.path.fillRule;
  }
  if (layer.style.strokeWidth !== undefined) {
    runtimeLayer.strokeWidth = layer.style.strokeWidth;
  }
  if (layer.style.fillOpacity !== undefined) {
    runtimeLayer.fillOpacity = layer.style.fillOpacity;
  }
  if (layer.style.strokeOpacity !== undefined) {
    runtimeLayer.strokeOpacity = layer.style.strokeOpacity;
  }
  if (layer.style.lineCap) {
    runtimeLayer.lineCap = layer.style.lineCap;
  }
  if (layer.style.lineJoin) {
    runtimeLayer.lineJoin = layer.style.lineJoin;
  }

  const transform = buildTransformString(layer);
  if (transform) {
    runtimeLayer.transform = transform;
  }

  const clipPath = resolveRuntimeClipPath(layer, layerById);
  if (clipPath) {
    runtimeLayer.clipPath = clipPath;
  }

  return runtimeLayer;
}

function resolveRuntimePaint(
  project: Project,
  iconId: string,
  variantId: string,
  paint: PaintRef | undefined,
  diagnostics: RuntimeExportDiagnostic[],
): RuntimePaint {
  if (!paint) return { kind: 'none' };

  switch (paint.mode) {
    case 'currentColor':
      return { kind: 'currentColor' };
    case 'fixed':
      return normalizeSolidPaint(paint.value);
    case 'token': {
      const resolved = project.tokenSet?.colors?.[paint.token];
      if (!resolved) {
        diagnostics.push({
          level: 'warning',
          code: 'missing-token',
          iconId,
          variantId,
          message: `Token "${paint.token}" is not defined. Falling back to currentColor.`,
        });
        return { kind: 'currentColor' };
      }
      return normalizeSolidPaint(resolved);
    }
    case 'linearGradient':
      return {
        kind: 'linearGradient',
        angle: paint.angle,
        stops: paint.stops.map(cloneGradientStop),
      };
    case 'radialGradient':
      return {
        kind: 'radialGradient',
        cx: paint.cx,
        cy: paint.cy,
        r: paint.r,
        stops: paint.stops.map(cloneGradientStop),
      };
    default:
      return { kind: 'none' };
  }
}

function normalizeSolidPaint(value: string): RuntimePaint {
  if (value === 'none') return { kind: 'none' };
  if (value === 'currentColor') return { kind: 'currentColor' };
  return { kind: 'solid', color: value };
}

function cloneGradientStop(stop: GradientStop): RuntimeGradientStop {
  return {
    offset: stop.offset,
    color: stop.color,
    opacity: stop.opacity,
  };
}

function buildDrawAnnotation(
  project: Project,
  icon: Icon,
  variant: Variant,
  states: Record<string, RuntimeState>,
  diagnostics: RuntimeExportDiagnostic[],
): RuntimeDrawAnnotation | undefined {
  const renderedLayerIds = new Set<string>();
  for (const state of Object.values(states)) {
    for (const layer of state.layers) {
      renderedLayerIds.add(layer.id);
    }
  }

  const drawItems = collectDrawGuideItems(project, icon, variant);
  const grouped = new Map<string, RuntimeDrawGuidePoint[]>();

  for (const item of drawItems) {
    if (!renderedLayerIds.has(item.layerId)) {
      diagnostics.push({
        level: 'warning',
        code: 'invalid-draw-layer',
        iconId: icon.id,
        variantId: variant.id,
        message: `Draw guide references missing runtime layer "${item.layerId}".`,
      });
      continue;
    }

    const existing = grouped.get(item.layerId) ?? [];
    existing.push({
      t: item.t,
      direction: item.direction,
    });
    grouped.set(item.layerId, existing);
  }

  const layers = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce<RuntimeDrawAnnotation['layers']>((acc, [layerId, guidePoints]) => {
      const orderedGuidePoints = [...guidePoints].sort((left, right) => {
        if (left.t !== right.t) return left.t - right.t;
        return (left.direction ?? '').localeCompare(right.direction ?? '');
      });

      if (orderedGuidePoints.length < 2) {
        diagnostics.push({
          level: 'warning',
          code: 'invalid-draw-layer',
          iconId: icon.id,
          variantId: variant.id,
          message: `Layer "${layerId}" needs at least two draw guide points to export Draw metadata.`,
        });
        return acc;
      }

      acc[layerId] = {
        guidePoints: orderedGuidePoints,
      };
      return acc;
    }, {});

  if (Object.keys(layers).length === 0) {
    return undefined;
  }

  return {
    mode: 'byLayer',
    layers,
  };
}

function collectDrawGuideItems(
  project: Project,
  icon: Icon,
  variant: Variant,
): Array<Extract<GuideItem, { kind: 'drawPoint' }>> {
  const items: GuideItem[] = [];

  if (variant.guideMasterId) {
    const guideMaster = project.guideMasters?.[variant.guideMasterId];
    if (guideMaster) {
      items.push(...guideMaster.items);
    }
  }

  if (icon.customGuides) {
    items.push(...icon.customGuides);
  }

  return items
    .filter(
      (item): item is Extract<GuideItem, { kind: 'drawPoint' }> =>
        item.kind === 'drawPoint',
    )
    .sort((left, right) => {
      const layerCmp = left.layerId.localeCompare(right.layerId);
      if (layerCmp !== 0) return layerCmp;
      if (left.t !== right.t) return left.t - right.t;
      return (left.direction ?? '').localeCompare(right.direction ?? '');
    });
}

function buildRuntimeTransitions(
  icon: Icon,
  variant: Variant,
  states: Record<string, RuntimeState>,
  drawLayerIds: Set<string>,
  diagnostics: RuntimeExportDiagnostic[],
): Record<string, RuntimeTransition> {
  return Object.keys(icon.transitions)
    .sort((a, b) => a.localeCompare(b))
    .reduce<Record<string, RuntimeTransition>>((acc, transitionId) => {
      const transition = icon.transitions[transitionId]!;
      const runtimeTransition = toRuntimeTransition(
        icon,
        variant,
        states,
        transitionId,
        transition,
        drawLayerIds,
        diagnostics,
      );

      if (runtimeTransition) {
        acc[transitionId] = runtimeTransition;
      }

      return acc;
    }, {});
}

function toRuntimeTransition(
  icon: Icon,
  variant: Variant,
  states: Record<string, RuntimeState>,
  transitionId: string,
  transition: Transition,
  drawLayerIds: Set<string>,
  diagnostics: RuntimeExportDiagnostic[],
): RuntimeTransition | null {
  if (!variant.states[transition.from] || !variant.states[transition.to]) {
    diagnostics.push({
      level: 'warning',
      code: 'invalid-transition',
      iconId: icon.id,
      variantId: variant.id,
      transitionId,
      message: `Transition "${transitionId}" references states that do not exist in variant "${variant.id}".`,
    });
    return null;
  }

  const runtimeBindings: RuntimeLayerBinding[] = [];
  for (const binding of transition.layerBindings) {
    const runtimeBinding = toRuntimeLayerBinding(
      icon,
      variant,
      transitionId,
      transition,
      binding,
      diagnostics,
    );
    if (!runtimeBinding) {
      return null;
    }
    runtimeBindings.push(runtimeBinding);
  }

  if (transition.strategy === 'track' && runtimeBindings.length === 0) {
    diagnostics.push({
      level: 'warning',
      code: 'invalid-transition',
      iconId: icon.id,
      variantId: variant.id,
      transitionId,
      message: `Track transition "${transitionId}" must contain at least one valid layer binding.`,
    });
    return null;
  }

  const runtimeTransition: RuntimeTransition = {
    from: transition.from,
    to: transition.to,
    strategy:
      transition.strategy === 'strictMorph' || transition.strategy === 'bestGuessMorph'
        ? 'morph'
        : transition.strategy,
    durationMs: transition.durationMs,
    easing: transition.easing ?? 'linear',
    layerBindings: runtimeBindings,
  };

  const preserveLayerIds = getPreservedLayerIds(
    states[transition.from]!,
    states[transition.to]!,
  );
  const drawIntegrated =
    preserveLayerIds.some((layerId) => drawLayerIds.has(layerId)) ||
    runtimeBindings.some(
      (binding) =>
        (binding.fromLayerId && drawLayerIds.has(binding.fromLayerId)) ||
        (binding.toLayerId && drawLayerIds.has(binding.toLayerId)),
    );

  if (preserveLayerIds.length > 0 || drawIntegrated) {
    runtimeTransition.magicReplace = {};
    if (preserveLayerIds.length > 0) {
      runtimeTransition.magicReplace.preserveLayerIds = preserveLayerIds;
    }
    if (drawIntegrated) {
      runtimeTransition.magicReplace.drawIntegrated = true;
    }
  }

  return runtimeTransition;
}

function toRuntimeLayerBinding(
  icon: Icon,
  variant: Variant,
  transitionId: string,
  transition: Transition,
  binding: LayerBinding,
  diagnostics: RuntimeExportDiagnostic[],
): RuntimeLayerBinding | null {
  const fromState = variant.states[transition.from]!;
  const toState = variant.states[transition.to]!;

  if (binding.fromLayerId && !fromState.layers[binding.fromLayerId]) {
    diagnostics.push({
      level: 'warning',
      code: 'invalid-transition',
      iconId: icon.id,
      variantId: variant.id,
      transitionId,
      message: `Transition "${transitionId}" references missing from-layer "${binding.fromLayerId}".`,
    });
    return null;
  }

  if (binding.toLayerId && !toState.layers[binding.toLayerId]) {
    diagnostics.push({
      level: 'warning',
      code: 'invalid-transition',
      iconId: icon.id,
      variantId: variant.id,
      transitionId,
      message: `Transition "${transitionId}" references missing to-layer "${binding.toLayerId}".`,
    });
    return null;
  }

  const runtimeBinding: RuntimeLayerBinding = {};
  if (binding.fromLayerId) runtimeBinding.fromLayerId = binding.fromLayerId;
  if (binding.toLayerId) runtimeBinding.toLayerId = binding.toLayerId;

  if (binding.tracks) {
    const tracks: RuntimeTrack[] = [];

    for (const track of binding.tracks) {
      if (!SUPPORTED_TRACK_PROPERTIES.has(track.property)) {
        diagnostics.push({
          level: 'warning',
          code: 'invalid-transition',
          iconId: icon.id,
          variantId: variant.id,
          transitionId,
          message: `Transition "${transitionId}" uses unsupported track property "${track.property}".`,
        });
        return null;
      }

      tracks.push({
        property: track.property,
        keyframes: [...track.keyframes],
      });
    }

    runtimeBinding.tracks = tracks;
  }

  if (transition.strategy === 'strictMorph' || transition.strategy === 'bestGuessMorph') {
    if (!binding.fromLayerId || !binding.toLayerId) {
      diagnostics.push({
        level: 'warning',
        code: 'invalid-transition',
        iconId: icon.id,
        variantId: variant.id,
        transitionId,
        message: `Morph transition "${transitionId}" requires both from-layer and to-layer bindings.`,
      });
      return null;
    }

    const fromLayer = fromState.layers[binding.fromLayerId];
    const toLayer = toState.layers[binding.toLayerId];
    if (!fromLayer?.path?.d || !toLayer?.path?.d) {
      diagnostics.push({
        level: 'warning',
        code: 'invalid-transition',
        iconId: icon.id,
        variantId: variant.id,
        transitionId,
        message: `Morph transition "${transitionId}" requires path geometry on both bound layers.`,
      });
      return null;
    }

    if (
      transition.strategy === 'strictMorph' &&
      !hasStrictMorphCompatibility(fromState, toState, binding.fromLayerId, binding.toLayerId)
    ) {
      diagnostics.push({
        level: 'warning',
        code: 'invalid-transition',
        iconId: icon.id,
        variantId: variant.id,
        transitionId,
        message: `Strict morph transition "${transitionId}" does not satisfy topology compatibility for "${binding.fromLayerId}" -> "${binding.toLayerId}".`,
      });
      return null;
    }

    runtimeBinding.morph = {
      topology: transition.strategy === 'strictMorph' ? 'strict' : 'bestGuess',
    };
  }

  return runtimeBinding;
}

function hasStrictMorphCompatibility(
  fromState: State,
  toState: State,
  fromLayerId: string,
  toLayerId: string,
): boolean {
  const fromPair = fromState.topology?.layerPairs.find(
    (pair) => pair.layerId === fromLayerId,
  );
  const toPair = toState.topology?.layerPairs.find((pair) => pair.layerId === toLayerId);

  if (!fromPair || !toPair) {
    return false;
  }

  return (
    fromPair.subpathCount === toPair.subpathCount &&
    arrayEquals(fromPair.commandSignature, toPair.commandSignature) &&
    arrayEquals(fromPair.closed, toPair.closed)
  );
}

function buildRuntimeEffects(
  icon: Icon,
  variantId: string,
  drawLayerIds: Set<string>,
  diagnostics: RuntimeExportDiagnostic[],
): Record<string, RuntimeEffect> | undefined {
  if (!icon.effects) return undefined;

  const effects = Object.keys(icon.effects)
    .sort((a, b) => a.localeCompare(b))
    .reduce<Record<string, RuntimeEffect>>((acc, effectId) => {
      const effect = icon.effects?.[effectId];
      if (!effect) return acc;

      const runtimeEffect = toRuntimeEffect(icon.id, variantId, effectId, effect, drawLayerIds, diagnostics);
      if (runtimeEffect) {
        acc[effectId] = runtimeEffect;
      }
      return acc;
    }, {});

  return Object.keys(effects).length > 0 ? effects : undefined;
}

function toRuntimeEffect(
  iconId: string,
  variantId: string,
  effectId: string,
  effect: Effect,
  drawLayerIds: Set<string>,
  diagnostics: RuntimeExportDiagnostic[],
): RuntimeEffect | null {
  if ((effect.kind === 'lineDrawOn' || effect.kind === 'lineDrawOff') && drawLayerIds.size === 0) {
    diagnostics.push({
      level: 'warning',
      code: 'invalid-effect',
      iconId,
      variantId,
      effectId,
      message: `Effect "${effectId}" requires exported Draw metadata, but no draw-capable layers were found.`,
    });
    return null;
  }

  return {
    kind: effect.kind,
    durationMs: effect.durationMs,
    easing: effect.easing,
  };
}

function getPreservedLayerIds(
  fromState: RuntimeState,
  toState: RuntimeState,
): string[] {
  const toLayerById = new Map(toState.layers.map((layer) => [layer.id, layer]));
  const preserved: string[] = [];

  for (const fromLayer of fromState.layers) {
    const toLayer = toLayerById.get(fromLayer.id);
    if (!toLayer) continue;
    if (serializeRuntimeJson(fromLayer) === serializeRuntimeJson(toLayer)) {
      preserved.push(fromLayer.id);
    }
  }

  return preserved.sort((a, b) => a.localeCompare(b));
}

function resolveRuntimeClipPath(
  layer: Layer,
  layerById: Map<string, Layer>,
): RuntimeClipPath | undefined {
  if (!layer.clipPathLayerId) return undefined;
  const maskLayer = layerById.get(layer.clipPathLayerId);
  if (!maskLayer?.path?.d || maskLayer.visible === false) return undefined;

  const clipPath: RuntimeClipPath = {
    d: maskLayer.path.d,
    fillRule: maskLayer.path.fillRule,
  };
  const transform = buildTransformString(maskLayer);
  if (transform) {
    clipPath.transform = transform;
  }
  return clipPath;
}

function buildTransformString(layer: Layer): string | undefined {
  const transform = layer.transform;
  if (!transform) return undefined;

  const parts: string[] = [];
  if (transform.x !== undefined || transform.y !== undefined) {
    parts.push(`translate(${transform.x ?? 0}, ${transform.y ?? 0})`);
  }
  if (transform.rotate !== undefined) {
    parts.push(`rotate(${transform.rotate})`);
  }
  if (transform.scaleX !== undefined || transform.scaleY !== undefined) {
    parts.push(`scale(${transform.scaleX ?? 1}, ${transform.scaleY ?? 1})`);
  }

  return parts.length > 0 ? parts.join(' ') : undefined;
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, sortJsonValue(entryValue)] as const);

    return Object.fromEntries(entries);
  }

  return value;
}

function arrayEquals<T>(left: T[], right: T[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

const SUPPORTED_TRACK_PROPERTIES = new Set<RuntimeTrackProperty>([
  'opacity',
  'rotate',
  'translateX',
  'translateY',
  'scale',
  'pathLength',
]);
