import type { Icon, LayerSnapshot, RuntimeTransitionIntent, Variant } from '../schema';
import { variantToSnapshot } from '../schema/types';

export type StateChangeListener = (snapshot: LayerSnapshot, transition: RuntimeTransitionIntent | null) => void;

export class StateMachine {
  private readonly icon: Icon;
  private variant: Variant;
  private readonly listeners = new Set<StateChangeListener>();
  private snapshot: LayerSnapshot;

  constructor(icon: Icon, variantId?: string) {
    this.icon = icon;
    this.variant = resolveVariant(icon, variantId);
    this.snapshot = variantToSnapshot(this.variant);
  }

  get currentSnapshot(): LayerSnapshot {
    return this.snapshot;
  }

  /** @deprecated Use currentSnapshot instead */
  get currentState(): LayerSnapshot {
    return this.snapshot;
  }

  transitionTo(variantId: string): RuntimeTransitionIntent | null {
    const nextVariant = this.icon.variants[variantId];
    if (!nextVariant) {
      throw new Error(`Variant "${variantId}" does not exist in icon "${this.icon.id}".`);
    }

    const nextSnapshot = variantToSnapshot(nextVariant);

    // No-op if the target variant is the same
    if (nextVariant.id === this.variant.id) {
      return null;
    }

    this.variant = nextVariant;
    this.snapshot = nextSnapshot;
    // No built-in transitions on the icon — callers manage RuntimeTransitionIntents externally.
    this.emitChange(null);
    return null;
  }

  onStateChange(callback: StateChangeListener): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  dispose(): void {
    this.listeners.clear();
  }

  private emitChange(transition: RuntimeTransitionIntent | null): void {
    for (const listener of this.listeners) {
      listener(this.snapshot, transition);
    }
  }
}

function resolveVariant(icon: Icon, variantId?: string): Variant {
  if (variantId) {
    const variant = icon.variants[variantId];
    if (!variant) {
      throw new Error(`Variant "${variantId}" does not exist in icon "${icon.id}".`);
    }
    return variant;
  }

  const firstVariant = Object.values(icon.variants)[0];
  if (!firstVariant) {
    throw new Error(`Icon "${icon.id}" does not define any variants.`);
  }
  return firstVariant;
}
