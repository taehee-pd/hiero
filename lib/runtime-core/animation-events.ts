export type AnimationEventType =
  | 'transitionStart'
  | 'transitionComplete'
  | 'effectStart'
  | 'effectComplete';

export type AnimationEvent = {
  type: AnimationEventType;
  fromState?: string;
  toState?: string;
  effectId?: string;
  timestamp: number;
};

export type AnimationEventCallback = (event: AnimationEvent) => void;
