/**
 * Theme switcher — `data-theme` attribute on <html>.
 *
 * The default theme is "classic" (the brand identity defined in :root +
 * .dark in app/globals.css). Other themes override only the component
 * tokens they change; everything else cascades from :root.
 *
 * To add a theme:
 *   1. Add a `[data-theme="<id>"]` block in app/globals.css.
 *   2. Add the id to the `THEMES` array below so the type and
 *      `isTheme()` guard pick it up.
 *
 * Usage:
 *   import { useTheme } from '@/lib/theme';
 *   const { theme, setTheme } = useTheme();
 */

export const THEMES = ['classic', 'minimal', 'brutalist'] as const;

export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'classic';

const STORAGE_KEY = 'hiero:theme';

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/**
 * Read the active theme from the document. Returns DEFAULT_THEME on the
 * server (where document is undefined) or when the attribute is absent.
 */
export function getTheme(): Theme {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const attr = document.documentElement.getAttribute('data-theme');
  return isTheme(attr) ? attr : DEFAULT_THEME;
}

/**
 * Write the theme to <html data-theme="..."> and persist it. The
 * "classic" theme is represented by removing the attribute (since :root
 * is already classic by definition) — keeps the DOM clean for the
 * default case.
 */
export function setTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === DEFAULT_THEME) {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* localStorage may be unavailable (private mode, quota); ignore. */
  }
}

/**
 * Read the persisted theme from localStorage. Used by the inline boot
 * script in <head> to apply the theme before first paint, avoiding a
 * theme-flash. Server-safe: returns null when window is undefined.
 */
export function readPersistedTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Inline script that runs synchronously in <head> before React hydrates
 * to avoid a theme flash on first paint. Reads localStorage and sets
 * data-theme on <html> if the stored value differs from the default.
 *
 * Stringified at build time and rendered with dangerouslySetInnerHTML
 * inside layout.tsx. Keep it dependency-free and tiny.
 */
export const themeBootScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t&&t!=='${DEFAULT_THEME}'&&['${THEMES.join("','")}'].indexOf(t)>=0){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;
