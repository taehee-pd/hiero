import type { Icon, LayerSnapshot, RuntimeTransitionIntent, Transition, Variant } from '../schema';
import { variantToSnapshot } from '../schema/types';

export type SnapshotChangeListener = (snapshot: LayerSnapshot, transition: RuntimeTransitionIntent | null) => void;

/** Find a transition defined on the icon that matches from→to variant IDs. */
function findTransition(icon: Icon, fromVariantId: string, toVariantId: string): Transition | null {
  if (!icon.transitions) return null;
  return (
    Object.values(icon.transitions).find(
      (t) => t.fromVariantId === fromVariantId && t.toVariantId === toVariantId,
    ) ?? null
  );
}

export class StateMachine {
  private readonly icon: Icon;
  private variant: Variant;
  private readonly listeners = new Set<SnapshotChangeListener>();
  private snapshot: LayerSnapshot;

  constructor(icon: Icon, variantId?: string) {
    this.icon = icon;
    this.variant = resolveVariant(icon, variantId);
    this.snapshot = variantToSnapshot(this.variant);
  }

  get currentVariantId(): string {
    return this.variant.id;
  }

  get currentSnapshot(): LayerSnapshot {
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

    const transition = findTransition(this.icon, this.variant.id, nextVariant.id);

    this.variant = nextVariant;
    this.snapshot = nextSnapshot;
    this.emitChange(transition);
    return transition;
  }

  onSnapshotChange(callback: SnapshotChangeListener): () => void {
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
