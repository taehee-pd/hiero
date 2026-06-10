/**
 * Canonical, user-facing documentation links surfaced inside the app
 * (Navbar Help menu, command palettes, shortcuts dialog). Centralized
 * so the URLs change in one place when the docs move to a hosted site.
 */

const DOCS_BASE =
  'https://github.com/taehee-pd/icon-authoring-tool/blob/main/docs';

export const DOCS_LINKS = {
  userGuide: `${DOCS_BASE}/user-guide/index.md`,
  quickStart: `${DOCS_BASE}/user-guide/quick-start.md`,
  shortcuts: `${DOCS_BASE}/user-guide/files-export-and-shortcuts.md`,
  frameworkIntegration: `${DOCS_BASE}/guides/framework-integration-playbook.md`,
} as const;

/** Open a docs page in a new tab without handing it our window object. */
export function openDocs(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}
