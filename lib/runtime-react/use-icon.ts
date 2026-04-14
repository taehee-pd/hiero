import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';

import {
  createIconRuntimeStore,
  type IconRuntimeEffectRepeat,
  type IconRuntimeStore,
} from '@/lib/runtime-core/store';
import type { RuntimeVariantPayload } from '@/lib/export/export-runtime-json';

export type UseIconOptions = {
  payload: RuntimeVariantPayload;
  state?: string;
  defaultType?: string;
  transition?: boolean;
  effect?: string | null;
  effectRepeat?: IconRuntimeEffectRepeat;
  onTypeChange?: (stateId: string) => void;
};

export type UseIconResult = ReturnType<IconRuntimeStore['getSnapshot']> & {
  availableTypes: string[];
  availableEffects: string[];
  setState: (stateId: string) => void;
  playEffect: (
    effectId: string,
    options?: { repeat?: IconRuntimeEffectRepeat },
  ) => void;
};

export function useIcon({
  payload,
  state,
  defaultType,
  transition = true,
  effect,
  effectRepeat,
  onTypeChange,
}: UseIconOptions): UseIconResult {
  const initialStateRef = useRef<string | undefined>(undefined);
  initialStateRef.current = state ?? defaultType;

  const store = useMemo(
    () =>
      createIconRuntimeStore(payload, {
        initialStateId: initialStateRef.current,
      }),
    [payload],
  );

  useEffect(() => () => store.destroy(), [store]);

  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  const emitStateChange = useCallback((stateId: string) => {
    if (!onTypeChange) {
      return;
    }

    startTransition(() => {
      onTypeChange(stateId);
    });
  }, [onTypeChange]);

  useEffect(() => {
    if (state === undefined) {
      return;
    }

    store.setState(state, {
      immediate: transition === false,
    });
  }, [state, store, transition]);

  useEffect(() => {
    if (!effect) {
      return;
    }

    store.playEffect(effect, { repeat: effectRepeat });
  }, [effect, effectRepeat, store]);

  return {
    ...snapshot,
    availableTypes: Object.keys(payload.types ?? { [payload.variant.id]: { layers: payload.layers } }).sort((left, right) =>
      left.localeCompare(right),
    ),
    availableEffects: Object.keys(payload.effects ?? {}).sort((left, right) =>
      left.localeCompare(right),
    ),
    setState(nextStateId) {
      if (state !== undefined) {
        emitStateChange(nextStateId);
        return;
      }

      store.setState(nextStateId, {
        immediate: transition === false,
      });
      emitStateChange(nextStateId);
    },
    playEffect(effectId, options) {
      store.playEffect(effectId, options);
    },
  };
}
