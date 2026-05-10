'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_THEME, getTheme, setTheme as writeTheme, type Theme } from './index';

/**
 * useTheme — read/write the active design theme.
 *
 * SSR-safe: returns DEFAULT_THEME during render on the server and during
 * the first client render (matching server HTML), then resyncs to the
 * actual document state after mount. The same pattern KbdHint uses for
 * platform detection.
 */
export function useTheme(): { theme: Theme; setTheme: (next: Theme) => void } {
  const [theme, setLocal] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    setLocal(getTheme());
  }, []);

  const setTheme = useCallback((next: Theme) => {
    writeTheme(next);
    setLocal(next);
  }, []);

  return { theme, setTheme };
}
