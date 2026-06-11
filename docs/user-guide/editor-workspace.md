# Editor Workspace

[Home](./index.md) | [Previous: Library and Browsing](./library-and-browsing.md) | [Next: Drawing and Editing](./drawing-and-editing.md)

## Layout

Hiero is a single-screen studio. The layout has four areas that are always present at once: the Navbar along the top, the collapsible NavPane on the far left, the collapsible ListPane next to it, and the embedded editor filling the remainder of the screen.

## Navbar

The Navbar runs across the top and gives you access to:

- **Hiero menu** — a logo-triggered dropdown with submenus for File (New Project, Open Project, Save draft, Export project file, Import Icons), Edit (Undo, Redo), Export (Quick ZIP, React library, Lottie JSON, Publish), and View (theme toggle, Search). Also contains Keyboard Shortcuts, User Guide, and Framework Integration links.
- **Project name** — click to rename the active project inline.
- **Save status badge** — shows the current save state (unsaved, autosaved, draft saved, or published) with a relative timestamp.
- **Save draft** button (`Cmd/Ctrl+S`) — stores a local checkpoint without downloading a file.
- **Undo / Redo** buttons — mirror the history stack; disabled when there is nothing to undo or redo.
- **Publish** button (`Cmd/Ctrl+Shift+P`) — opens the unified Publish dialog to release icons to a configured target (git PR, npm registry, or local directory).
- **History** button — navigates to the version history page. A small dot appears when there are new published snapshots.
- **Search** (`Cmd/Ctrl+K`) — opens the command palette to search icons or run actions.

## NavPane (Projects)

The NavPane is the collapsible sidebar on the far left. It lists all the projects (icon sets) in the current workspace. Use it to:

- switch between projects
- create a new project
- rename or delete an existing project

Click the collapse button or the vertical "Projects" label to toggle the pane between a full list (230 px) and a narrow rail (40 px). The rail shows project names as tooltips on hover.

## ListPane (Icon Browser)

The ListPane sits between the NavPane and the editor. When a project is selected it shows:

- a search box to filter icons by name, identifier, category, or tags
- a 3-column icon grid with marquee (drag-to-select) support
- per-icon context menus for open, rename, duplicate, delete, and favorite toggle
- a New icon button, an Import icons button, and a Quick ZIP export button in the header
- a selection mode header when one or more icons are selected (shows count and bulk download)

You can also drag SVG files onto the ListPane to import them in bulk.

Click the collapse button or the vertical "Icons" label to toggle the pane between the full grid view and a narrow rail.

## Embedded Editor

When an icon is open, the editor fills the main area. It is itself split into three columns:

### Left panel (Icon / Guides)

A tab strip at the top switches between two modes:

- **Icon tab** — shows the layer list for the current size variant. Use it to select, hide, or reorder layers. The icon name is displayed and editable at the top of this panel.
- **Guides tab** — shows the guide manager where you can create, duplicate, rename, and remove guide overlays, and toggle their visibility.

Above the canvas, a variant picker lets you switch between size-specific versions of the same icon and add or remove sizes.

### Canvas (center)

The canvas is where you draw and edit. It supports:

- pan and zoom
- drag-selection boxes for layers, points, and ruler guides
- direct SVG import by dragging a file onto the canvas
- ruler-based guide creation by dragging from a ruler
- point boxes and handles when point editing is active
- snap feedback while moving points

Hold the spacebar to pan temporarily, or drag with the middle mouse button.

### Right inspector

The right inspector changes depending on what is selected. It shows controls for:

- shape drawing options
- layer information
- clipping and boolean operations
- alignment and distribution
- fill and stroke styling
- point editing
- transforms

A tab strip at the top of the inspector switches between **Inspect** (layer and geometry controls) and **Animation** (transition and effect settings).

## When No Icon Is Open

If a project is selected but no icon is open, the editor area shows a prompt to select an icon. If no project is selected, it prompts you to select a project.

## Related Pages

- [Drawing and Editing](./drawing-and-editing.md)
- [Size Versions and Guides](./size-versions-and-guides.md)
- [Saving, Importing, Exporting, and Shortcuts](./files-export-and-shortcuts.md)
