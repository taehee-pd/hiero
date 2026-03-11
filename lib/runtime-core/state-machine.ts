import type { Icon, State, Transition, Variant } from '../schema';

export type StateChangeListener = (state: State, transition: Transition | null) => void;

export class StateMachine {
  private readonly icon: Icon;
  private readonly variant: Variant;
  private readonly listeners = new Set<StateChangeListener>();
  private state: State;

  constructor(icon: Icon, variantId?: string) {
    this.icon = icon;
    this.variant = resolveVariant(icon, variantId);
    this.state = resolveInitialState(this.variant);
  }

  get currentState(): State {
    return this.state;
  }

  transitionTo(stateId: string): Transition | null {
    const nextState = this.variant.states[stateId];
    if (!nextState) {
      throw new Error(`State "${stateId}" does not exist in variant "${this.variant.id}".`);
    }

    if (nextState.id === this.state.id) {
      return null;
    }

    const transition = findTransition(this.icon, this.state.id, nextState.id);
    this.state = nextState;
    this.emitChange(transition);
    return transition;
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

  private emitChange(transition: Transition | null): void {
    for (const listener of this.listeners) {
      listener(this.state, transition);
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

function resolveInitialState(variant: Variant): State {
  const initialState = variant.states[variant.defaultState];
  if (!initialState) {
    throw new Error(
      `Default state "${variant.defaultState}" does not exist in variant "${variant.id}".`,
    );
  }
  return initialState;
}

function findTransition(icon: Icon, fromStateId: string, toStateId: string): Transition | null {
  return (
    Object.values(icon.transitions).find(
      (transition) => transition.from === fromStateId && transition.to === toStateId,
    ) ?? null
  );
}
