# Hiero Studio — UI Kit

High-fidelity React recreation of the Hiero Studio workspace. Modeled directly on `_src/components/studio/` from the source repo (`github.com/taehee-pd/icon-authoring-tool`).

## Structure

| File | What |
|------|------|
| `index.html` | Interactive app shell — renders the full 3-pane studio layout with sample projects/icons |
| `studio.css` | Component styles; reads tokens from `../../colors_and_type.css` |
| `Primitives.jsx` | `IconButton`, `StatusBadge`, `Kbd` — atomic pieces used across the kit |
| `Navbar.jsx` | Top 40px bar — logo menu trigger, project name (inline-editable), save status, quick-action icons |
| `NavPane.jsx` | Left project list — 230px expanded / 40px collapsed |
| `ListPane.jsx` | Middle icon grid — search + 3-col grid with selection states |
| `Editor.jsx` | Right tools + canvas + properties panel |

## Interactive behavior

- Click a project in the left rail to switch icon sets
- Click an icon cell to open it in the editor; Cmd/Ctrl-click to multi-select
- Click the project name in the navbar to rename (Enter to commit, Esc to cancel) — sets the "Unsaved" badge
- Collapse either pane with the chevron button in its header

## Notes / deviations from source

- Icons throughout use **Lucide** (CDN) as a stand-in for the in-app icon runtime — the real Studio renders user-authored icons from its store. Stroke width and 14px sizing match the original `IconButton`.
- The canvas is a static placeholder — the real editor has a full vector path editor, path/point tools, snapping, guides, transitions. The **Properties panel** shows plausible field shapes (Appearance / Variants / States) without wiring real state.
- Menus, dialogs, and command palette from `Navbar.tsx` are not implemented — the menu button is decorative.
- Theme switcher is omitted; the kit renders dark-mode only (the source supports light/dark/system via `next-themes`).
