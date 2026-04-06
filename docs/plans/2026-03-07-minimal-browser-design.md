---
status: implemented
last-reviewed: 2026-03-18
---

# Minimal Browser Design

Date: 2026-03-07

## Context

Contour already has both an explorer and an editor. The current redesign direction is to stop treating the explorer like a landing page and instead make both screens feel like one quiet tool.

## Approved Direction

- Use dense file-browser minimalism.
- Keep the explorer as the first working surface, not a homepage.
- Keep only the project name as default high-level copy on the explorer.
- Reduce editor labels and supporting text as far as possible without making controls ambiguous.

## Explorer Changes

- Remove hero-style messaging and all explanatory paragraphs.
- Replace the large header with a compact browser bar.
- Keep project name, search, and small numeric signals visible.
- Keep the left rail strictly functional: selection count, select all, clear, category input, apply.
- Tighten icon cards for faster scanning and reduce metadata noise.

## Editor Changes

- Keep the editor layout, but reduce the chrome to a quieter pro-tool surface.
- Compress the current icon header to name, state chips, and back action.
- Remove verbose toolbar group copy and keep only minimal orientation labels where needed.
- Keep panel empty states short and direct.

## Copy Rule

- Remove instructional and promotional UX copy.
- Keep labels only where they prevent ambiguity.
- Allow short empty-state text and error-state text.
