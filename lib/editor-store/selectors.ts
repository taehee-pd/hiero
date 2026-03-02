import type { EditorStore } from './store';
import type { Icon, Variant, State, Layer } from '@/lib/schema/types';

export function selectCurrentIcon(s: EditorStore): Icon | null {
  if (!s.project || !s.currentIconId) return null;
  return s.project.icons[s.currentIconId] ?? null;
}

export function selectCurrentVariant(s: EditorStore): Variant | null {
  const icon = selectCurrentIcon(s);
  if (!icon || !s.currentVariantId) return null;
  return icon.variants[s.currentVariantId] ?? null;
}

export function selectCurrentState(s: EditorStore): State | null {
  const icon = selectCurrentIcon(s);
  if (!icon || !s.currentStateId) return null;
  return icon.states[s.currentStateId] ?? null;
}

export function selectCurrentLayers(s: EditorStore): Layer[] {
  const state = selectCurrentState(s);
  if (!state) return [];
  return Object.values(state.layers);
}

export function selectLayerById(
  s: EditorStore,
  layerId: string,
): Layer | null {
  const state = selectCurrentState(s);
  if (!state) return null;
  return state.layers[layerId] ?? null;
}

export function selectIconList(
  s: EditorStore,
): Array<{ id: string; name: string }> {
  if (!s.project) return [];
  return Object.values(s.project.icons).map((icon) => ({
    id: icon.id,
    name: icon.name,
  }));
}
