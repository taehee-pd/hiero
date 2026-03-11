'use client';

import { useState } from 'react';

export function useIconState(initialState: string) {
  const [state, setState] = useState(initialState);

  return {
    state,
    transitionTo: setState,
  };
}
