import type {
  RuntimeEffect,
  RuntimeLayer,
  RuntimeState,
  RuntimeTrack,
  RuntimeTransition,
  RuntimeVariantPayload,
} from '@/lib/export/export-runtime-json';
import { interpolateColor } from './color';
import { getEasingFunction } from './easing';
import { estimateSpringDuration, springProgress } from './spring';

export type IconRuntimeEffectRepeat = 'once' | 'loop' | number;

export type RuntimeSnapshotLayer = RuntimeLayer & {
  key: string;
  opacity: number;
  pathLengthProgress?: number;
};

export type RuntimeSnapshot = {
  stateId: string;
  viewBox: [number, number, number, number];
  layers: RuntimeSnapshotLayer[];
  groupTransform?: string;
  groupOpacity?: number;
};

export type IconRuntimeStoreSnapshot = {
  currentStateId: string;
  settledStateId: string;
  activeTransitionId?: string;
  activeEffectId?: string;
  isAnimating: boolean;
  snapshot: RuntimeSnapshot;
};

export type IconRuntimeStoreOptions = {
  initialStateId?: string;
  autoTick?: boolean;
  now?: () => number;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (handle: number) => void;
};

export type IconRuntimeStore = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): IconRuntimeStoreSnapshot;
  setState(stateId: string, options?: { immediate?: boolean }): void;
  playEffect(
    effectId: string,
    options?: { repeat?: IconRuntimeEffectRepeat },
  ): void;
  advanceTo(timeMs: number): void;
  destroy(): void;
};

type TransitionPlayback = {
  id: string;
  transition: RuntimeTransition;
  fromStateId: string;
  toStateId: string;
  startedAt: number;
};

type EffectPlayback = {
  id: string;
  effect: RuntimeEffect;
  startedAt: number;
  repeat: IconRuntimeEffectRepeat;
};

type FrameDriver = Required<
  Pick<IconRuntimeStoreOptions, 'now' | 'requestFrame' | 'cancelFrame'>
> & {
  autoTick: boolean;
};

const DEFAULT_REPEAT: IconRuntimeEffectRepeat = 'once';

export function createIconRuntimeStore(
  payload: RuntimeVariantPayload,
  options: IconRuntimeStoreOptions = {},
): IconRuntimeStore {
  const listeners = new Set<() => void>();
  const frame: FrameDriver = {
    autoTick: options.autoTick ?? true,
    now: options.now ?? (() => performance.now()),
    requestFrame:
      options.requestFrame ??
      ((callback) => window.requestAnimationFrame(callback)),
    cancelFrame:
      options.cancelFrame ?? ((handle) => window.cancelAnimationFrame(handle)),
  };

  const defaultStateId = resolveInitialStateId(payload, options.initialStateId);
  let settledStateId = defaultStateId;
  let currentStateId = defaultStateId;
  let transition: TransitionPlayback | undefined;
  let effect: EffectPlayback | undefined;
  let frameHandle: number | undefined;
  let destroyed = false;

  let snapshot: IconRuntimeStoreSnapshot = {
    currentStateId,
    settledStateId,
    isAnimating: false,
    snapshot: buildStateSnapshot(payload, currentStateId),
  };

  function emit() {
    for (const listener of listeners) {
      listener();
    }
  }

  function rebuildSnapshot(timeMs: number): void {
    const transitionElapsedMs = transition ? Math.max(timeMs - transition.startedAt, 0) : 0;
    const transitionProgress = transition
      ? resolveRuntimeEasingProgress(
          transition.transition.easing,
          transitionElapsedMs,
          transition.transition.durationMs,
        )
      : 1;
    const effectProgress = effect
      ? resolveEffectProgress(effect, timeMs)
      : undefined;

    if (transition && transitionElapsedMs >= Math.max(transition.transition.durationMs, 0)) {
      settledStateId = transition.toStateId;
      transition = undefined;
    }

    if (effect && effectProgress?.complete) {
      effect = undefined;
    }

    let runtimeSnapshot = transition
      ? buildTransitionSnapshot(payload, transition, transitionProgress)
      : buildStateSnapshot(payload, currentStateId);

    if (effect && effectProgress) {
      runtimeSnapshot = applyEffectToSnapshot(payload, runtimeSnapshot, effect, effectProgress.progress);
    }

    snapshot = {
      currentStateId,
      settledStateId,
      activeTransitionId: transition?.id,
      activeEffectId: effect?.id,
      isAnimating: Boolean(transition || effect),
      snapshot: runtimeSnapshot,
    };
  }

  function ensureFrame(): void {
    if (!frame.autoTick || frameHandle !== undefined || destroyed) {
      return;
    }

    if (!transition && !effect) {
      return;
    }

    frameHandle = frame.requestFrame((timeMs) => {
      frameHandle = undefined;
      rebuildSnapshot(timeMs);
      emit();
      ensureFrame();
    });
  }

  function setState(stateId: string, options?: { immediate?: boolean }) {
    if (!payload.states[stateId]) {
      return;
    }

    if (!options?.immediate && stateId === currentStateId) {
      return;
    }

    const sourceStateId = currentStateId;
    const now = frame.now();

    if (options?.immediate) {
      currentStateId = stateId;
      settledStateId = stateId;
      transition = undefined;
      rebuildSnapshot(now);
      emit();
      return;
    }

    const transitionEntry = Object.entries(payload.transitions).find(
      ([, candidate]) => candidate.from === sourceStateId && candidate.to === stateId,
    );

    currentStateId = stateId;

    if (!transitionEntry) {
      settledStateId = stateId;
      transition = undefined;
      rebuildSnapshot(now);
      emit();
      return;
    }

    const [transitionId, runtimeTransition] = transitionEntry;
    transition = {
      id: transitionId,
      transition: runtimeTransition,
      fromStateId: sourceStateId,
      toStateId: stateId,
      startedAt: now,
    };
    rebuildSnapshot(now);
    emit();
    ensureFrame();
  }

  function playEffect(
    effectId: string,
    options?: { repeat?: IconRuntimeEffectRepeat },
  ) {
    const runtimeEffect = payload.effects?.[effectId];
    if (!runtimeEffect) {
      return;
    }

    effect = {
      id: effectId,
      effect: runtimeEffect,
      startedAt: frame.now(),
      repeat: options?.repeat ?? DEFAULT_REPEAT,
    };
    rebuildSnapshot(frame.now());
    emit();
    ensureFrame();
  }

  function advanceTo(timeMs: number) {
    rebuildSnapshot(timeMs);
    emit();
  }

  function destroy() {
    destroyed = true;
    if (frameHandle !== undefined) {
      frame.cancelFrame(frameHandle);
      frameHandle = undefined;
    }
    listeners.clear();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return snapshot;
    },
    setState,
    playEffect,
    advanceTo,
    destroy,
  };
}

function resolveInitialStateId(
  payload: RuntimeVariantPayload,
  requestedStateId?: string,
): string {
  if (requestedStateId && payload.states[requestedStateId]) {
    return requestedStateId;
  }

  if (payload.states[payload.variant.defaultState]) {
    return payload.variant.defaultState;
  }

  return Object.keys(payload.states).sort((left, right) => left.localeCompare(right))[0] ?? '';
}

function buildStateSnapshot(
  payload: RuntimeVariantPayload,
  stateId: string,
): RuntimeSnapshot {
  const state = payload.states[stateId];

  return {
    stateId,
    viewBox: [...payload.variant.viewBox],
    layers: (state?.layers ?? []).map((layer) => ({
      ...layer,
      key: layer.id,
      opacity: 1,
    })),
  };
}

function buildTransitionSnapshot(
  payload: RuntimeVariantPayload,
  playback: TransitionPlayback,
  progress: number,
): RuntimeSnapshot {
  const fromState = payload.states[playback.fromStateId];
  const toState = payload.states[playback.toStateId];
  if (!fromState || !toState) {
    return buildStateSnapshot(payload, playback.toStateId);
  }

  if (playback.transition.strategy === 'replace' || playback.transition.strategy === 'morph') {
    const direction = resolveReplaceDirection(
      playback.transition.direction,
      playback.fromStateId,
      playback.toStateId,
    );

    if (direction) {
      return buildDirectionalReplaceSnapshot(
        playback.toStateId,
        payload.variant.viewBox,
        fromState,
        toState,
        progress,
        direction,
      );
    }

    return {
      stateId: playback.toStateId,
      viewBox: [...payload.variant.viewBox],
      layers: [
        ...fromState.layers.map((layer) => ({
          ...layer,
          key: `from:${layer.id}`,
          opacity: 1 - progress,
        })),
        ...toState.layers.map((layer) => ({
          ...layer,
          key: `to:${layer.id}`,
          opacity: progress,
        })),
      ],
    };
  }

  const layerSnapshots = new Map<string, RuntimeSnapshotLayer>();
  for (const layer of toState.layers) {
    layerSnapshots.set(layer.id, {
      ...layer,
      key: layer.id,
      opacity: 1,
    });
  }

  const transformState = new Map<
    string,
    { translateX: number; translateY: number; rotate: number; scale: number }
  >();
  const opacityState = new Map<string, number>();
  const pathLengthState = new Map<string, number>();

  for (const binding of playback.transition.layerBindings) {
    const layerId = binding.toLayerId ?? binding.fromLayerId;
    if (!layerId) {
      continue;
    }

    if (!layerSnapshots.has(layerId)) {
      const fallback =
        toState.layers.find((layer) => layer.id === layerId) ??
        fromState.layers.find((layer) => layer.id === layerId);
      if (!fallback) {
        continue;
      }
      layerSnapshots.set(layerId, {
        ...fallback,
        key: layerId,
        opacity: 1,
      });
    }

    const layerTransform =
      transformState.get(layerId) ?? {
        translateX: 0,
        translateY: 0,
        rotate: 0,
        scale: 1,
      };

    for (const track of binding.tracks ?? []) {
      const localProgress = resolveBindingProgress(
        progress,
        binding.delayMs,
        binding.durationMs,
        playback.transition.layerBindings,
      );
      const value = sampleTrack(track, localProgress);
      switch (track.property) {
        case 'opacity':
          if (typeof value === 'number') {
            opacityState.set(layerId, clamp01(value));
          }
          break;
        case 'translateX':
          if (typeof value === 'number') {
            layerTransform.translateX = value;
          }
          break;
        case 'translateY':
          if (typeof value === 'number') {
            layerTransform.translateY = value;
          }
          break;
        case 'rotate':
          if (typeof value === 'number') {
            layerTransform.rotate = value;
          }
          break;
        case 'scale':
          if (typeof value === 'number') {
            layerTransform.scale = value;
          }
          break;
        case 'pathLength':
          if (typeof value === 'number') {
            pathLengthState.set(layerId, clamp01(value));
          }
          break;
        case 'fill':
          if (typeof value === 'string') {
            const snapshot = layerSnapshots.get(layerId);
            if (snapshot) {
              snapshot.fill = { kind: 'solid', color: value };
            }
          }
          break;
        case 'stroke':
          if (typeof value === 'string') {
            const snapshot = layerSnapshots.get(layerId);
            if (snapshot) {
              snapshot.stroke = { kind: 'solid', color: value };
            }
          }
          break;
      }
    }

    transformState.set(layerId, layerTransform);
  }

  for (const [layerId, layer] of layerSnapshots) {
    const layerOpacity = opacityState.get(layerId);
    if (layerOpacity !== undefined) {
      layer.opacity = layerOpacity;
    }

    const transform = transformState.get(layerId);
    if (transform) {
      const extraParts: string[] = [];
      if (transform.translateX !== 0 || transform.translateY !== 0) {
        extraParts.push(`translate(${transform.translateX}, ${transform.translateY})`);
      }
      if (transform.rotate !== 0) {
        extraParts.push(`rotate(${transform.rotate})`);
      }
      if (transform.scale !== 1) {
        extraParts.push(`scale(${transform.scale}, ${transform.scale})`);
      }

      if (extraParts.length > 0) {
        layer.transform = joinTransforms(layer.transform, extraParts.join(' '));
      }
    }

    const pathLength = pathLengthState.get(layerId);
    if (pathLength !== undefined) {
      layer.pathLengthProgress = pathLength;
    }
  }

  return {
    stateId: playback.toStateId,
    viewBox: [...payload.variant.viewBox],
    layers: [...layerSnapshots.values()],
  };
}

function applyEffectToSnapshot(
  payload: RuntimeVariantPayload,
  snapshot: RuntimeSnapshot,
  playback: EffectPlayback,
  progress: number,
): RuntimeSnapshot {
  const nextSnapshot: RuntimeSnapshot = {
    ...snapshot,
    layers: snapshot.layers.map((layer) => ({ ...layer })),
  };

  switch (playback.effect.kind) {
    case 'lineDrawOn':
    case 'lineDrawOff': {
      const drawProgress =
        playback.effect.kind === 'lineDrawOff' ? 1 - progress : progress;
      const drawLayerIds = new Set(
        Object.keys(payload.draw?.layers ?? {}).sort((left, right) =>
          left.localeCompare(right),
        ),
      );
      nextSnapshot.layers = nextSnapshot.layers.map((layer) =>
        drawLayerIds.has(layer.id)
          ? {
              ...layer,
              pathLengthProgress: drawProgress,
            }
          : layer,
      );
      return nextSnapshot;
    }
    case 'pulse':
    case 'scale': {
      nextSnapshot.groupTransform = scaleAroundCenter(
        snapshot.viewBox,
        1 + Math.sin(progress * Math.PI) * 0.08,
      );
      return nextSnapshot;
    }
    case 'breathe': {
      nextSnapshot.groupTransform = scaleAroundCenter(
        snapshot.viewBox,
        1 + Math.sin(progress * Math.PI) * 0.04,
      );
      return nextSnapshot;
    }
    case 'wiggle': {
      nextSnapshot.groupTransform = rotateAroundCenter(
        snapshot.viewBox,
        Math.sin(progress * Math.PI * 4) * 10,
      );
      return nextSnapshot;
    }
    case 'rotate': {
      nextSnapshot.groupTransform = rotateAroundCenter(snapshot.viewBox, progress * 360);
      return nextSnapshot;
    }
    case 'bounce': {
      nextSnapshot.groupTransform = `translate(0, ${Math.sin(progress * Math.PI) * -3})`;
      return nextSnapshot;
    }
    case 'variableColor': {
      nextSnapshot.groupOpacity = 0.9 + Math.sin(progress * Math.PI) * 0.1;
      return nextSnapshot;
    }
    default:
      return nextSnapshot;
  }
}

function resolveEffectProgress(
  playback: EffectPlayback,
  timeMs: number,
): { progress: number; complete: boolean } {
  const duration = Math.max(playback.effect.durationMs, 1);
  const elapsed = Math.max(timeMs - playback.startedAt, 0);
  const loops = elapsed / duration;

  if (playback.repeat === 'loop') {
    return {
      progress: loops % 1,
      complete: false,
    };
  }

  if (typeof playback.repeat === 'number') {
    if (loops >= playback.repeat) {
      return { progress: 1, complete: true };
    }
    return {
      progress: loops % 1,
      complete: false,
    };
  }

  if (elapsed >= duration) {
    return { progress: 1, complete: true };
  }

  return {
    progress: resolveRuntimeEasingProgress(playback.effect.easing, elapsed, duration),
    complete: false,
  };
}

function sampleTrack(track: RuntimeTrack, progress: number): number | string {
  if (track.property === 'fill' || track.property === 'stroke') {
    return sampleStringTrack(track.keyframes as string[], progress);
  }
  return sampleNumberTrack(track.keyframes as number[], progress);
}

function sampleNumberTrack(keyframes: number[], progress: number): number {
  if (keyframes.length === 0) {
    return 0;
  }
  if (keyframes.length === 1) {
    return keyframes[0] ?? 0;
  }

  const scaled = progress * (keyframes.length - 1);
  const { startIndex, endIndex } = resolveKeyframeSegment(scaled, keyframes.length);
  const localProgress = scaled - startIndex;
  const start = keyframes[startIndex] ?? 0;
  const end = keyframes[endIndex] ?? start;
  return start + (end - start) * localProgress;
}

function sampleStringTrack(keyframes: string[], progress: number): string {
  if (keyframes.length === 0) {
    return '#000000';
  }
  if (keyframes.length === 1) {
    return keyframes[0] ?? '#000000';
  }

  const scaled = clamp01(progress) * (keyframes.length - 1);
  const startIndex = Math.floor(scaled);
  const endIndex = Math.min(startIndex + 1, keyframes.length - 1);
  const localProgress = scaled - startIndex;
  const start = keyframes[startIndex] ?? '#000000';
  const end = keyframes[endIndex] ?? start;
  return interpolateColor(start, end, localProgress);
}

function resolveKeyframeSegment(
  scaledProgress: number,
  length: number,
): { startIndex: number; endIndex: number } {
  if (scaledProgress <= 0) {
    return { startIndex: 0, endIndex: 1 };
  }

  if (scaledProgress >= length - 1) {
    return { startIndex: length - 2, endIndex: length - 1 };
  }

  const startIndex = Math.floor(scaledProgress);
  return {
    startIndex,
    endIndex: Math.min(startIndex + 1, length - 1),
  };
}

function resolveBindingProgress(
  globalProgress: number,
  delayMs: number | undefined,
  durationMs: number | undefined,
  bindings: RuntimeTransition['layerBindings'],
): number {
  const totalMs = Math.max(
    ...bindings.map((binding) => (binding.delayMs ?? 0) + (binding.durationMs ?? 0)),
    1,
  );
  const elapsed = globalProgress * totalMs;
  const duration = Math.max(durationMs ?? totalMs, 1);
  return Math.max(0, (elapsed - (delayMs ?? 0)) / duration);
}

function resolveRuntimeEasingProgress(
  easing: RuntimeTransition['easing'] | RuntimeEffect['easing'],
  elapsedMs: number,
  durationMs: number,
): number {
  if (typeof easing === 'string' || easing === undefined) {
    return getEasingFunction(easing ?? 'linear')(clamp01(elapsedMs / Math.max(durationMs, 1)));
  }

  const effectiveDuration = Math.min(
    Math.max(durationMs, 0),
    estimateSpringDuration(easing),
  );
  return springProgress(easing, Math.min(Math.max(elapsedMs, 0), effectiveDuration));
}

function scaleAroundCenter(
  viewBox: [number, number, number, number],
  scale: number,
): string {
  const [x, y, width, height] = viewBox;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  return `translate(${centerX}, ${centerY}) scale(${scale}, ${scale}) translate(${-centerX}, ${-centerY})`;
}

function rotateAroundCenter(
  viewBox: [number, number, number, number],
  degrees: number,
): string {
  const [x, y, width, height] = viewBox;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  return `rotate(${degrees} ${centerX} ${centerY})`;
}

function joinTransforms(base: string | undefined, extra: string): string {
  if (!base) {
    return extra;
  }
  return `${base} ${extra}`.trim();
}

// --- Directional replace transition helpers ---

/** Maximum slide offset in SVG units (matches SF Symbols' subtle slide). */
const DIRECTION_SLIDE_PX = 8;

type EffectiveDirection = 'downUp' | 'upUp' | 'offUp';

/**
 * Resolve the effective slide direction for a replace transition.
 * Returns undefined when no directional slide should be applied (plain crossfade).
 */
function resolveReplaceDirection(
  direction: RuntimeTransition['direction'],
  fromStateId: string,
  toStateId: string,
): EffectiveDirection | undefined {
  if (!direction) return undefined;

  if (direction === 'automatic') {
    // Infer from state ordering: ascending = downUp, descending = upUp
    return fromStateId.localeCompare(toStateId) < 0 ? 'downUp' : 'upUp';
  }

  return direction;
}

/**
 * Build a snapshot for a directional replace transition.
 *
 * Each direction mode determines the translateY offsets for outgoing and
 * incoming layers:
 * - downUp:  outgoing slides down, incoming slides up from below
 * - upUp:    both outgoing and incoming slide upward
 * - offUp:   outgoing scales/fades in place, incoming slides up from below
 */
function buildDirectionalReplaceSnapshot(
  toStateId: string,
  viewBox: [number, number, number, number],
  fromState: RuntimeState,
  toState: RuntimeState,
  progress: number,
  direction: EffectiveDirection,
): RuntimeSnapshot {
  const outOpacity = 1 - progress;
  const inOpacity = progress;

  // Compute per-direction Y offsets
  let outY: number;
  let inY: number;
  let outScale: number | undefined;

  switch (direction) {
    case 'downUp':
      // Outgoing slides down (0 → +SLIDE), incoming slides up (+SLIDE → 0)
      outY = progress * DIRECTION_SLIDE_PX;
      inY = (1 - progress) * DIRECTION_SLIDE_PX;
      break;
    case 'upUp':
      // Both slide upward: outgoing (0 → -SLIDE), incoming (+SLIDE → 0)
      outY = -progress * DIRECTION_SLIDE_PX;
      inY = (1 - progress) * DIRECTION_SLIDE_PX;
      break;
    case 'offUp':
      // Outgoing fades/scales in place, incoming slides up from below
      outY = 0;
      outScale = 1 - progress * 0.15; // slight scale-down (1 → 0.85)
      inY = (1 - progress) * DIRECTION_SLIDE_PX;
      break;
  }

  return {
    stateId: toStateId,
    viewBox: [...viewBox],
    layers: [
      ...fromState.layers.map((layer) => {
        const extraTransform = buildDirectionalTransform(outY, outScale);
        return {
          ...layer,
          key: `from:${layer.id}`,
          opacity: outOpacity,
          transform: extraTransform
            ? joinTransforms(layer.transform, extraTransform)
            : layer.transform,
        };
      }),
      ...toState.layers.map((layer) => {
        const extraTransform = buildDirectionalTransform(inY, undefined);
        return {
          ...layer,
          key: `to:${layer.id}`,
          opacity: inOpacity,
          transform: extraTransform
            ? joinTransforms(layer.transform, extraTransform)
            : layer.transform,
        };
      }),
    ],
  };
}

/**
 * Build a transform string fragment for directional offsets.
 * Returns undefined when no transform is needed (no offset, no scale).
 */
function buildDirectionalTransform(
  translateY: number,
  scale: number | undefined,
): string | undefined {
  const parts: string[] = [];

  if (Math.abs(translateY) > 0.001) {
    parts.push(`translate(0, ${translateY})`);
  }
  if (scale !== undefined && Math.abs(scale - 1) > 0.001) {
    parts.push(`scale(${scale}, ${scale})`);
  }

  return parts.length > 0 ? parts.join(' ') : undefined;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
