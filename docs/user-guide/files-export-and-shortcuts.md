# Saving, Importing, Exporting, and Shortcuts

[Home](./index.md) | [Previous: Size Versions and Guides](./size-versions-and-guides.md)

## Project Files

Use `Save` in the top bar to download the current project as a JSON file. This keeps your icon collection, categories, size versions, guide setups, and styling choices together.

Use `Open Project` to load that project again later.

## Importing SVG

There are two ways to bring SVG artwork into the app:

- choose `Import SVG` from the top bar
- drag an SVG file directly onto the editor canvas

When an SVG is imported:

- a new icon is created
- the file name becomes the display name
- the icon gets an initial size based on the artwork bounds
- the imported shapes are turned into editable drawing layers

## Exporting SVG

Use `Export SVG` in the top bar to export the active icon version.

The exported SVG is cleaned for output:

- editor-only overlays are excluded
- guide visuals are excluded
- selection markers are excluded
- masking, gradients, transforms, fill rules, and stroke settings are preserved

## Undo and Redo

The top bar includes buttons for undo and redo. These let you safely explore drawing changes without losing earlier work.

## Zoom Controls

The top bar also includes:

- zoom percentage readout
- zoom out
- zoom in
- fit view

Fit view is helpful after switching to a very small or very large icon version.

## Keyboard Shortcuts

### Tools

- `V`: selection tool
- `A`: point-editing tool
- `P`: pen tool
- `U`: shape tool

### History

- `Cmd/Ctrl + Z`: undo
- `Cmd/Ctrl + Shift + Z`: redo
- `Ctrl + Y`: redo on Windows or Linux

### Canvas Helpers

- `Cmd/Ctrl + ;`: show or hide guides
- `Cmd/Ctrl + Shift + ;`: turn snapping on or off

### Layer Alignment

With multiple layers selected:

- `Cmd/Ctrl + Shift + L`: align left
- `Cmd/Ctrl + Shift + C`: align center horizontally
- `Cmd/Ctrl + Shift + R`: align right
- `Cmd/Ctrl + Shift + T`: align top
- `Cmd/Ctrl + Shift + M`: align center vertically
- `Cmd/Ctrl + Shift + B`: align bottom

### Point Editing

- `Delete` or `Backspace`: delete selected points, remove selected layers, or remove selected guides
- `Shift + C`: toggle point smoothness
- `Shift + O`: open or close the selected path
- `Shift + I`: insert a point after the current one
- arrow keys: nudge selected points
- `Escape`: step back from point editing, then clear the selection

### Guide Tips

- drag from a ruler to create a guide
- drag a guide beyond the editable icon area when you need to inspect placement
- drag a selection box to collect ruler guides together with other selections
- hold `Option` or `Alt` while dragging a guide to make a copy
- drag a guide back into its ruler to remove it
- release a guide outside the editable canvas to discard it
- use `Delete` or `Backspace` to remove the selected guide

### Navigation Tips

- hold `Space` and drag to pan the canvas
- drag with the middle mouse button to pan the canvas

## Recommended Habit

For the smoothest workflow:

1. import or open artwork
2. make a clean base version
3. create additional sizes above the canvas
4. refine each size with guides and snapping
5. save the project
6. export the version you need

## Related Pages

- [Quick Start](./quick-start.md)
- [Editor Workspace](./editor-workspace.md)
- [Drawing and Editing](./drawing-and-editing.md)
