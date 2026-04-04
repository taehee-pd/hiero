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
  /** Trim-based draw animation values (0-1 normalised). */
  trimStart?: number;
  trimEnd?: number;
  trimOffset?: number;
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

  // Default state ID: prefer the first state key if states are defined, otherwise 'default'
  const fallbackStateId = payload.states
    ? (Object.keys(payload.states)[0] ?? 'default')
    : 'default';
  const initialStateId = options.initialStateId ?? fallbackStateId;
  let effect: EffectPlayback | undefined;
  let activeTransition: TransitionPlayback | undefined;
  let frameHandle: number | undefined;
  let destroyed = false;

  let snapshot: IconRuntimeStoreSnapshot = {
    currentStateId: initialStateId,
    settledStateId: initialStateId,
    isAnimating: false,
    snapshot: buildStateSnapshot(payload, initialStateId),
  };

  function emit() {
    for (const listener of listeners) {
      listener();
    }
  }

  function findTransition(
    fromStateId: string,
    toStateId: string,
  ): { id: string; transition: RuntimeTransition } | undefined {
    if (!payload.transitions) return undefined;
    for (const [id, transition] of Object.entries(payload.transitions)) {
      if (transition.from === fromStateId && transition.to === toStateId) {
        return { id, transition };
      }
    }
    return undefined;
  }

  function rebuildSnapshot(timeMs: number): void {
    const effectProgress = effect
      ? resolveEffectProgress(effect, timeMs)
      : undefined;

    if (effect && effectProgress?.complete) {
      effect = undefined;
    }

    // Handle active transition
    if (activeTransition) {
      const transitionProgress = resolveTransitionProgress(activeTransition, timeMs);

      if (transitionProgress.complete) {
        // Transition finished — settle into target state
        activeTransition = undefined;
        snapshot = {
          currentStateId: snapshot.currentStateId,
          settledStateId: snapshot.currentStateId,
          isAnimating: Boolean(effect),
          activeEffectId: effect?.id,
          snapshot: buildStateSnapshot(payload, snapshot.currentStateId),
        };
        return;
      }

      // Build interpolated snapshot
      let runtimeSnapshot = buildTransitionSnapshot(
        payload,
        activeTransition,
        transitionProgress.progress,
      );

      if (effect && effectProgress) {
        runtimeSnapshot = applyEffectToSnapshot(payload, runtimeSnapshot, effect, effectProgress.progress);
      }

      snapshot = {
        currentStateId: snapshot.currentStateId,
        settledStateId: activeTransition.fromStateId,
        activeTransitionId: activeTransition.id,
        activeEffectId: effect?.id,
        isAnimating: true,
        snapshot: runtimeSnapshot,
      };
      return;
    }

    let runtimeSnapshot = buildStateSnapshot(payload, snapshot.currentStateId);

    if (effect && effectProgress) {
      runtimeSnapshot = applyEffectToSnapshot(payload, runtimeSnapshot, effect, effectProgress.progress);
    }

    snapshot = {
      currentStateId: snapshot.currentStateId,
      settledStateId: snapshot.currentStateId,
      activeEffectId: effect?.id,
      isAnimating: Boolean(effect),
      snapshot: runtimeSnapshot,
    };
  }

  function ensureFrame(): void {
    if (!frame.autoTick || frameHandle !== undefined || destroyed) {
      return;
    }

    if (!effect && !activeTransition) {
      return;
    }

    frameHandle = frame.requestFrame((timeMs) => {
      frameHandle = undefined;
      rebuildSnapshot(timeMs);
      emit();
      ensureFrame();
    });
  }

  function setState(stateId: string, stateOptions?: { immediate?: boolean }) {
    if (payload.states && !payload.states[stateId] && stateId !== fallbackStateId) {
      return;
    }

    // If already targeting this state, ignore duplicate
    if (snapshot.currentStateId === stateId) {
      return;
    }

    const previousStateId = snapshot.currentStateId;

    // Look for a transition from current to target
    const found = findTransition(previousStateId, stateId);
    if (found && !stateOptions?.immediate) {
      // Preserve the previous settled state if we're interrupting an in-flight transition
      const settledState = activeTransition
        ? snapshot.settledStateId
        : previousStateId;
      activeTransition = {
        id: found.id,
        transition: found.transition,
        fromStateId: previousStateId,
        toStateId: stateId,
        startedAt: frame.now(),
      };
      snapshot = {
        ...snapshot,
        currentStateId: stateId,
        settledStateId: settledState,
        activeTransitionId: found.id,
        isAnimating: true,
        snapshot: buildStateSnapshot(payload, previousStateId),
      };
      emit();
      ensureFrame();
      return;
    }

    snapshot = {
      ...snapshot,
      currentStateId: stateId,
      settledStateId: stateId,
      snapshot: buildStateSnapshot(payload, stateId),
    };
    const now = frame.now();
    if (stateOptions?.immediate) {
      rebuildSnapshot(now);
    }
    emit();
  }

  function playEffect(
    effectId: string,
    effectOptions?: { repeat?: IconRuntimeEffectRepeat },
  ) {
    const runtimeEffect = payload.effects?.[effectId];
    if (!runtimeEffect) {
      return;
    }

    effect = {
      id: effectId,
      effect: runtimeEffect,
      startedAt: frame.now(),
      repeat: effectOptions?.repeat ?? DEFAULT_REPEAT,
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

function resolveTransitionProgress(
  playback: TransitionPlayback,
  timeMs: number,
): { progress: number; complete: boolean } {
  const duration = Math.max(playback.transition.durationMs, 1);
  const elapsed = Math.max(timeMs - playback.startedAt, 0);

  if (elapsed >= duration) {
    return { progress: 1, complete: true };
  }

  return {
    progress: resolveRuntimeEasingProgress(playback.transition.easing, elapsed, duration),
    complete: false,
  };
}

function buildTransitionSnapshot(
  payload: RuntimeVariantPayload,
  playback: TransitionPlayback,
  progress: number,
): RuntimeSnapshot {
  const fromState = payload.states?.[playback.fromStateId];
  const toState = payload.states?.[playback.toStateId];

  if (!fromState || !toState) {
    // Fallback: just use target state layers
    return buildStateSnapshot(payload, playback.toStateId);
  }

  // Determine if this is a replace/directional transition
  const transition = playback.transition;
  const effectiveDirection = resolveReplaceDirection(
    transition.direction,
    playback.fromStateId,
    playback.toStateId,
  );

  if (transition.strategy === 'replace' && effectiveDirection) {
    return buildDirectionalReplaceSnapshot(
      playback.toStateId,
      payload.variant.viewBox,
      fromState,
      toState,
      progress,
      effectiveDirection,
    );
  }

  // Track-based interpolation
  const fromLayers = fromState.layers;
  const toLayers = toState.layers;
  const bindings = transition.layerBindings ?? [];

  const interpolatedLayers = toLayers.map((toLayer) => {
    const fromLayer = fromLayers.find((layer) => layer.id === toLayer.id);
    const binding = bindings.find(
      (b) => b.toLayerId === toLayer.id || b.fromLayerId === toLayer.id,
    );

    if (!binding || !binding.tracks || binding.tracks.length === 0) {
      // No animation tracks — snap to target state
      return {
        ...toLayer,
        key: toLayer.id,
        opacity: 1,
      };
    }

    const bindingProgress = resolveBindingProgress(
      progress,
      binding.delayMs,
      binding.durationMs,
      bindings,
    );

    const result: RuntimeSnapshotLayer = {
      ...toLayer,
      key: toLayer.id,
      opacity: 1,
    };

    for (const track of binding.tracks) {
      const value = sampleTrack(track, bindingProgress);
      switch (track.property) {
        case 'opacity':
          result.opacity = value;
          break;
        case 'translateX': {
          const existingTransform = result.transform ?? '';
          result.transform = joinTransforms(
            existingTransform || undefined,
            `translate(${value}, 0)`,
          );
          break;
        }
        case 'translateY': {
          const existingTransform = result.transform ?? '';
          result.transform = joinTransforms(
            existingTransform || undefined,
            `translate(0, ${value})`,
          );
          break;
        }
        case 'pathLength':
          result.pathLengthProgress = value;
          break;
        default:
          break;
      }
    }

    return result;
  });

  return {
    stateId: playback.toStateId,
    viewBox: [...payload.variant.viewBox],
    layers: interpolatedLayers,
  };
}

function buildStateSnapshot(
  payload: RuntimeVariantPayload,
  stateId?: string,
): RuntimeSnapshot {
  const resolvedStateId = stateId ?? payload.variant.id;
  const layers = payload.states?.[resolvedStateId]?.layers ?? payload.layers ?? [];
  return {
    stateId: resolvedStateId,
    viewBox: [...payload.variant.viewBox],
    layers: layers.map((layer) => ({
      ...layer,
      key: layer.id,
      opacity: 1,
    })),
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
    case 'draw': {
      const drawConfig = (playback.effect as Record<string, unknown>).drawConfig as
        | { mode?: string; windowSize?: number; initialOffset?: number }
        | undefined;
      const mode = drawConfig?.mode ?? 'reveal';
      const offset = drawConfig?.initialOffset ?? 0;

      let trimStart = 0;
      let trimEnd = 0;
      const trimOffset = offset;
      switch (mode) {
        case 'reveal':
          trimStart = 0;
          trimEnd = progress;
          break;
        case 'erase':
          trimStart = progress;
          trimEnd = 1;
          break;
        case 'slide': {
          const ws = drawConfig?.windowSize ?? 0.2;
          trimStart = progress * (1 - ws);
          trimEnd = trimStart + ws;
          break;
        }
      }

      // Only apply trim to draw-eligible layers (open stroked paths).
      // Mirrors the EffectPlayer's filtering via isDrawEligible.
      const drawEligible = new Set(
        Object.keys(payload.draw?.layers ?? {}).sort((left, right) =>
          left.localeCompare(right),
        ),
      );
      nextSnapshot.layers = nextSnapshot.layers.map((layer) =>
        drawEligible.size === 0 || drawEligible.has(layer.id)
          ? { ...layer, trimStart, trimEnd, trimOffset }
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

function sampleTrack(track: RuntimeTrack, progress: number): number {
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
    ...bindings.map((binding: RuntimeTransition['layerBindings'][number]) => (binding.delayMs ?? 0) + (binding.durationMs ?? 0)),
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
      ...fromState.layers.map((layer: RuntimeLayer) => {
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
      ...toState.layers.map((layer: RuntimeLayer) => {
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
