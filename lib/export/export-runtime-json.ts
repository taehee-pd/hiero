import type {
  Effect,
  GradientStop,
  GuideItem,
  Icon,
  Layer,
  PaintRef,
  Project,
  TimelineTrack,
  SpringConfig,
  Variant,
} from '@/lib/schema/types';

export type RuntimeCoreLayer = {
  d: string;
  fill: string;
  stroke: string;
  strokeWidth?: number;
  opacity?: number;
  transform?: string;
};

export type RuntimeCoreJson = {
  id: string;
  name: string;
  variants: Record<
    string,
    {
      size: number;
      viewBox: [number, number, number, number];
      layers: Record<string, RuntimeCoreLayer>;
    }
  >;
  tokens?: {
    colors: Record<string, string>;
  };
};

type RuntimeJsonExportIcon = Icon & {
  tokenSet?: {
    colors?: Record<string, string>;
  };
};

export function exportRuntimeJson(
  icon: RuntimeJsonExportIcon,
  options?: { variants?: string[] },
): string {
  const variantIds = resolveFilteredVariantIds(icon, options?.variants);
  const colors = getRuntimeJsonColors(icon);

  const payload: RuntimeCoreJson = {
    id: icon.id,
    name: icon.name,
    variants: variantIds.reduce<RuntimeCoreJson['variants']>((acc, variantId) => {
      const variant = icon.variants[variantId]!;
      acc[variantId] = {
        size: variant.size,
        viewBox: [...variant.viewBox],
        layers: buildRuntimeJsonLayers(variant, colors),
      };
      return acc;
    }, {}),
  };

  if (colors && Object.keys(colors).length > 0) {
    payload.tokens = {
      colors: { ...colors },
    };
  }

  return serializeRuntimeJson(payload);
}

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
  | 'pathLength'
  | 'trimStart'
  | 'trimEnd'
  | 'trimOffset';

export type RuntimeTrack = {
  property: RuntimeTrackProperty;
  keyframes: number[] | string[];
};

export type RuntimeLayerBinding = {
  fromLayerId?: string;
  toLayerId?: string;
  tracks?: RuntimeTrack[];
  delayMs?: number;
  durationMs?: number;
  morph?: { topology: 'strict' | 'bestGuess' };
  compoundTrimMode?: 'simultaneously' | 'individually';
};

export type RuntimeMagicReplace = {
  preserveLayerIds?: string[];
  drawIntegrated?: boolean;
};

export type RuntimeTransition = {
  from: string;
  to: string;
  strategy: 'track' | 'morph' | 'replace' | 'lineAnimation';
  durationMs: number;
  easing: string | SpringConfig;
  layerBindings: RuntimeLayerBinding[];
  magicReplace?: RuntimeMagicReplace;
  /** Directional slide+fade for replace transitions. */
  direction?: 'downUp' | 'upUp' | 'offUp' | 'automatic';
};

export type RuntimeEffect = {
  kind: string;
  durationMs: number;
  easing?: string | SpringConfig;
  /** Palette of hex colors for the variableColor effect. */
  palette?: string[];
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
    }
  >;
};

export type RuntimeVariantPayload = {
  variant: {
    id: string;
    size: number;
    viewBox: [number, number, number, number];
  };
  layers: RuntimeLayer[];
  states?: Record<string, RuntimeState>;
  transitions?: Record<string, RuntimeTransition>;
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
  const runtimeLayers = buildRuntimeLayers(
    project,
    icon,
    variant,
    diagnostics,
  );
  const draw = buildDrawAnnotation(project, icon, variant, runtimeLayers, diagnostics);
  const drawLayerIds = new Set(
    draw ? Object.keys(draw.layers) : [],
  );
  const effects = buildRuntimeEffects(
    icon,
    variantId,
    drawLayerIds,
    diagnostics,
  );

  const transitions = buildRuntimeTransitions(
    icon,
    variantId,
    variant,
    runtimeLayers,
    drawLayerIds,
    diagnostics,
  );

  const payload: RuntimeVariantPayload = {
    variant: {
      id: variant.id,
      size: variant.size,
      viewBox: variant.viewBox,
    },
    layers: runtimeLayers,
  };

  if (transitions && Object.keys(transitions).length > 0) {
    payload.transitions = transitions;
  }
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

function resolveFilteredVariantIds(icon: Icon, variants?: string[]): string[] {
  const allowed = variants ? new Set(variants) : null;
  return Object.keys(icon.variants)
    .sort((a, b) => a.localeCompare(b))
    .filter((variantId) => (allowed ? allowed.has(variantId) : true));
}

function buildRuntimeJsonLayers(
  variant: Variant,
  colors?: Record<string, string>,
): Record<string, RuntimeCoreLayer> {
  return Object.keys(variant.layers)
    .sort((a, b) => a.localeCompare(b))
    .reduce<Record<string, RuntimeCoreLayer>>((acc, layerId) => {
      const layer = variant.layers[layerId]!;
      if (layer.visible === false || !layer.path?.d || layer.isClipMask) {
        return acc;
      }

      const runtimeLayer: RuntimeCoreLayer = {
        d: layer.path.d,
        fill: resolveRuntimeJsonPaint(layer.style.fill, colors),
        stroke: resolveRuntimeJsonPaint(layer.style.stroke, colors),
      };

      if (layer.style.strokeWidth !== undefined) {
        runtimeLayer.strokeWidth = layer.style.strokeWidth;
      }

      const opacity = resolveRuntimeJsonOpacity(layer);
      if (opacity !== undefined) {
        runtimeLayer.opacity = opacity;
      }

      const transform = buildTransformString(layer);
      if (transform) {
        runtimeLayer.transform = transform;
      }

      acc[layerId] = runtimeLayer;
      return acc;
    }, {});
}

function getRuntimeJsonColors(icon: Icon): Record<string, string> | undefined {
  const colors = (icon as RuntimeJsonExportIcon).tokenSet?.colors;
  if (!colors) return undefined;
  return Object.fromEntries(
    Object.entries(colors).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function resolveRuntimeJsonPaint(
  paint: PaintRef | undefined,
  colors?: Record<string, string>,
): string {
  if (!paint) return 'none';

  switch (paint.mode) {
    case 'currentColor':
      return 'currentColor';
    case 'fixed':
      return paint.value;
    case 'token':
      return colors?.[paint.token] ?? 'currentColor';
    case 'linearGradient':
    case 'radialGradient':
      return 'currentColor';
    default:
      return 'none';
  }
}

function resolveRuntimeJsonOpacity(layer: Layer): number | undefined {
  const fill = layer.style.fill;
  const stroke = layer.style.stroke;
  const fillVisible = Boolean(fill && !(fill.mode === 'fixed' && fill.value === 'none'));
  const strokeVisible = Boolean(stroke && !(stroke.mode === 'fixed' && stroke.value === 'none'));

  if (fillVisible && layer.style.fillOpacity !== undefined) {
    return layer.style.fillOpacity;
  }
  if (strokeVisible && layer.style.strokeOpacity !== undefined) {
    return layer.style.strokeOpacity;
  }
  if (!fillVisible && !strokeVisible) {
    return undefined;
  }
  return 1;
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

function buildRuntimeLayers(
  project: Project,
  icon: Icon,
  variant: Variant,
  diagnostics: RuntimeExportDiagnostic[],
): RuntimeLayer[] {
  const layerIds = Object.keys(variant.layers).sort((a, b) => a.localeCompare(b));
  const layerById = new Map(layerIds.map((layerId) => [layerId, variant.layers[layerId]!]));
  const layers: RuntimeLayer[] = [];

  for (const layerId of layerIds) {
    const layer = variant.layers[layerId]!;
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

  return layers;
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
  runtimeLayers: RuntimeLayer[],
  diagnostics: RuntimeExportDiagnostic[],
): RuntimeDrawAnnotation | undefined {
  const renderedLayerIds = new Set<string>();
  for (const layer of runtimeLayers) {
    renderedLayerIds.add(layer.id);
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

  const runtimeEffect: RuntimeEffect = {
    kind: effect.kind,
    durationMs: effect.durationMs,
    easing: effect.easing,
    palette: effect.palette,
  };

  // Include drawConfig for 'draw' effects so the runtime consumer knows the mode
  if (effect.kind === 'draw' && effect.drawConfig) {
    (runtimeEffect as Record<string, unknown>).drawConfig = {
      mode: effect.drawConfig.mode,
      ...(effect.drawConfig.windowSize !== undefined && { windowSize: effect.drawConfig.windowSize }),
      ...(effect.drawConfig.initialOffset !== undefined && { initialOffset: effect.drawConfig.initialOffset }),
      ...(effect.drawConfig.compoundTrimMode !== undefined && { compoundTrimMode: effect.drawConfig.compoundTrimMode }),
    };
  }

  return runtimeEffect;
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

function buildRuntimeTransitions(
  icon: Icon,
  variantId: string,
  variant: Variant,
  runtimeLayers: RuntimeLayer[],
  drawLayerIds: Set<string>,
  diagnostics: RuntimeExportDiagnostic[],
): Record<string, RuntimeTransition> | undefined {
  if (!icon.transitions) return undefined;

  const renderedLayerIds = new Set(runtimeLayers.map((layer) => layer.id));
  const validStateIds = new Set<string>(['default']);
  if (variant.states) {
    for (const stateId of Object.keys(variant.states)) {
      validStateIds.add(stateId);
    }
  }

  const result: Record<string, RuntimeTransition> = {};

  for (const transitionId of Object.keys(icon.transitions).sort((a, b) => a.localeCompare(b))) {
    const transition = icon.transitions[transitionId]!;

    // Filter: only transitions for this variant
    if (transition.fromVariantId !== variantId && transition.toVariantId !== variantId) {
      continue;
    }

    // Filter: both from/to states must exist
    const fromState = transition.from ?? 'default';
    const toState = transition.to ?? 'default';
    if (!validStateIds.has(fromState) || !validStateIds.has(toState)) {
      diagnostics.push({
        level: 'warning',
        code: 'invalid-transition',
        iconId: icon.id,
        variantId,
        transitionId,
        message: `Transition "${transitionId}" references unknown state(s). from="${fromState}" to="${toState}".`,
      });
      continue;
    }

    // Filter: strictMorph requires a topology contract on the variant
    if (transition.strategy === 'strictMorph') {
      if (!variant.topology) {
        diagnostics.push({
          level: 'warning',
          code: 'invalid-transition',
          iconId: icon.id,
          variantId,
          transitionId,
          message: `Transition "${transitionId}" uses strictMorph but variant has no topology contract.`,
        });
        continue;
      }
    }

    // Map strategy to runtime strategy
    let runtimeStrategy: RuntimeTransition['strategy'] = 'track';
    if (transition.strategy === 'auto' || transition.strategy === 'strictMorph' || transition.strategy === 'bestGuessMorph' || transition.strategy === 'crossIconMorph') {
      runtimeStrategy = 'morph';
    } else if (transition.strategy === 'replace') {
      runtimeStrategy = 'replace';
    } else if (transition.strategy === 'lineAnimation') {
      runtimeStrategy = 'lineAnimation';
    }

    // Build layer bindings with stagger timing
    const totalBindings = transition.layerBindings?.length ?? 0;
    const layerBindings: RuntimeLayerBinding[] = (transition.layerBindings ?? []).map(
      (binding, index) => {
        const runtimeBinding: RuntimeLayerBinding = {};
        if (binding.fromLayerId) runtimeBinding.fromLayerId = binding.fromLayerId;
        if (binding.toLayerId) runtimeBinding.toLayerId = binding.toLayerId;
        if (binding.tracks) {
          runtimeBinding.tracks = binding.tracks
            .filter((track) => SUPPORTED_TRACK_PROPERTIES.has(track.property as RuntimeTrackProperty))
            .map((track) => ({
              property: track.property as RuntimeTrackProperty,
              keyframes: [...track.keyframes],
            }));
        }
        if (binding.morph) {
          runtimeBinding.morph = { topology: binding.morph.topology };
        }
        if (binding.compoundTrimMode) {
          runtimeBinding.compoundTrimMode = binding.compoundTrimMode;
        }

        // Resolve stagger timing
        if (transition.stagger && transition.stagger.perLayerMs > 0) {
          const delayMs = index * transition.stagger.perLayerMs;
          runtimeBinding.delayMs = delayMs;
          runtimeBinding.durationMs = Math.max(transition.durationMs - delayMs, 0);
        }

        return runtimeBinding;
      },
    );

    // Build magic replace for lineAnimation strategy
    let magicReplace: RuntimeMagicReplace | undefined;
    if (transition.strategy === 'lineAnimation') {
      const boundLayerIds = new Set<string>();
      for (const binding of transition.layerBindings ?? []) {
        if (binding.fromLayerId) boundLayerIds.add(binding.fromLayerId);
        if (binding.toLayerId) boundLayerIds.add(binding.toLayerId);
      }
      const preserveLayerIds = [...renderedLayerIds]
        .filter((layerId) => !boundLayerIds.has(layerId))
        .sort((a, b) => a.localeCompare(b));

      magicReplace = {
        preserveLayerIds: preserveLayerIds.length > 0 ? preserveLayerIds : undefined,
        drawIntegrated: drawLayerIds.size > 0 ? true : undefined,
      };
    }

    const runtimeTransition: RuntimeTransition = {
      from: fromState,
      to: toState,
      strategy: runtimeStrategy,
      durationMs: transition.durationMs,
      easing: transition.easing ?? 'linear',
      layerBindings,
    };

    if (magicReplace) {
      runtimeTransition.magicReplace = magicReplace;
    }

    if (transition.direction) {
      runtimeTransition.direction = transition.direction;
    }

    result[transitionId] = runtimeTransition;
  }

  return Object.keys(result).length > 0 ? result : undefined;
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

const SUPPORTED_TRACK_PROPERTIES = new Set<RuntimeTrackProperty>([
  'opacity',
  'rotate',
  'translateX',
  'translateY',
  'scale',
  'pathLength',
  'trimStart',
  'trimEnd',
  'trimOffset',
]);
